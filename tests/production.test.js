import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceRequirements } from '../src/career.js';
import { createState, projectAt, projectAccess, productionOptions, productionCost, orderProduction, quality, defectLimit, runBuild, needsBuild, release, tick, serialize, deserialize, prestige } from '../src/core.js';

function developer(index=2,ratio=1){
  const s=createState();s.projectIndex=index;s.mode='dev';s.cash=1e8;s.autoEnabled=false;
  const access=experienceRequirements(index);s.experience={...access.experience};Object.assign(s.items,access.items);
  assert.equal(projectAccess(s).allowed,true,'the fixture meets career and equipment requirements without a legacy permit');
  for(const [id,value] of Object.entries(projectAt(index).req))s.skills[id]=value*ratio;
  return s;
}

test('named non-programming services quote an actual quality change and charge once per title',()=>{
  const s=developer();assert.equal(quality(s),80);
  const quotes=productionOptions(s),quote=quotes.find(q=>q.id==='graphics'),audio=quotes.find(q=>q.id==='audio');
  assert.equal(audio.cost,400);assert.equal(audio.name,'音楽・効果音素材ライセンス');assert.equal(audio.payee,'素材ストア・制作者');
  assert.equal(quote.cost,600);assert.equal(quote.name,'2D素材パック');assert.equal(quote.payee,'素材ストア・制作者');assert.equal(quote.qualityBefore,80);assert.equal(quote.qualityAfter,86);
  const before={cash:s.cash,progress:s.progress,skills:{...s.skills},debt:s.debt,defects:s.defects};
  assert.equal(orderProduction(s,'graphics'),true);assert.equal(s.cash,before.cash-600);assert.equal(quality(s),86);
  assert.equal(s.progress,before.progress);assert.deepEqual(s.skills,before.skills);assert.equal(s.debt,before.debt);assert.equal(s.defects,before.defects);
  assert.equal(orderProduction(s,'graphics'),false);assert.equal(s.cash,before.cash-600);assert.equal(productionCost(s),600);
  assert.equal(s.stats.outsourcing,600);
  const loaded=deserialize(serialize(s));assert.equal(orderProduction(loaded,'graphics'),false);assert.equal(productionCost(loaded),600);
  const cash=loaded.cash;tick(loaded,8*3600);assert.equal(loaded.cash,cash);assert.equal(loaded.stats.outsourcing,600);
});

test('both free exercises have no outsourcing, and invalid orders cannot overdraw cash',()=>{
  for(const index of [0,1]){
    const first=developer(index),cash=first.cash;assert.deepEqual(productionOptions(first),[]);
    assert.equal(orderProduction(first,'graphics'),false);assert.equal(orderProduction(first,'audio'),false);
    assert.equal(first.cash,cash);assert.equal(first.stats.outsourcing,0);assert.deepEqual(first.production,{});
  }
  const s=developer();s.cash=599;assert.equal(orderProduction(s,'graphics'),false);assert.equal(s.cash,599);
  assert.equal(orderProduction(s,'unknown'),false);assert.deepEqual(s.production,{});
});

test('larger productions pay named creators from the base sales budget rather than experience bonuses',()=>{
  const s=developer(3),quotes=productionOptions(s);
  const graphics=quotes.find(q=>q.id==='graphics'),audio=quotes.find(q=>q.id==='audio');
  assert.equal(graphics.name,'グラフィック制作');assert.match(graphics.payee,/アーティスト/);assert.equal(graphics.cost,45000);
  assert.equal(audio.name,'音楽・効果音制作');assert.match(audio.payee,/作曲家/);assert.equal(audio.cost,30000);
  s.experience.audience=1e6;for(const id of Object.keys(projectAt(3).req))s.skills[id]*=2;
  assert.deepEqual(productionOptions(s).map(q=>q.cost),[45000,30000]);
  const cash=s.cash;assert.equal(orderProduction(s,'graphics'),true);assert.equal(s.cash,cash-45000);assert.equal(quality(s),96);
});

test('quality caps are reflected before ordering and ineffective orders are blocked',()=>{
  const s=developer(2,2.5);assert.equal(quality(s),95);
  const quote=productionOptions(s).find(q=>q.id==='graphics');assert.equal(quote.qualityAfter,100);
  assert.equal(orderProduction(s,'graphics'),true);assert.equal(quality(s),100);
  const audio=productionOptions(s).find(q=>q.id==='audio');assert.equal(audio.qualityBefore,100);assert.equal(audio.qualityAfter,100);
  const cash=s.cash;assert.equal(orderProduction(s,'audio'),false);assert.equal(s.cash,cash);
});

test('new art invalidates integration checks and cannot repair code or bypass commercial gates',()=>{
  const s=developer();s.progress=100;runBuild(s);assert.equal(needsBuild(s),false);
  s.defects=100;const defects=s.defects;assert.equal(orderProduction(s,'graphics'),true);
  assert.equal(needsBuild(s),true);assert.equal(s.defects,defects);
  s.progress=projectAt(s.projectIndex).target;const blocking=defectLimit(s)*.11;s.defects=blocking;assert.equal(release(s),null);assert.equal(s.build.knownDefects,blocking);
  const unqualified=developer(2,.75);unqualified.progress=projectAt(2).target;orderProduction(unqualified,'graphics');orderProduction(unqualified,'audio');
  assert.equal(release(unqualified).royalty,0);
});

test('receipts stay with released titles and new projects never order or pay automatically',()=>{
  const s=developer(2);orderProduction(s,'graphics');orderProduction(s,'audio');s.progress=projectAt(2).target;
  const costs=productionCost(s),title=release(s);assert.equal(costs,1000);assert.equal(title.productionCosts,costs);assert.deepEqual(title.services,['graphics','audio']);
  assert.deepEqual(s.production,{});assert.equal(productionCost(s),0);assert.equal(s.stats.outsourcing,costs);
  const loaded=deserialize(serialize(s));assert.equal(loaded.catalog[0].productionCosts,costs);assert.deepEqual(loaded.production,{});
  const fresh=prestige(s);assert.deepEqual(fresh.production,{});assert.equal(fresh.stats.outsourcing,costs);
  const old=developer();delete old.production;delete old.stats.outsourcing;
  const migrated=deserialize(JSON.stringify(old));assert.deepEqual(migrated.production,{});assert.equal(migrated.stats.outsourcing,0);
});
