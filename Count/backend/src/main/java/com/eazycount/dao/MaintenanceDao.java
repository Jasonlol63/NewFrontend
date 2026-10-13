package com.eazycount.dao;

import com.eazycount.dto.MaintenanceBankProcessDTO;
import com.eazycount.dto.MaintenanceCaptureDTO;
import com.eazycount.dto.MaintenanceFormulaDTO;
import com.eazycount.dto.MaintenancePaymentDTO;
import com.eazycount.dto.MaintenanceTransactionDTO;
import com.eazycount.entity.Transaction;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Payment Maintenance + Bank Process Maintenance (list/archive/delete); backs {@code MaintenanceServiceImpl}. */
@Mapper
public interface MaintenanceDao {

    List<Transaction> findByIdsAndTenantId(@Param("tenantId") Integer tenantId, @Param("ids") List<Integer> ids);

    int deleteByIdsAndTenantId(@Param("tenantId") Integer tenantId, @Param("ids") List<Integer> ids);

    // Archive live payment-maintenance lines into transactions_deleted; caller then deletes from transactions.
    int archivePaymentMaintenanceToDeleted(
            @Param("tenantId") Integer tenantId,
            @Param("ids") List<Integer> ids,
            @Param("deletedBy") String deletedBy);

    // Archive live posted WIN/LOSE bank-process-maintenance lines into transactions_deleted.
    int archiveBankProcessMaintenanceToDeleted(
            @Param("tenantId") Integer tenantId,
            @Param("ids") List<Integer> ids,
            @Param("deletedBy") String deletedBy);

    // Deletable Bank Process Maintenance ids sharing any of the given posted ids.
    List<Integer> findBankProcessMaintenanceIdsByPostedIds(
            @Param("tenantId") Integer tenantId,
            @Param("postedIds") List<Integer> postedIds);

    // Distinct bank_process.id for live maintenance transaction ids being deleted.
    List<Integer> findBankProcessIdsByTransactionIds(
            @Param("tenantId") Integer tenantId,
            @Param("ids") List<Integer> ids);

    // Each transaction id's own bank_process.card_owner (a batch can span several contracts) — for delete-audit summaries.
    List<Map<String, Object>> findBankProcessCardOwnersByTransactionIds(
            @Param("tenantId") Integer tenantId,
            @Param("ids") List<Integer> ids);

    // Deletable Payment Maintenance ids sharing any of the given RATE group ids.
    List<Integer> findPaymentMaintenanceIdsByRateGroupIds(
            @Param("tenantId") Integer tenantId,
            @Param("rateGroupIds") List<String> rateGroupIds);

    // Payment Maintenance, one page (keyset): live bill lines (manual/Domain/Renew) + soft-deleted ones, newest first.
    // cursorId == null is the first page; otherwise the three cursor values are the last row of the previous page
    // (cursorSrc 1 = live, 0 = soft-deleted). Returns at most `limit` rows.
    List<MaintenancePaymentDTO> findPaymentMaintenancePage(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("transactionType") String transactionType,
            @Param("currencyCodes") List<String> currencyCodes,
            @Param("q") String q,
            @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
            @Param("cursorId") Integer cursorId,
            @Param("cursorSrc") Integer cursorSrc,
            @Param("limit") int limit);

    // How many rows the Payment Maintenance list holds in total under the same filters.
    long countPaymentMaintenance(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("transactionType") String transactionType,
            @Param("currencyCodes") List<String> currencyCodes,
            @Param("q") String q);

    // Bank Process Maintenance, one page (keyset): live lines (posted WIN/LOSE) + soft-deleted ones, newest first.
    // cursorId == null is the first page; otherwise the three cursor values are the last row of the previous page
    // (cursorSrc 1 = live, 0 = soft-deleted). Returns at most `limit` rows.
    List<MaintenanceBankProcessDTO> findBankProcessMaintenancePage(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("currencyCodes") List<String> currencyCodes,
            @Param("q") String q,
            @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
            @Param("cursorId") Integer cursorId,
            @Param("cursorSrc") Integer cursorSrc,
            @Param("limit") int limit);

