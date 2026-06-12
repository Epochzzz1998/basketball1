package com.dream.basketball.controller;

import com.dream.basketball.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Root endpoint. P4-1: the backend is now a pure JSON API (no server-rendered home
 * page), so "/" just reports liveness instead of forwarding to a FreeMarker view.
 */
@RestController
public class OriginController {

    @GetMapping("/")
    public Result<String> index() {
        return Result.ok("dream-app API is running");
    }
}
