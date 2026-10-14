# `transactions.group_id` 合并（2026-10-14）：迁移脚本改动记录

> **下次重新迁移数据前先读这一篇。** 目标库的表结构已经变了：`transactions` / `transactions_deleted` 不再有
> `rate_group_id` 和 `bank_process_posted_id`，统一成一个 `group_id`；`transactions_rate.rate_group_id`
> 改名为 `group_id`；`bank_process_accounting_posted` 新增 `group_id`。凡是往这几张表写数据的脚本都要按新结构写。
>
> 设计方案和 DDL：[`docs/group-id-merge-plan.md`](../../../../../../docs/group-id-merge-plan.md)
> 本地库当时的转换脚本：[`sql/migrate_merge_group_id_step1.sql`](../../sql/migrate_merge_group_id_step1.sql)（加列+回填）、
> [`step2.sql`](../../sql/migrate_merge_group_id_step2.sql)（删旧列）。**全新建库直接跑 `sql/schema.sql` 即可，不需要这两个。**

---

## 1. 为什么改

Maintenance 删除一笔"一次操作生成多条记录"的交易时，要把同一次操作的全部记录一起删，否则金额对不上。
这类操作有四种：Rate 手动交易（两种货币 + 中间人 + 平台费）、Bank Process 一期记账（Buy / Sell / Profit /
Profit Sharing）、Pay Domain 开公司收费、Pay Domain 续费。旧结构里 Rate 用 `rate_group_id`，Bank Process 用
`bank_process_posted_id`（指向账本行），Domain 没有任何分组字段，所以统一成一个 `group_id`。

## 2. 新结构与约定

| `group_id` 值 | 含义 | 谁写 |
|---|---|---|
| `RG-<毫秒>-<随机>`（旧数据保持原值，含 `RATE_<ts>_<n>`） | 一次 Rate 手动交易 | 应用；迁移脚本从旧库 `rate_group_id` 拷 |
| `BK-<毫秒>-<随机>`（迁移回填的为 `BK-<账本行 id>`） | 一期 Bank Process 记账 | 应用；迁移脚本 |
| `DF-<毫秒>-<随机>`（迁移回填的为 `DF-<该组最小 id>`） | 一次 Domain 收费 / 续费 | 应用；迁移脚本按规则归组 |
| `NULL` | 单笔交易、Data Capture | |

- `bank_process_accounting_posted.group_id` 与该期所有交易的 `group_id` 相同，用它反查合同、期数、`outcome`。
  JOIN 写法：`bpap.tenant_id = t.tenant_id AND bpap.group_id = t.group_id`（`uk_bpap_group` 唯一键）。
- `transactions_rate.group_id` = 对应 Rate 交易的 `group_id`。
- `transactions.bank_process_id`（合同直接关联，Bank Balance 的一次性 CONTRA 用）**保留**，不是分组概念。
- **判别规则变了**：以前 `bank_process_posted_id IS NULL` 表示"不是 Bank Process 行"。现在 Rate / Domain 也有
  `group_id`，所以不能写 `group_id IS NULL`，要写 `(group_id IS NULL OR group_id NOT LIKE 'BK-%')`
  （Bank 行：`group_id LIKE 'BK-%'`）。应用里各 mapper 的 `isBankLine` / `notBankLine` 片段就是这个。

## 3. 迁移脚本改了什么

| 脚本 | 改动 |
|---|---|
| `legacy_full_migration/migrate_data_transactions_from_legacy.sql` | ① `transactions_rate` 写 `group_id`（值取旧库 `rate_group_id`）；② 两条腿的回填改成 `SET t.group_id = r.group_id`；③ 新增 **§4**：Domain 收费按规则打 `DF-`（活表 + 已删除表）；④ Bank Process 行此处 `group_id` 仍为 NULL，由下一个脚本回填。临时表 `_resolve_rate` 的列也改名 `group_id` |
| `legacy_full_migration/migrate_data_bank_process_accounting_due_from_legacy.sql` | ① §2 账本行写入时 `group_id = CONCAT('BK-', id)`，POSTED 和 SKIPPED 都写（SKIPPED 行可能仍被已删除记录引用）；§3（due_dismissed，从无交易）保持 NULL；② §4 回填由 `SET t.bank_process_posted_id = bap.id` 改为 `SET t.group_id = bap.group_id` |
| `legacy_full_migration/migrate_data_bank_process_from_legacy.sql` | 只改了一处注释，无逻辑改动 |
| `fixes/fix_transactions_deleted_bank_process_posted_id_backfill.sql` | 找行的逻辑不变，`td.bank_process_posted_id` 的判断和赋值改成 `td.group_id`（取 `bank_process_accounting_posted.group_id`）。**必须在 accounting_due 脚本之后跑**，否则账本行还没有 `group_id` |

