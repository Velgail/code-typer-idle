import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import * as game from '../src/core.js';
import { TYPING_REWARD, typingCompletionMultiplier } from '../src/typing.js';
import { OFFICE_PROMPT_COUNT, officeOrderAt } from '../src/office.js';
import { nextOCRError, OCR_ERROR_INTERVAL, OCR_RESUBMISSION_FEE } from '../src/officequality.js';

export const SCENARIOS = [
  { id: 'click', name: 'クリック 8回/秒・連続', rate: 8, yield: 1, returning: false },
  { id: 'typing', name: 'タイピング 300打鍵/分・連続', rate: 300 / 60, yield: 1, typing: true, returning: false },
  { id: 'returning', name: 'クリック 8回/秒・離席あり', rate: 8, yield: 1, returning: true }
];
export const TYPING_WITH_READING = { id: 'typing-reading', name: 'タイピング 300文字試行/分・原票読取と訂正あり', rate: 5, yield: 1, typing: true, returning: false, accuracy: .98, officeReadingSeconds: 3, correctionSeconds: .4 };
export const FREE_FIRST_OPTIONS = { onlineMaterials: true, ocr: false, earlyInvestment: false };
export const FREE_FIRST_SCENARIOS = [
  { ...SCENARIOS[1], id: 'typing-online-no-ocr', name: '無料教材から開始・OCRなし / タイピング 300打鍵/分' },
  { ...SCENARIOS[0], id: 'click-online-no-ocr', name: '無料教材から開始・OCRなし / クリック 8回/秒' }
];
export const FAST_TYPING = { id: 'typing-stress', name: '高速入力 30打鍵/秒・検証用', rate: 30, yield: 1, typing: true, returning: false };
export const MEAN_OFFICE_LENGTH = Array.from({ length: OFFICE_PROMPT_COUNT }, (_, index) => officeOrderAt(index).input.length).reduce((sum, length) => sum + length, 0) / OFFICE_PROMPT_COUNT;
const items = Object.fromEntries(game.SHOP.map(item => [item.id, item]));

// A sensitivity model, not measured player performance. Raw rate counts character
// attempts; correctionSeconds is additional time per wrong character, excluding
// the original wrong keystroke. Entry reading uses all 256 invoices; correction
// reading uses the current field length, so short answers still pay for inspection.
// Code reading and prompt switching take zero time. Completion bonuses remain
// amortized immediately, so unfinished prompts are still an optimistic assumption.
export function manualInputModel(scenario, mode, { workLength = MEAN_OFFICE_LENGTH } = {}) {
  const rate = scenario.rate;
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('Input rate must be positive and finite');
  if (!scenario.typing) {
    const multiplier = scenario.yield ?? 1;
    if (!Number.isFinite(multiplier) || multiplier < 0) throw new RangeError('Input yield must be nonnegative and finite');
    return { correctRate: rate, attemptRate: rate, multiplier, unitsPerSecond: rate * multiplier };
  }
  const accuracy = scenario.accuracy ?? 1, correctionSeconds = scenario.correctionSeconds ?? 0;
  const officeReadingSeconds = scenario.officeReadingSeconds ?? 0;
  if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 1 || !Number.isFinite(correctionSeconds) || correctionSeconds < 0 || !Number.isFinite(officeReadingSeconds) || officeReadingSeconds < 0 || !Number.isFinite(workLength) || workLength <= 0) throw new RangeError('Invalid typing benchmark assumptions');
  const reading = mode === 'work' ? officeReadingSeconds / workLength : 0;
  const correctRate = 1 / (1 / (rate * accuracy) + (1 - accuracy) / accuracy * correctionSeconds + reading);
  const multiplier = TYPING_REWARD.character + typingCompletionMultiplier(mode) * accuracy ** 2;
  return { correctRate, attemptRate: correctRate / accuracy, multiplier, unitsPerSecond: correctRate * multiplier };
}

