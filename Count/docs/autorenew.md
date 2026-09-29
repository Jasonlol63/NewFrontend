# Auto Renew 页面 — 迁移 / 修复记录

> **本文档由 3 份合并而成**（2026-09-22），并把文件名对齐前端侧同名文档
> （`Count-frontend/docs/autorenew.md`，那边也是 2 份合并来的）。内部顺序：先迁移记录，后各项改动。
>
> | 顺序 | 来源文档 | 定位 |
> |---|---|---|
> | 1 | `autorenew-springboot-rewire.md` | 迁移记录 —— Auto Renew 页面接回 Spring Boot API |
> | 2 | `autorenew-daterange-counts-fix.md` | 修复 —— 日期范围不影响 badge 计数 / Show All 空表（**根因完全在后端**：`AutoRenewMapper.xml` / `AutoRenewService*` / `AutoRenewDao`） |
> | 3 | `autorenew-charge-on-approve-toggle.md` | 功能 —— 每行独立的 "Charge" 开关（全栈） |

---
---

# 1. Auto Renew 页面 — 接回 Spring Boot API（迁移记录）
## Auto Renew 页面 — 接回 Spring Boot API

> **范围**：`src/pages/autorenew/`（`autoRenewLogic.js` / `autoRenewTenantSettings.js`）+
> `src/utils/autoRenew/autoRenewPendingSync.js` + `src/pages/autorenew/AutoRenewPage.jsx`（Approve
> 提交参数）。**没有改动任何后端代码** —— 所需的 `/api/auto-renew/*` 端点已存在
> （`AutoRenewController`），Comm 设置弹窗复用的是 Domain 迁移（见
> `domain.md` 第 1 节）时已经接好的 `domainApi.js`。
> **最后更新**：2026-08-24

---

### 1. 修复总览

| 能力 | 旧 PHP 端点 | 新 Spring 端点 | 改动文件 |
|------|-------------|-----------------|----------|
| 列表 / 统计 / pending 数 | `POST api/subscription/auto_renew_api.php`（`action:list`） | `fetchAutoRenewApprovals()` → `POST /api/auto-renew/list` | `autoRenewLogic.js` |
| 拒绝续费 | `POST auto_renew_api.php`（`action:reject`） | `rejectAutoRenew()` → `POST /api/auto-renew/reject` | `autoRenewLogic.js` |
| 通过续费 | `POST auto_renew_api.php`（`action:approve`，带 `from_account_id`/`to_account_id`） | `approveAutoRenew()` → `POST /api/auto-renew/approve`，**只传 `request_id` + `period`**（后端自己按 C168 账户解析 from/to，见下方"字段校验"） | `autoRenewLogic.js`, `AutoRenewPage.jsx` |
| 侧边栏 pending 徽章轮询 | `POST auto_renew_api.php`（`action:pending_count`） | 直接 `POST /api/auto-renew/list`（`action:pending_count`），不再经旧 rewrite 表 | `autoRenewPendingSync.js` |
| Comm 设置弹窗：打开时加载 group/company 详情 | `POST api/domain/domain_api.php`（`get_groups`/`get_companies`） | `fetchDomainList(ownerId)` → `POST /api/domain/list?ownerId=`，从聚合返回的 `groups_full`/`companies_full` 里按 code 匹配 | `autoRenewTenantSettings.js` |
| Comm 设置弹窗：Price 预览 | `POST domain_api.php`（`get_domain_fee_settings`） | `fetchDomainFeeSettings()` → `POST /api/domain/list-fee` | `autoRenewTenantSettings.js` |
| Comm 设置弹窗：保存 Share % | 已经是 Spring（Domain 迁移时接好） | `updateTenantSetting()` → `PUT /api/domain/update-setting`（`commissionOnly` 模式） | 未改动（`CompanySettingsModal.jsx`/`GroupSettingsModal.jsx`） |

---

### 2. 字段校验 / tenant 解析都交给后端

