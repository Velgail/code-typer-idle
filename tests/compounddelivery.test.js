import test from 'node:test';
import assert from 'node:assert/strict';
import {registerCompoundDeliveryChallenges,compoundDeliveryOracle,COMPOUND_DELIVERY_CASES} from '../src/compounddelivery.js';

const ir={};
for(const [name,op] of Object.entries({V:'let',S:'set',A:'put',F:'for',R:'return',N:'comment',add:'+',sub:'-',mul:'*',div:'/',mod:'%',eq:'==',lt:'<',le:'<=',ge:'>=',and:'and',or:'or',at:'at',len:'len',filled:'filled',min:'min',max:'max'}))ir[name]=(...args)=>[op,...args];
ir.C=(condition,yes,no=[])=>['if',condition,yes,no];ir.filled=(n,value=0)=>['filled',n,value];
const definitions=[];
registerCompoundDeliveryChallenges((subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,options)=>{
 definitions.push({subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,...options});
},ir);
const def=definitions[0];

// Evaluate the authored IR, not player submissions, against independent answers.
function reference(args,{keepFirst=false}={}){
 const env=Object.fromEntries(def.parameters.map(([name],i)=>[name,structuredClone(args[i])]));
 let budget=20000000;
 const value=expr=>{
  if(typeof expr==='number')return expr;
  if(typeof expr==='string')return env[expr];
  const [op,a,b]=expr;
  if(op==='len')return env[a].length;
  if(op==='at')return env[a][value(b)];
  if(op==='filled')return Array(value(a)).fill(value(b));
  if(op==='and')return value(a)&&value(b);
  if(op==='or')return value(a)||value(b);
  const left=value(a),right=value(b);
  switch(op){
   case '+':return left+right;case '-':return left-right;case '*':return left*right;case '/':return Math.trunc(left/right);case '%':return left%right;
   case '==':return left===right;case '<':return left<right;case '<=':return left<=right;case '>=':return left>=right;
   case 'min':return Math.min(left,right);case 'max':return Math.max(left,right);
   default:throw Error(`Unknown reference expression ${op}`);
  }
 };
 function execute(body){
  for(const [op,a,b,c,d] of body){
   assert.ok(--budget>0,'compound reference exceeded its finite test budget');
   if(op==='comment')continue;
   if(op==='let')env[a]=value(c);
   else if(op==='set')env[a]=value(b);
   else if(op==='put'){
    if(keepFirst&&a==='best'&&env[a][value(b)]!==1000000000)continue;
    env[a][value(b)]=value(c);
   }
   else if(op==='return')return {value:value(a)};
   else if(op==='if'){const answer=execute(value(a)?b:c);if(answer)return answer;}
   else if(op==='for'){
    const end=value(c);
    for(env[a]=value(b);env[a]<end;env[a]++){const answer=execute(d);if(answer)return answer;}
   }else throw Error(`Unknown reference statement ${op}`);
  }
 }
 const answer=execute(def.body);assert.ok(answer);return answer.value;
}

// Enumerate every legal next visit without memoization or compressed states.
function brute(args,{ignoreCapacity=false,ignorePrecedence=false,ignoreService=false,noWait=false,finishDeadline=false,omitReturn=false}={}){
 const [weights,capacity,travel,appointments]=args,n=weights.length,points=2*n+1;
 if(!n)return 0;
 let answer=Infinity;
 const visit=(seen,last,time,load)=>{
  if(seen===(1<<(2*n))-1){answer=Math.min(answer,time+(omitReturn?0:travel[last*points]));return;}
  for(let next=1;next<points;next++){
   const bit=1<<(next-1);if(seen&bit)continue;
   const item=(next-1)%n,isPickup=next<=n;
   if(!isPickup&&!ignorePrecedence&&!(seen&(1<<item)))continue;
   const nextLoad=load+(isPickup?weights[item]:-weights[item]);
   if(!ignoreCapacity&&nextLoad>capacity)continue;
   const offset=(next-1)*3,arrival=time+travel[last*points+next];
   if(noWait&&arrival<appointments[offset])continue;
   const start=Math.max(arrival,appointments[offset]),end=start+(ignoreService?0:appointments[offset+2]);
   if((finishDeadline?end:start)>appointments[offset+1])continue;
   visit(seen|bit,next,end,nextLoad);
  }
 };
 visit(0,0,0,0);return Number.isFinite(answer)?answer:-1;
}

