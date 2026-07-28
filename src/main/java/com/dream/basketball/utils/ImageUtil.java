package com.dream.basketball.utils;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Iterator;

/**
 * 上传图片的瘦身：太大的图落盘前缩一缩再重编码。
 *
 * 为什么要做：群聊气泡最宽才 220px，帖子正文也就几百 px，但手机直接传上来的是
 * 3840×2160 的原图。实测同一张 4K 图，缩到长边 1600 + JPEG q82 之后从 2819KB 变成 272KB，
 * 省九成；而磁盘和 Cloudflare 隧道两头都跟着受益。
 *
 * 三条不能碰的红线：
 *  1. **只在确实偏大时才动**。实测一张 211KB 的图重编码后反而变成 357KB——原图本来就压好了，
 *     再压一次是用更差的画质换更大的体积。所以结果比原件大就一律丢弃，用原件。
 *  2. **GIF 不碰**。ImageIO 读进来只有第一帧，动图会被压成静态图。
 *  3. **EXIF 方向要自己处理**。ImageIO 读 JPEG 时不认 EXIF 的 Orientation，重编码又会把
 *     EXIF 丢掉，于是竖着拍的照片会横躺过来。这里先读出方向、把像素真正转正，再编码。
 */
public final class ImageUtil {

    /** 长边超过这个值才缩（群聊气泡 220px、正文几百 px，1600 足够清晰） */
    private static final int MAX_EDGE = 1600;
    /** 尺寸没超标但体积超过这个值时也重编码一次 */
    private static final long SIZE_THRESHOLD = 500L * 1024;
    private static final float JPEG_QUALITY = 0.82f;

    private ImageUtil() {
    }

    /** 处理结果：字节和最终扩展名（PNG 可能被转成 JPEG，扩展名要跟着变）。 */
    public static final class Result {
        public final byte[] data;
        public final String ext;

        Result(byte[] data, String ext) {
            this.data = data;
            this.ext = ext;
        }
    }

    /**
     * 该缩就缩，不该动就原样返回。任何一步出问题都退回原件——
     * 图片压不动是小事，把用户的图弄坏是大事。
     */
    public static Result shrink(byte[] data, String ext) {
        Result original = new Result(data, ext);
        String e = ext == null ? "" : ext.toLowerCase();
        boolean jpeg = "jpg".equals(e) || "jpeg".equals(e);
        if (!jpeg && !"png".equals(e)) {
            return original; // gif（动图）、webp、bmp 一律不碰
        }
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(data));
            if (img == null) {
                return original;
            }
            int orientation = jpeg ? exifOrientation(data) : 1;
            int longEdge = Math.max(img.getWidth(), img.getHeight());
            boolean tooBig = longEdge > MAX_EDGE || data.length > SIZE_THRESHOLD;
            if (!tooBig && orientation == 1) {
                return original;
            }
            boolean hasAlpha = img.getColorModel().hasAlpha();

            BufferedImage out = applyOrientation(img, orientation);
            longEdge = Math.max(out.getWidth(), out.getHeight());
            if (longEdge > MAX_EDGE) {
                double k = (double) MAX_EDGE / longEdge;
                out = scale(out, (int) Math.round(out.getWidth() * k), (int) Math.round(out.getHeight() * k), hasAlpha);
            }

