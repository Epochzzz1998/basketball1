<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>评论</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
</head>
<body>
<div class="layui-btn-container">
    <form class="layui-form"  action="">
        <div class="layui-form-item" style="margin-top: 15px">
            <input type="text" name="newsId" id="newsId" value="${(comment.newsId)!}" class="layui-hide">
            <input type="text" name="level" id="level" value="${(comment.level)!}" class="layui-hide">
            <input type="text" name="commentRelId" id="commentRelId" value="${(comment.commentRelId)!}" class="layui-hide">
            <div class="layui-inline">
                <label class="layui-form-label">评论人</label>
                <div class="layui-input-block">
                    <input type="text" name="userName" id="userName" value="${(comment.userName)!}" readonly class="layui-input">
                </div>
            </div>
        </div>
        <div class="layui-form-item layui-form-text">
            <label class="layui-form-label">评论内容</label>
            <div class="layui-input-block">
                <textarea name="content" id="content" value="${(comment.content)!}" placeholder="请输入内容" class="layui-textarea" style="height: 400px; width: 1000px"></textarea>
            </div>
        </div>
        <div class="layui-form-item">
            <div class="layui-input-block">
                <button class="layui-btn" lay-submit lay-filter="formDemo">发布评论</button>
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
    layui.use(['layer', 'form', 'element','table'], function(){
        var layer = layui.layer
            ,form = layui.form
            ,element = layui.element
            ,table = layui.table;

        layui.use('form', function(){
            var form = layui.form;

            //监听提交
            form.on('submit(formDemo)', function(data){
                // layer.msg(JSON.stringify(data.field));
                var dataJson = data.field;
                var loadingIndex = layer.msg('正在保存数据...', {
                    icon: 16,
                    shade: 0.3
                });
                $.ajax({
                    type: "post",
                    url: "/news/comment",
                    data: dataJson,
                    success: function (data) {
                        layer.close(loadingIndex);
                        if (data.result) {
                            layer.msg('评论成功！',{time: 1500},function () {
                                var index=parent.layer.getFrameIndex(window.name);
                                parent.layer.close(index);
                                parent.location.reload();
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