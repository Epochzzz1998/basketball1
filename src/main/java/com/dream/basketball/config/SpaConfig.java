package com.dream.basketball.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

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

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
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
