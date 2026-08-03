package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.config.TopicPermissionService;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumTopic;
import com.dream.basketball.entity.ForumTopicFile;
import com.dream.basketball.mapper.ForumTopicFileMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.FileUtils;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.dream.basketball.entity.ForumTopicFile.KIND_FILE;
import static com.dream.basketball.entity.ForumTopicFile.KIND_FOLDER;

/**
 * 专题文件系统：题主往专题里放资料，成员来取。
 *
 * <h2>权限的三层分工</h2>
 *
 * <table border="1">
 *   <tr><th>动作</th><th>谁</th><th>为什么</th></tr>
 *   <tr><td>开/关整个功能</td><td>只有超管</td><td>占的是服务器的盘，开给哪个专题由站长说了算
 *       （落点在 {@code TopicController.update}，非超管传了参数直接忽略）</td></tr>
 *   <tr><td>传文件/建文件夹/改名/删</td><td>题主（含小题主、超管）</td><td>这是"专题的资料柜"，
 *       不是网盘——放什么由管这个专题的人决定</td></tr>
 *   <tr><td>看和下载</td><td>能看这个专题的人</td><td>与帖子同一条可见性规则，私密专题的文件
 *       跟着专题一起私密</td></tr>
 * </table>
 *
 * <h2>存储复用评论附件那一套</h2>
 *
 * 文件落在 {@code {uploadPath}/topicfs-{topicId}/}，走 {@link FileUtils#uploadTopicFile}：
 * 同样的 30MB 上限、同样的内容寻址（同一个文件重复上传只落一份盘），但类型规则是
 * **黑名单**而不是评论附件那份白名单——文件系统的用途就是「什么文件都能放」，
 * 白名单每加一种格式都要改代码。挡掉的只有两类：浏览器会当文档执行的（html/svg/xml…，
 * 上传目录是静态直出的，那就是我们域名下的储存型 XSS）和双击即执行的（exe/bat/vbs…）。
 * 目录名和文件名都是猜不到的，私密专题的文件不会因为 URL 泄露而被翻出来——和私信附件
 * 同一个安全口径。
 *
 * <h2>没有「移动」</h2>
 *
 * 层级是 PARENT_ID 自引用，防环全靠"新建只能挂在已有文件夹下"。加移动就得自己查环
 * （把 A 挪进 A 的子孙里），而这个场景里挪错了大不了删掉重传——为它引入整套环检测不值。
 */
@RestController
@RequestMapping("/topicFile")
public class TopicFileController {

    private static final String ON = "1";
    private static final int NAME_MAX = 80;
    /** 单个文件夹里最多放多少个节点。防手滑循环上传把列表撑到没法看，不是容量管理 */
    private static final int FOLDER_CAP = 200;

    @Autowired
    private TopicPermissionService perms;

    @Autowired
    private ForumTopicFileMapper fileMapper;

    @Autowired
    private UserMapper userMapper;

    @Value("${picPath.uploadPath:}")
    private String uploadPath;

    /** 这个专题的文件功能开着、而且这个人能看它，返回 null；否则给出拒绝理由 */
    private String gateView(DreamUser me, ForumTopic t) {
        if (t == null) {
            return "专题不存在";
        }
        if (!ON.equals(t.getFilesEnabled())) {
            return "该专题未开放文件系统";
        }
        if (!perms.canView(me, t)) {
            return "无权查看该专题";
        }
        return null;
    }

    /** 校验 parentId：空 = 根目录；给了就必须是**本专题**的文件夹。跨专题挂载在这里挡住 */
    private ForumTopicFile checkParent(String topicId, String parentId) {
        if (StringUtils.isBlank(parentId)) {
            return null;
        }
        ForumTopicFile p = fileMapper.selectById(parentId.trim());
        if (p == null || !KIND_FOLDER.equals(p.getKind())
                || !StringUtils.equals(p.getTopicId(), topicId)) {
            throw new IllegalArgumentException("目标文件夹不存在");
        }
        return p;
    }

