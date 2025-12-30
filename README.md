# SHNU Playbrary

上海师范大学图书馆的沉浸式像素风读书冒险。前端使用 React + Vite，剧情由智谱 API（GLM-4.6V-Flash）生成，插画由智谱 API（CogView-3-Flash）生成，所有敏感调用统一由本地 API 代理保护。

## 开发环境

- Node.js >= 18（内置 `fetch` + 原生 ESM）
- npm / pnpm / yarn（示例使用 npm）
- 智谱 `ZHIPU_TEXT_API_KEY`
- 智谱 `ZHIPU_IMAGE_API_KEY`

## 安装依赖

```bash
npm install
```

> 首次安装会生成 `package-lock.json`，请一并提交以锁定依赖版本。

## 一键准备（推荐）

把“安装依赖 + 生成 `.env.local` + 类型检查”整合成一次性脚本：

```bash
node setup.mjs
```

也可以用 npm 脚本：

```bash
npm run setup
```

可选参数：
- `node setup.mjs --install-only`：只安装依赖并生成 `.env.local`
- `node setup.mjs --no-typecheck`：跳过类型检查

> 通过 `npm run setup` 传参时需要 `--`：`npm run setup -- --no-typecheck`

### Windows (PowerShell) 说明

如果你在 PowerShell 里执行 `npm`/`npx` 提示“禁止运行脚本（npm.ps1）”，请改用 `npm.cmd`/`npx.cmd`（或调整 PowerShell ExecutionPolicy）：

```bash
npm.cmd install
npm.cmd run dev
```

## 环境变量与 API Key 存储

1. 在项目根目录创建 `.env.local`（已列入 `.gitignore`），可从 `.env.example` 复制并修改：

   ```bash
   ZHIPU_TEXT_API_KEY=your-zhipu-text-key
   ZHIPU_STORY_MODEL=glm-4.6v-flash
   ZHIPU_STORY_TIMEOUT_MS=120000
   ZHIPU_TEMPERATURE=0.7
   ZHIPU_SCENE_MAX_CHARS=420          # 文生文：scene_description 最大字数（服务端会截断+提示词约束）
   ZHIPU_OPTION_TEXT_MAX_CHARS=15     # 文生文：每个选项 text 最大字数（服务端会截断+提示词约束）
   ZHIPU_IMAGE_API_KEY=sk-xxx  # 文生图，不要加 "Bearer " 前缀
   API_PORT=8788
   ALLOWED_ORIGINS=http://localhost:5173
   VITE_API_BASE_URL=http://localhost:8788   # 前端访问后端 API 的地址
   # 图像生成（智谱 CogView-3-Flash 在线 API）
   ZHIPU_IMAGE_MODEL=cogview-3-flash
   ZHIPU_IMAGE_SIZE=896x672
   ZHIPU_IMAGE_STYLE_PREFIX=8-bit复古的SNES时代风格  # 文生图：会自动拼到 image_prompt 前面做统一画风
   ZHIPU_IMAGE_WATERMARK_ENABLED=false
   ZHIPU_IMAGE_TIMEOUT_MS=120000
   ZHIPU_IMAGE_CONTENT_FILTER_LEVEL=3
   ZHIPU_MAX_CONCURRENT=2          # 同时请求上游的最大并发
   LOG_DIR=server/logs            # 可选：服务端日志目录
   LOG_FILE=server/logs/server.jsonl # 可选：服务端日志文件
   VITE_HOST=localhost            # 可选：Vite 监听地址（需要外网访问可设 0.0.0.0）
   VITE_PORT=5173                 # 可选：Vite 端口
   ```

2. 服务端启动时会先加载 `.env`，再用 `.env.local` 覆盖，统一通过 `server/config/env.ts` 校验并注入，避免在代码里直接访问 `process.env`。
3. 线上部署请使用平台提供的 Secret / Environment Variable 功能，不要把密钥写入镜像或仓库。
4. 图像生成接口返回图片 URL，前端直接渲染该 URL。

**前后端不同源时的统一配置**
- `VITE_API_BASE_URL` 指向部署好的后端（如 `https://api.yourdomain.com`）
- 同时将该域名加入 `ALLOWED_ORIGINS`，以便 CORS 放行
- 本地开发如果 Vite 端口可能变化（5173 被占用时会自动换端口），可把 `ALLOWED_ORIGINS` 设为 `http://localhost`（不写端口）以放行所有 localhost 端口

## 生成参数

### 文生文（剧情/选项）

- **剧情字数上限**：`ZHIPU_SCENE_MAX_CHARS`  
  - 生效位置：`server/services/zhipuService.ts`（`SCENE_DESCRIPTION_MAX_CHARS`，用于提示词约束 + 服务端截断）
