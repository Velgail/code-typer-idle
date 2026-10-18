import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/core.js';
import {experienceRequirements, experienceEffects, salesDuring} from '../src/career.js';
import {currentPrompt,acceptCharacter} from '../src/typing.js';

const near=(a,b,message)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,message || `${a} != ${b}`);
function unlock(s,index){const requirements=experienceRequirements(index);for(const [id,n] of Object.entries(requirements.experience))s.experience[id]=Math.max(s.experience[id],n);for(const [id,n] of Object.entries(requirements.items))s.items[id]=Math.max(s.items[id] || 0,n);s.autoEnabled=false;}
function complete(s,index=s.projectIndex){
  unlock(s,index);
  if(s.projectIndex!==index)assert.equal(game.selectProject(s,index),true);
  for(const [id,n] of Object.entries(game.projectAt(index).req))s.skills[id]=Math.max(s.skills[id],n);
  s.progress=game.projectAt(index).target;s.defects=0;s.crashed=false;
  const title=game.release(s);assert.ok(title,`project ${index} must be releasable`);return title;
}
function twoFree(s=game.createState(0)){complete(s,0);complete(s,1);return s;}
function commercial(){const s=game.createState(0);unlock(s,2);const title=complete(s,2);return{s,title};}

test('two free practice games provide the first career experience without sales, office work or purchases',()=>{
  const s=game.createState(0),cash=s.cash;
  for(const index of [0,1]){
    assert.equal(s.projectIndex,index);
    for(const [id,required] of Object.entries(game.projectAt(index).req)){
      game.openOnlineMaterial(s,id);s.subject=id;
      let inputs=0;while(game.skillKnowledge(s,id)<required && inputs++<1000)game.input(s,{mode:'study',subject:id,chars:100});
      assert.ok(game.skillKnowledge(s,id)>=required);
    }
    let steps=0;
    while(s.progress<game.projectAt(index).target && steps++<1000){
      s.refactor=s.crashed || s.defects>game.defectLimit(s)*.1;game.input(s,{mode:'dev',chars:100});
    }
    s.refactor=true;game.input(s,{mode:'dev',chars:game.projectAt(index).target});s.refactor=false;
    const title=game.release(s);assert.ok(title);assert.equal(title.payout,0);assert.equal(game.remainingSales(title),0);
  }
  assert.equal(s.cash,cash);assert.deepEqual(s.items,{});assert.equal(s.stats.jobs,0);assert.equal(s.ocr.failures,0);
  assert.deepEqual(s.runExperience,{craft:5,design:2,audience:1});
  assert.equal(game.prestigePreview(s).available,true);assert.equal(game.prestigeGain(s),8);
  assert.equal(game.projectAccess(s,2).allowed,false,'uncommitted run experience is not inherited career experience yet');
  const next=game.prestige(s,0);assert.ok(next);assert.deepEqual(next.experience,{craft:5,design:2,audience:1});
  assert.deepEqual(next.runExperience,{craft:0,design:0,audience:0});assert.equal(game.projectAccess(next,2).allowed,true);
});

test('practice-game experience cannot be farmed by repeats, saved cursors or repeated new lives',()=>{
  let s=twoFree(),first={...s.runExperience};
  complete(s,1);complete(s,0);complete(s,1);assert.deepEqual(s.runExperience,first);
  s=game.prestige(s,0);assert.ok(s);const inherited={...s.experience};
  complete(s,0);complete(s,1);assert.deepEqual(s.runExperience,{craft:0,design:0,audience:0});
  assert.equal(game.prestigeGain(s),0);assert.equal(game.prestige(s),null);
  s=game.deserialize(game.serialize(s,0));complete(s,1);assert.deepEqual(s.runExperience,{craft:0,design:0,audience:0});
  assert.deepEqual(s.experience,inherited);
});

