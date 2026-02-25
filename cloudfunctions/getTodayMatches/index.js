exports.main = async (event) => {
  const { league } = event || {};

  const list = [
    {
      matchId: 10001,
      league: '英超',
      matchTime: '2026-03-01 20:00:00',
      homeTeam: '阿森纳',
      awayTeam: '切尔西',
      latestPredictTime: '2026-03-01 18:30:00'
    },
    {
      matchId: 10002,
      league: '西甲',
      matchTime: '2026-03-01 22:00:00',
      homeTeam: '皇马',
      awayTeam: '马竞',
      latestPredictTime: '2026-03-01 18:32:00'
    }
  ];

  return {
    list: league ? list.filter((m) => m.league === league) : list
  };
};
