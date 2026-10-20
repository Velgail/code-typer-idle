import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonAt,TOPICS,evaluateTopic} from '../src/curriculum.js';
import {SHARED_CHALLENGE_STATEMENTS} from '../src/challengestatements.js';
import {quizAt,quizById,quizId,quizCatalog,QUIZ_LANGUAGES,QUIZ_SUBJECTS,QUIZ_TOPICS_PER_SUBJECT} from '../src/quizcatalog.js';

const catalog=quizCatalog();
const find=(language,topicId)=>catalog.find(q=>q.language===language&&q.topicId===topicId);
const callCase=(quiz,inputs)=>quiz.cases.find(c=>quiz.parameters.every((p,i)=>!Object.hasOwn(inputs,p.name)||c.args[i]===inputs[p.name]));

test('the implementation catalog has all 512 stable lessons without replacing typing lessons',()=>{
 assert.equal(QUIZ_TOPICS_PER_SUBJECT,16);
 assert.equal(catalog.length,512);
 assert.equal(new Set(catalog.map(q=>q.id)).size,512);
 for(const language of QUIZ_LANGUAGES)for(const subject of QUIZ_SUBJECTS)for(let index=0;index<16;index++){
  const q=quizAt(language,subject,index),lesson=lessonAt(language,subject,index);
  assert.equal(q.language,language);assert.equal(q.subject,subject);assert.equal(q.index,index);
  assert.equal(q.topicId,lesson.topicId);assert.equal(q.title,lesson.title);assert.equal(q.lessonBaseId,lesson.baseId);
  assert.equal(q.id,quizId(language,subject,index));assert.equal(quizById(q.id),q);
  assert.equal(quizAt(language,subject,index+16),q);
  assert.equal(q.supported,true);assert.deepEqual(q.limitations,[]);
 }
});

test('each problem tests one implementation against many data inputs and rejects every constant answer',()=>{
 for(const q of catalog){
  assert.ok(q.cases.length>=16,q.id);
  assert.equal(new Set(q.cases.map(c=>c.id)).size,q.cases.length,q.id);
  assert.ok(new Set(q.cases.map(c=>c.expected)).size>=2,q.id);
  assert.ok(q.cases.every(c=>Number.isSafeInteger(c.expected)),q.id);
  const constant=q.cases[0].expected;
  assert.ok(q.cases.some(c=>c.expected!==constant),q.id);
  if(q.language!=='sql'){
   assert.ok(q.parameters.length>0,q.id);
   assert.ok(q.cases.every(c=>c.args.length===q.parameters.length),q.id);
   for(const c of q.cases)for(const [i,p] of q.parameters.entries())assert.equal(typeof c.args[i],p.type==='string'?'string':'number',q.id);
  }
 }
});

test('parameters describe their role and problem statements specify actual behavior',()=>{
 for(const q of catalog){
  assert.match(q.description,/[\u3040-\u9fff]/,q.id);
  assert.ok(q.description.length>=20,q.id);
  for(const p of q.parameters){
   assert.ok(p.name&&p.type,q.id);assert.match(p.description,/[\u3040-\u9fff]/,q.id);
   assert.notEqual(p.description,`${p.name}の値`,q.id);
   assert.doesNotMatch(p.description,/処理仕様に従って使用する/,q.id);
  }
 }
 assert.match(find('cpp','clamp_health').parameters.find(p=>p.name==='limit').description,/上限/);
});

test('shared Challenges describe results with separate constraints and verified worked examples',()=>{
 const topics=Object.values(TOPICS).flatMap(topics=>topics.slice(0,14));
 assert.equal(Object.keys(SHARED_CHALLENGE_STATEMENTS).length,56);
 for(const topic of topics){
  const q=find('cpp',topic.id);
  assert.doesNotMatch(q.description,/処理仕様:|を0から .*未満まで1ずつ増やして|for文|範囲for/);
  assert.ok(Array.isArray(q.constraints)&&q.constraints.length>=1,q.id);
  assert.ok(q.constraints.every(value=>typeof value==='string'&&value.length>0),q.id);
  assert.ok(q.examples.length>=2,q.id);
  for(const example of q.examples){
   assert.equal(example.args.length,q.parameters.length,q.id);
   const inputs=Object.fromEntries(q.parameters.map((p,i)=>[p.name,example.args[i]]));
   assert.equal(evaluateTopic({...topic,inputs:()=>inputs},0),example.expected,`${q.id}: ${JSON.stringify(example.args)}`);
   assert.ok(example.explanation.length>0,q.id);
  }
  for(const language of QUIZ_LANGUAGES.filter(language=>language!=='sql')){
   const translated=find(language,topic.id);
   assert.equal(translated.description,q.description,translated.id);
   assert.deepEqual(translated.constraints,q.constraints,translated.id);
   assert.deepEqual(translated.examples,q.examples,translated.id);
  }
 }
});

