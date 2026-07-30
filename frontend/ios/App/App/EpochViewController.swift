import UIKit
import Capacitor
import ObjectiveC

/**
 * Capacitor 桥接控制器的子类，只做 Capacitor 没有暴露成配置项的那几件事。
 *
 * ## 为什么必须写原生代码
 *
 * `capacitor.config.json` 能配的 iOS 选项是固定的一小组（`contentInset`、`scrollEnabled`、
 * `backgroundColor` 等）。这里的三件事都在 WKWebView（或它内部的私有视图）上，
 * Capacitor 没有把它们接出来成配置，所以只能自己继承一层。
 *
 * 三件事的共同点：都是"iOS 用户觉得理所当然、缺了/多了就觉得这 App 是个网页"的东西。
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

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        removeInputAccessoryBar()
    }

    /**
     * 去掉键盘上方那条 `∧ ∨ ✓` 横条。
     *
     * ## 那条是什么
     *
     * WKWebView 给网页表单自带的 **input accessory view**（上一项 / 下一项 / 完成）。
     * 原生 App 不用 WebView，所以别的 App 里看不到它——一出现就等于告诉用户"这是个网页"。
     * 而且在本站毫无用处：聊天页只有一个输入框，"上一项/下一项"无处可去，
     * "完成"和点空白处收起键盘是一回事。
     *
     * ## 为什么要动运行时
     *
     * 它挂在 `WKContentView` 上——WebKit 的私有类，既不是配置项，
     * `capacitor.config.json` 里也没有对应开关。想让它返回 nil 只能从 Objective-C 运行时下手。
     *
     * ## 为什么改实例而不是改类
     *
     * 直接 `method_setImplementation` 改 `WKContentView` 的方法有个陷阱：
     * 如果这个类本身没有实现 `inputAccessoryView`，`class_getInstanceMethod` 拿到的
     * 是**继承自 UIResponder 的那一份**，改下去等于把全 App 所有视图的
     * accessory view 一起废掉。
     *
     * 所以走另一条路：运行时造一个只重写了这一个 getter 的子类，
     * 然后把**这一个实例**的 isa 指过去。影响面精确到我们自己的这块内容视图，
     * 系统类一个字节都没改。
     *
     * 子类只造一次（第二次进来会命中 `NSClassFromString`），
     * 因为 `objc_registerClassPair` 同名注册两次会直接崩。
     */
    private func removeInputAccessoryBar() {
        // WKContentView 是 scrollView 的子视图，类名私有，按前缀找
        guard let contentView = webView?.scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else {
            NSLog("[Epoch] 没找到 WKContentView，键盘横条保持原样")
            return
        }

        let baseClass: AnyClass = type(of: contentView)
        // 已经换过 isa 了（比如 App 切回前台又走一遍 viewDidAppear），不必再来
        if NSStringFromClass(baseClass).hasPrefix("Epoch_") { return }

        let name = "Epoch_\(NSStringFromClass(baseClass))_NoAccessoryBar"
        let subclass: AnyClass
        if let existing = NSClassFromString(name) {
            subclass = existing
        } else {
            guard let created = objc_allocateClassPair(baseClass, name, 0) else {
                NSLog("[Epoch] 子类创建失败，键盘横条保持原样")
                return
            }
            let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
            // "@@:" = 返回对象，参数为 self 与 selector
            class_addMethod(created,
                            #selector(getter: UIResponder.inputAccessoryView),
                            imp_implementationWithBlock(block),
                            "@@:")
            objc_registerClassPair(created)
            subclass = created
        }
        object_setClass(contentView, subclass)
        NSLog("[Epoch] 键盘横条已移除（%@ → %@）", NSStringFromClass(baseClass), name)
    }
}
