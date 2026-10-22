import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/core.js';
import {challengeCatalog, challengeTopics} from '../src/challengecatalog.js';
import {FIRST_PROJECT_PARTS, firstProjectQuizAt} from '../src/firstproject.js';
import {FIRST_PROJECT_STUDY_BASE} from '../src/challengerewards.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-9,`${actual} != ${expected}`);
const measured=()=>challengeTopics('cpp','syntax').find(q=>q.familyId==='io/sum-sequence');
function student(question=measured()){
 const s=game.createState(0);
 s.autoEnabled=false;s.mode='study';s.studyStyle='quiz';s.subject=question.subject;s.typing.language=question.language;
 game.openOnlineMaterial(s,question.subject);s.items[`book-${question.subject}`]=5;
 s.quiz.cursors[`${question.language}/${question.subject}`]=question.index;
 return s;
}
function expert(s){
 s.mode='dev';s.devStyle='quiz';s.projectIndex=3;s.legacyPermit=3;
 for(const skill of game.SKILLS)s.skills[skill.id]=1e6;
 return s;
}
function choose(s,q){
 s.subject=q.subject;s.typing.language=q.language;s.quiz.cursors[`${q.language}/${q.subject}`]=q.index;
}

test('calibrated Challenge work uses the frozen author result, independent of time and answer length',()=>{
 const q=measured(),s=student(q),base=q.rewardCalibration?.baseWorkUnits;
 assert.ok(Number.isFinite(base)&&base>0,'the measured family has a frozen work result');
 const original=game.quizRewardPreview(s,q);
 near(original.studyUnits,base*game.QUIZ_STUDY_MULTIPLIER*game.typingPower(s,'study',q.subject));
 for(const estimatedMinutes of [0,2,90,120,Number.MAX_VALUE,NaN]){
  const alternate={...q,estimatedMinutes,referenceSource:'// ignored\n'+q.referenceSource.repeat(3),rewardSource:'ignored'};
  assert.deepEqual(game.quizRewardPreview(s,alternate),original);
 }
 game.setQuizDraft(s,'int sum_sequence() { return 0; }');
 assert.deepEqual(game.quizRewardPreview(s),original,'a player draft cannot raise or lower rewards');
 const awarded=game.completeQuiz(s,q.id);
 assert.deepEqual(awarded,original,'the executable completion path awards its preview');
 assert.equal(game.completeQuiz(s,q.id).studyUnits,0,'repeat answers do not farm learning');
});

test('all seven implementation languages share the calibrated family base',()=>{
 const family=challengeCatalog().filter(q=>q.familyId==='io/sum-sequence');
 assert.equal(family.length,7);
 const base=measured().rewardCalibration.baseWorkUnits;
 for(const q of family){
  assert.equal(q.rewardCalibration.baseWorkUnits,base,q.language);
  const s=student(q),preview=game.quizRewardPreview(s,q);
  near(preview.studyUnits,base*game.QUIZ_STUDY_MULTIPLIER*game.typingPower(s,'study',q.subject));
 }
});

test('every Challenge has an explicit frozen work basis and old minute notes are retired',()=>{
 const catalog=challengeCatalog();
 const bases=new Set(['direct-raw-explanation-observation']);
 assert.ok(catalog.length>1100);
 for(const q of catalog){
  assert.ok(q.rewardCalibration,`${q.id}: missing reward basis`);
  assert.ok(Number.isFinite(q.rewardCalibration.baseWorkUnits)&&q.rewardCalibration.baseWorkUnits>0,q.id);
  assert.ok(bases.has(q.rewardCalibration.basis),`${q.id}: unknown reward basis`);
  if(q.difficultyRationale){
   assert.match(q.difficultyRationale.timeBasis,/実装文字数と旧分数は使用しない/,q.id);
   assert.doesNotMatch(q.difficultyRationale.timeBasis,/暫定の報酬基準/,q.id);
  }
 }
});

test('balance 22 and 23 saves keep solved claims, drafts and earned work after the reward recalibration',()=>{
 for(const previousBalance of [22,23]){
 const q=measured(),s=student(q);
 game.completeQuiz(s,q.id);game.setQuizDraft(s,q.starterSource);
 s.balanceVersion=previousBalance;s.cash=4321;
 const restored=game.deserialize(game.serialize(s,0));
 assert.equal(restored.balanceVersion,24);
 assert.equal(restored.cash,4321);
 assert.equal(restored.stats.study,s.stats.study);
 assert.deepEqual(restored.quiz.rewarded,s.quiz.rewarded);
 assert.deepEqual(restored.quiz.completed,s.quiz.completed);
 assert.deepEqual(restored.quiz.drafts,s.quiz.drafts);
 assert.equal(game.completeQuiz(restored,q.id).studyUnits,0,'a balance update cannot award the same solved question twice');
 }
});

