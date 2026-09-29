# 2026-09-29 重新全量迁移:目前为止发现的数据缺口清单

> 源库:`c168_net_legacy_20260929`(2026-09-29 09:59 c168.net 备份)
> 目标库:`count_real`(已清空,本轮重新跑全量迁移)
> 参照:`count_real_backup`(清空前的旧库快照,约 2026-09-21 左右的状态,记录里的字段值反映的是那个时间点)
> 本文档只记录**目前已完成域**(身份/租户、Currency、Ownership 剩余部分、account_link、Bank Process 核心域)发现的缺口,后续域(Process、Data Capture、Transactions、Accounting Due 台账)迁完后会继续补充。
> 每一条都已经逐行核对过源头(不是"数了个数不一样就写上"),明确区分"真的丢数据"和"源库这段时间自己变了"。

---

## 结论先说

**到目前为止,没有发现一条"应该迁过来但真的丢了"的数据。** 所有跟 `count_real_backup` 对不上的地方,都能归到下面三类之一:

1. **这一周内源库自己的业务变化**(新增记录、状态更新、账号被删、申请被处理清掉)——不是迁移问题
2. **源库本身的历史孤儿**(公司/账号/流程早就被删,残留的关联记录没跟着清)——原迁移设计就是跳过,这次延续同样处理
3. **迁移脚本本身的 bug,已发现并修复**——只有 1 处(见下方 §4)

---

## 1. 身份/租户域

无缺口。`owner`/`tenant`/`account`/`user`/`user_tenant_access`/`account_tenant_access` 全部逐行核对,backup 里的记录 100% 能在新库找到。

**故意不迁的部分**(沿用原迁移决定,不是新缺口):
- 3 个 IT 系统账号(`IT_JK`/`IT_JS`/`IT_MS`,旧 id 523/524/525)——确认过是系统自建的维护账号,不是真人,按之前的决定整个不迁

---

## 2. Currency / account_currency 域

| 表 | 缺口 | 原因 |
|---|---|---|
| `currency` | 0 | — |
| `account_currency` | **3 条**(账号 `A2`,id 5623,tenant 19) | backup 时期这个账号关联 SGD/EUR/USD 三个币种,现在源库里这个账号只剩 MYR 一个——业务方这周自己在系统里改的,账号本身还在、状态正常,不是数据丢失 |

**故意不迁的部分**:
- `account_currency_display_order`:16 条里只有 3 条格式"可用"(正数 account_id + 合法 JSON 数组),但这 3 条引用的账号(id 2130/3091/3599)在当前源库里**账号本身都已经不存在了**——不是迁移漏了,是这几个账号已经被删除,残留的排序偏好记录没跟着清。`sort_order` 保持默认值 0。

---

## 3. Ownership / Domain 剩余部分

| 表 | 缺口 | 原因 |
|---|---|---|
| `domain_list_fee_price` | 0 | — |
| `announcements` | 0 | — |
| `maintenance_marquee` | 0(源库/backup 都是 0 条) | 该功能这段时间没有公告内容 |
| `tenant_ownership` | 0 | — |
| `tenant_ownership_history` | 0 | — |
| `tenant_fee_share_allocation` | 0 | — |
| `tenant_auto_renew` | **3 条**(tenant 11/12/17,2026-05-31/08-04 的旧 pending 申请) | 源库 `company_auto_renew_request` 这张"申请队列"表里,这 3 条这段时间已经被处理/清掉了(8/27 时源库有 10 条,现在只剩 7 条),不是漏迁 |

---

## 4. account_link

无缺口,82 条全部对上(backup 81 条,多 1 条是这周新增)。

---

## 5. Bank Process 核心域

| 表 | 缺口 | 原因 |
|---|---|---|
| `bank_country` | 0 | — |
| `bank_option` | 0 | — |
| `bank_process` | 0(状态/remark 有变化,见下方) | — |
| `bank_process_share` | 0(修复后) | 见下方"迁移脚本 bug" |
| `bank_process_resend_daily_guard` | 238 条源数据里 **10 条孤儿**排除在外(228 条迁移成功) | 引用的 `bank_process_id` 在当前源库已经不存在(合约被删),同一种历史孤儿模式 |

