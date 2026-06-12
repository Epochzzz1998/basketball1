package com.dream.basketball.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.PlayerStats;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.mapper.PlayerStatsMapper;
import com.dream.basketball.service.PlayerStatsService;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.StatsMath;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PlayerStatsServiceImpl extends ServiceImpl<PlayerStatsMapper, PlayerStats> implements PlayerStatsService {

    // P3-2: read career rows via PlayerMapper directly (not PlayerService) to avoid a circular
    // service dependency, which Spring Boot 2.7 rejects by default.
    @Autowired
    private PlayerMapper playerMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void saveStatsAndRecomputeSummary(List<PlayerStats> statsList, String playerId) {
        if (statsList != null) {
            for (PlayerStats playerStats : statsList) {
                if (StringUtils.isBlank(playerStats.getStatsId())) {
                    playerStats.setStatsId(UUID.randomUUID().toString());
                }
                this.saveOrUpdate(playerStats);
            }
        }
        recomputeCareerSummary(playerId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void insertStatsWithBlankRow(List<PlayerStats> statsList, String playerId) {
        if (statsList == null || statsList.isEmpty()) {
            PlayerStats blank = new PlayerStats();
            blank.setStatsId(UUID.randomUUID().toString());
            blank.setPlayerId(playerId);
            blank.setSeasonNum(1);
            this.save(blank);
            return;
        }
        boolean flag = false;
        if (StringUtils.isBlank(statsList.get(0).getStatsId())) {
            for (PlayerStats playerStats : statsList) {
                playerStats.setStatsId(UUID.randomUUID().toString());
                playerStats.setPlayerId(playerId);
                this.saveOrUpdate(playerStats);
            }
        } else {
            for (PlayerStats playerStats : statsList) {
                if (StringUtils.isBlank(playerStats.getStatsId())) {
                    playerStats.setStatsId(UUID.randomUUID().toString());
                }
                flag = true;
                this.saveOrUpdate(playerStats);
            }
            PlayerStats blank = new PlayerStats();
            blank.setStatsId(UUID.randomUUID().toString());
            blank.setPlayerId(playerId);
            blank.setSeasonNum(flag ? statsList.size() : statsList.size() + 1);
            this.save(blank);
        }
    }

    /**
     * Recompute the games-weighted career summary row (season = CAREER_SUMMARY_SEASON).
     * Moved here from PlayerController in P3-2; the P3-1 divide-by-zero / null guards
     * (StatsMath) are preserved exactly.
     */
    private void recomputeCareerSummary(String playerId) {
        PlayerStatsDto param = new PlayerStatsDto();
        param.setPlayerId(playerId);
        List<PlayerStatsDto> rows = playerMapper.findPlayerStats(param);

        int playerFrAppearance = 0;
        int playerSrAppearance = 0;
        int playerAppearance = 0;
        double playingTime = 0.0;
        double playerAvgScore = 0.0;
        double playerAvgReb = 0.0;
        double playerAvgAss = 0.0;
        double playerAccuracy = 0.0;
        double playerThreeAccuracy = 0.0;
        double playerFreethrowAccuracy = 0.0;
        double playerAvgBlock = 0.0;
        double playerAvgSteal = 0.0;
        double playerAvgTurnover = 0.0;
        double playerPer = 0.0;
        double playerPie = 0.0;
        double playerWs = 0.0;
        double playerOffEff = 0.0;
        double playerDefEff = 0.0;
        double playerNetEff = 0.0;
        double playerAvgPn = 0.0;
        int mvpRank = 0;
        int dopyRank = 0;
        int seasonNum = rows.size() - 1;
        PlayerStats summary = null;
        for (PlayerStatsDto dto : rows) {
            if (dto.getSeason() != null && dto.getSeason() == Constants.CAREER_SUMMARY_SEASON) {
                summary = dto;
                continue;
            }
            int appearance = StatsMath.nz(dto.getPlayerAppearance());
            playerFrAppearance += StatsMath.nz(dto.getPlayerFrAppearance());
            playerSrAppearance += StatsMath.nz(dto.getPlayerSrAppearance());
            playerAppearance += appearance;
            playingTime += StatsMath.nz(dto.getPlayingTime()) * appearance;
            playerAvgScore += StatsMath.nz(dto.getPlayerAvgScore()) * appearance;
            playerAvgReb += StatsMath.nz(dto.getPlayerAvgReb()) * appearance;
            playerAvgAss += StatsMath.nz(dto.getPlayerAvgAss()) * appearance;
            playerAccuracy += StatsMath.nz(dto.getPlayerAccuracy()) * appearance;
            playerThreeAccuracy += StatsMath.nz(dto.getPlayerThreeAccuracy()) * appearance;
            playerFreethrowAccuracy += StatsMath.nz(dto.getPlayerFreethrowAccuracy()) * appearance;
            playerAvgBlock += StatsMath.nz(dto.getPlayerAvgBlock()) * appearance;
            playerAvgSteal += StatsMath.nz(dto.getPlayerAvgSteal()) * appearance;
            playerAvgTurnover += StatsMath.nz(dto.getPlayerAvgTurnover()) * appearance;
            playerPer += StatsMath.nz(dto.getPlayerPer()) * appearance;
            playerPie += StatsMath.nz(dto.getPlayerPie()) * appearance;
            playerWs += StatsMath.nz(dto.getPlayerWs()) * appearance;
            playerOffEff += StatsMath.nz(dto.getPlayerOffEff()) * appearance;
            playerDefEff += StatsMath.nz(dto.getPlayerDefEff()) * appearance;
            playerNetEff += StatsMath.nz(dto.getPlayerNetEff()) * appearance;
            playerAvgPn += StatsMath.nz(dto.getPlayerAvgPn()) * appearance;
            mvpRank += StatsMath.nz(dto.getMvpRank());
            dopyRank += StatsMath.nz(dto.getDpoyRank());
        }
        if (summary == null) {
            summary = new PlayerStats();
            summary.setStatsId(UUID.randomUUID().toString());
            summary.setPlayerId(playerId);
            summary.setSeason(Constants.CAREER_SUMMARY_SEASON);
            summary.setSeasonNum(Constants.CAREER_SUMMARY_SEASON);
            summary.setAllDbaTeam("/");
            summary.setAllDefTeam("/");
            summary.setPlayerPosition("/");
            summary.setPlayerTeam("/");
            seasonNum++;
        }
        summary.setPlayerFrAppearance(playerFrAppearance);
        summary.setPlayerSrAppearance(playerSrAppearance);
        summary.setPlayerAppearance(playerAppearance);
        summary.setPlayingTime(StatsMath.avg(playingTime, playerAppearance, 1));
        summary.setPlayerAvgScore(StatsMath.avg(playerAvgScore, playerAppearance, 1));
        summary.setPlayerAvgReb(StatsMath.avg(playerAvgReb, playerAppearance, 1));
        summary.setPlayerAvgAss(StatsMath.avg(playerAvgAss, playerAppearance, 1));
        summary.setPlayerAccuracy(StatsMath.avg(playerAccuracy, playerAppearance, 3));
        summary.setPlayerThreeAccuracy(StatsMath.avg(playerThreeAccuracy, playerAppearance, 3));
        summary.setPlayerFreethrowAccuracy(StatsMath.avg(playerFreethrowAccuracy, playerAppearance, 3));
        summary.setPlayerAvgBlock(StatsMath.avg(playerAvgBlock, playerAppearance, 1));
        summary.setPlayerAvgSteal(StatsMath.avg(playerAvgSteal, playerAppearance, 1));
        summary.setPlayerAvgTurnover(StatsMath.avg(playerAvgTurnover, playerAppearance, 1));
        summary.setPlayerPer(StatsMath.avg(playerPer, playerAppearance, 1));
        summary.setPlayerPie(StatsMath.avg(playerPie, playerAppearance, 1));
        summary.setPlayerWs(StatsMath.avg(playerWs, playerAppearance, 1));
        summary.setPlayerOffEff(StatsMath.avg(playerOffEff, playerAppearance, 1));
        summary.setPlayerDefEff(StatsMath.avg(playerDefEff, playerAppearance, 1));
        summary.setPlayerNetEff(StatsMath.avg(playerNetEff, playerAppearance, 1));
        summary.setPlayerAvgPn(StatsMath.avg(playerAvgPn, playerAppearance, 1));
        summary.setMvpRank(StatsMath.avgInt(mvpRank, seasonNum));
        summary.setDpoyRank(StatsMath.avgInt(dopyRank, seasonNum));
        this.saveOrUpdate(summary);
    }
}
