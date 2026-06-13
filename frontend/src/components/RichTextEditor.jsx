import { useEffect, useRef } from 'react'
import { createEditor, createToolbar } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'

/**
 * wangEditor 富文本编辑器的轻封装。
 * 用框架无关的核心包 @wangeditor/editor（不依赖 editor-for-react，避免它对 React 版本的 peer 冲突）。
 * 受控用法：value = HTML 字符串，onChange(html) 回写；uploadImage(file) => url 自定义插图上传。
 */
export default function RichTextEditor({ value, onChange, uploadImage, placeholder = '请输入正文…' }) {
  const editorRef = useRef(null)
  const toolbarElRef = useRef(null)
  const editorElRef = useRef(null)
  // 用 ref 持有最新回调：让下面的 effect 只在挂载时建一次编辑器，回调变化不重建
  const onChangeRef = useRef(onChange)
  const uploadRef = useRef(uploadImage)
  onChangeRef.current = onChange
  uploadRef.current = uploadImage

  useEffect(() => {
    const editor = createEditor({
      selector: editorElRef.current,
      html: value || '<p><br></p>',
      config: {
        placeholder,
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

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
      <div ref={toolbarElRef} style={{ borderBottom: '1px solid #e8e8e8' }} />
      <div ref={editorElRef} style={{ height: 400, overflowY: 'auto' }} />
    </div>
  )
}
