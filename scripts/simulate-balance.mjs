import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import * as game from '../src/core.js';
import { TYPING_REWARD, typingCompletionMultiplier } from '../src/typing.js';
import { OFFICE_PROMPT_COUNT, officeOrderAt } from '../src/office.js';

export const SCENARIOS = [
  { id: 'click', name: 'クリック 8回/秒・連続', rate: 8, yield: 1, returning: false },
  { id: 'typing', name: 'タイピング 300打鍵/分・連続', rate: 300 / 60, yield: 1, typing: true, returning: false },
  { id: 'returning', name: 'クリック 8回/秒・離席あり', rate: 8, yield: 1, returning: true }
];
export const TYPING_WITH_READING = { id: 'typing-reading', name: 'タイピング 300文字試行/分・原票読取と訂正あり', rate: 5, yield: 1, typing: true, returning: false, accuracy: .98, officeReadingSeconds: 3, correctionSeconds: .4 };
export const FAST_TYPING = { id: 'typing-stress', name: '高速入力 30打鍵/秒・検証用', rate: 30, yield: 1, typing: true, returning: false };
export const MEAN_OFFICE_LENGTH = Array.from({ length: OFFICE_PROMPT_COUNT }, (_, index) => officeOrderAt(index).input.length).reduce((sum, length) => sum + length, 0) / OFFICE_PROMPT_COUNT;
const items = Object.fromEntries(game.SHOP.map(item => [item.id, item]));

// A sensitivity model, not measured player performance. Raw rate counts character
// attempts; correctionSeconds is additional time per wrong character, excluding
// the original wrong keystroke. Office reading is amortized over all 256 invoices.
// Code reading and prompt switching take zero time. Completion bonuses remain
// amortized immediately, so unfinished prompts are still an optimistic assumption.
export function manualInputModel(scenario, mode) {
  const rate = scenario.rate;
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('Input rate must be positive and finite');
  if (!scenario.typing) {
    const multiplier = scenario.yield ?? 1;
    if (!Number.isFinite(multiplier) || multiplier < 0) throw new RangeError('Input yield must be nonnegative and finite');
    return { correctRate: rate, attemptRate: rate, multiplier, unitsPerSecond: rate * multiplier };
  }
  const accuracy = scenario.accuracy ?? 1, correctionSeconds = scenario.correctionSeconds ?? 0;
  const officeReadingSeconds = scenario.officeReadingSeconds ?? 0;
  if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 1 || !Number.isFinite(correctionSeconds) || correctionSeconds < 0 || !Number.isFinite(officeReadingSeconds) || officeReadingSeconds < 0) throw new RangeError('Invalid typing benchmark assumptions');
  const reading = mode === 'work' ? officeReadingSeconds / MEAN_OFFICE_LENGTH : 0;
  const correctRate = 1 / (1 / (rate * accuracy) + (1 - accuracy) / accuracy * correctionSeconds + reading);
  const multiplier = TYPING_REWARD.character + typingCompletionMultiplier(mode) * accuracy ** 2;
  return { correctRate, attemptRate: correctRate / accuracy, multiplier, unitsPerSecond: correctRate * multiplier };
}

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

const emptyModeSeconds = () => ({ work: 0, study: 0, development: 0, review: 0 });
const newStage = (index, startSeconds) => ({ index, name: game.projectAt(index).name, startSeconds, elapsedSeconds: 0, activeSeconds: 0, inactiveSeconds: 0, modeSeconds: emptyModeSeconds(), output: { manualStudyUnits: 0, autoStudyUnits: 0, manualDevelopmentCharacters: 0, autoDevelopmentCharacters: 0 } });