    private Map<String, Object> view(ForumTopicFile f, Map<String, String> nickCache) {
        Map<String, Object> m = new HashMap<>();
        m.put("fileId", f.getFileId());
        m.put("kind", f.getKind());
        m.put("name", f.getName());
        m.put("url", f.getUrl());
        m.put("size", f.getSize());
        m.put("createTime", f.getCreateTime());
        String uid = f.getUploaderId();
        if (StringUtils.isNotBlank(uid)) {
            String nick = nickCache.computeIfAbsent(uid, id -> {
                DreamUser u = userMapper.selectById(id);
                return u == null ? "" : StringUtils.defaultString(u.getUserNickname());
            });
            m.put("uploaderName", nick);
        }
        return m;
    }

    /**
     * 列一个文件夹：文件夹在前、文件在后，各按名字排。
     *
     * <p>顺带把**面包屑**也算好返回。前端当然可以自己边点边记路径，但直链/刷新时
     * 它手里只有一个 folder id，路径还是得有人从库里爬出来——那就服务端一次爬好。
     * 沿 PARENT_ID 上行，最多 20 层（层级由写入侧保证无环，这里的上限只是兜底）。
     */
    @GetMapping("/list")
    public Object list(String topicId, String parentId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        String no = gateView(me, t);
        if (no != null) {
            return new Result<>(1, no, null);
        }
        ForumTopicFile folder;
        try {
            folder = checkParent(t.getTopicId(), parentId);
        } catch (IllegalArgumentException e) {
            return new Result<>(1, e.getMessage(), null);
        }

        QueryWrapper<ForumTopicFile> qw = new QueryWrapper<ForumTopicFile>()
                .eq("TOPIC_ID", t.getTopicId());
        if (folder == null) {
            qw.isNull("PARENT_ID");
        } else {
            qw.eq("PARENT_ID", folder.getFileId());
        }
        List<ForumTopicFile> rows = fileMapper.selectList(qw);
        rows.sort((a, b) -> {
            int k = Boolean.compare(!KIND_FOLDER.equals(a.getKind()), !KIND_FOLDER.equals(b.getKind()));
            return k != 0 ? k : StringUtils.defaultString(a.getName())
                    .compareToIgnoreCase(StringUtils.defaultString(b.getName()));
        });
        Map<String, String> nicks = new HashMap<>();
        List<Map<String, Object>> files = new ArrayList<>();
        for (ForumTopicFile f : rows) {
            files.add(view(f, nicks));
        }

        // 面包屑：从当前文件夹沿 PARENT_ID 一路爬回根
        Deque<Map<String, Object>> crumbs = new ArrayDeque<>();
        ForumTopicFile cur = folder;
        for (int i = 0; cur != null && i < 20; i++) {
            Map<String, Object> c = new HashMap<>();
            c.put("fileId", cur.getFileId());
            c.put("name", cur.getName());
            crumbs.addFirst(c);
            cur = StringUtils.isBlank(cur.getParentId()) ? null : fileMapper.selectById(cur.getParentId());
        }

        Map<String, Object> data = new HashMap<>();
        data.put("files", files);
        data.put("path", new ArrayList<>(crumbs));
        data.put("canManage", perms.canManage(me, t));
        return new Result<>(0, "成功", data);
    }