test('collected coins accept the equivalent formula and examples preserve the initial balance',()=>{
 const q=find('cpp','sum_coins');
 assert.match(q.description,/現在の所持金は total/);
 assert.doesNotMatch(q.description,/for|ループ|繰り返し|1ずつ増や/);
 assert.ok(q.examples.some(example=>example.args[2]!==0&&example.args[0]>0));
 assert.ok(q.examples.some(example=>example.args[2]!==0&&example.args[0]===0&&example.expected===example.args[2]));
 for(const {args:[pickups,coin,total],expected} of [...q.cases,...q.examples]){
  assert.equal(total+coin*pickups,expected);
 }
});

test('overwritten scratch arguments are explicitly excluded from the requested result',()=>{
 const ignored={apply_armor:'damage',nearest_bucket:'bucket',inventory_capacity:'accepted',cooldown_gate:'wait',damage_pipeline:'damage',clamp_channel:'result',pool_slots:'free'};
 for(const [id,name] of Object.entries(ignored)){
  const q=find('cpp',id);
  assert.match(q.parameters.find(parameter=>parameter.name===name).description,/戻り値には影響しません/);
 }
});

test('common algorithms use the same cases and outcomes in all seven imperative languages',()=>{
 for(const subject of QUIZ_SUBJECTS)for(let index=0;index<14;index++){
  const first=quizAt('cpp',subject,index);
  for(const language of QUIZ_LANGUAGES.filter(l=>!['cpp','sql'].includes(l))){
   const q=quizAt(language,subject,index);
   assert.deepEqual(q.parameters.map(p=>p.name),first.parameters.map(p=>p.name));
   assert.deepEqual(q.cases,first.cases,q.id);
  }
 }
});

test('health and interval tasks include exact boundaries and their neighbors',()=>{
 const health=find('python','clamp_health');
 for(const [value,expected] of [[-1,0],[0,0],[99,99],[100,100],[101,100]])assert.equal(callCase(health,{health:value,limit:100}).expected,expected);
 const range=find('cpp','range_check');
 for(const [value,expected] of [[9,0],[10,1],[11,1],[29,1],[30,1],[31,0]])assert.equal(callCase(range,{value,low:10,high:30}).expected,expected);
 const viewport=find('rust','viewport_clip');
 for(const [x,expected] of [[-1,0],[0,1],[23,1],[24,0],[25,0]])assert.equal(callCase(viewport,{x,width:24}).expected,expected);
});

test('payment, expiration, and page tasks distinguish equality from just below and above',()=>{
 const payment=find('go','spend_coins');
 for(const [coins,expected] of [[17,17],[18,0],[19,1]])assert.equal(callCase(payment,{coins,cost:18}).expected,expected);
 const expiry=find('java','cache_expiry');
 for(const [now,expected] of [[27,1],[28,0],[29,0]])assert.equal(callCase(expiry,{now,expiry:28}).expected,expected);
 const pages=find('csharp','packet_pages');
 for(const [bytes,expected] of [[0,0],[63,1],[64,1],[65,2]])assert.equal(callCase(pages,{bytes,page_size:64}).expected,expected);
});

test('Python keeps branch assignments that happen to equal the old local initializer',()=>{
 const armor=find('python','apply_armor');
 assert.match(armor.referenceSource,/if \(damage < 0\):\n        damage = 0/);
 assert.match(armor.referenceSource,/def apply_armor\(hit, armor, damage\):/);
 assert.doesNotMatch(armor.referenceSource,/^    hit = /m);
 assert.equal(callCase(armor,{hit:6,armor:7,damage:0}).expected,0);
 assert.equal(callCase(armor,{hit:8,armor:7,damage:0}).expected,1);
});

