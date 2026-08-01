import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Input, Modal, Popconfirm, Spin, Upload, message } from 'antd'
import {
  ArrowLeftOutlined, DeleteOutlined, EditOutlined, FileImageOutlined, FileOutlined,
  FilePdfOutlined, FileTextOutlined, FileZipOutlined, FolderAddOutlined, FolderFilled,
  FolderOpenOutlined, UploadOutlined,
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

  /**
   * 批量上传的编排器。「选多个文件」和「选整个文件夹」都走这一条——
   * 区别只在有没有相对路径（webkitRelativePath）。
   *
   * 有路径时先把目录树建出来：收集全部中间目录、按深度排序、逐段 mkdir。
   * mkdir 是幂等的（同名同父直接返回已有的 id，见后端），所以同一段被
   * 两个文件共享也只会长出一个夹。**必须串行**：并发建同一个夹就算后端幂等，
   * 两个请求同时都查不到也会插两行。
   *
   * 文件本身也串行传。并发能快一点，但这里单文件最大 30MB，
   * 并发几个大文件会把手机的上行挤死，进度数字也会跳来跳去。
   */
  const uploadBatch = async (items) => {
    // items: [{ file, rel }]。rel 带 '/' 就按路径建目录；来源有三个——
    // 多选文件（rel=文件名）、目录选择器（rel=webkitRelativePath）、拖拽（rel=自己走出来的）
    setUploading(true)
    const key = 'topicfs-upload'
    let ok = 0
    const fails = []
    try {
      const dirIds = { '': folder || undefined }
      const dirs = new Set()
      items.forEach(({ rel }) => {
        const parts = rel.split('/')
        for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
      })
      const ordered = [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)
      for (const d of ordered) {
        const parent = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : ''
        message.loading({ content: `建目录 ${d}…`, key, duration: 0 })
        const r = await topicFileApi.mkdir(topicId, dirIds[parent], d.split('/').pop())
        if (!r?.fileId) throw new Error(`目录 ${d} 创建失败`)
        dirIds[d] = r.fileId
      }
      for (const { file, rel } of items) {
        const parent = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
        message.loading({ content: `上传中 ${ok + fails.length + 1}/${items.length}…`, key, duration: 0 })
        try {
          await topicFileApi.upload(file, topicId, dirIds[parent])
          ok += 1
        } catch {
          // 单个失败不中断：一批里夹着一个超限的，剩下的照传
          fails.push(rel)
        }
      }
      if (fails.length) {
        message.warning({
          content: `${ok} 个成功，${fails.length} 个失败（类型不支持或超 30MB）：${fails.slice(0, 3).join('、')}${fails.length > 3 ? '…' : ''}`,
          key, duration: 6,
        })
      } else {
        message.success({ content: `已上传 ${ok} 个文件`, key })
      }
      load()
    } catch (e) {
      message.error({ content: e?.message || '上传失败', key })
      load()
    } finally {
      setUploading(false)
    }
  }

  /** antd 对一批里的每个文件各调一次 beforeUpload；只在第一个上编排整批，其余直接吞掉 */
  const interceptBatch = (withPaths) => (file, list) => {
    if (file.uid === list[0].uid) {
      uploadBatch(list.map((f) => ({
        file: f,
        rel: withPaths ? String(f.webkitRelativePath || f.name) : f.name,
      })))
    }
    return false
  }

  /**
   * 拖拽上传：把文件或整个文件夹拖进列表区。
   *
   * 文件夹要靠 `webkitGetAsEntry` 递归展开——DataTransfer.files 只会给顶层文件，
   * 目录在里面是个空壳。`readEntries` 一次最多吐 100 项，必须循环读到空，
   * 否则超过 100 个文件的文件夹会静默截断。
   */
  const walkEntry = async (entry, prefix) => {
    if (entry.isFile) {
      const f = await new Promise((res) => entry.file(res, () => res(null)))
      return f ? [{ file: f, rel: prefix + f.name }] : []
    }
    if (!entry.isDirectory) return []
    const reader = entry.createReader()
    const out = []
    for (;;) {
      const batch = await new Promise((res) => reader.readEntries(res, () => res([])))
      if (!batch.length) break
      for (const e of batch) out.push(...await walkEntry(e, `${prefix + entry.name}/`))
    }
    return out
  }

  const [dragOver, setDragOver] = useState(false)
  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!canManage || uploading) return
    const items = [...(e.dataTransfer?.items || [])]
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean)
    let collected = []
    if (entries.length) {
      for (const en of entries) collected.push(...await walkEntry(en, ''))
    } else {
      // 老内核没有 entry API：退回平铺文件（拖文件夹在这种内核里本来就拿不到内容）
      collected = [...(e.dataTransfer?.files || [])].map((f) => ({ file: f, rel: f.name }))
    }
    if (collected.length) uploadBatch(collected)
  }

  const canManage = !!data?.canManage
  const crumbs = data?.path || []

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); if (canManage) setDragOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
      onDrop={onDrop}
      style={{ borderRadius: 14, outline: dragOver ? '2px dashed #fa541c' : 'none', outlineOffset: -2 }}
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
          {/* 传整个文件夹：目录结构原样搬进来。只在桌面端给——手机浏览器/套壳 WebView
              没有目录选择器，directory 输入框点了要么没反应要么退化成选单个文件 */}
          {!isMobile && (
            <Upload showUploadList={false} directory beforeUpload={interceptBatch(true)}>
              <Button size="small" icon={<FolderOpenOutlined />} loading={uploading}>传文件夹</Button>
            </Upload>
          )}
          <Upload showUploadList={false} multiple beforeUpload={interceptBatch(false)}>
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
