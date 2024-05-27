package com.dream.basketball.utils;

import com.alibaba.fastjson.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Random;

@Component
public class FileUtils{

    private static String picPath;

    @Value("${picPath.picPath:}")
    public void setPicPath(String picPath){
        FileUtils.picPath = picPath;
    }

    public static String upload(MultipartFile file,String path1, String path2) throws IOException {
        FileOutputStream out = null;
        long timestamp = new Date().getTime();
        String fileName = timestamp + getSuffix(file.getOriginalFilename());
        try {
            //这个路径用来映射成虚拟路径的(可以调用方法的时候传)
//        String path1 = "e:/photo/";
            //这个路径加上文件名是存入数据库的(可以调用方法的时候传)
//        String path2 = "img/";
            //获取文件名（比如123.jpg）
//        String fileName = file.getOriginalFilename();

            //如果想要生成新的文件名就调用方法（最好是生成新的，或者新的和原来的一起用，不然文件名重复的话，文件上传后便会被覆盖）
            //String newFileName=getNewFileName(fileName);
            //String suffix=getSuffix(fileName);
            //String fileName1=newFileName+suffix;

            File filed = new File(path1 + path2);

            //photo文件夹存在才会创建img
            //file.mkdir();

            //photo文件夹不存在便会同时创建photo和img
            if (!filed.exists()) {
                filed.mkdirs();
            }
            out = new FileOutputStream(path1 + path2 + fileName);
            // 二进制流写入
            out.write(file.getBytes());
            out.flush();
            return getReturnStr(picPath + path2, fileName, "上传成功", 0);
        } catch (IOException e){
            e.printStackTrace();
            return getReturnStr(picPath + path2, fileName, e.toString(), 1);
        } finally {
            if (out != null) {
                out.close();
            }
        }
    }

    /**
     * 获取文件的后缀名（比如.jpg）
     *
     * @param fileName 文件名(123.jpg)
     * @return
     */
    public static String getSuffix(String fileName) {
        return fileName.substring(fileName.lastIndexOf("."));
    }

    /**
     * 获取文件名（比如123）
     *
     * @param fileName 文件名(123.jpg)
     * @return
     */
    public static String getFileName(String fileName) {
        return fileName.substring(0, fileName.lastIndexOf("."));
    }
    /**
     * 生成新的文件名（比如从123变成2021022614251412345）
     *
     * @param fileName 文件名(123.jpg)
     * @return
     */
    public static String getNewFileName(String fileName) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMddHHmmss");
        String date = sdf.format(new Date());
        String result = "";
        Random random = new Random();
        for (int i = 0; i < 5; i++) {
            result += random.nextInt(10);
        }
        return date+result;
    }

    /**
    * @Description: layui前端layedit控件图片处理返回字符串
    * @param: [path, fileName, noticeWords, code]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/5/27
    * @time: 16:53
    */
    public static String getReturnStr(String path, String fileName, String noticeWords, int code){
        JSONObject jsonObject1 = new JSONObject();
        jsonObject1.put("code", code);
        jsonObject1.put("msg", noticeWords);
        JSONObject data = new JSONObject();
        data.put("src", path + fileName);
        data.put("title", fileName);
        jsonObject1.put("data", data);
        return jsonObject1.toJSONString();
    }
}