**`bank_process.status`/`remark` 跟 backup 不一致的 12 条**(id 431/457/458/527/594/598/606/610/635/636/763/764):全部是这一周内业务方在维护页面手动更新的(remark 里能看到 16/9、18/9、21/9、22/9、23/9 这些具体日期,内容是账号关闭/冻结/等待处理这类状态变更),不是迁移问题,如实反映了源库当前状态。

**迁移脚本 bug,已发现并修复**:`profit_sharing` 自由文本解析有 2 条(`bank_process.id=732/733`,公司 331)失败——文本是 `"ER SHAO - 50.00"`,原脚本"取第一个空格前的词当账号代码"这条规则切出来是 `"ER"`,但真实账号代码就是带空格的 `"ER SHAO"`(核对 `account` 表确认存在这个账号,不是脏数据,只是没有用 `[名字]` 括号包起来消歧义,这次数据里第一次出现这种格式)。已经改成更稳的切分规则(先按唯一的金额分隔连字符切,前半部分如果含 `[` 再进一步截断)重新解析,129/129 全部解析成功。

**故意不迁的部分**(沿用原迁移决定):
- `accounting_reactivated_floor_ymd`(11 条非空,原来只有 1 条)、`issue_flag_locked_end_ymd`(5 条非空,原来 0 条)——新 schema 没有对应列,压根没地方放,不是"不重要不迁",是没地方迁。用量比原迁移时涨了一些,如果之后业务上发现需要,需要另外评估加列。
- `accounting_resend_relax_created_floor` + 对应排程(3 条:id 420/694/701)——这个字段属于 Accounting Due 台账那个脚本的范围,不是核心域,还没做,不算这次的缺口。

---

## 6. Process(GAME/BANK)域

### 6.1 重大发现:`process.code` 唯一性约束已经变了

`count_real.process` 的 `(tenant_id, category, code)` 现在只是普通索引,不是唯一约束——真正拦重复的是触发器(`trg_process_bu_unique_code_desc`/`trg_pdl_bi_unique_code_desc`/`trg_pdl_bu_unique_code_desc`),只在 `(tenant, category, code, description)` 完全一样时才报错。这是原脚本(2026-08-27)写完之后才加的 schema 改动(`migrate_process_code_allow_duplicate.sql`)。**这次迁移不再对重复 code 加 `_1`/`_2` 后缀**,直接按源库原样插入,跟旧版前端显示一致。

### 6.2 "完全重复"(code+description 都一样)处理

这次 10 组、13 条"完全重复"记录(原来 8/27 只有 6 组 7 条),用永久表 `process_duplicate_merge_map`(旧 id → 存活 id)处理,存活记录选择依据"哪条有更多真实 `data_captures`/`submitted_processes` 历史";两组零使用记录(E198、MEGARSUB01)按内容(星期配置是否完整)判断。详细名单见 `process_duplicate_merge_map` 表本身。

**其中一组(INFINITY688US-2,127 公司)存活记录选择方向,这次跟 8/27 原始迁移反过来了**(原来选 4267,这次选 4538)——一个多月过去,4538 的提交历史反超了 4267,存活记录必须按当前数据重新算,不能直接复用旧的合并映射。

### 6.3 GAME→BANK 锚点重分类,过程中发现并修正了一个自己的错误

SALARY/BONUS/PROFIT/COMMISSION 这 4 个 BANK 固定码,一开始按"code 是这 4 个词就转 BANK"批量处理,**错误地把 3 条其实是普通 GAME 业务码、只是恰好用同一个词的记录也转成了 BANK**(比如 tenant 2 下 `BONUS`/`PROFIT` 各有两条,一条是真锚点,另一条是"MAXBET 赛季红股"这种正常游戏报表,只是凑巧同名)。跟 backup 核对后发现规律:同一 tenant+code 组里,只有 **id 最小(最早创建)** 的那条才是真锚点,已改回正确状态(id 4623/4600/4030 改回 GAME)。

### 6.4 逐表跟 backup 核对结果(排除后缀/login_id 格式差异后)

| 表 | 缺口 | 原因 |
|---|---|---|
| `process_description` | 3 条(`CQ9 API`、`MEGA888 API`、`MEGA888 EVO API`) | 这周源库把这几条 `description` 记录删掉了 |
| `process`/`process_description_link` | 0(排除上述 3 条描述带出的关联) | — |
| `process_day` | 22 条,全部能归到上面 3 条描述被删 + tenant 9 的 `KHD14`/`KHD14 PROFIT 8`/`KHD14 PROFIT 9` 三个 process 这周被清空了排班(process 本身还在,只是不再有 `process_day`) | 源库这周自己的变化 |
| `process_submitted` | 5 条,4 条是两组"真重复"存活记录选择跟 backup 不同(见 6.2,历史没丢只是转移到了新选出的存活记录)、1 条是源库这周删掉的提交记录 | 不是丢数据 |

