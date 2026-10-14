-- One-off DATA migration: Transactions / RATE domain, legacy PHP DB -> Spring Boot tenant model.
--
-- Source: staging DB holding the raw 2026-08-27 c168.net mysqldump, imported as-is
--         (`c168_net_legacy_20260827` below -- adjust if your staging DB name differs).
-- Target: count_real -- requires identity/tenant (migrate_data_identity_tenant_from_legacy.sql) and
--         currency (migrate_data_currency_domain_ownership_from_legacy.sql) already migrated, since
--         this maps by tenant.code and rebuilds the same currency dedup as that script.
--
-- Scope: `transactions`, `transactions_rate`, `transactions_deleted`. Legacy `transaction_entry` /
-- `transactions_rate_details` are NOT migrated -- per TABLE_MIGRATION.md §2.6 they're redundant
-- double-entry breakdown tables superseded by `transactions_rate` + the two RATE leg rows in
-- `transactions`; `transactions_rate_details` IS used below as a read-only bridge to figure out
-- which two `transactions` rows are the RATE legs, but nothing from it is copied into the new schema.
--
-- Process-duplicate-merge note: the 7 process ids merged during the Process domain migration
-- (4700/4538/4687/4701/4175/4417/4590 -> 4138/4267/4689/4176/4419/4591, see
-- process_duplicate_merge_map / MIGRATION_LOG.md §4.2) do NOT affect this script -- verified none of
-- legacy `transactions.source_bank_process_id` reference any of those 7 ids (0 rows; that column
-- references legacy `bank_process.id`, an entirely different id space from `process.id`, and the
-- Bank Process domain hasn't been migrated yet anyway -- see the group_id note below).
-- `transactions` has no process_id/data_capture_id column at all in either schema, so the two ledgers
-- are fully decoupled; the merge only ever mattered for Process/Data Capture, already handled there.
--
-- Known upstream decisions baked into this script:
--   - scope_type/scope_id ignored throughout (same as every other domain) -- company_id is
--     authoritative even for the handful of scope_type='group' rows in transactions_deleted (5 rows,
--     company_id populated correctly regardless -- verified).
--   - `group_id` (2026-10-14: replaces the old transactions.rate_group_id + bank_process_posted_id
--     pair; see logs/GROUP_ID_MERGE_20261014.md). One operation = one group_id: RG-/RATE_ = Rate,
--     BK-<bank_process_accounting_posted.id> = Bank Process posting, DF-<min id> = Domain fee/renewal
--     charge, NULL = single transaction / Data Capture. THIS script sets it for RATE rows (section 2,
--     copied from the legacy rate_group_id) and Domain-fee rows (section 4). Bank Process rows keep
--     group_id NULL here: it is a NEW aggregation concept (one posted batch can own many
--     transactions) with no 1:1 legacy source -- legacy `source_bank_process_id`/
--     `source_bank_process_period_type` point at individual bank_process rows, not posted
--     batches, and bank_process_accounting_posted (which owns the BK- id) isn't migrated yet.
--     migrate_data_bank_process_accounting_due_from_legacy.sql section 4 backfills those.
--     (Mentions of rate_group_id below that read the legacy DB (c168_net_legacy_*) are the LEGACY
--     column names and stay as they are.)
--   - created_by / approved_by / deleted_by: legacy splits "who did it" across two parallel nullable
--     int columns (a `user.id` column and an `owner.id` column) instead of one polymorphic
--     (id, type) pair like other domains used. Verified 350/11685 transactions rows have BOTH
--     columns populated simultaneously (not mutually exclusive) -- confirmed real (distinct owners,
--     not a sentinel value). New schema only has room for one login_id string, so this script applies
--     a documented precedence: prefer the `user` column, fall back to the `owner` column. Judgment
--     call, not a discovered invariant -- majority pattern (8375+ user-only vs 2959 owner-only rows)
--     supports user-primary, but revisit if that assumption turns out to matter later.
--   - RECEIVE transaction_type: legacy enum includes it but 0 rows use it in `transactions` (new
--     schema's enum doesn't have RECEIVE at all) -- confirmed empty, no mapping needed there.
--     `transactions_deleted` DOES have RECEIVE rows (3 total, only 1 otherwise-migratable) plus 53
--     rows with an empty-string transaction_type (48 otherwise-migratable) -- both invalid against the
--     new enum, excluded explicitly (see §3).
--
-- Idempotency: NOT idempotent (plain INSERT, no dedup dance) -- intended for a single run against a
-- target where transactions/transactions_rate/transactions_deleted are still empty.
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/migrate_data_transactions_from_legacy.sql

-- =============================================================================
-- 0. Rebuild _map_currency (same dedup rule as migrate_data_currency_domain_ownership_from_legacy.sql
--    -- manual wins over subsidiary, lowest id breaks ties; count_real.currency.id already equals the
--    survivor's legacy id, so this just tells us which legacy currency.id -> which currency.id to use).
-- =============================================================================
CREATE TEMPORARY TABLE _map_currency (
    old_currency_id  INT NOT NULL PRIMARY KEY,
    survivor_id      INT NOT NULL
);
INSERT INTO _map_currency (old_currency_id, survivor_id)
SELECT cu.id, s.id
FROM c168_net_legacy_20260827.currency cu
JOIN (
    SELECT id, company_id, code,
           ROW_NUMBER() OVER (PARTITION BY company_id, code ORDER BY (sync_source = 'subsidiary'), id) AS rn
    FROM c168_net_legacy_20260827.currency
) s ON s.company_id = cu.company_id AND s.code = cu.code
WHERE s.rn = 1;

-- =============================================================================
-- 1. transactions (1:1, id preserved -- target table is empty; 11685 legacy rows, all scope_type
--    ='company', all resolve cleanly -- verified 0 orphans against company/account/currency/
--    user/owner before writing this).
-- =============================================================================
INSERT INTO transactions (
    id, tenant_id, transaction_type, account_id, from_account_id, currency_id, amount,
    transaction_date, description, remark, created_by, approval_status, approved_by, approved_at,
    created_at, updated_at
)
SELECT
    t.id,
    ten.id,
    t.transaction_type,
    t.account_id,
    t.from_account_id,
    mc.survivor_id,
    t.amount,
    t.transaction_date,
    t.description,
    t.sms,
    COALESCE(u1.login_id, o1.owner_code),
    t.approval_status,
    COALESCE(u2.login_id, o2.owner_code),
    t.approved_at,
    t.created_at,
    t.updated_at
FROM c168_net_legacy_20260827.transactions t
JOIN c168_net_legacy_20260827.company c ON c.id = t.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN _map_currency mc ON mc.old_currency_id = t.currency_id
LEFT JOIN user u1 ON u1.id = t.created_by
LEFT JOIN owner o1 ON o1.id = t.created_by_owner
LEFT JOIN user u2 ON u2.id = t.approved_by
LEFT JOIN owner o2 ON o2.id = t.approved_by_owner;

-- =============================================================================
-- 2. transactions_rate (RATE group headers) + transactions.group_id backfill on the 2 legs.
--
--    Legacy links a RATE group to its ledger rows via transactions_rate_details(rate_group_id,
--    transaction_id, record_type): 'first_from'/'first_to' both point at the SAME transactions.id
--    (the leg1 / "from currency" row -- matches transactions_rate.transaction_id, verified for all
--    175 groups), 'transfer_to' points at the DISTINCT leg2 / "to currency" row. Verified this holds
--    for 173/175 groups (151 plain + 21 with a middleman + 1 where the middleman fee is a single
--    rebate row instead of a charge/receive pair -- none of that changes leg1/leg2 derivation).
--
--    2 groups (RATE_1779623477_1884, RATE_1786120634_9253) have NO 'transfer_to' row at all -- the
--    legacy data itself only ever recorded ONE ledger transaction for what should have been a
--    two-currency conversion (rate_to_currency_id differs from rate_from_currency_id in one of the
--    two, so this isn't just a same-currency shortcut -- it looks like a legacy bug/incomplete
--    submission). There is no second leg to point leg2_transaction_id at, and the column is NOT
--    NULL, so rather than fabricate one, these 2 groups get NO transactions_rate header row.
--    The lone leg1 transaction itself is still migrated normally in §1 (it's a real transaction,
--    just left without a rate_group_id / RATE counterpart). Expect 175 - 2 = 173 header rows.
-- =============================================================================
CREATE TEMPORARY TABLE _resolve_rate (
    group_id      VARCHAR(50) NOT NULL PRIMARY KEY,
    leg1_id       INT NOT NULL,
    leg2_id       INT NOT NULL
);
INSERT INTO _resolve_rate (group_id, leg1_id, leg2_id)
SELECT tr.rate_group_id, tr.transaction_id, trd.transaction_id
FROM c168_net_legacy_20260827.transactions_rate tr
JOIN c168_net_legacy_20260827.transactions_rate_details trd
    ON trd.rate_group_id = tr.rate_group_id AND trd.record_type = 'transfer_to';

-- rate_expression / middleman_rate_expression / platform_fee_amount: no legacy source (legacy only
-- stored the computed exchange_rate/middleman_rate numerics, never the raw UI input string; Platform
-- Fee is a feature added after this backup) -- left NULL, not fabricated.
INSERT INTO transactions_rate (
    tenant_id, group_id, leg1_transaction_id, leg2_transaction_id, exchange_rate,
    currency_from_id, amount_from, currency_to_id, amount_to,
    middleman_account_id, middleman_rate, middleman_amount,
    created_at, updated_at
)
SELECT
    ten.id,
    tr.rate_group_id,
    r.leg1_id,
    r.leg2_id,
    tr.exchange_rate,
    mcf.survivor_id,
    tr.rate_from_amount,
    mct.survivor_id,
    tr.rate_to_amount,
    tr.rate_middleman_account_id,
    tr.rate_middleman_rate,
    tr.rate_middleman_amount,
    tr.created_at,
    tr.updated_at
FROM c168_net_legacy_20260827.transactions_rate tr
JOIN _resolve_rate r ON r.group_id = tr.rate_group_id
JOIN c168_net_legacy_20260827.company c ON c.id = tr.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN _map_currency mcf ON mcf.old_currency_id = tr.rate_from_currency_id
JOIN _map_currency mct ON mct.old_currency_id = tr.rate_to_currency_id;

UPDATE transactions t
JOIN _resolve_rate r ON t.id = r.leg1_id OR t.id = r.leg2_id
SET t.group_id = r.group_id;

DROP TEMPORARY TABLE _resolve_rate;

-- =============================================================================
-- 3. transactions_deleted (soft-delete archive; new `id` is a fresh surrogate key -- the original
--    transactions.id is preserved separately in the `transaction_id` column, per schema comment).
--
--    Data-quality reality check done before writing this: of 2907 legacy rows, 1805 reference a
--    company_id that no longer exists in `company` at all (predates the company_deletion_archive
--    feature -- deleted_at on these rows is 2026-03, company_deletion_archive only starts 2026-06 --
--    so this is old cruft from company deletions that happened before any archival was in place, not
--    a migration bug). Those rows have no tenant to attach to (tenant_id is NOT NULL) and are
--    unrecoverable -- skipped, not fabricated. A further 49 of the remaining rows have an invalid
--    transaction_type for the new enum (48 empty-string, 1 RECEIVE) and are also skipped.
--    Net: 1097 rows pass the company/account existence check, 1048 also pass the transaction_type
--    check -- that's what this INSERT actually produces. group_id is left NULL for RATE rows (no
--    reliable legacy source for deleted RATE rows -- transactions_rate_details only covers live
--    groups, and a deleted RATE submission's header row is typically gone too).
-- =============================================================================
INSERT INTO transactions_deleted (
    tenant_id, transaction_id, transaction_type, account_id, from_account_id, currency_id, amount,
    transaction_date, description, remark, created_by, created_at, deleted_by, deleted_at
)
SELECT
    ten.id,
    td.transaction_id,
    td.transaction_type,
    td.account_id,
    td.from_account_id,
    mc.survivor_id,
    td.amount,
    td.transaction_date,
    td.description,
    td.sms,
    COALESCE(u1.login_id, o1.owner_code),
    td.created_at,
    COALESCE(u2.login_id, o2.owner_code),
    td.deleted_at
FROM c168_net_legacy_20260827.transactions_deleted td
JOIN c168_net_legacy_20260827.company c ON c.id = td.company_id
JOIN tenant ten ON ten.tenant_type = 'COMPANY' AND ten.code = c.company_id
JOIN account a ON a.id = td.account_id
LEFT JOIN _map_currency mc ON mc.old_currency_id = td.currency_id
LEFT JOIN user u1 ON u1.id = td.created_by
LEFT JOIN owner o1 ON o1.id = td.created_by_owner
LEFT JOIN user u2 ON u2.id = td.deleted_by_user_id
LEFT JOIN owner o2 ON o2.id = td.deleted_by_owner_id
WHERE td.transaction_type IN ('WIN','LOSE','PAYMENT','CONTRA','CLAIM','RATE','CLEAR','ADJUSTMENT');

-- =============================================================================
-- 4. Domain fee / renewal charges -> group_id 'DF-<min id>' (live + archived). One charge =
--    DOMAIN_FEE + DOMAIN_COMMISSION* + DOMAIN_NET_PROFIT lines written in one go (see
--    DomainFeeChargeServiceImpl): same tenant + same created_by + same created_at. Only well-formed
--    charges are tagged (exactly one DOMAIN_FEE, at most one DOMAIN_NET_PROFIT); the rest stay NULL --
--    check the SELECT at the end of this section. The NET_PROFIT line is inserted last, so it can land
--    one second after the others: a leftover NET_PROFIT joins the DF- group whose DOMAIN_FEE is at most
--    1s earlier (same tenant + creator) and which has no NET_PROFIT yet.
-- =============================================================================
UPDATE transactions t
JOIN (
    SELECT MIN(id) AS gid, tenant_id, created_by, created_at
    FROM transactions
    WHERE remark IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT')
    GROUP BY tenant_id, created_by, created_at
    HAVING SUM(remark = 'DOMAIN_FEE') = 1 AND SUM(remark = 'DOMAIN_NET_PROFIT') <= 1
) g ON g.tenant_id = t.tenant_id AND g.created_by <=> t.created_by AND g.created_at = t.created_at
SET t.group_id = CONCAT('DF-', g.gid)
WHERE t.remark IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND t.group_id IS NULL;

UPDATE transactions n
JOIN transactions f
  ON f.tenant_id = n.tenant_id AND f.created_by <=> n.created_by
 AND f.remark = 'DOMAIN_FEE' AND f.group_id LIKE 'DF-%'
 AND f.created_at BETWEEN n.created_at - INTERVAL 1 SECOND AND n.created_at
LEFT JOIN (SELECT DISTINCT group_id FROM transactions
           WHERE remark = 'DOMAIN_NET_PROFIT' AND group_id LIKE 'DF-%') hn ON hn.group_id = f.group_id
SET n.group_id = f.group_id
WHERE n.remark = 'DOMAIN_NET_PROFIT' AND n.group_id IS NULL AND hn.group_id IS NULL;

UPDATE transactions_deleted d
JOIN (
    SELECT MIN(transaction_id) AS gid, tenant_id, created_by, created_at
    FROM transactions_deleted
    WHERE remark IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND group_id IS NULL
    GROUP BY tenant_id, created_by, created_at
    HAVING SUM(remark = 'DOMAIN_FEE') = 1 AND SUM(remark = 'DOMAIN_NET_PROFIT') <= 1
) g ON g.tenant_id = d.tenant_id AND g.created_by <=> d.created_by AND g.created_at <=> d.created_at
SET d.group_id = CONCAT('DF-', g.gid)
WHERE d.remark IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND d.group_id IS NULL;

-- Domain charges left untagged (expected: none; otherwise review by hand)
SELECT 'live' AS src, tenant_id, created_by, created_at, GROUP_CONCAT(id) AS ids
FROM transactions
WHERE remark IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND group_id IS NULL
GROUP BY tenant_id, created_by, created_at
UNION ALL
SELECT 'deleted', tenant_id, created_by, created_at, GROUP_CONCAT(transaction_id)
FROM transactions_deleted
WHERE remark IN ('DOMAIN_FEE', 'DOMAIN_COMMISSION', 'DOMAIN_NET_PROFIT') AND group_id IS NULL
GROUP BY tenant_id, created_by, created_at;

DROP TEMPORARY TABLE _map_currency;
