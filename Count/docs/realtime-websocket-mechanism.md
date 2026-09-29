# 实时功能（WebSocket / STOMP）

> **范围**：流水（Transaction/Ledger）实时同步、通告（Announcement/Maintenance 跑马灯）全平台实时广播、IT "踢人开关"实时强制登出。
> **状态**：三个场景均已实现并验证（多账号多浏览器实测通过）。
> **前端对应**：`Count-frontend/src/lib/realtime/`（`subscribeAppRealtime.js`、`realtimeEvents.js`、`realtimeInvalidationRules.js`、`AppRealtimeBridge.jsx`），挂载点 `Count-frontend/src/components/AuthenticatedLayout.jsx`。
> **后端对应**：`com.eazycount.websocket` 包。
> **最后更新**：2026-09-21

---

## 1. 需求 & 设计决策

### 1.1 为什么选 WebSocket(STOMP) 而不是前端原本留的 SSE

前端迁移自旧 PHP 系统时，`src/lib/realtime/` 整套事件总线（`realtimeEvents.js` 的 `dispatchRealtimeInvalidate`/`onRealtimeInvalidate`、`AppRealtimeBridge.jsx` 的缓存失效规则、26 个页面的 `useRealtimeDomain` 订阅）都完整保留了下来，只有传输层（`subscribeAppRealtime.js`）被写死成 `{ enabled: false }` 的桩代码——因为它是照抄 PHP 那套 SSE + ticket 鉴权设计的，Spring 后端从未实现过对应接口。

决定**整个传输层推倒重做**，改用 WebSocket(STOMP)，理由：
- 双向、连接复用成本低，比 SSE 更适合"多个不同 domain 各自订阅"的场景。
- 事件总线（`realtimeEvents.js`）本身跟传输方式无关（只是 `window.dispatchEvent`/`window.addEventListener` 的封装），换协议不需要改这一层，也不需要改 26 个页面的订阅代码。

### 1.2 鉴权：为什么不用 STOMP CONNECT header 带 token

最初设计是前端在 STOMP `CONNECT` 帧的 header 里带 `Authorization: Bearer <token>`。后来发现后端的 JWT 存在 **httpOnly** 的 `ec_access_token` cookie 里（`AuthCookieHelper`），前端 JS 根本读不到这个 token，没法塞进 header。

改成复用现有登录态：WebSocket/STOMP 的握手本质上还是一次普通 HTTP 请求，浏览器会自动带上 cookie，现成的 `JwtAuthTokenFilter` 会照常认证、写入 `SecurityContextHolder`。`PrincipalHandshakeInterceptor`（`HandshakeInterceptor`）在握手阶段把这个已认证的身份从 `SecurityContextHolder` 复制进 WebSocket 握手的 `attributes`，`PrincipalHandshakeHandler`（`DefaultHandshakeHandler` 子类）再把它绑定成这条 STOMP 连接长期持有的 `Principal`（因为升级成 WebSocket 之后，后续帧不会再走一次 Servlet 过滤器链，身份必须在握手这一刻就固定下来）。握手时没有认证成功直接返回 401，拒绝升级。

### 1.3 Topic 设计：全局广播 vs 按公司广播

一开始只设计了 `/topic/company/{companyId}/{domain}` 一种（按租户隔离）。后来查 SQL 映射发现通告表的查询**写死 `company_code = 'C168'`**，不区分租户——通告本来就是全平台共享一份，不是按公司隔离的。于是扩成两种：

- `/topic/company/{companyId}/{domain}` —— 按租户隔离（`ledger`/`accounts`/`processes`/`datacapture`/`ownership`/`users`/`maintenance`/`domain`），订阅时用 `StompSubscriptionAuthInterceptor` 校验 `SessionUser.tenant_id` 是否匹配。
- `/topic/global/{domain}` —— 全平台广播（`announcements`），任何认证过的会话都能订阅，不做租户校验。

