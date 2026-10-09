# Sidebar 接 API + C168 权限检查：分析与落地方案

> 写于 2026-09-30，2026-10-04 更新。继续时先读这份文件。
> **状态：** 前端的 Report / Maintenance 子菜单（含占位页和路由）已在 2026-10-04 完成，见第 0 节。
> **2026-10-09 更新：** 后端已改（`login_origin_scope`、`c168_access`、按角色 × 公司类别算 `menu`、C168 接口拦截、`AUTORENEW` 权限，
> 迁移见 `Count/backend/src/main/resources/sql/migrate_add_auto_renew_permission.sql`，规则测试 `SessionUserMenuTest`）；
> 前端已接：`src/context/session.jsx`（SessionProvider）、`sidebarConfig.js` 的 `buildSidebarMenu` / `menuKeyForPath`、
> `useSidebarData`、`sidebarProfile.js`（角色名、到期时间）、`AuthenticatedLayout` 的登出和页面守卫。
> **还没做真实登录验证**（5 种身份），也没做 Auto Renew 待处理数量。下文第 3、4 节描述的是原方案，以代码为准。
> 文中的行号是写这份文件时的位置，动手前先重新核对。

---

## 0. 已经完成的（跟本方案无关，只作背景）

- 所有页面按屏幕尺寸自适应，规则写在 `frontend/CLAUDE.md`。
- Sidebar 分两种模式：
  - 宽度 ≥ 1200px：完整的 `Sidebar.jsx`。
  - 宽度 < 1200px：只有图标的 `SidebarRail.jsx`，点击时把完整 Sidebar 作为抽屉滑出。
  - 菜单配置放在 `src/components/layout/sidebarConfig.js`（`MENU_ITEMS`，目前是写死的 9 项，菜单内容还没接 API）。
- **Report / Maintenance 子菜单（2026-10-04 已完成）：**
  - `MENU_ITEMS` 里第 8、9 项没有 `path`，只有 `key` 和 `children`。每个子项是 `{ label, path, menu }`，`menu` 是以后接权限用的 key，现在没有用到。
  - 显示的子菜单名只保留关键字：Report 下是 Customer、Domain；Maintenance 下是 Data Capture、Transaction、Payment、Formula、Bank Process。
  - 子菜单网址：`/report/customer`、`/report/domain`、`/maintenance/data-capture`、`/maintenance/transaction`、`/maintenance/payment`、`/maintenance/formula`、`/maintenance/bank-process`。**不再有 `/report` 和 `/maintenance` 这两个父级路径。**
  - `Sidebar.jsx`：父项是按钮，点击在原地展开或收起，箭头旋转。同一时间只展开一个（状态是 `openKey`）。
  - **刷新或直接打开子页面时，父项不会自动展开。** 但当前页面在某个父项下面时，收起的父项会带浅色底，表示当前位置。
  - `SidebarRail.jsx`：父项有 `children` 时当作有子菜单，点击仍然打开抽屉。路径在某个子项下面时，对应的父图标高亮。
  - `sidebarConfig.js` 还导出 `SUBMENU_PAGES`（所有子页面的清单），`App.jsx` 用它给 7 个子页面注册路由。
  - **Report 的两个页面已经是真实页面（2026-10-04）：** `/report/customer` → `pages/report/customer/CustomerReportPage.jsx`，`/report/domain` → `pages/report/domain/DomainReportPage.jsx`，已接 `POST /api/report/customer-report/list` 和 `/api/report/domain-report/list`（后端早就有，没改）。`App.jsx` 的 `BUILT_PAGES` 里列出已做好的路径，其余 5 个 Maintenance 子页面仍是占位页 `src/pages/placeholder/ComingSoonPage.jsx`，只显示分组和页面名。
  - Report 页面做法：筛选卡 `pages/report/shared/ReportFilterCard.jsx`（Group / Company 用 `useListScope`，日期用 `DateRangePicker`，下拉用 `components/shared/DropdownSelect.jsx`），结果表复用 `DataTable`（新增了可选的 `totalRow`、`emptyMessage`，不分页不排序），请求用 `shared/useReport.js`（把返回里 `totalRow:true` 那行拆成 Total）。
  - 所有人都能看到全部 7 个子项，**权限过滤还没做**。
