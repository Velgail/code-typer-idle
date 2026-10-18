import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import * as game from '../src/core.js';
import { TYPING_REWARD, typingCompletionMultiplier } from '../src/typing.js';
import { OFFICE_PROMPT_COUNT, officeOrderAt } from '../src/office.js';
import { nextOCRError } from '../src/officequality.js';

export const SCENARIOS = [
  { id: 'click', name: 'クリック 8回/秒・連続', rate: 8, yield: 1, returning: false },
  { id: 'typing', name: 'タイピング 300打鍵/分・連続', rate: 300 / 60, yield: 1, typing: true, returning: false },
  { id: 'returning', name: 'クリック 8回/秒・離席あり', rate: 8, yield: 1, returning: true }
];
export const TYPING_WITH_READING = { id: 'typing-reading', name: 'タイピング 300文字試行/分・原票読取と訂正あり', rate: 5, yield: 1, typing: true, returning: false, accuracy: .98, officeReadingSeconds: 3, correctionSeconds: .4 };
export const FAST_TYPING = { id: 'typing-stress', name: '高速入力 30打鍵/秒・検証用', rate: 30, yield: 1, typing: true, returning: false };
export const MEAN_OFFICE_LENGTH = Array.from({ length: OFFICE_PROMPT_COUNT }, (_, index) => officeOrderAt(index).input.length).reduce((sum, length) => sum + length, 0) / OFFICE_PROMPT_COUNT;

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

// The policy uses public gates, current knowledge, quoted costs, and finite
// sales. It does not grant experience or force a preselected list of upgrades.
const items = Object.fromEntries(game.SHOP.map(item => [item.id, item]));
const emptyModes = () => ({ work: 0, study: 0, development: 0, review: 0, wait: 0 });
const emptyIncome = () => ({ manualJobs: 0, ocrGross: 0, ocrCancelled: 0, ocrFees: 0, ocrRecovered: 0, ocrNet: 0, gameRoyalties: 0, launchPayout: 0, repeatLaunch: 0, repeatTail: 0 });
const emptyOutput = () => ({ manualStudyUnits: 0, autoStudyUnits: 0, manualConfirmedKnowledge: 0, autoConfirmedKnowledge: 0, manualDevelopmentCharacters: 0, autoDevelopmentCharacters: 0, manualDebtAdded: 0, autoDebtAdded: 0, manualDefectsIntroduced: 0, autoDefectsIntroduced: 0, manualOCRRecovered: 0, autoOCRCancelled: 0, autoOCRFees: 0, autoOCRFailures: 0 });
const knowledge = state => Object.fromEntries(game.SKILLS.map(skill => [skill.id, game.skillKnowledge(state, skill.id)]));
const snapshot = state => ({ study: state.stats.study, valid: state.stats.valid, confirmed: Object.values(knowledge(state)).reduce((sum, n) => sum + n, 0), debt: state.debt, defects: state.defects, pending: state.ocr.pendingReward, fees: state.ocr.fees, failures: state.ocr.failures });
const outputSince = (state, output, source, before) => {
  const after = snapshot(state);
  output[`${source}StudyUnits`] += after.study - before.study;
  output[`${source}ConfirmedKnowledge`] += Math.max(0, after.confirmed - before.confirmed);
  output[`${source}DevelopmentCharacters`] += after.valid - before.valid;
  output[`${source}DebtAdded`] += Math.max(0, after.debt - before.debt);
  output[`${source}DefectsIntroduced`] += Math.max(0, after.defects - before.defects);
  if (source === 'auto') { output.autoOCRCancelled += after.pending - before.pending; output.autoOCRFees += after.fees - before.fees; output.autoOCRFailures += after.failures - before.failures; }
};
const bankAllows = (state, index) => game.projectAccess(state, index).requirements.filter(r => r.kind === 'experience').every(r => r.met);
const alreadyExperienced = (state, index) => index < 2 ? state.experiencedProjects.includes(index) : state.completedProjects.includes(index);
const nextExperienceProject = state => [0, 1, 2, 3, 4].find(index => !alreadyExperienced(state, index) && Object.values(game.projectExperience(state, index).gain).some(n => n > 0) && bankAllows(state, index));
const remainingRevenue = state => state.catalog.reduce((sum, title) => sum + game.remainingSales(title) * (1 - game.STORE_FEE_RATE), 0);
const activeAt = (scenario, time) => !scenario.returning || time < 3600 || time % 86400 < 57600 && time % 7200 < 300;