export function simulate(scenario, { horizon = 9 * 86400, stopAfter = 5, opportunistic = false, policy = 'steady', maintenance = true, reuse = true, outsource = false } = {}) {
  const state = game.createState(0);
  game.setDevelopmentPolicy(state, policy);
  const milestones = [], stages = [], modeSeconds = emptyModeSeconds();
  const inputModels = Object.fromEntries(['work', 'study', 'dev'].map(mode => [mode, manualInputModel(scenario, mode)]));
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
        if (id === 'library' && !reuse) continue;
        const item = items[id];
        if (state.projectIndex < item.gate || game.level(state, id) >= desired) continue;
        if (invest(id)) purchases[id] ??= time;
        else if (!essential && !game.level(state, id) && (['macro', 'library', 'lab'].includes(id) || id.startsWith('book-'))) essential = id;
      }
      if (outsource) for (const quote of game.productionOptions(state)) if (!quote.ordered && state.cash - quote.cost >= game.dailyBillEstimate(state)) game.orderProduction(state, quote.id);
      if (need.length) state.subject = need[0][0];
      state.autoEnabled = !need.length;
      if (state.progress >= project.target && !need.length && !state.crashed && state.defects <= game.defectLimit(state) * .1) {
        const released = game.release(state);
        if (released) milestones.push({ name: released.name, seconds: time, activeSeconds, manualInputs, builds: released.builds, productionCosts: released.productionCosts, modeSeconds: { ...modeSeconds } });
      } else if (!need.length) {
        if (state.refactor && !state.defects && !state.debt) state.refactor = false;
        if (state.defects > game.defectLimit(state) * .1 || maintenance && game.developmentEfficiency(state) < .8) state.refactor = true;
      }
      state.mode = essential ? 'work' : need.length ? 'study' : 'dev';
    }
    if (state.projectIndex >= stopAfter) break;
    if (stages.at(-1)?.index !== state.projectIndex) stages.push(newStage(state.projectIndex, time));
    const stage = stages.at(-1);
    stage.elapsedSeconds++;
    if (active) {
      const mode = state.mode === 'dev' ? state.refactor ? 'review' : 'development' : state.mode;
      stage.modeSeconds[mode]++; modeSeconds[mode]++; stage.activeSeconds++;
      const model = inputModels[state.mode];
      const studyBefore = state.stats.study, validBefore = state.stats.valid;
      game.input(state, { chars: game.handPower(state) * model.unitsPerSecond });
      stage.output.manualStudyUnits += state.stats.study - studyBefore;
      stage.output.manualDevelopmentCharacters += state.stats.valid - validBefore;
      state.stats.manual += model.attemptRate - 1;
      activeSeconds++;
      manualInputs += model.attemptRate;
    } else stage.inactiveSeconds++;
    const studyBefore = state.stats.study, validBefore = state.stats.valid;
    game.tick(state, 1);
    stage.output.autoStudyUnits += state.stats.study - studyBefore;
    stage.output.autoDevelopmentCharacters += state.stats.valid - validBefore;
    minimumCash = Math.min(minimumCash, state.cash);
  }
  return { ...scenario, purchases, milestones, stages, modeSeconds, inputModels, reached: state.projectIndex, activeSeconds, manualInputs, minimumCash, outsourcingSpend: state.stats.outsourcing };
}

export const reportFor = scenarios => ({
  balanceVersion: game.BALANCE_VERSION,
  target: '初回AAAまで、放置込み3〜7日',
  method: '新規セーブ、購入・作業切替は15秒ごと、周回なし。通常方針で開発し、変更効率80%未満または不具合が公開基準超ならレビュー・整理へ切替。負債を残した公開とライブラリへの25%流用、途中のビルド・テストを含む。標準計測は自作素材。日次支払い見込額を確保して購入し、資金と理解度の注入なし。ゲーム内1日＝実時間1時間。未公開・無料オフラインの固定費はゼロ。販売手数料25%、オンライン公開中のサーバー代、納品報酬を計上。標準タイピングは300打鍵/分、正確率100%と全問完入力を仮定。追加条件は毎分300文字を試行、正確率98%、原票1件の読取3秒、誤入力1回あたり追加訂正0.4秒を仮定した感度分析。原票256件の平均長から読取時間を配分。コード読取・出題切替時間はゼロ、完入力ボーナスは即時配分するため実測や最速保証ではない。離席ありは最初の1時間、その後は16時間の活動帯に2時間ごと5分、夜8時間離席。',
  meanOfficeLength: MEAN_OFFICE_LENGTH,
  scenarios
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = reportFor([...SCENARIOS, TYPING_WITH_READING].map(s => simulate(s)));
  for (const s of report.scenarios) {
    console.log(`${s.name} / 入門書 ${(s.purchases['book-syntax'] / 60).toFixed(1)}分`);
    for (let index = 0; index < s.milestones.length; index++) {
      const m = s.milestones[index], stage = s.stages[index], modes = stage.modeSeconds;
      console.log(`  ${m.name}: ${(m.seconds / 3600).toFixed(2)}時間（累積操作 ${(m.activeSeconds / 3600).toFixed(2)}時間） / この作品の操作: 仕事 ${(modes.work / 60).toFixed(1)}分・学習 ${(modes.study / 60).toFixed(1)}分・開発 ${(modes.development / 60).toFixed(1)}分・整理 ${(modes.review / 60).toFixed(1)}分`);
    }
  }
  if (process.argv.includes('--write')) {
    await writeFile(new URL('../src/pacing.js', import.meta.url), `// Generated by npm run balance -- --write. Do not edit numbers by hand.\nexport const PACING_REPORT = ${JSON.stringify(report, null, 2)};\n`);
    console.log('Updated src/pacing.js');
  }
}
