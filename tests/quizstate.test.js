import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, openOnlineMaterial, quizLesson, nextQuiz, setQuizDraft, completeQuiz, serialize, deserialize, prestige, QUIZ_UNITS } from '../src/core.js';

test('quiz completion requires the current exercise and material, and pays once across reload and prestige',()=>{
  const s=createState(0);s.studyStyle='quiz';s.mode='study';const quiz=quizLesson(s);
  assert.equal(completeQuiz(s,quiz.id).kind,'none');assert.deepEqual(s.quiz.completed,[]);
  openOnlineMaterial(s);assert.equal(completeQuiz(s,'quiz/v1/wrong').kind,'none');
  const reward=completeQuiz(s,quiz.id);assert.equal(reward.kind,'correct');assert.ok(reward.amount>0);assert.equal(s.stats.study,QUIZ_UNITS);
  const skill=s.skills.syntax;assert.equal(completeQuiz(s,quiz.id).kind,'answered');assert.equal(s.skills.syntax,skill);
  const loaded=deserialize(serialize(s));assert.equal(loaded.studyStyle,'quiz');assert.deepEqual(loaded.quiz.completed,[quiz.id]);assert.equal(completeQuiz(loaded,quiz.id).kind,'answered');
  loaded.runBest=2;loaded.runExperience.craft=1;
  // Use a defined experience key instead of relying on the visible UI labels.
  loaded.runExperience[Object.keys(loaded.experience)[0]]=1;
  const fresh=prestige(loaded);assert.ok(fresh);assert.equal(fresh.studyStyle,'quiz');assert.deepEqual(fresh.quiz.completed,[quiz.id]);
  fresh.mode='study';fresh.subject='syntax';assert.equal(completeQuiz(fresh,quiz.id).kind,'answered');
});

test('drafts and cursors are independent by language and subject; only recent bounded drafts are saved',()=>{
  const s=createState(0);setQuizDraft(s,'first');const first=quizLesson(s).id;
  nextQuiz(s);setQuizDraft(s,'second');assert.notEqual(quizLesson(s).id,first);
  s.typing.language='rust';assert.equal(s.quiz.cursors['rust/syntax']||0,0);setQuizDraft(s,'rust source');
  s.subject='design';setQuizDraft(s,'design source');
  const before=JSON.stringify(s.quiz);assert.equal(setQuizDraft(s,'x'.repeat(24001)),false);assert.equal(JSON.stringify(s.quiz),before);
  s.subject='syntax';s.typing.language='python';for(let i=0;i<16;i++){setQuizDraft(s,`draft ${i}`);nextQuiz(s);}
  assert.equal(Object.keys(s.quiz.drafts).length,12);assert.equal(s.quiz.drafts[first],undefined);
  const loaded=deserialize(serialize(s));assert.deepEqual(loaded.quiz,s.quiz);
});

test('legacy saves default to practice; malformed and unknown quiz data do not enter the save',()=>{
  const legacy=createState(0);delete legacy.quiz;const loaded=deserialize(JSON.stringify(legacy));assert.deepEqual(loaded.quiz,{cursors:{},completed:[],drafts:{}});
  const s=createState(0),id=quizLesson(s).id;
  s.quiz={cursors:{'cpp/syntax':100,'rust/design':3,'unknown/syntax':2},completed:[id,id,'unknown'],drafts:{[id]:'x'.repeat(24001),unknown:'code'}};
  const clean=deserialize(JSON.stringify(s));assert.deepEqual(clean.quiz.cursors,{'rust/design':3});assert.deepEqual(clean.quiz.completed,[id]);assert.deepEqual(clean.quiz.drafts,{});
});
