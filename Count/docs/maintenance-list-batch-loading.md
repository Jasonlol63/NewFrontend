# Maintenance 列表分批加载（后端）

记录日期：2026-10-13。适用接口：Capture / Transaction / Payment / Bank Process / Formula 五个 Maintenance 的 `.../list`。

- 本文只写**后端**：接口形状、游标、SQL、索引与查询提示、部署顺序、排查。
- 前端怎么调用、怎么渲染、遇到过什么问题，见前端配对文档 `frontend/docs/maintenance-pages-design.md`。
- 取代 `frontend-springboot-migration.md` 里 Capture / Transaction Maintenance 章节中 "一次性查完整段日期范围、不含分页" 的说法。

---

## 1. 背景

Maintenance 列表原来一次把整个日期范围的数据全部查出来。`count_real` 里 `data_capture_line` 约 9.3 万行、
`transactions` 约 13 万行、单个租户的 `data_capture_formula` 约 5500 行，选 All Process 或较大的日期范围时，后端有两处慢：

1. **SQL**：Capture 用 `GROUP BY dc.id` 把全部明细行汇总；Transaction / Payment 的排序键没有合适的索引，`EXPLAIN` 是临时表 + filesort，`LIMIT` 用不上。
2. **响应体**：整个数组一次返回，行数多时 JSON 很大。

产品要求不做翻页、保持滚到底的列表，所以接口改成**按批返回**：一次只查、只返回一批，客户端带上上一批的游标再取下一批。

---

## 2. 接口约定

### 2.1 响应

```json
{ "success": true, "message": "...", "data": [ ... ], "nextCursor": { ... } | null, "total": 123 | null }
```

- `data`：这一批的行。
- `nextCursor`：为 `null` 表示没有下一批；否则原样交给下一次请求（字段见 §2.3）。
- `total`：只在**第一批**（请求里没有游标）统计，之后为 `null`。用同样的过滤条件做 `COUNT`。
- 实现：`dto/CursorPage.java`（`record CursorPage<T>(List<T> rows, Map<String,Object> nextCursor, Long total)`），controller 把它展开成上面的 JSON。

### 2.2 请求

在原有过滤字段之外，各 `Maintenance*DTO` 增加：

| 字段 | 说明 |
|---|---|
| `limit` | 每批大小。默认见 §2.3；上限 `CAPTURE_PAGE_MAX = 2000`（Formula 为 `FORMULA_PAGE_MAX = 10000`） |
| `cursorCreatedAt` / `cursorId` / `cursorDeleted` | Capture / Payment / Bank Process 的游标（上一批最后一行的 `created_at`（ISO）、`id`、是否已删除） |
| `cursorCreatedAt` / `cursorId` | Transaction 的游标（上一批最后一个 **capture** 的 `created_at`、`id`） |
| `cursorOffset` | Formula 的游标（已经返回的行数） |
| `q` | 搜索词，由后端搜（各页匹配的字段见 §3） |

`cursorCreatedAt` 解析失败时抛 `BusinessException("Invalid list cursor")`（`parseCursorTime`）。
Service 里"多取一行判断有没有下一批"：DAO 取 `limit + 1`，service 截掉多出的一行，用最后一行生成 `nextCursor`。

### 2.3 各接口一览

| 接口 | 每批默认 | 游标 | 排序 |
|---|---|---|---|
| `POST /api/maintenance/capture-maintenance/list` | 100 行 | `createdAt, id, deleted` | `dc.created_at DESC, dc.id DESC, src DESC` |
| `POST /api/maintenance/transaction-maintenance/list` | 25 个 capture（约 150 行） | `createdAt, id`（capture） | capture `(created_at, id)`，capture 内 `dl.id DESC` |
| `POST /api/maintenance/payment-maintenance/list` | 100 行 | `createdAt, id, deleted` | `created_at DESC, id DESC, src DESC` |
| `POST /api/maintenance/bankprocess-maintenance/list` | 100 行 | `createdAt, id, deleted` | 同 Payment |
| `POST /api/maintenance/formula-maintenance/list` | 100 行 | `offset` | `id_product, product_type, sub_order, formula_variant, id` |