`maintenance` 这个 domain 名字前端本来就复用了两次（跑马灯公告用全局广播，维护页面删除记录用按公司广播），所以前端订阅时**每个 domain 都同时订阅两种形状**（`/topic/global/{domain}` + `/topic/company/{id}/{domain}`），不用区分某个 domain 到底该走哪种——用不到的那一种只是一个不会收到消息的空订阅，无害。

### 1.4 发布时机：事务提交之后

业务 Service 不直接调用 `SimpMessagingTemplate`，而是发一个 `RealtimeDomainEvent`（Spring `ApplicationEvent`），由 `RealtimeBroadcastListener` 用 `@TransactionalEventListener(phase = AFTER_COMMIT, fallbackExecution = true)` 监听，事务真正提交后才广播。避免"客户端收到通知立刻发请求，但事务还没提交、查到旧数据"的竞态。`fallbackExecution = true` 保证调用方即使不在事务里（比如 `SystemMaintenanceModeServiceImpl.setEnabled` 不是 `@Transactional`）也能立即触发。

### 1.5 前端：配置表驱动，替代 if/else 链

`AppRealtimeBridge.jsx` 原本是一串按 domain 分支的 `if/else`，新增/修改一个 domain 的处理逻辑要改这个函数本身。重构成 `realtimeInvalidationRules.js` 里一份声明式配置表（`RULES`），每个 domain 一条：`sideEffects`（清缓存的函数）、`queryKeys`/`queryPredicate`（要失效的 TanStack Query 缓存）、`ledgerTouching`（要不要连带清流水缓存，`true` 或按 `source` 判断的函数）。`AppRealtimeBridge.jsx` 只保留一个通用执行器 `runRealtimeInvalidationRule`，不用再碰。

`LEDGER_TOUCHING_SOURCES` 是这份配置表里的一个共享白名单：不是"哪些 domain 需要实时"，而是"哪些写入动作虽然发生在别的 domain（比如 Maintenance 页面删一笔记录），但也顺带改了账户余额，所以 Transaction 页面也要连带刷新"。

---

## 2. 后端分层（`com.eazycount.websocket`）

| 文件 | 职责 |
|---|---|
| `WebSocketConfig` | 注册 `/ws` 端点（**纯 WebSocket，不用 SockJS** — 见 §4.2）、消息代理前缀（`/topic` 广播、`/app` 上行） |
| `PrincipalHandshakeInterceptor` / `PrincipalHandshakeHandler` | 握手阶段把 `SecurityContextHolder` 里的登录身份绑定成 STOMP 连接的 `Principal`（见 §1.2） |
| `StompSubscriptionAuthInterceptor` | 订阅时校验：`/topic/company/{id}/...` 检查租户匹配；`/topic/global/...` 放行；两种格式之外的一律拒绝 |
| `RealtimeDomain` | 枚举，wire name 要跟前端 `REALTIME_DOMAINS`（`realtimeEvents.js`）逐字对齐 |
| `RealtimeDestinations` | 构建/解析 topic 字符串（`companyTopic`/`globalTopic`/`parseCompanyTopic`/`parseGlobalTopic`） |
| `RealtimeEventPublisher` | 业务 Service 调用的入口：`publish(companyId, domain, source)` / `publishGlobal(domain, source)` |
| `RealtimeDomainEvent` | 内部事件 POJO，`companyId == null` 代表广播到全局 topic |
| `RealtimeBroadcastListener` | `@TransactionalEventListener(AFTER_COMMIT)`，把事件真正发到 `SimpMessagingTemplate` |

### 已接入的业务写入点

