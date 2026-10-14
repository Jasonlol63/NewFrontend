package com.eazycount.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;

@Service
public class AuthTokenStore {

    private static final String KEY_PREFIX = "ec:auth:";
    // jti index per account; outlives the longest session (the JWT's 7-day outer cap).
    private static final String USER_SESSIONS_PREFIX = "ec:auth-user-sessions:";
    private static final Duration USER_SESSIONS_TTL = Duration.ofDays(8);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public AuthTokenStore(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    public void save(String jti, SessionUser user, long ttlMillis) {
        try {
            final String json = objectMapper.writeValueAsString(user);
            redis.opsForValue().set(key(jti), json, Duration.ofMillis(ttlMillis));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize session user", e);
        }
        if (user.user_id != null && user.user_type != null) {
            final String indexKey = userSessionsKey(user.user_type, user.user_id);
            redis.opsForSet().add(indexKey, jti);
            redis.expire(indexKey, USER_SESSIONS_TTL);
        }
    }

    /** Ends every session of one account (e.g. after a password reset). IT operators have no id and are not indexed. */
    public void deleteAllForUser(String userType, Integer userId) {
        if (userType == null || userId == null) {
            return;
        }
        final String indexKey = userSessionsKey(userType, userId);
        final Set<String> jtis = redis.opsForSet().members(indexKey);
        if (jtis != null) {
            jtis.forEach(this::delete);
        }
        redis.delete(indexKey);
    }

    public Optional<SessionUser> find(String jti) {
        final String json = redis.opsForValue().get(key(jti));
        if (json == null || json.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, SessionUser.class));
        } catch (JsonProcessingException e) {
            return Optional.empty();
        }
    }

    /** Slides the idle-timeout window forward on activity, without rewriting the stored session. */
    public void touch(String jti, long ttlMillis) {
        redis.expire(key(jti), Duration.ofMillis(ttlMillis));
    }

    public void delete(String jti) {
        redis.delete(key(jti));
    }

    private static String key(String jti) {
        return KEY_PREFIX + jti;
    }

    private static String userSessionsKey(String userType, Integer userId) {
        return USER_SESSIONS_PREFIX + userType + ":" + userId;
    }
}
