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

    /** Parse ids from a post body's HTML (wangeditor mention spans). */
    public static Set<String> parseNewsMentionIds(String html) {
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
                if (StringUtils.isNotBlank(id)) {
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
                cur = id == null ? null : idToName.get(id);
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
}
