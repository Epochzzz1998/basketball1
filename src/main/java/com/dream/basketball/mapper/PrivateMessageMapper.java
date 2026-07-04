package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.ConversationDto;
import com.dream.basketball.entity.DreamPrivateMessage;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface PrivateMessageMapper extends BaseMapper<DreamPrivateMessage> {

    /**
     * My conversation list: latest visible message per counterpart (window function)
     * + unread count + counterpart nickname/avatar, newest conversation first.
     */
    List<ConversationDto> findConversations(@Param("me") String me);

    /** Messages between me and one peer, both sides' deletes respected, newest first (PageHelper pages it). */
    List<DreamPrivateMessage> findHistory(@Param("me") String me, @Param("peerId") String peerId);
}