test('a commercial scale pays career experience once per run while further original games remain sales opportunities',()=>{
  const {s,title}=commercial(),first={...s.runExperience},cash=s.cash;
  assert.deepEqual(first,{craft:6,design:5,audience:6});assert.ok(title.payout>0);
  const knowledge={...s.skills},second=complete(s,2);assert.deepEqual(s.skills,knowledge,'repeated new titles cannot farm the completion understanding bonus');assert.deepEqual(s.runExperience,first);assert.ok(second.payout>0);assert.ok(s.cash>cash);
  assert.notEqual(second.id,title.id);
  const next=game.prestige(s,0);assert.ok(next);unlock(next,2);complete(next,2);
  assert.deepEqual(next.runExperience,first,'paid-scale experience is available again in the next development life');
});

test('a new life retains confirmed understanding, materials, course progress and answered reading without carrying unresolved gaps',()=>{
  const s=twoFree();Object.assign(s.skills,{syntax:40,design:20,graphics:18,systems:3});Object.assign(s.studyGaps,{syntax:5,design:2});
  for(const id of ['syntax','design','graphics'])game.openOnlineMaterial(s,id);
  s.mode='study';s.subject='syntax';s.inputStyle='typing';s.items['book-syntax']=2;
  const text=currentPrompt(s);for(const char of text.slice(0,7))acceptCharacter(s,char);
  game.answerReading(s,game.readingLesson(s).answer);
  s.typing.courseCompleted=['d2ef3c966238e723'];
  s.typing.courseCursors['cpp/syntax']={id:'cpp/00ab71eb-4ebb-4360-8621-a394040c894a/f07da5acf3589f86/0',offset:17,roundErrors:1,bonusBase:9};
  const expected=Object.fromEntries(game.SKILLS.map(({id})=>[id,game.skillKnowledge(s,id)]));
  const next=game.prestige(s,1000);assert.ok(next);
  assert.deepEqual(next.skills,expected);assert.deepEqual(next.studyGaps,{syntax:0,design:0,graphics:0,systems:0});
  assert.deepEqual(next.onlineMaterials,s.onlineMaterials);assert.deepEqual(next.reading,s.reading);
  assert.deepEqual(next.typing.courseCompleted,s.typing.courseCompleted);assert.deepEqual(next.typing.courseCursors,s.typing.courseCursors);
  assert.equal(next.typing.offset,0);assert.equal(next.typing.bonusBase,0,'a pending implementation prompt cannot become study or new-project work');
  assert.deepEqual(next.items,{});assert.deepEqual(next.catalog,[]);assert.equal(next.progress,0);assert.equal(next.debt,0);assert.equal(next.defects,0);
  assert.equal(game.hasTextbook(next,'syntax'),false);assert.equal(game.hasStudyMaterial(next,'syntax'),true);
  next.mode='study';next.subject='syntax';assert.equal(game.answerReading(next,game.readingLesson(next).answer).kind,'answered');
});

test('AAA and larger projects require inherited experience and a production team independently of code knowledge or money',()=>{
  const s=game.createState(0);for(const id of game.SKILLS.map(skill=>skill.id))s.skills[id]=1e9;s.cash=1e200;
  assert.equal(game.projectAccess(s,2).allowed,false);assert.equal(game.projectAccess(s,4).allowed,false);
  for(const index of [2,3,4,5,8]){
    const req=experienceRequirements(index);Object.assign(s.experience,req.experience);Object.assign(s.items,req.items);
    assert.equal(game.projectAccess(s,index).allowed,true,`scope ${index}`);
    for(const [id,n] of Object.entries(req.experience)){
      s.experience[id]=n-Number.EPSILON*Math.max(1,n)*4;assert.equal(game.projectAccess(s,index).allowed,false,id);s.experience[id]=n;
    }
    for(const [id,n] of Object.entries(req.items)){
      s.items[id]=n-1;assert.equal(game.projectAccess(s,index).allowed,false,id);s.items[id]=n;
    }
  }
});

test('locked project selection and direct development cannot discard unfinished work or bypass career requirements',()=>{
  const s=game.createState(0),initial=game.serialize(s,0);
  assert.equal(game.selectProject(s,4),false);assert.equal(game.serialize(s,0),initial);
  for(const field of ['progress','debt','defects']){
    const partial=game.createState(0);partial[field]=1;const before=game.serialize(partial,0);
    assert.equal(game.selectProject(partial,1),false);assert.equal(game.serialize(partial,0),before,field);
  }
  const outsourced=game.createState(0);outsourced.production.audio={paid:100};assert.equal(game.selectProject(outsourced,1),false);
  s.projectIndex=4;for(const [id,n] of Object.entries(game.projectAt(4).req))s.skills[id]=n;
  game.input(s,{mode:'dev',chars:1e12});assert.equal(s.progress,0,'setting projectIndex cannot bypass access in the actual production rule');
  s.progress=game.projectAt(4).target;assert.equal(game.release(s),null);
});

