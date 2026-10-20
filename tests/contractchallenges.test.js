import test from 'node:test';
import assert from 'node:assert/strict';
import {registerContractChallenges,CONTRACT_CHALLENGE_ORACLES} from '../src/contractchallenges.js';

const ir={};
for(const [name,op] of Object.entries({V:'let',S:'set',A:'put',P:'push',O:'pop',F:'for',W:'while',R:'return',add:'+',sub:'-',mul:'*',div:'/',eq:'==',ne:'!=',lt:'<',le:'<=',gt:'>',ge:'>=',and:'and',or:'or',at:'at',len:'len',filled:'filled',copy:'copy',min:'min',max:'max'}))ir[name]=(...args)=>[op,...args];
ir.C=(condition,yes,no=[])=>['if',condition,yes,no];ir.B=['break'];ir.filled=(n,value=0)=>['filled',n,value];
const definitions=[];
registerContractChallenges((subject,slug,title,concept,difficulty,minutes,parameters,result,body,cases,description,prerequisites,options)=>{
 definitions.push({subject,slug,title,concept,difficulty,minutes,parameters,result,body,cases,description,prerequisites,...options});
},ir);
const get=slug=>definitions.find(def=>def.slug===slug);

// Execute the authored reference model against independent, ordinary JS oracles.
// Production submissions are still compiled by each actual language runtime.
function model(def,args){
 const env=Object.fromEntries(def.parameters.map(([name],i)=>[name,structuredClone(args[i])]));
 let budget=2000000;
 const value=expr=>{
  if(typeof expr==='number')return expr;
  if(typeof expr==='string')return env[expr];
  const [op,left,right]=expr;
  if(op==='len')return env[left].length;
  if(op==='copy')return [...env[left]];
  if(op==='at')return env[left][value(right)];
  if(op==='filled')return Array(value(left)).fill(value(right));
  if(op==='and')return value(left)&&value(right);
  if(op==='or')return value(left)||value(right);
  const a=value(left),b=value(right);
  switch(op){
   case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return Math.trunc(a/b);
   case '==':return a===b;case '!=':return a!==b;case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;
   case 'min':return Math.min(a,b);case 'max':return Math.max(a,b);
   default:throw Error(`Unknown reference expression ${op}`);
  }
 };
 function execute(body){
  for(const [op,a,b,c,d] of body){
   assert.ok(--budget>0,`${def.slug}: model exceeded its finite test budget`);
   if(op==='let')env[a]=value(c);
   else if(op==='set')env[a]=value(b);
   else if(op==='put')env[a][value(b)]=value(c);
   else if(op==='push')env[a].push(value(b));
   else if(op==='pop')env[a].pop();
   else if(op==='return')return {kind:'return',value:value(a)};
   else if(op==='break')return {kind:'break'};
   else if(op==='if'){const result=execute(value(a)?b:c);if(result)return result;}
   else if(op==='for'){
    const finish=value(c);
    for(env[a]=value(b);env[a]<finish;env[a]++){
     const result=execute(d);if(result?.kind==='return')return result;if(result?.kind==='break')break;
    }
   }else if(op==='while'){
    while(value(a)){
     assert.ok(--budget>0,`${def.slug}: while loop exceeded its finite test budget`);
     const result=execute(b);if(result?.kind==='return')return result;if(result?.kind==='break')break;
    }
   }else throw Error(`Unknown reference statement ${op}`);
  }
 }
 const returned=execute(def.body);assert.equal(returned?.kind,'return',def.slug);return returned.value;
}

test('contract and geometry families have explicit requirements and independent answer models',()=>{
 assert.equal(definitions.length,6);
 assert.equal(new Set(definitions.map(q=>q.slug)).size,6);
 for(const def of definitions){
  assert.ok(def.cases.length>=10,def.slug);
  assert.ok(def.constraints.length,def.slug);
  assert.equal(typeof def.oracle,'function',def.slug);
  assert.equal(CONTRACT_CHALLENGE_ORACLES[def.slug],def.oracle);
  assert.equal(def.examples.length,2,def.slug);
  assert.ok(def.parameters.every(([name])=>def.parameterDescriptions[name]),def.slug);
  assert.equal(def.assessment.kind,def.subject==='design'?'state-contract':'algorithm');
  for(const example of def.examples)assert.deepEqual(def.oracle(example.args),example.expected,def.slug);
 }
});

for(const def of definitions)test(`${def.slug}: reference model meets all boundary and scale cases`,()=>{
 for(const args of def.cases)assert.deepEqual(model(def,args),def.oracle(args),`${def.slug}: ${JSON.stringify(args).slice(0,180)}`);
});

