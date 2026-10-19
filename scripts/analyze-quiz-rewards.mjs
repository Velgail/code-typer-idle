// Reproducible rule measurements, not a simulation of a person's thinking time.
// Run with --write to refresh the checked-in JSON report.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import {
  BALANCE_VERSION, DAY, createState, input, openOnlineMaterial, tick,
  studyGain, skillKnowledge, typingPower, unitRate, quizLesson,
  quizRewardPreview, completeQuiz, currentProject,
  QUIZ_STUDY_MULTIPLIER, QUIZ_IMPLEMENTATION_MULTIPLIER,
  QUIZ_VERIFICATION_MULTIPLIER
} from '../src/core.js';
import { lessonAt } from '../src/curriculum.js';
import { quizCatalog, QUIZ_LANGUAGES } from '../src/quizcatalog.js';
import { typingKeystrokes, TYPING_REWARD, TYPING_REFERENCE_RATE } from '../src/typing.js';

const LEGACY_QUIZ_UNITS = 1200;
const clone = value => structuredClone(value);
const quizzes = quizCatalog();
const outputURL = new URL('../research/quiz-rewards.json', import.meta.url);
const flags = process.argv.slice(2);
if (flags.some(flag => flag !== '--write')) throw new Error('Usage: node scripts/analyze-quiz-rewards.mjs [--write]');

function fixture({ lab = 0, knowledge = 0 } = {}) {
  const state = createState(0);
  state.mode = 'study';
  state.studyStyle = 'quiz';
  state.subject = 'syntax';
  state.typing.language = 'cpp';
  state.items.lab = lab;
  state.skills.syntax = knowledge;
  openOnlineMaterial(state, 'syntax');
  return state;
}

function copyUnits(state, quiz = quizLesson(state)) {
  const source = lessonAt(quiz.language, quiz.subject, quiz.index).code;
  return typingKeystrokes(source) * (TYPING_REWARD.character + TYPING_REWARD.completion)
    * typingPower(state, 'study', quiz.subject);
}

function selectQuiz(state, quiz) {
  state.typing.language = quiz.language;
  state.subject = quiz.subject;
  state.quiz.cursors[`${quiz.language}/${quiz.subject}`] = quiz.index;
}

function measure(state) {
  const topic = quizLesson(state);
  const before = JSON.stringify(state);
  const preview = quizRewardPreview(state);
  assert.equal(JSON.stringify(state), before, 'Preview must leave the fixture unchanged');
  const current = clone(state);
  const reward = completeQuiz(current, topic.id);
  assert.deepEqual(reward, preview, 'Preview must agree with the actual first-success reward');
  const old = clone(state);
  const legacy = input(old, { mode: 'study', subject: topic.subject, chars: LEGACY_QUIZ_UNITS, manual: false });
  const copied = clone(state);
  const units = copyUnits(state);
  const copy = input(copied, { mode: 'study', subject: topic.subject, chars: units, manual: true, countManual: false });
  return {
    typingPower: typingPower(state, 'study', topic.subject),
    copy: { workUnits: units, nominalKnowledge: studyGain(state, units, topic.subject), confirmedKnowledge: copy.amount },
    legacyQuiz: { workUnits: LEGACY_QUIZ_UNITS, nominalKnowledge: studyGain(state, LEGACY_QUIZ_UNITS, topic.subject), confirmedKnowledge: legacy.amount, verifiedKnowledge: legacy.verified },
    quiz: { workUnits: reward.studyUnits, nominalKnowledge: reward.learned, confirmedKnowledge: reward.amount, verifiedKnowledge: reward.verified },
    workRatioToCopy: reward.studyUnits / units,
    nominalKnowledgeRatioToCopy: reward.learned / studyGain(state, units, topic.subject)
  };
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { min: sorted[0], mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) };
}

