import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeCatalog,challengeById} from '../src/challengecatalog.js';
import {registerContestChallenges} from '../src/contestchallenges.js';
const subjects={
 'binary-search-minimum-capacity':'syntax','weighted-interval-planning':'syntax',
 'traveling-courier':'systems','key-door-shortest-path':'systems',
 'interval-merge-cost':'design','dynamic-range-sums':'design'
};
const question=(slug,language='cpp')=>challengeById(`challenge/v1/${language}/${subjects[slug]}/${slug}`);
const result=(slug,args)=>{
 const fixture=question(slug).cases.find(row=>JSON.stringify(row.args)===JSON.stringify(args));
 assert.ok(fixture,`${slug}: missing fixture ${JSON.stringify(args)}`);return fixture.expected;
};

test('contest algorithms share authored contracts and cases across seven languages without disturbing published indexes',()=>{
 for(const slug of Object.keys(subjects)){
  const rows=challengeCatalog().filter(q=>q.topicId===slug);assert.equal(rows.length,7);
  assert.equal(new Set(rows.map(q=>q.familyId)).size,1);
  for(const q of rows){
   assert.ok(q.index>=32);assert.deepEqual(q.cases,rows[0].cases);
   assert.equal(q.assessment.kind,'algorithm');assert.ok(q.assessment.criteria.length);assert.ok(q.assessment.limitations.length);
   assert.ok(q.scaleNotes.length);assert.ok(q.constraints.length>=3);assert.ok(q.examples.length);
   for(const example of q.examples){assert.equal(example.args.length,q.parameters.length);assert.ok(Object.hasOwn(example,'expected'));}
   for(const source of[q.referenceSource,q.starterSource]){
    assert.ok(source.length<24000,'submitted reference and starter fit the real answer limit');
    assert.ok(q.createHarness(source).source.length<24000,'authored fixtures stay compact; this is an authoring budget, not a runner limit');
   }
  }
 }
 assert.equal(question('traveling-courier').difficulty,3,'a standard subset-state tour does not acquire a hard label from its algorithm name');
 assert.equal(question('key-door-shortest-path').difficulty,3,'permanent-key BFS remains a standard state-expansion problem');
 assert.equal(question('dynamic-range-sums').difficulty,2,'small range-query fixtures permit direct array updates and scans');
 assert.equal(question('dynamic-range-sums').estimatedMinutes,6);
 assert.match(question('dynamic-range-sums').concept,/参考実装/);
});

test('standard families have reviewed difficulty and reward pacing without an advanced-label premium',()=>{
 const profiles={
  'binary-search-minimum-capacity':[3,10],'weighted-interval-planning':[3,12],
  'traveling-courier':[3,12],'key-door-shortest-path':[3,12],
  'interval-merge-cost':[3,12],'dynamic-range-sums':[2,6]
 };
 for(const [slug,[difficulty,minutes]] of Object.entries(profiles))for(const language of ['cpp','csharp','rust','go','python','java','lua']){
  const q=question(slug,language);
  assert.equal(q.difficulty,difficulty,q.id);
  assert.equal(q.estimatedMinutes,minutes,q.id);
 }
});

test('each standard algorithm records the required reasoning and actual role of its constraints',()=>{
 const authored=[];
 const ir=new Proxy({B:['break']},{get:(target,name)=>name in target?target[name]:(...args)=>[name,...args]});
 registerContestChallenges((...args)=>authored.push({slug:args[1],description:args[10],rationale:args[12].difficultyRationale}),ir);
 assert.equal(authored.length,6);
 for(const {slug,description,rationale} of authored){
  assert.equal(rationale.classification,slug==='dynamic-range-sums'?'direct-implementation':'standard-pattern',slug);
  assert.ok(rationale.requiredSkills.length>=2,slug);
  assert.ok(rationale.reasoning.length>=2,slug);
  assert.ok(rationale.constraintRole.length>20,slug);
  assert.match(rationale.timeBasis,/暫定の報酬基準/,slug);
  assert.match(rationale.timeBasis,/実測.*換算ではない/,slug);
  assert.ok(!description.includes(rationale.constraintRole),'developer rationale is separate from the public statement');
 }
});

test('capacity planning cases reject average-only, heaviest-only and reordering shortcuts',()=>{
 assert.equal(result('binary-search-minimum-capacity',[[],1]),0);
 assert.equal(result('binary-search-minimum-capacity',[[1,2,3,4,5],2]),9);
 assert.equal(result('binary-search-minimum-capacity',[[1,100,1,100],3]),101);
 assert.equal(result('binary-search-minimum-capacity',[[5,5,5],1]),15);
 assert.equal(result('binary-search-minimum-capacity',[[5,5,5],8]),5);
 assert.equal(question('binary-search-minimum-capacity').cases.at(-1).args[0].length,1536);
});

