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
            font-size: 16px;
            display:table-cell;
            vertical-align: middle;
            overflow:visible;
            text-overflow:inherit;
            white-space:normal;
        }
        p{
            text-align: right;
            color: #C2C2C2;
            font-size: 17px;
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
<#--style="background-color: #cccccc"-->
<div class="layui-btn-container" style="width: 100%;text-align: center">
</div>
<div style="text-align: left;width: 90%">
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

        var active = {
            reload: function (curr) {
                curr = curr == undefined ? 1 : curr;
                table.reload('commentList', {
                    url: '/news/CommentListData',
                    method: 'get',
                    where: {
                        newsId: newsId,
                        level: '2',
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
                level: '2',
                commentRelId: commentRelId
            }
            ,id: "commentList"
            ,even: true
            ,cols: [[ //表头
                {type: 'checkbox', width: '2%' <#if !(isManagerOrOver?? && isManagerOrOver != '')>,hide: true</#if>}
                ,{field: 'title', title: '<div style="font-size: 30px;">评论区</div>', width:'92%', align: 'left', style:"text-align: left",
                    templet: function (res) {
                        return '<span style="font-weight: bold">' + res.userName + '</span><span>&nbsp;&nbsp;/&nbsp;&nbsp;</span><span>' + new Date(res.commentDate).Format("yyyy-MM-dd hh:mm:ss") + '</span>&nbsp;&nbsp;/&nbsp;&nbsp;<span>' + res.floor + '楼</span>' +  cellData(res);
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
        function cellData(res){
            var str = '';
            str += '<div>' +
                '<div style="text-align: left;width: 100%;"><span style="font-size: 16px">' + res.content + '</span></div>' +
                '<div style="text-align: left;width: 50%;display: inline-block"><a href="javascript:void(0);" onclick="openCommentList(' + "'" + res.newsId + "'," + "'" + res.commentId + "'" + ')"><span style="font-size: 15px;color: cornflowerblue">查看全部评论</span></a>' +
                '&nbsp;&nbsp;/&nbsp;&nbsp;<a href="javascript:void(0);" onclick="openCommentRel(' + "'" + res.newsId + "'," + "'" + res.commentId + "'" + ')"><span style="font-size: 15px;color: cornflowerblue">回复</span></a></div>' +
                '<div style="text-align: right;width: 50%;display: inline-block">' +
                '<a href="javascript:void(0);" onclick="commentGood(' + "'" + res.commentId + "'" + ')"><i class="layui-icon layui-icon-praise" style="font-size: 25px;"></i></a><span style="font-size: 15px;">' + res.goodNum + '</span>' +
                '&nbsp;&nbsp;<a href="javascript:void(0);" onclick="commentBad(' + "'" + res.commentId + "'" + ')"><i class="layui-icon layui-icon-tread" style="font-size: 25px;"></i></a><span style="font-size: 15px;">' + res.badNum + '</span>' +
                '</div>' +
                '</div>';
            return str;
        }

        // 点赞
        $("#good").click(function () {
            $.ajax({
                url: '/news/good',
                type: 'post',
                dataType: 'json',
                data: {
                    newsId: '${news.newsId!}'
                },
                success: function (res) {
                    if (res.result) {
                        layer.msg(res.msg, {icon: 1});
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        });

        // 点踩
        $("#bad").click(function () {
            $.ajax({
                url: '/news/bad',
                type: 'post',
                dataType: 'json',
                data: {
                    newsId: '${news.newsId!}'
                },
                success: function (res) {
                    if (res.result) {
                        layer.msg(res.msg, {icon: 2});
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        });

        // 评论
        $("#comment").click(function () {
            $.ajax({
                url: '/user/checkLogin',
                type: 'post',
                dataType: 'json',
                data: {},
                success: function (res) {
                    if (res.result) {
                        var url = "/news/commentInput?newsId=" + '${news.newsId!}';
                        layerOpen(url, '', '', '评论');
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        });

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
            layerOpen(url, '', '', '回复详情');
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