删除 / 编辑接口（`capture-maintenance/delete`、`payment-maintenance/delete`、`bankprocess-maintenance/delete`、`formula-maintenance/update|delete`）不受影响，仍按 id 操作。

---

## 3. 各接口的实现

### 3.1 通用规则

- **游标用 keyset，不用 `OFFSET`**（Formula 除外，见 §3.5）：翻到很深的位置仍是常数时间。游标条件展开成 OR 链：
  `created_at < c OR (created_at = c AND (id < i OR (id = i AND src < s)))`。
  MariaDB 10.4 对行构造器 `(a,b) < (x,y)` 做不好范围优化，所以不用它。
- **`src`**：Capture / Payment / Bank Process 的列表同时含活跃行和软删除行，同一个 id 可能既有活跃行也有归档行。
  排序最后加 `src`（活跃 = 1，已删除 = 0，降序，活跃在前），游标带上最后一行是不是已删除。
- **活跃 + 已删除合并**：两个分支各自先 `ORDER BY … LIMIT #{limit}` 再 `UNION ALL`，外层统一 `ORDER BY … LIMIT #{limit}`。
  只在外层 `LIMIT` 的话数据库会先物化整个范围，所以每个分支必须先各自截断。
- 每个页面的 WHERE 抽成 `<sql>` 片段，分页查询和总数查询共用，避免条件写两遍。

### 3.2 Capture Maintenance

- `findCaptureMaintenancePage` + `countCaptureMaintenance`，替换原来的 `findCaptureLineMaintenanceRows` / `…DeletedRows`。
- 只对头表 `data_captures` 分页；`data_capture_line` 只用 `EXISTS (… LIMIT 1)` 判断这个 capture 有没有明细，不再 join 后 `GROUP BY`。
- 已删除的 capture：`captureArchiveAgg`（`data_capture_line_deleted` 按 `capture_id` 汇总 `MAX(deleted_by/deleted_at)`；一个 capture 整体归档，同一 capture 的行 deleted_by/at 一致）。
- 共用片段：`captureFilters`（过滤 + `q`）、`captureProductExpr`（Product 表达式，见 `frontend-springboot-migration.md` §42）、`captureDescriptionAgg`。
- `q` 搜 `p.code` / 描述 / 币种。

### 3.3 Transaction Maintenance（按 capture 分批，再取明细）

一行是一条 `data_capture_line`。原来按 `dl.created_at` 排序，排序键在明细表上没有合适的索引，`EXPLAIN` 是 `process → dc → dl` 的临时表 + filesort；
改成从 `dc` 驱动、`ORDER BY dc.created_at, dc.id, dl.id` 还是 filesort（排序跨两张表，索引用不上）。所以拆成两步：

1. `findTransactionCaptureKeys`：按 `(created_at, id)` 倒序取下一批 capture 的 id（多取 1 个判断有没有下一批），走 `idx_dc_tenant_cat_created`。
   带 `q` 时用 `EXISTS (有匹配 q 的明细行)` 挑 capture；不带 `q` 时也带 `EXISTS (有明细)`，避免空 capture 让一批变成 0 行。
2. `findTransactionLinesByCaptureIds`：只读这批 capture 的明细行（同样带 `q` 过滤），`ORDER BY dc.created_at DESC, dc.id DESC, dl.id DESC`（此时只有一百多行，排序可以忽略）。
3. `countTransactionLines`：第一批统计总行数。

- `nextCursor` 来自第一步最后一个 capture，不是最后一行明细。
- `q` 搜 `dl.id_product` / `a.account_id` / 描述（process 描述、`description_main`、`description_sub`）/ `dc.remark` / `dc.created_by`，和原来一致。
- **排序语义变化**：从 "明细行自己的 `created_at`" 变成 "capture 的 `created_at`，capture 内按明细 id 倒序"。
  `count_real` 里 5,603 / 93,413 行的 `dl.created_at` 与 capture 不同，这部分行的位置可能略有出入；同一 capture 的行总是连在一起。
