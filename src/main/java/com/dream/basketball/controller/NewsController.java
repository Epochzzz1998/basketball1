package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.SecUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.*;

@Controller
@RequestMapping("/news")
public class NewsController extends BaseUtils {

    private Logger logger = LoggerFactory.getLogger(getClass());

    @Autowired
    NewsService newsService;

    /**
    * @Description: 新闻列表
    * @param: [model, request]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/1/10
    * @time: 13:39
    */
    @RequestMapping("/newsList")
    public String newsList(Model model, HttpServletRequest request){
        isManagerOrOver(model, request);
        menuPower(model, request);
        return "news/news-list";
    }

    /**
    * @Description: 新闻数据
    * @param: [param, page, limit, response]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/10
    * @time: 13:39
    */
    @RequestMapping("/newsListData")
    @ResponseBody
    public Object newsListData(NewsDto param, Integer page, Integer limit, HttpServletResponse response) throws Exception{
        int code = -1;
        List<News> rows = new ArrayList<>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            rows = newsService.getNewsByParams(param);
            PageInfo<News> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("", e);
        }
        return handlerSuccessPageJson(code, "成功获取", count, rows);
    }

    /**
    * @Description: 删除方法
    * @param: [newsIds]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/10
    * @time: 14:54
    */
    @ResponseBody
    @DeleteMapping("/delete")
    public Object delete(String newsIds) {
        if (StringUtils.isNotBlank(newsIds)) {
            try {
                List<String> newsIdList = Arrays.asList(newsIds.split(","));
                newsService.deleteNewsListByIds(newsIdList, News.class);
                return handlerResultJson(true, "删除成功！");
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return handlerResultJson(false, "删除失败！");
    }

    /**
    * @Description: 新增新闻
    * @param: [model]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/1/10
    * @time: 16:21
    */
    @RequestMapping("/newsInput")
    public String newsInput(Model model, String newsId, HttpServletRequest request) {
        News news = new News();
        if (StringUtils.isNotBlank(newsId)) {
            NewsDto newsDto = new NewsDto();
            newsDto.setNewsId(newsId);
            List<News> newsList = newsService.getNewsByParams(newsDto);
            if (!CollectionUtils.isEmpty(newsList)) {
                news = newsList.get(0);
            }
        }
        if (StringUtils.isBlank(news.getAuthor())) {
            news.setAuthor(getLoginDreamUser(request).getUserName());
        }
        if (StringUtils.isBlank(news.getNewsId())) {
            news.setNewsId(UUID.randomUUID().toString());
        }
        model.addAttribute("news", news);
        return "news/news-input";
    }

    /**
    * @Description: 新闻预览
    * @param: [model, newsId, request]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/1/11
    * @time: 15:59
    */
    @RequestMapping("/newsShow")
    public String newsShow(Model model, String newsId, HttpServletRequest request) {
        News news = new News();
        if (StringUtils.isNotBlank(newsId)) {
            NewsDto newsDto = new NewsDto();
            newsDto.setNewsId(newsId);
            List<News> newsList = newsService.getNewsByParams(newsDto);
            if (!CollectionUtils.isEmpty(newsList)) {
                news = newsList.get(0);
            }
        }
        model.addAttribute("news", news);
        return "news/news-show";
    }

    /**
    * @Description: 保存新增
    * @param: [news]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/1/10
    * @time: 17:14
    */
    @RequestMapping("/save")
    @ResponseBody
    public Object save(News news){
        try{
            if (news.getPublishDate() == null) {
                news.setPublishDate(new Date());
            }
            newsService.save(news);
            return handlerResultJson(true, "操作成功！");
        }catch (Exception e){
            logger.error(e.toString());
        }
        return handlerResultJson(false, "操作失败！");
    }

}
