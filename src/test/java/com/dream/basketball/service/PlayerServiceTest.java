package com.dream.basketball.service;

import cn.hutool.core.date.DateUtil;
import com.alibaba.fastjson.JSONObject;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.impl.NewsServiceImpl;
import org.elasticsearch.action.get.GetResponse;
import org.elasticsearch.client.transport.TransportClient;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.sort.SortBuilders;
import org.elasticsearch.search.sort.SortOrder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchRestTemplate;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.NativeSearchQuery;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;
import org.elasticsearch.common.transport.TransportAddress;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.io.IOException;
import java.util.*;
import java.net.InetAddress;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PlayerServiceTest {

    @Autowired
    private PlayerService playerService;

    @Autowired
    private ElasticsearchRestTemplate elasticsearchRestTemplate;

    @Autowired
    NewsService newsService;

    @Autowired
    NewsServiceImpl newsServiceImpl;

    @Autowired
    StringRedisTemplate stringRedisTemplate;

    @Test
    void findAllPlayers() {
        DreamPlayerDto dreamPlayerDto = new DreamPlayerDto();
        System.out.println(playerService.findAllPlayers(dreamPlayerDto));
    }

    @Test
    public void insertData() {
        List<News> list = new ArrayList<>();
        list.add(new News("2e71072d-7b35-4ce0-b800-3fb83ed7d82b", "詹姆斯真的牛逼111", "詹姆斯太强啦", "epoch", DateUtil.parse("2023-01-08 10:23:22"), "LAL", "新闻"));
//        list.add(new News(UUID.randomUUID().toString(), "詹姆斯真的不行", "詹姆斯太弱啦", "epoch", DateUtil.parse("2023-01-05 10:13:52"), "LAL", "新闻"));
//        list.add(new News(UUID.randomUUID().toString(), "你知道的，加兰、米切尔是我兄弟", "詹姆斯又跑啦", "epoch", DateUtil.parse("2023-01-04 08:11:22"), "LAL", "交易"));
//        list.add(new News(UUID.randomUUID().toString(), "杜兰特给比尔点赞", "杜兰特快跑", "epoch", DateUtil.parse("2023-01-09 12:23:22"), "PHX", "交易"));
//        list.add(new News(UUID.randomUUID().toString(), "杜兰特想试试回勇士吗", "杜兰特去湖人吧", "epoch", DateUtil.parse("2023-01-09 12:23:22"), "LAL", "交易"));
        newsService.saveAll(list);
    }

    @Test
    public void getListTest(){
        NewsDto newsDto = new NewsDto();
        List<News> newsList = newsService.getNewsByParams(newsDto);
        for (News news : newsList) {
            System.out.println(news.getContent() + news.getPublishDate() + news.getNewsType());
        }
    }

    @Test
    public void getTest() throws IOException {
        NewsDto newsDto = new NewsDto();
        newsDto.setNewsType("交易");
        newsDto.setContent("詹姆斯");
        List<News> newsList = newsService.getNewsByParams(newsDto);
        for (News news : newsList) {
            System.out.println(news.getContent() + "\n" + news.getTitle() + "\n" + news.getNewsType());
        }
    }

    @Test
    public void deleteData() {
        newsService.deleteNewsById("41faf0f2-ec79-4cc2-bffc-a5f9eca2a02f", News.class);
    }

    @Test
    public void insertIndex() {
        newsService.create(News.class);
    }

    @Test
    public void testCreateIndex() {
        //创建索引
        IndexOperations indexOperations = elasticsearchRestTemplate.indexOps(IndexCoordinates.of("newstest"));
        if (indexOperations.exists()) {
            System.out.println("索引已经存在");
        } else {
            //创建索引
            indexOperations.create();
        }
    }

    @Test
    public void testDeleteIndex() {
        //删除索引
        IndexOperations indexOperations = elasticsearchRestTemplate.indexOps(IndexCoordinates.of("employee_index"));
        indexOperations.delete();
    }

    @Test
    public void testQueryDocument() {
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();
        //查询
        builder.withQuery(QueryBuilders.matchQuery("content", "詹姆斯"));
        // 设置分页信息
        builder.withPageable(PageRequest.of(0, 5));
        // 设置排序
//        builder.withSort(SortBuilders.fieldSort("age").order(SortOrder.DESC));
        SearchHits<News> search = elasticsearchRestTemplate.search(builder.build(), News.class);
        List<SearchHit<News>> searchHits = search.getSearchHits();
        for (SearchHit hit : searchHits) {
            System.out.println("返回结果：" + hit.toString());
        }
    }

    @Test
    public void getDataList(){
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();
        //查询
        builder.withQuery(QueryBuilders.matchQuery("content", "詹姆斯"));
        // 设置分页信息
        builder.withPageable(PageRequest.of(0, 5));
        // 设置排序
//        builder.withSort(SortBuilders.fieldSort("age").order(SortOrder.DESC));
        SearchHits<News> search = elasticsearchRestTemplate.search(builder.build(), News.class);
        List<SearchHit<News>> searchHits = search.getSearchHits();
        for (SearchHit hit : searchHits) {
            News news = (News) hit.getContent();
            System.out.println("返回结果：" + hit.toString());

        }
    }

    @Test
    public void testInsertBatch() {
        DreamPlayerDto dreamPlayerDto = new DreamPlayerDto();
        List<DreamPlayerDto> dreamPlayerDtos = playerService.findAllPlayers(dreamPlayerDto);
        List<IndexQuery> queries = new ArrayList<>();
        for (DreamPlayerDto dreamPlayer : dreamPlayerDtos) {
            IndexQuery indexQuery = new IndexQuery();
            indexQuery.setId(dreamPlayer.getPlayerId());
            String json = JSONObject.toJSONString(dreamPlayer);
            indexQuery.setSource(json);
            queries.add(indexQuery);
        }
        //bulk批量插入
        elasticsearchRestTemplate.bulkIndex(queries, DreamPlayerDto.class);
    }

    @Test
    public void redisTest(){
        ValueOperations<String, String> opsForValue = stringRedisTemplate.opsForValue();
        opsForValue.set("city", "南京");
        String value = opsForValue.get("city");
        System.out.println(value);
    }

    @Test
    public void getDataTest() {
//        try {
//            // 设置集群名称biehl01,Settings设置es的集群名称,使用的设计模式，链式设计模式、build设计模式。
//            Settings settings = Settings.builder().put("cluster.name", "biehl01").build();
//            // 读取es集群中的数据,创建client。
//            @SuppressWarnings("resource")
//            TransportClient client = new PreBuiltTransportClient(settings).addTransportAddresses(
//                    // 用java访问ES用的端口是9300。es的9200是restful的请求端口号
//                    // 由于我使用的是伪集群,所以就配置了一台机器,如果是集群方式,将竞选主节点的加进来即可。
//                    // new InetSocketTransportAddress(InetAddress.getByName("192.168.110.133"),
//                    // 9300),
//                    // new InetSocketTransportAddress(InetAddress.getByName("192.168.110.133"),
//                    // 9300),
//                    new TransportAddress(InetAddress.getByName("127.0.0.1"), 9200));
//            // 搜索数据(.actionGet()方法是同步的，没有返回就等待)
//            // 方式是先去索引里面查询出索引数据,再去文档里面查询出数据。
//            GetResponse response = client.prepareGet("user", "_doc", "1").execute().actionGet();
//            // 输出结果
//            System.out.println(response);
//            // 关闭client
//            client.close();
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
    }
}