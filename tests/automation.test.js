import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, input, tick, handPower, typingPower, unitRate, devCapacity,
  projectAt, knowledgeRatio, validity, developmentReadiness, learningGoal,
  autoStudySubject, skillKnowledge, studyGain, studyPreview, developmentGain,
  answerReading, readingLesson, READING_UNITS, serialize, deserialize,
  quality, applyOffline, BALANCE_VERSION, needsBuild, runBuild, defectLimit, buy, workRate, release, netIncome, STORE_FEE_RATE, finiteSalesGross, projectAccess
} from '../src/core.js';
import {acceptCharacter, currentPrompt, TYPING_REWARD, TYPING_REFERENCE_RATE} from '../src/typing.js';
import {recordOCR} from '../src/officequality.js';
import {experienceRequirements} from '../src/career.js';

const near=(a,b,message)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,message || `${a} != ${b}`);
const student=()=>{const s=createState(0);s.mode='study';s.items['book-syntax']=1;return s;};
const developer=()=>{const s=createState(0);s.mode='dev';for(const [id,n] of Object.entries(projectAt(0).req))s.skills[id]=n;return s;};

test('accurate typing at 300 physical keys per minute yields ten times eight clicks per second before equipment',()=>{
  for(const mode of ['work','study','dev']){
    const s=createState(0);s.mode=mode;
    const text=currentPrompt(s);let completedBonus=0;
    for(const char of text){const result=acceptCharacter(s,char,typingPower(s));assert.ok(result.correct);completedBonus+=result.bonus;}
    const workPerPhysicalKey=(text.length*TYPING_REWARD.character+completedBonus)/[...text].length;
    assert.equal(TYPING_REFERENCE_RATE,300/60);
    assert.equal(workPerPhysicalKey*TYPING_REFERENCE_RATE/(8*handPower(s)),10,mode);
  }
});

test('typing scales with the owned equipment capacity even when automatic development is paused',()=>{
  const s=developer();Object.assign(s.items,{macro:1,lab:4,library:4,assistant:4,engineer:2,'book-syntax':1,keyboard:2});
  const capacities={work:unitRate(s,'macro'),study:unitRate(s,'lab'),dev:devCapacity(s)};
  for(const mode of Object.keys(capacities)){
    near(typingPower(s,mode),handPower(s)+capacities[mode]/160);
    const before=typingPower(s,mode);s.autoEnabled=false;
    assert.equal(typingPower(s,mode),before,'turning automatic development off cannot manufacture a different manual reward');
    const restored=deserialize(serialize(s,0));assert.equal(typingPower(restored,mode),before);
    s.autoEnabled=true;
  }
  delete s.items['book-syntax'];assert.equal(typingPower(s,'study'),handPower(s),'a lab cannot bypass missing learning materials');
});

test('the automation share in typing is counted once through IDE development and fully supports manual repairs',()=>{
  const s=developer();s.items.library=3;s.items.assistant=2;s.items.ide=4;
  const physicalRate=TYPING_REFERENCE_RATE*(TYPING_REWARD.character+TYPING_REWARD.completion);
  const baseline=developmentGain(s,handPower(s)*physicalRate),assisted=developmentGain(s,typingPower(s)*physicalRate);
  near(assisted-baseline,devCapacity(s)*.5,'IDE must not multiply the equipment contribution a second time');
  s.refactor=true;
  near(typingPower(s),handPower(s)+devCapacity(s)/160,'repair has no IDE multiplier to divide out');
});

test('a perfect four-space Tab is one physical input and cannot claim four completion shares',()=>{
  const s=student(),text=currentPrompt(s),start=text.indexOf('    ');assert.ok(start>=0);
  for(const char of text.slice(0,start))acceptCharacter(s,char,1);
  const before=s.typing.bonusBase,base=typingPower(s)/4;
  let immediate=0;
  for(const char of text.slice(start,start+4)){assert.ok(acceptCharacter(s,char,base).correct);immediate+=base*TYPING_REWARD.character;}
  near(immediate,12);near(s.typing.bonusBase-before,1);
});

