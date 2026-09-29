package com.eazycount.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// One FX rate row: "1 base = rate quote" as of `date`. Doubles as both the external
// Frankfurter API's response row shape (FrankfurterClient deserializes into this) and
// /api/fx/rates' own response row shape — same fields, so no separate mapping needed.
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FxRateDTO {

    private LocalDate date;
    private String base;
    private String quote;
    private BigDecimal rate;

    // Result of ExchangeRateService.resolveRates — mirrors the shape the legacy
    // fx_rates_api.php endpoint returned ({rows, unsupported, rate_date}) so the frontend's
    // existing FX parsing logic (frankfurterRates.js on both desktop and mobile) needs no
    // changes beyond the URL.
    @Getter
    @AllArgsConstructor
    public static class Result {
        private final List<FxRateDTO> rows;
        private final List<String> unsupported;
        private final LocalDate rateDate;
    }
}
