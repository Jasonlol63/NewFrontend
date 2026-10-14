package com.eazycount.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class MaintenanceBankProcessDTO {

    private Integer tenantId;

    private String dateFrom;
    private String dateTo;
    private String q;

    // List paging: rows per batch (default 100) and, after the first batch, the last row received —
    // created time (ISO), id and whether it was a soft-deleted row.
    private Integer limit;
    private String cursorCreatedAt;
    private Integer cursorId;
    private Boolean cursorDeleted;

    private List<String> currencyCodes;
    private List<Integer> transactionIds;

    private Integer id;
    private String transactionType;
    private LocalDateTime createdAt;
    private String toAccountCode;
    private String fromAccountCode;
    private BigDecimal amount;
    private String currencyCode;
    private String description;
    private String remark;
    private String approvalStatus;
    private String approvedBy;
    private LocalDateTime approvedAt;
    private String createdBy;

    private Boolean deleted;
    private String deletedBy;
    private LocalDateTime deletedAt;

    /** Rows created by one posting share a group id (BK-…); the page ticks them together. */
    private String groupId;

    private Integer bankProcessId;

    private String periodType;

    private LocalDate transactionDate;

    /** Which bank_process leg this row belongs to: BUY_PRICE, SELL_PRICE, PROFIT, PROFIT_SHARING (or null if unmatched). */
    private String chargeCategory;
}
