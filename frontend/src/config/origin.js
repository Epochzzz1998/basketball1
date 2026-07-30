/**
 * 站点地址的唯一来源（阶段 2 · Capacitor 套壳）。
 *
 * ## 问题：套壳之后"相对路径"全都指错了地方
 *
 * 现在整个前端都建立在一个隐含假设上——**页面的源就是后端的源**：
 *
 * ```js
 * axios.create({ baseURL: '' })            // 相对路径，打到当前域名
 * `wss://${window.location.host}/ws`       // 当前域名
 * <img src="/picImg/xxx.jpg">              // 当前域名
 * ```
 *
 * 浏览器里这个假设成立。但套壳之后，**页面是从 App 包里加载的**，
 * 源变成 `capacitor://localhost`（iOS）或 `http://localhost`（安卓）。
 * 于是：
 *
 * | 原来 | 套壳后实际请求 | 结果 |
 * |---|---|---|
 * | `/news/newsListData` | `capacitor://localhost/news/newsListData` | 打到 App 包里，404 |
 * | `wss://当前host/ws` | `wss://localhost/ws` | 连不上 |
 * | `/picImg/xxx.jpg` | `capacitor://localhost/picImg/xxx.jpg` | **所有头像、封面、帖子配图全裂** |
 *
 * 第三条最容易被漏掉，因为它不报错，只是图不出来；而且这些地址
 * **不只在接口字段里，还嵌在每篇帖子的 HTML 正文里**（`<img src="/picImg/...">`），
 * 光改字段是不够的。
 *
 * ## 解法：一个开关 + 两个函数
 *
 * - `API_BASE`：网页端是空串（相对路径，行为一个字节不变），套壳时是站点全地址。
 * - `assetUrl()`：把 `/picImg/...` 这类根相对地址补全。
 * - `absolutizeHtml()`：把一段 HTML 里所有根相对的 `src`/`href` 一起补全。
 *
 * ## 为什么用构建期开关，不用运行时判断
 *
 * `window.Capacitor` 要等原生层注入之后才有，而 `http.js` 里的 axios 实例是
 * **模块加载时就创建好的**——那一刻去问 `window.Capacitor` 可能还没有。
 * 构建期的 `VITE_NATIVE` 没有这个时序问题：网页版和 App 版本来就是两次构建。
 * 运行时那条只作为兜底（万一网页版被塞进了壳里）。
 */

/** 站点地址。App 版打进包里，改域名要重新发版——所以后端域名不能随便动 */
export const SITE_URL = 'https://www.dream-everything.com'

/**
 * 当前是不是"页面不在站点源上"的运行方式。
 *
 * 构建期开关优先（`VITE_NATIVE=1 npm run build`），运行时检测兜底。
 */
export const isNative =
  import.meta.env.VITE_NATIVE === '1' || !!globalThis.Capacitor?.isNativePlatform?.()

/**
 * 接口前缀。
 *
 * 网页端是空串——**这一点很重要**：保持相对路径，Vite 的开发代理才有得代理，
 * 生产环境也不会凭空多出跨域。只有套壳时才变成全地址。
 */
export const API_BASE = isNative ? SITE_URL : ''

/**
 * 把后端返回的地址补全成可以直接用的。
 *
 * 只处理**根相对**（以 `/` 开头）的：那些是后端存进库里的上传文件路径。
 * 已经是 `http(s)://` 或 `data:` 的原样返回——球员照片有的是外链，
 * 验证码是 data URI，都不能动。
 */
export const assetUrl = (u) => {
  if (!u || typeof u !== 'string') return u
  if (!u.startsWith('/') || u.startsWith('//')) return u   // 非根相对，或协议相对，都不碰
  return API_BASE + u
}

/** 上传文件的统一前缀。只补全这一类，见 absolutizeData 的说明 */
const UPLOAD_PREFIX = '/picImg/'

/**
 * 递归把接口响应里的上传文件地址补全。挂在 axios 的响应拦截器上。
 *
 * **为什么在这一层做**：上传地址散落在头像、专题背景图、球员照片、帖子封面、
 * 评论附件…十几个字段里，逐个页面去改必然漏掉一两个，而且以后新加字段还会再漏一次。
 * 在响应出口处统一处理，等于一次覆盖全部、包括还没写出来的。
 *
 * **为什么只认 `/picImg/` 而不是所有以 `/` 开头的串**：响应里也有大量
 * **前端路由**（`/news/xxx`、`/users/xxx`）——那些是给 react-router 用的，
 * 补成全地址会让站内跳转变成打开外部链接，整个导航都废掉。
 * 上传文件全部在 `/picImg/` 下，这个前缀是精确的判据。
 *
 * 网页端 `API_BASE` 是空串，直接原样返回，一点开销不加。
 */
