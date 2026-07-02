package com.dream.basketball.esEntity;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.util.Date;

@Data
@NoArgsConstructor
@Document(indexName = "news")
public class News {

    @Id
    private String newsId;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String title;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String content;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String author;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String authorId;

    @Field(type = FieldType.Date, name = "publishDate",format = {},
            pattern = "yyyy-MM-dd HH:mm:ss || yyyy-MM-dd'T'HH:mm:ss'+08:00' || strict_date_optional_time || epoch_millis")
    private Date publishDate;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String team;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String newsType;

    /** official = manager-published news zone; forum = user posts. Missing on legacy docs (= forum). */
    @Field(type = FieldType.Keyword)
    private String newsChannel;

}



