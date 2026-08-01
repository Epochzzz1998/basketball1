import { Button } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

/**
 * 专题页上的「文件」入口，和群聊钮并排。
 *
 * 只在超管给这个专题开了文件系统时出现（topic.filesEnabled）。样式抄群聊那颗——
 * 它们是同一类东西：不是又一个筛选视图，点下去是进另一个空间。
 */
export default function TopicFilesEntry({ topic }) {
  const navigate = useNavigate()
  if (!topic?.filesEnabled) return null
  return (
    <Button
      icon={<FolderOpenOutlined />}
      onClick={() => navigate(`/news/topic/${topic.topicId}/files`)}
      style={{ fontWeight: 600, borderRadius: 999, color: '#4a6fe0', borderColor: '#adc0f5', background: '#f4f7ff' }}
    >
      文件
    </Button>
  )
}
