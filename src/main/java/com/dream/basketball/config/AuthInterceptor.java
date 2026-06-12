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
 * Registered on /**; looks for @RequiresRole on the handler method (falling back
 * to the controller class). No annotation = public endpoint. With an annotation:
 *  - anonymous          -> 401 JSON for AJAX, redirect to login page for navigation;
 *  - insufficient role  -> 403 JSON for AJAX, sendError(403) for navigation (error.ftl);
 *  - role covers        -> pass.
 *
 * Supersedes the P2-2 path-whitelist LoginInterceptor so the access rule lives
 * on the endpoint itself. CORS pre-flight (OPTIONS) always passes.
 */
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        // let CORS pre-flight through so the browser can fire the actual request
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // static resources etc. are not HandlerMethods and carry no annotations
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }
        RequiresRole rule = findRule((HandlerMethod) handler);
        if (rule == null) {
            return true;
        }
        DreamUser user = SecUtil.getLoginUserToSession(request);
        if (!SecUtil.isLogin(request) || user == null) {
            reject(request, response, HttpServletResponse.SC_UNAUTHORIZED, "未登录或会话已过期，请重新登录");
            return false;
        }
        if (!Role.fromUserRole(user.getUserRole()).covers(rule.value())) {
            reject(request, response, HttpServletResponse.SC_FORBIDDEN, "权限不足");
            return false;
        }
        return true;
    }

    private RequiresRole findRule(HandlerMethod handler) {
        RequiresRole rule = handler.getMethodAnnotation(RequiresRole.class);
        return rule != null ? rule : handler.getBeanType().getAnnotation(RequiresRole.class);
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, int status, String msg) throws IOException {
        if (isAjax(request)) {
            response.setStatus(status);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"result\":false,\"msg\":\"" + msg + "\"}");
        } else if (status == HttpServletResponse.SC_UNAUTHORIZED) {
            response.sendRedirect(request.getContextPath() + "/user/loginPage");
        } else {
            // logged in but not allowed: render the error page with a proper 403
            response.sendError(HttpServletResponse.SC_FORBIDDEN, msg);
        }
    }

    /** XHR / fetch (X-Requested-With or Accept: application/json) want status JSON, not an HTML redirect. */
    private boolean isAjax(HttpServletRequest request) {
        if ("XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))) {
            return true;
        }
        String accept = request.getHeader("Accept");
        return accept != null && accept.contains("application/json");
    }
}
