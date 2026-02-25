# 可复制运行骨架（微信小程序）

## 1. 目录说明
- `miniprogram/`：小程序前端代码
- `cloudfunctions/getTodayMatches`：今日比赛云函数（示例数据）
- `cloudfunctions/getPredictDetail`：预测详情云函数（示例数据）

## 2. 运行步骤
1. 用微信开发者工具导入本仓库，`miniprogram` 作为小程序目录。
2. 打开“云开发”，创建并绑定你的环境。
3. 修改 `miniprogram/app.js` 中 `globalData.envId` 为你的环境ID（如 `prod-xxxx`）。
4. 在开发者工具上传并部署两个云函数：
   - `getTodayMatches`
   - `getPredictDetail`
5. 编译运行后，默认首页为“今日竞彩”，点击比赛可进入预测详情。

## 3. 下一步改造
- 将云函数里的示例数据替换为数据库查询或抓取结果。
- 把 `miniprogram/utils/api.js` 的 `USE_MOCK` 保持 `false`（已默认）。
- 后续增加历史记录页、VIP权限判断页。
