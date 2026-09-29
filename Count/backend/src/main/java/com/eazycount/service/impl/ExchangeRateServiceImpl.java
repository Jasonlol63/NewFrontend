package com.eazycount.service.impl;

import com.eazycount.dao.ExchangeRateDao;
import com.eazycount.dto.FxRateDTO;
import com.eazycount.entity.ExchangeRate;
import com.eazycount.service.ExchangeRateService;
import com.eazycount.util.FrankfurterClient;
import com.eazycount.util.FxCryptoCodes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ExchangeRateServiceImpl implements ExchangeRateService {

    private static final int CONVERT_SCALE = 8;
    private static final String USD = "USD";

    @Autowired
    private ExchangeRateDao exchangeRateDao;

    @Autowired
    private FrankfurterClient frankfurterClient;

    @Override
    public Map<String, BigDecimal> loadRatesToUsd() {
        return exchangeRateDao.findLatestRates().stream()
                .collect(Collectors.toMap(
                        r -> r.getCurrencyCode().toUpperCase(),
                        ExchangeRate::getRateToUsd,
                        (a, b) -> a));
    }

    @Override
    public BigDecimal convert(BigDecimal amount, String fromCode, String toCode, Map<String, BigDecimal> ratesToUsd) {
        if (amount == null || fromCode == null || toCode == null) {
            return null;
        }
        String from = fromCode.trim().toUpperCase();
        String to = toCode.trim().toUpperCase();
        if (from.equals(to)) {
            return amount;
        }
        BigDecimal fromRateToUsd = ratesToUsd.get(from);
        BigDecimal toRateToUsd = ratesToUsd.get(to);
        if (fromRateToUsd == null || toRateToUsd == null || toRateToUsd.signum() == 0) {
            return null;
        }
        return amount.multiply(fromRateToUsd).divide(toRateToUsd, CONVERT_SCALE, RoundingMode.HALF_UP);
    }

    @Override
    public FxRateDTO.Result resolveRates(String baseRaw, List<String> quotesRaw, LocalDate date) {
        String base = normalizeCode(baseRaw);
        LocalDate targetDate = date != null ? date : LocalDate.now();

        List<String> unsupported = new ArrayList<>();
        LinkedHashSet<String> quotes = new LinkedHashSet<>();
        for (String raw : quotesRaw) {
            String code = normalizeCode(raw);
            if (code.isEmpty()) {
                continue;
            }
            if (FxCryptoCodes.UNSUPPORTED.contains(code)) {
                unsupported.add(code);
                continue;
            }
            quotes.add(code);
        }

        LinkedHashSet<String> needed = new LinkedHashSet<>(quotes);
        needed.add(base);

        Map<String, BigDecimal> ratesToUsd = exchangeRateDao
                .findRatesAsOf(new ArrayList<>(needed), targetDate).stream()
                .collect(Collectors.toMap(
                        r -> r.getCurrencyCode().toUpperCase(),
                        ExchangeRate::getRateToUsd,
                        (a, b) -> a));

        // USD/stablecoins are always 1:1 even if this exact date was never cron'd yet.
        for (String code : needed) {
            if (!ratesToUsd.containsKey(code) && (code.equals(USD) || FxCryptoCodes.STABLECOINS.contains(code))) {
                ratesToUsd.put(code, BigDecimal.ONE);
            }
        }

        List<String> missing = needed.stream()
                .filter(code -> !ratesToUsd.containsKey(code))
                .toList();
        if (!missing.isEmpty()) {
            Map<String, BigDecimal> usdToQuote = frankfurterClient.fetchUsdToQuote(missing, date);
            for (String code : missing) {
                BigDecimal rate = usdToQuote.get(code);
                if (rate == null || rate.signum() <= 0) {
                    continue;
                }
                BigDecimal rateToUsd = BigDecimal.ONE.divide(rate, CONVERT_SCALE, RoundingMode.HALF_UP);
                exchangeRateDao.upsertRate(new ExchangeRate(code, rateToUsd, targetDate, "frankfurter"));
                ratesToUsd.put(code, rateToUsd);
            }
        }

        List<FxRateDTO> rows = new ArrayList<>();
        if (!ratesToUsd.containsKey(base)) {
            // Base itself has no rate at all — every quote is unresolvable.
            unsupported.addAll(quotes);
        } else {
            for (String quote : quotes) {
                BigDecimal rate = convert(BigDecimal.ONE, base, quote, ratesToUsd);
                if (rate == null) {
                    unsupported.add(quote);
                } else {
                    rows.add(new FxRateDTO(targetDate, base, quote, rate));
                }
            }
        }

        return new FxRateDTO.Result(rows, unsupported, targetDate);
    }

    private static String normalizeCode(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase();
    }
}
