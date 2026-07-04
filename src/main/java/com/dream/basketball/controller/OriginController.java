package com.dream.basketball.controller;

import com.dream.basketball.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Liveness endpoint. P5: the backend now also serves the React SPA (SpaConfig), so "/"
 * must fall through to index.html — the liveness banner moved to /api/health.
 */
@RestController
public class OriginController {

    @GetMapping("/api/health")
    public Result<String> health() {
        return Result.ok("dream-app API is running");
    }
}
