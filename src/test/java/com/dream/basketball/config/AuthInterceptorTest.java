package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.SecUtil;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P2-5 unit tests for the annotation-driven auth gate. Uses spring-test mocks
 * (no Spring context, no middleware) and exercises the full authn/authz matrix,
 * including the role paths that cannot be scripted against the live site
 * because login requires a captcha.
 */
class AuthInterceptorTest {

    /** 功能开关是现读库判定的，所以拦截器要一个 mapper；用 mock 顶上，不碰真库。 */
    private final com.dream.basketball.mapper.UserMapper userMapper =
            org.mockito.Mockito.mock(com.dream.basketball.mapper.UserMapper.class);
    private final AuthInterceptor interceptor = new AuthInterceptor(userMapper);

    /** Handler stand-in carrying the annotations under test. */
    static class DummyController {
        public void publicEndpoint() {}

        @RequiresRole(Role.USER)
        public void userEndpoint() {}

        @RequiresRole(Role.MANAGER)
        public void managerEndpoint() {}

        @RequiresRole(Role.SUPER_MANAGER)
        public void adminEndpoint() {}

        @RequiresFeature(Feature.NBA_DATA)
        public void nbaEndpoint() {}

        /** 身份和模块两道门可以叠加，各判各的。 */
        @RequiresRole(Role.MANAGER)
        @RequiresFeature(Feature.NBA_DATA)
        public void nbaManagerEndpoint() {}
    }

    @RequiresRole(Role.SUPER_MANAGER)
    static class ClassAnnotatedController {
        public void inheritedEndpoint() {}
    }

    @RequiresFeature(Feature.NBA_DATA)
    static class FeatureAnnotatedController {
        public void inheritedEndpoint() {}
    }

    // ---------- helpers ----------

    private HandlerMethod handler(Class<?> type, String methodName) throws Exception {
        Method method = type.getMethod(methodName);
        return new HandlerMethod(type.getDeclaredConstructor().newInstance(), method);
    }

