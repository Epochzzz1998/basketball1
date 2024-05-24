package com.dream.basketball.controller;

import com.dream.basketball.utils.BaseUtils;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

@Controller
@RequestMapping("/")
public class OriginController extends BaseUtils {
    @RequestMapping("/")
    public String index(Model model, HttpServletRequest request) throws IOException {
        menuPower(model, request);
        return "news/news-list";
    }
}
