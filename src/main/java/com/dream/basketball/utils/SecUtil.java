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
     * 令牌认证的用户放在 <b>request 属性</b>里，不是 session 里（阶段 1 · Token 认证）。
     *
     * <p>为什么不直接塞进 session：那样每一个 App 请求都会让 Spring Session 在 Redis 里
     * <b>新建一条 session</b>（App 不带 Cookie，永远命不中已有的），30 天不过期。
     * 一天下来 Redis 里就是几万条只用过一次的 session。
     *
     * <p>放 request 属性则是"只活这一个请求"，与令牌本身是无状态的这一点吻合。
     * 而全站取当前用户只有 {@link #getLoginUserToSession} 这一个入口（115 处调用），
     * 所以在这里加一层判断，<b>那 115 处一行都不用改</b>。
     */
    public static final String REQ_USER_KEY = "REQ_TOKEN_USER";

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
        // 先看令牌（TokenAuthFilter 放的），再看 session。
        // 顺序不能反：令牌是"这次请求明确声明的身份"，比浏览器顺手带上的 Cookie 更明确。
        Object fromToken = request.getAttribute(REQ_USER_KEY);
        if (fromToken instanceof DreamUser) {
            return (DreamUser) fromToken;
        }
        return (DreamUser) WebUtils.getSessionAttribute(request, USER_KEY);
    }

    /**
     * 获取登录用户ID
     *
     * @param request
     * @return
     */
    public static String getLoginUserIdToSession(HttpServletRequest request) {
        Object fromToken = request.getAttribute(REQ_USER_KEY);
        if (fromToken instanceof DreamUser) {
            return ((DreamUser) fromToken).getUserId();
        }
        return (String) WebUtils.getSessionAttribute(request, USER_ID_KEY);
    }

    /**
     * 从裸 HttpSession 取登录用户ID（WebSocket 握手期只有 session 没有完整 request）
     */
    public static String getLoginUserId(javax.servlet.http.HttpSession session) {
        return session == null ? null : (String) session.getAttribute(USER_ID_KEY);
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
        request.removeAttribute(REQ_USER_KEY);   // 令牌登录的：清掉本次请求的身份
        javax.servlet.http.HttpSession s = request.getSession(false);
        if (s == null) {
            return;   // 令牌登录的请求本来就没有 session，别为了销毁而先建一个
        }
        setLoginUserToSession(request, null);
        setLoginUserIdToSession(request, null);
        s.invalidate();
    }

    public static void setLoginUserToSession(HttpServletRequest request, DreamUser dreamUser) {
        // 令牌登录时，"刷新登录态快照"只需要更新这一次请求的副本——
        // 下一个请求由 TokenAuthFilter 重新从库里取，本来就是新的。
        // 写进 session 反而会给一个无 Cookie 的客户端凭空造一条 session 出来
        if (request.getAttribute(REQ_USER_KEY) != null) {
            request.setAttribute(REQ_USER_KEY, dreamUser);
            return;
        }
        WebUtils.setSessionAttribute(request, USER_KEY, dreamUser);
    }

    public static void setLoginUserIdToSession(HttpServletRequest request, DreamUser dreamUser) {
        if (request.getAttribute(REQ_USER_KEY) != null) {
            return;   // 同上：令牌路径下 id 从 REQ_USER_KEY 里读，不用单独存
        }
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