test('calibrated work preserves study, development, cross-language transfer and later-project reuse shares',()=>{
 const q=measured(),port=challengeCatalog().find(x=>x.familyId===q.familyId&&x.language==='rust'),s=expert(student(q));
 const base=q.rewardCalibration.baseWorkUnits,initial=game.completeQuiz(s,q.id);
 near(initial.studyUnits,base*game.QUIZ_STUDY_MULTIPLIER*game.typingPower(s,'study',q.subject));
 near(initial.implementationUnits,base*game.QUIZ_IMPLEMENTATION_MULTIPLIER*game.typingPower(s,'dev',q.subject));
 choose(s,port);
 const translated=game.completeQuiz(s,port.id);
 assert.equal(translated.studyShare,game.CHALLENGE_TRANSFER_MULTIPLIER);
 assert.equal(translated.implementationShare,game.CHALLENGE_TRANSFER_MULTIPLIER);
 near(translated.studyUnits,base*game.QUIZ_STUDY_MULTIPLIER*.6*game.typingPower(s,'study',q.subject));
 near(translated.implementationUnits,base*game.QUIZ_IMPLEMENTATION_MULTIPLIER*.6*game.typingPower(s,'dev',q.subject));
 s.progress=game.currentProject(s).target;s.debt=0;s.defects=0;s.crashed=false;
 assert.ok(game.release(s));
 const reused=game.completeQuiz(s,port.id);
 assert.equal(reused.studyUnits,0);
 assert.equal(reused.implementationShare,game.CHALLENGE_REUSE_MULTIPLIER);
 near(reused.implementationUnits,base*game.QUIZ_IMPLEMENTATION_MULTIPLIER*.25*game.typingPower(s,'dev',port.subject));
});

test('bad calibration metadata grants no unverified Challenge work while syntax Quiz keeps its separate policy',()=>{
 const q=measured(),s=student(q),fallback=game.quizRewardPreview(s,{...q,rewardCalibration:undefined});
 assert.equal(fallback.studyUnits,0);assert.equal(fallback.implementationUnits,0);
 for(const value of [undefined,null,NaN,Infinity,-Infinity,0,-1,'500',{}]){
  assert.deepEqual(game.quizRewardPreview(s,{...q,rewardCalibration:{baseWorkUnits:value}}),fallback,String(value));
 }
 const capped=game.quizRewardPreview(s,{...q,rewardCalibration:{baseWorkUnits:Number.MAX_VALUE}});
 for(const key of ['studyUnits','amount','learned','verified'])assert.ok(Number.isFinite(capped[key]),key);
 assert.ok(capped.studyUnits<=1e250,'calibrated rewards use the shared finite game limit');
 const syntax=game.skillQuizLesson(s),before=game.skillQuizRewardPreview(s,syntax);
 assert.deepEqual(game.skillQuizRewardPreview(s,{...syntax,rewardCalibration:{baseWorkUnits:1e9}}),before);
});

test('the first game uses a curricular knowledge budget independent of source size and three separate implementation boundaries',()=>{
 const s=game.createState(0);s.autoEnabled=false;s.mode='dev';s.devStyle='quiz';s.subject='syntax';s.typing.language='cpp';
 game.openOnlineMaterial(s,'syntax');
 for(const part of FIRST_PROJECT_PARTS){
  const q=game.quizLesson(s),canonical=firstProjectQuizAt('cpp',part.index);
  assert.equal(q.id,canonical.id);
  const preview=game.quizRewardPreview(s,q),injected={...q,rewardCalibration:{baseWorkUnits:1e20},estimatedMinutes:120};
  assert.deepEqual(game.quizRewardPreview(s,injected),preview,'component work takes priority over generic calibration');
  near(preview.studyUnits,FIRST_PROJECT_STUDY_BASE*game.QUIZ_STUDY_MULTIPLIER*game.typingPower(s,'study','syntax'));
  assert.equal(game.completeQuiz(s,q.id).progress,1000);
  assert.equal(s.progress,part.end);
 }
 assert.equal(s.progress,3000);
});
