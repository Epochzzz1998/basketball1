package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
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
 * 阶段 1 起还接受 `?access_token=`：套壳 App 没有 Cookie，而握手请求按协议带不了自定义头。
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /** handshake attribute key carrying the authenticated userId into determineUser() */
    private static final String WS_USER_ID = "WS_USER_ID";

    @org.springframework.beans.factory.annotation.Autowired
    private TokenStore tokenStore;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new HandshakeInterceptor() {
                    /**
                     * 握手时认人。两条路：session（网页）和令牌（App）。
                     *
                     * <b>令牌只能走查询参数，不能走请求头</b>——WebSocket 的握手是一个
                     * 由浏览器发起的、协议规定死的 HTTP Upgrade 请求，
                     * `WebSocket` API 压根没有设置自定义请求头的地方（SockJS 的
                     * XHR 回退也一样）。这是协议层面的限制，不是这里偷懒。
                     *
                     * 代价是令牌会出现在访问日志的 URL 里。所以这条路**只在这儿开**，
                     * 普通接口一律走 Authorization 头。
                     *
                     * 认不出来仍然直接拒绝握手（和原来一样）：WebSocket 不像 HTTP 接口
                     * 有"匿名也能看公开内容"这回事，连上来就是要收推送的，
                     * 不知道你是谁就没有任何东西可推。
                     */
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        if (request instanceof ServletServerHttpRequest) {
                            javax.servlet.http.HttpServletRequest req =
                                    ((ServletServerHttpRequest) request).getServletRequest();
                            HttpSession session = req.getSession(false);
                            String userId = SecUtil.getLoginUserId(session);
                            if (StringUtils.isBlank(userId)) {
                                userId = tokenStore.resolve(TokenAuthFilter.extract(req));
                            }
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

    /** 专题群聊的广播地址前缀：/room/{topicId}。用 /room 不用 STOMP 惯例的 /topic，
     *  是因为这个项目里「topic」已经指论坛专题了，两个含义撞在一起没法读。 */
    public static final String ROOM_PREFIX = "/room/";

    @Autowired
    @Lazy
    private TopicPermissionService topicPerms;

    @Autowired
    @Lazy
    private UserMapper userMapper;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // /queue = 私信（一对一，配合 /user 前缀）；/room = 专题群聊（一对多广播）
        registry.enableSimpleBroker("/queue", "/room");
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
                // 订阅地址白名单：自己的私信队列，或者一个自己有权进的群聊房间。
                // 群聊这道校验是整个功能里最要紧的一处：房间地址就是专题 id，
                // 少了它，任何登录用户改一下订阅地址就能听私密专题的群聊。
                if (StompCommand.SUBSCRIBE.equals(cmd)) {
                    String dest = accessor.getDestination();
                    if (dest == null) {
                        return null;
                    }
                    if (dest.startsWith("/user/queue/")) {
                        return message;
                    }
                    if (dest.startsWith(ROOM_PREFIX) && mayJoinRoom(accessor, dest.substring(ROOM_PREFIX.length()))) {
                        return message;
                    }
                    return null;
                }
                return message;
            }
        });
    }

    /** 这条 STOMP 连接背后的人，此刻能不能进这个专题的群聊（实时查库，题主一关立刻生效）。 */
    private boolean mayJoinRoom(StompHeaderAccessor accessor, String topicId) {
        Principal user = accessor.getUser();
        if (user == null || StringUtils.isBlank(topicId)) {
            return false;
        }
        DreamUser me = userMapper.selectById(user.getName());
        return me != null && topicPerms.canChat(me, topicPerms.getTopic(topicId));
    }
}
