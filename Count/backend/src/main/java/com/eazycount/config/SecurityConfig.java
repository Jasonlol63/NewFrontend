package com.eazycount.config;

import com.eazycount.handler.AccessDeniedHandlerImpl;
import com.eazycount.handler.AuthenticationEntryPointImpl;
import com.eazycount.jwt.JwtAuthTokenFilter;
import com.eazycount.jwt.JwtService;
import com.eazycount.security.LoginUserPrincipal;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(JwtService.class)
public class SecurityConfig {

    private static final String[] PUBLIC_URLS = {
            "/auth/login",
            "/auth/logout",
            "/auth/send-reset-tac",
            "/auth/reset-password",
            "/api/announcement/getMaintenanceInLogin",
            "/api/settings/getTelegramLink",
    };

    private static final String[] C168_ONLY_URLS = {
            "/api/domain/**",
            "/api/auto-renew/**",
            "/api/announcement/listAnnouncement",
            "/api/announcement/listMaintenance",
            "/api/announcement/addAnnouncementContent",
            "/api/announcement/addMaintenanceContent",
            "/api/announcement/updateAnnouncement",
            "/api/announcement/updateMaintenance",
            "/api/announcement/deleteAnnouncement",
            "/api/announcement/deleteMaintenance",
    };

    /** Grants only sessions whose CURRENT company is C168 (switch-tenant rebuilds the session, so this follows the company); everyone else gets 403 via AccessDeniedHandlerImpl. */
    private static final AuthorizationManager<RequestAuthorizationContext> C168_ONLY = (authentication, context) -> {
        Authentication auth = authentication.get();
        boolean granted = auth != null
                && auth.getPrincipal() instanceof LoginUserPrincipal principal
                && principal.user().is_current_tenant_c168;
        return new AuthorizationDecision(granted);
    };

    /** Shared with {@code com.eazycount.websocket.WebSocketConfig} so the STOMP endpoint accepts the same origins. */
    public static final List<String> ALLOWED_ORIGINS = List.of(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "https://count168.site",
            "https://www.count168.site",
            "https://cf.count168.site"
    );

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public Argon2PasswordEncoder argon2PasswordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            JwtAuthTokenFilter jwtAuthTokenFilter,
            AuthenticationEntryPointImpl authenticationEntryPoint,
            AccessDeniedHandlerImpl accessDeniedHandler
    ) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(PUBLIC_URLS).permitAll()
                        // C168-only: Domain / Auto Renew / Announcement management. Kept in one place so a new
                        // endpoint under these prefixes is protected by default. The announcement endpoints
                        // every user needs (getDashboardAnnouncements, unreadCount, markRead) are not listed.
                        .requestMatchers(C168_ONLY_URLS).access(C168_ONLY)
                        // Defense in depth: every other endpoint at minimum requires a valid session.
                        // Role/hierarchy/read-only enforcement itself happens at the service layer
                        // (AccessControlUtils) — this line only closes the "no session at all" gap.
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(ALLOWED_ORIGINS);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
