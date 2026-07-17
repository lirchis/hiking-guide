# 山野路线探索器 · Hiking Guide

一个纯静态、数据驱动的徒步路线目录。路线价值和当前可走性分开呈现，帮助用户先比较景观、强度与季节，再核对开放、报备和客观风险。

## 当前进度

首个内容里程碑完成 **50 / 100 条路线**：

- 广东及周边 32 条
- 全国精选前 18 条
- 关键词、区域、难度和当前状态筛选
- 路线质量、景观评分、距离与季节排序
- 高密度桌面路线列表与手机端单列布局
- 浏览器端按需调用维基百科与 Wikimedia Commons，显示真实地点图片
- 图片懒加载、4 请求并发限制和 30 天本地缓存
- 图片详情保留摄影者、许可和 Wikimedia Commons 原始页面链接
- 路线详情和安全提醒弹窗
- URL 筛选状态，可复制当前筛选结果
- GitHub Pages 自动部署工作流

路线资料首批整理自[《山野路线探索器｜100条徒步路线精选（2026）》](https://my.feishu.cn/docx/HoFBdHWPKoBTwXx1S7BcXwG3nod)，数据版本为 2026-07-15。

## 技术约束

网站只使用 HTML、CSS、JavaScript 和 JSON：

- 无框架
- 无第三方运行时依赖
- 无服务端和数据库
- 无构建步骤
- 路线图片由前端直接调用 MediaWiki API，接口不可用时显示文字占位
- 所有路径均为相对路径，可部署在 GitHub Pages 的 `/hiking-guide/` 子路径

`package.json` 只提供本地预览和数据校验命令，不参与线上运行。

## 本地运行

```bash
npm run start
```

打开 <http://localhost:4176>。

运行语法和路线数据校验：

```bash
npm run check
```

## 发布到 GitHub Pages

仓库包含 `.github/workflows/pages.yml`。合并到 `main` 后：

1. 打开仓库的 **Settings → Pages**。
2. 将 **Source** 设为 **GitHub Actions**。
3. 手动运行一次 `Deploy static content to Pages`，或向 `main` 推送提交。
4. 部署完成后访问 `https://lirchis.github.io/hiking-guide/`。

GitHub Free 通常要求 Pages 源仓库为公开仓库；若继续使用私有仓库，需要支持私有 Pages 的 GitHub 计划。

## 目录结构

```text
.
├── .github/workflows/pages.yml
├── data
│   ├── trails.json
│   └── trails.schema.json
├── docs/PRODUCT.md
├── scripts/validate-data.js
├── src
│   ├── main.js
│   └── styles.css
├── .nojekyll
├── index.html
└── package.json
```

## 状态口径

- `available`：可纳入计划，但仍需在出发前复核。
- `verify`：开放边界、许可或现场条件需要先确认。
- `reference`：经典路线资料收录，不进入当前行程。
- `closed`：明确关闭或禁止穿越。

路线质量高不代表现在可走；第三方轨迹也不能证明一条路线被允许进入。

## 下一阶段

1. 录入剩余 50 条全国与全球路线。
2. 为路线补充官方来源链接和独立核验日期。
3. 增加地图、起点、GPX 和海拔剖面。
4. 增加信息过期提醒和变更记录。
