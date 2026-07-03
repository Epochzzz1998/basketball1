package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.PlayerService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.dream.basketball.utils.Constants.NEWS_CHANNEL_FORUM;
import static com.dream.basketball.utils.Constants.NEWS_CHANNEL_OFFICIAL;

/**
 * 全局搜索（公开）：一个关键词同时模糊查 球员 / 新闻 / 资讯帖 / 用户，
 * 各取前几条供顶栏搜索面板分组展示。
 */
@RestController
@RequestMapping("/search")
public class SearchController {

    @Autowired
    private PlayerService playerService;

    @Autowired
    private NewsService newsService;

    @Autowired
    private UserMapper userMapper;

    private static final int GROUP_LIMIT = 6;

    @GetMapping("/global")
    public Result<Map<String, Object>> global(String keyword) {
        Map<String, Object> data = new HashMap<>();
        String kw = keyword == null ? "" : keyword.trim();
        if (StringUtils.isBlank(kw) || kw.length() > 50) {
            return new Result<>(0, "成功", data);
        }

        // 球员：按名字模糊
        List<Map<String, Object>> players = new ArrayList<>();
        for (DreamPlayer p : playerService.list(new QueryWrapper<DreamPlayer>()
                .like("PLAYER_NAME", kw).last("limit " + GROUP_LIMIT))) {
            Map<String, Object> m = new HashMap<>();
            m.put("playerId", p.getPlayerId());
            m.put("playerName", p.getPlayerName());
            m.put("playerNumber", p.getPlayerNumber());
            players.add(m);
        }
        data.put("players", players);

        // 新闻 / 资讯：ES 相关度前 N（标题前缀加权）
        data.put("news", slimNews(newsService.searchNews(kw, NEWS_CHANNEL_OFFICIAL, GROUP_LIMIT)));
        data.put("forum", slimNews(newsService.searchNews(kw, NEWS_CHANNEL_FORUM, GROUP_LIMIT)));

        // 用户：用户名/昵称模糊（只回显示字段，后续再做用户主页）
        List<Map<String, Object>> users = new ArrayList<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>()
                .like("USER_NAME", kw).or().like("USER_NICKNAME", kw).last("limit " + GROUP_LIMIT))) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userName", u.getUserName());
            m.put("userNickname", u.getUserNickname());
            users.add(m);
        }
        data.put("users", users);

        return new Result<>(0, "成功", data);
    }

    /** 只保留面板需要的字段，避免整篇正文进响应 */
    private List<Map<String, Object>> slimNews(List<News> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (News n : list) {
            Map<String, Object> m = new HashMap<>();
            m.put("newsId", n.getNewsId());
            m.put("title", n.getTitle());
            m.put("author", n.getAuthor());
            m.put("publishDate", n.getPublishDate());
            out.add(m);
        }
        return out;
    }
}
