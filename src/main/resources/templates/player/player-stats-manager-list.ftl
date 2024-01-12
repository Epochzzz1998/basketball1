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
<button type="button" class="layui-btn layui-btn-lg layui-btn-normal">${playerName!}数据统计</button>

<table id="playerStats" lay-filter="playerStats"></table>

<script src="../../js/jquery-3.6.3.js"></script>
<script src="../../layui/layui.js"></script>
<script>
    layui.use(['layer', 'form', 'element','table'], function(){
        var layer = layui.layer
            ,form = layui.form
            ,element = layui.element
            ,table = layui.table;

        table.render({
            elem: '#playerStats'
            ,toolbar: '#toolbarDemo'
            ,height: 'full-' + 100
            ,url: '/player/getPlayerSeasonStatsList' //数据接口
            ,where: {
                playerId: '${playerId!}'
            }
            ,page: true //开启分页
            ,limit: 20
            ,cols: [[ //表头
                {fixed : 'left', field: 'seasonNum', title: '赛季', width:80, edit: 'text', sort: true, align: 'center',
                    templet: function (res) {
                    console.log(res);
                        if(res.seasonNum == 50){
                            return "生涯";
                        }
                        return res.seasonNum;
                    }}
                ,{fixed : 'left', field: 'playerTeam', title: '球队', width:110, edit: 'text', align: 'center'}
                ,{fixed : 'left', field: 'playerPosition', title: '位置', width:40, edit: 'text', align: 'center'}
                ,{field: 'playerNumber', title: '球衣号码', width:90, edit: 'text', align: 'center'}
                ,{field: 'playerFrAppearance', title: '首发', width:80, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerSrAppearance', title: '替补', width:80, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAppearance', title: '总出场数', width:110, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playingTime', title: '场均时间', width:110, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAvgScore', title: '场均得分', width:110, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAvgReb', title: '场均篮板', width:110, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAvgAss', title: '场均助攻', width:110, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAccuracy', title: '命中率', width:110, edit: 'text', sort: true, align: 'center',
                    templet: function (res) {
                        var num = (res.playerAccuracy)*100;
                        return num.toFixed(1) + "%";
                    }
                }
                ,{field: 'playerThreeAccuracy', title: '三分命中率', width:120, edit: 'text', sort: true, align: 'center',
                    templet: function (res) {
                        var num = (res.playerThreeAccuracy)*100;
                        return num.toFixed(1) + "%";
                    }
                }
                ,{field: 'playerFreethrowAccuracy', title: '罚球中率', width:120, edit: 'text', sort: true, align: 'center',
                    templet: function (res) {
                        var num = (res.playerFreethrowAccuracy)*100;
                        return num.toFixed(1) + "%";
                    }
                }
                ,{field: 'playerAvgBlock', title: '盖帽', width:80, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAvgSteal', title: '抢断', width:80, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerAvgTurnover', title: '失误', width:80, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerPer', title: 'PER', width:80, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerPie', title: '比赛贡献值', width:120, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerWs', title: '胜利贡献值', width:120, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerOffEff', title: '进攻效率', width:120, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerDefEff', title: '防守效率', width:120, edit: 'text', sort: true, align: 'center'}
                ,{field: 'playerNetEff', title: '净效率', width:110, edit: 'text', sort: true, align: 'center',
                    templet: function (res) {
                        if(res.playerNetEff > 0){
                            return "+" + res.playerNetEff;
                        }
                        return res.playerNetEff;
                    }}
                ,{field: 'playerAvgPn', title: '正负值', width:110, edit: 'text', sort: true, align: 'center',
                    templet: function (res) {
                        if(res.playerAvgPn > 0){
                            return "+" + res.playerAvgPn;
                        }
                        return res.playerAvgPn;
                    }}
                ,{field: 'mvpRank', title: 'MVP排名', width:110, edit: 'text', sort: true, align: 'center'}
                ,{field: 'dpoyRank', title: 'DPOY排名', width:120, edit: 'text', sort: true, align: 'center'}
                ,{field: 'allDbaTeam', title: '最佳阵容', width:120, edit: 'text', align: 'center'}
                ,{field: 'allDefTeam', title: '最佳防守阵容', width:120, edit: 'text', align: 'center'}
            ]]
        });

        table.on('sort(playerStats)', function(obj){ //注：sort 是工具条事件名，test 是 table 原始容器的属性 lay-filter="对应的值"
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
                    ,playerId: '${playerId!}'
                }
            });
        });

        table.on('toolbar(playerStats)', function(obj){
            if(obj.event == 'add'){
                var table = layui.table;
                var data = table.cache['playerStats']
                $.ajax({
                    url: '/player/insertAndSavePlayerStats?playerId=' + '${playerId!}',
                    data:{
                        data: JSON.stringify(data)
                    },//json
                    async:true,
                    dateType:'json',
                    type: 'post',
                    success: function (res) {
                        table.reload('playerStats', {
                        });
                        return false;
                    }
                });
            }
            else if(obj.event == 'save'){
                var table = layui.table;
                var data = table.cache['playerStats'] // 例如 let data = table.cache['Table-List'];
                $.ajax({
                    url: '/player/savePlayerStats',
                    data:{
                        playerId: '${playerId!}',
                        data: JSON.stringify(data)
                    },//json
                    async:true,
                    dateType:'json',
                    type: 'post',
                    success: function (res) {
                        table.reload('playerStats', {
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