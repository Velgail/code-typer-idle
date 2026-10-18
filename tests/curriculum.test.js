import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonAt, questionFor, TOPICS, SQL_TOPICS, localeForComments, CURRICULUM_VERSION } from '../src/curriculum.js';
import { createState, answerReading, nextReading, readingLesson, READING_UNITS, serialize, deserialize, developmentReadiness, validity, input, prestige } from '../src/core.js';
import { currentPrompt, acceptCharacter, promptAt } from '../src/typing.js';

test('all topics have purposeful English typing comments, Japanese notes, and stable numeric questions', () => {
  for (const pools of [TOPICS, SQL_TOPICS]) for (const topics of Object.values(pools)) {
    assert.equal(topics.length, 16);
    assert.equal(new Set(topics.map(t=>t.id)).size,16);
  }
  const answerPositions = new Set(), sortedPositions = new Set();
  for (const language of ['cpp','csharp','rust','go','python','java','sql','lua']) for (const subject of Object.keys(TOPICS)) for (let index=0;index<256;index++) {
    const lesson = lessonAt(language,subject,index), question=questionFor(lesson);
    assert.equal(lesson.version, CURRICULUM_VERSION);
    assert.equal(lesson.comments.length, 2);
    for (const c of lesson.comments) {
      assert.ok(c.en.length>25 && /^[\x20-\x7e]+$/.test(c.en));
      assert.match(c.ja, /[\u3040-\u9fff]/);
      assert.ok(lesson.code.includes(c.en));
      assert.equal(lesson.code.slice(c.start, c.end), c.en);
      assert.ok(!lesson.code.includes(c.ja));
    }
    assert.ok(Number.isSafeInteger(lesson.answer));
    assert.equal(new Set(question.choices).size,4);
    assert.equal(question.choices[question.answerIndex],lesson.answer);
    assert.deepEqual(questionFor(lesson),question);
    answerPositions.add(question.answerIndex);
    sortedPositions.add([...question.choices].sort((a,b)=>a-b).indexOf(lesson.answer));
  }
  assert.equal(answerPositions.size,4); assert.equal(sortedPositions.size,4);
  assert.equal(localeForComments('ja-JP'),'ja'); assert.equal(localeForComments('en-US'),'en');
});
test('reading is textbook-gated, pays only the first correct answer, and persists across reloads', () => {
  const s=createState(), lesson=readingLesson(s);
  assert.equal(answerReading(s,lesson.answer).kind,'textbook');
  assert.equal(Object.keys(s.reading.answers).length,0);
  s.items['book-syntax']=1;
  const result=answerReading(s,lesson.answer);
  assert.equal(result.kind,'correct'); assert.ok(result.amount>0);
  assert.equal(s.stats.study,READING_UNITS); assert.equal(s.stats.manual,0);
  const loaded=deserialize(serialize(s)), skill=loaded.skills.syntax;
  assert.equal(answerReading(loaded,lesson.answer).kind,'answered'); assert.equal(loaded.skills.syntax,skill);
  nextReading(loaded); assert.notEqual(readingLesson(loaded).baseId,lesson.baseId);
  assert.equal(loaded.stats.study,READING_UNITS);
  const next=readingLesson(loaded);
  assert.equal(answerReading(loaded,questionFor(next).choices.find(v=>v!==next.answer)).kind,'incorrect');
  assert.equal(answerReading(loaded,next.answer).kind,'answered');
  assert.equal(loaded.skills.syntax,skill,'an incorrect answer cannot be retried for credit');
  const restored=deserialize(serialize(loaded));
  assert.equal(readingLesson(restored).id,next.id); assert.equal(answerReading(restored,next.answer).kind,'answered');
});
test('reading exposes each subject separately, rejects malformed state, and retains answered questions in a new career', () => {
  const s=createState(); s.items['book-syntax']=1;
  for(let i=0;i<16;i++) {answerReading(s,readingLesson(s).answer);nextReading(s);}
  assert.equal(s.stats.study,16*READING_UNITS);
  assert.equal(answerReading(s,readingLesson(s).answer).kind,'answered');
  s.subject='design'; assert.equal(answerReading(s,readingLesson(s).answer).kind,'textbook');
  const raw=JSON.parse(serialize(s));raw.reading.answers.__proto__={evil:1};raw.reading.answers['cpp/syntax/invalid']=0;raw.reading.cursors['cpp/design']=1e20;
  const restored=deserialize(JSON.stringify(raw));
  assert.equal(Object.keys(restored.reading.answers).length,16); assert.equal(restored.reading.cursors['cpp/design'],undefined);
  s.runBest=2;s.runExperience={craft:5,design:2,audience:1}; const fresh=prestige(s); assert.ok(fresh);assert.deepEqual(fresh.reading,s.reading);
  assert.equal(answerReading(fresh,readingLesson(fresh).answer).kind,'textbook','reading credit remains answered while materials still gate access');
});
test('finite reading bonuses cannot bypass later knowledge requirements', () => {
  const s=createState();s.items['book-syntax']=1;
  for (const language of ['cpp','csharp','rust','go']) {
    s.typing.language=language;
    for(let i=0;i<16;i++){answerReading(s,readingLesson(s).answer);nextReading(s);}
  }
  assert.ok(s.skills.syntax>=12);
  assert.ok(s.skills.syntax<15,'finite reading credit must not bypass later requirements');
});
test('readiness agrees with real development at zero, exactly 50%, above 50%, and 100%', () => {
  const s=createState();s.mode='dev';
  for(const [value,stage,advances] of [[0,'learn',false],[6,'learn',false],[6.01,'prototype',true],[12,'ready',true]]) {
    s.skills.syntax=value;s.progress=0;s.debt=0;s.defects=0;
    assert.equal(developmentReadiness(s).stage,stage);
    assert.equal(validity(s)>0,advances);
    input(s,{chars:1});assert.equal(s.progress>0,advances);
    assert.equal(developmentReadiness(s).requirements[0].missing,Math.max(0,12-value));
  }
  s.progress=3000;assert.equal(developmentReadiness(s).stage,'complete');
  s.debt=100;assert.equal(developmentReadiness(s).stage,'complete');
  s.defects=100;assert.equal(developmentReadiness(s).stage,'repair');
  s.skills.syntax=5;assert.equal(developmentReadiness(s).stage,'repair');
});
test('completion notes refer to the finished English-comment exercise through next prompts and saves', () => {
  const s=createState();s.mode='study';const lesson=lessonAt('cpp','syntax',0), text=currentPrompt(s);
  assert.equal(text,lesson.code);assert.equal(s.typing.lastCompleted,null);
  const commentStart=text.indexOf(lesson.comments[0].en);
  for(const c of text.slice(0,commentStart))acceptCharacter(s,c);
  assert.equal(acceptCharacter(s,'あ').correct,false,'comments require exact English input');
  for(const c of text.slice(commentStart))acceptCharacter(s,c);
  assert.deepEqual(s.typing.lastCompleted,{version:2,language:'cpp',subject:'syntax',index:0});
  assert.notEqual(currentPrompt(s),text);
  const loaded=deserialize(serialize(s));
  assert.equal(lessonAt(loaded.typing.lastCompleted.language,loaded.typing.lastCompleted.subject,loaded.typing.lastCompleted.index).code,text);
});
test('unfinished legacy code remains exactly the same until its completion after an update', () => {
  const s=createState();s.mode='study';s.typing.curriculumVersion=1;s.typing.context='study/syntax/0';s.typing.offset=7;s.typing.bonusBase=7;
  const old=promptAt('cpp','syntax',0,1), raw=JSON.parse(serialize(s));delete raw.typing.curriculumVersion;
  const loaded=deserialize(JSON.stringify(raw));assert.equal(currentPrompt(loaded),old);assert.equal(loaded.typing.offset,7);
  for(const c of old.slice(7))assert.equal(acceptCharacter(loaded,c).correct,true);
  assert.equal(currentPrompt(loaded),lessonAt('cpp','syntax',1).code);assert.equal(loaded.typing.curriculumVersion,2);
  assert.equal(loaded.typing.lastCompleted,null,'legacy snippets must not display an unrelated new translation');
});
