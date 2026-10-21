import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/core.js';
import { skillQuizCatalog, skillQuizTopics, skillQuizById } from '../src/skillquiz.js';
import { challengeCatalog, challengeTopics } from '../src/challengecatalog.js';

const clone=value=>structuredClone(value);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(actual),Math.abs(expected))*1e-9,`${actual} != ${expected}`);
function student(){const s=game.createState(0);s.mode='study';s.studyStyle='skill-quiz';s.subject='syntax';s.typing.language='cpp';game.openOnlineMaterial(s);return s;}
function solve(s){const q=game.skillQuizLesson(s);return game.completeSkillQuiz(s,q.id,q.answer);}

test('syntax quizzes are a separate study/dev style and retain core grading',()=>{
  const s=student(),q=game.skillQuizLesson(s),before=clone(s);
  assert.equal(game.skillQuizEligible(s),true);
  const wrong=game.completeSkillQuiz(s,q.id,'definitely_not_the_answer');
  assert.equal(wrong.passed,false);assert.equal(wrong.kind,'incorrect');assert.deepEqual(s,before);
  assert.equal(game.completeSkillQuiz(s,'unknown',q.answer).kind,'none');assert.deepEqual(s,before);
  s.mode='work';assert.equal(game.skillQuizEligible(s),false);assert.equal(solve(s).kind,'none');
  s.mode='study';s.studyStyle='quiz';assert.equal(game.skillQuizEligible(s),false);assert.equal(solve(s).kind,'none');
  s.studyStyle='skill-quiz';s.onlineMaterials=[];assert.equal(solve(s).kind,'none');
});

test('first syntax success pays authored-time study effort, never implementation or copied-lesson credit',()=>{
  const s=student();s.items={keyboard:2,lab:3,monitor:2,'book-syntax':1};s.mode='dev';s.devStyle='skill-quiz';
  const q=game.skillQuizLesson(s),before=clone(s),units=q.estimatedMinutes*60*80*1.5*game.typingPower(s,'study',q.subject),gain=game.studyGain(s,units,q.subject);
  const preview=game.skillQuizRewardPreview(s);assert.deepEqual(s,before);
  const result=solve(s);assert.equal(result.passed,true);assert.equal(result.kind,'correct');
  near(result.studyUnits,units);near(result.learned,gain);near(result.amount,gain);
  assert.deepEqual(Object.keys(s.skillQuiz.verifiedAt),[q.id]);assert.deepEqual(s.skillQuiz.completed,[q.id]);
  for(const key of ['progress','debt','defects','cash','quizWork'])assert.deepEqual(s[key],before[key]);
  assert.equal(result.implementationUnits,0);assert.equal(result.progress,0);assert.equal(s.stats.manual,0);
  assert.deepEqual(s.typing.completedLessons,{});
  for(const key of ['kind','amount','learned','verified','studyUnits','progress'])nearOrEqual(result[key],preview[key]);
});
function nearOrEqual(a,b){if(typeof a==='number')near(a,b);else assert.equal(a,b);}

test('same success and hand-earned knowledge cannot repeat XP or gap confirmation',()=>{
  const s=student();solve(s);const after=clone(s);assert.equal(solve(s).kind,'answered');assert.deepEqual(s,after);
  game.input(s,{mode:'study',chars:1000,automation:false,manual:false});
  const nominal=s.skills.syntax,study=s.stats.study;
  assert.equal(solve(s).amount,0);assert.equal(s.skills.syntax,nominal);assert.equal(s.stats.study,study);
});

test('known syntax quizzes confirm only available automatic gaps and do not discard another topic budget',()=>{
  const s=student();s.skills.syntax=5000;const first=game.skillQuizLesson(s);solve(s);game.nextSkillQuiz(s);const second=game.skillQuizLesson(s);solve(s);
  game.input(s,{mode:'study',chars:1e9,manual:false,automation:true});
  const nominal=s.skills.syntax,gap=s.studyGaps.syntax,study=s.stats.study;
  s.skillQuiz.cursors['cpp/syntax']=first.index;const checked=solve(s);
  assert.ok(checked.verified>0);assert.ok(checked.verified<gap);assert.equal(checked.studyUnits,0);
  assert.equal(s.skills.syntax,nominal);assert.equal(s.stats.study,study);near(s.studyGaps.syntax,gap-checked.verified);
  const once=clone(s);assert.equal(solve(s).verified,0);assert.deepEqual(s,once);
  s.skillQuiz.cursors['cpp/syntax']=second.index;const other=solve(s);assert.ok(other.verified>0,'the remaining shared pool was not skipped');
  assert.ok(s.studyGaps.syntax>0);assert.equal(s.skills.syntax,nominal);
  const loaded=game.deserialize(game.serialize(s,0));assert.equal(solve(loaded).verified,0);
  game.input(loaded,{mode:'study',chars:1000,manual:false,automation:true});
  assert.ok(solve(loaded).verified>0,'new research opens another confirmation budget');
});