// Explicit, reproducible purchase policy, not a claim of an optimal speedrun.
// Every purchase is funded by the actual economy; no resources or knowledge
// are injected. The same policy is used for all input styles.
export function purchasePlan(state, need, { ocr = true } = {}) {
  const p = state.projectIndex;
  if (p === 0) return [...(ocr ? [['macro', 1]] : []), ['book-syntax', 1], ['keyboard', 1]];
  return [
    // Unlock required subjects before optional equipment. Syntax 12 -> 24
    // needs more XP than either new subject at 8, so buy its cheap second book first.
    ...need.map(([id]) => [`book-${id}`, 1]), ...(p === 1 ? [['book-syntax', 2]] : []),
    ['library', 1], ['lab', 1],
    ...(ocr ? [['macro', 1]] : []), ['keyboard', Math.min(8, p + 1)], ['monitor', Math.min(10, p + 1)],
    ...Object.keys(game.projectAt(p).req).map(id => [`book-${id}`, Math.min(15, p + 1)]),
    ['ide', p], ['library', p + 1], ['assistant', p], ['lab', p + 2],
    ['engineer', Math.max(0, p - 1)], ['cluster', Math.max(0, p - 3)]
  ];
}

const emptyModeSeconds = () => ({ work: 0, study: 0, development: 0, review: 0 });
const emptyIncome = () => ({ manualJobs: 0, ocrGross: 0, ocrCancelled: 0, ocrFees: 0, ocrRecovered: 0, ocrNet: 0, gameRoyalties: 0, launchPayout: 0 });
const recurringIncomeRates = state => {
  const ocrCapacity = game.unitRate(state, 'macro'), ocrGross = ocrCapacity * game.workRate(state);
  return {
    macroLevel: game.level(state, 'macro'), ocrCapacity, gameRoyalties: game.netRoyaltyRate(state),
    ocrGross, ocrUncorrected: ocrGross * (1 - (1 + OCR_RESUBMISSION_FEE) / OCR_ERROR_INTERVAL),
    ocrFullyCorrected: ocrGross * (1 - OCR_RESUBMISSION_FEE / OCR_ERROR_INTERVAL)
  };
};
const newStage = (state, startSeconds, income) => ({ index: state.projectIndex, name: game.projectAt(state.projectIndex).name, startSeconds, income, incomeRates: recurringIncomeRates(state), elapsedSeconds: 0, activeSeconds: 0, inactiveSeconds: 0, correctionSeconds: 0, modeSeconds: emptyModeSeconds(), output: { manualStudyUnits: 0, autoStudyUnits: 0, manualConfirmedKnowledge: 0, autoConfirmedKnowledge: 0, manualConfirmedRequiredProgress: 0, autoConfirmedRequiredProgress: 0, manualDevelopmentCharacters: 0, autoDevelopmentCharacters: 0, manualDebtAdded: 0, autoDebtAdded: 0, manualDefectsIntroduced: 0, autoDefectsIntroduced: 0, manualOCRRecovered: 0, autoOCRCancelled: 0, autoOCRFees: 0, autoOCRFailures: 0 } });
const confirmedKnowledge = state => game.SKILLS.reduce((sum, skill) => sum + game.skillKnowledge(state, skill.id), 0);
const requiredKnowledgeProgress = state => {
  const requirements = Object.entries(game.projectAt(state.projectIndex).req);
  return requirements.reduce((sum, [id, required]) => sum + Math.min(1, game.skillKnowledge(state, id) / required), 0) / requirements.length;
};
const snapshot = state => ({ study: state.stats.study, valid: state.stats.valid, confirmed: confirmedKnowledge(state), required: requiredKnowledgeProgress(state), debt: state.debt, defects: state.defects, ocrPendingReward: state.ocr.pendingReward, ocrFees: state.ocr.fees, ocrFailures: state.ocr.failures });
const recordOutput = (state, stage, source, before) => {
  const after = snapshot(state), output = stage.output;
  output[`${source}StudyUnits`] += after.study - before.study;
  output[`${source}ConfirmedKnowledge`] += Math.max(0, after.confirmed - before.confirmed);
  output[`${source}ConfirmedRequiredProgress`] += Math.max(0, after.required - before.required);
  output[`${source}DevelopmentCharacters`] += after.valid - before.valid;
  output[`${source}DebtAdded`] += Math.max(0, after.debt - before.debt);
  output[`${source}DefectsIntroduced`] += Math.max(0, after.defects - before.defects);
  if (source === 'auto') {
    output.autoOCRCancelled += after.ocrPendingReward - before.ocrPendingReward;
    output.autoOCRFees += after.ocrFees - before.ocrFees;
    output.autoOCRFailures += after.ocrFailures - before.ocrFailures;
  }
};

