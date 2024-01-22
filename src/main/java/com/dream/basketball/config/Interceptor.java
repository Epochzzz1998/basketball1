package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class Interceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        System.out.println("执行了Interceptor的preHandle方法");
        try {
            //统一拦截（查询当前session是否存在UserInfoVO用户信息）(这里UserInfoVO会在每次登陆成功后，写入session)
            DreamUser user = (DreamUser) request.getSession().getAttribute("DreamUser");
            if (user != null) {
                return true;
            }
            //这里设置拦截以后重定向的页面，一般设置为登陆页面地址
            response.sendRedirect(request.getContextPath() + "/user/loginPage");
        } catch (IOException e) {
            e.printStackTrace();
        }
        return true;//如果设置为false时，被请求时，拦截器执行到此处将不会继续操作
        //如果设置为true时，请求将会继续执行后面的操作
    }

}
