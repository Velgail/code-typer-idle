import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/core.js';
import {estimatePlan} from '../src/planning.js';
import {PLANNING_EXAMPLES} from '../src/planningcatalog.js';
import {salesDuring} from '../src/career.js';
import {currentPrompt,acceptCharacter,TYPING_REWARD} from '../src/typing.js';

const copy=value=>structuredClone(value);
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,message || `${a} != ${b}`);
const puzzle=(extra={})=>({genreId:'number-puzzle',presentationId:'console',audioId:'silent',inputId:'keyboard-mouse',engineId:'toolkit',targets:['browser'],...extra});
function expert(s){for(const skill of game.SKILLS)s.skills[skill.id]=1e6;s.autoEnabled=false;return s;}
function begin(plan=puzzle(),s=game.createState(0)){
  const result=game.startCustomProject(s,plan,{name:'独立検証作品'});
  assert.equal(result.ok,true,result.reason);assert.ok(result.id);return s;
}
function record(s,id=s.planner.active){const value=s.planner.projects.find(row=>row.id===id);assert.ok(value,id);return value;}
function finishCode(s){
  expert(s);game.setCustomAllocation(s,'code');s.refactor=false;
  for(let i=0;s.progress<game.currentProject(s).target && i<30;i++)game.input(s,{mode:'dev',chars:game.currentProject(s).target});
  assert.equal(s.progress,game.currentProject(s).target);
  s.refactor=true;game.input(s,{mode:'dev',chars:game.currentProject(s).target*10});s.refactor=false;
  assert.equal(s.defects,0);game.runBuild(s,'manual');
}
function finishAssets(s){
  game.setCustomAllocation(s,'assets');game.produceCustomAssets(s,{effort:Math.max(1,game.currentProject(s).target)*100,manual:false});game.setCustomAllocation(s,'code');
  const production=game.customProduction(s);near(production.assetProgress,production.assetTarget);
}
function publish(plan=puzzle(),s=game.createState(0)){
  begin(plan,s);s.cash=1e12;game.fundCustomProject(s);finishCode(s);finishAssets(s);
  const title=game.release(s);assert.ok(title,'completed, funded and tested custom work can be published');return{s,title};
}

test('an estimate and repeated plan selections do not create money, work, skill, or discovered synergies',()=>{
  const s=game.createState(0),before=JSON.stringify(s),first=game.estimateProjectDraft(s,puzzle());
  assert.equal(first.totals.codeCharacters,estimatePlan(puzzle()).totals.codeCharacters);
  for(let i=0;i<20;i++)game.estimateProjectDraft(s,puzzle({features:i%2?[{id:'tutorial-hints'}]:[]}));
  assert.equal(JSON.stringify(s),before,'looking at a project must have no gameplay reward');
  assert.ok(first.runtime.missingRequirements.length>0,'the estimator exposes missing knowledge rather than locking out reckless planning');
  assert.equal(first.runtime.availableCash,100);
});

test('starting a reckless project is allowed but its own missing knowledge prevents code progress',()=>{
  const plan=puzzle({inputId:'full-dive',presentationId:'3d',engineId:'custom',targets:['windows']}),s=begin(plan);
  const current=game.currentProject(s),before=s.cash;
  assert.equal(current.custom,true);assert.equal(current.target,estimatePlan(plan).totals.codeCharacters);
  assert.ok(current.req.systems>1000);assert.equal(game.projectAccess(s).allowed,true);
  game.input(s,{mode:'dev',chars:1000});assert.equal(s.progress,0);assert.equal(s.cash,before);
  assert.equal(game.release(s),null,'a selected but unimplemented large project cannot publish');
});

