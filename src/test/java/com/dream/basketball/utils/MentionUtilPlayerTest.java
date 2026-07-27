package com.dream.basketball.utils;

import org.junit.jupiter.api.Test;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * NBA 专区的帖子能 @ 球员，和 @ 用户共用同一种 mention span，靠 data-info 里的 kind 区分。
 * 两者必须分得干净：球员 id 混进用户集合就会去 @ 一个不存在的用户，发出一条谁也收不到的通知。
 */
class MentionUtilPlayerTest {

    private static String span(String infoJson, String visible) {
        String encoded;
        try {
            encoded = URLEncoder.encode(infoJson, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return "<span data-w-e-type=\"mention\" data-info=\"" + encoded + "\">@" + visible + "</span>";
    }

    private static final String USER_SPAN = span("{\"id\":\"u-1\"}", "老王");
    private static final String PLAYER_SPAN = span("{\"id\":\"nba-3975\",\"kind\":\"player\"}", "斯蒂芬·库里");
    private static final String BODY = "<p>" + USER_SPAN + " 你看 " + PLAYER_SPAN + " 这场</p>";

    @Test
    void userIdsExcludePlayers() {
        Set<String> users = MentionUtil.parseNewsMentionIds(BODY);
        assertEquals(Collections.singleton("u-1"), users);
        assertFalse(users.contains("nba-3975"), "球员 id 不能进用户集合——会给不存在的用户发通知");
    }

    @Test
    void playerIdsExcludeUsers() {
        assertEquals(Collections.singleton("nba-3975"), MentionUtil.parseNewsPlayerMentionIds(BODY));
    }

    /** 老帖的 span 没有 kind，按用户算（这套机制上线前发的帖全长这样）。 */
    @Test
    void legacySpanCountsAsUser() {
        assertEquals(Collections.singleton("u-1"), MentionUtil.parseNewsMentionIds(USER_SPAN));
        assertTrue(MentionUtil.parseNewsPlayerMentionIds(USER_SPAN).isEmpty());
    }

    /** 改名重写也要认 kind：拿用户昵称表去刷球员名（反之亦然）会把名字改错。 */
    @Test
    void renameRewriteStaysOnItsOwnKind() {
        String byUserMap = MentionUtil.rewriteNewsMentionNames(BODY, Collections.singletonMap("nba-3975", "错的名字"));
        assertTrue(byUserMap.contains("@斯蒂芬·库里"), "用户昵称表不该动到球员 span");

        String byPlayerMap = MentionUtil.rewritePlayerMentionNames(BODY, Collections.singletonMap("u-1", "错的名字"));
        assertTrue(byPlayerMap.contains("@老王"), "球员名表不该动到用户 span");

        String renamed = MentionUtil.rewritePlayerMentionNames(BODY, Collections.singletonMap("nba-3975", "库里"));
        assertTrue(renamed.contains("@库里"), "球员改名后正文里的 @ 应显示新名");
        assertTrue(renamed.contains("data-info"), "重写只换可见文字，data-info 保持不动");
    }

    /** 自动链接只处理标签外的纯文本，已有的球员 span 整块跳过，不能被当成待识别文本再包一层。 */
    @Test
    void autoLinkLeavesPlayerSpanAlone() {
        String out = MentionUtil.autoLinkNewsMentions(BODY, Collections.singletonMap("斯蒂芬·库里", "u-2"));
        assertEquals(Collections.singleton("nba-3975"), MentionUtil.parseNewsPlayerMentionIds(out));
        assertEquals(Collections.singleton("u-1"), MentionUtil.parseNewsMentionIds(out));
    }
}
