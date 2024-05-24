<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>D论坛</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
    <style>
        .layui-table-cell {
            height: auto;
            line-height: 60px;
            font-size: 13px;
        }
        p{
            text-align: right;
            color: #C2C2C2;
            font-size: 17px;
        }
        .layui-table-view{
            margin-left: 110px;
            border-radius: 20px;
            border-width: 2px;
        }
    </style>
</head>
<body>
<div class="layui-btn-container" style="width: 90%">
    <script type="text/html" id="toolbarDemo">
        <div class="layui-btn-container">
            <button class="layui-btn layui-btn-sm" id="add" lay-event="add">发帖</button>
        </div>
    </script>
</div>
<div style="text-align: left;width: 90%;margin-top: 20px">
    <table class="transparentDataTable " id="informationList" lay-filter="informationList"></table>
</div>
<script src="../../js/jquery-3.6.3.js"></script>
<script src="../../layui/layui.js"></script>
<script src="../../js/public.js"></script>
<script>
    layui.use(['layer', 'form', 'element','table'], function(){
        var layer = layui.layer
            ,form = layui.form
            ,element = layui.element
            ,table = layui.table;

        var active = {
            reload: function (curr) {
                curr = curr == undefined ? 1 : curr;
                table.reload('informationList', {
                    url: '/userInformation/userInformationListData',
                    method: 'get',
                    where: {},
                    height: 'full',
                    page: {
                        curr: curr //重新从指定页开始，默认第 1 页
                    },
                    done: function (res, curr, count) {
                        // 设置标题行文字居中
                    }
                });
            }
        };
        active.reload();

        table.render({
            elem: '#informationList'
            ,height: 'full'
            // ,toolbar: true
            ,url: '/userInformation/userInformationListData' //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,id: "informationList"
            ,cols: [[ //表头
                {field: 'title', title: '<div style="font-size: 30px;">我的消息</div>', width:'90%', align: 'left', style:"text-align: left",
                    templet: function (res) {
                        var msg = '';
                        var msgDate = formatDateTime(new Date(res.msgDate));
                        if (res.whetherRead == 'toRead') {
                            msg += '<span class="layui-badge-dot"></span>&nbsp;&nbsp;'
                        }
                        if (res.msgType == 'commentNews' || res.msgType == 'commentComment') {
                            msg += '<span style="color: #C2C2C2">' + res.operatorName + '</span>&nbsp;&nbsp;' + '<span>评论了您</span>&nbsp;&nbsp;' + '<span style="font-size: 13px">' + msgDate + '</span>' + cellData(res);
                        } else {
                            msg += '<span style="color: #C2C2C2">' + res.operatorName + '</span>&nbsp;&nbsp;' + '<span>' + res.contentMsg + '</span>&nbsp;&nbsp;' + '<span style="font-size: 13px">' + msgDate + '</span>' + cellData(res);
                        }
                        return msg;
                    }}
            ]]
            ,skin: 'line'
            ,
            done: function (res, curr, count) {
                // $('th').hide()
                $("#LAYTABLE_COLS").hide();
            }
        });

        form.on('submit(formDemo)', function(data){
            table.reload('informationList', {
                where: { //请求参数（注意：这里面的参数可任意定义，并非下面固定的格式）
                    newsType: data.field.newsType,
                    content: data.field.content,
                    author: data.field.author,
                    team: data.field.team
                }
            });
            return false;
        });

        // 加载行数据
        function cellData(res){
            var str = '';
            if (res.msgType == 'commentNews') {
                str += '<div>' +
                    '<div style="text-align: left;width: 100%;"><a href="javascript:;" onclick="openCommentAnchor(' + "'" + res.msgType + "','" + res.msgId + "','" + res.msgIdSecond + "','" + res.msgIdThird + "','" + res.userInformationId + "'" + ')"><span style="font-size: 13px">' + '"' + res.contentMsg + '"' + '</span></a></div>' +
                    '<div style="text-align: left;width: 100%;"><a href="javascript:;" onclick="openCommentNews(' + "'" + res.msgType + "','" + res.msgId + "','" + res.msgIdSecond + "','" + res.msgIdThird + "','" + res.userInformationId + "'" + ')"><span style="font-size: 13px">原帖：' + res.content + '</span></a></div>'
                + '</div>';
            } else if (res.msgType == 'commentComment') {
                str += '<div>' +
                    '<div style="text-align: left;width: 100%;"><a href="javascript:;" onclick="openCommentAnchor2(' + "'" + res.msgType + "','" + res.msgId + "','" + res.msgIdSecond + "','" + res.msgIdThird + "','" + res.userInformationId + "'" + ')"><span style="font-size: 13px">' + '"' + res.contentMsg + '"' + '</span></a></div>' +
                    '<div style="text-align: left;width: 100%;"><a href="javascript:;" onclick="openCommentCommentAnchor(' + "'" + res.msgType + "','" + res.msgId + "','" + res.commentRelRelId + "','" + res.msgIdSecond + "','" + res.msgIdThird + "','" + res.userInformationId + "','" + res.level + "'" + ')"><span style="font-size: 13px">原评论：' + res.content + '</span></a></div>'
                    + '</div>';
            } else {
                str += '<div>' +
                    '<a href="javascript:;" onclick="openUrl(' + "'" + res.msgType + "','" + res.msgId + "','" + res.msgIdSecond + "','" + res.userInformationId + "','" + res.level + "','" + res.commentRelRelId + "'" + ')"><div style="text-align: left;width: 100%;><span style="font-size: 13px">原帖/原评论：' + res.content + '</span></div></a>' +
                    '</div>';
            }
            return str;
        }

        window.openCommentNews = function (msgType, msgId, msgIdSecond, msgIdThird, userInformationId) {
            var url = "/news/newsShow?newsId=" + msgId + "&level=1&userInformationId=" + userInformationId;
            window.open(url);
            setTimeout(function() {
                active.reload();
            }, 1500);
        }

        window.openCommentAnchor = function (msgType, msgId, msgIdSecond, msgIdThird, userInformationId) {
            var url = "/news/newsShow?newsId=" + msgId + "&level=1&userInformationId=" + userInformationId + "&anchorId=" + msgIdThird;
            window.open(url);
            setTimeout(function() {
                active.reload();
            }, 1500);
        }

        window.openCommentAnchor2 = function (msgType, msgId, msgIdSecond, msgIdThird, userInformationId) {
            var url = "/news/commentDetailShow?newsId=" + msgIdSecond + "&commentRelId=" + msgId + "&anchorId=" + msgIdThird + "&userInformationId=" + userInformationId;
            window.open(url);
            setTimeout(function() {
                active.reload();
            }, 1500);
        }

        window.openCommentCommentAnchor = function (msgType, msgId, commentRelRelId, msgIdSecond, msgIdThird, userInformationId, level) {
            var url = '';
            // 评论的为新闻的评论
            if (level == '2') {
                url = "/news/newsShow?newsId=" + msgIdSecond + "&level=1&userInformationId=" + userInformationId + "&anchorId=" + msgId;
            }
            // 评论的为评论的评论
            else {
                url = "/news/commentDetailShow?newsId=" + msgIdSecond + "&commentRelId=" + commentRelRelId + "&anchorId=" + msgId + "&userInformationId=" + userInformationId;
            }
            window.open(url);
            setTimeout(function() {
                active.reload();
            }, 1500);
        }

        window.openUrl = function (msgType, msgId, msgIdSecond, userInformationId, level, commentRelRelId) {
            var url = "";
            if (msgType == 'goodNews' || msgType == 'badNews') {
                url = "/news/newsShow?newsId=" + msgId + "&level=1&userInformationId=" + userInformationId;
            } else if (msgType == 'goodComment' || msgType == 'badComment') {
                if (level == '2') {
                    url = "/news/newsShow?newsId=" + msgIdSecond + "&userInformationId=" + userInformationId + "&anchorId=" + msgId;
                } else {
                    url = "/news/commentDetailShow?newsId=" + msgIdSecond + "&commentRelId=" + commentRelRelId + "&userInformationId=" + userInformationId + "&anchorId=" + msgId;
                }
            }
            window.open(url);
            setTimeout(function() {
                active.reload();
            }, 1500);
        }

    });

</script>
</body>
</html>