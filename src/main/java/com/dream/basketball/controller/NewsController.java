package com.dream.basketball.controller;

import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.BaseUtils;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.List;

import static com.dream.basketball.utils.Constants.*;

@Controller
@RequestMapping("/news")
public class NewsController extends BaseUtils {

    private Logger logger = LoggerFactory.getLogger(getClass());

    @Autowired
    NewsService newsService;

    @Autowired
    DreamNewsService dreamNewsService;

    @Autowired
    DreamNewsCommentService dreamNewsCommentService;

    @Autowired
    UserInformationService userInformationService;

    /**
     * @Description: 新闻列表
     * @param: [model, request]
     * @Author: Epoch
     * @return: java.lang.String
     * @Date: 2024/1/10
     * @time: 13:39
     */
    @RequestMapping("/newsList")
    public String newsList(Model model, HttpServletRequest request) {
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
    public Object newsListData(NewsDto param, Integer page, Integer limit, HttpServletResponse response) throws Exception {
        int code = -1;
        List<NewsDto> rows = new ArrayList<>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            rows = newsService.getNewsByParams(param);
            PageInfo<NewsDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("{newsListData}错误" + e.getMessage(), e);
        }
        return handlerSuccessPageJson(code, "成功获取", count, rows);
    }

    /**
    * @Description: 获取评论
    * @param: [newsId, page, limit, response]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/19
    * @time: 14:21
    */
    @RequestMapping("/CommentListData")
    @ResponseBody
    public Object CommentListData(String newsId, String level, String commentRelId, String commentId, Integer page, Integer limit, HttpServletResponse response) throws Exception {
        int code = -1;
        List<DreamNewsCommentDto> rows = new ArrayList<>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            DreamNewsCommentDto param = new DreamNewsCommentDto();
            param.setNewsId(newsId);
            param.setLevel(level);
            param.setCommentId(commentId);
            param.setCommentRelId(commentRelId);
            rows = newsService.getCommentListByParams(param);
            PageInfo<DreamNewsCommentDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("{CommentListData}错误" + e.getMessage(), e);
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
                // 删除es数据
                newsService.deleteNewsListByIds(newsIds, News.class);
                // 同步删除数据库
                dreamNewsService.deleteSyncEs(newsIds);
                return handlerResultJson(true, "删除成功！");
            } catch (Exception e) {
                logger.error("{news[delete]错误" + e.getMessage(), e);
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
        model.addAttribute("news", newsService.getInputAndEditNews(newsId, request));
        return "news/news-input";
    }

    @RequestMapping("/commentInput")
    public String commentInput(Model model, String newsId, HttpServletRequest request, String level, String commentId) {
        model.addAttribute("comment", newsService.getCommentInit(newsId, request, level, commentId));
        return "news/comment-input";
    }

    /**
     * @Description: 新闻预览
     * @param: [model, newsId]
     * @Author: Epoch
     * @return: java.lang.String
     * @Date: 2024/1/11
     * @time: 15:59
     */
    @RequestMapping("/newsShow")
    public String newsShow(Model model, String newsId, String level, String userInformationId, String anchorId) {
        model.addAttribute("news", newsService.getNewsShow(newsId));
        model.addAttribute("level", level);
        // 定位锚点
        model.addAttribute("anchorId", StringUtils.isNotBlank(anchorId) ? anchorId : NO_ANCHOR);
        // 更新消息状态
        userInformationService.updateInformationRead(userInformationId);
        return "news/news-show";
    }

    /**
    * @Description: 获取评论的评论
    * @param: [model, newsId]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/1/22
    * @time: 17:50
    */
    @RequestMapping("/commentDetailShow")
    public String commentDetailShow(Model model, String newsId, String commentRelId, String userInformationId, String anchorId) {
        model.addAttribute("news", newsService.getNewsShow(newsId));
        model.addAttribute("commentRelId", commentRelId);
        model.addAttribute("comment", dreamNewsCommentService.getById(commentRelId));
        // 定位锚点
        model.addAttribute("anchorId", StringUtils.isNotBlank(anchorId) ? anchorId : NO_ANCHOR);
        // 更新消息状态
        userInformationService.updateInformationRead(userInformationId);
        return "news/comment-detail-show";
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
    public Object save(News news) {
        try {
            // es保存
            newsService.save(news);
            // 数据库同步保存
            dreamNewsService.saveSyncEs(news);
            return handlerResultJson(true, "操作成功！");
        } catch (Exception e) {
            logger.error("{news方法保存异常：}" + e.getMessage(), e);
        }
        return handlerResultJson(false, "操作失败！");
    }

    /**
     * @Description: 点赞
     * @param: [newsId]
     * @Author: Epoch
     * @return: java.lang.Object
     * @Date: 2024/1/18
     * @time: 9:21
     */
    @RequestMapping("/good")
    @ResponseBody
    public Object good(String newsId, HttpServletRequest request) {
        return newsService.good(newsId, request);
    }

    /**
     * @Description: 点踩
     * @param: [newsId, request]
     * @Author: Epoch
     * @return: java.lang.Object
     * @Date: 2024/1/18
     * @time: 12:50
     */
    @RequestMapping("/bad")
    @ResponseBody
    public Object bad(String newsId, HttpServletRequest request) {
        return newsService.bad(newsId, request);
    }

    /**
    * @Description: 评论点赞
    * @param: [newsId, request]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/19
    * @time: 16:22
    */
    @RequestMapping("/goodComment")
    @ResponseBody
    public Object goodComment(String commentId, HttpServletRequest request) {
        return newsService.goodComment(commentId, request);
    }

    /**
    * @Description: 评论点踩
    * @param: [newsId, request]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/19
    * @time: 16:26
    */
    @RequestMapping("/badComment")
    @ResponseBody
    public Object badComment(String commentId, HttpServletRequest request) {
        return newsService.badComment(commentId, request);
    }

    /**
    * @Description: 评论方法
    * @param: [dreamNewsComment, request]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/25
    * @time: 9:22
    */
    @RequestMapping("/comment")
    @ResponseBody
    public Object comment(DreamNewsComment dreamNewsComment, HttpServletRequest request){
        return newsService.comment(dreamNewsComment, request);
    }

}
