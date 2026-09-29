package com.eazycount.service.impl;

import com.eazycount.audit.AuditContext;
import com.eazycount.audit.Audited;
import com.eazycount.dao.SystemMaintenanceModeDao;
import com.eazycount.entity.AuditLog;
import com.eazycount.security.SecurityUtils;
import com.eazycount.service.SystemMaintenanceModeService;
import com.eazycount.util.AccessControlUtils;
import com.eazycount.websocket.RealtimeDomain;
import com.eazycount.websocket.RealtimeEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class SystemMaintenanceModeServiceImpl implements SystemMaintenanceModeService {

    private static final String REDIS_KEY = "ec:maintenance:enabled";
    private static final String ENTITY_ID = "system_maintenance_mode";

    @Autowired
    private SystemMaintenanceModeDao systemMaintenanceModeDao;
    @Autowired
    private StringRedisTemplate redisTemplate;
    @Autowired
    private RealtimeEventPublisher realtimeEventPublisher;

    @Override
    public boolean isEnabled() {
        String cached = redisTemplate.opsForValue().get(REDIS_KEY);
        if (cached != null) {
            return "1".equals(cached);
        }
        boolean enabled = Boolean.TRUE.equals(systemMaintenanceModeDao.findEnabled());
        redisTemplate.opsForValue().set(REDIS_KEY, enabled ? "1" : "0");
        return enabled;
    }

    @Override
    @Audited(module = "SYSTEM_MAINTENANCE", action = AuditLog.Action.UPDATE, entityIdExpr = "'" + ENTITY_ID + "'", sourceTable = "system_maintenance_mode")
    public void setEnabled(boolean enabled) {
        AccessControlUtils.requireItOperator(SecurityUtils.currentUser());

        AuditContext.captureBefore(ENTITY_ID, Map.of("enabled", isEnabled()));
        systemMaintenanceModeDao.updateEnabled(enabled);
        redisTemplate.opsForValue().set(REDIS_KEY, enabled ? "1" : "0");
        AuditContext.captureAfter(ENTITY_ID, Map.of("enabled", enabled));
        AuditContext.captureSummary(ENTITY_ID, (enabled ? "开启" : "关闭") + "维护模式");

        // Turning it off doesn't need to push anything — only the "everyone gets kicked out
        // right now" direction needs a realtime nudge. IT itself is exempt on the frontend,
        // same as JwtAuthTokenFilter's per-request check.
        if (enabled) {
            realtimeEventPublisher.publishGlobal(RealtimeDomain.SESSION_KICK, "maintenance_mode_enabled");
        }
    }
}
