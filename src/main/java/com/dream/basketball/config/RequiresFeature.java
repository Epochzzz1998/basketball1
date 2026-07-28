package com.dream.basketball.config;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 声明式的「功能模块」门禁，由 AuthInterceptor 执行，与 {@link RequiresRole} 正交：
 * RequiresRole 管的是"你是什么身份"，这个管的是"超管有没有给你开这个模块"。
 *
 * 挂在方法或整个 controller 上。未登录 → 401；登录但没被放行 → 403；超管一律放行。
 * 判定实时读库（session 里是登录快照），所以超管一改开关立刻生效，不用等对方重新登录。
 */
@Documented
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresFeature {
    Feature value();
}
