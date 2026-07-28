package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.TopicChatRead;
import org.apache.ibatis.annotations.Param;

public interface TopicChatReadMapper extends BaseMapper<TopicChatRead> {

    /** 主键是 (USER_ID, TOPIC_ID) 复合键，MyBatis-Plus 的 updateById 用不了，直接写 upsert。 */
    int upsert(@Param("userId") String userId, @Param("topicId") String topicId,
               @Param("lastRead") java.util.Date lastRead);
}