function bruteSchedule(jobs){
 const count=jobs.length/3;let answer=0;
 for(let chosen=0;chosen<2**count;chosen++){
  let reward=0,valid=true;
  for(let i=0;i<count;i++)if(chosen&(1<<i)){
   reward+=jobs[i*3+2];
   for(let j=i+1;j<count;j++)if((chosen&(1<<j))&&jobs[i*3]<jobs[j*3+1]&&jobs[j*3]<jobs[i*3+1])valid=false;
  }
  if(valid)answer=Math.max(answer,reward);
 }
 return answer;
}
test('small weighted schedules match exhaustive subsets, including duplicate jobs and touching endpoints',()=>{
 for(const c of question('weighted-interval-planning').cases.filter(c=>c.args[0].length<=24))assert.equal(c.expected,bruteSchedule(c.args[0]));
 assert.equal(result('weighted-interval-planning',[[0,3,10,0,1,6,1,3,7]]),13);
 assert.equal(result('weighted-interval-planning',[[0,1,5,0,1,5,1,2,2]]),7);
});

function bruteCourier(cities,costs){
 if(cities<2)return 0;let best=Infinity;
 const visit=(last,mask,cost)=>{
  if(mask===(1<<cities)-1){best=Math.min(best,cost+costs[last*cities]);return;}
  for(let next=1;next<cities;next++)if(!(mask&(1<<next)))visit(next,mask|(1<<next),cost+costs[last*cities+next]);
 };
 visit(0,1,0);return best;
}
test('courier oracle agrees with exhaustive permutations on small graphs and includes a larger state space',()=>{
 for(const c of question('traveling-courier').cases.filter(c=>c.args[0]<=7))assert.equal(c.expected,bruteCourier(...c.args));
 assert.equal(question('traveling-courier').cases.at(-1).args[0],13);
 assert.equal(result('traveling-courier',[3,[0,1,9,8,0,2,3,7,0]]),6);
});

test('key paths require revisiting cells, all four key bits, and keys on the initial cell',()=>{
 assert.equal(result('key-door-shortest-path',[[0,20,0],3,1,0,2]),-1);
 assert.equal(result('key-door-shortest-path',[[0,0,20,0,0,1,0,1,1,1,10,0,1,1,1],5,3,0,4]),10);
 assert.equal(result('key-door-shortest-path',[[0,10,20,11,21,12,22,13,23,0],10,1,0,9]),9);
 assert.equal(result('key-door-shortest-path',[[0,23,0],3,1,0,2]),-1);
 assert.equal(result('key-door-shortest-path',[[13,23,0],3,1,0,2]),2);
 assert.equal(question('key-door-shortest-path').cases.at(-1).expected,70);
});

function bruteMerge(values){
 if(values.length<2)return 0;let best=Infinity;
 for(let i=0;i<values.length-1;i++){
  const combined=values[i]+values[i+1],next=[...values.slice(0,i),combined,...values.slice(i+2)];
  best=Math.min(best,combined+bruteMerge(next));
 }
 return best;
}
test('small merge costs match every adjacent merge order rather than a greedy smallest-pair rule',()=>{
 for(const c of question('interval-merge-cost').cases.filter(c=>c.args[0].length<=7))assert.equal(c.expected,bruteMerge(c.args[0]));
 assert.equal(result('interval-merge-cost',[[40,30,30,50]]),300);
 assert.equal(result('interval-merge-cost',[[1,100,1,1]]),206);
 assert.equal(question('interval-merge-cost').cases.at(-1).args[0].length,60);
});

test('dynamic sums distinguish replacement, addition, empty intervals and repeated writes',()=>{
 assert.deepEqual(result('dynamic-range-sums',[[1,2,3,4],[1,1,3,0,2,-3,1,0,4,1,2,2,0,2,-3,1,0,3]]),[5,4,0,0]);
 assert.deepEqual(result('dynamic-range-sums',[[],[1,0,0]]),[0]);
 assert.deepEqual(result('dynamic-range-sums',[[0],[0,0,0,0,0,0,1,0,1]]),[0]);
 const scale=question('dynamic-range-sums').cases.at(-1);assert.equal(scale.args[1].length/3,512);assert.equal(scale.expected.length,256);
});
