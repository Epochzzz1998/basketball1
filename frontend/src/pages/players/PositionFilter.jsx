import { Segmented } from 'antd'
import { POSITION_GROUPS } from './rankConfig'
import ControlGroup from './ControlGroup'
import { useTranslation } from 'react-i18next'

/**
 * 位置筛选器，所有球员数据排行共用。
 * 分组规则在 rankConfig 的 inPositionGroup（PG/SG→后卫，SF/PF→前锋）。
 */
export default function PositionFilter({ value, onChange }) {
  const { t } = useTranslation()
  return (
    <ControlGroup label={t("位置")}>
      <Segmented size="small" value={value || 'all'} onChange={onChange} options={POSITION_GROUPS} />
    </ControlGroup>
  )
}
