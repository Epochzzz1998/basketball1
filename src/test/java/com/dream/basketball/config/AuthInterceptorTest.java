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

    private final AuthInterceptor interceptor = new AuthInterceptor();

    /** Handler stand-in carrying the annotations under test. */
    static class DummyController {
        public void publicEndpoint() {}

        @RequiresRole(Role.USER)
        public void userEndpoint() {}

        @RequiresRole(Role.MANAGER)
        public void managerEndpoint() {}

        @RequiresRole(Role.SUPER_MANAGER)
        public void adminEndpoint() {}
    }

    @RequiresRole(Role.SUPER_MANAGER)
    static class ClassAnnotatedController {
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
