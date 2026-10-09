# Sidebar 菜单与登录检查（现状说明）

> 写于 2026-10-09，取代原来的 `sidebar-api-plan.md`（那是动手前的方案，很多做法最后没采用）。
> 以代码为准；改规则时请同时改这里。

## 1. 核心规则：Sidebar 跟着「当前所在公司」走

- 登录进入哪家公司，Sidebar 就按这家公司显示；在任何页面的 Group / Company 选择器里选了别的公司，
  会调用 `/auth/switch-tenant`，后端用新公司重新生成整个 session，Sidebar 和所有页面一起切换。
- 菜单 = **角色层** × **当前公司类别层**，由后端在登录和切换公司时算好，存进 Redis 的 session，
  通过 `/auth/current-user` 的 `menu` 返回。前端只按 key 显示，不再自己判断。
- 没有「最初用什么身份登录」的概念：集团切到旗下的 C168，就会得到 C168 的三个入口。

## 2. 显示规则

| 入口（`menu` key） | 谁能看 |
|---|---|
| Home（`home`） | 所有人 |
| Domain / Announcement / Auto Renew（`domain`、`announcement`、`autoRenew`） | **当前公司是 C168**，不看角色 |
| Admin / Account / Ownership / Transaction Payment（`admin`、`account`、`ownership`、`transactionPayment`） | 角色有对应权限 |
| Data Capture（`dataCapture`） | 角色有权限，且公司是 Games、Bank 或集团 |
| Process（`process`） | 角色有权限，且**当前不是集团、不是 C168** |
| Report → Customer / Domain（`report`、`reportCustomer`、`reportDomain`） | 角色有权限，且**不是 Bank 公司** |
| Maintenance → Data Capture / Formula | 角色有 Maintenance 权限，且不是 Bank 公司 |
| Maintenance → Transaction / Payment | 角色有 Maintenance 权限 |
| Maintenance → Bank Process | 角色有 Maintenance 权限，且是 Bank 公司 |

- 集团一律按 Games 处理；公司是 Games 还是 Bank 看 `tenant_has_bank`（一个公司只会开一种）。
- 父项（Report、Maintenance）在子项全被隐藏时一起隐藏。显示的编号按实际显示的项自动排。
- 角色默认权限（`user_role_permission`）：Owner / Partnership / Admin 九项都有；Manager 少 Home；
  Supervisor 再少 Maintenance；Accountant 只有 Account、Process、Payment、Report；Audit 只有 Payment、Report、
  Maintenance；Customer Service 有 Account、Process、Data Capture、Payment、Report。
  账号设成 `CUSTOM` 模式时用 `user_permission_override` 的清单。
- **权限列表为空 = 全部可见**（Owner / IT 的约定）。`AUTORENEW`、`DOMAIN`、`ANNOUNCEMENTS` 不绑定任何角色，
  C168 登录时由后端注入。

## 3. 代码在哪里

**后端**（`Count/backend/src/main/java/com/eazycount/`）
- `security/SessionUser.java`：`buildMenu()` 是整张规则表；测试 `SessionUserMenuTest`。
- `service/impl/PermissionServiceImpl.java`：角色权限、功能模块检查、C168 额外权限。
- `service/impl/AuthServiceImpl.java`：`switchSessionTenant` 用新公司重建 session。
- `config/SecurityConfig.java`：接口拦截（见第 4 节）；测试 `SecurityConfigAccessTest`。
- 数据库：`permission` 表的 `AUTORENEW`（`sql/migrate_add_auto_renew_permission.sql`，已写进 `schema.sql`）。

**前端**（`frontend/src/`）
- `context/session.jsx`：`SessionProvider`、`useSession()`、`switchCompany(tenantId)`、`RequireSession`。
- `components/layout/sidebarConfig.js`：`MENU_ITEMS`（每项带 `menu` key）、`buildSidebarMenu()`、`menuKeyForPath()`。
- `components/layout/useSidebarData.js`、`sidebarProfile.js`：菜单、用户名、角色显示名、到期时间。
- `layouts/AuthenticatedLayout.jsx`：登出，以及页面守卫（URL 对应的 `menu` key 不是 true 就回 `/dashboard`）。
- `components/shared/list/useListScope.js`、`pages/dashboard/DashboardPage.jsx`：公司选择器显示 session 的公司，
  选了别的公司就切换 session。Dashboard 的 “All” 汇总跨多家公司，不切换。

## 4. 登录检查和接口拦截

- 没有有效登录：后端返回 **401**，前端任何请求收到 401 都整页跳到 `/login`（登录、二级密码、重置密码页除外）。
  业务错误（如密码错）是 HTTP 200，不会触发跳转。
- **二级密码没验证完的 session** 只能访问 `/auth/current-user` 和两个 `verify-*-secondary-password`（登出是公开的），
  其他接口一律 **403**；WebSocket 订阅同样拒绝。前端会把这种 session 送到 `/secondary-password`。
- **C168 专属接口**只有「当前公司是 C168」才放行，否则 403：`/api/domain/**`、`/api/auto-renew/**`，
  以及 announcement 的 `listAnnouncement`、`listMaintenance` 和 `add*`、`update*`、`delete*` 共 6 个管理接口。
  `getDashboardAnnouncements`、`unreadCount`、`markRead` 所有登录用户可用，`getMaintenanceInLogin` 公开。
- 页面守卫（前端）只是体验层，真正的拦截在后端。

## 5. 已知限制

- **权限是登录时的快照。** 管理员改了某人的角色或权限，对方要重新登录或切换一次公司才生效；
  旧格式的 session（没有 `menu`）会被送回登录页。
- **Member 账号权限列表为空，会看到全部菜单**（暂时不管）。
- **只隐藏了 Process 的入口和页面，`/api/process/**` 接口 C168 仍然可以调用。**
- 角色层的权限只控制菜单，服务层的角色、层级检查仍在 `AccessControlUtils`。
- 通知铃铛的数字、语言切换、头像还是写死的，后端没有对应数据。
- Auto Renew 旁边的待处理数量还没做（旧版用 `/api/auto-renew/list`，`action=pending_count`）。
