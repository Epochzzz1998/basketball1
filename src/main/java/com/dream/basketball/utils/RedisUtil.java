package com.dream.basketball.utils;

import com.dream.basketball.dto.UserInformationDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
public class RedisUtil {

    @Autowired
    StringRedisTemplate stringRedisTemplate;

    public void addMsgToRedis(String receiverId, String msgType, String msgId, String operatorId){
        stringRedisTemplate.opsForZSet().add("msg:" + receiverId, msgType + "," + msgId + "," + operatorId, stringRedisTemplate.opsForZSet().size("msg:" + receiverId) + 1);
    }

    public void removeMsgFromRedis(String userId, String msgType, String msgId, String operatorId){
        stringRedisTemplate.opsForZSet().remove("msg:" + userId, msgType + "," + msgId + "," + operatorId);
    }


}