test('learning materials and actual accepted ASCII typing advance the selected custom implementation',()=>{
  const s=begin();s.mode='study';s.subject='syntax';game.openOnlineMaterial(s,'syntax');
  while(game.skillKnowledge(s,'syntax')<game.currentProject(s).req.syntax)game.input(s,{mode:'study',subject:'syntax',chars:500});
  for(const [id,value] of Object.entries(game.currentProject(s).req))if(value>0 && game.skillKnowledge(s,id)<value){game.openOnlineMaterial(s,id);s.subject=id;while(game.skillKnowledge(s,id)<value)game.input(s,{mode:'study',subject:id,chars:1000});}
  s.mode='dev';s.inputStyle='typing';const text=currentPrompt(s);assert.ok(text.length>10);
  const start=s.progress,cash=s.cash,wrong=text[0]==='x'?'y':'x';assert.equal(acceptCharacter(s,wrong).correct,false);assert.equal(s.progress,start);
  for(const char of text.slice(0,10)){
    const base=game.handPower(s),result=acceptCharacter(s,char,base);assert.equal(result.correct,true);
    game.input(s,{mode:'dev',chars:base*TYPING_REWARD.character});
  }
  assert.ok(s.progress>start);assert.equal(s.cash,cash);assert.equal(game.currentProject(s).custom,true);
});

test('self-produced assets require separate work and code completion alone cannot publish',()=>{
  const s=begin(puzzle({presentationId:'pixel-2d'}));expert(s);finishCode(s);
  assert.ok(game.customProduction(s).assetTarget>0);assert.equal(game.customProduction(s).assetProgress,0);
  assert.equal(game.release(s),null,'unfinished art is not silently supplied for zero cash');
  const code=s.progress,debt=s.debt;finishAssets(s);assert.equal(s.progress,code);assert.equal(s.debt,debt);
  const title=game.release(s);assert.ok(title);assert.equal(title.payout,0,'the default free model remains free');
});

test('asset production records manual effort without inventing source characters, accepted code or study work',()=>{
  const s=begin(puzzle({presentationId:'pixel-2d'}));expert(s);s.mode='dev';s.inputStyle='typing';
  const prompt=currentPrompt(s);for(const char of prompt.slice(0,3))assert.equal(acceptCharacter(s,char).correct,true);
  const before={chars:s.stats.chars,valid:s.stats.valid,study:s.stats.study,manual:s.stats.manual,progress:s.progress};
  game.setCustomAllocation(s,'assets');game.input(s,{mode:'dev',chars:300});
  assert.equal(game.customProduction(s).assetProgress,0,'typing code cannot pay out material production');assert.equal(s.stats.manual,before.manual);
  game.produceCustomAssets(s,{effort:300});
  assert.ok(game.customProduction(s).assetProgress>0);assert.equal(s.stats.manual,before.manual+1);
  for(const key of ['chars','valid','study'])assert.equal(s.stats[key],before[key],key);assert.equal(s.progress,before.progress);
  game.setCustomAllocation(s,'code');assert.equal(game.currentProject(s).custom,true);
});

test('material work after code completion accumulates integration changes without rebuilding after every click',()=>{
  const s=begin(puzzle({presentationId:'pixel-2d'}));finishCode(s);game.setCustomAllocation(s,'assets');
  const before={count:s.build.count,revision:s.build.revision,changed:s.build.changed};
  for(let click=0;click<20;click++)assert.ok(game.produceCustomAssets(s).amount>0);
  assert.ok(game.customProduction(s).assetProgress<game.customProduction(s).assetTarget);
  assert.equal(s.build.count,before.count,'an already complete code target is not a reason to rebuild every material click');
  assert.ok(s.build.revision>before.revision);assert.ok(s.build.changed>before.changed);assert.equal(game.needsBuild(s),true,'the unscheduled material changes remain pending');
  let clicks=20;
  while(game.customProduction(s).assetProgress<game.customProduction(s).assetTarget && clicks<1000){game.produceCustomAssets(s);clicks++;}
  near(game.customProduction(s).assetProgress,game.customProduction(s).assetTarget);assert.ok(clicks>20);
  assert.ok(s.build.count-before.count<=8,'material milestones schedule a bounded number of checks, rather than hundreds of identical builds');
  const title=game.release(s);assert.ok(title,'publishing validates the final material changes');assert.equal(s.planner.active,null);
  const work=record(s,s.planner.projects.at(-1).id).work;assert.equal(work.build.checkedRevision,work.build.revision);assert.equal(work.build.changed,0);
});

