const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 8787;
const MATCH_CACHE_TTL_MS = Number(process.env.MATCH_CACHE_TTL_MS || 3 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 8000);
const LEAGUE_REGEX = /(英超|西甲|德甲|意甲|法甲|中超|欧冠|欧联|荷甲|葡超|日职|韩职|澳超|巴甲|阿甲|墨超|苏超|挪超|瑞超|英冠|西乙|德乙|意乙|法乙)/;

const defaultTeams = [
  { name: '阿森纳', league: '英超', elo: 1685, bt: 1.18, attack: 1.75, defense: 0.92, form: 0.76 },
  { name: '切尔西', league: '英超', elo: 1602, bt: 1.02, attack: 1.42, defense: 1.05, form: 0.55 },
  { name: '皇马', league: '西甲', elo: 1711, bt: 1.23, attack: 1.92, defense: 0.86, form: 0.81 },
  { name: '马竞', league: '西甲', elo: 1660, bt: 1.11, attack: 1.58, defense: 0.93, form: 0.69 },
  { name: '拜仁', league: '德甲', elo: 1702, bt: 1.21, attack: 1.88, defense: 0.9, form: 0.78 },
  { name: '多特', league: '德甲', elo: 1636, bt: 1.06, attack: 1.62, defense: 1.08, form: 0.61 }
];

const fallbackMatches = [
  { id: 10001, source: '500', league: '英超', time: '2026-03-01 20:00', home: '阿森纳', away: '切尔西' },
  { id: 10002, source: '500', league: '西甲', time: '2026-03-01 22:00', home: '皇马', away: '马竞' },
  { id: 10003, source: '球探', league: '德甲', time: '2026-03-01 21:30', home: '拜仁', away: '多特' }
];

const state = {
  weights: { elo: 0.35, bt: 0.3, mc: 0.35 },
  history: [],
  vipUsers: new Set(),
  teams: [...defaultTeams],
  liveMatches: {
    list: [...fallbackMatches],
    fetchedAt: 0,
    from: 'fallback',
    message: 'using fallback data'
  },
  uploads: []
};

function json(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function sanitizeText(text = '') {
  return text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function findTeam(name) {
  return state.teams.find((t) => t.name === name);
}

function createTeamProfile(name, league = '未知联赛') {
  const seed = hashString(`${league}-${name}`);
  const variance = (seed % 60) - 30;
  return {
    name,
    league,
    elo: 1500 + variance,
    bt: 0.95 + ((seed % 40) / 100),
    attack: 1.2 + ((seed % 70) / 100),
    defense: 0.9 + ((seed % 30) / 100),
    form: 0.45 + ((seed % 45) / 100)
  };
}

function getOrCreateTeam(name, league) {
  let team = findTeam(name);
  if (!team) {
    team = createTeamProfile(name, league);
    state.teams.push(team);
  }
  return team;
}


function looksLikeGarbageTeamName(name = '') {
  const v = (name || '').trim();
  if (!v) return true;
  if (v.length < 2 || v.length > 30) return true;

  const lower = v.toLowerCase();
  const badTokens = ['script', 'javascript', 'function', 'var', 'const', 'let', 'http', 'www', 'undefined', 'null'];
  if (badTokens.some((t) => lower.includes(t))) return true;

  if (/^\d{4}-\d{2}(-\d{2})?$/.test(v)) return true;
  if (/^\d{1,4}([:\-]\d{1,4}){1,3}$/.test(v)) return true;
  if (/^\d+$/.test(v)) return true;

  const cleaned = v.replace(/[\s\-\.\(\)一-龥A-Za-z]/g, '');
  if (cleaned.length > 0) return true;

  return false;
}

function isValidMatchRow(row) {
  if (!row || !row.home || !row.away) return false;
  const home = row.home.trim();
  const away = row.away.trim();
  if (home === away) return false;
  if (looksLikeGarbageTeamName(home) || looksLikeGarbageTeamName(away)) return false;
  return true;
}

function parseRowsByPair(html, source, pairRegex) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRegex.exec(html)) !== null) {
    const cleaned = sanitizeText(m[1]);
    const pair = cleaned.match(pairRegex);
    if (!pair) continue;

    const leagueMatch = cleaned.match(LEAGUE_REGEX);
    const timeMatch = cleaned.match(/(\d{2}:\d{2})/);

    rows.push({
      league: leagueMatch ? leagueMatch[1] : '其他联赛',
      time: timeMatch ? timeMatch[1] : '--:--',
      home: (pair[1] || "").trim(),
      away: (pair[2] || "").trim(),
      source
    });
  }
  return rows;
}