const lessons = quizzes.map(quiz => {
  const source = lessonAt(quiz.language, quiz.subject, quiz.index).code;
  return { id: quiz.id, language: quiz.language, subject: quiz.subject, characters: source.length, physicalKeys: typingKeystrokes(source) };
});
const corpus = {
  uniqueQuizCount: quizzes.length,
  uniqueQuizzesPerSubject: quizzes.filter(quiz => quiz.subject === 'syntax').length,
  matchedTypingLessonVariant: 0,
  characters: distribution(lessons.map(lesson => lesson.characters)),
  physicalKeys: distribution(lessons.map(lesson => lesson.physicalKeys)),
  languages: QUIZ_LANGUAGES.map(language => {
    const rows = lessons.filter(lesson => lesson.language === language);
    return { language, count: rows.length, characters: distribution(rows.map(row => row.characters)), physicalKeys: distribution(rows.map(row => row.physicalKeys)) };
  })
};

const initial = fixture();
const firstQuiz = quizLesson(initial);
const initialMeasurement = measure(initial);
const afterFirstQuiz = clone(initial);
completeQuiz(afterFirstQuiz, firstQuiz.id);
const rewardAfterRepeatingFirstSuccess = completeQuiz(afterFirstQuiz, firstQuiz.id);
assert.equal(rewardAfterRepeatingFirstSuccess.amount, 0, 'A repeated success must not award more study knowledge');
assert.equal(rewardAfterRepeatingFirstSuccess.studyUnits, 0, 'A repeated success must not award more study work');
const initialCppSyntax = {
  quizId: firstQuiz.id,
  title: firstQuiz.title,
  sourceCharacters: lessonAt('cpp', 'syntax', 0).code.length,
  physicalKeys: typingKeystrokes(lessonAt('cpp', 'syntax', 0).code),
  ...initialMeasurement,
  firstProjectRequiredSyntax: currentProject(initial).req.syntax,
  syntaxAfterFirstSuccess: skillKnowledge(afterFirstQuiz, 'syntax'),
  firstProjectKnowledgeMet: skillKnowledge(afterFirstQuiz, 'syntax') >= currentProject(initial).req.syntax,
  rewardAfterRepeatingFirstSuccess,
  perfectCopyInputSeconds: typingKeystrokes(lessonAt('cpp', 'syntax', 0).code) / TYPING_REFERENCE_RATE,
  equalNewWorkQuizSeconds: typingKeystrokes(lessonAt('cpp', 'syntax', 0).code) / TYPING_REFERENCE_RATE * QUIZ_STUDY_MULTIPLIER
};

const equipment = [0, 1, 5, 20].map(lab => {
  const state = fixture({ lab, knowledge: 500 });
  return { lab, initialNominalKnowledge: 500, initialGap: 0, labUnitsPerSecond: unitRate(state, 'lab'), ...measure(state) };
});

const gapRecovery = [1, 5, 20].map(lab => {
  const state = fixture({ lab, knowledge: 500 });
  tick(state, 8 * 3600);
  const startGap = state.studyGaps.syntax;
  const old = clone(state), current = clone(state);
  let newQuestionsUntilGapCleared = null;
  const syntaxQuizzes = quizzes.filter(quiz => quiz.subject === 'syntax');
  for (const [index, quiz] of syntaxQuizzes.entries()) {
    // Legacy behavior is replayed directly: one 1200-unit study input for each
    // unique first success, with the usual input verification limit of 1 gain.
    input(old, { mode: 'study', subject: 'syntax', chars: LEGACY_QUIZ_UNITS, manual: false });
    selectQuiz(current, quiz);
    completeQuiz(current, quiz.id);
    if (newQuestionsUntilGapCleared === null && current.studyGaps.syntax === 0) newQuestionsUntilGapCleared = index + 1;
  }
  return {
    lab,
    elapsedSeconds: 8 * 3600,
    elapsedHours: 8,
    elapsedGameDays: 8 * 3600 / DAY,
    nominalKnowledgeAfterResearch: state.skills.syntax,
    confirmedKnowledgeAfterResearch: skillKnowledge(state, 'syntax'),
    gapAfterResearch: startGap,
    firstQuestion: measure(state),
    distinctSyntaxQuestions: syntaxQuizzes.length,
    legacyAfterAllQuestions: { verifiedKnowledge: startGap - old.studyGaps.syntax, remainingGap: old.studyGaps.syntax },
    currentAfterAllQuestions: { remainingGap: current.studyGaps.syntax, confirmedKnowledge: skillKnowledge(current, 'syntax') },
    newQuestionsUntilGapCleared
  };
});