test('completion uses the power earned at each accepted character without repricing earlier input on upgrades, toggles or reload',()=>{
  let s=createState(0);s.inputStyle='typing';const text=currentPrompt(s),split=Math.floor(text.length/2);
  for(const char of text.slice(0,split))assert.ok(acceptCharacter(s,char,typingPower(s)).correct);
  assert.equal(s.typing.bonusBase,split);
  s.items.macro=1;s.autoEnabled=false;s=deserialize(serialize(s,0));
  assert.equal(s.typing.bonusBase,split);const laterPower=typingPower(s),savedBase=s.typing.bonusBase;
  assert.equal(acceptCharacter(s,'!').correct,false);assert.equal(s.typing.bonusBase,savedBase);
  // Correcting a typo changes accuracy, but cannot revise the previous power.
  let completion;
  for(const char of text.slice(split))completion=acceptCharacter(s,char,laterPower);
  near(completion.bonus,(split+(text.length-split)*laterPower)*4*(text.length/(text.length+1))**2);
  assert.equal(s.typing.bonusBase,0);assert.equal(s.typing.offset,0);
});

test('automatic learning reserves one quarter of new knowledge while ordinary manual-false rewards remain confirmed',()=>{
  const manual=student(),readingStyle=student(),automatic=student();
  const expected=studyGain(manual,1000);
  near(input(manual,{chars:1000}).amount,expected);
  near(input(readingStyle,{chars:1000,manual:false}).amount,expected);
  const result=input(automatic,{chars:1000,manual:false,automation:true});
  near(automatic.skills.syntax,manual.skills.syntax);near(automatic.studyGaps.syntax,expected*.25);
  near(result.amount,expected*.75);near(skillKnowledge(automatic,'syntax'),expected*.75);
  assert.equal(readingStyle.studyGaps.syntax,0);
  assert.equal(automatic.stats.manual,0);assert.equal(readingStyle.stats.manual,0);assert.equal(manual.stats.manual,1);
});

test('manual study confirms an existing gap in addition to new knowledge and reports the same preview',()=>{
  const s=student();input(s,{chars:10000,manual:false,automation:true});
  const nominal=s.skills.syntax,gap=s.studyGaps.syntax,before=skillKnowledge(s,'syntax'),gain=studyGain(s,100);
  assert.ok(gap>gain);const preview=studyPreview(s,100),result=input(s,{chars:100});
  near(result.verified,gain);near(s.skills.syntax,nominal+gain);near(s.studyGaps.syntax,gap-gain);
  near(result.amount,2*gain);near(skillKnowledge(s,'syntax')-before,preview);
  const huge=input(s,{chars:1e6});assert.equal(s.studyGaps.syntax,0);assert.ok(huge.verified>0);
  assert.ok(skillKnowledge(s,'syntax')<=s.skills.syntax);
});

test('a correct finite reading answer verifies knowledge without receiving the automation penalty',()=>{
  const s=student();input(s,{chars:10000,manual:false,automation:true});
  const gap=s.studyGaps.syntax,gain=studyGain(s,READING_UNITS),nominal=s.skills.syntax;
  const result=answerReading(s,readingLesson(s).answer);
  assert.equal(result.kind,'correct');near(result.amount,gain+Math.min(gap,gain));
  near(s.skills.syntax,nominal+gain);near(s.studyGaps.syntax,Math.max(0,gap-gain));
  const snapshot=serialize(s,0);assert.equal(answerReading(s,readingLesson(s).answer).kind,'answered');
  assert.equal(serialize(s,0),snapshot,'an answered reading question cannot be replayed to clear gaps');
});

