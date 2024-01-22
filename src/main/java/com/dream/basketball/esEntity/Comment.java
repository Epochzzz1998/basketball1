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
@Document(indexName = "comment")
public class Comment {

    @Id
    private String commentId;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String userId;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String userName;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String content;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String newsId;

    @Field(type = FieldType.Date, name = "publishDate",format = {},
            pattern = "yyyy-MM-dd HH:mm:ss || yyyy-MM-dd'T'HH:mm:ss'+08:00' || strict_date_optional_time || epoch_millis")
    private Date commentDate;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String team;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String goodNum;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String badNum;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String commentRelId;

    @Field(type = FieldType.Integer, analyzer = "ik_max_word")
    private Integer floor;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String level;

}



