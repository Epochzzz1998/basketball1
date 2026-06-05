package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 梦想球员实体类
 * @Date 2023/2/1 11:04
 * @Param
 * @return
 **/
public class DreamPlayer extends Model<DreamPlayer> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "PLAYER_ID", type = IdType.INPUT)
    private String playerId;

    @TableField("PLAYER_NAME")
    private String playerName;

    @TableField("PLAYER_NUMBER")
    private String playerNumber;

    @TableField("PLAYER_BIRTHDAY")
    private Date playerBirthday;

    @Override
    public String toString() {
        return "DreamPlayer{" +
                "playerId='" + playerId + '\'' +
                ", playerName='" + playerName + '\'' +
                ", playerNumber='" + playerNumber + '\'' +
                ", playerBirthday=" + playerBirthday +
                '}';
    }

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }

    public String getPlayerName() {
        return playerName;
    }

    public void setPlayerName(String playerName) {
        this.playerName = playerName;
    }

    public String getPlayerNumber() {
        return playerNumber;
    }

    public void setPlayerNumber(String playerNumber) {
        this.playerNumber = playerNumber;
    }

    public Date getPlayerBirthday() {
        return playerBirthday;
    }

    public void setPlayerBirthday(Date playerBirthday) {
        this.playerBirthday = playerBirthday;
    }

}