# Maintenance 页面设计与 API 说明

Maintenance（侧边栏 `9. Maintenance`）下有五个页面：**Data Capture**（Capture Maintenance）、**Transaction**、**Payment**、**Formula**、**Bank Process**。
它们是同一套外壳：顶部一张筛选卡片 + 下面一张列表卡片，列表**滚到底自动加载下一批**（不翻页）。Capture / Payment / Bank Process / Formula 可以勾选删除；Transaction 只读；Formula 另有编辑弹窗。

- **已全部接 Spring Boot API**（`/api/maintenance/*`），没有占位数据。
- 后端配对文档：`Count/docs/maintenance-list-batch-loading.md`（分批接口、游标、SQL、索引、部署顺序）。
- 页面外框、列表卡片、颜色 token 沿用 Admin / Account：`admin-account-list-specs.md`；整页不滚动的规则见 `frontend/CLAUDE.md`。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/maintenance/capture/CaptureMaintenancePage.jsx` / `captureMaintenanceRules.js` | Data Capture 页；接口地址、把接口行转成页面行 |
| `src/pages/maintenance/transaction/TransactionMaintenancePage.jsx` / `transactionMaintenanceRules.js` | Transaction 页（只读） |
| `src/pages/maintenance/payment/PaymentMaintenancePage.jsx` / `paymentMaintenanceRules.js` | Payment 页；Transaction Type 选项、请求体 |
| `src/pages/maintenance/bankprocess/BankProcessMaintenancePage.jsx` / `bankProcessMaintenanceRules.js` | Bank Process 页 |
| `src/pages/maintenance/formula/FormulaMaintenancePage.jsx` / `FormulaEditModal.jsx` / `formulaMaintenanceRules.js` | Formula 页、编辑弹窗、编辑规则与请求体 |
| `src/pages/maintenance/shared/MaintenanceFilterCard.jsx` | 顶部筛选卡片：Process（或页面自己的字段）、搜索、Date Range、右端按钮，下面是 Group / Company |
| `src/pages/maintenance/shared/useMaintenanceFilters.js` | Process 型页面（Capture / Transaction / Formula）的筛选状态与请求体 |
| `src/pages/maintenance/shared/useCurrencyFilters.js` / `CurrencyFilterRow.jsx` | 币种型页面（Payment / Bank Process）的筛选状态与币种筹码行 |
| `src/pages/maintenance/shared/useInfiniteMaintenanceList.js` | **分批加载的列表 hook**（五个页面都用它，见第 5 节） |
| `src/pages/maintenance/shared/useMaintenanceList.js` | 旧的 "一次读完" hook，现在没有页面使用 |
| `src/pages/maintenance/shared/maintenanceFormat.js` | `deletedByText`（"删除人 + 时间" 的显示文字） |
| `src/components/shared/list/DataTable.jsx` | 列表卡片；`virtual` 模式就是为这几页加的（第 5.3 节） |
| `src/components/shared/list/useRowActions.jsx` | 删除确认与结果 toast |
| `src/components/shared/list/useListScope.js` | Group / Company 选择（跟当前会话所在公司，见 `CLAUDE.md` 第 8 条） |
| `src/i18n/locales/{en,zh}/maintenance.json`、`common.json` | 文案：`cols.*`、`search.*`、`empty.*`、`errors.*`；`common.json` 的 `table.summaryLoaded` |
| `src/App.jsx`、`src/components/layout/sidebarConfig.js` | 路由和侧边栏菜单 |

---

## 2. 路由与菜单

| 页面 | 路由 | 菜单 key（`sidebarConfig.js`） |
|---|---|---|
| Data Capture | `/maintenance/data-capture` | `maintenanceDataCapture` |
| Transaction | `/maintenance/transaction` | `maintenanceTransaction` |
| Payment | `/maintenance/payment` | `maintenancePayment` |
| Formula | `/maintenance/formula` | `maintenanceFormula` |
| Bank Process | `/maintenance/bank-process` | `maintenanceBankProcess` |

菜单由后端按 "角色 × 当前公司" 算出（`user.menu`）。某个菜单不在 `user.menu` 里时，直接输入地址会被路由守卫带走：
没有 Bank Process 菜单的账号（例如某些 Partnership / IG 组公司）访问 `/maintenance/bank-process` 会被重定向。

---

## 3. 筛选与请求体

### 3.1 两种筛选

| | Process 型 | 币种型 |
|---|---|---|
| 页面 | Capture、Transaction、Formula | Payment、Bank Process |
| hook | `useMaintenanceFilters` | `useCurrencyFilters` |
| 第一个字段 | Process 下拉（必须先选一个，或 All Process，列表才加载；清空后列表为空并提示 `empty.pickProcess`） | Payment：Transaction Type 下拉；Bank Process：无 |
| 币种 | 无 | 币种筹码行：`ALL` 或一个币种（默认 MYR，没有则第一个币种；顺序可拖动，与 Dashboard 共用） |
| 日期 | Date Range，默认今天（Formula 没有日期） | Date Range，默认今天 |
| Group / Company | 都有，跟当前会话所在公司；切换会同时切换整个会话（`CLAUDE.md` 第 8 条） | 同左 |

- `Group` 自己的数据（`company === null`）按 Bank 分类，其余按 Games：Process 型请求的 `category` 为 `"bank"` / `"games"`。
- 搜索框只显示大写（匹配本来就不分大小写）；输入停顿 300ms 后才进请求体的 `q`，**由后端搜**（以前是前端过滤已加载的数组）。
- 任何筛选变化（Group / Company、Process、币种、日期、搜索）都会清空已勾选的行。

### 3.2 各页请求体（`POST`，JSON）

列表接口都是 `POST`，在下面字段之外，hook 会加 `limit`（每批大小）和游标字段（第 5.1 节）。

| 页面 | 列表接口 | 请求体 |
|---|---|---|
| Data Capture | `/api/maintenance/capture-maintenance/list` | `{ tenantId, dateFrom, dateTo, process, category, q? }` |
| Transaction | `/api/maintenance/transaction-maintenance/list` | 同上 |
| Payment | `/api/maintenance/payment-maintenance/list` | `{ tenantId, dateFrom, dateTo, transactionType, currencyCodes, q? }`（币种 `ALL` 时 `currencyCodes: []`） |
| Bank Process | `/api/maintenance/bankprocess-maintenance/list` | `{ tenantId, dateFrom, dateTo, currencyCodes, q? }` |
| Formula | `/api/maintenance/formula-maintenance/list` | `{ tenantId, process, category, q? }`（无日期） |

- `process` 为 `null` 表示 All Process，否则是 process 的 id 字符串。
- 响应形状：`{ data, nextCursor, total }`（`nextCursor` 为 `null` 表示没有下一批；`total` 只在第一批有值）。

### 3.3 删除 / 编辑接口

| 页面 | 接口 | 请求体 | 说明 |
|---|---|---|---|
| Data Capture | `/api/maintenance/capture-maintenance/delete` | `{ tenantId, captureIds }` | 删除单位是整个 capture（`data_captures.id`） |
| Payment | `/api/maintenance/payment-maintenance/delete` | `{ tenantId, transactionIds }` | 删除 RATE 会连带整组（两种币、Middle-Man、手续费），弹窗里有 `payment.rateNote` 提示 |
| Bank Process | `/api/maintenance/bankprocess-maintenance/delete` | `{ tenantId, transactionIds }` | |
| Formula | `/api/maintenance/formula-maintenance/delete` | `{ tenantId, formulaIds }` | 硬删除 |
| Formula | `/api/maintenance/formula-maintenance/update` | `{ tenantId, id, accountId, sourcePercent, inputMethod, formula, description }` | 只有这五个字段可改；改一个来源 formula 会连带改动它的复制行 |

---

## 4. 各页面

通用规则（Capture / Payment / Bank Process / Formula 的删除）：

- 勾选列在表格最右；**只读账号**（`user.readOnly`）没有可勾选的行，勾选列整列隐藏、Delete 按钮一直是灰的（不是故障：先看登录的账号是不是只读）。
- 已删除（归档）的行显示红色删除线、勾选框灰掉不可选（`lockedSelect`）；"Deleter / Deleted By" 列显示删除人和时间。
- 点 Delete → 确认弹窗（`useRowActions`）→ 成功 / 失败 toast。

### 4.1 Data Capture

- 列：No.、Dts Created、Product、Process、Currency、Submitted By、Deleted By。一行 = 一个 capture（`data_captures` 头表），一次提交可能涉及多个产品，已合并成一行。
- 活跃和已删除的 capture 在同一个列表里（同一个 id 可能同时有活跃行和归档行，所以前端行 id 是 `l<id>` / `d<id>`；`captureId` 才是删除请求要的）。
- Product 的取值（BANK = process 代码；GAME = process 配置的描述，没有则回退 process 代码）由后端算，前端只显示。
- 实时刷新：`REALTIME_DOMAINS.DATACAPTURE`。
- 搜索：Process、Product、Currency。
- 页面里**已经去掉了 W/L Group 列**：它和 Product 是同一个表达式，值永远相同。

### 4.2 Transaction（只读）

- 列：No.、Created At、Process、Id_Product、Account、Description、Remark、Percent、Currency、Rate、Cr、Dr、Submitter。一行 = 一条 `data_capture_line`（MAIN + SUB）。
- 没有勾选、没有删除；Id_Product / Description 的拼法（括号里的描述、SUB 行回退）由后端算。
- 实时刷新：`touchesLedger`（账务相关的变动）。
- 搜索：Id_Product、Account、Description、Remark、Submitter。
- 每批是 25 个 **capture**（约 150 行明细），不是 100 行；hook 的 `batchSize` 传 25（第 5.1 节）。

### 4.3 Payment

- 列：No.、Created At、Account (To)、Account (From)、Amount（币种 + 金额）、Description、Remark、Submitter、Deleter。
- 筛选：Transaction Type（All Types / PAYMENT / CLAIM / CLEAR / CONTRA / RATE / ADJUSTMENT / PROFIT）、币种筹码、Date Range。
- 活跃 + 已删除同列表，行 id `l<id>` / `d<id>`；`transactionId` 给删除请求。
- 实时刷新：`touchesLedger`。搜索：To / From 账号、Description、Remark、Submitter、Deleter。

### 4.4 Bank Process

- 列：No.、Dts Created、Account、From、Amount、Description、Remark、Submitted By、Deleted By。一行 = 一条已入账的 WIN/LOSE 交易。
- 筛选：币种筹码、Date Range。其余同 Payment。搜索：Account、From（含 card owner）、Description、Remark、Submitter、Deleter。
- 数据量很小（已入账的 WIN/LOSE 全库约 1,500 行），分批加载主要为了和其他页体验一致。

### 4.5 Formula

- 列：No.、Process、Account、Currency、Source、Product、Input Method、Formula、Description、Action（编辑图标）。无日期范围。
- Formula 和 Description 是 `fit` 列（装不下时以 "..." 结尾，悬停看全文）。
- **编辑弹窗**（`FormulaEditModal`）：改 Account（当前公司的活跃账号）、Source %（非负小数）、Input Method（8 种）、Formula（只允许数字、运算符、引用和它原有的字母，不能新输入字母；末尾自己输入的 `*(source)` 会被剥掉，因为 Source 单独存）、Description。
  没有任何改动或 Source 不合法时 Save 是灰的。
- **保存和删除之后用 `refreshLoaded()`**（第 5.1 节）：原地重读已加载的全部行，列表停在用户滚动到的位置；因为编辑来源 formula 会连带改它的复制行，所以不能只改本地一行。
- 没有实时刷新（配置类数据，很少变）。搜索：Process、Account、Product、Formula、Description。

---

## 5. 列表分批加载（本次优化）

### 5.1 `useInfiniteMaintenanceList`

```js
const list = useInfiniteMaintenanceList(url, request, normalizeRow, refreshOn, batchSize);
// list: { rows, total, loading, error, hasMore, loadingMore, loadMore, reload, refreshLoaded }
```

- `request` 为 `null` 时什么都不请求（还没选 Process / 币种）。请求体变化 → 取第一批（旧结果保留并变淡 `loading`，用 `AbortController` 取消旧请求）。
- 第一批带 `limit = batchSize`；`loadMore()` 带上服务端给的游标。**游标是通用的**：把 `nextCursor` 的每个字段加 `cursor` 前缀原样发回
  （`createdAt → cursorCreatedAt`、`id → cursorId`、`deleted → cursorDeleted`、`offset → cursorOffset`），所以后端换一种游标，hook 不用改。
- `loadMore()`：追加下一批；正在加载 / 没有下一批 / 上次失败时不动。**失败后停止自动加载**（页面有错误 toast，点重试走 `reload`），不会反复请求服务器。
- 去重：row id 是 React key，所以同一行出现两次（库里 `transactions_deleted` 里交易 12830 被归档了两次）时只显示一次。
- `reload()`：从头重新加载；`refreshLoaded()`：用一个请求把已加载的全部行重读并原地替换（读失败退回 `reload()`，因为这时编辑 / 删除其实已经成功了）。
- **实时刷新**（`refreshOn`，用 `useRealtime`）：别人改了数据时，**只重读最上面 3 批并合并**到已加载的行里：新读到的头部替换已加载列表的同一段，
  下面已经滚过的行和游标原样保留；接不上（那一行已被删）才整体替换。刷新不显示 "loading" 变淡。
- `batchSize`：每批多少。Capture / Payment / Bank Process / Formula 是 100 行；Transaction 是 25 个 capture（`CAPTURES_PER_BATCH`）。

### 5.2 页面里怎么用

每个页面（`CaptureMaintenancePage.jsx` 等）：

1. 搜索框 `filters.search` → 300ms 防抖 → `query`；
2. `request = { ...filters.request, ...(query ? { q: query } : {}) }`（用 `useMemo`，对象不变就不会重新请求）；
3. `const list = useInfiniteMaintenanceList(URL, request, normalizeRow, ...)`；
4. 把 `rows / total / hasMore / loadingMore / loadMore` 传给 `DataTable`，并带上 `virtual` 和 `scrollResetKey={request}`（换筛选时回到顶部）。

前端原来的 `filterXxxRows`（在已加载的数组里过滤）都已删除，搜索全部交给后端。

### 5.3 `DataTable` 的 `virtual` 模式

```jsx
<DataTable ... rows={list.rows} total={list.total} virtual
           hasMore={list.hasMore} loadingMore={list.loadingMore} onLoadMore={list.loadMore}
           scrollResetKey={request} />