export function simulate(scenario, { horizon = 9 * 86400, stopAfter = 5, opportunistic = false, policy = 'steady', maintenance = true, reuse = true, outsource = false, onlineMaterials = false, ocr = true, earlyInvestment = true } = {}) {
  const state = game.createState(0);
  game.setDevelopmentPolicy(state, policy);
  const milestones = [], stages = [], incomes = [], modeSeconds = emptyModeSeconds();
  const incomeFor = () => incomes[state.projectIndex] ??= emptyIncome();
  const inputModels = Object.fromEntries(['work', 'study', 'dev'].map(mode => [mode, manualInputModel(scenario, mode)]));
  let nextDecision = 0, activeSeconds = 0, manualInputs = 0, minimumCash = state.cash;
  const purchases = {}, purchaseHistory = [], materialsOpened = {}, manualStudyStarted = {};
  const reserve = () => game.dailyBillEstimate(state) + game.ocrReserve(state);
  const canBuyMore = id => !items[id].max || game.level(state, id) < items[id].max;
  const invest = id => {
    const cost = game.itemCost(state, items[id]);
    if (!canBuyMore(id) || state.cash - cost < reserve() || !game.buy(state, id)) return false;
    purchases[id] ??= state.stats.time;
    purchaseHistory.push({ id, level: game.level(state, id), seconds: state.stats.time, cost });
    return true;
  };
  for (let time = 0; time < horizon && state.projectIndex < stopAfter; time++) {
    // The first session lasts one hour. Afterwards the returning profile plays
    // five minutes every two hours during a 16-hour day, then leaves for 8 hours.
    const active = !scenario.returning || time < 3600 || (time % 86400 < 57600 && time % 7200 < 300);
    if (active && time >= nextDecision) {
      nextDecision = time + 15;
      const project = game.projectAt(state.projectIndex);
      if (onlineMaterials) for (const id of Object.keys(project.req)) if (game.openOnlineMaterial(state, id)) materialsOpened[id] = time;
      const need = Object.entries(project.req).filter(([id, required]) => game.skillKnowledge(state, id) < required)
        .sort((a, b) => game.skillKnowledge(state, a[0]) / a[1] - game.skillKnowledge(state, b[0]) / b[1]);
      let essential = null;
      const missingMaterials = state.projectIndex > 0 && need.some(([id]) => !game.hasStudyMaterial(state, id));
      if (opportunistic && !missingMaterials) for (const id of [...(ocr ? ['macro'] : []), ...need.map(([id]) => `book-${id}`), 'keyboard', 'monitor', 'ide', 'library', 'lab', 'assistant', 'engineer', 'cluster']) {
        const item = items[id];
        if (state.projectIndex >= item.gate && canBuyMore(id) && game.level(state, id) && state.cash > game.itemCost(state, item) * 4) invest(id);
      }
      for (const [id, desired] of purchasePlan(state, need, { ocr })) {
        if (id === 'library' && !reuse) continue;
        const item = items[id];
        if (missingMaterials && !id.startsWith('book-')) continue;
        if (state.projectIndex < item.gate || !canBuyMore(id) || game.level(state, id) >= desired) continue;
        if (invest(id)) purchases[id] ??= time;
        else if (!essential && !game.level(state, id) && ((id.startsWith('book-') && !game.hasStudyMaterial(state, id.slice(5))) || ((earlyInvestment || state.projectIndex >= 2) && ['macro', 'library', 'lab'].includes(id)))) {
          // Save for the missing prerequisite instead of spending on later gear.
          essential = id; break;
        }
      }
      if (outsource) for (const quote of game.productionOptions(state)) if (!quote.ordered && state.cash - quote.cost >= reserve()) game.orderProduction(state, quote.id);
      if (need.length) state.subject = need[0][0];
      state.autoEnabled = !need.length;
      if (state.progress >= project.target && !need.length && !state.crashed && state.defects <= game.defectLimit(state) * .1) {
        const income = incomeFor(), released = game.release(state);
        if (released) income.launchPayout += released.payout;
        if (released) milestones.push({ name: released.name, seconds: time, activeSeconds, manualInputs, builds: released.builds, productionCosts: released.productionCosts, payout: released.payout, cash: state.cash, confirmedKnowledge: Object.fromEntries(game.SKILLS.map(skill => [skill.id, game.skillKnowledge(state, skill.id)])), modeSeconds: { ...modeSeconds } });
      } else if (!need.length) {
        if (state.refactor && !state.defects && !state.debt) state.refactor = false;
        if (state.defects > game.defectLimit(state) * .1 || maintenance && game.developmentEfficiency(state) < .8) state.refactor = true;
      }
      state.mode = essential ? 'work' : need.length ? 'study' : 'dev';
    }
    if (state.projectIndex >= stopAfter) break;
    if (stages.at(-1)?.index !== state.projectIndex) stages.push(newStage(state, time, incomeFor()));
    const stage = stages.at(-1);
    stage.elapsedSeconds++;
    if (active) {
      const mode = state.mode === 'dev' ? state.refactor ? 'review' : 'development' : state.mode;
      stage.modeSeconds[mode]++; modeSeconds[mode]++; stage.activeSeconds++;
      // Prioritize outstanding corrections while raising money. This linear
      // model deliberately omits the UI's minimum 100-work completion reward.
      state.workTask = state.mode === 'work' && state.ocr.pending > 0 ? 'correction' : 'entry';
      const correction = state.workTask === 'correction' ? nextOCRError(state.ocr) : null;
      const model = correction ? manualInputModel(scenario, 'work', { workLength: correction.correctValue.length }) : inputModels[state.mode];
      const before = snapshot(state);
      const power = scenario.typing ? game.typingPower(state) : game.handPower(state);
      const result = game.input(state, { chars: power * model.unitsPerSecond });
      recordOutput(state, stage, 'manual', before);
      if (result.kind === 'study' && result.amount > 0) manualStudyStarted[state.subject] ??= time;
      if (state.mode === 'work') {
        if (correction) {
          stage.correctionSeconds++; stage.output.manualOCRRecovered += result.amount;
          stage.income.ocrRecovered += result.amount; stage.income.ocrNet += result.amount;
        } else stage.income.manualJobs += result.amount;
      }
      state.stats.manual += model.attemptRate - 1;
      activeSeconds++;
      manualInputs += model.attemptRate;
    } else stage.inactiveSeconds++;
    const before = snapshot(state), earnedBefore = state.stats.earned, gameRoyalties = game.netRoyaltyRate(state);
    game.tick(state, 1);
    recordOutput(state, stage, 'auto', before);
    // Earned excludes expenses and purchases, so online server bills cannot be
    // mistaken for OCR losses. Keep launch payouts out of recurring income.
    const ocrCancelled = state.ocr.pendingReward - before.ocrPendingReward, ocrFees = state.ocr.fees - before.ocrFees;
    const ocrNet = game.unitRate(state, 'macro') ? state.stats.earned - earnedBefore - gameRoyalties : 0;
    stage.income.ocrGross += ocrNet + ocrCancelled + ocrFees;
    stage.income.ocrCancelled += ocrCancelled; stage.income.ocrFees += ocrFees;
    stage.income.ocrNet += ocrNet; stage.income.gameRoyalties += gameRoyalties;
    minimumCash = Math.min(minimumCash, state.cash);
  }
  return { ...scenario, route: { name: `${onlineMaterials ? '無料教材から開始' : '有料教本へ投資'}・${ocr ? 'OCRあり' : 'OCRなし'}・${earlyInvestment ? '設備へ先行投資' : '初有料作品の公開を優先'}`, onlineMaterials, ocr, earlyInvestment }, purchases, purchaseHistory, materialsOpened, manualStudyStarted, onlineMaterialsOpened: [...state.onlineMaterials], milestones, stages, modeSeconds, inputModels, reached: state.projectIndex, activeSeconds, manualInputs, minimumCash, earned: state.stats.earned, outsourcingSpend: state.stats.outsourcing, itemLevels: { ...state.items }, ocrLedger: state.ocr, ocrReserve: game.ocrReserve(state) };
}