**故意不迁的部分**(沿用原决定):`enable_save_draft`(新 Draft 设计不再需要这个开关)。

---

## 7. Data Capture 域

### 7.1 这次直接把"事后修复"折进了主迁移脚本,不再分两步

跟 backup 对比确认 backup 当年是"迁完再补"(`transaction_id` 回填、`id_product` 回填分别是两次事后脚本)。这次直接在一次迁移里做完:
- `data_capture_line` 生成时同步建好对应的 `transactions` WIN/LOSE 记录并回填 `transaction_id`,不留空
- `currency_id` 直接取明细行自己的 `data_capture_details.currency_id`(源库这次抽查到 3419 条头尾币种不一致,按明细行走)
- `id_product` 插入时就用 `id_product_sub`/`id_product_main` 兜底填好

### 7.2 `transactions` id 预留,避免跟后续 Transactions 域撞车

`data_capture_line` 需要同步生成 `transactions` 记录,但 Transactions 域(旧库 `transactions` 表 1:1 保留 id)还没迁移。当前旧库 `transactions` id 范围 `2371~43371`,把 `count_real.transactions` 的 `AUTO_INCREMENT` 改到 **1,000,000** 再生成这批,这次生成的 90299 条全部落在 `[1000000, 1090298]`,跟旧库 id 区间之间留了近 96 万的安全边际。**迁移 Transactions 域之前会再检查一次这个预留是否还够。**

### 7.3 逐表跟 backup 核对结果

| 表 | 缺口 | 原因 |
|---|---|---|
| `data_captures` | 2 条(id 20826、21914) | 源库这周把这 2 条 capture 删了 |
| `data_capture_line` | 539 条 | 全部是上面 2 条被删 capture 的明细,同一原因 |
| `transactions`(本域生成部分) | 0 | — |
| `data_capture_formula` | 42 条(排除掉两次已知合并映射方向调整后) | 这批锚定的 process 在这次重新计算真重复合并时,合并目标(`process_duplicate_merge_map`)跟 backup 当时的选择不一样,内容本身核对过(344 条 `id_product` 能在新库找到对应),没有真丢,只是挂到了不同的 process_id 下 |
| `data_capture_draft`/`data_capture_draft_cell` | 0 | — |
| 金额合计(`SUM(processed_amount)`) | 分毫不差 | — |

**故意不迁的部分**(沿用原决定):`data_capture_description`(GAME 多选描述桥表),backup 也是 0 条,没有干净的源头字段可推导。

---

## 8. 细粒度 ACL(`user_tenant_account_access` / `user_tenant_process_access`)

源库 `user_company_permissions` 这次 44 行(原来 42 行)。跟原分析一致的孤儿模式:5 行整行没有对应的 `user_tenant_access`(3 个 IT 账号 523/524/525 + 2 个历史孤儿 user 280/299),其余 39 行正常解析。

| 表 | 缺口 | 原因 |
|---|---|---|
| `user_tenant_access.account_acl_mode`/`process_acl_mode` | 3 条从 `ALL` 变成 `CUSTOM`(user 255/265/522) | 查了对应的 `user_company_permissions` 行,数组长度 54~429,是这段时间源库新增的真实权限配置,不是误判 |
| `user_tenant_account_access` | 0 | — |
| `user_tenant_process_access` | 44 条 | 37 条是合并映射按当前数据重新计算导致的 process_id 归属变化(权限列表内容还在,只是挂到了不同 process_id),8 条是引用的 `process_id=4611` 这个 process 已经从源库彻底删除,自然排除 |

---

## 9. Transactions / RATE 域

金额流水域,核对标准比其他域更严格——不只对行数,逐字段核对 `account_id`/`from_account_id`/`description`/`remark`/`rate_group_id`,并且额外做了 `SUM(amount)` 总账对账。

### 9.1 关键陷阱:backup 的 id 在 40934 之后被 Data Capture 合成交易占用过

