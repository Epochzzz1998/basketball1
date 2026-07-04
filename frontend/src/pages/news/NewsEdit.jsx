import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Form, Input, Select, Space, message } from 'antd'
import RichTextEditor from '../../components/RichTextEditor'
import { newsApi } from '../../api/news'
import { searchApi } from '../../api/search'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'

// 富文本 @ 候选：把后端用户规约成编辑器面板要的 {id,name,avatar}
const mentionSearch = async (kw) => {
  const list = await searchApi.mentionUsers(kw)
  return (list || []).map((u) => ({ id: u.userId, name: u.userNickname, avatar: u.avatar }))
}

// 标签推荐项（可自定义添加，这里只是下拉建议）：常见分类 + NBA 30 队简写
const TAG_SUGGESTIONS = [
  '赛事', '转会', '伤病', '选秀', '数据分析', '花边', '公告', '重磅', '讨论',
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
]

/**
 * 资讯录入/编辑（manager）。替代 news-input.ftl。
 * - 作者：取当前登录用户昵称、只读不可改（编辑时保留原作者）；
 * - 球队/分类：下拉选择（NBA 30 队 / 预设分类），不手输；
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
  const newsIdRef = useRef(routeId || crypto.randomUUID())

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
          <Input placeholder="资讯标题" maxLength={100} showCount />
        </Form.Item>
        <Space size="large" wrap>
          <Form.Item name="author" label="作者" tooltip="当前登录用户，不可修改">
            <Input disabled style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="tags" label="标签" tooltip="输入后回车添加，可自定义；也可从推荐里选" style={{ minWidth: 320 }}>
            <Select
              mode="tags"
              allowClear
              placeholder="输入标签回车添加（如 转会、湖人、重磅）"
              style={{ minWidth: 320 }}
              tokenSeparators={[',', '，', ' ']}
              maxTagCount={8}
              options={TAG_SUGGESTIONS.map((t) => ({ label: t, value: t }))}
            />
          </Form.Item>
        </Space>
        <Form.Item label="正文" required>
          <RichTextEditor
            value={content}
            onChange={setContent}
            uploadImage={(file) => newsApi.uploadNewsImage(file, newsIdRef.current)}
            mentionSearch={mentionSearch}
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