test('failed known answers do not confirm gaps and correct verification is capped to the pool',()=>{
  const s=student(),q=game.skillQuizLesson(s);solve(s);game.input(s,{mode:'study',chars:100,manual:false,automation:true});
  const before=clone(s);assert.equal(game.completeSkillQuiz(s,q.id,'wrong').passed,false);assert.deepEqual(s,before);
  const result=solve(s);assert.ok(result.verified>0);assert.ok(result.verified<=before.studyGaps.syntax);assert.ok(s.studyGaps.syntax>=0);
  near(result.amount,result.verified);assert.equal(result.learned,0);
});

test('known Challenges also confirm later research without issuing another lifelong XP reward',()=>{
  const s=student();s.studyStyle='quiz';s.skills.syntax=500;
  const q=game.quizLesson(s);game.completeQuiz(s,q.id);
  game.input(s,{mode:'study',chars:1e6,manual:false,automation:true});
  const nominal=s.skills.syntax,gap=s.studyGaps.syntax,work=s.stats.study,preview=game.quizRewardPreview(s);
  const result=game.completeQuiz(s,q.id);assert.deepEqual(result,preview);assert.ok(result.verified>0);
  assert.equal(result.studyUnits,0);assert.equal(result.learned,0);assert.equal(s.skills.syntax,nominal);assert.equal(s.stats.study,work);
  near(s.studyGaps.syntax,gap-result.verified);assert.equal(game.completeQuiz(s,q.id).verified,0);
  const loaded=game.deserialize(game.serialize(s,0));assert.equal(game.completeQuiz(loaded,q.id).verified,0);
});

test('syntax cursors and drafts are bounded, independent, and cannot overfill the save',()=>{
  const s=student(),first=game.skillQuizLesson(s).id;assert.equal(game.setSkillQuizDraft(s,'draft'),true);
  game.nextSkillQuiz(s);assert.notEqual(game.skillQuizLesson(s).id,first);
  s.typing.language='rust';assert.equal(game.skillQuizLesson(s).index,0);s.subject='design';assert.equal(game.skillQuizLesson(s).index,0);
  const before=clone(s);assert.equal(game.setSkillQuizDraft(s,'x'.repeat(4097)),false);assert.deepEqual(s,before);
  s.subject='syntax';s.typing.language='cpp';for(let i=0;i<16;i++){game.setSkillQuizDraft(s,`answer-${i}`);game.nextSkillQuiz(s);}
  assert.equal(Object.keys(s.skillQuiz.drafts).length,12);
  const loaded=game.deserialize(game.serialize(s,0));assert.deepEqual(loaded.skillQuiz,s.skillQuiz);
  s.testPayload='x'.repeat(game.MAX_SAVE_BYTES);const drafts=clone(s.skillQuiz.drafts);
  assert.equal(game.setSkillQuizDraft(s,'too large in aggregate'),false);assert.deepEqual(s.skillQuiz.drafts,drafts);
  assert.equal(game.setQuizDraft(s,'also too large'),false);
});

test('all valid syntax IDs survive normalization, malformed metadata and unknown IDs do not',()=>{
  const s=student(),catalog=skillQuizCatalog();assert.equal(catalog.length,1024);
  s.skillQuiz.completed=[...catalog.map(q=>q.id),catalog[0].id,'unknown'];
  s.skillQuiz.cursors={'cpp/syntax':skillQuizTopics('cpp','syntax').length-1,'rust/design':-1,'unknown/design':1};
  s.skillQuiz.drafts={[catalog[0].id]:'answer',unknown:'x'};
  s.skillQuiz.verifiedAt={[catalog[0].id]:{nominal:0,automatic:0},[catalog[1].id]:{nominal:NaN,automatic:-1},unknown:{nominal:1,automatic:1}};
  const loaded=game.deserialize(game.serialize(s,0));assert.equal(loaded.skillQuiz.completed.length,1024);
  assert.deepEqual(loaded.skillQuiz.cursors,{'cpp/syntax':31});assert.deepEqual(loaded.skillQuiz.drafts,{[catalog[0].id]:'answer'});
  assert.deepEqual(loaded.skillQuiz.verifiedAt,{[catalog[0].id]:{nominal:0,automatic:0}});
  assert.ok(loaded.skillQuiz.completed.every(id=>skillQuizById(id)));
});

