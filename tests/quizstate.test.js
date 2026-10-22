import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, openOnlineMaterial, quizLesson, nextQuiz, setQuizDraft, completeQuiz, serialize, deserialize, prestige } from '../src/core.js';
import * as game from '../src/core.js';
import { lessonAt } from '../src/curriculum.js';
import { TYPING_REWARD, typingCompletionMultiplier, typingKeystrokes } from '../src/typing.js';
import {FIRST_PROJECT_STUDY_BASE} from '../src/challengerewards.js';
import { FIRST_PROJECT_PARTS, FIRST_PROJECT_LANGUAGES, firstProjectQuizAt, firstProjectQuizCatalog } from '../src/firstproject.js';

const copy=value=>structuredClone(value);
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(actual),Math.abs(expected))*1e-9,message || `${actual} != ${expected}`);
const puzzle=(extra={})=>({genreId:'number-puzzle',presentationId:'console',audioId:'silent',inputId:'keyboard-mouse',engineId:'toolkit',targets:['browser'],...extra});
function study(language='lua',subject='syntax'){
  const s=createState(0);s.mode='study';s.studyStyle='quiz';s.typing.language=language;s.subject=subject;
  openOnlineMaterial(s,subject);return s;
}
function expert(s){for(const skill of game.SKILLS)s.skills[skill.id]=1e6;s.autoEnabled=false;return s;}
function development(s=study()){
  expert(s);s.mode='dev';s.devStyle='quiz';s.projectIndex=2;s.legacyPermit=2;return s;
}
function baseUnits(quiz){
  return quiz.rewardCalibration?.baseWorkUnits ?? quiz.estimatedMinutes*60*80;
}
function rewarded(s){const q=quizLesson(s);completeQuiz(s,q.id);return q;}
function begin(s,extra={}){
  const result=game.startCustomProject(s,puzzle(extra));assert.equal(result.ok,true,result.reason);return result.id;
}
function enablePrestige(s){s.runBest=2;s.runExperience[Object.keys(s.experience)[0]]=1;}

test('first-project exercises are exclusive to the first fixed game outside review mode',()=>{
  const s=study();s.mode='dev';s.devStyle='quiz';assert.equal(game.firstProjectQuizMode(s),true);
  assert.equal(quizLesson(s).id,firstProjectQuizAt('lua',0).id);
  for(const mutate of [x=>x.mode='study',x=>x.devStyle='typing',x=>x.projectIndex=1,x=>x.refactor=true]){
    const other=copy(s);mutate(other);assert.equal(game.firstProjectQuizMode(other),false);assert.equal(quizLesson(other).firstProjectPart,undefined);
  }
  begin(s);assert.equal(game.firstProjectQuizMode(s),false);assert.equal(quizLesson(s).firstProjectPart,undefined);
});

test('first-project part boundaries tolerate floating point residue without changing saved progress',()=>{
  const s=createState(0);
  for(const [progress,index] of [[-1,0],[0,0],[999.9,0],[1000-5e-8,1],[1000,1],[1999.9,1],[2000,2],[2999.9,2],[3000,2]]){
    s.progress=progress;assert.equal(game.firstProjectPart(s).index,index,String(progress));assert.equal(s.progress,progress);
  }
});

test('a generic learning exercise unlocks three separate components instead of finishing the first game',()=>{
  const s=study(),generic=rewarded(s);assert.ok(game.skillKnowledge(s,'syntax')>0);assert.equal(s.progress,0);
  s.mode='dev';s.devStyle='quiz';assert.notEqual(quizLesson(s).id,generic.id);assert.equal(quizLesson(s).firstProjectPart,0);
  assert.equal(completeQuiz(s,generic.id).kind,'none','the old study answer cannot complete an unrelated project component');
  for(const part of FIRST_PROJECT_PARTS){
    const q=quizLesson(s);assert.equal(q.firstProjectPart,part.index);
    const before=s.progress,units=FIRST_PROJECT_STUDY_BASE*4*game.typingPower(s,'study','syntax');
    const preview=game.quizRewardPreview(s),r=completeQuiz(s,q.id);
    assert.deepEqual(r,preview);near(r.studyUnits,units);assert.equal(s.progress,part.end);near(r.progress,part.end-before);
    for(const language of FIRST_PROJECT_LANGUAGES)assert.equal(s.quiz.firstParts[language],Math.min(2,part.index+1));
  }
  assert.equal(s.progress,3000);assert.equal(quizLesson(s).firstProjectPart,2);assert.equal(s.quizWork.length,3);
  assert.equal(completeQuiz(s,quizLesson(s).id).implementationUnits,0);assert.equal(s.progress,3000);
});