export const reportFor = scenarios => ({
  balanceVersion: game.BALANCE_VERSION,
  target: '初回AAAまで、放置込み3〜7日',
  method: '基準4条件は有料教本・OCRへ先行投資する経路。追加2条件は無料オンライン教材で開始しOCRを一切買わず、最初の2作は教材・設備を必須投資にせず公開を優先。必要分野の無料教材を実際に開いて1倍で学び、初有料作品の売上から有料教本と通常設備へ投資する。教本・OCR投資経路では2作目以降、未購入の必須教材を先に揃え、2作目は基礎文法教本Lv2を設備より先に購入。必須投資に不足すると後続設備を買わずに貯蓄。共通条件は新規セーブ、購入・作業切替は15秒ごと、周回なし。金策中はOCRの未回収案件を毎秒優先し、なくなれば新しい仕事へ。通常方針で開発し、変更効率80%未満または不具合が公開基準超ならレビュー・整理へ切替。実際のtypingPower・確認済み理解度・自動学習の保留分・自動生成の負債と不具合・OCR誤納品台帳を使用。負債を残した公開とライブラリへの25%流用、途中のビルド・テストを含む。標準計測は自作素材。日次支払い見込額とOCR1件の再提出手数料を確保して購入し、資金と理解度の注入なし。OCRは1台の買い切り、事務単価は公開本数に連動せず1作業量1円。各作品の開発中に実際に受け取った継続収入をゲームとOCRへ分け、OCRは取消・手数料・訂正回収後の額を記録し、公開時の一時報酬は分離。段階開始時の継続収入/秒は、OCR未訂正と全訂正時の期待値を併記。ゲーム内1日＝実時間1時間。未公開・無料オフラインの固定費はゼロ。販売手数料25%、オンライン公開中のサーバー代、納品・再納品報酬と誤納品の取消・手数料を計上。標準タイピングは300物理打鍵/分、正確率100%と全問完入力を仮定。追加条件は毎分300文字を試行、正確率98%、原票や訂正欄の読取3秒、誤入力1回あたり追加訂正0.4秒を仮定した感度分析。新規入力は256件の平均長、OCR訂正は現在の正解欄の長さから読取時間を配分。訂正も作業量を線形に与え、実UIの完入力時最低100作業量は数えない。コード読取・出題切替時間はゼロ、完入力ボーナスは即時配分するため実測や最速保証ではない。確認済み理解度の4分野合計と、各作品の要求値までの進捗を手動・自動へ分けて記録。離席ありは最初の1時間、その後は16時間の活動帯に2時間ごと5分、夜8時間離席。',
  meanOfficeLength: MEAN_OFFICE_LENGTH,
  scenarios
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = reportFor([...[...SCENARIOS, TYPING_WITH_READING].map(s => simulate(s)), ...FREE_FIRST_SCENARIOS.map(s => simulate(s, FREE_FIRST_OPTIONS))]);
  for (const s of report.scenarios) {
    console.log(`${s.name} / ${s.route.name} / 入門書 ${(s.purchases['book-syntax'] / 60).toFixed(1)}分`);
    for (let index = 0; index < s.milestones.length; index++) {
      const m = s.milestones[index], stage = s.stages[index], modes = stage.modeSeconds;
      const income = stage.income, recurring = income.gameRoyalties + income.ocrNet;
      const output = stage.output, knowledge = output.manualConfirmedRequiredProgress + output.autoConfirmedRequiredProgress, development = output.manualDevelopmentCharacters + output.autoDevelopmentCharacters;
      console.log(`  ${m.name}: ${(m.seconds / 3600).toFixed(2)}時間（累積操作 ${(m.activeSeconds / 3600).toFixed(2)}時間） / この作品の操作: 仕事 ${(modes.work / 60).toFixed(1)}分（OCR訂正 ${stage.correctionSeconds}秒）・学習 ${(modes.study / 60).toFixed(1)}分・開発 ${(modes.development / 60).toFixed(1)}分・整理 ${(modes.review / 60).toFixed(1)}分 / 手動寄与: 確認済み学習 ${(100 * output.manualConfirmedRequiredProgress / knowledge).toFixed(1)}%・制作 ${(100 * output.manualDevelopmentCharacters / development).toFixed(1)}% / 継続収入: ゲーム ${income.gameRoyalties.toFixed(0)}円・OCR差引 ${income.ocrNet.toFixed(0)}円（ゲーム ${recurring ? (100 * income.gameRoyalties / recurring).toFixed(1) : '0.0'}%）、公開時 ${income.launchPayout.toFixed(0)}円`);
    }
  }
  if (process.argv.includes('--write')) {
    await writeFile(new URL('../src/pacing.js', import.meta.url), `// Generated by npm run balance -- --write. Do not edit numbers by hand.\nexport const PACING_REPORT = ${JSON.stringify(report, null, 2)};\n`);
    console.log('Updated src/pacing.js');
  }
}
