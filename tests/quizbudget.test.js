import test from 'node:test';
import assert from 'node:assert/strict';
import {QuizRunner,quizExecutionBudgetMs,QUIZ_DEFAULT_EXECUTION_BUDGET_MS,QUIZ_MAX_EXECUTION_BUDGET_MS} from '../src/quizrunner.js';
import {challengeTopics,CHALLENGE_LANGUAGES} from '../src/challengecatalog.js';

test('authored execution budgets have a default, validation and an absolute upper limit', () => {
  assert.equal(QUIZ_DEFAULT_EXECUTION_BUDGET_MS,30000);
  assert.equal(QUIZ_MAX_EXECUTION_BUDGET_MS,300000);
  assert.equal(quizExecutionBudgetMs({}),30000);
  for(const value of [null,NaN,Infinity,-Infinity,-1,0,1.5,'90000',{}]) {
    assert.equal(quizExecutionBudgetMs({executionBudgetMs:value}),30000);
  }
  assert.equal(quizExecutionBudgetMs({executionBudgetMs:90000}),90000);
  assert.equal(quizExecutionBudgetMs({executionBudgetMs:999999}),300000);
  assert.equal(quizExecutionBudgetMs({executionBudgetMs:90000},10),10);
  assert.equal(quizExecutionBudgetMs({executionBudgetMs:90000},Infinity),30000);
});

test('measured Rust task budgets do not extend other language deadlines', () => {
  for(const language of CHALLENGE_LANGUAGES.filter(language=>language!=='sql')){
    for(const [topic,budget] of [['dynamic-parity-component-cost',300000],['hamiltonian-floor-cycles',90000]]){
      const question=challengeTopics(language,'systems').find(q=>q.topicId===topic);
      assert.equal(quizExecutionBudgetMs(question),language==='rust'?budget:30000);
    }
    const sequence=challengeTopics(language,'design').find(q=>q.topicId==='coordinate-skill-sequence');
    assert.equal(quizExecutionBudgetMs(sequence),language==='rust'?300000:30000);
  }
});

class FakeWorker {
  postMessage(message){this.messages??=[];this.messages.push(message);}
  terminate(){this.terminated=true;}
  receive(message){this.onmessage({data:message});}
}
const quiz={language:'rust',executionBudgetMs:90000,createHarness:source=>({source,expected:[7],caseIds:['seven']})};
test('production runner uses each task budget while preserving explicit constructor overrides',async t=>{
  const deadlines=[];
  t.mock.method(globalThis,'setTimeout',(_callback,ms)=>{deadlines.push(ms);return 0;});
  for(const [override,expected] of [[undefined,90000],[10,10],[999999,300000],[NaN,30000]]){
    const worker=new FakeWorker(),runner=new QuizRunner({workerFactory:()=>worker,executionTimeout:override});
    const pending=runner.run(quiz,'source'),id=worker.messages[0].id;
    worker.receive({id,type:'ready'});
    assert.equal(deadlines.at(-1),expected);
    assert.equal(worker.messages[1].type,'execute');
    worker.receive({id,type:'result',result:{stdout:'7\n'}});
    assert.equal((await pending).passed,true);
    assert.equal(worker.terminated,true);
  }
});
