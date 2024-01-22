package com.dream.basketball.impl;

import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.Comment;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.mapper.DreamNewsCommentMapper;
import com.dream.basketball.mapper.DreamNewsMapper;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.elasticsearch.core.ElasticsearchRestTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class DreamNewsCommentServiceImpl extends ServiceImpl<DreamNewsCommentMapper, DreamNewsComment> implements DreamNewsCommentService {

    @Autowired
    ElasticsearchRestTemplate template;

    /**
    * @Description: 找到最大楼层
    * @param: [newsId]
    * @Author: Epoch
    * @return: java.lang.Integer
    * @Date: 2024/1/19
    * @time: 10:23
    */
    public Integer findMaxFloor(String newsId){
        return baseMapper.findMaxFloor(newsId);
    }

    /**
    * @Description: 数据库更新评论点赞
    * @param: [newsId, num]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/1/19
    * @time: 16:36
    */
    public void goodComment(String commentId, Integer num) {
        DreamNewsComment dreamNewsComment = baseMapper.selectById(commentId);
        if (dreamNewsComment != null) {
            dreamNewsComment.setGoodNum(dreamNewsComment.getGoodNum() + num);
            saveOrUpdate(dreamNewsComment);
            // 同步es
            Comment comment = JSONUtil.toBean(JSONUtil.toJsonStr(dreamNewsComment), Comment.class);
            if (comment != null ){
                template.save(comment);
            }
        }
    }

    /**
     * @Description: 数据库更新评论点赞
     * @param: [newsId, num]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/19
     * @time: 16:36
     */
    public void badComment(String commentId, Integer num) {
        DreamNewsComment dreamNewsComment = baseMapper.selectById(commentId);
        if (dreamNewsComment != null) {
            dreamNewsComment.setBadNum(dreamNewsComment.getBadNum() + num);
            saveOrUpdate(dreamNewsComment);
            // 同步es
            Comment comment = JSONUtil.toBean(JSONUtil.toJsonStr(dreamNewsComment), Comment.class);
            if (comment != null ){
                template.save(comment);
            }
        }
    }

}
