# 2026-10-07 增量同步（旧版 c168.net → count_real，本地演练）

> 源库：`c168_net_legacy_20261007`（2026-10-07 10:25 的 c168.net 备份，导入为本地库）
> 基线：`c168_net_legacy_20260929`（2026-09-29 09:59，上次全量迁移的来源）
> 目标：本地 `count_real`（演练，**线上 `count168_site` / `count168_org` 尚未执行**）
> 规则（用户决定）：旧版为准，删除也同步；合同（Bank Process）整体对齐旧版；新系统独有的数据先告诉用户再决定。

## 规则

- **新增**：旧版有、目标没有的行插入。
- **修改**：只写旧版自己在基线之后改过的**那一列**（per column），没改过的列、新系统独有的转换（描述新格式、`WIN→PROFIT` 等）不动。
- **删除**：只删旧版在基线之后删掉的行。
- 例外：`bank_process` 按用户要求**整体对齐旧版**（不是只改旧版改过的列）。

## 执行顺序（`delta_sync/`，全部可重复执行）

| # | 脚本 | 内容 |
|---|---|---|
| 1 | `migrate_delta_identity_tenant_20261007.sql` | owner / tenant / account / account_tenant_access / user / user_tenant_access。UPLINE→SUPPLIER；用户 id 冲突（旧版 546 JH vs 新系统 TEST ANC）→ 先给 JH 新 id，TEST ANC 删除后 JH 改回 546 |
| 1b | `migrate_delta_user_acl_account_20261007.sql` | 用户的「可见账户」清单（`user_company_permissions.account_permissions`）。**漏了这一步会出现"账户在库里但页面看不到"** |
| 2 | `migrate_delta_currency_domain_20261007.sql` | currency / account_currency / account_link / tenant_ownership(+history) / 功能模块 / 分成 / tenant_auto_renew（对齐旧版） |
| 3 | `migrate_delta_process_20261007.sql` | process_description / process / link / process_day + 用户的「可见流程」清单 |
| 3b | `cleanup_test_process_4777_20261007.sql` | 一次性：删除新系统独有的测试 process 4777（M1/TEST/DEMO）及其测试 capture 和 4 笔交易（已确认） |
| 4 | `migrate_delta_datacapture_20261007.sql` | data_captures / data_capture_line / **新明细生成 WIN/LOSE 交易（新 id）** / formula / draft(+cell) / process_submitted |
| 5 | `migrate_delta_bank_process_20261007.sql` | bank_country / bank_option / bank_process（整体对齐）/ share / resend_daily_guard |
| 6 | `migrate_delta_transactions_and_accounting_due_20261007.sql` | 交易（新 id）/ RATE / transactions_deleted / 账本 / 交易与账本关联 |
| 6b | 手工 SQL + `tools/BankProcessDescriptionBackfillTool.java --min-txn-id=N` | 6 条账本补账期日期；把新增的 Bank Process 交易描述转成新格式 |
| 7 | `migrate_delta_post_conversion_20261007.sql` | 新增交易/明细的迁移后转换（见文末「阶段 7」）。在 6b 之后执行；RATE leg2 互换用 `delta_sync_marker` 保证只执行一次（本地已手工做过，已写入标记） |

## 关键决定与坑

- **交易必须用新 id**：旧版新增交易 id（43372～44738）全被新系统生成的交易占用。映射用 `MAX(id)+n`，且带"已存在则跳过"的保护（不含 description，因为描述之后会被改写）。
- **Data Capture 新明细 → 交易**：沿用现有 9 万多笔的格式 `流程代码: 公式`，备注取主/子描述；类型 `processed_amount > 0` 为 WIN 否则 LOSE。
- **Bank Process 描述**：用现成工具 `BankProcessDescriptionBackfillTool` 重新生成（和线上入账用同一套 `buildLineDescription`）。工具改了两处：
  - 新增 `--min-txn-id=N`，只处理这次新增的交易；
  - 账户同时承担多个角色时（例如既是供应商又是利润分成），**先看旧版描述前缀**（`Buy Price`/`Sell Price`/`Profit Sharing`/`Profit for`）判断是哪条腿，否则会拿错价格。
  - 不要跑 `BankProcessLedgerBackfillTool`（它会碰全部缺日期的账本，包括 100 条迁移前就缺日期但描述已是新格式的）。
