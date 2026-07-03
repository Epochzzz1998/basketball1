import { ConfigProvider, Segmented } from 'antd'

/**
 * 品牌橙胶囊分段器（全站统一的"现代化 Tab"）：
 * options: [{ value, icon, label }]。选中=橙色圆角滑块白字，浅灰内凹轨道。
 */
export default function PillTabs({ value, onChange, options, style }) {
  return (
    <ConfigProvider
      theme={{
        token: { borderRadius: 22, borderRadiusSM: 18 },
        components: {
          Segmented: {
            itemSelectedBg: '#fa541c',
            itemSelectedColor: '#ffffff',
            trackBg: '#efefef',
            itemColor: '#666',
            itemHoverColor: '#fa541c',
            itemHoverBg: 'rgba(250,84,28,0.08)',
          },
        },
      }}
    >
      <Segmented
        size="large"
        value={value}
        onChange={onChange}
        style={{ marginBottom: 16, padding: 4, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.04)', ...style }}
        options={options.map((o) => ({
          value: o.value,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
              {o.icon} {o.label}
            </span>
          ),
        }))}
      />
    </ConfigProvider>
  )
}
