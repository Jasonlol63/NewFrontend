package com.eazycount.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

/**
 * Maps to {@code process_auto_fetch} — the report website a GAME process fills its Data Capture Table from
 * (Process > Auto Fetch). The password and PIN columns hold AES-GCM ciphertext (see util.CredentialCipher).
 */
@Getter
@Setter
@ToString(exclude = {"loginPasswordEnc", "loginPinEnc"})
@NoArgsConstructor
@AllArgsConstructor
public class ProcessAutoFetch {

    private Integer id;

    private Integer processId;

    private Integer tenantId;

    private Provider provider;

    private Boolean enabled;

    private String siteUrl;

    private String loginUsername;

    private String loginPasswordEnc;

    private String loginPinEnc;

    private String createdBy;

    private String updatedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /* Which kind of report website it is; decides how it is logged in to and read. */
    @Getter
    public enum Provider {
        CITIBET
    }
}
