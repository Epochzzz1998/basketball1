package com.dream.basketball.utils;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.apache.commons.lang3.StringUtils;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
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
}
