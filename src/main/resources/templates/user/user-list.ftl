<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>用户列表</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
</head>
<body>
<#include "/public/head.ftl"/>
<script type="text/html" id="toolbarDemo">
    <#if isManagerOrOver?? && isManagerOrOver != ''>
        <div class="layui-btn-container">
            <button class="layui-btn layui-btn-sm" id="add" lay-event="add">新增用户</button>
            <button class="layui-btn layui-btn-sm" id="del" lay-event="del">删除用户</button>
        </div>
    </#if>
</script>
<div class="layui-btn-container">
    <form class="layui-form" lay-filter="formFilter">
        <div class="layui-form-item" >
            <button class="layui-btn" style="margin-top: 20px" lay-submit lay-filter="formDemo">搜索</button>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">用户昵称</label>
                <div class="layui-input-block">
                    <input type="text" name="userNickName" id="userNickName"  placeholder="用户昵称" autocomplete="off" class="layui-input">
                </div>
            </div>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">用户状态</label>
                <div class="layui-input-block">
                    <input type="text" name="author"  placeholder="球员姓名" autocomplete="off" class="layui-input">
                </div>
            </div>
            <div class="layui-input-inline" style="width: 300px;margin-top: 20px">
                <label class="layui-form-label">新闻类型</label>
                <div class="layui-input-block">
                    <select name="newsType" id="newsType" >
                        <option value="">所有</option>
                        <option value="交易">交易</option>
                        <option value="流言">流言</option>
                        <option value="新闻">新闻</option>
                        <option value="资讯">资讯</option>
                        <option value="球场">球场</option>
                    </select>
                </div>
            </div>
        </div>
    </form>
</div>
<table class="layui-hide" id="newsList" lay-filter="newsList"></table>
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
                table.reload('newsList', {
                    url: '/news/newsListData',
                    method: 'get',
                    where: {},
                    height: 'full-' + 145,
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
            elem: '#newsList'
            ,height: 'full-' + 145
            ,toolbar: '#toolbarDemo'
            ,url: '/news/newsListData' //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,id: "newsList"
            ,cols: [[ //表头
                {type: 'checkbox', width: '2%', fixed: 'left'}
                ,{field: 'title', title: '新闻标题', width:'60%', align: 'center', style:"text-align: left",
                    templet: function (res) {
                        // return '<a href="/news/newsInput?newsId=' + res.newsId + '" target="_blank">' + res.title + '</a>';
                        return '<a href="javascript:void(0);" onclick="openUrl(' + "'" + res.newsId + "'" + ')">' + res.title + '</a>';
                    }}
                ,{field: 'newsType', title: '新闻类别', width:'10%', align: 'center'}
                ,{field: 'newsId', title: 'id', hide: true}
                ,{field: 'author', title: '作者', width:'10%', align: 'center'}
                ,{field: 'publishDate', title: '发布时间', width:'10%', align: 'center',
                    templet: function (res) {
                        if (typeof res.publishDate != 'undefined') {
                            return new Date(res.publishDate).Format("yyyy-MM-dd hh:mm:ss")
                        } else {
                            return '';
                        }
                    }
                }
                ,{field: 'team', title: '队伍', width:'6.8%', align: 'center'}
            ]]
        });

        form.on('submit(formDemo)', function(data){
            console.log(data.field);
            table.reload('newsList', {
                where: { //请求参数（注意：这里面的参数可任意定义，并非下面固定的格式）
                    newsType: data.field.newsType,
                    content: data.field.content,
                    author: data.field.author,
                    team: data.field.team
                }
            });
            return false;
        });

        // 删除
        $("#del").click(function () {
            var data = table.checkStatus("newsList").data;
            console.log(data)
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

        //新增
        $("#add").click(function () {
            var url = "/news/newsInput";
            layerOpen(url, '', '', '新增新闻');
        });

    });

    // 打开页面
    function openUrl(newsId){
        if ('${isManagerOrOver!}' == 'true') {
            var url = "/news/newsInput?newsId=" + newsId;
        } else {
            var url = "/news/newsShow?newsId=" + newsId;
        }
        layerOpen(url, '', '', '新闻详情');
    }

</script>
</body>
</html>