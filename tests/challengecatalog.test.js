import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeAt,challengeById,challengeTopics,challengeCatalog,CHALLENGE_LANGUAGES,CHALLENGE_SUBJECTS} from '../src/challengecatalog.js';
import {quizCatalog} from '../src/quizcatalog.js';

const catalog=challengeCatalog();
const additions=catalog.filter(q=>!q.legacy);
const added=(slug,language='cpp')=>additions.find(q=>q.topicId===slug&&q.language===language);
const expected=(slug,args)=>{
 const q=added(slug);assert.ok(q,slug);
 const c=q.cases.find(c=>JSON.stringify(c.args)===JSON.stringify(args));assert.ok(c,`${slug}: ${JSON.stringify(args)}`);return c.expected;
};

test('legacy exercises preserve their exact identifiers and numeric harnesses as entry-level challenges',()=>{
 for(const old of quizCatalog()){
  const q=challengeById(old.id);assert.ok(q);assert.equal(q.id,old.id);assert.equal(q.kind,'challenge');assert.equal(q.legacy,true);
  assert.equal(q.referenceSource,old.referenceSource);assert.deepEqual(q.cases,old.cases);
  assert.deepEqual(q.createHarness(q.referenceSource),old.createHarness(old.referenceSource));
  assert.equal(challengeAt(old.language,old.subject,old.index),q);
  assert.match(q.description,/実装方法は自由/);
 }
});
test('published IO tasks retain their positions and fourteen appended families share seven language implementations',()=>{
 assert.equal(CHALLENGE_LANGUAGES.length,8);assert.equal(CHALLENGE_SUBJECTS.length,4);
 assert.equal(catalog.length,1122);assert.equal(additions.length,610);assert.equal(new Set(catalog.map(q=>q.id)).size,catalog.length);
 for(const language of CHALLENGE_LANGUAGES)for(const subject of CHALLENGE_SUBJECTS){
  const count=language==='sql'?32:subject==='design'?38:subject==='systems'?36:34;
  const topics=challengeTopics(language,subject);assert.equal(topics.length,count,`${language}/${subject}`);
  assert.equal(topics.filter(q=>!q.legacy).length,count-16);assert.equal(new Set(topics.map(q=>q.familyId)).size,count);
  topics.forEach((q,index)=>{assert.equal(q.index,index);assert.equal(challengeAt(language,subject,index),q);assert.equal(challengeById(q.id),q);});
 }
});
test('challenge metadata distinguishes complexity, concepts, estimated thought time and actual input contracts',()=>{
 for(const q of catalog){
  assert.ok(Number.isInteger(q.difficulty)&&q.difficulty>=1&&q.difficulty<=6,q.id);
  assert.equal(q.difficultyLabel,['入門','基礎','応用','発展','競技','難関'][q.difficulty-1],q.id);
  assert.ok(q.estimatedMinutes>=2&&q.estimatedMinutes<=60,q.id);assert.ok(q.concept);assert.ok(q.familyId);assert.ok(Array.isArray(q.prerequisites));
  assert.ok(q.parameters.every(p=>p.name&&p.type&&p.description),q.id);assert.ok(q.description&&q.title&&q.referenceSource&&q.starterSource);
 }
 for(const language of CHALLENGE_LANGUAGES.filter(l=>l!=='sql')){
  const qs=additions.filter(q=>q.language===language);
  assert.equal(new Set(qs.map(q=>q.familyId)).size,78);assert.ok(qs.some(q=>q.difficulty===4));
  assert.ok(qs.some(q=>q.parameters.some(p=>p.type==='array')));assert.ok(qs.some(q=>q.parameters.some(p=>p.type==='string')));
  assert.ok(qs.some(q=>q.resultType==='array'));assert.ok(qs.some(q=>q.resultType==='string'));
 }
});
test('same semantic task shares a transfer family across languages while different tasks do not',()=>{
 for(const slug of ['sum-sequence','max-subarray','flood-fill','knapsack','edit-distance']){
  const qs=additions.filter(q=>q.topicId===slug);assert.equal(qs.length,7);assert.equal(new Set(qs.map(q=>q.familyId)).size,1);
  const cases=qs[0].cases.map(c=>({args:c.args,expected:c.expected}));for(const q of qs)assert.deepEqual(q.cases.map(c=>({args:c.args,expected:c.expected})),cases);
 }
 assert.equal(challengeById('quiz/v1/cpp/syntax/clamp_health').familyId,challengeById('quiz/v1/lua/syntax/clamp_health').familyId);
});
test('all new models and starters expose JSON-lines harnesses with actual structured expected values',()=>{
 for(const q of additions){
  const h=q.createHarness(q.referenceSource);assert.equal(h.outputFormat,'json-lines',q.id);assert.equal(h.language,q.language);
  assert.deepEqual(h.expected,q.cases.map(c=>c.expected));assert.deepEqual(h.caseIds,q.cases.map(c=>c.id));assert.ok(h.source.includes(q.language==='sql'?q.referenceSource.trim().replace(/;$/,''):q.referenceSource),q.id);
  assert.ok(q.cases.length>=4,q.id);assert.equal(new Set(q.cases.map(c=>c.id)).size,q.cases.length);
  assert.notEqual(q.starterSource,q.referenceSource,q.id);
 }
 assert.ok(additions.some(q=>q.cases.some(c=>Array.isArray(c.expected))));assert.ok(additions.some(q=>q.cases.some(c=>typeof c.expected==='string')));
});
test('numeric and string input source literals survive JSON escaping without sharing mutable fixtures',()=>{
 for(const language of CHALLENGE_LANGUAGES.filter(l=>l!=='sql')){
  const q=added('collapse-whitespace',language),before=JSON.stringify(q.cases);const h=q.createHarness(q.referenceSource);
  assert.ok(h.source.includes('line\\tend'));assert.ok(h.source.includes(' a\\nb\\rc\\r\\nd '));assert.equal(JSON.stringify(q.cases),before);
 }
});
test('variable-length array tasks cover emptiness, negatives, duplicate values and order-sensitive results',()=>{
 assert.equal(expected('sum-sequence',[[]]),0);assert.deepEqual(expected('positive-filter',[[1,-2,3,-4,5]]),[1,3,5]);
 assert.deepEqual(expected('prefix-totals',[[1,-2,3,-4,5]]),[1,-1,2,-2,3]);
 assert.deepEqual(expected('adjacent-deduplicate',[[2,1,2,1,2]]),[2,1,2,1,2]);
 assert.deepEqual(expected('rotate-sequence',[[1,2,3],-1]),[3,1,2]);
 assert.deepEqual(expected('merge-sorted',[[1,1],[1,1]]),[1,1,1,1]);
 assert.deepEqual(expected('pair-sum-indices',[[1,2,3,4],5]),[0,3]);assert.equal(expected('missing-label',[[3,0,1]]),2);
 assert.deepEqual(expected('product-except-self',[[0,2,3]]),[6,0,0]);assert.deepEqual(expected('product-except-self',[[0,2,0]]),[0,0,0]);
 assert.equal(expected('max-subarray',[[-8,-2,-5]]),-2);assert.deepEqual(expected('insertion-sort',[[1,-2,3,-4,5]]),[-4,-2,1,3,5]);
});
test('text tasks distinguish whitespace, case, repetition, nesting and empty inputs',()=>{
 assert.equal(expected('collapse-whitespace',['  one  two ']),'one two');assert.equal(expected('normalized-palindrome',['0P']),0);
 const mixed=[' a\nb\rc\r\nd '];
 assert.equal(expected('collapse-whitespace',mixed),'a b c d');assert.deepEqual(expected('word-lengths',mixed),[1,1,1,1]);assert.equal(expected('reverse-word-order',mixed),'d c b a');
 assert.equal(expected('anagram-check',['aab','abb']),0);assert.equal(expected('substring-occurrences',['aaaa','aa']),3);
 assert.equal(expected('rotation-check',['abc','acb']),0);assert.equal(expected('caesar-shift',['Abz!',1]),'Bca!');
 assert.equal(expected('balanced-brackets',['([)]']),0);assert.equal(expected('balanced-brackets',['([{}])']),1);
 assert.equal(expected('compress-runs',['AAAAAAAAAAAA']),'A12');assert.equal(expected('longest-unique-span',['pwwkew']),3);
});
test('geometry and image tasks process actual point sets and matrix layouts',()=>{
 assert.deepEqual(expected('bounding-box',[[1,2,-3,4,5,-6]]),[-3,-6,5,4]);
 assert.equal(expected('rectangle-intersection',[[0,0,1,1],[1,0,2,1]]),0);
 assert.equal(expected('nearest-point',[[1,0,-1,0],0,0]),0);
 assert.deepEqual(expected('rotate-square',[[1,2,3,4],2]),[3,1,4,2]);
 assert.deepEqual(expected('flood-fill',[[1,0,0,1],2,2,0,9]),[9,0,0,1]);
 assert.deepEqual(expected('bresenham-line',[[0,0,3,2]]),[0,0,1,1,2,1,3,2]);
 assert.equal(expected('binary-perimeter',[[1,1,1,1],2,2]),8);
 assert.equal(expected('binary-perimeter',[[1,1,1,1,0,1,1,1,1],3,3]),16);
});
test('graph, dynamic-programming and state-machine tasks require different outputs for different structures',()=>{
 assert.deepEqual(expected('graph-distances',[4,[0,1,2,3],0]),[0,1,-1,-1]);
 assert.deepEqual(expected('graph-distances',[4,[0,1,1,2],2]),[2,1,0,-1]);
 assert.deepEqual(expected('component-labels',[4,[0,1,2,3]]),[0,0,1,1]);
 assert.deepEqual(expected('topological-order',[3,[0,1,1,2,2,0]]),[]);
 assert.deepEqual(expected('weighted-paths',[3,[0,1,4,0,2,10,1,2,2],0]),[0,4,6]);
 assert.equal(expected('minimum-coins',[[1,3,4],6]),2);assert.equal(expected('minimum-coins',[[2],3]),-1);
 assert.equal(expected('common-subsequence',['abcde','ace']),3);assert.equal(expected('knapsack',[[1,1,1],[2,3,4],2]),7);
 assert.deepEqual(expected('sliding-maximum',[[1,3,-1,-3,5,3,6,7],3]),[3,3,5,5,6,7]);
 assert.deepEqual(expected('lru-cache',[[1,2,1,3,2],2]),[4,3,2]);assert.equal(expected('edit-distance',['kitten','sitting']),3);
 assert.equal(expected('redundant-connections',[3,[0,0,0,1,0,1]]),2);assert.equal(expected('postfix-evaluation',['92-3/']),2);
});
test('old method-specific descriptions now specify outputs and permit alternative implementations',()=>{
 for(const id of ['cpp/systems/cpp_unique_owner','cpp/design/cpp_struct_method','python/design/python_dataclass']){
  const q=challengeById('quiz/v1/'+id);assert.ok(q.referenceTechnique);assert.match(q.description,/実装方法は自由/);
  assert.doesNotMatch(q.description,/unique_ptrに所有|dataclassを|メンバー関数で/);
 }
 const slice=challengeById('quiz/v1/rust/graphics/rust_slice_pixels');assert.match(slice.description,/2×increment/);
 for(const c of slice.cases){const [a,b,d,e,increment]=c.args;assert.equal(c.expected,a+b+d+e+2*increment);}
 const cache=challengeById('quiz/v1/csharp/systems/csharp_dictionary_cache');assert.match(cache.description,/100\+initial\+increment/);
 for(const c of cache.cases)assert.equal(c.expected,100+c.args[0]+c.args[1]);
 const counter=challengeById('quiz/v1/python/systems/python_counter');assert.match(counter.description,/1の個数×10/);
 for(const c of counter.cases){const v=c.args[0],values=[1,2,1,v];assert.equal(c.expected,values.filter(n=>n===1).length*10+values.filter(n=>n===v).length);}
});
test('invalid challenge identifiers and language/subject selections cannot escape their catalogs',()=>{
 for(const id of [null,'','challenge/v2/cpp/syntax/sum-sequence','challenge/v1/cpp/syntax/unknown','challenge/v1/invalid/syntax/sum-sequence','challenge/v1/cpp/syntax/sum-sequence/extra'])assert.equal(challengeById(id),null);
 assert.throws(()=>challengeTopics('javascript','syntax'),RangeError);assert.throws(()=>challengeTopics('cpp','unknown'),RangeError);
 assert.equal(challengeAt('cpp','syntax',NaN),challengeAt('cpp','syntax',0));assert.equal(challengeAt('cpp','syntax',34),challengeAt('cpp','syntax',0));
 assert.equal(challengeAt('cpp','syntax',32).topicId,'binary-search-minimum-capacity');
});
