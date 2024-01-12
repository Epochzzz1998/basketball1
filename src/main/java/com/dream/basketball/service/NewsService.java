package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.esEntity.News;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

public interface NewsService {

    public void create(Class<?> clazz);

    public void saveAll(Iterable<?> entities);

    public void save(News news);

    public void deleteNewsById(String newsId, Class<?> clazz);

    public void deleteNewsListByIds(List<String> newsIdList, Class<?> clazz);

    public List<News> getNewsByParams(NewsDto params);

}