- **选项文字上限**：`ZHIPU_OPTION_TEXT_MAX_CHARS`  
  - 生效位置：`server/services/zhipuService.ts`（`OPTION_TEXT_MAX_CHARS`，用于提示词约束 + 服务端截断）
- **选项规则 Prompt（A/B/C 的要求）**：  
  - 生效位置：`server/services/zhipuService.ts` 的 `fetchStory()` 里 `system` 提示词（包含“必须 3 个选项、互斥、动词开头、禁止空泛选项”等规则）
- **主角强制一致（角色锚定）**：  
  - 前端会把 `protagonistName` 带回服务端；服务端会在 prompt 里强约束并在不一致时修复  
  - 生效位置：`shared/game.ts`（请求字段）、`server/routes/game.ts`（解析字段）、`server/services/zhipuService.ts`（`protagonistRule` / `ensureProtagonist`）

### 文生图（插画）

- **文生图 Prompt 组成**：`最终 prompt = ZHIPU_IMAGE_STYLE_PREFIX + story.image_prompt`  
  - 生效位置：`server/services/zhipuService.ts` 的 `applyImageStyle()`（会把统一画风前缀拼到模型返回的 `image_prompt` 前）
- **默认画风前缀**：`ZHIPU_IMAGE_STYLE_PREFIX`  
  - 生效位置：`server/services/zhipuService.ts`（`IMAGE_STYLE_PREFIX`）
- **图片尺寸/模型**：`ZHIPU_IMAGE_SIZE`、`ZHIPU_IMAGE_MODEL`  
  - 生效位置：`server/services/zhipuService.ts` 的 `fetchImageUrl()`（请求参数 `size` / `model`）

## 运行

开发模式会同时启动 React 前端与本地 API 代理：

```bash
npm run dev
```

服务端健康检查：
- `GET http://localhost:8788/health`
- `GET http://localhost:8788/api/health`

- `npm run dev:client`：仅运行 Vite（默认端口 5173）
- `npm run dev:server`：仅运行 API 代理（默认端口 8788）

## 构建与部署

前端：

```bash
npm run build
```

产物位于 `dist/`，可托管到任意静态站点（Vercel、Netlify、OSS 等）。

后端（API 代理）：

1. 部署 `server/` 下的 Node 服务，可用 `tsx server/index.ts` 或编译后运行。
2. 确保运行环境设置好 `ZHIPU_TEXT_API_KEY` 与 `ZHIPU_IMAGE_API_KEY` 等变量。
3. 生产环境建议放在支持 HTTPS 的 Node 运行时（如 Render、Railway、Cloud Run 等），并在前端 `VITE_API_BASE_URL` 指向该地址。

## 目录结构

```
├── src/                    # React 组件、hooks、常量与样式
├── server/                 # Express API（封装智谱调用）
├── shared/                 # 前后端共享的 TypeScript 类型
├── tsconfig*.json          # 前端/服务端独立的 TS 配置
└── vite.config.ts          # 构建与别名配置
```

## 常用脚本

| 命令                      | 作用                                   |
| ------------------------- | -------------------------------------- |
| `npm run dev`             | 并行启动前端与 API 服务器              |
| `npm run dev:client`      | 仅启动 Vite                             |
| `npm run dev:server`      | 仅启动 API 代理                         |
| `npm run build`           | 构建前端静态资源                        |
| `npm run preview`         | 本地预览构建产物                        |
| `npm run typecheck`       | 前端类型检查                            |
| `npm run typecheck:server`| 后端类型检查                            |

## 安全说明

- 前端不再直接持有 API Key，所有敏感调用由 `server/routes/game.ts` 提供的 `/api/play-turn` 代理处理。
- `vite.config.ts` 默认绑定 `localhost`，避免本地调试时暴露到局域网；如需外网访问可设置 `VITE_HOST=0.0.0.0`。
- 依赖版本通过 `package-lock.json` 固定，防止构建时自动升级带来的供应链风险。

3.多分支决策：每个回合都会面临三个不同的行动选项（A/B/C），用户的每一个选择都会改变后续剧情的发展。
4.AI 绘图：利用文生图技术，根据当前剧情动态生成 8-bit 复古像素风格 的场景插画
5.画风设计：整体 UI 采用了复古游戏（如 Pokemon 或 SNES 时代）的界面设计，包含像素字体、跳动的文字动画和具有颗粒感的视觉滤镜。
6.馆藏链接：游戏会根据书名，自动关联到 上海师范大学图书馆 的官方查询系统（findshnu.libsp.cn）。