test('licensed assets charge their named supplier exactly once and cannot publish while unpaid',()=>{
  const plan=puzzle({presentationId:'pixel-2d',assetSources:{'pixel-style-kit':'license'}}),s=begin(plan);
  const cost=estimatePlan(plan).totals.upfrontCost;assert.ok(cost>100);assert.equal(game.customProduction(s).assetTarget,0);
  finishCode(s);const poor=s.cash;assert.equal(game.fundCustomProject(s),false);assert.equal(s.cash,poor);assert.equal(game.release(s),null);
  s.cash=cost+123;assert.equal(game.fundCustomProject(s),true);near(s.cash,123);near(game.customProduction(s).paid,cost);
  const after=s.cash;game.fundCustomProject(s);assert.equal(s.cash,after);assert.ok(game.release(s));
});

test('expansion preserves completed code, paid work, debt and defect exposure instead of granting quality',()=>{
  const s=begin();expert(s);game.input(s,{mode:'dev',chars:500});s.defects=15;
  const before={target:game.currentProject(s).target,progress:s.progress,cash:s.cash,debt:s.debt,defects:s.defects,limit:game.defectLimit(s),q:game.quality(s)};
  const result=game.expandCustomProject(s,{addFeatures:[{id:'save-load'}]});assert.equal(result.ok,true,result.reason);assert.ok(result.delta.codeCharacters>0);
  assert.equal(game.currentProject(s).target,before.target+result.delta.codeCharacters);assert.equal(s.progress,before.progress);assert.equal(s.cash,before.cash);
  assert.equal(s.debt,before.debt);assert.equal(s.defects,before.defects);assert.equal(game.defectLimit(s),before.limit,'adding scope cannot make existing defects disappear beneath a larger denominator');
  assert.ok(game.quality(s)<=before.q,'more code in the plan is not a quality reward');
  const unchanged=game.expandCustomProject(s,{addFeatures:[{id:'save-load'}]});assert.equal(unchanged.ok,true);assert.equal(unchanged.delta.codeCharacters,0);
});

test('pausing, choosing other work, and resuming restores the actual implementation and its maintenance state',()=>{
  const s=begin();expert(s);game.input(s,{mode:'dev',chars:300});s.defects=23;
  const first=s.planner.active,work={progress:s.progress,debt:s.debt,defects:s.defects,build:copy(s.build)};
  assert.equal(game.pauseCustomProject(s),true);assert.equal(s.planner.active,null);assert.equal(record(s,first).status,'paused');
  begin(puzzle({features:[{id:'tutorial-hints'}]}),s);assert.notEqual(s.planner.active,first);game.input(s,{mode:'dev',chars:50});
  const second=s.planner.active,secondProgress=s.progress;
  assert.equal(game.resumeCustomProject(s,first),true);assert.equal(s.planner.active,first);
  assert.equal(s.progress,work.progress);assert.equal(s.debt,work.debt);assert.equal(s.defects,work.defects);assert.deepEqual(s.build,work.build);
  assert.equal(game.resumeCustomProject(s,second),true);assert.equal(s.progress,secondProgress);
});

test('active and paused custom work survive serialization without repricing assets or resetting progress',()=>{
  const s=begin(puzzle({presentationId:'pixel-2d'}));expert(s);game.input(s,{mode:'dev',chars:100});
  game.setCustomAllocation(s,'assets');game.produceCustomAssets(s,{effort:100,manual:false});game.setCustomAllocation(s,'code');
  const first=s.planner.active;game.pauseCustomProject(s);begin(puzzle({features:[{id:'save-load'}]}),s);game.input(s,{mode:'dev',chars:200});
  const before={active:s.planner.active,progress:s.progress,target:game.currentProject(s).target,first:copy(record(s,first)),asset:game.customProduction(s)};
  const loaded=game.deserialize(game.serialize(s,0));assert.equal(loaded.planner.active,before.active);assert.equal(loaded.progress,before.progress);
  assert.equal(game.currentProject(loaded).target,before.target);assert.deepEqual(record(loaded,first),before.first);
  assert.equal(game.resumeCustomProject(loaded,first),true);assert.ok(game.customProduction(loaded).assetProgress>0);
});

