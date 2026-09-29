# Admin 账号 ↔ 公司归属：无法自动确认的清单（迁移前备查）

背景：为支持"不同公司下允许重复 login_id"（例如 APPLE 在 AG 是 Admin、在 C168 是 Customer Service），计划把 `user.login_id` 的唯一约束从全局唯一改成 `(home_tenant_id, login_id)` 联合唯一。回填 `home_tenant_id` 时，用了两类信号交叉核对：

1. `user_tenant_access`（新库授权表）+ `process`/`transactions`/`data_captures`/`bank_process`/`process_submitted` 里 `created_by = login_id` 的数据痕迹（新库 `count168_site`）。
2. 旧库 `c168_net` 的 `user_company_map`、`user_company_permissions`、`user_group_map`、`auto_login_credentials`，以及同样几张业务表连同 `_backup`/`_deleted` 历史归档变体（本地导入库 `c168_net_legacy`，来源 `D:\Backup - c168.net\c168_net-202609281733.sql`，导出时间 2026-09-28 17:33）。

两边交叉查完，一致确认 **37 个账号能自动定位公司**，**9 个是角色模板/占位账号**（可直接排除），剩下 **51 个账号在新旧两套系统里都从未被赋予过任何公司归属记录**——不是迁移漏了，是这些账号从建立起就没人分配过公司。

**结论：这 51 个账号无法靠数据自动回填 `home_tenant_id`，只能人工指定。** 这份文件保留原始数据，方便：
- 上线新的唯一约束后，如果某个账号登录不上（提示找不到 `home_tenant_id` 或找不到公司），可以从这里查到它的原始 email / 创建人 / 创建时间等线索，人工确认它该归哪家公司再补一条 SQL。
- 避免以后又重新做一次同样的排查。

---

## 51 个待人工确认账号（原始数据来自旧库 `user_backup`）

`login_id` 一列写的是**新库**里的版本（新库为了满足当时的全局唯一约束，给撞车的账号加了 `_1/_2/_4...` 后缀）；旧库里这些账号的 `login_id` 是没加后缀的原始值，比如新库的 `APPLE_1`/`APPLE_2`/`APPLE_4` 在旧库里都还叫 `APPLE`。

