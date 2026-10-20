import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/core.js';
import { challengeTopics } from '../src/challengecatalog.js';
import { requiredChallengeBookLevel } from '../src/challengeaccess.js';
import { skillQuizTopics } from '../src/skillquiz.js';
import { FIRST_PROJECT_PARTS, FIRST_PROJECT_LANGUAGES } from '../src/firstproject.js';

function student(subject = 'syntax', language = 'cpp') {
  const s = game.createState(0);
  s.mode = 'study'; s.studyStyle = 'quiz'; s.subject = subject; s.typing.language = language;
  game.openOnlineMaterial(s, subject);
  return s;
}
function choose(s, difficulty) {
  const lesson = challengeTopics(s.typing.language, s.subject).find(q => q.difficulty === difficulty);
  assert.ok(lesson, `${s.typing.language}/${s.subject} has difficulty ${difficulty}`);
  s.quiz.cursors[`${s.typing.language}/${s.subject}`] = lesson.index;
  return lesson;
}
function assertNoReward(result) {
  assert.equal(result.kind, 'none');
  for (const field of ['amount', 'learned', 'verified', 'progress', 'fixed', 'debtRemoved', 'studyUnits', 'implementationUnits']) {
    assert.equal(result[field], 0, field);
  }
}

test('Challenge difficulty maps to subject textbook levels while first-game parts stay free', () => {
  for (const [difficulty, required] of [[1,0],[2,0],[3,1],[4,2],[5,3],[6,4]]) {
    assert.equal(requiredChallengeBookLevel({difficulty}), required);
    assert.equal(requiredChallengeBookLevel({difficulty, firstProjectPart:0}), 0);
    const state = student(), question = {id:`test/level-${difficulty}`, subject:'syntax', difficulty};
    state.items['book-syntax'] = Math.max(0, required - 1);
    assert.equal(game.challengeAccess(state, question).available, required === 0);
    state.items['book-syntax'] = required;
    assert.equal(game.challengeAccess(state, question).available, true);
  }
  const s = student();
  for (const subject of game.SKILLS.map(skill => skill.id)) {
    game.openOnlineMaterial(s, subject);
    const question = {id:`test/${subject}`, subject, difficulty:4};
    const access = game.challengeAccess(s, question);
    assert.equal(access.bookId, `book-${subject}`);
    assert.equal(access.bookName, game.SHOP.find(book => book.id === access.bookId).name);
    assert.equal(access.requiredLevel, 2);
    assert.equal(access.ownedLevel, 0);
    assert.equal(access.available, false);
    s.items[`book-${subject}`] = 2;
    assert.equal(game.challengeAccess(s, question).available, true);
  }
});

test('free material opens basic Challenges; purchasing the required book opens an applied task', () => {
  const s = student(), basic = choose(s, 2);
  assert.equal(game.challengeAccess(s, basic).available, true);
  const lesson = choose(s, 3), before = structuredClone(s), access = game.challengeAccess(s);
  assert.equal(access.available, false); assert.equal(access.requiredLevel, 1); assert.equal(access.review, false);
  assert.match(access.reason, /プログラミング基礎教本 Lv\.1/);
  assertNoReward(game.quizRewardPreview(s));
  assert.deepEqual(s, before, 'preview never mutates the save');
  assertNoReward(game.completeQuiz(s, lesson.id));
  assert.deepEqual(s, before, 'direct completion cannot bypass the book requirement');
  s.cash = 1500;
  assert.equal(game.buy(s, 'book-syntax'), true);
  assert.equal(s.cash, 0);
  assert.equal(game.challengeAccess(s).available, true);
  assert.equal(game.challengeAccess(s).ownedLevel, 1);
  assert.ok(game.completeQuiz(s, lesson.id).amount > 0);
  assert.ok(s.quiz.completed.includes(lesson.id));
});

test('locked development Challenges cannot award understanding, verification, code or maintenance work', () => {
  const s = student('systems'), lesson = choose(s, 4);
  s.mode = 'dev'; s.devStyle = 'quiz'; s.projectIndex = 3; s.legacyPermit = 3; s.refactor = true;
  s.skills.systems = 1000; s.studyGaps.systems = 100; s.progress = 100; s.debt = 100; s.defects = 20;
  s.items['book-systems'] = 1;
  const before = structuredClone(s);
  assert.equal(game.challengeAccess(s).requiredLevel, 2);
  assertNoReward(game.quizRewardPreview(s));
  assertNoReward(game.completeQuiz(s, lesson.id));
  assert.deepEqual(s, before);
});

