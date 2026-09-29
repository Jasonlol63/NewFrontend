# Bank Process 页面 — 功能 / 修复记录（含 Accounting Due）

> **本文档由 3 份合并而成**（2026-09-22）。三份同属 Bank Process 页面家族——Bank Balance 与 Monthly
> dues 都在 Bank Process 弹窗/计算里，Accounting Due 是从 Bank Process 进入的
> （后端 `BkProcessAccountingDueController`）。
>
> | 顺序 | 来源文档 | 定位 |
> |---|---|---|
> | 1 | `bank-process-bank-balance.md` | 功能 —— Bank Balance（一次性 Contra 结余） |
> | 2 | `bank-process-monthly-dues-extra-period-fix.md` | 修复（2026-09-15）—— Monthly 频率在 `dayEnd` 之后多生成一期账单 |
> | 3 | `accounting-due-early-transaction-date.md` | 功能 —— Accounting Due 的提前交易日期选择器 |
>
> 前端配对文档：`Count-frontend/docs/maintenance-page.md`（Bank Balance 与 Accounting Due 都在那边，
> 因为前端按 Maintenance 页面归类）。

---
---

# 1. Bank Process：Bank Balance（一次性 Contra 结余）
## Bank Process：Bank Balance（一次性 Contra 结余）

Add/Edit Process 弹窗新增一个可选的 "Bank Balance" 金额输入框。Supplier/Customer 之间正常交易
记的都是精确到 0.00 的完整金额，但实际操作中双方之间可能会留一笔几块钱的零头（不会精确归零）。
填了这个字段后，系统会自动帮用户生成一笔 Contra 交易，把这笔零头结平：Customer 付款方
`-amount`，Supplier 收款方 `+amount`。

前端设计/交互细节见 `Count-frontend` 仓库的
[`docs/maintenance-page.md`](../../Count-frontend/docs/maintenance-page.md)（Bank Balance 一节）。
这份文档只记录后端部分。

### 目标行为

- **Add Process**：填了 Bank Balance（且 > 0）→ 流程创建成功后追加生成一笔 CONTRA 交易；没填 →
  跳过，行为不变。
- **Edit Process**：
  - 该流程还没有关联的 Bank Balance 交易 → 字段可编辑，填了保存后生成新的 CONTRA。
  - **已经有关联交易** → 字段锁定，不接受新值——哪怕请求里带了新的 `bankBalance`，后端也**不会**
    用它覆盖或重新生成，必须先调用删除接口把旧的那笔删掉，才能再次创建。这个"已锁定就忽略"的判断
    在后端做，不信任前端传来的值（前端表单本来就会把字段设成只读，但服务端这一层是双重保险）。
  - 提供一个独立的"删除 Bank Balance"接口，删除关联的 CONTRA 交易后，字段重新解锁。

### 数据库改动：`transactions.bank_process_id`

新增一列，直接指回 `bank_process.id`：

- [`migrate_add_bank_process_id_to_transactions.sql`](../backend/src/main/resources/sql/migrate_add_bank_process_id_to_transactions.sql) —— 增量 migration，`information_schema` 判断后再
  `ADD COLUMN` / `ADD KEY` / `ADD CONSTRAINT`，可安全重跑。已经在本地 `testcount` 库跑过验证。
- [`schema.sql`](../backend/src/main/resources/sql/schema.sql) —— 同步更新新装库的建表语句（列、索引 `idx_txn_bank_process`、外键 `fk_txn_bank_process` 三处都加了）。

```sql
ALTER TABLE `transactions`
    ADD COLUMN `bank_process_id` INT UNSIGNED DEFAULT NULL
        COMMENT 'FK bank_process.id; direct link for one-off transactions tied to the process
                  itself (e.g. Bank Balance), independent of periodic postings
                  (see bank_process_posted_id)'
        AFTER `bank_process_posted_id`,
    ADD KEY `idx_txn_bank_process` (`bank_process_id`),
    ADD CONSTRAINT `fk_txn_bank_process`
        FOREIGN KEY (`bank_process_id`) REFERENCES `bank_process` (`id`)
        ON DELETE SET NULL;
```

