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
            ,url: '/player/getPlayerData' //数据接口
            ,page: true //开启分页
            ,limit: 20
            ,cols: [[ //表头
                {type: 'checkbox', fixed: 'left'}
                ,{field: 'playerName', title: '球员姓名', width:120, align: 'center',
                    templet: function (res) {
                        return '<a class="layui-btn layui-btn-xs layui-fontbtn" href="/player/playerStatsList?playerId=' + res.playerId + '" target="_blank">' + res.playerName + '</a>';
                    }}
                ,{field: 'playerNumber', title: '球衣号码', width:120, align: 'center'}
                ,{fixed: 'right', title: '操作', toolbar: '#tablebar', align: 'center', width: 150 }
            ]]
        });

        table.on('sort(playerList)', function(obj){ //注：sort 是工具条事件名，test 是 table 原始容器的属性 lay-filter="对应的值"
            console.log(obj.field); //当前排序的字段名
            console.log(obj.type); //当前排序类型：desc（降序）、asc（升序）、null（空对象，默认排序）
            console.log(this); //当前排序的 th 对象

            //尽管我们的 table 自带排序功能，但并没有请求服务端。
            //有些时候，你可能需要根据当前排序的字段，重新向服务端发送请求，从而实现服务端排序，如：
            table.reload('playerStats', {
                initSort: obj //记录初始排序，如果不设的话，将无法标记表头的排序状态。
                ,where: { //请求参数（注意：这里面的参数可任意定义，并非下面固定的格式）
                    field: obj.field //排序字段
                    ,order: obj.type //排序方式
                }
            });
        });

        table.on('toolbar(playerList)', function(obj){
            switch(obj.event){
                case 'add':
                    layer.msg('添加');
                    console.log(table.getData('playerList'));
                    break;
                case 'delete':
                    layer.msg('删除');
                    break;
                case 'update':
                    layer.msg('编辑');
                    break;
            };
        });

        table.on('tool(playerList)', function(obj){
            console.log(obj);
            switch(obj.event){
                case 'edit':
                    window.open('/user/loginPage','login');
                    break;
                case 'delete':
                    layer.msg('删除');
                    break;
            };
        });
    });
</script>
</body>
</html>