test('sales forecasts describe a finite customer budget and exact exponential tail payments',()=>{
  const {s,title}=commercial(),forecast=game.salesForecast(s,2,title.quality);
  assert.equal(forecast.commercial,true);assert.ok(forecast.price>0 && forecast.copies>0);
  near(forecast.gross,forecast.price*forecast.copies);near(forecast.launchGross+forecast.tailGross,forecast.gross);
  near(game.remainingSales(title),forecast.tailGross);
  near(title.unitPrice,forecast.price);near(title.totalCopies,forecast.copies);
  const expected=forecast.tailGross*.5,gross=game.finiteSalesGross(s,forecast.halfLife);
  near(gross,expected);near(gross,salesDuring(title,forecast.halfLife));
  const cash=s.cash,fees=s.stats.storeFees;game.tick(s,forecast.halfLife);
  near(s.cash-cash,expected*(1-game.STORE_FEE_RATE));near(s.stats.storeFees-fees,expected*game.STORE_FEE_RATE);
  near(game.remainingSales(s.catalog[0]),expected);
  assert.ok(s.catalog[0].soldCopies<=s.catalog[0].totalCopies);
});

test('eight-hour foreground, split foreground, and saved offline sales agree without exceeding finite demand',()=>{
  const {s}=commercial(),raw=game.serialize(s,0),a=game.deserialize(raw),b=game.deserialize(raw),c=game.deserialize(raw);
  const before=a.cash,total=game.finiteSalesGross(a,8*3600);
  game.tick(a,8*3600);
  for(let i=0;i<16;i++)game.tick(b,1800);
  game.applyOffline(c,8*3600*1000);
  near(a.cash,b.cash);near(a.cash,c.cash);near(a.cash-before,total*(1-game.STORE_FEE_RATE));
  near(game.remainingSales(a.catalog[0]),game.remainingSales(b.catalog[0]));near(game.remainingSales(a.catalog[0]),game.remainingSales(c.catalog[0]));
  const d=game.deserialize(game.serialize(a,8*3600*1000));near(game.remainingSales(d.catalog[0]),game.remainingSales(a.catalog[0]));
  const tailBefore=game.remainingSales(d.catalog[0]);game.tick(d,8*3600);assert.ok(game.remainingSales(d.catalog[0])<tailBefore);
  assert.ok(d.catalog[0].soldCopies<=d.catalog[0].totalCopies);
});

test('publication controls use unique title IDs when multiple originals share a project scale',()=>{
  const {s,title:first}=commercial(),second=complete(s,2);assert.notEqual(first.id,second.id);
  assert.equal(game.setPublicationActive(s,first.id,false),true);
  assert.equal(s.catalog.find(t=>t.id===first.id).active,false);assert.equal(s.catalog.find(t=>t.id===second.id).active,true);
  const firstRemaining=game.remainingSales(s.catalog.find(t=>t.id===first.id)),secondRemaining=game.remainingSales(s.catalog.find(t=>t.id===second.id));
  game.tick(s,60);assert.equal(game.remainingSales(s.catalog.find(t=>t.id===first.id)),firstRemaining);
  assert.ok(game.remainingSales(s.catalog.find(t=>t.id===second.id))<secondRemaining);
  assert.equal(game.setPublicationActive(s,first.id,true),true);game.tick(s,60);assert.ok(game.remainingSales(s.catalog.find(t=>t.id===first.id))<firstRemaining);
});