**为什么不是复用 `bank_process_posted_id`**：这一列关联的是"某一期账单"
（`bank_process_accounting_posted`），是 Accounting Due 那套周期性出账逻辑专用的间接关联；
Bank Balance 是"直接挂在流程本身、跟具体某一期账单无关"的一次性结算，语义不一样，所以加了一列
新的直接外键，而不是套用旧列。

**为什么金额不存在 `bank_process` 表上**：Bank Balance 的金额永远从关联的那笔 `transactions.amount`
读出来，`bank_process` 表本身不新增任何列——单一数据源，不会出现两边数字不一致的风险。

**唯一性只在应用层保证**：一个 `bank_process` 应该"最多"关联一笔 Bank Balance 用的 CONTRA 交易，
但数据库层面没有唯一约束兜底（MySQL 做"部分唯一索引"不方便）。`findAllBankProcess` 的查询用了
相关子查询而不是普通 `LEFT JOIN`，防御万一出现异常的重复数据时把整个列表查询搞乱：

```sql
LEFT JOIN transactions bbt ON bbt.id = (
    SELECT t2.id FROM transactions t2
    WHERE t2.bank_process_id = bp.id AND t2.transaction_type = 'CONTRA'
    ORDER BY t2.id DESC LIMIT 1
)
```

### Contra 交易怎么生成的：复用现有的 `CONTRA` 类型和提交服务，没有另起一套

`CONTRA` 本来就是 `transactions.transaction_type` 枚举里的一个值，Transaction Payment 页面手动
创建 Contra 走的是
[`TransactionSubmitServiceImpl.submitTransfer`](../backend/src/main/java/com/eazycount/service/impl/TransactionSubmitServiceImpl.java)。
Bank Balance 直接复用这同一条路径，而不是自己写一套 insert 逻辑，好处是账户余额更新、跨币种
汇率处理、审批状态、实时通知事件这些都天然保持一致。

**改动方式**：给 `TransactionSubmitDTO` 加一个内部专用字段：

```java
/* Internal only — never set by the manual Transaction Payment UI. */
private Integer bankProcessId;
```

`insertAndBuildResult` / `insertApproved` 各加一个多带 `bankProcessId` 参数的重载版本，原有签名
不变、内部委托给新重载并传 `null`——这样除了 `submitTransfer` 之外的所有调用点
（`submitProfit`/`submitAdjustment`/`submitRate`）完全不用改，永远传 `null`。`submitTransfer`
改成把 `request.getBankProcessId()` 传下去，最终写进 `transactions.bank_process_id`。

`BankProcessServiceImpl.createBankBalanceContra(bankProcess, amount)`：

```java
TransactionSubmitDTO request = new TransactionSubmitDTO();
request.setTenantId(bankProcess.getTenantId());
request.setTransactionType(Transaction.TransactionType.CONTRA.name());
request.setToAccountId(bankProcess.getCustomerAccountId());   // 付款方，-amount
request.setFromAccountId(bankProcess.getSupplierAccountId()); // 收款方，+amount
request.setCurrencyCode(country.getCode());                   // 见下方"币种怎么定"
request.setAmount(amount);
request.setBankProcessId(bankProcess.getId());
transactionSubmitService.submit(request);
```

**币种怎么定**：`TransactionSubmitServiceImpl.resolveCurrency` 要求显式传 `currencyId` 或
`currencyCode`，不会自动从账户推断。Bank Balance 没有单独问用户要币种，而是直接用这个流程自己的
币种——`bank_process.country_id` 关联的 `bank_country.code` 本来就是币种代码（Add Process 表单
"Country (Currency)" 那个字段选的就是它），语义上完全对得上。

