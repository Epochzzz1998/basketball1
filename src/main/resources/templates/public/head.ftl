<ul class="layui-nav" style="padding: 0px 25px" lay-filter="">
    <li class="layui-nav-item"><a href="/">联盟数据</a></li>
    <li class="layui-nav-item"><a href="/news/newsList">D论坛</a></li>
    <li class="layui-nav-item"><a href="javascript:;" onclick="alertMsg()">战队排行榜</a></li>
    <li class="layui-nav-item">
        <a href="javascript:;" onclick="alertMsg()">球员数据</a>
        <dl class="layui-nav-child"> <!-- 二级菜单 -->
            <dd><a href="javascript:;" onclick="alertMsg()">得分榜</a></dd>
            <dd><a href="javascript:;" onclick="alertMsg()">篮板榜</a></dd>
            <dd><a href="javascript:;" onclick="alertMsg()">助攻榜</a></dd>
        </dl>
    </li>
<#--    <li class="layui-nav-item">-->
<#--        <a href="javascript:;">球队数据</a>-->
<#--        <dl class="layui-nav-child"> <!-- 二级菜单 &ndash;&gt;-->
<#--            <dd><a href="">移动模块</a></dd>-->
<#--            <dd><a href="">后台模版</a></dd>-->
<#--            <dd><a href="">电商平台</a></dd>-->
<#--        </dl>-->
<#--    </li>-->
    <#if isSuperManager?? && isSuperManager != ''>
        <li class="layui-nav-item" style="float: right">
            <a href="javascript:;">后台管理</a>
            <dl class="layui-nav-child"> <!-- 二级菜单 -->
                <dd><a href="/player/playerManage">球员列表</a></dd>
                <dd><a href="/user/userList">用户列表</a></dd>
                <dd><a href="/news/newsList">新闻列表</a></dd>
            </dl>
        </li>
    </#if>
    <#if isLogin?? && isLogin != ''>
        <li class="layui-nav-item" style="float: right">
            <a href=""><img src="" class="layui-nav-img">我</a>
            <dl class="layui-nav-child">
                <dd><a href="javascript:;">修改信息</a></dd>
                <dd><a href="javascript:;" onclick="alertMsg()">安全管理</a></dd>
                <dd><a href="/user/loginOut">登出</a></dd>
            </dl>
        </li>
        <li class="layui-nav-item" style="float: right">
            <a href="javascript:;" onclick="alertMsg()">控制台<span class="layui-badge">9</span></a>
        </li>
        <li class="layui-nav-item" style="float: right">
            <a href="javascript:;" onclick="alertMsg()">个人中心<span class="layui-badge-dot"></span></a>
        </li>
    <#else>
        <li class="layui-nav-item" style="float: right">
            <a href="javascript:;">用户选项</a>
            <dl class="layui-nav-child"> <!-- 二级菜单 -->
                <dd><a href="/user/loginPage">登录</a></dd>
                <dd><a href="/user/registPage">注册</a></dd>
            </dl>
        </li>
    </#if>
    <script>
        window.alertMsg = function (){
            layerMsg("正在开发，敬请期待！");
        }
        // 用户信息修改
        window.userEdit = function (){
            layerMsg("正在开发，敬请期待！");
        }
    </script>
</ul>