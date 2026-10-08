-- Incremental DATA sync, STAGE 4: Data Capture domain, legacy c168.net PHP DB -> count_real (local rehearsal).
--
-- Source = `c168_net_legacy_20261007`   Baseline = `c168_net_legacy_20260929`   Target = count_real.
-- Run AFTER the identity / currency / process stages (needs tenants, accounts, currencies, processes).
--
-- Rules (same as the other stages): NEW rows since the baseline are inserted (ids preserved where the new schema
-- preserves them); CHANGED = only what legacy changed since the baseline, per column; DELETED = only what legacy
-- removed since the baseline. Rows that exist only in count_real are never touched.
--
-- What this script does
--   0. deletions legacy made since the baseline: capture 21938 (+ its 2 lines and the 2 transactions those lines
--      generated), template 38133, submitted_processes row 15096.
--   1. data_captures        (id preserved)       2. data_capture_line (from data_capture_details, id preserved)
--   3. transactions         one WIN/LOSE per NEW line, FRESH ids (legacy transaction ids are not used at all: every
--                           id above 43371 is already taken by earlier generated rows). Same shape as the earlier
--                           backfills (migrate_delta_datacapture_line_transactions_backfill_20260905.sql):
--                           type = WIN if processed_amount > 0 else LOSE, amount = ABS, description =
--                           '<process code>: <formula>', remark = description_main (MAIN) / description_sub (SUB),
--                           created_by/approved_by = capture creator, timestamps = capture created_at.
--   4. data_capture_formula (from data_capture_templates, id preserved): new rows, per-column changes, removed row
--   5. data_capture_draft (+ _cell): new / changed drafts; cells of those drafts are rebuilt from draft_json
--   6. process_submitted    (NOT id preserved): new rows and the removed row, matched on
--                           (tenant, process, created_by, capture_date, created_at). capture_id stays NULL like
--                           every earlier migrated row.
--
-- Usage:
--   mysql -u root count_real < backend/src/main/resources/SqlEtcForMigrate/delta_sync/migrate_delta_datacapture_20261007.sql

START TRANSACTION;

CREATE TEMPORARY TABLE _map_tenant (
    old_type      ENUM('COMPANY','GROUP') NOT NULL,
    old_id        INT NOT NULL,
    new_tenant_id INT NOT NULL,
    PRIMARY KEY (old_type, old_id)
);
INSERT INTO _map_tenant (old_type, old_id, new_tenant_id)
SELECT 'COMPANY', c.id, t.id FROM c168_net_legacy_20261007.company c
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id;
INSERT INTO _map_tenant (old_type, old_id, new_tenant_id)
SELECT 'GROUP', g.id, t.id FROM c168_net_legacy_20261007.groups g
JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = g.group_code;

CREATE TEMPORARY TABLE _map_currency (
    old_currency_id  INT NOT NULL PRIMARY KEY,
    survivor_id      INT NOT NULL
);
INSERT INTO _map_currency (old_currency_id, survivor_id)
SELECT cu.id, s.id
FROM c168_net_legacy_20261007.currency cu
JOIN (
    SELECT id, company_id, code,
           ROW_NUMBER() OVER (PARTITION BY company_id, code ORDER BY (sync_source = 'subsidiary'), id) AS rn
    FROM c168_net_legacy_20261007.currency
) s ON s.company_id = cu.company_id AND s.code = cu.code
WHERE s.rn = 1;

CREATE TEMPORARY TABLE _resolve_process (
    old_process_id      INT NOT NULL PRIMARY KEY,
    resolved_process_id INT UNSIGNED NOT NULL
);
INSERT INTO _resolve_process (old_process_id, resolved_process_id)
SELECT p.id, COALESCE(m.canonical_process_id, p.id)
FROM c168_net_legacy_20261007.process p
LEFT JOIN process_duplicate_merge_map m ON m.old_process_id = p.id;

