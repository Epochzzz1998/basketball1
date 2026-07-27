package com.dream.basketball.utils;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.apache.commons.lang3.StringUtils;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts the set of @-mentioned user ids from a piece of user content.
 *
 * Two sources, one meaning ("who did this content @?"):
 * - comments store a compact JSON array {@code [{"id":"..","name":".."}]} in a column;
 * - post bodies embed wangeditor mention spans in the HTML, carrying the id in a
 *   URL-encoded {@code data-info} JSON attribute — we regex those out.
 *
 * Both return ids only; order-preserving and de-duplicated (LinkedHashSet).
 */
public final class MentionUtil {

    private MentionUtil() {
    }

    // wangeditor mention span: <span data-w-e-type="mention" ... data-info="URLENCODED_JSON">@name</span>
    private static final Pattern MENTION_SPAN =
            Pattern.compile("data-w-e-type=\"mention\"[^>]*?data-info=\"([^\"]*)\"");

    // 同一个 span，但把「前缀 / data-info / 收尾 / 可见@名 / 闭合」都分组捕获，便于只替换可见文字。
    private static final Pattern MENTION_SPAN_FULL = Pattern.compile(
            "(<span[^>]*data-w-e-type=\"mention\"[^>]*data-info=\")([^\"]*)(\"[^>]*>)(@[^<]*)(</span>)");