test('locked selection and draft persist while next Challenge skips inaccessible entries', () => {
  const s = student(), locked = choose(s, 3), key = 'cpp/syntax';
  assert.equal(game.setQuizDraft(s, 'keep my unfinished implementation'), true);
  const restored = game.deserialize(game.serialize(s, 0));
  assert.equal(game.quizLesson(restored).id, locked.id);
  assert.equal(restored.quiz.drafts[locked.id], 'keep my unfinished implementation');
  assert.equal(game.challengeAccess(restored).available, false);
  game.nextQuiz(restored);
  assert.notEqual(restored.quiz.cursors[key], locked.index);
  assert.equal(game.challengeAccess(restored).available, true);
  assert.equal(restored.quiz.drafts[locked.id], 'keep my unfinished implementation');
  const pool = challengeTopics('cpp', 'syntax');
  s.quiz.cursors[key] = pool.length - 1;
  game.nextQuiz(s);
  assert.equal(s.quiz.cursors[key], 0, 'next wraps through the finite catalog');
  s.onlineMaterials = []; const cursor = s.quiz.cursors[key];
  game.nextQuiz(s);
  assert.equal(s.quiz.cursors[key], cursor, 'no available task leaves selection unchanged');
});

test('completed tasks remain reviewable after book loss and prestige, but still need subject material', () => {
  const s = student(), lesson = choose(s, 3);
  s.items['book-syntax'] = 1;
  game.completeQuiz(s, lesson.id);
  delete s.items['book-syntax'];
  assert.equal(game.challengeAccess(s).available, true);
  assert.equal(game.challengeAccess(s).review, true);
  assert.equal(game.challengeAccess(s).ownedLevel, 0);
  s.runBest = 2; s.runExperience = {craft:5, design:2, audience:1};
  const fresh = game.prestige(s, 0);
  assert.ok(fresh);
  fresh.mode = 'study'; fresh.studyStyle = 'quiz'; fresh.subject = 'syntax'; fresh.typing.language = 'cpp';
  fresh.quiz.cursors['cpp/syntax'] = lesson.index;
  assert.equal(game.level(fresh, 'book-syntax'), 0);
  assert.equal(game.quizLesson(fresh).id, lesson.id);
  assert.equal(game.challengeAccess(fresh).available, true);
  assert.equal(game.challengeAccess(fresh).review, true);
  fresh.onlineMaterials = [];
  const before = structuredClone(fresh);
  assert.equal(game.challengeAccess(fresh).available, false);
  assertNoReward(game.completeQuiz(fresh, lesson.id));
  assert.deepEqual(fresh, before);
});

test('all three first-game components can be built with free material in every language', () => {
  for (const language of FIRST_PROJECT_LANGUAGES) {
    const s = student('syntax', language);
    s.mode = 'dev'; s.devStyle = 'quiz'; s.skills.syntax = 12;
    assert.deepEqual(s.items, {});
    for (const part of FIRST_PROJECT_PARTS) {
      const lesson = game.quizLesson(s);
      assert.equal(lesson.firstProjectPart, part.index);
      assert.equal(game.challengeAccess(s).requiredLevel, 0);
      assert.equal(game.challengeAccess(s).available, true);
      assert.ok(game.completeQuiz(s, lesson.id).progress > 0);
      assert.equal(s.progress, part.end);
    }
    assert.equal(s.progress, 3000);
    assert.deepEqual(s.items, {});
    assert.equal(s.cash, 100);
  }
});

test('syntax Quiz remains available independently of Challenge textbook tiers', () => {
  const s = student(); s.studyStyle = 'skill-quiz';
  const question = skillQuizTopics('cpp', 'syntax').find(q => q.difficulty === 4);
  s.skillQuiz.cursors['cpp/syntax'] = question.index;
  const result = game.completeSkillQuiz(s, question.id, question.answer);
  assert.equal(result.passed, true);
  assert.ok(result.amount > 0);
  assert.deepEqual(s.items, {});
});