- **列表/审批的 tenant 归属**：`request_id`、`period` 以外不再由前端拼装校验逻辑；能否
  Approve（`canApproveRow`）仍由前端做 UI 层的按钮禁用判断（period 是否选、
  `default_from_account_id`/`default_to_account_id` 是否存在、价格是否 > 0），但这只是禁用态展示，
  真正的账户解析、金额计算、写账都在 `AutoRenewServiceImpl.approveRequest` 里用后端当前数据重新算一遍
  ——前端算错也不会污染数据，最多是按钮该亮没亮。
- **Comm 设置弹窗的 tenant 归属**：`ownerId` 现在是从 `fetchDomainList(ownerId)` 的查询参数传入，由
  Spring 按登录态 + `ownerId` 过滤返回该 owner 名下的 tenant，前端不再自己拼 `owner_id` 去 PHP 查询
  过滤；`code` 匹配（group_code / company_id）只是在返回结果里定位具体那一行，不构成校验。
- **保存 Share %**：`updateTenantSetting()` 提交时带 `id`（真实 tenant id，来自 `fetchDomainList`
  聚合行），后端按 `id` 定位 tenant、校验 owner 归属，不接受前端自报的 owner/tenant 关系。

---

### 3. 已知缺口：Delete / Save Draft 没有 Spring 端点

查过后端源码（`Count/backend/.../controller/AutoRenewController.java` +
`service/AutoRenewService.java`），目前只有：

```
POST /api/auto-renew/list
POST /api/auto-renew/reject
POST /api/auto-renew/approve
```

**没有 `/delete` 也没有 `/save_draft`**。这两个动作（列表里"删除/撤销已处理记录"按钮、以及从未在 UI
上实际调用过的草稿保存）本次**保留调用旧的 `api/subscription/auto_renew_api.php`**（`autoRenewLogic.js`
里的 `postAutoRenewLegacy`），在当前环境本来就是不通的——`utils/core/apiUrl.js` 里遗留的 rewrite 规则
会把它错误地转发到 `/api/auto-renew/list`，不是本次改动引入的新问题，只是没有把它伪装成"已迁移"。

**要让 Delete 生效，需要后端补一个 `/api/auto-renew/delete` 接口**（对齐
`Count/docs/frontend-springboot-migration.md` §7.4/§11.5 记录的缺口：Delete/回滚还没接 Spring
approve 写入的多笔 Domain Fee 行）。

---

### 4. 验证清单

- 前端 `npm run build` 通过（无 import/语法错误，已确认）。
- 待人工验证（需要本地 Spring Boot + 前端都在跑，且有 C168 运营测试账号）：
  1. 列表加载（Pending/Approved/Rejected/All 四个 tab，Company/Group 两个页签），Network 面板只看到
     `POST /api/auto-renew/list`，无 `.php`。
  2. Approve：选 period → 提交，Network 看到 `POST /api/auto-renew/approve`（body 只有
     `request_id`/`period`），到期日与记账结果符合预期。
  3. Reject。
  4. Comm 设置弹窗：打开加载、Share % 保存。
  5. 侧边栏 pending 徽章数字与列表页 tab 计数一致。
  6. （已知会失败，非本次引入）Delete/撤销按钮——确认失败提示，不是本次改动的回归。

---

### 5. 备份

本记录（现并入本文档第 1 节）同步维护于后端仓库，并在
`Count/docs/frontend-springboot-migration.md` §4.7 更新了状态。

---
---

# 2. Auto Renew — Date-range counts/list mismatch fix
## Auto Renew — Date-range counts/list mismatch fix

> **最后更新**：2026-09-01

### Symptom
On the Auto Renew page, picking a date range in the picker did not change the Pending /
Approved / Rejected / Show All badge numbers next to the filter chips — they always showed
the same totals regardless of the selected range. Separately, once counts were made
date-range aware, `Show All` started returning an **empty list** on days with pending
requests but no approved/rejected activity, even though its badge correctly showed a
non-zero count.