- **账本**：旧版 `due_dismissed` / `posted(*_skipped)` 映射成 SKIPPED；旧版已删的 SKIPPED 同步删除；旧版已入账而新库是 SKIPPED 的同一 key → 改为 POSTED（否则新交易会挂在 SKIPPED 行上）。
- **利润分成解析**：账户代码可能带空格（`ER SHAO - 50.00`），代码取 `[` 或 ` - ` 之前的全部内容。
- **前端缓存**：改库不会通知前端，页面要强制刷新；重启本地后端更保险。
- **用户 `read_only`**：新系统有意把非 Partnership/Audit 用户统一为 0，同步用户时只能覆盖旧版真正改过的列，否则会把 ADMIN/MANAGER 锁成只读。
- **MariaDB 10.4 的坑**：对 `information_schema` 做"相关子查询 + GROUP_CONCAT"或多表关联会让本地 mysqld 崩溃（崩溃恢复后数据无损）。

## 结果（本地 count_real，和旧版逐项对账）

account 2018 / account_tenant_access 1963 / tenant 30 / user 95 / account_currency 2238 / account_link 83 / process_description 579 / process 1225（旧版 1238，其中 13 个是之前合并的重复项）/ data_captures 16210 / data_capture_line 93413 / process_submitted 10919 / bank_process 263 / transactions_rate 221（旧版 223，其中 2 组不完整）。
每个公司的账户数与旧版一致；账户和流程的可见清单全部对齐；UPLINE 0；3 个触发器完好；孤儿记录 0。

## 已知遗留（不是这次造成的）

- 旧版 `Rate charge` 类交易有 34 笔在新系统里不存在（迁移前就缺）。
- 公式表比旧版可用模板少 172 条（迁移前就缺，131 条指向已不存在的流程）。
- `process` 里 19 个 BANK 分类的流程（BONUS/SALARY/PROFIT/COMMISSION）在游戏流程列表里不显示（新系统设计，迁移前就是如此）。
- 旧版合并掉的 13 个重复 process（其中 95 公司的 `EC23` 为活跃）在新库里不是独立的一行。
- 本次演练里 `due_closed` 回填被「用 backup 覆盖 count_real」冲掉，现在为 0。

## 上线线上库之前要注意

- 线上 `count168_site` 自 10/1 起已有自己的新数据（账户、process、data_captures 的 id 与旧版新增 id **会重叠**），**不能直接套本地的"保留 id"做法**，需要为线上重新核对并改写 id 映射。
- 先在线上重跑预览，再逐阶段执行；每阶段前先导出备份。

## 阶段 7：新增交易的「迁移后转换」补做（2026-10-07，本地 count_real）

阶段 6 只是把旧版交易原样插入，旧数据此前做过的转换（fixes/ 与 tools/）没有套用到新增行，导致例如 XE 的 RATE 正负号反了。已对**新增行**补做：

| 项目 | 做法 | 数量 |
|---|---|---|
| RATE 腿 | 对照 backup 与旧版：leg1 与旧版一致、**只有 leg2 互换** account_id↔from_account_id（只能跑一次） | 9 组 / 9 行 |
| Rate charge 孤儿 | 单边两行合并成一行双边（account=对手腿，from=另一腿），补 rate_group_id，删多余行 | 3 对（137731/2、137742/3、137939/40） |
| 手动转账描述 | `TYPE FROM a TO b` | 835 行（PAYMENT/CONTRA/CLAIM/CLEAR） |
| 域名费用 | `PAY DOMAIN FEE`/`NET PROFIT FROM K`，方向、remark 标签 | 2 行 |
| 手动 Profit | WIN→PROFIT（描述为空、有 from_account、无 capture 行） | 9 行 |
| data_capture_line 币种 | 取旧版明细自己的币种，并同步交易币种 | 133 行 + 133 笔交易 |
| 公式 | `data_capture_formula.formula` 改回公式主体（formula_operators） | 509 行 |
| transactions_deleted.bank_process_posted_id | 按旧版 source_bank_process 回填 | 635 行（含 backup 里本来就是空的老行） |

