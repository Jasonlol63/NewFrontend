# Bank Process 页面设计与 API 说明

Process 页（`/process`）在 **Bank 类型的公司** 下显示 Bank Process 列表：每一行是一份银行卡合同——哪家银行、哪个国家（币别）、卡主是谁、供应商（Supplier）和客户（Customer）是谁、买价 / 卖价 / 利润、合同期限、出账频率和状态。可以新增、编辑、改状态、写备注、重发账单（Resend）、删除，还可以打开 **Accounting Due**（到期账单）把账单入账或删除。

- **已全部接 Spring Boot API**（`/api/bank-process/*`、`/api/bank-process/accounting-due/*`、`/api/bank-country-option/*`、`/api/account/list`），没有占位数据。
- 列表卡片、弹窗外壳、颜色 token 沿用 Games Process / Admin / Account：`games-process-page-design.md`、`admin-account-list-specs.md`、`form-modal-shared-design.md`，这里只写 Bank Process 独有的部分。
- 后端配对文档：`Count/docs/bank-process.md`（Bank Balance、Monthly 多生成一期的修复、提前交易日期、Currency ↔ Country 同步、选中银行持久化）。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/process/ProcessPage.jsx` | 入口：当前是 Bank 公司时渲染 `BankProcessView`（见第 2 节） |
| `src/pages/process/bank/BankProcessView.jsx` | 列表页：顶部按钮、工具栏卡片、两种列方案、状态选择器、各个弹窗的接线 |
| `src/pages/process/bank/BankProcessFormModal.jsx` | Add Process / Edit Process 弹窗（同一个组件） |
| `src/pages/process/bank/BankProfitSharing.jsx` | 弹窗里的 Profit Sharing 卡片 |
| `src/pages/process/bank/CountryBankAdder.jsx` | Country / Bank 旁边的 "+" 小气泡（新增、显示 / 隐藏、移除） |
| `src/pages/process/bank/BankRemarkDialog.jsx` | 单独编辑 Remark 的小弹窗 |
| `src/pages/process/bank/BankResendModal.jsx` | Resend to Accounting Due 弹窗 |
| `src/pages/process/bank/AccountingDueModal.jsx` | Accounting Due 弹窗 |
| `src/pages/process/bank/bankProcessRules.js` | 接口地址、把接口行转成页面行、状态表、锁定规则、搜索 / 筛选 / 排序 |
| `src/pages/process/bank/bankFormRules.js` | 频率 / 合同 / 卡主类型选项、账号过滤、校验、Add / Edit 请求体 |
| `src/pages/process/bank/bankResendRules.js` | Resend 的规则、说明句子、请求体 |
| `src/pages/process/bank/accountingDueRules.js` | 到期账单的转换、Early 判断、提前日期快捷项 |
| `src/pages/process/bank/useBankProcesses.js` | 列表、状态、备注、Resend、批量删除；国家列表（币别筹码） |
| `src/pages/process/bank/useBankFormData.js` | 弹窗用的国家 / 银行 / 账号读取与增删；"隐藏的国家 / 银行"（存在浏览器） |
| `src/pages/process/bank/useAccountingDue.js` | 到期账单读取、入账、删除；按钮上的数量 |
| `src/components/shared/form-modal/ExpandableTextarea.jsx`、`TextEditorSheet.jsx`、`RecordBar.jsx` | SOP / Remark 的放大编辑，弹窗底部的记录条 |
| `src/pages/account/form/AccountFormModal.jsx` | 弹窗里 "+" / 编辑按钮打开的 Add / Edit Account（和 Account 页是同一个弹窗） |
| `src/components/shared/list/DataTable.jsx` | 用到 `altColumns`（两行单元格）、`selectColumn={false}`、`dense`、`boxedPager`、`SelectBox` |
| `src/hooks/useOrderedCurrencies.js` | 币别筹码的顺序（可拖动，存在浏览器） |

页面外框与 Account 一致：`flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]`，整页不滚动，只有表格内部分页。

---

## 2. 什么时候显示这个页面

`ProcessPage` 里 `isBank = scope.company !== null && session.tenant_has_bank`：选了某个 Company 并且这个公司是 Bank 类型（后端算好放在 `/auth/current-user`）就渲染 `BankProcessView`；选的是 Group 自己的数据时仍是 Games 列表。传给它的是页面共用的 `scope`（Group / Company 选择器的状态）和 `readOnly`。公司的切换规则见 `frontend/CLAUDE.md` 第 8 条：选择器会切换会话所在的公司。

---

## 3. 页面布局

从上到下：

1. **按钮行**：`Add Process`（蓝色）和 `Accounting Due`（白底、带红色数量角标，见第 9 节）。
2. **工具栏卡片**（白色，与 Admin 同款）：
   - 第一行：日期范围、搜索、六个状态标签、`Delete`；
   - 第二行起：`Group ID:`、`Company:`、`Currency:` 三排按钮。
3. 错误条（红色，合并 Group / Company 选择器错误、列表读取错误、状态切换失败）。
4. **列表**（`DataTable`，`boxedPager`、`fitWidth`、`dense`，12px 字）。

### 3.1 工具栏第一行（按卡片自己的宽度排版，不看屏幕宽度）

| 控件 | 说明 |
|---|---|
| 日期范围 | `DateRangePicker`，默认**今年 1 月 1 日到 12 月 31 日**；按每行的 **Date（Day Start）** 过滤 |
| 搜索 | 搜 Supplier、Country、Bank、Card Owner、Contract、Customer、Status、Date |
| 状态标签 | `Show All`、`Active`、`Inactive`、`Official`、`E-Invoice`、`Blocked`（规则见 4.4） |
| `Delete (n)` | 靠右，红色；n 是已勾选行数 |

空间不够时按固定顺序一步步让（`toolbarLayout`，每一步只在放不下时才发生，所以不会提前挤搜索框）：

1. Delete 去掉文字，只留垃圾桶（和数量）；
2. 搜索框变成放大镜图标，点开后在原位置浮出一个 170px 的搜索框（失焦 / Enter / Esc 收起；有内容时图标右上角有蓝点）；
3. 状态标签变"瘦"（compact）；
4. 还是放不下（小于约 1000px 的屏幕）→ 状态标签换到第二行，按原大小排。

日期框：宽屏（卡片够宽）用 330px 的原版，否则用 256px 的紧凑版。

### 3.2 Currency 一排

`Currency:` 后面是 `All` 加该公司的每个币别（= 该公司的 Bank Country，来自 `/api/bank-country-option/list-country`）。可以**拖动改顺序**，顺序保存在浏览器里，和 Dashboard、Customer Report 共用同一个存储键 `dashboard.currencyOrder`（按登录账号区分）。选币别按行的 `currency`（就是国家代码）过滤。

---

## 4. 列表

### 4.1 列（一行一行显示，放得下的时候）

| 列 | 可排序 | 内容 |
|---|---|---|
| No | 否 | 序号，宽 40px |
| Supplier | 是 | 供应商账号代码，加粗 |
| Country | 是 | 国家代码（= 币别） |
| Bank | 是 | 银行名（太窄时 `...`，最窄 76px） |
| Card Owner | 是 | 卡主名（最窄 88px） |
| Contract | 是 | 合同徽章（见 4.5） |
| Ins. | 是 | 保险金额，没有时 `-` |
| Cust. | 是 | 客户账号代码 |
| Cost | 是 | 买价（供应商价），`#,##0.00` |
| Price | 是 | 卖价（客户价） |
| Profit | 是 | 利润 = 公司价；公司价为空时用 卖价 − 买价 |
| Status | 是 | 状态徽章，也是改状态的入口（见 4.3） |
| Date | 是 | Day Start（`yyyy-mm-dd`） |
| Action | 否 | 见 4.6 |

