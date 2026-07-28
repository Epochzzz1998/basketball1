package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.TopicPermissionService;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumTopic;
import com.dream.basketball.entity.UserFollow;
import com.dream.basketball.mapper.ForumTopicMapper;
import com.dream.basketball.mapper.ForumTopicMemberMapper;
import com.dream.basketball.mapper.TopicChatMessageMapper;
import com.dream.basketball.mapper.UserFollowMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * /chat/mentionCandidates 的取人范围。
 *
 * 两条互不相同的规则，混在一起写最容易出错，所以分开钉：
 *  - 私密专题：只列房间里的人。@ 一个进不来的人，他既收不到也看不见。
 *  - 公开专题：再加上我关注的人和关注我的人。公开专题任何登录用户都能进群聊，
 *    所以他们收得到提醒、点进来就能看见，不存在"叫不到"的问题。
 *
 * 顺序也要钉：候选只留 8 条，重名时在场的那个远比"我关注的某人"更可能是要找的。
 */
class ChatMentionCandidateTest {

    private static final String TOPIC = "t-1";
    private static final String ME = "u-me";

    private final TopicChatMessageMapper chatMapper = Mockito.mock(TopicChatMessageMapper.class);
    private final ForumTopicMemberMapper memberMapper = Mockito.mock(ForumTopicMemberMapper.class);
    private final ForumTopicMapper topicMapper = Mockito.mock(ForumTopicMapper.class);
    private final UserFollowMapper followMapper = Mockito.mock(UserFollowMapper.class);
    private final UserMapper userMapper = Mockito.mock(UserMapper.class);

    private final TopicPermissionService perms = new TopicPermissionService();
    private final ChatController controller = new ChatController();

    ChatMentionCandidateTest() {
        ReflectionTestUtils.setField(perms, "topicMapper", topicMapper);
        ReflectionTestUtils.setField(perms, "memberMapper", memberMapper);
        ReflectionTestUtils.setField(controller, "perms", perms);
        ReflectionTestUtils.setField(controller, "chatMapper", chatMapper);
        ReflectionTestUtils.setField(controller, "memberMapper", memberMapper);
        ReflectionTestUtils.setField(controller, "followMapper", followMapper);
        ReflectionTestUtils.setField(controller, "userMapper", userMapper);
        // 没有成员行 = 没被单独禁言，群聊默认放开
        Mockito.when(memberMapper.selectOne(ArgumentMatchers.any())).thenReturn(null);
        Mockito.when(memberMapper.selectList(ArgumentMatchers.any())).thenReturn(Collections.emptyList());
        Mockito.when(chatMapper.speakerIds(TOPIC)).thenReturn(Collections.emptyList());
        Mockito.when(followMapper.selectList(ArgumentMatchers.any())).thenReturn(Collections.emptyList());
    }

    private DreamUser user(String id, String nick) {
        DreamUser u = new DreamUser();
        u.setUserId(id);
        u.setUserNickname(nick);
        return u;
    }

    /** 我是题主（这样私密专题里也进得去群聊），群聊开着 */
    private void topic(String visibility) {
        ForumTopic t = new ForumTopic();
        t.setTopicId(TOPIC);
        t.setVisibility(visibility);
        t.setChatEnabled("1");
        t.setOwnerId(ME);
        t.setOwnerIds(JSON.toJSONString(Collections.singletonList(ME)));
        Mockito.when(topicMapper.selectById(TOPIC)).thenReturn(t);
    }

    /** 我关注了 followeeId */
    private UserFollow iFollow(String followeeId) {
        UserFollow f = new UserFollow();
        f.setFollowerId(ME);
        f.setFolloweeId(followeeId);
        return f;
    }

    /** followerId 关注了我 */
    private UserFollow followsMe(String followerId) {
        UserFollow f = new UserFollow();
        f.setFollowerId(followerId);
        f.setFolloweeId(ME);
        return f;
    }

