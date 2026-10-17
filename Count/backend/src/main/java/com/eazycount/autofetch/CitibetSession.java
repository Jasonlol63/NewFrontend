package com.eazycount.autofetch;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.StringJoiner;

/*
 * One sign-in to a Citibet agent site, kept open between fetches so the validation code only has to be typed once per
 * session instead of once per report. The steps mirror the pages a browser visits (see CitibetPages for what each page
 * holds): the login form, POST /login, the PIN page + POST /verifypin, Agree, Proceed, SG Mode, then the
 * Payment Report at /newPayReport.jsp?start=..&end=..&uid=.. . The validation code is always read and typed by the
 * person (the Data Capture dialog shows the site's own image); nothing here reads or solves it.
 *
 * Cookies are held in this object (java.net.CookieManager drops the site's "domain=riding168.com" cookies) and
 * redirects are walked by hand so every hop's Set-Cookie is kept. Calls on one session are serialised.
 */
public final class CitibetSession {

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    private static final Duration TIMEOUT = Duration.ofSeconds(30);
    private static final int MAX_REDIRECTS = 10;

    /** The site sent the login page instead of the page asked for: this session is no longer signed in. */
    public static final class SessionExpiredException extends RuntimeException {
        SessionExpiredException() {
            super("The report website session has expired");
        }
    }

    /** The site turned down the validation code, password or PIN; the message carries the site's own reason when it gives one. */
    public static final class LoginRejectedException extends RuntimeException {
        LoginRejectedException(String message) {
            super(message);
        }
    }

    public record Captcha(byte[] image, String contentType) {
    }

    private record Page(URI url, int status, String body) {
    }

    // Where the pages are asked for. A site set up as "http://..." answers with a redirect to its https address, so the
    // first page of a sign-in adopts whatever address it ends up on: a POST must not be the request that gets
    // redirected, because a redirected POST is re-sent as a GET and would arrive with no form on it at all.
    private URI base;
    private final HttpClient http;
    private final Map<String, String> cookies = new LinkedHashMap<>();
    private String validToken;
    private boolean signedIn;
    private String reportUid;
    private volatile Instant lastUsed = Instant.now();

