/**
 * 「有帖子发出来 / 改过了」的一声招呼。
 *
 * ## 为什么需要
 *
 * 发帖器是**盖在列表上的浮层**（背景路由，见 App.jsx 的 composerBackground）。
 * 发完 `navigate(-1)` 只是把浮层收起来，底下的列表组件从头到尾没有卸载过，
 * 它那个 `useEffect` 的依赖也没变，于是不会重新拉数据——刚发的帖子要手动
 * 下拉刷新一次才出得来。编辑已有帖子回到详情页是同一回事。
 *
 * ## 为什么不用 context
 *
 * 只有一个生产者（发帖器）和两个消费者（列表、详情），而它们之间隔着一整棵路由树。
 * 为这件事铺一层 Provider，收益还不如这十行。
 */
const KEY = 'epoch:post-published'

export const notifyPostPublished = () => {
  window.dispatchEvent(new Event(KEY))
}

/** 订阅，返回退订函数（正好可以直接 return 给 useEffect） */
export const onPostPublished = (fn) => {
  window.addEventListener(KEY, fn)
  return () => window.removeEventListener(KEY, fn)
}
