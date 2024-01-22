package com.dream.basketball.kafka;

import com.alibaba.fastjson.JSONObject;
import com.dream.basketball.dto.EventDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class EventProducer {

    @Autowired
    private KafkaTemplate kafkaTemplate;

    // 处理事件
    public void fireEvent(EventDto event){
        // 将事件发布到指定的主题(评论、点赞、关注)
        kafkaTemplate.send(event.getTopic(), JSONObject.toJSONString(event));
    }
}


