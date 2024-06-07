package com.dream.basketball.service;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamUser;

import javax.servlet.http.HttpServletRequest;

public interface RabbitMqService {

    public void newsActionRmq(String newsId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNews dreamNews, String action);

}
