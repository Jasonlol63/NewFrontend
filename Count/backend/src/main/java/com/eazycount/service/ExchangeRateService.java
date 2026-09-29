package com.eazycount.service;

import com.eazycount.dto.FxRateDTO;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ExchangeRateService {

    // One DB read for the whole request: latest available rate_to_usd per currency code
    // (uppercased). Callers load this once and reuse it for every row they convert —
    // conversion itself is then pure in-memory arithmetic, no further I/O.
    Map<String, BigDecimal> loadRatesToUsd();

    // amount in `fromCode` -> equivalent in `toCode`, derived as
    // amount * rate(fromCode -> USD) / rate(toCode -> USD) — no NxN rate matrix needed.
    // Returns null if either currency has no known rate yet (caller renders "—").
    BigDecimal convert(BigDecimal amount, String fromCode, String toCode, Map<String, BigDecimal> ratesToUsd);

    // On-demand lookup backing /api/fx/rates: "1 base = rate quote" for each requested quote,
    // as of `date` (null = latest/today). Checks exchange_rate first; anything missing is
    // fetched live from Frankfurter and cached back into the table, so a date only ever costs
    // an external call the first time it's asked for.
    FxRateDTO.Result resolveRates(String base, List<String> quotes, LocalDate date);
}
