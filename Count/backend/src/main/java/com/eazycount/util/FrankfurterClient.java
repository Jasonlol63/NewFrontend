package com.eazycount.util;

import com.eazycount.dto.FxRateDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Thin wrapper around Frankfurter's /v2/rates — extracted out of ExchangeRateSyncJob so the
// daily cron and the on-demand /api/fx/rates endpoint (ExchangeRateServiceImpl) share one
// implementation instead of two copies drifting apart.
@Component
public class FrankfurterClient {

    private static final Logger log = LoggerFactory.getLogger(FrankfurterClient.class);
    private static final String USD = "USD";

    private final RestTemplate restTemplate;

    @Value("${app.exchange-rate.frankfurter-url}")
    private String frankfurterUrl;

    public FrankfurterClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * "1 USD = X quote" for each requested code, as of {@code date} (null = latest).
     * Batch call first; on failure retries one currency at a time so a single bad/unsupported
     * code doesn't take every other quote's lookup down with it.
     */
    public Map<String, BigDecimal> fetchUsdToQuote(List<String> quoteCodes, LocalDate date) {
        try {
            return fetchBatch(quoteCodes, date);
        } catch (RestClientException e) {
            log.warn("Frankfurter batch fetch failed for {} (date={}, {}), retrying per-currency",
                    quoteCodes, date, e.getMessage());
            return fetchIndividually(quoteCodes, date);
        }
    }

    private Map<String, BigDecimal> fetchBatch(List<String> quoteCodes, LocalDate date) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(frankfurterUrl)
                .queryParam("base", USD)
                .queryParam("quotes", String.join(",", quoteCodes));
        if (date != null) {
            builder.queryParam("date", date.toString());
        }
        FxRateDTO[] rows = restTemplate.getForObject(builder.toUriString(), FxRateDTO[].class);
        if (rows == null) {
            return Map.of();
        }
        return Arrays.stream(rows)
                .filter(row -> row.getQuote() != null && row.getRate() != null)
                .collect(Collectors.toMap(
                        row -> row.getQuote().trim().toUpperCase(),
                        FxRateDTO::getRate,
                        (a, b) -> a));
    }

    private Map<String, BigDecimal> fetchIndividually(List<String> quoteCodes, LocalDate date) {
        Map<String, BigDecimal> merged = new java.util.HashMap<>();
        for (String code : quoteCodes) {
            try {
                merged.putAll(fetchBatch(List.of(code), date));
            } catch (RestClientException e) {
                log.warn("Frankfurter: {} has no usable rate (date={}, {})", code, date, e.getMessage());
            }
        }
        return merged;
    }
}