## 线上 count168_site：只迁 Bank Process 相关数据（2026-10-07 演练）

脚本：`delta_sync/prod_bank_process_migration_20261007.sql`（`__TGT__` = 目标库，`__SRC__` = 来源库）。
演练：把线上 `count168_site` 导成本地 `prod_snap`，`__TGT__=prod_snap`、`__SRC__=count_real`，跑完再跑一次，第二次全为 0。

| 项目 | 结果 |
|---|---|
| bank_country / bank_option | 各新增 1（tenant 38 TT 线上没有，该公司的 bank_country 跳过） |
| 账户 | 新增 6205、6216 + account_tenant_access 2 + account_currency 8 + user_tenant_account_access 10 |
| bank_process | 新增 7（786–792），更新 52（本地为准，含 due_closed 30） |
| bank_process_share / resend guard | 新增 2 / 116 |
| 账本（按 tenant+合同+posted_date+period_type 匹配，id 两边不同） | 新增 174，SKIPPED→POSTED 升级 1（合同 693 的 2026-10-01） |
| 交易 | 新增 407（新 id；挂在带过去的账本上）。另外 15 笔线上已入账同一账期，不重复插入 |

规则：线上独有的账本（31 条，多为用户自己 SKIPPED）保留；线上已 POSTED 的不降级；JK 在本地 2026-10-07 验证时点出来的 4 条 SKIPPED 不迁。
未包含：transactions_deleted.bank_process_posted_id 回填（线上全是 NULL）、其它非 Bank 数据。
线上与本地的租户 id 不同：本地有 38 TT、没有 36 MG；线上相反（这次不处理）。

执行流程（线上）：
1. 备份 count168_site → 2. 从本地导出来源表（bank 表全量 + 与这些账户相关的行 + `transactions WHERE bank_process_posted_id IS NOT NULL`）到线上临时库 `bp_src` → 3. 先 ROLLBACK 干跑看数字 → 4. 正式执行 → 5. 删除 `bp_src` → 6. 重启 count168-api 并刷新页面。

### id 撞车检查（基于线上备份 count168_site-202610071613.sql，演练库 prod_snap2）

- 线上下一个自增 id：account 6177、bank_process 786、bank_process_accounting_posted 3216、transactions 133727；本地新增的 id（account 6176–6216、bank_process 786–792）落在同一段，线上一旦有人新建就会撞。
- **已经撞了的一个**：账户 id 6175，线上是 MG（tenant 36，2026-09-30 新建），本地是旧版的 CS009/KH（tenant 5）。与 Bank Process 无关，但以后做整体迁移必须处理。
- 租户不一致：本地有 38 TT、没有 36 MG；线上相反。
- 脚本的处理：新合同/新账户 id 空闲就沿用，被占用就取新 id（max+n），并把共享、重发锁、账本、交易、合同的账户字段、账户权限全部跟着改；共享合同（id ≤ 785）若 id 对应的不是同一个合同就直接中止（PREFLIGHT）。
- 压力测试（prod_snap3：线上先有 786、787 号合同和 6205 号账户）：本地 786→793、787→794、6205→6217，其余引用全部跟随，孤儿记录 0；重跑全为 0。

### 线上 count168_site 正式执行记录（2026-10-07 约 16:45 本地时间）

