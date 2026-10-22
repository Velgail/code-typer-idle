import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHardFrontierChallenges,hamiltonianFloorCycleOracle,HARD_FRONTIER_CASES} from '../src/hardfrontier.js';

const ir={};
for(const [name,op] of Object.entries({V:'let',S:'set',A:'put',P:'push',O:'pop',F:'for',W:'while',R:'return',N:'comment',add:'+',sub:'-',mul:'*',div:'/',mod:'%',eq:'==',ne:'!=',lt:'<',le:'<=',gt:'>',ge:'>=',and:'and',or:'or',at:'at',len:'len',filled:'filled',max:'max'}))ir[name]=(...args)=>[op,...args];
ir.C=(condition,yes,no=[])=>['if',condition,yes,no];ir.filled=(n,value=0)=>['filled',n,value];
let definition;
registerHardFrontierChallenges((subject,slug,title,concept,difficulty,parameters,result,body,cases,description,prerequisites,options)=>{
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
   case 'max':return Math.max(a,b);case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return Math.trunc(a/b);case '%':return a%b;
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

// Independent graph traversal: fix the smallest vertex as the start and
// retain one of the two traversal directions by its first/last neighbour order.
function enumerateCycles([width,height,blocked]){
 const free=[];for(let i=0;i<blocked.length;i++)if(!blocked[i])free.push(i);
 if(free.length<4)return 0;
 const start=free[0],neighbours=new Map(free.map(cell=>[cell,[]]));
 for(const cell of free){
  const x=cell%width,y=Math.floor(cell/width);
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const next=ny*width+nx;if(!blocked[next])neighbours.get(cell).push(next);
  }
 }
 let total=0;const visited=new Set([start]);
 function visit(cell,first){
  if(visited.size===free.length){if(neighbours.get(cell).includes(start)&&first<cell)total++;return;}
  for(const next of neighbours.get(cell))if(!visited.has(next)){
   visited.add(next);visit(next,visited.size===2?next:first);visited.delete(next);
  }
 }
 visit(start,-1);return total%1009;
}
const rectangle=(width,height)=>[width,height,Array(width*height).fill(0)];

test('Hamiltonian floor contract specifies one undirected simple cycle with no traversal duplicates',()=>{
 assert.equal(definition.slug,'hamiltonian-floor-cycles');
 assert.equal(definition.oracle,hamiltonianFloorCycleOracle);
 assert.ok(definition.difficulty>=6);
 assert.equal(definition.examples.length,3);
 assert.ok(definition.parameters.every(([name])=>definition.parameterDescriptions[name]));
 assert.match(definition.description,/複数の閉路は不可/);
 assert.match(definition.description,/開始セルや進行方向が違っても同じ一つ/);
 for(const example of definition.examples){
  assert.equal(definition.oracle(example.args),example.expected);
  assert.equal(reference(example.args),example.expected);
  assert.equal(enumerateCycles(example.args),example.expected);
 }
});

test('canonical paired-label reference agrees with balanced-plug oracle on every authored floor',()=>{
 for(const args of HARD_FRONTIER_CASES)assert.equal(reference(args),hamiltonianFloorCycleOracle(args),JSON.stringify(args));
});

test('small whole-grid enumeration independently verifies all wall configurations through 3 by 3',()=>{
 for(const [width,height] of [[1,1],[1,4],[2,2],[2,3],[3,3]])for(let mask=0;mask<2**(width*height);mask++){
  const args=[width,height,Array.from({length:width*height},(_,i)=>(mask>>i)&1)];
  const expected=enumerateCycles(args);
  assert.equal(hamiltonianFloorCycleOracle(args),expected,`oracle ${width}x${height} mask${mask}`);
  assert.equal(reference(args),expected,`reference ${width}x${height} mask${mask}`);
 }
});

test('rectangles exercise frontier joins and count modulo 1009',()=>{
 for(const [width,height,expected] of [[2,2,1],[2,20,1],[3,4,2],[4,4,6],[6,6,63],[6,20,886]]){
  const args=rectangle(width,height);
  assert.equal(hamiltonianFloorCycleOracle(args),expected);
  assert.equal(reference(args),expected);
 }
 // Independent DFS can also cover a larger 4x4 floor without a transfer state.
 assert.equal(enumerateCycles(rectangle(4,4)),6);
});

test('local degree two is insufficient for two separate loops and a completed prefix cannot be accepted early',()=>{
 const separate=[5,2,[0,0,1,0,0,0,0,1,0,0]];
 assert.equal(reference(separate),0);
 const prefix=[3,5,[0,0,0,0,0,0,1,1,1,0,0,0,0,0,0]];
 assert.equal(reference(prefix),0);
 const padded=[2,4,[1,1,0,0,0,0,1,1]];
 assert.equal(reference(padded),1,'the last free cell can precede trailing wall cells');
});

test('random obstacle floors agree with graph traversal independently of transfer representation',()=>{
 let seed=19087;const next=limit=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%limit;};
 for(let sample=0;sample<240;sample++){
  const width=1+next(4),height=1+next(4),blocked=Array.from({length:width*height},()=>next(5)===0?1:0);
  const args=[width,height,blocked],expected=enumerateCycles(args);
  assert.equal(hamiltonianFloorCycleOracle(args),expected,`oracle sample ${sample}`);
  assert.equal(reference(args),expected,`reference sample ${sample}`);
 }
});
