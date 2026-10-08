package com.eazycount.service;

import com.eazycount.dto.AccountingDueDTO;

import java.time.LocalDate;
import java.util.List;

public interface AccountingDueService {

    List<AccountingDueDTO> resolveInbox(Integer tenantId, LocalDate asOf, boolean restoreSkipped);

    void skipPeriods(List<AccountingDueDTO> items);

    /**
     * Called after a Bank Process status change was written ({@code bp} already carries the new status).
     * Entering INACTIVE decides {@code due_closed}; INACTIVE -> ACTIVE on a closed contract auto-skips past months
     * (1st / Monthly) or keeps Week / Day closed. See docs §31.
     */
    void onStatusChanged(com.eazycount.entity.BankProcess bp, com.eazycount.entity.BankProcess.Status oldStatus, String actor);

    /**
     * Post selected Accounting Due periods to {@code transactions}.
     * Supported: {@code FIRST_OF_EVERY_MONTH}, {@code MONTHLY}, {@code WEEK}, {@code DAY}, {@code ONCE}.
     *
     * @return number of transaction lines created
     */
    int postToTransaction(List<AccountingDueDTO> items);
}
