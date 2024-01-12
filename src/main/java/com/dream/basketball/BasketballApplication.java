package com.dream.basketball;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.dream.basketball.mapper")
public class BasketballApplication {

    public static void main(String[] args) {
        SpringApplication.run(BasketballApplication.class, args);
    }

}