### 触发时机

`BankProcessServiceImpl`：

- `insertBankProcess`：流程 insert 成功、profit sharing 也建好之后，`bankBalance` 校验通过
  （非空、大于 0）就调用 `createBankBalanceContra`。
- `updateBankProcessDetails`：流程更新成功后，先查
  `transactionDao.findLinkedBankBalanceTransaction(tenantId, id)`，**只有查不到已有关联时**才会
  创建新的；已经存在的话，请求里的 `bankBalance` 直接忽略。

`normalizeBankBalanceAmount(raw)` 校验规则：

- `null` 或 `0` → 当作"不生成"，返回 `null`（原行为不变）。
- 负数 → 直接 `BusinessException` 拒绝，不会被静默忽略（大概率是打错了）。
- 生成前如果 `supplierAccountId`/`customerAccountId` 任一没设置 → 拒绝，不会留下"想生成但生成不了"
  的半成品状态。

### 删除：复用 Payment Maintenance 现成的删除流程，没有另写一套

新增 `BankProcessService.deleteBankBalance(id, tenantId)`（`POST /api/bank-process/delete-bank-balance`）。

删除一笔交易这件事，`MaintenanceServiceImpl.deletePaymentMaintenanceRows` 早就实现好了：先把行
归档进 `transactions_deleted`，再从 `transactions` 硬删除；`CONTRA` 本来就在它支持的类型列表
（`paymentMaintenanceTransactionTypes` / `ALLOWED_TYPES`）里，`filterDeletableIds` 只会排除
`bankProcessPostedId != null` 的行（周期账单专用），而 Bank Balance 的 CONTRA 走的是新的
`bankProcessId` 字段，`bankProcessPostedId` 本来就是 `null`，天然能通过这道过滤。

所以 `deleteBankBalance` 直接找到关联交易的 id，包一个 `MaintenancePaymentDTO` 转发给
`MaintenanceService.deletePaymentMaintenanceRows`，没有另外写归档/硬删除逻辑：

```java
Transaction linked = transactionDao.findLinkedBankBalanceTransaction(tenantId, id);
if (linked == null) {
    throw new BusinessException("No Bank Balance to delete!");
}
MaintenancePaymentDTO deleteRequest = new MaintenancePaymentDTO();
deleteRequest.setTenantId(tenantId);
deleteRequest.setTransactionIds(List.of(linked.getId()));
maintenanceService.deletePaymentMaintenanceRows(deleteRequest);
```

这样删除行为跟应用里其他地方删交易完全一致（同一份审计归档逻辑），也顺带继承了 `assertEditable`
（OFFICIAL/E_INVOICE/BLOCK 状态的流程不能删 Bank Balance，跟其他编辑操作一致）。

### 列表读取：新字段怎么传到前端

`bank-process-list` 页面的 Edit 表单没有单独的 by-id 查询接口，是直接用 list 接口
（`findAllBankProcess`）已经加载好的那一行数据构建的，所以 Bank Balance 的读取也加进了这个
list 查询：

- [`BankProcessMapper.xml`](../backend/src/main/resources/mybatis/BankProcessMapper.xml)：
  `findAllBankProcess` 加一个 LEFT JOIN（见上方"唯一性只在应用层保证"那段的 SQL），
  `BankProcessListMap` 新增 `bankBalance`/`bankBalanceTransactionId` 两个字段映射。
- [`BankProcessDTO.java`](../backend/src/main/java/com/eazycount/dto/BankProcessDTO.java)：
  `bankBalance`（add/update 请求里是要创建的金额；list 结果里是已关联的金额）、
  `bankBalanceTransactionId`（仅 list 结果用，驱动前端锁定状态）。

### 涉及文件汇总

