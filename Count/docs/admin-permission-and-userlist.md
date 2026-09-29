# Admin 权限体系 与 用户列表 — 设计 / 修复 / 行为记录

> **本文档由 5 份合并而成**（2026-09-22），把 Admin 侧边栏权限体系与 Admin/账号列表相关的记录按模块
> 归拢到一处。内部按 **「权限体系（基础 → 扩展）→ 数据权限修复 → 列表行为」** 排序。
>
> | 顺序 | 来源文档 | 定位 |
> |---|---|---|
> | 1 | `admin-permission-rbac-hierarchy.md` | **权限体系基础**（2026-08-27）—— 角色层级 + `read_only` 全局校验：把 `/api/**` 从 `permitAll()` 收紧，并给所有写接口补上 `read_only` 防护 |
> | 2 | `admin-permission-account-override.md` | **权限体系扩展**（2026-08-27）—— 账号级侧边栏权限覆盖（`permissions` 字段以前提交后被静默丢弃） |
> | 3 | `account-process-permission-fixes.md` | 数据权限修复 —— Edit User 的 Account / Process 勾选控制 `/api/account/list`、`/api/process/process-list` 能看到哪些数据，本文记围绕它的几个 bug |
> | 4 | `userlist-groupview-owner-missing-fix.md` | 列表行为 —— 新建 Group 后单 Group 视图看不到自己数据 |
> | 5 | `last-login-logout-tracking.md` | 列表行为 —— Admin / Owner / Account 的 Last Login & Last Logout 追踪 |
>
> **前端配对文档**：`Count-frontend/docs/permission-rbac-frontend-alignment.md`（RBAC 前端对齐）、
> `Count-frontend/docs/account-userlist-display.md`（列表展示与行为，由前端侧的同类文档合并而成）、
> `Count-frontend/docs/userlist-group-mode-issues.md`（单 Group 模式下 UserList 的两个问题）。

> ### ⚠️ 未纳入本文件的相关文档
> `it-role-*` 三份（IT 角色体系）**不在本文档内**，因为 `it-role-audit-log.md` 被 8 个后端 java 源码文件
> 当作「前置阅读」引用，改名会连带 13 处指针，收益不抵风险。

---
---

# 1. Admin 权限体系 — 角色层级 + Read-Only 全局校验（2026-08-27）
## Admin 权限体系 — 角色层级 + Read-Only 全局校验（2026-08-27）

> 配套前端记录：`Count-frontend/docs/permission-rbac-frontend-alignment.md`
> 相关但独立的既有文档：`docs/frontend-springboot-migration.md` 第 5 节（Admin 页面）、第 11 节（跨模块共性与缺口）——本文档记录的改动缩小了那两节里列出的部分缺口，具体见文末「对照更新」。

### 背景

在这次改动之前做过一轮审计，发现两个核心问题：

1. **`SecurityConfig` 对 `/api/**` 全部 `permitAll()`**，除 `/auth/**` 外不要求登录，也没有任何 `@PreAuthorize`/`hasRole` 之类的接口级角色校验。
2. **`read_only` 账号标志**（Partnership / Audit 角色在 UI 上可切换）只在两个地方被检查（`MaintenanceServiceImpl`、`TransactionSubmitServiceImpl`），其余所有写接口（Admin、Domain、Currency、Process、BankProcess、Announcement、AutoRenew、Ownership、DataCapture 等）完全没有防护——只要有合法 session token，绕过前端直接调接口就能写。
3. `user_role.hierarchy_level` 定义与前端 `ROLE_HIERARCHY` 互相矛盾（DB 把 Partnership 排最低，前端排第 2），且这个字段在后端从未被任何业务逻辑读取用于比较。

### 业务规则（本次落地的目标状态）

**角色层级**（数值越小权限越高，`user_role.hierarchy_level`）：

```
1 OWNER  >  2 PARTNERSHIP  >  3 ADMIN  >  4 MANAGER  >  5 SUPERVISOR  >  6 ACCOUNTANT / 7 AUDIT / 8 CUSTOMER_SERVICE
```

**全局 read_only 开关**（Partnership、Audit 两个角色，账号级独立生效）：

- `read_only=1`：该账号在**全站所有页面**禁止一切写操作（不分角色，只要标志位是 1 就拦截，与角色无关——这点沿用了原有 Maintenance/Transaction 检查的行为，只是不再各处重复实现）。
- `read_only=0`：正常按下面的层级规则执行 CRUD。

**Admin 页面（员工列表 `/api/userlist`）写操作范围**：

| 操作者 | 可管理目标（含自己按下方限制） | 不可碰 |
|---|---|---|
| OWNER | 所有角色，含自己 | — |
| PARTNERSHIP | 自己（仅基础信息，不含 role 字段）、ADMIN、MANAGER、SUPERVISOR、ACCOUNTANT、AUDIT、CUSTOMER_SERVICE | OWNER |
| ADMIN | MANAGER、SUPERVISOR、ACCOUNTANT、AUDIT、CUSTOMER_SERVICE | OWNER、PARTNERSHIP、ADMIN（含自己/同级） |
| MANAGER | 自己（仅基础信息）、SUPERVISOR、ACCOUNTANT、AUDIT、CUSTOMER_SERVICE | ADMIN 及以上 |
| SUPERVISOR | 自己（仅基础信息）、ACCOUNTANT、AUDIT、CUSTOMER_SERVICE | MANAGER 及以上 |
| ACCOUNTANT / AUDIT / CUSTOMER_SERVICE | 默认无 Admin 页面入口；但账号级权限覆盖（见本文档第 2 节）可以额外开通，开通后按 hierarchy_level 只能管理比自己层级数值更大的角色（ACCOUNTANT 能管 AUDIT/CUSTOMER_SERVICE；AUDIT 能管 CUSTOMER_SERVICE；CUSTOMER_SERVICE 是最低层级，实际管不到任何人）——2026-08-27 追加，见下方「后续追加」 | 层级数值 ≤ 自己的所有角色 |

