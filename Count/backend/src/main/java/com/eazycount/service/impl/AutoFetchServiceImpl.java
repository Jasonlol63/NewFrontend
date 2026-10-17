package com.eazycount.service.impl;

import com.eazycount.autofetch.AutoFetchSessions;
import com.eazycount.autofetch.CitibetPages;
import com.eazycount.autofetch.CitibetSession;
import com.eazycount.common.BusinessException;
import com.eazycount.dao.ProcessAutoFetchDao;
import com.eazycount.dao.ProcessDao;
import com.eazycount.dto.AutoFetchDTO;
import com.eazycount.dto.ProcessAutoFetchDTO;
import com.eazycount.entity.Process;
import com.eazycount.entity.ProcessAutoFetch;
import com.eazycount.service.AutoFetchService;
import com.eazycount.util.AccessControlUtils;
import com.eazycount.util.AssertUtils;
import com.eazycount.util.CredentialCipher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.util.Base64;

/*
 * Data Capture > Auto Fetch: reads a process's Payment Report off its report website so the Data Capture Table does not
 * have to be copied in by hand. The website wants a validation code that only a person can read, so a fetch either
 * answers with the report (the session for that website account is already open) or with the code's image; the typed
 * code comes back with the ticket and the session is then kept for the next fetch (see autofetch/AutoFetchSessions).
 */
@Service
public class AutoFetchServiceImpl implements AutoFetchService {

    private static final Logger log = LoggerFactory.getLogger(AutoFetchServiceImpl.class);

    private final ProcessAutoFetchDao autoFetchDao;
    private final ProcessDao processDao;
    private final CredentialCipher cipher;
    private final AutoFetchSessions sessions;
    private final ObjectMapper mapper;

    public AutoFetchServiceImpl(ProcessAutoFetchDao autoFetchDao, ProcessDao processDao, CredentialCipher cipher,
                                AutoFetchSessions sessions, ObjectMapper mapper) {
        this.autoFetchDao = autoFetchDao;
        this.processDao = processDao;
        this.cipher = cipher;
        this.sessions = sessions;
        this.mapper = mapper;
    }

    @Override
    public ProcessAutoFetchDTO findByProcessId(Integer processId, Integer tenantId) {
        AccessControlUtils.requireLoggedIn();
        AccessControlUtils.requireValidTenantId(tenantId);
        if (processId == null) {
            throw new BusinessException("Process ID not found!");
        }
        ProcessAutoFetch row = autoFetchDao.findByProcessId(processId, tenantId);
        return row == null ? null : toDto(row);
    }

    /** The setup without its secrets: only whether a password / PIN is saved. */
    static ProcessAutoFetchDTO toDto(ProcessAutoFetch row) {
        ProcessAutoFetchDTO dto = new ProcessAutoFetchDTO();
        dto.setEnabled(Boolean.TRUE.equals(row.getEnabled()));
        dto.setSiteUrl(row.getSiteUrl());
        dto.setUsername(row.getLoginUsername());
        dto.setHasPassword(row.getLoginPasswordEnc() != null && !row.getLoginPasswordEnc().isBlank());
        dto.setHasPin(row.getLoginPinEnc() != null && !row.getLoginPinEnc().isBlank());
        return dto;
    }

    @Override
    public AutoFetchDTO fetch(AutoFetchDTO request) {
        AccessControlUtils.requireLoggedIn();
        if (request == null) {
            throw new BusinessException("Request body is required");
        }
        Integer tenantId = request.getTenantId();
        AccessControlUtils.requireValidTenantId(tenantId);
        if (request.getProcessId() == null) {
            throw new BusinessException("Process ID not found!");
        }
        LocalDate captureDate = request.getCaptureDate();
        if (captureDate == null) {
            throw new BusinessException("Capture date is required");
        }

        Process process = AssertUtils.requireFound(
                processDao.findProcessByIdAndTenantId(request.getProcessId(), tenantId), "Process not found!");
        ProcessAutoFetch setup = autoFetchDao.findByProcessId(process.getId(), tenantId);
        if (setup == null || !Boolean.TRUE.equals(setup.getEnabled())) {
            throw new BusinessException("Auto Fetch is not set up for this process");
        }

        URI site = parseSite(setup.getSiteUrl());
        String accountKey = AutoFetchSessions.accountKey(setup.getSiteUrl(), setup.getLoginUsername());
        CitibetPages.ReportWeek week = CitibetPages.lastWeek(captureDate);

        // An answered validation code: sign in with it, then read the report.
        if (request.getTicket() != null && !request.getTicket().isBlank()) {
            signIn(request, setup, accountKey);
        }

        CitibetSession session = sessions.signedIn(accountKey);
        if (session == null) {
            return askForCaptcha(site, accountKey, week, null);
        }
        try {
            String html = session.fetchPaymentReportHtml(week);
            return reportReply(session, week, html);
        } catch (CitibetSession.SessionExpiredException e) {
            sessions.forget(accountKey);
            return askForCaptcha(site, accountKey, week, "The report website signed this session out. Enter the validation code again.");
        }
    }

