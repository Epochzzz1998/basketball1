package com.dream.basketball.service;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;

import javax.servlet.http.HttpServletRequest;

public interface RabbitMqService {

    public void newsActionRmq(String newsId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNews dreamNews, String action);

    public void commentActionRmq(String commentId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNewsComment dreamNewsComment, String action);

}