backup 创建时(约 9/21),旧库 `transactions` 自然增长的上限是 **40933**(`MIN(data_capture_line.transaction_id)-1` 反推出来的),从 id=40934 开始 backup 里的记录其实是 Data Capture 补建的合成交易,不是旧库原样保留的 id。这次源库涨到了 43371,`[40934, 43371]` 这段 id 在两边指代完全不同的交易,第一次核对时被这个误差吓了一跳(以为 8 万多条对不上),排查后确认只是核对方法的问题,把比较范围限定在 `id<40934` 后核对结果完全正常。

### 9.2 最终规则(逐条用真实数据核对过,不是照抄文档描述)

- **RATE leg1/leg2**:leg1 原样保留旧库 `account_id`/`from_account_id`;leg2 两列物理对调
- **Domain Fee**:`account_id`/`from_account_id` 对调,`description`→`PAY DOMAIN FEE`,`remark`→`DOMAIN_FEE`
- **Domain Commission**:两列对调,`description`→`{ROLE} COMMISSION FROM {付款公司}`(从 `sms` 标签解析,不用旧库写死写错的文本),`remark`→`DOMAIN_COMMISSION`
- **Domain Net Profit**:`from_account_id` 从 NULL 补成自引用,`description`→`NET PROFIT FROM {付款公司}`,`remark`→`DOMAIN_NET_PROFIT`
- **手动转账**(PAYMENT/CLAIM/CLEAR/CONTRA):`description` 从单边"`TYPE FROM x`"改成双边"`TYPE FROM x TO y`"
- **RATE 中间人孤儿记录**(旧库存成两条独立单边记录):尽量合并成一条(付款方那条的 `from_account_id` 改成中间人账号)+ 补 `rate_group_id`;实在合并不了的(账号对调没法做),**`rate_group_id` 只要查得到就照样补上**,不是整条都不碰——这个细节是核对 backup 才发现的,一开始漏了

### 9.3 执行中发现并修复的 3 个 bug(都是核对 backup 时抓出来的)

| # | bug | 影响范围 | 修复方式 |
|---|---|---|---|
| 1 | Domain Net Profit 的 `description` 结尾带了多余的 `]`(如 "NET PROFIT FROM 95]") | 全部 12 条 Net Profit 记录 | `remark` 标签只有 1 个 `\|` 时,截取逻辑漏切收尾括号;改用 `REPLACE(...,']','')` |
| 2 | MAC999/TZX/WSMT 回填金额算成 2400,应为 1680 | 3 条新回填记录 | 根源同上,Fee 一侧取出的公司代码带 `]`,导致跟 Commission 一侧(干净文本)对不上、`LEFT JOIN` 落空,佣金没扣掉;删除重插并修正 |
| 3 | RATE 中间人孤儿匹配用精确金额相等,漏掉小数点第 8 位取整误差的情况(如 `7979.99998000` vs `7979.99997900`) | 5 组配对漏配 + 4 条 `rate_group_id` 漏填 | 改成按 `(tenant, description, transaction_date)` 配对(不比对金额),`rate_group_id` 反查也放宽金额精确匹配 |

### 9.4 逐表跟 backup 核对结果(限定在 `id<40934` 的有效比较区间内)

| 项 | 结果 |
|---|---|
| `transactions` 缺失 | 0 |
| `account_id`/`from_account_id` 不一致 | 0(修复后) |
| `remark` 不一致 | 0 |
| `rate_group_id` 不一致 | 0(修复后) |
| `description` 不一致 | 1032 条,查证 100% 是 `Process:` 开头的 Bank Process 过账描述文案(`FULL MONTH (APR 2026) @MONTHLY ... \| 银行` 格式),需要 Accounting Due 台账数据才能生成,属于下一个域的范围,不是这次遗漏 |
| `SUM(amount)` 总账对账 | 源库 8,740,794,210.25 − 中间人孤儿重复删除 161,587.24 + Net Profit 回填 5,040.00 = **8,740,637,663.01**,跟迁移结果分毫不差 |
| `transactions_rate` | 212 组(源库 214 组,2 组缺 leg2 正常跳过) |
| `transactions_deleted` | 2 条缺口(该表不参与任何实时账本计算,只影响 Maintenance 页面的历史审计追溯) |

### 9.5 明确排除、不强行处理的记录(对齐 backup 的最终状态)