    /** Parse ids from a comment's MENTIONS json ([{"id","name"}, ...]). */
    public static Set<String> parseCommentMentionIds(String mentionsJson) {
        Set<String> ids = new LinkedHashSet<>();
        if (StringUtils.isBlank(mentionsJson)) {
            return ids;
        }
        try {
            JSONArray arr = JSON.parseArray(mentionsJson);
            for (int i = 0; i < arr.size(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String id = o == null ? null : o.getString("id");
                if (StringUtils.isNotBlank(id)) {
                    ids.add(id);
                }
            }
        } catch (Exception ignore) {
            // malformed json -> no mentions
        }
        return ids;
    }

    /**
     * NBA 专区的帖子还能 @ 球员，同样存成 mention span，靠 data-info 里的 {@code kind} 区分。
     * 球员不是用户：这条 id 拿去查用户表查不到、发通知发给不存在的人，所以两类 id 必须分开取。
     * 老帖没有 kind，一律按用户算（兼容）。
     */
    public static final String KIND_PLAYER = "player";

    /** Parse ids from a post body's HTML (wangeditor mention spans). 只回用户，球员见 {@link #parseNewsPlayerMentionIds}。 */
    public static Set<String> parseNewsMentionIds(String html) {
        return parseMentionIds(html, false);
    }

    /** 正文里 @ 到的球员 id（dream_player.PLAYER_ID）。 */
    public static Set<String> parseNewsPlayerMentionIds(String html) {
        return parseMentionIds(html, true);
    }

    private static Set<String> parseMentionIds(String html, boolean wantPlayer) {
        Set<String> ids = new LinkedHashSet<>();
        if (StringUtils.isBlank(html)) {
            return ids;
        }
        Matcher m = MENTION_SPAN.matcher(html);
        while (m.find()) {
            try {
                String info = URLDecoder.decode(m.group(1), StandardCharsets.UTF_8.name());
                JSONObject o = JSON.parseObject(info);
                String id = o == null ? null : o.getString("id");
                boolean isPlayer = o != null && KIND_PLAYER.equals(o.getString("kind"));
                if (StringUtils.isNotBlank(id) && isPlayer == wantPlayer) {
                    ids.add(id);
                }
            } catch (Exception ignore) {
                // one bad span shouldn't drop the rest
            }
        }
        return ids;
    }

    /**
     * 给评论 MENTIONS json 里每个 mention 补一个 {@code cur}=当前昵称（按 id 解析）。
     * 原 {@code name} 保留不动（正文里 @ 的是旧昵称，前端靠它在文本里定位），前端展示时优先用 {@code cur}。
     * idToName 里没有的 id（用户已删/无变化时也可不传）保持原样。
     */
    public static String enrichCommentMentions(String mentionsJson, Map<String, String> idToName) {
        if (StringUtils.isBlank(mentionsJson) || idToName == null || idToName.isEmpty()) {
            return mentionsJson;
        }
        try {
            JSONArray arr = JSON.parseArray(mentionsJson);
            boolean changed = false;
            for (int i = 0; i < arr.size(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (o == null) {
                    continue;
                }
                String id = o.getString("id");
                String cur = id == null ? null : idToName.get(id);
                if (StringUtils.isNotBlank(cur)) {
                    o.put("cur", cur);
                    changed = true;
                }
            }
            return changed ? arr.toJSONString() : mentionsJson;
        } catch (Exception ignore) {
            return mentionsJson;
        }
    }

    /**
     * 把帖子正文 HTML 里每个 @mention span 的可见文字 {@code @旧昵称} 改写成 {@code @当前昵称}（按 span 内 data-info 的 id 解析）。
     * data-info 本身保持不动（只 id 有用）；解析不出或 id 不在 map 里的 span 原样保留。
     */
    public static String rewriteNewsMentionNames(String html, Map<String, String> idToName) {
        return rewriteMentionNames(html, idToName, false);
    }

    /** 同上，但只改 @球员 的那些 span（球员汉化名有调整时，老帖跟着显示新名）。 */
    public static String rewritePlayerMentionNames(String html, Map<String, String> idToName) {
        return rewriteMentionNames(html, idToName, true);
    }

    private static String rewriteMentionNames(String html, Map<String, String> idToName, boolean wantPlayer) {
        if (StringUtils.isBlank(html) || idToName == null || idToName.isEmpty()) {
            return html;
        }
        Matcher m = MENTION_SPAN_FULL.matcher(html);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String cur = null;
            try {
                String info = URLDecoder.decode(m.group(2), StandardCharsets.UTF_8.name());
                JSONObject o = JSON.parseObject(info);
                String id = o == null ? null : o.getString("id");
                boolean isPlayer = o != null && KIND_PLAYER.equals(o.getString("kind"));
                cur = (id == null || isPlayer != wantPlayer) ? null : idToName.get(id);
            } catch (Exception ignore) {
                // 解析失败就保留原文
            }
            String visible = StringUtils.isNotBlank(cur) ? "@" + cur : m.group(4);
            // quoteReplacement 防止昵称里的 $ / \ 破坏替换串
            m.appendReplacement(sb, Matcher.quoteReplacement(m.group(1) + m.group(2) + m.group(3) + visible + m.group(5)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    // ===== 无联想 @：后端按"全量昵称、最长前缀匹配"识别纯文本里的 @昵称 =====

    // 整个 mention span（含内容）或任意 HTML 标签——自动链接时按此切块，只对标签外的纯文本动手
    private static final Pattern SPAN_OR_TAG =
            Pattern.compile("(<span[^>]*data-w-e-type=\"mention\".*?</span>)|(<[^>]+>)", Pattern.DOTALL);

    /** 在 nickToId（昵称→id）里找 text 从 from 起能匹配的最长昵称；无命中返回 null。 */
    private static String longestNickAt(String text, int from, Map<String, String> nickToId) {
        String best = null;
        for (String nick : nickToId.keySet()) {
            if (StringUtils.isNotBlank(nick) && text.startsWith(nick, from)
                    && (best == null || nick.length() > best.length())) {
                best = nick;
            }
        }
        return best;
    }

    /**
     * 评论用：无联想输入下，按全站昵称对纯文本做 @ 识别（每个 @ 取最长匹配昵称）。
     * 返回与旧机制同构的 [{"id","name"}] JSON（同一用户去重），无命中返回 null——
     * 前端 renderContent 的"按 name 定位、cur 显示"逻辑原样生效。
     */
    public static String resolveTextMentions(String text, Map<String, String> nickToId) {
        if (StringUtils.isBlank(text) || nickToId == null || nickToId.isEmpty()) {
            return null;
        }
        JSONArray arr = new JSONArray();
        Set<String> seen = new LinkedHashSet<>();
        int i = text.indexOf('@');
        while (i >= 0) {
            String best = longestNickAt(text, i + 1, nickToId);
            if (best != null) {
                String id = nickToId.get(best);
                if (seen.add(id)) {
                    JSONObject o = new JSONObject();
                    o.put("id", id);
                    o.put("name", best);
                    arr.add(o);
                }
                i = text.indexOf('@', i + 1 + best.length());
            } else {
                i = text.indexOf('@', i + 1);
            }
        }
        return arr.isEmpty() ? null : arr.toJSONString();
    }

    /**
     * 帖子正文（HTML）读时自动链接：把标签外文本里的 @昵称（命中全站昵称，最长优先）包成
     * wangeditor 同款 mention span——前端既有的高亮/点击跳主页机制直接生效。
     * 已有的 mention span（老帖联想选择产生）整块跳过不重复处理。
     * 注意：文本里存的是发帖时的昵称，对方改名后旧文本匹配不到自然退化为纯文本（无害）。
     */
    public static String autoLinkNewsMentions(String html, Map<String, String> nickToId) {
        if (StringUtils.isBlank(html) || nickToId == null || nickToId.isEmpty() || html.indexOf('@') < 0) {
            return html;
        }
        Matcher m = SPAN_OR_TAG.matcher(html);
        StringBuilder out = new StringBuilder();
        int last = 0;
        while (m.find()) {
            out.append(linkTextSegment(html.substring(last, m.start()), nickToId));
            out.append(m.group()); // 现有 span / 标签原样
            last = m.end();
        }
        out.append(linkTextSegment(html.substring(last), nickToId));
        return out.toString();
    }

    /** 对一段"标签外纯文本"做 @昵称 → mention span 替换。 */
    private static String linkTextSegment(String seg, Map<String, String> nickToId) {
        if (seg.indexOf('@') < 0) {
            return seg;
        }
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < seg.length()) {
            char c = seg.charAt(i);
            if (c == '@') {
                String best = longestNickAt(seg, i + 1, nickToId);
                if (best != null) {
                    JSONObject info = new JSONObject();
                    info.put("id", nickToId.get(best));
                    String encoded;
                    try {
                        encoded = java.net.URLEncoder.encode(info.toJSONString(), StandardCharsets.UTF_8.name());
                    } catch (Exception e) {
                        encoded = "";
                    }
                    sb.append("<span data-w-e-type=\"mention\" data-info=\"").append(encoded)
                            .append("\">@").append(best).append("</span>");
                    i += 1 + best.length();
                    continue;
                }
            }
            sb.append(c);
            i++;
        }
        return sb.toString();
    }
}