test('learning indicators, conversion, repairs, and quality use confirmed knowledge rather than nominal totals',()=>{
  const s=createState(0);s.mode='study';s.projectIndex=1;s.subject='syntax';
  Object.assign(s.skills,{syntax:48,design:8,graphics:8});s.studyGaps.syntax=36;
  assert.equal(skillKnowledge(s,'syntax'),12);assert.equal(knowledgeRatio(s),.5);assert.equal(validity(s),0);
  assert.equal(developmentReadiness(s).stage,'learn');
  assert.deepEqual(developmentReadiness(s).requirements[0],{id:'syntax',required:24,current:12,missing:12});
  const goal=learningGoal(s);assert.equal(goal.next.id,'syntax');near(goal.progress,5/6);
  assert.equal(input(s,{mode:'dev',chars:100}).amount,0);assert.equal(s.progress,0);
  s.refactor=true;s.defects=100;assert.equal(input(s,{mode:'dev',chars:100}).kind,'review');assert.equal(s.defects,100);
  s.studyGaps.syntax=24;s.defects=0;s.refactor=false;
  assert.equal(knowledgeRatio(s),1);assert.equal(developmentReadiness(s).stage,'ready');assert.equal(learningGoal(s).next,null);
  assert.equal(quality(s),80,'unverified nominal understanding cannot raise sale quality');
  s.items['book-design']=1;s.studyGaps.design=8;
  assert.equal(autoStudySubject(s),'design','the lab must target an unverified requirement even if its nominal number is sufficient');
});

test('automated code incurs twice the deferred work and bugs for equal new progress, with a named generated-code source',()=>{
  const manual=developer(),automatic=developer(),nonmanual=developer();
  const ordinary=input(manual,{chars:100}),auto=input(automatic,{chars:100,manual:false,automation:true}),reward=input(nonmanual,{chars:100,manual:false});
  assert.equal(auto.amount,ordinary.amount);near(auto.debtAdded,ordinary.debtAdded*2);near(auto.introducedDefects,ordinary.introducedDefects*2);
  near(automatic.debtSources.generated,ordinary.debtAdded);
  for(const source of ['temporary','coupling','verification'])near(automatic.debtSources[source],manual.debtSources[source]);
  near(reward.debtAdded,ordinary.debtAdded);near(reward.introducedDefects,ordinary.introducedDefects);
  assert.equal(nonmanual.debtSources.generated,0,'a completion or other nonmanual reward is not automated code');
});

test('lab ticks retain unverified knowledge through reload and produce the same confirmed amount offline',()=>{
  const a=student();a.items.lab=1;const b=deserialize(serialize(a,0));
  tick(a,200);const result=applyOffline(b,200000);
  near(a.skills.syntax,b.skills.syntax);near(a.studyGaps.syntax,b.studyGaps.syntax);
  near(skillKnowledge(a,'syntax'),a.skills.syntax*.75);
  assert.ok(a.studyGaps.syntax>0);assert.equal(a.stats.manual,0);
  near(result.knowledge,skillKnowledge(b,'syntax'));
  assert.ok(result.knowledge<b.skills.syntax,'offline notifications must not call unverified nominal gains confirmed knowledge');
  const restored=deserialize(serialize(a,0));near(restored.studyGaps.syntax,a.studyGaps.syntax);
});

test('pre-quality saves preserve earned knowledge, money, equipment, and unfinished manual work without retroactive fees',()=>{
  const old=student();old.balanceVersion=11;old.cash=4321;old.skills.syntax=34;old.items.macro=2;old.job={progress:37,rate:1};
  delete old.studyGaps;delete old.ocr;delete old.ocrJob;delete old.workTask;
  const loaded=deserialize(JSON.stringify(old));
  assert.equal(loaded.cash,8071);assert.equal(skillKnowledge(loaded,'syntax'),34);assert.equal(loaded.items.macro,1);
  assert.deepEqual(loaded.job,{progress:37,rate:1});assert.deepEqual(loaded.ocrJob,{progress:0,rate:1});
  assert.equal(loaded.ocr.failures,0);assert.equal(loaded.ocr.pending,0);assert.equal(loaded.ocr.fees,0);
  for(const value of Object.values(loaded.studyGaps))assert.equal(value,0);
});

