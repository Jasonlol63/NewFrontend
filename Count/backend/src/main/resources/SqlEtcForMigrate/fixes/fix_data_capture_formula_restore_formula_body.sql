-- One-off DATA CORRECTION (not raw migration): restores `data_capture_formula.formula` to the formula
-- BODY (the `$n` / `[idProduct,col]` reference expression) for the rows where the data-capture
-- migration wrote a frozen display snapshot instead.
--
-- Root cause (confirmed by comparing all 13,636 rows against the legacy table, not guessed):
-- `migrate_data_datacapture_from_legacy.sql` §3 does
--     data_capture_formula.formula   <-   legacy data_capture_templates.formula_display
-- and the column it replaced, `formula_operators`, was dropped on purpose (TABLE_MIGRATION.md §3.8:
-- "删除 formula_operators;formula 成为计算与展示唯一来源"). But `formula_display` is not a formula --
-- it is a RESOLVED SNAPSHOT the old PHP app rewrote at every capture, e.g. `2208.93*(0.155)`, while
-- `formula_operators` held the live body, e.g. `$12`. Measured: all 13,636 migrated rows are
-- byte-identical to the legacy `formula_display`, and 13,504 of them differ from the legacy
-- `formula_operators` that should have been copied.
--
-- Why the body (and not the display text) is the correct target -- verified against the new frontend:
--   * the display is composed at read time, not stored: `createFormulaDisplayFromExpression(body,
--     sourcePercent, enableSourcePercent)` (Count-Frontend/src/shared/formula/buildFormulaDisplay.js)
--     appends `*(<source>)`, and `expandDollarFormulaOperators`
--     (pages/datacapturesummary/formula/summaryTemplateSourceData.js) expands `$n` against the live
--     capture table -- so a stored snapshot shows stale numbers and never re-resolves.
--   * `source_percent` is an independent column in the new model ("Formula and Source are independent
--     columns, stored and shown separately", formulaMaintenanceLogic.js) and the maintenance edit box
--     holds the body only -- so the body must NOT carry the trailing `*(<percent>)`.
--   * the new app's own save path writes the same shape: `resolveFormulaOperatorsBodyForSave()`
--     ("includes row *0.90, excludes *(source)").
--
-- The body is copied VERBATIM from legacy `formula_operators`, no rewriting: the new frontend accepts
-- both the legacy `$n` refs (8,174 bare `$n` + 5,335 expressions like `$10+$7*$11`) and the bracketed
-- `[idProduct,col]` form (14 rows, handled by parseReferenceFormula).
--
-- Scope (all verified before writing this):
--   13,636 data_capture_formula rows; all 13,636 join to legacy data_capture_templates by id (the 178
--     legacy rows that were not migrated are the known merge/duplicate/NULL cases -- GAPS §7.3)
--   13,504 rows need the body restored: 13,459 `$`-ref rows + 14 bracket-ref rows + 31 no-ref rows
--     whose stored formula had the source percent baked in
--   132 rows already equal the legacy body -> excluded by the WHERE clause
--   0 rows were touched in the new app (created_by/updated_by all NULL) and 0 rows have a NULL/blank
--     formula -- nothing user-authored is overwritten
--
-- Idempotent: only rows that still differ are updated, so re-running is a no-op. Re-run after every
-- fresh legacy migration (same trap as the read_only backfill in MIGRATION_20260929_GAPS.md §13.3).
-- The previous value is recoverable from `c168_net_legacy_20260929.data_capture_templates.formula_display`
-- (same id).
--
-- Usage:
--   mysql -u root < backend/src/main/resources/SqlEtcForMigrate/fixes/fix_data_capture_formula_restore_formula_body.sql

USE count_real;

UPDATE data_capture_formula f
JOIN c168_net_legacy_20260929.data_capture_templates t ON t.id = f.id
SET f.formula = TRIM(t.formula_operators)
WHERE t.formula_operators IS NOT NULL
  AND TRIM(t.formula_operators) <> ''
  AND NOT (f.formula <=> TRIM(t.formula_operators));

-- Expected: 0 rows.
SELECT f.id, f.formula, t.formula_operators
FROM data_capture_formula f
JOIN c168_net_legacy_20260929.data_capture_templates t ON t.id = f.id
WHERE NOT (f.formula <=> TRIM(t.formula_operators));

-- Sanity after the update (measured on the 2026-09-29 run): 13,509 rows hold `$n` refs and 53 rows
-- hold bracketed `[idProduct,col]` refs -- 39 rows contain both, so the union of "has a live
-- reference" is 13,523. The bracketed figure is inclusive; only 14 rows carry a bracket WITHOUT any
-- `$`. The remaining 113 rows are legacy bodies referencing nothing at all, e.g. "(24127.07+3.00)+33".
SELECT
    SUM(formula LIKE '%$%') AS dollar_ref_rows,
    SUM(formula LIKE '%[%') AS bracket_ref_rows,
    COUNT(*)                AS total_rows
FROM data_capture_formula;