通用规则：任何角色编辑「自己」时，`role` 字段一律锁死，不能自我提权。

### 实现

#### 1. 统一权限工具类

新增 [`backend/src/main/java/com/eazycount/util/AccessControlUtils.java`](../backend/src/main/java/com/eazycount/util/AccessControlUtils.java)（放在既有 `util` 包，不是 `utils`，跟仓库现有命名对齐）：

- `requireWritable(SessionUser session)` — 未登录或 `read_only==1` 时抛 `BusinessException`。所有写方法的第一行都应调用。
- `assertCanManageAdminTarget(actor, actorHierarchyLevel, isSelf, targetHierarchyLevel, roleFieldChanging)` — Admin 页面专属的层级校验：
  1. Owner 直接放行；
  2. 操作者角色必须在 `ADMIN_PAGE_MANAGER_ROLES` 集合内，否则直接拒绝（连自己都管不了，更管不了别人）；集合内容见下方「后续追加」，2026-08-27 之后是 `{PARTNERSHIP, ADMIN, MANAGER, SUPERVISOR, AUDIT, ACCOUNTANT, CUSTOMER_SERVICE}`；
  3. 调用 `requireWritable` 走 read_only 检查；
  4. 若是编辑自己：只挡 `roleFieldChanging`（改角色），其余放行；
  5. 否则按 `actorHierarchyLevel >= targetHierarchyLevel` 判断（数值必须严格小于目标才允许管理）。

之所以是「工具类里手动调用」而不是全局拦截器/AOP：这个项目的每个 Controller 都会自己 `catch (BusinessException e)` 并重塑成 `{success:false, message, data:null}` 返回；如果用 `HandlerInterceptor` 在进入 Controller 之前就抛异常，会绕开这层本地 catch，改走 `GlobalExceptionHandler` 的 `{status:"error", message}` 格式，破坏前端 `response.data.success` 的判断契约。所以选择跟既有 `MaintenanceServiceImpl.requireWritableSession()` 一样的写法：**在每个 Service 写方法内部第一行调用**，让异常走原有调用链，响应格式不变。仓库里目前也没有任何 `@Aspect`/`HandlerInterceptor`/`WebMvcConfigurer`，这个选择也更贴近现有代码风格。

#### 2. `AdminServiceImpl` 层级校验

`createAdmin` / `updateAdmin` / `updateStatusById` / `deleteAdminByIdAndStatus` 四个方法都接入了 `assertCanManageAdminTarget`：

- 新增私有方法 `resolveRole(String role)`（返回 `AdminRole` 而不只是 id，供拿 `hierarchyLevel`）与 `resolveActorRole(SessionUser session)`。
- `resolveRoleId` 改为委托给 `resolveRole(...).getId()`，避免重复逻辑。
- `updateAdmin` 额外计算 `roleChanging`（对比 `normalizeStaffRoleCode` 后的新旧角色码）传给校验方法，用于判断自己改自己角色。

#### 3. `read_only` 全局覆盖

除了 `AdminServiceImpl`，以下 Service 的**全部写方法**都在方法首行加了 `AccessControlUtils.requireWritable(session)`（复用方法里已有的 `SecurityUtils.currentUser()`/`session` 变量，不重复取）：

| Service | 方法 |
|---|---|
| `AnnouncementServiceImpl` | `addMaintenance` `addAnnouncement` `updateAnnouncement` `updateMaintenance` `deleteAnnouncement` `deleteMaintenance` |
| `AutoRenewServiceImpl` | `rejectRequest` `approveRequest` `deleteRequest` |
| `BankCountryOptionServiceImpl` | `insertNewCountry` `insertNewBankOption` `deleteCountryByIdAndTenantId` `deleteBankOptionByIdAndTenantId` |
| `BankProcessServiceImpl` | `insertBankProcess` `updateBankProcessDetails` `deleteBankProcess` `updateBankProcessStatus` `updateBankProcessRemark` |
| `BankProcessResendServiceImpl` | `resend` |
| `BankAccountingDueServiceImpl` | `skipPeriods` `postToTransaction`；`resolveInbox` 仅在 `restoreSkipped` 分支内加（该方法本身也是只读的 inbox 查询入口，只有 restore 分支才写库） |
| `CurrencyServiceImpl` | `addNewCurrency` `deleteCurrencyByIdAndTenantId` `bulkUpdateAccountCurrency` |
| `DataCaptureServiceImpl` | `saveBankDraft` |
| `DataCaptureSummaryServiceImpl` | `saveAddFormula` `updateFormula` `deleteFormulas` `submit` |
| `DomainServiceImpl` | `createDomain` `updateTenantDetailsSetting` `updateDomain` `deleteOwnerDetails` `updateDomainFeeSettings`（内部共用的 `insertOwnerDetails`/`updateOwnerDetails`/`updateTenantDetails`/`deleteTenantDetails` 等 helper 不重复加，避免和外层入口重复校验） |
| `ProcessServiceImpl` | `addNewProcess` `updateProcess` `deleteProcessById` `updateProcessStatus` |
| `ProcessDescServiceImpl` | `insertNewProcessDescription` `deleteProcessDescriptionById` |
| `TenantOwnershipServiceImpl` | `linkPartner` `saveOwnership` `updateTenantParentId`（这三个方法本来就有 `canModifyOwnership()` 角色/权限检查，这次是叠加 read_only 检查，两者互不冲突） |
| `UserServiceImpl` | `createUser` `updateUser` `updateStatusByUserId` `deleteUserByIdAndStatus` `insertAccountLink` `deleteAccountLinkById` `deleteAccountLinkByAccountId` `deleteAccountLinkByPair` `updateAccountLink` |
| `MaintenanceServiceImpl` / `TransactionSubmitServiceImpl` | 原有的两处独立 read_only 检查改为调用 `AccessControlUtils.requireWritable`，逻辑不变，只是去重 |