function studyUnits(state, id, required) {
  const missing = required - game.skillKnowledge(state, id);
  if (missing <= 0) return 0;
  let high = 1;
  while (game.studyPreview(state, high, id) < missing && high < 1e20) high *= 4;
  let low = 0;
  for (let i = 0; i < 28; i++) { const mid = (low + high) / 2; if (game.studyPreview(state, mid, id) < missing) low = mid; else high = mid; }
  return high;
}

// A rough investment quote, not a predicted completion time. It prices the
// remaining learning and implementation at current capacity; actual play below
// still incurs all debt, builds, errors, and review. Returning play values
// installed capacity over its 40 active minutes per 24-hour day.
function taskQuote(state, index, scenario, models, units) {
  const project = game.projectAt(index), duty = scenario.returning ? 1 / 36 : 1;
  const task = { ...state, projectIndex: index };
  let study = 0;
  for (const [id, required] of Object.entries(project.req)) {
    const count = units ? units[id] * game.studyMultiplier(units.state, id) / game.studyMultiplier(task, id) : studyUnits(task, id, required);
    const power = scenario.typing ? game.typingPower(task, 'study', id) : game.handPower(task);
    study += count / Math.max(1e-9, power * models.study.unitsPerSecond * duty + game.unitRate(task, 'lab') * .75);
  }
  const ready = { ...task, skills: { ...task.skills }, refactor: false };
  for (const [id, required] of Object.entries(project.req)) ready.skills[id] = Math.max(ready.skills[id], required + (ready.studyGaps[id] || 0));
  const power = scenario.typing ? game.typingPower(ready, 'dev') : game.handPower(ready);
  const manual = power * models.dev.unitsPerSecond * game.ideMultiplier(ready) * duty;
  const capacity = (manual + game.devCapacity(ready)) * game.abstraction(ready);
  return study + Math.max(0, project.target - (state.projectIndex === index ? state.progress : 0)) / Math.max(1e-9, capacity);
}

function investmentQuotes(state, index, scenario, models, { ocr, reuse, paybackTitles }) {
  const project = game.projectAt(index), units = { state: { ...state, items: { ...state.items } } };
  for (const [id, required] of Object.entries(project.req)) units[id] = studyUnits({ ...state, projectIndex: index }, id, required);
  const current = taskQuote(state, index, scenario, models, units);
  const budget = game.salesForecast(state, index, 80).gross * (1 - game.STORE_FEE_RATE);
  if (!budget || !Number.isFinite(current) || current <= 0) return [];
  return game.SHOP.filter(item => item.id !== 'kitchen' && (ocr || item.id !== 'macro') && (reuse || item.id !== 'library') && item.id !== 'macro' && game.shopUnlocked(state, item) && (!item.max || game.level(state, item.id) < item.max)).map(item => {
    const preview = { ...state, items: { ...state.items, [item.id]: game.level(state, item.id) + 1 } };
    const after = taskQuote(preview, index, scenario, models, units), saved = Math.max(0, current - after), cost = game.itemCost(state, item);
    return { id: item.id, cost, savedSeconds: saved, projectSeconds: current, payback: saved ? cost / (budget * saved / current) : Infinity };
  }).filter(quote => quote.savedSeconds > 0 && quote.payback <= paybackTitles).sort((a, b) => a.payback - b.payback);
}

