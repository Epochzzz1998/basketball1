package com.dream.basketball.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReactTestController {

    @GetMapping("/api/hello")
    public String hello() {
        return "hello, react and spring boot";
    }
}
