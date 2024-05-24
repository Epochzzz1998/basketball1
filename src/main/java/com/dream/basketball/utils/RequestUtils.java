package com.dream.basketball.utils;

import org.apache.commons.lang3.StringUtils;

import javax.servlet.http.HttpServletRequest;

public final class RequestUtils {
    /**
    * @Description: 获取ip
    * @param: [request]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/1/29
    * @time: 16:06
    */
    public static String getClientIP(HttpServletRequest request) {
        String xForwardedFor;
        xForwardedFor = StringUtils.trimToNull(request.getHeader("$wsra"));
        if (xForwardedFor != null) {
            return xForwardedFor;
        }
        xForwardedFor = StringUtils.trimToNull(request.getHeader("X-Real-IP"));
        if (xForwardedFor != null) {
            return xForwardedFor;
        }
        xForwardedFor = StringUtils.trimToNull(request.getHeader("X-Forwarded-For"));
        if (xForwardedFor != null) {
            int spaceIndex = xForwardedFor.indexOf(',');
            if (spaceIndex > 0) {
                return xForwardedFor.substring(0, spaceIndex);
            } else {
                return xForwardedFor;
            }
        }
        return request.getRemoteAddr();
    }
}
