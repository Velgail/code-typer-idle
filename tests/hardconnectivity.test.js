import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHardConnectivityChallenges,dynamicParityComponentCostOracle} from '../src/hardconnectivity.js';

const ir={};
for(const [name,op] of Object.entries({V:'let',S:'set',A:'put',P:'push',O:'pop',F:'for',W:'while',R:'return',N:'comment',add:'+',sub:'-',mul:'*',div:'/',mod:'%',eq:'==',ne:'!=',lt:'<',le:'<=',gt:'>',ge:'>=',and:'and',at:'at',len:'len',filled:'filled',band:'&',bor:'|',shl:'<<',min:'min'}))ir[name]=(...args)=>[op,...args];
ir.C=(condition,yes,no=[])=>['if',condition,yes,no];ir.B=['break'];ir.filled=(n,value=0)=>['filled',n,value];
let definition;
registerHardConnectivityChallenges((subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,options)=>{
 definition={subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,...options};
},ir);

function reference(args){
 const env=Object.fromEntries(definition.parameters.map(([name],i)=>[name,structuredClone(args[i])]));
 let budget=100000000;
 const value=e=>{
  if(typeof e==='number')return e;
  if(typeof e==='string')return env[e];
  const [op,left,right]=e;
  if(op==='len')return env[left].length;
  if(op==='at')return env[left][value(right)];
  if(op==='filled')return Array(value(left)).fill(value(right));
  if(op==='and')return value(left)&&value(right);
  if(op==='min')return Math.min(value(left),value(right));
  const a=value(left),b=value(right);
  switch(op){
   case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return Math.trunc(a/b);case '%':return a%b;
   case '&':return a&b;case '|':return a|b;case '<<':return a<<b;
   case '==':return a===b;case '!=':return a!==b;case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;
   default:throw Error(`Unexpected expression ${op}`);
  }
 };
 function execute(body){
  for(const [op,a,b,c,d] of body){
   assert.ok(--budget>0,'reference exceeds its finite test budget');
   if(op==='comment')continue;
   if(op==='let')env[a]=value(c);
   else if(op==='set')env[a]=value(b);
   else if(op==='put')env[a][value(b)]=value(c);
   else if(op==='push')env[a].push(value(b));
   else if(op==='pop')env[a].pop();
   else if(op==='return')return {kind:'return',value:value(a)};
   else if(op==='break')return {kind:'break'};
   else if(op==='if'){const result=execute(value(a)?b:c);if(result)return result;}
   else if(op==='for'){
    const end=value(c);
    for(env[a]=value(b);env[a]<end;env[a]++){
     const result=execute(d);if(result?.kind==='return')return result;if(result?.kind==='break')break;
    }
   }else if(op==='while'){
    while(value(a)){
     assert.ok(--budget>0,'reference while exceeds its finite test budget');
     const result=execute(b);if(result?.kind==='return')return result;if(result?.kind==='break')break;
    }
   }else throw Error(`Unexpected statement ${op}`);
  }
 }
 const result=execute(definition.body);assert.equal(result?.kind,'return');return result.value;
}

// Independent tiny-input checker: enumerate all complete colorings instead of
// propagating parity values or maintaining any disjoint-set structure.
function bruteForce(args){
 const [weights,edges,operations]=args,n=weights.length,active=Array(edges.length/3).fill(false),out=[];
 for(let i=0;i<operations.length;i+=2){
  const kind=operations[i],x=operations[i+1];
  if(kind<2){active[x]=kind===0;continue;}
  const members=new Set([x]);let changed=true;
  while(changed){
   changed=false;
   for(let id=0;id<active.length;id++)if(active[id]){
    const u=edges[id*3],v=edges[id*3+1];
    if(members.has(u)&&!members.has(v)){members.add(v);changed=true;}
    if(members.has(v)&&!members.has(u)){members.add(u);changed=true;}
   }
  }
  let best=Infinity;
  for(let colors=0;colors<2**n;colors++){
   let valid=true,cost=0;
   for(let id=0;id<active.length;id++)if(active[id]&&members.has(edges[id*3])){
    const u=edges[id*3],v=edges[id*3+1];
    if(((colors>>u&1)^(colors>>v&1))!==edges[id*3+2])valid=false;
   }
   if(valid){for(const v of members)if(colors>>v&1)cost+=weights[v];best=Math.min(best,cost);}
  }
  out.push(Number.isFinite(best)?best:-1);
 }
 return out;
}

