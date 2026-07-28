package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Annotation-driven auth gate (P2-2 authentication + P2-5 authorization).
 *
 * Registered on /**; reads @RequiresRole on the handler method (falling back to the
 * controller class). No annotation = public endpoint. With an annotation:
 *  - anonymous          -> 401 JSON
 *  - insufficient role  -> 403 JSON
 *  - role covers        -> pass.
 *
 * @RequiresFeature is checked the same way and is orthogonal: role says who you are,
 * feature says whether the admin opened that module for you. A handler may carry both.
 *
 * P4-1: now a pure JSON API — there is no FreeMarker login page to redirect to, so
 * unauthenticated requests always get 401 JSON (the React client routes to its own
 * login on 401). Responses use the unified {code,msg,data} shape (see Result).
 * CORS pre-flight (OPTIONS) always passes.
 */
public class AuthInterceptor implements HandlerInterceptor {

    /** 功能开关要现读库判断——session 里的用户是登录那一刻的快照，改了开关不会自己更新。 */
    private final UserMapper userMapper;

    public AuthInterceptor(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }
        HandlerMethod method = (HandlerMethod) handler;
        RequiresRole rule = findRule(method);
        RequiresFeature feature = findFeature(method);
        if (rule == null && feature == null) {
            return true;
        }
        DreamUser user = SecUtil.getLoginUserToSession(request);
        if (!SecUtil.isLogin(request) || user == null) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "未登录或会话已过期，请重新登录");
            return false;
        }
        if (rule != null && !Role.fromUserRole(user.getUserRole()).covers(rule.value())) {
            reject(response, HttpServletResponse.SC_FORBIDDEN, "权限不足");
            return false;
        }
        if (feature != null && !featureGranted(feature.value(), user)) {
            reject(response, HttpServletResponse.SC_FORBIDDEN, "管理员尚未对你开放该模块");
            return false;
        }
        return true;
    }

    /** 超管一律放行（否则管不了自己关掉的模块）；其余按库里最新的开关判定。 */
    private boolean featureGranted(Feature feature, DreamUser sessionUser) {
        if (Role.fromUserRole(sessionUser.getUserRole()) == Role.SUPER_MANAGER) {
            return true;
        }
        DreamUser fresh = userMapper.selectById(sessionUser.getUserId());
        return feature.granted(fresh);
    }

    private RequiresRole findRule(HandlerMethod handler) {
        RequiresRole rule = handler.getMethodAnnotation(RequiresRole.class);
        return rule != null ? rule : handler.getBeanType().getAnnotation(RequiresRole.class);
    }

    private RequiresFeature findFeature(HandlerMethod handler) {
        RequiresFeature f = handler.getMethodAnnotation(RequiresFeature.class);
        return f != null ? f : handler.getBeanType().getAnnotation(RequiresFeature.class);
    }

    /** Write a unified {code,msg,data:null} body with the matching HTTP status. */
    private void reject(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":" + status + ",\"msg\":\"" + msg + "\",\"data\":null}");
    }
}