### 4.2 两行单元格（放不下的时候）

列太多、卡片又窄时，表格**自动切换**成 `altColumns`（这时行高从 38px 变成 52px，`useListView` 的 `rowMin` 跟着变），把相关的列叠在一个单元格里，上面是主要内容、下面是 11.5px 的次要内容；去掉 No 列。切回来也是自动的。

| 单元格 | 上 / 下 |
|---|---|
| Supplier / Customer | 供应商（加粗）/ 客户 |
| Bank / Card Owner | 银行 / 卡主 |
| Country / Contract | 国家 / 合同徽章 |
| Ins.、Cost、Price、Profit | 各自独立（三个价格不合并，避免混淆） |
| Status / Date | 状态徽章 / 日期 |
| Action | 同上 |

### 4.3 状态徽章就是状态选择器

点徽章弹出一个小气泡（`Popover`，渲染到最外层，不会被表格裁掉），列出可选状态，点一个就生效。当前状态那一项用对应的颜色底；其余项只有彩色文字、透明底。

| 状态 | 徽章颜色 | 能手动选吗 | 说明 |
|---|---|---|---|
| WAITING | 浅蓝 `#e0f2fe` / `#0369a1` | **不能**（系统设置，只显示） | 选择器里没有这一项；改它会被后端拒绝 `Invalid status!` |
| ACTIVE | 绿 `#dcfce7` / `#15803d` | 能 | 正常出账 |
| INACTIVE | 红 `#fee2e2` / `#b91c1c` | 能 | 停止出账；**只有它可以被勾选删除** |
| OFFICIAL | 琥珀 `#fef3c7` / `#b45309` | 能 | **账单字段锁定**（见 4.7） |
| E-INVOICE | 橙 `#ffedd5` / `#c2410c` | 能 | 同上 |
| BLOCK | 灰 `#e5e7eb` / `#1f2937` | 能 | 同上 |

宽度：徽章固定宽 74px，窗口 ≥ 1366px 时 84px，≥ 1536px 时 96px（弹出的选项再各加 14px：88 / 98 / 110px，边和徽章对齐）。没有下拉箭头，靠鼠标指针和悬停变色提示可点。徽章把字间距设为 0，给箭头 / 圆点腾地方。

改状态：`POST /api/bank-process/update-status`，请求期间这一行的徽章变成只读；**后端同时会按新状态打开或关闭这份合同的到期账单**（见第 12 节）。后端拒绝时，原话显示在上面的红色错误条里。