    @RequiresRole(Role.USER)
    @PostMapping("/mkdir")
    public Object mkdir(String topicId, String parentId, String name, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        String no = gateView(me, t);
        if (no != null) {
            return new Result<>(1, no, null);
        }
        if (!perms.canManage(me, t)) {
            return new Result<>(1, "只有题主能管理文件", null);
        }
        String nm = StringUtils.trimToEmpty(name);
        if (nm.isEmpty()) {
            return new Result<>(1, "文件夹名不能为空", null);
        }
        if (nm.length() > NAME_MAX) {
            return new Result<>(1, "名字最多 " + NAME_MAX + " 个字", null);
        }
        ForumTopicFile folder;
        try {
            folder = checkParent(t.getTopicId(), parentId);
        } catch (IllegalArgumentException e) {
            return new Result<>(1, e.getMessage(), null);
        }
        // 幂等：同名文件夹已经在了就直接还给它的 id。这是「上传整个文件夹」的地基——
        // 客户端按相对路径逐段确保目录存在，同一段被确保两次必须收敛到同一个夹，
        // 不能长出两个同名夹（手动重复建也一样收敛，顺带把重名问题挡了）
        QueryWrapper<ForumTopicFile> dup = new QueryWrapper<ForumTopicFile>()
                .eq("TOPIC_ID", t.getTopicId()).eq("KIND", KIND_FOLDER).eq("NAME", nm);
        if (folder == null) {
            dup.isNull("PARENT_ID");
        } else {
            dup.eq("PARENT_ID", folder.getFileId());
        }
        ForumTopicFile exist = fileMapper.selectOne(dup.last("limit 1"));
        Map<String, Object> data = new HashMap<>();
        if (exist != null) {
            data.put("fileId", exist.getFileId());
            return new Result<>(0, "已存在", data);
        }
        if (countIn(t.getTopicId(), folder) >= FOLDER_CAP) {
            return new Result<>(1, "这个文件夹放不下了（上限 " + FOLDER_CAP + " 项）", null);
        }
        ForumTopicFile f = new ForumTopicFile();
        f.setFileId(UUID.randomUUID().toString());
        f.setTopicId(t.getTopicId());
        f.setParentId(folder == null ? null : folder.getFileId());
        f.setKind(KIND_FOLDER);
        f.setName(nm);
        f.setUploaderId(me.getUserId());
        f.setCreateTime(new Date());
        fileMapper.insert(f);
        data.put("fileId", f.getFileId());
        return new Result<>(0, "已创建", data);
    }