| Domain | Source | 方法 |
|---|---|---|
| `announcements`（全局） | `announcement_create`/`update`/`delete` | `AnnouncementServiceImpl` |
| `maintenance`（全局，跑马灯） | `maintenance_create`/`update`/`delete` | `AnnouncementServiceImpl` |
| `ledger`（按公司） | `post_to_transaction` | `TransactionSubmitServiceImpl.submit`、`BankAccountingDueServiceImpl.postToTransaction` |
| `ledger`（按公司） | `restore` | `BankAccountingDueServiceImpl.resolveInbox`（还原被跳过的账期） |
| `maintenance`（按公司） | `payment_delete` | `MaintenanceServiceImpl.deletePaymentMaintenanceRows` |
| `maintenance`（按公司） | `bankprocess_delete` | `MaintenanceServiceImpl.deleteBankProcessMaintenanceRows`、`BankProcessServiceImpl.deleteBankProcess` |
| `datacapture`（按公司） | `capture_delete` | `MaintenanceServiceImpl.deleteMaintenanceCaptureRows` |
| `datacapture`（按公司） | `summary_submit` | `DataCaptureSummaryServiceImpl.submit` |
| `domain`（按公司） | `domain_fee_create` | `DomainFeeChargeServiceImpl.chargeDomainFee` |
| `session_kick`（全局，非缓存失效类，见 §3） | `maintenance_mode_enabled` | `SystemMaintenanceModeServiceImpl.setEnabled(true)` |

`accounts`/`processes`/`ownership`/`users` 这 4 个 domain **刻意未接**——评估后判断这四个纯粹是"列表页多人协作时的同步"场景，跟用户实际要的三个目标（流水、通告、踢人）无关，性价比不够，决定跳过。

`LEDGER_TOUCHING_SOURCES` 里另外 4 个 source（`payment_update`/`transaction_delete`/`capture_update`/`domain_fee_update`）调查后**没找到对应的后端方法**，已从前端白名单里删除（不是"待接"，是判断这几个动作现在后端压根没有对应的独立写入路径）。

---

## 3. "踢人开关"——不走缓存失效那套配置表

`SESSION_KICK` 不是一个"数据变了、去刷新缓存"的普通 domain，是一条**强制登出命令**：IT 打开系统维护/踢人开关（`SystemMaintenanceModeServiceImpl.setEnabled(true)`）时，广播给所有在线连接，前端收到后立刻跳转登录页，不经过 `realtimeInvalidationRules.js` 的规则表。

前端在 `AuthenticatedLayout.jsx` 里直接用 `onRealtimeInvalidate(REALTIME_DOMAINS.SESSION_KICK, ...)` 单独监听，复用抽出来的 `forceLogoutForMaintenanceKick()` 函数（跟原有的 30 秒轮询、同浏览器跨 tab 广播共用同一段清缓存+跳转逻辑）。IT 账号本身用 `isItOperator(me)`（`sidebarPermissions.js`，判断 `role === "it"`）豁免，不受这个开关影响。

原有的 30 秒轮询 + 跨 tab 广播机制**没有删除**，作为兜底保留（比如 WebSocket 连接意外断开时还能靠轮询发现）。

---

## 4. 踩过的坑

### 4.1 Vite 配置改了不会热重载

给 `vite.config.js` 加 `/ws` 代理条目（`ws: true`，让 WebSocket 请求跟 `/api`/`/auth` 一样走同源代理转发到后端）之后，正在跑的 dev server 进程不会自动感知——**改 `vite.config.js` 必须重启 dev server**，Vite 不会像改普通源码那样热更新配置文件本身。排查耗了一轮：后端代码明明是最新的（Java 进程/`.class` 文件时间戳都对得上），但前端一直连不上，最后发现是 dev server 进程比配置改动的时间还早。

### 4.2 SockJS 一开始被怀疑是元凶，其实是误判（但顺手拿掉了）

后端一开始用 `.withSockJS()` 注册端点，前端却是直接拿原生 WebSocket 连 `/ws/websocket`（SockJS 内部的"跳过帧"子路径），没有引入 `sockjs-client`。第一次看到"连接能建立但订阅全部失败、疯狂反复重连"时，第一反应怀疑是**自定义 `HandshakeHandler` 在 SockJS 内部的这条子路径下没有被正确复用**，导致身份没绑定成功。为了排除这个不确定性，把 `.withSockJS()` 整个去掉，前端直接连纯 WebSocket 端点 `/ws`。

结果去掉之后问题依旧——说明**从一开始就猜错了方向**，见 §4.3 才是真正原因。不过这次简化本身没有坏处（前端反正没用到 SockJS 的降级能力），就保留了。

