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
            font-size: 15px;
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
<script src="../../js/jquery-3.6.3.js"></script>
<script src="../../layui/layui.js"></script>
<script src="../../js/public.js"></script>
<#include "/public/head.ftl"/>
<script type="text/html" id="toolbarDemo">
    <div class="layui-btn-container">
        <button class="layui-btn layui-btn-sm" id="add" lay-event="add">发帖</button>
        <#if isManagerOrOver?? && isManagerOrOver != ''>
            <button class="layui-btn layui-btn-sm" id="del" lay-event="del">删除</button>
        </#if>
    </div>
</script>
<div class="layui-btn-container" style="width: 90%">
    <form class="layui-form" lay-filter="formFilter" style="width: 90%;margin-left: 110px">
        <div class="layui-form-item" >
            <button class="layui-btn" style="margin-top: 20px" lay-submit lay-filter="formDemo">搜索</button>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">球队</label>
                <div class="layui-input-block">
                    <select name="team" id="team" lay-filter="onClickSelected">
                        <option value="">所有</option>
                        <option value="SPUR">SPUR</option>
                        <option value="HOS">HOS</option>
                        <option value="LAC">LAC</option>
                        <option value="LAL">LAL</option>
                        <option value="DET">DET</option>
                        <option value="COD">COD</option>
                        <option value="BAK">BAK</option>
                        <option value="JAS">JAS</option>
                        <option value="OKC">OKC</option>
                        <option value="PHX">PHX</option>
                        <option value="PHS">PHS</option>
                        <option value="GOS">GOS</option>
                    </select>
                </div>
            </div>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">内容</label>
                <div class="layui-input-block">
                    <input type="text" name="content" id="content"  placeholder="内容" autocomplete="off" class="layui-input">
                </div>
            </div>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">标题</label>
                <div class="layui-input-block">
                    <input type="text" name="title" id="title"  placeholder="标题" autocomplete="off" class="layui-input">
                </div>
            </div>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">作者</label>
                <div class="layui-input-block">
                    <input type="text" name="author" id="author"  placeholder="作者" autocomplete="off" class="layui-input">
                </div>
            </div>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">帖子类型</label>
                <div class="layui-input-block">
                    <select name="newsType" id="newsType" >
                        <option value="">所有</option>
                        <option value="交易">交易</option>
                        <option value="流言">流言</option>
                        <option value="新闻">新闻</option>
                        <option value="资讯">资讯</option>
                        <option value="球场">球场</option>
                        <option value="水贴">水贴</option>
                        <option value="流言板">流言板</option>
                        <option value="吐槽">吐槽</option>
                    </select>
                </div>
            </div>
        </div>
    </form>
</div>
<div style="text-align: left;width: 90%">
    <table class="transparentDataTable " id="newsList" lay-filter="newsList"></table>
</div>
<script>
    layui.use(['layer', 'form', 'element','table'], function(){
        var layer = layui.layer
            ,form = layui.form
            ,element = layui.element
            ,table = layui.table;

        var active = {
            reload: function (curr) {
                curr = curr == undefined ? 1 : curr;
                table.reload('newsList', {
                    url: '/news/newsListData',
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
        // active.reload();

        table.render({
            elem: '#newsList'
            ,id: 'newsList'
            ,height: 'full'
            ,toolbar: '#toolbarDemo'
            ,url: '/news/newsListData' //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,cols: [[ //表头
                {type: 'checkbox', width: '2%' <#if !(isManagerOrOver?? && isManagerOrOver != '')>,hide: true</#if>}
                ,{field: 'title', title: '<div style="font-size: 30px;">D论坛</div>', width:'92%', align: 'left', style:"text-align: left",
                    templet: function (res) {
                        return '<a href="javascript:void(0);" onclick="openUrl(' + "'" + res.newsId + "'" + ')"><span>' + res.title + '</span>  /  <span style="color: #C2C2C2">' + res.author + '</span>' + '</a>' + cellData(res);
                    }}
                <#if isManagerOrOver?? && isManagerOrOver != ''>,{field: 'newsId', title: 'newsId', hide: true}</#if>
                <#if isManagerOrOver?? && isManagerOrOver != ''>,{field: 'authorId', title: 'authorId', hide: true}</#if>
            ]]
            ,skin: 'line'
            ,
            done: function (res, curr, count) {
                // $('th').hide()
            }
        });

        form.on('submit(formDemo)', function(data){
            console.log(data.field);
            table.reload('newsList', {
                where: { //请求参数（注意：这里面的参数可任意定义，并非下面固定的格式）
                    newsType: data.field.newsType,
                    content: data.field.content,
                    author: data.field.author,
                    team: data.field.team,
                    title: data.field.title
                }
            });
            return false;
        });

        // 加载行数据
        function cellData(res){
            var str = '';
            var publishDate = formatDateTime(new Date(res.publishDate));
            str += '<div>' +
                '<div style="text-align: left;width: 50%;display: inline-block"><span style="font-size: 14px">' + publishDate + '</span>&nbsp;&nbsp;<span style="font-size: 14px">/&nbsp;&nbsp;' + res.newsType + '</span>&nbsp;&nbsp;<span style="font-size: 14px">/&nbsp;&nbsp;' + res.team + '</span></div>' +
                '<div style="text-align: right;width: 50%;display: inline-block"><i class="layui-icon layui-icon-praise" style="font-size: 20px;"><span style="font-size: 14px;">' + res.goodNum + '</span></i>' +
                '&nbsp;&nbsp;<i class="layui-icon layui-icon-tread" style="font-size: 20px;"><span style="font-size: 14px;">' + res.badNum + '</span></i>&nbsp;&nbsp;<i class="layui-icon layui-icon-form" style="font-size: 20px;"><span style="font-size: 14px;">' + res.commentNum + '</span></i></div>' +
                '</div>';
            return str;
        }

        // 删除
        $("#del").click(function () {
            var data = table.checkStatus("newsList").data;
            if (data.length == 0) {
                return layerMsg("请至少选择一条数据进行删除！");
            }
            layerConfirm("确定要删除吗？", function() {
                var ids = [];
                $.each(data, function(idx, obj) {
                    ids.push(obj.newsId);
                });
                console.log(ids)
                var index = layer.load(2);
                $.ajax({
                    url: '/news/delete',
                    type: 'delete',
                    data: {newsIds: ids.join(",")},
                    success: function(res){
                        if (res.result == true) {
                            setTimeout(function() {
                                active.reload();
                            }, 1500);
                        }
                        layer.close(index);
                        layerMsg(res);
                    }
                });
            });
        });

        // 发帖
        $("#add").click(function () {
            $.ajax({
                url: '/user/checkLogin',
                type: 'post',
                dataType: 'json',
                data: {},
                success: function (res) {
                    if (res.result) {
                        var url = "/news/newsInput";
                        layerOpen(url, '', '', '发帖');
                    } else {
                        layerMsg(res.msg);
                    }

                }
            });
        });

    });

    // 打开页面
    function openUrl(newsId){
        if ('${isManagerOrOver!}' == 'true') {
            var url = "/news/newsInput?newsId=" + newsId;
            layerOpen(url, '', '', '新闻详情');
        } else {
            var url = "/news/newsShow?newsId=" + newsId + "&level=1";
            window.open(url);
        }
    }

</script>
</body>
</html>