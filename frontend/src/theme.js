/**
 * 全站主题（antd v5 Design Token）。
 * antd v5 不再用 less 覆盖样式，而是"设计令牌"：在 ConfigProvider 上改一份 token，
 * 按钮/链接/选中态/表头等所有组件的派生色（hover、浅色底、边框）自动跟着算出来。
 * 主色取"篮球橙"（volcano），贴合站点气质。
 */
export const themeConfig = {
  token: {
    colorPrimary: '#fa541c', // 篮球橙（volcano-6）
    colorInfo: '#fa541c',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Layout: {
      bodyBg: '#f5f5f5', // 内容区灰底，让白色卡片"浮"出来
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
}
