package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * 把 {@code Authorization: Bearer xxx} 解析成"当前登录用户"（阶段 1 · Token 认证）。
 *
 * <h2>为什么一个过滤器就够，不用改那 115 处</h2>
 *
 * 全站取当前用户只有一个入口：
 *
 * <pre>{@code DreamUser me = SecUtil.getLoginUserToSession(request);}</pre>
 *
 * 115 处调用散在 20 个文件里，连 {@code @RequiresRole} 的拦截器读的也是它。
 * 所以只要在请求进 controller <b>之前</b>把令牌换成用户、放进
 * {@link SecUtil#REQ_USER_KEY}，下游一行都不用动——包括以后新写的接口。
 *
 * <h2>三条设计上的取舍</h2>
 *
 * <b>① Cookie 优先，令牌兜底。</b> 已经有 session 的请求直接放行，不做任何多余的活。
 * 这让整件事是<b>加一条路</b>而不是换一条路：网页端的行为一个字节都没变，
 * 即使令牌这条有问题也波及不到现有用户。
 *
 * <b>② 每个请求都回库取一次用户。</b> 主键查询，代价可以忽略，换来的是令牌路径
 * 比 Cookie 路径更"新鲜"：session 里存的是登录那一刻的快照，改了权限要等
 * {@code /user/current} 才刷新；令牌这边天然就是最新的，账号一被禁用下一个请求立刻失效。
 *
 * <b>③ 令牌无效不拦，当成没登录继续走。</b> 因为这个站<b>公开内容占很大比重</b>
 * （百家说、帖子详情、专题列表都允许匿名浏览）。在这里直接 401 会把"令牌过期"
 * 变成"连首页都打不开"。让它继续走下去，需要登录的接口自己会 401，
 * 前端的响应拦截器再据此跳登录页——和 Cookie 过期时的表现完全一致。
 *
 * <h2>为什么还认查询参数里的令牌</h2>
 *
 * 有两类请求带不了自定义请求头：
 * <ul>
 *   <li><b>WebSocket 握手</b>——协议本身不允许（见 {@code WebSocketConfig}）；</li>
 *   <li><b>浏览器直接发起的导航</b>——{@code <img src>}、{@code <a download>}、
 *       {@code window.open}，比如群聊导出和附件下载。</li>
 * </ul>
 * 所以额外接受 {@code ?access_token=}。放在查询串里的凭据会进服务器访问日志，
 * 这是已知的代价，因此<b>只作为退路</b>，能走请求头的一律走请求头。
 */
@Component
public class TokenAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";
    /** 退路：只给带不了请求头的那几类请求用（WebSocket 握手、导航式下载） */
    public static final String QUERY_PARAM = "access_token";

    @Autowired
    private TokenStore tokenStore;

    @Autowired
    private UserMapper userMapper;

    /** 从请求里取出令牌：优先请求头，其次查询参数。都没有返回 null */
    public static String extract(HttpServletRequest request) {
        String h = request.getHeader(HEADER);
        if (StringUtils.isNotBlank(h) && h.startsWith(PREFIX)) {
            String t = h.substring(PREFIX.length()).trim();
            if (StringUtils.isNotBlank(t)) {
                return t;
            }
        }
        String q = request.getParameter(QUERY_PARAM);
        return StringUtils.isNotBlank(q) ? q.trim() : null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // ① 已经有 session 登录态：网页端的老路，原样放行
        if (SecUtil.getLoginUserToSession(request) != null) {
            chain.doFilter(request, response);
            return;
        }
        String token = extract(request);
        if (token == null) {
            chain.doFilter(request, response);
            return;
        }
        String userId = tokenStore.resolve(token);   // 命中即滑动续期
        if (StringUtils.isNotBlank(userId)) {
            DreamUser u = userMapper.selectById(userId);
            // ② 用户还在、且没被封。封号立刻生效，不用等他重新登录
            if (u != null && !Constants.DISABLE.equals(u.getUserStatus())) {
                request.setAttribute(SecUtil.REQ_USER_KEY, u);
            }
        }
        // ③ 令牌无效/过期/用户被封：什么都不做，当匿名继续走（理由见类注释）
        chain.doFilter(request, response);
    }
}
