// Observe real career purchases/prestiges, then measure finite quiz banks on
// cloned states. No quiz-solving duration or automatic progress is invented.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as game from '../src/core.js';
import { challengeCatalog } from '../src/challengecatalog.js';
import { skillQuizAt, skillQuizCatalog } from '../src/skillquiz.js';
import { typingKeystrokes } from '../src/typing.js';
import { simulate, SCENARIOS } from './simulate-balance.mjs';

const flags = process.argv.slice(2);
if (flags.some(flag => flag !== '--write')) throw new Error('Usage: node scripts/analyze-quiz-career.mjs [--write]');
const clone = value => structuredClone(value);
const quizzes = challengeCatalog();
const generalIds = quizzes.map(quiz => quiz.id);
const outputURL = new URL('../research/quiz-career.json', import.meta.url);
const keys = quiz => typingKeystrokes(quiz.rewardSource ?? quiz.referenceSource);

function select(state, quiz) {
  state.mode = 'dev'; state.devStyle = 'quiz'; state.subject = quiz.subject;
  state.typing.language = quiz.language;
  state.quiz.cursors[`${quiz.language}/${quiz.subject}`] = quiz.index;
}

function summarizeState(state, meta) {
  return {
    seconds: meta.seconds, activeSeconds: meta.activeSeconds, run: meta.run,
    projectIndex: state.projectIndex, project: game.currentProject(state).name,
    target: game.currentProject(state).target, progress: state.progress,
    cash: state.cash, items: { ...state.items }, experience: { ...state.experience },
    confirmedKnowledge: Object.fromEntries(game.SKILLS.map(skill => [skill.id, game.skillKnowledge(state, skill.id)])),
    studyGaps: { ...state.studyGaps }, debt: state.debt, defects: state.defects,
    devCapacity: game.devCapacity(state), handPower: game.handPower(state),
    ideMultiplier: game.ideMultiplier(state), devTypingPower: game.typingPower(state, 'dev'),
    abstraction: game.abstraction(state), developmentEfficiency: game.developmentEfficiency(state),
    projectAccessAllowed: game.projectAccess(state).allowed
  };
}

function quizState(snapshot, newLearning) {
  const state = clone(snapshot);
  if (!newLearning) state.quiz.rewarded = [...new Set([...state.quiz.rewarded, ...generalIds])];
  state.mode = 'dev'; state.devStyle = 'quiz'; state.refactor = false;
  return state;
}

function measureOne(snapshot, newLearning = true) {
  const state = quizState(snapshot, newLearning);
  const required = Object.keys(game.currentProject(state).req);
  if (state.projectIndex !== 0) select(state, quizzes.find(quiz => quiz.language === 'cpp' && required.includes(quiz.subject)));
  const quiz = game.quizLesson(state);
  const reward = game.completeQuiz(state, quiz.id);
  return {
    newLearning, quizId: quiz.id, physicalKeys: keys(quiz), reward,
    progressPercent: reward.progress / game.currentProject(state).target * 100,
    finalDebt: state.debt, finalDefects: state.defects
  };
}

function measureFirstParts(snapshot) {
  const state = quizState(snapshot, true), steps = [], seen = new Set();
  while (state.progress < game.currentProject(state).target) {
    const quiz = game.quizLesson(state);
    if (seen.has(quiz.id)) break;
    seen.add(quiz.id);
    const reward = game.completeQuiz(state, quiz.id);
    steps.push({ quizId: quiz.id, progress: state.progress, knowledge: game.skillKnowledge(state, 'syntax'), reward });
    if (!reward.progress) break;
  }
  return { bank: 'first-project-parts', steps, complete: state.progress >= game.currentProject(state).target };
}

