import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../src/core.js';
import { LANGUAGES, currentPrompt, acceptCharacter, typingCommentProgress, typingCodeView } from '../src/typing.js';
import { lessonAt } from '../src/curriculum.js';
import { COURSE } from '../src/course.js';
import { installCourses } from '../src/courses.js';

test('each comment is revealed at its own correct final character and survives reload', () => {
  for (const { id: language } of LANGUAGES) {
    const state = createState();state.mode = 'study';state.inputStyle = 'typing';state.typing.language = language;
    const lesson = lessonAt(language, 'syntax', 0), prompt = currentPrompt(state);
    const comments = [...lesson.comments].sort((a, b) => a.end - b.end);
    let offset = 0;
    for (const [index, comment] of comments.entries()) {
      for (const char of prompt.slice(offset, comment.end - 1)) assert.ok(acceptCharacter(state, char).correct);
      assert.equal(typingCommentProgress(state).comments.length, index);
      assert.equal(acceptCharacter(state, prompt[comment.end - 1] === 'x' ? 'y' : 'x').correct, false);
      assert.equal(typingCommentProgress(state).comments.length, index, 'an incorrect final character cannot reveal the next translation');
      assert.ok(acceptCharacter(state, prompt[comment.end - 1]).correct);
      assert.equal(state.typing.completed, 0, 'translation must appear before the complete exercise');
      assert.equal(typingCommentProgress(state).comments.at(-1).ja, comment.ja);
      assert.deepEqual(typingCommentProgress(deserialize(serialize(state))).comments, typingCommentProgress(state).comments);
      offset = comment.end;
    }
    state.inputStyle = 'click';assert.deepEqual(typingCommentProgress(state).comments, []);
    state.inputStyle = 'typing';state.studyStyle = 'reading';assert.deepEqual(typingCommentProgress(state).comments, []);
    state.mode = 'work';assert.deepEqual(typingCommentProgress(state).comments, []);
  }
});

test('repeated comments, empty markers, string literals, and Unicode use exact source positions', () => {
  const en = '// Repeat.';
  const code = 'void sample() {\n    auto icon = "🎮";\n    auto text = "// Repeat.";\n    // Repeat.\n    //\n    // Repeat.\n}';
  const first = code.indexOf(en, code.indexOf('auto text') + 'auto text = "// Repeat.";'.length);
  const second = code.lastIndexOf(en);
  const unit = { ...COURSE.cpp.units[0], exercise: 0, file: 0, code, comments: [first, second].map(start => ({ en, ja: '繰り返す。', start, end: start + en.length })) };
  const track = { ...COURSE.cpp, units: [unit], exercises: [COURSE.cpp.exercises[0]], files: [COURSE.cpp.files[0]] };
  installCourses({ ...COURSE, cpp: track });
  try {
    const state = createState();state.mode = 'study';state.inputStyle = 'typing';state.typing.source = 'course';state.subject = unit.subject;state.typing.courseUnit = unit.id;
    currentPrompt(state);
    let offset = 0;
    for (const [end, count] of [[first + 2, 0], [first + en.length - 1, 0], [first + en.length, 1], [second + en.length - 1, 1], [second + en.length, 2]]) {
      for (const char of code.slice(offset, end)) assert.ok(acceptCharacter(state, char).correct);
      assert.equal(typingCommentProgress(state).comments.length, count);
      offset = end;
    }
  } finally { installCourses(COURSE); }
});

test('inline translation changes only the accepted display, keeping English validation and saved cursors',()=>{
 for(const {id:language} of LANGUAGES){
  const state=createState();state.mode='study';state.inputStyle='typing';state.typing.language=language;
  const lesson=lessonAt(language,'syntax',0),comment=lesson.comments[0],prompt=currentPrompt(state);
  for(const char of prompt.slice(0,comment.end-1))acceptCharacter(state,char);
  assert.equal(typingCodeView(state).typed.some(p=>p.translated),false);
  acceptCharacter(state,'あ');assert.equal(typingCodeView(state).typed.some(p=>p.translated),false);
  acceptCharacter(state,prompt[comment.end-1]);
  const before=structuredClone(state),view=typingCodeView(state);
  assert.ok(view.typed.some(p=>p.translated && p.text.includes(comment.ja)),language);
  assert.equal(currentPrompt(state),prompt);
  assert.deepEqual(state,before,'display changes must not award input or rewrite saves');
  assert.equal(state.typing.offset,comment.end);
  assert.deepEqual(typingCodeView(deserialize(serialize(state))),view);
  assert.equal(view.next,prompt[comment.end]);
  state.settings.commentLocale='en';assert.equal(typingCodeView(state).typed.map(p=>p.text).join(''),prompt.slice(0,comment.end));
  state.settings.commentLocale='ja';
  for(const char of prompt.slice(comment.end))assert.equal(acceptCharacter(state,char).correct,true);
  assert.equal(typingCodeView(state).typed.some(p=>p.translated),false,'the next prompt must not inherit translations');
 }
});

test('course comments keep their delimiters and replace only their exact occurrence',()=>{
 const cases=[
  ['// Return a value.','値を返す。','// 値を返す。'],
  ['/// Return a value.','値を返す。','/// 値を返す。'],
  ['//! Return a value.','値を返す。','//! 値を返す。'],
  ['# Return a value.','値を返す。','# 値を返す。'],
  ['-- Return a value.','値を返す。','-- 値を返す。'],
  ['/* Return a value. */','値を返す。','/* 値を返す。 */'],
  ['/** Return\n * a value.\n */','値を返す。','/** 値を返す。 */'],
  ['--[=[ Return\n a value. ]=]','値を返す。','--[=[ 値を返す。 ]=]'],
  ['"""Return\n a value."""','値を返す。','"""値を返す。"""'],
  ["r'''Return\n a value.'''",'値を返す。',"r'''値を返す。'''"],
  ['// Two lines.','1行目。\n2行目。','// 1行目。\n    // 2行目。']
 ];
 for(const [en,ja,expected] of cases){
  const prefix=`auto icon = "🎮"; auto literal = ${JSON.stringify(en)};\n    `;
  const code=prefix+en+'\nreturn 1;',start=prefix.length,end=start+en.length;
  const unit={...COURSE.cpp.units[0],exercise:0,file:0,code,comments:[{en,ja,start,end}]};
  installCourses({...COURSE,cpp:{...COURSE.cpp,units:[unit]}});
  try{
   const state=createState();state.mode='study';state.inputStyle='typing';state.typing.source='course';state.subject=unit.subject;state.typing.courseUnit=unit.id;
   currentPrompt(state);for(const char of code.slice(0,end))assert.equal(acceptCharacter(state,char).correct,true);
   const view=typingCodeView(state);
   assert.equal(view.typed.map(p=>p.text).join(''),prefix+expected);
   assert.equal(view.pending,code.slice(end+1));assert.equal(view.next,'\n');
   assert.equal(currentPrompt(state),code);
  }finally{installCourses(COURSE);}
 }
});

test('a previous lastCourseComments field cannot carry translations into another prompt',()=>{
 const state=createState();state.mode='study';state.inputStyle='typing';
 state.typing.lastCourseComments=COURSE.cpp.units.find(u=>u.comments.length).id;
 const loaded=deserialize(serialize(state));
 assert.equal(Object.hasOwn(loaded.typing,'lastCourseComments'),false);
 assert.equal(typingCodeView(loaded).typed.some(p=>p.translated),false);
});
