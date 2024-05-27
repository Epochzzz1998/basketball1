<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>发帖</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
</head>
<body>
<div class="layui-btn-container">
    <form class="layui-form"  action="">
        <div class="layui-form-item" style="margin-top: 15px">
            <input type="text" name="newsId" id="newsId" value="${(news.newsId)!}" class="layui-hide">
            <input type="text" name="authorId" id="authorId" value="${(news.authorId)!}" class="layui-hide">
            <div class="layui-inline">
                <label class="layui-form-label">帖子标题</label>
                <div class="layui-input-block">
                    <input type="text" name="title" id="title" value="${(news.title)!}" required  lay-verify="required" placeholder="帖子标题" autocomplete="off" class="layui-input" style="width: 500px">
                </div>
            </div>
            <div class="layui-inline">
                <label class="layui-form-label">作者</label>
                <div class="layui-input-block">
                    <input type="text" name="author" id="author" value="${(news.author)!}" readonly class="layui-input">
                </div>
            </div>
        </div>
        <div class="layui-form-item">
            <div class="layui-inline">
                <label class="layui-form-label">球队</label>
                <div class="layui-input-inline">
                    <select name="team" id="team" >
                        <option value="">选填</option>
                        <option value="SAS">SAS</option>
                        <option value="HOS">HOS</option>
                        <option value="LAC">LAC</option>
                        <option value="LAL">LAL</option>
                        <option value="DET">DET</option>
                        <option value="COD">COD</option>
                        <option value="BAK">BAK</option>
                        <option value="JAS">JAS</option>
                        <option value="OKC">OKC</option>
                        <option value="PHX">PHX</option>
                        <option value="PHI">PHI</option>
                        <option value="GOS">GOS</option>
                        <option value="BOS">BOS</option>
                    </select>
                </div>
            </div>
            <div class="layui-inline">
                <label class="layui-form-label">帖子类型</label>
                <div class="layui-input-inline">
                    <select name="newsType" id="newsType" lay-verify="required">
                        <option value="">请选择</option>
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
<#--            <div class="layui-form-mid layui-word-aux">辅助文字</div>-->
        </div>
        <div class="layui-form-item layui-form-text">
            <label class="layui-form-label">帖子内容</label>
            <div class="layui-input-block">
                <textarea name="content" id="content" value="${(news.content)!}" placeholder="请输入内容" style="display: none;">${(news.content)!}</textarea>
            </div>
        </div>
        <div class="layui-form-item">
            <div class="layui-input-block">
                <button class="layui-btn" lay-submit lay-filter="formDemo">发布</button>
                <button type="reset" class="layui-btn layui-btn-primary">重置</button>
            </div>
        </div>
    </form>
</div>
<table class="layui-hide" id="newsList" lay-filter="newsList"></table>
<script src="../../js/jquery-3.6.3.js"></script>
<script src="../../layui/layui.js"></script>
<script src="../../js/public.js"></script>
<script>
    layui.use(['layer', 'form', 'element','table', 'layedit'], function(){
        var layer = layui.layer
            ,form = layui.form
            ,element = layui.element
            ,layedit = layui.layedit
            ,table = layui.table;

        layedit.set({
            uploadImage: {
                url: '/news/upload?newsId=' + '${(news.newsId)!}' //接口url
                ,type: 'post' //默认post
            }
        });
        var layeditContent = layedit.build('content'); //建立编辑器
        layui.use('form', function(){
            var form = layui.form;

            function initSelect(){
                var newsType = '${news.newsType!}';
                $("#newsType").val(newsType);
                var team = '${news.team!}';
                $("#team").val(team);
                form.render(); //更新全部
                form.render('select'); //刷新select选择框渲染
            }
            initSelect();

            //监听提交
            form.on('submit(formDemo)', function(data){
                // layer.msg(JSON.stringify(data.field));
                var contentValue = layedit.getContent(layeditContent);
                console.log(contentValue);
                // $("#content").text(contentValue);
                var dataJson1 = JSON.stringify(data.field);
                // dataJson.put("content", contentValue);
                var dataJson = JSON.parse(dataJson1);
                dataJson.content = contentValue;
                console.log(dataJson);
                var loadingIndex = layer.msg('正在保存数据...', {
                    icon: 16,
                    shade: 0.3
                });
                $.ajax({
                    type: "post",
                    url: "/news/save",
                    data: dataJson,
                    success: function (data) {
                        layer.close(loadingIndex);
                        if (data.result) {
                            layer.confirm(data.msg, {
                                btn: ['确定']
                            }, function (index) {
                                try {
                                    parent.location.reload();
                                    var index = parent.layer.getFrameIndex(window.name); //先得到当前iframe层的索引
                                    parent.layer.close(index); //再执行关闭
                                } catch (e) {

                                }
                            });
                        } else {
                            layerMsg(data.msg);
                        }
                    }
                });
                return false;
            });
        });

    });
</script>
</body>
</html>