-- =============================================================================
-- 0. Deletions legacy made since the baseline.
-- =============================================================================
CREATE TEMPORARY TABLE _del_line (id INT PRIMARY KEY, transaction_id BIGINT UNSIGNED);
INSERT INTO _del_line (id, transaction_id)
SELECT l.id, l.transaction_id
FROM data_capture_line l
WHERE l.id IN (SELECT b.id FROM c168_net_legacy_20260929.data_capture_details b
               WHERE NOT EXISTS (SELECT 1 FROM c168_net_legacy_20261007.data_capture_details a WHERE a.id = b.id));
SELECT 'lines legacy removed' AS step, COUNT(*) AS n FROM _del_line;

DELETE l FROM data_capture_line l JOIN _del_line d ON d.id = l.id;
SELECT 'data_capture_line deleted' AS step, ROW_COUNT() AS n;

DELETE t FROM transactions t JOIN _del_line d ON d.transaction_id = t.id;
SELECT 'transactions of removed lines deleted' AS step, ROW_COUNT() AS n;

DELETE x FROM process_submitted x
JOIN (
    SELECT m.new_tenant_id AS tenant_id, COALESCE(pm.canonical_process_id, b.process_id) AS process_id,
           CASE WHEN b.user_type = 'owner' THEN ow.owner_code ELSE u.login_id END AS created_by,
           b.capture_date, b.created_at
    FROM c168_net_legacy_20260929.submitted_processes b
    JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = b.company_id
    LEFT JOIN owner ow ON ow.id = b.user_id AND b.user_type = 'owner'
    LEFT JOIN user u ON u.id = b.user_id AND b.user_type = 'user'
    LEFT JOIN process_duplicate_merge_map pm ON pm.old_process_id = b.process_id
    WHERE NOT EXISTS (SELECT 1 FROM c168_net_legacy_20261007.submitted_processes a WHERE a.id = b.id)
) gone ON gone.tenant_id = x.tenant_id AND gone.process_id = x.process_id AND gone.created_by <=> x.created_by
      AND gone.capture_date <=> x.capture_date AND gone.created_at <=> x.created_at;
SELECT 'process_submitted deleted' AS step, ROW_COUNT() AS n;

DELETE dc FROM data_captures dc
WHERE dc.id IN (SELECT b.id FROM c168_net_legacy_20260929.data_captures b
                WHERE NOT EXISTS (SELECT 1 FROM c168_net_legacy_20261007.data_captures a WHERE a.id = b.id))
  AND NOT EXISTS (SELECT 1 FROM data_capture_line l WHERE l.capture_id = dc.id);
SELECT 'data_captures deleted' AS step, ROW_COUNT() AS n;

DELETE f FROM data_capture_formula f
WHERE f.id IN (SELECT b.id FROM c168_net_legacy_20260929.data_capture_templates b
               WHERE NOT EXISTS (SELECT 1 FROM c168_net_legacy_20261007.data_capture_templates a WHERE a.id = b.id));
SELECT 'data_capture_formula deleted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 1. data_captures: new rows since the baseline, id preserved.
-- =============================================================================
INSERT INTO data_captures
    (id, tenant_id, category, capture_date, process_id, currency_id, remark,
     remove_word, replace_word_from, replace_word_to, created_by, created_at)
SELECT
    dc.id, m.new_tenant_id, pr.category, dc.capture_date, rp.resolved_process_id, mc.survivor_id,
    dc.remark, pr.remove_word, pr.replace_word_from, pr.replace_word_to,
    CASE WHEN dc.user_type = 'owner' THEN ow.owner_code ELSE u.login_id END,
    dc.created_at
FROM c168_net_legacy_20261007.data_captures dc
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = dc.company_id
JOIN _resolve_process rp ON rp.old_process_id = dc.process_id
JOIN process pr ON pr.id = rp.resolved_process_id
JOIN _map_currency mc ON mc.old_currency_id = dc.currency_id
LEFT JOIN owner ow ON ow.id = dc.created_by AND dc.user_type = 'owner'
LEFT JOIN user u ON u.id = dc.created_by AND dc.user_type = 'user'
WHERE dc.id NOT IN (SELECT id FROM c168_net_legacy_20260929.data_captures)
  AND dc.id NOT IN (SELECT id FROM data_captures);