test('old saves without planning data preserve existing campaign progress and current title',()=>{
  const s=game.createState(0);delete s.planner;s.projectIndex=1;s.progress=321;s.skills.syntax=24;s.skills.design=8;s.skills.graphics=8;s.debt=12;s.defects=3;
  const loaded=game.deserialize(JSON.stringify(s));assert.equal(loaded.projectIndex,1);assert.equal(loaded.progress,321);assert.equal(loaded.debt,12);assert.equal(loaded.defects,3);
  assert.equal(loaded.planner.active,null);assert.deepEqual(loaded.planner.projects,[]);assert.equal(game.currentProject(loaded).target,game.projectAt(1).target);
});

test('auto planning proposes an explicit plan and is inert until enabled',()=>{
  const s=game.createState(0),before=JSON.stringify(s),suggestion=game.chooseAutoPlan(s);
  assert.ok(suggestion?.plan && suggestion.snapshot && suggestion.reason);assert.equal(JSON.stringify(s),before);
  assert.equal(estimatePlan(suggestion.plan).totals.codeCharacters,suggestion.snapshot.totals.codeCharacters);
  assert.equal(game.setAutoPlanning(s,true),true);assert.equal(s.planner.auto,true);
  assert.equal(game.startAutoPlan(s).ok,true);assert.equal(game.currentProject(s).custom,true);
  assert.equal(game.setAutoPlanning(s,false),true);assert.equal(s.planner.auto,false);
});

test('releasing a free custom work records only observed knowledge and cannot repeatedly reveal the same fact',()=>{
  const {s,title}=publish();assert.equal(title.payout,0);assert.ok(title.builds>0);
  assert.equal(s.planner.active,null);const knowledge=copy(s.planner.knowledge);assert.ok(knowledge.testedFeatures.length>0);
  assert.ok(knowledge.genres.includes('number-puzzle'));
  publish(puzzle(),s);assert.deepEqual(s.planner.knowledge,knowledge,'repeating the same known combination is not a discovery farm');
  const restored=game.deserialize(game.serialize(s,0));assert.deepEqual(restored.planner.knowledge,knowledge);
});

test('observed affinities survive saves and repeated publication without turning every catalog hypothesis into player knowledge',()=>{
  const plan=puzzle({features:[{id:'tutorial-hints'}]}),estimate=estimatePlan(plan);assert.ok(estimate.compatibility.known.length>0);
  const untouched=game.createState(0);game.estimateProjectDraft(untouched,plan);assert.deepEqual(untouched.planner.knowledge.synergies,[]);
  const {s}=publish(plan),known=copy(s.planner.knowledge.synergies);assert.ok(known.length>0);
  const loaded=game.deserialize(game.serialize(s,0));assert.deepEqual(loaded.planner.knowledge.synergies,known,'generated affinity identifiers remain valid through normalization');
  publish(plan,loaded);assert.deepEqual(loaded.planner.knowledge.synergies,known);
});

