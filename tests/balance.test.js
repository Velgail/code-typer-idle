import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,SCENARIOS,FAST_TYPING,TYPING_WITH_READING,manualInputModel} from '../scripts/simulate-balance.mjs';
import {PACING_REPORT} from '../src/pacing.js';
import {BALANCE_VERSION,INITIAL_CASH,OFFICE_CONTRACT_WORK,projectAt,STORE_FEE_RATE} from '../src/core.js';

const cache=new Map();
const run=(scenario,options={})=>{const key=JSON.stringify([scenario,options]);if(!cache.has(key))cache.set(key,simulate(scenario,options));return cache.get(key);};
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-8,message || `${a} != ${b}`);
function fundedAndFinite(result){
  assert.ok(result.minimumCash>=-1e-6,'the policy must pay its own purchases and bills');
  for(const key of ['elapsedSeconds','simulatedSeconds','offlineCappedSeconds','activeSeconds','manualInputs','minimumCash','spent','finalCash','earned','capitalChanges','expenses'])assert.ok(Number.isFinite(result[key]),key);
  near(result.elapsedSeconds,result.simulatedSeconds+result.offlineCappedSeconds,'capped offline time must stay on the real timeline without advancing the core');
  near(INITIAL_CASH+result.earned+result.capitalChanges-result.spent-result.expenses-result.outsourcingSpend,result.finalCash,'cash must reconcile after giving up cash at every actual prestige');
  const income=result.income;
  near(income.manualJobs+income.ocrNet+income.gameRoyalties+income.launchPayout,result.earned,'repeat-title income is a subset of game income, not an extra payment');
  near(income.ocrGross-income.ocrCancelled-income.ocrFees+income.ocrRecovered,income.ocrNet);
  assert.equal(Object.values(result.modeSeconds).reduce((sum,n)=>sum+n,0),result.activeSeconds);
  for(const stage of result.stages){
    assert.equal(Object.values(stage.modeSeconds).reduce((sum,n)=>sum+n,0),stage.activeSeconds);
    assert.ok(stage.elapsedSeconds>=stage.activeSeconds);
    for(const n of Object.values(stage.output))assert.ok(Number.isFinite(n)&&n>=-1e-8);
    for(const n of Object.values(stage.income))assert.ok(Number.isFinite(n));
  }
  for(const milestone of result.milestones){
    near(milestone.fullSalesNet,milestone.price*milestone.copies*(1-STORE_FEE_RATE));
    assert.ok(milestone.payout<=milestone.fullSalesNet);
    for(const [id,required] of Object.entries(projectAt(milestone.index).req))assert.ok(milestone.confirmedKnowledge[id]>=required);
  }
}

for(const scenario of [SCENARIOS[0],SCENARIOS[1],TYPING_WITH_READING])test(`free exercises, a real new life and first commercial release: ${scenario.name}`,()=>{
  const result=run(scenario,{horizon:8*3600,stopAfter:3});fundedAndFinite(result);
  assert.equal(result.status,'release-limit');assert.deepEqual(result.milestones.map(m=>[m.index,m.run]),[[0,1],[1,1],[2,2]]);
  assert.equal(result.reachedAAA,false);assert.equal(result.aaa,null);
  assert.equal(result.runs[0].releases,2);assert.equal(result.prestiges.length,1);
  const prestige=result.firstPrestige;assert.ok(prestige);assert.deepEqual(prestige.gain,{craft:5,design:2,audience:1});
  assert.deepEqual(prestige.knowledgeAfter,prestige.knowledgeBefore,'the policy must not relearn confirmed syntax every life');
  assert.deepEqual(prestige.experienceAfter,{craft:5,design:2,audience:1});
  for(const milestone of result.milestones.slice(0,2)){assert.equal(milestone.commercial,false);assert.equal(milestone.payout,0);assert.equal(milestone.fullSalesNet,0);assert.equal(milestone.cash,INITIAL_CASH);}
  assert.equal(result.firstCommercial.index,2);assert.equal(result.firstCommercial.run,2);assert.ok(result.firstCommercial.payout>0);
  assert.ok(result.firstCommercial.seconds>result.firstPrestige.seconds);
  assert.equal(result.modeSeconds.work,0);assert.equal(result.workShare,0);assert.equal(result.officeRemaining,OFFICE_CONTRACT_WORK);
  for(const key of ['manualJobs','ocrGross','ocrCancelled','ocrFees','ocrRecovered','ocrNet'])assert.equal(result.income[key],0,key);
  assert.equal(result.itemLevels.macro || 0,0);assert.ok(!result.purchaseHistory.some(p=>p.id==='macro'));
  assert.ok(result.purchaseHistory.every(p=>p.seconds>=result.firstCommercial.seconds));
});

test('the standard policy does not force first-life AAA or inject career experience when a new life is disallowed',()=>{
  const result=run(SCENARIOS[1],{horizon:8*3600,maxRuns:1});fundedAndFinite(result);
  assert.equal(result.status,'run-limit');assert.equal(result.reachedAAA,false);assert.equal(result.prestiges.length,0);
  assert.deepEqual(result.careerExperience,{craft:0,design:0,audience:0});assert.deepEqual(result.runExperience,{craft:5,design:2,audience:1});
  assert.deepEqual(result.milestones.map(m=>m.index),[0,1]);
});