test('invalid saved gaps cannot inflate knowledge and extreme equipment keeps typing finite',()=>{
  const s=student();s.skills.syntax=20;s.studyGaps={syntax:21,design:-1,graphics:Infinity,systems:NaN};
  const restored=deserialize(JSON.stringify(s));
  assert.equal(restored.studyGaps.syntax,0);assert.equal(skillKnowledge(restored,'syntax'),20);
  for(const value of Object.values(restored.studyGaps))assert.equal(value,0);
  restored.assets=1e250;restored.cash=-1;Object.assign(restored.items,{macro:800,lab:800,library:800,assistant:800,engineer:800,cluster:800,ide:800});
  for(const mode of ['work','study','dev'])assert.ok(Number.isFinite(typingPower(restored,mode))&&typingPower(restored,mode)>0);
  for(const subject of ['syntax','design','graphics','systems']){
    restored.items[`book-${subject}`]=1;restored.skills[subject]=1e249;restored.studyGaps[subject]=1e248;
    input(restored,{mode:'study',subject,chars:1e250,manual:false,automation:true});
    assert.ok(Number.isFinite(restored.skills[subject]));assert.ok(Number.isFinite(restored.studyGaps[subject]));
    assert.ok(skillKnowledge(restored,subject)>=0);
  }
});


test('the expanded AAA scope preserves old completion and upkeep ratios and invalidates its old build only once',()=>{
  const old=createState(0),oldTarget=4e8;
  Object.assign(old,{balanceVersion:11,projectIndex:4,progress:2e8,debt:1e7,defects:4e6,cash:987654,reviewedAt:10});
  Object.assign(old.skills,{syntax:3100,design:5100,graphics:4600,systems:4100});
  old.stats.time=100;old.items.macro=3;old.job={progress:73,rate:8};
  Object.assign(old.debtSources,{temporary:2e6,coupling:5e6,verification:3e6});
  const earlier={status:'warnings',trigger:'automatic',revision:6,progress:1e8,defects:2e6,time:50,checks:4};
  const recent={status:'warnings',trigger:'automatic',revision:7,progress:1.8e8,defects:3e6,time:80,checks:4};
  old.build={revision:7,checkedRevision:7,changed:0,checkedProgress:1.8e8,knownDefects:3e6,count:8,last:recent,history:[earlier,recent]};
  delete old.studyGaps;delete old.ocr;delete old.ocrJob;delete old.workTask;
  const loaded=deserialize(JSON.stringify(old)),newTarget=projectAt(4).target;
  assert.equal(newTarget,6.2e8);
  for(const key of ['progress','debt','defects']){
    near(loaded[key],old[key]*1.55);near(loaded[key]/newTarget,old[key]/oldTarget);
  }
  for(const [source,n] of Object.entries(old.debtSources))near(loaded.debtSources[source],n*1.55);
  near(loaded.debt/defectLimit(loaded),old.debt/(oldTarget*.25));
  near(loaded.defects/defectLimit(loaded),old.defects/(oldTarget*.25));
  assert.equal(loaded.build.checkedProgress,old.build.checkedProgress*1.55);
  assert.equal(loaded.build.knownDefects,old.build.knownDefects*1.55);
  assert.equal(loaded.build.count,old.build.count);
  for(let index=0;index<old.build.history.length;index++){
    const before=old.build.history[index],after=loaded.build.history[index];
    near(after.progress,before.progress*1.55);near(after.defects,before.defects*1.55);
    for(const key of ['revision','time','checks'])assert.equal(after[key],before[key]);
  }
  assert.equal(loaded.build.last.progress,recent.progress*1.55);assert.equal(loaded.build.last.defects,recent.defects*1.55);
  assert.equal(needsBuild(loaded),true,'a changed scope must not inherit stale successful certification');
  assert.equal(loaded.cash,old.cash+13125);assert.deepEqual(loaded.skills,old.skills);
  assert.equal(loaded.items.macro,1);assert.ok(Object.entries(loaded.items).every(([id,n])=>id==='macro' || n===0));
  assert.deepEqual(loaded.job,old.job);assert.deepEqual(loaded.ocrJob,{progress:0,rate:1});
  assert.equal(loaded.ocr.pending,0);assert.equal(loaded.ocr.failures,0);assert.equal(loaded.ocr.fees,0);
  for(const [id,n] of Object.entries(old.skills))assert.equal(skillKnowledge(loaded,id),n);
  const reloaded=deserialize(serialize(loaded,0));
  for(const key of ['progress','debt','defects'])assert.equal(reloaded[key],loaded[key]);
  assert.deepEqual(reloaded.build,loaded.build,'a second reload must neither rescale nor add another pending check');
  assert.deepEqual(reloaded.debtSources,loaded.debtSources);
  const result=runBuild(reloaded);assert.ok(result);assert.equal(needsBuild(reloaded),false);
  const checked=deserialize(serialize(reloaded,0));
  assert.deepEqual(checked.build,reloaded.build);assert.equal(needsBuild(checked),false);assert.equal(runBuild(checked),null);
  const otherProject={...old,projectIndex:3};const unchanged=deserialize(JSON.stringify(otherProject));
  assert.equal(unchanged.progress,projectAt(3).target,'other projects retain their own target rather than adopting the AAA scale');
  assert.equal(unchanged.debt,old.debt);assert.equal(unchanged.defects,Math.min(old.defects,defectLimit(unchanged)));
});

