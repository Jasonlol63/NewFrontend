package com.eazycount.service;

import com.eazycount.dto.AutoFetchDTO;
import com.eazycount.dto.ProcessAutoFetchDTO;

public interface AutoFetchService {

    /** The Auto Fetch setup of a process as the Process form shows it (no password / PIN), null when it has none. */
    ProcessAutoFetchDTO findByProcessId(Integer processId, Integer tenantId);

    /**
     * Data Capture > Auto Fetch. Reads the report of the process's week when the website session is open, else answers
     * CAPTCHA with the site's validation-code image. A request that carries a ticket + captcha signs in first.
     */
    AutoFetchDTO fetch(AutoFetchDTO request);
}
