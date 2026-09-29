package com.eazycount.websocket;

import java.time.Instant;
import java.util.UUID;

/* 一次广播事件。companyId 为空就发到全局频道，否则发到对应公司的频道。 */
public record RealtimeDomainEvent(Integer companyId, RealtimeDomain domain, String source, String rev, long ts) {

    public RealtimeDomainEvent(Integer companyId, RealtimeDomain domain, String source) {
        this(companyId, domain, source, UUID.randomUUID().toString(), Instant.now().toEpochMilli());
    }
}
