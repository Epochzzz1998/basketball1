<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="../../layui/css/layui.css">
    <style type="text/css">
        .container{
            width: 420px;
            height: 220px;
            min-height: 320px;
            max-height: 320px;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            margin: auto;
            padding: 20px;
            z-index: 130;
            border-radius: 8px;
            background-color: #ffffff;
            box-shadow: 0 3px 18px rgb(0, 25, 100);
            font-size: 16px;
        }
        .close{
            background-color: white;
            border: none;
            font-size: 18px;
            margin-left: 410px;
            margin-top: -10px;
        }

        .layui-input{
            border-radius: 5px;
            width: 300px;
            height: 40px;
            font-size: 15px;
            margin-top: 12px;
        }
        .layui-form-item{
            margin-left: -20px;
        }
        #logoid{
            margin-top: -17px;
            padding-left:135px;
            padding-bottom: 15px;
        }
        .layui-btn{
            margin-left: -50px;
            border-radius: 5px;
            width: 350px;
            height: 40px;
            font-size: 15px;
        }
        .verity{
            width: 120px;
        }
        .font-set{
            font-size: 13px;
            text-decoration: none;
            margin-left: 120px;
        }
        a:hover{
            text-decoration: underline;
        }
        .bg { background-image: url('../../img/login-background.png'); background-size: cover; height: 100vh; }

    </style>
</head>
<body>
<form class="layui-form">
    <div class="bg"></div>
    <div class="container">
<#--        <button class="close" title="关闭">X</button>-->
<#--        <div class="layui-form-mid layui-word-aux" >-->
<#--            <img id="logoid" src="../../img/login_logo.png" height="35">-->
<#--        </div>-->
        <div class="layui-form-item">
            <label class="layui-form-label">用户名</label>
            <div class="layui-input-block">
                <input type="text" name="userNickname" required  lay-verify="required" placeholder="请输入用户名" autocomplete="off" class="layui-input">
            </div>
        </div>
        <div class="layui-form-item">
            <label class="layui-form-label">真实姓名</label>
            <div class="layui-input-block">
                <input type="text" name="userName" required  lay-verify="required" placeholder="真实姓名注册后不可修改" autocomplete="off" class="layui-input">
            </div>
        </div>
        <div class="layui-form-item">
            <label class="layui-form-label">密 &nbsp;&nbsp;码</label>
            <div class="layui-input-inline">
                <input type="password" name="password" required lay-verify="required" placeholder="请输入密码" autocomplete="off" class="layui-input">
            </div>
            <!-- <div class="layui-form-mid layui-word-aux">辅助文字</div> -->
        </div>
        <div class="layui-form-item">
            <label class="layui-form-label">确认密码</label>
            <div class="layui-input-inline">
                <input type="password" name="confirmPass" required lay-verify="required|confirmPass" placeholder="请输入确认密码" autocomplete="off" class="layui-input">
            </div>
            <!-- <div class="layui-form-mid layui-word-aux">辅助文字</div> -->
        </div>
<#--        <div class="layui-form-item">-->
<#--            <label class="layui-form-label">验证码</label>-->
<#--&lt;#&ndash;            <div class="layui-input-inline">&ndash;&gt;-->
<#--&lt;#&ndash;                <input type="text" name="title" required  lay-verify="required" placeholder="请输入验证码" autocomplete="off" class="layui-input verity">&ndash;&gt;-->
<#--&lt;#&ndash;            </div>&ndash;&gt;-->
<#--            <div class="layui-input-inline" style="width: 178px;">-->
<#--                <input type="text" id="code" name="code" required lay-verify="required" placeholder="请输入验证码" autocomplete="off" class="layui-input">-->
<#--                <img id="codeImage" src="/user/captcha" width="120px" height="48px" style="margin-top: -5px"  alt="点我更换" onclick="this.src='/user/captcha?'+Math.random()"/>-->
<#--            </div>-->
<#--&lt;#&ndash;            <input type="hidden" id="specCaptchaText" name="specCaptchaText" value="${specCaptchaText!}">&ndash;&gt;-->
<#--            <!-- <div class="layui-form-mid layui-word-aux">辅助文字</div> &ndash;&gt;-->

<#--        </div>-->
        <!-- 			  <div class="layui-form-item">
                            <label class="layui-form-label">记住密码</label>
                            <div class="layui-input-block">
                              <input type="checkbox" name="close" lay-skin="switch" lay-text="ON|OFF">
                            </div>
                      </div> -->

        <div class="layui-form-item">
            <div class="layui-input-block">
                <button class="layui-btn" lay-submit lay-filter="formDemo">注册</button>
            </div>
        </div>
<#--        <a href="" class="font-set">忘记密码?</a>  <a href="" class="font-set">立即注册</a>-->
    </div>
</form>
<script type="text/javascript" src="../../layui/layui.js"></script>
<#--<script type="text/javascript" src="../../js/jquery1.11.3.min.js"></script>-->
<script type="text/javascript" src="../../js/jquery-3.6.3.js"></script>
<script>
    layui.use(['form', 'laydate','layer'], function(){
        var form = layui.form
            ,layer = layui.layer
            ,laydate = layui.laydate;
        //日期
        /* laydate.render({
           elem: '#date'
         });
         laydate.render({
           elem: '#date1'
         });

         //创建一个编辑器
         var editIndex = layedit.build('LAY_demo_editor');

         //自定义验证规则
         form.verify({
           title: function(value){
             if(value.length < 5){
               return '标题至少得5个字符啊';
             }
           }
           ,pass: [
             /^[\S]{6,12}$/
             ,'密码必须6到12位，且不能出现空格'
           ]
           ,content: function(value){
             layedit.sync(editIndex);
           }
         });

         //监听指定开关
         form.on('switch(switchTest)', function(data){
           layer.msg('开关checked：'+ (this.checked ? 'true' : 'false'), {
             offset: '6px'
           });
           layer.tips('温馨提示：请注意开关状态的文字可以随意定义，而不仅仅是ON|OFF', data.othis)
         });*/
        form.verify({
            confirmPass : function(value) {
                if ($('input[name=password]').val() !== value)
                    return '两次密码输入不一致！';
            }
        });

        //监听提交
        form.on('submit(formDemo)', function(data){
            // layer.msg(JSON.stringify(data.field));
            $.ajax({
                url: '/user/regist',
                type: 'post',
                data: data.field,
                success: function (res) {
                    layer.confirm('注册成功！', {
                        btn: ['确定'] //可以无限个按钮
                        ,btn1: function(index, layero){
                            window.location.href = '/player/playerList';
                        }
                    });
                }
            });
            return false;
        });

        //表单初始赋值
        /* form.val('example', {
           "username": "贤心" // "name": "value"
           ,"password": "123456"
           ,"interest": 1
           ,"like[write]": true //复选框选中状态
           ,"close": true //开关状态
           ,"sex": "女"
           ,"desc": "我爱 layui"
         })*/


    });
</script>
</body>
</html>
