package com.eazycount.util;

import java.util.Set;

// Shared between ExchangeRateSyncJob (daily cron) and ExchangeRateServiceImpl (on-demand
// /api/fx/rates lookups) so both treat the same codes the same way.
public final class FxCryptoCodes {

    // Pegged ~1:1 to USD — Frankfurter has no fiat rate for these, so both call sites write/read
    // rate_to_usd = 1 directly instead of asking the external API.
    public static final Set<String> STABLECOINS = Set.of("USDT", "USDC");

    // Not fiat and not pegged 1:1 — Frankfurter has no rate for these at all, so on-demand lookups
    // mark them unsupported immediately instead of spending a request finding that out. (The daily
    // cron doesn't special-case these; a bad request just fails and is skipped, same net effect.)
    public static final Set<String> UNSUPPORTED = Set.of(
            "BUSD", "DAI", "TUSD", "FDUSD", "USDD", "BTC", "ETH", "BNB", "XRP", "SOL");

    private FxCryptoCodes() {
    }
}
