# 登录 Session 过期改为 Idle-Based，不再是固定 1h

> **范围**：`JwtAuthTokenFilter`、`JwtService`、`AuthCookieHelper`、`AuthTokenStore`、
> `application.yml`/`application.yml.example`。
> **最后更新**：2026-09-24

---

## 1. 问题：登录满 1 小时就强制掉线，跟有没有在操作无关

登录时会做两件事：签发一个 JWT（`exp` 写死"登录时间 + 1h"），以及在 Redis 里存一份 session（TTL
同样固定 1h）。这两处都**只在登录那一刻设置一次，之后再也没被更新过**——哪怕用户一直在操作，
1 小时一到，JWT 签名过期 + Redis key 自然淘汰，直接被踢下线，跟"这一小时里到底有没有在用"完全无关。

对还在正常操作的用户来说，这是一个纯粹的体验问题：明明一直在用，却会被莫名其妙地登出。

## 2. 修复思路：把"固定 1h"拆成两层

- **Idle-timeout（会不会被登出，看活跃度）**：每次带 JWT 的请求进来，`JwtAuthTokenFilter` 都会调
  `AuthTokenStore.touch(jti, accessTokenExpiration)`，把 Redis 里这个 session 的 TTL 重新往后推
  一个 `accessTokenExpiration`（1h）。只要用户在 1 小时内至少有一次请求，session 就不会掉——真正
  决定登出的，是"连续 1 小时完全没有任何请求"，不是"登录后固定 1 小时"。
- **JWT 自身的签名过期（`exp`）单独拆出一个更长的外层上限**：新增 `jwtExpiration`
  （`spring.jwt.jwt-expiration`，默认 7 天）。JWT 的 `exp` 用这个值签发，不再跟着
  `accessTokenExpiration` 走——否则 JWT 本身签名过期这道硬限制会先于 Redis 的 idle 判断触发，
  activity 再多也救不回来，等于白改。
- **Cookie 的 `Max-Age` 对齐到 `jwtExpiration`，不是 `accessTokenExpiration`**：如果还按 1 小时
  设置，浏览器会在正常持续操作的第 1 小时准时把 cookie 扔掉，跟"idle 才登出"的目标矛盾。

三者关系：`accessTokenExpiration`（1h，idle 窗口，靠活跃度滑动续期）
< `jwtExpiration` = `refreshTokenExpiration`（7d，外层硬上限，登录时一次性签发，不会被活跃度续期，
到点必须重新登录）。

## 3. 具体改动

- [`JwtAuthTokenFilter.java`](../backend/src/main/java/com/eazycount/jwt/JwtAuthTokenFilter.java) ——
  校验通过后立刻调 `authTokenStore.touch(jti, jwtService.getAccessTokenExpiration())`，滑动续期
  Redis session 的 TTL。
- [`JwtService.java`](../backend/src/main/java/com/eazycount/jwt/JwtService.java) —— 新增
  `jwtExpiration` 字段（默认 604800000ms = 7 天），`createAccessToken` 签发 `exp` 时改用这个值，
  不再用 `accessTokenExpiration`。
- [`AuthTokenStore.java`](../backend/src/main/java/com/eazycount/security/AuthTokenStore.java) ——
  新增 `touch(jti, ttlMillis)`：只重设 Redis key 的过期时间，不重写 session 内容本身。
- [`AuthCookieHelper.java`](../backend/src/main/java/com/eazycount/security/AuthCookieHelper.java) ——
  cookie `Max-Age` 从 `accessTokenExpiration` 改成 `jwtExpiration`。
- `application.yml` / `application.yml.example` —— 新增 `spring.jwt.jwt-expiration: 604800000`
  配置项，并给 `access-token-expiration` 补充注释说明它现在是"idle 窗口"而不是"固定过期时间"。

同一个 commit 里顺带修了一处不相关的小问题：
[`UserServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/UserServiceImpl.java)
的 `updateUserDetails` 原本会把 `BusinessException`（比如校验失败的业务错误）也吞进通用
`catch (Exception e)`，统一包装成一句"Update User failed!"，导致真实的校验错误信息丢失；补了一个
`catch (BusinessException e) { throw e; }` 让业务异常原样透传。跟 session 过期改造本身无关，只是
顺手带上的修复。

## 4. 已确认不受影响的地方

- **登出（logout）/ 踢人（system_maintenance_mode）流程不变**：两者都是主动删除 Redis key
  （`AuthTokenStore.delete`）或整体拒绝请求，不经过 `touch`，跟 idle 续期逻辑没有交叉。
- **Refresh token 机制维持原样**：`refreshTokenExpiration`（7d）本来就独立于
  `accessTokenExpiration`，这次改动前后都没变过；新增的 `jwtExpiration` 只是让 access token 的
  `exp` 也对齐到跟 refresh token 一样长的量级，两者目前数值相同（7d）但语义上是两个独立配置项，
  以后可以分开调。