test('all eight first-project language routes apply exactly one thousand implementation characters per component',()=>{
  for(const language of FIRST_PROJECT_LANGUAGES){
    const s=study(language);expert(s);s.mode='dev';s.devStyle='quiz';
    for(const part of FIRST_PROJECT_PARTS){
      const q=quizLesson(s),r=completeQuiz(s,q.id);
      assert.equal(q.firstProjectPart,part.index,language);assert.equal(r.progress,1000,`${language}/${part.index}`);
      assert.equal(s.progress,part.end,language);assert.equal(s.stats.valid,part.end,language);
    }
  }
});

test('all eight fresh direct implementation routes assemble the first game with staged knowledge and three equal curricular knowledge grants',()=>{
  for(const language of FIRST_PROJECT_LANGUAGES){
    const s=study(language);s.mode='dev';s.devStyle='quiz';
    assert.equal(s.skills.syntax,0);assert.equal(s.cash,100);assert.deepEqual(s.items,{});
    for(const part of FIRST_PROJECT_PARTS){
      assert.equal(game.currentProject(s).req.syntax,(part.index+1)*4,`${language}/${part.index} requirement`);
      const q=quizLesson(s),units=FIRST_PROJECT_STUDY_BASE*4*game.typingPower(s,'study','syntax');
      const gain=game.studyGain(s,units,'syntax'),preview=game.quizRewardPreview(s),r=completeQuiz(s,q.id);
      assert.deepEqual(r,preview);near(r.studyUnits,units,language);near(r.learned,gain,language);
      assert.equal(r.progress,1000,`${language}/${part.index} progress`);assert.equal(s.progress,part.end,language);
      assert.ok(game.skillKnowledge(s,'syntax')>=(part.index+1)*4,`${language}/${part.index} learned knowledge`);
    }
    assert.equal(s.progress,3000,language);assert.ok(game.skillKnowledge(s,'syntax')>=12,language);
    assert.equal(game.currentProject(s).req.syntax,12);assert.equal(s.stats.manual,0);assert.equal(s.cash,100);assert.deepEqual(s.items,{});
  }
});

test('staged first-game requirements depend on actual progress and preserve the full requirement in other modes',()=>{
  const s=study();s.mode='dev';s.devStyle='quiz';
  for(const [progress,expected] of [[0,4],[750,4],[1000,8],[1750,8],[2000,12],[3000,12]]){
    s.progress=progress;s.quiz.firstParts.lua=2;
    assert.equal(game.currentProject(s).req.syntax,expected,'selecting a future task cannot change the current requirement');
    for(const mutate of [x=>x.mode='study',x=>{x.devStyle='typing';x.inputStyle='typing';},x=>{x.devStyle='typing';x.inputStyle='click';},x=>x.refactor=true]){
      const other=copy(s);mutate(other);assert.equal(game.currentProject(other).req.syntax,12);assert.equal(other.progress,progress);
    }
  }
  assert.deepEqual(game.projectAt(0).req,{syntax:12},'the shared project definition is never rewritten');
  begin(s);const requirements=copy(game.currentProject(s).req);s.devStyle='typing';assert.deepEqual(game.currentProject(s).req,requirements);
  s.devStyle='quiz';assert.deepEqual(game.currentProject(s).req,requirements,'a custom project retains its own requirements');
});

test('switching away from staged implementation can change validity without removing already assembled code',()=>{
  const s=study();s.mode='dev';s.devStyle='quiz';s.skills.syntax=5;s.progress=500;
  assert.equal(game.knowledgeRatio(s),1.25);assert.equal(game.validity(s),1);
  const before={progress:s.progress,debt:s.debt,defects:s.defects,valid:s.stats.valid};
  s.devStyle='typing';assert.equal(game.currentProject(s).req.syntax,12);assert.equal(game.validity(s),0);
  assert.deepEqual({progress:s.progress,debt:s.debt,defects:s.defects,valid:s.stats.valid},before);
  s.devStyle='quiz';assert.equal(game.currentProject(s).req.syntax,4);assert.equal(game.validity(s),1);
  assert.deepEqual({progress:s.progress,debt:s.debt,defects:s.defects,valid:s.stats.valid},before);
});