- **RATE 中间人"BK1"那组**(id 18146/18147):中间人自己 108.50、付款方 110.00,金额真不一致(不是取整误差),`account_id`/`from_account_id` 保持原样不动,只补了 `rate_group_id`
- **RATE 中间人"CX"那条**(id 17756,AUD 1.50):找不到任何对手方,单边孤儿,只补了 `rate_group_id`

---

## 10. Bank Process Accounting Due 台账 + 交易关联 + 文案

### 10.1 不能照抄 backup 台账的原因

- backup 台账 id 不可信:3101/3102/2987 这几个 id 在 backup 里是历史 delta 同步补的孤儿台账,但旧库这周自己新建的台账也用到了同样的 id(之前"串号 bug"的根源)。这次台账从旧库 `process_accounting_posted` / `process_accounting_due_dismissed` 重新推导,**保留旧库 id**,同键 POSTED 优先于 SKIPPED
- 开放补单排程(bp 420/694/701):原脚本把 bp 420 的日期写死成 `2026-05-31 ~ 06-15`,实际库里存的是 `06-01 ~ 06-16`(时区显示陷阱,差一天)。这次直接从旧库字段复制,不写死
- backup 里补的孤儿台账(TRAVELMINI 189 的 3 个补单事件、bp 420 的 5/1 补单、CARGO 526、QIN 693 的 9/1 补单):按规则复现——"有真实交易挂着、但旧库没有 POSTED 台账的键,补一条 POSTED;同键已有 SKIPPED 的升级为 POSTED"
- TRUSTY HAULERS(457)/ SUPPER SERVICE(458)8/1:旧库存成 FULL_MONTH,按 `day_end_monthly_cap_enabled=1` 重分类为 DAY_END_TAIL(同 `BankProcessDayEndTailFixTool` 的规则)

### 10.2 执行结果

| 项 | 结果 |
|---|---|
| `bank_process_accounting_posted` | 610 条(406 POSTED) |
| `transactions.bank_process_posted_id` | 1063 条全部挂上,0 条未挂(backup 是 1034 条,多出的是这周新增 29 条) |
| 开放补单排程 | 3 个(420/694/701) |
| PARTIAL_FIRST_MONTH / DAY_END_TAIL / RESEND_CONSOLIDATED 的 `billing_start`/`billing_end` | 全部补齐,0 缺失(RESEND 优先用旧文案里的 `[RESEND_END=...]` 标记) |

### 10.3 文案生成

先用**只读预览**验证:按 `BankAccountingDueServiceImpl.buildPostDescription` 的规则重新生成旧区间 1032 条,**1019 条与 backup 逐字相同**,证明生成规则与系统格式一致;不同的 13 条全部可解释。写入规则:

- 旧区间已是新格式的:照抄 backup
- backup 拿不到的 31 条(这周新增 29 条 + FARAH FASHION 分润 2 条,backup 里还是旧格式)按规则生成,没有一条生成失败
- 每条腿(供应商/客户/公司/分润)按**旧库原文**(`Buy Price`/`Sell Price`/`Profit`/`Profit Sharing`)判断,不再靠"账号先匹配供应商"猜

### 10.4 backup 文案里发现的问题(已用正确值)

| 交易 | 合约 | backup | 正确值 | 原因 |
|---|---|---|---|---|
| 20268/20272/20281 | THE QIN RESTAURANT 691/692/693(9/1 补单)分润行 | `@MONTHLY 1400` | `@MONTHLY 200` | SU25 同时是供应商和分润账号,当年回填工具按账号先匹配到供应商价 |
| 20286/20290/20298 | 同上(8/28 补单) | `@MONTHLY 1400` | `@MONTHLY 200` | 同上 |
| 19784 | HOCK YONG SENG 738 公司利润行 | `@MONTHLY 0` | `@MONTHLY 1200` | 公司账号同时也是供应商账号,取了供应商价 0 |

### 10.5 保留 backup 原样的(经确认)

