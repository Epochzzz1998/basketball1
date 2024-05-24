<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>${(news.title)!}</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
    <style>
        .layui-table-cell {
            height: auto;
            line-height: 60px;
            font-size: 13px;
            display:table-cell;
            vertical-align: middle;
            overflow:visible;
            text-overflow:inherit;
            white-space:normal;
        }
        p{
            text-align: right;
            color: #C2C2C2;
            font-size: 13px;
        }
        .no-scrollbar::-webkit-scrollbar {
            width: 0;
            height: 0;
            background-color: transparent;
        }
        .layui-table-view{
            margin-left: 110px;
            border-radius: 20px;
            border-width: 2px;
            padding: 6px;
        }
    </style>
</head>
<body>
<div style="text-align: left;width: 90%;margin-top: 40px">
    <table class="layui-hide" id="commentBefore" lay-filter="commentBefore">
    </table>
</div>
<div style="text-align: left;width: 90%;margin-top: 60px">
    <table class="layui-hide" id="commentList" lay-filter="commentList"></table>
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

        var newsId = '${news.newsId!}';
        var commentRelId = '${commentRelId!}';
        var anchorId = '${anchorId!}';

        var active1 = {
            reload: function (curr) {
                curr = curr == undefined ? 1 : curr;
                table.reload('commentBefore', {
                    url: '/news/CommentListData',
                    method: 'get',
                    where: {
                        commentId: commentRelId
                    },
                    height: 'full',
                    id: "commentBefore",
                    even: true,
                    skin: 'nob',
                    text: {
                        none: '暂时没有回复捏'
                    },
                    page: false,
                    done: function (res, curr, count) {
                    }
                });
            }
        };
        active1.reload();

        table.render({
            elem: '#commentBefore'
            ,height: 'full'
            ,url: '/news/CommentListData' //数据接口
            ,page: false //开启分页
            ,where: {
                commentId: commentRelId
            }
            ,id: "commentBefore"
            ,even: true
            ,cols: [[ //表头
                {field: 'title', title: '<div style="font-size: 30px;">回复评论</div>', width:'91%', align: 'left', style:"text-align: left",
                    templet: function (res) {
                        return '<span style="font-weight: bold" id=' + '"' + res.commentId + '"' + '>' + res.userName + '</span><span>&nbsp;&nbsp;/&nbsp;&nbsp;</span><span>' + new Date(res.commentDate).Format("yyyy-MM-dd hh:mm:ss") + '</span>&nbsp;&nbsp;/&nbsp;&nbsp;<span>' + res.floor + '楼</span>' +  replayCellData(res);
                    }}
            ]]
            ,skin: 'nob'
            ,text: {
                none: '暂时没有回复捏'
            }
            ,done: function (res, curr, count) {
                // $('th').hide()
            }
        });

        var active = {
            reload: function (curr) {
                curr = curr == undefined ? 1 : curr;
                table.reload('commentList', {
                    url: '/news/CommentListData',
                    method: 'get',
                    where: {
                        newsId: newsId,
                        commentRelId: commentRelId
                    },
                    height: 'full',
                    id: "commentList",
                    even: true,
                    skin: 'nob',
                    text: {
                      none: '暂时没有回复捏'
                    },
                    page: {
                        curr: curr //重新从指定页开始，默认第 1 页
                    },
                    done: function (res, curr, count) {
                    }
                });
            }
        };
        active.reload();

        table.render({
            elem: '#commentList'
            ,height: 'full'
            ,url: '/news/CommentListData' //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,where:{
                newsId: newsId,
                commentRelId: commentRelId
            }
            ,id: "commentList"
            ,even: true
            ,cols: [[ //表头
                {type: 'checkbox', width: '2%' <#if !(isManagerOrOver?? && isManagerOrOver != '')>,hide: true</#if>}
                ,{field: 'title', title: '<div style="font-size: 30px;">评论区</div>', width:'91.5%', align: 'left', style:"text-align: left",
                    templet: function (res) {
                        return '<span style="font-weight: bold" id=' + '"' + res.commentId + '"' + '>' + res.userName + '</span><span>&nbsp;&nbsp;/&nbsp;&nbsp;</span><span>' + new Date(res.commentDate).Format("yyyy-MM-dd hh:mm:ss") + '</span>&nbsp;&nbsp;/&nbsp;&nbsp;<span>' + res.floor + '楼</span>' +  cellData(res);
                    }}
            ]]
            ,skin: 'nob'
            ,text: {
                none: '暂时没有回复捏'
            }
            ,done: function (res, curr, count) {
                // 定位跳转
                if (anchorId != 'noAnchor') {
                    window.location.href = '#' + anchorId;
                }
            }
        });

        form.on('submit(formDemo)', function(data){
            console.log(data.field);
            table.reload('commentList', {
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
        function replayCellData(res){
            var str = '';
            str += '<div>' +
                '<div style="text-align: left;width: 100%;"><span style="font-size: 14px">' + res.content + '</span></div>' +
                '<div style="text-align: left;width: 50%;display: inline-block">' +
                '<a href="javascript:void(0);" onclick="openCommentRel(' + "'" + res.newsId + "'," + "'" + res.commentId + "'" + ')"><span style="font-size: 14px;color: cornflowerblue">回复</span></a></div>' +
                '<div style="text-align: right;width: 50%;display: inline-block">' +
                '<a href="javascript:void(0);" onclick="commentGood(' + "'" + res.commentId + "'" + ')"><i class="layui-icon layui-icon-praise" style="font-size: 25px;"></i>&nbsp;点赞&nbsp;<span style="font-size: 14px;">（' + res.goodNum + '）</span></a>' +
                '&nbsp;&nbsp;<a href="javascript:void(0);" onclick="commentBad(' + "'" + res.commentId + "'" + ')"><i class="layui-icon layui-icon-tread" style="font-size: 25px;"></i>&nbsp;点踩&nbsp;<span style="font-size: 14px;">（' + res.badNum + '）</span></a>' +
                '</div>' +
                '</div>';
            return str;
        }

        // 加载行数据
        function cellData(res){
            var str = '';
            str += '<div>' +
                '<div style="text-align: left;width: 100%;"><span style="font-size: 14px">' + res.content + '</span></div>' +
                '<div style="text-align: left;width: 50%;display: inline-block"><a href="javascript:void(0);" onclick="openCommentList(' + "'" + res.newsId + "'," + "'" + res.commentId + "'" + ')"><span style="font-size: 14px;color: cornflowerblue">查看全部' + res.commentNum + '条评论</span></a>' +
                '&nbsp;&nbsp;/&nbsp;&nbsp;<a href="javascript:void(0);" onclick="openCommentRel(' + "'" + res.newsId + "'," + "'" + res.commentId + "'" + ')"><span style="font-size: 14px;color: cornflowerblue">回复</span></a></div>' +
                '<div style="text-align: right;width: 50%;display: inline-block">' +
                '<a href="javascript:void(0);" onclick="commentGood(' + "'" + res.commentId + "'" + ')"><i class="layui-icon layui-icon-praise" style="font-size: 25px;"></i>&nbsp;点赞&nbsp;<span style="font-size: 14px;">（' + res.goodNum + '）</span></a>' +
                '&nbsp;&nbsp;<a href="javascript:void(0);" onclick="commentBad(' + "'" + res.commentId + "'" + ')"><i class="layui-icon layui-icon-tread" style="font-size: 25px;"></i>&nbsp;点踩&nbsp;<span style="font-size: 14px;">（' + res.badNum + '）</span></a>' +
                '</div>' +
                '</div>';
            return str;
        }

        // 评论点赞
        window.commentGood = function (commentId){
            $.ajax({
                url: '/news/goodComment',
                type: 'post',
                dataType: 'json',
                data: {
                    commentId: commentId
                },
                success: function (res) {
                    if (res.result) {
                        layer.msg(res.msg, {icon: 1});
                        setTimeout(function() {
                            active.reload();
                            active1.reload();
                        }, 1500);
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        }

        // 评论点踩
        window.commentBad = function (commentId){
            $.ajax({
                url: '/news/badComment',
                type: 'post',
                dataType: 'json',
                data: {
                    commentId: commentId
                },
                success: function (res) {
                    if (res.result) {
                        layer.msg(res.msg, {icon: 1});
                        setTimeout(function() {
                            active.reload();
                            active1.reload();
                        }, 1500);
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        }

        // 打开评论的评论
        window.openCommentList = function (newsId, commentId){
            var url = "/news/commentDetailShow?newsId=" + newsId + "&commentRelId=" + commentId;
            window.location.href = url;
            // layerOpen(url, '', '', '回复详情');
        }

        // 回复评论
        window.openCommentRel = function (newsId, commentId){
            $.ajax({
                url: '/user/checkLogin',
                type: 'post',
                dataType: 'json',
                data: {},
                success: function (res) {
                    if (res.result) {
                        var url = "/news/commentInput?newsId=" + newsId + "&level=2&commentId=" + commentId;
                        layerOpen(url, '', '', '评论');
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        }

    });

</script>
</body>
</html>