package com.eazycount.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/*
 * Process > Auto Fetch as the Process list shows it and the Add / Edit Process form sends it.
 * password / pin are write-only: sent to set or replace them, never sent back (hasPassword / hasPin say whether one is
 * saved). On Edit, a blank password / pin keeps the saved one.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProcessAutoFetchDTO {

    private Boolean enabled;

    private String siteUrl;

    private String username;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String pin;

    private Boolean hasPassword;

    private Boolean hasPin;
}
