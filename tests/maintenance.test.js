import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceRequirements } from '../src/career.js';
import { createState, projectAt, projectAccess, input, tick, release, quality, buy, debtLimit, defectLimit, developmentEfficiency, setDevelopmentPolicy, libraryDebtImport, serialize, deserialize, applyOffline, DAY, prestige } from '../src/core.js';
import { debtBreakdown, debtAgeDays, changeDefectRate } from '../src/maintenance.js';

function developer(index=0){
  const s=createState(0);s.projectIndex=index;s.mode='dev';
  const access=experienceRequirements(index);s.experience={...access.experience};Object.assign(s.items,access.items);
  assert.equal(projectAccess(s).allowed,true,'the fixture meets career and equipment requirements without a legacy permit');
  for(const [id,required] of Object.entries(projectAt(index).req))s.skills[id]=required;
  return s;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('understood code incurs deferred work with actionable causes; policies trade speed for upkeep',()=>{
  const states=Object.fromEntries(['prototype','steady','structured'].map(id=>{
    const s=developer();assert.equal(setDevelopmentPolicy(s,id),true);input(s,{chars:100});return [id,s];
  }));
  assert.ok(states.prototype.progress>states.steady.progress);
  assert.ok(states.steady.progress>states.structured.progress);
  assert.ok(states.prototype.debt/states.prototype.progress>states.steady.debt/states.steady.progress);
  assert.ok(states.steady.debt/states.steady.progress>states.structured.debt/states.structured.progress);
  for(const s of Object.values(states)){
    assert.deepEqual(debtBreakdown(s).map(c=>c.id),['temporary','coupling','verification']);
    near(debtBreakdown(s).reduce((n,c)=>n+c.amount,0),s.debt);
    assert.ok(s.defects>0);assert.equal(s.crashed,false);
  }
  assert.equal(setDevelopmentPolicy(states.steady,'unknown'),false);
});

test('debt and repaired historical mistakes neither block a commercial release nor reduce quality',()=>{
  const s=developer(2);s.progress=projectAt(2).target;s.debt=debtLimit(s);s.mistakes=1e6;
  assert.equal(quality(s),80);
  const result=release(s);
  assert.ok(result.royalty>0);assert.ok(result.salesRemaining>0);assert.equal(result.technicalDebt,projectAt(2).target*.25);
  assert.equal(s.debt,0,'an isolated project is not forcibly reused');
  const bugs=developer(2);bugs.progress=projectAt(2).target;bugs.defects=defectLimit(bugs)*.11;
  assert.equal(release(bugs),null);
});

test('both free exercises can ship working code with deferred cleanup and no fabricated sales',()=>{
  for(const index of [0,1]){
    const s=developer(index);s.progress=projectAt(index).target;s.debt=debtLimit(s);s.mistakes=1e6;
    const cash=s.cash,qualityBefore=quality(s),title=release(s);
    assert.ok(title);assert.equal(title.quality,qualityBefore);assert.equal(title.quality,80);
    assert.equal(title.technicalDebt,projectAt(index).target*.25);assert.equal(title.defects,0);
    assert.equal(title.payout,0);assert.equal(title.royalty,0);assert.equal(title.salesRemaining,0);assert.equal(s.cash,cash);
    assert.equal(s.defects,0);assert.equal(s.debt,0);
  }
});

test('inexperienced developers accumulate unnoticed debt, and existing debt makes later additions buggy',()=>{
  const novice=developer(),experienced=developer();experienced.skills.design=400;experienced.stats.releases=5;
  input(novice,{chars:100});input(experienced,{chars:100});
  assert.equal(novice.progress,experienced.progress);
  assert.ok(novice.debt>experienced.debt);assert.ok(experienced.debt>0);
  const clean=developer(),messy=developer();messy.debt=debtLimit(messy)*.5;
  assert.ok(changeDefectRate(messy,debtLimit(messy))>changeDefectRate(clean,debtLimit(clean)));
  // Compare equal new progress, rather than confusing slower progress with safety.
  const cleanWork=input(clean,{chars:100}),messyWork=input(messy,{chars:100});
  assert.ok(messyWork.introducedDefects/messyWork.amount>cleanWork.introducedDefects/cleanWork.amount);
  assert.equal(messy.crashed,false,'the debt itself is not a broken build');
});

test('time, completed inputs and policy changes do not manufacture debt or defects',()=>{
  const s=developer();input(s,{chars:3000});s.items.library=1;
  const before=[s.debt,s.defects,s.progress];
  tick(s,8*3600);
  assert.deepEqual([s.debt,s.defects,s.progress],before);
  setDevelopmentPolicy(s,'prototype');s.skills.syntax=9;
  for(let n=0;n<30;n++)input(s,{chars:100});
  assert.deepEqual([s.debt,s.defects,s.progress],before);
  s.autoEnabled=false;s.progress=1500;
  tick(s,3600);
  assert.deepEqual([s.debt,s.defects],[before[0],before[1]]);
});

test('old messy code slows modification; review fixes bugs first and cleaning restores efficiency',()=>{
  const s=developer();input(s,{chars:1000});s.autoEnabled=false;
  const fresh=developmentEfficiency(s),debt=s.debt;
  for(let n=0;n<4;n++)tick(s,8*DAY);
  assert.equal(s.debt,debt);assert.ok(debtAgeDays(s,DAY)>=30);
  assert.ok(developmentEfficiency(s)<fresh);
  s.defects=40;s.refactor=true;
  const first=input(s,{chars:5});assert.equal(first.fixed,20);assert.equal(first.amount,0);near(s.debt,debt);
  const progress=s.progress;input(s,{chars:1000});
  assert.equal(s.progress,progress);assert.equal(s.defects,0);assert.equal(s.debt,0);
  assert.equal(developmentEfficiency(s),1);assert.equal(s.reviewedAt,s.stats.time);
});

test('automation repairs a completed crashed build and then cleans its structure',()=>{
  const s=developer();s.progress=3000;s.defects=750;s.crashed=true;s.debt=50;s.refactor=true;s.items.assistant=1;
  tick(s,100);
  assert.equal(s.crashed,false);assert.equal(s.defects,0);assert.equal(s.debt,0);assert.equal(s.progress,3000);
  assert.ok(s.stats.defectsFixed>0);assert.ok(s.stats.debtRemoved>0);
});

test('library imports 25% of the latest source once, then carries only the current code at release',()=>{
  const s=developer(2);s.cash=1e6;s.stats.time=100;
  s.catalog=[{name:'古い作品',technicalDebt:1000,reviewedAt:0},{name:'直前の作品',technicalDebt:400,reviewedAt:50}];
  assert.equal(libraryDebtImport(s),100);assert.equal(s.debt,0);
  assert.equal(buy(s,'library'),true);assert.equal(s.debt,100);assert.equal(s.debtSources.reuse,100);
  assert.equal(libraryDebtImport(s),0);assert.equal(buy(s,'library'),true);assert.equal(s.debt,100);
  s.progress=projectAt(2).target;
  const title=release(s);assert.equal(title.technicalDebt,100);assert.equal(s.debt,25);assert.equal(s.debtSources.reuse,25);
  const loaded=deserialize(serialize(s,1000));assert.equal(loaded.debt,25);assert.equal(loaded.reviewedAt,50);
  assert.equal(libraryDebtImport(loaded),0);
  const fresh=prestige(s);assert.ok(fresh);assert.equal(fresh.debt,0);assert.equal(fresh.defects,0);
});

test('reuse cannot discard debt by filling a nominal project budget before buying the library',()=>{
  const s=developer(1);s.cash=100000;s.debt=debtLimit(s);s.catalog=[{name:'前作',technicalDebt:400,reviewedAt:0}];
  assert.equal(libraryDebtImport(s),100);assert.equal(buy(s,'library'),true);
  assert.equal(s.debt,debtLimit(s)+100);
  assert.equal(deserialize(serialize(s)).debt,s.debt);
});

test('old bad-code debt migrates to defects without losing resources or a recovery route',()=>{
  for(const balanceVersion of [undefined,1,7]){
    const s=developer();s.balanceVersion=balanceVersion;s.debt=750;s.crashed=true;s.cash=12345;s.progress=1200;s.items.assistant=1;
    const migrated=deserialize(JSON.stringify(s));
    assert.equal(migrated.debt,0);assert.equal(migrated.defects,750);assert.equal(migrated.crashed,true);
    assert.equal(migrated.cash,12345);assert.equal(migrated.progress,1200);assert.equal(migrated.items.assistant,1);
    migrated.refactor=true;input(migrated,{chars:200});assert.equal(migrated.crashed,false);assert.equal(migrated.defects,0);
  }
});

test('new saves reconcile debt sources and retain policy and deferred work across foreground/offline paths',()=>{
  const s=developer();setDevelopmentPolicy(s,'structured');input(s,{chars:100});s.items.library=1;s.stats.time=DAY;s.savedAt=1000;
  const raw=serialize(s,1000),foreground=deserialize(raw),offline=deserialize(raw);
  assert.equal(offline.developmentPolicy,'structured');near(offline.debt,s.debt);
  tick(foreground,100);applyOffline(offline,101000);
  for(const key of ['progress','debt','defects','reviewedAt'])near(foreground[key],offline[key]);
  const tampered=JSON.parse(raw);tampered.debtSources={temporary:1e50,evil:123};tampered.developmentPolicy='evil';
  const clean=deserialize(JSON.stringify(tampered));
  near(debtBreakdown(clean).reduce((n,c)=>n+c.amount,0),clean.debt);
  assert.equal(clean.debtSources.evil,undefined);assert.equal(clean.developmentPolicy,'steady');
});
