import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Input, Modal, Popconfirm, Spin, Upload, message } from 'antd'
import {
  ArrowLeftOutlined, DeleteOutlined, EditOutlined, FileImageOutlined, FileOutlined,
  FilePdfOutlined, FileTextOutlined, FileZipOutlined, FolderAddOutlined, FolderFilled,
  UploadOutlined,
} from '@ant-design/icons'
import { topicApi } from '../../api/topic'
import { topicFileApi } from '../../api/topicFile'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'

/**
 * 专题文件页（/news/topic/:topicId/files）。
 *
 * 一张卡：面包屑在头上，文件夹和文件混排在一列里（文件夹在前，后端排好）。
 * 当前文件夹写进 URL（?folder=）——刷新、直链、返回都落回同一层，
 * 面包屑的路径由后端沿 PARENT_ID 爬好一起返回，前端不用自己记进来的路。
 *
 * 权限跟着接口走：canManage（题主/小题主/超管）才看得到上传/建文件夹/改名/删除。
 * 普通成员就是个只读的资料柜——点文件夹进去，点文件下载。
 */

const BRAND = '#fa541c'

const fmtSize = (n) => {
  const v = Number(n)
  if (!v) return ''
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  return `${(v / 1024 / 1024).toFixed(1)} MB`
}

const fmtDate = (v) => {
  if (!v) return ''
  const t = new Date(v)
  if (Number.isNaN(t.getTime())) return ''
  const p = (x) => String(x).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}

/** 扩展名 → 图标。分四类就够了：图 / pdf / 文本表格 / 压缩包，其余给通用文件 */
const fileIcon = (name) => {
  const ext = String(name || '').split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return <FileImageOutlined style={{ color: '#4a8fe0' }} />
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#e5533d' }} />
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md'].includes(ext)) return <FileTextOutlined style={{ color: '#52a35a' }} />
  if (['zip', 'rar', '7z'].includes(ext)) return <FileZipOutlined style={{ color: '#b58a2f' }} />
  return <FileOutlined style={{ color: '#8c8c8c' }} />
}