- 目前已注册的路由：`/dashboard`、`/admin`、`/account`，加上上面 7 个子页面。其余菜单（Ownership、Process、Data Capture、Transaction Payment）点进去还是空白页。

---

## 1. 用户的需求（已确认）

### 1.1 菜单结构
- **Report 子菜单**：Customer Report、Domain Report
- **Maintenance 子菜单**：Data Capture、Transaction、Payment、Formula、Bank Process

### 1.2 显示规则

| 入口 | Games 公司 | Bank 公司 | C168（Games 公司） | 集团 |
|---|---|---|---|---|
| Home | ✅ | ✅ | ✅ | ✅ |
| Domain | — | — | ✅ | ❌ |
| Announcement | — | — | ✅ | ❌ |
| Auto Renew | — | — | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Account | ✅ | ✅ | ✅ | ✅ |
| Ownership | ✅ | ✅ | ✅ | ✅ |
| Process | ✅ | ✅ | ✅ | **❌** |
| Data Capture | ✅ | ✅ | ✅ | ✅ |
| Transaction Payment | ✅ | ✅ | ✅ | ✅ |
| Report（Customer、Domain） | ✅ | **❌ 整个不显示** | ✅ | ✅ |
| Maintenance → Data Capture | ✅ | ❌ | ✅ | ✅ |
| Maintenance → Transaction | ✅ | ✅ | ✅ | ✅ |
| Maintenance → Payment | ✅ | ✅ | ✅ | ✅ |
| Maintenance → Formula | ✅ | ❌ | ✅ | ✅ |
| Maintenance → Bank Process | ❌ | ✅ | ❌ | ❌ |

- **集团一律按 Games 格式处理。** 目前集团只会是 Games 格式。
- **集团没有 Process。** C168 的三个专属入口集团也**永远不能看到**，即使集团旗下就有 C168。
- **集团和公司各自保存自己的数据。** 后端已经做好这部分。
- **C168 本身是 Games 格式**，C168 的菜单顺序是：
  Home, Domain, Announcement, Auto Renew, Admin, Account, Ownership, Process, Data Capture, Transaction, Report, Maintenance（Data Capture / Transaction / Payment / Formula）。
- 登录成功后，Sidebar 要显示真实的**用户名**和**角色**。

### 1.3 用户已回复的问题
1. **一个公司同时开 Game 和 Bank？** 不会发生，一个公司固定只能开一种模块。判断方式：`tenant_has_bank` 为 true 就是 Bank，否则是 Games。
2. **按角色权限 `permissions` 过滤？** 暂时不做，以后再说。
3. **Member 账号？** 暂时不管。
4. **子菜单网址用 `/report/customer`、`/maintenance/bank-process` 这种格式？** 可以。已确认不会和后端冲突：后端接口都在 `/api/*` 和 `/auth/*` 下面，Vite proxy 也只转发这两个前缀（`frontend/vite.config.js`）。

---

## 2. 读代码得到的发现

### 2.1 `/auth/current-user` 已经返回 Sidebar 需要的数据
接口在 `Count/backend/.../controller/AuthController.java`，返回的是 `SessionUser`（`security/SessionUser.java`）：

| 字段 | 用途 |
|---|---|
| `name` | 显示的用户名 |
| `role` | 小写的角色代码：`owner` / `admin` / `manager` / `supervisor` / `accountant` / `audit` / `customer_service` / `partnership` / `it`。显示名称来自 `schema.sql` 的 `user_role` 表，例如 "Customer Service" |
| `login_scope` | `group` 或 `company`，是**当前**公司的类型，切换公司后会变 |
| `tenant_has_game` / `tenant_has_bank` | 判断 Games 还是 Bank 格式 |
| `is_current_tenant_c168` | 判断是不是 C168，比较的是**当前**公司代码 |
| `permissions` | 小写的模块代码列表，空数组表示全部可见（Owner / IT 就是空数组） |
| `menu` | 目前只有 `report`、`dataCapture` 两项，由 `SessionUser.buildMenu()` 计算 |
| `expiration_date` | 用来算 "Exp: Xm Yd left"。`9999-12-31` 表示永久有效（`Tenant.PERMANENT_EXPIRATION_DATE`） |
| `read_only` | 1 表示只读 |

