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

    /** owning forum topic (keyword, exact filtering). Null for official news; backfilled for legacy forum posts. */
    @Field(type = FieldType.Keyword)
    private String topicId;

    /** free-form tags, comma-separated (replaces the old team/newsType selects). */
    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String tags;

    /** 置顶 '1'/'0'. Lives in dream_news; merged in at read time, not indexed in ES. */
    @org.springframework.data.annotation.Transient
    private String top;

    /** 精华 '1'/'0'. Lives in dream_news; merged in at read time, not indexed in ES. */
    @org.springframework.data.annotation.Transient
    private String essence;

    /** 浏览计数（PV 总数 / UV 人数）。存 dream_news，读时合并，不进 ES。 */
    @org.springframework.data.annotation.Transient
    private Integer viewCount;

    @org.springframework.data.annotation.Transient
    private Integer viewerCount;

}



