package com.eazycount.websocket;

import com.eazycount.security.LoginUserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/*
 * WebSocket 握手本质上还是一次普通 HTTP 请求，JwtAuthTokenFilter 已经从ec_access_token 这个 httpOnly cookie 里认证过了
 *（前端没法把 token 塞进STOMP CONNECT header，只能靠这个 cookie）。但这个认证状态只在这次请求里有效——连接升级成功后，
 * 后续的 STOMP 帧（SUBSCRIBE/SEND）不会再走一遍过滤器链。这个拦截器把已认证的身份存进握手的 attributes，
 * 交给 PrincipalHandshakeHandler绑定到 STOMP 连接上；没登录的话直接拒绝升级。
 */
@Component
public class PrincipalHandshakeInterceptor implements HandshakeInterceptor {

    static final String PRINCIPAL_ATTR = "ec.principal";

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        final Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof LoginUserPrincipal principal)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        attributes.put(PRINCIPAL_ATTR, new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // 不需要处理
    }
}
