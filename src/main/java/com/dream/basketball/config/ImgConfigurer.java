package com.dream.basketball.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

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

    /**
     * 上传目录下的每个响应都带 {@code X-Content-Type-Options: nosniff}。
     *
     * <p>这些文件是**静态资源直出**的（上面那条 handler），Content-Type 完全由扩展名决定。
     * 没有 nosniff 的话浏览器允许「内容嗅探」：一个 .json 或 .txt，如果内容看起来像 HTML，
     * 有些浏览器会当 HTML 渲染——于是扩展名黑名单（{@code FileUtils.DANGEROUS_EXTENSIONS}）
     * 就被绕过去了。专题文件系统改成黑名单放开格式之后，这一条从「加固」变成了「前提」。
     *
     * <p>拦截器对静态资源处理器同样生效（它们走的是同一条 HandlerExecutionChain），
     * 所以不需要额外加一个 Filter。picPath 为空时不注册——那样模式会变成 {@code **}，
     * 把整站都套进来，不是这条规则该管的范围。
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        if (picPath == null || picPath.isEmpty()) {
            return;
        }
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
                res.setHeader("X-Content-Type-Options", "nosniff");
                return true;
            }
        }).addPathPatterns(picPath + "**");
    }
}
