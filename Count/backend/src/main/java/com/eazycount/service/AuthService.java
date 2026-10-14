package com.eazycount.service;

import com.eazycount.dto.AdminTenantDTO;
import com.eazycount.dto.LoginResultDTO;
import com.eazycount.dto.OwnerTenantDTO;
import com.eazycount.dto.TenantDTO;
import com.eazycount.dto.UserDTO;
import com.eazycount.dto.UserTenantDTO;
import com.eazycount.entity.Tenant;
import com.eazycount.security.SessionUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.List;
import java.util.Map;

public interface AuthService {

    List<OwnerTenantDTO> findAccessibleTenantsByOwnerId(Integer ownerId, String tenantCode);

    List<AdminTenantDTO> findAccessibleTenantsByAdminId(Integer adminId, String tenantCode);

    List<UserTenantDTO> findAccessibleTenantsByMemberId(Integer userId, String tenantCode);

    List<TenantDTO> findAllTenantsByUserType(String userType, Integer userId);

    Map<String, Object> accessibleTenants(boolean all);

    // Throws unless the logged-in user may open every given tenant (same rule as switch-tenant).
    // Loads the user's tenants once, so a long id list is not one query per id.
    void requireAccessibleTenants(java.util.Collection<Integer> tenantIds);

    Map<String, Object> tenantByCode(String code);

    UserDTO requireIdentity(String userType, String identifier);

    List<Tenant> findActiveTenantsByLoginCode(String tenantCode);

    LoginResultDTO login(String tenantCode, String username, String password, LoginRole role);

    Map<String, Object> toLoginResponse(LoginResultDTO result);

    SessionUser applyInitialSecondaryState(SessionUser sessionUser, LoginResultDTO result);

    void verifySecondaryPassword(String secondaryPassword, SessionUser current, String jti, long ttlMillis);

    Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response);

    Map<String, Object> switchSessionTenant(int tenantId, SessionUser current, String jti, long ttlMillis);

    // Sends a password reset TAC to the email of an Admin ("admin") or Owner ("owner") account of the given tenant.
    // The account is found by loginId, or (when loginId is blank) by name + email.
    void sendResetTac(String role, String tenantCode, String loginId, String name, String email);

    // Checks the TAC without using it up (the reset page's code step); throws if it is wrong or expired.
    void verifyResetTac(String role, String tenantCode, String loginId, String name, String email, String tac);

    // Verifies the TAC (one-time use), sets the new primary password and ends the account's sessions. The secondary password is never touched.
    void resetPassword(String role, String tenantCode, String loginId, String name, String email, String tac, String newPassword);
}
