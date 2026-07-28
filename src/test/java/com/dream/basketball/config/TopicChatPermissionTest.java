package com.dream.basketball.config;

import com.alibaba.fastjson.JSON;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumTopic;
import com.dream.basketball.entity.ForumTopicMember;
import com.dream.basketball.mapper.ForumTopicMemberMapper;
import com.dream.basketball.utils.Constants;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 群聊准入规则。这套判定同时守着两个入口——REST 的 /chat/send 和 WebSocket 的房间订阅，
 * 后者一旦放宽，任何登录用户改一下订阅地址就能听私密专题的群聊，所以逐条钉死。
 *
 * 注意它和发帖/发言的默认值是**相反**的：那两个是默认关、逐项授予，群聊是默认开、按人禁言。
 */
class TopicChatPermissionTest {

    private final ForumTopicMemberMapper memberMapper = Mockito.mock(ForumTopicMemberMapper.class);
    private final TopicPermissionService perms = new TopicPermissionService();

    TopicChatPermissionTest() {
        ReflectionTestUtils.setField(perms, "memberMapper", memberMapper);
    }

    private ForumTopic topic(String visibility, String chatEnabled, String ownerId) {
        ForumTopic t = new ForumTopic();
        t.setTopicId("t-1");
        t.setVisibility(visibility);
        t.setChatEnabled(chatEnabled);
        t.setOwnerId(ownerId);
        t.setOwnerIds(JSON.toJSONString(Collections.singletonList(ownerId)));
        return t;
    }

    private DreamUser user(String id, String role) {
        DreamUser u = new DreamUser();
        u.setUserId(id);
        u.setUserRole(role);
        return u;
    }

    /** 该用户在这个专题里的成员行；canChat 传 null 表示"有成员行但没设过群聊开关"。 */
    private void memberRow(String canView, String canChat) {
        ForumTopicMember m = new ForumTopicMember();
        m.setTopicId("t-1");
        m.setUserId("u-1");
        m.setCanView(canView);
        m.setCanChat(canChat);
        Mockito.when(memberMapper.selectOne(ArgumentMatchers.any())).thenReturn(m);
    }

    private void noMemberRow() {
        Mockito.when(memberMapper.selectOne(ArgumentMatchers.any())).thenReturn(null);
    }

    // ---------- 总开关 ----------

    @Test
    void chatOff_nobodyGetsIn_notEvenTheOwner() {
        ForumTopic t = topic(TopicPermissionService.PUBLIC, "0", "owner-1");
        noMemberRow();
        assertFalse(perms.canChat(user("owner-1", Constants.NORMAL_USER), t), "题主自己关的群聊，他也不该看见房间");
        assertFalse(perms.canChat(user("u-1", Constants.NORMAL_USER), t));
        assertFalse(perms.canChat(user("admin", Constants.SUPER_MANAGER), t), "超管也不例外，否则界面自相矛盾");
    }

    @Test
    void anonymous_neverGetsIn() {
        assertFalse(perms.canChat(null, topic(TopicPermissionService.PUBLIC, "1", "owner-1")));
    }

    @Test
    void nullTopic_isNotARoom() {
        assertFalse(perms.canChat(user("u-1", Constants.NORMAL_USER), null));
    }

    // ---------- 可见性 ----------

    @Test
    void privateTopic_nonMemberStaysOut() {
        noMemberRow();
        assertFalse(perms.canChat(user("u-1", Constants.NORMAL_USER),
                topic(TopicPermissionService.PRIVATE, "1", "owner-1")),
                "看不见这个专题的人，更不该进它的群聊");
    }

    @Test
    void privateTopic_memberWithViewGetsIn() {
        memberRow("1", null);
        assertTrue(perms.canChat(user("u-1", Constants.NORMAL_USER),
                topic(TopicPermissionService.PRIVATE, "1", "owner-1")));
    }

    // ---------- 默认放开 / 按人禁言 ----------

    @Test
    void publicTopic_defaultsOpenWithoutAnyMemberRow() {
        noMemberRow();
        assertTrue(perms.canChat(user("u-1", Constants.NORMAL_USER),
                topic(TopicPermissionService.PUBLIC, "1", "owner-1")),
                "公开专题 + 群聊已开 + 没被单独禁言 = 能进");
    }

    @Test
    void memberRowWithoutFlag_isStillOpen() {
        memberRow("1", null); // 老数据：有成员行，但那时候还没有 CAN_CHAT 这一列
        assertTrue(perms.canChat(user("u-1", Constants.NORMAL_USER),
                topic(TopicPermissionService.PUBLIC, "1", "owner-1")));
    }

    @Test
    void explicitlyMuted_isBlocked() {
        memberRow("1", "0");
        assertFalse(perms.canChat(user("u-1", Constants.NORMAL_USER),
                topic(TopicPermissionService.PUBLIC, "1", "owner-1")));
    }

    @Test
    void mutedManager_stillGetsIn() {
        memberRow("1", "0");
        assertTrue(perms.canChat(user("owner-1", Constants.NORMAL_USER),
                topic(TopicPermissionService.PUBLIC, "1", "owner-1")),
                "题主不受自己那行禁言标记影响");
    }
}
