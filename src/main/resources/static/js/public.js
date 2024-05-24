Date.prototype.Format = function(fmt) { // author: meizz
    var o = {
        "M+" : this.getMonth() + 1, // 月份
        "d+" : this.getDate(), // 日
        "h+" : this.getHours(), // 小时
        "m+" : this.getMinutes(), // 分
        "s+" : this.getSeconds(), // 秒
        "q+" : Math.floor((this.getMonth() + 3) / 3), // 季度
        "S" : this.getMilliseconds() // 毫秒
    };
    if (/(y+)/.test(fmt)){
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }

    for (var k in o){
        if (new RegExp("(" + k + ")").test(fmt)){
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]): (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}

/**
 * 信息提示
 * @param msg
 * @param icon
 */
function layerMsg(msg, icon) {
    var _msg = "　";
    var _icon = 7;
    if ("string" != typeof msg) {
        if (msg.result == false) {
            _icon = 5;
        } else {
            _icon = 6;
        }
        if (msg.msg) {
            _msg = msg.msg;
        }
    } else {
        _msg = msg;
    }
    if ($.trim(icon) != "" && formatNum(icon) >= 0 && formatNum(icon) <= 7) {
        _icon = formatNum(icon);
    }
    layui.use("layer", function () {
        var layer = layui.layer;
        layer.msg(_msg, {icon: _icon});
    });
}

/**
 * 格式化数字
 * @param value
 * @param num 保留小数位，当要整数时该值可以不传
 * @param sfbl 是否补0，不需要补0可以不传
 * @returns
 */
function formatNum(value, num, sfbl) {
    if ($.trim(value) == "" || isNaN(value)) {
        return 0;
    }

    var n = 0;
    if ($.trim(num) != "" && !isNaN(num) && parseInt(num) > 0 && parseInt(num) <= 20) {
        n = parseInt(num);
    }

    var v = parseFloat(value);
    v = v.toFixed(n);

    if ($.trim(sfbl) != "true") {
        return parseFloat(v);
    }
    return v;
}

/**
 * 询问框
 * @param msg 消息
 * @param callback 确认回调事件
 * @param cancel 取消回调事件
 */
function layerConfirm(msg, callback, cancel) {
    msg = $.trim(msg) == "" ? "　" : msg;
    layui.use("layer", function () {
        var layer = layui.layer;
        layer.confirm(msg, {icon: 3, title: '提示'}, function (index) {
            if (typeof callback == "function") {
                callback();
            }
            layer.close(index);
        }, function () {
            if (typeof cancel == "function") {
                cancel();
            }
        });
    });
}

/**
 * 弹窗
 * @param url 地址
 * @param width 宽度，默认90%
 * @param height 高度，默认90%
 * @param title 标题
 * @param maxmin 默认true，最大化按钮
 * @param reload 是否重载页面表格【弹出框由台账页面弹出的时候使用】
 * @param closeFunction 弹出窗关闭之后执行的方法
 */
function layerOpen(url, width, height, title, maxmin, reload, closeFunction, successFunction, whetherFull) {
    width = !width ? $(window).width() * 0.9 : width;
    height = !height ? $(window).height() * 0.9 : height;
    title = !title ? '　' : title;
    maxmin = $.trim(maxmin) == "" ? true : maxmin;
    layui.use("layer", function () {
        var layer = layui.layer;
        var openIndex = layer.open({
            type: 2,
            title: title,
            fix: false,
            shadeClose: false,
            maxmin: maxmin,
            area: [width + 'px', height + 'px'],
            skin: 'layerdemo',
            content: url,
            success: function (layero, index) {
                if (null != successFunction && "" != successFunction) {
                    successFunction();
                }
            },
            end: function () {
                if (true == reload) {
                    $(".gt-search")[0].click();
                }
                if (null != closeFunction && "" != closeFunction) {
                    closeFunction();
                }
            }
        });
        if (null != whetherFull) {
            if (whetherFull) {
                layer.full(openIndex);
            }
        }
    });
}

/**
    时间格式化
 */
function formatDateTime(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1 + '').padStart(2, '0')
    const day = (date.getDate() + '').padStart(2, '0')
    const hour = (date.getHours() + '').padStart(2, '0')
    const minute = (date.getMinutes() + '').padStart(2, '0')
    const second = (date.getSeconds() + '').padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}