### 4.4 状态标签与默认显示

- **一个标签都不勾 → 只显示 ACTIVE。**
- 勾了某些状态标签 → 显示这些状态（`Active`、`Inactive`、`Official`、`E-Invoice`、`Blocked` 各加一个状态）。
- `Show All` → **所有状态都显示（包括 WAITING）**，并且不分页（全部放进表格里滚动）。

### 4.5 合同徽章（`ContractBadge`）

白底蓝边的小徽章，前面一个小圆点：**绿色 = 合同还在期内，灰色（文字也变灰）= 已过期**（`dayEnd` 早于今天）。`1+1`、`1+2`、`1+3` 显示成 `1+1 MONTHS` 这样（后端按原文 `1+N` 识别补偿合同，所以保存的是 `1+1`，只是显示时加 `MONTHS`）。没有 `dayEnd` 的合同（Once、Daily、Weekly）永远不会过期。

### 4.6 Action 列

宽 84px 左右，三个图标（表头里还有"全选当前页可删除行"的勾选框）：

| 图标 | 作用 |
|---|---|
| 铅笔 | 打开 Edit Process。只读登录时禁用；锁定状态下仍可打开，悬停提示 `Billing fields are locked in this status; only SOP, Remark and Insurance can be changed` |
| 对话框 | 打开 Remark 小弹窗（第 7 节）；有备注时悬停显示 `Remark: …` |
| 第三个位置 | **Inactive 行**显示勾选框（可删除），**其它状态**显示 `Resend`（循环箭头，打开 Resend 弹窗；WAITING / INACTIVE 时禁用并提示 `Resend isn't available in this status`） |

### 4.7 排序与删除

- 默认排序：**日期新的在前**，相同时按 Supplier；点表头换成别的列。
- 删除：勾选 Inactive 的行 → `Delete (n)` → 确认框 `Delete 2 processes?`（一行时写 `SUPPLIER (BANK)`）→ **逐个**调用 `/delete-bank-process`；中途失败时前面已删的仍会从列表消失，失败原因在 `Delete failed` 对话框里。

---

## 5. Add Process / Edit Process 弹窗

`BankProcessFormModal`（`mode: "add" | "edit"`），外壳是 `FormModal`，标题图标 Add 是 `FilePlus2`、Edit 是 `FilePen`，保存键 `Add Process` / `Update Process`。**弹窗里所有标题、标签、值、占位文字都显示成大写**（`uppercase` 加输入框 / 文本框单独设置；按钮保持正常大小写；下拉和日期的弹出层在弹窗外面，自己带 `uppercase`）。

### 5.1 布局

| 内容区宽度 | 布局 |
|---|---|
| ≥ 900px | 两栏：**左** Bank Information / Schedule / SOP and Remark；**右** Detail / Profit Sharing |
| < 900px | 一栏，整个弹窗上下滚动，顺序不变 |

### 5.2 Bank Information

| 字段 | Add | Edit |
|---|---|---|
| Country (Currency) | 下拉 + "+" 小气泡（见 5.7）；选国家就是选币别 | 灰色只读 |
| Bank | 下拉 + "+" 小气泡；没选国家前禁用（提示 `Pick a country first`）；换国家会清空已选银行 | 灰色只读 |
| Type | 下拉：`PERSONAL`、`BUSINESS`、`ENTERPRISE`（数据库里是自由文本，页面只提供这三个） | 灰色只读 |
| Card Owner | 文本框，保存时去空格转大写 | 灰色只读 |

Edit 里这四项后端也不会改（用已存的值）。

### 5.3 Schedule

| 字段 | 说明 |
|---|---|
| Day Start（必填） | 日期，`DD/MM/YYYY` |
| Day End（可选） | 只有 `1st of Every Month` 和 `Monthly` 用到；其它频率显示灰色 `Not used`，换频率时清空 |
| Frequency（必填） | `1st of Every Month`（默认）、`Monthly`、`Once`、`Daily`、`Weekly`（值依次是 `FIRST_OF_EVERY_MONTH`、`MONTHLY`、`ONCE`、`DAY`、`WEEK`） |
| Day End 开关（**仅 Edit + 1st of Every Month**） | 标题行右边的 ON / OFF。ON = Day End 锁定，最后一个月按 Day End 算到期（后端 `dayEndMonthlyCapEnabled`，只有 1st of Every Month 才会为 true）；OFF（默认）= Day End 可编辑。ON 时 Day End 显示成灰色只读 |

### 5.4 SOP and Remark

两个文本框并排（窄屏叠成一列），右上角各有一个放大按钮（`ExpandableTextarea`）：点开后在弹窗上方浮出一个大编辑框（`TextEditorSheet`，最大 640×440，副标题是 `供应商 · 银行 · 卡主`，Add 时是 `Add Process`），改的是同一份内容；`Done`、折叠按钮、点背景、`Esc` 都能关（`Esc` 只关它，不关底下的弹窗）。小屏上写长文本用它。SOP 和 Remark 保存时都转大写。

### 5.5 Detail

