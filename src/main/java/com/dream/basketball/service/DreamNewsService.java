package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.esEntity.News;

public interface DreamNewsService extends IService<DreamNews> {

    public void good(String newsId, Integer num);

    public void bad(String newsId, Integer num);

    public boolean saveSyncEs(News news);

    public boolean deleteSyncEs(String newsIds);

}