    private void knownUsers(DreamUser... users) {
        Mockito.when(userMapper.selectList(ArgumentMatchers.any())).thenReturn(new ArrayList<>(Arrays.asList(users)));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> candidates(String keyword) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        SecUtil.setLoginUserToSession(request, user(ME, "我"));
        Object r = controller.mentionCandidates(TOPIC, keyword, request);
        return (List<Map<String, Object>>) ((Result<Object>) r).getData();
    }

    private List<String> nicknames(String keyword) {
        List<String> out = new ArrayList<>();
        for (Map<String, Object> m : candidates(keyword)) {
            out.add(String.valueOf(m.get("userNickname")));
        }
        return out;
    }

    @Test
    void publicTopicOffersPeopleIFollow() {
        topic(TopicPermissionService.PUBLIC);
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(iFollow("u-a")));
        knownUsers(user("u-a", "阿关"));
        assertEquals(Collections.singletonList("阿关"), nicknames("阿"));
    }

    @Test
    void publicTopicOffersMyFollowers() {
        topic(TopicPermissionService.PUBLIC);
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(followsMe("u-b")));
        knownUsers(user("u-b", "小粉"));
        assertEquals(Collections.singletonList("小粉"), nicknames(""));
    }

    @Test
    void privateTopicKeepsTheFollowGraphOut() {
        topic(TopicPermissionService.PRIVATE);
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Arrays.asList(iFollow("u-a"), followsMe("u-b")));
        knownUsers(user("u-a", "阿关"), user("u-b", "小粉"));
        assertTrue(nicknames("").isEmpty(), "私密专题不该把不在房间里的人列出来");
    }

    @Test
    void followGraphCandidatesAreMarked() {
        topic(TopicPermissionService.PUBLIC);
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(iFollow("u-a")));
        knownUsers(user("u-a", "阿关"));
        assertEquals(Boolean.TRUE, candidates("").get(0).get("viaFollow"));
    }

    /** 已经在房间里的人不打"关注"标——他就在群里，标了反而误导 */
    @Test
    void someoneAlreadyInTheRoomIsNotMarked() {
        topic(TopicPermissionService.PUBLIC);
        Mockito.when(chatMapper.speakerIds(TOPIC)).thenReturn(Collections.singletonList("u-a"));
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(iFollow("u-a")));
        knownUsers(user("u-a", "阿关"));
        List<Map<String, Object>> out = candidates("");
        assertEquals(1, out.size(), "同一个人不该出现两次");
        assertEquals(Boolean.FALSE, out.get(0).get("viaFollow"));
    }

    /** 房间里的人排在关注关系前面：候选就 8 条，重名时先给在场的 */
    @Test
    void roomComesBeforeTheFollowGraph() {
        topic(TopicPermissionService.PUBLIC);
        Mockito.when(chatMapper.speakerIds(TOPIC)).thenReturn(Collections.singletonList("u-in"));
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(iFollow("u-out")));
        // 故意让数据库先吐出"不在房间里"的那个，确认排序不是照搬 selectList 的顺序
        knownUsers(user("u-out", "老王二"), user("u-in", "老王"));
        assertEquals(Arrays.asList("老王", "老王二"), nicknames("老王"));
    }

    /** @ 自己没意义，哪一路都不该带上自己 */
    @Test
    void neverOffersMyself() {
        topic(TopicPermissionService.PUBLIC);
        UserFollow selfEdge = new UserFollow();
        selfEdge.setFollowerId(ME);
        selfEdge.setFolloweeId(ME);
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(selfEdge));
        knownUsers(user(ME, "我"));
        assertFalse(nicknames("").contains("我"));
    }

    @Test
    void anonymousVisitorGetsNothing() {
        topic(TopicPermissionService.PUBLIC);
        Mockito.when(followMapper.selectList(ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(iFollow("u-a")));
        knownUsers(user("u-a", "阿关"));
        Object r = controller.mentionCandidates(TOPIC, "", new MockHttpServletRequest());
        assertTrue(((List<?>) ((Result<?>) r).getData()).isEmpty());
    }
}
