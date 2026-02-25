const state = {
  userId: 'demo-user',
  matches: [],
  selectedMatchId: null
};

const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadScreenshot() {
  const input = $('matchImageInput');
  const status = $('uploadStatus');
  const file = input.files && input.files[0];
  if (!file) {
    status.textContent = '请先选择图片';
    return;
  }
  status.textContent = '上传中...';
  try {
    const imageBase64 = await toBase64(file);
    const note = $('uploadNote').value || '';
    const res = await api('/api/upload/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, imageBase64, note })
    });
    status.textContent = res.success ? `上传成功：${res.item.file}` : `上传失败：${res.message || ''}`;
  } catch (e) {
    status.textContent = `上传失败：${e.message}`;
  }
}

async function loadMatches(force = false) {
  const source = $('sourceSelect').value;
  const league = $('leagueSelect').value;
  const qs = new URLSearchParams();
  if (source) qs.set('source', source);
  if (league) qs.set('league', league);

  if (force) qs.set('refresh', '1');
  const data = await api(`/api/matches/today?${qs.toString()}`);
  state.matches = data.list;

  const leagueSelect = $('leagueSelect');
  if (leagueSelect.options.length <= 1 && data.leagues) {
    data.leagues.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = l;
      leagueSelect.appendChild(opt);
    });
  }

  $('dataStatus').textContent = `数据状态：${data.mode || '-'}；${data.message || ''}`;
  $('uploadBox').style.display = data.needsUpload ? 'block' : 'none';

  const matchesEl = $('matches');
  matchesEl.innerHTML = '';
  if (!data.list.length) {
    matchesEl.innerHTML = '<p>暂无符合条件的比赛。</p>';
    return;
  }

  data.list.forEach((m) => {
    const div = document.createElement('div');
    div.className = 'match';
    div.innerHTML = `
      <div>
        <strong>${m.home} vs ${m.away}</strong>
        <small>${m.league} · ${m.time} · 数据源: ${m.source}</small>
      </div>
      <button data-id="${m.id}">预测</button>
    `;
    div.querySelector('button').addEventListener('click', () => loadDetail(m.id));
    matchesEl.appendChild(div);
  });
}

async function loadDetail(matchId) {
  state.selectedMatchId = matchId;
  const d = await api(`/api/predict/detail?matchId=${matchId}`);
  const detail = $('detail');
  detail.innerHTML = `
    <p><span class="tag">${d.match.league}</span><b>${d.match.home} vs ${d.match.away}</b>（${d.match.time}）</p>
    <p>胜平负：胜 ${pct(d.probability.win)} / 平 ${pct(d.probability.draw)} / 负 ${pct(d.probability.lose)}</p>
    <p>让球：让胜 ${pct(d.probability.handicapWin)} / 让平 ${pct(d.probability.handicapDraw)} / 让负 ${pct(d.probability.handicapLose)}</p>
    <p>ELO：主队 ${d.elo.home}，客队 ${d.elo.away}，差值 ${d.elo.diff.toFixed(0)}</p>
    <p>BT：主胜倾向 ${pct(d.bt.win)}</p>
    <p>蒙特卡洛：${d.simulateCount} 次（λ主=${d.lambdaHome.toFixed(2)}，λ客=${d.lambdaAway.toFixed(2)}）</p>
    <p>总进球区间：${d.goalsRange.map((x) => `${x.range}:${pct(x.prob)}`).join('，')}</p>
    <p>TOP3比分：${d.topScores.map((x) => `${x.score}(${pct(x.prob)})`).join('，')}</p>
    <p><b>推荐理由：</b>${d.reason}</p>
    <p class="warn">免责声明：仅供数据分析与参考，请理性决策。</p>
  `;

  $('weightText').textContent = `当前模型权重（自我进化后）：ELO ${d.weights.elo} / BT ${d.weights.bt} / MC ${d.weights.mc}`;
  await loadHistory();
}

async function loadHistory() {
  const data = await api('/api/history/list');
  const el = $('history');
  el.innerHTML = '';
  if (!data.list.length) {
    el.innerHTML = '<p>暂无历史预测，先点一场比赛进行预测。</p>';
    return;
  }
  data.list.slice(0, 10).forEach((h) => {
    const div = document.createElement('div');
    div.className = 'match';
    div.innerHTML = `
      <div>
        <strong>${h.home} vs ${h.away}</strong>
        <small>${h.league} · ${new Date(h.createdAt).toLocaleString()}</small>
      </div>
      <small>预测：胜 ${pct(h.prediction.win)} / 平 ${pct(h.prediction.draw)} / 负 ${pct(h.prediction.lose)}</small>
    `;
    el.appendChild(div);
  });
}

async function loadVip() {
  const data = await api(`/api/vip/status?userId=${state.userId}`);
  $('vipStatus').textContent = data.isVip
    ? `你已是VIP（月卡），到期时间：${new Date(data.expireTime).toLocaleDateString()}`
    : '当前为普通用户，可查看基础分析。';
}

async function runDiag() {
  const d = await api('/api/scrape/health');
  alert(`抓取状态: ${d.mode}\n比赛数: ${d.count}\n信息: ${d.message}`);
}

async function rechargeVip() {
  await api('/api/vip/recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: state.userId })
  });
  await loadVip();
  alert('充值成功（演示模式）');
}

$('reloadBtn').addEventListener('click', () => loadMatches(false));
$('forceRefreshBtn').addEventListener('click', () => loadMatches(true));
$('diagBtn').addEventListener('click', runDiag);
$('sourceSelect').addEventListener('change', loadMatches);
$('leagueSelect').addEventListener('change', loadMatches);
$('rechargeBtn').addEventListener('click', rechargeVip);
$('uploadBtn').addEventListener('click', uploadScreenshot);

(async function init() {
  await loadMatches();
  await loadVip();
  await loadHistory();
})();