test('archiving more than one hundred original releases keeps finite sales, unique IDs and future payments through saving',()=>{
  const s=game.createState(0);unlock(s,2);const seen=new Set();
  for(let index=0;index<105;index++){const title=complete(s,2);assert.ok(!seen.has(title.id));seen.add(title.id);}
  assert.ok(s.catalog.length<=100);assert.ok(s.catalog.some(t=>t.archived));
  const available=s.catalog.reduce((sum,t)=>sum+game.remainingSales(t),0),expected=game.finiteSalesGross(s,1800);
  assert.ok(available>0 && expected>0 && expected<available);
  const loaded=game.deserialize(game.serialize(s,0));near(game.finiteSalesGross(loaded,1800),expected);
  near(loaded.catalog.reduce((sum,t)=>sum+game.remainingSales(t),0),available);
  const cash=loaded.cash;game.tick(loaded,1800);near(loaded.cash-cash,expected*(1-game.STORE_FEE_RATE));
  const ids=loaded.catalog.map(t=>t.id);assert.equal(new Set(ids).size,ids.length);
  const next=complete(loaded,2);assert.ok(!seen.has(next.id));
});

test('different experience types have distinct effects and do not produce a universal cash multiplier',()=>{
  const craft=experienceEffects({craft:100,design:0,audience:0}),design=experienceEffects({craft:0,design:100,audience:0}),audience=experienceEffects({craft:0,design:0,audience:100});
  assert.ok(craft.speed>1);assert.equal(craft.architecture,1);assert.equal(craft.audience,1);
  assert.equal(design.speed,1);assert.ok(design.architecture<1);assert.equal(design.audience,1);
  assert.equal(audience.speed,1);assert.equal(audience.architecture,1);assert.ok(audience.audience>1);
  const scenarios=Object.fromEntries(['baseline','craft','design','audience'].map(id=>{
    const state=game.createState(0);state.mode='dev';state.skills.syntax=12;
    if(id!=='baseline')state.experience[id]=100;
    game.input(state);return[id,state];
  }));
  assert.ok(scenarios.craft.progress>scenarios.baseline.progress);
  assert.equal(scenarios.design.progress,scenarios.baseline.progress);assert.ok(scenarios.design.debt<scenarios.baseline.debt);
  assert.equal(scenarios.audience.progress,scenarios.baseline.progress);
  const normalDemand=game.salesForecast(scenarios.baseline,2,80).copies;
  assert.equal(game.salesForecast(scenarios.craft,2,80).copies,normalDemand);assert.equal(game.salesForecast(scenarios.design,2,80).copies,normalDemand);
  assert.ok(game.salesForecast(scenarios.audience,2,80).copies>normalDemand);
  const s=game.createState(0);s.experience={craft:100,design:100,audience:100};const cash=s.cash;
  game.input(s,{mode:'work',chars:100});assert.equal(s.cash-cash,100,'experience must not multiply a quoted data-entry payment');
});

test('version fourteen saves retain current production, funds, learned progress and achievements while receiving a current-run access permit',()=>{
  const old=game.createState(0);old.balanceVersion=14;
  Object.assign(old,{cash:98765,projectIndex:4,progress:123456,debt:1234,defects:234,runBest:4,assets:16,resets:2});
  Object.assign(old.skills,{syntax:3400,design:5100,graphics:4500,systems:4200});old.studyGaps.syntax=23;
  old.items={'book-syntax':2,macro:1,engineer:1};old.onlineMaterials=['syntax','design'];
  Object.assign(old.stats,{releases:4,valid:123456,chars:234567,earned:345678,storeFees:1234});old.achievements=['first-release','first-book'];
  old.catalog=[{name:'legacy indie',index:2,quality:80,royalty:64,payout:100000,grossPayout:133333,salesFee:33333,active:true}];
  for(const key of ['experience','runExperience','completedProjects','experiencedProjects','nextTitleId','legacyPermit'])delete old[key];
  const loaded=game.deserialize(JSON.stringify(old));
  for(const key of ['cash','progress','debt','defects','projectIndex','assets','resets'])assert.equal(loaded[key],old[key],key);
  assert.deepEqual(loaded.skills,old.skills);assert.deepEqual(loaded.studyGaps,old.studyGaps);assert.deepEqual(loaded.stats,old.stats);
  assert.deepEqual([...loaded.achievements].sort(),[...old.achievements].sort());assert.deepEqual(loaded.onlineMaterials,old.onlineMaterials);
  assert.equal(loaded.items.engineer,1);assert.equal(loaded.items['book-syntax'],2);
  assert.equal(game.projectAccess(loaded,4).allowed,true,'existing AAA work must remain accessible despite newly required experience or equipment');
  assert.equal(game.projectAccess(loaded,5).allowed,false,'the migration permit cannot unlock scopes beyond the existing project');
  const title=loaded.catalog[0];assert.equal(title.payout,100000);assert.equal(title.salesFee,33333);
  assert.ok(Number.isFinite(game.remainingSales(title)) && game.remainingSales(title)>0);
  const twice=game.deserialize(game.serialize(loaded,0));
  for(const key of ['cash','progress','debt','defects'])assert.equal(twice[key],loaded[key]);
  assert.equal(game.projectAccess(twice,4).allowed,true);assert.deepEqual(twice.experience,loaded.experience);
  near(game.remainingSales(twice.catalog[0]),game.remainingSales(title));
  loaded.runBest=Math.max(2,loaded.runBest);loaded.runExperience={craft:6,design:5,audience:6};
  const next=game.prestige(loaded,0);assert.ok(next);assert.equal(game.projectAccess(next,4).allowed,false,'the old production permit ends with that life');
});

