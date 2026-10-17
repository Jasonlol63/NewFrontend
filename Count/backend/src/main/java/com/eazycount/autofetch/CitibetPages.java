package com.eazycount.autofetch;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * What the pages of a Citibet agent site (riding168.com and the like) look like, without any network: the tokens the
 * login / PIN forms need, how the site hashes what is typed (its mask.js is plain SHA-1, hex), and the Payment Report,
 * whose rows are a JSON literal in the page (CitibetHandler.data = {...}) that the site's pay_report.js draws as the
 * Upline / Downline tables. The frontend turns that JSON back into the text a manual copy of the tables gives.
 */
public final class CitibetPages {

    private static final Pattern VALID_TOKEN = Pattern.compile("<input[^>]*\\bid=\"valid\"[^>]*\\bvalue=\"([^\"]+)\"");
    private static final Pattern PIN_R1 = Pattern.compile("\\bvar\\s+r1\\s*=\\s*'([^']*)'");
    private static final Pattern PIN_R2 = Pattern.compile("\\bvar\\s+r2\\s*=\\s*'([^']*)'");
    private static final Pattern PIN_USER = Pattern.compile("\\bvar\\s+u\\s*=\\s*'([^']*)'");
    private static final Pattern REPORT_UID = Pattern.compile("<input[^>]*\\bid=\"uid\"[^>]*\\bvalue=\"([^\"]*)\"");
    private static final Pattern REPORT_DATA = Pattern.compile("CitibetHandler\\.data\\s*=\\s*\\{");
    private static final Pattern PAGE_DATA = Pattern.compile("PayReportHandler\\.data\\s*=\\s*\\{");
    private static final Pattern RACING_MODE = Pattern.compile("PayReportHandler\\.data\\.racing_mode\\s*=\\s*'([a-z]+)'");
    private static final Pattern CASH_MODE = Pattern.compile("PayReportHandler\\.data\\.cash_mode\\s*=\\s*(true|false)");
    private static final Pattern I18N_RESOURCE = Pattern.compile("I18N\\.setResource\\(\\s*\\{");
    private static final Pattern ALERT = Pattern.compile("alert\\(\\s*['\"]([^'\"]{3,200})['\"]\\s*\\)");
    /* A refused sign-in is sent back to the login page with a number saying why: ".../login.jsp?e=3&s=true". */
    private static final Pattern LOGIN_BOUNCE = Pattern.compile("login\\.jsp\\?e=(\\d+)");
    private static final Pattern ERROR_ITEM = Pattern.compile("<li\\s+class=\"error\"(?![^>]*display:\\s*none)[^>]*>(.*?)</li>", Pattern.DOTALL);
    private static final Pattern TAG = Pattern.compile("<[^>]+>");

    // Where a page sends the browser on to. The site does this from a script rather than with a status: the page that
    // answers the sign-in carries `var goTo='/validate_pin.jsp'`, and a few others use location.href / location.replace.
    private static final Pattern GO_TO = Pattern.compile("\\bgoTo\\s*=\\s*['\"]([^'\"]+)['\"]");
    private static final Pattern LOCATION_TO =
            Pattern.compile("location(?:\\.href|\\.replace)?\\s*(?:=\\s*|\\(\\s*)['\"]([^'\"]+)['\"]", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCK_COMMENT = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL);
    private static final Pattern LINE_COMMENT = Pattern.compile("(?m)//[^\\n\"']*$");
    // A real destination is a path on this site; a piece of a concatenated string (the commented-out 'ht' + 'tp://...')
    // is not, and following one of those lands on a 404 instead of the next page.
    private static final Pattern PAGE_PATH = Pattern.compile("^/?[\\w./-]*\\.(?:jsp|html?)(?:\\?[^\\s]*)?$|^/[\\w./-]+/?$");
    /* The site's redirect stubs are a few hundred characters; its real pages run from several KB up. */
    private static final int REDIRECT_PAGE_MAX = 2048;

