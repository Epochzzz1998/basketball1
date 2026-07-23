import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Form, Input, Select, Space, message } from 'antd'
import { BarChartOutlined, StarFilled } from '@ant-design/icons'
import RichTextEditor from '../../components/RichTextEditor'
import { RatingImagePicker } from '../../components/RatingCard'
import { newsApi } from '../../api/news'
import { ratingApi } from '../../api/rating'
import { pollApi } from '../../api/poll'
import { searchApi } from '../../api/search'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'

// 标签推荐项（只是下拉建议，可自定义任意添加）：通用分类，不绑定具体主题
const TAG_SUGGESTIONS = [
  '讨论', '分享', '求助', '公告', '资源', '教程', '反馈', '闲聊', '重磅', '精华',
]

/**
 * 资讯录入/编辑（manager）。替代 news-input.ftl。
 * - 作者：取当前登录用户昵称、只读不可改（编辑时保留原作者）；
 * - 标签：mode="tags" 自定义任意添加 + 通用推荐项（不绑定具体主题）；
 * - 新建用 crypto.randomUUID() 定 newsId（插图按它归档、保存按它 upsert）；
 * - publishDate 不传，后端 save() 见空自动设当前时间。
 */
export default function NewsEdit() {
  const { newsId: routeId } = useParams()
  const isEdit = !!routeId
  // 频道：从官方新闻区点"发布新闻"带 ?channel=official；后端只对新帖校验（official 需 manager+），编辑保留原频道
  const [searchParams] = useSearchParams()
  const official = searchParams.get('channel') === 'official'
  // 论坛发帖必须带 ?topicId=xxx（从专题内点"发帖"进来）；编辑时后端保留原专题
  const topicId = searchParams.get('topicId') || undefined
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form] = Form.useForm()
  const [content, setContent] = useState('')
  const [authorId, setAuthorId] = useState(undefined) // 保存时回传：新建=当前用户，编辑=原作者
  const [topicName, setTopicName] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false) // 开分填写卡展开态（默认只显示按钮）
  const [ratingImg, setRatingImg] = useState('') // 打分对象配图 URL（可选）
  const [pollOpen, setPollOpen] = useState(false) // 发起投票填写卡展开态
  const [pollSubject, setPollSubject] = useState('')
  const [pollOptions, setPollOptions] = useState(['', '']) // 2-10 个选项
  const newsIdRef = useRef(routeId || crypto.randomUUID())
  const isMobile = useIsMobile()

  // 新建到专题：拉专题名显示（让用户知道发到哪）
  useEffect(() => {
    if (!isEdit && topicId) {
      topicApi.get(topicId).then((t) => setTopicName(t?.name || '')).catch(() => {})
    }
  }, [isEdit, topicId])

  // 新建：用户信息异步加载好后，把作者填成当前登录用户（字段只读）
  useEffect(() => {
    if (!isEdit && user) {
      form.setFieldsValue({ author: user.userNickname })
      setAuthorId(user.userId)
    }
  }, [isEdit, user, form])

  // 编辑：拉取已有资讯，预载表单并保留原作者
  useEffect(() => {
    if (!isEdit) return
    let alive = true
    newsApi.getNews(routeId)
      .then((data) => {
        const n = data?.news
        if (alive && n) {
          form.setFieldsValue({ title: n.title, author: n.author, tags: (n.tags || '').split(',').map((s) => s.trim()).filter(Boolean) })
          setAuthorId(n.authorId)
          setContent(n.content || '')
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [routeId, isEdit, form])

  const onFinish = async (values) => {
    setSaving(true)
    try {
      await newsApi.saveNews({
        newsId: newsIdRef.current,
        title: values.title,
        author: values.author, // 只读字段，值仍由 antd Form 收集
        authorId,
        tags: (values.tags || []).join(','), // 标签数组 → 逗号串
        newsChannel: official ? 'official' : 'forum',
        topicId: official ? undefined : topicId, // 新建论坛帖带专题；编辑时后端保留原专题
        content,
      })
      // 发帖时开启打分（可选，仅新帖）：帖子存好后把打分项挂上；失败不阻断发帖
      const ratingSubject = ratingOpen ? (values.ratingSubject || '').trim() : ''
      if (!isEdit && ratingSubject) {
        try {
          await ratingApi.create({ newsId: newsIdRef.current, subject: ratingSubject, imageUrl: ratingImg || undefined })
        } catch { message.warning('帖子已发出，但打分开启失败，可在评论区重新开启') }
      }
      // 发帖时发起投票（可选，仅新帖）：同打分，失败不阻断发帖
      const pollSub = pollOpen ? pollSubject.trim() : ''
      const pollOpts = pollOptions.map((o) => o.trim()).filter(Boolean)
      if (!isEdit && pollSub && pollOpts.length >= 2) {
        try {
          await pollApi.create({ newsId: newsIdRef.current, subject: pollSub, options: JSON.stringify(pollOpts) })
        } catch { message.warning('帖子已发出，但投票发起失败，可在评论区重新发起') }
      }
      message.success('已保存')
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title={isEdit ? '编辑帖子' : official ? '发布官方新闻' : topicName ? `发帖到「${topicName}」` : '发帖'}
      loading={loading}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入标题" maxLength={100} showCount />
        </Form.Item>
        {/* 作者 + 标签：移动端标签独占一整行（Space 里 minWidth:100% 不生效，空 Select 会坍缩成一个字宽） */}
        <div style={{ display: 'flex', columnGap: 24, flexWrap: 'wrap' }}>
          <Form.Item name="author" label="作者" tooltip="当前登录用户，不可修改">
            <Input disabled style={{ width: 160 }} />
          </Form.Item>
          <Form.Item
            name="tags"
            label="标签"
            tooltip="输入后回车添加，可自定义；也可从推荐里选"
            style={{ flex: 1, minWidth: isMobile ? '100%' : 320 }}
          >
            <Select
              mode="tags"
              allowClear
              placeholder="输入标签回车添加，可自定义（如 讨论、公告、求助）"
              style={{ width: '100%' }}
              tokenSeparators={[',', '，', ' ']}
              maxTagCount={8}
              options={TAG_SUGGESTIONS.map((t) => ({ label: t, value: t }))}
            />
          </Form.Item>
        </div>
        {/* 开启打分（可选，仅新帖）：填了对象即在主贴挂一个 1-5 星打分项；之后楼主还能在评论区继续开 */}
        {/* 开启打分（可选，仅新帖）：默认只是一个按钮，点开才出填写卡；收起即放弃并清空 */}
        {!isEdit && (
          <div style={{ marginBottom: 24 }}>
            {!ratingOpen ? (
              <span
                onClick={() => setRatingOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
                  padding: '5px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                  color: '#fa8c16', background: '#fff7e6', border: '1px solid #ffd591', transition: 'all .15s',
                }}
              >
                <StarFilled /> 开启打分（可选）
              </span>
            ) : (
              <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 12, padding: '14px 16px', maxWidth: 480 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#d46b08' }}>
                    <StarFilled style={{ marginRight: 6 }} />开启打分（随帖子一起发布）
                  </span>
                  <span style={{ flex: 1 }} />
                  <a
                    onClick={() => { setRatingOpen(false); setRatingImg(''); form.setFieldsValue({ ratingSubject: undefined }) }}
                    style={{ fontSize: 12, color: '#bfbfbf' }}
                  >
                    收起不开
                  </a>
                </div>
                <Form.Item name="ratingSubject" noStyle>
                  <Input placeholder="想为什么打分？" maxLength={30} showCount style={{ maxWidth: 360, display: 'block' }} />
                </Form.Item>
                <div style={{ marginTop: 10 }}>
                  <RatingImagePicker value={ratingImg} onChange={setRatingImg} upload={(f) => newsApi.uploadNewsImage(f, newsIdRef.current)} />
                </div>
                <div style={{ fontSize: 11, color: '#d3a15f', marginTop: 8 }}>1-5 星打分，可配一张图；发帖后还能在评论区继续为其他对象开分</div>
              </div>
            )}
          </div>
        )}
        {/* 发起投票（可选，仅新帖）：与打分同款折叠交互，蓝色系区分 */}
        {!isEdit && (
          <div style={{ marginBottom: 24 }}>
            {!pollOpen ? (
              <span
                onClick={() => setPollOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
                  padding: '5px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                  color: '#1677ff', background: '#e6f4ff', border: '1px solid #91caff', transition: 'all .15s',
                }}
              >
                <BarChartOutlined /> 发起投票（可选）
              </span>
            ) : (
              <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 12, padding: '14px 16px', maxWidth: 480 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0958d9' }}>
                    <BarChartOutlined style={{ marginRight: 6 }} />发起投票（随帖子一起发布）
                  </span>
                  <span style={{ flex: 1 }} />
                  <a
                    onClick={() => { setPollOpen(false); setPollSubject(''); setPollOptions(['', '']) }}
                    style={{ fontSize: 12, color: '#bfbfbf' }}
                  >
                    收起不发
                  </a>
                </div>
                <Input
                  placeholder="想投什么？"
                  maxLength={30}
                  showCount
                  value={pollSubject}
                  onChange={(e) => setPollSubject(e.target.value)}
                  style={{ maxWidth: 360, display: 'block' }}
                />
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Input
                        placeholder={`选项 ${i + 1}`}
                        maxLength={20}
                        value={opt}
                        onChange={(e) => setPollOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                      {pollOptions.length > 2 && (
                        <Button size="small" type="text" danger onClick={() => setPollOptions((arr) => arr.filter((_, j) => j !== i))}>删</Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 10 && (
                    <Button size="small" onClick={() => setPollOptions((arr) => [...arr, ''])} style={{ width: 120 }}>+ 添加选项</Button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#69b1ff', marginTop: 8 }}>2-10 个选项，单选、可改票；发帖后还能在评论区继续发起投票</div>
              </div>
            )}
          </div>
        )}
        <Form.Item label="正文" required>
          <RichTextEditor
            value={content}
            onChange={setContent}
            uploadImage={(file) => newsApi.uploadNewsImage(file, newsIdRef.current)}
          />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
          <Button onClick={() => navigate(-1)}>取消</Button>
        </Space>
      </Form>
    </Card>
  )
}