test('large automatic batches stop at a staged component and reevaluate incomplete knowledge on the next batch',()=>{
  const s=study();s.mode='dev';s.devStyle='quiz';s.skills.syntax=5;s.items={library:5,assistant:3,ide:5};
  assert.equal(game.currentProject(s).req.syntax,4);assert.equal(game.validity(s),1);
  game.input(s,{mode:'dev',chars:100000,manual:false,automation:true});
  assert.equal(s.progress,1000);assert.equal(game.currentProject(s).req.syntax,8);assert.equal(game.knowledgeRatio(s),5/8);assert.equal(game.validity(s),.25);
  const expected=game.developmentGain(s,100,false),before=s.progress,defects=s.defects;
  const second=game.input(s,{mode:'dev',chars:100,manual:false,automation:true});
  assert.equal(second.kind,'defect');near(s.progress-before,expected);assert.ok(s.progress<2000);assert.ok(s.defects>defects);
});

test('fully understood automatic batches complete at most one staged component each',()=>{
  const s=study();s.mode='dev';s.devStyle='quiz';s.skills.syntax=12;s.items={library:5,assistant:3,ide:5};
  for(const part of FIRST_PROJECT_PARTS){
    game.input(s,{mode:'dev',chars:100000,manual:false,automation:true});
    assert.equal(s.progress,part.end);assert.equal(s.stats.valid,part.end);assert.equal(s.crashed,false);
  }
  assert.equal(s.progress,3000);assert.equal(game.currentProject(s).req.syntax,12);
});

test('ordinary development and development overrides outside the staged mode keep their original batch size',()=>{
  for(const arrange of [
    s=>{s.devStyle='typing';s.inputStyle='typing';},
    s=>{s.devStyle='typing';s.inputStyle='click';},
    s=>s.mode='study',
    s=>s.mode='work'
  ]){
    const s=study();s.mode='dev';s.devStyle='quiz';s.skills.syntax=12;s.items={library:5,assistant:3};arrange(s);
    game.input(s,{mode:'dev',chars:100000,manual:false,automation:true});assert.equal(s.progress,3000);
  }
  const explicit=study();expert(explicit);explicit.mode='dev';explicit.devStyle='quiz';
  game.input(explicit,{mode:'dev',chars:100000,manual:false,automation:true,progressLimit:400});assert.equal(explicit.progress,400,'an explicit smaller limit is still respected');
});

test('future and past components may teach once but cannot create work outside their own interval',()=>{
  const s=study();expert(s);s.mode='dev';s.devStyle='quiz';s.quiz.firstParts.lua=2;
  const future=quizLesson(s),r=completeQuiz(s,future.id);assert.ok(r.studyUnits>0);assert.equal(r.progress,0);assert.ok(r.reason);assert.deepEqual(s.quizWork,[]);
  s.quiz.firstParts.lua=0;const first=quizLesson(s);assert.equal(completeQuiz(s,first.id).progress,1000);
  s.typing.language='cpp';assert.equal(quizLesson(s).firstProjectPart,1,'language switches follow the current unfinished component');
  s.quiz.firstParts.cpp=0;const past=quizLesson(s),pastResult=completeQuiz(s,past.id);
  assert.ok(pastResult.studyUnits>0);assert.equal(pastResult.progress,0);assert.ok(pastResult.reason);assert.equal(s.progress,1000);
  assert.equal(s.quizWork.includes(past.id),false,'the blocked claim was not spent');
  s.typing.language='lua';assert.equal(quizLesson(s).firstProjectPart,1);assert.equal(completeQuiz(s,quizLesson(s).id).progress,1000);
  assert.equal(quizLesson(s).id,future.id);const last=completeQuiz(s,future.id);
  assert.equal(last.studyUnits,0);assert.equal(last.progress,1000,'previously solved future work becomes applicable when its turn arrives');
});

test('first-project part selection is independent from generic study cursors and next stops at the last component',()=>{
  const s=study();s.quiz.cursors['lua/syntax']=7;s.mode='dev';s.devStyle='quiz';
  assert.equal(quizLesson(s).firstProjectPart,0);nextQuiz(s);assert.equal(quizLesson(s).firstProjectPart,1);
  nextQuiz(s);nextQuiz(s);assert.equal(quizLesson(s).firstProjectPart,2);assert.equal(s.quiz.cursors['lua/syntax'],7);
  s.mode='study';assert.equal(quizLesson(s).index,7);nextQuiz(s);assert.equal(quizLesson(s).index,8);assert.equal(s.quiz.firstParts.lua,2);
});

