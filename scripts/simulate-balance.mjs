import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import * as game from '../src/core.js';
import { TYPING_REWARD, typingCompletionMultiplier } from '../src/typing.js';

export const SCENARIOS = [
  { id: 'click', name: 'クリック 8回/秒・連続', rate: 8, yield: 1, returning: false },
  { id: 'typing', name: 'タイピング 300打鍵/分・連続', rate: 300 / 60, yield: 1, typing: true, returning: false },
  { id: 'returning', name: 'クリック 8回/秒・離席あり', rate: 8, yield: 1, returning: true }
];
export const FAST_TYPING = { id: 'typing-stress', name: '高速入力 30打鍵/秒・検証用', rate: 30, yield: 1, typing: true, returning: false };
const items = Object.fromEntries(game.SHOP.map(item => [item.id, item]));

// Explicit, reproducible purchase policy, not a claim of an optimal speedrun.
// Every purchase is funded by the actual economy; no resources or knowledge
// are injected. The same policy is used for all input styles.
export function purchasePlan(state, need) {
  const p = state.projectIndex;
  if (p === 0) return [['macro', 1], ['book-syntax', 1], ['keyboard', 1]];
  return [
    ['library', 1], ['lab', 1], ...need.map(([id]) => [`book-${id}`, 1]),
    ['macro', Math.min(6, p + 1)], ['keyboard', Math.min(8, p + 1)], ['monitor', Math.min(10, p + 1)],
    ...Object.keys(game.projectAt(p).req).map(id => [`book-${id}`, Math.min(15, p + 1)]),
    ['ide', p], ['library', p + 1], ['assistant', p], ['lab', p + 2],
    ['engineer', Math.max(0, p - 1)], ['cluster', Math.max(0, p - 3)]
  ];
}

export function simulate(scenario, { horizon = 9 * 86400, stopAfter = 5, opportunistic = false } = {}) {
  const state = game.createState(0);
  const milestones = [];
  let nextDecision = 0, activeSeconds = 0, manualInputs = 0, minimumCash = state.cash;
  const purchases = {};
  const invest = id => state.cash - game.itemCost(state, items[id]) >= game.dailyBillEstimate(state) && game.buy(state, id);
  for (let time = 0; time < horizon && state.projectIndex < stopAfter; time++) {
    // The first session lasts one hour. Afterwards the returning profile plays
    // five minutes every two hours during a 16-hour day, then leaves for 8 hours.
    const active = !scenario.returning || time < 3600 || (time % 86400 < 57600 && time % 7200 < 300);
    if (active && time >= nextDecision) {
      nextDecision = time + 15;
      const project = game.projectAt(state.projectIndex);
      const need = Object.entries(project.req).filter(([id, required]) => state.skills[id] < required)
        .sort((a, b) => state.skills[a[0]] / a[1] - state.skills[b[0]] / b[1]);
      let essential = null;
      if (opportunistic) for (const id of ['macro', ...need.map(([id]) => `book-${id}`), 'keyboard', 'monitor', 'ide', 'library', 'lab', 'assistant', 'engineer', 'cluster']) {
        const item = items[id];
        if (state.projectIndex >= item.gate && game.level(state, id) && state.cash > game.itemCost(state, item) * 4) invest(id);
      }
      for (const [id, desired] of purchasePlan(state, need)) {
        const item = items[id];
        if (state.projectIndex < item.gate || game.level(state, id) >= desired) continue;
        if (invest(id)) purchases[id] ??= time;
        else if (!essential && !game.level(state, id) && (['macro', 'library', 'lab'].includes(id) || id.startsWith('book-'))) essential = id;
      }
      if (need.length) state.subject = need[0][0];
      state.autoEnabled = !need.length;
      state.mode = essential ? 'work' : need.length ? 'study' : 'dev';
      if (state.progress >= project.target && !need.length) {
        const released = game.release(state);
        if (released) milestones.push({ name: released.name, seconds: time, activeSeconds, manualInputs });
      }
    }
    if (active) {
      // Aggregate one second of correct manual work. Learning XP is additive;
      // this conservative typing benchmark assumes 100% accuracy and full
      // completion bonuses. Real mistakes and unfinished prompts earn less.
      const multiplier = scenario.typing ? TYPING_REWARD.character + typingCompletionMultiplier(state.mode) : scenario.yield;
      game.input(state, { chars: game.handPower(state) * scenario.rate * multiplier });
      state.stats.manual += scenario.rate - 1;
      activeSeconds++;
      manualInputs += scenario.rate;
    }
    game.tick(state, 1);
    minimumCash = Math.min(minimumCash, state.cash);
  }
  return { ...scenario, purchases, milestones, reached: state.projectIndex, activeSeconds, manualInputs, minimumCash };
}

export const reportFor = scenarios => ({
  balanceVersion: game.BALANCE_VERSION,
  target: '初回AAAまで、放置込み3〜7日',
  method: '新規セーブ、購入・作業切替は15秒ごと、周回なし。ゲーム内1日＝実時間1時間。日次支払い見込額を確保して購入。段階別の事業費・事務所代・納品報酬を計上し、費用の免除なし。タイピングは300打鍵/分（5打鍵/秒）、正確率100%と完入力ボーナス込み（伝票2.25倍、コード2倍）。離席ありは最初の1時間、その後は16時間の活動帯に2時間ごと5分、夜は8時間離席。',
  scenarios
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = reportFor(SCENARIOS.map(s => simulate(s)));
  for (const s of report.scenarios) {
    console.log(`${s.name} / 入門書 ${(s.purchases['book-syntax'] / 60).toFixed(1)}分`);
    for (const m of s.milestones) console.log(`  ${m.name}: ${(m.seconds / 3600).toFixed(2)}時間（操作 ${(m.activeSeconds / 3600).toFixed(2)}時間）`);
  }
  if (process.argv.includes('--write')) {
    await writeFile(new URL('../src/pacing.js', import.meta.url), `// Generated by npm run balance -- --write. Do not edit numbers by hand.\nexport const PACING_REPORT = ${JSON.stringify(report, null, 2)};\n`);
    console.log('Updated src/pacing.js');
  }
}
