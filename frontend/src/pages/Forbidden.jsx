import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Forbidden() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Result
      status="403"
      title="403"
      subTitle={t("抱歉，你没有权限访问此页面。")}
      extra={<Button type="primary" onClick={() => navigate('/')}>{t("返回首页")}</Button>}
    />
  )
}