- **每批行数不固定**：平均一个 capture 5.8 行（约 150 行/批），但最大的 capture 有 574 行，14 个 capture 超过 100 行，偶尔一批较大。

### 3.4 Payment / Bank Process Maintenance

- Payment：`findPaymentMaintenancePage` + `countPaymentMaintenance`，替换 `findPaymentMaintenanceRows` / `…DeletedRows`。
  过滤条件拆成 `paymentLiveWhere`（`t` 别名，含 `approval_status = 'APPROVED'`）和 `paymentDeletedWhere`（`td` 别名，`q` 额外搜 `deleted_by`）。
  两个分支的列保持一致；已删除分支原来多选的 `approvalStatus` / `approvedBy` / `approvedAt` 没有保留（前端没用）。
- Bank Process：`findBankProcessMaintenancePage` + `countBankProcessMaintenance`；FROM + WHERE 拆成 `bankProcessLiveSource` / `bankProcessDeletedSource`。
  返回字段不变（含 `bankProcessId` / `periodType` / `transactionDate` / `chargeCategory`）。
- Payment 活跃分支加了 `STRAIGHT_JOIN` + `FORCE INDEX`（§4）。Bank Process **不加**：已入账的 WIN/LOSE 很少（全库 1,485 行，最大租户 600 行），
  `EXPLAIN` 走 `idx_txn_posted` / `idx_txn_approval` 筛出约 1% 再 filesort，成本可忽略。

### 3.5 Formula Maintenance（OFFSET 分页）

- `findFormulaMaintenancePage`（`LIMIT #{limit} OFFSET #{offset}`）+ `countFormulaMaintenance`，FROM + WHERE（含 `q`）抽成 `formulaSource`。
- 用 OFFSET 而不是游标：排序是五列，类型不同，`sub_order` 对 MAIN 行是 NULL，做 keyset 要写五层 OR 且容易错；
  一个租户最多几千行（`count_real`：租户 2 有 5,492 行 / 328 个 process），偏移量最多几千，代价可忽略；排序以主键收尾，顺序稳定。
- `nextCursor = { "offset": offset + pageSize }`，请求字段 `cursorOffset`。
- 上限 `FORMULA_PAGE_MAX = 10000`：编辑 / 删除之后客户端可能用一个请求重读已加载的全部行。一个租户超过 10000 行 formula 后，这个重读会被截断。

---

## 4. 索引与查询提示（部署前必看）

两张大表各加一个索引，让数据库能按 `created_at` 倒着读、凑够一批就停：

| 索引 | 表 | 迁移脚本 | 用在 |
|---|---|---|---|
| `idx_dc_tenant_cat_created (tenant_id, category, created_at, id)` | `data_captures` | `SqlEtcForMigrate/fixes/add_idx_dc_tenant_cat_created_20261013.sql` | Capture 活跃分支、Transaction 第一步 |
| `idx_txn_tenant_created (tenant_id, created_at, id)` | `transactions` | `SqlEtcForMigrate/fixes/add_idx_txn_tenant_created_20261013.sql` | Payment 活跃分支 |

两个索引也写进了 `sql/schema.sql`。

**为什么要 `STRAIGHT_JOIN` + `FORCE INDEX`**：只建索引，优化器仍然选 "先从 `currency`/`process` 开始 → 临时表 → filesort"
（`EXPLAIN` 已确认：索引出现在 `possible_keys` 里但不被选）。所以在这三条查询里：

- `SELECT STRAIGHT_JOIN` 固定 `data_captures` / `transactions` 在最前面；
- `FORCE INDEX (idx_dc_tenant_cat_created)` / `(idx_txn_tenant_created)` 让它顺着索引倒序读；
- Capture / Transaction 里的 `EXISTS (…)` 末尾加 `LIMIT 1`，防止子查询被拍平成 join，让优化器又回到 filesort 计划。