**明确跳过、未加的地方**（都有具体理由，不是遗漏）：

- `MaintenanceController` 的写接口本来就全部走 `requireWritableSession()`，没有缺口。
- `MemberController`、`TransactionController`（除 submit 外）只有读接口。
- 一些被多处复用的底层 helper（如 `CurrencyServiceImpl.insertAccountCurrency`）没有单独加检查，因为调用它的所有入口方法都已经在各自入口加了，重复加反而是无意义的双重校验。

#### 4. `SecurityConfig` 兜底

`/api/**` 从 `.anyRequest().permitAll()` 改成 `.anyRequest().authenticated()`（`PUBLIC_URLS` 里的登录/登出/重置密码几个接口不受影响）。这只是防止**完全匿名**（连 session token 都没有）的请求，真正的角色/层级判断仍然在上面第 2、3 点的 Service 层。

#### 5. 数据库迁移

新增 [`backend/src/main/resources/sql/migrate_role_hierarchy_and_admin_permission_fix.sql`](../backend/src/main/resources/sql/migrate_role_hierarchy_and_admin_permission_fix.sql)（幂等，可重复执行）：

- 把 `user_role.hierarchy_level` 改成本文档开头的新顺序（Partnership 从 8 改到 2）。
- 删除 `user_role_permission` 里 Customer Service 对应 `ADMIN`（员工列表）侧边栏权限的行（如果存在——实际检查下来 `schema.sql` 本身从未插入过这行，这条 DELETE 是防御性的，万一线上库有手动加的脏数据也能顺手清掉）。

`schema.sql` 本身的基线也同步改了（新建库直接生效），`TABLE_MIGRATION.md` 索引表加了这条迁移脚本的说明行。

### 后续追加（2026-08-27，同一天，紧接账号级权限覆盖功能之后）

上线「账号级权限覆盖」（本文档第 2 节）之后，实测发现两个连带问题，一并修了：

#### 1. `ADMIN_PAGE_MANAGER_ROLES` 白名单扩大到 AUDIT / ACCOUNTANT / CUSTOMER_SERVICE

最初这三个角色被排除在外，理由是「默认没有 Admin 页面入口」。但权限覆盖功能上线后，可以单独给某个账号开通 Admin 菜单可见性——这时候原来的白名单会导致「菜单能看到，写操作永远 No permission，跟 read_only 状态无关」，因为角色白名单检查（第 2 步）在 `requireWritable`（第 3 步）之前，AUDIT 等角色连第 2 步都过不去。

跟用户确认后，改成：这三个角色也加进白名单，行为上没有特殊化，完全复用同一套判断顺序（先角色白名单 → 再 read_only → 再层级比较）。默认情况下这三个角色仍然没有 Admin 菜单入口（`user_role_permission` 没有 ADMIN 这一行），所以实际能不能写，还是取决于有没有单独给这个账号开权限覆盖——白名单只是「万一开了权限覆盖，写操作不要莫名其妙被角色本身卡住」。

#### 2. `user.read_only` 默认值从 1 改成 0

这个问题是上一条的连带发现：`read_only` 的开关 UI（`roleHasReadOnlyToggle`）前端只对 Partnership / Audit 暴露，其余角色的账号新建时后端一直是硬编码默认 `read_only=true`，且没有任何 UI 能把它改回 `false`。在 `AccessControlUtils.requireWritable` 全局生效之前这个默认值无关紧要（没人检查它），但现在一旦生效，Accountant / Customer Service（以及任何没有开关 UI 的角色）即使被加进了 `ADMIN_PAGE_MANAGER_ROLES` 白名单，也会被这个永远搬不动的默认值卡死，白名单改了等于没改。

确认过前端流程：只有 Partnership / Audit 的创建/编辑表单会显式传 `readOnly` 字段（默认 true，UI 上手动关掉），其余角色从来不传，完全由后端默认值决定。所以把默认值改成 `false` 只影响没有开关 UI 的角色，不影响 Partnership / Audit 已有的「默认锁定、手动放开」模型。

改动：
- `AdminServiceImpl.mapDtoToAdmin`/`persistUserForCreate`/`getAdminDetailByUserId` 三处兜底值从 `true` 改成 `false`。
- `schema.sql`：`user.read_only` 列默认值改成 `0`。
- 新增 [`migrate_admin_read_only_default_false.sql`](../backend/src/main/resources/sql/migrate_admin_read_only_default_false.sql)（幂等）：改列默认值 + 回填现有「角色不是 Partnership/Audit 但 read_only 还是 1」的账号成 0（这个 1 从来不是谁主动选的，只是旧默认值，回填是安全的）。

