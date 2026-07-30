import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Input, List, Popconfirm, Space, Spin, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 绑定 Riot 账号。
 *
 * ## 为什么要绑，明明不绑也查得到
 *
 * Riot 的公开接口本来就能查任何人（知道 `名字#后缀` 就行，不需要对方授权），
 * 所以绑定在技术上不是必需的。它解决的是另外两件事：
 *
 * 1. **把游戏账号对上站内的人**。不绑的话榜上只能显示一串游戏 ID，
 *    而这个模块的全部意义是「我们几个之间」的比较。
 * 2. **绑定这个动作本身就是同意**。这里会出「谁在的时候队伍胜率最低」这类榜，
 *    没有当事人点过头，迟早出事。
 *
 * 也正因为不需要 Riot 授权，绑定就是填一个字符串——不用跳转、不用 OAuth。
 * 参与成本低到不需要说服，这是这个模块能活下来的前提。
 */
export default function LolBind() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)
  const [riotId, setRiotId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    lolApi.accounts()
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
  }, [])

  useEffect(() => { load() }, [load])

  const add = () => {
    const v = riotId.trim()
    if (!v) return
    setSaving(true)
    lolApi.bind(v)
      .then(() => {
        message.success('绑定成功，历史战绩正在后台拉取，几分钟后回来看')
        setRiotId('')
        load()
      })
      // 失败提示由 http 拦截器统一弹出（后端已经把 Riot 的 404 翻译成人话了）
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  const remove = (accountId) => {
    lolApi.unbind(accountId)
      .then(() => { message.success('已解绑'); load() })
      .catch(() => {})
  }

  return (
    <Card
      title="绑定游戏账号"
      style={{ borderRadius: 16 }}
      styles={{ body: { padding: isMobile ? 16 : 24 } }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="绑定之后，你的对局会自动进榜"
        description={
          <>
            填游戏里的完整 Riot ID，形如 <Tag style={{ margin: '0 2px' }}>Epoch#3113</Tag>
            （名字后面那串在客户端的个人资料里能看到）。
            <br />
            绑定后会自动补最近 100 场，之后每几分钟同步一次新的对局，不用管它。
            <br />
            解绑会**连同你的对局记录一起删掉**，随时可以解。
          </>
        }
      />

      <Space.Compact style={{ width: '100%', maxWidth: 420, marginBottom: 20 }}>
        <Input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          onPressEnter={add}
          placeholder="Epoch#3113"
          style={{ height: 34, borderRadius: '17px 0 0 17px', background: '#f5f5f5' }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={saving}
          onClick={add}
          style={{ height: 34, borderRadius: '0 17px 17px 0' }}
        >
          绑定
        </Button>
      </Space.Compact>

      {rows === null ? (
        <Spin style={{ display: 'block', margin: '30px auto' }} />
      ) : rows.length === 0 ? (
        <Empty description="还没绑定任何账号" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={rows}
          renderItem={(a) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="解绑这个账号？"
                  description="这个号的对局记录会一起删掉"
                  okText="解绑"
                  cancelText="算了"
                  onConfirm={() => remove(a.accountId)}
                >
                  <Button type="link" danger size="small">解绑</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <span style={{ fontWeight: 700 }}>
                    {a.gameName}
                    <span style={{ color: '#aaa', fontWeight: 400 }}>#{a.tagLine}</span>
                  </span>
                }
                description={
                  <Space size={6} wrap>
                    <Tag color="blue">{String(a.platform || '').toUpperCase()}</Tag>
                    {/* 回填没跑完时说一声，否则用户会以为「绑了但没数据」是坏了 */}
                    {a.backfilled === '1'
                      ? <span style={{ color: '#999', fontSize: 12 }}>历史已补齐</span>
                      : <Tag color="orange">正在补历史…</Tag>}
                    {a.lastError && <Tag color="red">同步异常</Tag>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
