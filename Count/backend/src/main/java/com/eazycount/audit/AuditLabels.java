package com.eazycount.audit;

/**
 * Shared phrasing helpers for hand-written {@link AuditContext#captureSummary} calls — the
 * counterpart to {@link AuditSummaryDefaults} for call sites that need a name/identity only the
 * writing method already has in hand (e.g. an account's display name, a contract's card owner),
 * so they can't go through the generic before/after-snapshot fallback. Pure string formatting
 * only — no DAO access here, callers resolve their own values and pass them in.
 */
public final class AuditLabels {

    private AuditLabels() {
    }

    /** "创建新{label} {identifier}" — identifier omitted when blank. */
    public static String create(String label, String identifier) {
        return "创建新" + label + suffix(identifier);
    }

    /** "更新{label} {identifier} 状态" — identifier omitted when blank. */
    public static String updateStatus(String label, String identifier) {
        return "更新" + label + suffix(identifier) + " 状态";
    }

    /** "更新{label} {identifier}" + (" 的 " + diff, only when diff is present). */
    public static String updateWithDiff(String label, String identifier, String diff) {
        String base = "更新" + label + suffix(identifier);
        return diff == null || diff.isBlank() ? base : base + " 的 " + diff;
    }

    /** "GAME- {code}" / "BANK- {code}" — the category-prefix format shared by Data Capture and its Maintenance page. */
    public static String categoryProcess(boolean isGame, String code) {
        return (isGame ? "GAME" : "BANK") + "- " + code;
    }

    /**
     * "创建 {type}({currencyCode}) {fromName} → {toName}" — two-account transfers. No amount:
     * the point is which type of transaction moved money between which two accounts in what
     * currency, not the exact figure (that's in the expanded before/after panel already).
     */
    public static String transferTransaction(String type, String currencyCode, String fromName, String toName) {
        return "创建 " + type + "(" + currencyCode + ") " + fromName + " → " + toName;
    }

    /** "创建 {type}({currencyCode}) {accountName}" — single-account transactions (e.g. ADJUSTMENT). */
    public static String accountTransaction(String type, String currencyCode, String accountName) {
        return "创建 " + type + "(" + currencyCode + ") " + accountName;
    }

    /** "创建 RATE({fromCcy}→{toCcy}) {fromName} → {toName}" — the RATE trade's two legs share this. */
    public static String rateTransaction(String fromCcy, String toCcy, String fromName, String toName) {
        return "创建 RATE(" + fromCcy + "→" + toCcy + ") " + fromName + " → " + toName;
    }

    /** "创建 Middleman 抽成({currencyCode})" — the Rate-Mul commission leg. English business term, no Chinese doubling-up. */
    public static String middlemanRate(String currencyCode) {
        return "创建 Middleman 抽成(" + currencyCode + ")";
    }

    /** "创建 Middleman 手续费({currencyCode})" — the Fee leg. */
    public static String middlemanFee(String currencyCode) {
        return "创建 Middleman 手续费(" + currencyCode + ")";
    }

    /** "创建 Platform Fee({currencyCode})" */
    public static String platformFee(String currencyCode) {
        return "创建 Platform Fee(" + currencyCode + ")";
    }

    private static String suffix(String identifier) {
        return identifier == null || identifier.isBlank() ? "" : " " + identifier;
    }
}