    private static final DateTimeFormatter REPORT_DAY = DateTimeFormatter.ofPattern("dd-MM-yyyy EEE", Locale.ENGLISH);

    // The page's I18N resources are a JS object literal: read it leniently (single quotes, trailing commas...).
    private static final ObjectMapper LENIENT = JsonMapper.builder()
            .enable(JsonReadFeature.ALLOW_SINGLE_QUOTES, JsonReadFeature.ALLOW_UNQUOTED_FIELD_NAMES,
                    JsonReadFeature.ALLOW_TRAILING_COMMA, JsonReadFeature.ALLOW_JAVA_COMMENTS,
                    JsonReadFeature.ALLOW_UNESCAPED_CONTROL_CHARS)
            .build();

    private CitibetPages() {
    }

    /** The week the report is read for: "Last week" of the capture date, Monday to Sunday, as the site's own button picks it. */
    public record ReportWeek(LocalDate start, LocalDate end) {
        public String startLabel() {
            return REPORT_DAY.format(start);
        }

        public String endLabel() {
            return REPORT_DAY.format(end);
        }
    }

    public static ReportWeek lastWeek(LocalDate captureDate) {
        LocalDate monday = captureDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        return new ReportWeek(monday, monday.plusDays(6));
    }

    /** The PIN page's one-time values: r1, r2 and the login name u (validate_pin.jsp). */
    public record PinChallenge(String r1, String r2, String user) {
    }

    /** The parsed Payment Report: data = CitibetHandler.data, page = what drawing it depends on, i18n = the page's labels. */
    public record Report(JsonNode data, JsonNode page, Map<String, String> i18n) {
    }

    /** The report page holds no report (the site disables it for a while after the last race). */
    public static final class ReportUnavailableException extends RuntimeException {
        ReportUnavailableException(String message) {
            super(message);
        }
    }

    // ---- hashing (mask.js) ----