test('only completed and successfully built custom foundations reduce later work and their debt follows the reuse',()=>{
  const plan=puzzle({engineId:'custom',targets:['windows']}),s=begin(plan);expert(s);
  assert.equal(game.estimateProjectDraft(s,plan).runtime.reusableLines,0);
  game.input(s,{mode:'dev',chars:1000});assert.equal(s.planner.foundations.length,0,'unfinished engine code is not an owned foundation');
  for(let i=0;s.progress<game.currentProject(s).target && i<30;i++)game.input(s,{mode:'dev',chars:game.currentProject(s).target});
  assert.equal(s.progress,game.currentProject(s).target);game.runBuild(s);
  assert.ok(s.planner.foundations.length>0);assert.ok(s.planner.foundations.every(row=>row.verified && row.builds>0));
  const foundations=copy(s.planner.foundations),preview=game.estimateProjectDraft(s,plan);assert.ok(preview.runtime.reusableLines>0);
  assert.ok(preview.runtime.codeTarget>0 && preview.runtime.codeTarget<preview.totals.codeCharacters);
  assert.ok(foundations.some(row=>row.debt>0),'a working engine can still contain maintenance debt');
  game.pauseCustomProject(s);begin(plan,s);assert.ok(s.debt>0);near(s.debt,record(s).reuse.reduce((sum,row)=>sum+row.debt,0));
  const loaded=game.deserialize(game.serialize(s,0));assert.deepEqual(loaded.planner.foundations,foundations);near(loaded.debt,s.debt);
  const unverified=game.createState(0);unverified.planner.foundations=foundations.map(row=>({...row,verified:false}));assert.equal(game.estimateProjectDraft(unverified,plan).runtime.reusableLines,0);
  const incompatible=game.createState(0);incompatible.planner.foundations=foundations.map(row=>({...row,catalogVersion:'old-catalog'}));assert.equal(game.estimateProjectDraft(incompatible,plan).runtime.reusableLines,0);
});

test('adding a large new feature cannot wash an inherited engine debt down by changing its share of the project',()=>{
  const plan=puzzle({engineId:'custom',targets:['windows']}),s=begin(plan);expert(s);
  for(let i=0;s.progress<game.currentProject(s).target && i<30;i++)game.input(s,{mode:'dev',chars:game.currentProject(s).target});
  game.runBuild(s);const original=new Map(s.planner.foundations.map(row=>[row.id,row.debt]));assert.ok([...original.values()].some(value=>value>0));
  game.pauseCustomProject(s);begin(plan,s);const inherited=s.debtSources.reuse;assert.ok(inherited>0);
  // An experienced architect adds almost no new debt. That must not erase
  // the older, still-unrefactored engine merely by diluting its share.
  s.experience.design=1e12;
  const expanded=game.expandCustomProject(s,{addFeatures:[{id:'stage-content',quantity:100}]});assert.equal(expanded.ok,true,expanded.reason);
  for(let i=0;s.progress<game.currentProject(s).target && i<100;i++){
    if(s.crashed || s.defects>game.defectLimit(s)*.05){s.refactor=true;game.input(s,{mode:'dev',chars:s.defects/game.defectRepairRate(s)});s.refactor=false;}
    game.input(s,{mode:'dev',chars:game.currentProject(s).target});
  }
  assert.equal(s.progress,game.currentProject(s).target);
  s.refactor=true;game.input(s,{mode:'dev',chars:s.defects/game.defectRepairRate(s)});s.refactor=false;game.runBuild(s);
  near(s.debtSources.reuse,inherited,'repairing defects alone does not repay the engine structure debt');
  for(const [id,debt] of original)assert.ok(s.planner.foundations.find(row=>row.id===id).debt>=debt-1e-7,id);
});

test('every monetization route has finite revenue and a larger code or content budget alone does not raise the sales forecast',()=>{
  for(const salesModelId of ['free','paid','subscription','f2p-cosmetic','ad-supported','pay-what-you-want']){
    const plan=puzzle({salesModelId}),s=begin(plan);expert(s);s.experience.audience=100;const forecast=game.salesForecast(s);
    assert.ok(Number.isFinite(forecast.gross) && forecast.gross>=0);near(forecast.launchGross+forecast.tailGross,forecast.gross);
    if(salesModelId==='free')assert.equal(forecast.gross,0);else assert.ok(forecast.gross>0,salesModelId);
    const expanded=game.expandCustomProject(s,{addFeatures:[{id:'stage-content',quantity:100}]});assert.equal(expanded.ok,true,expanded.reason);
    const after=game.salesForecast(s);assert.equal(after.copies,forecast.copies);assert.equal(after.gross,forecast.gross,'raw source and content counts do not create customers');
    const {s:released,title}=publish(plan);assert.ok(title.salesRemaining+title.grossPayout<=title.unitPrice*title.totalCopies+1e-7);
    const horizon=game.finiteSalesGross(released,1e100);assert.ok(horizon<=title.salesRemaining+1e-7);near(horizon,title.salesRemaining);
  }
});

