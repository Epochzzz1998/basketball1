package com.dream.basketball.esEntity;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.DateFormat;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.LocalDateTime;
import java.util.Date;

@Data
@NoArgsConstructor
@Document(indexName = "newstest")
public class News {

    @Id
    private String newsId;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String title;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String content;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String author;

    @Field(type = FieldType.Date, name = "publishDate",format = {},
            pattern = "yyyy-MM-dd HH:mm:ss || yyyy-MM-dd'T'HH:mm:ss'+08:00' || strict_date_optional_time || epoch_millis")
    private Date publishDate;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String team;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String newsType;

    public News(String newsId, String title, String content, String author, Date publishDate, String team, String newsType) {
        this.newsId = newsId;
        this.title = title;
        this.content = content;
        this.author = author;
        this.publishDate = publishDate;
        this.team = team;
        this.newsType = newsType;
    }
}



