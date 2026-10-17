package com.eazycount.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.Map;

/*
 * Data Capture > Auto Fetch (/api/datacapture/autofetch/*).
 * Request: tenantId, processId, captureDate; plus ticket + captcha when answering a validation code.
 * Reply status:
 *   REPORT  - report holds the Payment Report of the week (weekStart..weekEnd);
 *   CAPTCHA - the website wants its validation code: show captchaImage, send the typed code back with ticket
 *             (message says why when a code / password was just refused).
 */
@Getter
@Setter
@NoArgsConstructor
public class AutoFetchDTO {

    public static final String REPORT = "REPORT";
    public static final String CAPTCHA = "CAPTCHA";

    // ---- request ----
    private Integer tenantId;
    private Integer processId;
    private LocalDate captureDate;
    private String ticket;
    private String captcha;

    // ---- reply ----
    private String status;
    private String site;
    private String weekStart;
    private String weekEnd;
    private String captchaImage;
    private String message;
    private Report report;

    /** CitibetHandler.data of the page, what drawing it depends on (racing_mode, isOP...), and the page's labels. */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Report {
        private JsonNode data;
        private JsonNode page;
        private Map<String, String> i18n;
    }
}
