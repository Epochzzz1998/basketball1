package com.dream.basketball.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Global exception handling (P4-2): turns uncaught exceptions into the unified
 * {@link Result} body instead of a raw stack trace / Spring whitelabel page, and
 * logs them once with context. Lets controllers drop their per-method try/catch
 * (done progressively in P4-1).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Unique-constraint violation (e.g. duplicate nickname, see P3-1). */
    @ExceptionHandler(DuplicateKeyException.class)
    public Result<Void> handleDuplicateKey(DuplicateKeyException e) {
        log.warn("duplicate key violation: {}", e.getMessage());
        return Result.fail("数据已存在，请勿重复提交");
    }

    /** Missing required request parameter -> 400-style client error. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        return Result.fail(400, "缺少必要参数：" + e.getParameterName());
    }

    /** Invalid argument (e.g. disallowed/oversize upload from FileUtils, P2-4) -> 400. */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleIllegalArgument(IllegalArgumentException e) {
        return Result.fail(400, e.getMessage());
    }

    /** Upload exceeds the configured multipart size -> 400. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleMaxUpload(MaxUploadSizeExceededException e) {
        return Result.fail(400, "文件过大");
    }

    /** Catch-all: log with stack trace, return a generic 500 body (no internals leaked). */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleException(Exception e) {
        log.error("unhandled exception", e);
        return Result.fail(500, "服务器内部错误");
    }
}