| user.id | login_id（新库） | name | email | role | 创建人(created_by) | 创建时间 | 最近登录 |
|---|---|---|---|---|---|---|---|
| 216 | BEE | YAO | yao1@gmail.com | admin | K | 2026-02-03 12:06:16 | 2026-03-08 19:32:49 |
| 219 | KY | KAYDEN | ky@gmail.com | supervisor | ZERO | 2026-02-03 12:41:58 | 2026-02-04 17:10:39 |
| 220 | APPLE | APPLE | apple@gmail.com | supervisor | ZERO | 2026-02-03 18:43:57 | 2026-03-08 15:22:42 |
| 221 | MOON | MOON | moon@gmail.com | supervisor | ZERO | 2026-02-03 18:45:06 | 2026-03-07 14:36:31 |
| 222 | MILO | MILO | milo@gmail.com | supervisor | BEE | 2026-02-03 18:49:20 | 2026-03-08 20:26:03 |
| 223 | SEVEN | SEVEN | seven@gmail.com | supervisor | BEE | 2026-02-03 18:50:50 | 2026-02-23 22:36:46 |
| 228 | KAYDEN | GW | kayden@gmail.com | manager | ZERO | 2026-02-07 19:29:46 | 2026-03-01 20:39:47 |
| 230 | 7ZAI | QI ZAI 1 | qizai9172@gmail.com | admin | LFF77 | 2026-02-09 17:27:09 | — |
| 241 | 9 | 9 | 999@gmail.com | admin | 1 | 2026-02-11 18:40:05 | 2026-02-28 14:46:44 |
| 244 | APPLE_1 | APPLE | 12223@gmail.com | admin | 1 | 2026-02-11 20:55:21 | — |
| 247 | 1111 | 111 | 1111@gmail.com | manager | 1 | 2026-02-12 10:48:48 | 2026-02-12 10:49:07 |
| 250 | APPLE_2 | 1 | 11123@gmail.com | manager | K | 2026-02-28 15:37:25 | 2026-02-28 16:08:27 |
| 251 | 9_1 | 1 | 1g@gmail.com | supervisor | K | 2026-02-28 15:37:43 | 2026-02-28 15:38:08 |
| 252 | 9_2 | 9 | 9@gmail.com | (空) | APPLE | 2026-03-04 15:28:11 | 2026-03-07 19:43:03 |
| 253 | A9 | 9 | a9@gmail.com | accountant | APPLE | 2026-03-04 15:49:59 | 2026-03-04 15:50:14 |
| 267 | ZERO_1 | ZERO | zero@gmail.com | admin | K | 2026-03-09 02:54:18 | 2026-03-18 14:11:05 |
| 270 | BEE_2 | BEE | be1e@gmail.com | admin | K | 2026-03-09 02:54:52 | — |
| 271 | JK_1 | JK | jk1@gmail.com | admin | K | 2026-03-09 02:55:21 | 2026-04-14 12:58:13 |
| 274 | APPLE_4 | APPLE | appl1e@gmail.com | admin | K | 2026-03-09 02:56:38 | — |
| 275 | WINE | 9 | kc1@gmail.com | admin | K | 2026-03-09 02:56:58 | — |
| 281 | XJ | XIAO JIE | 11g@gmail.com | admin | K | 2026-03-20 13:19:22 | 2026-03-23 11:48:35 |
| 282 | JR | JERRY | 2222g@gmail.com | admin | K | 2026-03-20 13:19:44 | 2026-03-23 12:13:42 |
| 283 | CS001 | A1 | ppaplen0000@gmail.com | (空) | XJ | 2026-03-20 16:58:06 | 2026-03-21 12:27:00 |
| 286 | DVD | XIAOJIE | sohaijie@gmail.com | manager | JR | 2026-03-23 12:14:57 | 2026-03-23 12:15:22 |
| 291 | JS_1 | JS | js@gmail.com | admin | JK | 2026-03-26 11:56:27 | 2026-04-08 10:03:30 |
| 292 | JJ | JJ | jj11@gmail.com | (空) | JS | 2026-03-26 14:57:16 | — |
| 293 | KAYDEN_2 | KAYDEN | zero111@gmail.com | admin | K | 2026-03-31 11:28:28 | 2026-03-31 11:28:44 |
| 294 | MS | MS | ms1@gmail.com | admin | JK | 2026-04-02 10:05:26 | 2026-04-21 16:04:40 |
| 295 | XM | XIAO MI | xiaomi@gmail.com | admin | K | 2026-04-02 13:26:15 | 2026-04-02 13:28:06 |
| 296 | TEST | TEST | test@gmail.com | (空) | JK | 2026-04-06 14:08:20 | 2026-04-22 15:20:08 |
| 297 | NEW | NEW | new@gmail.com | (空) | JK | 2026-04-08 10:12:11 | 2026-04-22 16:55:18 |
| 357 | TEST01_1 | TEST01 | 123456@gmail.com | manager | TEST | 2026-04-27 21:19:55 | 2026-06-06 22:52:45 |
| 365 | TEST01_2 | TEST01 | test01@gmail.com | admin | TEST | 2026-05-20 11:16:34 | 2026-05-21 13:14:53 |
| 411 | ABC | ABCD | abc@gmail.com | admin | TEST | 2026-05-20 16:24:03 | — |
| 489 | ABC_1 | ABC | 1234567@gmail.com | supervisor | TEST | 2026-05-20 16:30:13 | 2026-06-30 15:41:33 |
| 498 | AB | ABCD | ab@gmail.com | admin | TEST | 2026-05-20 16:33:32 | — |
| 503 | APPLE_5 | LI PIN | 1232a@gmail.com | (空) | K | 2026-05-26 23:13:50 | 2026-07-10 22:31:14 |
| 504 | WINE_1 | KC | wine1@gmail.com | (空) | K | 2026-05-26 23:18:18 | 2026-06-05 18:13:29 |
| 505 | JK_2 | JK | jk111@gmail.com | admin | K | 2026-05-26 23:46:44 | 2026-05-28 09:31:35 |
| 506 | KY_1 | KAI YUAN | kkyylim663@gmail.com | admin | K | 2026-05-27 22:11:23 | 2026-05-28 01:44:53 |
| 507 | TEST_2 | TEST | phototest@gmail.com | admin | APPLE | 2026-05-28 00:45:04 | 2026-06-06 21:39:16 |
| 508 | KAYDEN_3 | GW | gw@gmail.com | (空) | K | 2026-05-28 15:03:34 | 2026-06-15 18:01:14 |
| 511 | JIU | 123 | kyuskc999@gmail.com | (空) | K | 2026-06-05 22:39:24 | — |
| 512 | A | A | a@gmail.com | accountant | TEST01 | 2026-06-06 22:53:49 | 2026-06-06 22:55:25 |
| 513 | B | B | b@gmail.com | (空) | TEST01 | 2026-06-06 22:54:21 | 2026-06-06 22:55:54 |
| 514 | CS | CS | cs@gmail.com | (空) | TEST01 | 2026-06-06 22:54:45 | 2026-06-17 10:14:36 |
| 515 | MS_1 | MS | kunzzholdings@gmail.com | (空) | TEST | 2026-06-08 12:54:28 | 2026-06-08 14:22:06 |
| 516 | SH_1 | SH | sh123@gmail.com | manager | TEST | 2026-06-08 19:18:29 | 2026-06-29 14:44:55 |
| 518 | JS_2 | JS | js11@gmail.com | admin | TEST | 2026-06-23 17:58:27 | 2026-06-23 17:58:38 |
| 519 | TL | TL | testlogin@gmail.com | admin | TEST | 2026-06-30 15:52:09 | 2026-06-30 15:53:32 |
| 526 | T1 | T1 | kunzzit01111@gmail.com | (空) | TEST | 2026-07-22 09:17:59 | 2026-07-22 09:24:58 |

