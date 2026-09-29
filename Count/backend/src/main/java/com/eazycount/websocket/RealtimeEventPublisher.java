package com.eazycount.websocket;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/*
 * 业务 Service 用来"广播一下：这个公司/这个 domain 有东西变了"的入口。
 * 调用方发完即忘——真正的 WebSocket 广播会等外层事务提交后才发出（见 RealtimeBroadcastListener），写完库直接调用这个方法就行，不用操心顺序问题。
 * source 建议用简短的 snake_case 标签描述是哪个写入动作触发的（比如"announcement_create"、"post_to_transaction"）——尽量跟前端
 * LEDGER_TOUCHING_SOURCES 和 AppRealtimeBridge.jsx 里各 domain 的处理逻辑用同一套命名，因为前端会按这个字符串判断行为。
 */
@Component
public class RealtimeEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;

    public RealtimeEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    /* 广播到这个 companyId 对应的、按租户隔离的频道。 */
    public void publish(Integer companyId, RealtimeDomain domain, String source) {
        if (companyId == null || domain == null) {
            return;
        }
        applicationEventPublisher.publishEvent(new RealtimeDomainEvent(companyId, domain, source));
    }

    /* 广播到这个 domain 的全局频道（不分租户）——比如通告。 */
    public void publishGlobal(RealtimeDomain domain, String source) {
        if (domain == null) {
            return;
        }
        applicationEventPublisher.publishEvent(new RealtimeDomainEvent(null, domain, source));
    }
}