test('dynamic parity contract specifies local contradictions, independent edge IDs and costs',()=>{
 assert.equal(definition.slug,'dynamic-parity-component-cost');
 assert.equal(definition.oracle,dynamicParityComponentCostOracle);
 assert.equal(definition.result,'array');assert.equal(definition.parameters.length,3);
 assert.ok(definition.constraints.length>=6);assert.equal(definition.examples.length,2);
 assert.equal(definition.difficultyRationale.classification,'reversible-invariant-composition');
 for(const [name] of definition.parameters)assert.ok(definition.parameterDescriptions[name]);
 for(const example of definition.examples){
  assert.deepEqual(definition.oracle(example.args),example.expected);
  assert.deepEqual(bruteForce(example.args),example.expected);
 }
});

test('rollback reference agrees with BFS oracle across every boundary and scale fixture',()=>{
 let outputCharacters=0;
 for(const args of definition.cases){
  const snapshot=JSON.stringify(args),expected=definition.oracle(args);
  assert.deepEqual(reference(args),expected,snapshot.slice(0,220));
  assert.equal(JSON.stringify(args),snapshot,'neither solver mutates the provided input');
  outputCharacters+=JSON.stringify(expected).length+1;
 }
 assert.ok(outputCharacters<65536,`all production case outputs fit the runner stdout budget: ${outputCharacters}`);
});

test('all small fixtures agree with exhaustive color assignments',()=>{
 for(const args of definition.cases.filter(a=>a[0].length<=7)){
  assert.deepEqual(definition.oracle(args),bruteForce(args));
 }
});

test('parallel edges remain independent and deleting a contradiction restores the component',()=>{
 const args=[[10,3],[0,1,1,0,1,1,0,1,0],[0,0,0,1,2,0,1,0,2,0,0,2,2,1,1,1,2,0,1,2,2,0]];
 assert.deepEqual(reference(args),[3,3,-1,0,0]);
 assert.deepEqual(bruteForce(args),[3,3,-1,0,0]);
});

test('component costs account for root-relative color and contradictions stay local',()=>{
 const args=[[100,1,50,2,9],[0,1,1,2,3,1,1,2,0,4,4,1],[0,0,0,1,0,2,0,3,2,0,2,4,1,2,2,0,2,2,1,3,2,4]];
 assert.deepEqual(reference(args),[51,-1,1,2,0]);
 assert.deepEqual(bruteForce(args),[51,-1,1,2,0]);
});

test('nested activation intervals and reactivation agree with independent enumeration',()=>{
 let seed=650033;const next=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let sample=0;sample<160;sample++){
  const n=1+next(7),weights=Array.from({length:n},()=>next(21)),edgeCount=next(10),edges=[],operations=[],active=Array(edgeCount).fill(false);
  for(let id=0;id<edgeCount;id++)edges.push(next(n),next(n),next(2));
  for(let i=0;i<30;i++){
   if(edgeCount&&next(3)!==0){const id=next(edgeCount);operations.push(active[id]?1:0,id);active[id]=!active[id];}
   else operations.push(2,next(n));
  }
  const args=[weights,edges,operations],expected=bruteForce(args);
  assert.deepEqual(definition.oracle(args),expected,`BFS oracle sample ${sample}`);
  assert.deepEqual(reference(args),expected,`rollback reference sample ${sample}`);
 }
});
