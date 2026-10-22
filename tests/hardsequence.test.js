import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHardSequenceChallenges,coordinateSkillSequenceOracle,HARD_SEQUENCE_CASES} from '../src/hardsequence.js';

const ir={};
for(const [name,op] of Object.entries({V:'let',S:'set',A:'put',P:'push',O:'pop',F:'for',W:'while',R:'return',N:'comment',add:'+',sub:'-',mul:'*',div:'/',mod:'%',eq:'==',ne:'!=',lt:'<',le:'<=',gt:'>',ge:'>=',and:'and',or:'or',at:'at',len:'len',filled:'filled'}))ir[name]=(...args)=>[op,...args];
ir.C=(condition,yes,no=[])=>['if',condition,yes,no];ir.filled=(n,value=0)=>['filled',n,value];
let definition;
registerHardSequenceChallenges((subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,options)=>{
 definition={subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,...options};
},ir);

function reference(args){
 const env=Object.fromEntries(definition.parameters.map(([name],i)=>[name,structuredClone(args[i])]));
 let budget=80000000;
 const value=e=>{
  if(typeof e==='number')return e;
  if(typeof e==='string')return env[e];
  const [op,left,right]=e;
  if(op==='len')return env[left].length;
  if(op==='at')return env[left][value(right)];
  if(op==='filled')return Array(value(left)).fill(value(right));
  if(op==='and')return value(left)&&value(right);
  if(op==='or')return value(left)||value(right);
  const a=value(left),b=value(right);
  switch(op){
   case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return Math.trunc(a/b);case '%':return a%b;
   case '==':return a===b;case '!=':return a!==b;case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;
   default:throw Error(`Unexpected expression ${op}`);
  }
 };
 function execute(body){
  for(const [op,a,b,c,d] of body){
   assert.ok(--budget>0,'reference exceeds finite operation budget');
   if(op==='comment')continue;
   if(op==='let')env[a]=value(c);
   else if(op==='set')env[a]=value(b);
   else if(op==='put')env[a][value(b)]=value(c);
   else if(op==='push')env[a].push(value(b));
   else if(op==='pop')env[a].pop();
   else if(op==='return')return {kind:'return',value:value(a)};
   else if(op==='if'){const result=execute(value(a)?b:c);if(result)return result;}
   else if(op==='for'){
    const end=value(c);
    for(env[a]=value(b);env[a]<end;env[a]++){
     const result=execute(d);if(result)return result;
    }
   }else if(op==='while'){
    while(value(a)){
     assert.ok(--budget>0,'reference loop exceeds finite operation budget');
     const result=execute(b);if(result)return result;
    }
   }else throw Error(`Unexpected statement ${op}`);
  }
 }
 const result=execute(definition.body);assert.equal(result?.kind,'return');return result.value;
}

test('coordinate skill contract defines sequence direction, conjugation and replacement semantics',()=>{
 assert.equal(definition.slug,'coordinate-skill-sequence');
 assert.equal(definition.oracle,coordinateSkillSequenceOracle);
 assert.equal(definition.subject,'design');
 assert.equal(definition.difficulty,4,'valid direct per-element solutions keep this candidate in the advanced tier');
 assert.ok(definition.constraints.length>=5);
 assert.equal(definition.examples.length,3);
 assert.ok(definition.parameters.every(([name])=>definition.parameterDescriptions[name]));
 assert.match(definition.description,/逆順は逆関数の適用ではない/);
 for(const example of definition.examples){
  assert.deepEqual(definition.oracle(example.args),example.expected);
  assert.deepEqual(reference(example.args),example.expected);
 }
});

test('explicit-stack lazy reference agrees with per-element substitution on all authored cases',()=>{
 for(const args of HARD_SEQUENCE_CASES)assert.deepEqual(reference(args),coordinateSkillSequenceOracle(args),`n=${args[0].length/2}, q=${args[1].length/5}`);
});

test('time-ordered coordinate changes compose in the declared order',()=>{
 const args=[[2,1,3,4],[1,0,2,1,7,1,0,2,-1,11,2,0,2,5,0,3,0,2,5,0]];
 assert.deepEqual(reference(args),[3,1]);
 // Swapping the two transformations changes the resulting coordinate system.
 const swapped=[[2,1,3,4],[1,0,2,-1,11,1,0,2,1,7,2,0,2,5,0,3,0,2,5,0]];
 assert.notDeepEqual(reference(args),reference(swapped));
});

test('new point replacements do not inherit earlier lazy coordinate changes',()=>{
 const args=[[2,1,3,4],[1,0,2,1,7,0,1,0,1,0,2,0,2,5,0,3,0,2,5,0]];
 assert.deepEqual(reference(args),[4,4]);
});

test('zero coefficients need no inverse and empty intervals preserve the query input',()=>{
 const args=[[0,7,1,5],[1,0,2,-1,10,2,0,2,9,0,3,0,2,9,0,2,1,1,1008,0,3,0,0,17,0]];
 assert.deepEqual(reference(args),[1007,3,1008,17]);
});

test('independent random operations preserve both sequence directions after overlapping changes',()=>{
 let seed=7049;const next=limit=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%limit;};
 for(let sample=0;sample<160;sample++){
  const count=1+next(13),initial=Array.from({length:count*2},()=>next(1009)),operations=[];
  for(let i=0;i<40;i++){
   const kind=next(4);
   if(kind===0){operations.push(0,next(count),0,next(1009),next(1009));continue;}
   let left=next(count+1),right=next(count+1);if(left>right)[left,right]=[right,left];
   operations.push(kind,left,right,kind===1?(next(2)?1:-1):next(1009),kind===1?next(1009):0);
  }
  const args=[initial,operations];
  assert.deepEqual(reference(args),coordinateSkillSequenceOracle(args),`sample ${sample}`);
 }
});

test('combined output remains below the production worker stdout limit with comfortable headroom',()=>{
 const bytes=Buffer.byteLength(HARD_SEQUENCE_CASES.map(args=>JSON.stringify(coordinateSkillSequenceOracle(args))+'\n').join(''));
 assert.ok(bytes<32768,`${bytes} output bytes`);
});