- `backend/src/main/resources/sql/migrate_add_bank_process_id_to_transactions.sql`（新增 migration）
- `backend/src/main/resources/sql/schema.sql`
- `backend/src/main/java/com/eazycount/entity/Transaction.java`
- `backend/src/main/resources/mybatis/TransactionMapper.xml`
- `backend/src/main/java/com/eazycount/dao/TransactionDao.java`
- `backend/src/main/java/com/eazycount/dto/TransactionSubmitDTO.java`
- `backend/src/main/java/com/eazycount/service/impl/TransactionSubmitServiceImpl.java`
- `backend/src/main/java/com/eazycount/dto/BankProcessDTO.java`
- `backend/src/main/resources/mybatis/BankProcessMapper.xml`
- `backend/src/main/java/com/eazycount/service/BankProcessService.java`
- `backend/src/main/java/com/eazycount/service/impl/BankProcessServiceImpl.java`
- `backend/src/main/java/com/eazycount/controller/BankProcessController.java`

### 已知限制

- 目前只在本地 `testcount` 库验证过 migration 和 `mvn compile`；`count_real`（正式库）还没跑这个
  migration。
- 没有做端到端的自动化测试，前端联调时（Add → Edit 查看锁定态 → 删除解锁）需要人工过一遍。

---
---

# 2. Bank Process — Monthly frequency generates one extra due past dayEnd
## Bank Process — Monthly frequency generates one extra due past dayEnd

> **最后更新**：2026-09-15

### Symptom
For a Bank Process with `Frequency = Monthly` whose contract runs an exact number of
months starting mid-month (e.g. `dayStart = 16/06/2026`, `Contract = 3 MONTHS`,
`dayEnd = 15/09/2026`), the accounting-due generator produced **one extra due dated
exactly on dayEnd** (here: `15/09/2026`, billing window `15/09 – 15/10`), on top of the
three legitimate monthly dues (16/06, 15/07, 15/08). This happened even when the process
was already in `BLOCK` status (contract expired / blocked), which is not supposed to keep
generating new periods.

Reported case: Bank Process for supplier `BS005` / OCBC / card owner `PIXEL FORGE
PTE.LTD.` (and the same pattern on `CATERING COLLECTIVE PTE.LTD.`), both 3-month
contracts starting on the 16th.

### Root cause
`resolveMonthlyDues()` in `BankAccountingDueServiceImpl.java` anchors each period on
`dayStart.getDayOfMonth() - 1` (see `monthlyAnchor()`), not on `dayStart`'s own
day-of-month. For a contract where `dayEnd`'s day-of-month equals that anchor day (i.e.
`dayEnd = dayStart + N months - 1 day`, the standard "N-month contract starting
mid-month" shape), the loop's stop check ran **after** adding the current period and
compared the *anchor's calendar month* to `endMonth = YearMonth.from(dayEnd)` — not
whether the period just added already covered through `dayEnd`.

Trace for the reported case (anchor day = 16 - 1 = 15):

| # | posted (anchor) | billing window | month vs endMonth check |
|---|---|---|---|
| 1 | 16/06 | 16/06 – 16/07 | 06 before 09 → continue |
| 2 | 15/07 | 15/07 – 15/08 | 07 before 09 → continue |
| 3 | 15/08 | 15/08 – 15/09 | 08 before 09 → continue (but this period already reaches dayEnd!) |
| 4 | 15/09 | 15/09 – 15/10 | 09 == endMonth → break **after** generating this extra due |

Period 3 already billed through `dayEnd` (15/09), but the stop condition only looked at
the anchor's calendar month, not the period's own coverage — so it let one more
iteration run and generated a 4th, entirely-past-contract-end due. This is independent of
`BLOCK`/`ACTIVE` status (the `ACTIVE`-only "keep rolling past dayEnd" branch was already
correctly gated off for `BLOCK`); it reproduces for **any** Monthly-frequency contract
shaped like `dayEnd = dayStart + N months - 1 day`, which is the common case for
"N MONTHS" contracts starting mid-month (several other rows in the same Bank Process
list — e.g. the `2 MONTHS`/`3 MONTHS` contracts also starting on the 16th — matched this
shape and were equally at risk, just not yet noticed because their last period hadn't
been reached).

