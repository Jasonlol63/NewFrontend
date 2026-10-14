package com.eazycount.util;

import java.util.concurrent.ThreadLocalRandom;

/*
 * transactions.group_id: every transaction created by one operation shares one id, so Maintenance can delete
 * the whole operation together. The prefix says which operation it was.
 */
public final class TransactionGroupId {

    public static final String RATE_PREFIX = "RG-";
    public static final String BANK_PROCESS_PREFIX = "BK-";
    public static final String DOMAIN_FEE_PREFIX = "DF-";

    private TransactionGroupId() {
    }

    public static String newRate() {
        return next(RATE_PREFIX);
    }

    public static String newBankProcess() {
        return next(BANK_PROCESS_PREFIX);
    }

    public static String newDomainFee() {
        return next(DOMAIN_FEE_PREFIX);
    }

    /** True for a group id made by a Bank Process posting (mirrors the SQL fragment {@code group_id LIKE 'BK-%'}). */
    public static boolean isBankProcess(String groupId) {
        return groupId != null && groupId.startsWith(BANK_PROCESS_PREFIX);
    }

    private static String next(String prefix) {
        return prefix + System.currentTimeMillis() + "-" + ThreadLocalRandom.current().nextInt(1000, 10000);
    }
}