test('the implementation limit is applied before debt, defects and build changes and does not cap ordinary work',()=>{
  const s=development();s.projectIndex=0;const capped=copy(s),expected=copy(s),ordinary=copy(s);
  ordinary.devStyle='typing';
  const needed=1000/(game.abstraction(s)*game.ideMultiplier(s));
  game.input(expected,{mode:'dev',chars:needed,manual:true,countManual:false});
  game.input(capped,{mode:'dev',chars:1e6,manual:true,countManual:false,progressLimit:1000});
  game.input(ordinary,{mode:'dev',chars:1e6,manual:true,countManual:false});
  assert.equal(capped.progress,1000);near(capped.debt,expected.debt);near(capped.defects,expected.defects);
  assert.deepEqual(capped.build,expected.build);assert.equal(capped.stats.valid,expected.stats.valid);assert.equal(ordinary.progress,3000);
  const before=copy(capped);game.input(capped,{mode:'dev',chars:1e6,manual:true,countManual:false,progressLimit:1000});
  assert.equal(capped.progress,1000);assert.equal(capped.debt,before.debt);assert.equal(capped.defects,before.defects);assert.deepEqual(capped.build,before.build);
});

test('first-project IDs, drafts, reward claims and safe part selections survive reload',()=>{
  const s=study();expert(s);s.mode='dev';s.devStyle='quiz';const q=quizLesson(s);setQuizDraft(s,q.referenceSource);completeQuiz(s,q.id);
  s.quiz.firstParts={lua:1,python:2,cpp:3,rust:1.5,sql:'1',unknown:0};s.quizWork.push(q.id,'unknown');
  const loaded=deserialize(serialize(s,0));assert.equal(loaded.progress,1000);assert.deepEqual(loaded.quiz.firstParts,{python:2,lua:1});
  assert.deepEqual(loaded.quiz.completed,[q.id]);assert.deepEqual(loaded.quiz.rewarded,[q.id]);assert.deepEqual(loaded.quizWork,[q.id]);
  assert.equal(loaded.quiz.drafts[q.id],q.referenceSource);assert.equal(quizLesson(loaded).firstProjectPart,1);
  const catalog=firstProjectQuizCatalog();s.quiz.completed=catalog.map(row=>row.id);s.quiz.rewarded=[...s.quiz.completed];s.quizWork=[...s.quiz.completed];
  const all=deserialize(serialize(s,0));assert.equal(all.quiz.completed.length,24);assert.equal(all.quiz.rewarded.length,24);assert.equal(all.quizWork.length,24);
});

test('old saves keep their first-game progress and resume the corresponding component with empty new records',()=>{
  for(const progress of [0,750,1000,1750,2000,3000]){
    const old=study();expert(old);old.mode='dev';old.devStyle='quiz';old.progress=progress;old.balanceVersion=19;delete old.quiz.firstParts;
    const loaded=deserialize(JSON.stringify(old));assert.equal(loaded.progress,progress);assert.deepEqual(loaded.quiz.firstParts,{});
    assert.deepEqual(loaded.quizWork,[]);assert.equal(quizLesson(loaded).firstProjectPart,Math.min(2,Math.floor(progress/1000)));
    if(progress<3000){const r=completeQuiz(loaded,quizLesson(loaded).id);assert.equal(loaded.progress,progress<1000?1000:progress<2000?2000:3000);assert.ok(r.progress<=1000);}
  }
});

test('first-game component claims stay with their paused work and a newly selected first game starts at its first part',()=>{
  const s=study();expert(s);s.mode='dev';s.devStyle='quiz';const q=quizLesson(s);completeQuiz(s,q.id);
  const firstClaims=copy(s.quizWork);begin(s);assert.deepEqual(s.quizWork,[]);assert.equal(game.firstProjectQuizMode(s),false);
  assert.equal(game.pauseCustomProject(s),true);assert.equal(s.progress,1000);assert.deepEqual(s.quizWork,firstClaims);assert.equal(quizLesson(s).firstProjectPart,1);
  const fresh=study();expert(fresh);fresh.mode='dev';fresh.devStyle='quiz';fresh.projectIndex=1;fresh.quiz.firstParts.lua=2;
  assert.equal(game.selectProject(fresh,0),true);assert.deepEqual(fresh.quiz.firstParts,{});assert.equal(quizLesson(fresh).firstProjectPart,0);
});