    /**
     * 上传一个文件到某个文件夹。
     *
     * <p>显示名用**原始文件名**（清洗掉路径段和控制字符），落盘名是内容寻址的
     * 十六进制串——两者分开，列表才可读，同时磁盘上保持天然去重。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/upload")
    public Object upload(MultipartFile file, String topicId, String parentId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        String no = gateView(me, t);
        if (no != null) {
            return new Result<>(1, no, null);
        }
        if (!perms.canManage(me, t)) {
            return new Result<>(1, "只有题主能管理文件", null);
        }
        ForumTopicFile folder;
        try {
            folder = checkParent(t.getTopicId(), parentId);
        } catch (IllegalArgumentException e) {
            return new Result<>(1, e.getMessage(), null);
        }
        if (countIn(t.getTopicId(), folder) >= FOLDER_CAP) {
            return new Result<>(1, "这个文件夹放不下了（上限 " + FOLDER_CAP + " 项）", null);
        }
        String url;
        try {
            url = FileUtils.uploadTopicFile(file, uploadPath, "topicfs-" + t.getTopicId());
        } catch (IllegalArgumentException e) {
            return new Result<>(1, e.getMessage(), null);
        } catch (IOException e) {
            return new Result<>(1, "存储失败，请重试", null);
        }
        // 原始名只留最后一段，去掉控制字符；空了就退回落盘名
        String raw = StringUtils.defaultString(file.getOriginalFilename());
        String nm = raw.replaceAll(".*[/\\\\]", "").replaceAll("[\\p{Cntrl}]", "").trim();
        if (nm.isEmpty()) {
            nm = url.substring(url.lastIndexOf('/') + 1);
        }
        if (nm.length() > NAME_MAX) {
            // 截中间不截扩展名：太长的名字保住开头和结尾，类型信息不丢
            int dot = nm.lastIndexOf('.');
            String ext = dot > 0 ? nm.substring(dot) : "";
            nm = nm.substring(0, Math.max(1, NAME_MAX - ext.length() - 1)) + "…" + ext;
        }
        ForumTopicFile f = new ForumTopicFile();
        f.setFileId(UUID.randomUUID().toString());
        f.setTopicId(t.getTopicId());
        f.setParentId(folder == null ? null : folder.getFileId());
        f.setKind(KIND_FILE);
        f.setName(nm);
        f.setUrl(url);
        f.setSize(file.getSize());
        f.setUploaderId(me.getUserId());
        f.setCreateTime(new Date());
        fileMapper.insert(f);
        Map<String, Object> data = new HashMap<>();
        data.put("fileId", f.getFileId());
        data.put("url", url);
        return new Result<>(0, "已上传", data);
    }

    @RequiresRole(Role.USER)
    @PostMapping("/rename")
    public Object rename(String fileId, String name, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopicFile f = fileMapper.selectById(StringUtils.trimToEmpty(fileId));
        if (f == null) {
            return new Result<>(1, "文件不存在", null);
        }
        ForumTopic t = perms.getTopic(f.getTopicId());
        if (t == null || !perms.canManage(me, t)) {
            return new Result<>(1, "只有题主能管理文件", null);
        }
        String nm = StringUtils.trimToEmpty(name);
        if (nm.isEmpty()) {
            return new Result<>(1, "名字不能为空", null);
        }
        if (nm.length() > NAME_MAX) {
            return new Result<>(1, "名字最多 " + NAME_MAX + " 个字", null);
        }
        f.setName(nm);
        fileMapper.updateById(f);
        return new Result<>(0, "已改名", null);
    }

    /**
     * 删一个节点；文件夹连同**整棵子树**一起删。
     *
     * <p>磁盘上的文件只在「这个 URL 再没有别的行引用」时才删：存储是内容寻址的，
     * 同一个文件被传到两个文件夹只有一份盘文件，先删的那个不能把后一个的盘底抽掉。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/delete")
    public Object delete(String fileId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopicFile f = fileMapper.selectById(StringUtils.trimToEmpty(fileId));
        if (f == null) {
            return new Result<>(0, "已删除", null);   // 已经没了，当成功
        }
        ForumTopic t = perms.getTopic(f.getTopicId());
        if (t == null || !perms.canManage(me, t)) {
            return new Result<>(1, "只有题主能管理文件", null);
        }
        // 宽度优先收集整棵子树。一层一查而不是递归到库里逐个点名，
        // 文件夹一般就几层，几次查询完事
        List<ForumTopicFile> doomed = new ArrayList<>();
        doomed.add(f);
        List<String> frontier = new ArrayList<>();
        if (KIND_FOLDER.equals(f.getKind())) {
            frontier.add(f.getFileId());
        }
        for (int depth = 0; !frontier.isEmpty() && depth < 20; depth++) {
            List<ForumTopicFile> kids = fileMapper.selectList(new QueryWrapper<ForumTopicFile>()
                    .eq("TOPIC_ID", f.getTopicId()).in("PARENT_ID", frontier));
            doomed.addAll(kids);
            frontier = new ArrayList<>();
            for (ForumTopicFile k : kids) {
                if (KIND_FOLDER.equals(k.getKind())) {
                    frontier.add(k.getFileId());
                }
            }
        }
        Set<String> ids = new HashSet<>();
        List<String> urls = new ArrayList<>();
        for (ForumTopicFile d : doomed) {
            ids.add(d.getFileId());
            if (StringUtils.isNotBlank(d.getUrl())) {
                urls.add(d.getUrl());
            }
        }
        fileMapper.deleteBatchIds(ids);
        for (String url : urls) {
            boolean shared = fileMapper.selectCount(new QueryWrapper<ForumTopicFile>()
                    .eq("URL", url)) > 0;
            if (!shared) {
                java.io.File disk = FileUtils.resolveUploadFile(uploadPath, url);
                if (disk != null) {
                    disk.delete();
                }
            }
        }
        return new Result<>(0, "已删除", null);
    }

    /**
     * 下载：文件按原名直出，文件夹整棵打成 zip 流出去。
     *
     * <p>为什么要有这个接口而不是让前端直接开 /picImg/ 的静态地址——三个原因：
     * ① 静态地址的文件名是内容哈希，浏览器存下来叫 <code>9bceb458....txt</code>，
     *    这里带 {@code Content-Disposition} 还原成上传时的原名；
     * ② 文件夹没有静态地址可开，只能服务端现打包；
     * ③ zip 是**流式**写的（边压边发），不在内存或磁盘攒整包——
     *    文件夹上限 200 项 × 30MB，攒整包最坏要吃 6GB。
     *
     * <p>权限同 list（能看专题就能下载）。zip 里同名文件按 (2)、(3) 改名——
     * zip 规范不允许重名条目，而同一个文件夹里传两个同名文件是允许的。
     */
    @GetMapping("/download")
    public void download(String fileId, HttpServletRequest request,
                         javax.servlet.http.HttpServletResponse response) throws IOException {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopicFile f = fileMapper.selectById(StringUtils.trimToEmpty(fileId));
        ForumTopic t = f == null ? null : perms.getTopic(f.getTopicId());
        String no = f == null ? "文件不存在" : gateView(me, t);
        if (no != null) {
            response.setStatus(404);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":1,\"msg\":\"" + no + "\",\"data\":null}");
            return;
        }
        if (KIND_FILE.equals(f.getKind())) {
            java.io.File disk = FileUtils.resolveUploadFile(uploadPath, f.getUrl());
            if (disk == null) {
                response.setStatus(404);
                return;
            }
            response.setContentType("application/octet-stream");
            response.setContentLengthLong(disk.length());
            response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''"
                    + java.net.URLEncoder.encode(f.getName(), "UTF-8").replace("+", "%20"));
            java.nio.file.Files.copy(disk.toPath(), response.getOutputStream());
            return;
        }

        // 文件夹：BFS 收集整棵子树，边走边记每个节点的相对路径
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''"
                + java.net.URLEncoder.encode(f.getName() + ".zip", "UTF-8").replace("+", "%20"));
        Map<String, String> pathOf = new HashMap<>();
        pathOf.put(f.getFileId(), "");
        List<String> frontier = new ArrayList<>();
        frontier.add(f.getFileId());
        Set<String> used = new HashSet<>();
        try (java.util.zip.ZipOutputStream zip =
                     new java.util.zip.ZipOutputStream(response.getOutputStream(),
                             java.nio.charset.StandardCharsets.UTF_8)) {
            for (int depth = 0; !frontier.isEmpty() && depth < 20; depth++) {
                List<ForumTopicFile> kids = fileMapper.selectList(new QueryWrapper<ForumTopicFile>()
                        .eq("TOPIC_ID", f.getTopicId()).in("PARENT_ID", frontier));
                frontier = new ArrayList<>();
                for (ForumTopicFile k : kids) {
                    String base = pathOf.get(k.getParentId()) + k.getName();
                    if (KIND_FOLDER.equals(k.getKind())) {
                        pathOf.put(k.getFileId(), base + "/");
                        frontier.add(k.getFileId());
                        zip.putNextEntry(new java.util.zip.ZipEntry(base + "/"));
                        zip.closeEntry();
                        continue;
                    }
                    java.io.File disk = FileUtils.resolveUploadFile(uploadPath, k.getUrl());
                    if (disk == null) {
                        continue;      // 盘上没了就跳过，别让一条坏记录毁掉整个包
                    }
                    String entry = base;
                    for (int i = 2; !used.add(entry); i++) {
                        int dot = base.lastIndexOf('.');
                        entry = dot > base.lastIndexOf('/')
                                ? base.substring(0, dot) + " (" + i + ")" + base.substring(dot)
                                : base + " (" + i + ")";
                    }
                    zip.putNextEntry(new java.util.zip.ZipEntry(entry));
                    java.nio.file.Files.copy(disk.toPath(), zip);
                    zip.closeEntry();
                }
            }
        }
    }

    private int countIn(String topicId, ForumTopicFile folder) {
        QueryWrapper<ForumTopicFile> qw = new QueryWrapper<ForumTopicFile>().eq("TOPIC_ID", topicId);
        if (folder == null) {
            qw.isNull("PARENT_ID");
        } else {
            qw.eq("PARENT_ID", folder.getFileId());
        }
        Integer n = fileMapper.selectCount(qw);
        return n == null ? 0 : n;
    }
}
