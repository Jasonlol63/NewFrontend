package com.eazycount.service.impl;

import com.eazycount.common.BusinessException;
import com.eazycount.dao.AuthDao;
import com.eazycount.dao.TenantDao;
import com.eazycount.dto.AdminTenantDTO;
import com.eazycount.dto.LoginResultDTO;
import com.eazycount.dto.OwnerTenantDTO;
import com.eazycount.dto.TenantDTO;
import com.eazycount.dto.UserDTO;
import com.eazycount.dto.UserTenantDTO;
import com.eazycount.entity.Admin;
import com.eazycount.entity.FeatureModule;
import com.eazycount.entity.Owner;
import com.eazycount.entity.Tenant;
import com.eazycount.entity.User;
import com.eazycount.jwt.JwtService;
import com.eazycount.mail.PasswordResetMailService;
import com.eazycount.security.AuthCookieHelper;
import com.eazycount.security.AuthTokenStore;
import com.eazycount.security.ItOperatorIdentity;
import com.eazycount.security.ItOperatorProperties;
import com.eazycount.security.ItOperatorRegistry;
import com.eazycount.security.LoginUserPrincipal;
import com.eazycount.security.PasswordResetTacStore;
import com.eazycount.security.SecurityUtils;
import com.eazycount.security.SessionUser;
import com.eazycount.service.AuthService;
import com.eazycount.service.LoginRole;
import com.eazycount.service.SystemMaintenanceModeService;
import com.eazycount.util.AccessControlUtils;
import com.eazycount.util.AssertUtils;
import com.eazycount.service.PermissionService;
import com.eazycount.util.TenantDtoHelper;
import com.eazycount.util.SecondaryPasswordUtils;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

@Service
public class AuthServiceImpl implements AuthService {

    @Autowired
    private AuthDao authDao;
    @Autowired
    private TenantDao tenantDao;
    @Autowired
    private PermissionService permissionService;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private Argon2PasswordEncoder argon2PasswordEncoder;
    @Autowired
    private AuthTokenStore authTokenStore;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private PasswordResetTacStore passwordResetTacStore;
    @Autowired
    private PasswordResetMailService passwordResetMailService;
    @Autowired
    private ItOperatorRegistry itOperatorRegistry;
    @Autowired
    private SystemMaintenanceModeService systemMaintenanceModeService;

    private static final String RESET_SCOPE_ADMIN = "admin";
    private static final String RESET_SCOPE_OWNER = "owner";
    private static final int MAX_PASSWORD_BYTES = 72;
    private static final SecureRandom TAC_RANDOM = new SecureRandom();

