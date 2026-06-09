package com.dream.basketball.config;

import com.dream.basketball.utils.SecUtil;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Authentication gate (P2-2). Replaces the never-registered, always-passing old Interceptor.
 *
 * Fixes vs. the old code:
 *  - actually registered (see BeanResolveConfiguration) on protected path patterns;
 *  - reads the SAME session key that login writes (via SecUtil), not the phantom "DreamUser" key;
 *  - returns false to truly block, instead of returning true right after a redirect;
 *  - REST-friendly: AJAX/JSON callers get 401 JSON, browser navigations get redirected to the login page;
 *  - lets CORS pre-flight (OPTIONS) through.
 *
 * Scope is authentication only (is the caller logged in). Role-based authorization on the
 * write endpoints is layered on top in P2-5.
 */
public class LoginInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        // let CORS pre-flight through so the browser can fire the actual request
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (SecUtil.isLogin(request)) {
            return true;
        }
        // not authenticated
        if (isAjax(request)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"result\":false,\"msg\":\"未登录或会话已过期，请重新登录\"}");
        } else {
            response.sendRedirect(request.getContextPath() + "/user/loginPage");
        }
        return false;
    }

    /** XHR / fetch (X-Requested-With or Accept: application/json) want a 401 JSON, not an HTML redirect. */
    private boolean isAjax(HttpServletRequest request) {
        if ("XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))) {
            return true;
        }
        String accept = request.getHeader("Accept");
        return accept != null && accept.contains("application/json");
    }
}
