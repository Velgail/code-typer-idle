import test from 'node:test';
import assert from 'node:assert/strict';
import { compareQuizOutput, QuizRunner } from '../src/quizrunner.js';

test('all cases, finite numeric output and the exact row count are required',()=>{
  assert.equal(compareQuizOutput('0\n42\n-2\n',[0,42,-2]).passed,true);
  for(const output of ['0\n42','0\n42\n-2\n99','0\n42\nNaN','0\n42\n','0\n42\n-2foo','0\n42\nInfinity']) assert.equal(compareQuizOutput(output,[0,42,-2]).passed,false,output);
  assert.equal(compareQuizOutput('',[]).passed,false);
  assert.equal(compareQuizOutput('1e-3',[.001]).passed,true);
  assert.equal(compareQuizOutput('2147483646',[2147483647]).passed,false,'integer results must match exactly');
  assert.equal(compareQuizOutput('5\n5\n5',[0,5,10]).passed,false,'a constant is not an implementation');
});

const quiz={language:'python',createHarness:source=>({source,expected:[0,10],caseIds:['zero','limit']})};
class FakeWorker {
  postMessage(message){this.messages ??=[];this.messages.push(message);}
  terminate(){this.terminated=true;}
  receive(data){this.onmessage({data});}
}
function fixture(options={}){const workers=[];const runner=new QuizRunner({workerFactory:()=>{const w=new FakeWorker();workers.push(w);return w;},...options});return {runner,workers};}
function ready(w){w.receive({id:w.messages[0].id,type:'ready'});}
function result(w,values){w.receive({id:w.messages[0].id,type:'result',result:values});}

test('compiler failure never clears a quiz even when stdout matches; workers are discarded',async()=>{
  const {runner,workers}=fixture();const pending=runner.run(quiz,'source'),w=workers[0];
  ready(w);assert.equal(w.messages[1].type,'execute');
  result(w,{stdout:'0\n10',error:'syntax',errorKind:'compile'});
  const report=await pending;assert.equal(report.passed,false);assert.equal(report.status,'compile-error');assert.equal(w.terminated,true);
});

test('cancelled runs resolve without accepting a late response',async()=>{
  const {runner,workers}=fixture();const old=runner.run(quiz,'old'),w=workers[0];
  runner.cancel();assert.equal((await old).status,'cancelled');
  const pending=runner.run(quiz,'new'),current=workers[1];
  result(w,{stdout:'0\n10'});assert.equal(runner.worker,current);
  ready(current);result(current,{stdout:'0\n10'});
  const report=await pending;assert.equal(report.status,'passed');assert.deepEqual(report.cases.map(c=>c.id),['zero','limit']);
});

test('a runaway execution terminates only its worker and permits retry',async()=>{
  const {runner,workers}=fixture({executionTimeout:10});
  const pending=runner.run(quiz,'loop');ready(workers[0]);
  assert.equal((await pending).status,'timeout');assert.equal(workers[0].terminated,true);
  const retry=runner.run(quiz,'fixed');ready(workers[1]);result(workers[1],{stdout:'0\n10'});assert.equal((await retry).passed,true);
});

test('truncated output and oversized source fail before earning progress',async()=>{
  const {runner,workers}=fixture();assert.equal((await runner.run(quiz,'x'.repeat(24001))).passed,false);assert.equal(workers.length,0);
  const pending=runner.run(quiz,'output');ready(workers[0]);result(workers[0],{stdout:'0\n10',outputTruncated:true});assert.equal((await pending).passed,false);
});
test('structured Challenge output checks full arrays, strings, object fields and output count',()=>{
 assert.equal(compareQuizOutput('[1,2]\n"hello"\n{"value":3}\n',[[1,2],'hello',{value:3}],[],'json-lines').passed,true);
 for(const source of ['[1,3]\n"hello"\n{"value":3}','[1,2]\n"hello"\n{"value":3,"extra":0}','[1,2]\nhello\n{"value":3}','[1,2]\n"hello"\n{"value":3}\n0'])assert.equal(compareQuizOutput(source,[[1,2],'hello',{value:3}],[],'json-lines').passed,false);
 assert.equal(compareQuizOutput('"1"',[1],[],'json-lines').passed,false);
 assert.equal(compareQuizOutput('[]',[[]],[],'json-lines').passed,true);
});

test('SQL mutation execution metadata reaches the worker without editing the answer',async()=>{
 const {runner,workers}=fixture();
 const source='UPDATE rows SET value=value+1 RETURNING id,value; SELECT id,value FROM rows;';
 const sqlProgram=[{source,captureOutput:false},{source:'SELECT json_array(1,2);',captureOutput:true}];
 const mutation={language:'sql',createHarness:answer=>({source:answer,sqlChecks:[],sqlProgram,expected:[[1,2]],caseIds:['state'],outputFormat:'json-lines'})};
 const pending=runner.run(mutation,source);ready(workers[0]);
 assert.equal(workers[0].messages[1].source,source);
 assert.deepEqual(workers[0].messages[1].sqlProgram,sqlProgram);
 result(workers[0],{stdout:'[1,2]\n'});assert.equal((await pending).passed,true);
});