test('legacy repair typing preserves its accepted cursor and bonus while migrating to a separate review context',()=>{
  const old=developer();old.inputStyle='typing';old.refactor=true;old.balanceVersion=11;
  const text=currentPrompt(old),prefix=text.slice(0,9);
  for(const char of prefix)assert.ok(acceptCharacter(old,char,2).correct);
  const offset=old.typing.offset,bonus=old.typing.bonusBase;
  old.typing.context=old.typing.context.replace(/\/review$/,'');
  const loaded=deserialize(serialize(old,0));
  assert.match(loaded.typing.context,/\/review$/);assert.equal(currentPrompt(loaded),text);
  assert.equal(loaded.typing.offset,offset);assert.equal(loaded.typing.bonusBase,bonus);
  const restored=deserialize(serialize(loaded,0));
  assert.equal(currentPrompt(restored),text);assert.equal(restored.typing.offset,offset);assert.equal(restored.typing.bonusBase,bonus);
  assert.ok(acceptCharacter(restored,text[offset],2).correct);assert.equal(restored.typing.bonusBase,bonus+2);
});

test('switching between implementation and repair cannot move pending typing rewards to the other task',()=>{
  const s=developer();s.inputStyle='typing';const implementation=currentPrompt(s);
  for(const char of implementation.slice(0,8))assert.ok(acceptCharacter(s,char,4).correct);
  assert.equal(s.typing.bonusBase,32);assert.equal(s.typing.offset,8);
  s.refactor=true;const repair=currentPrompt(s);
  assert.match(s.typing.context,/\/review$/);assert.equal(s.typing.offset,0);assert.equal(s.typing.bonusBase,0);
  for(const char of repair.slice(0,5))assert.ok(acceptCharacter(s,char,2).correct);
  assert.equal(s.typing.bonusBase,10);
  s.refactor=false;assert.equal(currentPrompt(s),implementation);
  assert.doesNotMatch(s.typing.context,/\/review$/);assert.equal(s.typing.offset,0);assert.equal(s.typing.bonusBase,0);
  s.refactor=true;currentPrompt(s);assert.equal(s.typing.offset,0);assert.equal(s.typing.bonusBase,0);
});


test('office work stays a fixed-price side job across releases rather than becoming the business growth engine',()=>{
  for(const index of [0,1,2,3,4,5,6,1000]){
    const s=createState(0);s.projectIndex=index;s.items.macro=1;
    assert.equal(workRate(s),1);assert.equal(unitRate(s,'macro'),10);
    assert.equal(input(s,{mode:'work',chars:100}).amount,100);
    const cash=s.cash;tick(s,100);
    assert.equal(s.cash-cash,880,'the same OCR output cannot earn more merely because a new game was released');
    assert.equal(s.ocr.pending,1);assert.equal(s.ocr.pendingReward,100);assert.equal(s.ocr.fees,20);
    near(netIncome(s),8.8);
    s.cash=1e9;assert.equal(buy(s,'macro'),false);assert.equal(unitRate(s,'macro'),10);
  }
});

