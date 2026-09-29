package com.eazycount.controller;

import com.eazycount.dto.FxRateDTO;
import com.eazycount.service.ExchangeRateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Replaces the legacy api/fx/fx_rates_api.php: on-demand FX rate lookup for the dashboard's
// currency widgets (arbitrary base/quotes, optional historical date). See ExchangeRateService
// .resolveRates for the resolution logic (DB cache first, live Frankfurter fetch on miss).
@RestController
@RequestMapping("/api/fx")
public class FxRateController {

    @Autowired
    private ExchangeRateService exchangeRateService;

    @PostMapping("/rates")
    public ResponseEntity<Map<String, Object>> rates(
            @RequestParam("base") String base,
            @RequestParam("quotes") String quotes,
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        List<String> quoteCodes = Arrays.stream(quotes.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        FxRateDTO.Result result = exchangeRateService.resolveRates(base, quoteCodes, date);

        List<Map<String, Object>> rows = result.getRows().stream()
                .map(FxRateController::rowToMap)
                .toList();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rows", rows);
        data.put("rates", rows);
        data.put("unsupported", result.getUnsupported());
        data.put("rate_date", result.getRateDate());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Rates retrieved",
                "data", data
        ));
    }

    private static Map<String, Object> rowToMap(FxRateDTO row) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("date", row.getDate());
        map.put("base", row.getBase());
        map.put("quote", row.getQuote());
        map.put("rate", row.getRate());
        return map;
    }
}
