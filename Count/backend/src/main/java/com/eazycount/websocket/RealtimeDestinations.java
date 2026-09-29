package com.eazycount.websocket;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * 生成/解析两种频道地址：
 * - /topic/company/{id}/{domain} —— 按公司隔离，比如流水、账户
 * - /topic/global/{domain} —— 全平台共用，比如通告（所有公司看到同一份）
 */
public final class RealtimeDestinations {

    // domain 名字里 session_kick 带下划线，正则要允许下划线
    private static final Pattern COMPANY_TOPIC = Pattern.compile("^/topic/company/(\\d+)/([a-zA-Z_]+)$");
    private static final Pattern GLOBAL_TOPIC = Pattern.compile("^/topic/global/([a-zA-Z_]+)$");

    private RealtimeDestinations() {
    }

    public static String companyTopic(Integer companyId, RealtimeDomain domain) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required");
        }
        return "/topic/company/" + companyId + "/" + domain.wireName();
    }

    public static String globalTopic(RealtimeDomain domain) {
        return "/topic/global/" + domain.wireName();
    }

    public record ParsedDestination(Integer companyId, RealtimeDomain domain) {
    }

    /* 格式不对就返回空。 */
    public static Optional<ParsedDestination> parseCompanyTopic(String destination) {
        if (destination == null) {
            return Optional.empty();
        }
        final Matcher matcher = COMPANY_TOPIC.matcher(destination.trim());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        return RealtimeDomain.fromWireName(matcher.group(2))
                .map(domain -> new ParsedDestination(Integer.valueOf(matcher.group(1)), domain));
    }

    /* 格式不对就返回空。 */
    public static Optional<RealtimeDomain> parseGlobalTopic(String destination) {
        if (destination == null) {
            return Optional.empty();
        }
        final Matcher matcher = GLOBAL_TOPIC.matcher(destination.trim());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        return RealtimeDomain.fromWireName(matcher.group(1));
    }
}
