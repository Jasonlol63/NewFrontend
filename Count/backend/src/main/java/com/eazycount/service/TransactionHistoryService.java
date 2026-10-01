package com.eazycount.service;

import com.eazycount.dto.TransactionHistoryRequest;
import com.eazycount.dto.TransactionHistoryResult;

public interface TransactionHistoryService {

    /**
     * Payment History list for one account: Bank Process (Win/Loss) + Domain Payment (Cr/Dr).
     * Admin view — full descriptions.
     */
    default TransactionHistoryResult historyList(TransactionHistoryRequest request) {
        return historyList(request, false);
    }

    /**
     * @param memberView true only for the Member page: manual PAYMENT / CLAIM descriptions are shown as
     *                   "PAYMENT SETTLEMENT" / "CLAIM SETTLEMENT" (no counterparty account). Set server-side, never from the client.
     */
    TransactionHistoryResult historyList(TransactionHistoryRequest request, boolean memberView);
}
