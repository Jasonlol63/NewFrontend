package com.eazycount.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Formula Maintenance row (view-only): one {@code data_capture_formula} config row per process. Hard delete only — no soft-delete fields. */
@Getter
@Setter
public class MaintenanceFormulaDTO {

    private Integer tenantId;
    private String process;
    private String category;
    private String q;

    // Delete request only: data_capture_formula.id values to hard-delete.
    private List<Integer> formulaIds;

    private Integer id;
    // Update request only: FK account.id (nullable — clears the row's account when null).
    private Integer accountId;
    private String productType;
    private String idProduct;
    private String parentIdProduct;
    private Integer formulaVariant;
    private BigDecimal subOrder;
    // Read-only: Capture row this formula is aligned to (Summary tells same-id_product rows apart by it).
    private Integer rowIndex;
    private String account;
    // Read-only join columns so callers (Summary) can build the "code [name]" display client-side.
    private String accountName;
    private String accountRole;
    // Read-only: data_capture_formula.currency_id — Summary needs the id (not just the code) to submit under the row's own currency.
    private Integer currencyId;
    private String currency;
    private String description;
    private String sourceColumns;
    private String columnsDisplay;
    private String formula;
    private String inputMethod;
    private String sourcePercent;
    private Boolean enableSourcePercent;
    private Boolean enableInputMethod;
    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
