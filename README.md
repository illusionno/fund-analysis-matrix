# 📈 Fund Analysis Matrix (基金/股票/黄金 矩阵面板)

![React](https://img.shields.io/badge/React-19.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF.svg)
![Ant Design](https://img.shields.io/badge/Ant_Design-6.3-1890FF.svg)
![Zustand](https://img.shields.io/badge/Zustand-5.0-black.svg)
![ECharts](https://img.shields.io/badge/ECharts-5.6-E43961.svg)

**Fund Analysis Matrix** 是一个基于 React + Serverless 架构的现代化金融行情看板应用。
它能够聚合来自于东方财富、天天基金等平台的实时数据，支持基金、A股/美股/港股、黄金 (XAU) 的同屏追踪，并集成大语言模型 (LLM) 为你提供个性化的每日行情 AI 复盘。

---

## ✨ 核心特性

- 🎯 **全品类聚合**：无需在不同 App 间来回切换，支持统一添加基金代码、股票代码或直接追踪国际金价 (XAU)。
- 🤖 **AI 智能复盘**：基于大语言模型（如 GPT-4 / DeepSeek），一键读取你当前自选列表的整体表现，生成专属的宏观/微观市场复盘摘要。
- 📊 **交互式 K 线图表**：集成 Apache ECharts，点击卡片即可查看个股或基金的历史走势（支持日/周/月/年级别切换）。
- 🌗 **丝滑的深浅色主题**：精心设计的暗色 (Dark) / 亮色 (Light) 双主题体系，结合科技感十足的 HTML5 Canvas 动态粒子背景与毛玻璃 (Glassmorphism) 材质，提供极致的视觉体验。
- ⚡ **现代化技术栈**：采用 React 19 + Zustand 持久化存储，配合 Vite 7 带来的极速构建体验。
- ☁️ **Serverless 友好**：BFF (Backend for Frontend) 架构设计。所有的跨域代理、数据清洗和大模型请求均封装在 API 层（兼容 Vercel/Netlify Functions），前端只需关注纯粹的 UI 渲染。

---

## 🛠️ 技术栈

### 前端 (Frontend)
- **核心框架**: React 19, TypeScript
- **构建工具**: Vite 7
- **UI 组件库**: Ant Design 6
- **状态管理**: Zustand (含持久化插件)
- **数据可视化**: ECharts (echarts-for-react)
- **样式方案**: SCSS, CSS Variables

### 后端 / API 层 (BFF)
- **运行环境**: Node.js
- **部署架构**: Serverless Functions (Vercel Node API)
- **数据源**: 东方财富实时/历史接口、天天基金估值接口
- **AI 接入**: 兼容 OpenAI 格式的大语言模型 API

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/fund-matrix.git
cd fund-matrix
```

### 2. 安装依赖

```bash
npm install
# 或者使用 pnpm / yarn
```

### 3. 配置环境变量

在项目根目录创建一个 `.env.local` 文件，配置你的大模型 API 密钥（用于 AI 复盘功能）：

```env
# 必须：你的大模型 API Key (如 OpenAI, DeepSeek 等)
OPENAI_API_KEY=sk-xxxxxxxxx

# 可选：API 代理地址 (默认为官方地址)
OPENAI_API_BASE=https://api.openai.com/v1

# 可选：使用的模型名称
OPENAI_MODEL=gpt-4o-mini
```
> **注意**：如果未配置该文件，应用的基础行情功能仍可正常使用，仅 AI 复盘功能会提示未配置。

### 4. 启动本地开发服务器

```bash
npm run dev
```
打开浏览器访问 `http://localhost:5173` 即可预览。在开发模式下，Vite 会自动拦截 `/api/*` 请求并使用本地的 Node.js 逻辑进行处理。

---

## 📦 生产构建与部署

### 构建静态文件
```bash
npm run build
```
执行完毕后，前端静态产物将生成在 `dist` 目录下。

### Vercel 部署 (推荐)
本项目原生适配 Vercel 的 Serverless 架构，你可以直接将仓库导入 Vercel：
1. 在 Vercel 控制台导入该 GitHub 仓库。
2. 在 **Environment Variables** 选项卡中，填入你的 `OPENAI_API_KEY` 等环境变量。
3. 点击 Deploy，Vercel 会自动将根目录下的 `api/` 文件夹部署为 Serverless Functions，并将其与前端的静态文件完美结合。

---

## 🏗️ 架构概览

```text
fund-matrix/
├── api/                    # Serverless 接口入口 (Vercel Functions)
│   ├── lib/                # 后端核心逻辑 (数据清洗、AI 调用、K线聚合)
│   ├── quote.ts            # 实时行情聚合接口
│   ├── kline.ts            # 历史走势接口
│   └── review.ts           # AI 复盘接口
├── src/                    # 前端源代码
│   ├── assets/             # SVG 图标与静态资源
│   ├── components/         # React 业务组件 (Header, QuoteBoard, 等)
│   ├── context/            # React Context (主题切换等)
│   ├── services/           # 前端 API 请求封装
│   ├── store/              # Zustand 状态库 (自选列表等)
│   ├── styles/             # SCSS 样式及 AntD 覆盖
│   ├── theme/              # Ant Design 自定义 Token
│   ├── App.tsx             # 应用主入口与 Canvas 粒子背景
│   └── main.tsx            # React 挂载点
├── vite.config.ts          # Vite 配置及本地开发接口代理
└── package.json            # 依赖管理
```

---

## 📄 声明与免责

本项目获取的行情数据具有一定的延迟性，且大模型生成的复盘内容具有不可预测性。**本项目仅供编程学习与技术交流使用，不构成任何投资建议。市场有风险，决策请独立判断。**

## 📄 开源协议

基于 [MIT License ](MIT) License](LICENSE) 开源，请自行补充) 开源。请自由地自由地享受构建并享受编码，自由探索。