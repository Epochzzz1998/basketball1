package com.dream.basketball.impl;

import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.service.NewsService;
import org.apache.commons.lang3.StringUtils;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.elasticsearch.core.ElasticsearchRestTemplate;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.NativeSearchQuery;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class NewsServiceImpl implements NewsService {

    @Autowired
    ElasticsearchRestTemplate template;

    @Autowired
    private RestHighLevelClient client;

    public void create(Class<?> clazz) {
        template.indexOps(clazz);
    }

    public void saveAll(Iterable<?> entities) {
        template.save(entities);
    }

    /**
    * @Description: 保存方法
    * @param: [news]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/1/10
    * @time: 17:34
    */
    public void save(News news){
        template.save(news);
    }

    /**
    * @Description: 根据id删除新闻
    * @param: [newsId, clazz]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/1/10
    * @time: 14:05
    */
    public void deleteNewsById(String newsId, Class<?> clazz) {
        template.delete(newsId, clazz);
    }

    /**
    * @Description: 批量删除
    * @param: [newsId, clazz]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/1/10
    * @time: 14:50
    */
    public void deleteNewsListByIds(List<String> newsIdList, Class<?> clazz){
        for (String newsId : newsIdList) {
            deleteNewsById(newsId, clazz);
        }
    }

    /**
     * @Description: 新闻列表查询
     * @param: [params]
     * @Author: Epoch
     * @return: java.util.List<com.dream.basketball.esEntity.News>
     * @Date: 2024/1/10
     * @time: 10:19
     */
    public List<News> getNewsByParams(NewsDto params) {
        NativeSearchQueryBuilder builder = getMatchSearch(params);
        NativeSearchQuery nativeSearchQuery = builder.build();
        // 设置分页信息
//        builder.withPageable(PageRequest.of(0, 5));
        // 设置排序
//        builder.withSort(SortBuilders.fieldSort("publishDate").order(SortOrder.DESC));
        SearchHits<News> search = template.search(nativeSearchQuery, News.class);
        List<SearchHit<News>> searchHits = search.getSearchHits();
        List<News> newsList = new ArrayList<>();
        for (SearchHit hit : searchHits) {
            newsList.add((News) hit.getContent());
        }
        return newsList;
    }

    /**
     * @Description: 搜索条件
     * @param: [params]
     * @Author: Epoch
     * @return: org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder
     * @Date: 2024/1/10
     * @time: 10:19
     */
    private NativeSearchQueryBuilder getMatchSearch(NewsDto params) {
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();
        BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
        if (params != null) {
            if (StringUtils.isNotBlank(params.getNewsId())) {
                queryBuilder.must(QueryBuilders.matchQuery("newsId", params.getNewsId()));
            }
            if (StringUtils.isNotBlank(params.getTeam())) {
                queryBuilder.must(QueryBuilders.matchQuery("team", params.getTeam()));
            }
            if (StringUtils.isNotBlank(params.getNewsType())) {
                queryBuilder.must(QueryBuilders.matchQuery("newsType", params.getNewsType()));
            }
            if (StringUtils.isNotBlank(params.getContent())) {
                queryBuilder.must(QueryBuilders.matchQuery("content", params.getContent()));
            }
            if (StringUtils.isNotBlank(params.getAuthor())) {
                queryBuilder.must(QueryBuilders.matchQuery("author", params.getAuthor()));
            }
        }
        return builder.withQuery(queryBuilder);
    }

}