test('Challenge first learning gives four frozen base-work units with study equipment power in either mode',()=>{
  assert.equal(game.QUIZ_STUDY_MULTIPLIER,4);assert.equal(game.QUIZ_IMPLEMENTATION_MULTIPLIER,2);assert.equal(game.QUIZ_VERIFICATION_MULTIPLIER,3);
  for(const language of ['cpp','csharp','rust','go','python','java','sql','lua']){
    const s=study(language);s.items={keyboard:2,monitor:2,lab:2,'book-syntax':1,library:4,assistant:3};
    s.mode='dev';s.devStyle='quiz';s.projectIndex=2;s.legacyPermit=2;
    const q=quizLesson(s),units=baseUnits(q)*4*game.typingPower(s,'study','syntax'),gain=game.studyGain(s,units,'syntax');
    assert.notEqual(game.typingPower(s,'study'),game.typingPower(s,'dev'),'fixture distinguishes the two equipment paths');
    const r=completeQuiz(s,q.id);near(r.studyUnits,units,language);near(r.learned,gain,language);near(r.amount,gain,language);
    near(s.stats.study,units);assert.equal(r.implementationUnits,0,'other required knowledge is still missing');assert.equal(s.stats.manual,0);
  }
});

test('student source length, current typing variant, and existing failures cannot inflate a topic reward',()=>{
  const a=study(),b=copy(a),q=quizLesson(a);
  setQuizDraft(a,q.referenceSource);setQuizDraft(b,'-- extra comments\n'.repeat(1000));
  b.typing.index=255;b.typing.offset=99;b.typing.roundErrors=123;
  const left=completeQuiz(a,q.id),right=completeQuiz(b,q.id);
  near(left.studyUnits,right.studyUnits);near(left.amount,right.amount);assert.deepEqual(a.skills,b.skills);
});

test('successful learning confirms at most three new gains of the initial unverified gap, in total',()=>{
  for(const gap of [0,.1,10,90]){
    const s=study('lua','design');s.skills.design=100;s.studyGaps.design=gap;
    const q=quizLesson(s),units=baseUnits(q)*4*game.typingPower(s,'study','design');
    const gain=game.studyGain(s,units,'design'),verified=Math.min(gap,gain*3),r=completeQuiz(s,q.id);
    near(r.learned,gain);near(r.verified,verified);near(r.amount,gain+verified);
    near(s.skills.design,100+gain);near(s.studyGaps.design,gap-verified);
    const before=copy(s);assert.equal(completeQuiz(s,q.id).studyUnits,0);assert.deepEqual(s,before,'a retry cannot verify another slice');
  }
});

test('reward previews are pure and match the actual combined learning and implementation outcome',()=>{
  const s=development();begin(s,{features:[{id:'save-load'}]});s.subject='syntax';s.skills.syntax=100;s.studyGaps.syntax=8;
  s.items={keyboard:2,ide:3,lab:2,assistant:2};setQuizDraft(s,'unfinished solution');
  const before=copy(s),preview=game.quizRewardPreview(s),again=game.quizRewardPreview(s);
  assert.deepEqual(s,before);assert.deepEqual(preview,again);assert.ok(preview.studyUnits>0);assert.ok(preview.implementationUnits>0);
  assert.deepEqual(completeQuiz(s,quizLesson(s).id),preview);assert.equal(s.stats.manual,0);
});

test('old cleared exercises receive the new learning reward once on re-clear, without automatic load rewards',()=>{
  const old=study();old.skills.syntax=20;const id=quizLesson(old).id;
  old.quiz.completed=[id];delete old.quiz.rewarded;old.balanceVersion=18;
  const s=deserialize(JSON.stringify(old));assert.deepEqual(s.quiz.completed,[id]);assert.deepEqual(s.quiz.rewarded,[]);
  assert.equal(s.skills.syntax,20);assert.equal(s.stats.study,0);
  const r=completeQuiz(s,id);assert.ok(r.studyUnits>1200);assert.ok(r.learned>0);
  assert.deepEqual(s.quiz.completed,[id]);assert.deepEqual(s.quiz.rewarded,[id]);assert.equal(completeQuiz(s,id).studyUnits,0);
});

test('study completion leaves a separate per-project implementation reward using the normal manual IDE path',()=>{
  const s=study(),q=rewarded(s);development(s);s.items={ide:2,keyboard:1,assistant:2};
  const before=copy(s),units=baseUnits(q)*2*game.typingPower(s,'dev',q.subject),expected=copy(s);
  game.input(expected,{mode:'dev',chars:units,manual:true,countManual:false});
  const r=completeQuiz(s,q.id);assert.equal(r.studyUnits,0);near(r.implementationUnits,units);assert.ok(r.progress>0);
  for(const key of ['progress','debt','defects','stats','build'])assert.deepEqual(s[key],expected[key],key);
  assert.deepEqual(s.skills,before.skills);assert.deepEqual(s.quizWork,[q.id]);assert.equal(s.stats.manual,0);
  const after=copy(s);assert.equal(completeQuiz(s,q.id).kind,'answered');assert.deepEqual(s,after);
});

