package com.eazycount.websocket;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

/* 把 PrincipalHandshakeInterceptor 暂存的登录身份，绑定为这条 STOMP 连接的用户。 */
public class PrincipalHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        final Object principal = attributes.get(PrincipalHandshakeInterceptor.PRINCIPAL_ATTR);
        return principal instanceof Principal p ? p : null;
    }
}
