package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.TopicChatMessage;

public interface TopicChatMessageMapper extends BaseMapper<TopicChatMessage> {

    /** 哪几天有聊天记录（yyyy-MM-dd 升序），小日历标记用。 */
    java.util.List<String> distinctDays(@org.apache.ibatis.annotations.Param("topicId") String topicId);

    /** 曾在这个群里发过言的人。 */
    java.util.List<String> speakerIds(@org.apache.ibatis.annotations.Param("topicId") String topicId);

    /** 各专题的群聊占用（仅超管看）：条数、正文字节、时间跨度。 */
    java.util.List<java.util.Map<String, Object>> usageByTopic();

    /**
     * 带附件的消息的 URL。三个条件都可为空：topicId 限专题，before 取该时间之前，
     * after 取该时间之后（清理时要知道"留下来的还在用哪些文件"）。导出、清理、算体积共用。
     */
    java.util.List<java.util.Map<String, Object>> attachmentsOf(
            @org.apache.ibatis.annotations.Param("topicId") String topicId,
            @org.apache.ibatis.annotations.Param("before") java.util.Date before,
            @org.apache.ibatis.annotations.Param("after") java.util.Date after);
}