```

- **只画屏幕上看得到的行**：行高固定（`rowHeight` = 38px），由 `scrollTop` 算出该画哪些行；可视行上下各多画 12 行（`OVERSCAN`），其余用上下两个占位 `<tr>` 撑出总高度。
  窗口按 10 行为步长移动（`WINDOW_STEP`），滚动时不会每滚一行就重绘。无论已经加载多少行，DOM 里只有几十行。
- **滚动到快底部时加载下一批**：离底部不足 30 行（`LOAD_AHEAD`）调用 `onLoadMore`；第一批填不满卡片时也会继续加载。
- **页脚**：还有下一批时显示 `Showing {{shown}} of {{total}} {{noun}}`（`common.json` 的 `table.summaryLoaded`，中英文都有），全部加载完显示 "Showing all N …"。
- 行的斑马纹和 No. 用全局行号（窗口起点 + 序号），所以滚动时不会闪。
- `fitWidth` 的列宽只根据**当前画出来的行**计算（测量只对可视行做，这也是不再卡死的原因之一）。
- 没有引入 TanStack Virtual：行高固定，自己写不到 50 行就够用。
- **全选**（表头的勾选框）只选**已加载**的行；Delete 按钮上的数字是选中的行数。

### 5.4 已知取舍

1. 滚动条长度随已加载的行数变化：快速拖到最底会先停在已加载的末尾，等后面几批追加完才真正到底。
2. `fitWidth` 列宽随可视行变化，滚动时可能有轻微跳动。
3. 没有 "删除当前筛选条件下的全部"：批量删除只能删已加载并勾选的行。
4. Formula 的 `refreshLoaded` 一次最多重读 10000 行（后端上限）。

---

## 6. 遇到的问题（以及怎么解决）

### 6.1 列表一大就卡死整页 / 整台电脑

**原因**：整个日期范围一次性读回、每行一个 `<tr>`，`DataTable` 的 `fitColumns` 还要对每一行测量 `scrollWidth`（强制回流），上万行时浏览器直接卡死。
**处理**：后端分批返回；前端 `virtual` 模式只画可视行、只测可视行（第 5.3 节）。

### 6.2 滚动到 2000 行左右就弹回来，滚不到底

**现象**：Payment / Capture 滚到约 2000 行后又回到约 2100 行，在 2100 ↔ 2400 之间来回，永远到不了底。
**原因**：页面会不时收到实时刷新事件（别的会话或后台任务改了账务数据）。最初的刷新逻辑是 "把已加载的行数（上限 2000）重新读一遍，再整体替换列表"，
列表一超过 2000 行，每次刷新就把它截回 2000 行并重置游标。
**处理**：刷新只重读最上面 3 批并合并进已加载的行，下面滚过的行和游标原样保留（第 5.1 节）。
实测 Capture 滚到 "Showing all 6051"、Payment 到 "Showing all 5340"、Transaction 到 "Showing all 33435"，滚动期间 8 / 6 / 15 次刷新都被合并，没有被截断。

### 6.3 控制台报 "two children with the same key"（如 `d12830`）

**原因**：库里 `transactions_deleted` 里交易 12830 被归档了两次，列表里出现两条同 id 的行，React key 重复。
**处理**：hook 对同 id 的行去重，只显示一条。要根治需要清理库里重复的那一对。

### 6.4 Capture Maintenance 看不到勾选框 / Delete 一直灰

**原因**：不是页面丢了勾选框。`DataTable` 在整页没有任何可勾选的行时隐藏勾选列；而只读账号（`user.readOnly`）的每一行都不可勾选。
**判断**：先看登录账号是不是只读（例如 Partnership 账号），换一个非只读账号再看；已删除的行本来就不能勾选。

### 6.5 Formula 编辑 / 删除之后列表回到顶部

**原因**：保存 / 删除后调用 `reload()` 会从第一批重新开始，几千行的列表里改了深处的一行就被打回顶部。
**处理**：改成 `refreshLoaded()` 原地重读已加载的全部行（第 5.1 节）。编辑来源 formula 会连带改动复制行，所以不能只改本地一行。

### 6.6 访问 Bank Process 被带到登录页

**原因**：账号没有 `maintenanceBankProcess` 菜单（`user.menu` 由角色 × 公司算出）时，路由守卫会拒绝；会话失效时也是同样的表现。
**处理**：用有该菜单的账号测试；这不是列表代码的问题。

---

## 7. 怎么测试

1. 重启后端（新的接口形状要生效；部署前先建好后端文档里列的两个索引）。
2. 对每个页面：选 All Process（或一个数据量大的币种）+ "This Year"，一直往底部滚，页脚应从 `Showing N of total` 一直到 `Showing all total records`，**中间不会被弹回**。
3. 打字搜索：停顿 300ms 后列表应换成匹配的结果，页脚的 total 同步变化。
4. 切换筛选（Process / 币种 / 日期 / Group / Company）：列表回到顶部、勾选清空。
5. Capture / Payment / Bank Process：勾选几行删除，确认弹窗、toast、列表刷新；已删除行显示红色划线且不可勾选。
6. Formula：编辑一行并保存、批量删除，列表应停在原来的位置。
7. 用只读账号登录：没有勾选列，Formula 的编辑图标是灰的。
8. 控制台没有 `two children with the same key` 之类的报错。

## 8. 验证记录

- `vite build`、`oxlint` 通过。
- 内置浏览器里实测（Group IG、公司 AG，选 All Process / 全年，一路往底部滚）：Capture 滚到 "Showing all 6051 records"，Payment 到 "Showing all 5340"，Transaction 到 "Showing all 33435"，滚动期间的实时刷新都被合并，滚动条总高度和 行数 × 38px 对得上。
- **未在浏览器里验证**：Bank Process 和 Formula 的整页滚动、Formula 编辑 / 删除后位置保持，以及所有页面带搜索词的情况（当时登录失效，无法进入页面）；这些复用已验证的 hook 和 `DataTable`，需要使用者自行测试。

## 9. 后续

- 其他模块的列表（Admin、Account 等）仍然是原来的翻页列表，这里只处理 Maintenance。
- 如需 "删除当前筛选条件下的全部"，要先有后端按条件删除的接口，再在表头加一个 "选中全部筛选结果" 的入口。
- `useMaintenanceList.js` 现在没有页面使用，下一次整理时可以删除。