function measureBank(snapshot, language, newLearning) {
  const state = quizState(snapshot, newLearning);
  const target = game.currentProject(state).target;
  const required = Object.keys(game.currentProject(state).req);
  const relevant = quizzes.filter(quiz => required.includes(quiz.subject) && (language === 'all' || quiz.language === language));
  const bank = relevant.filter(quiz => game.challengeAccess(state, quiz).available);
  let implementationQuestions = 0, reviewQuestions = 0, attempted = 0;
  let implementationUnits = 0, learned = 0, verified = 0, fixed = 0, debtRemoved = 0;
  let atCodeCompletion = null;
  for (const quiz of bank) {
    if (state.progress >= target && !state.debt && !state.defects) break;
    select(state, quiz);
    if (state.progress >= target || state.crashed || state.defects > game.defectLimit(state) * .1 || game.developmentEfficiency(state) < .8) state.refactor = true;
    if (state.refactor && !state.debt && !state.defects) state.refactor = false;
    const reviewing = state.refactor;
    const reward = game.completeQuiz(state, quiz.id);
    attempted++; implementationUnits += reward.implementationUnits;
    learned += reward.learned; verified += reward.verified;
    fixed += reward.fixed; debtRemoved += reward.debtRemoved;
    if (reward.implementationUnits) {
      if (reviewing) reviewQuestions++; else implementationQuestions++;
    }
    if (state.progress >= target && atCodeCompletion === null) atCodeCompletion = {
      attemptedQuestions: attempted, implementationQuestions, reviewQuestions,
      debt: state.debt, defects: state.defects
    };
  }
  const completeAndClean = state.progress >= target && !state.debt && !state.defects;
  const released = completeAndClean ? game.release(clone(state)) : null;
  return {
    language, newLearning, availableQuestions: bank.length, lockedQuestions: relevant.length-bank.length, attemptedQuestions: attempted,
    implementationQuestions, reviewQuestions, implementationUnits,
    progress: state.progress - snapshot.progress, progressPercent: (state.progress - snapshot.progress) / target * 100,
    remainingProgress: Math.max(0, target - state.progress),
    learned, verified, fixed, debtRemoved, finalDebt: state.debt, finalDefects: state.defects,
    crashed: state.crashed, atCodeCompletion, completeAndClean, releaseAcceptedByCore: !!released
  };
}

function skillQuizComparison(snapshot) {
  const state=clone(snapshot),subject=Object.keys(game.currentProject(state).req)[0];
  state.mode='dev';state.devStyle='skill-quiz';state.subject=subject;state.typing.language='cpp';
  state.skillQuiz.cursors[`cpp/${subject}`]=0;
  const quiz=skillQuizAt('cpp',subject,0);
  return {id:quiz.id,estimatedMinutes:quiz.estimatedMinutes,difficulty:quiz.difficulty,reward:game.completeSkillQuiz(state,quiz.id,quiz.answer)};
}

function observeCareer(scenario) {
  const observed = new Map();
  const capture = (key, state, meta) => { if (!observed.has(key)) observed.set(key, { state: clone(state), meta: { ...meta } }); };
  const baseline = simulate(scenario, { onBeforeInput(state, meta) {
    const ready = state.mode === 'dev' && !state.refactor && !state.crashed && game.knowledgeRatio(state) >= 1 && state.progress < game.currentProject(state).target;
    if (!ready) return;
    if (state.projectIndex === 0) capture('first-project', state, meta);
    if (state.projectIndex === 2) {
      capture('first-commercial', state, meta);
      if (state.resets >= 5 && game.level(state, 'library')) capture('funding-indie', state, meta);
    }
    if (state.projectIndex === 3) capture('first-3d', state, meta);
    if (state.projectIndex === 4) capture('first-aaa', state, meta);
  } });
  assert.ok(baseline.reachedAAA, `${scenario.id} baseline must actually reach AAA`);
  const snapshots = [...observed].map(([key, { state, meta }]) => {
    const summary = {
      key, state: summarizeState(state, meta),
      purchasesAlreadyMadeThisRun: baseline.purchaseHistory.filter(purchase => purchase.run === meta.run && purchase.seconds <= meta.seconds).length,
      firstQuestion: measureOne(state), syntaxQuizComparison: skillQuizComparison(state)
    };
    if (state.projectIndex === 0) summary.firstProjectParts = measureFirstParts(state);
    else summary.banks = ['cpp', 'all'].flatMap(language => [false, true].map(newLearning => measureBank(state, language, newLearning)));
    return summary;
  });
  assert.equal(snapshots.length, 5, 'All five stage snapshots must be observed');
  return {
    scenario,
    baseline: { status: baseline.status, aaaReached: baseline.reachedAAA, aaaSeconds: baseline.aaa.seconds, elapsedSeconds: baseline.elapsedSeconds, activeSeconds: baseline.activeSeconds, lives: baseline.runs.length, publications: baseline.milestones.length, purchaseCount: baseline.purchaseHistory.length, minimumCash: baseline.minimumCash, officeWorkShare: baseline.workShare, ocr: baseline.route.ocr, office: baseline.route.office },
    snapshots
  };
}

