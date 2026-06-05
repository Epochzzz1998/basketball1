# 篮球项目 · 前端（Vite + React）

本目录是前后端分离后的**唯一前端工程**（P0-5 选定；详见 Obsidian `篮球项目改造/` 文档）。
技术栈：**Vite + React 19**。

## 开发 / 构建

```bash
npm install
npm run dev      # 本地开发，默认 http://localhost:5173
npm run build    # 生产构建，产物在 dist/
npm run preview  # 预览生产构建
npm run lint     # ESLint 检查
```

后端默认在 `http://localhost:8088`。开发期建议在 `vite.config.js` 配置 dev proxy，把 `/api` 转发到后端以避免跨域；生产部署再按实际方案处理。

## 目录结构

```
frontend/
├── public/        # 静态资源
├── src/
│   ├── assets/    # 图片等
│   ├── App.jsx    # 根组件
│   └── main.jsx   # 入口
├── index.html
├── vite.config.js
└── package.json
```

## 规划（随重构推进补充，见 Obsidian 阶段文档 P4/P5）

- **路由**：react-router
- **请求层**：封装 fetch/axios，统一对接后端返回体与鉴权（Session + CORS）
- **UI**：Ant Design v5；表格密集页可单独引入 `@ant-design/pro-components`（ProTable/ProForm），无需 Umi
- 按现有页面（用户 / 资讯 / 球员）逐屏迁移
