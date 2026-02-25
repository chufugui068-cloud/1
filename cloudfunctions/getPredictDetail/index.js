exports.main = async (event) => {
  const { matchId } = event || {};
  const id = Number(matchId || 10001);

  return {
    match: {
      matchId: id,
      league: '英超',
      homeTeam: '阿森纳',
      awayTeam: '切尔西',
      matchTime: '2026-03-01 20:00:00'
    },
    probability: {
      win: 0.48,
      draw: 0.29,
      lose: 0.23,
      handicapWin: 0.41,
      handicapDraw: 0.32,
      handicapLose: 0.27
    },
    goalsRange: [
      { range: '0-1', prob: 0.24 },
      { range: '2-3', prob: 0.51 },
      { range: '4+', prob: 0.25 }
    ],
    topScores: [
      { score: '1-0', prob: 0.182 },
      { score: '1-1', prob: 0.156 },
      { score: '2-1', prob: 0.129 }
    ],
    reason: '主队近5场不败且ELO高出42分，结合盘口变化，稳健倾向主队不败。'
  };
};