### Fix
**`backend/src/main/java/com/eazycount/service/impl/BankAccountingDueServiceImpl.java`**,
`resolveMonthlyDues()`:
- Removed the `endMonth` calendar-month comparison and the mid-loop clamp that forced the
  overshooting anchor date down to `dayEnd` (`periodPosted = ... ? dayEnd : posted`) —
  that clamp is what mislabeled the extra due's `postedDate` as `dayEnd` itself.
- The loop now stops right after adding a period whose own billing window
  (`posted.plusMonths(1)`) already reaches or passes `dayEnd`, instead of waiting for the
  *next* iteration's anchor to land in the same calendar month as `dayEnd`:
  ```java
  if (!extendPastDayEnd && !posted.plusMonths(1).isBefore(dayEnd)) {
      break;
  }
  ```
- `ACTIVE`-status behavior (keep rolling anchors indefinitely past `dayEnd` until status
  changes) is unaffected — `extendPastDayEnd` still short-circuits this check.

### Why this shouldn't recur
The stop condition now asks "has the period I just billed already covered through
dayEnd?" instead of "did the *next* anchor's calendar month arrive?" — the two questions
happened to agree for contracts where `dayEnd`'s day-of-month differs from the anchor
day, which is why this went unnoticed until a contract landed exactly on that boundary.
Basing the check on the actual billing coverage instead of calendar-month equality makes
it correct for both cases.

### Verification
Recompiled (`mvnw -q -o compile`) with no errors. Re-traced the reported case
(`dayStart=16/06/2026`, `dayEnd=15/09/2026`, `Monthly`, `BLOCK`) by hand against the new
loop: produces exactly 3 dues (16/06, 15/07, 15/08) and stops — no more 15/09 entry.

### Files changed
- `backend/src/main/java/com/eazycount/service/impl/BankAccountingDueServiceImpl.java`

---
---

# 3. Accounting Due：提前交易日期（Early Transaction Date）
## Accounting Due：提前交易日期（Early Transaction Date）

Bank Process 的 Accounting Due 弹窗新增了一个"提前交易"功能：用户可以选择今天~今年年底之间的
任意一天，预览"如果时间走到那一天"会有哪些账单到期，并可以直接对这些提前出现的账单执行入账，
不需要真的等到那一天。

前端设计/交互细节见 `Count-frontend` 仓库的
[`docs/maintenance-page.md`](../../Count-frontend/docs/maintenance-page.md)（Accounting Due 一节）。
这份文档只记录后端部分。

### 背景：`asOf` 参数早就存在，只是从没做成正式功能

[`AccountingDueInboxRequest.java`](../backend/src/main/java/com/eazycount/dto/AccountingDueInboxRequest.java)
的 `asOf` 字段（`LocalDate`，覆盖 `resolveInbox` 计算"今天"用的基准日）、
[`BkProcessAccountingDueController.java`](../backend/src/main/java/com/eazycount/controller/BkProcessAccountingDueController.java)
的 `/inbox` 接口透传、[`BankAccountingDueServiceImpl.resolveInbox`](../backend/src/main/java/com/eazycount/service/impl/BankAccountingDueServiceImpl.java)
里 `LocalDate today = asOf != null ? asOf : LocalDate.now();` 这条链路，在这次改动之前**就已经全部打通**——
只是原本的注释写的是"for dev/testing"，从没设计成给真实用户在 UI 上用的参数，前端也只有一个写死
`null` 的调试常量 `ACCOUNTING_DUE_AS_OF_OVERRIDE`。

这次改动本质上是把这条已有的开发者后门，正式升级成一个用户可用的功能，后端只补了一处校验。

### 唯一的后端改动：给 `asOf` 加范围校验

