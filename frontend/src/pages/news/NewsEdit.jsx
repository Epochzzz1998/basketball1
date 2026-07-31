import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Input, Modal, Popconfirm, Spin, Tooltip, Upload, message } from 'antd'
import {
  AppstoreOutlined, BarChartOutlined, CloseOutlined, PaperClipOutlined, PictureOutlined,
  RightOutlined, StarOutlined, TagOutlined,
} from '@ant-design/icons'
import RichTextEditor from '../../components/RichTextEditor'
import EmojiPicker from '../../components/EmojiPicker'
import { newsApi } from '../../api/news'
import { ratingApi } from '../../api/rating'
import { pollApi } from '../../api/poll'
import { searchApi } from '../../api/search'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'
import { useGoBack } from '../../components/backNav'
import useIsMobile from '../../hooks/useIsMobile'
import useVisualViewport from '../../hooks/useVisualViewport'
import {
  PollEditModal, PollPreview, RatingEditModal, RatingPreview, TagPickerModal,
} from './PostComposerExtras'

/**
 * 发帖器（P6 改版）。整屏一张"纸"：
 *
 *   ✕   贴子              存草稿  发布
 *   ─────────────────────────────────
 *   标题
 *   正文（无边框、无自带工具栏，随内容长高）
 *   [投票卡] [打分卡]        ← 填完摆在正文下面，可叉掉
 *   ─────────────────────────────────
 *   发到  某某专题
 *   # 添加话题        #讨论 #复盘   >
 *   分区             （专题配了才有） >
 *   投票 / 打分                     >
 *   ─────────────────────────────────
 *   🖼  📎  🙂                      ➕
 *
 * 几个刻意的选择：
 * - **富文本自带的工具栏收掉了**（RichTextEditor 的 bare 模式）：功能改由底部那条
 *   四个图标的工具栏提供，桌面端也一样——两端一套长相是明确要求。
 * - 移动端整块 `position: fixed` 钉在**可视视口**上（和群聊/私信同一套做法），
 *   底部工具栏因此永远停在键盘上沿。
 * - 打分/投票仍然**只对新帖**开放：它们是"发布"动作，编辑一篇已经发出去的帖子时
 *   要改这些得去评论区（后端接口也是这么分的）。
 */

const HEAD_H = 52

/** 底部工具栏的一个图标 */
function ToolIcon({ icon, title, onClick }) {
  return (
    <Tooltip title={title}>
      <span
        onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, fontSize: 20, color: '#8c8c8c',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}
      >
        {icon}
      </span>
    </Tooltip>
  )
}

/** 底部那一排设置项的一行：图标 + 名字 …… 右边的值 + 箭头 */
function SettingRow({ icon, label, value, placeholder, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 2px',
        borderTop: '1px solid #f5f5f5', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 16, color: danger ? '#ff4d4f' : '#595959', display: 'inline-flex' }}>{icon}</span>
      <span style={{ fontSize: 15, color: danger ? '#ff4d4f' : '#262626', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          flex: 1, minWidth: 0, textAlign: 'right', fontSize: 13,
          color: value ? '#595959' : '#c4c4c4',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value || placeholder}
      </span>
      <RightOutlined style={{ fontSize: 12, color: '#d0d0d0' }} />
    </div>
  )
}