脚本里仍然出现的 `rate_group_id`，只有读取**旧库**（`c168_net_legacy_*`）的源列（`tr.rate_group_id`、
`trd.rate_group_id`），那是旧库的列名，不要改。

### Domain 归组规则（`DF-`）

一次收费 = 同租户 + 同 `created_by` + 同 `created_at`（`DomainFeeChargeServiceImpl` 一次性写入所有行）。
只给"格式完整"的组打标：恰好 1 条 `DOMAIN_FEE`，且最多 1 条 `DOMAIN_NET_PROFIT`。

`DOMAIN_NET_PROFIT` 是最后写入的，可能比其它行晚 1 秒（本地库遇到过 04:34:17 / 04:34:18）。落单的
NET_PROFIT 并入"同租户同创建人、`DOMAIN_FEE` 在它之前 1 秒内、且该组还没有 NET_PROFIT"的 `DF-` 组。
归不上的保持 NULL，脚本 §4 末尾的 SELECT 会列出来，人工看。

## 4. 下次重新迁移的执行顺序

1. 目标库用现在的 `sql/schema.sql` 建（已是新结构，不要跑 `migrate_merge_group_id_step*.sql`）。
2. 照 `MIGRATION_LOG.md` 的顺序跑各域脚本；本次涉及的是：
   `migrate_data_transactions_from_legacy.sql` → `migrate_data_bank_process_from_legacy.sql` →
   `migrate_data_bank_process_accounting_due_from_legacy.sql` →（需要时）`fixes/fix_transactions_deleted_bank_process_posted_id_backfill.sql`。
   transactions 脚本必须在 accounting_due 脚本**之前**（后者往已存在的交易行上写 `group_id`）。
3. 跑完执行 §6 的验证 SQL。

## 5. 2026-10-14 在副本上的试跑结果（不是原样重放）

做法：把 `count_real` 克隆成临时库，清空 `transactions` / `transactions_rate` / `transactions_deleted` /
`bank_process_accounting_posted`，把脚本里的 `c168_net_legacy_20260827` 换成本机现有的最新快照
`c168_net_legacy_20261007`，按上面顺序跑（关掉外键检查，只验证 `group_id` 逻辑），跑完删除临时库。

| 项 | 结果 |
|---|---|
| 活表交易 | 36,555 条：Rate 442 条（221 组）、Bank 1,466 条（416 组）、其余无分组 |
| 账本行 | 701 条：696 条（§2）有 `group_id`，5 条（§3 due_dismissed）为 NULL |
| `BK-` 交易找不到同组账本行 | 0 |
| 已删除 Bank 行找不到同组账本行 | 0 |
| POSTED 账本行没有 `group_id` | 0 |
| `transactions_rate` 头记录没有对应交易 | 0 |
| 旧列是否还在 | 0（`bank_process_posted_id`、`rate_group_id` 都不存在） |
| Domain §4 | 更新 0 行、无未归组残留（说明这份快照迁入的交易里没有 `DOMAIN_*` 备注，所以这一步在这次试跑里没有真正处理数据；规则本身在本地正式库上验证过：13 组全部归组） |

### 试跑时发现、与本次改动无关的问题（下次迁移前要先处理）

- **`accounting_due` 脚本 §1 会报错**：`Unknown column 'accounting_resend_relax_created_floor'`（`UPDATE bank_process ... WHERE id IN (694, 701) AND accounting_resend_relax_created_floor = 1`）。
  `bank_process` 表现在没有这一列，是脚本和现有表结构不一致的老问题。试跑时跳过 §1，从 §2 开始跑。
- **脚本里写死的旧库名是 `c168_net_legacy_20260827`**，本机已经没有这个库（只有 `_20260827_baseline`、`_20260903`、`_20260905`、
  `_20260907`、`_20260929`、`_20261007`、`c168_net_legacy`）。换快照要全文替换库名。