[`BankAccountingDueServiceImpl.resolveInbox`](../backend/src/main/java/com/eazycount/service/impl/BankAccountingDueServiceImpl.java)：

```java
LocalDate systemToday = LocalDate.now();
if (asOf != null) {
    LocalDate yearEnd = systemToday.withMonth(12).withDayOfMonth(31);
    if (asOf.isBefore(systemToday) || asOf.isAfter(yearEnd)) {
        throw new BusinessException("asOf must be between today and the end of the current year!");
    }
}
LocalDate today = asOf != null ? asOf : systemToday;
```

**为什么要加**：前端日历组件本身已经把可选范围限制在"今天~今年年底"，正常使用不会传出范围外的
值。但 `asOf` 原本是给内部调试用的，接口本身从来没有做过任何范围检查——如果有人绕过前端 UI
直接调用 `/api/bank-process/accounting-due/inbox`（比如用 Postman，或者以后又有别的调用方），
传一个离谱的未来日期（例如 10 年后），会带来两个问题：

1. `resolveFirstOfMonthDues` / `resolveMonthlyDues` 等方法是按月份从 `dayStart` 循环到 `asOf` 的，
   `asOf` 越离谱循环次数越多，对租户下所有 `bank_process` 逐个跑一遍是不必要的性能负担。
2. 业务逻辑上等于可以一次性把好几年份的账单全部解锁提前入账，跟"提前交易最多到今年年底"的产品
   设计意图不符。

这是一处防御性加固，不是功能必需——只有登录且有写权限的用户才能调这个接口，风险本身不高，但加上
之后成本很低。

顺带把 [`AccountingDueInboxRequest.java`](../backend/src/main/java/com/eazycount/dto/AccountingDueInboxRequest.java)
上那条过时的 "for dev/testing" 注释更新了，反映它现在是正式功能的一部分。

### 已确认的既有行为（未改动，容易被误以为要改）

排查这个功能时确认过几条既有逻辑，特意记录下来避免以后重复排查：

- **Once 频率会被提前交易影响**：`resolveOnceDue(dto, bp, today)` 判断 `today.isBefore(dayStart)`，
  这里的 `today` 就是 `asOf`。如果一个 Once 流程的 `dayStart` 是未来某天，正常情况下不会出现在
  Accounting Due 里；但只要把预览日期拉到 `dayStart` 或之后，它就会提前出现。这跟 Monthly / 1st of
  Every Month / Week / Day 是同一套判断逻辑，**没有被特殊排除**（用户已确认这是预期行为，不需要改）。
- **Compensation（1+N 合同的补偿账单）完全不受影响**：`resolveOnePlusCompensationDue(dto, tenantId)`
  这个调用**不接收 `today`/`asOf` 参数**，只看流程当前 `status` 是否为 OFFICIAL/E-Invoice/Block 且
  合同是 1+1/1+2/1+3 来决定要不要生成，跟预览日期完全无关。入账时 `postOneAccountingDuePeriod` 对
  COMPENSATION 类型固定用 `LocalDate.now()`（真实当天），同样不受 `asOf` 影响。
- **Transaction 入账逻辑完全不需要改**：`postToTransaction` 用的是每一行账单自己算出来的
  `postedDate`/`billing_period_start/end`，不是"今天"，所以提前预览出来的账单直接勾选入账，走的
  是和正常到期入账完全一样的代码路径。
- **幂等性有保障**：`bank_process_accounting_posted` 表 `(tenant_id, bank_process_id, posted_date,
  period_type)` 唯一键已经防止同一账期被重复过账，提前入账后，等真正到期日那天系统不会重复生成。

### 涉及文件