test('legacy Challenge saves retain their identity and new Quiz defaults; new styles survive reload',()=>{
  const s=student();delete s.skillQuiz;s.studyStyle='quiz';s.devStyle='quiz';s.balanceVersion=20;
  const q=game.quizLesson(s);s.quiz.completed=[q.id];s.quiz.rewarded=[q.id];
  const loaded=game.deserialize(JSON.stringify(s));assert.equal(loaded.studyStyle,'quiz');assert.equal(loaded.devStyle,'quiz');
  assert.deepEqual(loaded.quiz.completed,[q.id]);assert.deepEqual(loaded.quiz.rewarded,[q.id]);assert.deepEqual(loaded.skillQuiz,{cursors:{},completed:[],drafts:{},verifiedAt:{}});
  loaded.studyStyle='skill-quiz';loaded.devStyle='skill-quiz';const again=game.deserialize(game.serialize(loaded,0));
  assert.equal(again.studyStyle,'skill-quiz');assert.equal(again.devStyle,'skill-quiz');
});

test('Challenge claims normalize the whole variable catalog and code reuse pays a reduced share',()=>{
  const all=challengeCatalog();assert.ok(all.length>536);
  const s=student();s.quiz.completed=all.map(q=>q.id);s.quiz.rewarded=[...s.quiz.completed];s.quizWork=[...s.quiz.completed];
  const loaded=game.deserialize(game.serialize(s,0));assert.equal(loaded.quizWork.length,all.length);assert.equal(loaded.quiz.rewarded.length,all.length);
  s.quiz={cursors:{},firstParts:{},completed:[],rewarded:[],implemented:[],verifiedAt:{},drafts:{}};s.quizWork=[];
  s.mode='dev';s.devStyle='quiz';s.projectIndex=3;s.legacyPermit=3;for(const skill of game.SKILLS)s.skills[skill.id]=1e6;
  const q=game.quizLesson(s),first=game.completeQuiz(s,q.id);assert.ok(first.implementationUnits>0);assert.deepEqual(s.quiz.implemented,[q.id]);
  s.progress=game.currentProject(s).target;s.debt=0;s.defects=0;s.crashed=false;assert.ok(game.release(s));
  const expected=q.estimatedMinutes*60*80*game.QUIZ_IMPLEMENTATION_MULTIPLIER*game.CHALLENGE_REUSE_MULTIPLIER*game.typingPower(s,'dev',q.subject);
  const reused=game.completeQuiz(s,q.id);near(reused.implementationUnits,expected);assert.equal(reused.studyUnits,0);
  const saved=game.deserialize(game.serialize(s,0));assert.ok(saved.quiz.implemented.includes(q.id));
  assert.ok(challengeTopics('cpp','syntax').length>=32,'the original Challenge catalog remains available as advanced topics are appended');
});

test('new Challenge families pay full, another language pays sixty percent, and same-code reuse takes priority',()=>{
  const catalog=challengeCatalog(),first=catalog.find(q=>q.subject==='syntax' && q.familyId && catalog.some(other=>other.familyId===q.familyId && other.language!==q.language));
  assert.ok(first);const port=catalog.find(q=>q.familyId===first.familyId && q.language!==first.language);
  const s=student();s.studyStyle='quiz';
  const choose=q=>{s.typing.language=q.language;s.subject=q.subject;s.quiz.cursors[`${q.language}/${q.subject}`]=q.index;};
  choose(first);const original=game.completeQuiz(s,first.id);assert.equal(original.studyShare,1);
  choose(port);const translated=game.completeQuiz(s,port.id);assert.equal(translated.studyShare,.6);
  near(translated.studyUnits,port.estimatedMinutes*60*80*4*.6*game.typingPower(s,'study',port.subject));
  assert.equal(game.completeQuiz(s,port.id).studyUnits,0);
  s.mode='dev';s.devStyle='quiz';s.projectIndex=3;s.legacyPermit=3;for(const skill of game.SKILLS)s.skills[skill.id]=1e6;
  choose(first);const initialImplementation=game.completeQuiz(s,first.id);assert.equal(initialImplementation.implementationShare,1,'prior study is not prior implementation');
  choose(port);const portImplementation=game.completeQuiz(s,port.id);assert.equal(portImplementation.implementationShare,.6);
  s.progress=game.currentProject(s).target;s.debt=0;s.defects=0;s.crashed=false;assert.ok(game.release(s));
  const reuse=game.completeQuiz(s,port.id);assert.equal(reuse.implementationShare,.25);assert.equal(reuse.studyUnits,0);
});

test('prestige preserves solved syntax knowledge and verification records, and clears no new XP claims',()=>{
  const s=student(),q=game.skillQuizLesson(s);solve(s);s.runBest=2;s.runExperience.craft=1;
  game.input(s,{mode:'study',chars:1000,manual:false,automation:true});
  const fresh=game.prestige(s,0);assert.ok(fresh);assert.deepEqual(fresh.skillQuiz,s.skillQuiz);assert.equal(fresh.studyGaps.syntax,0);
  fresh.mode='study';fresh.studyStyle='skill-quiz';fresh.subject='syntax';fresh.typing.language='cpp';
  const nominal=fresh.skills.syntax;assert.equal(game.completeSkillQuiz(fresh,q.id,q.answer).studyUnits,0);assert.equal(fresh.skills.syntax,nominal);
});
