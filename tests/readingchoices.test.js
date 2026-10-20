import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonAt,questionFor,TOPICS} from '../src/curriculum.js';
import {createState,SKILLS,answerReading,serialize,deserialize,prestige} from '../src/core.js';
import {isReadingChoice,readingChoiceLabel} from '../src/readingchoices.js';

test('health reading choices reflect actual state-update and bound confusions',()=>{
  const lesson=lessonAt('cpp','syntax',0),question=questionFor(lesson);
  assert.equal(lesson.answer,0);
  assert.deepEqual(new Set(question.choices),new Set([0,-8,100]));
  assert.match(question.options.find(option=>option.value===-8).reason,/代入|更新|変更/);
  assert.match(question.options.find(option=>option.value===100).reason,/上限|下限/);
  assert.ok(question.choices.every(value=>![-3,-2,-1].includes(value)),'nearby-number padding is absent');
});

test('SQL missing aggregates can distinguish NULL from zero without inventing a number',()=>{
  const question=questionFor(lessonAt('sql','syntax',8));
  assert.ok(question.choices.includes(null));
  assert.ok(question.choices.includes(0));
  assert.equal(readingChoiceLabel(null),'NULL');
  assert.match(question.options.find(option=>option.value===null).reason,/COALESCE|NULL|null/);
  const average=questionFor(lessonAt('sql','syntax',5));
  assert.ok(average.choices.includes(11.5),'ignoring CAST keeps the actual fractional average');
  assert.match(average.options.find(option=>option.value===11.5).reason,/CAST|小数/);
});

test('NULL and execution-outcome answers remain incorrect and locked across save and restart',()=>{
  const languages=['cpp','csharp','rust','go','python','java','sql','lua'];
  const fixtures=[{language:'sql',subject:'syntax',index:8,value:null},{language:'sql',subject:'syntax',index:5,value:11.5}];
  outer:for(const language of languages)for(const subject of Object.keys(TOPICS))for(let index=0;index<16;index++) {
    const question=questionFor(lessonAt(language,subject,index));
    const value=question.choices.find(value=>value==='runtime-error'||value==='compile-error');
    if(value){fixtures.push({language,subject,index,value});break outer;}
  }
  assert.equal(fixtures.length,3,'at least one genuine language-error misconception is available');
  for(const {language,subject,index,value} of fixtures) {
    const state=createState();state.mode='study';state.studyStyle='reading';state.typing.language=language;state.subject=subject;
    state.onlineMaterials=SKILLS.map(skill=>skill.id);state.reading.cursors[`${language}/${subject}`]=index;
    const lesson=lessonAt(language,subject,index);
    assert.equal(answerReading(state,value).kind,'incorrect');assert.equal(state.stats.study,0);
    const restored=deserialize(serialize(state));
    assert.ok(Object.hasOwn(restored.reading.answers,lesson.baseId));
    assert.equal(restored.reading.answers[lesson.baseId],value);
    assert.equal(answerReading(restored,lesson.answer).kind,'answered','reload never reopens the reward');
    restored.runBest=2;restored.runExperience={craft:5,design:2,audience:1};
    const restarted=prestige(restored);
    assert.ok(restarted);
    assert.equal(restarted.reading.answers[lesson.baseId],value);
    assert.equal(restarted.stats.study,0);
  }
  for(const bad of ['NULL','error','passed',undefined,{},NaN,Infinity])assert.equal(isReadingChoice(bad),false);
});