test('the first commercial game receives finite customer payments while office income stays a limited side contract',()=>{
  const s=createState(0);s.projectIndex=2;s.progress=projectAt(2).target;s.items.macro=1;
  Object.assign(s.experience,experienceRequirements(2).experience);Object.assign(s.skills,projectAt(2).req);
  assert.equal(projectAccess(s).allowed,true);
  const title=release(s);assert.ok(title);assert.ok(title.payout>0);assert.ok(title.salesRemaining>0);
  const sales=finiteSalesGross(s,100),cash=s.cash,office=createState(0);
  office.items.macro=1;office.experience={...s.experience};const officeCash=office.cash;
  tick(office,100);tick(s,100);
  near(s.cash-cash,sales*(1-STORE_FEE_RATE)+office.cash-officeCash);
});

test('removed OCR expansions are refunded exactly once while the installed tool remains and earned statistics stay settled',()=>{
  for(const [count,refund] of [[0,0],[1,0],[2,3750],[3,13125],[6,241640.625],[800,1e250]]){
    const old=createState(0);old.balanceVersion=12;old.items.macro=count;old.cash=4321;old.stats.earned=12345;
    const loaded=deserialize(JSON.stringify(old)),expected=Math.min(1e250,4321+refund);
    assert.equal(loaded.cash,expected);assert.equal(loaded.items.macro,count?1:0);assert.equal(loaded.stats.earned,12345);
    assert.equal(unitRate(loaded,'macro'),count?10:0);
    const twice=deserialize(serialize(loaded,0));assert.equal(twice.cash,expected);assert.equal(twice.items.macro,loaded.items.macro);
  }
  for(const invalid of [-1,1e6,Infinity,NaN,'3']){
    const old=createState(0);old.balanceVersion=12;old.items.macro=invalid;old.cash=4321;
    const loaded=deserialize(JSON.stringify(old));assert.equal(loaded.items.macro,0);assert.equal(loaded.cash,4321);
  }
  const current=createState(0);current.items.macro=4;current.cash=4321;
  const capped=deserialize(JSON.stringify(current));assert.equal(capped.items.macro,1);assert.equal(capped.cash,4321,'current saves cannot claim removed-expansion refunds');
});

test('legacy invoice quotes and unpaid OCR corrections settle at their accepted rates before new work uses the fixed price',()=>{
  const old=createState(0);old.balanceVersion=12;old.projectIndex=2;old.items.macro=2;old.cash=4321;
  old.job={progress:70,rate:3};old.ocrJob={progress:90,rate:3};recordOCR(old.ocr,10,3);
  old.studyGaps.syntax=2;old.skills.syntax=10;
  const loaded=deserialize(JSON.stringify(old)),before=loaded.cash;
  assert.equal(before,8071);assert.deepEqual(loaded.job,old.job);assert.deepEqual(loaded.ocrJob,old.ocrJob);
  assert.deepEqual(loaded.ocr,old.ocr);assert.equal(loaded.studyGaps.syntax,2);
  assert.equal(input(loaded,{mode:'work',chars:40}).amount,300);assert.deepEqual(loaded.job,{progress:10,rate:1});
  tick(loaded,1);assert.equal(loaded.cash-before,600);assert.deepEqual(loaded.ocrJob,{progress:0,rate:1});
  loaded.workTask='correction';assert.equal(input(loaded,{mode:'work',chars:100}).amount,300);
  assert.equal(loaded.ocr.pending,0);assert.equal(loaded.ocr.fees,60,'correcting an old case restores the quoted reward but leaves its paid fee');
  assert.equal(loaded.cash-before,900);
  loaded.workTask='entry';assert.equal(input(loaded,{mode:'work',chars:90}).amount,100);
  tick(loaded,10);assert.equal(loaded.cash-before,1100);assert.equal(loaded.ocr.fees,60);
  const again=deserialize(serialize(loaded,0));assert.equal(again.cash,loaded.cash);assert.deepEqual(again.ocr,loaded.ocr);
});

