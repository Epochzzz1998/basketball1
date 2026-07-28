/**
 * 上传前在浏览器里把大图缩一缩。
 *
 * 为什么放在前端做：手机直接选的照片动辄 3-4MB、3840×2160，而聊天气泡最宽 220px。
 * 在这儿压掉之后，**上传流量、服务器磁盘、以后每次浏览的下行流量**三头都省——
 * 尤其是上传，4G 下传 3MB 和传 300KB 是两种体验。服务端另有一道兜底（ImageUtil），
 * 那道防的是绕过前端直接调接口的情况。
 *
 * 三条一定要守住的：
 *  1. 只压图片，其它文件原样返回；
 *  2. 压完比原来还大就用原件（本来就压好的小图会这样）；
 *  3. 任何一步出错都返回原件——图片压不动是小事，传不上去是大事。
 *
 * EXIF 方向：现代浏览器把图片画进 canvas 时会自动按 EXIF 转正，所以这里不用另外处理；
 * 但也因此**方向信息会随 EXIF 一起丢掉**，好在像素已经是正的了。
 */

const MAX_EDGE = 1600
const QUALITY = 0.82
/** 小于这个体积就别折腾了，重编码大概率反而更大 */
const SKIP_UNDER = 300 * 1024

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
  img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
  img.src = url
})

/**
 * @param {File} file 用户选中的文件
 * @returns {Promise<File>} 压好的 JPEG，或者原件
 */
export async function compressImage(file) {
  if (!file || !file.type?.startsWith('image/')) return file
  // GIF 画进 canvas 只剩第一帧，动图会被压成静态图
  if (file.type === 'image/gif') return file
  if (file.size <= SKIP_UNDER) return file

  try {
    const img = await loadImage(file)
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
    const k = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1
    const w = Math.round(img.naturalWidth * k)
    const h = Math.round(img.naturalHeight * k)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    // 透明底转 JPEG 会变黑，先铺一层白
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