    @Override
    public LoginResultDTO login(String tenantCode, String username, String password, LoginRole role) {
        List<Tenant> loginCandidates = findActiveTenantsByLoginCode(tenantCode);
        Tenant loginTenant = resolveLoginTenant(loginCandidates, tenantCode);

        String code = normalize(tenantCode);
        String name = normalize(username);

        if (name.isBlank()) {
            throw new BusinessException("Please enter username");
        }
        if (role == null) {
            throw new BusinessException("Invalid login role");
        }
        if (password == null || password.isBlank()) {
            throw new BusinessException("Password is required");
        }

        UserDTO identity = new UserDTO();

        if (role == LoginRole.MEMBER) {
            User member = authDao.findMemberByAccountIdAndTenantCode(name, code);
            if (member == null || !verifyPassword(password, member.getPassword())) {
                throw new BusinessException("Account ID, Company ID or password is incorrect");
            }
            if (isArgon2Hash(member.getPassword())) {
                authDao.updateMemberPassword(member.getId(), passwordEncoder.encode(password));
            }
            List<UserTenantDTO> access = findAccessibleTenantsByMemberId(member.getId(), code);
            if (access.isEmpty()) {
                throw new BusinessException("You do not have access to this Company or Group");
            }
            Tenant sessionTenant = access.get(0).getTenant();
            assertTenantNotExpired(sessionTenant);
            requireNotUnderMaintenance();
            authDao.updateMemberLastLogin(member.getId());
            identity.setUser(member);
            identity.setTenant(sessionTenant);
            return buildLoginResult(identity, loginTenant, sessionTenant);
        }

        // IT operators are checked before the Admin table — a separate registry (it-operators.yml),
        // not a DB row. Same "admin" login tab; no fall-through if the username matches here but the
        // password doesn't, so a mistyped password never leaks into the Admin lookup below.
        ItOperatorProperties.Operator itOperator = itOperatorRegistry.findByUsername(name);
        if (itOperator != null) {
            if (!itOperatorRegistry.verifyPassword(itOperator, password, passwordEncoder)) {
                throw new BusinessException("Username or password is incorrect");
            }
            assertTenantNotExpired(loginTenant);
            identity.setItOperator(new ItOperatorIdentity(itOperator.getUsername(), itOperator.getDisplayName()));
            identity.setTenant(loginTenant);
            return buildLoginResult(identity, loginTenant, loginTenant);
        }

        Admin admin = authDao.findAdminByLoginId(name, code);
        if (admin != null) {
            if (!verifyPassword(password, admin.getPassword())) {
                throw new BusinessException("Username or password is incorrect");
            }
            if (isArgon2Hash(admin.getPassword())) {
                authDao.updateAdminPassword(admin.getId(), passwordEncoder.encode(password));
            }
            List<AdminTenantDTO> access = findAccessibleTenantsByAdminId(admin.getId(), code);
            if (access.isEmpty()) {
                throw new BusinessException("You do not have access to this Company or Group");
            }
            Tenant sessionTenant = access.get(0).getTenant();
            assertTenantNotExpired(sessionTenant);
            requireNotUnderMaintenance();
            authDao.updateAdminLastLogin(admin.getId());
            identity.setAdmin(admin);
            identity.setTenant(sessionTenant);
            return buildLoginResult(identity, loginTenant, sessionTenant);
        }

        Owner owner = authDao.findOwnerByOwnerCode(name);
        if (owner != null) {
            if (!verifyPassword(password, owner.getPassword())) {
                throw new BusinessException("Username or password is incorrect");
            }
            if (isArgon2Hash(owner.getPassword())) {
                authDao.updateOwnerPassword(owner.getId(), passwordEncoder.encode(password));
            }
            List<OwnerTenantDTO> access = findAccessibleTenantsByOwnerId(owner.getId(), code);
            if (access.isEmpty()) {
                throw new BusinessException("You do not have access to this Company or Group");
            }
            Tenant sessionTenant = access.get(0).getTenant();
            assertTenantNotExpired(sessionTenant);
            requireNotUnderMaintenance();
            authDao.updateOwnerLastLogin(owner.getId());
            identity.setOwner(owner);
            identity.setTenant(sessionTenant);
            return buildLoginResult(identity, loginTenant, sessionTenant);
        }

        throw new BusinessException("Username or password is incorrect");
    }

    @Override
    public Map<String, Object> toLoginResponse(LoginResultDTO result) {
        if (result == null || result.getIdentity() == null) {
            throw new BusinessException("Invalid login result");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "success");
        body.put("tenant", toTenantMap(result.getSessionTenant()));
        body.put("login_tenant", toTenantMap(result.getLoginTenant()));
        body.put("user_type", result.getUserType());
        body.put("redirect", result.getRedirect());
        return body;
    }

    @Override
    public List<OwnerTenantDTO> findAccessibleTenantsByOwnerId(Integer ownerId, String tenantCode) {
        if (ownerId == null || tenantCode == null || tenantCode.isBlank()) {
            throw new BusinessException("Invalid to Login!");
        }
        return authDao.findAccessibleTenantsByOwnerId(ownerId, normalize(tenantCode));
    }

    @Override
    public List<AdminTenantDTO> findAccessibleTenantsByAdminId(Integer adminId, String tenantCode) {
        if (adminId == null || tenantCode == null || tenantCode.isBlank()) {
            throw new BusinessException("Invalid to Login!");
        }
        return authDao.findAccessibleTenantsByAdminId(adminId, normalize(tenantCode));
    }

    @Override
    public List<UserTenantDTO> findAccessibleTenantsByMemberId(Integer userId, String tenantCode) {
        if (userId == null || tenantCode == null || tenantCode.isBlank()) {
            throw new BusinessException("Invalid to Login!");
        }
        return authDao.findAccessibleTenantsByMemberId(userId, normalize(tenantCode));
    }

