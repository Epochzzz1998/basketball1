import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Card, Empty, Modal, Popconfirm, Select, Spin, Tag, message } from 'antd'
import { CrownFilled, FireOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { bbqApi } from '../../api/bbq'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 耿阿姨烤串 · 成员管理（店长专属）。
 * - 添加店员：只能从「关注我的人」里选（关注是入职门槛，之后取关不影响成员身份）；
 * - 店长可提拔店员为店长；解除店长只有超管能做（在用户管理里）；
 * - 移除店员不动工资历史，之后还能再加回来。
 */

const AMBER = '#d48806'
const AMBER_DARK = '#ad6800'

export default function BbqMembers() {
  const { user, dn } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [picked, setPicked] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    bbqApi.staffList().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setPicked(null)
    setAddOpen(true)
    bbqApi.candidates().then((r) => setCandidates(Array.isArray(r) ? r : [])).catch(() => setCandidates([]))
  }

  const doAdd = async () => {
    if (!picked) return message.info('先选一个人')
    setAdding(true)
    try {
      await bbqApi.addStaff(picked)
      message.success('已添加为店员')
      setAddOpen(false)
      load()
    } catch { /* 已提示 */ } finally { setAdding(false) }
  }

  const doPromote = async (r) => {
    try { await bbqApi.promote(r.userId); message.success('已提拔为店长'); load() } catch { /* 已提示 */ }
  }

  const doRemove = async (r) => {
    try { await bbqApi.removeStaff(r.userId); message.success('已移除'); load() } catch { /* 已提示 */ }
  }

  const ring = (size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.16)', ...pos })

  return (
    <>
      {/* 横幅：炭火琥珀 */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '22px 28px', marginBottom: 16,
          background: 'linear-gradient(120deg, #613400 0%, #ad6800 55%, #d48806 100%)',
        }}
      >
        <div style={ring(170, { top: -70, right: 100 })} />
        <div style={ring(110, { bottom: -45, right: 260 })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
              <FireOutlined style={{ marginRight: 8 }} />耿阿姨烤串 · 成员管理
            </div>
            <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
              店长共管全店账本；店员只能查看自己的薪资。只能添加关注你的人。
            </div>
          </div>
          <Button icon={<PlusOutlined />} onClick={openAdd} style={{ fontWeight: 600 }}>添加店员</Button>
        </div>
      </div>

      <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? '10px 12px' : '14px 18px' } }}>
        {rows === null ? (
          <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
        ) : rows.length === 0 ? (
          <Empty description="还没有成员，点右上角「添加店员」" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => {
              const isManager = r.role === 'manager'
              return (
                <div
                  key={r.userId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 6px',
                    borderTop: i === 0 ? 'none' : '1px solid #f5f5f5', flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}
                >
                  {/* 点头像进 TA 的个人主页 */}
                  <Avatar
                    size={40}
                    src={r.avatar || undefined}
                    icon={r.avatar ? undefined : <UserOutlined />}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    title="进入个人主页"
                    onClick={() => navigate(`/users/${r.userId}`)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* 名字同头像：点了进 TA 的个人主页 */}
                      <span
                        style={{ fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                        title="进入个人主页"
                        onClick={() => navigate(`/users/${r.userId}`)}
                      >
                        {dn(r.userId, r.userNickname)}
                      </span>
                      {isManager
                        ? <Tag color="gold" style={{ marginInlineEnd: 0 }}><CrownFilled /> 店长</Tag>
                        : <Tag style={{ marginInlineEnd: 0 }}>店员</Tag>}
                      {r.userId === user?.userId && <Tag color="blue" style={{ marginInlineEnd: 0 }}>我</Tag>}
                    </div>
                    <div style={{ color: '#999', fontSize: 12, marginTop: 3 }}>
                      {r.addedByName ? `${r.addedByName} 添加` : '—'} · {r.addTime ? dayjs(r.addTime).format('YYYY-MM-DD') : '—'}
                      {/* 整体不换行，防止移动端把"最近时薪"从中间拆行 */}
                      {r.lastRate != null && <span style={{ marginLeft: 8, color: AMBER_DARK, whiteSpace: 'nowrap', display: 'inline-block' }}>最近时薪 ${Number(r.lastRate).toFixed(2)}</span>}
                    </div>
                  </div>
                  {!isManager && (
                    <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Popconfirm title={`提拔 ${dn(r.userId, r.userNickname)} 为店长？`} description="店长共管全店账本，解除只能由超管操作" onConfirm={() => doPromote(r)} okText="提拔" cancelText="取消">
                        <Button size="small" style={{ color: AMBER, borderColor: `${AMBER}88` }}>提拔为店长</Button>
                      </Popconfirm>
                      <Popconfirm title={`移除 ${dn(r.userId, r.userNickname)}？`} description="工资历史保留，之后可再添加" onConfirm={() => doRemove(r)} okText="移除" cancelText="取消">
                        <Button size="small" danger>移除</Button>
                      </Popconfirm>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        title="添加店员"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={doAdd}
        okText="添加"
        cancelText="取消"
        confirmLoading={adding}
        destroyOnClose
      >
        <div style={{ color: '#999', fontSize: 13, marginBottom: 10 }}>
          只能添加<b>关注你</b>的用户。让对方先到你的主页点关注，这里就能选到 TA。
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="选择要添加的人"
          value={picked}
          onChange={setPicked}
          showSearch
          optionFilterProp="label"
          options={candidates.map((c) => ({ value: c.userId, label: dn(c.userId, c.userNickname) }))}
          notFoundContent="没有可添加的人（关注你的人都已在店里）"
        />
      </Modal>
    </>
  )
}
