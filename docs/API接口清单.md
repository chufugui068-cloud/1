# API 接口清单（V1）

## 1) 获取今日竞彩比赛
- `GET /api/matches/today`
- Query:
  - `league` (optional)
  - `page` `pageSize`
- Response:
```json
{
  "list": [
    {
      "matchId": 10001,
      "league": "英超",
      "matchTime": "2026-03-01 20:00:00",
      "homeTeam": "A",
      "awayTeam": "B",
      "latestPredictTime": "2026-03-01 18:30:00"
    }
  ]
}
```

## 2) 获取单场预测详情
- `GET /api/predict/detail`
- Query:
  - `matchId` (required)
- Response:
```json
{
  "match": {
    "matchId": 10001,
    "league": "英超",
    "homeTeam": "A",
    "awayTeam": "B",
    "matchTime": "2026-03-01 20:00:00"
  },
  "probability": {
    "win": 0.48,
    "draw": 0.29,
    "lose": 0.23,
    "handicapWin": 0.41,
    "handicapDraw": 0.32,
    "handicapLose": 0.27
  },
  "goalsRange": [
    {"range":"0-1", "prob":0.24},
    {"range":"2-3", "prob":0.51},
    {"range":"4+", "prob":0.25}
  ],
  "topScores": [
    {"score":"1-0", "prob":0.182},
    {"score":"1-1", "prob":0.156},
    {"score":"2-1", "prob":0.129}
  ],
  "reason": "主队近5场不败且ELO高出42分，结合盘口变化，稳健倾向主队不败。"
}
```

## 3) 获取历史记录
- `GET /api/history/list`
- Query:
  - `page` `pageSize`
  - `hitType` (optional: `wdl|score|all`)
- Response:
```json
{
  "list": [
    {
      "matchId": 10001,
      "homeTeam": "A",
      "awayTeam": "B",
      "predict": "胜",
      "finalScore": "2-1",
      "hitWDL": 1,
      "hitScore": 0,
      "settledAt": "2026-03-02 01:00:00"
    }
  ]
}
```

## 4) 触发预测重算（管理接口）
- `POST /api/admin/predict/recompute`
- Body:
```json
{
  "matchIds": [10001, 10002],
  "simulateCount": 5000,
  "modelVersion": "v1.0.0"
}
```

## 5) 用户VIP状态
- `GET /api/vip/status`
- Response:
```json
{
  "isVip": false,
  "planType": "monthly",
  "expireTime": null
}
```

## 6) 创建月卡订单（预留支付）
- `POST /api/vip/order/create`
- Body:
```json
{
  "planType": "monthly"
}
```
- Response:
```json
{
  "orderNo": "VIP202603010001",
  "amount": 29.00,
  "paymentStatus": "pending"
}
```

## 7) 模型参数更新（手动调参）
- `POST /api/admin/model/config/update`
- Body:
```json
{
  "modelVersion": "v1.0.1",
  "eloWeight": 0.35,
  "btWeight": 0.30,
  "mcWeight": 0.35,
  "riskStyle": "steady",
  "autoTuneEnabled": true,
  "manualOverrideEnabled": true
}
```