test('subscription periods, cosmetic purchases and ad views are distinct finite revenue units with a per-customer spending cap',()=>{
  for(const [salesModelId,kind] of [['paid','copy'],['subscription','subscription-period'],['f2p-cosmetic','cosmetic-purchase'],['ad-supported','ad-view'],['pay-what-you-want','support-payment']]){
    const s=begin(puzzle({salesModelId}));expert(s);s.experience.audience=100;
    const forecast=game.salesForecast(s);assert.equal(forecast.revenueUnitKind,kind);
    assert.equal(forecast.revenueUnitCount,forecast.customerCount*forecast.unitsPerCustomer);assert.ok(forecast.customerCount<=forecast.audienceCount);
    assert.ok(forecast.unitsPerCustomer<=forecast.maxPeriods);assert.ok(forecast.unitsPerCustomer*forecast.price<=forecast.lifetimeBudget+1e-9);
    near(forecast.gross,forecast.revenueUnitCount*forecast.price);
    s.cash=1e12;game.fundCustomProject(s);finishCode(s);finishAssets(s);const title=game.release(s);assert.ok(title);assert.equal(title.revenueUnitKind,kind);
    const loaded=game.deserialize(game.serialize(s,0)).catalog.at(-1);for(const key of ['revenueUnitKind','audienceCount','customerCount','revenueUnitCount','maxPeriods','unitsPerCustomer','lifetimeBudget'])assert.equal(loaded[key],title[key],key);
  }
});

test('custom store fees apply to both launch and tail receipts and survive foreground, offline and saving',()=>{
  for(const [storeIds,rate] of [[['direct'],.05],[['pc-store'],.3]]){
    const {s,title}=publish(puzzle({salesModelId:'paid',storeIds,targets:['windows']}));assert.ok(title.salesRemaining>0);
    near(title.storeFeeRate,rate);near(title.salesFee,title.grossPayout*rate);
    s.cash=0;const raw=game.serialize(s,0),a=game.deserialize(raw),b=game.deserialize(raw),c=game.deserialize(raw),gross=game.finiteSalesGross(a,1800),fees=a.stats.storeFees;
    game.tick(a,1800);for(let i=0;i<3;i++)game.tick(b,600);game.applyOffline(c,1800000);
    near(a.cash,gross*(1-rate));near(a.stats.storeFees-fees,gross*rate);near(a.cash,b.cash);near(a.cash,c.cash);
    const loaded=game.deserialize(game.serialize(a,1800000));near(loaded.catalog[0].storeFeeRate,rate);near(loaded.catalog[0].salesRemaining,a.catalog[0].salesRemaining);
  }
});

test('store discovery offers a tradeoff with direct-sale fees without counting one audience once per store',()=>{
  const forecast=storeIds=>{const s=begin(puzzle({salesModelId:'paid',targets:['windows'],storeIds}));expert(s);s.experience.audience=100;return game.salesForecast(s);};
  const direct=forecast(['direct']),pc=forecast(['pc-store']),both=forecast(['direct','pc-store']),duplicate=forecast(['pc-store','direct','pc-store']);
  assert.ok(pc.copies>direct.copies,'paying for a sales channel can reach more people than an unvisited personal page');
  assert.equal(both.copies,pc.copies,'adding a personal checkout does not count the same reachable audience a second time');
  assert.equal(duplicate.copies,both.copies);assert.equal(duplicate.gross,both.gross);assert.ok(direct.storeFeeRate<pc.storeFeeRate);
});