SELECT 'data_captures inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 2. data_capture_line: new rows since the baseline, id preserved (transaction_id filled in step 3).
-- =============================================================================
INSERT INTO data_capture_line
    (id, tenant_id, capture_id, product_type, id_product, id_product_main, id_product_sub,
     description_main, description_sub, formula_variant, display_order, account_id, currency_id,
     source_columns, source_value, source_percent, enable_source_percent, formula,
     processed_amount, rate, rate_expression, created_at)
SELECT
    dcd.id, dc.tenant_id, dcd.capture_id, UPPER(dcd.product_type), dcd.id_product,
    dcd.id_product_main, dcd.id_product_sub, dcd.description_main, dcd.description_sub,
    dcd.formula_variant, dcd.display_order, CAST(dcd.account_id AS UNSIGNED), dc.currency_id,
    dcd.columns_value, dcd.source_value, dcd.source_percent, dcd.enable_source_percent, dcd.formula,
    dcd.processed_amount, dcd.rate, dcd.rate_expression, dcd.created_at
FROM c168_net_legacy_20261007.data_capture_details dcd
JOIN data_captures dc ON dc.id = dcd.capture_id
WHERE dcd.id NOT IN (SELECT id FROM c168_net_legacy_20260929.data_capture_details)
  AND dcd.id NOT IN (SELECT id FROM data_capture_line);
SELECT 'data_capture_line inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 3. transactions for the NEW lines: fresh ids (MAX(id)+n, ordered by line id), then link back.
-- =============================================================================
CREATE TEMPORARY TABLE _new_line (
    line_id INT PRIMARY KEY,
    txn_id  BIGINT UNSIGNED NOT NULL
);
SET @base_txn := (SELECT IFNULL(MAX(id), 0) FROM transactions);
INSERT INTO _new_line (line_id, txn_id)
SELECT l.id, @base_txn + ROW_NUMBER() OVER (ORDER BY l.id)
FROM data_capture_line l
WHERE l.transaction_id IS NULL
  AND l.id NOT IN (SELECT id FROM c168_net_legacy_20260929.data_capture_details);
SELECT 'new lines needing a transaction' AS step, COUNT(*) AS n FROM _new_line;

INSERT INTO transactions (
    id, tenant_id, transaction_type, account_id, currency_id, amount, transaction_date,
    description, remark, created_by, approval_status, approved_by, approved_at, created_at, updated_at
)
SELECT
    nl.txn_id,
    dcl.tenant_id,
    CASE WHEN dcl.processed_amount > 0 THEN 'WIN' ELSE 'LOSE' END,
    dcl.account_id,
    dcl.currency_id,
    ABS(dcl.processed_amount),
    dc.capture_date,
    CONCAT(p.code, ': ', dcl.formula),
    CASE WHEN dcl.product_type = 'MAIN' THEN dcl.description_main ELSE dcl.description_sub END,
    dc.created_by,
    'APPROVED',
    dc.created_by,
    dc.created_at,
    dc.created_at,
    dc.created_at
FROM _new_line nl
JOIN data_capture_line dcl ON dcl.id = nl.line_id
JOIN data_captures dc ON dc.id = dcl.capture_id
JOIN process p ON p.id = dc.process_id;
SELECT 'transactions inserted' AS step, ROW_COUNT() AS n;

UPDATE data_capture_line dcl
JOIN _new_line nl ON nl.line_id = dcl.id
SET dcl.transaction_id = nl.txn_id;
SELECT 'lines linked to their transaction' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 4. data_capture_formula (from data_capture_templates): new rows, then per-column legacy changes.
-- =============================================================================
INSERT IGNORE INTO data_capture_formula
    (id, tenant_id, process_id, product_type, id_product, parent_id_product, formula_variant,
     sub_order, row_index, account_id, currency_id, description, source_columns, columns_display,
     formula, input_method, source_percent, enable_source_percent, enable_input_method,
     created_at, updated_at)
