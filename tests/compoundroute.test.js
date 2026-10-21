import test from 'node:test';
import assert from 'node:assert/strict';
import {registerCompoundRouteChallenges,consumableGateRouteOracle} from '../src/compoundroute.js';

const ir={};
for(const [name,op] of Object.entries({V:'let',S:'set',A:'put',P:'push',O:'pop',F:'for',W:'while',R:'return',N:'comment',add:'+',sub:'-',mul:'*',div:'/',mod:'%',eq:'==',ne:'!=',lt:'<',le:'<=',gt:'>',ge:'>=',and:'and',at:'at',len:'len',filled:'filled',band:'&',bor:'|',shl:'<<'}))ir[name]=(...args)=>[op,...args];
ir.C=(condition,yes,no=[])=>['if',condition,yes,no];ir.B=['break'];ir.filled=(n,value=0)=>['filled',n,value];
let definition;
registerCompoundRouteChallenges((subject,slug,title,concept,difficulty,minutes,parameters,result,body,cases,description,prerequisites,options)=>{
 definition={subject,slug,title,concept,difficulty,minutes,parameters,result,body,cases,description,prerequisites,...options};
},ir);

function reference(args){
 const env=Object.fromEntries(definition.parameters.map(([name],i)=>[name,structuredClone(args[i])]));
 let budget=16000000;
 const value=e=>{
  if(typeof e==='number')return e;
  if(typeof e==='string')return env[e];
  const [op,left,right]=e;
  if(op==='len')return env[left].length;
  if(op==='at')return env[left][value(right)];
  if(op==='filled')return Array(value(left)).fill(value(right));
  if(op==='and')return value(left)&&value(right);
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

// Independent small-input checker. It enumerates integer time explicitly and
// carries inventory values, rather than deriving stock from the history masks.
// An edge is taken only when unlock completion coincides with its phase; a
// separate one-tick wait enumerates all equivalent waits before an operation.
function timeExpanded(args,capacity=Infinity){
 const [nodes,edges,initialKeys,supplies,doors,start,goal]=args;
 const supplyCount=supplies.length/3,doorCount=doors.length/2;
 let maxStep=0;
 for(let i=0;i<edges.length;i+=6)maxStep=Math.max(maxStep,edges[i+2]+edges[i+3]-1+(edges[i+5]<0?0:doors[edges[i+5]*2+1]));
 const limit=(nodes*2**supplyCount*2**doorCount-1)*maxStep;
 const buckets=Array.from({length:limit+1},()=>[]),seen=new Set();
 const add=(time,node,taken,opened,stock)=>{
  if(time>limit)return;
  const keys=[...stock];let collected=taken;
  for(let i=0;i<supplyCount;i++)if(supplies[i*3]===node&&!(collected&(1<<i))){collected|=1<<i;const kind=supplies[i*3+1];keys[kind]=Math.min(capacity,keys[kind]+supplies[i*3+2]);}
  const key=[time,node,collected,opened,...keys].join('/');
  if(!seen.has(key)){seen.add(key);buckets[time].push({node,taken:collected,opened,stock:keys});}
 };
 add(0,start,0,0,initialKeys);
 for(let time=0;time<=limit;time++)for(let head=0;head<buckets[time].length;head++){
  const state=buckets[time][head];if(state.node===goal)return time;
  add(time+1,state.node,state.taken,state.opened,state.stock);
  for(let i=0;i<edges.length;i+=6)if(edges[i]===state.node){
   const door=edges[i+5],stock=[...state.stock];let opened=state.opened,unlock=0;
   if(door>=0&&!(opened&(1<<door))){
    const type=doors[door*2];if(stock[type]===0)continue;
    stock[type]--;opened|=1<<door;unlock=doors[door*2+1];
   }
   if((time+unlock)%edges[i+3]!==edges[i+4])continue;
   add(time+unlock+edges[i+2],edges[i+1],state.taken,opened,stock);
  }
 }
 return -1;
}

test('compound route specifies resources, shared history and operation order with executable examples',()=>{
 assert.equal(definition.slug,'consumable-gate-route');
 assert.equal(definition.oracle,consumableGateRouteOracle);
 assert.equal(definition.parameters.length,7);assert.ok(definition.cases.length>=16);
 assert.equal(definition.difficultyRationale.classification,'compound-constraints');
 assert.ok(definition.constraints.length>=6);assert.equal(definition.examples.length,2);
 for(const [name] of definition.parameters)assert.ok(definition.parameterDescriptions[name]);
 for(const ex of definition.examples)assert.equal(definition.oracle(ex.args),ex.expected);
});

test('heap reference agrees with the independent label-correcting oracle on all authored cases',()=>{
 for(const args of definition.cases)assert.equal(reference(args),definition.oracle(args),JSON.stringify(args).slice(0,220));
});

test('small authored cases also agree with explicit time and inventory enumeration',()=>{
 for(const args of definition.cases.filter(a=>a[0]<=4))assert.equal(definition.oracle(args),timeExpanded(args));
});

test('unlocking occurs before phase matching; supply and opened-door histories cannot be discarded',()=>{
 assert.equal(reference([2,[0,1,2,4,1,0],[1,0],[],[0,3],0,1]),7);
 assert.equal(reference(definition.examples[1].args),8,'one consumed key opens all edges sharing a door, including reverse traversal');
 assert.equal(reference([4,[0,1,0,1,0,-1,1,2,1,1,0,0,2,1,0,1,0,-1,2,3,1,1,0,1],[0,0],[1,0,1],[0,0,0,0],0,3]),-1,'a return to the supply cannot create a second key');
 assert.equal(reference([4,[0,1,1,1,0,-1,0,2,3,1,0,-1,2,1,1,1,0,-1,1,3,1,1,0,0],[0,0],[2,0,1],[0,0],0,3]),5,'a node can be revisited with useful new history');
});

test('the initial key bound is not a carrying capacity after collecting supplies',()=>{
 const args=[5,[0,1,1,1,0,0,1,2,1,1,0,1,2,3,1,1,0,2,3,4,1,1,0,3],[2,0],[0,0,2],[0,0,0,0,0,0,0,0],0,4];
 assert.ok(definition.cases.some(c=>JSON.stringify(c)===JSON.stringify(args)),'the carrying-capacity counterexample is included in production grading');
 assert.equal(definition.oracle(args),4);assert.equal(reference(args),4);assert.equal(timeExpanded(args),4);
 assert.equal(timeExpanded(args,2),-1,'an incorrect capacity of two discards keys required for the third and fourth doors');
});

test('tiny independently generated graphs match time-expanded search, including zero-time loops',()=>{
 let seed=6911;const next=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let sample=0;sample<64;sample++){
  const nodes=2+next(3),initial=[next(2),next(2)],supplies=[],doors=[],edges=[];
  for(let i=0,count=next(3);i<count;i++)supplies.push(next(nodes),next(2),1+next(2));
  for(let i=0,count=next(3);i<count;i++)doors.push(next(2),next(3));
  for(let i=0,count=next(8);i<count;i++){
   const period=1+next(3);
   edges.push(next(nodes),next(nodes),next(4),period,next(period),next(doors.length/2+1)-1);
  }
  const args=[nodes,edges,initial,supplies,doors,next(nodes),next(nodes)],expected=timeExpanded(args);
  assert.equal(definition.oracle(args),expected,`oracle on random sample ${sample}`);
  assert.equal(reference(args),expected,`reference on random sample ${sample}`);
 }
});
