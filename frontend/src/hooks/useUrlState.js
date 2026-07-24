import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * 把一个页面级选择（赛季/赛段等）同步进 URL 查询串（replace，不新增历史记录）。
 * 意义：进次级页面再点返回时，父页从 URL 恢复用户选中的值，而不是跳回默认值。
 * @param key    查询参数名（如 'seasonNum'、'stage'）
 * @param fallback URL 没带该参数时的初始值
 * @param isNumber 参数按数字解析（赛季号）
 */
export default function useUrlState(key, fallback, isNumber = false) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(key)
  const fromUrl = raw == null ? null : isNumber ? Number(raw) || null : raw
  const [value, setValue] = useState(fromUrl ?? fallback)

  const change = (v) => {
    setValue(v)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set(key, v)
      return p
    }, { replace: true })
  }
  return [value, change]
}