---

## 附：3 个系统维护账号（不是真人，直接作废，不需要分配公司）

| user.id | login_id | email | 创建人 | 创建时间 |
|---|---|---|---|---|
| 523 | IT_JK | it_jk@count168.local | system-maintenance | 2026-07-10 10:08:19 |
| 524 | IT_JS | it_js@count168.local | system-maintenance | 2026-07-10 10:08:19 |
| 525 | IT_MS | it_ms@count168.local | system-maintenance | 2026-07-10 10:08:19 |

来源：旧库 `user_company_permissions`，三者均归属 `C168`；但已确认这三个是系统自建的维护/巡检账号，**直接作废，不用迁移、不用分配 `home_tenant_id`**（新库 `user_tenant_access` 里本来就没有这三笔记录，跟"待人工确认"的账号不是一回事）。迁移脚本可以直接跳过或停用这三个 `user.id`。

---

## 已确认的 37 个账号（供对照，不需要再查）

见会话中另一份文件 `admin_account_company_mapping.md`「一、可确认公司」表。

---

## 如果上线后某账号登录不上，按这个流程补：

1. 先查 `user.login_id` / `user.email` 对上面表里的哪一行。
2. 找当事人或熟悉这批账号的同事确认真实归属公司（可以拿 email、创建人这两列做线索，比如同一个创建人建的一批账号往往是同一个人对接的同一家公司）。
3. 确认后，给 `user.home_tenant_id` 补一条 `UPDATE`，对应的 `tenant.code`。
4. 更新完这份文件，把该行从"待确认"移到"已确认"，避免以后重复排查。
