App({
  globalData: {
    envId: ''
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.envId || undefined,
      traceUser: true
    });
  }
});
