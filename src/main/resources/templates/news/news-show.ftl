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
        .layui-table-main{
            height: 2000px;
        }
        .no-scrollbar::-webkit-scrollbar {
            width: 0;
            height: 0;
            background-color: transparent;
        }
    </style>
</head>
<body>
<#--style="background-color: #cccccc"-->
<div class="layui-btn-container" style="width: 100%;text-align: center">
    <form class="layui-form" style="text-align: center" action="">
        <div class="layui-form-item" style="margin-top: 15px">
            <input type="text" name="newsId" id="newsId" value="${(news.newsId)!}" class="layui-hide">
            <input type="text" name="authorId" id="authorId" value="${(news.authorId)!}" class="layui-hide">
            <div class="layui-inline">
                <label class="layui-form-label"></label>
                <div class="layui-input-block">
                    <input type="text" name="title" id="title" value="${(news.title)!}" required readonly lay-verify="required" placeholder="新闻标题" autocomplete="off" class="layui-input" style= "background-color:transparent;border:2px;width:1150px;font-size: 30px;text-align: center;margin-left: -5%">
                </div>
            </div>
        </div>
        <div class="layui-form-item">
            <div class="layui-inline">
                <label class="layui-form-label">球队：</label>
                <div class="layui-input-block">
                    <input type="text" name="team" id="team" style="background-color:transparent;border:0;font-size: 16px;width: 100px" value="${(news.team)!}" readonly class="layui-input">
                </div>
            </div>
            <div class="layui-inline">
                <label class="layui-form-label">帖子类型：</label>
                <div class="layui-input-block">
                    <input type="text" name="newsType" id="newsType" style="background-color:transparent;border:0;font-size: 16px;width: 100px" value="${(news.newsType)!}" readonly class="layui-input">
                </div>
            </div>
            <div class="layui-inline">
                <label class="layui-form-label">作者：</label>
                <div class="layui-input-block">
                    <input type="text" name="author" id="author" style="background-color:transparent;border:0;font-size: 16px;width: 100px" value="${(news.author)!}" readonly class="layui-input">
                </div>
            </div>
            <#--            <div class="layui-form-mid layui-word-aux">辅助文字</div>-->
        </div>
        <div class="layui-form-item layui-form-text">
            <label class="layui-form-label"></label>
            <div class="layui-input-block">
                <div style="width: 100%"><pre style="text-align: left;font-size: 20px;font-weight: bold">${(news.content)!}</pre></div>
<#--                <textarea name="content" id="content" value="${(news.content)!}"  placeholder="请输入内容" readonly class="layui-textarea" style="background-color:transparent;border:0;height: 1000px; width: 95%;resize: none">${(news.content)!}</textarea>-->
            </div>
        </div>
    </form>
    <div style="width: 90%;text-align: right">
        <button type="button" class="layui-btn layui-btn-radius layui-btn-normal" id="comment">评论</button>
        <button type="button" class="layui-btn layui-btn-radius" id="good">赞</button>
        <button type="button" class="layui-btn layui-btn-radius layui-btn-danger" id="bad">踩</button>
    </div>
</div>
<div style="text-align: center;width: 90%">
    <table class="layui-hide no-scrollbar" id="commentList" lay-filter="commentList"></table>
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

        var active = {
            reload: function (curr) {
                curr = curr == undefined ? 1 : curr;
                table.reload('commentList', {
                    url: '/news/CommentListData',
                    method: 'get',
                    where: {
                        newsId: newsId,
                        level: '1',
                        commentId: ''
                    },
                    height: 'full+' + 1200,
                    id: "commentList",
                    even: true,
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
            ,height: 'full+' + 1200
            ,url: '/news/CommentListData' //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,where:{
                newsId: newsId,
                level: '1',
                commentId: ''
            }
            ,id: "commentList"
            ,even: true
            ,cols: [[ //表头
                {type: 'checkbox', width: '2%' <#if !(isManagerOrOver?? && isManagerOrOver != '')>,hide: true</#if>}
                ,{field: 'title', title: '<div style="font-size: 30px;">评论区</div>', width:'100%', align: 'left', style:"text-align: left",
                    templet: function (res) {
                        return '<span style="font-weight: bold">' + res.userName + '</span><span>&nbsp;&nbsp;/&nbsp;&nbsp;</span><span>' + new Date(res.commentDate).Format("yyyy-MM-dd hh:mm:ss") + '</span>&nbsp;&nbsp;/&nbsp;&nbsp;<span>' + res.floor + '楼</span>' +  cellData(res);
                    }}
            ]]
            ,skin: 'line'
            ,
            done: function (res, curr, count) {
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
                        var url = "/news/commentInput?newsId=" + '${news.newsId!}' + "&level=1&commentId=''";
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
            var url = "/news/commentDetailShow?newsId=" + newsId + "&commentId=" + commentId;
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