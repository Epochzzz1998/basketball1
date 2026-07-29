import { Component } from 'react'
import { Button, Typography } from 'antd'
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons'

const { Paragraph } = Typography

/**
 * 页面级错误边界。
 *
 * 为什么要自己写一个：ProLayout 内部用了 @ant-design/pro-utils 的 ErrorBoundary，
 * 它只显示 `error.message`（就是那句 "Something went wrong." 加一行报错文本）。
 * 而线上代码是压缩过的，`undefined is not an object (evaluating 'a.length')` 里的 `a`
 * 是压缩器随机分配的名字，**据此完全定位不到源码**——只能靠猜，猜错就得再来一轮。
 *
 * 这个边界多做三件事：
 *  1. 显示 `error.stack` 的前几帧（含 `index-xxx.js:行:列`）——配合构建时生成的
 *     source map 就能反查出原始文件与行号；
 *  2. 一键复制，方便直接贴出来；
 *  3. 同时 `console.error` 一份，接了远程日志之后可以直接上报。
 *
 * source map **只在本地保留、不随 jar 部署**（打包前会删掉 static 里的 .map），
 * 所以不会暴露源码。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, stack: '', resetKey: props.resetKey }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  /**
   * 换了一页就把错误状态清掉。
   *
   * **为什么不是给这个组件挂 `key={pathname}`。** 那样确实能重置，但代价是
   * 每次路由变化整棵子树都被卸载重建——包括那些"地址变了、页面其实没变"的场景。
   * NBA 分区就是典型：`/news/topic/x/nba/league` → `.../nba/players` 只是换了内容区，
   * 横幅和标签条本该原地不动，结果整个专题页被重建，重新拉一次 `/topic/get`、
   * 闪一下满屏的 loading——**看起来就像整页刷新了一次**。
   *
   * 改成比对 resetKey：地址变了就清错误，但 children 不换 key，该保留的组件继续活着。
   */
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, stack: '', resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error, info) {
    // 组件栈在生产构建里多半也被压缩过，但和 error.stack 互为佐证，一起留着
    const stack = [error?.stack, info?.componentStack].filter(Boolean).join('\n---\n')
    this.setState({ stack })
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    const { error, stack } = this.state
    if (!error) return this.props.children

    const detail = `${error.message || error}\n\n${stack}`.slice(0, 4000)
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>这个页面出错了</div>
        <div style={{ color: '#cf1322', fontSize: 14, marginBottom: 16, wordBreak: 'break-word' }}>
          {String(error.message || error)}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新重试
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() => navigator.clipboard?.writeText(detail)}
          >
            复制错误详情
          </Button>
        </div>

        {/* 手机上看不到控制台，堆栈必须直接摆在页面上，否则等于没有 */}
        <Paragraph>
          <pre
            style={{
              background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8,
              padding: 12, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              wordBreak: 'break-all', maxHeight: 360, overflow: 'auto', margin: 0,
            }}
          >
            {detail}
          </pre>
        </Paragraph>
      </div>
    )
  }
}
