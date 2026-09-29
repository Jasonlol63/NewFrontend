package com.eazycount.dao;

import com.eazycount.entity.ExchangeRate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface ExchangeRateDao {

    // Distinct currency codes actually in use across all tenants, so the sync job doesn't
    // need a hardcoded currency list.
    List<String> findDistinctActiveCurrencyCodes();

    // (currency_code, rate_date) is unique — this inserts today's snapshot or refreshes it
    // if the job re-runs the same day.
    void upsertRate(ExchangeRate rate);

    // Latest available row per currency (each code resolved independently, not one shared date) —
    // if today's sync missed one currency, that code still returns yesterday's rate instead of
    // dropping out entirely.
    List<ExchangeRate> findLatestRates();

    // Latest row per currency ON OR BEFORE `date` (each code resolved independently). Used by
    // /api/fx/rates for historical lookups — a date that was never explicitly cron'd falls back
    // to the closest earlier snapshot instead of returning nothing.
    List<ExchangeRate> findRatesAsOf(@Param("codes") List<String> codes, @Param("date") LocalDate date);
}
