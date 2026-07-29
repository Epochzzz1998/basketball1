import UIKit
import Capacitor

/**
 * Capacitor 桥接控制器的子类，只做 Capacitor 没有暴露成配置项的那几件事。
 *
 * ## 为什么必须写原生代码
 *
 * `capacitor.config.json` 能配的 iOS 选项是固定的一小组（`contentInset`、`scrollEnabled`、
 * `backgroundColor` 等）。下面这两个属性在 WKWebView 上，但 Capacitor 没有把它们
 * 接出来成配置，所以只能自己继承一层。
 *
 * 改动只有两行，但都是"iOS 用户觉得理所当然、缺了就觉得这 App 很怪"的东西。
 */
class EpochViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        /**
         * 从屏幕左边缘右滑返回。
         *
         * iOS 用户对这个手势的预期是肌肉记忆级的——**没有它，App 会被觉得"不像 iOS 应用"**，
         * 而且这个站有很多层级（专题 → 帖子 → 用户主页），全靠点左上角那个返回钮很累。
         *
         * 对 SPA 也有效：react-router 的 pushState 会进 WKWebView 的历史栈，
         * 所以这个手势退的就是站内上一页，和点返回钮等价。
         */
        webView?.allowsBackForwardNavigationGestures = true

        /**
         * 关掉长按链接弹出的预览浮层。
         *
         * 这个站里长按的语义是别的（选文字、复制），弹出一张网页预览卡片属于误触，
         * 而且它渲染的是"另一个页面"，在套壳 App 里显得很突兀。
         */
        webView?.allowsLinkPreview = false
    }
}