| 字段 | 说明 |
|---|---|
| Supplier（必填） | 下拉 + 右边按钮：没选时是 "+"（打开 Add Account，角色预设 `SUPPLIER`），选了之后变成铅笔（打开 Edit Account）；选中后下拉里有小 x 可清除 |
| Buy Price（必填） | 金额，只允许数字和一个小数点 |
| Customer（必填） | 同 Supplier，角色不预设 |
| Sell Price（必填） | 同 Buy Price |
| Company（可选） | 同 Supplier，角色不预设 |
| Profit | 只读，`卖价 − 买价`，保留 2 位；**保存时作为 `companyPrice` 发给后端** |
| Contract（必填） | 下拉：`1 MONTH`、`2 MONTHS`、`3 MONTHS`、`6 MONTHS`、`1+1 MONTHS`、`1+2 MONTHS`、`1+3 MONTHS`；已保存的合同文字不在选项里（老数据）时，会把它临时加进选项，不会显示空白 |
| Insurance（可选） | 金额 |
| Bank Balance（可选） | 见 5.6 |

**账号下拉能选哪些**（和旧版 Bank Process 页相同）：只有 **Active** 并且角色是 `PARTNER`、`SUPPLIER`、`STAFF`、`AGENT`、`MEMBER`、`PROFIT` 的账号。`CAPITAL`、`BANK`、`CASH`、`EXPENSES`、`COMPANY`、`DEBTOR` 不提供。例外：**这份合同已经在用的账号**（供应商、客户、公司、分成账号）和**在弹窗里新建 / 修改过的账号**会一直留在选项里，不会因为过滤而消失。选项文字是 `BA019 [MUAR DASON]`，没有名字时只显示代码。

**"+" 和铅笔打开的是 Account 页同一个 Add / Edit Account 弹窗**，叠在这个弹窗上面。新建成功后账号自动被选中，并加进下拉。弹窗里公司选项是当前 Group 的各个公司（选了 Group 自己的数据时只有这个 Group）。

### 5.6 Bank Balance（一次性 Contra 结余）

供应商和客户之间正常交易记的是精确金额，实际可能留下几块钱零头；填了 Bank Balance，后端会自动生成一笔 **CONTRA** 把它结平：客户 −金额，供应商 +金额，币别用这份合同的国家代码。

- Add：填了且大于 0 → 合同建好后追加一笔 Contra；没填 → 什么都不发生。
- Edit：这份合同**还没有**关联的 Bank Balance → 可填，保存时生成；**已经有** → 字段变成只读灰框（带锁图标、金额、一个红色垃圾桶），下面写 `Settled by a Contra. Delete it to enter a new amount.`
- 点垃圾桶 → 确认框 `Delete bank balance?`（`This also removes its Contra between the Supplier and the Customer.`）→ `POST /api/bank-process/delete-bank-balance`，成功后字段解锁，并通知列表重新读取（`onBalanceDeleted`）。
- 锁定状态（Official / E-Invoice / Block）下：字段不可编辑，垃圾桶不显示，提示 `Change the status first to delete it.`（后端也拒绝删除）。
- 请求里只有在"还没有关联 Contra"时才带 `bankBalance`；后端自己再查一遍，已关联就忽略前端传的值。后端校验：负数拒绝（`Bank Balance cannot be negative!`）；需要供应商和客户都已设置。

### 5.7 Country / Bank 的 "+" 小气泡（`CountryBankAdder`）

点 Country 或 Bank 旁边的 "+"，下面弹出一个宽度与"下拉 + 按钮"这一行相同的小气泡：

- **上面**：输入框 + `Add`（自动大写；回车也行）。重复显示 `That country already exists`，后端重复显示 `Country Name already exists!` / `Bank Option Name already exists!`。**新增国家会同时在该公司建一个同代码的币别**（气泡里有提示 `Also creates a currency of that name`）；新增成功后自动选中它。
- **下面**：现有的国家 / 银行做成小标签。默认模式下**点标签 = 在下拉里显示 / 隐藏**（蓝色 = 显示，灰色 = 隐藏）；点 `Remove` 切到移除模式，标签变红带 x，点哪个就删哪个，再点 `Done` 退出（这样不会误点删除）。
- **显示 / 隐藏只保存在这个浏览器里**（按登录账号 + 公司，键 `bankProcess.hidden.<公司 id>`），不在后端；新增 / 移除是立即写后端的。
- 删除被合同在用的国家会被后端拒绝：`Cannot delete country. It is in use by one or more bank processes.`；银行同理 `Failed to delete bank option! It may be in use by a bank process.`，原话显示在气泡里。

### 5.8 Profit Sharing（`BankProfitSharing`）

卡片右上角：`n selected` 计数和 `Add`。

