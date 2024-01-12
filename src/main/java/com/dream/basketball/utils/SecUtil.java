package com.dream.basketball.utils;

import com.dream.basketball.entity.DreamUser;
import org.apache.commons.lang3.StringUtils;
import org.springframework.web.util.WebUtils;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class SecUtil {
    /**
     * session信息
     */
    final static String USER_KEY = "USER_KEY";
    final static String USER_ID_KEY = "USER_ID_KEY";
    final static String USER_ROLE_KEY = "USER_ROLE_KEY";

    /**
     * 判断是否登录
     *
     * @param request
     * @return
     */
    public static boolean isLogin(HttpServletRequest request) {
        return StringUtils.isNoneBlank(getLoginUserIdToSession(request));
    }

    /**
     * 获取登录用户
     *
     * @param request
     * @return
     */
    public static DreamUser getLoginUserToSession(HttpServletRequest request) {
        return (DreamUser) WebUtils.getSessionAttribute(request, USER_KEY);
    }

    /**
     * 获取登录用户ID
     *
     * @param request
     * @return
     */
    public static String getLoginUserIdToSession(HttpServletRequest request) {
        return (String) WebUtils.getSessionAttribute(request, USER_ID_KEY);
    }

    /**
     * 登录
     *
     * @param request
     * @param dreamUser
     */
    public static void login4Session(HttpServletRequest request, DreamUser dreamUser) {
        setLoginUserToSession(request, dreamUser);
        setLoginUserIdToSession(request, dreamUser);
    }

    /**
     * 登出
     *
     * @param request
     */
    public static void logout4Session(HttpServletRequest request) {
        setLoginUserToSession(request, null);
        setLoginUserIdToSession(request, null);
        request.getSession().invalidate();
    }

    public static void setLoginUserToSession(HttpServletRequest request, DreamUser dreamUser) {
        WebUtils.setSessionAttribute(request, USER_KEY, dreamUser);
    }

    public static void setLoginUserIdToSession(HttpServletRequest request, DreamUser dreamUser) {
        if (dreamUser != null) {
            WebUtils.setSessionAttribute(request, USER_ID_KEY, dreamUser.getUserId());
        } else {
            WebUtils.setSessionAttribute(request, USER_ID_KEY, "");
        }
    }

    public static String getCookie(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals(cookieName)) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    public static void setCookie(HttpServletResponse response, String cookieName, String value, int cookieMaxAge) {
        Cookie cookie = new Cookie(cookieName, value);
        cookie.setPath("/");
        cookie.setMaxAge(cookieMaxAge);
        response.addCookie(cookie);
    }

    public static void deleteCookie(HttpServletResponse response, String cookieName) {
        setCookie(response, cookieName, null, 0);
    }
}
