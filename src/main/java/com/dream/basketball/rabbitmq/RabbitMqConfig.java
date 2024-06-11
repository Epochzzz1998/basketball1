package com.dream.basketball.rabbitmq;

import org.springframework.amqp.core.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    /**
    * @Description: 交换机
    * @param: []
    * @Author: Epoch
    * @return: org.springframework.amqp.core.TopicExchange
    * @Date: 2024/6/7
    * @time: 15:14
    */
    @Bean
    TopicExchange exchange() {
        return new TopicExchange("exchange");
    }

    /**
    * @Description: 新闻点赞
    * @param: []
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Queue
    * @Date: 2024/6/5
    * @time: 15:36
    */
    @Bean(name = "goodNewsQueue")
    public Queue goodNewsQueue() {
        return  QueueBuilder.durable("good_news_queue").build();
    }

    /**
    * @Description: 新闻点踩
    * @param: []
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Queue
    * @Date: 2024/6/7
    * @time: 17:02
    */
    @Bean(name = "badNewsQueue")
    public Queue badNewsQueue() {
        return  QueueBuilder.durable("bad_news_queue").build();
    }

    /**
    * @Description: 评论点赞
    * @param: []
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Queue
    * @Date: 2024/6/11
    * @time: 10:48
    */
    @Bean(name = "goodCommentQueue")
    public Queue goodCommentQueue(){
        return  QueueBuilder.durable("good_comment_queue").build();
    }

    /**
    * @Description: 评论点踩
    * @param: []
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Queue
    * @Date: 2024/6/11
    * @time: 10:48
    */
    @Bean(name = "badCommentQueue")
    public Queue badCommentQueue(){
        return  QueueBuilder.durable("bad_comment_queue").build();
    }

    /**
    * @Description: 绑定新闻/帖子点赞队列
    * @param: [queue, exchange]
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Binding
    * @Date: 2024/6/7
    * @time: 15:46
    */
    @Bean
    public Binding goodNewsBinding(@Qualifier("goodNewsQueue") Queue queue, @Qualifier("exchange") TopicExchange exchange) {
        return BindingBuilder.bind(queue).to(exchange).with("good.news");
    }

    /**
    * @Description: 绑定新闻/帖子点踩队列
    * @param: [queue, exchange]
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Binding
    * @Date: 2024/6/7
    * @time: 17:03
    */
    @Bean
    public Binding badNewsBinding(@Qualifier("badNewsQueue") Queue queue, @Qualifier("exchange") TopicExchange exchange) {
        return BindingBuilder.bind(queue).to(exchange).with("bad.news");
    }

    /**
    * @Description: 绑定评论点赞队列
    * @param: [queue, exchange]
    * @Author: Epoch
    * @return: org.springframework.amqp.core.Binding
    * @Date: 2024/6/11
    * @time: 10:49
    */
    @Bean
    public Binding goodCommentBiding(@Qualifier("goodCommentQueue") Queue queue, @Qualifier("exchange") TopicExchange exchange){
        return BindingBuilder.bind(queue).to(exchange).with("good.comment");
    }

    @Bean
    public Binding badCommentBiding(@Qualifier("badCommentQueue") Queue queue, @Qualifier("exchange") TopicExchange exchange){
        return BindingBuilder.bind(queue).to(exchange).with("bad.comment");
    }

}
