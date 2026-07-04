import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from 'antd'
import { Boot, createEditor, createToolbar } from '@wangeditor/editor'
import mentionModule from '@wangeditor/plugin-mention'
import '@wangeditor/editor/dist/css/style.css'

/**
 * wangEditor 富文本编辑器的轻封装。
 * 用框架无关的核心包 @wangeditor/editor（不依赖 editor-for-react，避免它对 React 版本的 peer 冲突）。
 * 受控用法：value = HTML 字符串，onChange(html) 回写；uploadImage(file) => url 自定义插图上传。
 *
 * @-mention（可选）：传 mentionSearch(keyword) => [{id,name,avatar}] 即开启。
 * 打 `@` 时插件回调 showModal，我们在光标处自绘候选面板（MentionPanel）；选中后插入
 * mention 节点，序列化成 <span data-w-e-type="mention" data-info="{id}">@名字</span>，
 * id 就藏在 data-info 里——后端据此发通知，详情页据此渲染成可点链接。
 */

// mention 插件必须在"创建任何编辑器之前、且只注册一次"（官方要求）。
// 放模块顶层注册；用 window 标记防 Vite HMR 重新求值本模块时重复注册报错。
if (typeof window !== 'undefined' && !window.__wangMentionRegistered) {
  try {
    Boot.registerModule(mentionModule?.default || mentionModule)
  } catch {
    /* 已注册则忽略 */
  }
  window.__wangMentionRegistered = true
}

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

/** 光标处浮出的 @ 候选面板：自带搜索输入 + 键盘上下/回车选择，点选回调 onPick */
function MentionPanel({ top, left, search, onPick, onClose }) {
  const [kw, setKw] = useState('')
  const [opts, setOpts] = useState([])
  const [active, setActive] = useState(0)
  const timerRef = useRef()
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const list = await search(kw)
        setOpts(list || [])
        setActive(0)
      } catch {
        setOpts([])
      }
    }, 200)
    return () => clearTimeout(timerRef.current)
  }, [kw, search])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(opts.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (opts[active]) onPick(opts[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', top, left, zIndex: 2000, width: 244, background: '#fff', borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,.16)', border: '1px solid #f0f0f0', overflow: 'hidden',
      }}
      // 阻止面板抢焦点导致编辑器选区丢失
      onMouseDown={(e) => e.preventDefault()}
    >
      <input
        ref={inputRef}
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="搜索用户…"
        style={{ width: '100%', border: 'none', outline: 'none', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13, boxSizing: 'border-box' }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {opts.length ? (
          opts.map((u, i) => (
            <div
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); onPick(u) }}
              onMouseEnter={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: i === active ? 'rgba(250,84,28,.08)' : 'transparent' }}
            >
              {u.avatar ? (
                <Avatar size={22} src={u.avatar} />
              ) : (
                <Avatar size={22} style={{ background: avatarColor(u.name), fontSize: 12 }}>
                  {String(u.name || '?')[0].toUpperCase()}
                </Avatar>
              )}
              <span style={{ fontSize: 13 }}>{u.name}</span>
            </div>
          ))
        ) : (
          <div style={{ padding: 14, color: '#bbb', fontSize: 13, textAlign: 'center' }}>无匹配用户</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default function RichTextEditor({ value, onChange, uploadImage, mentionSearch, placeholder = '请输入正文…' }) {
  const editorRef = useRef(null)
  const toolbarElRef = useRef(null)
  const editorElRef = useRef(null)
  // 用 ref 持有最新回调：让下面的 effect 只在挂载时建一次编辑器，回调变化不重建
  const onChangeRef = useRef(onChange)
  const uploadRef = useRef(uploadImage)
  const mentionSearchRef = useRef(mentionSearch)
  onChangeRef.current = onChange
  uploadRef.current = uploadImage
  mentionSearchRef.current = mentionSearch

  const [mentionPos, setMentionPos] = useState(null) // { top, left } 或 null

  useEffect(() => {
    const editor = createEditor({
      selector: editorElRef.current,
      html: value || '<p><br></p>',
      config: {
        placeholder,
        // mention 插件全局注册后，任何编辑器打 `@` 都会回调 mentionConfig.showModal；
        // 这里始终提供该配置（缺失会让插件解构报错），showModal 内再按有没有 mentionSearch 决定是否开面板
        EXTEND_CONF: {
          mentionConfig: {
            showModal: () => {
              if (!mentionSearchRef.current) return
              const sel = window.getSelection()
              let rect = null
              if (sel && sel.rangeCount > 0) rect = sel.getRangeAt(0).getBoundingClientRect()
              // 折叠选区在部分浏览器返回全 0 的 rect，退回编辑区左上角定位
              if (!rect || (rect.top === 0 && rect.bottom === 0)) {
                rect = editorElRef.current?.getBoundingClientRect() || null
              }
              const top = Math.min((rect ? rect.bottom : 200) + 4, window.innerHeight - 300)
              const left = Math.min(rect ? rect.left : 200, window.innerWidth - 264)
              setMentionPos({ top: Math.max(8, top), left: Math.max(8, left) })
            },
            hideModal: () => setMentionPos(null),
          },
        },
        MENU_CONF: {
          uploadImage: {
            // 自定义上传：把文件交给后端，拿回 URL 后用 insertFn 插入 <img>
            async customUpload(file, insertFn) {
              const url = await uploadRef.current?.(file)
              if (url) insertFn(url, '', url)
            },
          },
        },
        onChange: (ed) => onChangeRef.current?.(ed.getHtml()),
      },
      mode: 'default',
    })
    createToolbar({ editor, selector: toolbarElRef.current, mode: 'default' })
    editorRef.current = editor
    return () => {
      editor.destroy()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部异步把 value 灌进来（编辑模式加载到正文）时同步一次；
  // 比对 getHtml 避免覆盖正在输入的内容、以及无谓的光标跳动
  useEffect(() => {
    const editor = editorRef.current
    if (editor && value != null && value !== editor.getHtml()) {
      editor.setHtml(value || '<p><br></p>')
    }
  }, [value])

  // 面板搜索：把后端 [{userId,userNickname,avatar}] 规约成 {id,name,avatar}
  const panelSearch = async (kw) => {
    const list = await mentionSearchRef.current?.(kw)
    return list || []
  }

  // 选中一个人：删掉刚打的 `@`，插入 mention 节点（id 进 data-info），关面板，焦点回编辑器
  const pickMention = (user) => {
    const editor = editorRef.current
    if (editor) {
      editor.restoreSelection()
      editor.deleteBackward('character')
      editor.insertNode({ type: 'mention', value: user.name, info: { id: user.id }, children: [{ text: '' }] })
      editor.move(1)
      editor.focus()
    }
    setMentionPos(null)
  }

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
      <div ref={toolbarElRef} style={{ borderBottom: '1px solid #e8e8e8' }} />
      <div ref={editorElRef} style={{ height: 400, overflowY: 'auto' }} />
      {mentionPos && (
        <MentionPanel
          top={mentionPos.top}
          left={mentionPos.left}
          search={panelSearch}
          onPick={pickMention}
          onClose={() => setMentionPos(null)}
        />
      )}
    </div>
  )
}