- TRAVELMINI(189)的 6 条补单:backup 显示 `PRORATED(18/3 - 17/9 | 184 DAYS)`、`PRORATED(1/4 - 17/9 | 170 DAYS)`,旧版网站截图确认就是这样显示(补单文案显示的是整个补单窗口,不是这一笔金额对应的天数)。**注意:我在分析阶段一度用"金额反推"判断这条是错的,判断有误,已更正**——补单文案不能用金额反推校验
- BIKE RESCUE(469)3 条 `MONTHLY BILL 2500 | OCBC`:`buildPostDescription` 对 MONTHLY 频率不检查补单类型,丢失补单日期区间,属于代码空档,按要求保持现状
- 合约在过账之后改过价的(如 RASA BRO 734,金额 1300、文案显示 `@MONTHLY 1200`):旧版 PHP 也是按当前合约价现算文案,保持 backup 现状;这周新增的 29 条经核对没有出现这种情况

### 10.5 这周新增、源数据本身比较特殊的(照旧库原样迁,不做修正)

- VINCENT(754)9/1 补单窗口一直到 2027-10-31,新系统日期格式不带年份,显示为 `PRORATED(1/10 - 31/10 | 396 DAYS)`,看起来别扭但天数是对的
- JASON(676)补单账期是 2024-10,是旧库原样数据

---

## 11. `tenant_auto_renew_transaction`

**无数据可迁,保持空表是正确状态。** 旧库现在 `company_auto_renew_request` 只剩 7 条(4 条 rejected、3 条 pending),**全部 `transaction_id` 为空**;原来 8/27 时唯一带关联交易的那条(AJ 公司,request 2943,关联交易 17044)已经从旧库申请队列里被清掉,交易 17044 本身也已从旧库删除(旧库、backup、`count_real` 均查不到)。backup 里这张表同样是 0 条。

---

## 12. 交易 id 重新编号(对齐 backup 的做法)

之前为了避免 Data Capture 合成交易跟旧库交易 id 撞车,把它们放在 1,000,000 以上。这次已改成跟 backup 一致:**旧库真实 id 1~43371 原样保留,合成交易(Data Capture 90299 条 + MAC999/TZX/WSMT Net Profit 回填 3 条)按原顺序从 43372 开始连续编号到 133673**,`AUTO_INCREMENT`=133674。同步更新了 `data_capture_line.transaction_id`(唯一指向这批 id 的外键表;`tenant_auto_renew_transaction` 为空、`transactions_rate` 只引用旧库 id,不受影响)。改完 `data_capture_line` 0 孤儿,合成交易金额与明细行金额逐条一致。

## 13. 整体验收结果(只读核对)

| 检查 | 结果 |
|---|---|
| 各表行数 vs 旧库 | owner 15、tenant 29、account 1979、user 94(旧库 97-3 个 IT 账号)、account_currency 2179、account_link 82、process 1194(1207-13 合并)、process_submitted 10341、bank_process 256、data_captures 15630、data_capture_line 90299 全部与旧库一致 |
| 外键孤儿(19 项) | 18 项为 0;`tenant.owner` 1 条:租户 `T1`(GROUP)指向的 owner 139 在旧库 `owner` 表里就不存在(旧库自身遗留,另 ASIA/GT/AJ 三家旧库 owner 本来就是空) |
| 旧库 id 区间交易金额 | 35227 条,合计比旧库少 169,907.78 = 32 组 RATE 中间人重复记录合并删除的金额(161,587.24 + 8,320.54),精确对上 |
| Data Capture 合成交易 | 金额合计 151,252,908.56 = `data_capture_line` 金额合计,0 条金额/账号/币种不一致 |
| RATE 中间人孤儿 | 剩 2 条,即已知排除项(BK1 的 18146 金额真不一致、CX 的 17756 单边孤儿) |
| Domain Fee/Commission/Net Profit | 67 条标记(12 + 43 + 12),0 条描述残留括号 |
| Bank Process 交易 | 1063 条全挂台账,0 条旧格式文案 |
| 与 backup 逐 账号+币种 余额对比 | 4 组差异,全部可解释:账号 5022(-2032.33)、5723(-7000)是交易 18152/40014 这周在旧库被删除;账号 3892(+5540.98)、4373(+108.84)是交易 2915/2917,见下 |

### 交易 2915 / 2917(已按用户决定与 backup 保持一致)

3/16(95 公司,操作人 ZERO)的一次 RATE 换汇:JB-XIONG 用 CNY 3,298.20 换 XE 的 MYR 1,936.70(交易 3271/3272,汇率 ÷1.703)。另外两条:2915「Transaction to JB-XIONG (Rate: 1.713)」MYR 5,540.98(无归属分组、无对应另一条腿)与 2917「Rate charge (x0.033) from CNY 3298.20」MYR 108.84(该换汇的手续费,已归入分组)。旧库里这两条一直是有效交易,但 backup 里 **K 于 2026-09-22 在新系统手动删除**了(进 `transactions_deleted`,11:13 与 11:25),重建后这次删除没有带过来。