SELECT
    dct.id, m.new_tenant_id, rp.resolved_process_id, UPPER(dct.product_type), dct.id_product,
    dct.parent_id_product, dct.formula_variant, dct.sub_order, dct.row_index, dct.account_id,
    mc.survivor_id, dct.description, dct.source_columns, dct.columns_display, dct.formula_display,
    dct.input_method, dct.source_percent, dct.enable_source_percent, dct.enable_input_method,
    dct.created_at, dct.updated_at
FROM c168_net_legacy_20261007.data_capture_templates dct
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = dct.company_id
JOIN _resolve_process rp ON rp.old_process_id = CAST(dct.process_id AS UNSIGNED)
LEFT JOIN _map_currency mc ON mc.old_currency_id = dct.currency_id
WHERE dct.process_id IS NOT NULL AND dct.process_id REGEXP '^[0-9]+$'
  AND dct.id NOT IN (SELECT id FROM c168_net_legacy_20260929.data_capture_templates)
  AND dct.id NOT IN (SELECT id FROM data_capture_formula);
SELECT 'data_capture_formula inserted' AS step, ROW_COUNT() AS n;

UPDATE data_capture_formula f
JOIN c168_net_legacy_20261007.data_capture_templates a ON a.id = f.id
JOIN c168_net_legacy_20260929.data_capture_templates b ON b.id = a.id
SET f.source_columns = CASE WHEN a.source_columns <=> b.source_columns THEN f.source_columns ELSE a.source_columns END,
    f.columns_display = CASE WHEN a.columns_display <=> b.columns_display THEN f.columns_display ELSE a.columns_display END,
    f.row_index = CASE WHEN a.row_index <=> b.row_index THEN f.row_index ELSE a.row_index END,
    f.input_method = CASE WHEN a.input_method <=> b.input_method THEN f.input_method ELSE a.input_method END,
    f.formula = CASE WHEN a.formula_display <=> b.formula_display THEN f.formula ELSE a.formula_display END,
    f.account_id = CASE WHEN a.account_id <=> b.account_id THEN f.account_id ELSE a.account_id END,
    f.description = CASE WHEN a.description <=> b.description THEN f.description ELSE a.description END,
    f.source_percent = CASE WHEN a.source_percent <=> b.source_percent THEN f.source_percent ELSE a.source_percent END,
    f.enable_source_percent = CASE WHEN a.enable_source_percent <=> b.enable_source_percent THEN f.enable_source_percent ELSE a.enable_source_percent END,
    f.enable_input_method = CASE WHEN a.enable_input_method <=> b.enable_input_method THEN f.enable_input_method ELSE a.enable_input_method END,
    f.updated_at = CASE WHEN a.updated_at <=> b.updated_at THEN f.updated_at ELSE a.updated_at END
WHERE NOT (a.source_columns <=> b.source_columns AND a.columns_display <=> b.columns_display
           AND a.row_index <=> b.row_index AND a.input_method <=> b.input_method
           AND a.formula_display <=> b.formula_display AND a.account_id <=> b.account_id
           AND a.description <=> b.description AND a.source_percent <=> b.source_percent
           AND a.enable_source_percent <=> b.enable_source_percent AND a.enable_input_method <=> b.enable_input_method
           AND a.updated_at <=> b.updated_at);
SELECT 'data_capture_formula changed' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 5. data_capture_draft (+ cells): drafts that are new or whose draft_json changed since the baseline.
-- =============================================================================
CREATE TEMPORARY TABLE _numbers_r (i INT PRIMARY KEY);
INSERT INTO _numbers_r (i)
SELECT t.n + o.n
FROM (SELECT 0 n UNION ALL SELECT 10 UNION ALL SELECT 20) t,
     (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) o
WHERE t.n + o.n <= 25;
CREATE TEMPORARY TABLE _numbers_c (i INT PRIMARY KEY);
INSERT INTO _numbers_c (i)
SELECT t.n + o.n
FROM (SELECT 0 n UNION ALL SELECT 10 UNION ALL SELECT 20) t,
     (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) o
WHERE t.n + o.n <= 20;

