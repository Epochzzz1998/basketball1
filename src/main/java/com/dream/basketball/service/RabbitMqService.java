package com.dream.basketball.service;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamUser;

import javax.servlet.http.HttpServletRequest;

public interface RabbitMqService {

    public void goodNewsRmq(String newsId, String userId, boolean isGood, DreamUser dreamUser, DreamNews dreamNews);

}
