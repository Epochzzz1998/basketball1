package com.dream.basketball.utils;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 上传瘦身的行为约束。这段代码碰的是用户的原始文件，压坏了没法还原，
 * 所以「什么时候不该动」比「能压多小」更需要被钉死。
 */
class ImageUtilTest {

    /** 造一张有渐变的图，纯色图会被压到几乎为零，测不出真实行为 */
    private static byte[] jpeg(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        for (int x = 0; x < w; x += 4) {
            g.setColor(new Color((x * 7) % 255, (x * 13) % 255, (x * 29) % 255));
            g.fillRect(x, 0, 4, h);
        }
        g.dispose();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, "jpeg", bos);
        return bos.toByteArray();
    }

    private static byte[] pngWithAlpha(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(255, 0, 0, 128));
        g.fillRect(0, 0, w / 2, h);
        g.dispose();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bos);
        return bos.toByteArray();
    }

    private static BufferedImage decode(byte[] d) throws Exception {
        return ImageIO.read(new ByteArrayInputStream(d));
    }

    // ---------- 该压的压 ----------

    @Test
    void oversizedJpeg_isShrunk() throws Exception {
        byte[] big = jpeg(3840, 2160);
        ImageUtil.Result r = ImageUtil.shrink(big, "jpg");
        assertTrue(r.data.length < big.length, "4K 图应该被压小");
        BufferedImage out = decode(r.data);
        assertEquals(1600, Math.max(out.getWidth(), out.getHeight()), "长边应该缩到 1600");
        assertEquals("jpg", r.ext);
    }

    @Test
    void aspectRatio_isKept() throws Exception {
        ImageUtil.Result r = ImageUtil.shrink(jpeg(3200, 800), "jpg");
        BufferedImage out = decode(r.data);
        assertEquals(1600, out.getWidth());
        assertEquals(400, out.getHeight(), "4:1 的图缩完还得是 4:1");
    }

    // ---------- 不该动的别动 ----------

    @Test
    void smallImage_isLeftAlone() throws Exception {
        byte[] small = jpeg(400, 300);
        ImageUtil.Result r = ImageUtil.shrink(small, "jpg");
        assertSame(small, r.data, "尺寸和体积都没超标，应该原样返回同一个数组");
    }

    @Test
    void gif_isNeverTouched() {
        byte[] fake = new byte[]{'G', 'I', 'F', '8', '9', 'a', 0, 1, 2, 3};
        ImageUtil.Result r = ImageUtil.shrink(fake, "gif");
        assertSame(fake, r.data, "动图压完只剩第一帧，绝对不能碰");
    }

    @Test
    void documents_arePassedThrough() {
        byte[] pdf = new byte[]{'%', 'P', 'D', 'F', '-', '1', '.', '4'};
        assertSame(pdf, ImageUtil.shrink(pdf, "pdf").data);
        assertSame(pdf, ImageUtil.shrink(pdf, "zip").data);
    }

    @Test
    void brokenBytes_fallBackToOriginal() {
        byte[] junk = new byte[]{1, 2, 3, 4, 5, 6, 7, 8};
        ImageUtil.Result r = ImageUtil.shrink(junk, "jpg");
        assertSame(junk, r.data, "解不开就退回原件，不能把上传搞失败");
    }

    /** 这是实测踩到的：一张 211KB 的图重编码后变成 357KB。结果更大就必须丢弃。 */
    @Test
    void neverGrowsTheFile() throws Exception {
        for (int w : new int[]{800, 1200, 1600, 2000, 3000}) {
            byte[] src = jpeg(w, w * 3 / 4);
            ImageUtil.Result r = ImageUtil.shrink(src, "jpg");
            assertTrue(r.data.length <= src.length,
                    w + "px 的图压完反而变大了（" + src.length + " → " + r.data.length + "）");
        }
    }

    // ---------- 透明通道 ----------

    @Test
    void transparentPng_staysPng() throws Exception {
        byte[] png = pngWithAlpha(2400, 2400);
        ImageUtil.Result r = ImageUtil.shrink(png, "png");
        assertEquals("png", r.ext, "带透明的图转 JPEG 会把透明底变成黑块");
        BufferedImage out = decode(r.data);
        assertNotNull(out);
        assertTrue(out.getColorModel().hasAlpha(), "透明通道要保住");
    }

    // ---------- EXIF 方向 ----------

    @Test
    void noExif_readsAsUpright() throws Exception {
        assertEquals(1, ImageUtil.exifOrientation(jpeg(100, 100)));
    }

    @Test
    void nonJpegBytes_readAsUpright() {
        assertEquals(1, ImageUtil.exifOrientation(new byte[]{1, 2, 3}));
        assertEquals(1, ImageUtil.exifOrientation(new byte[0]));
    }

    /** 手工拼一段带 Orientation=6（顺时针 90°）的最小 EXIF，确认能读出来。 */
    @Test
    void exifOrientation_isParsed() {
        byte[] d = new byte[64];
        int i = 0;
        d[i++] = (byte) 0xFF; d[i++] = (byte) 0xD8;              // SOI
        d[i++] = (byte) 0xFF; d[i++] = (byte) 0xE1;              // APP1
        d[i++] = 0; d[i++] = 40;                                  // 段长
        d[i++] = 'E'; d[i++] = 'x'; d[i++] = 'i'; d[i++] = 'f'; d[i++] = 0; d[i++] = 0;
        int tiff = i;
        d[i++] = 'I'; d[i++] = 'I'; d[i++] = 42; d[i++] = 0;      // 小端 + 魔数
        d[i++] = 8; d[i++] = 0; d[i++] = 0; d[i++] = 0;           // IFD0 偏移 = 8
        d[i++] = 1; d[i++] = 0;                                   // 条目数 = 1
        d[i++] = 0x12; d[i++] = 0x01;                             // tag 0x0112
        d[i++] = 3; d[i++] = 0;                                   // type = SHORT
        d[i++] = 1; d[i++] = 0; d[i++] = 0; d[i++] = 0;           // count = 1
        d[i++] = 6; d[i] = 0;                                     // value = 6
        assertEquals(6, ImageUtil.exifOrientation(d), "应该读出 Orientation=6");
        assertTrue(tiff > 0);
    }

    // ---------- 去重命名 ----------

    @Test
    void sameBytes_sameName_differentBytes_differentName() {
        byte[] a = "hello world".getBytes();
        byte[] b = "hello world".getBytes();
        byte[] c = "hello worle".getBytes();
        assertEquals(FileUtils.contentName(a), FileUtils.contentName(b), "同样的内容必须得到同样的文件名，去重靠它");
        assertEquals(32, FileUtils.contentName(a).length());
        assertArrayEquals(a, b);
        assertTrue(!FileUtils.contentName(a).equals(FileUtils.contentName(c)));
    }
}