- **添加**：点 `Add`，卡片顶部展开一个浅蓝面板，每行是 `Account`（下拉）+ 加号 / 铅笔（同 5.5 的 Add / Edit Account）+ `Amount`（输入框，右对齐）+ `%` 按钮；底下是虚线的 `Add Account`，可以一次填好几行再点顶部的 `Add (n)` 一起加入。`Cancel` 放弃。
- **`%` 按钮**：把这个格子变成"百分比框"，输入 20 就把 Amount 自动填成 **利润的 20%**（Amount 变灰不可手改）；再点框里的 `%` 回到手输金额。没有利润（买价 / 卖价还没填）时 `%` 按钮禁用。
- **已加入的**：每条一行，显示账号、`MYR 1,200.00` 这样的金额徽章、红色垃圾桶。同一个账号不能重复（已在列表里的、面板里别的行选了的，都从下拉里去掉）。
- 空的时候显示 `No profit sharing selected`。
- 校验：每一条金额必须大于 0（`Every Profit Sharing amount must be more than 0`）。
- 锁定状态下（`inert`）整张卡片不可操作。

### 5.9 锁定状态（Official、E-Invoice、Block）

这三个状态下后端**冻结账单字段**：日期、频率、合同、买卖价、账号、Profit Sharing、Bank Balance 全部保持原值，**只保存 SOP、Remark、Insurance**。所以 Edit 弹窗里：

- 标题栏旁出现一个黄色提示条 `Billing locked · only SOP, Remark and Insurance can be changed`（窄时缩成 `Billing locked`，悬停显示完整句子）；
- Day Start、Day End、Frequency、Supplier、Customer、Company、Buy / Sell Price、Contract、Bank Balance 全部灰掉，Profit Sharing 整张不可操作；Day End 开关不显示；
- 校验直接通过（这三项都不是必填），请求体只带 `id、tenantId、insurancePrice、sop、remark`。

### 5.10 校验与请求

校验（`validateBankForm`，第一个问题显示在弹窗底部红字里）：

| 条件 | 提示 |
|---|---|
| Add 没选国家 / 银行 / Type / 没填卡主 | `Country is required` / `Bank is required` / `Type is required` / `Card Owner is required` |
| 没填 Day Start / Frequency | `Day Start is required` / `Frequency is required` |
| 没选 Supplier / Customer | `Supplier is required` / `Customer is required` |
| Buy / Sell Price 为空 | `Buy Price is required` / `Sell Price is required` |
| 没选合同 | `Contract is required` |
| Profit Sharing 有金额 ≤ 0 | `Every Profit Sharing amount must be more than 0` |

**Add 请求体**（`POST /api/bank-process/add-bank-process`）：

```
{ tenantId, countryId, bankOptionId, cardOwner (大写), cardOwnerType,
  dayStart, dayEnd | null, dayEndMonthlyCapEnabled: false, frequency,
  supplierAccountId, supplierPrice, customerAccountId, customerPrice,
  companyAccountId | null, companyPrice (= 卖价 − 买价),
  contract, insurancePrice | null, sop (大写), remark (大写),
  shares: [{ accountId, amount, sortOrder }],
  bankBalance?: <只有大于 0 才带> }
```

**Edit 请求体**（`POST /api/bank-process/update-bank-process`）：同上但不带 `countryId`、`bankOptionId`、`cardOwner`、`cardOwnerType`，带 `id`；`dayEndMonthlyCapEnabled` 只有"1st of Every Month 且开关 ON"时为 true；`bankBalance` 只在还没有关联 Contra 时才带。锁定状态下只带 5.9 那几项。

保存时按钮变处理中；失败时后端原话显示在弹窗底部（同时显示国家 / 银行 / 账号读取失败的错误）；成功后弹窗关闭并重读列表。弹窗底部左边还有一条 **Record 记录条**（仅 Edit）：`Modified` 时间 + 操作人标签、`Created` 时间 + 操作人标签，窄时换两行。

---

## 6. Remark 小弹窗（`BankRemarkDialog`）

列表里点对话框图标打开，**单独保存**（`POST /api/bank-process/update-remark`，`{ id, tenantId, remark }`），不经过 Edit 弹窗——所以**锁定状态下也能改备注**，只读登录时图标禁用。

- 居中的白色圆角弹窗，渲染进 `#main-overlay`（只盖内容区，侧边栏保持清晰），宽 `min(540px, 100%-24px)`；右上的放大按钮切到 `min(760px, …)` 并把文本框加高（普通 `clamp(110px,30dvh,220px)`，放大 `clamp(220px,52dvh,420px)`）。
- 标题 `Remark`，副标题 `供应商 · 银行 · 卡主`；文本框占位 `ENTER REMARKS...`，显示成大写，字号手机 16px、≥ 600px 为 15px（防止 iOS 自动放大）。
- 下面一行：左 `Saved in uppercase`，右蓝色的字符数。
- 按钮：`Cancel`（浅色）、`Save`（蓝渐变带勾，保存中显示 `Saving…`）；失败时红字显示后端原话，弹窗保持打开；成功后列表该行的备注直接更新，不重读列表。

---

## 7. Resend to Accounting Due 弹窗（`BankResendModal`）

用来**给一份合同补发一段时间的账单**（比如漏出账了，或要重发某个月），不改合同本身。入口是 Action 列的循环箭头，只在 ACTIVE / OFFICIAL / E-INVOICE / BLOCK 下可用。