### 4.3 真正的根因：正则表达式漏掉了下划线

`RealtimeDestinations.java` 里解析 topic 路径的正则原本是 `[a-zA-Z]+`（只认字母）。后来给"踢人开关"加的 `RealtimeDomain.SESSION_KICK` wire name 是 `session_kick`，带下划线——**正则匹配不上**，导致后端把每一次 `/topic/(company/{id}|global)/session_kick` 的订阅都判定为"无法识别的目标地址"直接拒绝抛异常。

由于前端连上之后会一次性订阅所有 domain（包括 `session_kick`），这个 bug 导致**每一条 WebSocket 连接必然会在订阅阶段报错**——Spring 把这次异常包成一条 STOMP `ERROR` 帧发给客户端，`@stomp/stompjs` 收到 `ERROR` 帧后判定连接失效、断线重连，新连接重复同样的订阅顺序，又在同一个地方失败，构成无限重连死循环（后端 `WebSocketMessageBrokerStats` 日志里能看到 `CONNECT(43)-CONNECTED(43)-DISCONNECT(0)` 这种数字持续暴涨）。

**定位方式**：让用户在浏览器 DevTools → Network → WS 连接的 Messages 面板里看实际收发的 STOMP 帧，看到最后一条成功发送的 SUBSCRIBE 恰好是 `/topic/company/{id}/session_kick`，紧跟着就是 ERROR——直接锁定是这个 domain 名字的问题。

修复：正则字符集从 `[a-zA-Z]+` 改成 `[a-zA-Z_]+`。

### 4.4 前端硬编码 IT 账号名单 vs 角色字段

`AuthenticatedLayout.jsx` 里踢人开关的豁免判断，一开始（照抄旧代码风格）写成 `["IT_JK", "IT_JS", "IT_MS"].includes(login_id)`——具体账号名单硬编码，而不是用后端 `SessionUser.role === "it"` 这个角色字段。这样以后新增 IT 账号，账号名不在这个写死的名单里，会导致新账号打开踢人开关时把自己也踢下线。改成调用现成的 `isItOperator(me)`（`sidebarPermissions.js`，基于 `role` 字段判断）。

顺带发现 `loginScope.js` 里还有一套更大范围的硬编码限制（`SYSTEM_IT_LOGIN_IDS`/`isSystemMaintenanceItUser`），效果是把这几个账号的公司/集团可见范围反向收窄到只剩 C168+AP/IG——这是旧版遗留、需要迁移的限制，跟新版"IT 角色应无限制访问所有公司/集团"的需求冲突，已整个删除（3 个调用点连带清理，让 IT 落到"无指派范围 = 无限制"这条已有的通用路径，跟 `owner` 角色走同一条路）。

---

## 5. 已知缺口 / 未来可能要做的事

- `payment_update`/`transaction_delete`/`capture_update`/`domain_fee_update` 这 4 个动作目前后端没有找到对应的独立写入方法，没有接实时广播。
- `accounts`/`processes`/`ownership`/`users` 4 个 domain 完全没有接后端广播（前端订阅逻辑都在，只是没人发布）。
- Session 自然过期（非踢人开关触发）目前**没有走 WebSocket**，靠的是 `AuthenticatedLayout.jsx` 里已有的 30 秒轮询 + 标签页切回前台立即检查（`fetchCurrentUser` 收到 401 触发跳转）。如果要做到"过期那一秒精确弹出"，需要后端在登录/current-user 接口里额外暴露 token 到期时间戳（目前完全没有暴露），前端再用精确定时器实现——这个需求评估后判断现有的轮询+可见性检查已经够用，暂未做。
- `canUseGroupOnlyMode`/`resolveVisibleGroupIds`（`loginScope.js`）里给 IT 移除限制后走的默认路径，没有逐行验证是否在所有集团/公司组合下都真正做到"完全无限制"——如果测试发现 IT 在某些场景下还是看不全，需要单独排查这两个函数本身的默认逻辑，不是这次删掉的那部分限制的问题。