### 已知的、故意没在这次处理的点

- **Ownership 页面**（`/api/ownership`）：`TenantOwnershipServiceImpl.canModifyOwnership()` 判断「role==owner 或 session.permissions 含 ownership」，这次只是叠加了 read_only 检查，没有改动它本身的角色判断逻辑。Admin 角色现在前端也会显示 Ownership 入口（见前端文档），后端这条判断本来就认 Admin（`schema.sql` 默认给 Admin 发了 `OWNERSHIP` 权限），所以后端不用改。
- **通用的「API 层校验 session.permissions 是否含对应模块」**（`docs/frontend-springboot-migration.md` 第 11.1/11.5 节提到的缺口）**没有全面解决**——本次只针对 Admin 页面做了角色层级校验、针对 read_only 做了全局覆盖，像"Process 接口要求 session.permissions 包含 process"这类更通用的模块级权限校验仍然缺失，属于更大范围的另一个任务。

### 对照更新

`docs/frontend-springboot-migration.md` 第 33 节（Login → Permission → 各业务页面功能说明）第 5.12、11.1、11.5 小节里，以下几行随本次改动更新：

- 5.12「API 层校验 `permissions` 含 `admin`」：仍是 ❌（这次做的是角色层级校验，不是「session.permissions 是否含 admin」这个具体检查），但新增了一行「Admin 页面按角色层级校验写操作」✅ 及「Partnership/Audit read_only 全局校验」✅。
- 11.1/11.5：新增说明「read_only 与 Admin 页面层级校验已于 2026-08-27 补上，通用模块级 permission 校验仍缺」。

---
---

# 2. Admin 账号级侧边栏权限覆盖（Permission Override）（2026-08-27）
## Admin 账号级侧边栏权限覆盖（Permission Override）（2026-08-27）

> 配套/前置文档：本文档第 1 节（角色层级 + read_only 全局校验）——本文档是在那之上加的另一个独立功能，两者互不依赖。

### 背景

之前 Edit User 弹窗里的 "Choose permissions" 复选框一直是纯 UI 状态：前端会把勾选结果放进 `permissions: string[]` 字段发给 `/api/userlist/add`/`update`，但 `AdminServiceImpl` 从头到尾没有任何地方读取这个字段——侧边栏权限完全、只按角色（`user_role_permission`）决定，账号级别的勾选提交了也是被静默丢弃。

这次要支持：**在角色默认权限之外，单独给某个账号加/减入口，不影响同角色的其他账号**。

### 设计

没有采用"角色默认 ∪ 账号级 ALLOW/DENY 差集"这种更"通用"的模型（讨论过程见对话记录），原因：
- 差集模型每次都要读两份数据再合并，读取路径变长；
- 跟仓库里 `account_acl_mode`/`process_acl_mode`（`AdminTenantAccess.AclMode`：ALL/CUSTOM/NONE）已经确立的"一个账号非此即彼"的设计语言不一致，多引入一套合并逻辑对维护没有好处；
- 需求本身只是"角色默认"或"这个账号自己的完整清单"二选一，不需要更复杂的模型。

最终采用跟 `AclMode` 同源的二选一设计：

```
user.permission_mode = ROLE_DEFAULT（默认）→ 侧边栏权限 100% 来自 user_role_permission，零额外查询
user.permission_mode = CUSTOM         → 侧边栏权限 100% 来自 user_permission_override 这个账号自己的完整清单
                                          （可以比角色默认多，也可以比角色默认少，两者永远不合并）
```

### 数据库

- [`migrate_add_user_permission_override.sql`](../backend/src/main/resources/sql/migrate_add_user_permission_override.sql)（幂等，跑在已有库上）+ `schema.sql` 基线同步：
  - `user` 表加 `permission_mode ENUM('ROLE_DEFAULT','CUSTOM') NOT NULL DEFAULT 'ROLE_DEFAULT'`
  - 新增 `user_permission_override(user_id, permission_id)`，`user_id` FK 级联删除，按账号精确隔离

### 后端改动

- **`entity/Admin.java`**：加 `permissionMode` 字段 + `PermissionMode { ROLE_DEFAULT, CUSTOM }` 枚举（MyBatis 默认按枚举名字符串映射，跟 `AclMode` 用法一致，没加额外配置）。
- **新增 `entity/UserPermissionOverride.java`**：`{ userId, permissionId }`，仿照 `AdminTenantAccountAccess` 的简单行实体写法。
- **`dao/PermissionDao.java`** 加 `findOverridePermissionsByUserId`；**`dao/AdminDao.java`** 加 `insertOverridePermissionsBatch`、`deleteOverridePermissionsByUserId`。
- **Mapper XML**：
  - `PermissionMapper.xml` 新增对应 select（照抄 `findActivePermissionsByRoleId` 的写法）。
  - `AdminMapper.xml`：`insertAdmin`/`updateAdmin` 带上 `permission_mode` 列；`findAdminById` 的 SELECT 加了这一列；新增 override 表的 insert/delete。
  - `LoginMapper.xml`：`AdminMap`/`AdminColumns` 加 `permission_mode`——这是**登录时**真正影响 session 菜单的地方。