export function simulate(scenario, { horizon = 90 * 86400, stopAfter = Infinity, maxRuns = 40, repeats = true, ocr = false, office = ocr, onlineMaterials = true, policy = 'steady', maintenance = true, reuse = true, outsource = false, paybackTitles = 3, onEvent = null } = {}) {
  let state = game.createState(0), time = 0, nextDecision = 0, stage = null, fundingFor = null;
  game.setDevelopmentPolicy(state, policy);
  const milestones = [], prestiges = [], stages = [], runs = [], purchaseHistory = [], materialsOpened = [], modes = emptyModes(), income = emptyIncome();
  const models = Object.fromEntries(['work', 'study', 'dev'].map(mode => [mode, manualInputModel(scenario, mode)]));
  let inactiveProcessed = 0, offlineCappedSeconds = 0;
  let activeSeconds = 0, manualInputs = 0, minimumCash = state.cash, spent = 0, outsourcingSpend = 0, expenses = 0, capitalChanges = 0, status = 'horizon', failureReason = null;
  const repeatIds = new Set();
  const runNumber = () => state.resets + 1;
  const reserve = () => game.dailyBillEstimate(state) + game.ocrReserve(state);
  const ensureRun = () => {
    if (runs.at(-1)?.run !== runNumber()) runs.push({ run: runNumber(), startSeconds: time, startActiveSeconds: activeSeconds, startKnowledge: knowledge(state), experience: { ...state.experience }, releases: 0, repeats: 0 });
    return runs.at(-1);
  };
  const finishStage = reason => { if (stage) { stage.endSeconds = time; stage.reason = reason; stage = null; } };
  const ensureStage = () => {
    ensureRun();
    if (stage && (stage.run !== runNumber() || stage.index !== state.projectIndex)) finishStage('selected-another-project');
    if (!stage) { stage = { run: runNumber(), index: state.projectIndex, name: game.projectAt(state.projectIndex).name, startSeconds: time, elapsedSeconds: 0, activeSeconds: 0, modeSeconds: emptyModes(), output: emptyOutput(), income: emptyIncome() }; stages.push(stage); }
    return stage;
  };
  const addIncome = (key, amount) => { income[key] += amount; ensureStage().income[key] += amount; };
  const invest = (id, reason) => {
    const cost = game.itemCost(state, items[id]);
    if (state.cash - cost < reserve() || !game.buy(state, id)) return false;
    spent += cost; minimumCash = Math.min(minimumCash, state.cash);
    purchaseHistory.push({ run: runNumber(), seconds: time, projectIndex: state.projectIndex, id, level: game.level(state, id), cost, reason });
    return true;
  };
  const openMaterials = index => { if (onlineMaterials) for (const id of Object.keys(game.projectAt(index).req)) if (game.openOnlineMaterial(state, id)) materialsOpened.push({ run: runNumber(), seconds: time, id }); };
  const fundingProject = goal => [3, 2].find(index => index < goal && state.experiencedProjects.includes(index) && game.projectAccess(state, index).allowed);
  const doPrestige = () => {
    const preview = game.prestigePreview(state), beforeCash = state.cash, beforeKnowledge = knowledge(state), oldRun = ensureRun();
    const next = game.prestige(state, time * 1000);
    if (!next) return false;
    prestiges.push({ seconds: time, activeSeconds, run: runNumber(), experienceBefore: { ...state.experience }, gain: { ...preview.experience }, experienceAfter: { ...next.experience }, knowledgeBefore: beforeKnowledge, knowledgeAfter: knowledge(next), retiredCash: beforeCash, discardedSales: remainingRevenue(state) });
    onEvent?.({ type: 'prestige', ...prestiges.at(-1) });
    Object.assign(oldRun, { endSeconds: time, elapsedSeconds: time - oldRun.startSeconds, activeSeconds: activeSeconds - oldRun.startActiveSeconds, gain: { ...preview.experience }, experienceAfter: { ...next.experience } });
    finishStage('prestige'); state = next; game.setDevelopmentPolicy(state, policy); repeatIds.clear(); capitalChanges += state.cash - beforeCash; fundingFor = null; ensureRun();
    return true;
  };
  const finishRelease = () => {
    const index = state.projectIndex, repeat = state.completedProjects.includes(index), oldStage = ensureStage(), beforeKnowledge = knowledge(state), run = ensureRun();
    const title = game.release(state);
    if (!title) return false;
    income.launchPayout += title.payout; oldStage.income.launchPayout += title.payout;
    if (repeat) { repeatIds.add(title.id); income.repeatLaunch += title.payout; oldStage.income.repeatLaunch += title.payout; run.repeats++; }
    const milestone = { index, series: 1 + milestones.filter(m => m.run === runNumber() && m.index === index).length, name: title.name, run: runNumber(), repeat, seconds: time, runSeconds: time - run.startSeconds, activeSeconds, commercial: title.unitPrice > 0, payout: title.payout, fullSalesNet: (title.grossPayout + game.remainingSales(title)) * (1 - game.STORE_FEE_RATE), price: title.unitPrice, copies: title.totalCopies, cash: state.cash, builds: title.builds, productionCosts: title.productionCosts, confirmedKnowledge: beforeKnowledge, experienceEarned: { ...title.experienceEarned }, runExperience: { ...state.runExperience }, fundingFor: fundingFor && { ...fundingFor } };
    milestones.push(milestone); onEvent?.({ type: 'release', ...milestone }); run.releases++; oldStage.milestone = milestones.length - 1; finishStage('released'); fundingFor = null;
    return true;
  };
  ensureRun();
  while (time < horizon) {
    const active = activeAt(scenario, time);
    if (active && time >= nextDecision) {
      nextDecision = time + 15;
      const current = game.projectAt(state.projectIndex);
      if (state.progress >= current.target && game.knowledgeRatio(state) >= 1 && !state.crashed && state.defects <= game.defectLimit(state) * .1) finishRelease();
      if (milestones.some(m => m.index === 4 && m.commercial)) { status = 'aaa'; break; }
      if (milestones.length >= stopAfter) { status = 'release-limit'; break; }
      const idle = !state.progress && !state.defects && !state.crashed && (!state.debt || state.projectCarryover);
      let goal = nextExperienceProject(state), waitForMoney = false;
      if (idle && goal === undefined && game.prestigePreview(state).available) {
        if (runNumber() >= maxRuns) { status = 'run-limit'; break; }
        doPrestige(); goal = nextExperienceProject(state);
      }
      if (goal === undefined) goal = state.projectIndex;
      openMaterials(goal);
      const required = game.projectAccess(state, goal).missing.filter(r => r.kind === 'item');
      for (const requirement of required) while (game.level(state, requirement.id) < requirement.required && invest(requirement.id, `access-${goal}`)) {}
      let target = goal;
      const missing = game.projectAccess(state, goal).missing.filter(r => r.kind === 'item');
      const funding = fundingProject(goal);
      if (missing.length) {
        const requirement = missing[0], needed = game.itemCost(state, items[requirement.id]);
        fundingFor = { index: goal, item: requirement.id, cost: needed };
        if (repeats && funding !== undefined) target = funding;
        else waitForMoney = true;
      }
      // Capacity investments must repay their cost within three copies of the
      // planned scale. No item is made a mandatory cash grind unless access
      // actually requires it. Optional upgrades use money already received;
      // repeat projects finance access requirements, not speculative purchases.
      const quotes = investmentQuotes(state, target, scenario, models, { ocr, reuse, paybackTitles });
      for (const quote of quotes) if (state.cash - quote.cost >= reserve()) { invest(quote.id, 'capacity-payback'); break; }
      if (ocr && game.availableOfficeWork(state) > 0 && !game.level(state, 'macro')) invest('macro', 'optional-office-contract');
      if (idle && target !== state.projectIndex) {
        if (!game.selectProject(state, target) && !state.progress && !state.debt && !state.defects && game.projectAccess(state, target).allowed) {
          game.runBuild(state, 'review'); game.selectProject(state, target);
        }
      }
      const selectionBlocked = target !== state.projectIndex && !state.progress;
      openMaterials(state.projectIndex);
      if (outsource) for (const quote of game.productionOptions(state)) if (!quote.ordered && state.cash - quote.cost >= reserve() && game.orderProduction(state, quote.id)) { outsourcingSpend += quote.cost; minimumCash = Math.min(minimumCash, state.cash); }
      const need = Object.entries(game.projectAt(state.projectIndex).req).filter(([id, required]) => game.skillKnowledge(state, id) < required).sort((a, b) => game.skillKnowledge(state, a[0]) / a[1] - game.skillKnowledge(state, b[0]) / b[1]);
      if (need.length) state.subject = need[0][0];
      if (waitForMoney && !state.progress) {
        const cost = fundingFor?.cost || Infinity;
        const officeBudget = office ? game.availableOfficeWork(state) * game.workRate(state) + state.ocr.pendingReward : 0;
        if (state.cash + remainingRevenue(state) + officeBudget < cost) { status = 'policy-blocked'; failureReason = { kind: 'finite-budget-without-repeats', goal, cash: state.cash, remainingSales: remainingRevenue(state), officeBudget, needed: cost }; break; }
        if (state.debt && !state.projectCarryover) { state.mode = 'dev'; state.refactor = true; state.autoEnabled = true; }
        else { state.mode = office && (game.availableOfficeWork(state) > 0 || state.ocr.pending > 0) ? 'work' : 'wait'; state.autoEnabled = false; }
      } else if (selectionBlocked) {
        // Buying a library can import debt and temporarily prevent selecting
        // the intended project. Review that code instead of starting an
        // unrequested repeat of the previous scale.
        if (state.debt || state.defects || state.crashed) { state.mode = 'dev'; state.refactor = true; state.autoEnabled = true; }
        else { status = 'policy-blocked'; failureReason = { kind: 'project-selection-refused', target, current: state.projectIndex }; break; }
      } else {
        state.mode = need.length ? 'study' : 'dev';
        if (!need.length) {
          if (state.refactor && !state.defects && !state.debt) state.refactor = false;
          if (state.crashed || state.defects > game.defectLimit(state) * .1 || maintenance && game.developmentEfficiency(state) < .8) state.refactor = true;
        }
        state.autoEnabled = !need.length;
      }
    }
    const currentStage = ensureStage(), dt = active ? 1 : Math.min(60, horizon - time);
    if (active) inactiveProcessed = 0;
    const coreDt = active ? dt : Math.min(dt, Math.max(0, game.OFFLINE_LIMIT - inactiveProcessed));
    if (!active) { inactiveProcessed += coreDt; offlineCappedSeconds += dt - coreDt; }
    currentStage.elapsedSeconds += dt;
    if (active) {
      const mode = state.mode === 'dev' ? state.refactor ? 'review' : 'development' : state.mode;
      currentStage.modeSeconds[mode]++; modes[mode]++; currentStage.activeSeconds++; activeSeconds++;
      if (state.mode !== 'wait') {
        state.workTask = state.mode === 'work' && state.ocr.pending > 0 ? 'correction' : 'entry';
        const correction = state.workTask === 'correction' ? nextOCRError(state.ocr) : null;
        const model = correction ? manualInputModel(scenario, 'work', { workLength: correction.correctValue.length }) : models[state.mode];
        const before = snapshot(state), power = scenario.typing ? game.typingPower(state) : game.handPower(state);
        const result = game.input(state, { chars: power * model.unitsPerSecond });
        outputSince(state, currentStage.output, 'manual', before);
        if (state.mode === 'work') {
          addIncome(correction ? 'ocrRecovered' : 'manualJobs', result.amount);
          if (correction) { addIncome('ocrNet', result.amount); currentStage.output.manualOCRRecovered += result.amount; }
        }
        state.stats.manual += model.attemptRate - 1; manualInputs += model.attemptRate;
      }
    }
    const before = snapshot(state), earned = state.stats.earned, serverFees = state.stats.serverFees;
    const sales = game.finiteSalesGross(state, coreDt) * (1 - game.STORE_FEE_RATE);
    const repeatBefore = state.catalog.filter(title => repeatIds.has(title.id)).reduce((sum, title) => sum + game.remainingSales(title), 0);
    game.tick(state, coreDt); outputSince(state, currentStage.output, 'auto', before);
    const cancelled = state.ocr.pendingReward - before.pending, fees = state.ocr.fees - before.fees;
    const ocrNet = game.level(state, 'macro') ? state.stats.earned - earned - sales : 0;
    addIncome('gameRoyalties', sales); addIncome('ocrNet', ocrNet); addIncome('ocrGross', ocrNet + cancelled + fees); addIncome('ocrCancelled', cancelled); addIncome('ocrFees', fees);
    const repeatAfter = state.catalog.filter(title => repeatIds.has(title.id)).reduce((sum, title) => sum + game.remainingSales(title), 0);
    addIncome('repeatTail', Math.max(0, repeatBefore - repeatAfter) * (1 - game.STORE_FEE_RATE));
    expenses += state.stats.serverFees - serverFees;
    minimumCash = Math.min(minimumCash, state.cash); time += dt;
  }
  finishStage(status);
  const lastRun = runs.at(-1); Object.assign(lastRun, { endSeconds: time, elapsedSeconds: time - lastRun.startSeconds, activeSeconds: activeSeconds - lastRun.startActiveSeconds, gain: { ...state.runExperience } });
  const aaa = milestones.find(m => m.index === 4 && m.commercial) || null;
  const firstCommercial = milestones.find(m => m.commercial) || null;
  return { ...scenario, route: { onlineMaterials, ocr, office, repeats, paybackTitles }, status, failureReason, reachedAAA: !!aaa, aaa, firstCommercial, firstPrestige: prestiges[0] || null, elapsedSeconds: time, simulatedSeconds: state.stats.time, offlineCappedSeconds, activeSeconds, manualInputs, workShare: activeSeconds ? modes.work / activeSeconds : 0, milestones, prestiges, runs, stages, modeSeconds: modes, income, purchaseHistory, materialsOpened, minimumCash, spent, outsourcingSpend, expenses, capitalChanges, finalCash: state.cash, earned: state.stats.earned, itemLevels: { ...state.items }, careerExperience: { ...state.experience }, runExperience: { ...state.runExperience }, officeRemaining: game.availableOfficeWork(state), ocrLedger: state.ocr, finalProjectIndex: state.projectIndex, finalProgress: state.progress, finalTarget: game.projectAt(state.projectIndex).target, finalKnowledgeRatio: game.knowledgeRatio(state), finalAccess: game.projectAccess(state), remainingSales: remainingRevenue(state) };
}

