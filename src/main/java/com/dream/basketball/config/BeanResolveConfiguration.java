package com.dream.basketball.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC config (P2-2): registers the authentication gate and configures CORS for the
 * future front/back-separated React client (Session cookie + credentials).
 */
@Configuration
public class BeanResolveConfiguration implements WebMvcConfigurer {

    /** Comma-separated allowed origins; overridden per profile (see application-*.yml). */
    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String[] allowedOrigins;

    /**
     * Protected paths requiring an authenticated session. Public browsing
     * (player/news read endpoints, login/regist/captcha, static assets) stays open.
     * Role-based authorization on these writes is added in P2-5.
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new LoginInterceptor())
                .addPathPatterns(
                        // player writes + admin pages
                        "/player/insertAndSavePlayer",
                        "/player/savePlayer",
                        "/player/insertAndSavePlayerStats",
                        "/player/savePlayerStats",
                        "/player/deletePlayer",
                        "/player/playerManage",
                        "/player/playerStatsManagerList",
                        // news writes + admin pages + member interactions
                        "/news/save",
                        "/news/delete",
                        "/news/upload",
                        "/news/newsInput",
                        "/news/commentInput",
                        "/news/comment",
                        "/news/good",
                        "/news/bad",
                        "/news/goodComment",
                        "/news/badComment",
                        // user admin / session
                        "/user/userList",
                        "/user/loginOut"
                );
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