test('an implementation blocked by incomplete knowledge can be retried later without repeating learning',()=>{
  const s=study();s.mode='dev';s.devStyle='quiz';s.projectIndex=2;s.legacyPermit=2;
  const q=quizLesson(s),first=completeQuiz(s,q.id);
  assert.ok(first.studyUnits>0);assert.equal(first.progress,0);assert.equal(first.implementationUnits,0);assert.ok(first.reason);
  assert.deepEqual(s.quizWork,[]);assert.equal(s.defects,0);assert.equal(s.mistakes,0);
  const studyWork=s.stats.study;expert(s);const retry=completeQuiz(s,q.id);
  assert.equal(retry.studyUnits,0);assert.ok(retry.progress>0);assert.ok(retry.implementationUnits>0);
  assert.equal(s.stats.study,studyWork);assert.deepEqual(s.quizWork,[q.id]);
});

test('access, subject, completed work and a failing build do not spend the implementation claim',()=>{
  const fixtures=[
    ['access',s=>{s.projectIndex=4;s.legacyPermit=-1;}],
    ['unrelated subject',s=>{s.projectIndex=1;s.subject='systems';openOnlineMaterial(s,'systems');rewarded(s);}],
    ['completed work',s=>{s.progress=game.currentProject(s).target;}],
    ['failing build',s=>{s.crashed=true;}]
  ];
  for(const [name,arrange] of fixtures){
    const s=study();rewarded(s);development(s);arrange(s);
    const q=quizLesson(s),before=copy(s),r=completeQuiz(s,q.id);
    assert.equal(r.studyUnits,0,name);assert.equal(r.implementationUnits,0,name);assert.equal(r.progress,0,name);assert.ok(r.reason,name);
    assert.deepEqual(s.quizWork,[],name);assert.equal(s.progress,before.progress,name);assert.equal(s.defects,before.defects,name);
    assert.equal(s.stats.chars,before.stats.chars,name);
  }
});

test('material work cannot be produced by solving a code exercise or consume its implementation claim',()=>{
  const s=study(),q=rewarded(s);expert(s);begin(s,{presentationId:'pixel-2d'});
  game.setCustomAllocation(s,'assets');const before=copy(s),r=completeQuiz(s,q.id);
  assert.equal(r.studyUnits,0);assert.equal(r.implementationUnits,0);assert.equal(r.progress,0);
  assert.deepEqual(s.quizWork,[]);assert.deepEqual(game.customProduction(s),game.customProduction(before));assert.equal(s.cash,before.cash);
  game.setCustomAllocation(s,'code');assert.ok(completeQuiz(s,q.id).progress>0,'returning to code still permits application');
});

test('review mode applies an unclaimed exercise through ordinary defect repair and debt repayment',()=>{
  const s=study(),q=rewarded(s);development(s);
  s.progress=2000;s.debt=300;s.debtSources.reuse=300;s.defects=30;s.crashed=true;s.refactor=true;
  const units=baseUnits(q)*2*game.typingPower(s,'dev',q.subject),expected=copy(s),progress=s.progress;
  game.input(expected,{mode:'dev',chars:units,manual:true,countManual:false});
  const preview=game.quizRewardPreview(s),r=completeQuiz(s,q.id);assert.deepEqual(r,preview);
  assert.equal(r.studyUnits,0);near(r.implementationUnits,units);assert.ok(r.fixed>0);assert.ok(r.debtRemoved>0);
  assert.equal(r.progress,0);assert.equal(s.progress,progress);assert.equal(s.crashed,false);assert.deepEqual(s.quizWork,[q.id]);
  for(const key of ['debt','debtSources','defects','stats','build'])assert.deepEqual(s[key],expected[key],key);
  s.debt=100;s.debtSources.reuse=100;s.defects=10;const after=copy(s);
  assert.equal(completeQuiz(s,q.id).implementationUnits,0);assert.deepEqual(s,after,'the same exercise cannot repair repeatedly in one project');
});

test('review without existing maintenance work leaves the implementation claim for later use',()=>{
  const s=study(),q=rewarded(s);development(s);s.refactor=true;
  const empty=completeQuiz(s,q.id);assert.equal(empty.implementationUnits,0);assert.ok(empty.reason);assert.deepEqual(s.quizWork,[]);
  s.debt=100;s.debtSources.reuse=100;
  const repair=completeQuiz(s,q.id);assert.equal(repair.studyUnits,0);assert.ok(repair.debtRemoved>0);assert.deepEqual(s.quizWork,[q.id]);
});

