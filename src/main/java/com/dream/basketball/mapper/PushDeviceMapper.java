package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.PushDevice;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.util.Date;

public interface PushDeviceMapper extends BaseMapper<PushDevice> {

    /**
     * 记一次成功送达。
     *
     * <p>单独写一条 UPDATE 而不是 selectById → set → updateById：那样是两次往返，
     * 而且中间那一下把整行都读上来只为了改一列。
     */
    @Update("UPDATE push_device SET LAST_OK = #{at} WHERE DEVICE_ID = #{deviceId}")
    int touchLastOk(@Param("deviceId") String deviceId, @Param("at") Date at);
}