test('a version fourteen project with zero completed characters also keeps its current-run access',()=>{
  const old=game.createState(0);old.balanceVersion=14;old.projectIndex=4;old.progress=0;old.items={};
  for(const key of ['experience','runExperience','completedProjects','experiencedProjects','legacyPermit'])delete old[key];
  const loaded=game.deserialize(JSON.stringify(old));assert.equal(loaded.progress,0);assert.equal(game.projectAccess(loaded,4).allowed,true);
});

test('a mixed archive preserves active and stopped sales batches through saving and can stop all remaining server costs',()=>{
  const s=game.createState(0);unlock(s,2);s.nextTitleId=101;
  const active={id:'release-1',name:'active online',index:5,online:true,serverDaily:3000,active:true,salesRemaining:400,salesHalfLife:game.DAY,unitPrice:10,totalCopies:40,soldCopies:0};
  const stopped={id:'release-2',name:'stopped online',index:5,online:true,serverDaily:5000,active:false,salesRemaining:800,salesHalfLife:game.DAY*2,unitPrice:20,totalCopies:40,soldCopies:0};
  s.catalog=[active,stopped,...Array.from({length:98},(_,index)=>({id:`release-${index+3}`,name:'old free',index:0,online:false,active:true,salesRemaining:0,salesHalfLife:game.DAY,unitPrice:0,totalCopies:0,soldCopies:0}))];
  complete(s,2);const archive=s.catalog.find(t=>t.archived);assert.ok(archive);
  const isolated=game.createState(0);isolated.cash=1e8;isolated.catalog=[archive];isolated.nextTitleId=s.nextTitleId;
  const expected=salesDuring(active,game.DAY)+salesDuring(stopped,game.DAY);near(game.finiteSalesGross(isolated,game.DAY),expected);
  assert.equal(game.operatingCost(isolated),3000);assert.equal(archive.salesBatches.length,2);
  const loaded=game.deserialize(game.serialize(isolated,0));near(game.finiteSalesGross(loaded,game.DAY),expected);
  const cash=loaded.cash;game.tick(loaded,game.DAY);near(loaded.cash-cash,expected*(1-game.STORE_FEE_RATE)-3000);
  const savedArchive=loaded.catalog[0],inactive=savedArchive.salesBatches.find(b=>b.active===false);
  assert.equal(inactive.remaining,800);assert.equal(game.setPublicationActive(loaded,savedArchive.id,false),true);
  assert.equal(game.operatingCost(loaded),0);const remaining=game.remainingSales(savedArchive),pausedCash=loaded.cash;
  game.tick(loaded,game.DAY);assert.equal(loaded.cash,pausedCash);assert.equal(game.remainingSales(savedArchive),remaining);
  assert.equal(game.setPublicationActive(loaded,savedArchive.id,true),true);game.tick(loaded,game.DAY);
  assert.equal(inactive.remaining,800,'resuming the group must not resume a constituent that was already stopped');
  assert.ok(game.remainingSales(savedArchive)<remaining);assert.equal(game.operatingCost(loaded),3000);
  game.setPublicationActive(loaded,savedArchive.id,false);
  loaded.catalog.push(...Array.from({length:99},(_,index)=>({id:`release-${1000+index}`,name:'old free',index:0,online:false,active:true,salesRemaining:0,salesHalfLife:game.DAY,unitPrice:0,totalCopies:0,soldCopies:0})));
  complete(loaded,2);const repacked=loaded.catalog.find(t=>t.archived);
  assert.ok(repacked);assert.equal(game.titleSalesRate(repacked),0,'archiving a stopped archive again cannot restart its constituent sales');
  const restored=game.deserialize(game.serialize(loaded,0)),restoredArchive=restored.catalog.find(t=>t.archived);
  assert.equal(game.titleSalesRate(restoredArchive),0);assert.equal(game.serverCost(restored,restoredArchive),0);
});