- **`PermissionServiceImpl`**：把原来 `resolveModuleKeysForRoleId` 里"C168 extras + feature gate 过滤 + 排序"这段公共逻辑拆成 `resolveModuleKeysFromPermissions`，角色默认路径和 CUSTOM 路径共用；`resolveAdminModuleKeys` 按 `admin.getPermissionMode()` 二选一读取，永远只读一个来源，不合并。
- **`AdminServiceImpl`**：
  - 新增 `resolvePermissionMode(submittedPermissions, roleId)` — 提交的清单如果跟角色默认完全一致（或没传）就是 `ROLE_DEFAULT`，否则 `CUSTOM`（永远是完整清单，不是差集）。
  - 新增 `persistPermissionOverrides(userId, mode, submittedPermissions)` — 先删后插，跟现有 `replaceAccountAcl`/`replaceProcessAcl` 一个套路，天然幂等；`ROLE_DEFAULT` 时只做清空。
  - 新增 `resolveEffectiveSidebarPermissionCodes(admin)` — 给编辑详情用，CUSTOM 读 override 表，否则退回角色默认。
  - `persistUserForCreate`/`persistUserForUpdate`：角色解析完之后算 `permissionMode` 并写入 `admin` 对象（跟着 insert/update 一起落库），写库成功后调用 `persistPermissionOverrides`。
  - `getAdminDetailByUserId`：把回显权限列表的调用换成 `resolveEffectiveSidebarPermissionCodes(admin)`。

### 踩坑记录：一个自己漏改的 bug（已修复）

`getAdminDetailByUserId` 内部其实有两处拼 `detail.setPermissions(...)` 的地方：

1. Owner 影子行分支（`ownerShadow == true`，很少走到）
2. **普通账号分支（`scopedAccess != null`，几乎所有真实账号，包括测试用的 Customer Service / Audit 账号都走这条）**

第一版改动用 `replace_all` 只成功换掉了第 1 处，第 2 处（真正被使用的那条）还是旧的 `resolveSidebarPermissionCodes(admin.getRoleId())`——纯读角色默认，完全不看 override 表。

**症状**：登录后侧边栏能正确看到额外权限（`PermissionServiceImpl` 那边改对了，是独立的另一套代码路径），但重新打开 Edit User 详情弹窗，权限列表永远只显示角色默认，看起来像是"保存了又被清空"。

**排查过程**：一开始怀疑是前端 `computeRowCapabilities`（层级 gate 导致 `permissions` 字段没发）、`ROLE_HIERARCHY` 里 `"customer service"`（空格）vs 角色码 `CUSTOMER_SERVICE` 经 `normRole()` 转出来的 `"customer_service"`（下划线）不匹配（这个 key 不一致确实是个真实存在的独立小 bug，但数学上推导过，不是这次症状的成因）、数据库迁移没跑、后端没重启——一个个排除之后，最后翻回后端代码逐行核对才发现是这个漏改的调用点。用户提供的"登录后侧边栏正常，但编辑详情页看不到"这个关键区别信息，是定位到问题的决定性线索。

现在两处都指向 `resolveEffectiveSidebarPermissionCodes`。

### 前端

**不需要改动。** 已确认现有的 `permSelected`/`permDisabledMap`/save 逻辑本来就会把完整勾选清单发给后端（`permissions` 字段），只是后端之前完全不处理。

### 验证方式

1. 编辑一个非 Owner/Partnership/Admin 角色的账号（比如 Customer Service 或 Audit），在 Permissions 里额外勾选角色默认之外的入口，保存。
2. 重新打开同一账号的 Edit User，确认权限列表包含角色默认 + 新加的入口（这一步是本次修的 bug，之前会丢失）。
3. 用该账号登录，确认侧边栏也出现了额外入口（这一步之前就是对的）。
4. 检查同角色的**其他**账号权限没有被影响（按 `user_id` 精确隔离）。

---
---

# 3. Account / Process 数据权限修复
## Account / Process 数据权限修复

Edit User 页面的 Account / Process 勾选，控制一个 admin/staff 登录后能在
`/api/account/list`（Account 列表页）、`/api/process/process-list`（Process 列表页）
里看到哪些数据。这份文档记录围绕这个功能修的几个 bug。

### 涉及文件

- `backend/src/main/java/com/eazycount/service/impl/UserServiceImpl.java`
- `backend/src/main/java/com/eazycount/service/impl/ProcessServiceImpl.java`
- `backend/src/main/java/com/eazycount/service/impl/AdminServiceImpl.java`
- `backend/src/main/java/com/eazycount/dto/AdminDTO.java`（无残留改动，最终与改动前一致）
- 前端未改动（曾短暂加过一个多租户标签页 UI，已完全撤销）

### 数据模型

- `AdminTenantAccess`（表 `user_tenant_access`）：每个 (admin, tenant) 一条记录，
  `accountAclMode` / `processAclMode` 取值 `ALL`（不限制）/ `NONE`（清空）/ `CUSTOM`（自定义白名单）。
- `AdminTenantAccountAccess`（表 `user_tenant_account_access`）：`CUSTOM` 模式下的账户白名单，FK 到 `account.id`。
- `AdminTenantProcessAccess`（表 `user_tenant_process_access`）：`CUSTOM` 模式下的流程白名单，FK 到 `process.id`。
- `account`、`process` 都是**严格按单一 tenant_id 归属**的表，没有跨租户共享。

### 问题 1：读取接口没有做权限过滤

**现象**：Edit User 里清空 Account/Process 勾选并保存后，该账号登录仍能看到全部数据。

**原因**：`/api/account/list`、`/api/process/process-list` 只是无条件查询整个租户下的所有数据，
完全没有读取 `AdminTenantAccess`/`AdminTenantAccountAccess`/`AdminTenantProcessAccess` 这几张权限表。

