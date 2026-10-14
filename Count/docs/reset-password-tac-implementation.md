# Reset Password（Admin/User）— TAC 验证码 + Spring Boot 实现

> **范围**：`AuthController` / `AuthService` / `AuthServiceImpl` 新增两个端点，新建
> `PasswordResetTacStore`（Redis）+ `PasswordResetMailService`（JavaMail），`AuthDao` /
> `LoginMapper.xml` 补两条 SQL，`pom.xml` + `application.yml` 加 mail 依赖与配置。
> **2026-10 起 admin 与 owner 都支持，且接口参数已改**——以第 8 节为准；第 2、5、6 节描述的是最初只支持 admin 的版本。
> **最后更新**：2026-10-14

---

## 1. 背景

`docs/known-issues-data capture.md` 第 2 項原本记录：前端 `authApi.js` 已经封装好
`sendResetTacRequest()` / `resetPasswordRequest()`，但**后端 `AuthController` 里这两个方法完全
不存在**——`SecurityConfig` 提前把 `/auth/send-reset-tac`、`/auth/reset-password` 列进
`permitAll()`，只是占位，没有真正的实现。旧 PHP 的 `send_reset_tac_api.php` /
`reset_password_api.php` 在仓库里也已经找不到了。本次从零实现这条链路。

---

## 2. 新增端点

| 方法 | 路径 | 参数（form-data） | 说明 |
|------|------|----|------|
| POST | `/auth/send-reset-tac` | `tenant_code`, `email` | 校验通过就寄 TAC；找不到账号会返回具体错误，见第 8 节 |
| POST | `/auth/reset-password` | `tenant_code`, `email`, `tac`, `new_password` | 验证 TAC（一次性消费）成功后更新 `user.password` |

两个端点都在 `AuthController`（[`AuthController.java`](../backend/src/main/java/com/eazycount/controller/AuthController.java)），委托给 `AuthServiceImpl.sendResetTac` /
`resetPassword`。校验失败（冷却中、TAC 错误/过期、字段缺失）会抛 `BusinessException`，经
`GlobalExceptionHandler` 转成 `{"status":"error","message":"..."}`；成功统一回
`{"success":true,"message":"..."}`。

---

## 3. TAC 存储改用 Redis（不用 DB 表）

新建 [`PasswordResetTacStore`](../backend/src/main/java/com/eazycount/security/PasswordResetTacStore.java)（仿现有 `AuthTokenStore` 的写法），三类 key，都挂在
`ec:auth:reset-*` 前缀下：

| Key | 用途 | TTL | 命令 |
|-----|------|-----|------|
| `ec:auth:reset-tac:{scope}:{tenantCode}:{email}` | TAC 本体（6 位数字） | 15 分钟 | `SET EX` |
| `ec:auth:reset-cooldown:{scope}:{tenantCode}:{email}` | 60 秒重发冷却锁 | 60 秒 | `SET NX EX` |
| `ec:auth:reset-attempts:{scope}:{tenantCode}:{email}` | 验证失败次数计数器 | 与 TAC 同步过期 | `INCR` |

`scope` 目前固定是 `"admin"`（`AuthServiceImpl.RESET_SCOPE_ADMIN`），为将来 owner 那一半预留。

- **一次性使用**：`verifyAndConsume()` 验证成功立刻 `DEL` 掉 TAC key，同一个码不能重放。
- **失败次数限制**：验证错误达到 5 次（`MAX_ATTEMPTS`），直接让该 TAC 失效（连同计数器一起删掉），
  防止暴力枚举 6 位数字。
- **冷却锁必须在后端强制**：`tryClaimCooldown()` 用 `SET NX EX 60` 抢锁，抢不到就返回剩余秒数，
  `AuthServiceImpl.sendResetTac` 直接 `throw new BusinessException("Please wait " + remaining + "s ...")`；
  前端按钮 disable 60 秒只是体验优化，不是唯一防线。
- `schema.sql` 里原本的 `password_reset_tac` / `password_reset_tac_owner` 两张表**保留未删**，
  Redis 化之后功能上已经不需要它们，要不要 `DROP` 留给之后决定。

---

## 4. 邮件发送

新建 [`PasswordResetMailService`](../backend/src/main/java/com/eazycount/mail/PasswordResetMailService.java)，走 `spring-boot-starter-mail` + `JavaMailSender`（新加进
`pom.xml`）。`application.yml` 新增：