test('the office contract ends at exactly fifty shared deliveries and cannot be replenished by waiting or switching input methods',()=>{
  const s=game.createState(0);assert.equal(game.OFFICE_CONTRACT_WORK,5000);assert.equal(game.availableOfficeWork(s),5000);
  game.input(s,{mode:'work',chars:4999});assert.equal(s.cash,5000);assert.equal(game.availableOfficeWork(s),1);
  assert.equal(game.input(s,{mode:'work',chars:1e12}).amount,100);assert.equal(s.cash,5100);assert.equal(s.stats.jobs,50);
  assert.equal(game.availableOfficeWork(s),0);assert.equal(s.job.progress,0);
  assert.equal(game.input(s,{mode:'work',chars:1e12}).amount,0);s.items.macro=1;game.tick(s,8*game.DAY);
  assert.equal(s.cash,5100);assert.equal(s.stats.jobs,50);assert.equal(game.availableOfficeWork(s),0);assert.equal(game.netIncome(s),0);
  const restored=game.deserialize(game.serialize(s,0));assert.equal(game.availableOfficeWork(restored),0);game.tick(restored,1000);assert.equal(restored.cash,s.cash);
});

test('manual invoices and OCR consume one office budget and split partial entry cannot lose the final payable order',()=>{
  const shared=game.createState(0);shared.items.macro=1;
  game.input(shared,{mode:'work',chars:2500});game.tick(shared,250);
  assert.equal(game.availableOfficeWork(shared),0);assert.equal(shared.stats.jobs,50);
  assert.equal(shared.cash,100+2500+2500-240);assert.equal(shared.ocr.pending,2);assert.equal(shared.ocr.fees,40);
  const split=game.createState(0);split.items.macro=1;game.input(split,{mode:'work',chars:49});game.tick(split,500);
  assert.equal(game.availableOfficeWork(split),0);assert.equal(split.stats.jobs,50);
  near(split.cash+split.ocr.pendingReward+split.ocr.fees,100+5000);
  assert.equal(split.job.progress+split.ocrJob.progress,0,'the last fifty-delivery contract cannot strand fragments in two separate input queues');
});

test('OCR corrections recover the old unpaid reward after the office contract ends without charging or restoring contract work',()=>{
  const s=game.createState(0);s.items.macro=1;game.tick(s,500);
  assert.equal(game.availableOfficeWork(s),0);assert.equal(s.ocr.pending,5);assert.equal(s.cash,4500);
  s.workTask='correction';assert.equal(game.input(s,{mode:'work',chars:500}).amount,500);
  assert.equal(s.cash,5000);assert.equal(s.ocr.pending,0);assert.equal(s.ocr.fees,100);assert.equal(game.availableOfficeWork(s),0);
  assert.equal(game.input(s,{mode:'work',chars:1e8}).amount,0);s.workTask='entry';assert.equal(game.input(s,{mode:'work',chars:500}).amount,0);
  assert.equal(s.cash,5000);assert.equal(game.availableOfficeWork(s),0);
});

