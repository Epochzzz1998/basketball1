import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Checkbox, Empty, Modal, Popconfirm, Select, Spin, message } from 'antd'
import { CloseCircleFilled, CrownFilled, DeleteOutlined } from '@ant-design/icons'
import { topicApi } from '../api/topic'
import { searchApi } from '../api/search'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 专题成员权限管理（owner / admin 用）：搜用户加入 + 逐人勾三权（浏览/发帖/发言）+ 移除。
 * 发帖/发言会自动带上浏览权（后端强制），保存后重拉以反映归一化后的状态。
 */

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}
const bool = (b) => (b ? '1' : '0')

export default function TopicMemberModal({ topicId, open, onClose, onChange }) {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const isSuper = !!user?.isSuperManager
  const [rows, setRows] = useState(null)
  const [reqs, setReqs] = useState([])
  const [reqFlags, setReqFlags] = useState({}) // { requestId: {comment, post} } 审批时勾选给哪些权限
  const [opts, setOpts] = useState([])
  const [owners, setOwners] = useState([]) // 题主列表 [{userId,userNickname,avatar}]，超管管理
  const [ownerOpts, setOwnerOpts] = useState([])
  const [subOwners, setSubOwners] = useState([]) // 小题主列表（最多 3 人），题主/超管管理
  const [canEditSub, setCanEditSub] = useState(false)
  const [subOpts, setSubOpts] = useState([])
  const timer = useRef()
  const ownerTimer = useRef()
  const subTimer = useRef()

  const load = () => {
    setRows(null)
    topicApi.members(topicId).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
    topicApi.requests(topicId).then((r) => {
      const list = Array.isArray(r) ? r : []
      setReqs(list)
      // 默认勾「发言」，不勾「发帖」
      const f = {}
      list.forEach((x) => { f[x.requestId] = { comment: true, post: false } })
      setReqFlags(f)
    }).catch(() => setReqs([]))
    topicApi.get(topicId).then((d) => {
      setOwners(d?.owners || [])
      setSubOwners(d?.subOwners || [])
      setCanEditSub(!!d?.canEditSubOwners)
    }).catch(() => {})
  }
  useEffect(() => { if (open && topicId) load() }, [open, topicId])

  // ===== 题主管理（超管专用，可多人）=====
  const commitOwners = async (ids) => {
    if (!ids.length) return message.warning('至少要保留一个题主')
    try {
      await topicApi.setOwners(topicId, ids.join(','))
      load()
      onChange?.() // 让上层刷新题主标识/横幅
      message.success('已更新题主')
    } catch { /* 拦截器已提示 */ }
  }
  const addOwner = (userId) => {
    setOwnerOpts([])
    if (owners.some((o) => o.userId === userId)) return message.info('该用户已是题主')
    commitOwners([...owners.map((o) => o.userId), userId])
  }
  const removeOwner = (userId) => {
    if (owners.length <= 1) return message.warning('至少要保留一个题主')
    commitOwners(owners.filter((o) => o.userId !== userId).map((o) => o.userId))
  }
  const ownerSearch = (kw) => {
    clearTimeout(ownerTimer.current)
    if (!kw.trim()) return setOwnerOpts([])
    ownerTimer.current = setTimeout(async () => {
      try {
        const list = await searchApi.mentionUsers(kw)
        setOwnerOpts((list || []).map((u) => ({ value: u.userId, label: u.userNickname, avatar: u.avatar })))
      } catch { setOwnerOpts([]) }
    }, 250)
  }

  // ===== 小题主管理（题主/超管，最多 3 人）=====
  const commitSubOwners = async (ids) => {
    try {
      await topicApi.setSubOwners(topicId, ids.join(','))
      load()
      onChange?.()
      message.success('已更新小题主')
    } catch { /* 拦截器已提示 */ }
  }
  const addSubOwner = (userId) => {
    setSubOpts([])
    if (subOwners.some((o) => o.userId === userId)) return message.info('该用户已是小题主')
    if (owners.some((o) => o.userId === userId)) return message.info('该用户已是题主，无需设为小题主')
    if (subOwners.length >= 3) return message.warning('每个专题最多 3 个小题主')
    commitSubOwners([...subOwners.map((o) => o.userId), userId])
  }
  const removeSubOwner = (userId) => {
    commitSubOwners(subOwners.filter((o) => o.userId !== userId).map((o) => o.userId))
  }
  const subSearch = (kw) => {
    clearTimeout(subTimer.current)
    if (!kw.trim()) return setSubOpts([])
    subTimer.current = setTimeout(async () => {
      try {
        const list = await searchApi.mentionUsers(kw)
        setSubOpts((list || []).map((u) => ({ value: u.userId, label: u.userNickname, avatar: u.avatar })))
      } catch { setSubOpts([]) }
    }, 250)
  }

  const setReqFlag = (rid, key, val) => setReqFlags((f) => ({ ...f, [rid]: { ...f[rid], [key]: val } }))

  const handle = async (requestId, approve) => {
    try {
      const f = reqFlags[requestId] || { comment: true, post: false }
      await topicApi.handleRequest({
        requestId,
        approve: approve ? '1' : '0',
        ...(approve ? { canComment: f.comment ? '1' : '0', canPost: f.post ? '1' : '0' } : {}),
      })
      message.success(approve ? '已通过' : '已驳回')
      load()
      onChange?.() // 让上层刷新待审批角标
    } catch { /* 拦截器已提示 */ }
  }

  const search = (kw) => {
    clearTimeout(timer.current)
    if (!kw.trim()) return setOpts([])
    timer.current = setTimeout(async () => {
      try {
        const list = await searchApi.mentionUsers(kw)
        setOpts((list || []).map((u) => ({ value: u.userId, label: u.userNickname, avatar: u.avatar })))
      } catch { setOpts([]) }
    }, 250)
  }

  const addUser = async (userId) => {
    setOpts([])
    if (rows?.some((r) => r.userId === userId)) return message.info('该用户已在列表中')
    try {
      await topicApi.setMember({ topicId, userId, canView: '1', canPost: '0', canComment: '0' })
      load()
    } catch { /* 拦截器已提示 */ }
  }

  const setFlags = async (row, next) => {
    try {
      await topicApi.setMember({
        topicId, userId: row.userId,
        canView: bool(next.canView), canPost: bool(next.canPost), canComment: bool(next.canComment),
      })
      load()
    } catch { /* 拦截器已提示 */ }
  }

  const remove = async (userId) => {
    try { await topicApi.removeMember(topicId, userId); load() } catch { /* 已提示 */ }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="成员权限管理" width={560} destroyOnClose>
      {/* 题主管理（超管专用，可多人） */}
      {isSuper && (
        <div style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#389e0d', marginBottom: 10 }}>
            <CrownFilled style={{ marginRight: 6 }} />题主（可多人 · 超管指派）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {owners.map((o) => (
              <span key={o.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #d9f7be', borderRadius: 16, padding: '2px 8px 2px 2px' }}>
                {o.avatar ? <Avatar size={22} src={o.avatar} /> : <Avatar size={22} style={{ background: avatarColor(o.userNickname), fontSize: 11 }}>{String(o.userNickname || '?')[0].toUpperCase()}</Avatar>}
                <span style={{ fontSize: 13 }}>{o.userNickname}</span>
                {owners.length > 1 && (
                  <CloseCircleFilled onClick={() => removeOwner(o.userId)} style={{ color: '#ccc', cursor: 'pointer', fontSize: 15 }} />
                )}
              </span>
            ))}
          </div>
          <Select
            showSearch
            filterOption={false}
            value={null}
            placeholder="搜索用户设为题主…"
            style={{ width: '100%' }}
            onSearch={ownerSearch}
            onSelect={addOwner}
            notFoundContent={null}
            options={ownerOpts.map((o) => ({
              value: o.value,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {o.avatar ? <Avatar size={20} src={o.avatar} /> : <Avatar size={20} style={{ background: avatarColor(o.label), fontSize: 11 }}>{String(o.label || '?')[0].toUpperCase()}</Avatar>}
                  {o.label}
                </span>
              ),
            }))}
          />
          <div style={{ fontSize: 11, color: '#95de64', marginTop: 6 }}>题主对该专题有完整管理权（改设置、管成员、置顶/隐藏帖），发帖/评论会带「题主」标；至少保留一人。</div>
        </div>
      )}

      {/* 小题主管理（题主/超管，最多 3 人） */}
      {canEditSub && (
        <div style={{ marginBottom: 16, background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0958d9', marginBottom: 10 }}>
            <CrownFilled style={{ marginRight: 6 }} />小题主（最多 3 人 · 题主指派）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {subOwners.length ? subOwners.map((o) => (
              <span key={o.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #bae0ff', borderRadius: 16, padding: '2px 8px 2px 2px' }}>
                {o.avatar ? <Avatar size={22} src={o.avatar} /> : <Avatar size={22} style={{ background: avatarColor(o.userNickname), fontSize: 11 }}>{String(o.userNickname || '?')[0].toUpperCase()}</Avatar>}
                <span style={{ fontSize: 13 }}>{o.userNickname}</span>
                <CloseCircleFilled onClick={() => removeSubOwner(o.userId)} style={{ color: '#ccc', cursor: 'pointer', fontSize: 15 }} />
              </span>
            )) : <span style={{ fontSize: 12, color: '#69b1ff' }}>还没有小题主</span>}
          </div>
          {subOwners.length < 3 && (
            <Select
              showSearch
              filterOption={false}
              value={null}
              placeholder="搜索用户设为小题主…"
              style={{ width: '100%' }}
              onSearch={subSearch}
              onSelect={addSubOwner}
              notFoundContent={null}
              options={subOpts.map((o) => ({
                value: o.value,
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {o.avatar ? <Avatar size={20} src={o.avatar} /> : <Avatar size={20} style={{ background: avatarColor(o.label), fontSize: 11 }}>{String(o.label || '?')[0].toUpperCase()}</Avatar>}
                    {o.label}
                  </span>
                ),
              }))}
            />
          )}
          <div style={{ fontSize: 11, color: '#69b1ff', marginTop: 6 }}>小题主拥有题主的全部管理权限（管成员、审批、置顶/隐藏/删帖），唯一区别：不能对题主进行任何操作。</div>
        </div>
      )}

      {/* 待审批申请 */}
      {reqs.length > 0 && (
        <div style={{ marginBottom: 16, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ad6800', marginBottom: 8 }}>待审批申请（{reqs.length}）</div>
          {reqs.map((r) => {
            const f = reqFlags[r.requestId] || { comment: true, post: false }
            return (
              <div key={r.requestId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #fff3d6', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                {r.avatar ? <Avatar size={30} src={r.avatar} /> : <Avatar size={30} style={{ background: avatarColor(r.userNickname), fontWeight: 700 }}>{String(r.userNickname || '?')[0].toUpperCase()}</Avatar>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.userNickname}</div>
                  {r.message && <div style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</div>}
                </div>
                {/* 勾选给哪些权限（浏览默认给） */}
                <Checkbox checked={f.comment} onChange={(e) => setReqFlag(r.requestId, 'comment', e.target.checked)}>发言</Checkbox>
                <Checkbox checked={f.post} onChange={(e) => setReqFlag(r.requestId, 'post', e.target.checked)}>发帖</Checkbox>
                <Button size="small" type="primary" onClick={() => handle(r.requestId, true)}>通过</Button>
                <Button size="small" danger onClick={() => handle(r.requestId, false)}>驳回</Button>
              </div>
            )
          })}
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>通过后自动给「浏览」，发言/发帖按上方勾选；也可直接驳回。</div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Select
          showSearch
          filterOption={false}
          value={null}
          placeholder="搜索用户加入专题…"
          style={{ width: '100%' }}
          onSearch={search}
          onSelect={addUser}
          notFoundContent={null}
          options={opts.map((o) => ({
            value: o.value,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {o.avatar ? <Avatar size={20} src={o.avatar} /> : <Avatar size={20} style={{ background: avatarColor(o.label), fontSize: 11 }}>{String(o.label || '?')[0].toUpperCase()}</Avatar>}
                {o.label}
              </span>
            ),
          }))}
        />
      </div>

      <div style={{ display: 'flex', fontSize: 12, color: '#999', padding: '0 4px 6px', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ flex: 1 }}>成员</span>
        <span style={{ width: isMobile ? 44 : 56, textAlign: 'center' }}>浏览</span>
        <span style={{ width: isMobile ? 44 : 56, textAlign: 'center' }}>发帖</span>
        <span style={{ width: isMobile ? 44 : 56, textAlign: 'center' }}>发言</span>
        <span style={{ width: isMobile ? 28 : 36 }} />
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {rows === null ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
        ) : rows.length ? (
          rows.map((row) => (
            <div key={row.userId} style={{ display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #fafafa' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {row.avatar ? <Avatar size={30} src={row.avatar} /> : <Avatar size={30} style={{ background: avatarColor(row.userNickname), fontWeight: 700 }}>{String(row.userNickname || '?')[0].toUpperCase()}</Avatar>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.userNickname}</span>
              </div>
              <span style={{ width: isMobile ? 44 : 56, textAlign: 'center' }}>
                <Checkbox checked={row.canView} onChange={(e) => setFlags(row, { ...row, canView: e.target.checked })} />
              </span>
              <span style={{ width: isMobile ? 44 : 56, textAlign: 'center' }}>
                <Checkbox checked={row.canPost} onChange={(e) => setFlags(row, { ...row, canPost: e.target.checked })} />
              </span>
              <span style={{ width: isMobile ? 44 : 56, textAlign: 'center' }}>
                <Checkbox checked={row.canComment} onChange={(e) => setFlags(row, { ...row, canComment: e.target.checked })} />
              </span>
              <span style={{ width: isMobile ? 28 : 36, textAlign: 'center' }}>
                <Popconfirm title="移除该成员？" onConfirm={() => remove(row.userId)} okText="移除" cancelText="取消">
                  <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} />
                </Popconfirm>
              </span>
            </div>
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有成员，搜索用户加入" style={{ margin: '24px 0' }} />
        )}
      </div>
      <div style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>提示：勾选发帖或发言会自动获得浏览权。owner 和 admin 始终有全部权限，无需加入。</div>
    </Modal>
  )
}