- 前端的 `src/hooks/useSavedState.js` 已经会调用一次 current-user，只拿来生成 localStorage 的 key。
- 登出接口是 `POST /auth/logout`。
- 登录资料存在 **Redis** 里（`security/AuthTokenStore.java`），用户改不了，所以后端根据这些标记做权限判断是可靠的。

### 2.2 权限表缺 AUTO_RENEW
- `schema.sql` 的 `permission` 表（约 172 行）有 11 项：
  `HOME(1) DOMAIN(2) ANNOUNCEMENTS(3) ADMIN(4) ACCOUNT(5) OWNERSHIP(6) PROCESS(7) DATACAPTURE(8) PAYMENT(9) REPORT(10, 需要 GAME 模块) MAINTENANCE(11)`
- **没有 `AUTO_RENEW`。**
- `PermissionServiceImpl.java:29` 里 `C168_EXTRA_PERMISSION_CODES = List.of("DOMAIN", "ANNOUNCEMENTS")`：C168 登录时会自动加上这两项，但不包括 Auto Renew。
- `PermissionServiceImpl.resolveModuleKeysFromPermissions`（约 95–128 行）：
  - 集团会跳过模块检查（`bypassFeatureGate = isGroupTenant`），所以集团永远按 Games 处理。
  - `isC168Account` 只比较公司代码是不是 "C168"（约 79 行）。

### 2.3 ⚠️ 三个 C168 专属模块的后端**没有任何 C168 权限检查**
Service 层只检查了 `requireLoggedIn`（有没有登录）和 `requireWritable`（是不是只读），**任何已登录的公司或集团都能直接调用这些接口**：

- **`DomainController`**（`/api/domain`）：`/list`、`/add`、`PUT /update-setting`、`PUT /update`、`/delete`、`/list-fee`、`/add-fee`
- **`AutoRenewController`**（`/api/auto-renew`）：`/list`（包括 `action=pending_count`，旧版 Sidebar 用它显示待处理数量）、`/reject`、`/approve`、`/delete`
- **`AnnouncementController`**（`/api/announcement`）：
  - `GET /listAnnouncement`、`GET /listMaintenance`
  - `GET /getDashboardAnnouncements` → **Dashboard 要用，所有已登录用户都必须能访问**
  - `GET /getMaintenanceInLogin` → **登录页要用，已经在 `SecurityConfig.PUBLIC_URLS` 里设为公开**
  - `/addAnnouncementContent`、`/addMaintenanceContent`、`/updateAnnouncement`、`/updateMaintenance`、`/deleteAnnouncement`、`/deleteMaintenance`

这三个 Service（`DomainServiceImpl`、`AutoRenewServiceImpl`、`AnnouncementServiceImpl`）只有这三个 Controller 在用。

### 2.4 ⚠️ 集团可以通过"切换公司"变成 C168
- `AuthServiceImpl.switchSessionTenant`（约 433 行）调用 `rebuildSessionUserWithTenant`（约 713 行），用切换后的公司**重新生成** `SessionUser`：
  - `login_scope` 会变成新公司的类型（group → company）。
  - `is_current_tenant_c168` 也会重新计算。
- 结果：如果集团旗下有 C168，集团账号切换到 C168 后就会拿到 C168 的权限。**这直接违反了"集团永远不能看到 C168 入口"这条规则。** 而且切换之后，前端和后端都分不出这个人原本是用集团登录的。
- 目前前端还没有调用 `/auth/switch-tenant`，但这个接口是开放的，任何人都能直接调用。

### 2.5 其他
- `SecurityConfig.java` 的注释提到 `ReadOnlyGuardInterceptor` 和 `@WriteOperation`，但**项目里根本没有这两个东西**，是过时的注释。
- 现有的权限检查统一放在 `util/AccessControlUtils.java`，例如 `requireItOperator`、`requireWritable`、`assertCanManageAdminTarget`。
- 没有权限时，`handler/AccessDeniedHandlerImpl.java` 返回 **403** 和 `{success:false, message:"Forbidden"}`。前端 `src/lib/api.js` 的 `getJson`/`postForm` 遇到 `!res.ok` 会直接 throw，已经能处理这种情况。
- 项目里已经有 AOP 的用法：`audit/AuditLogAspect.java`，配合 `@Audited` 注解。
- 后端测试只有 `CountApplicationTests`、`SummaryAmountFormatTest`，基本没有测试。