- 小尺寸居中弹窗（`FormModal compact`），大写显示。
- **Process 卡片**：Supplier 和 `银行 · 卡主`（只读）。
- **Schedule 卡片**：`Day Start`（默认带合同的 Day Start）、`Day End`（默认带合同的 Day End，**只有 `1st of Every Month` 用到**，其它频率显示 `NOT USED` 并禁用）、`Frequency`（默认合同的频率，可改）。**这些值只对这一次 Resend 有效，不会保存到合同里。**
- 下面一句**实时说明**会重发什么（`resendSummary`）：

  | 频率 | 说明 |
  |---|---|
  | 1st of Every Month，有 Day End | `Resends every month from <Day Start> to <Day End>, billed on the 1st.` |
  | 1st of Every Month，没有 Day End | `Resends only the month of <Day Start>, billed on the 1st.`（只发 Day Start 所在的那个月；Day Start 不是 1 号时按比例） |
  | Monthly | 从 Day Start 起**一个月**（Day Start 日期加一个月，月底日期不够时落到该月最后一天） |
  | Weekly | 从 Day Start 起**七天** |
  | Once / Daily | **只那一天** |

  Day End 早于 Day Start 时说明变红：`Day End can't be before Day Start.`，保存键提示同样的话。
- 保存键 `Resend`（处理中 `Resending…`）→ `POST /api/bank-process/resend`，请求体 `{ tenantId, bankProcessId, dayStart, dayEnd | null, frequency }`。成功后弹窗关闭，**Accounting Due 的数量刷新**（Resend 会产生一张账单）。
- 后端规则：同一份合同、同一个 Day Start 已有未处理的 Resend 账单时拒绝（`This process already has an open Resend bill for this Day start!`）；不同 Day Start 会**覆盖**上一张未处理的（以最新为准）；之前被"删除（Skip）"的同一个 Day Start 可以再次 Resend。

---

## 8. 列表读取与数据映射

`useBankProcesses(tenantId)`：

- `POST /api/bank-process/list`，请求体是公司 id 本身；切公司时旧行保留并变淡，新数据到了才换；`reload()` 重读。
- 返回的每个 `BankProcessDTO`：`{ id, bankProcess: {…}, countryCode, bankName, supplierAccountCode/Name, customerAccountCode/Name, companyAccountCode/Name, status, bankBalance, bankBalanceTransactionId, shares: [{ accountId, amount, sortOrder }] }`，`normalizeBankRow` 压平成列表行（`currency` = `countryCode`；`profit` 优先用后端的 `companyPrice`；`status` 转大写；金额转数字）。
- `bankBalance`、`bankBalanceTransactionId` 来自列表查询里的一个子查询（取该合同最新一笔关联的 CONTRA），**Edit 弹窗没有单独的详情接口，完全用列表这一行建表单**，所以弹窗里看到的是打开那一刻列表里的数据。

---

## 9. Accounting Due（到期账单）

### 9.1 按钮上的数量

`Accounting Due` 按钮上红色角标 = **今天已经到期**的账单数（`dueNowCount`，不含 Early）。读取方式：`POST /api/bank-process/accounting-due/inbox`，`{ tenantId, asOf: null, restoreSkipped: false }`（`useDueCount`）。弹窗里入账 / 删除或 Resend 之后会刷新（`onChanged` / `dueBills.refresh`）。

### 9.2 弹窗布局

标题 `Accounting Due` + 红色数量 + 橙色字 `as of dd-mm-yyyy`（< 600px 隐藏）。标题栏右边有 `Refresh`。从上到下：

1. **Early transaction date 卡片**：一个日期框（宽 150px，**默认是今年年底**）+ 快捷按钮 `Today`、`+1 Week`、`+2 Weeks`、`+1 Month`、`Year End`（选中的是蓝色）+ 右边提示 `Bills posted or deleted early won't be generated again.`
2. **Bills 卡片**：右上 `n bills · m selected`；表格按"账单日期"排序，分两组：`Due now`（今天及以前）和 `Early`（带 `NOT DUE YET` 标签，行首有一条橙色竖线）。每组的组行有全选勾选框。
3. 没有账单时：`Nothing left to post.`

**勾选**：默认**全部勾上**；取消的记在 `unticked` 里，所以换日期后新出现的账单也默认勾上。

### 9.3 表格列（按表格自己的宽度切换）

| 表格宽度 | 列 |
|---|---|
| ≥ 900px | 勾选、No、Start Date、Billing Date、Frequency、Card Owner、Bank、Contract |
| 560–899px | 勾选、Billing Date（下面小字 `Start …`）、Card Owner（下面 `频率`）、Bank、Contract |
| 430–559px | 勾选、Billing Date、Card Owner、Bank（下面 `合同`） |
| < 430px（手机） | 勾选、Billing Date、Card Owner（下面 `银行 · 合同`） |

`1st of Every Month` 在窄列里缩写成 `1st of Month`。

### 9.4 操作

| 按钮 | 作用 | 接口 |
|---|---|---|
| `Transaction (n)`（窄屏 `Post (n)`） | 把勾选的账单**入账**，成功提示 `Posted 5 transaction lines` | `POST /accounting-due/post`，请求体是**后端给的原始账单数组**（不改动） |
| `Delete (n)` | 把勾选的账单**删除（Skip）**，先确认 `Deleted bills won't be generated again.`，成功提示 `Deleted` | `POST /accounting-due/skip`，请求体同上 |
| `Refresh` | 重新读取，并让后端**恢复已被删除的账单**（见 9.5） | inbox，`restoreSkipped: true` |
| 日期框 / 快捷按钮 | 改"提前交易日期"：预览"如果到了那一天"会有哪些账单，可以直接入账 | inbox，`asOf: <日期>` |

