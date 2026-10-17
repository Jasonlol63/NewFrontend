package com.eazycount.autofetch;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Auto Fetch: the week a report is read for, the hashes the site's own scripts make, and reading its pages. */
class CitibetPagesTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // ---- the report week ----

    // The site's own "Last week" button, as seen on Sat 17-10-2026: 05-10-2026 Mon .. 11-10-2026 Sun.
    @Test
    void lastWeekIsTheMondayToSundayBeforeTheCaptureDatesWeek() {
        CitibetPages.ReportWeek week = CitibetPages.lastWeek(LocalDate.of(2026, 10, 17));
        assertEquals(LocalDate.of(2026, 10, 5), week.start());
        assertEquals(LocalDate.of(2026, 10, 11), week.end());
        assertEquals("05-10-2026 Mon", week.startLabel());
        assertEquals("11-10-2026 Sun", week.endLabel());
    }

    @Test
    void aMondayCaptureReadsTheWeekThatJustFinished() {
        CitibetPages.ReportWeek week = CitibetPages.lastWeek(LocalDate.of(2026, 10, 19));
        assertEquals(LocalDate.of(2026, 10, 12), week.start());
        assertEquals(LocalDate.of(2026, 10, 18), week.end());
    }

    // Monday and Thursday of one week (the Day Use of M99M06) read the same week.
    @Test
    void everyDayOfOneWeekReadsTheSameWeek() {
        CitibetPages.ReportWeek monday = CitibetPages.lastWeek(LocalDate.of(2026, 10, 12));
        CitibetPages.ReportWeek thursday = CitibetPages.lastWeek(LocalDate.of(2026, 10, 15));
        CitibetPages.ReportWeek sunday = CitibetPages.lastWeek(LocalDate.of(2026, 10, 18));
        assertEquals(monday.start(), thursday.start());
        assertEquals(monday.start(), sunday.start());
        assertEquals(LocalDate.of(2026, 10, 5), monday.start());
    }

    // ---- the hashes of the site's scripts ----

    // mask.js is plain SHA-1, hex and lower case.
    @Test
    void maskIsSha1Hex() {
        assertEquals("a9993e364706816aba3e25717850c26c9cd0d89d", CitibetPages.sha1Hex("abc"));
        assertEquals("da39a3ee5e6b4b0d3255bfef95601890afd80709", CitibetPages.sha1Hex(""));
    }

    // _index.js: mask(valid + code + mask("voodoo_people_" + uid + mask(pass))).
    @Test
    void passwordHashNestsTheWayTheLoginScriptDoes() {
        String expected = CitibetPages.sha1Hex("tok" + "1234"
                + CitibetPages.sha1Hex("voodoo_people_" + "user1" + CitibetPages.sha1Hex("secret")));
        assertEquals(expected, CitibetPages.passwordHash("tok", "1234", "user1", "secret"));
    }

    // validatePin.js: mask(r1 + r2 + mask("pin_" + u + code)).
    @Test
    void pinHashNestsTheWayThePinScriptDoes() {
        CitibetPages.PinChallenge challenge = new CitibetPages.PinChallenge("r-one", "r-two", "subm99m06");
        String expected = CitibetPages.sha1Hex("r-oner-two" + CitibetPages.sha1Hex("pin_subm99m06" + "8888"));
        assertEquals(expected, CitibetPages.pinHash(challenge, "8888"));
    }

    // ---- reading the pages ----

    @Test
    void readsTheOneTimeTokenOfTheLoginForm() {
        String html = "<form id=\"form1\"><input name=\"valid\" type=\"hidden\" id=\"valid\" value=\"f22da9d2-ac01\"></form>";
        assertEquals("f22da9d2-ac01", CitibetPages.loginValidToken(html));
        assertNull(CitibetPages.loginValidToken("<html>no form here</html>"));
    }

    @Test
    void readsThePinChallenge() {
        String html = "<form ACTION=\"/verifypin\" id=\"form1\"></form>"
                + "<script>var u='subm99m06';var r1='541638e1';var r2='ac54c543';</script>";
        assertTrue(CitibetPages.isPinPage(html));
        CitibetPages.PinChallenge challenge = CitibetPages.pinChallenge(html);
        assertNotNull(challenge);
        assertEquals("541638e1", challenge.r1());
        assertEquals("ac54c543", challenge.r2());
        assertEquals("subm99m06", challenge.user());
    }

    @Test
    void tellsTheGatePagesApart() {
        assertTrue(CitibetPages.isTermsPage("<div id=\"agreebtn\"><a href=\"/member/announcement.jsp\">Agree</a></div>"));
        assertFalse(CitibetPages.isTermsPage("<div>something else</div>"));
        assertTrue(CitibetPages.isAccountPage("<script>function payreport(){window.open(\"/newPayReport.jsp\")}</script>"));
        assertFalse(CitibetPages.isAccountPage("<html>login</html>"));
    }

    @Test
    void readsTheReportRowsAndTheAccountTheyBelongTo() {
        String html = reportHtml("{\"upline\":[[{\"lvl\":\"MG\",\"total_tax\":\"$34.07\"}]]}");
        assertTrue(CitibetPages.isReportPage(html));
        assertEquals("m99m06", CitibetPages.reportUid(html));

        CitibetPages.Report report = CitibetPages.parseReport(html, mapper);
        assertEquals("MG", report.data().get("upline").get(0).get(0).get("lvl").asText());
        assertEquals("summary", report.page().get("racing_mode").asText());
        assertFalse(report.page().get("cash_mode").asBoolean());
        assertEquals("m99m06", report.page().get("username").asText());
        assertEquals("Ringgit Malaysia (RM)", report.i18n().get("long_RM"));
    }

    // The site turns the report off for a while after the last race; its own wording is what the user should see.
    @Test
    void saysSoWhenTheSiteShipsNoReport() {
        String html = "<script>\nI18N.setResource({\n\t\"payreport.exception\" : \"Sorry! Payment Report has been temporarily disabled.\"\n});\n"
                + "PayReportHandler.data = {\"lvl\":3};\n</script>";
        CitibetPages.ReportUnavailableException thrown =
                assertThrows(CitibetPages.ReportUnavailableException.class, () -> CitibetPages.parseReport(html, mapper));
        assertEquals("Sorry! Payment Report has been temporarily disabled.", thrown.getMessage());
    }

    // ---- where a page sends the browser next ----

    // The real answer to a correct sign-in: it carries the PIN page in `goTo`, and also a commented-out, pieced-together
    // URL. Following the first piece of that ("ht") lands on a 404 instead of the PIN page.
    @Test
    void followsTheSignInAnswerToThePinPageAndIgnoresCommentedOutCode() {
        String html = "<script>document.domain = 'riding168.com';</script>"
                + "<script>/*window.top.location = 'ht' + 'tp://' + 'WWW.riding168.com/validate_pin.jsp';*/</script>"
                + "<script>var goTo='/validate_pin.jsp'; var hostX = 'WWW.riding168.com'; var z = '.riding168.com';</script>"
                + "<script src='/js/text5.js' type='text/javascript'></script>";
        assertEquals("/validate_pin.jsp", CitibetPages.scriptedNextPage(html));
    }

    @Test
    void followsAPlainScriptRedirect() {
        assertEquals("/_index_blank.jsp", CitibetPages.scriptedNextPage("<script>location.href='/_index_blank.jsp';</script>"));
        assertEquals("/subacc.jsp", CitibetPages.scriptedNextPage("<script>location.replace('/subacc.jsp')</script>"));
    }

    @Test
    void staysPutWhenThereIsNowhereRealToGo() {
        // The front page's own cache-busting reload, another site, and a bare fragment of a string are all not destinations.
        assertNull(CitibetPages.scriptedNextPage("<script>location.replace('?e2c5819d-2bc2')</script>"));
        assertNull(CitibetPages.scriptedNextPage("<script>location.href='https://elsewhere.example/x.jsp'</script>"));
        assertNull(CitibetPages.scriptedNextPage("<script>var x = 'ht' + 'tp://host/a.jsp';</script>"));
        assertNull(CitibetPages.scriptedNextPage("<html><body>no script at all</body></html>"));
        assertNull(CitibetPages.scriptedNextPage(null));
    }

    @Test
    void readsTheReasonTheLoginPageGives() {
        assertEquals("Invalid validation code.", CitibetPages.loginError("<script>alert('Invalid validation code.');</script>"));
        assertEquals("Wrong password", CitibetPages.loginError("<li class=\"error\"><b>Wrong password</b></li>"));
        // The error line the login page always carries, hidden: not a reason.
        assertNull(CitibetPages.loginError("<li class=\"error\" style='display:none'>x</li>"));
        assertNull(CitibetPages.loginError("<html>fine</html>"));
    }

    // A refused sign-in is bounced back to the login page with a code, in a pieced-together URL.
    @Test
    void saysSoWhenTheSignInIsBouncedBackToTheLoginPage() {
        String html = "<script>document.domain = 'riding168.com';</script>"
                + "<script>window.top.location = 'ht' + 'tp://www.' + 'riding168.com/login.jsp?e=3&s=true';</script>";
        String reason = CitibetPages.loginError(html);
        assertNotNull(reason);
        assertTrue(reason.contains("3"), reason);
        assertTrue(reason.toLowerCase().contains("validation code"), reason);
        // The pieced-together URL is still not a page to go to (its first piece is "ht").
        assertNull(CitibetPages.scriptedNextPage(html));
    }

    private static String reportHtml(String citibetData) {
        return "<script>\nI18N.setResource({\n\t\"long_RM\" : \"Ringgit Malaysia (RM)\",\n\t\"overall\" : \"Overall\"\n});\n"
                + "PayReportHandler.data = {\"isOne\":false,\"lvl\":3,\"currency\":\"RM\"};\n"
                + "PayReportHandler.data.racing_mode = 'summary';\n"
                + "PayReportHandler.data.cash_mode=false;\n"
                + "CitibetHandler.data = " + citibetData + ";\n</script>"
                + "<input name=\"uid\" type=\"hidden\" id=\"uid\" value=\"m99m06\"/>";
    }
}