- **76 条 `RATE` 行没有 `transactions_rate` 头记录**：没有逐条查证来源，多半是旧库里单边的 "Rate charge" 中间人手续费记录，
  这类记录本来就由后面的 `RateChargeOrphanBackfillTool` / `RateChargeOrphanReshapeTool`（见 `MIGRATION_LOG.md` §35）处理。
- **已删除的 Bank WIN/LOSE 有 469 条没有 `group_id`**：没有逐条查证；性质应与
  `fix_transactions_deleted_bank_process_posted_id_backfill.sql` 末尾注释里说的"无法修复的那批"相同（对应的账本行在新库里不存在）。

## 6. 验证 SQL

```sql
-- 各来源数量
SELECT CASE WHEN group_id IS NULL THEN '(none)' WHEN group_id LIKE 'BK-%' THEN 'BK'
            WHEN group_id LIKE 'DF-%' THEN 'DF' ELSE 'RATE_/RG' END AS prefix,
       COUNT(*) AS txns, COUNT(DISTINCT group_id) AS grp
FROM transactions GROUP BY 1;

-- 以下四条都应为 0
SELECT COUNT(*) FROM transactions t LEFT JOIN bank_process_accounting_posted p
  ON p.tenant_id = t.tenant_id AND p.group_id = t.group_id WHERE t.group_id LIKE 'BK-%' AND p.id IS NULL;
SELECT COUNT(*) FROM transactions_deleted t LEFT JOIN bank_process_accounting_posted p
  ON p.tenant_id = t.tenant_id AND p.group_id = t.group_id WHERE t.group_id LIKE 'BK-%' AND p.id IS NULL;
SELECT COUNT(*) FROM bank_process_accounting_posted WHERE outcome = 'POSTED' AND group_id IS NULL;
SELECT COUNT(*) FROM transactions_rate r LEFT JOIN transactions t
  ON t.tenant_id = r.tenant_id AND t.group_id = r.group_id WHERE t.id IS NULL;

-- 一个 Bank 分组里是否混了多次记账（同一账本行被重复记账的数据问题）：有结果就要人工看
SELECT group_id, COUNT(*) AS lines, COUNT(DISTINCT created_at) AS distinct_created
FROM transactions WHERE group_id LIKE 'BK-%'
GROUP BY group_id HAVING COUNT(DISTINCT created_at) > 2;
```

最后一条是本地库查出来的问题：`BK-3123`、`BK-2950` 两个账本行各被记了两批（8 条），Maintenance 里勾一条会
连带另一批。当时的决定是不处理（测试数据）。旧库里如果同一账期确实有两批，迁移后会再次出现同样的合并分组。

## 7. 没有改的脚本（它们仍写旧列，只能在旧结构上运行）

| 目录 | 说明 |
|---|---|
| `delta_sync/*`（含 `*_20261007.sql`、`prod_*`） | 针对"旧结构"的增量同步，已执行；如果要在新结构上再用，需要同样把写 `rate_group_id` / `bank_process_posted_id` 的地方改成 `group_id` |
| `tools/*.java`（13 个一次性工具） | 同上；这些是 `src/main/resources` 下的资源文件，不会被编译进应用 |
| `fixes/*`（除上面那个） | 一次性修复，已执行 |
| `tenant18_adhoc/*` | 租户 18 的一次性清理，已执行 |

改写时的对照：

| 旧写法 | 新写法 |
|---|---|
| `rate_group_id`（`transactions` / `transactions_deleted` / `transactions_rate`） | `group_id` |
| `bank_process_posted_id = X` | `group_id = (SELECT group_id FROM bank_process_accounting_posted WHERE id = X)` |
| `t.bank_process_posted_id IS NOT NULL` | `t.group_id LIKE 'BK-%'` |
| `t.bank_process_posted_id IS NULL` | `(t.group_id IS NULL OR t.group_id NOT LIKE 'BK-%')` |
| `JOIN bank_process_accounting_posted p ON p.id = t.bank_process_posted_id` | `JOIN bank_process_accounting_posted p ON p.tenant_id = t.tenant_id AND p.group_id = t.group_id` |
| 读旧库的 `c168_net_legacy_*.….rate_group_id` | 不改（旧库的列名） |

## 8. 本地库转换的备份

转换前备份了 4 张相关表：`Count/db-backups/count_real_pre_drop_old_cols_20261014_1013.sql`（`transactions`、
`transactions_deleted`、`transactions_rate`、`bank_process_accounting_posted`，删旧列之前的状态）。
