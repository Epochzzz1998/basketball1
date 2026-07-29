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
         * **刻意关掉** WebView 自带的前进/后退手势。
         *
         * 它走的是历史栈，语义是"上一次去过的地址"；而 App 的左右滑该是：
         * 在 Tab 首页之间横滑切 Tab、在二级页面从左边缘滑回**上一级**。
         * 两者从第一步就不一样——站在百家说首页往左滑，历史栈会把你带去某个不相干的页面，
         * 而正确的行为是滑不动（左边没有 Tab 了）。
         *
         * 所以手势改由前端按语义实现（`layout/useAppSwipe.js`），这里关掉原生的免得两套打架。
         */
        webView?.allowsBackForwardNavigationGestures = false

        /**
         * 关掉长按链接弹出的预览浮层。
         *
         * 这个站里长按的语义是别的（选文字、复制），弹出一张网页预览卡片属于误触，
         * 而且它渲染的是"另一个页面"，在套壳 App 里显得很突兀。
         */
        webView?.allowsLinkPreview = false
    }
}