    // How many rows the Bank Process Maintenance list holds in total under the same filters.
    long countBankProcessMaintenance(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("currencyCodes") List<String> currencyCodes,
            @Param("q") String q);

    // Transaction Maintenance (view-only), in batches of whole captures, one category (GAME/BANK) at a time:
    // 1) the next captures (id + created_at) with a line matching `q`, newest first, after the cursor (cursorId == null: from the top);
    List<MaintenanceCaptureDTO> findTransactionCaptureKeys(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("process") String process,
            @Param("category") String category,
            @Param("q") String q,
            @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
            @Param("cursorId") Integer cursorId,
            @Param("limit") int limit);

    // 2) the lines of those captures that match `q`, in list order;
    List<MaintenanceTransactionDTO> findTransactionLinesByCaptureIds(
            @Param("tenantId") Integer tenantId,
            @Param("captureIds") List<Integer> captureIds,
            @Param("q") String q);

    // 3) how many lines the list holds in total under the same filters.
    long countTransactionLines(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("process") String process,
            @Param("category") String category,
            @Param("q") String q);

    // Capture Maintenance, one page (keyset): live + archived captures, newest first, one category (GAME/BANK) at a time.
    // cursorId == null is the first page; otherwise the three cursor values are the last row of the previous page
    // (cursorSrc 1 = live, 0 = archived). Returns at most `limit` rows.
    List<MaintenanceCaptureDTO> findCaptureMaintenancePage(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("process") String process,
            @Param("category") String category,
            @Param("q") String q,
            @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
            @Param("cursorId") Integer cursorId,
            @Param("cursorSrc") Integer cursorSrc,
            @Param("limit") int limit);

    // How many rows the list holds in total under the same filters.
    long countCaptureMaintenance(
            @Param("tenantId") Integer tenantId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("process") String process,
            @Param("category") String category,
            @Param("q") String q);


    // transaction_id of every live line under the given captures (non-null only) — what to cascade-archive.
    List<Integer> findCaptureLineTransactionIdsByCaptureIdsAndTenantId(
            @Param("tenantId") Integer tenantId,
            @Param("captureIds") List<Integer> captureIds);

    // Archive the WIN/LOSE transactions those lines generated into transactions_deleted
    int archiveCaptureTransactionsToDeleted(
            @Param("tenantId") Integer tenantId,
            @Param("ids") List<Integer> ids,
            @Param("deletedBy") String deletedBy);

    // Archive every live line under the given captures into data_capture_line_deleted.
    int archiveCaptureLineMaintenanceToDeleted(
            @Param("tenantId") Integer tenantId,
            @Param("captureIds") List<Integer> captureIds,
            @Param("deletedBy") String deletedBy);

    // Hard delete every line under the given captures from data_capture_line (post-archive).
    int deleteCaptureLineMaintenanceByCaptureIds(
            @Param("tenantId") Integer tenantId,
            @Param("captureIds") List<Integer> captureIds);

    // Drop the "already submitted" marker for fully-deleted captures
    int deleteProcessSubmittedByCaptureIds(
            @Param("tenantId") Integer tenantId,
            @Param("captureIds") List<Integer> captureIds);

    // Formula Maintenance (view-only): every data_capture_formula row for one process, one category (GAME/BANK) at a time.
    List<MaintenanceFormulaDTO> findFormulaMaintenanceRows(
            @Param("tenantId") Integer tenantId,
            @Param("process") String process,
            @Param("category") String category,
            @Param("q") String q);

    // Formula Maintenance Edit: only account_id/source_percent/input_method/formula/description are editable.
    int updateFormulaMaintenanceRow(
            @Param("tenantId") Integer tenantId,
            @Param("id") Integer id,
            @Param("accountId") Integer accountId,
            @Param("sourcePercent") String sourcePercent,
            @Param("inputMethod") String inputMethod,
            @Param("formula") String formula,
            @Param("description") String description,
            @Param("updatedBy") String updatedBy);

    // Formula Maintenance Delete: hard delete, batch by id, tenant-scoped (no soft-delete/archive).
    int deleteFormulaMaintenanceRows(
            @Param("tenantId") Integer tenantId,
            @Param("ids") List<Integer> ids);
}