---

## 3. 后端修改方案

### B1. 记住"最初是用什么身份登录的"（B2 和 B3 的前提）
- 在 `SessionUser` 里新增 `public String login_origin_scope`（group 或 company），**登录时写入，之后切换公司也不会变**。
- 要改的地方：
  - `SessionUser` 的 private 构造函数，加参数。4 个 `fromXxx` 方法在登录时传入 `tenantScope(tenant)`。
  - `AuthServiceImpl.rebuildSessionUserWithTenant`（切换公司时）：沿用 `current.login_origin_scope`。
  - `SessionUser.withSecondaryVerified`：原样复制。
- 由后端计算一个字段 `public boolean c168_access = is_current_tenant_c168 && !"group".equals(login_origin_scope)`。
- **前端显示入口和后端拦截接口都只看 `c168_access` 这一个值。**
- 注意：Redis 里的旧登录资料没有这个新字段。上线后旧 session 读出来会是 null，保险起见应该当作"不能访问"，或者让大家重新登录一次。

### B2. 统一的检查函数
- 在 `AccessControlUtils` 新增 `requireC168Access(SessionUser session)`，写法参考 `requireItOperator`。不符合条件就 throw。

### B3. 在一个地方统一拦截接口（推荐这样做）
在 `SecurityConfig.filterChain` 里加 `requestMatchers(...).access(c168Only)`。`c168Only` 是一个 `AuthorizationManager`，读取 `LoginUserPrincipal.user().c168_access` 来判断：

```
/api/domain/**                              → 只有 C168
/api/auto-renew/**                          → 只有 C168
/api/announcement/listAnnouncement          → 只有 C168（待确认，见第 6 节第 1 点）
/api/announcement/listMaintenance           → 只有 C168（待确认）
/api/announcement/add*, update*, delete*    → 只有 C168
/api/announcement/getDashboardAnnouncements → 所有已登录用户
/api/announcement/getMaintenanceInLogin     → 公开（已在 PUBLIC_URLS）
```

- 不符合条件时会自动走 `AccessDeniedHandlerImpl`，返回 403。
- **为什么不在 21 个 Service 方法里各写一遍检查：**
  - 规则集中在一处，一眼就能看完。
  - 以后在 `/api/domain/**` 下新增接口会自动受到保护，不会漏加。
  - 请求在进入 Controller 之前就被拒绝。
- 另一种做法：在 Controller 类上加 `@RequireC168` 注解，再写一个 Aspect 来拦截（仿照 `AuditLogAspect`）。更贴近"Service 层做检查"的现有风格，但要逐个类加注解。

### B4. 补上 AUTO_RENEW 权限
- 新建 `sql/migrate_add_auto_renew_permission.sql`：
  - 把 ADMIN 到 MAINTENANCE 的 `sort_order` 各加 1。
  - 插入 `AUTO_RENEW`，`sort_order = 4`，`requires_feature_id = NULL`，`status = ACTIVE`。
  - 这样顺序就是 Home, Domain, Announcements, Auto Renew, Admin…
- `schema.sql` 同步更新，保持一致。
- `PermissionServiceImpl.C168_EXTRA_PERMISSION_CODES` 加上 `"AUTO_RENEW"`。
- `resolveModuleKeysFromPermissions` 里补 C168 权限的判断，改成 `isC168Account(tenant) && !集团登录`。这是双重保险，需要把 origin scope 传进来。

### B5.（建议做）由后端直接算出完整的 Sidebar 显示规则
把 `SessionUser.buildMenu()` 扩展成第 1.2 节的完整规则表：

```
menu: {
  domain, announcement, autoRenew,          // = c168_access
  process,                                  // 不是集团登录
  report,                                   // 不是 Bank（集团一律算 Games）
  dataCapture,                              // 沿用现有逻辑
  maint_datacapture, maint_formula,         // 不是 Bank
  maint_transaction, maint_payment,         // 一律 true
  maint_bankprocess                         // 是 Bank，且不是集团
}
```

- 这些值在构造函数里计算，所以切换公司和验证二级密码后都会自动重新算。
- **好处**：前端只负责按 key 显示。"能看到哪些入口"和"能调用哪些接口"都来自后端同一份规则。以后要加 `permissions` 角色过滤，也只需要改后端。
- 现有的 `menu.report` 和 `menu.dataCapture` 会叠加 `permissions` 的判断（空数组表示全部可见），这部分要保留。

