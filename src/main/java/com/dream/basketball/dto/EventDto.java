package com.dream.basketball.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class EventDto {

    private String userId;

    private String topic;

    // 封装其他数据，用于扩展
    private Map<String,Object> data = new HashMap<>(16);

}