test('typing is ten times click throughput at the reference speed before equipment and correction retains reading costs',()=>{
  const click=manualInputModel(SCENARIOS[0],'work').unitsPerSecond;
  for(const mode of ['work','study','dev'])assert.equal(manualInputModel(SCENARIOS[1],mode).unitsPerSecond,click*10);
  const realistic=manualInputModel(TYPING_WITH_READING,'work');assert.ok(realistic.unitsPerSecond>50 && realistic.unitsPerSecond<60);
  assert.ok(manualInputModel(TYPING_WITH_READING,'study').unitsPerSecond>70);
  assert.ok(manualInputModel(TYPING_WITH_READING,'work',{workLength:2}).unitsPerSecond<realistic.unitsPerSecond);
  assert.ok(manualInputModel({...TYPING_WITH_READING,officeReadingSeconds:6},'work').unitsPerSecond<realistic.unitsPerSecond);
  assert.ok(manualInputModel({...TYPING_WITH_READING,correctionSeconds:1},'work').unitsPerSecond<realistic.unitsPerSecond);
  assert.ok(manualInputModel({...TYPING_WITH_READING,accuracy:1},'work').unitsPerSecond>realistic.unitsPerSecond);
  for(const invalid of [{rate:0},{accuracy:0},{accuracy:1.1},{correctionSeconds:-1},{officeReadingSeconds:Infinity}])assert.throws(()=>manualInputModel({...TYPING_WITH_READING,...invalid},'work'),RangeError);
  assert.throws(()=>manualInputModel(TYPING_WITH_READING,'work',{workLength:0}),RangeError);
});

test('faster correct input accelerates the same funded career opening without creating extra free-game experience',()=>{
  const click=run(SCENARIOS[0],{horizon:8*3600,stopAfter:3}),typing=run(SCENARIOS[1],{horizon:8*3600,stopAfter:3}),fast=run(FAST_TYPING,{horizon:8*3600,stopAfter:3});
  fundedAndFinite(fast);assert.ok(typing.firstCommercial.seconds<click.firstCommercial.seconds);assert.ok(fast.firstCommercial.seconds<typing.firstCommercial.seconds);
  assert.deepEqual(fast.firstPrestige.gain,typing.firstPrestige.gain);
});

test('development policies retain implementation versus review tradeoffs in the free opening',()=>{
  const prototype=run(SCENARIOS[1],{horizon:3600,stopAfter:2,policy:'prototype'}),structured=run(SCENARIOS[1],{horizon:3600,stopAfter:2,policy:'structured'});
  for(const result of [prototype,structured]){fundedAndFinite(result);assert.equal(result.milestones.length,2);}
  assert.ok(prototype.modeSeconds.development<structured.modeSeconds.development);assert.ok(prototype.modeSeconds.review>structured.modeSeconds.review);
});

test('the published balance report describes actual multi-life careers and reconciles its finite income',()=>{
  assert.equal(PACING_REPORT.balanceVersion,BALANCE_VERSION,'regenerate the balance report after a rule update');
  assert.ok(PACING_REPORT.scenarios.length>=3);
  for(const result of PACING_REPORT.scenarios){
    fundedAndFinite(result);if(result.returning)assert.ok(result.offlineCappedSeconds>0);else assert.equal(result.offlineCappedSeconds,0);assert.ok(result.firstPrestige);assert.equal(result.milestones[0].run,1);assert.equal(result.milestones[1].run,1);
    assert.equal(result.milestones[0].commercial,false);assert.equal(result.milestones[1].commercial,false);
    if(result.reachedAAA){assert.ok(result.aaa.run>1);assert.ok(result.prestiges.length>1);assert.equal(result.aaa.index,4);}
    else assert.notEqual(result.status,'aaa','an unreached title cannot be reported as completed');
  }
});


test('a funded career reaches AAA after actual commercial repeats, higher-scale releases and multiple new lives',()=>{
  const result=run(SCENARIOS[1]);fundedAndFinite(result);
  assert.equal(result.status,'aaa');assert.equal(result.reachedAAA,true);assert.ok(result.aaa.run>2);
  assert.ok(result.prestiges.length>1);assert.ok(result.milestones.some(m=>m.index===3));
  assert.ok(result.milestones.some(m=>m.repeat && m.index>=2));
  assert.ok(result.income.repeatLaunch+result.income.repeatTail>0);
  assert.equal(result.modeSeconds.work,0);assert.equal(result.income.manualJobs,0);assert.equal(result.income.ocrNet,0);
  const ref=PACING_REPORT.scenarios.find(s=>s.id===result.id);assert.ok(ref);
  assert.equal(result.aaa.seconds,ref.aaa.seconds);assert.equal(result.aaa.run,ref.aaa.run);
  assert.deepEqual(result.milestones.map(m=>[m.run,m.index,m.repeat,m.seconds]),ref.milestones.map(m=>[m.run,m.index,m.repeat,m.seconds]),'regenerate the report when real career milestones change');
  for(const prestige of result.prestiges)assert.deepEqual(prestige.knowledgeAfter,prestige.knowledgeBefore);
});

test('removing commercial repeats exposes finite funding limits rather than fabricating infinite royalties',()=>{
  const result=run(SCENARIOS[1],{repeats:false});fundedAndFinite(result);
  assert.equal(result.reachedAAA,false);assert.equal(result.status,'policy-blocked');
  assert.equal(result.failureReason.kind,'finite-budget-without-repeats');
  assert.ok(result.failureReason.cash+result.failureReason.remainingSales<result.failureReason.needed);
  assert.equal(result.income.repeatLaunch,0);assert.equal(result.income.repeatTail,0);
});


test('returning play cannot reset the eight-hour offline limit by splitting one long absence into smaller ticks',()=>{
  const result=run(SCENARIOS[2],{horizon:30*3600});fundedAndFinite(result);
  assert.ok(result.offlineCappedSeconds>0);assert.equal(result.elapsedSeconds,30*3600);
  assert.ok(result.simulatedSeconds<result.elapsedSeconds);
  assert.ok(result.activeSeconds<=6600,'the benchmark must not manufacture active input during capped overnight time');
});
