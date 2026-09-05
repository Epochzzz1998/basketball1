import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="404"
      subTitle={t("页面不存在。")}
      extra={<Button type="primary" onClick={() => navigate('/')}>{t("返回首页")}</Button>}
    />
  )
}