export default function TopicFilesPage() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [folder, setFolder] = useUrlState('folder', '')
  const [topicName, setTopicName] = useState('')
  const [data, setData] = useState(null)          // { files, path, canManage } | null=加载中
  const [denied, setDenied] = useState('')        // 非空 = 后端拒绝的理由，整页换提示
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [mkdirName, setMkdirName] = useState('')
  const [renameAt, setRenameAt] = useState(null)  // {fileId, name} | null
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    topicApi.get(topicId).then((t) => setTopicName(t?.name || '')).catch(() => {})
  }, [topicId])

  const load = useCallback(() => {
    topicFileApi.list(topicId, folder || undefined)
      .then((d) => { setData(d || { files: [], path: [], canManage: false }); setDenied('') })
      .catch((e) => setDenied(e?.message || '加载失败'))
  }, [topicId, folder])

  useEffect(() => { setData(null); load() }, [load])

  const run = async (fn, done) => {
    setBusy(true)
    try {
      await fn()
      if (done) done()
      load()
    } catch { /* 接口层已 toast */ } finally {
      setBusy(false)
    }
  }

  const canManage = !!data?.canManage
  const crumbs = data?.path || []

  return (
    <Card
      style={{ borderRadius: 14 }}
      styles={{ body: { padding: isMobile ? '4px 0 10px' : '4px 8px 12px' } }}
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* 返回：面包屑在根目录时回专题，在子目录时回上一层——和文件管理器的习惯一致 */}
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (crumbs.length) setFolder(crumbs.length > 1 ? crumbs[crumbs.length - 2].fileId : '')
              else navigate(`/news/topic/${topicId}`)
            }}
            style={{ flexShrink: 0 }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Link to={`/news/topic/${topicId}`} style={{ color: 'inherit' }}>{topicName || '专题'}</Link>
            <span style={{ color: '#bbb', margin: '0 6px' }}>/</span>
            <span onClick={() => setFolder('')} style={{ cursor: 'pointer', color: crumbs.length ? BRAND : 'inherit' }}>文件</span>
            {crumbs.map((c, i) => (
              <span key={c.fileId}>
                <span style={{ color: '#bbb', margin: '0 6px' }}>/</span>
                <span
                  onClick={() => i < crumbs.length - 1 && setFolder(c.fileId)}
                  style={i < crumbs.length - 1 ? { cursor: 'pointer', color: BRAND } : {}}
                >
                  {c.name}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
      extra={canManage && (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button size="small" icon={<FolderAddOutlined />} onClick={() => { setMkdirName(''); setMkdirOpen(true) }}>
            {isMobile ? '' : '新建文件夹'}
          </Button>
          <Upload
            showUploadList={false}
            multiple
            customRequest={async ({ file, onSuccess, onError }) => {
              setUploading(true)
              try {
                await topicFileApi.upload(file, topicId, folder || undefined)
                onSuccess()
                load()
              } catch (e) { onError(e) } finally { setUploading(false) }
            }}
          >
            <Button size="small" type="primary" icon={<UploadOutlined />} loading={uploading} style={{ background: BRAND }}>
              {isMobile ? '' : '上传文件'}
            </Button>
          </Upload>
        </span>
      )}
    >
      {denied ? (
        <Empty description={denied} style={{ padding: 40 }} />
      ) : data === null ? (
        <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>
      ) : data.files.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={canManage ? '空的，点右上角传点什么' : '这里还什么都没有'}
          style={{ padding: 36 }}
        />
      ) : (
        data.files.map((f) => (
          <div
            key={f.fileId}
            onClick={() => (f.kind === 'folder' ? setFolder(f.fileId) : window.open(f.url, '_blank'))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              borderBottom: '1px solid #f7f7f7', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 0, flexShrink: 0 }}>
              {f.kind === 'folder' ? <FolderFilled style={{ color: '#f7c948' }} /> : fileIcon(f.name)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: f.kind === 'folder' ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </div>
              <div style={{ color: '#bbb', fontSize: 12 }}>
                {[fmtSize(f.size), fmtDate(f.createTime), f.uploaderName].filter(Boolean).join(' · ')}
              </div>
            </span>
            {canManage && (
              // 行内管理钮要 stopPropagation：整行是"打开"，别让改名点成进入文件夹
              <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, display: 'inline-flex', gap: 2 }}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setRenameAt({ fileId: f.fileId, name: f.name })} />
                <Popconfirm
                  title={f.kind === 'folder' ? '删除文件夹？里面的东西会一起删掉' : '删除这个文件？'}
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => run(() => topicFileApi.remove(f.fileId), () => message.success('已删除'))}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            )}
          </div>
        ))
      )}

      <Modal
        title="新建文件夹"
        open={mkdirOpen}
        onCancel={() => setMkdirOpen(false)}
        confirmLoading={busy}
        okText="创建"
        onOk={() => {
          if (!mkdirName.trim()) return
          run(() => topicFileApi.mkdir(topicId, folder || undefined, mkdirName.trim()),
            () => { setMkdirOpen(false); message.success('已创建') })
        }}
      >
        <Input
          value={mkdirName}
          onChange={(e) => setMkdirName(e.target.value)}
          placeholder="文件夹名"
          maxLength={80}
          autoFocus
          onPressEnter={() => {
            if (!mkdirName.trim()) return
            run(() => topicFileApi.mkdir(topicId, folder || undefined, mkdirName.trim()),
              () => { setMkdirOpen(false); message.success('已创建') })
          }}
        />
      </Modal>

      <Modal
        title="重命名"
        open={!!renameAt}
        onCancel={() => setRenameAt(null)}
        confirmLoading={busy}
        okText="保存"
        onOk={() => {
          if (!renameAt?.name?.trim()) return
          run(() => topicFileApi.rename(renameAt.fileId, renameAt.name.trim()),
            () => { setRenameAt(null); message.success('已改名') })
        }}
      >
        <Input
          value={renameAt?.name || ''}
          onChange={(e) => setRenameAt((r) => ({ ...r, name: e.target.value }))}
          maxLength={80}
          autoFocus
        />
      </Modal>
    </Card>
  )
}