### Root cause

#### 1. Counts ignored the date range entirely
`AutoRenewDao.countRequestsByStatus(status, tenantType, windowDays)` had no `dateFrom`/
`dateTo` parameters at all. Pending count used the existing expiration-window logic
(`DATEDIFF(t.expiration_date, CURDATE()) <= windowDays`, correct/unaffected), but
approved/rejected counted **every matching row that ever existed**, with no `processed_at`
filter — while `selectAutoRenewList` (the row list backing the same tabs) already filtered
approved/rejected rows by `DATE(r.processed_at)` within the selected range. Badge vs. row
count could diverge any time a date range narrower than "all time" was picked.

#### 2. Show All silently dropped every pending row
`selectAutoRenewList`'s `<where>` block had:
```xml
<if test="status != 'pending'">
    <if test="dateFrom != null">AND DATE(r.processed_at) &gt;= #{dateFrom}</if>
    <if test="dateTo != null">AND DATE(r.processed_at) &lt;= #{dateTo}</if>
</if>
```
For Show All, `status` is `null` (the service maps `"all"` → `null`). In MyBatis OGNL,
`null != 'pending'` evaluates to `true`, so this branch fired **for every row regardless of
its actual status**, including pending rows. Pending rows have `processed_at = NULL`, and
`NULL >= '2026-09-01'` is never true in SQL — so every pending row was silently excluded
from the Show All list whenever any date range was set (which is always, since the frontend
sends a default range on load).

### Fix

**`backend/src/main/resources/mybatis/AutoRenewMapper.xml`**
- `countRequestsByStatus`: added `dateFrom`/`dateTo` params. Pending keeps the window-based
  filter untouched; approved/rejected now filter on `DATE(r.processed_at)` within the
  selected range, matching `selectAutoRenewList`'s existing per-row logic.
- `selectAutoRenewList`: restructured the `<where>` so a specific status keeps its existing
  branch (pending → window, approved/rejected → date range), and the Show All (`status ==
  null`) case now uses an explicit `OR` group instead of one blanket condition:
  ```sql
  (r.status = 'pending' AND DATEDIFF(t.expiration_date, CURDATE()) <= windowDays)
  OR (r.status IN ('approved','rejected') AND DATE(r.processed_at) BETWEEN dateFrom AND dateTo)
  ```

**`backend/src/main/java/com/eazycount/dao/AutoRenewDao.java`**
- `countRequestsByStatus` signature gains `LocalDate dateFrom, LocalDate dateTo`.

**`backend/src/main/java/com/eazycount/service/AutoRenewService.java` /
`service/impl/AutoRenewServiceImpl.java`**
- `getAutoRenewCounts(tenantType, windowDays)` → `getAutoRenewCounts(tenantType, windowDays,
  dateFrom, dateTo)`. Pending's own `countRequestsByStatus` call always passes
  `(null, null)` (window-based, unaffected by range); approved/rejected pass through the
  real range. `total = pending + approved + rejected` is unchanged and now stays consistent
  automatically.
- `getAutoRenewList(...)` forwards its already-parsed `dateFrom`/`dateTo` into the
  `getAutoRenewCounts` call it makes to populate the response's `counts` field.

**`backend/src/main/java/com/eazycount/controller/AutoRenewController.java`**
- The `pending_count` short-circuit branch (used by the sidebar pending badge, unrelated to
  the date picker) updated to the new signature, passing `(null, null)`.

### Why this shouldn't recur
Every place that counts or lists auto-renew requests now applies exactly one rule per
status: pending is always window-based (never date-range-filtered), approved/rejected are
always date-range-based (never window-filtered), and Show All is an explicit `OR` of both
rules rather than one condition applied indiscriminately to every row. There's no longer a
code path where a status-agnostic filter (like the old blanket `processed_at` check) can
accidentally exclude rows whose status it was never meant to touch.

