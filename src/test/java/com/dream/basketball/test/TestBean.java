package com.dream.basketball.test;

import com.dream.basketball.service.PlayerService;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringJUnit4ClassRunner.class) //作用：让当前类在容器环境下进行测试
@org.springframework.boot.test.context.SpringBootTest(classes = SpringBootApplication.class)
public class TestBean {

    @Autowired
    private PlayerService playerService;

    @Test
    public void test(){
        System.out.println(playerService.count());
    }

}