test('existing paid titles move to the revised continuing-sales rates once without changing free releases or settled receipts',()=>{
  const old=createState(0);old.balanceVersion=12;old.cash=1234;old.stats.earned=5678;old.stats.storeFees=910;
  const receipt={quality:80,payout:26250,grossPayout:35000,salesFee:8750};
  old.catalog=[
    {name:'first paid',index:1,royalty:1.6,...receipt},
    {name:'indie',index:2,royalty:16,...receipt},
    {name:'free first',index:1,royalty:0,...receipt,payout:0,grossPayout:0,salesFee:0},
    {name:'free indie',index:2,royalty:0,...receipt,payout:0,grossPayout:0,salesFee:0},
    {name:'later',index:3,royalty:160,...receipt},
    {name:'archive',index:-1,archived:true,royalty:123,...receipt}
  ];
  const loaded=deserialize(JSON.stringify(old));
  near(loaded.catalog[0].royalty,32);assert.ok(loaded.catalog[0].salesRemaining>0,'an old paid block game keeps a finite sales tail after new blocks become free');
  near(loaded.catalog[1].royalty,64);
  assert.equal(loaded.catalog[2].royalty,0);assert.equal(loaded.catalog[3].royalty,0);
  assert.equal(loaded.catalog[4].royalty,160);assert.equal(loaded.catalog[5].royalty,123);
  for(let index=0;index<old.catalog.length;index++)for(const key of ['quality','payout','grossPayout','salesFee'])assert.equal(loaded.catalog[index][key],old.catalog[index][key]);
  assert.equal(loaded.cash,old.cash);assert.equal(loaded.stats.earned,old.stats.earned);assert.equal(loaded.stats.storeFees,old.stats.storeFees);
  const reloaded=deserialize(serialize(loaded,0));assert.deepEqual(reloaded.catalog,loaded.catalog);assert.equal(reloaded.cash,loaded.cash);
  assert.equal(reloaded.stats.storeFees,loaded.stats.storeFees);
});

test('an unfinished legacy OCR contract can be followed by new lower-price failures without losing their cancellation or correction across saves',()=>{
  const old=createState(0);old.balanceVersion=12;old.projectIndex=2;old.items.macro=2;old.cash=4321;
  old.ocrJob={progress:90,rate:3};recordOCR(old.ocr,10,3);
  let loaded=deserialize(JSON.stringify(old));const cash=loaded.cash;
  assert.equal(loaded.ocr.pending,1);assert.equal(loaded.ocr.pendingReward,300);assert.equal(loaded.ocr.fees,60);
  tick(loaded,1);
  assert.equal(loaded.cash-cash,300);assert.deepEqual(loaded.ocrJob,{progress:0,rate:1});
  assert.equal(loaded.ocr.pending,1,'settling the partly entered invoice must not dispose of its old unpaid correction');
  tick(loaded,100);
  assert.equal(loaded.cash-cash,300+1000-120,'one new bad order cancels its 100 payment and charges 20 even while older higher-price work is pending');
  assert.equal(loaded.ocr.failures,2);assert.equal(loaded.ocr.pending,2);
  assert.equal(loaded.ocr.pendingReward,400);assert.equal(loaded.ocr.fees,80);
  assert.deepEqual(loaded.ocr.buckets.map(b=>[b.rate,b.count]),[[3,1],[1,1]]);
  const beforeSave=structuredClone(loaded.ocr);loaded=deserialize(serialize(loaded,0));
  assert.deepEqual(loaded.ocr,beforeSave,'reload must preserve both legacy and lower-price cases in arrival order');
  assert.equal(loaded.cash-cash,1180,'loading cannot repeat the cancellation, fee, or removed-expansion refund');
  loaded.workTask='correction';
  assert.equal(input(loaded,{mode:'work',chars:100}).amount,300);
  assert.equal(loaded.ocr.pending,1);assert.equal(loaded.ocr.pendingReward,100);
  assert.equal(input(loaded,{mode:'work',chars:100}).amount,100);
  assert.equal(loaded.ocr.pending,0);assert.equal(loaded.ocr.pendingReward,0);assert.equal(loaded.ocr.corrected,2);
  assert.equal(loaded.cash-cash,1580);assert.equal(loaded.ocr.fees,80,'manual corrections restore payments without refunding either resubmission fee');
  assert.equal(input(loaded,{mode:'work',chars:1000}).amount,0);
  const corrected=deserialize(serialize(loaded,0));assert.equal(corrected.cash,loaded.cash);assert.deepEqual(corrected.ocr,loaded.ocr);
});
