# 竞彩智能分析网页应用（可直接运行）

## 先回答你最关心的问题
**需要下载到你的电脑上**，至少要有：
- `webapp/`
- `scripts/start-webapp-windows.bat`

不会 Git 也没关系：直接在仓库页面点击 `Code -> Download ZIP`，解压后即可运行。

## 快速开始
```bash
cd webapp
npm start
```

启动后访问：`http://localhost:8787`

## 电脑本地打开（新手最短路径）
1. 先安装 Node.js LTS（18/20 均可）。
2. 打开终端进入项目目录：`cd webapp`。
3. 启动服务：`npm start`。
4. 浏览器访问：`http://localhost:8787`。

详细图文步骤见：`docs/本地运行网页应用指南.md`。


### Windows 一键启动
你是 Windows 的话，推荐直接双击：
- `scripts/start-webapp-windows.bat`

或者终端执行：
```powershell
cd webapp
npm start
```

## 已实现功能
- 数据源选择（500彩票网 / 球探网）
- 今日竞彩足球比赛
- ELO 评分展示
- Bradley-Terry 概率展示
- 蒙特卡洛 5000 次模拟
- TOP3 波胆比分
- 推荐理由生成
- 历史记录与自我进化（权重自动微调）
- VIP 充值（月卡演示）

## 说明
- 当前为演示可运行版：数据为内置样例，可直接操作所有主流程。
- 下一步可把 `server.js` 内置数据替换成真实抓取与数据库。


## 实时抓取说明
- 接口 `GET /api/matches/today` 会优先尝试从 500 + 球探网页抓取当天比赛（不限五大联赛）。
- 若抓取失败，会自动回退到内置示例数据，接口返回 `mode` 与 `message` 说明当前状态。
- 前端“网页实时抓取”按钮会强制刷新抓取一次。

### 可选环境变量
- `MATCH_CACHE_TTL_MS`：比赛列表缓存时长（默认 180000ms）
- `FETCH_TIMEOUT_MS`：抓取超时时间（默认 8000ms）


## 实时抓取失败怎么排查
1. 先点页面里的“抓取诊断”按钮，看 `mode/message`。
2. 如果是 `fallback`，通常是目标站反爬、网络限制或页面结构变更。
3. 在 Windows 终端里设置备用网址后重启：
```powershell
$env:SOURCE_500_URL="https://trade.500.com/jczq/"
$env:SOURCE_QIUTAN_URL="https://live.titan007.com/oldIndexall.aspx"
npm start
```
4. 适当增大超时：`$env:FETCH_TIMEOUT_MS=15000`。
5. 若仍失败，保留 fallback 不中断服务，并更新解析规则（`parseMatchesFrom500/parseMatchesFromQiutan`）。
