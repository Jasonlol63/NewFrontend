package com.eazycount.security;

import com.eazycount.dto.UserDTO;
import com.eazycount.entity.Admin;
import com.eazycount.entity.FeatureModule;
import com.eazycount.entity.Owner;
import com.eazycount.entity.Tenant;
import com.eazycount.entity.User;
import com.eazycount.service.PermissionService;
import com.eazycount.util.SecondaryPasswordUtils;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.io.Serializable;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Authenticated user payload — aligned with legacy {@code current_user_api.php}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionUser implements Serializable {

    public static final String SESSION_KEY = "EC_SESSION_USER";

    public String user_type;
    public Integer user_id;
    public Integer tenant_id;
    public String tenant_code;
    public String login_scope;
    public String login_identifier;
    public boolean needs_owner_secondary;
    public boolean needs_user_secondary;
    public String expiration_date;
    public String name;
    public String login_id;
    public String email;
    public String role;
    public List<String> permissions;
    public boolean is_current_tenant_c168;
    public boolean tenant_has_game;
    public boolean tenant_has_bank;
    public int read_only;

    /** Sidebar visibility by key (role × company category), computed once at construction. */
    public Map<String, Boolean> menu;

    public SessionUser() {
    }

    private SessionUser(
            String userType,
            Integer userId,
            Integer tenantId,
            String tenantCode,
            String loginScope,
            String loginIdentifier,
            boolean needsOwnerSecondary,
            boolean needsUserSecondary,
            String expirationDate,
            String name,
            String loginId,
            String email,
            String role,
            List<String> permissions,
            boolean isCurrentTenantC168,
            boolean tenantHasGame,
            boolean tenantHasBank,
            int readOnly
    ) {
        this.user_type = userType;
        this.user_id = userId;
        this.tenant_id = tenantId;
        this.tenant_code = tenantCode;
        this.login_scope = loginScope;
        this.login_identifier = loginIdentifier;
        this.needs_owner_secondary = needsOwnerSecondary;
        this.needs_user_secondary = needsUserSecondary;
        this.expiration_date = expirationDate;
        this.name = name;
        this.login_id = loginId;
        this.email = email;
        this.role = role;
        this.permissions = permissions != null ? permissions : Collections.emptyList();
        this.is_current_tenant_c168 = isCurrentTenantC168;
        this.tenant_has_game = tenantHasGame;
        this.tenant_has_bank = tenantHasBank;
        this.read_only = readOnly;
        this.menu = buildMenu(
                this.permissions, tenantHasGame, tenantHasBank, "group".equals(loginScope), isCurrentTenantC168);
    }

    /**
     * Sidebar visibility = role layer × company-category layer.
     * <ul>
     *   <li>Role layer: {@code moduleKeys} (role defaults / CUSTOM override, already feature-gated). An empty
     *       list means "unrestricted" (Owner/IT convention, same as the frontend's {@code hasFullPermissions}),
     *       not "has nothing".</li>
     *   <li>Category layer: the CURRENT company's type — Games vs Bank (a group is always treated as Games),
     *       group or company, C168. switch-tenant rebuilds the whole SessionUser, so the menu follows the company.</li>
     * </ul>
     * Keys match the {@code menu} keys in the frontend's {@code sidebarConfig.js}. C168-only entries ignore the
     * role layer on purpose — they are not bound to any role.
     */
    static Map<String, Boolean> buildMenu(
            List<String> moduleKeys, boolean hasGame, boolean hasBank,
            boolean currentIsGroup, boolean c168) {
        Set<String> keys = moduleKeys == null ? Set.of() : Set.copyOf(moduleKeys);
        boolean unrestricted = keys.isEmpty();
        boolean isBank = hasBank && !currentIsGroup;

        boolean report = (unrestricted || keys.contains("report")) && !isBank;
        boolean maintenance = unrestricted || keys.contains("maintenance");
        boolean maintenanceDataCapture = maintenance && !isBank;
        boolean maintenanceFormula = maintenance && !isBank;
        boolean maintenanceTransaction = maintenance;
        boolean maintenancePayment = maintenance;
        boolean maintenanceBankProcess = maintenance && isBank;
        boolean dataCapture = (unrestricted || keys.contains("datacapture"))
                && (hasGame || hasBank || currentIsGroup);

        Map<String, Boolean> menu = new LinkedHashMap<>();
        menu.put("home", true);
        menu.put("domain", c168);
        menu.put("announcement", c168);
        menu.put("autoRenew", c168);
        menu.put("admin", unrestricted || keys.contains("admin"));
        menu.put("account", unrestricted || keys.contains("account"));
        menu.put("ownership", unrestricted || keys.contains("ownership"));
        // No Process for a group, and none inside C168.
        menu.put("process", (unrestricted || keys.contains("process")) && !currentIsGroup && !c168);
        menu.put("dataCapture", dataCapture);
        menu.put("transactionPayment", unrestricted || keys.contains("payment"));
        menu.put("report", report);
        menu.put("reportCustomer", report);
        menu.put("reportDomain", report);
        menu.put("maintenanceDataCapture", maintenanceDataCapture);
        menu.put("maintenanceTransaction", maintenanceTransaction);
        menu.put("maintenancePayment", maintenancePayment);
        menu.put("maintenanceFormula", maintenanceFormula);
        menu.put("maintenanceBankProcess", maintenanceBankProcess);
        // Parent entry: shown only if at least one child is.
        menu.put("maintenance", maintenanceDataCapture || maintenanceTransaction || maintenancePayment
                || maintenanceFormula || maintenanceBankProcess);
        return menu;
    }

    public static SessionUser from(
            UserDTO dto,
            Tenant tenant,
            List<FeatureModule> featureModules,
            PermissionService permissionService
    ) {
        if (dto == null) {
            throw new IllegalArgumentException("UserDTO is required");
        }
        if (permissionService == null) {
            throw new IllegalArgumentException("PermissionService is required");
        }

        final Tenant effectiveTenant = dto.getTenant() != null ? dto.getTenant() : tenant;
        final List<FeatureModule> modules = featureModules != null ? featureModules : List.of();

        if (dto.getAdmin() != null) {
            return fromAdmin(dto.getAdmin(), effectiveTenant, modules, permissionService);
        }
        if (dto.getUser() != null) {
            return fromMember(dto.getUser(), effectiveTenant, modules, permissionService);
        }
        if (dto.getOwner() != null) {
            return fromOwner(dto.getOwner(), effectiveTenant, modules, permissionService);
        }
        if (dto.getItOperator() != null) {
            return fromItOperator(dto.getItOperator(), effectiveTenant, modules, permissionService);
        }

        throw new IllegalArgumentException("UserDTO has no identity");
    }

    public static SessionUser from(
            Owner owner,
            Tenant tenant,
            List<FeatureModule> featureModules,
            PermissionService permissionService
    ) {
        if (owner == null) {
            throw new IllegalArgumentException("Owner is required");
        }
        if (permissionService == null) {
            throw new IllegalArgumentException("PermissionService is required");
        }
        final List<FeatureModule> modules = featureModules != null ? featureModules : List.of();
        return fromOwner(owner, tenant, modules, permissionService);
    }

    private static SessionUser fromAdmin(
            Admin admin,
            Tenant tenant,
            List<FeatureModule> featureModules,
            PermissionService permissionService
    ) {
        final String companyCode = tenantCode(tenant);
        final boolean isC168 = permissionService.isC168Account(tenant);
        final boolean hasSecondary = SecondaryPasswordUtils.isConfigured(admin.getSecondaryPassword());
        final String role = admin.getRoleCode() != null ? admin.getRoleCode() : "";
        final List<String> moduleKeys = toFrontendModuleKeys(
                permissionService.resolveAdminModuleKeys(admin, tenant, featureModules));
        final boolean hasGame = permissionService.hasGameModule(featureModules);
        final boolean hasBank = permissionService.hasBankModule(featureModules);

        return new SessionUser(
                "user",
                admin.getId(),
                tenant != null ? tenant.getId() : null,
                blankToNull(companyCode),
                tenantScope(tenant),
                companyCode,
                false,
                hasSecondary,
                tenantExpiration(tenant),
                Objects.toString(admin.getName(), ""),
                normalizeUpper(Objects.toString(admin.getLoginId(), "")),
                Objects.toString(admin.getEmail(), ""),
                normalizeLower(role),
                moduleKeys,
                isC168,
                hasGame,
                hasBank,
                Boolean.TRUE.equals(admin.getReadOnly()) ? 1 : 0
        );
    }

    private static SessionUser fromMember(
            User member,
            Tenant tenant,
            List<FeatureModule> featureModules,
            PermissionService permissionService
    ) {
        final String companyCode = tenantCode(tenant);
        final boolean hasGame = permissionService.hasGameModule(featureModules);
        final boolean hasBank = permissionService.hasBankModule(featureModules);

        return new SessionUser(
                "member",
                member.getId(),
                tenant != null ? tenant.getId() : null,
                blankToNull(companyCode),
                tenantScope(tenant),
                companyCode,
                false,
                false,
                tenantExpiration(tenant),
                Objects.toString(member.getName(), ""),
                normalizeUpper(Objects.toString(member.getAccountId(), "")),
                "",
                normalizeLower(Objects.toString(member.getRole(), "")),
                Collections.emptyList(),
                permissionService.isC168Account(tenant),
                hasGame,
                hasBank,
                0
        );
    }

    private static SessionUser fromOwner(
            Owner owner,
            Tenant tenant,
            List<FeatureModule> featureModules,
            PermissionService permissionService
    ) {
        final String companyCode = !tenantCode(tenant).isBlank()
                ? tenantCode(tenant)
                : normalizeUpper(Objects.toString(owner.getOwnerCode(), ""));
        final boolean hasSecondary = SecondaryPasswordUtils.isConfigured(owner.getSecondaryPassword());
        final boolean hasGame = permissionService.hasGameModule(featureModules);
        final boolean hasBank = permissionService.hasBankModule(featureModules);

        return new SessionUser(
                "owner",
                owner.getId(),
                tenant != null ? tenant.getId() : null,
                blankToNull(companyCode),
                tenant != null ? tenantScope(tenant) : "group",
                companyCode,
                hasSecondary,
                false,
                tenantExpiration(tenant),
                Objects.toString(owner.getName(), ""),
                normalizeUpper(Objects.toString(owner.getOwnerCode(), "")),
                Objects.toString(owner.getEmail(), ""),
                "owner",
                toFrontendModuleKeys(
                        permissionService.resolveOwnerModuleKeys(owner, tenant, featureModules)),
                "C168".equalsIgnoreCase(companyCode),
                hasGame,
                hasBank,
                0
        );
    }

    /**
     * IT accounts come from {@link ItOperatorRegistry}, not a DB row — no permission/role lookup
     * here (deliberately: IT is a separate track from the Admin role/permission system, and
     * always carries an empty permissions list = unrestricted). {@code featureModules} is still
     * needed, though: tenant_has_game/tenant_has_bank must reflect the *company IT is currently
     * in*, same as every other role, otherwise Report/Data Capture/bank-or-game-gated sidebar
     * entries stay wrong no matter which company an IT operator logs into.
     */
    private static SessionUser fromItOperator(
            ItOperatorIdentity operator,
            Tenant tenant,
            List<FeatureModule> featureModules,
            PermissionService permissionService
    ) {
        final String companyCode = tenantCode(tenant);
        final boolean hasGame = permissionService.hasGameModule(featureModules);
        final boolean hasBank = permissionService.hasBankModule(featureModules);

        return new SessionUser(
                "it",
                null,
                tenant != null ? tenant.getId() : null,
                blankToNull(companyCode),
                tenantScope(tenant),
                companyCode,
                false,
                false,
                tenantExpiration(tenant),
                Objects.toString(operator.getDisplayName(), operator.getUsername()),
                normalizeUpper(Objects.toString(operator.getUsername(), "")),
                "",
                "it",
                Collections.emptyList(),
                "C168".equalsIgnoreCase(companyCode),
                hasGame,
                hasBank,
                0
        );
    }

    public SessionUser withSecondaryVerified() {
        return new SessionUser(
                user_type,
                user_id,
                tenant_id,
                tenant_code,
                login_scope,
                login_identifier,
                false,
                false,
                expiration_date,
                name,
                login_id,
                email,
                role,
                permissions,
                is_current_tenant_c168,
                tenant_has_game,
                tenant_has_bank,
                read_only
        );
    }

    private static String tenantCode(Tenant tenant) {
        return tenant != null && tenant.getCode() != null
                ? normalizeUpper(tenant.getCode())
                : "";
    }

    private static String tenantScope(Tenant tenant) {
        return tenant != null && tenant.getTenantType() != null
                ? normalizeLower(tenant.getTenantType().name())
                : "company";
    }

    private static String tenantExpiration(Tenant tenant) {
        return tenant != null && tenant.getExpirationDate() != null
                ? tenant.getExpirationDate().toString()
                : null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String normalizeUpper(String s) {
        return Objects.toString(s, "").trim().toUpperCase();
    }

    private static String normalizeLower(String s) {
        return Objects.toString(s, "").trim().toLowerCase();
    }

    /** Backend resolves uppercase module keys; frontend expects lowercase (e.g. {@code home}). */
    private static List<String> toFrontendModuleKeys(List<String> moduleKeys) {
        if (moduleKeys == null || moduleKeys.isEmpty()) {
            return Collections.emptyList();
        }
        return moduleKeys.stream()
                .filter(Objects::nonNull)
                .map(key -> key.trim().toLowerCase())
                .toList();
    }
}
