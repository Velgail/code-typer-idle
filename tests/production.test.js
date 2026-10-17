import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, projectAt, productionOptions, productionCost, orderProduction, quality, runBuild, needsBuild, release, tick, serialize, deserialize, prestige } from '../src/core.js';

function developer(index=1,ratio=1){
  const s=createState();s.projectIndex=index;s.mode='dev';s.cash=1e8;s.autoEnabled=false;
  for(const [id,value] of Object.entries(projectAt(index).req))s.skills[id]=value*ratio;
  return s;
}

test('named non-programming services quote an actual quality change and charge once per title',()=>{
  const s=developer();assert.equal(quality(s),80);
  const quote=productionOptions(s).find(q=>q.id==='graphics');
  assert.equal(quote.cost,6000);assert.match(quote.payee,/アーティスト/);assert.equal(quote.qualityBefore,80);assert.equal(quote.qualityAfter,86);
  const before={cash:s.cash,progress:s.progress,skills:{...s.skills},debt:s.debt,defects:s.defects};
  assert.equal(orderProduction(s,'graphics'),true);assert.equal(s.cash,before.cash-6000);assert.equal(quality(s),86);
  assert.equal(s.progress,before.progress);assert.deepEqual(s.skills,before.skills);assert.equal(s.debt,before.debt);assert.equal(s.defects,before.defects);
  assert.equal(orderProduction(s,'graphics'),false);assert.equal(s.cash,before.cash-6000);assert.equal(productionCost(s),6000);
  assert.equal(s.stats.outsourcing,6000);
  const loaded=deserialize(serialize(s));assert.equal(orderProduction(loaded,'graphics'),false);assert.equal(productionCost(loaded),6000);
  const cash=loaded.cash;tick(loaded,8*3600);assert.equal(loaded.cash,cash);assert.equal(loaded.stats.outsourcing,6000);
});

test('the first text-only game has no compulsory outsourcing, and invalid orders cannot overdraw cash',()=>{
  const first=developer(0);assert.deepEqual(productionOptions(first),[]);assert.equal(orderProduction(first,'graphics'),false);
  const s=developer();s.cash=5999;assert.equal(orderProduction(s,'graphics'),false);assert.equal(s.cash,5999);
  assert.equal(orderProduction(s,'unknown'),false);assert.deepEqual(s.production,{});
});

test('quality caps are reflected before ordering and ineffective orders are blocked',()=>{
  const s=developer(1,2.5);assert.equal(quality(s),95);
  const quote=productionOptions(s).find(q=>q.id==='graphics');assert.equal(quote.qualityAfter,100);
  assert.equal(orderProduction(s,'graphics'),true);assert.equal(quality(s),100);
  const audio=productionOptions(s).find(q=>q.id==='audio');assert.equal(audio.qualityBefore,100);assert.equal(audio.qualityAfter,100);
  const cash=s.cash;assert.equal(orderProduction(s,'audio'),false);assert.equal(s.cash,cash);
});

test('new art invalidates integration checks and cannot repair code or bypass commercial gates',()=>{
  const s=developer();s.progress=100;runBuild(s);assert.equal(needsBuild(s),false);
  s.defects=100;const defects=s.defects;assert.equal(orderProduction(s,'graphics'),true);
  assert.equal(needsBuild(s),true);assert.equal(s.defects,defects);
  s.progress=18000;s.defects=500;assert.equal(release(s),null);assert.equal(s.build.knownDefects,500);
  const unqualified=developer(1,.75);unqualified.progress=18000;orderProduction(unqualified,'graphics');orderProduction(unqualified,'audio');
  assert.equal(release(unqualified).royalty,0);
});

test('receipts stay with released titles and new projects never order or pay automatically',()=>{
  const s=developer(2);orderProduction(s,'graphics');orderProduction(s,'audio');s.progress=projectAt(2).target;
  const costs=productionCost(s),title=release(s);assert.equal(title.productionCosts,costs);assert.deepEqual(title.services,['graphics','audio']);
  assert.deepEqual(s.production,{});assert.equal(productionCost(s),0);assert.equal(s.stats.outsourcing,costs);
  const loaded=deserialize(serialize(s));assert.equal(loaded.catalog[0].productionCosts,costs);assert.deepEqual(loaded.production,{});
  const fresh=prestige(s);assert.deepEqual(fresh.production,{});assert.equal(fresh.stats.outsourcing,costs);
  const old=developer();delete old.production;delete old.stats.outsourcing;
  const migrated=deserialize(JSON.stringify(old));assert.deepEqual(migrated.production,{});assert.equal(migrated.stats.outsourcing,0);
});