```yaml
spring:
  mail:
    host: ${MAIL_HOST:localhost}
    port: ${MAIL_PORT:1025}
    username: ${MAIL_USERNAME:}
    password: ${MAIL_PASSWORD:}
    default-encoding: UTF-8
    properties:
      mail:
        smtp:
          auth: ${MAIL_SMTP_AUTH:false}
          starttls:
            enable: ${MAIL_SMTP_STARTTLS:false}

app:
  mail:
    from: ${MAIL_FROM:no-reply@eazycount.local}
```

- **本地开发默认指向 `localhost:1025`**（MailHog / smtp4dev 之类的假 SMTP 抓包工具），不需要真的
  发信就能测试整条链路。
- **要接真实 Gmail**：`host=smtp.gmail.com`、`port=587`、`auth`/`starttls` 都要 `true`，
  `username`/`password` 用环境变量传（**不要把明文密码写进 `application.yml`**）。Gmail 现在强制要求
  用「[应用专用密码](https://myaccount.google.com/apppasswords)」而不是账号本身的登录密码，且该
  Gmail 账号必须先开两步验证才能生成应用专用密码；如果账号被组织/Workspace 托管、或开了「高级保护
  计划」，可能完全无法生成应用专用密码，需要换一个普通 `@gmail.com` 账号或改用 SendGrid/Mailgun 等
  第三方邮件服务。
- **发信失败不抛给调用方**：`sendResetCode()` 内部 `catch (MailException e)` 只记 log，不往上抛——
  否则 SMTP 故障会被前端观察到、间接暴露"这个请求原本是要发信的"这个信息，等于变相回显了账号是否
  存在。

---

## 5. Service 层实现要点（`AuthServiceImpl`）

```java
sendResetTac(tenantCode, email):
    抢冷却锁 → 没抢到就 throw（前端会显示剩余秒数）
    查 user 表（AuthDao.findAdminByEmail）+ 校验该 admin 对这个 tenantCode 有访问权限
      （复用已有的 findAccessibleTenantsByAdminId，跟登录逻辑一致）
    只有查到才真的生成 TAC + 发信；查不到也不报错、不提前 return，
      调用方永远看到同一句「如果账号存在，验证码已发送」

resetPassword(tenantCode, email, tac, newPassword):
    verifyAndConsume 失败 → throw "Verification code is invalid or expired"
    再查一次 admin + tenant 权限（防止 TAC 验证和实际改密码之间账号被删/停用的竞态）
    BCrypt 加密新密码，AuthDao.updateAdminPassword(id, hash)
```

`email` 在 `user` 表上是全局唯一（`uk_user_email`），`tenant_code` 主要用来确认这个 admin
确实挂在这个 tenant 下（跟登录时的校验逻辑保持一致），不是用来当查找 key。

---

## 6. 已知缺口 / 后续要做的事

- **Owner 那一半没做**：`password_reset_tac_owner` 对应的重置流程尚未实现。之后要做的话，
  `AuthServiceImpl` 已经把 `RESET_SCOPE_ADMIN` 抽成一个独立常量，加一个 `RESET_SCOPE_OWNER`
  走 `Owner` 相关查询（`authDao.findOwnerByOwnerCode`/邮箱）即可复用同一套 `PasswordResetTacStore`
  和 `PasswordResetMailService`，`AuthController` 需要一个方式区分是 admin 还是 owner 在重置
  （目前前端 `ResetPasswordPage.jsx` 只有 tenant_code + email，没有角色选择）。
- **没有独立的"仅验证 TAC 不消费"接口**：验证和改密码在同一次 `resetPassword` 调用里原子完成。
  讨论过是否要做成"TAC 验证成功才显示密码框"的分步 UI，结论是不做——分步需要额外接口和状态管理，
  且不提升实际安全性，见前端文档第 5 节。
- **`password_reset_tac` / `password_reset_tac_owner` 表**：保留未删，Redis 化后已经不需要，
  是否 `DROP` 待之后决定。
- 尚未做端到端的真实 SMTP 联调测试（本地 `mvn compile` 已通过，但收发邮件那一步需要人工用真实
  Gmail 账号或 MailHog 验证）。

---

## 8. 2026-10 更新：Admin / Owner 都可重置

### 8.1 接口（form-data）

| 路径 | 参数 |
|---|---|
| `POST /auth/send-reset-tac` | `role`(`admin`\|`owner`), `tenant_code`, `login_id` **或** `name`, `email` |
| `POST /auth/reset-password` | 同上 + `tac`, `new_password` |

- 账号怎么找：`login_id` 非空时按登录 ID（admin：该公司下的 `login_id`；owner：`owner_code`）；为空则按 `name` + `email`。**两种方式邮箱都必须和账号登记的邮箱一致**，并且账号要对该 `tenant_code` 有访问权限。
- 用名字找 owner 时，`owner.email` 没有唯一约束，如果「同邮箱 + 同名」找到多个 owner，按「找不到」处理（不发验证码）。admin 因 `user.email` 唯一，按邮箱找到后再核对名字。
- 角色由前端的 Admin / Owner 选择决定，不再先查 admin 再查 owner，所以同一个邮箱既是 admin 又是 owner 也不会混。
- `send-reset-tac` **会说明哪里不对**（2026-10 改动，方便用户自己改正）：公司不存在 → `Group/Company Not Found!`；登录ID不存在 / 邮箱不存在 → `Login ID not found` / `Email not found`；邮箱与账号不符 → `Email does not match this account`；名字与邮箱不符 → `Name does not match this email`；同邮箱同名的 owner 多于一个 → 请改用登录ID；账号无权访问该公司 → `You do not have access to this Company or Group`。代价是别人可以借此探测账号是否存在，已有的发信冷却只限制发信、不限制探测。`reset-password` 仍然只回「验证码无效或已过期」。冷却改为**找到账号之后**才占用，输错信息不会锁住用户 60 秒。

### 8.2 只改主密码

- **二级密码不受影响，也不接收二级密码参数**（owner 一定有、admin 仅 C168 且设置过才有；登录后是否要输入二级密码仍由账号当前状态决定）。要改二级密码走客服/IT。
- 新密码在**消耗验证码之前**先校验（不设强度限制，只要求非空、不超过 72 字节——bcrypt 只读前 72 字节），不合格不会白白用掉验证码。

### 8.3 Redis key 的变化

| Key | 现在的 identity |
|---|---|
| 冷却 `reset-cooldown:{role}:…` | `{公司}:{邮箱}` |
| 验证码 / 失败次数 `reset-tac:{role}:…` | **账号 id**（解析到账号后才有），验证码绑定具体账号，不再绑定输入的字符串 |

`reset-password` 的顺序：校验新密码 → 解析账号（找不到 = 「验证码无效或已过期」）→ 验证并消耗验证码 → 更新密码。

### 8.4 重置成功之后

- `AuthTokenStore.deleteAllForUser`：结束该账号的全部会话。会话 jti 按账号记在 Redis 集合 `ec:auth-user-sessions:{user_type}:{id}`（TTL 8 天，长于 JWT 的 7 天上限）；**部署前已登录的旧会话没有记入集合，不会被踢**，它们最多再存活 1 小时空闲时间。
- 给账号邮箱发「密码已更改」通知邮件。
- 邮件改成**异步发送**（`PasswordResetMailService` 内的小线程池），请求不再等 SMTP。

### 8.5 仍需注意

- `owner.email` 没有唯一约束（另行处理）；没有邮箱的 owner 无法使用此功能。
- IT 运维账号（`it-operators.yml`）和 member 不支持重置。
- 本地只验证了编译通过；发信、Redis 流程需要真实 SMTP/MailHog 联调。

---

## 7. 参考文件

- [`AuthController.java`](../backend/src/main/java/com/eazycount/controller/AuthController.java)
- [`AuthService.java`](../backend/src/main/java/com/eazycount/service/AuthService.java) /
  [`AuthServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/AuthServiceImpl.java)
- [`PasswordResetTacStore.java`](../backend/src/main/java/com/eazycount/security/PasswordResetTacStore.java)
- [`PasswordResetMailService.java`](../backend/src/main/java/com/eazycount/mail/PasswordResetMailService.java)
- [`AuthDao.java`](../backend/src/main/java/com/eazycount/dao/AuthDao.java) /
  [`LoginMapper.xml`](../backend/src/main/resources/mybatis/LoginMapper.xml)
- 前端对应文档：`Count-frontend/docs/reset-password-tac-implementation.md`
