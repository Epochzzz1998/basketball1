import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      /**
       * 用了没导入的组件（`<Foo />` 而 Foo 不存在）。
       *
       * **核心的 no-undef 抓不到这一类。** 没有 eslint-plugin-react 时，ESLint 的作用域分析
       * 不把 JSX 标识符当成变量引用，所以 `<NotDefined />` 一声不吭。实测过：
       * 同一个文件里 `const x = NotDefinedVar` 会报 no-undef，`<NotDefinedComponent />` 不会。
       *
       * 而这一类的后果是**运行时 ReferenceError → 整页白屏**，构建还照样成功
       * （打包器不检查自由变量）。这个项目已经因此白屏过两次。
       */
      'react/jsx-no-undef': 'error',

      /**
       * 只在 JSX 里用到的导入，会被 no-unused-vars 误判成"没用过"。
       * 这条规则把 JSX 里的引用标记为已使用，两条配合才不会互相打架。
       */
      'react/jsx-uses-vars': 'error',
    },
  },
])