    private void signIn(AutoFetchDTO request, ProcessAutoFetch setup, String accountKey) {
        String captcha = request.getCaptcha();
        if (captcha == null || captcha.isBlank()) {
            throw new BusinessException("Enter the validation code shown on the report website");
        }
        CitibetSession pending = sessions.takePending(request.getTicket(), accountKey);
        if (pending == null) {
            throw new BusinessException("The validation code took too long. Try Auto Fetch again.");
        }
        Long blocked = sessions.blockedMinutes(accountKey);
        if (blocked != null) {
            throw new BusinessException("Too many refused sign-ins to the report website. Try again in " + blocked + " minute(s).");
        }
        try {
            pending.completeLogin(setup.getLoginUsername(), cipher.decrypt(setup.getLoginPasswordEnc()),
                    captcha.trim(), setup.getLoginPinEnc() == null ? null : cipher.decrypt(setup.getLoginPinEnc()));
        } catch (CitibetSession.LoginRejectedException e) {
            sessions.recordFailure(accountKey);
            // The site's own wording, which tells the user whether it was the code, the password or the PIN.
            throw new BusinessException(e.getMessage());
        }
        sessions.clearFailures(accountKey);
        sessions.keepSignedIn(accountKey, pending);
    }

    private AutoFetchDTO askForCaptcha(URI site, String accountKey, CitibetPages.ReportWeek week, String message) {
        Long blocked = sessions.blockedMinutes(accountKey);
        if (blocked != null) {
            throw new BusinessException("Too many refused sign-ins to the report website. Try again in " + blocked + " minute(s).");
        }
        CitibetSession session = new CitibetSession(site);
        CitibetSession.Captcha captcha;
        try {
            captcha = session.startLogin();
        } catch (CitibetSession.LoginRejectedException e) {
            throw new BusinessException(e.getMessage());
        }
        AutoFetchDTO reply = baseReply(site.getHost(), week);
        reply.setStatus(AutoFetchDTO.CAPTCHA);
        reply.setTicket(sessions.addPending(accountKey, session));
        reply.setCaptchaImage("data:" + captcha.contentType() + ";base64," + Base64.getEncoder().encodeToString(captcha.image()));
        reply.setMessage(message);
        return reply;
    }

    private AutoFetchDTO reportReply(CitibetSession session, CitibetPages.ReportWeek week, String html) {
        CitibetPages.Report parsed;
        try {
            parsed = CitibetPages.parseReport(html, mapper);
        } catch (CitibetPages.ReportUnavailableException e) {
            // The site itself says the report is off for a while; it is not a sign-in problem.
            throw new BusinessException(e.getMessage());
        }
        AutoFetchDTO.Report report = new AutoFetchDTO.Report();
        report.setData(parsed.data());
        report.setPage(parsed.page());
        report.setI18n(parsed.i18n());

        AutoFetchDTO reply = baseReply(session.host(), week);
        reply.setStatus(AutoFetchDTO.REPORT);
        reply.setReport(report);
        log.debug("Auto Fetch read the {} report of {}..{}", session.host(), week.start(), week.end());
        return reply;
    }

    private static AutoFetchDTO baseReply(String host, CitibetPages.ReportWeek week) {
        AutoFetchDTO reply = new AutoFetchDTO();
        reply.setSite(host);
        reply.setWeekStart(week.start().toString());
        reply.setWeekEnd(week.end().toString());
        return reply;
    }

    private static URI parseSite(String siteUrl) {
        try {
            URI uri = new URI(siteUrl.trim());
            if (uri.getHost() == null || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                throw new BusinessException("The Auto Fetch website address is not a valid http(s) address");
            }
            // Always a directory base, so "/login" and the like resolve against the site root.
            return uri.resolve("/");
        } catch (URISyntaxException e) {
            throw new BusinessException("The Auto Fetch website address is not a valid http(s) address");
        }
    }
}
