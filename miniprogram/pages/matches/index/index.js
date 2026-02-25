const api = require('../../../utils/api');

Page({
  data: {
    loading: false,
    leagueOptions: ['全部'],
    leagueIndex: 0,
    allList: [],
    list: []
  },

  onLoad() {
    this.fetchMatches();
  },

  async fetchMatches() {
    this.setData({ loading: true });
    try {
      const res = await api.getTodayMatches();
      const allList = res.list || [];
      const leagues = Array.from(new Set(allList.map((item) => item.league))).filter(Boolean);
      this.setData({
        allList,
        list: allList,
        leagueOptions: ['全部', ...leagues]
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onLeagueChange(e) {
    const leagueIndex = Number(e.detail.value);
    const leagueName = this.data.leagueOptions[leagueIndex];
    const list = leagueName === '全部'
      ? this.data.allList
      : this.data.allList.filter((item) => item.league === leagueName);

    this.setData({ leagueIndex, list });
  },

  goDetail(e) {
    const matchId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/predict/detail/detail?matchId=${matchId}`
    });
  }
});
