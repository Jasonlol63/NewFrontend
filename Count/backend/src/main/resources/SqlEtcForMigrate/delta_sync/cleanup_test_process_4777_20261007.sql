-- One-off cleanup (local rehearsal, 2026-10-07, confirmed by the user): remove the new-system-only TEST process
-- (id 4777, tenant M1, code TEST, created by DEMO on 2026-09-30) together with everything hanging off it:
-- 2 data_captures (22467 empty, 22468 with 4 lines), the 4 transactions those lines generated, 4 formula rows,
-- 1 process_submitted row, 7 process_day rows, its description link and description 2170.
-- None of this exists in legacy. Guards: the process must still be M1/TEST/DEMO or nothing is deleted.
--
-- Usage: mysql -u root count_real < .../cleanup_test_process_4777_20261007.sql

START TRANSACTION;

CREATE TEMPORARY TABLE _del_txn (id BIGINT UNSIGNED PRIMARY KEY);
INSERT INTO _del_txn (id)
SELECT DISTINCT l.transaction_id
FROM data_capture_line l
JOIN data_captures dc ON dc.id = l.capture_id
JOIN process p ON p.id = dc.process_id
JOIN tenant t ON t.id = p.tenant_id
WHERE p.id = 4777 AND p.code = 'TEST' AND p.created_by = 'DEMO' AND t.code = 'M1'
  AND l.transaction_id IS NOT NULL;
SELECT 'transactions to delete' AS step, COUNT(*) AS n FROM _del_txn;

DELETE l FROM data_capture_line l
JOIN data_captures dc ON dc.id = l.capture_id
WHERE dc.process_id = 4777 AND EXISTS (SELECT 1 FROM process p WHERE p.id = 4777 AND p.code = 'TEST' AND p.created_by = 'DEMO');
SELECT 'data_capture_line deleted' AS step, ROW_COUNT() AS n;

DELETE t FROM transactions t JOIN _del_txn d ON d.id = t.id;
SELECT 'transactions deleted' AS step, ROW_COUNT() AS n;

DELETE FROM process_submitted WHERE process_id = 4777 AND created_by = 'DEMO';
SELECT 'process_submitted deleted' AS step, ROW_COUNT() AS n;

DELETE FROM data_capture_formula WHERE process_id = 4777 AND created_by = 'DEMO';
SELECT 'data_capture_formula deleted' AS step, ROW_COUNT() AS n;

DELETE FROM data_captures WHERE process_id = 4777 AND created_by = 'DEMO';
SELECT 'data_captures deleted' AS step, ROW_COUNT() AS n;

DELETE FROM process_day WHERE process_id = 4777;
SELECT 'process_day deleted' AS step, ROW_COUNT() AS n;

DELETE FROM user_tenant_process_access WHERE process_id = 4777;
SELECT 'process ACL entries deleted' AS step, ROW_COUNT() AS n;

DELETE FROM process_description_link WHERE process_id = 4777;
SELECT 'process_description_link deleted' AS step, ROW_COUNT() AS n;

DELETE FROM process WHERE id = 4777 AND code = 'TEST' AND created_by = 'DEMO';
SELECT 'process deleted' AS step, ROW_COUNT() AS n;

DELETE FROM process_description WHERE id = 2170 AND name = 'TEST'
  AND NOT EXISTS (SELECT 1 FROM process_description_link l WHERE l.description_id = 2170);
SELECT 'process_description deleted' AS step, ROW_COUNT() AS n;

DROP TEMPORARY TABLE _del_txn;
COMMIT;
