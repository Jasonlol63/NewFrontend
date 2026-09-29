package com.eazycount.websocket;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/*
 * 把已提交的RealtimeDomainEvent 转成真正的 STOMP 广播。
 * 一定要等事务提交后再广播（{@code AFTER_COMMIT}）：不然客户端收到通知立刻发请求，可能查到的还是改之前的数据。
 * fallbackExecution = true是为了让没有事务的调用方（比如定时任务）也能正常触发广播。
 */
@Component
public class RealtimeBroadcastListener {

    private final SimpMessagingTemplate messagingTemplate;

    public RealtimeBroadcastListener(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRealtimeDomainEvent(RealtimeDomainEvent event) {
        final String destination = event.companyId() != null
                ? RealtimeDestinations.companyTopic(event.companyId(), event.domain())
                : RealtimeDestinations.globalTopic(event.domain());
        messagingTemplate.convertAndSend(destination, new Payload(
                "domain_changed",
                event.domain().wireName(),
                event.source(),
                event.rev(),
                event.ts()
        ));
    }

    /* 消息格式要跟前端 realtimeEvents.js 的 {@code dispatchRealtimeInvalidate} 对上。 */
    private record Payload(String type, String domain, String source, String rev, long ts) {
    }
}