- 没有可选账单、读取中、处理中、只读登录时，`Transaction` 和 `Delete` 都禁用。
- 入账 / 删除完成后账单列表重新读取，所有结果（包括别处同时处理掉的账单）都以重读结果为准；底部显示结果或红色错误。
- **提前日期的范围**：只能是**今天到今年年底**。前端日期早于今天时按"今天"处理（`asOf: null`）；后端对范围外的值直接拒绝（`asOf must be between today and the end of the current year!`）。
- 账单的 id 是 `合同 id | 账单日期 | 周期类型` 拼的；入账和删除用这三样在后端找到对应周期，所以前端要**原样**把后端给的那行送回去（`raw`）。

### 9.5 后端怎么算账单、入账时写什么

- 账单由后端按每份合同的频率现算：`1st of Every Month`、`Monthly`、`Once`、`Weekly`、`Daily`，加上 Resend 补发的账单（`RESEND_CONSOLIDATED`）和 `1+N` 合同在 Official / E-Invoice / Block 下的**补偿账单**（`COMPENSATION`）。ACTIVE 总是出账；Official / E-Invoice / Block 只有**非 1+N** 的合同才继续出普通账单；INACTIVE 不出账。
- 已入账（POSTED）或已删除（SKIPPED）的账期记录在 `bank_process_accounting_posted`，`(公司, 合同, 账单日期, 周期类型)` 唯一，所以**同一期不会重复出账**；提前入账之后，到了真正的日子也不会再生成。
- **入账写的交易**（都是 APPROVED 状态，日期 = 账单日期；补偿账单用当天）：

  | 交易 | 账号 | 金额 |
  |---|---|---|
  | WIN | Supplier | 买价 × 比例 |
  | LOSE | Customer | 卖价 × 比例 |
  | WIN | Company | 利润 × 比例（利润为 0 也会写一条） |
  | WIN | 每个 Profit Sharing 账号 | 该账号金额 × 比例（金额 ≤ 0 的跳过） |

  比例通常是 1；`1st of Every Month` 的首月 / 末月 / Resend 窗口按天数占当月天数计算；补偿账单再乘 `1+N` 里的 N。
- **入账要求供应商、客户、公司三个账号都已设置**（`Supplier, customer and company accounts are required!`）。表单里 Company 是可选的，没填就无法入账——见第 11 节。
- **改状态时后端对账单的联动**（`onStatusChanged`）：
  - 变成 INACTIVE：合同已结束 → 当时所有还没处理的账单被自动 Skip（原因 `INACTIVE`），并标记 `due_closed`；合同还在期内 → 不处理。"已结束"的判断：Once 永远不算结束；Day Start 还没到不算；Weekly / Daily（没有 Day End）Day Start 一到就算；`1st of Every Month` / `Monthly` 要今天 ≥ Day End。
  - INACTIVE → ACTIVE 且之前被关闭：`1st of Every Month` / `Monthly` 自动 Skip 当月之前未处理的账期，当月起照常出账；Weekly / Daily 保持关闭，只能靠 Resend。
  - INACTIVE → 其它状态：只是清掉 `due_closed`。
  - Once 合同的 Day Start 早于创建月份：打开 Accounting Due 时后端会自动把它设为 INACTIVE。
  - Skip 一个 Once 合同的账单，会同时把它设为 INACTIVE。
- **`Refresh` 的"恢复已删除账单"**受后端开关 `app.accounting-due.restore-skipped-enabled`（默认 true）控制；开着时 Refresh 会删掉当前范围内的 SKIPPED 记录，被删掉的账单会重新出现在列表里。这件事需要**写权限**。

---

## 10. API 对照

所有请求都是 `postJson`（POST、`credentials: include`），成功判断用返回体的 `success: true`，失败抛出后端的 `message`。

