<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>Dream Basketball Union</title>
    <link rel="stylesheet" href="../../layui/css/layui.css">
</head>
<body>
<#include "/public/head.ftl"/>
<script type="text/html" id="toolbarDemo">
    <div class="layui-btn-container">
        <button class="layui-btn layui-btn-sm" lay-event="add">新增</button>
        <button class="layui-btn layui-btn-sm" lay-event="save">保存</button>
    </div>
</script>
<script type="text/html" id="tablebar">
    <a class="layui-btn layui-fontbtn layui-btn-xs" lay-event="del">删除</a>
</script>
<table id="playerList" lay-filter="playerList"></table>
<script src="../../js/jquery-3.6.3.js"></script>
<script src="../../layui/layui.js"></script>
<script>
    layui.use(['layer', 'form', 'element','table'], function(){
        var layer = layui.layer
            ,form = layui.form
            ,element = layui.element
            ,table = layui.table;

        table.render({
            elem: '#playerList'
            ,toolbar: '#toolbarDemo'
            ,height: 'full-' + 60
            ,url: '/player/getPlayerData?versionType=' + new Date().getTime() //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,cols: [[ //表头
                {field: 'playerName', title: '球员姓名', width:120, edit: 'text', align: 'center',
                    templet: function (res) {
                        return '<a class="layui-btn layui-btn-xs layui-fontbtn" href="/player/playerStatsManagerList?playerId=' + res.playerId + '" target="_blank">' + res.playerName + '</a>';
                    }}
                ,{field: 'playerNumber', title: '球衣号码', width:120,  edit: 'text', align: 'center'}
                ,{fixed: 'right', title: '操作', toolbar: '#tablebar', align: 'center', width: 150 }
            ]]
        });

        table.on('sort(playerList)', function(obj){ //注：sort 是工具条事件名，test 是 table 原始容器的属性 lay-filter="对应的值"
            console.log(obj.field); //当前排序的字段名
            console.log(obj.type); //当前排序类型：desc（降序）、asc（升序）、null（空对象，默认排序）
            console.log(this); //当前排序的 th 对象

            //尽管我们的 table 自带排序功能，但并没有请求服务端。
            //有些时候，你可能需要根据当前排序的字段，重新向服务端发送请求，从而实现服务端排序，如：
            table.reload('playerList', {
                initSort: obj //记录初始排序，如果不设的话，将无法标记表头的排序状态。
                ,where: { //请求参数（注意：这里面的参数可任意定义，并非下面固定的格式）
                    field: obj.field //排序字段
                    ,order: obj.type //排序方式
                }
            });
        });

        table.on('edit(playerList)', function(obj){ //注：edit是固定事件名，test是table原始容器的属性 lay-filter="对应的值"
            console.log(obj.value); //得到修改后的值
            console.log(obj.field); //当前编辑的字段名
            console.log(obj.data); //所在行的所有相关数据
        });

        table.on('tool(playerList)', function(obj){
            if(obj.event == 'del'){
                layer.confirm('确定要删除吗？', {
                    btn: ['确定','取消'] //可以无限个按钮
                    ,btn1: function(index, layero){
                        $.ajax({
                            url: '/player/deletePlayer',
                            type: 'post',
                            data: {
                                playerId: obj.data.playerId
                            },
                            success: function (res) {
                                location.reload();
                            }
                        });
                    },
                    btn2: function(index, layero){
                        // location.reload();
                    }
                });
            }
        });

        table.on('toolbar(playerList)', function(obj){
            if(obj.event == 'add'){
                var table = layui.table;
                var data = table.cache['playerList']
                $.ajax({
                    url: '/player/insertAndSavePlayer',
                    data:{
                        data: JSON.stringify(data)
                    },//json
                    async:true,
                    dateType:'json',
                    type: 'post',
                    success: function (res) {
                        table.reload('playerList', {
                        });
                        return false;
                    }
                });
            }
            else if(obj.event == 'save'){
                var table = layui.table;
                var data = table.cache['playerList'] // 例如 let data = table.cache['Table-List'];
                $.ajax({
                    url: '/player/savePlayer',
                    data:{
                        data: JSON.stringify(data)
                    },//json
                    async:true,
                    dateType:'json',
                    type: 'post',
                    success: function (res) {
                        table.reload('playerList', {
                        });
                        return false;
                    }
                });
            }
        });
    });
</script>
</body>
</html>