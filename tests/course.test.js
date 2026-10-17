import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE} from '../src/course.js';
import {installCourses,courseLesson,courseUnit,firstCourseUnit,validCourseId,rememberCourseCursor,needsLegacyCourses,installLegacyCourses,nextCourseUnit} from '../src/courses.js';
import {COURSE as LEGACY_COURSE} from '../docs/build/course.a422c81794d07a40.js';
import {learningGuide} from '../src/learningguide.js';
import {createState,serialize,deserialize,input} from '../src/core.js';
import {currentPrompt,acceptCharacter,TYPING_REWARD} from '../src/typing.js';
installCourses(COURSE);
test('the pinned course keeps exercise context, prerequisites, source and translated comments',()=>{
 let exercises=0,blocks=0;const ids=new Set(),keys=new Set();
 for(const [language,track] of Object.entries(COURSE)) {
  exercises+=track.exercises.length;blocks+=track.units.length;
  assert.ok(track.exercises.length>=75,language);
  for(const exercise of track.exercises){assert.match(exercise.purposeJa,/[\u3040-\u9fff]/);assert.ok(exercise.setup.length);assert.ok(exercise.units.length);}
  for(const unit of track.units){
   assert.ok(validCourseId(unit.id));assert.ok(!ids.has(unit.id));ids.add(unit.id);
   assert.ok(!keys.has(unit.key));keys.add(unit.key);
   const e=track.exercises[unit.exercise],file=track.files[unit.file];assert.ok(e&&file);
   assert.ok(e.units.includes(track.units.indexOf(unit)));assert.ok(unit.code.length>0 && unit.code.length<8192);assert.doesNotMatch(unit.code,/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/);
   assert.ok(file.url.includes(track.sha));assert.ok(Array.isArray(e.prerequisites));
   for(const c of unit.comments){assert.ok(c.en.length);assert.match(c.ja,/[\u3040-\u9fff]/);assert.equal(unit.code.slice(c.start,c.end),c.en);assert.ok(!/^[\s/*#-]+$/.test(c.en));}
  }
 }
 assert.equal(exercises,1062);assert.ok(blocks>exercises);
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
 const track=COURSE.python;const e=track.exercises.find(e=>e.slug==='guidos-gorgeous-lasagna');const units=e.units.map(i=>track.units[i]);assert.ok(units.length);
 const notes=units.flatMap(u=>u.comments);assert.ok(notes.some(c=>c.en.includes('Calculate the bake time remaining') && c.ja.includes('残りの焼き時間')));
});

const exerciseUnits=(language,slug)=>{
 const track=COURSE[language],exercise=track.exercises.find(e=>e.slug===slug);
 assert.ok(exercise,`${language}/${slug}`);
 return {exercise,units:exercise.units.map(i=>track.units[i])};
};
test('implementation lessons keep ownership, closures and central declarations',()=>{
 const last=exerciseUnits('cpp','last-will');
 assert.equal(last.units.length,1);assert.match(last.units[0].code,/namespace estate_executor/);
 assert.doesNotMatch(last.units[0].code,/int code_fragment\(\)/);
 const guide=learningGuide({...last.units[0],language:'cpp',exerciseInfo:last.exercise});
 assert.match(guide.bindings.find(b=>b.name==='secret_modifier').meaning,/口座番号.*補正値/);
 assert.ok(last.exercise.setup.some(f=>f.code.includes('int code_fragment()')));
 const lua=exerciseUnits('lua','robot-simulator');
 assert.match(lua.units[0].code,/R = \{\s+north = function\(self\)/);
 const robotGuide=learningGuide({...lua.units[0],language:'lua',exerciseInfo:lua.exercise});
 assert.equal(robotGuide.bindings.filter(b=>b.name==='self').length,1);
 assert.ok(robotGuide.bindings.slice(0,6).some(b=>b.name==='commands'));
 const python=exerciseUnits('python','space-age');
 const converter=python.units.find(u=>u.code.includes('def period_converter'));
 assert.match(converter.code,/def inner\(self\)/);
 assert.ok(python.units.some(u=>u.code.includes('on_mercury = period_converter')));
 assert.ok(!python.units.some(u=>u.code.trim().startsWith('def inner')));
 assert.ok(exerciseUnits('csharp','logs-logs-logs').units.some(u=>u.code.includes('enum LogLevel')));
 const weather=exerciseUnits('go','weather-forecast');
 assert.ok(weather.units.some(u=>u.code.includes('// CurrentCondition describes')));
 assert.ok(weather.units.some(u=>u.code.includes('// Forecast returns')));
 const ocr=exerciseUnits('rust','ocr-numbers');
 for(const unit of ocr.units)if(unit.code.includes('#[derive'))assert.match(unit.code,/(struct|enum) /);
 assert.match(exerciseUnits('rust','matching-brackets').units.map(u=>JSON.stringify(u.scope)).join('\n'),/From<Vec<\(char, char\)>> for MatchingBrackets/);
});
test('SQL schema and import commands remain context instead of separate input exercises',()=>{
 const {exercise,units}=exerciseUnits('sql','nucleotide-count');
 assert.ok(exercise.setup.some(f=>f.code.includes('CREATE TABLE')));
 assert.ok(units.every(u=>!/^\s*\.(import|mode)/m.test(u.code)));
 assert.ok(units.every(u=>!/^\s*DROP TABLE\b[^;]*;\s*$/i.test(u.code)));
 const hello=exerciseUnits('sql','hello-world');
 assert.ok(hello.exercise.setup.some(f=>f.code.includes('CREATE TABLE')));
});
test('identifier hints do not assume coordinates or characters from an ambiguous name',()=>{
 const make=(language,slug,code,name)=>learningGuide({language,code,exerciseInfo:{slug,purposeJa:'用途'},bindings:[{name,kind:'parameter'}]});
 assert.doesNotMatch(make('go','luhn','x * 2','x').bindings[0].meaning,/横/);
 assert.match(make('go','dnd-character','character.Health','character').bindings[0].meaning,/RPG/);
 assert.equal(make('cpp','unrelated','int x','x').bindings[0].meaning,'呼び出し側から渡す引数');
});
test('an unfinished published course retains exact text and cursor through the archive upgrade',()=>{
 const old=LEGACY_COURSE.cpp.units.find(u=>COURSE.cpp.legacyTargets[u.id]);
 installCourses(LEGACY_COURSE);
 const state=createState();state.mode='study';state.studyStyle='course';state.typing.source='course';state.subject=old.subject;state.items[`book-${old.subject}`]=1;state.typing.courseUnit=old.id;
 const text=currentPrompt(state);for(const char of text.slice(0,7))acceptCharacter(state,char);
 rememberCourseCursor(state);const raw=serialize(state),bonus=state.typing.bonusBase;
 installCourses(COURSE);const loaded=deserialize(raw);assert.equal(needsLegacyCourses(loaded),true);
 installLegacyCourses(LEGACY_COURSE);assert.equal(needsLegacyCourses(loaded),false);
 assert.equal(currentPrompt(loaded),text);assert.equal(loaded.typing.offset,7);assert.equal(loaded.typing.bonusBase,bonus);
 assert.equal(courseLesson(old.id).legacy,true);
 for(const char of text.slice(7))assert.equal(acceptCharacter(loaded,char).correct,true);
 assert.equal(loaded.typing.lastCompleted.courseUnit,old.id);
 assert.equal(loaded.typing.courseUnit,COURSE.cpp.legacyTargets[old.id]);
 assert.equal(courseUnit(loaded.typing.courseUnit).legacy,undefined);
 assert.equal(loaded.typing.courseCursors[`cpp/${old.subject}`].bonusBase,0);
 assert.equal(nextCourseUnit(courseUnit(old.id)).id,loaded.typing.courseUnit);
 installCourses(COURSE);
});