| 功能 | 接口 | 请求体 | 前端位置 |
|---|---|---|---|
| 列表 | `POST /api/bank-process/list` | 公司 id 本身 | `useBankProcesses` |
| 新增 / 编辑 | `POST /api/bank-process/add-bank-process` / `update-bank-process` | 见 5.10 | `BankProcessView.submitBank` ← `buildBankRequest` |
| 改状态 | `POST /api/bank-process/update-status` | `{ id, tenantId, status }` | `useBankProcesses.changeStatus` |
| 改备注 | `POST /api/bank-process/update-remark` | `{ id, tenantId, remark }` | `saveRemark` |
| 删除合同 | `POST /api/bank-process/delete-bank-process` | `{ id, tenantId }` | `deleteRows`（逐个） |
| 删除 Bank Balance | `POST /api/bank-process/delete-bank-balance` | `{ id, tenantId }` | 弹窗 `deleteBalance` |
| Resend | `POST /api/bank-process/resend` | `{ tenantId, bankProcessId, dayStart, dayEnd, frequency }` | `resend` |
| 到期账单 | `POST /api/bank-process/accounting-due/inbox` | `{ tenantId, asOf, restoreSkipped }` | `useAccountingDue` / `useDueCount` |
| 入账 | `POST /api/bank-process/accounting-due/post` | 账单数组 | `useAccountingDue.post`，返回 `{ createdCount }` |
| 删除账单 | `POST /api/bank-process/accounting-due/skip` | 账单数组 | `useAccountingDue.skip` |
| 国家列表 | `POST /api/bank-country-option/list-country` | 公司 id 本身 | 币别筹码、`useBankCountryOptions` |
| 新增 / 删除国家 | `POST /api/bank-country-option/insert-country` / `delete-country` | `{ tenantId, code }` / `{ id, tenantId }` | `CountryBankAdder` |
| 银行列表 | `POST /api/bank-country-option/list-bank-option` | `{ tenantId, countryId }` | `useBankOptions` |
| 新增 / 删除银行 | `POST /api/bank-country-option/insert-bank-option` / `delete-bank-option` | `{ tenantId, countryId, name }` / `{ id, tenantId, countryId }` | 同上 |
| 账号列表 | `POST /api/account/list?tenant_id=…` | 无 | `useAccountRows` |
| Add / Edit Account | Account 页同一套接口 | — | 弹窗里的 `AccountFormModal` |

---

## 11. 已知情况和注意点

- **Company 在表单里是可选，但入账必须有。** 没填 Company 的合同可以保存，到了 Accounting Due 入账时会失败（`Supplier, customer and company accounts are required!`）。建议要么把 Company 改成必填，要么在入账失败时提醒去补。
- **银行"选中"状态没有接后端。** 后端已经有 `bank_option.is_selected` 和 `POST /api/bank-country-option/select-banks`（跨设备保存哪些银行在选中面板里，见 `Count/docs/bank-process.md` 第 5 节），但新前端用的是浏览器里的"隐藏的国家 / 银行"（`bankProcess.hidden.<公司>`），换浏览器 / 清缓存后隐藏状态会丢。要和后端对齐的话，需要把 5.7 的显示 / 隐藏改成调用 `select-banks`。
- **Refresh 对只读登录会报错**：`Refresh` 总是带 `restoreSkipped: true`，后端在这个开关打开时要求写权限，只读登录点 Refresh 会看到后端的拒绝信息。弹窗里其它读取不受影响。
- **Edit 弹窗用的是列表那一行的快照**：打开后如果别人改了这份合同，弹窗里看不到；保存会以弹窗里的值覆盖（锁定状态下只保存三个字段）。
- **Resend 与合同本身无关**：Resend 弹窗里改的 Day Start / Day End / Frequency 只用于这一次补发，不会写回合同。
- **币别 ↔ 国家的同步是后端做的**：新增国家会建同代码的币别；删除币别时如果对应国家被合同占用会被拒绝，需要先到 Bank Process 删除合同（Games 公司的币别删除逻辑不变）。
- **"1+N" 合同只在 Official / E-Invoice / Block 下出补偿账单**，ACTIVE 下按普通频率出账；合同文字必须正好是 `1+1`、`1+2`、`1+3` 才会被识别。
- **Monthly 多生成一期的问题已在后端修复**（2026-09-15，见 `Count/docs/bank-process.md` 第 2 节），前端没有对应改动。

---

## 12. 手动验证清单

1. 用 Bank 公司登录进入 `/process`，出现 Bank Process 列表；Game 公司则是 Games 列表。
2. 列表默认只显示 ACTIVE；勾 `Inactive` / `Official` 等能看到对应状态；`Show All` 看到 WAITING 并取消分页。
3. 缩窄窗口：Delete → 图标，搜索框 → 放大镜，状态标签变瘦，最后换到第二行；列表自动切成两行单元格，行高变高。
4. Add：不填必填项逐个看到提示；建一份 1st of Every Month 合同，带两个 Profit Sharing（试一下 `%` 按钮）和一个 Bank Balance；保存后列表出现，Edit 里 Bank Balance 显示锁定，点垃圾桶解锁。
5. 把状态改成 OFFICIAL：Edit 弹窗显示黄色提示条，账单字段灰掉，只能改 SOP / Remark / Insurance；Remark 小弹窗仍可保存；Bank Balance 垃圾桶消失。
6. 把状态改成 INACTIVE：出现勾选框，可删除；Resend 图标消失。
7. Country / Bank "+" 气泡：新增、重复、隐藏 / 显示、Remove 模式删除；删除被合同占用的国家看到后端的拒绝。
8. Resend：改 Day Start 看说明句子随频率变化；成功后 Accounting Due 的红色数量 +1；同一个 Day Start 再发一次被拒绝。
9. Accounting Due：默认日期是年底，能看到 Early 分组；取消勾选一部分后 `Transaction (n)` 数量变化；入账后交易页出现 WIN / LOSE 几条；`Delete` 之后 `Refresh` 能把账单恢复（后端开关打开时）。
10. 1280×560 与 1536×730：整页不滚动，弹窗两栏 / 一栏切换正常。
