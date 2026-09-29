package com.eazycount.websocket;

import com.eazycount.security.LoginUserPrincipal;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

/*
 * 订阅（SUBSCRIBE）时校验租户隔离：只能订阅自己会话所在公司的 /topic/company/{companyId}/...频道
 * （IT 账号的tenant_id会跟着当前所在的公司变，跟其他角色一样——见SessionUser.fromItOperator）。
 * CONNECT 阶段已经被PrincipalHandshakeInterceptor拦过一次了（没登录直接拒绝握手），这里只需要处理 SUBSCRIBE。
 */
@Component
public class StompSubscriptionAuthInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        final StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (accessor.getCommand() != StompCommand.SUBSCRIBE) {
            return message;
        }

        final LoginUserPrincipal principal = resolvePrincipal(accessor);
        if (principal == null) {
            throw new AccessDeniedException("No authenticated session for this WebSocket subscription");
        }

        final String destination = accessor.getDestination();
        final var companyTopic = RealtimeDestinations.parseCompanyTopic(destination);
        if (companyTopic.isPresent()) {
            final Integer sessionTenantId = principal.user().tenant_id;
            if (sessionTenantId == null || !sessionTenantId.equals(companyTopic.get().companyId())) {
                throw new AccessDeniedException(
                        "Session is not scoped to company " + companyTopic.get().companyId());
            }
            return message;
        }

        // 全局频道（比如通告）不用查租户，只要登录了就能订阅。除了这两种已知格式，
        // 其它一律拒绝，避免客户端瞎猜地址探测。
        if (RealtimeDestinations.parseGlobalTopic(destination).isPresent()) {
            return message;
        }

        throw new AccessDeniedException("Unrecognized realtime destination: " + destination);
    }

    private LoginUserPrincipal resolvePrincipal(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof LoginUserPrincipal principal) {
            return principal;
        }
        return null;
    }
}