test('language-specific data exercises cover absence, saved zero, order, and Unicode',()=>{
 for(const [language,id] of [['csharp','csharp_nullable_value'],['rust','rust_option'],['java','java_optional'],['python','python_dict_default'],['lua','lua_table_default']]){
  const q=find(language,id);
  assert.ok(q.cases.some(c=>c.args[0]===0&&c.args[1]===0&&c.expected===0),q.id);
  assert.ok(q.cases.some(c=>c.args[1]===1&&c.expected===c.args[2]),q.id);
 }
 const sort=find('cpp','cpp_sprite_sort');assert.ok(sort.cases.some(c=>c.args[0]===c.args[1]&&c.args[1]===c.args[2]));
 const queue=find('csharp','csharp_queue_order');assert.equal(callCase(queue,{first:1,second:2}).expected,11);
 const unicode=find('go','go_rune_frame');assert.equal(callCase(unicode,{text:'a😀b',initial:1}).expected,4);
 const counter=find('python','python_counter');assert.equal(callCase(counter,{value:1}).expected,33);
});

test('harnesses execute submitted source with all cases rather than executing the reference answer',()=>{
 for(const q of catalog){
  const h=q.createHarness('USER_SOURCE_SENTINEL');
  assert.equal(h.language,q.language);assert.ok(h.source.includes('USER_SOURCE_SENTINEL'),q.id);
  assert.ok(!h.source.includes(q.referenceSource),q.id);
  assert.deepEqual(h.expected,q.cases.map(c=>c.expected),q.id);
  assert.deepEqual(h.caseIds,q.cases.map(c=>c.id),q.id);
 }
 assert.match(quizAt('java','syntax',0).createHarness('USER_SOURCE_SENTINEL').source,/public class Main/);
 assert.match(quizAt('csharp','syntax',0).createHarness('USER_SOURCE_SENTINEL').source,/static void Main\(string\[\] args\)/);
});

test('SQL fixtures vary rows, identifiers, groups, missing data, and recursion bounds',()=>{
 const sql=catalog.filter(q=>q.language==='sql');assert.equal(sql.length,64);
 for(const q of sql){
  assert.equal(q.cases.length,20);
  const harness=q.createHarness(q.referenceSource);
  assert.equal(harness.executions.length,q.cases.length);
  assert.ok(harness.executions.every(e=>e.source===q.referenceSource));
  for(const c of q.cases){
   assert.ok(c.fixtureRows.length>=4&&c.fixtureRows.length<=6);
   assert.equal(new Set(c.fixtureRows.map(r=>r[0])).size,c.fixtureRows.length);
   assert.ok(c.fixtureRows.every(r=>r.length===4&&r.every(Number.isSafeInteger)));
   assert.ok(c.counterLimit>=1&&c.counterLimit<=9);
  }
 }
 assert.ok(new Set(find('sql','keyset_page').cases.map(c=>c.expected)).size>1);
 assert.ok(new Set(find('sql','successor_links').cases.map(c=>c.expected)).size>1);
 const recursive=find('sql','recursive_counter');
 for(const c of recursive.cases)assert.equal(c.expected,c.counterLimit*(c.counterLimit+1)/2);
 assert.match(recursive.referenceSource,/SELECT counter_limit FROM quiz_config/);
 assert.ok(find('sql','coalesce_missing').cases.some(c=>c.expected===0));
});

test('C# projection does not depend on the missing trimmed Sum overload and Java avoids exception exercises',()=>{
 const projection=find('csharp','csharp_linq_pixels');
 assert.match(projection.referenceSource,/Enumerable.Select/);
 assert.doesNotMatch(projection.referenceSource,/Enumerable.Sum/);
 for(const q of catalog.filter(q=>q.language==='java'))assert.doesNotMatch(q.referenceSource,/catch\s*\(|throw\s+new/);
});

test('invalid identifiers and axes cannot silently select a different problem',()=>{
 assert.equal(quizById('quiz/v1/sql/syntax/not-a-topic'),null);
 assert.equal(quizById('quiz/v2/cpp/syntax/clamp_health'),null);
 assert.equal(quizById('__proto__'),null);assert.equal(quizById(null),null);
 assert.throws(()=>quizAt('javascript','syntax',0),RangeError);
 assert.throws(()=>quizAt('cpp','invalid',0),RangeError);
});
