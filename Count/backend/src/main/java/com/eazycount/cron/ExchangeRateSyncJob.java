package com.eazycount.cron;

import com.eazycount.dao.ExchangeRateDao;
import com.eazycount.entity.ExchangeRate;
import com.eazycount.util.FrankfurterClient;
import com.eazycount.util.FxCryptoCodes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// Refreshes `exchange_rate` once a day. All rates are pivoted against USD (see
// migrate_add_exchange_rate_table.sql) so converting any currency A -> B is a simple
// division at read time — this job only has to know each currency's rate against USD.
@Component
public class ExchangeRateSyncJob {

    private static final Logger log = LoggerFactory.getLogger(ExchangeRateSyncJob.class);

    private static final String USD = "USD";
    private static final int RATE_SCALE = 8;

    private final ExchangeRateDao exchangeRateDao;
    private final FrankfurterClient frankfurterClient;

    public ExchangeRateSyncJob(ExchangeRateDao exchangeRateDao, FrankfurterClient frankfurterClient) {
        this.exchangeRateDao = exchangeRateDao;
        this.frankfurterClient = frankfurterClient;
    }

    @Scheduled(cron = "${app.exchange-rate.cron}")
    public void syncDailyRates() {
        LocalDate today = LocalDate.now();
        List<String> activeCodes = exchangeRateDao.findDistinctActiveCurrencyCodes();
        if (activeCodes.isEmpty()) {
            log.info("Exchange rate sync skipped: no active currencies configured");
            return;
        }

        exchangeRateDao.upsertRate(new ExchangeRate(USD, BigDecimal.ONE, today, "frankfurter"));

        Set<String> stablecoinCodes = activeCodes.stream()
                .filter(FxCryptoCodes.STABLECOINS::contains)
                .collect(Collectors.toSet());
        stablecoinCodes.forEach(code ->
                exchangeRateDao.upsertRate(new ExchangeRate(code, BigDecimal.ONE, today, "stablecoin")));

        List<String> fiatCodes = activeCodes.stream()
                .filter(code -> !code.equals(USD) && !FxCryptoCodes.STABLECOINS.contains(code))
                .distinct()
                .toList();
        if (fiatCodes.isEmpty()) {
            log.info("Exchange rate sync: no fiat currencies to fetch (stablecoins={})", stablecoinCodes);
            return;
        }

        // FrankfurterClient swallows fetch failures internally and logs them — a currency that
        // couldn't be resolved this run just keeps its previous rate_date row (see
        // syncFiatRates), so Frankfurter being unreachable never breaks dashboard reads.
        syncFiatRates(fiatCodes, today);
    }

    private void syncFiatRates(List<String> fiatCodes, LocalDate today) {
        // FrankfurterClient already handles the batch-then-per-currency fallback internally
        // (a typo'd code like "RM" 4xx'ing the whole batch must not take every other currency
        // down with it) and never throws — codes it couldn't resolve are simply absent below.
        Map<String, BigDecimal> usdToQuote = frankfurterClient.fetchUsdToQuote(fiatCodes, null);

        for (String code : fiatCodes) {
            BigDecimal rate = usdToQuote.get(code);
            if (rate == null || rate.signum() <= 0) {
                // A currency missing from the response (delisted, typo, unsupported) is logged
                // and left untouched — its previous rate_date row simply stays the latest one.
                log.warn("Exchange rate sync: no rate returned for {}, leaving previous value in place", code);
                continue;
            }
            // Response is "1 USD = X quote", we store "1 quote = ? USD".
            BigDecimal rateToUsd = BigDecimal.ONE.divide(rate, RATE_SCALE, RoundingMode.HALF_UP);
            exchangeRateDao.upsertRate(new ExchangeRate(code, rateToUsd, today, "frankfurter"));
        }
    }
}
