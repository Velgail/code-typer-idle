// Pure game rules. All time is in seconds; progress is measured in characters.
export const VERSION = 1;
export const DAY = 60;
export const OFFLINE_LIMIT = 8 * 60 * 60;
const LIMIT = 1e250;
const bounded = n => Math.max(0, Math.min(LIMIT, Number.isFinite(n) ? n : LIMIT));
const add = (a, b) => bounded(a + b);
export const SKILLS = [
  { id: 'syntax', name: '基礎文法', short: '文法', color: '#a4e7b5', label: '01', file: 'fundamentals.js', lesson: '変数、条件分岐、そして最初の関数。' },
  { id: 'design', name: '設計・構造', short: '設計', color: '#b9a4ec', label: '02', file: 'architecture.js', lesson: '動いたコードを、直せるコードへ。' },
  { id: 'graphics', name: '描画・演出', short: '描画', color: '#edc591', label: '03', file: 'render.js', lesson: '画面の向こうに、遊べる世界を。' },
  { id: 'systems', name: '最適化・基盤', short: '基盤', color: '#8cbce1', label: '04', file: 'systems.js', lesson: '1フレームのために、できること。' }
];
export const PROJECTS = [
  { name: '小さな数当てゲーム', genre: 'CONSOLE / FIRST BUILD', target: 3000, req: { syntax: 12 }, payout: 0, royalty: 0, desc: '最初の一本。売上はゼロ。でも、完成させた経験は残る。', icon: '01' },
  { name: 'ネオン・ブロック崩し', genre: 'ARCADE / 2D', target: 18000, req: { syntax: 50, design: 20, graphics: 20 }, payout: 35000, royalty: 30, desc: '反射角を覚えたら、少しだけゲーム開発者らしくなった。', icon: '02' },
  { name: '雨のダンジョン', genre: 'ROGUELIKE / INDIE', target: 200000, req: { syntax: 160, design: 120, graphics: 100 }, payout: 800000, royalty: 700, desc: '毎回変わる迷宮。生活を支える、最初のインディー作品。', icon: '03' },
  { name: '軌道上の街', genre: 'SIMULATION / 3D', target: 2500000, req: { syntax: 550, design: 700, graphics: 600, systems: 300 }, payout: 2e7, royalty: 16000, desc: '街も、住民も、フレームレートも、あなたの責任。', icon: '04' },
  { name: 'NO MAN’S DEADLINE', genre: 'OPEN WORLD / AAA', target: 1e8, req: { syntax: 3000, design: 5000, graphics: 4500, systems: 4000 }, payout: 1e9, royalty: 800000, desc: '1億文字の世界を作る。エンドロールの後にも、仕事はある。', icon: '05' },
  { name: '永続するオンライン宇宙', genre: 'LIVE SERVICE / PLANET SCALE', target: 1e10, req: { syntax: 20000, design: 35000, graphics: 26000, systems: 40000 }, payout: 2e11, royalty: 1.5e8, desc: '全プレイヤーが同じ宇宙にいる。障害対応も同じ宇宙で起きる。', icon: '06' },
  { name: '現実コンパイラ', genre: 'SIMULATION / REALITY SCALE', target: 1e13, req: { syntax: 2e5, design: 4e5, graphics: 3e5, systems: 5e5 }, payout: 5e13, royalty: 4e10, desc: '物理法則を仕様書に書き起こす。仕様変更は受け付けない。', icon: '07' }
];
export function projectAt(index) {
  if (index < PROJECTS.length) return PROJECTS[index];
  const n = index - PROJECTS.length + 1;
  const pow = (base, exp) => Math.min(LIMIT, Math.pow(base, Math.min(800, exp)));
  const scope = n - 1 + 0.06 * (n - 1) ** 2;
  const understanding = n + 0.04 * n ** 2;
  return { name: `多元宇宙エンジン / 第${n}世代`, genre: 'ENDLESS / ANOTHER SPECIFICATION', target: Math.min(LIMIT, 1e15 * pow(40, scope)), req: { syntax: Math.min(LIMIT, 1e6 * pow(3, understanding)), design: Math.min(LIMIT, 2e6 * pow(3, understanding)), graphics: Math.min(LIMIT, 1.5e6 * pow(3, understanding)), systems: Math.min(LIMIT, 3e6 * pow(3, understanding)) }, payout: Math.min(LIMIT, 1e16 * pow(50, n - 1)), royalty: Math.min(LIMIT, 1e13 * pow(50, n - 1)), desc: '宇宙をリリースした翌日、次の宇宙の要件定義が届いた。', icon: String(index + 1).padStart(2, '0') };
}
export const SHOP = [
  ...SKILLS.map((s, i) => ({ id: `book-${s.id}`, tab: 'books', name: ['はじめてのJavaScript', '設計パターンの教科書', 'ゲーム描画のしくみ', '最適化と分散システム'][i], desc: `${s.name}の学習効率 ×3 / Lv。最初の1冊は ×10`, base: [1500, 6000, 8000, 30000][i], growth: 6, type: 'book', skill: s.id, glyph: 'book', gate: 0 })),
  { id: 'keyboard', tab: 'gear', name: 'メカニカルキーボード', desc: '手動入力の文字数 ×2 / Lv', base: 1800, growth: 3.5, type: 'gear', glyph: 'keyboard', gate: 0 },
  { id: 'monitor', tab: 'gear', name: 'デュアルモニター', desc: 'すべての学習効率 ×2 / Lv', base: 5000, growth: 4, type: 'gear', glyph: 'monitor', gate: 0 },
  { id: 'ide', tab: 'gear', name: 'IDE・コード補完', desc: '手動開発 ×3 / Lv（理解度100%時）', base: 10000, growth: 5, type: 'gear', glyph: 'code', gate: 1 },
  { id: 'kitchen', tab: 'gear', name: '自炊セット', desc: '食費と家賃を25%削減。買い切り', base: 3000, growth: 1, max: 1, type: 'gear', glyph: 'coffee', gate: 0 },
  { id: 'macro', tab: 'auto', name: 'データ入力マクロ', desc: '日銭ワーク +4文字/秒。各Lvで ×2.5', base: 900, growth: 3, type: 'auto', glyph: 'terminal', gate: 0 },
  { id: 'library', tab: 'auto', name: '自作ライブラリ', desc: '開発 +20文字/秒。各Lvで ×3', base: 8000, growth: 4.5, type: 'auto', glyph: 'layers', gate: 1 },
  { id: 'assistant', tab: 'auto', name: 'AIコーディング補助', desc: '開発 +300文字/秒。各Lvで ×4。要レビュー', base: 40000, growth: 5, type: 'auto', glyph: 'spark', gate: 1 },
  { id: 'engineer', tab: 'auto', name: '開発チーム', desc: '開発 +8,000文字/秒。各Lvで ×5', base: 900000, growth: 6, type: 'auto', glyph: 'users', gate: 2 },
  { id: 'lab', tab: 'auto', name: '研究ラボ', desc: '選択分野の学習 +12文字/秒。各Lvで ×3', base: 60000, growth: 5, type: 'auto', glyph: 'flask', gate: 1 },
  { id: 'cluster', tab: 'auto', name: '自律開発クラスタ', desc: '開発 +1,000,000文字/秒。各Lvで ×8', base: 6e7, growth: 8, type: 'auto', glyph: 'server', gate: 4 }
];
export const ACHIEVEMENTS = [
  { id: 'first-input', name: '最初の一文字', hint: '1回入力する', test: s => s.stats.manual > 0 },
  { id: 'first-book', name: '積読では終わらせない', hint: '教材を買う', test: s => Object.keys(s.items).some(k => k.startsWith('book-') && s.items[k] > 0) },
  { id: 'first-release', name: 'Hello, Developer.', hint: 'ゲームを1本公開する', test: s => s.stats.releases >= 1 },
  { id: 'automation', name: '寝ていても、仕事', hint: 'マクロを導入する', test: s => level(s, 'macro') > 0 },
  { id: 'indie', name: '自分のゲームで食べる', hint: 'ローグライクを公開する', test: s => s.projectIndex >= 3 },
  { id: 'million', name: '100万行は通過点', hint: '累計4,000万文字（換算100万行）', test: s => s.stats.chars >= 4e7 },
  { id: 'aaa', name: 'エンドロールのその先', hint: 'AAAタイトルを公開する', test: s => s.projectIndex >= 5 },
  { id: 'restart', name: '強くてニューゲーム', hint: 'コード資産を引き継いで再出発', test: s => s.resets > 0 },
  { id: 'universe', name: 'スコープは無限', hint: '多元宇宙エンジンを公開する', test: s => s.projectIndex >= 8 }
];
export function createState(now = Date.now()) {
  return { version: VERSION, cash: 1200, skills: Object.fromEntries(SKILLS.map(s => [s.id, 0])), items: {}, mode: 'work', subject: 'syntax', refactor: false, autoEnabled: true, projectIndex: 0, progress: 0, debt: 0, mistakes: 0, crashed: false, catalog: [], assets: 0, resets: 0, runReleased: 0, runBest: 0, achievements: [], stats: { chars: 0, manual: 0, valid: 0, releases: 0, earned: 0, study: 0, debtRemoved: 0, time: 0 }, day: 1, dayElapsed: 0, savedAt: now, settings: { sound: false, reducedMotion: false }, log: [{ text: '開発環境を起動しました。最初の一文字をどうぞ。', kind: 'info', day: 1 }] };
}
export const level = (s, id) => s.items[id] || 0;
export const metaBonus = s => 1 + Math.sqrt(s.assets) * 0.5;
export const livingCost = s => 120 * (level(s, 'kitchen') ? 0.75 : 1);
export const rentCost = s => 3600 * (level(s, 'kitchen') ? 0.75 : 1);
export const workRate = s => 12 * (1 + Math.min(8, s.projectIndex) * 0.65);
export const handPower = s => bounded(2 ** Math.min(800, level(s, 'keyboard')) * metaBonus(s) * (s.cash < 0 ? 0.5 : 1));
export function knowledgeRatio(s) {
  return Math.min(...Object.entries(projectAt(s.projectIndex).req).map(([id, req]) => s.skills[id] / req));
}
export function validity(s) {
  const ratio = knowledgeRatio(s);
  return ratio < 0.5 ? 0 : ratio < 1 ? (ratio - 0.5) * 2 : 1;
}
export const debtLimit = s => projectAt(s.projectIndex).target * 0.25;
export const abstraction = s => Math.min(3, Math.max(1, 1 + (knowledgeRatio(s) - 1) * 0.3));
export const royaltyRate = s => bounded(s.catalog.reduce((sum, p) => sum + p.royalty, 0));
export function unitRate(s, id) {
  const l = level(s, id);
  if (!l) return 0;
  const config = { macro: [4, 2.5], library: [20, 3], assistant: [300, 4], engineer: [8000, 5], lab: [12, 3], cluster: [1e6, 8] }[id];
  return bounded(config[0] * Math.pow(config[1], Math.min(800, l - 1)) * metaBonus(s));
}
export const devRate = s => s.autoEnabled ? bounded(['library', 'assistant', 'engineer', 'cluster'].reduce((sum, id) => sum + unitRate(s, id), 0)) : 0;
export const studyMultiplier = (s, id = s.subject) => bounded((level(s, `book-${id}`) ? 10 * 3 ** Math.min(500, level(s, `book-${id}`) - 1) : 1) * 2 ** Math.min(800, level(s, 'monitor')));
export const itemCost = (s, item) => bounded(item.base * Math.pow(item.growth, Math.min(800, level(s, item.id))));
export const netIncome = s => unitRate(s, 'macro') * workRate(s) + royaltyRate(s) - livingCost(s) / DAY - rentCost(s) / (DAY * 30);
export function log(s, text, kind = 'info') {
  if (s.log.at(-1)?.text === text) return;
  s.log.push({ text, kind, day: s.day });
  if (s.log.length > 50) s.log.shift();
}
export function checkAchievements(s) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) if (!s.achievements.includes(a.id) && a.test(s)) { s.achievements.push(a.id); unlocked.push(a); }
  return unlocked;
}
export function buy(s, id) {
  const item = SHOP.find(i => i.id === id);
  if (!item || s.projectIndex < item.gate || (item.max && level(s, id) >= item.max) || s.cash < itemCost(s, item)) return false;
  s.cash -= itemCost(s, item);
  s.items[id] = level(s, id) + 1;
  log(s, `${item.name} Lv.${level(s, id)} を導入しました。`, 'success');
  return true;
}
function earn(s, money) {
  s.cash = Math.min(LIMIT, s.cash + money);
  s.stats.earned = add(s.stats.earned, money);
}
export function input(s, { mode = s.mode, chars = handPower(s), manual = true } = {}) {
  if (!(chars > 0) || !Number.isFinite(chars)) return { kind: 'none', amount: 0 };
  chars = Math.min(LIMIT, chars);
  if (manual) s.stats.manual = add(s.stats.manual, 1);
  s.stats.chars = add(s.stats.chars, chars);
  if (mode === 'work') {
    const money = bounded(chars * workRate(s));
    earn(s, money);
    return { kind: 'work', amount: money };
  }
  if (mode === 'study') {
    const xp = bounded(chars * 0.065 * studyMultiplier(s));
    s.skills[s.subject] = add(s.skills[s.subject], xp);
    s.stats.study = add(s.stats.study, chars);
    return { kind: 'study', amount: xp };
  }
  const ratio = knowledgeRatio(s);
  if (s.refactor) {
    if (ratio < 1) return { kind: 'review', amount: 0 };
    const amount = Math.min(s.debt, bounded(chars * (1 + ratio) * 2));
    s.debt -= amount;
    s.stats.debtRemoved = add(s.stats.debtRemoved, amount);
    if (s.crashed && s.debt <= debtLimit(s) * 0.2) { s.crashed = false; log(s, 'ビルド復旧。もう一度、動くものを作ろう。', 'success'); }
    return { kind: 'refactor', amount };
  }
  if (s.crashed) return { kind: 'crash', amount: 0 };
  const rate = validity(s);
  if (!rate) { s.mistakes = add(s.mistakes, chars); return { kind: 'error', amount: 0 }; }
  if (rate < 1) {
    const bad = chars * (1 - rate);
    s.debt = Math.min(debtLimit(s), s.debt + bad);
    s.mistakes = add(s.mistakes, bad);
    if (s.debt >= debtLimit(s)) {
      s.crashed = true;
      log(s, 'ビルド崩壊。必要理解度を満たし、負債を20%以下まで修復してください。', 'error');
      return { kind: 'crash', amount: 0 };
    }
  }
  const ide = manual && ratio >= 1 ? 3 ** Math.min(500, level(s, 'ide')) : 1;
  const amount = bounded(chars * rate * abstraction(s) * ide * (1 - s.debt / debtLimit(s) * 0.8));
  const accepted = Math.min(amount, projectAt(s.projectIndex).target - s.progress);
  s.progress = add(s.progress, accepted);
  s.stats.valid = add(s.stats.valid, accepted);
  return { kind: rate < 1 ? 'debt' : 'code', amount: accepted };
}
// At zero understanding generated code is all invalid; unreviewable automation
// also fills the debt budget, rather than silently deleting its mistakes.
function automateDevelopment(s, chars) {
  if (knowledgeRatio(s) < 0.5 && !s.refactor && !s.crashed) {
    s.stats.chars = add(s.stats.chars, chars);
    s.mistakes = add(s.mistakes, chars);
    s.debt = Math.min(debtLimit(s), s.debt + chars);
    if (s.debt >= debtLimit(s)) { s.crashed = true; log(s, '自動生成コードをレビューできず、ビルドが崩壊しました。', 'error'); }
    return;
  }
  input(s, { mode: 'dev', chars, manual: false });
}
export function tick(s, seconds) {
  seconds = Math.max(0, Math.min(OFFLINE_LIMIT, seconds));
  // One-second chunks make daily costs, bankruptcy, and debt behave identically
  // for a foreground session and an offline session.
  while (seconds > 1e-6) {
    const dt = Math.min(1, seconds);
    seconds -= dt;
    s.stats.time += dt;
    s.dayElapsed += dt;
    earn(s, bounded(royaltyRate(s) * dt));
    if (unitRate(s, 'macro')) input(s, { mode: 'work', chars: bounded(unitRate(s, 'macro') * dt), manual: false });
    if (unitRate(s, 'lab')) input(s, { mode: 'study', chars: bounded(unitRate(s, 'lab') * dt), manual: false });
    if (devRate(s) && s.progress < projectAt(s.projectIndex).target) automateDevelopment(s, bounded(devRate(s) * dt));
    while (s.dayElapsed >= DAY) {
      s.dayElapsed -= DAY;
      s.day += 1;
      s.cash = Math.max(-1200, s.cash - livingCost(s));
      if ((s.day - 1) % 30 === 0) { s.cash = Math.max(-1200, s.cash - rentCost(s)); log(s, `家賃を支払いました。次の支払いは30日後。`); }
    }
  }
}
export function quality(s) {
  const p = projectAt(s.projectIndex);
  return Math.round(Math.max(20, Math.min(100, 80 + Math.min(20, (knowledgeRatio(s) - 1) * 10) - Math.min(40, s.mistakes / p.target * 25) - s.debt / debtLimit(s) * 30)));
}
export function release(s) {
  const p = projectAt(s.projectIndex);
  if (s.progress < p.target || s.crashed || s.debt > debtLimit(s) * 0.1) return null;
  const q = quality(s);
  const commercial = s.projectIndex > 0 && q >= 60 && knowledgeRatio(s) >= 1;
  const royalty = commercial ? bounded(p.royalty * q / 100 * metaBonus(s)) : 0;
  const payout = commercial ? bounded(p.payout * (q / 100)) : 0;
  earn(s, payout);
  const title = { name: p.name, quality: q, royalty, payout, index: s.projectIndex };
  s.catalog.push(title);
  // Keep a bounded catalog; old titles still contribute to income.
  if (s.catalog.length > 100) { const old = s.catalog.shift(); s.catalog[0].royalty = add(s.catalog[0].royalty, old.royalty); }
  s.runReleased += 1;
  s.runBest = Math.max(s.runBest, s.projectIndex + 1);
  s.stats.releases += 1;
  for (const [id, req] of Object.entries(p.req)) s.skills[id] = add(s.skills[id], req * .05);
  log(s, `${p.name} を${commercial ? '発売' : '無料公開'}！ 品質 ${q} / 100。完成経験で理解度が上がりました。`, 'success');
  s.projectIndex += 1;
  s.progress = 0;
  s.debt = 0;
  s.mistakes = 0;
  s.crashed = false;
  s.refactor = false;
  if (devRate(s)) {
    s.autoEnabled = false;
    log(s, '次の企画のレビュー待ち。自動開発を停止しました。理解度を確認して再開してください。');
  }
  return title;
}
export function prestigeGain(s) {
  if (s.runBest < 3) return 0;
  return Math.max(1, Math.floor(4 ** Math.min(400, s.runBest - 3) * (1 + Math.log10(1 + s.stats.valid) / 10)));
}
export function prestige(s, now = Date.now()) {
  const gain = prestigeGain(s);
  if (!gain) return null;
  const fresh = createState(now);
  fresh.assets = add(s.assets, gain);
  fresh.resets = s.resets + 1;
  fresh.achievements = [...s.achievements];
  fresh.stats = { ...s.stats };
  fresh.settings = { ...s.settings };
  fresh.cash = 1200 * metaBonus(fresh);
  log(fresh, `コード資産 +${gain}。${fresh.resets + 1}回目の開発人生を始めます。`, 'success');
  return fresh;
}
export function applyOffline(s, now = Date.now()) {
  const elapsed = Math.max(0, (now - s.savedAt) / 1000);
  const seconds = Math.min(elapsed, OFFLINE_LIMIT);
  const before = { cash: s.cash, progress: s.progress, knowledge: s.skills[s.subject] };
  if (seconds > 2) tick(s, seconds);
  s.savedAt = now;
  return { seconds, capped: elapsed > OFFLINE_LIMIT, cash: s.cash - before.cash, progress: s.progress - before.progress, knowledge: s.skills[s.subject] - before.knowledge };
}
export function serialize(s, now = Date.now()) { s.savedAt = now; return JSON.stringify(s); }
export function deserialize(raw) {
  if (typeof raw !== 'string' || raw.length > 500000) throw new Error('セーブファイルのサイズが不正です。');
  const x = JSON.parse(raw);
  if (!x || x.version !== VERSION) throw new Error('対応していないセーブデータです。');
  const s = createState();
  const num = (value, fallback = 0, min = 0, max = LIMIT) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  for (const key of ['cash', 'progress', 'debt', 'mistakes', 'assets', 'savedAt']) s[key] = num(x[key], s[key], key === 'cash' ? -1200 : 0);
  for (const key of ['resets', 'projectIndex', 'runReleased', 'runBest', 'day']) s[key] = Math.floor(num(x[key], s[key], 0, 1e6));
  s.day = Math.max(1, s.day);
  s.dayElapsed = num(x.dayElapsed, 0, 0, DAY - 1e-6);
  for (const k of Object.keys(s.stats)) s.stats[k] = num(x.stats?.[k]);
  for (const k of Object.keys(s.skills)) s.skills[k] = num(x.skills?.[k]);
  for (const item of SHOP) s.items[item.id] = Math.floor(num(x.items?.[item.id], 0, 0, item.max || 800));
  if (['work', 'study', 'dev'].includes(x.mode)) s.mode = x.mode;
  if (SKILLS.some(k => k.id === x.subject)) s.subject = x.subject;
  for (const k of ['refactor', 'autoEnabled', 'crashed']) if (typeof x[k] === 'boolean') s[k] = x[k];
  for (const k of Object.keys(s.settings)) if (typeof x.settings?.[k] === 'boolean') s.settings[k] = x.settings[k];
  s.progress = Math.min(s.progress, projectAt(s.projectIndex).target);
  s.debt = Math.min(s.debt, debtLimit(s));
  s.crashed = s.crashed || s.debt >= debtLimit(s);
  s.achievements = ACHIEVEMENTS.filter(a => x.achievements?.includes?.(a.id)).map(a => a.id);
  s.catalog = Array.isArray(x.catalog) ? x.catalog.slice(-100).filter(p => typeof p?.name === 'string').map(p => ({ name: p.name.slice(0, 100), royalty: num(p.royalty), quality: num(p.quality, 80, 0, 100), payout: num(p.payout), index: num(p.index, 0, 0, 1e6) })) : [];
  // Log messages are rebuilt instead of trusting imported HTML or metadata.
  s.log = [{ text: 'セーブデータを読み込みました。', kind: 'info', day: s.day }];
  return s;
}