test('archiving mixed-store originals preserves each fee rate rather than merging them into one royalty contract',()=>{
  const s=game.createState(0),originals=[];
  for(let i=0;i<102;i++)originals.push(copy(publish(puzzle({salesModelId:'paid',storeIds:[i%2?'pc-store':'direct'],targets:['windows']}),s).title));
  assert.ok(s.catalog.some(title=>title.archived));assert.ok(s.catalog.length<=100);
  const seconds=1800,expected=originals.reduce((sum,title)=>sum+salesDuring(title,seconds)*(1-title.storeFeeRate),0);
  s.cash=0;const loaded=game.deserialize(game.serialize(s,0));game.tick(loaded,seconds);near(loaded.cash,expected);
  const batchRates=new Set(loaded.catalog.filter(title=>title.archived).flatMap(title=>title.salesBatches.map(batch=>batch.feeRate)));
  assert.ok(batchRates.has(.05) && batchRates.has(.3),'old direct and PC receipts retain separate fee rates');
});

test('DLC cannot launch without a published base and its audience remains a subset of the selected base purchasers',()=>{
  const s=begin(puzzle({salesModelId:'dlc'}));expert(s);s.cash=1e12;game.fundCustomProject(s);finishCode(s);finishAssets(s);
  assert.equal(game.release(s),null,'selecting DLC does not conjure an installed player base');
  const base=publish(puzzle({salesModelId:'paid'}),s).title;assert.ok(base.totalCopies>0);
  const started=game.startCustomProject(s,puzzle({salesModelId:'dlc'}),{baseId:base.id,name:'本編の追加内容'});assert.equal(started.ok,true,started.reason);
  game.fundCustomProject(s);finishCode(s);finishAssets(s);const forecast=game.salesForecast(s);assert.ok(forecast.copies<=base.totalCopies);
  assert.ok(game.release(s));
});

test('automatic planning actually finishes a known small production without granting instant code or material work',()=>{
  const s=game.createState(0);Object.assign(s.skills,{syntax:12,design:8,systems:8});s.items.library=1;s.cash=10000;game.setAutoPlanning(s,true);
  assert.equal(game.startAutoPlan(s).ok,true);const initial=game.currentProject(s),before=s.stats.releases;
  assert.equal(s.progress,0);assert.equal(game.customProduction(s).assetProgress,0);
  let elapsed=0;while(s.stats.releases===before && elapsed<4*3600){game.tick(s,60);elapsed+=60;}
  assert.ok(s.stats.releases>before,`${initial.name} must leave the assembly stage in automatic mode`);
  assert.ok(elapsed>0 && s.stats.time>=elapsed);assert.ok(s.catalog.some(title=>title.custom));
});

test('the permitted shelf capacity remains loadable even with large multi-feature project snapshots',()=>{
  const s=game.createState(0),plan=PLANNING_EXAMPLES.find(row=>row.id==='full-dive-vrmmo').plan;
  for(let index=0;index<24;index++)begin(plan,s);
  assert.equal(s.planner.projects.length,24);const before=JSON.stringify(s.planner.projects.map(row=>[row.id,row.status,row.snapshot.catalogVersion,row.codeTarget]));
  const raw=game.serialize(s,0),loaded=game.deserialize(raw);assert.equal(loaded.planner.projects.length,24);
  assert.equal(JSON.stringify(loaded.planner.projects.map(row=>[row.id,row.status,row.snapshot.catalogVersion,row.codeTarget])),before);
  const next=game.startCustomProject(loaded,puzzle());assert.equal(next.ok,false);assert.equal(loaded.planner.projects.length,24);
});

test('recent published history does not evict any of the twenty-four pending projects during save normalization',()=>{
  const s=game.createState(0);for(let i=0;i<7;i++)publish(puzzle(),s);
  for(let i=0;i<24;i++)begin(puzzle({features:[{id:'save-load'}]}),s);
  const pending=s.planner.projects.filter(project=>project.status!=='released').map(project=>project.id).sort(),active=s.planner.active;
  assert.equal(pending.length,24);assert.ok(s.planner.projects.some(project=>project.status==='released'));
  const loaded=game.deserialize(game.serialize(s,0));assert.deepEqual(loaded.planner.projects.filter(project=>project.status!=='released').map(project=>project.id).sort(),pending);
  assert.equal(loaded.planner.active,active);assert.ok(loaded.planner.projects.some(project=>project.status==='released'));
});