function parsePairsFromWholeHtml(html, source) {
  const cleaned = sanitizeText(html);
  const rows = [];
  const patterns = [
    /([一-龥A-Za-z0-9\.\-\(\)]{2,30})\s*(?:VS|vs|v|对阵)\s*([一-龥A-Za-z0-9\.\-\(\)]{2,30})/g,
    /([一-龥A-Za-z0-9\.\-\(\)]{2,30})\s*-\s*([一-龥A-Za-z0-9\.\-\(\)]{2,30})/g
  ];

  for (const reg of patterns) {
    let m;
    while ((m = reg.exec(cleaned)) !== null) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(cleaned.length, m.index + m[0].length + 40);
      const ctx = cleaned.slice(start, end);
      const leagueMatch = ctx.match(LEAGUE_REGEX)
        || cleaned.slice(Math.max(0, m.index - 120), Math.min(cleaned.length, m.index + 120)).match(LEAGUE_REGEX);
      const timeMatch = ctx.match(/(\d{2}:\d{2})/);
      rows.push({
        league: leagueMatch ? leagueMatch[1] : '其他联赛',
        time: timeMatch ? timeMatch[1] : '--:--',
        home: (m[1] || "").trim(),
        away: (m[2] || "").trim(),
        source
      });
      if (rows.length > 300) return rows;
    }
  }

  return rows;
}

function parseMatchesFrom500(html) {
  const byRow = parseRowsByPair(html, '500', /([一-龥A-Za-z0-9\.\-\(\)]+)\s*(?:VS|vs|v)\s*([一-龥A-Za-z0-9\.\-\(\)]+)/);
  return byRow.length ? byRow : parsePairsFromWholeHtml(html, '500');
}