test('atomic transfer rejection restores the entire batch including earlier successful work',()=>{
 const def=get('atomic-transfer-batch');
 assert.deepEqual(model(def,[[10,0,0],[0,1,4,1,2,5]]),[0,10,0,0]);
 assert.deepEqual(model(def,[[3],[0,0,4]]),[0,3]);
 assert.deepEqual(model(def,[[3],[0,0,3]]),[1,3]);
 for(let first=0;first<=4;first++)for(let second=0;second<=4;second++)for(let amount=0;amount<=6;amount++){
  const args=[[first,second],[0,1,amount,1,0,2]];
  assert.deepEqual(model(def,args),def.oracle(args));
 }
});

test('idempotent requests preserve both successes and failures even when a payload changes',()=>{
 const def=get('idempotent-stock-requests');
 assert.deepEqual(model(def,[10,[1,4,1,9]]),[6,1,1]);
 assert.deepEqual(model(def,[10,[1,11,1,1]]),[10,0,0]);
 assert.deepEqual(model(def,[0,[0,0,0,1]]),[0,1,1]);
 for(let stock=0;stock<=5;stock++)for(let quantity=0;quantity<=7;quantity++)for(let next=0;next<=7;next++){
  const args=[stock,[4,quantity,4,next,5,next]];
  assert.deepEqual(model(def,args),def.oracle(args));
 }
});

test('versioned saves reject stale writers without changing either part of the state',()=>{
 const def=get('optimistic-versioned-save');
 assert.deepEqual(model(def,[10,3,[3,20,3,99]]),[20,4,1,0]);
 assert.deepEqual(model(def,[7,0,[0,7,0,8,1,9]]),[9,2,1,0,1]);
 assert.deepEqual(model(def,[-9,1000000,[1000000,1,1000001,2]]),[2,1000002,1,1]);
});

test('retry scheduling includes the exact deadline and never makes an extra attempt',()=>{
 const def=get('retry-deadline-policy');
 assert.deepEqual(model(def,[[0,0,1],2,8,6,3]),[1,3,6]);
 assert.deepEqual(model(def,[[0,0,1],2,8,5,3]),[0,2,2]);
 assert.deepEqual(model(def,[[1],1,4,0,0]),[0,0,-1]);
 for(let mask=0;mask<32;mask++)for(let deadline=0;deadline<12;deadline++)for(let maxAttempts=0;maxAttempts<7;maxAttempts++){
  const args=[Array.from({length:5},(_,i)=>(mask>>i)&1),1,4,deadline,maxAttempts];
  assert.deepEqual(model(def,args),def.oracle(args));
 }
});

test('histogram stack agrees with exhaustive interval areas on every short height sequence',()=>{
 const def=get('largest-histogram-rectangle');
 for(let length=0;length<=5;length++)for(let encoding=0;encoding<4**length;encoding++){
  const heights=Array.from({length},(_,i)=>Math.floor(encoding/4**i)%4);
  assert.equal(model(def,[heights]),def.oracle([heights]));
 }
});

test('rectangle union agrees with independently enumerated unit cells for small coordinates',()=>{
 const def=get('rectangle-union-area');
 function pixels(rectangles){
  const covered=new Set();
  for(let i=0;i<rectangles.length;i+=4)for(let x=rectangles[i];x<rectangles[i+2];x++)for(let y=rectangles[i+1];y<rectangles[i+3];y++)covered.add(`${x}/${y}`);
  return covered.size;
 }
 for(let seed=0;seed<160;seed++){
  const rectangles=Array.from({length:4},(_,i)=>{
   const x=(seed*7+i*3)%5,y=(seed*11+i*2)%5;
   return [x,y,Math.min(5,x+(seed+i)%4),Math.min(5,y+(seed*3+i)%4)];
  }).flat();
  const expected=pixels(rectangles);
  assert.equal(def.oracle([rectangles]),expected);
  assert.equal(model(def,[rectangles]),expected);
 }
});

test('authored fixtures keep all seven language harnesses within a compact source budget',async()=>{
 const {challengeTopics}=await import('../src/challengecatalog.js');
 for(const language of ['cpp','csharp','rust','go','python','java','lua'])for(const subject of ['design','graphics']){
  const rows=challengeTopics(language,subject).filter(q=>CONTRACT_CHALLENGE_ORACLES[q.topicId]);
  assert.equal(rows.length,subject==='design'?4:2,`${language}/${subject}`);
  for(const q of rows){
   assert.ok(q.referenceSource.length<=24000,q.id);
   for(const source of [q.referenceSource,q.starterSource])assert.ok(q.createHarness(source).source.length<=24000,`${q.id}: authored harness size budget`);
   for(const row of q.cases)assert.deepEqual(row.expected,CONTRACT_CHALLENGE_ORACLES[q.topicId](row.args),q.id);
  }
 }
});