### B6. 顺便清理
- 删掉 `SecurityConfig` 里提到 `ReadOnlyGuardInterceptor` 和 `@WriteOperation` 的过时注释。

---

## 4. 前端修改方案

1. **新建 `SessionProvider`**（建议放在 `src/context/session.jsx`）
   - 在 AuthenticatedLayout 加载时调用 `/auth/current-user`，把结果放进 context。
   - 返回 401 就跳回 `/login`，顺便做了登录保护。
   - `useSavedState.js` 改成从 context 读，不再自己请求。
   - 数据还在加载时，名字和菜单位置显示灰色占位块，不会先闪出一份错误的菜单。
2. **修改 `sidebarConfig.js`**
   - 新增 Domain、Announcement、Auto Renew 三个入口。
   - ✅ 已完成：Report 下 2 个子菜单，Maintenance 下 5 个子菜单，每一项已有 `menu` key，网址也已定好（见第 0 节）。
   - 还要做：新增 Domain、Announcement、Auto Renew 三个入口。
   - 还要做：菜单编号按实际显示的项目自动排（目前是写死的 1–9）。
   - 还要做：按 `menu` key 过滤显示。子项已经带了 `menu` key，只差拿后端的值去过滤。
   - 如果没做 B5：就由前端写一个 `buildSidebarMenu(session)`，自己按第 1.2 节的规则判断。
3. **`Sidebar.jsx` 支持子菜单**：✅ 已完成（见第 0 节）。
   - 原定"当前页面在某个子菜单里时自动展开"，**已改为不自动展开**（用户 2026-10-04 决定），只给收起的父项加当前位置的浅色底。
   - 父级路径 `/report`、`/maintenance` 已去掉。
   - `SidebarRail.jsx` 维持现状：点这两项会打开抽屉。
   - 这一步之后接 API 只需要过滤 `children`，父项的 `children` 全部被过滤掉时，整个父项也要隐藏（例如 Bank 公司看不到 Report）。
4. **接上真实数据**
   - 用户名。
   - 角色：把 `role` 代码转成显示名称，例如 `customer_service` → "Customer Service"。
   - 到期时间：`expiration_date` 转成 "Exp: Xm Yd left"，永久有效就显示 "No expiry"。
   - Logout：先调 `POST /auth/logout`，再跳转到 `/login`。
5. **保护页面**：以后的 Domain、Announcement、Auto Renew 页面，如果 `c168_access` 为 false 就跳回 `/dashboard`。接口返回 403 时显示"没有权限"。
6. **（可选）Auto Renew 待处理数量**：C168 登录时调用 `/api/auto-renew/list`（`action=pending_count`），在 Auto Renew 旁边显示数字。
7. **暂时不动**：通知铃铛的数字（目前写死是 3）、语言切换、头像。这三个后端没有对应的数据。

---

## 5. 执行顺序和验证方法

1. **后端 B1 → B2 → B3 → B4**：先堵住接口漏洞，再补迁移文件。
2. **后端 B5**：前端的菜单依赖它。
3. **前端 1 → 5**，第 6 项可选。（第 2、3 项里的子菜单部分已经完成。）
4. **后端验证**：用下面五种身份，逐一调用第 2.3 节的 21 个接口。C168 应该全部可以调用，其他四种都应该返回 403，`getDashboardAnnouncements` 例外（所有人都能调用）：
   - C168
   - 普通 Games 公司
   - Bank 公司
   - 集团
   - **集团切换到 C168**
5. **前端验证**：用同样五种身份登录，对照第 1.2 节的表格截图检查 Sidebar。同时检查大 Sidebar、窄条、抽屉三种状态下都正常。

---

## 6. 还需要用户确认

1. `listAnnouncement` 和 `listMaintenance`，**除了 C168 的管理页面，还有其他公司的页面会用到吗？** 如果有，就不能把它们设成只有 C168 能用。
2. **IT 账号**登录 C168 时，要不要也能用这三个入口？建议可以，因为它不需要任何额外处理，自然就能访问。
3. **B5 要不要做？** 建议做。如果不做，就由前端自己按规则表判断。
