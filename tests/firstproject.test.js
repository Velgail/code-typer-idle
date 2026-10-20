import test from 'node:test';
import assert from 'node:assert/strict';
import {FIRST_PROJECT_PARTS,FIRST_PROJECT_LANGUAGES,firstProjectQuizAt,firstProjectQuizById,firstProjectQuizCatalog} from '../src/firstproject.js';

const catalog=firstProjectQuizCatalog();
const findCase=(quiz,args)=>quiz.cases.find(c=>c.args.length===args.length&&c.args.every((v,i)=>v===args[i]));

test('the first game has three actual components with independent progress endpoints',()=>{
 assert.deepEqual(FIRST_PROJECT_PARTS.map(p=>({id:p.id,index:p.index,end:p.end})),[
  {id:'accept-guess',index:0,end:1000},{id:'compare-guess',index:1,end:2000},{id:'round-status',index:2,end:3000}
 ]);
 assert.equal(catalog.length,24);assert.equal(new Set(catalog.map(q=>q.id)).size,24);
 for(const language of FIRST_PROJECT_LANGUAGES)for(const part of FIRST_PROJECT_PARTS){
  const q=firstProjectQuizAt(language,part.index);
  assert.equal(q.id,`first-build/v1/${language}/${part.id}`);assert.equal(firstProjectQuizById(q.id),q);
  assert.equal(q.index,part.index);assert.equal(q.firstProjectPart,part.index);assert.equal(q.firstProjectPartId,part.id);
  assert.equal(q.subject,'syntax');assert.equal(q.language,language);assert.equal(q.lessonBaseId,null);
  assert.equal(q.rewardSource,q.referenceSource);assert.equal(q.supported,true);assert.deepEqual(q.limitations,[]);
  assert.match(part.description,/[\u3040-\u9fff]/);assert.match(q.description,/[\u3040-\u9fff]/);
 }
});

test('all languages use the same cases and no constant result can complete a component',()=>{
 for(const part of FIRST_PROJECT_PARTS){
  const expected=firstProjectQuizAt('cpp',part.index).cases.map(c=>({args:c.args,expected:c.expected}));
  for(const language of FIRST_PROJECT_LANGUAGES){
   const q=firstProjectQuizAt(language,part.index);
   assert.ok(q.cases.length>=16);assert.equal(new Set(q.cases.map(c=>c.id)).size,q.cases.length);
   assert.deepEqual(q.cases.map(c=>({args:c.args,expected:c.expected})),expected);
   assert.ok(new Set(q.cases.map(c=>c.expected)).size>=2);
   for(const c of q.cases){
    assert.equal(c.args.length,q.parameters.length);assert.ok(Number.isSafeInteger(c.expected));
    assert.ok(c.args.every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647));
   }
   for(const p of q.parameters){assert.equal(p.type,'int');assert.match(p.description,/[\u3040-\u9fff]/);}
  }
 }
});

test('accept_guess includes both endpoints, singleton and reversed ranges',()=>{
 const q=firstProjectQuizAt('cpp',0);
 for(const [args,result] of [
  [[-1,0,10],0],[[0,0,10],1],[[10,0,10],1],[[11,0,10],0],
  [[0,0,0],1],[[-1,0,0],0],[[1,0,0],0],[[5,10,0],0],
  [[-10,-10,-1],1],[[-1,-10,-1],1],[[-11,-10,-1],0],[[0,-10,-1],0]
 ])assert.equal(findCase(q,args)?.expected,result,JSON.stringify(args));
 assert.match(q.description,/両端を含む/);assert.match(q.description,/highより大きい/);
});

test('compare_guess returns direction rather than a potentially overflowing subtraction',()=>{
 const q=firstProjectQuizAt('rust',1);
 for(const [args,result] of [
  [[-1,0],-1],[[0,0],0],[[1,0],1],
  [[-2147483648,2147483647],-1],[[2147483647,-2147483648],1],
  [[-2147483648,-2147483648],0],[[2147483647,2147483647],0]
 ])assert.equal(findCase(q,args)?.expected,result,JSON.stringify(args));
 assert.doesNotMatch(q.referenceSource,/guess\s*-\s*secret/);
});

