package com.eazycount.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

@Getter
@Setter
@ToString
@NoArgsConstructor
@AllArgsConstructor
public class BankOption {

    private Integer id;

    private Integer tenantId;

    private Integer countryId;

    // Bank name e.g. UBANK, RHB, CIMB
    private String name;

    // 1=selected (shown as Selected Bank in Bank Process form), 0=available only
    private Boolean selected;

    private LocalDateTime createdAt;
}