const report = {
  schemaVersion: 1,
  balanceVersion: BALANCE_VERSION,
  reproduce: 'node scripts/analyze-quiz-rewards.mjs --write',
  assumptions: {
    purpose: 'Actual rule measurements of first-success rewards, not a playthrough, affordability proof, or measured human solution time.',
    fixtures: 'Fresh state with cash 100, no experience/assets, no books/monitor/keyboard, only free syntax material opened. The only item is the stated lab level; direct item assignment isolates equipment effects.',
    labAffordability: 'Lab levels 1/5/20 have cumulative unmodified prices 2000/242000/3486784400000. Level 20 is an extreme fixture, not an early-game purchase route.',
    initialKnowledge: 'Equipment and gap scenarios begin with nominal and confirmed syntax 500, gap 0. Initial C++ scenario starts at 0.',
    automation: 'Only lab study runs during the 8-hour interval. No development or OCR equipment; syntax remains the selected subject after satisfying the first project.',
    time: `Eight hours means 28800 elapsed simulation seconds. DAY=${DAY} seconds, so this is ${28800 / DAY} game days. No automation time passes between the measured quiz completions.`,
    physicalKeys: 'typingKeystrokes from src/typing.js replaces each ASCII space run with ceil(length/4) Tab keys, including short runs. Newlines and other characters each count once. No typing errors.',
    matchedSource: 'Work uses the canonical same-topic typing lesson at variant 0, never the submitted answer length; whitespace padding cannot increase it.',
    copyReward: 'Perfect copying receives 12 units per physical key plus completion 4, multiplied by current study typingPower. A batch input measures equal nominal XP, without interleaved automation.',
    legacy: 'The removed 1200-unit baseline is calculated with input directly. It verifies up to one new nominal knowledge gain, exactly as old completeQuiz did.',
    current: `Actual quizRewardPreview/completeQuiz; study work multiplier ${QUIZ_STUDY_MULTIPLIER}, implementation multiplier ${QUIZ_IMPLEMENTATION_MULTIPLIER}, verification limit ${QUIZ_VERIFICATION_MULTIPLIER} times new nominal knowledge. The verification limit includes the one gain already confirmed by input.`,
    finiteClaims: 'Each subject has 128 distinct quizzes across eight languages. Gap-recovery order is language catalog order, then topic index. Each is a first success; completed/rewarded claims prevent repeat farming.',
    interpretation: 'Four times work units does not imply four times knowledge because the XP curve diminishes. It does not imply four times hourly earnings: reading, thinking, compiling, and retries are unmeasured. Equal-new-work seconds compare only perfect physical typing at 300 keys/min.'
  },
  corpus,
  initialCppSyntax,
  equipment,
  gapRecovery
};

if (flags.includes('--write')) {
  writeFileSync(outputURL, `${JSON.stringify(report, null, 2)}\n`);
  console.log('Wrote research/quiz-rewards.json');
  console.table(gapRecovery.map(row => ({
    lab: row.lab, gapAfter8Hours: row.gapAfterResearch,
    oldGapAfter128Questions: row.legacyAfterAllQuestions.remainingGap,
    newQuestionsToVerifyGap: row.newQuestionsUntilGapCleared
  })));
} else console.log(JSON.stringify(report, null, 2));
