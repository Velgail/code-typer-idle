import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../src/core.js';
import { LANGUAGES, currentPrompt, acceptCharacter, typingCommentProgress } from '../src/typing.js';
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