test('code application preserves material supplier bills and cannot buy or finish assets',()=>{
  const s=study(),q=rewarded(s);expert(s);
  begin(s,{presentationId:'pixel-2d',assetSources:{'pixel-style-kit':'license'}});
  const before=game.customProduction(s),cash=s.cash;assert.ok(before.outstandingCash>0);
  assert.ok(completeQuiz(s,q.id).progress>0);assert.equal(s.cash,cash);
  const after=game.customProduction(s);assert.equal(after.paid,before.paid);assert.equal(after.outstandingCash,before.outstandingCash);assert.equal(after.assetProgress,before.assetProgress);
  assert.equal(game.release(s),null,'unpaid material contracts remain release blockers');
});

test('a fixed-title release opens the next implementation claim without refreshing lifelong learning',()=>{
  const s=study(),q=rewarded(s);expert(s);s.mode='dev';s.devStyle='quiz';s.projectIndex=1;s.legacyPermit=2;
  const r=completeQuiz(s,q.id);assert.ok(r.progress>0);assert.deepEqual(s.quizWork,[q.id]);
  s.progress=game.currentProject(s).target;s.debt=0;s.defects=0;s.crashed=false;
  assert.ok(game.release(s));assert.deepEqual(s.quizWork,[]);assert.deepEqual(s.quiz.rewarded,[q.id]);
  const next=completeQuiz(s,q.id);assert.equal(next.studyUnits,0);assert.ok(next.progress>0);assert.deepEqual(s.quizWork,[q.id]);
});

test('custom project claims survive expansion, pause, reload and resume independently of other work',()=>{
  const s=study(),q=rewarded(s);development(s);
  completeQuiz(s,q.id);const tutorialClaims=copy(s.quizWork),first=begin(s);
  assert.deepEqual(s.quizWork,[]);assert.ok(completeQuiz(s,q.id).progress>0);
  const amendment=game.expandCustomProject(s,{addFeatures:[{id:'save-load'}]});assert.equal(amendment.ok,true,amendment.reason);
  assert.deepEqual(s.quizWork,[q.id]);assert.equal(completeQuiz(s,q.id).implementationUnits,0);
  assert.equal(game.pauseCustomProject(s),true);assert.deepEqual(s.quizWork,tutorialClaims);
  const second=begin(s,{features:[{id:'tutorial-hints'}]});assert.notEqual(second,first);assert.deepEqual(s.quizWork,[]);
  assert.ok(completeQuiz(s,q.id).progress>0);
  const loaded=deserialize(serialize(s,0));assert.deepEqual(loaded.quizWork,[q.id]);
  assert.equal(game.resumeCustomProject(loaded,first),true);assert.deepEqual(loaded.quizWork,[q.id]);
  const progress=loaded.progress;assert.equal(completeQuiz(loaded,q.id).implementationUnits,0);assert.equal(loaded.progress,progress);
  assert.equal(game.pauseCustomProject(loaded),true);assert.deepEqual(loaded.quizWork,tutorialClaims);
  assert.equal(game.resumeCustomProject(loaded,second),true);assert.deepEqual(loaded.quizWork,[q.id]);
});

test('prestige keeps lifelong learning but starts with a fresh implementation claim',()=>{
  const s=development(),q=quizLesson(s);completeQuiz(s,q.id);assert.deepEqual(s.quizWork,[q.id]);
  enablePrestige(s);const fresh=prestige(s,0);assert.ok(fresh);assert.deepEqual(fresh.quizWork,[]);
  assert.deepEqual(fresh.quiz.rewarded,[q.id]);assert.deepEqual(fresh.quiz.completed,[q.id]);assert.equal(game.quizRewardPreview(fresh).studyUnits,0);
});

test('quiz submission contexts distinguish changes in mode, project, release, repair and allocation',()=>{
  const s=study();s.projectIndex=2;const initial=game.quizContextKey(s),q=quizLesson(s).id;
  s.mode='dev';s.devStyle='quiz';assert.notEqual(game.quizContextKey(s),initial);const dev=game.quizContextKey(s);
  for(const mutate of [x=>x.refactor=true,x=>x.nextTitleId++,x=>x.projectIndex++,x=>x.planner.allocation='assets',x=>x.developmentPolicy='prototype']){
    const changed=copy(s);mutate(changed);assert.equal(quizLesson(changed).id,q);assert.notEqual(game.quizContextKey(changed),dev);
  }
  const first=begin(s),firstKey=game.quizContextKey(s);game.pauseCustomProject(s);const second=begin(s);
  assert.notEqual(first,second);assert.notEqual(game.quizContextKey(s),firstKey);
});