**修复**：`UserServiceImpl.findUserByTenantId` 新增 `filterByAccountAcl`，
`ProcessServiceImpl.findProcessByTenantId` 新增 `filterByProcessAcl`，逻辑对称：

```java
SessionUser session = SecurityUtils.currentUser();
if (session == null || !"user".equalsIgnoreCase(session.user_type)) return rows;   // 仅限管理端/staff登录

AdminTenantAccess access = adminDao.findTenantAccessByUserIdAndTenantId(session.user_id, tenantId);
if (access == null || access.getAccountAclMode() == ALL) return rows;   // 不限制
if (access.getAccountAclMode() == NONE) return List.of();               // 清空

Set<Integer> allowedIds = ...查 admin_tenant_account_access 得到的白名单...;
return rows.stream().filter(r -> allowedIds.contains(r.getId())).toList();  // CUSTOM
```

只影响这一条查询路径，不影响 `userDao`/`processDao` 被其他内部逻辑（如 `AutoRenewServiceImpl`、
`DomainServiceImpl`）直接调用的场景。

### 问题 2：一个账号被授权多个 Company 时，保存会把权限套错公司

**现象**：账号同时被授权 AP、C168、QQ，Edit User 里勾的清单保存后，切到 C168 / QQ 反而看不到数据。

**原因**：原逻辑是"遍历这个账号被授权的所有公司，把同一份勾选清单塞给每一个"。但 Account/Process 是
每个公司各自独立的表，C168 的 process id=5 和 QQ 的 process id=5 是完全不同的两条记录，
把同一份 ID 清单套到别的公司，等于套了一堆不存在的 ID，查出来自然是空的。

**修复**：`AdminServiceImpl.syncTenantGrants` 改成——本次保存的勾选清单，**只应用到当前编辑所在的那个公司**
（`scopeTenantId`）；这个账号被授权的其他公司保持原样不动：

```java
for (Integer tenantId : tenantIds) {          // 这个账号被授权的所有公司
    boolean isScopedTenant = scopeTenantId.equals(tenantId);
    access = isScopedTenant
        ? syncScopedTenantAccess(admin.getId(), tenantId, dto)   // 当前公司：应用本次勾选
        : ensureUnscopedTenantAccess(admin.getId(), tenantId);   // 其他公司：原样保留 / 新公司默认 ALL
}
```

`ensureUnscopedTenantAccess`：该公司之前已有权限记录就不动；如果是这个账号第一次被加进这家公司
（还没人配置过），默认给 `ALL`（不限制），直到管理员切到那家公司下专门编辑保存。

**使用方式**：想给不同公司设不同权限，就切到对应 Group/Company 上下文，分别打开 Edit User、
分别勾选保存。不需要任何额外 UI（中途曾加过一个公司切换标签页，已撤销，前端代码与改动前一致）。

### 问题 3：`null` 和 `[]` 被当成同一回事，全选保存后变成清空

**现象**：Account 面板全选（或从未动过、默认全选）保存后，登录看到的是空列表，跟点 Clear All 效果一样。

**原因**：前端这两种情况发送的请求体不同：
- 全选 / 从未限制过 → `accountPermissions: null`
- 点 Clear All → `accountPermissions: []`（空数组）

原来的 `resolveAclModes` 把 `null` 先强制转成空数组，之后就跟真正的 `[]` 没区别，两种语义不同的输入
被判成了同一个结果——`NONE`（一个都不给看）。

**修复**：拆开判断：

```java
private AclMode resolveAclMode(List<?> itemsRaw) {
    if (itemsRaw == null) return AclMode.ALL;                      // 全选 / 不限制
    return itemsRaw.isEmpty() ? AclMode.NONE : AclMode.CUSTOM;      // [] 清空 / 非空 自定义清单
}
```

与读取那边（`resolveAccountPermissions` 把 `ALL` 模式回显成 `null` 给前端）保持对称。

### 完整链路（修复后）

| 前端勾选状态 | 请求体 | 存的 AclMode | 登录后看到的数据 |
|---|---|---|---|
| Clear All（全部取消勾选） | `[]` | `NONE` | 空 |
| 全选 / 从未动过 | `null` | `ALL` | 全部 |
| 勾选部分 | `[{id:1},{id:2},...]` | `CUSTOM` | 只有勾选的那些 |

多公司账号：每个公司在自己的 Group/Company 上下文下独立保存，互不影响；新授权但还没设置过的公司默认 `ALL`。

---
---

# 4. Admin 用户列表：新建 Group 后单 Group 视图看不到自己数据
## Admin 用户列表：新建 Group 后单 Group 视图看不到自己数据

### 问题现象

- Owner 新建一个 Domain/Group（例如 Group "Q"，无下属 Company）。
- 切到 Admin 用户列表页，选择 **Company** 维度筛选（例如 Q1）能立刻看到自己 Owner 的账号数据。
- 但切到**单 Group 维度**（选中 Group "Q"，Company 栏为空）时，列表却是空的，要等很久或反复刷新页面好几次才会出现。
- 后端没有任何异步复制、消息队列或缓存延迟——建 Group 是同步事务，查询接口也不带缓存，问题完全出在前端。详见 [Count-frontend/docs/userlist-group-mode-issues.md](../../Count-frontend/docs/userlist-group-mode-issues.md) 的根因分析。

### 本次后端改动

为配合前端修复，新增一个**始终查库、不带任何缓存**的按 code 查 tenant id 接口，供前端在本地缓存过期/未刷新时兜底调用。

#### 新增接口

`GET /auth/tenant-by-code?code=Q`

