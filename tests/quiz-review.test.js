import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, input, serialize, deserialize, prestige, openOnlineMaterial, answerReading, readingLesson } from '../src/core.js';
import { currentPrompt, acceptCharacter, completedLesson, normalizeTypingState } from '../src/typing.js';
import { CURRICULUM_VERSION, lessonAt } from '../src/curriculum.js';
import { installCourses, currentCourseUnit } from '../src/courses.js';
import { COURSE } from '../src/course.js';

function copy(s,index=0){
  s.typing.index=index;s.typing.context='';
  const source=currentPrompt(s);
  for(const char of source)assert.equal(acceptCharacter(s,char).correct,true);
  return source;
}
test('only a complete copy unlocks its exact language, subject and topic, retaining the actual variant',()=>{
  const s=createState();s.mode='study';s.inputStyle='typing';s.typing.language='lua';
  const lesson=lessonAt('lua','syntax',16);s.typing.index=16;
  const prompt=currentPrompt(s);
  for(const char of prompt.slice(0,-1))acceptCharacter(s,char);
  assert.equal(completedLesson(s,lesson.baseId),null);
  assert.equal(acceptCharacter(s,'!').correct,false);assert.equal(completedLesson(s,lesson.baseId),null);
  assert.equal(acceptCharacter(s,prompt.at(-1)).complete,true);
  assert.equal(completedLesson(s,lesson.baseId).code,lesson.code);
  assert.equal(completedLesson(s,lessonAt('lua','syntax',1).baseId),null);
  assert.equal(completedLesson(s,lessonAt('lua','design',0).baseId),null);
  assert.equal(completedLesson(s,lessonAt('cpp','syntax',0).baseId),null);
  copy(s,1);assert.equal(completedLesson(s,lesson.baseId).index,16,'later copies do not erase earlier topics');
  copy(s,32);assert.equal(completedLesson(s,lesson.baseId).index,32,'recopying retains the most recent actual variant');
});
test('clicking, automation, office typing and reading do not count as copying code',()=>{
  const s=createState();copy(s);
  s.mode='study';openOnlineMaterial(s);input(s,{chars:500});input(s,{chars:500,automation:true});
  answerReading(s,readingLesson(s).answer);
  assert.deepEqual(s.typing.completedLessons,{});
  assert.equal(completedLesson(s,lessonAt('cpp','syntax',0).baseId),null);
});
test('course completion retains its own record without impersonating a matching original lesson',()=>{
  installCourses(COURSE);
  const s=createState();s.mode='study';s.inputStyle='typing';s.studyStyle='course';s.typing.source='course';
  const unit=currentCourseUnit(s);
  copy(s);
  assert.ok(s.typing.courseCompleted.includes(unit.key));assert.deepEqual(s.typing.completedLessons,{});
});
test('copy records survive reload and prestige without rewards or stored source text',()=>{
  const s=createState();s.mode='dev';s.inputStyle='typing';copy(s,0);
  const lesson=lessonAt('cpp','syntax',0), before=structuredClone(s);
  completedLesson(s,lesson.baseId);assert.deepEqual(s,before,'looking up a completed lesson changes nothing');
  const loaded=deserialize(serialize(s));assert.deepEqual(loaded.typing.completedLessons,s.typing.completedLessons);
  assert.deepEqual(loaded.typing.completedLessons[lesson.baseId],{version:CURRICULUM_VERSION,index:0});
  loaded.runBest=2;loaded.runExperience.craft=1;
  const fresh=prestige(loaded);assert.ok(fresh);assert.equal(completedLesson(fresh,lesson.baseId).code,lesson.code);
});
test('legacy saves restore only the last proven original lesson, never earlier topics or course units',()=>{
  const s=createState();s.mode='study';copy(s,0);copy(s,1);
  const first=lessonAt('cpp','syntax',0),last=lessonAt('cpp','syntax',1);
  delete s.typing.completedLessons;
  const loaded=deserialize(serialize(s));assert.equal(completedLesson(loaded,first.baseId),null);
  assert.equal(completedLesson(loaded,last.baseId).index,1);
  s.typing.lastCompleted={version:1,language:'cpp',subject:'syntax',index:0};
  assert.deepEqual(normalizeTypingState(s.typing).completedLessons,{});
  s.typing.lastCompleted={version:CURRICULUM_VERSION,courseUnit:COURSE.cpp.units[0].id};
  assert.deepEqual(normalizeTypingState(s.typing).completedLessons,{});
});
test('saved copy IDs, curriculum versions and topic indices are checked before displaying a lesson',()=>{
  const id=lessonAt('cpp','syntax',0).baseId;
  for(const record of [{version:1,index:0},{version:CURRICULUM_VERSION,index:1},{version:CURRICULUM_VERSION,index:256},{version:CURRICULUM_VERSION,index:'0'},null]){
    const typing=normalizeTypingState({completedLessons:{[id]:record}});
    assert.deepEqual(typing.completedLessons,{});
  }
  const typing=normalizeTypingState({completedLessons:{[id]:{version:CURRICULUM_VERSION,index:16},unknown:{version:CURRICULUM_VERSION,index:0}}});
  assert.deepEqual(typing.completedLessons,{[id]:{version:CURRICULUM_VERSION,index:16}});
});
