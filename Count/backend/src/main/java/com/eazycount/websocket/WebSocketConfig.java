package com.eazycount.websocket;

import com.eazycount.config.SecurityConfig;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/*
 * STOMP over WebSocket 的连接层，负责实时推送（对应前端 Count-frontend/src/lib/realtime，这里就是喂数据给那边的事件总线）。
 * 客户端直接用原生 WebSocket 连 /ws（没用 SockJS——前端本来就没引入 sockjs-client，都是靠 @stomp/stompjs 直连的，这层完全用不上，去掉更省事），
 * 订阅{/topic/company/{companyId}/{domain}}，业务事务提交后由 SimpMessagingTemplate 往这个地址推消息。
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final PrincipalHandshakeInterceptor principalHandshakeInterceptor;
    private final StompSubscriptionAuthInterceptor stompSubscriptionAuthInterceptor;

    public WebSocketConfig(
            PrincipalHandshakeInterceptor principalHandshakeInterceptor,
            StompSubscriptionAuthInterceptor stompSubscriptionAuthInterceptor
    ) {
        this.principalHandshakeInterceptor = principalHandshakeInterceptor;
        this.stompSubscriptionAuthInterceptor = stompSubscriptionAuthInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setHandshakeHandler(new PrincipalHandshakeHandler())
                .addInterceptors(principalHandshakeInterceptor)
                .setAllowedOrigins(SecurityConfig.ALLOWED_ORIGINS.toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompSubscriptionAuthInterceptor);
    }
}