test('remaining office work persists in current saves and legacy contracts are granted only on their first migration',()=>{
  const s=game.createState(0);game.input(s,{mode:'work',chars:1234});
  const loaded=game.deserialize(game.serialize(s,0));assert.equal(game.availableOfficeWork(loaded),5000-1234);assert.deepEqual(loaded.job,s.job);
  const old=game.createState(0);old.balanceVersion=14;delete old.office;old.cash=4321;old.job={progress:37,rate:1};
  let legacy=game.deserialize(JSON.stringify(old));assert.equal(game.availableOfficeWork(legacy),5000-37);assert.equal(legacy.cash,4321);assert.deepEqual(legacy.job,old.job);
  game.input(legacy,{mode:'work',chars:5000});assert.equal(game.availableOfficeWork(legacy),0);assert.equal(legacy.job.progress,0,'old entered work is part of the fifty-delivery contract');
  legacy=game.deserialize(game.serialize(legacy,0));assert.equal(game.availableOfficeWork(legacy),0);
  const run=twoFree();game.input(run,{mode:'work',chars:5000});assert.equal(game.availableOfficeWork(run),0);
  const next=game.prestige(run,0);assert.ok(next);assert.equal(game.availableOfficeWork(next),5000);
});

test('commercial experience is capped against inherited plus pending totals and never subtracts experience already above that scale',()=>{
  const s=game.createState(0);s.experience={craft:59,design:39,audience:59};s.runExperience={craft:.5,design:.5,audience:.5};
  const preview=game.projectExperience(s,2);
  assert.deepEqual(preview.cap,{craft:60,design:40,audience:60});assert.deepEqual(preview.gain,{craft:.5,design:.5,audience:.5});
  assert.equal(preview.claimed,false);assert.equal(preview.exhausted,false);
  const title=complete(s,2);assert.deepEqual(title.experienceEarned,preview.gain);
  assert.deepEqual(s.runExperience,{craft:1,design:1,audience:1});assert.equal(game.projectExperience(s,2).claimed,true);
  const restored=game.deserialize(game.serialize(s,0));assert.deepEqual(game.projectExperience(restored,2).gain,{craft:0,design:0,audience:0});
  const experienced=game.createState(0);experienced.experience={craft:200,design:200,audience:200};
  assert.deepEqual(game.projectExperience(experienced,2).gain,{craft:0,design:0,audience:0});assert.equal(game.projectExperience(experienced,2).exhausted,true);
  complete(experienced,2);assert.deepEqual(experienced.experience,{craft:200,design:200,audience:200});assert.deepEqual(experienced.runExperience,{craft:0,design:0,audience:0});
});

test('repeating only small commercial games across lives cannot qualify for AAA; larger production is required to grow beyond their experience cap',()=>{
  let s=game.prestige(twoFree(),0),exhausted=false;
  for(let life=0;life<20;life++){
    const title=complete(s,2),gain=Object.values(title.experienceEarned).reduce((sum,n)=>sum+n,0);
    if(!gain){assert.equal(game.prestige(s),null);exhausted=true;break;}
    s=game.prestige(s,0);assert.ok(s);
    assert.ok(s.experience.craft<=60 && s.experience.design<=40 && s.experience.audience<=60);
  }
  assert.equal(exhausted,true);assert.deepEqual(s.experience,{craft:60,design:40,audience:60});
  Object.assign(s.items,experienceRequirements(4).items);
  assert.equal(game.projectAccess(s,4).allowed,false,'money and AAA equipment cannot replace experience from more complex games');
  assert.ok(game.projectAccess(s,4).missing.some(r=>r.kind==='experience'));
  const bigger=complete(s,3);assert.ok(Object.values(bigger.experienceEarned).every(n=>n>0));
  const next=game.prestige(s,0);assert.ok(next);assert.ok(next.experience.craft>60 && next.experience.design>40 && next.experience.audience>60);
});