    @Override
    public UserDTO requireIdentity(String userType, String identifier) {
        if (userType == null || userType.isBlank()) {
            throw new BusinessException("Invalid identity type");
        }
        if (identifier == null || identifier.isBlank()) {
            throw new BusinessException("Invalid identity identifier");
        }

        String key = normalize(identifier);
        UserDTO identity = new UserDTO();

        return switch (userType.trim().toLowerCase()) {
            case "member" -> {
                identity.setUser(requireFound(
                        authDao.findMemberByAccountId(key),
                        User::getAccountId,
                        "User Not Found!"));
                yield identity;
            }
            case "user" -> {
                // Generic/diagnostic path, no tenant context available -- global match only.
                // Real login/session-rebuild use the tenant-scoped or PK-based lookups instead.
                identity.setAdmin(requireFound(
                        authDao.findAdminByLoginIdGlobal(key),
                        Admin::getLoginId,
                        "Admin Not Found!"));
                yield identity;
            }
            case "owner" -> {
                identity.setOwner(requireFound(
                        authDao.findOwnerByOwnerCode(key),
                        Owner::getId,
                        "Owner Not Found!"));
                yield identity;
            }
            default -> throw new BusinessException("Invalid identity type");
        };
    }

    @Override
    public List<Tenant> findActiveTenantsByLoginCode(String tenantCode) {
        if (tenantCode == null || tenantCode.isBlank()) {
            throw new BusinessException("Invalid Group/Company ID");
        }
        List<Tenant> tenants = TenantDtoHelper.distinctTenants(
                tenantDao.findActiveTenantFeaturesByLoginCode(normalize(tenantCode)));
        if (tenants.isEmpty()) {
            throw new BusinessException("Group/Company Not Found!");
        }
        return tenants;
    }

    @Override
    public List<TenantDTO> findAllTenantsByUserType(String userType, Integer userId) {
        if (userType == null || userType.isBlank()) {
            throw new BusinessException("Invalid identity type");
        }
        final String normalizedType = userType.trim().toLowerCase();
        // IT has no per-tenant assignment row to look up by userId (its user_id is always null) —
        // it sees every active tenant/group/company instead.
        if (!"it".equals(normalizedType) && userId == null) {
            throw new BusinessException("Invalid Login!");
        }

        return switch (normalizedType) {
            case "owner" -> tenantDao.findTenantFeaturesByOwnerId(userId);
            case "member" -> tenantDao.findTenantFeaturesByMemberId(userId);
            case "user" -> tenantDao.findTenantFeaturesByAdminId(userId);
            case "it" -> tenantDao.findAllActiveTenantFeatures();
            default -> throw new BusinessException("Invalid identity type");
        };
    }

    @Override
    public Map<String, Object> accessibleTenants(boolean all) {
        SessionUser user = AccessControlUtils.requireLoggedIn();

        String userType = String.valueOf(user.user_type).trim().toLowerCase();
        List<TenantDTO> rows = findAllTenantsByUserType(userType, user.user_id);

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> data = new ArrayList<>();
        LinkedHashSet<String> parentTenantCodes = new LinkedHashSet<>();

        Map<Integer, LocalDateTime> grantedAtByTenantId = new HashMap<>();
        for (TenantDTO row : rows) {
            if (row == null || row.getTenant() == null || row.getTenant().getId() == null) {
                continue;
            }
            LocalDateTime grantedAt = row.getGrantedAt();
            if (grantedAt == null) {
                continue;
            }
            grantedAtByTenantId.merge(row.getTenant().getId(), grantedAt,
                    (existing, candidate) -> candidate.isBefore(existing) ? candidate : existing);
        }

        for (Tenant tenant : TenantDtoHelper.distinctTenants(rows)) {
            if (tenant == null) {
                continue;
            }
            if (tenant.getExpirationDate() != null && tenant.getExpirationDate().isBefore(today)) {
                continue;
            }
            if (!all) {
                // Reserved: filter by session tenant_id / login_scope when needed.
            }

            boolean isGroup = tenant.getTenantType() == Tenant.TenantType.GROUP;
            String code = tenant.getCode() != null ? tenant.getCode().trim().toUpperCase() : "";
            String parentTenantCode = tenant.getParentGroupCode() != null
                    ? tenant.getParentGroupCode().trim().toUpperCase()
                    : null;

            Map<String, Object> ui = new LinkedHashMap<>();
            ui.put("tenant_id", tenant.getId());
            ui.put("tenant_code", code);
            ui.put("tenant_type", tenant.getTenantType() != null ? tenant.getTenantType().name() : null);
            ui.put("parent_tenant_code", isGroup ? code : parentTenantCode);
            ui.put("native_parent_tenant_code", isGroup ? code : parentTenantCode);
            ui.put("expiration_date", tenant.getExpirationDate());
            ui.put("granted_at", grantedAtByTenantId.get(tenant.getId()));
            data.add(ui);

            if (isGroup && !code.isBlank()) {
                parentTenantCodes.add(code);
            } else if (parentTenantCode != null && !parentTenantCode.isBlank()) {
                parentTenantCodes.add(parentTenantCode);
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "");
        body.put("data", data);
        body.put("accessible_parent_tenant_codes", new ArrayList<>(parentTenantCodes));
        return body;
    }

    @Override
    public Map<String, Object> tenantByCode(String code) {
        SessionUser user = AccessControlUtils.requireLoggedIn();
        String normalized = code == null ? null : code.trim().toUpperCase();
        if (normalized == null || normalized.isEmpty()) {
            throw new BusinessException("Invalid tenant code");
        }

        String userType = String.valueOf(user.user_type).trim().toLowerCase();
        List<TenantDTO> rows = findAllTenantsByUserType(userType, user.user_id);
        Tenant match = TenantDtoHelper.distinctTenants(rows).stream()
                .filter(t -> t != null && normalized.equalsIgnoreCase(t.getCode()))
                .findFirst()
                .orElse(null);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "");
        if (match == null) {
            body.put("data", null);
        } else {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("tenant_id", match.getId());
            data.put("tenant_code", match.getCode());
            data.put("tenant_type", match.getTenantType() != null ? match.getTenantType().name() : null);
            body.put("data", data);
        }
        return body;
    }

