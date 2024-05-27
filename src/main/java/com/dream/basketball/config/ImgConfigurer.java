package com.dream.basketball.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ImgConfigurer implements WebMvcConfigurer {

    @Value("${picPath.picPath:}")
    private String picPath;
    @Value("${picPath.uploadPath:}")
    private String uploadPath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(picPath + "**").
                addResourceLocations("file:" + uploadPath);
    }
}