            byte[] encoded;
            String outExt;
            if (hasAlpha) {
                // 带透明通道的 PNG 转成 JPEG 会把透明底变成黑块，只缩尺寸、仍旧存 PNG
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                ImageIO.write(out, "png", bos);
                encoded = bos.toByteArray();
                outExt = "png";
            } else {
                encoded = encodeJpeg(out);
                outExt = "jpg";
            }
            // 压完反而更大就别用了（本来就压好的小图会这样）
            return encoded.length > 0 && encoded.length < data.length ? new Result(encoded, outExt) : original;
        } catch (Throwable t) {
            return original;
        }
    }

    private static BufferedImage scale(BufferedImage src, int w, int h, boolean alpha) {
        BufferedImage dst = new BufferedImage(Math.max(1, w), Math.max(1, h),
                alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = dst.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src.getScaledInstance(dst.getWidth(), dst.getHeight(), java.awt.Image.SCALE_SMOOTH), 0, 0, null);
        g.dispose();
        return dst;
    }

    private static byte[] encodeJpeg(BufferedImage img) throws java.io.IOException {
        BufferedImage rgb = img;
        if (img.getType() != BufferedImage.TYPE_INT_RGB) {
            rgb = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            g.drawImage(img, 0, 0, java.awt.Color.WHITE, null);
            g.dispose();
        }
        Iterator<ImageWriter> it = ImageIO.getImageWritersByFormatName("jpeg");
        if (!it.hasNext()) {
            return new byte[0];
        }
        ImageWriter writer = it.next();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(bos)) {
            writer.setOutput(ios);
            ImageWriteParam p = writer.getDefaultWriteParam();
            if (p.canWriteCompressed()) {
                p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                p.setCompressionQuality(JPEG_QUALITY);
            }
            writer.write(null, new IIOImage(rgb, null, null), p);
        } finally {
            writer.dispose();
        }
        return bos.toByteArray();
    }

    /** 按 EXIF 方向把像素真正转正（1 = 本来就是正的，直接返回）。 */
    private static BufferedImage applyOrientation(BufferedImage src, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = orientation >= 5; // 5~8 都带 90 度旋转，宽高要对调
        BufferedImage dst = new BufferedImage(swap ? h : w, swap ? w : h,
                src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        AffineTransform t = new AffineTransform();
        switch (orientation) {
            case 2: t.scale(-1, 1); t.translate(-w, 0); break;                 // 水平镜像
            case 3: t.translate(w, h); t.rotate(Math.PI); break;               // 180°
            case 4: t.scale(1, -1); t.translate(0, -h); break;                 // 垂直镜像
            case 5: t.rotate(-Math.PI / 2); t.scale(-1, 1); break;             // 镜像 + 逆时针 90°
            case 6: t.translate(h, 0); t.rotate(Math.PI / 2); break;           // 顺时针 90°
            case 7: t.scale(-1, 1); t.translate(-h, 0); t.translate(0, w); t.rotate(-Math.PI / 2); break;
            case 8: t.translate(0, w); t.rotate(-Math.PI / 2); break;          // 逆时针 90°
            default: return src;
        }
        Graphics2D g = dst.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, t, null);
        g.dispose();
        return dst;
    }

    /**
     * 从 JPEG 字节里读 EXIF 的 Orientation（tag 0x0112）。读不到就当 1（正的）。
     *
     * 只走到 IFD0 就够了，不解析整份 EXIF：找 APP1 段 → 认 "Exif\0\0" → 读 TIFF 头定字节序
     * → 跳到 IFD0 → 逐条目找 0x0112。
     */
    static int exifOrientation(byte[] d) {
        try {
            if (d.length < 4 || (d[0] & 0xFF) != 0xFF || (d[1] & 0xFF) != 0xD8) {
                return 1; // 不是 JPEG
            }
            int i = 2;
            while (i + 4 < d.length) {
                if ((d[i] & 0xFF) != 0xFF) {
                    return 1; // 段结构对不上，别猜了
                }
                int marker = d[i + 1] & 0xFF;
                int len = ((d[i + 2] & 0xFF) << 8) | (d[i + 3] & 0xFF);
                if (marker == 0xE1 && i + 4 + 6 <= d.length
                        && d[i + 4] == 'E' && d[i + 5] == 'x' && d[i + 6] == 'i' && d[i + 7] == 'f') {
                    return orientationInTiff(d, i + 10); // 跳过 "Exif\0\0"
                }
                if (marker == 0xDA) {
                    return 1; // 到图像数据了，前面没有 EXIF
                }
                i += 2 + len;
            }
        } catch (Throwable ignore) {
            // 坏 EXIF 不该影响上传
        }
        return 1;
    }

    private static int orientationInTiff(byte[] d, int tiff) {
        if (tiff + 8 > d.length) {
            return 1;
        }
        boolean little = d[tiff] == 'I' && d[tiff + 1] == 'I';
        int ifd = tiff + readInt(d, tiff + 4, little);
        if (ifd + 2 > d.length) {
            return 1;
        }
        int count = readShort(d, ifd, little);
        for (int k = 0; k < count; k++) {
            int entry = ifd + 2 + k * 12;
            if (entry + 12 > d.length) {
                return 1;
            }
            if (readShort(d, entry, little) == 0x0112) {
                int v = readShort(d, entry + 8, little);
                return v >= 1 && v <= 8 ? v : 1;
            }
        }
        return 1;
    }

    private static int readShort(byte[] d, int p, boolean little) {
        return little
                ? (d[p] & 0xFF) | ((d[p + 1] & 0xFF) << 8)
                : ((d[p] & 0xFF) << 8) | (d[p + 1] & 0xFF);
    }

    private static int readInt(byte[] d, int p, boolean little) {
        return little
                ? (d[p] & 0xFF) | ((d[p + 1] & 0xFF) << 8) | ((d[p + 2] & 0xFF) << 16) | ((d[p + 3] & 0xFF) << 24)
                : ((d[p] & 0xFF) << 24) | ((d[p + 1] & 0xFF) << 16) | ((d[p + 2] & 0xFF) << 8) | (d[p + 3] & 0xFF);
    }
}