    public CitibetSession(URI base) {
        this.base = base;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public String host() {
        return base.getHost();
    }

    public Instant lastUsed() {
        return lastUsed;
    }

    public synchronized boolean isSignedIn() {
        return signedIn;
    }

    /** Opens the login form on a fresh session and returns its validation-code image for the person to read. */
    public synchronized Captcha startLogin() {
        cookies.clear();
        signedIn = false;
        reportUid = null;
        validToken = null;
        // The front page settles which address the site really answers on (http redirects to https); everything after
        // this, the sign-in POST included, is asked for there directly.
        adoptOrigin(get("/").url());
        Page form = get("/_index_blank.jsp");
        validToken = CitibetPages.loginValidToken(form.body());
        if (validToken == null) {
            throw new LoginRejectedException("The report website did not return its login form. Try again shortly.");
        }
        return captcha();
    }

    /** Fetches a fresh validation-code image for the open login form (the person asked for a new one). */
    public synchronized Captcha refreshCaptcha() {
        if (validToken == null) {
            return startLogin();
        }
        return captcha();
    }

    private Captcha captcha() {
        HttpResponse<byte[]> res = sendBytes(request("/img.jpg?" + Math.random()).GET().build());
        storeCookies(res);
        String type = res.headers().firstValue("content-type").orElse("image/jpeg");
        return new Captcha(res.body(), type);
    }

    /**
     * Signs in with the account's username / password and the validation code the person typed, then walks the PIN,
     * Agree, Proceed and SG-Mode pages so the next fetch lands straight on the Payment Report.
     */
    public synchronized void completeLogin(String username, String password, String validationCode, String pin) {
        if (validToken == null) {
            throw new LoginRejectedException("Open the login form first.");
        }
        String masked = CitibetPages.passwordHash(validToken, validationCode, username, password);
        // Every named input of the form, in the order the page has them. The site's own script empties the visible
        // uid2 / pass2 / code2 boxes only AFTER it submits, so the request really does carry them filled in.
        Page afterLogin = postForm("/login", orderedForm(
                "uid2", username,
                "pass2", password,
                "code2", validationCode,
                "uid", username,
                "pass", masked,
                "code", validationCode,
                "valid", validToken,
                "lang", "EN",
                "ssl", "https:"));
        validToken = null;

        Page page = afterLogin;
        if (!CitibetPages.isPinPage(page.body())) {
            // Some accounts land straight on Terms; otherwise the login was refused.
            if (!CitibetPages.isTermsPage(page.body()) && !CitibetPages.isAccountPage(page.body())) {
                throw new LoginRejectedException(loginRefusal(page.body()));
            }
        } else {
            page = submitPin(page.body(), username, pin);
        }

        page = advanceThroughGates(page);
        if (!CitibetPages.isAccountPage(page.body())) {
            throw new LoginRejectedException("Could not reach the account page after signing in.");
        }
        reportUid = null;
        signedIn = true;
    }

    private Page submitPin(String pinHtml, String username, String pin) {
        CitibetPages.PinChallenge challenge = CitibetPages.pinChallenge(pinHtml);
        if (challenge == null) {
            throw new LoginRejectedException("The PIN page could not be read.");
        }
        if (pin == null || pin.isBlank()) {
            throw new LoginRejectedException("This account needs a PIN. Add it in Process > Auto Fetch.");
        }
        // Every named input of the PIN form. The statistics fields are filled by the page's own scripts in a browser; a
        // client that runs no scripts leaves them empty, and fpVisitorId takes the value the page itself uses then.
        Page after = postForm("/verifypin", orderedForm(
                "code", CitibetPages.pinHash(challenge, pin),
                "trafficStatistics", "",
                "trafficStatisticsCanvas", "",
                "trafficStatisticsActivex", "",
                "trafficStatisticsResolution", "",
                "trafficStatistics2", "",
                "fpVisitorId", "NO_VISITOR_ID",
                "fpError", ""));
        if (CitibetPages.isPinPage(after.body())) {
            throw new LoginRejectedException("The PIN was not accepted.");
        }
        return after;
    }

    // Agree (Terms) -> Proceed (Announcement) -> SG Mode (Select) until the account page shows.
    private Page advanceThroughGates(Page page) {
        for (int i = 0; i < 6 && !CitibetPages.isAccountPage(page.body()); i++) {
            if (CitibetPages.isTermsPage(page.body())) {
                page = get("/member/announcement.jsp");
            } else if (page.body() != null && page.body().contains("/select.jsp")
                    && page.body().contains("proceedbtn")) {
                page = get("/select.jsp");
            } else if (page.body() != null && page.body().contains("SG MODE")) {
                page = get("/select.jsp?mode=sg");
            } else {
                break;
            }
        }
        return page;
    }

    /** The Payment Report page for the given week, as raw HTML (CitibetPages.parseReport turns it into rows). */
    public synchronized String fetchPaymentReportHtml(CitibetPages.ReportWeek week) {
        if (!signedIn) {
            throw new SessionExpiredException();
        }
        if (reportUid == null) {
            Page landing = get("/newPayReport.jsp");
            requireSignedIn(landing);
            reportUid = CitibetPages.reportUid(landing.body());
            if (CitibetPages.isReportPage(landing.body()) && matchesWeek(landing.body(), week)) {
                return landing.body();
            }
        }
        String query = "start=" + enc(week.startLabel())
                + "&end=" + enc(week.endLabel())
                + "&uid=" + enc(reportUid != null ? reportUid : "")
                + "&domain=";
        Page report = get("/newPayReport.jsp?" + query);
        requireSignedIn(report);
        return report.body();
    }

    /**
     * Signs this session out of the website. The site keeps one sitting of an account at a time, so a session that is
     * finished with has to be given back - otherwise the account stays occupied and the next sign-in, ours or the
     * person's own in a browser, is refused. Never throws: it is cleanup.
     */
    public synchronized void logout() {
        boolean was = signedIn;
        signedIn = false;
        reportUid = null;
        validToken = null;
        if (!was) {
            return;
        }
        try {
            get("/logout");
        } catch (RuntimeException e) {
            // Nothing to do about it; the sitting falls away on the site's own timeout.
        }
        cookies.clear();
    }

    // The landing report already shows the asked week when its start date box holds that week's Monday.
    private static boolean matchesWeek(String html, CitibetPages.ReportWeek week) {
        return html != null && html.contains("value='" + week.startLabel() + "'");
    }

    private void requireSignedIn(Page page) {
        if (page.body() != null && CitibetPages.loginValidToken(page.body()) != null) {
            signedIn = false;
            throw new SessionExpiredException();
        }
    }

    private String loginRefusal(String html) {
        String reason = CitibetPages.loginError(html);
        return reason != null ? reason : "The report website turned down the sign-in. Check the username, password, PIN and validation code.";
    }

    // ---- HTTP plumbing ----

    private Page get(String path) {
        return follow(request(path).GET().build());
    }

    private Page postForm(String path, String body) {
        HttpRequest req = request(path)
                .header("content-type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        return follow(req);
    }

    private Page follow(HttpRequest first) {
        HttpRequest req = first;
        for (int i = 0; i < MAX_REDIRECTS; i++) {
            HttpResponse<String> res = sendString(req);
            storeCookies(res);
            int status = res.statusCode();
            if (status >= 300 && status < 400) {
                String location = res.headers().firstValue("location").orElse(null);
                if (location == null) {
                    break;
                }
                URI next = res.uri().resolve(location);
                req = request(next).GET().build();
                continue;
            }
            // Several of these pages send the browser on from a script instead of with a status (the answer to the
            // sign-in carries `var goTo='/validate_pin.jsp'`), so that is followed the way a browser follows it.
            String scripted = CitibetPages.scriptedNextPage(res.body());
            if (scripted != null) {
                req = request(res.uri().resolve(scripted)).GET().build();
                continue;
            }
            return new Page(res.uri(), status, res.body());
        }
        throw new LoginRejectedException("The report website redirected too many times.");
    }

    // Takes the scheme / host a page actually came from as the one to ask on from now on.
    private void adoptOrigin(URI landed) {
        if (landed == null || landed.getHost() == null) {
            return;
        }
        URI origin = landed.resolve("/");
        if (!origin.equals(base)) {
            base = origin;
        }
    }

    private HttpRequest.Builder request(String pathOrQuery) {
        return request(base.resolve(pathOrQuery));
    }

    private HttpRequest.Builder request(URI uri) {
        lastUsed = Instant.now();
        HttpRequest.Builder b = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .header("user-agent", USER_AGENT)
                .header("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                .header("accept-language", "en-US,en;q=0.9")
                .header("referer", base.toString());
        String cookieHeader = cookieHeader();
        if (!cookieHeader.isEmpty()) {
            b.header("cookie", cookieHeader);
        }
        return b;
    }

    private HttpResponse<String> sendString(HttpRequest req) {
        try {
            return http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new LoginRejectedException("Could not reach the report website: " + e.getMessage());
        }
    }

    private HttpResponse<byte[]> sendBytes(HttpRequest req) {
        try {
            return http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new LoginRejectedException("Could not load the validation-code image: " + e.getMessage());
        }
    }

    private synchronized void storeCookies(HttpResponse<?> res) {
        for (String header : res.headers().allValues("set-cookie")) {
            int semi = header.indexOf(';');
            String pair = (semi >= 0 ? header.substring(0, semi) : header).trim();
            int eq = pair.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            cookies.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
        }
    }

    private synchronized String cookieHeader() {
        StringJoiner joiner = new StringJoiner("; ");
        cookies.forEach((k, v) -> joiner.add(k + "=" + v));
        return joiner.toString();
    }

    private static String orderedForm(String... kv) {
        StringJoiner joiner = new StringJoiner("&");
        for (int i = 0; i + 1 < kv.length; i += 2) {
            joiner.add(enc(kv[i]) + "=" + enc(kv[i + 1]));
        }
        return joiner.toString();
    }

    private static String enc(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