test('compound delivery exposes the combined contract without prescribing its solution',()=>{
 assert.equal(definitions.length,1);assert.equal(def.slug,'windowed-pickup-delivery');
 assert.equal(def.subject,'systems');assert.equal(def.oracle,compoundDeliveryOracle);
 assert.ok(def.cases.length>=16);assert.equal(def.examples.length,2);
 assert.ok(def.parameters.every(([name])=>def.parameterDescriptions[name]));
 assert.equal(def.assessment.kind,'algorithm');assert.ok(def.assessment.criteria.length>=3);
 assert.equal(def.difficultyRationale.requiredSkills.length,4);
 assert.match(def.difficultyRationale.timeBasis,/直接観測/);
 assert.doesNotMatch(def.description,/三進|DP|動的計画|ビットマスク/);
 for(const example of def.examples)assert.equal(def.oracle(example.args),example.expected);
});

test('all boundary and scale fixtures agree between forwards ternary IR and backwards mask oracle',()=>{
 for(const args of COMPOUND_DELIVERY_CASES)assert.equal(reference(args),compoundDeliveryOracle(args),JSON.stringify(args).slice(0,160));
 const full=COMPOUND_DELIVERY_CASES.find(args=>args[0].length===6);
 assert.ok(full);assert.equal(full[2].length,169);assert.equal(full[3].length,36);
});

test('time windows apply to work starts, allow waiting, and include all work and final travel',()=>{
 const waited=COMPOUND_DELIVERY_CASES[2];
 assert.equal(reference(waited),12);
 assert.equal(brute(waited),12);
 assert.equal(brute(waited,{noWait:true}),-1);
 assert.equal(brute(waited,{finishDeadline:true}),-1);
 const first=COMPOUND_DELIVERY_CASES[1];assert.equal(reference(first),13);
 assert.notEqual(brute(first,{ignoreService:true}),13);
 assert.notEqual(brute(first,{omitReturn:true}),13);
});

test('capacity and pickup precedence jointly change feasibility and valid visit order',()=>{
 assert.equal(reference(COMPOUND_DELIVERY_CASES[3]),-1);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[5]),12);
 assert.notEqual(brute(COMPOUND_DELIVERY_CASES[5],{ignorePrecedence:true}),12);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[8]),5);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[9]),-1);
 assert.equal(brute(COMPOUND_DELIVERY_CASES[9],{ignoreCapacity:true}),5);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[7]),5);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[10]),8);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[13]),5);
});

test('direct travel cannot be replaced by shortest paths through extra intermediate visits',()=>{
 const args=COMPOUND_DELIVERY_CASES[6],changed=structuredClone(args),points=args[0].length*2+1;
 for(let k=0;k<points;k++)for(let i=0;i<points;i++)for(let j=0;j<points;j++)changed[2][i*points+j]=Math.min(changed[2][i*points+j],changed[2][i*points+k]+changed[2][k*points+j]);
 const expected=brute(args);
 assert.equal(reference(args),expected);assert.equal(compoundDeliveryOracle(args),expected);
 assert.notEqual(brute(changed),expected);
});

test('waiting changes the optimum even when another legal route has shorter travel distance',()=>{
 const args=COMPOUND_DELIVERY_CASES[19],[,,travel,appointments]=args;
 const simulate=route=>{
  let last=0,time=0,distance=0;
  for(const point of route){const cost=travel[last*5+point];distance+=cost;time=Math.max(time+cost,appointments[(point-1)*3])+appointments[(point-1)*3+2];last=point;}
  return {distance:distance+travel[last*5],end:time+travel[last*5]};
 };
 assert.deepEqual(simulate([1,2,3,4]),{distance:5,end:53});
 assert.deepEqual(simulate([1,3,2,4]),{distance:6,end:52});
 assert.equal(reference(args),52);assert.equal(compoundDeliveryOracle(args),52);assert.equal(brute(args),52);
});

test('a state must retain its earliest finish instead of the first discovered route',()=>{
 const args=COMPOUND_DELIVERY_CASES[14];
 assert.equal(reference(args),44);
 assert.notEqual(reference(args,{keepFirst:true}),44);
});

test('zero jobs, zero travel, exact service boundaries and all six cargo digits are exercised',()=>{
 assert.equal(reference(COMPOUND_DELIVERY_CASES[0]),0);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[11]),0);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[12]),40);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[15]),25);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[16]),-1);
 assert.equal(reference(COMPOUND_DELIVERY_CASES[17]),-1);
});

test('compressed states match every ordering on independent deterministic small instances',()=>{
 let seed=90421;
 const next=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
 for(let sample=0;sample<180;sample++){
  const n=sample%4,points=2*n+1,weights=Array.from({length:n},()=>1+next(4)),capacity=next(8);
  const travel=Array.from({length:points*points},(_,i)=>Math.floor(i/points)===i%points?0:next(6));
  const appointments=Array.from({length:2*n},()=>{const opens=next(12);return [opens,opens+next(15),next(4)];}).flat();
  const args=[weights,capacity,travel,appointments],expected=brute(args);
  assert.equal(compoundDeliveryOracle(args),expected,`oracle sample ${sample}`);
  assert.equal(reference(args),expected,`reference sample ${sample}`);
 }
});
