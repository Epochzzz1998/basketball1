package com.dream.basketball.config;

import org.springframework.boot.web.server.MimeMappings;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Serve the React SPA (bundled into classpath:/static/) and fall back to index.html
 * for client-side routes so a page refresh on /news, /players/x, etc. works.
 *
 * Precedence keeps this safe:
 *  - @RestController mappings (e.g. /news/newsListData, /user/current) run BEFORE any
 *    resource handler, so real API paths are never shadowed by the SPA fallback.
 *  - The more specific /picImg/** handler (ImgConfigurer, uploaded files) wins over /**.
 *  - Only paths with no controller AND no matching static file fall through to index.html.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    /**
     * Tomcat 的默认 MIME 表里没有 .webmanifest，PWA 的 manifest 会被当成
     * application/octet-stream 发出去。Chrome 照样能解析，但 iOS Safari 严格得多，
     * 类型不对就当没有 manifest —— 主屏图标、standalone 全都不生效。
     * 而 iOS 正是这套东西最终要上的平台，所以这一行不能省。
     */
    @Bean
    public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> webManifestMimeType() {
        return factory -> {
            MimeMappings mappings = new MimeMappings(MimeMappings.DEFAULT);
            mappings.add("webmanifest", "application/manifest+json");
            factory.setMimeMappings(mappings);
        };
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Hashed bundles are immutable — cache long. The SPA shell must NOT be heuristically
        // cached (browsers were serving week-old index.html referencing old bundles): no-cache
        // forces a revalidation each load, which is a cheap 304 via Last-Modified.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS)); // hashed filenames = immutable in practice
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested; // real static asset (js/css/img/index.html)
                        }
                        // Unknown non-file path → hand the SPA its shell; React Router routes it.
                        return new ClassPathResource("static/index.html");
                    }
                });
    }
}