- 执行前备份：服务器 `~/db-backups/count168_site_PRE_bankmig_20261007.sql.gz`；用户自己的 16:13 备份。
- 来源：本地 count_real 的 11 张表导入线上临时库 `bp_src`（用户导入），执行后已删除，服务器上的 `bp_src_load.sql` 已删除。
- 脚本：`prod_bank_process_migration_20261007.sql`（`__TGT__=count168_site`，`__SRC__=bp_src`），先 ROLLBACK 干跑，数字一致后正式 COMMIT。
- 执行后核对：合同 263（due_closed 30）、账本 803、交易 125981（新增 407，最大 id 134644）、账户 6205/6216 已创建、重发锁 344、共享 131、孤儿账本 0、无账本的交易 0、JK 验证记录 0。
- 合同状态：ACTIVE 121 / INACTIVE 110 / BLOCK 30 / OFFICIAL 2。
- 没有重启后端（site 的 count168-api、cf 的 count168-api-cf 都在运行）。

### 线上 count168_site：只补 CX 公司的非 Bank 交易（脚本 `prod_cx_transactions_migration_20261007.sql`）

- 范围：tenant CX(6)，9/29 起、线上没有的非 Bank 交易共 30 笔（PAYMENT 8、CONTRA 6、CLEAR 4、RATE 6、WIN/LOSE 6）+ 2 组 transactions_rate；新 id；RATE 腿按 rate_group_id+描述重新对应。
- SALARY/COMMISSION 的 6 笔 WIN/LOSE 只迁交易，不带 Data Capture（线上 capture 22470 已被 tenant 5 占用，process 4783 线上没有）。
- 线上 id 133686–133689 是 DEMO(tenant 19) 的数据，不是 CX 测试数据，不需要删除；线上 CX 在 9/30 之后没有用户录入的非 Bank 交易。
- 判断"线上已有"用自然键计数（类型+账户+对方账户+金额+日期），重复执行为 0。
- 演练：在 16:13 备份上先跑 Bank 迁移脚本、再跑本脚本（来源为 11 张表之外的精简暂存库 bp_src：tenant/transactions/transactions_rate），30 笔、2 组、0 个未解析；重跑为 0。

### 线上修复：合同 189 的 9/1 重复入账（`fix_prod_duplicate_bank_post_contract189_20261007.sql`）

- 现象：BS002 等账户在 9/1 多一条一样的 -1,530.00。原因是线上 JK 在 10/6 把 9/1 再入账了一次（DAY_END_TAIL，账本 3215、交易 133724–133726），而旧版 9/1 已用 RESEND_CONSOLIDATED 入过账（账本 1844）。这三笔在 Bank Process 迁移之前就已经在线上。
- 处理：3 笔交易移到 transactions_deleted（deleted_by=DUP_FIX_20261007）并删除；账本 3215 改为 SKIPPED/MANUAL。执行前备份 `~/db-backups/count168_site_PRE_dupfix_20261007.sql.gz`。
- 复查：全库按「同合同+同账户+同日+同金额+不同账本」查，重复对数 0。

### count168_org：从 count168_site 迁 Bank Process + CX 交易（演练，2026-10-07）

- org 不是 site 的副本：9/29 起 org 自己新增 3,380 笔交易（租户 2/5/10），有 org 独有账户 6178/6179，账户 id 6175 两边不同（org=CS009，site=MG），org 没有租户 MG；不能整库覆盖。
- org 的 Bank 数据停在 9/29 基线（是 site 的子集）；org 缺 `due_closed`/`skip_reason` 两列（用户已手工加上并部署新 jar）。
- 做法：沿用 `prod_bank_process_migration_20261007.sql`（TGT=count168_org，SRC=count168_site，只读 site）和 `prod_cx_transactions_migration_20261007.sql`，顺序：先 Bank，再 CX（CX 依赖账户 6205）。
- 在 org 17:22 备份（补列后）上演练：合同新增 7/更新 53，账本新增 193 + 升级 1，交易新增 422；CX 30 笔 + 2 组 RATE；重跑为 0。
- 线上 org 实际干跑（ROLLBACK）：账本新增 187（另外 6 条是用户在 org 测试合同 242 时已经产生的，与 site 相同），其余数字一致。
