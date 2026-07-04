package com.dream.basketball.config;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.AbstractSubProtocolEvent;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Online-presence registry driven by STOMP connect/disconnect events.
 *
 * A logged-in user holds one WebSocket connection while the app is open (opened in AppLayout on
 * login, see pmSocket.js), so "online" == "has at least one live WS connection". We count
 * connections per user (multiple tabs → count > 1) and treat count > 0 as online. The STOMP
 * session Principal name is the userId (set in WebSocketConfig.determineUser).
 */
@Component
public class PresenceService {

    private final Map<String, Integer> connectionCounts = new ConcurrentHashMap<>();

    public boolean isOnline(String userId) {
        return userId != null && connectionCounts.getOrDefault(userId, 0) > 0;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        String userId = userOf(event);
        if (userId != null) {
            connectionCounts.merge(userId, 1, Integer::sum);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String userId = userOf(event);
        if (userId != null) {
            connectionCounts.computeIfPresent(userId, (k, v) -> v <= 1 ? null : v - 1);
        }
    }

    private String userOf(AbstractSubProtocolEvent event) {
        Principal p = event.getUser();
        return p == null ? null : p.getName();
    }
}