    public static String sha1Hex(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** _index.js: mask(valid + code + mask("voodoo_people_" + uid + mask(pass))). */
    public static String passwordHash(String validToken, String captcha, String username, String password) {
        return sha1Hex(validToken + captcha + sha1Hex("voodoo_people_" + username + sha1Hex(password)));
    }

    /** validate_pin.jsp: mask(r1 + r2 + mask("pin_" + u + code)). */
    public static String pinHash(PinChallenge challenge, String pin) {
        return sha1Hex(challenge.r1() + challenge.r2() + sha1Hex("pin_" + challenge.user() + pin));
    }

    // ---- pages ----

    /** The one-time "valid" value of the login form (_index_blank.jsp), null when the page is not the login form. */
    public static String loginValidToken(String html) {
        return first(VALID_TOKEN, html);
    }

    public static boolean isPinPage(String html) {
        return html != null && html.contains("/verifypin") && PIN_R1.matcher(html).find();
    }

    public static PinChallenge pinChallenge(String html) {
        String r1 = first(PIN_R1, html);
        String r2 = first(PIN_R2, html);
        String user = first(PIN_USER, html);
        return r1 == null || r2 == null || user == null ? null : new PinChallenge(r1, r2, user);
    }

    public static boolean isTermsPage(String html) {
        return html != null && html.contains("agreebtn") && html.contains("/member/announcement.jsp");
    }

    public static boolean isAccountPage(String html) {
        return html != null && html.contains("payreport()") && html.contains("newPayReport.jsp");
    }

    public static boolean isReportPage(String html) {
        return html != null && PAGE_DATA.matcher(html).find();
    }

    /** The account the Payment Report is for (its hidden uid input): the main account, not the sub login. */
    public static String reportUid(String html) {
        return first(REPORT_UID, html);
    }

    /** Best-effort reason the login page gave for refusing (an alert or a visible error line), null when it says none. */
    public static String loginError(String html) {
        String alert = first(ALERT, html);
        if (alert != null) {
            return alert.trim();
        }
        String item = first(ERROR_ITEM, html);
        if (item != null) {
            String text = TAG.matcher(item).replaceAll(" ").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
            if (!text.isEmpty()) {
                return text;
            }
        }
        // Sent back to the login page: the sign-in was refused. The validation code is the part of it that goes stale,
        // so that is what the message points at first.
        String bounce = first(LOGIN_BOUNCE, html);
        if (bounce != null) {
            return "The report website refused the sign-in (code " + bounce
                    + "). The validation code may have expired - try again with the new one.";
        }
        return null;
    }

    /**
     * The page a script on this one sends the browser to, or null when it stays put. Commented-out code is ignored, and
     * so is anything that is not a path on this site (the sign-in answer holds a commented-out, pieced-together URL
     * whose first piece, "ht", would otherwise be followed straight to a 404).
     */
    public static String scriptedNextPage(String html) {
        if (html == null) {
            return null;
        }
        String live = LINE_COMMENT.matcher(BLOCK_COMMENT.matcher(html).replaceAll(" ")).replaceAll(" ");
        // `goTo` is this site's own way of saying "the browser belongs on that page next", so it is taken at its word.
        String target = first(GO_TO, live);
        if (target == null) {
            // A bare location.href / location.replace only means a redirect on a page that holds nothing else. A real
            // page (Terms, the announcements, the account page) has such calls inside its own functions, for buttons
            // and popups, and following those would wander off the sign-in instead of going on with it.
            target = live.length() <= REDIRECT_PAGE_MAX ? first(LOCATION_TO, live) : null;
        }
        if (target == null) {
            return null;
        }
        target = target.trim();
        if (target.isEmpty() || target.startsWith("?") || target.startsWith("#")
                || target.contains("://") || target.startsWith("//") || !PAGE_PATH.matcher(target).matches()) {
            return null;
        }
        return target;
    }

    public static Report parseReport(String html, ObjectMapper mapper) {
        JsonNode data = jsonAt(html, REPORT_DATA, mapper);
        Map<String, String> i18n = i18n(html);
        if (data == null || !data.isObject()) {
            String reason = i18n.get("payreport.exception");
            throw new ReportUnavailableException(reason != null ? reason : "The Payment Report did not load. Please try again in a few minutes.");
        }
        ObjectNode page = mapper.createObjectNode();
        JsonNode pageData = jsonAt(html, PAGE_DATA, mapper);
        if (pageData != null && pageData.isObject()) {
            page.setAll((ObjectNode) pageData);
        }
        String racingMode = first(RACING_MODE, html);
        page.put("racing_mode", racingMode != null ? racingMode : "summary");
        page.put("cash_mode", "true".equals(first(CASH_MODE, html)));
        String uid = reportUid(html);
        if (uid != null && !page.hasNonNull("username")) {
            page.put("username", uid);
        }
        return new Report(data, page, i18n);
    }

    private static Map<String, String> i18n(String html) {
        Map<String, String> out = new LinkedHashMap<>();
        JsonNode node = jsonAt(html, I18N_RESOURCE, LENIENT);
        if (node != null && node.isObject()) {
            node.fields().forEachRemaining(e -> out.put(e.getKey(), e.getValue().asText()));
        }
        return out;
    }

    // The JSON value that starts at the "{" the pattern ends on; whatever follows it (";", more script) is not read.
    private static JsonNode jsonAt(String html, Pattern opening, ObjectMapper mapper) {
        if (html == null) {
            return null;
        }
        Matcher m = opening.matcher(html);
        if (!m.find()) {
            return null;
        }
        try (JsonParser parser = mapper.getFactory().createParser(html.substring(m.end() - 1))) {
            return mapper.readTree(parser);
        } catch (IOException e) {
            return null;
        }
    }

    private static String first(Pattern pattern, String html) {
        if (html == null) {
            return null;
        }
        Matcher m = pattern.matcher(html);
        return m.find() ? m.group(1) : null;
    }
}
