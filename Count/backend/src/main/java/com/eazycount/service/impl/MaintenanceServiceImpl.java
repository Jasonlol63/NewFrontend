package com.eazycount.service.impl;

import com.eazycount.audit.AuditContext;
import com.eazycount.audit.AuditLabels;
import com.eazycount.audit.AuditSnapshots;
import com.eazycount.audit.Audited;
import com.eazycount.common.BusinessException;
import com.eazycount.dao.BankProcessResendDao;
import com.eazycount.dao.DataCaptureSummaryDao;
import com.eazycount.dao.MaintenanceDao;
import com.eazycount.dao.ProcessDao;
import com.eazycount.dao.TransactionRateDao;
import com.eazycount.dto.CursorPage;
import com.eazycount.dto.MaintenanceBankProcessDTO;
import com.eazycount.dto.MaintenanceCaptureDTO;
import com.eazycount.dto.MaintenanceFormulaDTO;
import com.eazycount.dto.MaintenancePaymentDTO;
import com.eazycount.dto.MaintenanceTransactionDTO;
import com.eazycount.entity.AuditLog;
import com.eazycount.entity.DataCapture;
import com.eazycount.entity.DataCaptureFormula;
import com.eazycount.entity.Process;
import com.eazycount.entity.Transaction;
import com.eazycount.security.SecurityUtils;
import com.eazycount.security.SessionUser;
import com.eazycount.service.MaintenanceService;
import com.eazycount.util.AccessControlUtils;
import com.eazycount.util.NormalizeUtils;
import com.eazycount.util.TransactionDateParse;
import com.eazycount.util.TransactionGroupId;
import com.eazycount.websocket.RealtimeDomain;
import com.eazycount.websocket.RealtimeEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MaintenanceServiceImpl implements MaintenanceService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "PAYMENT", "CLAIM", "CLEAR", "CONTRA", "RATE", "ADJUSTMENT", "PROFIT");

    private static final Set<String> BANK_PROCESS_MAINTENANCE_TYPES = Set.of("WIN", "LOSE");

    // Capture Maintenance loads in batches: 100 rows by default; a refresh may ask for as many as are already on screen.
    private static final int CAPTURE_PAGE_DEFAULT = 100;
    private static final int CAPTURE_PAGE_MAX = 2000;
    // Payment and Bank Process Maintenance load in batches of rows too.
    private static final int PAYMENT_PAGE_DEFAULT = 100;
    // Formula Maintenance pages by offset. After an edit or delete the page re-reads everything already loaded in one
    // request, hence the high cap (a tenant has a few thousand formulas at most).
    private static final int FORMULA_PAGE_DEFAULT = 100;
    private static final int FORMULA_PAGE_MAX = 10000;
    // Transaction Maintenance loads whole captures (about 6 lines each) per batch.
    private static final int TRANSACTION_PAGE_DEFAULT = 25;

    @Autowired
    private MaintenanceDao maintenanceDao;

    @Autowired
    private DataCaptureSummaryDao dataCaptureSummaryDao;

    @Autowired
    private ProcessDao processDao;

    @Autowired
    private TransactionRateDao transactionRateDao;

    @Autowired
    private BankProcessResendDao bankProcessResendDao;

    @Autowired
    private RealtimeEventPublisher realtimeEventPublisher;

    @Override
    public CursorPage<MaintenanceTransactionDTO> findMaintenanceTransactionsRows(MaintenanceTransactionDTO mt) {
        AccessControlUtils.requireLoggedIn();
        ProcessCategoryListQuery query = parseTransactionListQuery(mt);

        int batch = mt.getLimit() == null ? TRANSACTION_PAGE_DEFAULT : Math.max(1, Math.min(mt.getLimit(), CAPTURE_PAGE_MAX));
        boolean firstPage = mt.getCursorId() == null;
        LocalDateTime cursorCreatedAt = firstPage ? null : parseCursorTime(mt.getCursorCreatedAt());

        // Step 1: the next captures (one more than a batch tells whether there is another batch after this one).
        List<MaintenanceCaptureDTO> keys = new ArrayList<>(maintenanceDao.findTransactionCaptureKeys(
                query.tenantId(),
                query.dateFrom(),
                query.dateTo(),
                query.process(),
                query.category(),
                query.q(),
                cursorCreatedAt,
                mt.getCursorId(),
                batch + 1));
        Map<String, Object> nextCursor = null;
        if (keys.size() > batch) {
            keys = keys.subList(0, batch);
            MaintenanceCaptureDTO last = keys.get(batch - 1);
            nextCursor = new LinkedHashMap<>();
            nextCursor.put("createdAt", last.getDtsCreated().toString());
            nextCursor.put("id", last.getId());
        }

        // Step 2: just those captures' lines.
        List<MaintenanceTransactionDTO> rows = keys.isEmpty()
                ? List.of()
                : maintenanceDao.findTransactionLinesByCaptureIds(
                        query.tenantId(),
                        keys.stream().map(MaintenanceCaptureDTO::getId).toList(),
                        query.q());
        Long total = firstPage
                ? maintenanceDao.countTransactionLines(
                        query.tenantId(), query.dateFrom(), query.dateTo(), query.process(), query.category(), query.q())
                : null;
        return new CursorPage<>(rows, nextCursor, total);
    }

    private static LocalDateTime parseCursorTime(String raw) {
        try {
            return LocalDateTime.parse(raw);
        } catch (RuntimeException e) {
            throw new BusinessException("Invalid list cursor");
        }
    }

    @Override
    public CursorPage<MaintenanceCaptureDTO> findMaintenanceCaptureRows(MaintenanceCaptureDTO mc) {
        AccessControlUtils.requireLoggedIn();
        ProcessCategoryListQuery query = parseCaptureListQuery(mc);

        int pageSize = mc.getLimit() == null ? CAPTURE_PAGE_DEFAULT : Math.max(1, Math.min(mc.getLimit(), CAPTURE_PAGE_MAX));
        boolean firstPage = mc.getCursorId() == null;
        LocalDateTime cursorCreatedAt = firstPage ? null : parseCursorTime(mc.getCursorCreatedAt());
        Integer cursorSrc = Boolean.TRUE.equals(mc.getCursorDeleted()) ? 0 : 1;

        // One row more than asked tells whether there is a next batch.
        List<MaintenanceCaptureDTO> rows = new ArrayList<>(maintenanceDao.findCaptureMaintenancePage(
                query.tenantId(),
                query.dateFrom(),
                query.dateTo(),
                query.process(),
                query.category(),
                query.q(),
                cursorCreatedAt,
                mc.getCursorId(),
                cursorSrc,
                pageSize + 1));
        Map<String, Object> nextCursor = null;
        if (rows.size() > pageSize) {
            rows = rows.subList(0, pageSize);
            MaintenanceCaptureDTO last = rows.get(rows.size() - 1);
            nextCursor = new LinkedHashMap<>();
            nextCursor.put("createdAt", last.getDtsCreated().toString());
            nextCursor.put("id", last.getId());
            nextCursor.put("deleted", Boolean.TRUE.equals(last.getDeleted()));
        }
        Long total = firstPage
                ? maintenanceDao.countCaptureMaintenance(
                        query.tenantId(), query.dateFrom(), query.dateTo(), query.process(), query.category(), query.q())
                : null;
        return new CursorPage<>(rows, nextCursor, total);
    }

    // Capture Maintenance delete: unit is always the whole capture (data_captures.id) — the list is already
    // one row per capture, so `mc.captureIds` are exactly the ids to act on, no line-id resolution needed.
    @Override
    @Audited(module = "CAPTURE_MAINTENANCE", action = AuditLog.Action.DELETE, entityIdExpr = "#mc.captureIds", sourceTable = "data_capture_line")
    @Transactional
    public void deleteMaintenanceCaptureRows(MaintenanceCaptureDTO mc) {
        SessionUser session = requireWritableSession();
        Integer tenantId = mc != null ? mc.getTenantId() : null;
        AccessControlUtils.requireValidTenantId(tenantId);
        List<Integer> captureIds = requireIds(mc != null ? mc.getCaptureIds() : null);

        String deletedBy = session.login_id.trim();

        // Snapshot before archiving — same reasoning as deletePaymentMaintenanceRows: only this
        // method still has the pre-delete rows. One snapshot per capture (entityIdExpr resolves
        // per captureId), reusing captureSubmit()'s shape since this is effectively that
        // operation's inverse — a header plus a summary of the transactions it's linked to.
        Map<Integer, Object> beforeSnapshots = new LinkedHashMap<>();
        for (Integer captureId : captureIds) {
            DataCapture header = dataCaptureSummaryDao.findCaptureByIdAndTenantId(captureId, tenantId);
            List<Integer> captureTransactionIds =
                    maintenanceDao.findCaptureLineTransactionIdsByCaptureIdsAndTenantId(tenantId, List.of(captureId));
            BigDecimal total = captureTransactionIds.isEmpty()
                    ? BigDecimal.ZERO
                    : maintenanceDao.findByIdsAndTenantId(tenantId, captureTransactionIds).stream()
                            .map(Transaction::getAmount)
                            .filter(Objects::nonNull)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
            beforeSnapshots.put(captureId,
                    AuditSnapshots.captureSubmit(header, captureTransactionIds.size(), total, captureTransactionIds));
            AuditContext.captureSummary(captureId, "删除数据" + captureLabel(header, tenantId));
        }
        AuditContext.captureBeforeBatch(beforeSnapshots);

        List<Integer> transactionIds =
                maintenanceDao.findCaptureLineTransactionIdsByCaptureIdsAndTenantId(tenantId, captureIds);
        if (!transactionIds.isEmpty()) {
            int archivedTransactions =
                    maintenanceDao.archiveCaptureTransactionsToDeleted(tenantId, transactionIds, deletedBy);
            if (archivedTransactions <= 0) {
                throw new BusinessException("Failed to archive linked transactions");
            }
            maintenanceDao.deleteByIdsAndTenantId(tenantId, transactionIds);
        }

        int archivedLines = maintenanceDao.archiveCaptureLineMaintenanceToDeleted(tenantId, captureIds, deletedBy);
        if (archivedLines <= 0) {
            throw new BusinessException("Failed to archive capture maintenance records");
        }

        int removed = maintenanceDao.deleteCaptureLineMaintenanceByCaptureIds(tenantId, captureIds);
        if (removed <= 0) {
            throw new BusinessException("Failed to delete capture maintenance records");
        }

        maintenanceDao.deleteProcessSubmittedByCaptureIds(tenantId, captureIds);
        realtimeEventPublisher.publish(tenantId, RealtimeDomain.DATACAPTURE, "capture_delete");
    }

    /** "BANK- SALARY" / "GAME- {code}" — same category-prefix format as Data Capture Summary's own submit summary. */
    private String captureLabel(DataCapture header, Integer tenantId) {
        if (header == null) {
            return "抓取";
        }
        boolean isGame = header.getCategory() == DataCapture.Category.GAME;
        Process process = header.getProcessId() != null
                ? processDao.findProcessByIdAndTenantId(header.getProcessId(), tenantId)
                : null;
        String code = process != null && process.getCode() != null ? process.getCode() : "?";
        return AuditLabels.categoryProcess(isGame, code);
    }

    @Override
    public CursorPage<MaintenanceFormulaDTO> findMaintenanceFormulaRows(MaintenanceFormulaDTO mf) {
        AccessControlUtils.requireLoggedIn();
        FormulaListQuery query = parseFormulaListQuery(mf);

        int pageSize = mf.getLimit() == null ? FORMULA_PAGE_DEFAULT : Math.max(1, Math.min(mf.getLimit(), FORMULA_PAGE_MAX));
        int offset = mf.getCursorOffset() == null ? 0 : Math.max(0, mf.getCursorOffset());

        // One row more than asked tells whether there is a next batch.
        List<MaintenanceFormulaDTO> rows = new ArrayList<>(maintenanceDao.findFormulaMaintenancePage(
                query.tenantId(), query.process(), query.category(), query.q(), pageSize + 1, offset));
        Map<String, Object> nextCursor = null;
        if (rows.size() > pageSize) {
            rows = rows.subList(0, pageSize);
            nextCursor = new LinkedHashMap<>();
            nextCursor.put("offset", offset + pageSize);
        }
        Long total = offset == 0
                ? maintenanceDao.countFormulaMaintenance(query.tenantId(), query.process(), query.category(), query.q())
                : null;
        return new CursorPage<>(rows, nextCursor, total);
    }

    // Formula Maintenance Edit: only account_id/source_percent/input_method/formula/description are editable.
    // enable_source_percent/enable_input_method are left untouched; updated_at auto-refreshes (ON UPDATE CURRENT_TIMESTAMP).
    @Override
    @Audited(module = "FORMULA_MAINTENANCE", action = AuditLog.Action.UPDATE, entityIdExpr = "#ft.id", sourceTable = "data_capture_formula")
    @Transactional
    public void updateFormulaMaintenance(MaintenanceFormulaDTO ft) {
        SessionUser session = requireWritableSession();
        Integer tenantId = ft != null ? ft.getTenantId() : null;
        AccessControlUtils.requireValidTenantId(tenantId);
        int id = requireFormulaId(ft);

        Integer accountId = ft.getAccountId();
        String sourcePercent = normalizeSourcePercent(ft.getSourcePercent());
        String inputMethod = normalizeQ(ft.getInputMethod());
        String formula = normalizeQ(ft.getFormula());
        String description = NormalizeUtils.trimToEmpty(ft.getDescription());
        String updatedBy = session.login_id.trim();

        DataCaptureFormula before = dataCaptureSummaryDao.findByIdAndTenantId(id, tenantId);
        AuditContext.captureBefore(id, AuditSnapshots.formulaFull(before));

        int updated = maintenanceDao.updateFormulaMaintenanceRow(
                tenantId, id, accountId, sourcePercent, inputMethod, formula, description, updatedBy);
        if (updated <= 0) {
            throw new BusinessException("Formula maintenance record not found");
        }

        DataCaptureFormula after = dataCaptureSummaryDao.findByIdAndTenantId(id, tenantId);
        AuditContext.captureAfter(id, AuditSnapshots.formulaFull(after));

        // Copy From formula sync: one-way, root -> downstream only. A row's formula_group_id equals
        // its own id exactly when it's the group's root — editing the root mirrors onto every
        // downstream row in the group; editing a downstream row stays local so it never clobbers the
        // root or its siblings. Delete is deliberately NOT synced either way — each process only ever
        // removes its own row.
        Integer groupId = dataCaptureSummaryDao.findFormulaGroupIdByIdAndTenantId(tenantId, id);
        if (groupId != null && groupId.equals(id)) {
            dataCaptureSummaryDao.propagateFormulaGroupUpdate(
                    tenantId, groupId, id, accountId, sourcePercent, inputMethod, formula, description, updatedBy);
        }
    }

    // Formula Maintenance Delete: hard delete, batch by id, tenant-scoped — no archive/soft-delete.
    @Override
    @Audited(module = "FORMULA_MAINTENANCE", action = AuditLog.Action.DELETE, entityIdExpr = "#ft.formulaIds", sourceTable = "data_capture_formula")
    @Transactional
    public void deleteFormulaMaintenance(MaintenanceFormulaDTO ft) {
        requireWritableSession();
        Integer tenantId = ft != null ? ft.getTenantId() : null;
        AccessControlUtils.requireValidTenantId(tenantId);
        List<Integer> ids = requireIds(ft != null ? ft.getFormulaIds() : null);

        Map<Integer, Object> beforeSnapshots = new LinkedHashMap<>();
        for (Integer id : ids) {
            beforeSnapshots.put(id, AuditSnapshots.formulaFull(dataCaptureSummaryDao.findByIdAndTenantId(id, tenantId)));
        }
        AuditContext.captureBeforeBatch(beforeSnapshots);

        int removed = maintenanceDao.deleteFormulaMaintenanceRows(tenantId, ids);
        if (removed <= 0) {
            throw new BusinessException("No matching formula maintenance records to delete");
        }
    }

    @Override
    public CursorPage<MaintenancePaymentDTO> findPaymentMaintenanceRows(MaintenancePaymentDTO request) {
        AccessControlUtils.requireLoggedIn();
        ListQuery query = parseListQuery(request);

        int pageSize = request.getLimit() == null ? PAYMENT_PAGE_DEFAULT : Math.max(1, Math.min(request.getLimit(), CAPTURE_PAGE_MAX));
        boolean firstPage = request.getCursorId() == null;
        LocalDateTime cursorCreatedAt = firstPage ? null : parseCursorTime(request.getCursorCreatedAt());
        Integer cursorSrc = Boolean.TRUE.equals(request.getCursorDeleted()) ? 0 : 1;

        // One row more than asked tells whether there is a next batch.
        List<MaintenancePaymentDTO> rows = new ArrayList<>(maintenanceDao.findPaymentMaintenancePage(
                query.tenantId(),
                query.dateFrom(),
                query.dateTo(),
                query.transactionType(),
                query.currencyCodes(),
                query.q(),
                cursorCreatedAt,
                request.getCursorId(),
                cursorSrc,
                pageSize + 1));
        Map<String, Object> nextCursor = null;
        if (rows.size() > pageSize) {
            rows = rows.subList(0, pageSize);
            MaintenancePaymentDTO last = rows.get(rows.size() - 1);
            nextCursor = new LinkedHashMap<>();
            nextCursor.put("createdAt", last.getCreatedAt().toString());
            nextCursor.put("id", last.getId());
            nextCursor.put("deleted", Boolean.TRUE.equals(last.getDeleted()));
        }
        Long total = firstPage
                ? maintenanceDao.countPaymentMaintenance(
                        query.tenantId(), query.dateFrom(), query.dateTo(), query.transactionType(), query.currencyCodes(), query.q())
                : null;
        return new CursorPage<>(rows, nextCursor, total);
    }

    @Override
    public CursorPage<MaintenanceBankProcessDTO> findBankProcessMaintenanceRows(MaintenanceBankProcessDTO request) {
        AccessControlUtils.requireLoggedIn();
        ListQuery query = parseBankProcessListQuery(request);

        int pageSize = request.getLimit() == null ? PAYMENT_PAGE_DEFAULT : Math.max(1, Math.min(request.getLimit(), CAPTURE_PAGE_MAX));
        boolean firstPage = request.getCursorId() == null;
        LocalDateTime cursorCreatedAt = firstPage ? null : parseCursorTime(request.getCursorCreatedAt());
        Integer cursorSrc = Boolean.TRUE.equals(request.getCursorDeleted()) ? 0 : 1;

        // One row more than asked tells whether there is a next batch.
        List<MaintenanceBankProcessDTO> rows = new ArrayList<>(maintenanceDao.findBankProcessMaintenancePage(
                query.tenantId(),
                query.dateFrom(),
                query.dateTo(),
                query.currencyCodes(),
                query.q(),
                cursorCreatedAt,
                request.getCursorId(),
                cursorSrc,
                pageSize + 1));
        Map<String, Object> nextCursor = null;
        if (rows.size() > pageSize) {
            rows = rows.subList(0, pageSize);
            MaintenanceBankProcessDTO last = rows.get(rows.size() - 1);
            nextCursor = new LinkedHashMap<>();
            nextCursor.put("createdAt", last.getCreatedAt().toString());
            nextCursor.put("id", last.getId());
            nextCursor.put("deleted", Boolean.TRUE.equals(last.getDeleted()));
        }
        Long total = firstPage
                ? maintenanceDao.countBankProcessMaintenance(
                        query.tenantId(), query.dateFrom(), query.dateTo(), query.currencyCodes(), query.q())
                : null;
        return new CursorPage<>(rows, nextCursor, total);
    }

    @Override
    @Audited(module = "PAYMENT_MAINTENANCE", action = AuditLog.Action.DELETE, entityIdExpr = "#result", sourceTable = "transactions")
    @Transactional
    public List<Integer> deletePaymentMaintenanceRows(
            MaintenancePaymentDTO request) {
        SessionUser session = requireWritableSession();
        Integer tenantId = request != null ? request.getTenantId() : null;
        AccessControlUtils.requireValidTenantId(tenantId);
        List<Integer> requestedIds = requireIds(request != null ? request.getTransactionIds() : null);

        DeletableBatch batch = resolveDeletableBatch(tenantId, requestedIds);
        if (batch.ids().isEmpty()) {
            throw new BusinessException("No matching payment maintenance records to delete");
        }

        // Snapshot before archiving — this is the only place that still has the pre-delete rows;
        // @Audited's aspect can't see them from outside the method. Field names match the
        // `transactions` DB columns (not this entity's Java property names) so the audit log's
        // before_data can be used directly for manual DB recovery — see docs/it-role-audit-log.md.
        List<Transaction> rowsBeingDeleted = maintenanceDao.findByIdsAndTenantId(tenantId, batch.ids());
        Map<Integer, Object> beforeSnapshots = new LinkedHashMap<>();
        for (Transaction row : rowsBeingDeleted) {
            beforeSnapshots.put(row.getId(), AuditSnapshots.transaction(row));
        }
        AuditContext.captureBeforeBatch(beforeSnapshots);

        String deletedBy = session.login_id.trim();
        int archived = maintenanceDao.archivePaymentMaintenanceToDeleted(
                tenantId, batch.ids(), deletedBy);
        // Every row about to be deleted must have been archived; otherwise roll the whole delete back.
        if (archived != batch.ids().size()) {
            throw new BusinessException("Failed to archive payment maintenance records");
        }

        // transactions_rate only has rows for Rate groups; other group ids simply match nothing.
        if (!batch.groupIds().isEmpty()) {
            transactionRateDao.deleteByTenantIdAndGroupIds(tenantId, batch.groupIds());
        }

        int removed = maintenanceDao.deleteByIdsAndTenantId(tenantId, batch.ids());
        if (removed <= 0) {
            throw new BusinessException("Failed to delete payment maintenance records");
        }

        realtimeEventPublisher.publish(tenantId, RealtimeDomain.MAINTENANCE, "payment_delete");
        return batch.ids();
    }

    @Override
    @Audited(module = "BANK_PROCESS_MAINTENANCE", action = AuditLog.Action.DELETE, entityIdExpr = "#result", sourceTable = "transactions")
    @Transactional
    public List<Integer> deleteBankProcessMaintenanceRows(
            MaintenanceBankProcessDTO request) {
        SessionUser session = requireWritableSession();
        Integer tenantId = request != null ? request.getTenantId() : null;
        AccessControlUtils.requireValidTenantId(tenantId);
        List<Integer> requestedIds = requireIds(request != null ? request.getTransactionIds() : null);

        BankProcessDeletableBatch batch = resolveBankProcessDeletableBatch(tenantId, requestedIds);
        if (batch.ids().isEmpty()) {
            throw new BusinessException("No matching bank process maintenance records to delete");
        }

        // Snapshot before archiving — same reasoning as deletePaymentMaintenanceRows: only this
        // method still has the pre-delete rows, and field names match the `transactions` DB
        // columns (not this entity's Java property names) for manual-recovery use.
        List<Transaction> rowsBeingDeleted = maintenanceDao.findByIdsAndTenantId(tenantId, batch.ids());
        Map<Integer, String> cardOwnerByTransactionId = maintenanceDao
                .findBankProcessCardOwnersByTransactionIds(tenantId, batch.ids()).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row.get("id")).intValue(),
                        row -> String.valueOf(row.get("cardOwner"))));
        Map<Integer, Object> beforeSnapshots = new LinkedHashMap<>();
        for (Transaction row : rowsBeingDeleted) {
            beforeSnapshots.put(row.getId(), AuditSnapshots.transaction(row));
            String cardOwner = cardOwnerByTransactionId.getOrDefault(row.getId(), "?");
            AuditContext.captureSummary(row.getId(), "删除" + cardOwner + "合同交易");
        }
        AuditContext.captureBeforeBatch(beforeSnapshots);

        String deletedBy = session.login_id.trim();
        int archived = maintenanceDao.archiveBankProcessMaintenanceToDeleted(
                tenantId, batch.ids(), deletedBy);
        if (archived != batch.ids().size()) {
            throw new BusinessException("Failed to archive bank process maintenance records");
        }

        if (!batch.bankProcessIds().isEmpty()) {
            bankProcessResendDao.deleteDailyGuardByTenantAndBankProcessIds(
                    tenantId, batch.bankProcessIds());
        }

        int removed = maintenanceDao.deleteByIdsAndTenantId(tenantId, batch.ids());
        if (removed <= 0) {
            throw new BusinessException("Failed to delete bank process maintenance records");
        }

        realtimeEventPublisher.publish(tenantId, RealtimeDomain.MAINTENANCE, "bankprocess_delete");
        return batch.ids();
    }

    private BankProcessDeletableBatch resolveBankProcessDeletableBatch(
            int tenantId, List<Integer> requestedIds) {
        List<Transaction> selected = maintenanceDao.findByIdsAndTenantId(tenantId, requestedIds);
        List<Integer> ids = filterBankProcessDeletableIds(selected);
        if (ids.isEmpty()) {
            return new BankProcessDeletableBatch(List.of(), List.of());
        }

        // One posting = one group: deleting any of its lines (Buy / Sell / Profit / Profit Sharing) takes the rest along.
        List<String> groupIds = groupIdsFrom(selected, ids);
        if (!groupIds.isEmpty()) {
            Set<Integer> expanded = new LinkedHashSet<>(ids);
            expanded.addAll(
                    maintenanceDao.findBankProcessMaintenanceIdsByGroupIds(tenantId, groupIds));
            ids = new ArrayList<>(expanded);
        }

        List<Integer> bankProcessIds =
                maintenanceDao.findBankProcessIdsByTransactionIds(tenantId, ids);
        return new BankProcessDeletableBatch(ids, bankProcessIds);
    }

    private static List<Integer> filterBankProcessDeletableIds(List<Transaction> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = new ArrayList<>();
        for (Transaction row : rows) {
            if (row == null || row.getId() == null || row.getId() <= 0) {
                continue;
            }
            if (!TransactionGroupId.isBankProcess(row.getGroupId())) {
                continue;
            }
            Transaction.TransactionType type = row.getTransactionType();
            if (type == null || !BANK_PROCESS_MAINTENANCE_TYPES.contains(type.name())) {
                continue;
            }
            if (row.getApprovalStatus() != Transaction.ApprovalStatus.APPROVED) {
                continue;
            }
            ids.add(row.getId());
        }
        return ids;
    }

    /** The distinct group ids of the given transactions (RG- Rate, BK- Bank Process, DF- Domain fee); singles have none. */
    private static List<String> groupIdsFrom(List<Transaction> rows, List<Integer> ids) {
        if (rows == null || rows.isEmpty() || ids == null || ids.isEmpty()) {
            return List.of();
        }
        Set<Integer> idSet = new LinkedHashSet<>(ids);
        Set<String> groupIds = new LinkedHashSet<>();
        for (Transaction row : rows) {
            if (row == null || row.getId() == null || !idSet.contains(row.getId())) {
                continue;
            }
            String groupId = NormalizeUtils.trimToNull(row.getGroupId());
            if (groupId != null) {
                groupIds.add(groupId);
            }
        }
        return new ArrayList<>(groupIds);
    }

    private DeletableBatch resolveDeletableBatch(int tenantId, List<Integer> requestedIds) {
        List<Transaction> selected = maintenanceDao.findByIdsAndTenantId(tenantId, requestedIds);
        List<Integer> ids = filterDeletableIds(selected);
        if (ids.isEmpty()) {
            return new DeletableBatch(List.of(), List.of());
        }

        // One Rate (both currencies, Middle-Man, fees) or one Domain charge (fee, commissions, net profit) = one group.
        List<String> groupIds = groupIdsFrom(selected, ids);
        if (!groupIds.isEmpty()) {
            Set<Integer> expanded = new LinkedHashSet<>(ids);
            expanded.addAll(maintenanceDao.findPaymentMaintenanceIdsByGroupIds(tenantId, groupIds));
            ids = new ArrayList<>(expanded);
        }

        return new DeletableBatch(ids, groupIds);
    }

    private static List<Integer> filterDeletableIds(List<Transaction> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = new ArrayList<>();
        for (Transaction row : rows) {
            if (row == null || row.getId() == null || row.getId() <= 0) {
                continue;
            }
            if (TransactionGroupId.isBankProcess(row.getGroupId())) {
                continue;
            }
            Transaction.TransactionType type = row.getTransactionType();
            if (type == null || !ALLOWED_TYPES.contains(type.name())) {
                continue;
            }
            ids.add(row.getId());
        }
        return ids;
    }

    private static DateRangeTenantQuery parseDateRangeTenantQuery(
            Integer tenantId, String dateFromRaw, String dateToRaw) {
        AccessControlUtils.requireValidTenantId(tenantId);
        int validTenantId = tenantId;
        LocalDate dateFrom = TransactionDateParse.parseRequired(dateFromRaw, "dateFrom");
        LocalDate dateTo = TransactionDateParse.parseRequired(dateToRaw, "dateTo");
        if (dateTo.isBefore(dateFrom)) {
            throw new BusinessException("dateTo must be on or after dateFrom");
        }
        return new DateRangeTenantQuery(validTenantId, dateFrom, dateTo);
    }

    private static ListQuery parseListQuery(MaintenancePaymentDTO request) {
        DateRangeTenantQuery base = parseDateRangeTenantQuery(
                request != null ? request.getTenantId() : null,
                request != null ? request.getDateFrom() : null,
                request != null ? request.getDateTo() : null);
        return new ListQuery(
                base.tenantId(),
                base.dateFrom(),
                base.dateTo(),
                normalizeType(request.getTransactionType()),
                NormalizeUtils.normalizeUpperList(request.getCurrencyCodes()),
                normalizeQ(request.getQ()));
    }

    private static ListQuery parseBankProcessListQuery(
            MaintenanceBankProcessDTO request) {
        DateRangeTenantQuery base = parseDateRangeTenantQuery(
                request != null ? request.getTenantId() : null,
                request != null ? request.getDateFrom() : null,
                request != null ? request.getDateTo() : null);
        return new ListQuery(
                base.tenantId(),
                base.dateFrom(),
                base.dateTo(),
                null,
                NormalizeUtils.normalizeUpperList(request.getCurrencyCodes()),
                normalizeQ(request.getQ()));
    }

    private static ProcessCategoryListQuery parseTransactionListQuery(MaintenanceTransactionDTO request) {
        DateRangeTenantQuery base = parseDateRangeTenantQuery(
                request != null ? request.getTenantId() : null,
                request != null ? request.getDateFrom() : null,
                request != null ? request.getDateTo() : null);
        return new ProcessCategoryListQuery(
                base.tenantId(),
                base.dateFrom(),
                base.dateTo(),
                normalizeQ(request.getProcess()),
                normalizeMaintenanceCategory(request.getCategory()),
                normalizeQ(request.getQ()));
    }

    private static ProcessCategoryListQuery parseCaptureListQuery(MaintenanceCaptureDTO request) {
        DateRangeTenantQuery base = parseDateRangeTenantQuery(
                request != null ? request.getTenantId() : null,
                request != null ? request.getDateFrom() : null,
                request != null ? request.getDateTo() : null);
        return new ProcessCategoryListQuery(
                base.tenantId(),
                base.dateFrom(),
                base.dateTo(),
                normalizeQ(request.getProcess()),
                normalizeMaintenanceCategory(request.getCategory()),
                normalizeQ(request.getQ()));
    }

    private static FormulaListQuery parseFormulaListQuery(MaintenanceFormulaDTO request) {
        Integer tenantId = request != null ? request.getTenantId() : null;
        AccessControlUtils.requireValidTenantId(tenantId);
        return new FormulaListQuery(
                tenantId,
                normalizeQ(request.getProcess()),
                normalizeMaintenanceCategory(request.getCategory()),
                normalizeQ(request.getQ()));
    }

    private static String normalizeMaintenanceCategory(String raw) {
        String category = NormalizeUtils.trimToNull(raw);
        if (category == null) {
            throw new BusinessException("category is required");
        }
        String lower = category.toLowerCase(Locale.ROOT);
        return switch (lower) {
            case "games" -> "GAME";
            case "bank"  -> "BANK";
            default -> throw new BusinessException("Unsupported category: " + category);
        };
    }

    private static SessionUser requireWritableSession() {
        SessionUser session = SecurityUtils.currentUser();
        AccessControlUtils.requireWritable(session);
        if (session.login_id == null || session.login_id.isBlank()) {
            throw new BusinessException("Invalid session login id");
        }
        return session;
    }

    private static List<Integer> requireIds(List<Integer> raw) {
        List<Integer> ids = NormalizeUtils.normalizeIds(raw);
        if (ids.isEmpty()) {
            throw new BusinessException("Please select at least one record");
        }
        return ids;
    }

    private static int requireFormulaId(MaintenanceFormulaDTO request) {
        if (request == null || request.getId() == null || request.getId() <= 0) {
            throw new BusinessException("Invalid formula id");
        }
        return request.getId();
    }

    // data_capture_formula.source_percent is NOT NULL DEFAULT '0'; a blank edit falls back to that default.
    private static String normalizeSourcePercent(String raw) {
        String trimmed = NormalizeUtils.trimToNull(raw);
        return trimmed != null ? trimmed : "0";
    }

    private record DateRangeTenantQuery(Integer tenantId, LocalDate dateFrom, LocalDate dateTo) {}

    private record ListQuery(
            Integer tenantId,
            LocalDate dateFrom,
            LocalDate dateTo,
            String transactionType,
            List<String> currencyCodes,
            String q) {}

    private record ProcessCategoryListQuery(
            Integer tenantId,
            LocalDate dateFrom,
            LocalDate dateTo,
            String process,
            String category,
            String q) {}

    private record FormulaListQuery(
            Integer tenantId,
            String process,
            String category,
            String q) {}

    private record DeletableBatch(List<Integer> ids, List<String> groupIds) {}

    private record BankProcessDeletableBatch(List<Integer> ids, List<Integer> bankProcessIds) {}

    private static String normalizeType(String raw) {
        if (raw == null) {
            return null;
        }
        String type = raw.trim().toUpperCase(Locale.ROOT);
        if (type.isEmpty()) {
            return null;
        }
        if (!ALLOWED_TYPES.contains(type)) {
            throw new BusinessException("Unsupported transaction type: " + type);
        }
        return type;
    }

    private static String normalizeQ(String raw) {
        if (raw == null) {
            return null;
        }
        String q = raw.trim();
        return q.isEmpty() ? null : q;
    }

}
