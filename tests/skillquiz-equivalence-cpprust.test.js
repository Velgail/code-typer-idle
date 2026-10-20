import test from 'node:test';
import assert from 'node:assert/strict';
import {skillQuizById,gradeSkillQuiz} from '../src/skillquiz.js';

const quiz=(language,id)=>skillQuizById(`skill-quiz/v1/${language}/${id}`);
const accepts=(language,id,answers)=>{
 const question=quiz(language,id);assert.ok(question,`${language}/${id}`);
 for(const answer of answers)assert.equal(gradeSkillQuiz(question,answer).passed,true,`${language}/${id}: ${answer}`);
};
const rejects=(language,id,answers)=>{
 const question=quiz(language,id);assert.ok(question,`${language}/${id}`);
 for(const answer of answers)assert.equal(gradeSkillQuiz(question,answer).passed,false,`${language}/${id}: ${answer}`);
};

test('brace initialization accepts zero-valued lists while preserving the required technique',()=>{
 accepts('cpp','syntax/value-init',['{}','{0}','= {}','= {0}']);
 rejects('cpp','syntax/value-init',['()','[]','= 0','(0)','= 1','{1}','=0; int injected=0']);
 const question=quiz('cpp','syntax/value-init');
 assert.equal(question.title,'波括弧で0に初期化');
 assert.match(question.prompt,/波括弧によるリスト初期化/);
 assert.match(question.explanation,/\{0\}.*リスト初期化/);
 assert.match(question.explanation,/=0.*コピー初期化/);
});

test('C++ accepts alternate language spellings and the operations required by the actual blank',()=>{
 accepts('cpp','syntax/logical-and',['and']);
 accepts('cpp','syntax/vector-append',['emplace_back']);
 accepts('cpp','syntax/overload-selection',['int','(int)']);
 accepts('cpp','syntax/designated-init',['={.x=2,.y=3}']);
 accepts('cpp','design/setter-invariant',['std::max(value,0)','value<0?0:value']);
 accepts('cpp','graphics/time-delta',['1000.','1e3']);
 accepts('cpp','systems/custom-deleter',['std::fclose']);
 rejects('cpp','syntax/logical-and',['&','or']);
 rejects('cpp','graphics/time-delta',['1000','0.001']);
 rejects('cpp','design/setter-invariant',['0','std::min(value,0)']);
});

test('an identical value for one example does not bypass a stated syntax or technique requirement',()=>{
 rejects('cpp','syntax/fold-expression',['(...+args)','6']);
 rejects('cpp','syntax/designated-init',['{2,3}','{.y=3,.x=2}']);
 rejects('cpp','systems/compare-exchange',['compare_exchange_weak']);
 rejects('rust','design/reborrow-mutable',['borrow']);
 rejects('rust','design/field-shorthand',['x:x']);
 rejects('rust','design/shared-receiver',['self','&mut self']);
 assert.match(quiz('cpp','systems/compare-exchange').prompt,/見せかけの失敗をせず/);
});

test('Rust accepts explicit receiver types, borrowing-preserving duplication, trait paths and bound order',()=>{
 accepts('rust','design/shared-receiver',['self: &Self','self: &Player']);
 accepts('rust','design/mutable-receiver',['self: &mut Self','self: &mut Player']);
 accepts('rust','design/clone-owned-value',['to_owned']);
 accepts('rust','design/qualified-trait-call',['A::value']);
 accepts('rust','systems/thread-send-bound',["'static + Send"]);
 rejects('rust','design/qualified-trait-call',['Thing::value','B::value']);
 rejects('rust','systems/thread-send-bound',['Send','Sync']);
 assert.equal(quiz('rust','design/qualified-trait-call').title,'呼び出すtraitを指定');
});

test('stronger atomic ordering satisfies the stated synchronization goal without allowing weaker ordering',()=>{
 accepts('cpp','systems/release-publish',['std::memory_order::release','std::memory_order_seq_cst']);
 accepts('cpp','systems/acquire-observe',['std::memory_order::acquire','std::memory_order::seq_cst']);
 accepts('rust','systems/release-store',['SeqCst']);
 accepts('rust','systems/acquire-load',['SeqCst']);
 rejects('cpp','systems/release-publish',['std::memory_order_relaxed']);
 rejects('rust','systems/acquire-load',['Relaxed']);
 assert.match(quiz('cpp','systems/release-publish').explanation,/より強いseq_cst/);
 assert.match(quiz('rust','systems/acquire-load').explanation,/より強いSeqCst/);
});
