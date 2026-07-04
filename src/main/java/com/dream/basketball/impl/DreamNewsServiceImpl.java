package com.dream.basketball.impl;

import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.mapper.DreamNewsMapper;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.PlayerService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Arrays;
import java.util.List;

@Service
public class DreamNewsServiceImpl extends ServiceImpl<DreamNewsMapper, DreamNews> implements DreamNewsService {

    /**
     * @Description: 点赞数+1
     * @param: [newsId]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/18
     * @time: 9:30
     */
    public void good(String newsId, Integer num) {
        DreamNews dreamNews = baseMapper.selectById(newsId);
        if (dreamNews != null) {
            dreamNews.setGoodNum(dreamNews.getGoodNum() + num);
            saveOrUpdate(dreamNews);
        }
    }

    /**
     * @Description: 点踩
     * @param: [newsId, num]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/18
     * @time: 12:53
     */
    public void bad(String newsId, Integer num) {
        DreamNews dreamNews = baseMapper.selectById(newsId);
        if (dreamNews != null) {
            dreamNews.setBadNum(dreamNews.getBadNum() + num);
            saveOrUpdate(dreamNews);
        }
    }

    /**
     * @Description: 论坛数据库同步es保存
     * @param: [news]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/18
     * @time: 10:16
     */
    public boolean saveSyncEs(News news) {
        String newsId = news.getNewsId();
        if (StringUtils.isBlank(newsId)) {
            return false;
        }
        DreamNews dreamNews = baseMapper.selectById(newsId);
        DreamNews dreamNewsNew = JSONUtil.toBean(JSONUtil.toJsonStr(news), DreamNews.class);
        // 更新操作：这些字段由 DB 端管理（不随发帖正文提交），从旧行保留，别被重建的空值覆盖。
        // 其中 TOP/ESSENCE/LOCKED/HIDDEN/VIEW_COUNT/VIEWER_COUNT 是 NOT NULL，若置 null 会直接报错。
        if (dreamNews != null) {
            dreamNewsNew.setGoodNum(dreamNews.getGoodNum());
            dreamNewsNew.setBadNum(dreamNews.getBadNum());
            dreamNewsNew.setCommentNum(dreamNews.getCommentNum());
            dreamNewsNew.setTop(dreamNews.getTop());
            dreamNewsNew.setEssence(dreamNews.getEssence());
            dreamNewsNew.setLocked(dreamNews.getLocked());
            dreamNewsNew.setHidden(dreamNews.getHidden());
            dreamNewsNew.setViewCount(dreamNews.getViewCount());
            dreamNewsNew.setViewerCount(dreamNews.getViewerCount());
            dreamNewsNew.setLastEditTime(dreamNews.getLastEditTime());
            dreamNewsNew.setLastEditorId(dreamNews.getLastEditorId());
        } else {
            // 新增操作
            dreamNewsNew.setGoodNum(0);
            dreamNewsNew.setBadNum(0);
            dreamNewsNew.setCommentNum(0);
        }
        return saveOrUpdate(dreamNewsNew);
    }

    /**
     * 同步删除数据库数据
     *
     * @Description:
     * @param: [newsIds]
     * @Author: Epoch
     * @return: boolean
     * @Date: 2024/1/18
     * @time: 10:59
     */
    public boolean deleteSyncEs(String newsIds) {
        List<String> newsIdList = Arrays.asList(newsIds.split(","));
        return removeByIds(newsIdList);
    }

}