test('revisiting the practice games after the first new life takes fewer manual inputs because confirmed learning is retained',()=>{
  const play=s=>{
    let actions=0,studyActions=0;
    if(s.projectIndex!==0)assert.equal(game.selectProject(s,0),true);
    for(const index of [0,1]){
      for(const [id,required] of Object.entries(game.projectAt(index).req)){
        game.openOnlineMaterial(s,id);
        while(game.skillKnowledge(s,id)<required && actions<200000){game.input(s,{mode:'study',subject:id,chars:game.handPower(s)});actions++;studyActions++;}
        assert.ok(game.skillKnowledge(s,id)>=required);
      }
      while((s.progress<game.projectAt(index).target || s.crashed || s.defects>game.defectLimit(s)*.1) && actions<200000){
        s.refactor=s.crashed || s.defects>game.defectLimit(s)*.1;
        game.input(s,{mode:'dev',chars:game.handPower(s)});actions++;
      }
      s.refactor=false;assert.ok(game.release(s));
    }
    return{actions,studyActions};
  };
  const first=game.createState(0),firstEffort=play(first),next=game.prestige(first,0);assert.ok(next);
  const secondEffort=play(next);assert.ok(firstEffort.studyActions>0);assert.equal(secondEffort.studyActions,0);
  assert.ok(secondEffort.actions<firstEffort.actions/2,'the new life must not repeat the original syntax-study wall');
  assert.deepEqual(next.runExperience,{craft:0,design:0,audience:0},'faster repeated practice still cannot farm another experience payout');
});

test('choosing another accessible project after publication keeps carried library debt and stops being free once implementation starts',()=>{
  const s=game.createState(0);unlock(s,2);s.projectIndex=2;s.items.library=1;
  Object.assign(s.skills,game.projectAt(2).req);game.input(s,{mode:'dev',chars:100});
  const title=complete(s,2);assert.ok(title.technicalDebt>0);assert.ok(s.debt>0);assert.equal(s.projectCarryover,true);
  const loaded=game.deserialize(game.serialize(s,0)),carried=loaded.debt,sources=structuredClone(loaded.debtSources);
  assert.equal(game.selectProject(loaded,0),true);assert.equal(loaded.debt,carried);assert.deepEqual(loaded.debtSources,sources);
  game.input(loaded,{mode:'dev',chars:1});assert.ok(loaded.progress>0);assert.equal(loaded.projectCarryover,false);
  assert.equal(game.selectProject(loaded,1),false,'switching must not discard code or the debt attached to real work');
});


test('legacy partial invoices count toward the fifty-delivery budget and retain both accepted quotes regardless of how remaining work is entered',()=>{
  const old=game.createState(0);old.balanceVersion=14;delete old.office;old.cash=4321;
  old.job={progress:37,rate:2};old.ocrJob={progress:23,rate:3};
  for(const method of ['manual-batch','manual-characters','automatic']){
    const s=game.deserialize(JSON.stringify(old)),cash=s.cash;
    assert.equal(game.availableOfficeWork(s),4940);assert.deepEqual(s.job,old.job);assert.deepEqual(s.ocrJob,old.ocrJob);
    if(method==='manual-batch')game.input(s,{mode:'work',chars:4940});
    if(method==='manual-characters')for(let index=0;index<4940;index++)game.input(s,{mode:'work',chars:1});
    if(method==='automatic'){s.items.macro=1;game.tick(s,494);}
    assert.equal(game.availableOfficeWork(s),0);assert.equal(s.stats.jobs,50);assert.equal(s.job.progress+s.ocrJob.progress,0);
    const quotedGross=200+300+48*100;
    near(s.cash-cash+s.ocr.pendingReward+s.ocr.fees,quotedGross,method);
    const restored=game.deserialize(game.serialize(s,0));assert.equal(game.availableOfficeWork(restored),0);assert.equal(restored.cash,s.cash);
    assert.equal(game.input(restored,{mode:'work',chars:100}).amount,0);
  }
});


test('an empty legacy input queue cannot apply an old unaccepted quote to a new office order',()=>{
  for(const method of ['manual','automatic']){
    const old=game.createState(0);old.balanceVersion=14;delete old.office;old.job={progress:0,rate:3};old.ocrJob={progress:0,rate:3};
    const s=game.deserialize(JSON.stringify(old)),cash=s.cash;
    if(method==='manual')assert.equal(game.input(s,{mode:'work',chars:100}).amount,100);
    else{s.items.macro=1;game.tick(s,10);}
    assert.equal(s.cash-cash,100);assert.equal(game.availableOfficeWork(s),4900);assert.equal(s.stats.jobs,1);
    assert.equal(s[method==='manual'?'job':'ocrJob'].rate,1);
  }
});