-- draft scope is keyed by COMPANY id or GROUP *code* (group_id is the group code string), like the original draft migration
CREATE TEMPORARY TABLE _map_tenant_draft (
    old_type      ENUM('COMPANY','GROUP') NOT NULL,
    old_id        VARCHAR(50) NOT NULL,
    new_tenant_id INT NOT NULL,
    PRIMARY KEY (old_type, old_id)
);
INSERT INTO _map_tenant_draft (old_type, old_id, new_tenant_id)
SELECT 'COMPANY', c.id, t.id FROM c168_net_legacy_20261007.company c
JOIN tenant t ON t.tenant_type = 'COMPANY' AND t.code = c.company_id;
INSERT INTO _map_tenant_draft (old_type, old_id, new_tenant_id)
SELECT 'GROUP', g.group_code, t.id FROM c168_net_legacy_20261007.groups g
JOIN tenant t ON t.tenant_type = 'GROUP' AND t.code = g.group_code;

CREATE TEMPORARY TABLE _resolve_draft (
    old_draft_id INT NOT NULL PRIMARY KEY,
    tenant_id    INT UNSIGNED,
    process_id   INT UNSIGNED,
    currency_id  INT UNSIGNED
);
INSERT INTO _resolve_draft (old_draft_id, tenant_id, process_id, currency_id)
SELECT
    d.id,
    mt.new_tenant_id,
    COALESCE(
        (SELECT COALESCE(pm.canonical_process_id, CAST(d.process_key AS UNSIGNED))
         FROM c168_net_legacy_20261007.process lp
         LEFT JOIN process_duplicate_merge_map pm ON pm.old_process_id = lp.id
         WHERE d.process_key REGEXP '^[0-9]+$' AND lp.id = CAST(d.process_key AS UNSIGNED)),
        (SELECT p.id FROM process p
         WHERE NOT (d.process_key REGEXP '^[0-9]+$')
           AND p.tenant_id = mt.new_tenant_id AND p.category = 'BANK' AND UPPER(p.code) = UPPER(d.process_key)
         LIMIT 1)
    ),
    mc.survivor_id
FROM c168_net_legacy_20261007.data_capture_draft d
JOIN _map_tenant_draft mt ON mt.old_type = UPPER(d.scope_type)
    AND mt.old_id COLLATE utf8mb4_unicode_ci = (CASE WHEN d.scope_type = 'company' THEN CAST(d.company_id AS CHAR) ELSE d.group_id END) COLLATE utf8mb4_unicode_ci
LEFT JOIN _map_currency mc ON mc.old_currency_id = d.currency_id;

CREATE TEMPORARY TABLE _draft_scope (id INT PRIMARY KEY);
INSERT INTO _draft_scope (id)
SELECT a.id
FROM c168_net_legacy_20261007.data_capture_draft a
JOIN _resolve_draft r ON r.old_draft_id = a.id AND r.process_id IS NOT NULL
LEFT JOIN c168_net_legacy_20260929.data_capture_draft b ON b.id = a.id
WHERE b.id IS NULL OR NOT (a.draft_json <=> b.draft_json);
SELECT 'drafts in scope (new or changed, resolvable)' AS step, COUNT(*) AS n FROM _draft_scope;

INSERT INTO data_capture_draft (id, tenant_id, process_id, currency_id, updated_at, created_at)
SELECT d.id, r.tenant_id, r.process_id, r.currency_id, d.updated_at, d.updated_at
FROM c168_net_legacy_20261007.data_capture_draft d
JOIN _draft_scope s ON s.id = d.id
JOIN _resolve_draft r ON r.old_draft_id = d.id
WHERE d.id NOT IN (SELECT id FROM data_capture_draft);
SELECT 'data_capture_draft inserted' AS step, ROW_COUNT() AS n;

UPDATE data_capture_draft x
JOIN c168_net_legacy_20261007.data_capture_draft d ON d.id = x.id
JOIN _draft_scope s ON s.id = d.id
JOIN _resolve_draft r ON r.old_draft_id = d.id
SET x.currency_id = r.currency_id, x.updated_at = d.updated_at;
SELECT 'data_capture_draft touched' AS step, ROW_COUNT() AS n;