export default function NewsEdit() {
  const { newsId: routeId } = useParams()
  const isEdit = !!routeId
  // 频道：从官方新闻区点"发布新闻"带 ?channel=official；后端只对新帖校验（official 需 manager+），编辑保留原频道
  const [searchParams] = useSearchParams()
  const official = searchParams.get('channel') === 'official'
  // 论坛发帖必须带 ?topicId=xxx（从专题内点"发帖"进来）；编辑时后端保留原专题
  const topicId = searchParams.get('topicId') || undefined
  const navigate = useNavigate()
  const goBack = useGoBack() // ✕ 走它：直链进来（通知、外部链接）时历史里没有上一页，-1 会退出整个站
  const { user, dn } = useAuth() // dn：我给谁起过备注名（@ 面板的小字里提示，插进正文的仍是真昵称）
  const isMobile = useIsMobile()
  const vp = useVisualViewport()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState([])
  const [categoryId, setCategoryId] = useState(undefined)
  const [authorId, setAuthorId] = useState(undefined) // 保存时回传：新建=当前用户，编辑=原作者
  const [author, setAuthor] = useState('')
  const [topicName, setTopicName] = useState('')
  const [postCats, setPostCats] = useState([]) // 本专题的帖子类别（题主配的 [{id,name}]）
  const [zoneTopicId, setZoneTopicId] = useState(topicId) // 本帖所属专题：新建取自路由，编辑取自帖子
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [isDraft, setIsDraft] = useState(false)   // 打开的这篇本来就是草稿？决定按钮写「发布」还是「保存」
  const draftRef = useRef(false)                  // 本次提交是存草稿还是正式发布

  const [poll, setPoll] = useState(null)          // { subject, options[] } | null
  const [rating, setRating] = useState(null)      // { subject, imageUrl } | null
  const [tagOpen, setTagOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)

  const newsIdRef = useRef(routeId || crypto.randomUUID())
  const editorRef = useRef(null)

  // 专题名：新建时显示"发到哪"，编辑时只为判断是不是 NBA 专区（决定能不能 @ 球员）。
  // 编辑态的 topicId 要等帖子拉回来才知道，所以这里接的是 zoneTopicId 而非路由参数。
  useEffect(() => {
    if (!zoneTopicId) return
    topicApi.get(zoneTopicId)
      .then((t) => { setTopicName(t?.name || ''); setPostCats(t?.postCategories || []) })
      .catch(() => {})
  }, [zoneTopicId])

  // 新建：用户信息异步加载好后，把作者记成当前登录用户
  useEffect(() => {
    if (!isEdit && user) {
      setAuthor(user.userNickname)
      setAuthorId(user.userId)
    }
  }, [isEdit, user])

  // 编辑：拉取已有资讯，预载并保留原作者
  useEffect(() => {
    if (!isEdit) return undefined
    let alive = true
    newsApi.getNews(routeId)
      .then((data) => {
        const n = data?.news
        if (alive && n) {
          setTitle(n.title || '')
          setAuthor(n.author || '')
          setAuthorId(n.authorId)
          setCategoryId(n.categoryId || undefined)
          setTags((n.tags || '').split(',').map((s) => s.trim()).filter(Boolean))
          setContent(n.content || '')
          setZoneTopicId(n.topicId || undefined) // 编辑他人/自己的老帖时，专区靠帖子自己带
          setIsDraft(n.draft === '1') // 打开的是草稿：主按钮改成「发布」
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [routeId, isEdit])

  // 桌面端是罩在页面上的弹层，底下那一页不该还能滚（滚了黑纱后面的内容会动，
  // 而且滚回来时纸的位置没变，看着像卡住了）。移动端那张纸自己钉满一屏，不用管
  useEffect(() => {
    if (isMobile) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isMobile])

  // NBA 专区（专题名含 NBA，与首页热帖榜同一判定）才开 @ 面板
  const isNbaZone = !official && topicName.includes('NBA')

  // @ 候选：所有专区都联想用户，NBA 专区额外带上球员。
  // 只给球员是不行的——面板一弹出来焦点就进了它的搜索框，正文里再也打不出 @昵称，
  // 等于把「@ 人」这条老路堵死了。两个接口并行拉，用户在前、球员在后。
  const searchMentions = async (kw) => {
    const [users, players] = await Promise.all([
      searchApi.mentionUsers(kw).catch(() => []),
      isNbaZone ? searchApi.mentionPlayers(kw).catch(() => []) : Promise.resolve([]),
    ])
    return [
      ...(users || []).map((u) => ({
        id: u.userId,
        name: u.userNickname,
        avatar: u.avatar,
        // 备注名只出现在小字里：正文里插的必须是真昵称，否则别人看到的是我私下起的外号
        sub: dn(u.userId, '') && dn(u.userId, '') !== u.userNickname ? `备注：${dn(u.userId, '')}` : '',
        group: isNbaZone ? '用户' : '', // 只有一组时不必出小标题
      })),
      // sub 那行放英文名 + 生涯年份——同姓球员一堆，光中文名认不出是哪个库里
      ...(players || []).map((p) => ({
        id: p.playerId,
        name: p.playerName || p.nameEn,
        avatar: p.photo,
        sub: [p.nameEn, p.firstYear ? `${p.firstYear}-${p.lastYear}` : ''].filter(Boolean).join(' · '),
        group: '球员',
        info: { kind: 'player' }, // 写进 data-info，正文里据此描金标、点击进资料卡
      })),
    ]
  }

  // 草稿是自己没发出去的东西，随手删掉的入口就该在编辑器里——它点进来只有这一条路，
  // 详情页那个删除按钮草稿根本走不到
  const removeDraft = async () => {
    try {
      await newsApi.deletePost(newsIdRef.current)
      message.success('草稿已删除')
      navigate(-1)
    } catch { /* 已提示 */ }
  }

  const upload = (file) => newsApi.uploadNewsImage(file, newsIdRef.current)

  // 底部工具栏「图片」：传完插进光标处
  const pickImage = async (file) => {
    try {
      const url = await upload(file)
      if (url) editorRef.current?.insertImage(url)
    } catch {
      message.error('图片上传失败')
    }
  }

  // 底部工具栏「附件」：走评论那条上传（图片和文档都收），在正文里插一条链接
  const pickFile = async (file) => {
    try {
      const url = await newsApi.uploadCommentFile(file, newsIdRef.current)
      if (url) editorRef.current?.insertLink(file.name, url)
    } catch {
      message.error('附件上传失败')
    }
  }

  const submit = async (asDraft) => {
    draftRef.current = asDraft
    if (!asDraft && !title.trim()) return message.warning('请输入标题')
    setSaving(true)
    try {
      await newsApi.saveNews({
        newsId: newsIdRef.current,
        title: title.trim(),
        author, // 只读，跟着帖子走
        authorId,
        tags: tags.join(','), // 标签数组 → 逗号串
        categoryId: categoryId || '', // 帖子类别（专题自配，可不选）
        newsChannel: official ? 'official' : 'forum',
        topicId: official ? undefined : topicId, // 新建论坛帖带专题；编辑时后端保留原专题
        content,
        draft: asDraft ? '1' : '0',
      })
      // 存草稿就到此为止：打分/投票是发布动作，草稿阶段不该挂上去，也不该通知任何人。
      // 存完**留在编辑器里**——跳走的话主按钮上那个「发布」就再也见不到了。
      if (asDraft) {
        message.success('草稿已保存，点右上角发布发出')
        setIsDraft(true)
        return undefined
      }
      // 发帖时开启打分（可选，仅新帖）：帖子存好后把打分项挂上；失败不阻断发帖
      if (!isEdit && rating?.subject) {
        try {
          await ratingApi.create({ newsId: newsIdRef.current, subject: rating.subject, imageUrl: rating.imageUrl || undefined })
        } catch { message.warning('帖子已发出，但打分开启失败，可在评论区重新开启') }
      }
      // 发帖时发起投票（可选，仅新帖）：同打分，失败不阻断发帖
      if (!isEdit && poll?.subject && poll.options?.length >= 2) {
        try {
          await pollApi.create({ newsId: newsIdRef.current, subject: poll.subject, options: JSON.stringify(poll.options) })
        } catch { message.warning('帖子已发出，但投票发起失败，可在评论区重新发起') }
      }
      message.success(isEdit && !isDraft ? '已保存' : '已发布')
      navigate(-1)
      return undefined
    } finally {
      setSaving(false)
    }
  }

  const catLabel = useMemo(
    () => postCats.find((c) => c.id === categoryId)?.name || '',
    [postCats, categoryId],
  )

  // 移动端把整块钉在可视视口上（照搬群聊/私信）：键盘一弹，底部工具栏正好停在键盘上沿。
  // 拿不到 visualViewport 的浏览器退回普通布局
  const pinned = isMobile && vp.h != null
  // 键盘弹起来的时候底部就不是屏幕底边了，再垫一截 home 条的安全区会空出一道白
  const kbOpen = pinned && vp.h < window.innerHeight - 80

  const shell = pinned
    ? {
        position: 'fixed', left: 0, top: vp.top, width: '100%', height: vp.h, zIndex: 1000,
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }
    : {
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        // 桌面端是一张浮在蒙层上的纸，尺寸和原来铺在页面里时一样（宽 760、至少 72vh），
        // 只是不再跟着页面滚——上下留一截，内容多了在纸里面滚
        maxWidth: 760, width: '100%', minHeight: '72vh', maxHeight: 'calc(100vh - 64px)',
        boxShadow: '0 16px 48px rgba(0,0,0,.24)',
      }

  return (
    /* 外面这一层：桌面端是黑纱，移动端用 display:contents 让它从布局里消失
       （里面那张纸自己已经钉满一屏了）。
       **不能写成「移动端直接返回 sheet、桌面端才包一层」**：`pinned` 会在挂载后
       第一次拿到 visualViewport 时由 false 翻成 true，根节点的结构一变 React 就把
       整棵子树卸载重建，富文本编辑器跟着被销毁重造，控制台一串
       "Can not get editor instance"，刚打的字也没了。结构恒定，只换样式。

       点黑纱不关：写了一半的东西手一抖就没了，关闭只走左上角那个 ✕（和移动端一致） */
    <div
      className={pinned ? undefined : 'composer-backdrop'}
      style={pinned ? { display: 'contents' } : {
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
    <div className="composer-sheet" style={shell}>
      {/* ===== 顶栏：✕ / 标题 / 存草稿 + 发布 ===== */}
      <div
        style={{
          flexShrink: 0, padding: '0 14px',
          paddingTop: pinned ? 'env(safe-area-inset-top)' : 0,
          borderBottom: '1px solid #f5f5f5', background: '#fff',
        }}
      >
        {/* 标题绝对定位居中，**不能靠 flex:1 + textAlign 居中**：右边「存草稿 + 发布」
            比左边一个 ✕ 宽得多，那样算出来的中点是「剩余空间的中点」，看着明显偏左。
            这一层不含上面那截安全区内边距，所以 inset 0 就是顶栏本身。
            pointerEvents:none 让它不挡住底下按钮的点击区 */}
        <div style={{ position: 'relative', height: HEAD_H, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 600, pointerEvents: 'none',
            }}
          >
            {isEdit ? '编辑' : official ? '新闻' : '贴子'}
          </span>
          <CloseOutlined
            onClick={goBack}
            style={{ fontSize: 18, color: '#595959', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          />
          <span style={{ flex: 1 }} />
          {/* 草稿：不校验必填也不通知任何人，随手存下来就走。已经发出去的帖子没有"存草稿"一说 */}
          {(!isEdit || isDraft) && (
            <a
              onClick={() => !saving && submit(true)}
              style={{ fontSize: 13, color: '#8c8c8c', flexShrink: 0, position: 'relative' }}
            >
              存草稿
            </a>
          )}
          <Button
            type="primary"
            shape="round"
            loading={saving && !draftRef.current}
            onClick={() => submit(false)}
            style={{ flexShrink: 0, position: 'relative' }}
          >
            {/* 只有「改一篇已经发出去的帖子」才叫保存；新帖和草稿点下去都是真的发出去 */}
            {isEdit && !isDraft ? '保存' : '发布'}
          </Button>
        </div>
      </div>

      {/* ===== 中间：可滚动的一屏 ===== */}
      <div className="composer-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '4px 16px 20px' : '4px 26px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>
        ) : (
          <>
            {isDraft && (
              <div style={{ margin: '10px 0 4px', padding: '8px 12px', borderRadius: 10, background: '#fffbe6', fontSize: 12, color: '#ad6800' }}>
                这是草稿，只有你自己看得到。点右上角「发布」才会公开出去。
              </div>
            )}

            <Input
              variant="borderless"
              placeholder="请输入完整贴子标题"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              style={{ fontSize: 19, fontWeight: 700, padding: '16px 0 12px' }}
            />
            <div style={{ height: 1, background: '#f5f5f5' }} />

            <RichTextEditor
              ref={editorRef}
              bare
              minHeight={pinned ? 180 : 260}
              placeholder="请输入正文…"
              value={content}
              onChange={setContent}
              uploadImage={upload}
              mentionSearch={searchMentions}
              mentionHint={isNbaZone
                ? { placeholder: '搜索用户或球员…', emptyText: '没有找到用户或球员' }
                : { placeholder: '搜索用户…', emptyText: '无匹配用户' }}
            />

            {/* 填好的投票/打分摆在正文下面，可叉掉、点一下回到弹窗改 */}
            {poll && <PollPreview value={poll} onEdit={() => setPollOpen(true)} onRemove={() => setPoll(null)} />}
            {rating && <RatingPreview value={rating} onEdit={() => setRatingOpen(true)} onRemove={() => setRating(null)} />}

            {/* ===== 设置区 ===== */}
            <div style={{ marginTop: 22 }}>
              {(topicName || official) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 12px', fontSize: 15, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fa541c' }} />
                  {official ? '官方新闻' : topicName}
                </div>
              )}

              <SettingRow
                icon={<TagOutlined />}
                label="添加话题"
                value={tags.map((t) => `#${t}`).join(' ')}
                placeholder="加了话题更容易被翻到"
                onClick={() => setTagOpen(true)}
              />

              {/* 类别是本专题自己的一份（题主在专题设置里配）；没配过就不出这一行 */}
              {postCats.length > 0 && (
                <SettingRow
                  icon={<AppstoreOutlined />}
                  label="分区"
                  value={catLabel}
                  placeholder="不选 = 未分类"
                  onClick={() => setCatOpen(true)}
                />
              )}

              {/* 打分/投票只对新帖开放（见文件头说明） */}
              {!isEdit && (
                <>
                  <SettingRow
                    icon={<BarChartOutlined />}
                    label="投票"
                    value={poll?.subject}
                    placeholder="发起一个投票"
                    onClick={() => setPollOpen(true)}
                  />
                  <SettingRow
                    icon={<StarOutlined />}
                    label="打分"
                    value={rating?.subject}
                    placeholder="开一个 1-5 星打分"
                    onClick={() => setRatingOpen(true)}
                  />
                </>
              )}

              {isDraft && (
                <Popconfirm
                  title="删除这份草稿？"
                  description="草稿没有发布过，删了不可恢复"
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  onConfirm={removeDraft}
                >
                  <div><SettingRow icon={<CloseOutlined />} label="删除草稿" danger /></div>
                </Popconfirm>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== 底部工具栏：图片 / 附件 / 表情 =====
          右下角原来还有一个「+」（弹出投票/打分/话题），去掉了——那三样在上面设置区
          各自有一行，同一个动作给两个入口只会让人犹豫点哪个 */}
      <div
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderTop: '1px solid #f0f0f0', background: '#fff',
          paddingBottom: kbOpen ? 6 : 'calc(6px + env(safe-area-inset-bottom))',
        }}
      >
        <Upload accept="image/*" showUploadList={false} beforeUpload={(f) => { pickImage(f); return false }}>
          <ToolIcon icon={<PictureOutlined />} title="图片" />
        </Upload>
        <Upload showUploadList={false} beforeUpload={(f) => { pickFile(f); return false }}>
          <ToolIcon icon={<PaperClipOutlined />} title="附件" />
        </Upload>
        {/* EmojiPicker 自带笑脸图标和弹层，这里只要给它一个落点 */}
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, fontSize: 20 }}>
          <EmojiPicker onPick={(e) => editorRef.current?.insertText(e)} />
        </span>
      </div>

      {/* ===== 弹窗 ===== */}
      <TagPickerModal
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        value={tags}
        onChange={setTags}
        topicId={zoneTopicId}
        official={official}
      />
      {!isEdit && (
        <>
          <PollEditModal open={pollOpen} onClose={() => setPollOpen(false)} value={poll} onSave={setPoll} />
          <RatingEditModal open={ratingOpen} onClose={() => setRatingOpen(false)} value={rating} onSave={setRating} upload={upload} />
        </>
      )}
      {/* 分区：题主配的那几项，单选，再点一下取消 */}
      <Modal open={catOpen} onCancel={() => setCatOpen(false)} title="选择分区" footer={null} width={400} destroyOnClose>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {postCats.map((c) => {
            const on = c.id === categoryId
            return (
              <span
                key={c.id}
                onClick={() => { setCategoryId(on ? undefined : c.id); setCatOpen(false) }}
                style={{
                  cursor: 'pointer', userSelect: 'none', padding: '6px 14px', borderRadius: 999, fontSize: 13,
                  color: on ? '#d4380d' : '#595959',
                  background: on ? '#fff1e6' : '#f5f5f5',
                  border: `1px solid ${on ? '#ffbb96' : 'transparent'}`,
                }}
              >
                {c.name}
              </span>
            )
          })}
        </div>
        <div style={{ fontSize: 12, color: '#bbb', marginTop: 14 }}>不选 = 未分类；再点一下已选中的即可取消</div>
      </Modal>
    </div>
    </div>
  )
}