    private MockHttpServletRequest ajaxRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/x");
        request.addHeader("X-Requested-With", "XMLHttpRequest");
        return request;
    }

    private MockHttpServletRequest pageRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/x");
        request.addHeader("Accept", "text/html");
        return request;
    }

    private void loginAs(MockHttpServletRequest request, String role) {
        DreamUser user = new DreamUser();
        user.setUserId("test-user-id");
        user.setUserRole(role);
        SecUtil.login4Session(request, user);
    }

    // ---------- public / pass-through ----------

    @Test
    void unannotatedHandler_passesAnonymously() throws Exception {
        assertTrue(interceptor.preHandle(ajaxRequest(), new MockHttpServletResponse(),
                handler(DummyController.class, "publicEndpoint")));
    }

    @Test
    void nonHandlerMethod_passes() throws Exception {
        // e.g. static resource handler
        assertTrue(interceptor.preHandle(ajaxRequest(), new MockHttpServletResponse(), new Object()));
    }

    @Test
    void optionsPreflight_passesEvenWhenProtected() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/x");
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "adminEndpoint")));
    }

    // ---------- authentication (401) ----------

    @Test
    void anonymousAjax_gets401Json() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(ajaxRequest(), response,
                handler(DummyController.class, "userEndpoint")));
        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":401"));
    }

    @Test
    void anonymousPageNav_alsoGets401Json() throws Exception {
        // P4-1: pure JSON API — no login page to redirect to, so page navigation also gets 401 JSON
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(pageRequest(), response,
                handler(DummyController.class, "userEndpoint")));
        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":401"));
    }

    // ---------- authorization (403) ----------

    @Test
    void normalUser_passesUserEndpoint() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "userEndpoint")));
    }

    @Test
    void normalUserAjax_gets403OnAdminEndpoint() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(DummyController.class, "adminEndpoint")));
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("权限不足"));
    }

    @Test
    void normalUserPageNav_gets403ErrorOnAdminEndpoint() throws Exception {
        MockHttpServletRequest request = pageRequest();
        loginAs(request, Constants.NORMAL_USER);
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(DummyController.class, "adminEndpoint")));
        assertEquals(403, response.getStatus());
    }

    @Test
    void normalUser_gets403OnManagerEndpoint() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(DummyController.class, "managerEndpoint")));
        assertEquals(403, response.getStatus());
    }

    @Test
    void manager_passesManagerEndpoint_butNotAdmin() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.MANAGER);
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "managerEndpoint")));

        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(DummyController.class, "adminEndpoint")));
        assertEquals(403, response.getStatus());
    }

    @Test
    void superManager_passesEverything() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.SUPER_MANAGER);
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "userEndpoint")));
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "managerEndpoint")));
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "adminEndpoint")));
    }

    @Test
    void classLevelAnnotation_isHonored() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(ClassAnnotatedController.class, "inheritedEndpoint")));
        assertEquals(403, response.getStatus());
    }

    // ---------- 功能模块门禁（@RequiresFeature） ----------

    /** 让"现读库"那一步返回一个 FEAT_DATA 为指定值的普通用户。 */
    private void dbFeatData(String value) {
        DreamUser fresh = new DreamUser();
        fresh.setUserId("test-user-id");
        fresh.setUserRole(Constants.NORMAL_USER);
        fresh.setFeatData(value);
        org.mockito.Mockito.when(userMapper.selectById("test-user-id")).thenReturn(fresh);
    }

    @Test
    void anonymous_gets401OnFeatureEndpoint() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(ajaxRequest(), response,
                handler(DummyController.class, "nbaEndpoint")));
        assertEquals(401, response.getStatus());
    }

    /** 没设置过 = 没放行。这是与其它模块相反的那条规则，必须被守住。 */
    @Test
    void userWithoutFlag_passesFeatureEndpoint() throws Exception {
        // 语义已从「默认关、逐个放行」改成「默认放行、可按人封禁」（入口挪进 NBA 专题，
        // 不该再卡人工审批）。没设置过 = 能用，是现在的正确行为。
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        dbFeatData(null);
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(request, response,
                handler(DummyController.class, "nbaEndpoint")));
    }

    @Test
    void userExplicitlyDenied_gets403OnFeatureEndpoint() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        dbFeatData("0");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(DummyController.class, "nbaEndpoint")));
        assertEquals(403, response.getStatus());
    }

    @Test
    void grantedUser_passesFeatureEndpoint() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        dbFeatData("1");
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "nbaEndpoint")));
    }

    /** 超管不看开关（否则关掉之后自己也管不了了），也不该为此多查一次库。 */
    @Test
    void superManager_passesFeatureEndpointWithoutReadingDb() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.SUPER_MANAGER);
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(),
                handler(DummyController.class, "nbaEndpoint")));
        org.mockito.Mockito.verify(userMapper, org.mockito.Mockito.never()).selectById(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void featureAnnotationOnClass_isHonored() throws Exception {
        // 挂在类上的注解同样生效：被封禁的人访问该类下任意方法都要被挡
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        dbFeatData("0");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(FeatureAnnotatedController.class, "inheritedEndpoint")));
        assertEquals(403, response.getStatus());
    }

    /** 两道门叠加：身份不够先被身份挡掉，即便模块已放行。 */
    @Test
    void roleAndFeature_bothEnforced() throws Exception {
        MockHttpServletRequest request = ajaxRequest();
        loginAs(request, Constants.NORMAL_USER);
        dbFeatData("1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response,
                handler(DummyController.class, "nbaManagerEndpoint")));
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("权限不足"));
    }

    @Test
    void featureRule_isDefaultOnWithPerUserBan() {
        // NBA 数据：**必须登录 + 默认放行 + 可按人封禁**。
        // 只有显式 '0' 才是封禁；null（没设置过）和 '1' 都能用。
        // 未登录那道门在 preHandle 里（401 优先于 403），不在这个方法里判。
        DreamUser u = new DreamUser();
        assertFalse(Feature.NBA_DATA.granted(null), "查不到用户 = 不放行");
        assertTrue(Feature.NBA_DATA.granted(u), "没设置过 = 默认能用");
        u.setFeatData("0");
        assertFalse(Feature.NBA_DATA.granted(u), "显式 '0' = 被封禁");
        u.setFeatData("1");
        assertTrue(Feature.NBA_DATA.granted(u));
    }

    // ---------- role mapping ----------

    @Test
    void roleMapping_matchesBaseUtilsSemantics() {
        assertEquals(Role.SUPER_MANAGER, Role.fromUserRole(Constants.SUPER_MANAGER));
        assertEquals(Role.MANAGER, Role.fromUserRole(Constants.MANAGER));
        assertEquals(Role.MANAGER, Role.fromUserRole("Manager"));
        assertEquals(Role.USER, Role.fromUserRole(Constants.NORMAL_USER));
        assertEquals(Role.USER, Role.fromUserRole(null));
        assertEquals(Role.USER, Role.fromUserRole(""));
        assertTrue(Role.SUPER_MANAGER.covers(Role.MANAGER));
        assertTrue(Role.MANAGER.covers(Role.USER));
        assertFalse(Role.USER.covers(Role.MANAGER));
        assertFalse(Role.MANAGER.covers(Role.SUPER_MANAGER));
    }
}