- [`backend/src/main/java/com/eazycount/dto/AccountingDueInboxRequest.java`](../backend/src/main/java/com/eazycount/dto/AccountingDueInboxRequest.java) —— 注释更新。
- [`backend/src/main/java/com/eazycount/service/impl/BankAccountingDueServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/BankAccountingDueServiceImpl.java) —— `resolveInbox` 加范围校验。

---
---

# 4. Currency ↔ Bank Country：新增互相同步，删除互相保护
## Currency ↔ Bank Country：新增互相同步，删除互相保护

Account 的 Currency Setting 页面（`currency` 表）和 Bank Process 表单里 "Select or Add Country"
弹窗（`bank_country` 表）原本是**完全独立的两套数据**，没有任何外键或关联——两边各自维护一份
"MYR / SGD / ..." 的列表，长得很像但互不相干。这次改动只针对 **Bank 格式**的 tenant，把两者按
`code`（币别代码，如 `MYR`）打通：新增互相同步，删除单向且带合同占用保护。Games 格式的 Currency
删除逻辑（account/transaction 占用检查）完全没动。

### 行为规则

| 操作 | 行为 |
|---|---|
| Currency 新增 | 按 code 查 `bank_country` 是否已存在，不存在则同步插入一条 |
| Bank Country 新增 | 按 code 查 `currency` 是否已存在，不存在则同步插入一条（`syncSource=MANUAL`、`status=ACTIVE`） |
| Currency 删除 | 原有 account/transaction 占用检查保留；新增检查对应 `bank_country` 是否被 `bank_process`（合同）占用——占用则阻止并提示先去 Bank Process 删除合同；不占用则删除 Currency 并级联删除对应 `bank_country` |
| Bank Country 删除 | 新增主动查 `bank_process` 占用检查（原本完全没有，只靠 DB 外键报错兜底）——占用则阻止；不占用则删除，**不**回流影响 Currency（单向） |

两边互相调用时靠"新增前先查重、已存在则跳过"天然防止死循环，不需要额外加锁或标志位。

### 为什么按 code 匹配，不加外键

`currency` 与 `bank_country` 是两张历史上完全独立演进的表，加一个正式外键需要处理存量数据对齐、
迁移风险更高。按 `code` 字符串匹配（统一 `trim().toUpperCase()`）足够满足"同一个货币在两边应该长
得一样"这个业务诉求，改动范围小，只在 Service 层新增逻辑，不动表结构、不动现有查询。

### 涉及文件

- [`backend/src/main/java/com/eazycount/service/impl/CurrencyServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/CurrencyServiceImpl.java) —— `addNewCurrency` 同步新增 `bank_country`；`deleteCurrencyByIdAndTenantId` 加合同占用校验 + 级联删除。
- [`backend/src/main/java/com/eazycount/service/impl/BankCountryOptionServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/BankCountryOptionServiceImpl.java) —— `insertNewCountry` 同步新增 `currency`；`deleteCountryByIdAndTenantId` 加合同占用校验。
- [`backend/src/main/java/com/eazycount/dao/BankCountryOptionDao.java`](../backend/src/main/java/com/eazycount/dao/BankCountryOptionDao.java) / [`BankCountryOptionMapper.xml`](../backend/src/main/resources/mybatis/BankCountryOptionMapper.xml) —— 新增 `countBankProcessByCountryId`。

---
---

# 5. Select-or-Add-Bank 弹窗：选中银行状态改为后端持久化
## Select-or-Add-Bank 弹窗：选中银行状态改为后端持久化

### Symptom

在 Bank Process 表单的 "Select or Add Bank" 弹窗里，用户为某个国家（如 MYR）勾选了 OCBC、PBB 两
家银行并 Confirm 后，正常预期是这个选中状态会一直保持。但实际上换设备/换浏览器登录、清缓存、或
切换 tenant 之后，之前选中的银行会"变回未选中"，需要重新勾选一次。

### Root cause

选中状态从来没有落库，完全存在浏览器 `localStorage` 里（key 为 `bankProcessCountryChips:<tenantId>`，
见 `Count-frontend/src/pages/bankprocesslist/lib/bankProcessHelpers.js`）。代码注释里明确写着
"Spring has no persistence endpoint for it"——旧 PHP 版本原本有 `save_selected_countries` /
`save_selected_banks` 这两个后端接口，迁移到 Spring 时被直接砍掉，没有迁移过来，只临时用
localStorage 顶替。换设备/换浏览器/清缓存/换 tenant 都会导致这个 key 读不到，从而"看起来"选中状态
丢了。

### Fix

给 `bank_option` 表加一个 `is_selected` 字段（`TINYINT(1) NOT NULL DEFAULT 1`），新增
`POST /api/bank-country-option/select-banks` 接口，一次性替换某个国家下**全部**银行的选中状态
（请求体是 `List<BankOption>`，复用现有 entity，`{ id, tenantId, countryId, selected }`，跟其它
CRUD 接口风格保持一致，没有另开 DTO）。前端弹窗 Confirm 时改成调这个接口，同时把银行目录的
`selected` 字段作为弹窗打开时"哪些银行在 Selected 面板"的唯一数据来源，完全不再读写 localStorage。

Service 层（`BankCountryOptionServiceImpl.updateSelectedBanks`）做的事：

1. 从请求列表第一个元素取 `tenantId`/`countryId`，校验 tenant 和 country 合法。
2. 提取 `selected=true` 的 id，去重、去空、去负数。
3. 校验这些 id 确实都属于该 tenant + country（防止跨 tenant/country 乱传）。
4. 有 id 则先 `markBanksSelected` 标记为已选。
5. 最后统一 `unmarkSelectedBanksExcept`，把该 country 下不在这批 id 里的都清成未选（空列表代表全部
   清空）——两个 DAO 方法配合调用，不是各自独立完整的接口。

`DEFAULT 1` 让存量数据在迁移后不会被清空（`ADD COLUMN ... DEFAULT 1` 会自动把已有行都回填成
"已选中"，不需要额外的 `UPDATE` 语句），迁移脚本：
[`migrate_add_is_selected_to_bank_option.sql`](../backend/src/main/resources/sql/migrate_add_is_selected_to_bank_option.sql)。

### 涉及文件

- `backend/src/main/resources/sql/migrate_add_is_selected_to_bank_option.sql`（新增迁移脚本）、[`schema.sql`](../backend/src/main/resources/sql/schema.sql)、[`TABLE_MIGRATION.md`](../backend/src/main/resources/sql/TABLE_MIGRATION.md) —— `bank_option.is_selected` 列。
- [`backend/src/main/java/com/eazycount/entity/BankOption.java`](../backend/src/main/java/com/eazycount/entity/BankOption.java) —— 加 `selected` 字段。
- [`backend/src/main/java/com/eazycount/dao/BankCountryOptionDao.java`](../backend/src/main/java/com/eazycount/dao/BankCountryOptionDao.java) / [`BankCountryOptionMapper.xml`](../backend/src/main/resources/mybatis/BankCountryOptionMapper.xml) —— `markBanksSelected` / `unmarkSelectedBanksExcept` / `countValidBankOptionsForCountry`。
- [`backend/src/main/java/com/eazycount/service/BankCountryOptionService.java`](../backend/src/main/java/com/eazycount/service/BankCountryOptionService.java) / [`BankCountryOptionServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/BankCountryOptionServiceImpl.java) —— `updateSelectedBanks`。
- [`backend/src/main/java/com/eazycount/controller/BankCountryOptionController.java`](../backend/src/main/java/com/eazycount/controller/BankCountryOptionController.java) —— `POST /api/bank-country-option/select-banks`。
- 前端（`Count-Frontend` 仓库）：`src/pages/bankprocesslist/bankCountryOptionApi.js`、`hooks/useBankProcessListPage.js`、`BankProcessListPage.jsx`、`src/translateFile/pages/bankProcessTranslate.js`。
