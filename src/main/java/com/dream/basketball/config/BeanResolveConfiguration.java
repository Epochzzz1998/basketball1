package com.dream.basketball.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC config: registers the annotation-driven auth gate (P2-2/P2-5) and configures
 * CORS for the future front/back-separated React client (Session cookie + credentials).
 */
@Configuration
public class BeanResolveConfiguration implements WebMvcConfigurer {

    /** Comma-separated allowed origins; overridden per profile (see application-*.yml). */
    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String[] allowedOrigins;

    /** 功能开关要现读库（@RequiresFeature），所以拦截器需要一个 mapper。 */
    @org.springframework.beans.factory.annotation.Autowired
    private com.dream.basketball.mapper.UserMapper userMapper;

    /**
     * One interceptor over everything; access rules are declared per endpoint
     * with @RequiresRole / @RequiresFeature (P2-5). Un-annotated handlers remain public.
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AuthInterceptor(userMapper)).addPathPatterns("/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
