import { useState } from 'react'
import { Image, Popconfirm, Rate, Upload, message } from 'antd'
import { CloseCircleFilled, DeleteOutlined, LoadingOutlined, PictureOutlined, StarFilled } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 打分对象配图选择器（开分表单用，发帖页/评论区共用）：虚线上传方块（橙色调，与打分卡同系），
 * 传完原位变缩略图 + 右上角移除，前后同尺寸不跳动。
 * upload(file) => Promise<url>（外部决定传到哪，通常 newsApi.uploadNewsImage 归到帖子目录）。
 */
const PICKER_SIZE = 64

export function RatingImagePicker({ value, onChange, upload }) {
  const [uploading, setUploading] = useState(false)
  if (value) {
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={value}
          alt=""
          style={{ width: PICKER_SIZE, height: PICKER_SIZE, objectFit: 'cover', borderRadius: 10, border: '1px solid #ffd591', display: 'block' }}
        />
        <CloseCircleFilled
          onClick={() => onChange('')}
          style={{ position: 'absolute', top: -7, right: -7, color: '#00000073', cursor: 'pointer', fontSize: 16, background: '#fff', borderRadius: '50%' }}
        />
      </span>
    )
  }
  return (
    <Upload
      accept="image/*"
      showUploadList={false}
      customRequest={async ({ file, onSuccess, onError }) => {
        setUploading(true)
        try {
          const url = await upload(file)
          if (url) onChange(url)
          onSuccess?.(url)
        } catch (e) {
          message.error('图片上传失败')
          onError?.(e)
        } finally {
          setUploading(false)
        }
      }}
    >
      <style>{'.rating-img-picker:hover{border-color:#fa8c16 !important;background:#fff3e0 !important;color:#d46b08 !important}'}</style>
      <div
        className="rating-img-picker"
        style={{
          width: PICKER_SIZE, height: PICKER_SIZE, boxSizing: 'border-box',
          border: '1.5px dashed #ffc069', background: '#fffaf0', borderRadius: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fa8c16', cursor: 'pointer', transition: 'all .15s', userSelect: 'none',
        }}
      >
        {uploading ? <LoadingOutlined style={{ fontSize: 18 }} /> : <PictureOutlined style={{ fontSize: 18 }} />}
        <span style={{ fontSize: 11, marginTop: 3 }}>{uploading ? '上传中' : '配图'}</span>
      </div>
    </Upload>
  )
}

/**
 * 打分卡：均分大字 + 只读星（半星）+ 人数 + 5→1 星分布条 + 我的评分行（点星打/改）。
 * item = {itemId, subject, avg, count, dist{1..5:人数}, myScore}；数据由上层（NewsDetail）统一持有，
 * onVote(itemId, score) 打分/改分；canDelete 时右上出删除（超管或楼主）；disabled=帖已锁定只读。
 */
export default function RatingCard({ item, onVote, onDelete, canDelete, disabled }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const count = item.count || 0
  const avg = Number(item.avg || 0)
  const dist = item.dist || {}

  const handleVote = (score) => {
    if (!score) return // Rate 点同星会回 0（清除），打分场景忽略
    if (!user) { message.info('请先登录'); navigate('/login'); return }
    if (disabled) { message.info('该帖已被锁定，暂不能打分'); return }
    onVote?.(item.itemId, score)
  }

  return (
    <div
      style={{
        background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 12,
        padding: isMobile ? '12px 14px' : '14px 18px', maxWidth: 520,
      }}
    >
      {/* 头行：打分对象 + 删除 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StarFilled style={{ color: '#fa8c16' }} />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          为「{item.subject}」打分
        </span>
        {canDelete && (
          <Popconfirm title="删除该打分项？投票记录一并清除" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => onDelete?.(item.itemId)}>
            <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} />
          </Popconfirm>
        )}
      </div>

      {/* 配图（可点大图）+ 均分/分布：有图时左图右分 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            width={isMobile ? 76 : 92}
            height={isMobile ? 76 : 92}
            style={{ objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#fff1d6' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 均分 + 星 + 人数 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#fa8c16', lineHeight: 1 }}>
              {count ? avg.toFixed(1) : '-'}
            </span>
            <Rate disabled allowHalf value={count ? Math.round(avg * 2) / 2 : 0} style={{ fontSize: 16 }} />
            <span style={{ fontSize: 12, color: '#999' }}>{count} 人参与</span>
          </div>
          {/* 5→1 星分布条 */}
          {count > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[5, 4, 3, 2, 1].map((s) => {
                const n = dist[s] || dist[String(s)] || 0
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#999' }}>
                    <span style={{ width: 22, textAlign: 'right' }}>{s} 星</span>
                    <div style={{ flex: 1, height: 6, background: '#fff1d6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${count ? (n / count) * 100 : 0}%`, height: '100%', background: '#ffa940', borderRadius: 3 }} />
                    </div>
                    <span style={{ width: 26 }}>{n}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 我的评分 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #ffe2b8', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>我的评分</span>
        <Rate value={item.myScore || 0} onChange={handleVote} disabled={disabled} style={{ fontSize: 18 }} />
        <span style={{ fontSize: 12, color: '#bbb' }}>
          {disabled ? '已锁定' : item.myScore ? `已打 ${item.myScore} 星，点星可改` : '点星参与打分'}
        </span>
      </div>
    </div>
  )
}