test('quiz completion requires the current exercise and material, and pays once across reload and prestige',()=>{
  const s=createState(0);s.studyStyle='quiz';s.mode='study';const quiz=quizLesson(s);
  assert.equal(completeQuiz(s,quiz.id).kind,'none');assert.deepEqual(s.quiz.completed,[]);
  openOnlineMaterial(s);assert.equal(completeQuiz(s,'quiz/v1/wrong').kind,'none');
  const units=baseUnits(quiz)*4*game.typingPower(s,'study');
  const reward=completeQuiz(s,quiz.id);assert.equal(reward.kind,'correct');assert.ok(reward.amount>0);near(s.stats.study,units);
  assert.deepEqual(s.quiz.rewarded,[quiz.id]);assert.deepEqual(s.quizWork,[]);assert.equal(s.stats.manual,0);
  assert.deepEqual(s.typing.completedLessons,{},'solving is not evidence of copying a lesson');
  const skill=s.skills.syntax;assert.equal(completeQuiz(s,quiz.id).kind,'answered');assert.equal(s.skills.syntax,skill);
  const loaded=deserialize(serialize(s));assert.equal(loaded.studyStyle,'quiz');assert.deepEqual(loaded.quiz.completed,[quiz.id]);assert.equal(completeQuiz(loaded,quiz.id).kind,'answered');
  loaded.runBest=2;loaded.runExperience.craft=1;
  // Use a defined experience key instead of relying on the visible UI labels.
  loaded.runExperience[Object.keys(loaded.experience)[0]]=1;
  const fresh=prestige(loaded);assert.ok(fresh);assert.equal(fresh.studyStyle,'quiz');assert.deepEqual(fresh.quiz.completed,[quiz.id]);
  fresh.mode='study';fresh.subject='syntax';assert.equal(completeQuiz(fresh,quiz.id).kind,'answered');
});

test('drafts and cursors are independent by language and subject; only recent bounded drafts are saved',()=>{
  const s=createState(0);openOnlineMaterial(s,'syntax');setQuizDraft(s,'first');const first=quizLesson(s).id;
  nextQuiz(s);setQuizDraft(s,'second');assert.notEqual(quizLesson(s).id,first);
  s.typing.language='rust';assert.equal(s.quiz.cursors['rust/syntax']||0,0);setQuizDraft(s,'rust source');
  s.subject='design';setQuizDraft(s,'design source');
  const before=JSON.stringify(s.quiz);assert.equal(setQuizDraft(s,'x'.repeat(24001)),false);assert.equal(JSON.stringify(s.quiz),before);
  s.subject='syntax';s.typing.language='python';for(let i=0;i<16;i++){setQuizDraft(s,`draft ${i}`);nextQuiz(s);}
  assert.equal(Object.keys(s.quiz.drafts).length,12);assert.equal(s.quiz.drafts[first],undefined);
  const loaded=deserialize(serialize(s));assert.deepEqual(loaded.quiz,s.quiz);
});

test('legacy saves default to practice; malformed and unknown quiz data do not enter the save',()=>{
  const legacy=createState(0);delete legacy.quiz;delete legacy.quizWork;const loaded=deserialize(JSON.stringify(legacy));assert.deepEqual(loaded.quiz,{cursors:{},firstParts:{},completed:[],rewarded:[],implemented:[],verifiedAt:{},drafts:{}});assert.deepEqual(loaded.quizWork,[]);
  const s=createState(0);openOnlineMaterial(s,'syntax');const id=quizLesson(s).id;
  nextQuiz(s);const uncompleted=quizLesson(s).id;
  s.quiz={cursors:{'cpp/syntax':100,'rust/design':3,'unknown/syntax':2},completed:[id,id,'unknown'],rewarded:[id,id,uncompleted,'unknown'],drafts:{[id]:'x'.repeat(24001),unknown:'code'}};
  s.quizWork=[id,id,'unknown',null];
  const clean=deserialize(JSON.stringify(s));assert.deepEqual(clean.quiz.cursors,{'rust/design':3});assert.deepEqual(clean.quiz.completed,[id]);assert.deepEqual(clean.quiz.rewarded,[id]);assert.deepEqual(clean.quizWork,[id]);assert.deepEqual(clean.quiz.drafts,{});
  assert.equal(clean.stats.study,0);assert.equal(clean.progress,0);assert.deepEqual(clean.skills,s.skills);
});
