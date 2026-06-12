package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
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
 * P4-1: now a pure JSON API — there is no FreeMarker login page to redirect to, so
 * unauthenticated requests always get 401 JSON (the React client routes to its own
 * login on 401). Responses use the unified {code,msg,data} shape (see Result).
 * CORS pre-flight (OPTIONS) always passes.
 */
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }
        RequiresRole rule = findRule((HandlerMethod) handler);
        if (rule == null) {
            return true;
        }
        DreamUser user = SecUtil.getLoginUserToSession(request);
        if (!SecUtil.isLogin(request) || user == null) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "未登录或会话已过期，请重新登录");
            return false;
        }
        if (!Role.fromUserRole(user.getUserRole()).covers(rule.value())) {
            reject(response, HttpServletResponse.SC_FORBIDDEN, "权限不足");
            return false;
        }
        return true;
    }

    private RequiresRole findRule(HandlerMethod handler) {
        RequiresRole rule = handler.getMethodAnnotation(RequiresRole.class);
        return rule != null ? rule : handler.getBeanType().getAnnotation(RequiresRole.class);
    }

    /** Write a unified {code,msg,data:null} body with the matching HTTP status. */
    private void reject(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":" + status + ",\"msg\":\"" + msg + "\",\"data\":null}");
    }
}
