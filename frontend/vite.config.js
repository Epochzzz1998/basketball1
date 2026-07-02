import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // 开发期把所有后端接口前缀代理到本地运行的 Spring Boot（localhost:8088），
    // 浏览器只与 5173 通信，从而完全避开跨域（CORS）。生产由后端同源提供。
    proxy: {
      "/api": { target: "http://localhost:8088", changeOrigin: true },
      "/user": { target: "http://localhost:8088", changeOrigin: true },
      "/player": { target: "http://localhost:8088", changeOrigin: true },
      "/team": { target: "http://localhost:8088", changeOrigin: true },
      "/news": { target: "http://localhost:8088", changeOrigin: true },
      "/userInformation": { target: "http://localhost:8088", changeOrigin: true },
      "/picImg": { target: "http://localhost:8088", changeOrigin: true }
    }
  }
})