### Verification
Confirmed directly against `count_real` data for a 2026-09-01 → 2026-09-01 range: 2 pending
requests (tenants `BK1`, `M2`), 0 approved/rejected in that window. Badge counts
(`Pending 2 / Approved 0 / Rejected 0 / Show All 2`) now match the row lists exactly,
including Show All returning both pending rows instead of an empty table.

### Files changed
- `backend/src/main/resources/mybatis/AutoRenewMapper.xml`
- `backend/src/main/java/com/eazycount/dao/AutoRenewDao.java`
- `backend/src/main/java/com/eazycount/service/AutoRenewService.java`
- `backend/src/main/java/com/eazycount/service/impl/AutoRenewServiceImpl.java`
- `backend/src/main/java/com/eazycount/controller/AutoRenewController.java`

### Frontend
`Count-frontend/src/pages/autorenew/AutoRenewPage.jsx` — filter chips reordered to
`Show All → Pending → Approved → Rejected` (default selected filter stays Pending); no
change needed to how it calls `/api/auto-renew/list` (`dateFrom`/`dateTo` were already
being sent). See `Count-frontend/docs/autorenew.md`.

---
---

# 3. Auto Renew — per-row "Charge" toggle on Approve
## Auto Renew — per-row "Charge" toggle on Approve

> 范围：在 Auto Renew 页面的每一行（仅 pending 可编辑行）新增一个开关，控制点击 Approve 时是否要生成 Domain Fee + Commission 流水，语义与 Domain 页面 Company/Group Settings 弹窗里的 "收费开关"（`chargeDomainFeeOnConfirm`）一致，但这里是**逐行独立**的，不是租户级全局设置。

---

### 1. 需求背景

Domain 页面的 Company/Group Settings 弹窗里已经有一个开关：保存设置时是否要立即对该租户收一次 Domain Fee（`CompanySettingsModal.jsx` 的 `chargeOnSave`）。

Auto Renew 页面此前审批（Approve）时**无条件**收费——只要点 Approve，就一定会调用 `DomainFeeChargeService.chargeDomainFee(...)` 生成 Domain Fee + Commission 两笔交易。用户希望在 Auto Renew 页面也能选择"只延长到期日、不产生付款"（例如白名单续期场景）。

要求：这个开关**放在每一行**（不是弹窗、也不是页面级全局开关），批准时按当前行的开关状态决定要不要收费。

---

### 2. 后端改动

复用的是 Domain 页面同一套收费服务 `DomainFeeChargeService`，approve 流程本身没变，只是给它加了一个"是否执行"的开关。

