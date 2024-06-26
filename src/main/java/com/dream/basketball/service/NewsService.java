package com.dream.basketball.service;

import com.dream.basketball.dto.*;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.Comment;
import com.dream.basketball.esEntity.News;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

public interface NewsService {

    public void create(Class<?> clazz);

    public void saveAll(Iterable<?> entities);

    public void save(News news);

    public void saveComment(Comment comment);

    public void deleteNewsById(String newsId, Class<?> clazz);

    public void deleteNewsListByIds(String newsIds, Class<?> clazz);

    public List<NewsDto> getNewsByParams(NewsDto params);

    public List<DreamNewsCommentDto> getCommentListByParams(DreamNewsCommentDto params);

    public Object good(String newsId, HttpServletRequest request);

    public Object bad(String newsId, HttpServletRequest request);

    public Object goodComment(String commentId, HttpServletRequest request);

    public Object badComment(String commentId, HttpServletRequest request);

    public Object comment(DreamNewsComment dreamNewsComment, HttpServletRequest request);

    public News getInputAndEditNews(String newsId, HttpServletRequest request);

    public DreamNewsComment getCommentInit(String newsId, HttpServletRequest request, String level, String commentId);

    public News getNewsShow(String newsId);

}