test('round_status gives victory priority on the last or already exhausted attempt',()=>{
 const q=firstProjectQuizAt('python',2);
 for(const [args,result] of [
  [[0,0,2],1],[[0,0,1],1],[[0,0,0],1],[[0,0,-1],1],
  [[1,0,2],0],[[1,0,1],-1],[[1,0,0],-1],[[-1,0,-1],-1],
  [[1,1,-2147483648],1],[[2147483647,-2147483648,-2147483648],-1]
 ])assert.equal(findCase(q,args)?.expected,result,JSON.stringify(args));
 assert.match(q.parameters.find(p=>p.name==='remaining').description,/送る直前/);
 assert.match(q.description,/今回の判定で1回使う/);
 assert.match(q.description,/回数そのものを更新せず/);
});

test('harnesses call the submitted implementation for every case without adding a model answer',()=>{
 for(const q of catalog){
  const h=q.createHarness('SUBMITTED_COMPONENT_SOURCE');
  assert.equal(h.language,q.language);assert.ok(h.source.includes('SUBMITTED_COMPONENT_SOURCE'));
  assert.ok(!h.source.includes(q.referenceSource));assert.deepEqual(h.expected,q.cases.map(c=>c.expected));
  assert.deepEqual(h.caseIds,q.cases.map(c=>c.id));
  assert.notEqual(q.starterSource,q.referenceSource);
 }
 assert.match(firstProjectQuizAt('java',0).createHarness('SOURCE').source,/public class Main/);
 assert.match(firstProjectQuizAt('csharp',0).createHarness('SOURCE').source,/static void Main\(string\[\] args\)/);
 assert.match(firstProjectQuizAt('go',0).createHarness('SOURCE').source,/package main\nimport "fmt"/);
});

test('SQL gives each call an input row with the component parameter columns',()=>{
 for(const q of catalog.filter(q=>q.language==='sql')){
  const columns=q.parameters.map(p=>p.name),h=q.createHarness(q.referenceSource);
  assert.equal(q.fixtureTable,'input');assert.deepEqual(q.fixtureColumns,columns);
  assert.equal(h.executions.length,q.cases.length);
  for(const [i,c] of q.cases.entries()){
   assert.equal(c.fixtureTable,'input');assert.deepEqual(c.fixtureColumns,columns);
   assert.deepEqual(c.fixtureRows,[c.args]);
   assert.match(h.executions[i].fixtureSql,/DROP TABLE IF EXISTS input;/);
   assert.match(h.executions[i].fixtureSql,/CREATE TABLE input/);
   assert.equal(h.executions[i].source,q.referenceSource);assert.equal(h.executions[i].expected,c.expected);
  }
  assert.match(q.referenceSource,/SELECT CASE/);assert.match(q.referenceSource,/FROM input;/);
 }
});

test('reference comments explain the game component without padding its work amount',()=>{
 for(const q of catalog){
  const comments=q.referenceSource.split('\n').filter(line=>/^\s*(?:\/\/|--|#) /.test(line));
  assert.ok(comments.length>=1&&comments.length<=2,q.id);
  assert.ok(comments.every(line=>/^[\x20-\x7e]+$/.test(line)),q.id);
  assert.ok(q.referenceSource.length<700,q.id);
 }
});

test('unrecognized progress and saved identifiers cannot select a different part',()=>{
 for(const index of [-1,3,4,0.5,NaN,Infinity])assert.equal(firstProjectQuizAt('cpp',index),null);
 for(const id of [null,'','__proto__','first-build/v2/cpp/accept-guess','first-build/v1/javascript/accept-guess','first-build/v1/cpp/unknown','first-build/v1/cpp/accept-guess/extra'])assert.equal(firstProjectQuizById(id),null);
 assert.throws(()=>firstProjectQuizAt('javascript',0),RangeError);
});
