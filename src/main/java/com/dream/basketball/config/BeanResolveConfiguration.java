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

    /**
     * 套壳 App 的 WebView 源。iOS 上是 {@code capacitor://localhost}，
     * 安卓上是 {@code http://localhost}（Capacitor 默认；也有配成 {@code ionic://} 的老项目）。
     * 这三个是<b>固定字面量</b>，不是通配，所以放开它们不会扩大攻击面。
     */
    private static final String[] NATIVE_ORIGINS = {
        "capacitor://localhost", "ionic://localhost", "http://localhost",
    };

    /**
     * CORS。
     *
     * <p>从 {@code allowedOrigins} 换成 {@code allowedOriginPatterns}，原因是
     * Spring 5.3 起，{@code allowCredentials(true)} 和 {@code allowedOrigins} 里出现
     * 通配符是<b>互斥</b>的（会直接抛异常拒绝启动）。虽然这里加的三个是精确串，
     * 但 pattern 版本对二者都放行，以后要加 {@code https://*.dream-everything.com}
     * 这种也不用再改一次结构。
     *
     * <p>{@code allowCredentials(true)} 保留：网页端还是靠 Cookie。
     * App 端不需要它（Bearer 头不算 credentials），留着也不影响。
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = new String[allowedOrigins.length + NATIVE_ORIGINS.length];
        System.arraycopy(allowedOrigins, 0, origins, 0, allowedOrigins.length);
        System.arraycopy(NATIVE_ORIGINS, 0, origins, allowedOrigins.length, NATIVE_ORIGINS.length);
        registry.addMapping("/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