| 文件 | 改动 |
|---|---|
| [`backend/src/main/java/com/eazycount/dto/AutoRenewApprovalRequest.java`](../backend/src/main/java/com/eazycount/dto/AutoRenewApprovalRequest.java) | 新增 `Boolean chargeOnApprove`（JSON 字段 `charge_on_approve`）。`reject` 接口共用这个 DTO 但不传该字段，不受影响。 |
| [`backend/src/main/java/com/eazycount/controller/AutoRenewController.java`](../backend/src/main/java/com/eazycount/controller/AutoRenewController.java) | `approve` 接口读取该字段，**未传时默认为 `true`**（保持旧行为向后兼容），再传给 Service 层。 |
| [`backend/src/main/java/com/eazycount/service/AutoRenewService.java`](../backend/src/main/java/com/eazycount/service/AutoRenewService.java) / [`service/impl/AutoRenewServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/AutoRenewServiceImpl.java) | `approveRequest(Integer requestId, String period)` → `approveRequest(Integer requestId, String period, boolean chargeOnApprove)`。原来无条件调用的 `domainFeeChargeService.chargeDomainFee(tenant, period)` 改成：<br>`chargeOnApprove ? domainFeeChargeService.chargeDomainFee(tenant, period) : Collections.emptyList()`<br>其余逻辑不变：价格仍然会查（`domainListFeePriceDao.findPriceByTenantTypeAndPeriod`，没配置价格照样报错拦住），到期日照样延长（`autoRenewDao.updateTenantExpiration`），审批记录照样落库（`autoRenewDao.approveRequest(...)`，`price` 字段存的是"应付价格"，即使没收费也会记录这个数值用于展示）。 |

**关掉开关时的行为**：只延长 `tenant.expiration_date`、把请求标记为已审批，**不生成 Transaction、不插入 `insertRequestTransactionLink`**，也就是完全不留付款记录。

---

### 3. 前端改动

| 文件 | 改动 |
|---|---|
| [`Count-frontend/src/pages/autorenew/AutoRenewPage.jsx`](../../Count-frontend/src/pages/autorenew/AutoRenewPage.jsx) | 在表头 Period 和 Status 之间插入一列 "Charge"；表格行里仅 `isPendingEditable` 的行渲染开关（非 pending 行显示 `—`）。开关 UI 直接复用 Domain 页面 `CompanySettingsModal.jsx` 里同款的 `company-share-charge-on-save` / `company-share-charge-switch` 样式类，视觉上和 Domain 页面保持一致。开关状态写入 `rowDrafts[requestId].chargeOnApprove`，`updateDraft(row.request_id, { chargeOnApprove: e.target.checked })`。确认批准弹窗的文案（`confirmApprove` / `confirmApproveNoCharge`）会根据这一行当前的开关状态动态切换，明确告知"会/不会创建付款"。 |
| [`Count-frontend/src/pages/autorenew/autoRenewPageHelpers.js`](../../Count-frontend/src/pages/autorenew/autoRenewPageHelpers.js) | `getRowDraftValues(row, drafts)` 返回值新增 `chargeOnApprove: draft.chargeOnApprove ?? true`（默认开，与后端默认值保持一致）。 |
| [`Count-frontend/src/pages/autorenew/autoRenewLogic.js`](../../Count-frontend/src/pages/autorenew/autoRenewLogic.js) | `approveAutoRenew({ requestId, period, chargeOnApprove = true })` 请求体新增 `charge_on_approve` 字段，POST 到 `api/auto-renew/approve`。 |
| [`Count-frontend/src/translateFile/pages/autoRenewTranslate.js`](../../Count-frontend/src/translateFile/pages/autoRenewTranslate.js) | 新增中英文案：`colCharge`（列头 "Charge"/"收费"）、`on`/`off`、`chargeToggleAria`、`confirmApproveNoCharge`（关闭收费时的确认弹窗文案）。 |
| [`Count-frontend/public/css/auto_renew.css`](../../Count-frontend/public/css/auto_renew.css) | 表格 grid 布局从 8 列（无 Submitter）/ 9 列（有 Submitter）扩为 9 列 / 10 列，在所有响应式断点（默认桌面、≤1280px、1025–1440px 13寸覆盖、≤1024 平板，含中英文两套宽度）同步插入新增列的宽度定义；同时把 `--auto-renew-table-min-width` 及各断点 `min-width: max(100%, …)` 的横向滚动阈值都相应调大，给新列留出空间。 |

---

### 4. 兼容性

- 后端 `charge_on_approve` 字段未传时按 `true` 处理，任何还在用旧请求体的调用方（理论上不存在，因为只有这一个前端在调）行为不变。
- 数据库结构无改动，完全复用现有 `Transaction` / `tenant_auto_renew` 表；关闭收费时只是不写入交易记录，不是新增字段去标记"是否已收费"——如果之后要在已批准列表里回显某一行当时有没有收费，需要额外加字段记录，目前没有做。

---

### 5. 验证情况

- `./mvnw.cmd -o compile`：后端编译通过。
- `npx vite build`：前端构建两轮均无编译/语法错误。
- **未做真实登录环境下的端到端浏览器验证**（该环境没有跑起来的带数据库鉴权会话），列宽在真实数据下的视觉效果、窄屏换行情况建议本地起服务后实测一遍。