const fresh = game.createState(0);
game.openOnlineMaterial(fresh, 'syntax');
const report = {
  schemaVersion: 2, balanceVersion: game.BALANCE_VERSION,
  catalogs: {challengeCount:quizzes.length,cppChallengeCount:quizzes.filter(quiz=>quiz.language==='cpp').length,skillQuizCount:skillQuizCatalog().length},
  reproduce: 'node scripts/analyze-quiz-career.mjs --write',
  assumptions: {
    baseline: 'Unmodified simulate() standard policies for continuous typing 300 physical keys/min and clicking 8/s. Free online materials, OCR/office disabled, real purchases and prestige, no cash/knowledge/equipment/experience grants.',
    observation: 'onBeforeInput runs immediately before each actual manual input, after mode/subject/review decisions. It only deep-clones the first eligible state at each stage. The source career is never changed by the observer.',
    timing: 'Manual input and core time advance in one-second steps. Purchasing, project selection, publication, and prestige decisions run every 15 seconds. Recorded activeSeconds includes the current input second.',
    snapshots: 'First knowledge-ready implementation state of the first project, first commercial project, funding indie after five prestiges, first 3D, and first AAA. This benchmark follows fixed tutorial projects, not custom plans.',
    quizExperiment: 'Each experiment uses a deep clone. It changes only UI mode/language/subject/cursor/review choices and calls completeQuiz. All Challenge tests are assumed to pass; this script does not run compilers or solve tasks. No time passes while solving: no extra purchases, sales, automatic implementation, or automatic study are credited.',
    learningCounterfactual: 'newLearning=false marks general quiz rewarded IDs as already claimed without changing knowledge or equipment. This suppresses new nominal XP but ordinary known-answer gap verification remains available. It is not a separately simulated earlier quiz route.',
    finiteBank: 'The current challengeCatalog determines the bank sizes reported below. Only subjects required by the project and unlocked by the snapshot textbook levels or actual completed-review history are eligible. Locked questions are counted separately. One implementation per ID per project; same-family language transfer pays 60%, previously implemented same ID pays 25%. The first project has its separate staged parts. Syntax Quiz adds study/verification and never implementation.',
    maintenance: 'Use remaining, unclaimed problems for actual review when defect/efficiency thresholds require it, or after implementation completes. A problem cannot be spent on both implementation and review on the same project.',
    rewardBasis: 'Challenge work is based on authored estimatedMinutes and current equipment, never source length. The former source-length 32*sum(keys) upper bound and old 512-bank counts do not apply to this schema. Initial study/implementation shares and transfer/reuse are applied by actual core APIs.',
    interpretation: 'Snapshot question counts are not a full quiz-driven career time. Reading, thinking, editing, compilation, failures, and retries are unmeasured. Quiz reward work is abstract implementation effort, not literal submitted source length.'
  },
  firstProjectFreshStart: {
    method: 'Actual new save, free syntax material opened, no prior study or other input; switch directly to development quizzes.',
    initialCash: fresh.cash, initialSyntax: game.skillKnowledge(fresh, 'syntax'),
    firstQuestion: measureOne(fresh), parts: measureFirstParts(fresh)
  },
  careers: SCENARIOS.filter(scenario => !scenario.returning).map(observeCareer)
};

if (flags.includes('--write')) {
  writeFileSync(outputURL, `${JSON.stringify(report, null, 2)}\n`);
  console.log('Wrote research/quiz-career.json');
  for (const career of report.careers) {
    const aaa = career.snapshots.find(snapshot => snapshot.key === 'first-aaa');
    console.log(`${career.scenario.id}: real career ${(career.baseline.elapsedSeconds / 3600).toFixed(3)}h / ${career.baseline.lives} lives`);
    console.table(aaa.banks.map(bank => ({ language: bank.language, newLearning: bank.newLearning, implementation: bank.implementationQuestions, review: bank.reviewQuestions, progressPercent: bank.progressPercent, clean: bank.completeAndClean })));
  }
} else console.log(JSON.stringify(report, null, 2));