- [`AuthController.java`](../backend/src/main/java/com/eazycount/controller/AuthController.java) — 新增 `tenantByCode` 方法，鉴权方式与既有的 `/auth/tenant-accessible` 一致（`SecurityUtils.currentUser()`，未登录返回 401）。
- [`AuthService.java`](../backend/src/main/java/com/eazycount/service/AuthService.java) / [`AuthServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/AuthServiceImpl.java) — 新增 `tenantByCode(String code)`：

```java
@Override
public Map<String, Object> tenantByCode(String code) {
    SessionUser user = SecurityUtils.currentUser();
    ...
    String userType = String.valueOf(user.user_type).trim().toLowerCase();
    List<TenantDTO> rows = findAllTenantsByUserType(userType, user.user_id);
    Tenant match = TenantDtoHelper.distinctTenants(rows).stream()
            .filter(t -> t != null && normalized.equalsIgnoreCase(t.getCode()))
            .findFirst()
            .orElse(null);
    ...
}
```

复用了 `accessibleTenants()` 同一套数据源 `findAllTenantsByUserType`（owner/member/user 三种身份都走同一鉴权规则），只是把结果按 code 过滤到一条，而不是返回全量列表——语义上等价于"从 `/auth/tenant-accessible` 里挑一条"，但不用前端每次都拉全量再本地匹配。

返回格式：

```json
{ "success": true, "message": "", "data": { "tenant_id": 123, "tenant_code": "Q", "tenant_type": "GROUP" } }
```

查不到时 `data` 为 `null`（不算错误，前端按"暂不存在"处理）。

### 为什么不直接复用 `DomainDao.findTenantByCodeAndOwnerId`

`DomainServiceImpl` 内部建 Group/Company 时用的 `domainDao.findTenantByCodeAndOwnerId(code, ownerId)` 需要显式传入 `ownerId`，这对 Owner 类型的会话没问题（`user_id` 就是 `ownerId`），但对 Member/Admin 类型的会话不成立（他们的可见 tenant 集合是通过 `findTenantFeaturesByMemberId` / `findTenantFeaturesByAdminId` 算出来的，不是简单的 `owner_id` 匹配）。所以新接口选择复用 `accessibleTenants()` 同一条鉴权路径，保证跟这三种登录身份的现有权限模型完全一致，不会因为身份不同而查漏或越权。

### 验证

- `./mvnw -q -o compile` 通过，无编译错误。
- 未修改任何既有接口的行为，`domain/*`、`auth/tenant-accessible`、`auth/current-user` 等均未改动。

### 影响范围

- 新增文件：无（只在既有 `AuthController` / `AuthService` / `AuthServiceImpl` 里追加方法）。
- 纯新增只读接口，不涉及写操作，不影响现有登录/鉴权流程。

---
---

# 5. Admin / Owner / Account：Last Login & Last Logout 追踪
## Admin / Owner / Account：Last Login & Last Logout 追踪

后端在三张身份表（`user` = Admin-tab、`owner` = Owner、`account` = Member-tab）上补齐了登录/登出
时间戳，供 Admin User List 和 Account List 的 "Last Login" / "Last Logout" 两列展示使用。

前端展示/交互细节见 `Count-frontend` 仓库的
[`docs/account-userlist-display.md`](../../Count-frontend/docs/account-userlist-display.md)（Last Login/Logout 一节）。这份文档只
记录后端部分。

### 覆盖范围的共同限制

三张表的 `last_logout` **只在成功调用 `POST /auth/logout` 时才会写入**。浏览器直接关闭标签页、
token 自然过期而没有走这个接口的情况，不会被记录——这是当前认证机制（JWT + Cookie，前端主动登出）
下的固有限制，不是 bug。

### 1. Admin（`user` 表）

`last_login` 本来就存在且已经在写入，只是 `last_logout` 和更新逻辑是新加的。

- **Schema**：[`schema.sql`](../backend/src/main/resources/sql/schema.sql) 加 `last_logout DATETIME
  DEFAULT NULL`；已有库用
  [`migrate_add_last_logout_to_user.sql`](../backend/src/main/resources/sql/migrate_add_last_logout_to_user.sql)
  补齐（`information_schema` 判断后 `ADD COLUMN`，可安全重跑）。
- **实体**：[`Admin.java`](../backend/src/main/java/com/eazycount/entity/Admin.java) 加
  `lastLogout` 字段。
- **写入**：
  [`AuthDao.updateAdminLastLogout`](../backend/src/main/java/com/eazycount/dao/AuthDao.java) +
  [`LoginMapper.xml`](../backend/src/main/resources/mybatis/LoginMapper.xml) 的
  `UPDATE user SET last_logout = NOW() WHERE id = #{adminId}`。
  [`AuthServiceImpl.logout()`](../backend/src/main/java/com/eazycount/service/impl/AuthServiceImpl.java)
  按 `SessionUser.user_type == "user"` 分流调用。
- **读取**：[`AdminMapper.xml`](../backend/src/main/resources/mybatis/AdminMapper.xml) 的
  `AdminListDTO` resultMap 及 `findAdminsByTenantId` / `findDuplicateLoginIdLoginId` /
  `findAdminByUserIdAndTenantId` / `findAdminById` 都加了 `last_logout` 列映射。
- **顺手没动的已知问题**：Owner 通过 Admin-tab 登录（`AuthServiceImpl.login()` 里
  `findAdminByLoginId` 落空后才 fallback 到 `findOwnerByOwnerCode` 的那条分支，见下一节）已经会
  更新 `owner.last_login`；但如果未来发现 `user` 表本身在某条登录分支漏更新 `last_login`，那是独立
  问题，本次没有改动这部分。

### 2. Owner（`owner` 表）

`owner` 表之前**完全没有**任何登录/登出时间字段，即使 Admin User List 一直有个 Owner 的"影子行"
展示 Last Login 列，数据源头也从来不存在，所以永远显示占位符。

- **Schema**：[`schema.sql`](../backend/src/main/resources/sql/schema.sql) 加 `last_login` +
  `last_logout` 两列（都是新的）；已有库用
  [`migrate_add_last_login_logout_to_owner.sql`](../backend/src/main/resources/sql/migrate_add_last_login_logout_to_owner.sql)。
- **实体**：[`Owner.java`](../backend/src/main/java/com/eazycount/entity/Owner.java) 加
  `lastLogin` / `lastLogout` 字段。
- **写入**：`AuthDao.updateOwnerLastLogin` / `updateOwnerLastLogout` +
  `LoginMapper.xml` 对应 SQL。`AuthServiceImpl.login()` 的 Owner 分支（`findOwnerByOwnerCode`
  验证通过后）调用 `updateOwnerLastLogin`；`logout()` 按 `user_type == "owner"` 调用
  `updateOwnerLastLogout`。
- **读取**：[`DomainMapper.xml`](../backend/src/main/resources/mybatis/DomainMapper.xml) 的
  `OwnerMap`（`findOwnerById` 用 `select *`，之前完全没映射这两列，读出来恒为 `null`）补上
  `lastLogin` → `last_login`、`lastLogout` → `last_logout`。
- **传到 Admin User List 的影子行**：
  [`AdminServiceImpl.mapOwnerToAdminShell()`](../backend/src/main/java/com/eazycount/service/impl/AdminServiceImpl.java)
  把 `owner.getLastLogin()` / `owner.getLastLogout()` 塞进合成的 `Admin` 对象，序列化后跟 Admin
  行走的是同一个 `admin.lastLogin` / `admin.lastLogout` JSON 字段，前端不需要区分 Admin 行还是
  Owner 影子行。

### 3. Account / Member（`account` 表）

`last_login` 本来就存在且登录时已经在写入（`AuthServiceImpl.login()` 的 `LoginRole.MEMBER`
分支），但列表查询从来没有把它 SELECT 出来，所以前端一直显示占位符；`last_logout` 是全新的。

- **Schema**：[`schema.sql`](../backend/src/main/resources/sql/schema.sql) 加 `last_logout
  DATETIME DEFAULT NULL`；已有库用
  [`migrate_add_last_logout_to_account.sql`](../backend/src/main/resources/sql/migrate_add_last_logout_to_account.sql)。
- **实体**：[`User.java`](../backend/src/main/java/com/eazycount/entity/User.java)（对应
  `account` 表，命名容易和 Admin/Owner 的 "User" 混淆，注意区分）加 `lastLogout` 字段。
- **写入**：`AuthDao.updateMemberLastLogout` + `LoginMapper.xml` 对应 SQL；
  `AuthServiceImpl.logout()` 按 `user_type == "member"` 分流调用。
- **DTO**：[`UserListDTO.java`](../backend/src/main/java/com/eazycount/dto/UserListDTO.java) 加
  `lastLogout` 字段（`lastLogin` 本来就有）。
- **读取 bug 修复**：[`AccountMapper.xml`](../backend/src/main/resources/mybatis/AccountMapper.xml)
  的 `findUserByTenantId` / `findUserByIdAndTenantId` 两处 SELECT 之前把列名写成驼峰
  `a.lastLogin` / `a.lastLogout`，但实际数据库列是下划线 `last_login` / `last_logout`——这两个
  接口一跑就会报 `Unknown column`。已改成 `a.last_login AS accountLogin` /
  `a.last_logout AS accountLogout`，跟 `UserListDTOMap` 的既有映射对上。

### 涉及文件汇总

- `backend/src/main/resources/sql/schema.sql`
- `backend/src/main/resources/sql/migrate_add_last_logout_to_user.sql`（新增）
- `backend/src/main/resources/sql/migrate_add_last_login_logout_to_owner.sql`（新增）
- `backend/src/main/resources/sql/migrate_add_last_logout_to_account.sql`（新增）
- `backend/src/main/java/com/eazycount/entity/Admin.java`
- `backend/src/main/java/com/eazycount/entity/Owner.java`
- `backend/src/main/java/com/eazycount/entity/User.java`
- `backend/src/main/java/com/eazycount/dto/UserListDTO.java`
- `backend/src/main/java/com/eazycount/dao/AuthDao.java`
- `backend/src/main/resources/mybatis/LoginMapper.xml`
- `backend/src/main/resources/mybatis/AdminMapper.xml`
- `backend/src/main/resources/mybatis/DomainMapper.xml`
- `backend/src/main/resources/mybatis/AccountMapper.xml`
- `backend/src/main/java/com/eazycount/service/impl/AuthServiceImpl.java`
- `backend/src/main/java/com/eazycount/service/impl/AdminServiceImpl.java`

### 已知限制

- 只在本地开发库验证过 `mvn compile` 和迁移脚本语法；正式库（`count_real`）还没跑过这三条
  migration。
- 没有端到端自动化测试，联调时需要人工验证三种登录路径（Admin/Owner/Member）各自的
  Login/Logout 时间是否正确落库、以及在对应列表页面正确显示。