function parseMatchesFromQiutan(html) {
  const byRow = parseRowsByPair(html, '球探', /([一-龥A-Za-z0-9\.\-\(\)]+)\s*(?:-|VS|vs|v)\s*([一-龥A-Za-z0-9\.\-\(\)]+)/);
  return byRow.length ? byRow : parsePairsFromWholeHtml(html, '球探');
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeLiveMatches(rawRows) {
  const nowDate = new Date().toISOString().slice(0, 10);
  const unique = new Map();
  rawRows.forEach((r) => {
    if (!isValidMatchRow(r)) return;
    const key = `${r.source}-${r.league}-${r.home}-${r.away}-${r.time}`;
    if (!unique.has(key)) unique.set(key, r);
  });

  return [...unique.values()].map((r, idx) => ({
    id: hashString(`${r.source}-${r.league}-${r.home}-${r.away}-${r.time}`) % 100000000 + idx,
    source: r.source,
    league: r.league || '其他联赛',
    time: r.time && r.time.includes(':') ? `${nowDate} ${r.time}` : `${nowDate} 00:00`,
    home: r.home,
    away: r.away
  }));
}

async function refreshLiveMatches(force = false) {
  const now = Date.now();
  if (!force && now - state.liveMatches.fetchedAt < MATCH_CACHE_TTL_MS && state.liveMatches.list.length) {
    return state.liveMatches;
  }

  const sources = [
    { name: '500', url: process.env.SOURCE_500_URL || 'https://trade.500.com/jczq/', parser: parseMatchesFrom500 },
    { name: '球探', url: process.env.SOURCE_QIUTAN_URL || 'https://live.titan007.com/oldIndexall.aspx', parser: parseMatchesFromQiutan }
  ];

  const collected = [];
  const errors = [];

  for (const source of sources) {
    try {
      const html = await fetchHtml(source.url);
      const parsed = source.parser(html);
      if (parsed.length) collected.push(...parsed);
      else errors.push(`${source.name}:未解析到比赛`);
    } catch (e) {
      errors.push(`${source.name}:${e.message}`);
    }
  }

  const normalized = normalizeLiveMatches(collected);
  if (normalized.length) {
    state.liveMatches = {
      list: normalized,
      fetchedAt: now,
      from: 'live-scrape',
      message: errors.length ? `部分源失败: ${errors.join('; ')}` : 'ok'
    };
  } else {
    state.liveMatches = {
      list: [...fallbackMatches],
      fetchedAt: now,
      from: 'fallback',
      message: `实时抓取失败，已回退示例数据: ${errors.join('; ') || 'no data'}`
    };
  }

  return state.liveMatches;
}

function simulateMatch(home, away, n = 5000) {
  const homeAdv = 0.23;
  const lambdaHome = Math.max(0.2, home.attack * away.defense + homeAdv + (home.form - away.form) * 0.5);
  const lambdaAway = Math.max(0.2, away.attack * home.defense + (away.form - home.form) * 0.35);

  let win = 0;
  let draw = 0;
  let lose = 0;
  const scoreMap = new Map();
  const goalsRange = { '0-1': 0, '2-3': 0, '4+': 0 };

  for (let i = 0; i < n; i += 1) {
    const hg = poissonSample(lambdaHome);
    const ag = poissonSample(lambdaAway);
    if (hg > ag) win += 1;
    else if (hg === ag) draw += 1;
    else lose += 1;

    const total = hg + ag;
    if (total <= 1) goalsRange['0-1'] += 1;
    else if (total <= 3) goalsRange['2-3'] += 1;
    else goalsRange['4+'] += 1;

    const s = `${hg}-${ag}`;
    scoreMap.set(s, (scoreMap.get(s) || 0) + 1);
  }

  const topScores = [...scoreMap.entries()]
    .map(([score, count]) => ({ score, prob: count / n }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 3);

  return {
    n,
    lambdaHome,
    lambdaAway,
    wdl: { win: win / n, draw: draw / n, lose: lose / n },
    goalsRange: Object.entries(goalsRange).map(([range, count]) => ({ range, prob: count / n })),
    topScores
  };
}

function predictionForMatch(match) {
  const home = getOrCreateTeam(match.home, match.league);
  const away = getOrCreateTeam(match.away, match.league);

  const eloDiff = home.elo - away.elo + 50;
  const eloWin = sigmoid(eloDiff / 120);
  const eloDraw = 0.24;
  const eloLose = Math.max(0.01, 1 - eloWin - eloDraw);

  const btWin = home.bt / (home.bt + away.bt);
  const btDraw = 0.22;
  const btLose = Math.max(0.01, 1 - btWin - btDraw);

  const mc = simulateMatch(home, away, 5000);

  const w = state.weights;
  const win = w.elo * eloWin + w.bt * btWin + w.mc * mc.wdl.win;
  const draw = w.elo * eloDraw + w.bt * btDraw + w.mc * mc.wdl.draw;
  const lose = Math.max(0.001, 1 - win - draw);

  const result = {
    match,
    source: match.source,
    elo: {
      home: home.elo,
      away: away.elo,
      diff: eloDiff,
      win: eloWin,
      draw: eloDraw,
      lose: eloLose
    },
    bt: { win: btWin, draw: btDraw, lose: btLose },
    mc,
    fused: {
      win,
      draw,
      lose,
      handicapWin: Math.max(0.01, win - 0.07),
      handicapDraw: Math.min(0.5, draw + 0.02),
      handicapLose: Math.max(0.01, lose + 0.05)
    }
  };

  const strong = win >= draw && win >= lose ? `${match.home}不败` : `${match.away}不败`;
  result.reason = `ELO差值${eloDiff.toFixed(0)}，BT主胜倾向${(btWin * 100).toFixed(1)}%，蒙特卡洛5000次显示主胜/平/客胜为${(mc.wdl.win * 100).toFixed(1)}%/${(mc.wdl.draw * 100).toFixed(1)}%/${(mc.wdl.lose * 100).toFixed(1)}%，稳健建议偏向${strong}。`;

  state.history.unshift({
    id: Date.now() + Math.floor(Math.random() * 100),
    matchId: match.id,
    league: match.league,
    home: match.home,
    away: match.away,
    source: match.source,
    prediction: { win, draw, lose },
    topScores: mc.topScores,
    reason: result.reason,
    createdAt: new Date().toISOString()
  });

  state.history = state.history.slice(0, 100);
  tuneWeights();

  return result;
}

function tuneWeights() {
  if (state.history.length < 8) return;
  const recent = state.history.slice(0, 20);
  const variance = recent.reduce((acc, x) => acc + Math.abs((x.prediction.win || 0) - 0.5), 0) / recent.length;
  const targetMc = Math.min(0.5, 0.3 + variance * 0.4);
  state.weights.mc = Number(targetMc.toFixed(2));
  const rest = 1 - state.weights.mc;
  state.weights.elo = Number((rest * 0.55).toFixed(2));
  state.weights.bt = Number((rest * 0.45).toFixed(2));
}


function ensureUploadDir() {
  const dir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveBase64Image(filename, imageBase64) {
  const match = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(imageBase64 || '');
  if (!match) throw new Error('只支持 png/jpeg/webp 图片');
  const mime = match[1];
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const safeName = (filename || 'match-screenshot').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_').slice(0, 40);
  const out = `${Date.now()}-${safeName}.${ext}`;
  const filePath = path.join(ensureUploadDir(), out);
  fs.writeFileSync(filePath, Buffer.from(match[3], 'base64'));
  return out;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  if (pathname === '/api/matches/today' && req.method === 'GET') {
    const source = url.searchParams.get('source');
    const league = url.searchParams.get('league');
    const forceRefresh = url.searchParams.get('refresh') === '1';

    const live = await refreshLiveMatches(forceRefresh);
    const filtered = live.list.filter((m) => (!source || m.source === source) && (!league || m.league === league));
    return json(res, 200, {
      list: filtered,
      leagues: [...new Set(live.list.map((m) => m.league))],
      fetchedAt: live.fetchedAt,
      mode: live.from,
      message: live.message,
      needsUpload: live.from === 'fallback'
    });
  }

  if (pathname === '/api/matches/refresh' && req.method === 'POST') {
    const live = await refreshLiveMatches(true);
    return json(res, 200, { success: true, count: live.list.length, mode: live.from, message: live.message });
  }

  if (pathname === '/api/scrape/health' && req.method === 'GET') {
    const live = await refreshLiveMatches(false);
    return json(res, 200, {
      mode: live.from,
      fetchedAt: live.fetchedAt,
      count: live.list.length,
      message: live.message,
      sample: live.list.slice(0, 5),
      uploads: state.uploads.slice(0, 5)
    });
  }

  if (pathname === '/api/predict/detail' && req.method === 'GET') {
    const matchId = Number(url.searchParams.get('matchId'));
    const live = await refreshLiveMatches(false);
    const match = live.list.find((m) => m.id === matchId);
    if (!match) return json(res, 404, { message: '比赛不存在' });
    const r = predictionForMatch(match);
    return json(res, 200, {
      match: r.match,
      source: r.source,
      elo: r.elo,
      bt: r.bt,
      probability: r.fused,
      goalsRange: r.mc.goalsRange,
      topScores: r.mc.topScores,
      lambdaHome: r.mc.lambdaHome,
      lambdaAway: r.mc.lambdaAway,
      reason: r.reason,
      simulateCount: r.mc.n,
      weights: state.weights
    });
  }

  if (pathname === '/api/history/list' && req.method === 'GET') {
    return json(res, 200, { list: state.history });
  }

  if (pathname === '/api/vip/status' && req.method === 'GET') {
    const userId = url.searchParams.get('userId') || 'guest';
    const isVip = state.vipUsers.has(userId);
    return json(res, 200, {
      userId,
      isVip,
      planType: isVip ? 'monthly' : null,
      expireTime: isVip ? new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString() : null
    });
  }

  if (pathname === '/api/vip/recharge' && req.method === 'POST') {
    const body = await parseBody(req);
    const userId = body.userId || 'guest';
    state.vipUsers.add(userId);
    return json(res, 200, { success: true, userId, isVip: true, amount: 29 });
  }

  if (pathname === '/api/upload/screenshot' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const file = saveBase64Image(body.filename, body.imageBase64);
      const item = {
        id: Date.now(),
        file,
        note: (body.note || '').slice(0, 200),
        createdAt: new Date().toISOString()
      };
      state.uploads.unshift(item);
      state.uploads = state.uploads.slice(0, 200);
      return json(res, 200, { success: true, item });
    } catch (e) {
      return json(res, 400, { success: false, message: e.message || '上传失败' });
    }
  }

  if (pathname === '/api/model/weights' && req.method === 'POST') {
    const body = await parseBody(req);
    const { elo, bt, mc } = body;
    if ([elo, bt, mc].some((x) => typeof x !== 'number')) {
      return json(res, 400, { message: '参数需要数字' });
    }
    const sum = elo + bt + mc;
    if (Math.abs(sum - 1) > 0.0001) {
      return json(res, 400, { message: '权重和必须为1' });
    }
    state.weights = { elo, bt, mc };
    return json(res, 200, { success: true, weights: state.weights });
  }

  const publicPath = path.join(__dirname, 'public');
  const filePath = pathname === '/' ? path.join(publicPath, 'index.html') : path.join(publicPath, pathname);
  if (filePath.startsWith(publicPath)) {
    return serveStatic(res, filePath);
  }

  return json(res, 404, { message: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`Web app running: http://localhost:${PORT}`);
});
