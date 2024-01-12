<ul class="layui-nav" lay-filter="">
    <li class="layui-nav-item"><a href="/">联盟数据</a></li>
    <li class="layui-nav-item"><a href="/news/newsList">新闻列表</a></li>
    <li class="layui-nav-item"><a href="">战队排行榜</a></li>
    <li class="layui-nav-item">
        <a href="javascript:;">球员数据</a>
        <dl class="layui-nav-child"> <!-- 二级菜单 -->
            <dd><a href="">得分榜</a></dd>
            <dd><a href="">篮板榜</a></dd>
            <dd><a href="">助攻榜</a></dd>
        </dl>
    </li>
    <li class="layui-nav-item">
        <a href="javascript:;">球队数据</a>
        <dl class="layui-nav-child"> <!-- 二级菜单 -->
            <dd><a href="">移动模块</a></dd>
            <dd><a href="">后台模版</a></dd>
            <dd><a href="">电商平台</a></dd>
        </dl>
    </li>
    <#if isSuperManager?? && isSuperManager != ''>
        <li class="layui-nav-item" style="float: right">
            <a href="javascript:;">后台管理</a>
            <dl class="layui-nav-child"> <!-- 二级菜单 -->
                <dd><a href="/player/playerManage">球员列表</a></dd>
                <dd><a href="/user/registPage">用户列表</a></dd>
                <dd><a href="/news/newsList">新闻列表</a></dd>
            </dl>
        </li>
    </#if>
    <#if isLogin?? && isLogin != ''>
        <li class="layui-nav-item" style="float: right"><a href="">社区</a></li>
        <li class="layui-nav-item" style="float: right">
            <a href=""><img src="" class="layui-nav-img">我</a>
            <dl class="layui-nav-child">
                <dd><a href="javascript:;">修改信息</a></dd>
                <dd><a href="javascript:;">安全管理</a></dd>
                <dd><a href="/user/loginOut">登出</a></dd>
            </dl>
        </li>
        <li class="layui-nav-item" style="float: right">
            <a href="">控制台<span class="layui-badge">9</span></a>
        </li>
        <li class="layui-nav-item" style="float: right">
            <a href="">个人中心<span class="layui-badge-dot"></span></a>
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

</ul>