**决定**:重新应用这次删除(跟 backup 保持一致)。已把 backup 里这两条归档记录原样复制进 `transactions_deleted`,并从有效交易表移除。3271/3272 保留。注意:旧库(线上系统)里这两条仍是有效交易,以后重新从旧库迁移会再带回来,需要再删一次。

执行后与 backup 逐 账号+币种 对比余额差异只剩 2 组,即交易 18152/40014 这周在旧库被用户删除所致。

## 13.1 验收后发现的遗漏:手动 Profit 转账没有重分类为 PROFIT(已修复)

**现象**:AG 公司 SPORT 账号 Payment History,新版把 8/22 的 50,000 显示成 `ID PRODUCT = DATA CAPTURE`、description 空、金额符号反了(+50,000),B/F 也多出 20,000。旧版显示 `PROFIT` / `PROFIT FROM KJ` / -50,000。

**根因**:这是 [MANUAL_PROFIT_TYPE_RECLASSIFY_LOG.md](MANUAL_PROFIT_TYPE_RECLASSIFY_LOG.md) 记录过的同一个问题。旧库没有 `PROFIT` 类型,"手动从 A 账号转一笔到 B 账号"存成 `WIN` + `from_account_id`;新系统按 `transaction_type` 精确路由,`WIN/LOSE` 会被当成 Data Capture 行(ID PRODUCT 兜底 `DATA CAPTURE`、符号按 WIN 恒正)。上一轮 Transactions 迁移我把 §9.2 的规则清单里漏掉了这一类,`count_real` 里 `PROFIT` 类型是 0 条(backup 是 93 条)。

**识别规则**(沿用原文档):`transaction_type IN ('WIN','LOSE') AND from_account_id IS NOT NULL AND bank_process_posted_id IS NULL AND 没有对应的 data_capture_line`。用这条规则在 `count_real` 命中 94 条,跟 backup 的 93 条 `PROFIT` **逐条对上(0 多 0 少)**,另外 1 条是这周新增(AG,id 42542,`WIN`、空 description)。

**修复**:只改 `transaction_type` → `PROFIT`,不动 description(空 description 的 PROFIT 行由页面按 `PROFIT FROM {对手方}` 现算)。执行后 `PROFIT` 共 94 条,剩余误分类 0 条,`transaction_type` 跟 backup 逐条一致。分布:AG 62、95 10、RS 10、23 9、TZX 3。

### 13.2 `transactions` 全列逐列与 backup 对比(旧库 id 区间)

| 列 | 不同条数 | 说明 |
|---|---|---|
| currency_id / amount / transaction_date / transaction_type / remark / approval_status / rate_group_id / tenant_id / account_id / from_account_id | 0 | — |
| description | 9 | 7 条已确认的 Bank Process 改正值 + FARAH 2 条(backup 里是旧格式) |
| created_by / approved_by | 6690 / 6780 | 全部是去掉 `login_id` 后缀(`BEE_1`→`BEE` 等),去后缀再比较 **0 条不同** |
| bank_process_posted_id | 23 | 台账 id 不同(backup 的孤儿台账 id 与旧库 id 冲突),台账键(租户+合约+日期+类型)**全部一致** |

## 14. 迁移状态总结

所有域已完成:身份/租户、tenant_feature_module、Currency、Ownership/Domain 剩余部分、account_link、Bank Process 核心域、Process、Data Capture、细粒度 ACL、Transactions/RATE、Bank Process Accounting Due 台账 + 文案、`tenant_auto_renew_transaction`(无数据)。

**仍需注意**:
- `data_capture_description`(GAME 多选描述桥表)依然没有可靠来源,与 backup 一样保持空表
- BIKE RESCUE(469)3 条补单文案丢日期区间,是 `buildPostDescription` 的代码空档,按要求保持现状
- 新系统里做过、但旧库没有的手动操作(如上面 2915/2917 的删除),重建后不会自动带回;目前核对只发现这一处

这几个域迁完后会在本文档继续补充对应章节,或者另开一份文档,到时候跟你确认。