    @Override
    public SessionUser applyInitialSecondaryState(SessionUser sessionUser, LoginResultDTO result) {
        if (result.getIdentity().getOwner() != null) {
            if (!sessionUser.needs_owner_secondary) {
                return sessionUser.withSecondaryVerified();
            }
            return sessionUser;
        }
        if (result.getIdentity().getAdmin() != null && !sessionUser.needs_user_secondary) {
            return sessionUser.withSecondaryVerified();
        }
        return sessionUser;
    }

    @Override
    public void verifySecondaryPassword(String secondaryPassword, SessionUser current, String jti, long ttlMillis) {
        AccessControlUtils.requireLoggedIn(current);

        String userType = String.valueOf(current.user_type).trim().toLowerCase();
        if ("owner".equals(userType)) {
            if (!current.needs_owner_secondary) {
                return;
            }
            verifySecondaryPin(secondaryPassword, current.user_id, true);
        } else if ("user".equals(userType)) {
            if (!current.needs_user_secondary) {
                return;
            }
            verifySecondaryPin(secondaryPassword, current.user_id, false);
        } else {
            throw new BusinessException("Unauthorized");
        }

        authTokenStore.save(jti, current.withSecondaryVerified(), ttlMillis);
    }

    @Override
    public Map<String, Object> switchSessionTenant(int tenantId, SessionUser current, String jti, long ttlMillis) {
        AccessControlUtils.requireLoggedIn(current);
        if (tenantId <= 0) {
            throw new BusinessException("Missing tenant_id parameter");
        }
        if (!userCanAccessTenantId(current, tenantId)) {
            throw new BusinessException("No permission to access this company");
        }

        Tenant tenant = AssertUtils.requireFound(
                tenantDao.findTenantById(tenantId), "No permission to access this company");
        assertTenantNotExpired(tenant);

        List<FeatureModule> featureModules = tenantDao.findActiveFeatureModulesByTenantId(tenantId);
        SessionUser rebuilt = rebuildSessionUserWithTenant(current, tenant, featureModules);
        final boolean secondaryAlreadyVerified =
                !current.needs_owner_secondary && !current.needs_user_secondary;
        if (secondaryAlreadyVerified || (!rebuilt.needs_owner_secondary && !rebuilt.needs_user_secondary)) {
            rebuilt = rebuilt.withSecondaryVerified();
        }

        authTokenStore.save(jti, rebuilt, ttlMillis);

        final boolean hasGame = permissionService.hasGameModule(featureModules);
        final boolean hasBank = permissionService.hasBankModule(featureModules);
        final String code = tenant.getCode() != null ? tenant.getCode().trim().toUpperCase() : null;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("tenant_id", tenant.getId());
        data.put("tenant_code", code);
        data.put("has_game", hasGame);
        data.put("has_bank", hasBank);
        data.put("company_id", tenant.getId());
        data.put("company_code", code);
        data.put("has_gambling", hasGame);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Company updated");
        body.put("error", null);
        body.put("data", data);
        return body;
    }