export const absolutizeData = (v) => {
  if (!API_BASE) return v
  if (typeof v === 'string') {
    return v.startsWith(UPLOAD_PREFIX) ? API_BASE + v : v
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) v[i] = absolutizeData(v[i])
    return v
  }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) v[k] = absolutizeData(v[k])
    return v
  }
  return v
}

/**
 * `absolutizeData` 的反向操作：把请求里的站内上传地址还原成根相对。挂在 axios 的请求拦截器上。
 *
 * ## 为什么必须有这一步
 *
 * 补全过的地址会**原路返回给后端**，而后端只认根相对：
 *
 * ```
 * 上传 → 后端返回 /picImg/pm-x/a.png
 *      → 响应拦截器补成 https://站点/picImg/pm-x/a.png（不补图就不显示）
 *      → 存进待发送附件，随 /pm/send 发回去
 *      → 后端 isLocalUploadUrl() 判 startsWith("/picImg/") → 假
 *      → 附件被当成外链整个丢掉 → "内容不能为空"
 * ```
 *
 * 网页端 `API_BASE` 是空串、补全本身是空操作，所以这个坑**只在 App 里踩得到**，
 * 而且报的错完全指错方向（说你没填内容，其实是附件被拒了）。
 *
 * 涉及的不止私信：发帖插图、评论附件、群聊附件、头像、专题背景图、球员照片，
 * 凡是"先上传拿地址、再把地址交回后端"的流程都是同一个形状。所以修在请求出口，
 * 和响应出口的 `absolutizeData` 正好对称，一次覆盖全部、包括以后新写的。
 *
 * ## 和 absolutizeData 不是严格镜像
 *
 * 补全时只认**整个值就是** `/picImg/...` 的字符串；还原时要替换**串里任何位置**的出现。
 * 因为帖子正文是一段 HTML，地址嵌在 `<img src="…">` 里面——
 * 在 App 里插的图，编辑器拿到的就是补全后的绝对地址，存库时必须还原回来，
 * 否则库里会混进一批带域名的地址（换域名就全裂）。
 */
export const relativizeData = (v) => {
  if (!API_BASE) return v
  const abs = API_BASE + UPLOAD_PREFIX
  if (typeof v === 'string') {
    return v.includes(abs) ? v.split(abs).join(UPLOAD_PREFIX) : v
  }
  // 本站的 POST 大多是表单体（URLSearchParams），值就地改写
  if (typeof URLSearchParams !== 'undefined' && v instanceof URLSearchParams) {
    for (const k of [...v.keys()]) {
      const cur = v.getAll(k)
      const next = cur.map((s) => relativizeData(s))
      if (next.some((s, i) => s !== cur[i])) {
        v.delete(k)
        next.forEach((s) => v.append(k, s))
      }
    }
    return v
  }
  // FormData 里装的是文件本身，没有地址可还原；碰它反而有把 File 变成字符串的风险
  if (typeof FormData !== 'undefined' && v instanceof FormData) return v
  if (Array.isArray(v)) return v.map(relativizeData)
  if (v && typeof v === 'object') {
    // 不就地改写：请求体是调用方的对象，改了它等于偷偷动别人的 state
    const out = {}
    for (const k of Object.keys(v)) out[k] = relativizeData(v[k])
    return out
  }
  return v
}

/**
 * 把一段 HTML 里的根相对地址整体补全。
 *
 * 用在帖子正文上：正文是用户发的富文本，里面的 `<img src="/picImg/...">`
 * 是发帖时编辑器插进去的，存库时就是相对路径。
 *
 * **用 DOM 解析而不是正则替换**：正则要正确处理引号、转义、属性顺序、
 * 以及 `srcset` 那种逗号分隔的多值，写对很难而且改一次坏一次。
 * 这里 HTML 已经过 DOMPurify 净化，用 `DOMParser` 再解一遍是安全的，
 * 而且浏览器的解析器天然处理了上面全部情况。
 *
 * 网页端直接原样返回，一点开销都不加。
 */
export const absolutizeHtml = (html) => {
  if (!html || !API_BASE) return html
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('[src], [href]').forEach((el) => {
      for (const attr of ['src', 'href']) {
        const v = el.getAttribute(attr)
        if (v && v.startsWith('/') && !v.startsWith('//')) {
          el.setAttribute(attr, API_BASE + v)
        }
      }
    })
    return doc.body.innerHTML
  } catch {
    return html   // 解析失败就用原文：图不出来是小事，正文整段不见是大事
  }
}
