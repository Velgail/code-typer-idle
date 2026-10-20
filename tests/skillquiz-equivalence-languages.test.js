import test from 'node:test';
import assert from 'node:assert/strict';
import {skillQuizById,gradeSkillQuiz} from '../src/skillquiz.js';

// Keep nearby wrong answers alongside each legitimate spelling: accepting a
// shorthand must not turn a technique question into a constant-output check.
const examples=[
 ['go','syntax/full-slice-capacity',[':1:1'],[':1','0:1:3']],
 ['go','syntax/half-open-slice',['1:len(history)'],[':len(history)']],
 ['go','syntax/rune-literal',[String.raw`'\u0041'`,String.raw`'\x41'`],['"A"',String.raw`'\u0042'`]],
 ['go','syntax/map-comma-ok',['stock[`potion`]'],['stock[`rope`]','stock["potion"], true']],
 ['go','design/nil-guard',['nil == player'],['player != nil','true']],
 ['go','graphics/opacity-scale',['100','1e2'],['255','1']],
 ['go','graphics/rgba-array',['[4]byte'],['[]byte','[3]byte']],
 ['go','graphics/row-major-index',['x + y * width'],['x * width + y','19']],
 ['python','syntax/tuple-unpack',['(x, y)','[x, y]'],['(y, x)','x']],
 ['python','syntax/dictionary-lookup',["'potion'"],["'POTION'","'rope'"]],
 ['python','syntax/sequence-pattern',["('move', distance)","'move', distance"],["('jump', distance)",'["move", 3]']],
 ['python','syntax/f-string',['F'],['r','b']],
 ['python','syntax/raw-regex',['R'],['b','f']],
 ['python','design/safe-default-list',['list()'],['None','items','{}']],
 ['python','graphics/point-components',['x, y'],['y, x','x + y']],
 ['python','graphics/channel-clamp',['min(255, max(0, red))'],['min(0, max(255, red))','255']],
 ['python','graphics/draw-command-record',[`{'kind': "sprite", 'x': 3, "y": 4}`],[`{'kind': 'other', 'x': 3, 'y': 4}`]],
 ['python','systems/binary-layout',["'!I'","'>I'"],["'<I'","'>h'"]],
 ['python','systems/digest-bytes',['payload.encode()',"payload.encode('utf-8')"],['payload','payload.encode("utf-16")']],
 ['csharp','syntax/interpolation',['$@"Score: {score}"','@$"Score: {score}"'],['@"Score: {score}"','"Score: {score}"']],
 ['csharp','syntax/type-pattern',['System.Int32'],['var','string']],
 ['csharp','syntax/discard-output',['var _','int _'],['null','void']],
 ['csharp','syntax/range-slice',['1..(values.Length - 1)'],['1..values.Length','0..^1']],
 ['csharp','graphics/blend-weight',['255.0F'],['255','255.0']],
 ['java','graphics/float-opacity',['255.0f'],['255','255.0']],
 ['java','systems/fifo-queue',['remove','poll','pollFirst'],['getFirst','peek','peekFirst']],
 ['java','design/default-conflict',['B.super'],['super','A']],
 ['java','syntax/record-pattern',['Point(var px, var py)'],['Point px']],
 ['lua','design/constructor-fresh-table',[`{['health'] = 100}`,'{health = 100,}'],['{health = 0}','{}']],
 ['lua','design/return-error-pair',["nil, 'not found'"],["false, 'not found'","nil, 'different'"]],
 ['sql','syntax/left-join',['LEFT OUTER JOIN'],['INNER JOIN','CROSS JOIN']],
 ['sql','design/junction-table',['INNER JOIN','CROSS JOIN'],['UNION','GROUP BY']],
 ['sql','systems/rollback-to-savepoint',['ROLLBACK TO SAVEPOINT','ROLLBACK TRANSACTION TO SAVEPOINT'],['ROLLBACK','COMMIT']],
 ['sql','systems/savepoint-release',['RELEASE SAVEPOINT'],['ROLLBACK TO','COMMIT']],
 ['sql','systems/transaction-commit',['END TRANSACTION','COMMIT TRANSACTION'],['ROLLBACK']]
];

for(const [language,id,accepted,rejected] of examples){
 test(`${language}/${id} accepts equivalent spelling and preserves its contract`,()=>{
  const quiz=skillQuizById(`skill-quiz/v1/${language}/${id}`);
  assert.ok(quiz);
  for(const answer of accepted){
   const result=gradeSkillQuiz(quiz,answer);
   assert.equal(result.passed,true,answer);
   assert.equal(result.completedSource,quiz.code.replace('____',answer));
   assert.equal(gradeSkillQuiz(quiz,answer+'; unexpected()').passed,false,'appended statements');
  }
  for(const answer of rejected)assert.equal(gradeSkillQuiz(quiz,answer).passed,false,answer);
 });
}

test('explicit pedagogic constraints remain separate from arbitrary I/O implementations',()=>{
 for(const [language,id,wrong] of [
  ['python','syntax/none-identity','=='],
  ['python','syntax/enumerate-start','1'],
  ['sql','syntax/count-rows','COUNT(1)'],
  ['sql','syntax/coalesce-default','IFNULL'],
  ['lua','syntax/method-call-colon','.']
 ]){
  const quiz=skillQuizById(`skill-quiz/v1/${language}/${id}`);
  assert.equal(gradeSkillQuiz(quiz,wrong).passed,false,`${language}/${id}: ${wrong}`);
 }
});