    @Override
    public Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response) {
        String jti = resolveLogoutJti(request);
        if (StringUtils.hasText(jti)) {
            authTokenStore.delete(jti);
        }

        SessionUser currentUser = SecurityUtils.currentUser();
        if (currentUser != null && currentUser.user_id != null) {
            if ("user".equals(currentUser.user_type)) {
                authDao.updateAdminLastLogout(currentUser.user_id);
            } else if ("owner".equals(currentUser.user_type)) {
                authDao.updateOwnerLastLogout(currentUser.user_id);
            } else if ("member".equals((currentUser.user_type))) {
                authDao.updateMemberLastLogout(currentUser.user_id);
            }
        }

        AuthCookieHelper.clearAccessTokenCookie(response, jwtService);
        SecurityContextHolder.clearContext();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Logged out");
        return body;
    }

    // The account a password reset resolved to. scope = Redis scope (admin / owner); sessionUserType = SessionUser.user_type.
    private record ResetTarget(String scope, String sessionUserType, Integer id, String email) {}

    @Override
    public void sendResetTac(String role, String tenantCode, String loginId, String name, String email) {
        String scope = resetScope(role);
        String code = normalize(tenantCode);
        String normalizedEmail = normalizeEmail(email);
        if (code.isBlank() || normalizedEmail.isBlank()) {
            throw new BusinessException("Group/Company ID and email are required");
        }
        if (normalize(loginId).isBlank() && isBlank(name)) {
            throw new BusinessException("Login ID or name is required");
        }

        // A wrong company / login ID / name / email is reported to the user (strict), so he can fix it. This lets someone
        // probe whether an account exists; the resend cooldown below limits the mail, not the probing.
        findActiveTenantsByLoginCode(code);
        ResetTarget target = resolveResetTarget(scope, code, loginId, name, normalizedEmail, true);

        // Claimed only after the account is found, so a typo does not lock the user out for a minute.
        long remaining = passwordResetTacStore.tryClaimCooldown(scope, code + ":" + normalizedEmail);
        if (remaining > 0) {
            throw new BusinessException("Please wait " + remaining + "s before requesting another code");
        }

        String tac = generateTac();
        passwordResetTacStore.saveCode(target.scope(), String.valueOf(target.id()), tac);
        passwordResetMailService.sendResetCode(target.email(), tac);
    }

    @Override
    public void resetPassword(String role, String tenantCode, String loginId, String name, String email, String tac, String newPassword) {
        String scope = resetScope(role);
        String code = normalize(tenantCode);
        String normalizedEmail = normalizeEmail(email);
        String trimmedTac = tac == null ? "" : tac.trim();

        if (code.isBlank() || normalizedEmail.isBlank() || trimmedTac.isBlank()) {
            throw new BusinessException("Group/Company ID, email and TAC are required");
        }
        if (normalize(loginId).isBlank() && isBlank(name)) {
            throw new BusinessException("Login ID or name is required");
        }
        // Checked before the code is spent, so a rejected password does not cost the user a new code.
        validateNewPassword(newPassword);

        ResetTarget target = resolveResetTarget(scope, code, loginId, name, normalizedEmail, false);
        if (target == null || !passwordResetTacStore.verifyAndConsume(target.scope(), String.valueOf(target.id()), trimmedTac)) {
            throw new BusinessException("Verification code is invalid or expired");
        }

        String encoded = passwordEncoder.encode(newPassword);
        if (RESET_SCOPE_OWNER.equals(target.scope())) {
            authDao.updateOwnerPassword(target.id(), encoded);
        } else {
            authDao.updateAdminPassword(target.id(), encoded);
        }
        // Only the primary password changes; the secondary password is left as it is (changing it goes through support).
        authTokenStore.deleteAllForUser(target.sessionUserType(), target.id());
        passwordResetMailService.sendPasswordChangedNotice(target.email());
    }

    /**
     * Finds the account a reset request names. The account is found by login ID (admin: login_id of that company, owner:
     * owner_code) or, without one, by name + email; the email must in every case be the one on the account, and the account
     * must have access to the tenant. More than one owner with the same email and name counts as not found.
     * strict = say what is wrong (send-reset-tac); otherwise return null (reset-password, where the code decides).
     */
    private ResetTarget resolveResetTarget(String scope, String code, String loginId, String name, String normalizedEmail, boolean strict) {
        String id = normalize(loginId);
        boolean byId = !id.isBlank();
        if (RESET_SCOPE_OWNER.equals(scope)) {
            Owner owner;
            if (byId) {
                owner = authDao.findOwnerByOwnerCode(id);
                if (owner == null) {
                    return reject(strict, "Login ID not found");
                }
                if (!normalizedEmail.equals(normalizeEmail(owner.getEmail()))) {
                    return reject(strict, "Email does not match this account");
                }
            } else {
                List<Owner> sameEmail = authDao.findOwnersByEmail(normalizedEmail);
                if (sameEmail.isEmpty()) {
                    return reject(strict, "Email not found");
                }
                List<Owner> matches = sameEmail.stream().filter(o -> sameName(o.getName(), name)).toList();
                if (matches.isEmpty()) {
                    return reject(strict, "Name does not match this email");
                }
                if (matches.size() > 1) {
                    return reject(strict, "More than one account matches, please use your Login ID");
                }
                owner = matches.get(0);
            }
            if (findAccessibleTenantsByOwnerId(owner.getId(), code).isEmpty()) {
                return reject(strict, "You do not have access to this Company or Group");
            }
            return new ResetTarget(RESET_SCOPE_OWNER, "owner", owner.getId(), owner.getEmail());
        }

        // user.email is unique, so by name the email alone finds the one admin.
        Admin admin = byId ? authDao.findAdminByLoginId(id, code) : authDao.findAdminByEmail(normalizedEmail);
        if (admin == null) {
            return reject(strict, byId ? "Login ID not found" : "Email not found");
        }
        if (byId && !normalizedEmail.equals(normalizeEmail(admin.getEmail()))) {
            return reject(strict, "Email does not match this account");
        }
        if (!byId && !sameName(admin.getName(), name)) {
            return reject(strict, "Name does not match this email");
        }
        if (findAccessibleTenantsByAdminId(admin.getId(), code).isEmpty()) {
            return reject(strict, "You do not have access to this Company or Group");
        }
        return new ResetTarget(RESET_SCOPE_ADMIN, "user", admin.getId(), admin.getEmail());
    }

    private static ResetTarget reject(boolean strict, String message) {
        if (strict) {
            throw new BusinessException(message);
        }
        return null;
    }

    private static String resetScope(String role) {
        String value = role == null ? "" : role.trim().toLowerCase();
        if (RESET_SCOPE_ADMIN.equals(value) || RESET_SCOPE_OWNER.equals(value)) {
            return value;
        }
        throw new BusinessException("Invalid role");
    }

    // No strength rules on purpose (same as creating an account). Only the bcrypt limit stays: it reads the first 72 bytes only.
    private static void validateNewPassword(String newPassword) {
        if (newPassword == null || newPassword.isEmpty()) {
            throw new BusinessException("New password is required");
        }
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new BusinessException("Password is too long");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean sameName(String stored, String given) {
        return !isBlank(stored) && !isBlank(given) && stored.trim().equalsIgnoreCase(given.trim());
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String generateTac() {
        return String.format("%06d", TAC_RANDOM.nextInt(1_000_000));
    }

    private LoginResultDTO buildLoginResult(UserDTO identity, Tenant loginTenant, Tenant sessionTenant) {
        LoginResultDTO result = new LoginResultDTO();
        result.setIdentity(identity);
        result.setLoginTenant(loginTenant);
        result.setSessionTenant(sessionTenant);
        if (sessionTenant != null && sessionTenant.getId() != null) {
            result.setSessionFeatureModules(
                    tenantDao.findActiveFeatureModulesByTenantId(sessionTenant.getId()));
        } else {
            result.setSessionFeatureModules(List.of());
        }

        if (identity.getUser() != null) {
            result.setUserType("member");
            result.setRedirect("/member");
            return result;
        }
        if (identity.getAdmin() != null) {
            result.setUserType("user");
            result.setRedirect(SecondaryPasswordUtils.isConfigured(identity.getAdmin().getSecondaryPassword())
                    ? "/user-secondary-password"
                    : "/dashboard");
            return result;
        }
        if (identity.getOwner() != null) {
            result.setUserType("owner");
            result.setRedirect(SecondaryPasswordUtils.isConfigured(identity.getOwner().getSecondaryPassword())
                    ? "/owner-secondary-password"
                    : "/dashboard");
            return result;
        }
        if (identity.getItOperator() != null) {
            result.setUserType("it");
            // TEMP landing page until the unrestricted-dashboard-access work ships —
            // see the IT-role design discussion. No secondary-password step for IT.
            result.setRedirect("/audit-log");
            return result;
        }

        throw new BusinessException("Invalid login result");
    }

    private void verifySecondaryPin(String secondaryPassword, Integer userId, boolean owner) {
        String pin = secondaryPassword == null ? "" : secondaryPassword.trim();
        if (pin.isEmpty()) {
            throw new BusinessException("Please enter secondary password");
        }
        if (!pin.matches("^\\d{6}$")) {
            throw new BusinessException("Secondary password must be exactly 6 digits");
        }

        String storedHash;
        if (owner) {
            Owner row = authDao.findOwnerSecondaryPasswordById(userId);
            storedHash = row != null ? row.getSecondaryPassword() : null;
        } else {
            Admin row = authDao.findAdminSecondaryPasswordById(userId);
            storedHash = row != null ? row.getSecondaryPassword() : null;
        }

        if (storedHash == null || storedHash.isBlank()) {
            return;
        }
        if (!verifyPassword(pin, storedHash)) {
            throw new BusinessException("Secondary password is incorrect");
        }
        if (isArgon2Hash(storedHash)) {
            String rehashed = passwordEncoder.encode(pin);
            if (owner) {
                authDao.updateOwnerSecondaryPassword(userId, rehashed);
            } else {
                authDao.updateAdminSecondaryPassword(userId, rehashed);
            }
        }
    }

    private static Map<String, Object> toTenantMap(Tenant tenant) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (tenant == null) {
            return map;
        }
        map.put("id", tenant.getId());
        map.put("code", tenant.getCode());
        map.put("type", tenant.getTenantType() != null ? tenant.getTenantType().name() : null);
        map.put("name", tenant.getName());
        map.put("parent_id", tenant.getParentId());
        String parentCode = tenant.getParentGroupCode();
        map.put("parent_code", parentCode != null && !parentCode.isBlank()
                ? parentCode.trim().toUpperCase()
                : null);
        return map;
    }

    private Tenant resolveLoginTenant(List<Tenant> candidates, String tenantCodeInput) {
        String code = normalize(tenantCodeInput);

        for (Tenant tenant : candidates) {
            if (code.equalsIgnoreCase(Objects.toString(tenant.getCode(), ""))
                    && tenant.getTenantType() == Tenant.TenantType.GROUP) {
                return tenant;
            }
        }

        for (Tenant tenant : candidates) {
            if (code.equalsIgnoreCase(Objects.toString(tenant.getCode(), ""))) {
                return tenant;
            }
        }

        Tenant groupContext = new Tenant();
        groupContext.setCode(code);
        groupContext.setName(code);
        groupContext.setTenantType(Tenant.TenantType.GROUP);
        return groupContext;
    }

    private boolean userCanAccessTenantId(SessionUser user, int tenantId) {
        return userCanAccessTenantIds(user, List.of(tenantId));
    }

    @Override
    public void requireAccessibleTenants(Collection<Integer> tenantIds) {
        SessionUser user = AccessControlUtils.requireLoggedIn();
        if (!userCanAccessTenantIds(user, tenantIds)) {
            throw new BusinessException("No permission to access this Group/Company");
        }
    }

    // True only when every id is a non-expired tenant the user may open.
    private boolean userCanAccessTenantIds(SessionUser user, Collection<Integer> tenantIds) {
        if (user == null) {
            return false;
        }
        final LocalDate today = LocalDate.now();
        if (AccessControlUtils.isItOperator(user.role)) {
            // IT has no per-tenant assignment row to check against (it is a separate track from
            // the admin/user permission system) — any active, non-expired tenant is in scope.
            for (Integer tenantId : tenantIds) {
                Tenant tenant = tenantId == null ? null : tenantDao.findTenantById(tenantId);
                if (tenant == null
                        || (tenant.getExpirationDate() != null && tenant.getExpirationDate().isBefore(today))) {
                    return false;
                }
            }
            return true;
        }
        if (user.user_id == null) {
            return false;
        }
        final String userType = String.valueOf(user.user_type).trim().toLowerCase();
        final List<TenantDTO> rows = findAllTenantsByUserType(userType, user.user_id);
        final Set<Integer> allowed = new HashSet<>();
        for (TenantDTO row : rows) {
            if (row == null || row.getTenant() == null || row.getTenant().getId() == null) {
                continue;
            }
            Tenant tenant = row.getTenant();
            if (tenant.getExpirationDate() == null || !tenant.getExpirationDate().isBefore(today)) {
                allowed.add(tenant.getId());
            }
        }
        for (Integer tenantId : tenantIds) {
            if (tenantId == null || !allowed.contains(tenantId)) {
                return false;
            }
        }
        return true;
    }

    private SessionUser rebuildSessionUserWithTenant(SessionUser current, Tenant tenant, List<FeatureModule> featureModules) {
        final String userType = String.valueOf(current.user_type).trim().toLowerCase();
        UserDTO identity = new UserDTO();
        if ("member".equals(userType)) {
            // account_id may repeat across tenants — rebuild by PK, not login code
            identity.setUser(requireFound(
                    authDao.findMemberById(current.user_id),
                    User::getId,
                    "User Not Found!"));
        } else if ("it".equals(userType)) {
            // IT has no DB row to rebuild by PK — re-resolve from the same registry login() uses.
            ItOperatorProperties.Operator itOperator = itOperatorRegistry.findByUsername(current.login_id);
            if (itOperator == null) {
                throw new BusinessException("IT operator not found");
            }
            identity.setItOperator(new ItOperatorIdentity(itOperator.getUsername(), itOperator.getDisplayName()));
        } else if ("user".equals(userType)) {
            // login_id may repeat across companies — rebuild by PK, not login_id
            identity.setAdmin(requireFound(
                    authDao.findAdminById(current.user_id),
                    Admin::getId,
                    "Admin Not Found!"));
        } else {
            identity = requireIdentity(userType, current.login_id);
        }
        identity.setTenant(tenant);
        return SessionUser.from(identity, tenant, featureModules, permissionService);
    }

    private static <T> T requireFound(T entity, Function<T, ?> key, String notFoundMessage) {
        if (entity == null || key.apply(entity) == null) {
            throw new BusinessException(notFoundMessage);
        }
        return entity;
    }

    private boolean verifyPassword(String raw, String stored) {
        if (stored == null || stored.isBlank()) {
            return false;
        }
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            return passwordEncoder.matches(raw, stored);
        }
        if (isArgon2Hash(stored)) {
            return argon2PasswordEncoder.matches(raw, stored);
        }
        return raw.equals(stored);
    }

    private static boolean isArgon2Hash(String stored) {
        return stored != null && stored.startsWith("$argon2");
    }

    private void assertTenantNotExpired(Tenant tenant) {
        if (tenant == null) {
            throw new BusinessException("Invalid tenant");
        }
        if (tenant.getExpirationDate() != null
                && tenant.getExpirationDate().isBefore(LocalDate.now())) {
            throw new BusinessException("Company or Group has expired.");
        }
    }

    private void requireNotUnderMaintenance() {
        if (systemMaintenanceModeService.isEnabled()) {
            throw new BusinessException(
                    "System is currently under maintenance. Please try again later.",
                    Map.of("maintenanceMode", true));
        }
    }

    private String resolveLogoutJti(HttpServletRequest request) {
        return SecurityUtils.currentPrincipal()
                .map(LoginUserPrincipal::jti)
                .orElseGet(() -> extractJtiFromRequest(request));
    }

    private String extractJtiFromRequest(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) {
            return null;
        }

        final String cookieName = jwtService.getCookieName();
        for (Cookie cookie : request.getCookies()) {
            if (!cookieName.equals(cookie.getName()) || !StringUtils.hasText(cookie.getValue())) {
                continue;
            }
            try {
                Claims claims = jwtService.parseToken(cookie.getValue().trim());
                return claims.getId();
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.trim().toUpperCase();
    }
}
