package com.eazycount.websocket;

import java.util.Arrays;
import java.util.Optional;

/*
 * 要跟前端的 {@code REALTIME_DOMAINS}（Count-frontend/src/lib/realtime/realtimeEvents.js）
 * 保持一致——这里的 {@code wireName} 会出现在 STOMP 频道地址和消息体的 {@code domain}
 * 字段里，两边改一个另一边也要跟着改。
 */
public enum RealtimeDomain {
    LEDGER("ledger"),
    ACCOUNTS("accounts"),
    PROCESSES("processes"),
    DATACAPTURE("datacapture"),
    OWNERSHIP("ownership"),
    USERS("users"),
    MAINTENANCE("maintenance"),
    ANNOUNCEMENTS("announcements"),
    DOMAIN("domain"),
    APP("app"),

    // 跟其它 domain 不一样，这个不是"数据变了去刷新缓存"，而是一条强制登出命令。
    // IT 打开系统维护/踢人开关时广播一次（见 SystemMaintenanceModeServiceImpl.setEnabled）。前端用专门的监听器处理（直接跳转登录页），不走通用的缓存失效规则。
    SESSION_KICK("session_kick");

    private final String wireName;

    RealtimeDomain(String wireName) {
        this.wireName = wireName;
    }

    public String wireName() {
        return wireName;
    }

    public static Optional<RealtimeDomain> fromWireName(String value) {
        if (value == null) {
            return Optional.empty();
        }
        return Arrays.stream(values())
                .filter(d -> d.wireName.equalsIgnoreCase(value.trim()))
                .findFirst();
    }
}