DELETE c FROM data_capture_draft_cell c JOIN _draft_scope s ON s.id = c.draft_id;
SELECT 'draft cells deleted (to rebuild)' AS step, ROW_COUNT() AS n;

INSERT INTO data_capture_draft_cell (draft_id, row_index, col_index, cell_value, updated_at)
SELECT d.id, ridx.i, cidx.i + 1,
       JSON_UNQUOTE(JSON_EXTRACT(
           COALESCE(JSON_EXTRACT(d.draft_json, '$.rows'), JSON_EXTRACT(d.draft_json, '$.tableData.rows')),
           CONCAT('$[', ridx.i, '][', cidx.i + 1, '].value'))),
       d.updated_at
FROM c168_net_legacy_20261007.data_capture_draft d
JOIN _draft_scope s ON s.id = d.id
CROSS JOIN _numbers_r ridx
CROSS JOIN _numbers_c cidx
WHERE JSON_UNQUOTE(JSON_EXTRACT(
        COALESCE(JSON_EXTRACT(d.draft_json, '$.rows'), JSON_EXTRACT(d.draft_json, '$.tableData.rows')),
        CONCAT('$[', ridx.i, '][', cidx.i + 1, '].type'))) = 'data'
  AND JSON_UNQUOTE(JSON_EXTRACT(
        COALESCE(JSON_EXTRACT(d.draft_json, '$.rows'), JSON_EXTRACT(d.draft_json, '$.tableData.rows')),
        CONCAT('$[', ridx.i, '][', cidx.i + 1, '].value'))) IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(
        COALESCE(JSON_EXTRACT(d.draft_json, '$.rows'), JSON_EXTRACT(d.draft_json, '$.tableData.rows')),
        CONCAT('$[', ridx.i, '][', cidx.i + 1, '].value'))) != '';
SELECT 'draft cells inserted' AS step, ROW_COUNT() AS n;

-- =============================================================================
-- 6. process_submitted: new rows since the baseline (natural key incl. created_at), capture_id left NULL.
-- =============================================================================
INSERT INTO process_submitted (tenant_id, process_id, created_by, capture_date, created_at)
SELECT m.new_tenant_id, COALESCE(pdm.canonical_process_id, sp.process_id),
       CASE WHEN sp.user_type = 'owner' THEN ow.owner_code ELSE u.login_id END,
       sp.capture_date, sp.created_at
FROM c168_net_legacy_20261007.submitted_processes sp
JOIN _map_tenant m ON m.old_type = 'COMPANY' AND m.old_id = sp.company_id
LEFT JOIN owner ow ON ow.id = sp.user_id AND sp.user_type = 'owner'
LEFT JOIN user u ON u.id = sp.user_id AND sp.user_type = 'user'
LEFT JOIN process_duplicate_merge_map pdm ON pdm.old_process_id = sp.process_id
WHERE sp.id NOT IN (SELECT id FROM c168_net_legacy_20260929.submitted_processes)
  AND EXISTS (SELECT 1 FROM process pr WHERE pr.id = COALESCE(pdm.canonical_process_id, sp.process_id))
  AND NOT EXISTS (
      SELECT 1 FROM process_submitted x
      WHERE x.tenant_id = m.new_tenant_id AND x.process_id = COALESCE(pdm.canonical_process_id, sp.process_id)
        AND x.created_by <=> CASE WHEN sp.user_type = 'owner' THEN ow.owner_code ELSE u.login_id END
        AND x.capture_date <=> sp.capture_date AND x.created_at <=> sp.created_at
  );
SELECT 'process_submitted inserted' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _draft_scope;
DROP TEMPORARY TABLE _map_tenant_draft;
DROP TEMPORARY TABLE _resolve_draft;
DROP TEMPORARY TABLE _numbers_r;
DROP TEMPORARY TABLE _numbers_c;
DROP TEMPORARY TABLE _new_line;
DROP TEMPORARY TABLE _del_line;
DROP TEMPORARY TABLE _resolve_process;
DROP TEMPORARY TABLE _map_currency;
DROP TEMPORARY TABLE _map_tenant;

COMMIT;