加提示后 `EXPLAIN`：`dc` / `t` 表 `type=ref` 或 `range`，`key` 是新索引，`Extra` 里**没有** `Using temporary; Using filesort`；
带游标的后续页是 `range`（`key_len` 12，游标条件被用成了索引范围）。

> ⚠️ **`FORCE INDEX` 在索引不存在时会直接报错**：所有环境（含线上）必须**先建索引、再部署后端**。
> `transactions` 有 13 万行，线上建索引请选低峰期。

**已知限制**：这个计划依赖 "匹配的行比较密集"。条件很稀疏（很少用的币种 + 很旧的日期范围）时，要沿索引读很多行才凑得够一批。
搜索 `q`（`UPPER(...) LIKE '%…%'`）无法走索引，只能靠先缩小范围；匹配稀疏时一样会读很多行，但每次仍然只返回一批。

---

## 5. 排查

- **接口报 `Key 'idx_…' doesn't exist` 之类的错误**：没先执行 §4 的迁移脚本。
- **某个列表第一批很慢**：对该查询（把占位参数换成真实值）跑 `EXPLAIN`，确认 `key` 是新索引且没有 `Using filesort`；
  若是条件稀疏导致读很多行，见 §4 的"已知限制"。
- **`nextCursor` 一直不是 `null`、或翻到重复行**：检查游标条件里的比较方向和 `src`；同一个 id 既有活跃行又有归档行时，靠 `src` 区分。
- **库里同一行出现两次**：`transactions_deleted` 里交易 `12830` 被归档了两次（id 1423 / 1424），这是库里已有的脏数据，
  列表会返回两条同 id 的行；要根治需清理这对重复行。
- **Transaction 一批行数很多**：一个 capture 有几百行明细（最大 574），是正常的，不是 bug。

---

## 6. 验证记录

- `mvnw compile` 通过。
- `count_real`（MariaDB 10.4）上直接跑过：Capture / Payment / Bank Process 的 `UNION ALL` 分页、Transaction 第二步（3 个 capture → 105 行，顺序正确）、Formula `OFFSET` 分页；
  总数核对：租户 5 GAME 的 capture 6,051、明细 33,435，租户 2 GAME 的 formula 5,455。
- `EXPLAIN`：Capture 活跃分支、Transaction 第一步、Payment 活跃分支（含带游标的后续页）加提示和索引后都没有 filesort；Bank Process 带游标的第二页走 `idx_txn_posted`，约 920 行 filesort。
- 通过实际页面一路滚到底核对过 Capture（6051）、Payment（5340）、Transaction（33435）的总行数，与库里一致。
- **未在真实后端上验证**：所有接口带 `q` 搜索、已删除行的游标翻页；Bank Process 和 Formula 的接口通过页面的完整滚动（当时登录失效）。

## 7. 改动文件

`Count/backend/src/main/`：`resources/mybatis/MaintenanceMapper.xml`、`java/com/eazycount/dao/MaintenanceDao.java`、
`service/MaintenanceService.java`、`service/impl/MaintenanceServiceImpl.java`、`controller/MaintenanceController.java`、
`dto/CursorPage.java`（新）、`dto/Maintenance{Capture,Transaction,Payment,BankProcess,Formula}DTO.java`（加 `limit` + 游标字段）、
`resources/sql/schema.sql`、`resources/SqlEtcForMigrate/fixes/add_idx_dc_tenant_cat_created_20261013.sql`（新）、
`resources/SqlEtcForMigrate/fixes/add_idx_txn_tenant_created_20261013.sql`（新）。

## 8. 后续

- 如需 "删除当前筛选条件下的全部"，要新增后端按条件删除的接口（不要把几千个 id 传回来）。
- 一个租户的 formula 超过 10000 行时，需要把 Formula 的重读改成可分批。
- 其他模块的列表（Admin / Account 等）不在本文范围。
