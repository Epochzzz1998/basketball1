package com.dream.basketball.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class BeanResolveConfiguration implements WebMvcConfigurer {
//    @Override
//    public void addInterceptors(InterceptorRegistry registry) {
//        //添加拦截器，、
//        //配置不拦截的路径
//        registry.addInterceptor(new Interceptor()).excludePathPatterns(
//                "/user/login",
//                "/user/regist",
//                "/user/loginPage",
//                "/user/registPage"
//        );
//    }
}
