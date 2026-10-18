import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceRequirements } from '../src/career.js';
import { createState, projectAt, projectAccess, input, tick, runBuild, needsBuild, buildStep, release, serialize, deserialize, applyOffline, setDevelopmentPolicy } from '../src/core.js';

function developer(index=0){
  const s=createState(0);s.mode='dev';s.projectIndex=index;s.autoEnabled=false;
  const access=experienceRequirements(index);s.experience={...access.experience};Object.assign(s.items,access.items);
  assert.equal(projectAccess(s).allowed,true,'the fixture meets career and equipment requirements without a legacy permit');
  for(const [id,value] of Object.entries(projectAt(index).req))s.skills[id]=value;
  return s;
}

test('small changes are built and tested before the first project is complete',()=>{
  const s=developer(),step=buildStep(s);
  assert.ok(step>=100 && step<=300);
  input(s,{chars:step-1});assert.equal(s.build.count,0);assert.equal(s.build.knownDefects,0);assert.equal(needsBuild(s),true);
  input(s,{chars:2});assert.ok(s.progress<3000);assert.equal(s.build.count,1);
  assert.equal(s.build.last.status,'warnings');assert.ok(s.build.knownDefects>0);
  assert.equal(needsBuild(s),false);assert.equal(s.crashed,false);
  input(s,{chars:1});assert.equal(needsBuild(s),true);assert.ok(s.defects>s.build.knownDefects);
});

test('manual builds inspect the current change without providing repeatable rewards',()=>{
  const s=developer();input(s,{chars:10});
  const resources=JSON.stringify({cash:s.cash,stats:s.stats,skills:s.skills,progress:s.progress,debt:s.debt,defects:s.defects});
  const result=runBuild(s);assert.equal(result.status,'warnings');assert.equal(s.build.count,1);
  assert.equal(JSON.stringify({cash:s.cash,stats:s.stats,skills:s.skills,progress:s.progress,debt:s.debt,defects:s.defects}),resources);
  for(let n=0;n<20;n++)assert.equal(runBuild(s),null);
  assert.equal(s.build.count,1);
});

test('repairing and refactoring invalidate the checked revision even without increasing progress',()=>{
  const s=developer();input(s,{chars:100});runBuild(s);
  const progress=s.progress,revision=s.build.checkedRevision;s.refactor=true;
  input(s,{chars:1});assert.equal(s.defects,0);assert.ok(s.debt>0);assert.ok(s.build.revision>revision);
  assert.equal(s.build.last.status,'passed');assert.equal(needsBuild(s),false);
  input(s,{chars:1});assert.equal(s.progress,progress);assert.equal(needsBuild(s),true);
  const changed=s.build.revision;runBuild(s);assert.equal(s.build.checkedRevision,changed);assert.equal(needsBuild(s),false);
});

test('publication checks the latest tail and cannot reuse a successful earlier build',()=>{
  const s=developer();input(s,{chars:100});runBuild(s);const checked=s.build.checkedRevision;
  // A save can contain completed work plus a final unchecked patch.
  s.progress=3000;s.defects=100;s.build.revision++;s.build.changed=1;
  const cash=s.cash;assert.equal(release(s),null);assert.equal(s.cash,cash);
  assert.ok(s.build.checkedRevision>checked);assert.equal(s.build.knownDefects,100);assert.equal(s.build.last.status,'test-failed');
  s.refactor=true;input(s,{chars:25});assert.equal(s.defects,0);
  const released=release(s);assert.ok(released);assert.ok(released.builds>1);
  assert.equal(s.build.count,0,'the new project has its own build history');
});

test('large automated batches aggregate small checks without an unbounded loop or history',()=>{
  const s=developer(6);s.autoEnabled=true;input(s,{chars:projectAt(6).target});
  assert.ok(s.build.count>1e6);assert.ok(Number.isFinite(s.build.count));assert.ok(s.build.history.length<=6);
  assert.equal(s.build.checkedProgress,s.progress);
  for(let i=0;i<30;i++){s.refactor=true;input(s,{chars:1});}
  assert.ok(s.build.history.length<=6);
  assert.ok(buildStep(s)<=4000);assert.ok(buildStep(developer(4))<=4000);
  assert.ok(projectAt(4).target/40>=1e7,'AAA scope must extend well beyond one million lines');
});

test('foreground and offline builds preserve the same pending tail and current report',()=>{
  const s=developer();s.items.library=1;s.autoEnabled=true;input(s,{chars:210});
  const a=deserialize(serialize(s,1000)),b=deserialize(serialize(s,1000));
  tick(a,17);applyOffline(b,18000);
  assert.deepEqual(a.build,b.build);assert.equal(needsBuild(a),needsBuild(b));
  const reloaded=deserialize(serialize(a,18000));assert.deepEqual(reloaded.build,a.build);
});

test('waiting, work, study and policy changes do not create builds or advance the revision',()=>{
  const s=developer();input(s,{chars:100});runBuild(s);const before=JSON.stringify(s.build);
  tick(s,100);input(s,{mode:'work',chars:100});s.items['book-syntax']=1;input(s,{mode:'study',chars:100});setDevelopmentPolicy(s,'structured');
  assert.equal(JSON.stringify(s.build),before);
});

test('old and malformed saves retain work without falsely certifying unchecked code',()=>{
  const s=developer();s.progress=1200;s.defects=20;delete s.build;
  const loaded=deserialize(JSON.stringify(s));assert.equal(loaded.progress,1200);assert.equal(loaded.defects,20);assert.equal(needsBuild(loaded),true);
  runBuild(loaded);assert.equal(loaded.build.knownDefects,20);
  const raw=JSON.parse(serialize(loaded));raw.build.revision=100;raw.build.checkedRevision=100;
  raw.build.last.revision=2;raw.build.history.push({status:'<script>',trigger:'manual'});
  const safe=deserialize(JSON.stringify(raw));assert.equal(needsBuild(safe),true);assert.ok(safe.build.history.every(b=>b.status!=='<script>'));
});
