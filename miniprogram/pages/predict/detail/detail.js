const api = require('../../../utils/api');

function toPercent(value) {
  if (typeof value !== 'number') return '--';
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeDetail(detail) {
  const probability = detail.probability || {};
  return {
    ...detail,
    probability: {
      ...probability,
      winText: toPercent(probability.win),
      drawText: toPercent(probability.draw),
      loseText: toPercent(probability.lose),
      handicapWinText: toPercent(probability.handicapWin),
      handicapDrawText: toPercent(probability.handicapDraw),
      handicapLoseText: toPercent(probability.handicapLose)
    },
    goalsRange: (detail.goalsRange || []).map((item) => ({
      ...item,
      probText: toPercent(item.prob)
    })),
    topScores: (detail.topScores || []).map((item) => ({
      ...item,
      probText: toPercent(item.prob)
    }))
  };
}

Page({
  data: {
    loading: false,
    matchId: null,
    detail: {}
  },

  onLoad(options) {
    const matchId = Number(options.matchId);
    if (!matchId) {
      wx.showToast({ title: '缺少matchId', icon: 'none' });
      return;
    }
    this.setData({ matchId });
    this.fetchDetail();
  },

  async fetchDetail() {
    this.setData({ loading: true });
    try {
      const detail = await api.getPredictDetail(this.data.matchId);
      this.setData({ detail: normalizeDetail(detail) });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