export const reportFor = scenarios => ({
  balanceVersion: game.BALANCE_VERSION,
  target: '無料習作で経験を持ち帰り、連作と複数の開発人生を経てチームでAAAへ',
  method: '新規セーブ、無料オンライン教材を実APIで取得し、資金・知識・経験を注入しない。初周は無料2作から転生、以後は未獲得の規模の経験を優先する。経験だけで解禁可能な次規模の必要設備を実購入し、資金不足なら知識を満たした商業規模で新作を作る。同規模連作から追加の企画経験は得ない。任意設備は、現在の学習・制作能力から見積もった短縮時間が同規模3作までで購入額を回収するものを検討する目安で、最適方針や実測を意味しない。解禁がこれ以上進まない人生は実際の転生条件を満たして確定済み知識と3種の経験を持ち帰る。初周AAA到達期限は設けない。標準はOCR/短期事務を使わず、別条件だけ5000作業量の有限契約を許す。継続売上は有限市場の正確な区間積分、公開時収入と区別し、転生時の所持金・残市場の放棄も記録。購入・企画選択・公開・転生の判断は15秒ごと、入力は1秒ごとに正解/完入力ボーナスを按分する。コード読取と切替時間ゼロ、300物理打鍵/分で全問正解・完入力を仮定する比較であり実プレイの所要時間保証ではない。帰還型は初回1時間、その後16時間の活動帯で2時間ごと5分、夜8時間離席。ページを閉じる帰還型を想定し、各離席のcore進行を最大8時間に制限する。上限を超えた離席も実経過には含め、売上や自動進捗を足さない。進行する離席tickは60秒ずつ集計しcore内部の1秒処理を使う。未到達は未到達として状態と理由を記録する。',
  scenarios
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = reportFor(SCENARIOS.map(scenario => simulate(scenario)));
  for (const result of report.scenarios) {
    console.log(`${result.name}: ${result.status} / ${(result.elapsedSeconds / 3600).toFixed(2)}h、操作 ${(result.activeSeconds / 3600).toFixed(2)}h、${result.runs.length}人生・${result.milestones.length}公開・事務 ${(result.workShare * 100).toFixed(2)}%`);
    for (const run of result.runs) console.log(`  人生${run.run}: ${(run.elapsedSeconds / 3600).toFixed(2)}h、公開${run.releases}（連作${run.repeats}）、経験 ${JSON.stringify(run.gain)}`);
  }
  if (process.argv.includes('--write')) { await writeFile(new URL('../src/pacing.js', import.meta.url), `// Generated by npm run balance -- --write. Do not edit numbers by hand.\nexport const PACING_REPORT = ${JSON.stringify(report, null, 2)};\n`); console.log('Updated src/pacing.js'); }
}
