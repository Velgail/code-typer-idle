import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE} from '../src/course.js';
import {installCourses,courseLesson,courseUnit,firstCourseUnit,validCourseId,rememberCourseCursor} from '../src/courses.js';
import {createState,serialize,deserialize,input} from '../src/core.js';
import {currentPrompt,acceptCharacter,TYPING_REWARD} from '../src/typing.js';
installCourses(COURSE);
test('the pinned course keeps exercise context, prerequisites, source and translated comments',()=>{
 let exercises=0,functions=0,blocks=0;const ids=new Set(),keys=new Set();
 for(const [language,track] of Object.entries(COURSE)) {
  exercises+=track.exercises.length;functions+=track.functionCount;blocks+=track.units.length;
  assert.ok(track.exercises.length>=75,language);
  for(const unit of track.units){
   assert.ok(validCourseId(unit.id));assert.ok(!ids.has(unit.id));ids.add(unit.id);
   assert.ok(!keys.has(unit.key));keys.add(unit.key);
   const e=track.exercises[unit.exercise],file=track.files[unit.file];assert.ok(e&&file);
   assert.ok(e.units.includes(track.units.indexOf(unit)));assert.ok(unit.code.length>0 && unit.code.length<8192);
   assert.ok(file.url.includes(track.sha));assert.ok(Array.isArray(e.prerequisites));
   for(const c of unit.comments){assert.ok(c.en.length);assert.match(c.ja,/[\u3040-\u9fff]/);}
  }
 }
 assert.ok(exercises>=1000);assert.ok(functions>=4500);assert.ok(blocks>=6000);
});
test('course typing keeps its precise cursor and credits through saves and records completion',()=>{
 for(const language of Object.keys(COURSE)){
  const s=createState();s.mode='study';s.studyStyle='course';s.typing.source='course';s.typing.language=language;s.items['book-syntax']=1;
  const lesson=firstCourseUnit(language,'syntax');assert.ok(lesson,language);s.typing.courseUnit=lesson.id;
  const text=currentPrompt(s);assert.equal(text,lesson.code);
  for(const c of [...text].slice(0,5))assert.ok(acceptCharacter(s,c).correct);
  const loaded=deserialize(serialize(s));assert.equal(currentPrompt(loaded),text);assert.equal(loaded.studyStyle,'course');assert.equal(loaded.typing.offset,s.typing.offset);
  const before=loaded.typing.offset;
  for(const c of text.slice(before)){const r=acceptCharacter(loaded,c);assert.ok(r.correct,language);input(loaded,{chars:TYPING_REWARD.character});}
  assert.equal(loaded.typing.lastCompleted.courseUnit,lesson.id);assert.ok(loaded.typing.courseCompleted.includes(lesson.key));
  assert.equal(courseLesson(loaded.typing.lastCompleted.courseUnit).code,text);
  assert.notEqual(loaded.typing.courseUnit,lesson.id);assert.ok(courseUnit(loaded.typing.courseUnit));
 }
});
test('all course progress fits the existing portable save limit',()=>{
 const s=createState();s.typing.courseCompleted=Object.values(COURSE).flatMap(t=>t.units.map(u=>u.key));
 const raw=serialize(s);assert.ok(raw.length<200000);assert.equal(deserialize(raw).typing.courseCompleted.length,s.typing.courseCompleted.length);
});
test('a character outside the BMP can be typed without splitting its surrogate pair',()=>{
 const s=createState();s.mode='study';s.typing.source='course';s.typing.language='java';
 const unit=COURSE.java.units.find(u=>[...u.code].some(c=>c.length===2));
 if(!unit)return;
 s.subject=unit.subject;s.typing.courseUnit=unit.id;
 const text=currentPrompt(s);for(const c of text)assert.equal(acceptCharacter(s,c).correct,true);
 assert.equal(s.typing.lastCompleted.courseUnit,unit.id);
});

test('completed course bonuses cannot be replayed from an old suspended cursor',()=>{
 const s=createState();s.mode='study';s.typing.source='course';s.studyStyle='course';const u=firstCourseUnit('cpp','syntax');s.typing.courseUnit=u.id;
 const text=currentPrompt(s);for(const c of text.slice(0,-1))acceptCharacter(s,c);rememberCourseCursor(s);
 acceptCharacter(s,text.at(-1));assert.equal(s.typing.courseCursors['cpp/syntax'].bonusBase,0);
 s.typing.courseUnit=u.id;s.typing.context='';assert.equal(currentPrompt(s),text);assert.equal(s.typing.offset,0);assert.equal(s.typing.bonusBase,0);
});
test('a course can resume its selection and partial input after subject and language changes',()=>{
 const s=createState();s.mode='study';s.typing.source='course';s.studyStyle='course';const u=COURSE.cpp.units.filter(u=>u.subject==='syntax')[5];s.typing.courseUnit=u.id;
 const text=currentPrompt(s);for(const c of text.slice(0,5))acceptCharacter(s,c);rememberCourseCursor(s);
 s.subject='design';currentPrompt(s);rememberCourseCursor(s);s.subject='syntax';assert.equal(currentPrompt(s),text);assert.equal(s.typing.offset,5);
 rememberCourseCursor(s);s.typing.language='go';currentPrompt(s);rememberCourseCursor(s);s.typing.language='cpp';assert.equal(currentPrompt(s),text);assert.equal(s.typing.offset,5);
 const loaded=deserialize(serialize(s));assert.equal(currentPrompt(loaded),text);assert.equal(loaded.typing.offset,5);
});
test('Python docstrings receive notes when their closing part is completed',()=>{
 const units=COURSE.python.units.filter(u=>u.label==='bake_time_remaining');assert.ok(units.length>=2);
 const notes=units.flatMap(u=>u.comments);assert.ok(notes.some(c=>c.en.includes('Calculate the bake time remaining') && c.ja.includes('残りの焼き時間')));
});
