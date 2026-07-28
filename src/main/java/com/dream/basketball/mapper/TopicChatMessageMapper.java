package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.TopicChatMessage;

public interface TopicChatMessageMapper extends BaseMapper<TopicChatMessage> {

    /** 各专题的群聊占用（仅超管看）：条数、正文字节、时间跨度。 */
    java.util.List<java.util.Map<String, Object>> usageByTopic();

    /** 带附件的消息的 URL；topicId/before 为空表示不限。导出、清理、算体积共用。 */
    java.util.List<java.util.Map<String, Object>> attachmentsOf(
            @org.apache.ibatis.annotations.Param("topicId") String topicId,
            @org.apache.ibatis.annotations.Param("before") java.util.Date before);
}
