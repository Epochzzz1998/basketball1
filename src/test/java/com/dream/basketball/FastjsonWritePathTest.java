package com.dream.basketball;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.PlayerStats;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Calendar;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P0-4 point-test: verifies the fastjson 1.x -> fastjson2 (v1-compat) swap keeps the
 * write-path JSON behavior identical. Covers the exact call sites used in production:
 * <ul>
 *   <li>PlayerController#savePlayer / savePlayerStats: {@code JSON.parseArray(data, X.class)}</li>
 *   <li>NewsServiceImpl: {@code JSONObject.parseObject(JSONObject.toJSONString(x), Y.class)}</li>
 * </ul>
 * Plain JUnit (no Spring context) so it runs without MySQL/Redis/ES.
 */
class FastjsonWritePathTest {

    /** PlayerController#savePlayerStats line: JSON.parseArray(data, PlayerStats.class) */
    @Test
    void parseArray_playerStats_bindsDecimalsIntsAndCjkStrings() {
        String data = "[{"
                + "\"statsId\":\"fj2-s1\",\"playerId\":\"fj2\",\"season\":5,\"seasonNum\":5,"
                + "\"playerTeam\":\"LAC\",\"playerPosition\":\"SF\","
                + "\"playerAppearance\":80,\"playerFrAppearance\":80,\"playerSrAppearance\":0,"
                + "\"playingTime\":37.1,\"playerAvgScore\":29.7,\"playerAvgReb\":9.6,\"playerAvgAss\":3.5,"
                + "\"playerAccuracy\":0.524,\"playerThreeAccuracy\":0.349,\"playerFreethrowAccuracy\":0.807,"
                + "\"playerAvgBlock\":0.6,\"playerAvgSteal\":1.4,\"playerAvgTurnover\":3.2,"
                + "\"playerPer\":25.3,\"playerPie\":19.5,\"playerWs\":11.5,"
                + "\"playerOffEff\":119.3,\"playerDefEff\":99.5,\"playerNetEff\":13.4,\"playerAvgPn\":7.9,"
                + "\"mvpRank\":4,\"dpoyRank\":1,\"allDbaTeam\":\"二阵\",\"allDefTeam\":\"一阵\"}]";

        List<PlayerStats> list = JSON.parseArray(data, PlayerStats.class);

        assertNotNull(list);
        assertEquals(1, list.size());
        PlayerStats ps = list.get(0);
        // String fields
        assertEquals("fj2-s1", ps.getStatsId());
        assertEquals("fj2", ps.getPlayerId());
        assertEquals("LAC", ps.getPlayerTeam());
        assertEquals("SF", ps.getPlayerPosition());
        // CJK strings must survive intact
        assertEquals("二阵", ps.getAllDbaTeam());
        assertEquals("一阵", ps.getAllDefTeam());
        // Integer fields
        assertEquals(5, ps.getSeason());
        assertEquals(5, ps.getSeasonNum());
        assertEquals(80, ps.getPlayerAppearance());
        assertEquals(80, ps.getPlayerFrAppearance());
        assertEquals(0, ps.getPlayerSrAppearance());
        assertEquals(4, ps.getMvpRank());
        assertEquals(1, ps.getDpoyRank());
        // BigDecimal fields (value parity, scale-insensitive)
        assertEquals(0, ps.getPlayerAvgScore().compareTo(new BigDecimal("29.7")));
        assertEquals(0, ps.getPlayingTime().compareTo(new BigDecimal("37.1")));
        assertEquals(0, ps.getPlayerAccuracy().compareTo(new BigDecimal("0.524")));
        assertEquals(0, ps.getPlayerThreeAccuracy().compareTo(new BigDecimal("0.349")));
        assertEquals(0, ps.getPlayerPer().compareTo(new BigDecimal("25.3")));
        assertEquals(0, ps.getPlayerNetEff().compareTo(new BigDecimal("13.4")));
    }

    /** PlayerController#savePlayer line: JSON.parseArray(data, DreamPlayer.class), incl. Date binding */
    @Test
    void parseArray_dreamPlayer_bindsStringsAndDate() {
        String data = "[{\"playerId\":\"fj2\",\"playerName\":\"测试球员\",\"playerNumber\":\"23\","
                + "\"playerBirthday\":\"2000-05-20\"}]";

        List<DreamPlayer> list = JSON.parseArray(data, DreamPlayer.class);

        assertEquals(1, list.size());
        DreamPlayer p = list.get(0);
        assertEquals("fj2", p.getPlayerId());
        assertEquals("测试球员", p.getPlayerName());
        assertEquals("23", p.getPlayerNumber());
        assertNotNull(p.getPlayerBirthday(), "fastjson2 should parse yyyy-MM-dd into Date");
        Calendar c = Calendar.getInstance();
        c.setTime(p.getPlayerBirthday());
        assertEquals(2000, c.get(Calendar.YEAR));
    }

    /** Empty payload (the no-op branch in insertAndSavePlayerStats) must yield an empty list, not null/throw. */
    @Test
    void parseArray_emptyArray_isEmptyList() {
        List<PlayerStats> list = JSON.parseArray("[]", PlayerStats.class);
        assertNotNull(list);
        assertTrue(list.isEmpty());
    }

    /** NewsServiceImpl pattern: JSONObject.parseObject(JSONObject.toJSONString(obj), Class) round-trip. */
    @Test
    void toJSONString_then_parseObject_roundTrips() {
        DreamPlayer src = new DreamPlayer();
        src.setPlayerId("fj2");
        src.setPlayerName("测试球员");
        src.setPlayerNumber("23");

        String json = JSONObject.toJSONString(src);
        DreamPlayer back = JSONObject.parseObject(json, DreamPlayer.class);

        assertEquals(src.getPlayerId(), back.getPlayerId());
        assertEquals(src.getPlayerName(), back.getPlayerName());
        assertEquals(src.getPlayerNumber(), back.getPlayerNumber());
    }
}
