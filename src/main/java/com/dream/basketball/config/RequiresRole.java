package com.dream.basketball.config;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declarative endpoint authorization (P2-5), enforced by AuthInterceptor.
 *
 * Annotate a handler method (or controller class) to require an authenticated
 * session with at least the given role. Methods without this annotation stay
 * public. Replaces the P2-2 path whitelist so the access rule lives next to
 * the endpoint it protects.
 */
@Documented
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresRole {
    /** Minimum role required; defaults to "any logged-in user". */
    Role value() default Role.USER;
}
