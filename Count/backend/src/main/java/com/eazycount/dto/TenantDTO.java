package com.eazycount.dto;

import com.eazycount.entity.FeatureModule;
import com.eazycount.entity.Tenant;
import com.eazycount.entity.TenantFeatureModule;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TenantDTO {

    private Tenant tenant;
    private FeatureModule featureModule;
    private TenantFeatureModule tenantFeatureModule;

    // When the current session user first gained access to this tenant (grant/creation date) —
    // used by the frontend as the default "unread since" baseline for announcements.
    private LocalDateTime grantedAt;
}
