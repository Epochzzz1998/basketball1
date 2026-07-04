package com.dream.basketball.config;

import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import javax.servlet.http.HttpSession;
import java.security.Principal;
import java.util.Map;

/**
 * STOMP over WebSocket for private messages (P5).
 *
 * Design: clients NEVER send business frames over the socket — writes go through REST
 * (/pm/send etc.), the socket is a pure server->client push channel. Each logged-in user
 * subscribes to "/user/queue/pm" and the server targets them with convertAndSendToUser(userId, ...).
 *
 * Auth: the WS handshake is a plain HTTP request carrying the session cookie, so we read the
 * login state from the HttpSession — unauthenticated handshakes are rejected outright, and the
 * logged-in userId becomes the STOMP session Principal (that's what routes /user/... destinations).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /** handshake attribute key carrying the authenticated userId into determineUser() */
    private static final String WS_USER_ID = "WS_USER_ID";

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new HandshakeInterceptor() {
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        if (request instanceof ServletServerHttpRequest) {
                            HttpSession session = ((ServletServerHttpRequest) request).getServletRequest().getSession(false);
                            String userId = SecUtil.getLoginUserId(session);
                            if (StringUtils.isNotBlank(userId)) {
                                attributes.put(WS_USER_ID, userId);
                                return true;
                            }
                        }
                        response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                        return false; // not logged in -> refuse the handshake
                    }

                    @Override
                    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                               WebSocketHandler wsHandler, Exception exception) {
                    }
                })
                .setHandshakeHandler(new DefaultHandshakeHandler() {
                    @Override
                    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler,
                                                      Map<String, Object> attributes) {
                        String userId = (String) attributes.get(WS_USER_ID);
                        return userId == null ? null : () -> userId;
                    }
                });
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue");
        registry.setUserDestinationPrefix("/user");
        registry.setApplicationDestinationPrefixes("/app"); // reserved; no client->server messaging yet
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) {
                    return message;
                }
                StompCommand cmd = accessor.getCommand();
                // writes go through REST only; drop any client SEND frame
                if (StompCommand.SEND.equals(cmd)) {
                    return null;
                }
                // only the per-user queue may be subscribed (no peeking at broker internals)
                if (StompCommand.SUBSCRIBE.equals(cmd)) {
                    String dest = accessor.getDestination();
                    if (dest == null || !dest.startsWith("/user/queue/")) {
                        return null;
                    }
                }
                return message;
            }
        });
    }
}
