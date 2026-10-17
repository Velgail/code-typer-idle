import assert from 'node:assert/strict';
import { createState } from '../src/core.js';
import { lessonAt } from '../src/curriculum.js';
import { COURSE } from '../src/course.js';

// Exercise the actual input element at the last character of a comment, before
// the rest of the code is complete. Whole-exercise checks miss this boundary.
export async function verifyCommentTranslations(browser, url, errors) {
  const cases = Object.keys(COURSE).flatMap(language => [
    { language, source: 'standard', lesson: lessonAt(language, 'syntax', 0) },
    { language, source: 'course', lesson: COURSE[language].units.find(unit => unit.comments.some(c => c.end < unit.code.length)) }
  ]);
  cases.push({ language: 'rust', source: 'course', lesson: COURSE.rust.units.find(unit => unit.comments.length >= 8 && unit.comments.at(-1).end < unit.code.length - 1), checkScroll: true });
  cases.push({ language: 'python', source: 'course', lesson: COURSE.python.units.find(unit => unit.comments.length === 1 && unit.code.endsWith(unit.comments[0].en)), completes: true });
  for (const { language, source, lesson, completes = false, checkScroll = false } of cases) {
    assert.ok(lesson, `${language}/${source} needs a real comment fixture`);
    const context = await browser.newContext({ viewport: checkScroll ? { width: 390, height: 450 } : { width: 1100, height: 1000 } });
    try {
      const data = createState();
      Object.assign(data, { mode: 'study', inputStyle: 'typing', studyStyle: source === 'course' ? 'course' : 'practice', subject: lesson.subject || 'syntax' });
      Object.assign(data.typing, { language, source, courseUnit: source === 'course' ? lesson.id : '' });
      for (const subject of ['syntax', 'design', 'graphics', 'systems']) data.items[`book-${subject}`] = 1;
      await context.addInitScript(data => {
        if (!sessionStorage.getItem('comment-test-seeded')) {
          localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data));
          sessionStorage.setItem('comment-test-seeded', '1');
        }
      }, data);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForSelector('#typing-input:not([hidden])');
      assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'), lesson.code);
      const comments = [...lesson.comments].sort((a, b) => a.end - b.end);
      const first = comments[0];
      const type = async text => {
        for (const piece of text.split(/(\t|\n)/)) {
          if (piece === '\t') await page.keyboard.press('Tab');
          else if (piece === '\n') await page.keyboard.press('Enter');
          else if (piece) await page.keyboard.type(piece);
        }
      };
      const enter = async text => {
        await page.locator('#typing-input').click();
        await page.keyboard.press('Control+End');
        await type(text);
      };
      await enter(lesson.code.slice(0, first.end - 1));
      await page.locator('#typing-input').evaluate(el => el.scrollIntoView({ block: 'end', behavior: 'instant' }));
      assert.equal(await page.locator('#typing-comment-notes [lang=ja]').count(), 0, `${language}/${source}: an unfinished comment must stay untranslated`);
      if (language === 'cpp' && source === 'standard') {
        await page.keyboard.type(lesson.code[first.end - 1] === 'x' ? 'y' : 'x');
        assert.equal(await page.locator('#typing-comment-notes [lang=ja]').count(), 0, 'an incorrect final character must not reveal a translation');
        await page.keyboard.press('Backspace');
      }
      await type(lesson.code.slice(first.end - 1, first.end));
      assert.equal(await page.locator('#typing-comment-notes').isVisible(), true, `${language}/${source}: the translation must appear on the comment's last character`);
      assert.ok((await page.locator('#typing-comment-notes').textContent()).includes(first.ja), `${language}/${source}: show this comment's Japanese translation`);
      assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'revealing translations must retain typing focus');
      assert.equal(await page.locator('#typing-input').evaluate(el => el.selectionStart), completes ? 0 : first.end, 'translation rendering must preserve the input caret');
      const inputBox = await page.locator('#typing-input').boundingBox();
      assert.ok(inputBox.y >= -1 && inputBox.y + inputBox.height <= page.viewportSize().height + 1, 'adding a translation must keep the focused input inside the viewport');
      if (completes) assert.notEqual(await page.locator('#editor-content').getAttribute('data-prompt'), lesson.code);
      else assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'), lesson.code);
      assert.match(await page.locator('#typing-completed').textContent(), completes ? /1問/ : /0問/);
      await page.locator('#save-button').click();
      await page.reload();
      await page.waitForSelector('#typing-comment-notes:not(.hidden)');
      assert.ok((await page.locator('#typing-comment-notes').textContent()).includes(first.ja), 'the translation must survive saving and reloading');
      if (checkScroll) {
        let offset = first.end;
        for (const comment of comments.slice(1)) {
          await enter(lesson.code.slice(offset, comment.end));offset = comment.end;
          const panel = await page.locator('#typing-comment-notes').boundingBox(), latest = await page.locator('#typing-comment-notes p:last-child').boundingBox();
          assert.ok(latest.y >= panel.y - 1 && latest.y < panel.y + panel.height, 'the latest translation must be visible inside the notes panel');
        }
        await page.locator('#typing-comment-notes').evaluate(el => { el.scrollTop = 0; });
        const code = await page.locator('#editor-content').getAttribute('data-prompt'), draft = await page.locator('#typing-input').inputValue();
        await enter(code.slice(draft.length, draft.length + 1));
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#typing-comment-notes').evaluate(el => el.scrollTop), 0, 'ordinary input and periodic rendering must preserve manual note scrolling');
      }
      if (language === 'cpp' && source === 'standard') {
        await page.locator('#settings-button').click();
        await page.locator('#comment-locale-setting').selectOption('en');
        assert.equal(await page.locator('#typing-comment-notes [lang=ja]').count(), 0);
        assert.ok((await page.locator('#typing-comment-notes [lang=en]').textContent()).includes(first.en));
        await page.locator('#comment-locale-setting').selectOption('ja');
        await page.locator('#modal-close').click();
        const second = comments[1];
        await enter(lesson.code.slice(first.end, second.end - 1));
        assert.equal(await page.locator('#typing-comment-notes [lang=ja]').count(), 1, 'later comments must remain untranslated until complete');
        await enter(lesson.code.slice(second.end - 1, second.end));
        assert.equal(await page.locator('#typing-comment-notes [lang=ja]').count(), 2);
        await enter(lesson.code.slice(second.end));
        assert.ok((await page.locator('#typing-comment-notes').textContent()).includes(second.ja), 'advancing to the next exercise must keep the completed translations available');
        await page.locator('[data-study-style=reading]').click();
        assert.equal(await page.locator('#typing-comment-notes').isVisible(), false);
        await page.locator('[data-study-style=practice]').click();
        await page.locator('[data-input-style=click]').click();
        assert.equal(await page.locator('#typing-comment-notes').isVisible(), false);
        await page.locator('[data-input-style=typing]').click();
      }
      if (language === 'cpp' || language === 'python') {
        await page.setViewportSize({ width: 390, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'translations must fit mobile widths');
        const notes = await page.locator('#typing-comment-notes').boundingBox(), field = await page.locator('#typing-input').boundingBox();
        assert.ok(notes.y + notes.height <= field.y, 'translations must be beside the input, above the text field');
      }
    } finally { await context.close(); }
  }
  console.log('Comment translation checks passed: last-character boundaries in all eight languages and both curricula, wrong input, multiline docstrings, completion, locale, save/reload, focus, and mobile layout.');
}
