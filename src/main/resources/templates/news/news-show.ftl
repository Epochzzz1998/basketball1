<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>新闻新增</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
</head>
<body>
<div class="layui-btn-container">
    <form class="layui-form" style="text-align: center" action="">
        <div class="layui-form-item" style="margin-top: 15px">
            <input type="text" name="newsId" id="newsId" value="${(news.newsId)!}" class="layui-hide">
            <div class="layui-inline">
                <label class="layui-form-label"></label>
                <div class="layui-input-block">
                    <input type="text" name="title" id="title" value="${(news.title)!}" required readonly lay-verify="required" placeholder="新闻标题" autocomplete="off" class="layui-input" style= "background-color:transparent;border:0;width:1150px;font-size: 23px;text-align: center;margin-left: -5%">
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
                <label class="layui-form-label">新闻类型：</label>
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
                <textarea name="content" id="content" value="${(news.content)!}"  placeholder="请输入内容" readonly class="layui-textarea" style="background-color:transparent;border:0;height: 1000px; width: 95%;resize: none">${(news.content)!}</textarea>
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

        layui.use('form', function(){
            var form = layui.form;

        });

    });
</script>
</body>
</html>