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
    * @Description: 绑定队列
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

}
