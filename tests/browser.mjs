// Optional UI verification. Install Playwright for development, not for hosting.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createState, projectAt, handPower, BALANCE_VERSION } from '../src/core.js';
import { COURSE } from '../src/course.js';
import { lessonAt, questionFor } from '../src/curriculum.js';
import { verifyCommentTranslations } from './comment-translations.mjs';
import { verifyClickKeyboardGuard } from './keyboard-clicks.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve('docs');
const currentRelease = JSON.parse(await readFile(resolve(root, 'version.json'), 'utf8'));
const nextVersion = `${currentRelease.version}+cache-test`;
const nextId = currentRelease.id === 'ffffffffffffffff' ? 'eeeeeeeeeeeeeeee' : 'ffffffffffffffff';
let nextDeployment = false, legacyHTML = false;
const requests = [];
let server;
const url = process.env.CTI_TEST_URL || await new Promise(resolveUrl => {
  server = createServer(async (req, res) => {
    try {
      const requested = new URL(req.url, 'http://local');
      const pathname = decodeURIComponent(requested.pathname);
      requests.push(req.url);
      const path = resolve(root, `.${pathname.replace(nextId, currentRelease.id)}` + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!path.startsWith(root + '/')) throw Error('Invalid path');
      let data = await readFile(path);
      if (pathname.endsWith('/') && legacyHTML && !requested.searchParams.has('v')) data = Buffer.from('<!doctype html><html lang="ja"><body>Cached legacy HTML<script type="module" src="./js/app.js"></script></body></html>');
      else if ((nextDeployment && (pathname.endsWith('/') || pathname.endsWith('/version.json'))) || pathname.includes(nextId)) data = Buffer.from(data.toString().replaceAll(currentRelease.id, nextId).replaceAll(currentRelease.version, nextVersion));
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }[extname(path)] || 'text/plain', 'Cache-Control': 'public, max-age=31536000, immutable' }); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  }).listen(0, '127.0.0.1', () => resolveUrl(`http://127.0.0.1:${server.address().port}`));
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
const errors = [];
try {
  await verifyClickKeyboardGuard(browser, url, errors);
  await verifyCommentTranslations(browser, url, errors);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForSelector('.buy-button');
  const firstButton = await page.locator('#type-button').boundingBox();
  assert.ok(firstButton.y >= 0 && firstButton.y + firstButton.height <= 1100, 'a new player must be able to start working in the first desktop viewport');
  assert.match(await page.title(), /Code Typer Idle/);
  assert.equal(await page.getByText('ここで使うのは、ゲーム内のお金だけ。', { exact: true }).count(), 0);
  assert.equal(await page.locator('.local-tag').count(), 0);
  assert.equal(await page.locator('#cash').textContent(), '¥100');
  assert.match(await page.locator('#living').textContent(), /¥0/);
  assert.equal(await page.locator('#bill-next').textContent(), '契約・支払いなし');
  await page.locator('#help-button').click();
  assert.equal(await page.locator('.help-section').count(), 7);
  assert.match(await page.locator('#modal-body').textContent(), /教材.*プログラミング基礎教本.*写経・学習/s);
  assert.match(await page.locator('#modal-body').textContent(), /リファクタリングに切替/);
  assert.match(await page.locator('#modal-body').textContent(), /セーブを書き出す/);
  assert.doesNotMatch(await page.locator('#modal-body').textContent(), /FIRST RUN|BALANCE|3〜7日|300打鍵|旧セーブは/);
  await page.locator('#modal-close').click();
  await page.locator('#type-button').click();
  await page.keyboard.type('arbitrary_keyboard_spam_');
  await page.locator('h1').click();
  await page.keyboard.type('2026');
  await page.locator('#save-button').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(saved.cash, 100); assert.equal(saved.job.progress, 1, 'arbitrary keys must never produce rewards');
  assert.equal(saved.mode, 'work', 'typing a year outside the input must never switch to the study tab');
  await page.locator('[data-mode=work]').click();
  await page.getByRole('textbox', { name: '伝票データ入力' }).click();
  assert.equal(await page.locator('[data-input-style=typing]').getAttribute('aria-pressed'), 'true', 'clicking the input must start typing without a mode-selector prerequisite');
  assert.equal(await page.locator('#typing-input').isVisible(), true);
  await page.locator('[data-mode=study]').click();
  await page.locator('[data-mode=work]').click();
  assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'switching task tabs must restore typing focus');
  const prompt = await page.locator('#editor-content').getAttribute('data-prompt');
  const wrong = prompt[0] === 'x' ? 'y' : 'x';
  await page.keyboard.type(wrong);
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /);
  assert.equal(await page.locator('#cash').textContent(), '¥100');
  assert.equal(await page.locator('#typing-input').inputValue(), wrong.toUpperCase(), 'incorrect text must remain visible and editable');
  assert.match(await page.locator('#input-feedback').textContent(), /伝票番号/);
  await page.keyboard.press('Backspace');
  assert.equal(await page.locator('#typing-input').inputValue(), '');
  // Programmatic clipboard events exercise the real paste/beforeinput guards.
  await page.locator('#typing-input').evaluate(el => {
    const clipboard = new DataTransfer(); clipboard.setData('text/plain', 'injected paste');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
    el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', data: 'injected paste', bubbles: true, cancelable: true }));
  });
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ｉｎｖ', selectionStart: 3, selectionEnd: 3 });
  await page.waitForTimeout(350); // At least one render must leave the IME draft intact.
  assert.equal(await page.locator('#typing-input').inputValue(), 'ｉｎｖ');
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /, 'uncommitted IME text must not pay');
  await cdp.send('Input.insertText', { text: 'ｉｎｖ' });
  assert.equal(await page.locator('#typing-input').inputValue(), 'INV');
  assert.match(await page.locator('#typing-round').textContent(), /^3 \/ /, 'committed IME text must count exactly once');
  await cdp.send('Input.imeSetComposition', { text: 'ｘ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  assert.equal(await page.locator('#typing-input').inputValue(), 'INV');
  assert.match(await page.locator('#typing-round').textContent(), /^3 \/ /, 'cancelling composition must not credit its draft');
  const dateStart = prompt.indexOf(',') + 1;
  await page.keyboard.type(prompt.slice(3, dateStart));
  await page.locator('#office-image').click();
  assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'reading the invoice image must preserve typing focus');
  await page.keyboard.type('2026');
  assert.equal(await page.locator('[data-mode=work]').getAttribute('aria-selected'), 'true');
  assert.match(await page.locator('#typing-round').textContent(), new RegExp(`^${dateStart + 4} / `));
  const lines = prompt.slice(dateStart + 4).split('\n');
  for (let line = 0; line < lines.length; line++) {
    if (line) {
      await page.keyboard.press('Enter');
      assert.match(await page.locator('#editor-cursor').textContent(), new RegExp(`Ln ${line + 1}, Col 1`));
    }
    await page.keyboard.type(lines[line]);
  }
  assert.match(await page.locator('#typing-completed').textContent(), /1問/);
  await page.locator('#save-button').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(saved.typing.correct, prompt.length);
  assert.equal(saved.typing.errors, 1);
  const workValue = saved.cash + saved.job.progress * saved.job.rate;
  assert.ok(workValue > 101 + prompt.length * 1.5);
  assert.ok(workValue < 101 + prompt.length * 2.25, 'a mistake reduces the completion bonus');
  assert.ok(Math.abs(await page.locator('#job-progress-bar').evaluate(el => el.value) - saved.job.progress) < 0.01, 'the progress beside the input must show the work still awaiting delivery');
  assert.match(await page.locator('#job-payment').textContent(), /¥100/);
  assert.equal(saved.mode, 'work', 'digits within a prompt must not trigger mode shortcuts');
  // Holding a correct key advances once; repeated keydown is rejected.
  const secondPrompt = await page.locator('#editor-content').getAttribute('data-prompt');
  await page.locator('#typing-input').click();
  await page.keyboard.down(secondPrompt[0]);
  await page.keyboard.down(secondPrompt[0]);
  await page.keyboard.up(secondPrompt[0]);
  assert.match(await page.locator('#typing-round').textContent(), /^1 \/ /);
  // Office jobs use image invoices, while study/development use programming languages.
  assert.equal(saved.skills.syntax, 0, 'office typing must not grant programming knowledge');
  assert.equal(await page.locator('#office-source').isVisible(), true);
  assert.equal(await page.locator('#language-select').isVisible(), false);
  assert.equal(await page.locator('#editor-content').textContent(), prompt[0] + '▌', 'office output must not show a completed CSV answer');
  await page.locator('h1').click();
  await page.keyboard.type('1232026');
  assert.equal(await page.locator('[data-mode=work]').getAttribute('aria-selected'), 'true', 'digits must never be tab shortcuts after typing focus is lost');
  assert.match(await page.locator('#typing-round').textContent(), /^1 \/ /);
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Office source fits ${width}px`);
  }
  await page.screenshot({ path: 'work/office-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('[data-mode=study]').click();
  assert.equal(await page.locator('#office-source').isVisible(), false);
  assert.equal(await page.locator('#study-lock').isVisible(), true);
  assert.match(await page.locator('#study-lock-message').textContent(), /プログラミング基礎教本.*1,500/);
  for (const style of ['click', 'typing']) {
    await page.locator(`[data-input-style=${style}]`).click();
    assert.equal(await page.locator('#type-button').isDisabled(), true);
    assert.equal(await page.locator('#typing-input').isVisible(), false);
    assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'), '');
    await page.locator('#typing-input').evaluate(el => el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'int 123', bubbles: true, cancelable: true })));
  }
  await page.locator('#save-button').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(saved.skills.syntax, 0);
  await page.reload();
  await page.waitForSelector('#task-title');
  assert.equal(await page.locator('#type-button').isDisabled(), true, 'the missing-textbook requirement must survive reload');
  // Completed-project fixture tests publishing independently of the balance clock.
  const complete = createState(); complete.mode = 'dev'; complete.skills.syntax = 12;
  complete.progress = projectAt(0).target; complete.cash = 20000;
  await context.close();
  const seededContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  await seededContext.addInitScript(({ data }) => {
    if (!sessionStorage.getItem('fixture-seeded')) { localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data)); sessionStorage.setItem('fixture-seeded', 'yes'); }
  }, { data: complete });
  const seeded = await seededContext.newPage();
  seeded.on('pageerror', e => errors.push(e.message));
  await seeded.goto(url);
  await seeded.locator('#release-button').click();
  assert.match(await seeded.locator('#modal-body').textContent(), /無料公開/);
  await seeded.locator('[data-action=close]').click();
  assert.match(await seeded.locator('#task-title').textContent(), /ブロック崩し/);
  await seeded.locator('[data-action=catalog]').click();
  assert.match(await seeded.locator('#modal-body').textContent(), /数当てゲーム/);
  await seeded.locator('#modal-close').click();
  await seeded.locator('[data-view=roadmap]').click();
  assert.equal(await seeded.locator('.pacing-panel').count(), 0);
  assert.doesNotMatch(await seeded.locator('#roadmap-view').textContent(), /FIRST RUN|BALANCE|シミュレーション|3〜7日|旧セーブ|300打鍵/);
  assert.equal(await seeded.locator('.roadmap-card').count(), 10);
  await seeded.locator('[data-view=achievements]').click();
  assert.equal(await seeded.locator('.achievement-card').count(), 9);
  await seeded.locator('[data-view=workspace]').click();
  await seeded.locator('[data-mode=work]').click();
  await seeded.locator('[data-shop=auto]').click();
  await seeded.locator('[data-buy=macro]').click();
  assert.match(await seeded.locator('#auto-work').textContent(), /0.25/);
  await seeded.locator('[data-mode=study]').click();
  await seeded.locator('[data-action=textbooks]').click();
  assert.equal(await seeded.locator('#type-button').isDisabled(), true);
  await seeded.locator('[data-buy=book-syntax]').click();
  assert.equal(await seeded.locator('#study-lock').isVisible(), false);
  assert.equal(await seeded.locator('#type-button').isDisabled(), false);
  assert.ok(await seeded.locator('#editor-content').getAttribute('data-prompt'), 'buying the textbook must reveal its study code immediately');
  await seeded.locator('[data-input-style=typing]').click();
  const studyCDP = await seededContext.newCDPSession(seeded);
  await studyCDP.send('Input.imeSetComposition', { text: 'ｉｎｔ', selectionStart: 3, selectionEnd: 3 });
  await studyCDP.send('Input.insertText', { text: 'ｉｎｔ' });
  assert.equal(await seeded.locator('#typing-input').inputValue(), 'int');
  await seeded.locator('#save-button').click();
  const beforeRetyping = await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')).stats.study);
  await seeded.locator('#typing-input').click();
  await seeded.keyboard.press('Control+A'); await seeded.keyboard.press('Backspace');
  await seeded.keyboard.type('int');
  await seeded.locator('#save-button').click();
  const afterRetyping = await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')).stats.study);
  assert.equal(afterRetyping, beforeRetyping, 'editing already credited text must not award duplicate study XP');
  for (const language of ['csharp', 'rust', 'go', 'python', 'java', 'sql', 'lua', 'cpp']) {
    await seeded.locator('#language-select').selectOption(language);
    const target = await seeded.locator('#editor-content').getAttribute('data-prompt');
    await seeded.keyboard.type(target.slice(0, 12));
    assert.match(await seeded.locator('#typing-round').textContent(), /^12 \/ /, language);
  }
  await seeded.locator('[data-subject=design]').click();
  assert.equal(await seeded.locator('#type-button').isDisabled(), true, 'a syntax textbook must not unlock design study');
  assert.match(await seeded.locator('#study-lock-message').textContent(), /設計パターンの教科書.*6,000/);
  await seeded.locator('[data-subject=syntax]').click();
  assert.equal(await seeded.locator('#typing-input').evaluate(el => el === document.activeElement), true);
  const studyPrompt = await seeded.locator('#editor-content').getAttribute('data-prompt');
  const studyLines = studyPrompt.split('\n');
  let checkedIndentExit = false;
  for (let line = 0; line < studyLines.length; line++) {
    if (line) await seeded.keyboard.press('Enter');
    const indent = studyLines[line].match(/^ */)[0].length;
    let beforeIndent;
    if (indent >= 4 && !checkedIndentExit) {
      await seeded.locator('#save-button').click();
      beforeIndent = await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
      await seeded.locator('#typing-input').click();
      await seeded.keyboard.press('Control+End');
    }
    for (let space = 0; space + 4 <= indent; space += 4) await seeded.keyboard.press('Tab');
    assert.equal(await seeded.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'code indentation must keep focus in the editor');
    if (indent >= 4 && !checkedIndentExit) {
      await seeded.locator('#save-button').click();
      const afterIndent = await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
      const tabs = Math.floor(indent / 4);
      assert.equal(afterIndent.stats.study - beforeIndent.stats.study, tabs * handPower(beforeIndent) * 1.5, 'Tab must pay for one physical keystroke, not four expanded spaces');
      assert.equal(afterIndent.stats.manual - beforeIndent.stats.manual, tabs);
      assert.equal(afterIndent.typing.bonusBase - beforeIndent.typing.bonusBase, tabs * handPower(beforeIndent), 'Tab completion bonus must also count one keystroke');
      await seeded.locator('#typing-input').click();
      await seeded.keyboard.press('Control+End');
      await seeded.keyboard.press('Shift+Tab');
      assert.equal(await seeded.locator('#typing-input').evaluate(el => el === document.activeElement), false, 'Shift+Tab must let keyboard users leave the editor');
      await seeded.locator('#typing-input').click();
      await seeded.keyboard.press('Control+End');
      checkedIndentExit = true;
    }
    await seeded.keyboard.type(studyLines[line].slice(indent - indent % 4));
  }
  assert.match(await seeded.locator('#typing-completed').textContent(), /1問/);
  assert.equal(await seeded.locator('#completed-notes').isVisible(), true);
  const completedLesson = lessonAt('cpp', 'syntax', 0);
  assert.match(await seeded.locator('#completed-notes').textContent(), new RegExp(completedLesson.title));
  assert.ok((await seeded.locator('#typing-comment-notes').textContent()).includes(completedLesson.comments[0].ja));
  assert.equal(await seeded.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'completion notes must not take typing focus');
  const nextStudyPrompt = await seeded.locator('#editor-content').getAttribute('data-prompt');
  await seeded.keyboard.type(nextStudyPrompt.slice(0, 12));
  await seeded.locator('#save-button').click();
  await seeded.reload();
  await seeded.waitForSelector('#task-title');
  assert.match(await seeded.locator('#typing-round').textContent(), /^12 \/ /);
  await seeded.locator('#settings-button').click();
  await seeded.locator('#motion-setting').check();
  await seeded.locator('#comment-locale-setting').selectOption('en');
  assert.equal(await seeded.locator('#typing-comment-notes [lang=ja]').count(), 0);
  await seeded.locator('#comment-locale-setting').selectOption('ja');
  assert.equal(await seeded.locator('#typing-comment-notes [lang=ja]').count(), 2);
  const [download] = await Promise.all([seeded.waitForEvent('download'), seeded.locator('[data-action=export]').click()]);
  assert.match(download.suggestedFilename(), /^code-typer-idle-day\d+\.json$/);
  await seeded.locator('#modal-close').click();
  assert.ok(await seeded.locator('body').evaluate(el => el.classList.contains('reduce-motion')));
  // Reading checks actual code outcomes and grants only finite first-answer bonuses.
  await seeded.locator('#save-button').click();
  const beforeReading = await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  await seeded.locator('[data-study-style=reading]').click();
  assert.equal(await seeded.locator('#typing-input').isVisible(), false);
  assert.equal(await seeded.locator('#reading-panel').isVisible(), true);
  assert.equal(await seeded.locator('#reading-panel [lang=ja]').count(), 0, 'the explanation must wait until the answer');
  const readLesson = lessonAt('cpp','syntax',0);
  assert.equal(await seeded.locator('.reference-code').textContent(), readLesson.code);
  await seeded.locator(`[data-read-answer="${readLesson.answer}"]`).click();
  const afterReading = await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(afterReading.stats.study - beforeReading.stats.study,120);
  assert.equal(afterReading.typing.offset,beforeReading.typing.offset,'reading must preserve unfinished typing');
  assert.ok((await seeded.locator('.reading-explanation').textContent()).includes(readLesson.comments[0].ja));
  assert.match(await seeded.locator('#reading-panel .reading-trace').textContent(), /health = -8/);
  assert.equal(await seeded.locator('[data-read-answer]:disabled').count(),4);
  await seeded.locator('[data-action=next-reading]').click();
  const wrongLesson=lessonAt('cpp','syntax',1);
  const wrongChoice=questionFor(wrongLesson).choices.find(n=>n!==wrongLesson.answer);
  await seeded.locator(`[data-read-answer="${wrongChoice}"]`).click();
  let readingSave=await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(readingSave.stats.study,afterReading.stats.study,'incorrect reading answers grant nothing');
  await seeded.reload(); await seeded.waitForSelector('#reading-question');
  assert.equal(await seeded.locator('[data-read-answer]:disabled').count(),4);
  assert.match(await seeded.locator('.reading-explanation').textContent(),/不正解/);
  await seeded.locator('#save-button').click();
  readingSave=await seeded.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(readingSave.stats.study,afterReading.stats.study,'reload must not award reading twice');
  assert.match(await seeded.locator('#typing-round').textContent(), /^12 \/ /);
  await seeded.locator('[data-subject=design]').click();
  assert.equal(await seeded.locator('#reading-panel').isVisible(),false);
  assert.equal(await seeded.locator('#study-lock').isVisible(),true);
  await seeded.locator('[data-subject=syntax]').click();
  await seeded.locator('[data-study-style=practice]').click();
  assert.equal(await seeded.locator('#typing-input').isVisible(),true);
  assert.match(await seeded.locator('#typing-round').textContent(), /^0 \/ /);
  assert.match(await seeded.locator('#completed-notes').textContent(),new RegExp(completedLesson.title));
  await mkdir('work', { recursive: true });
  await seeded.screenshot({ path: 'work/desktop.png', fullPage: true });
  for (const width of [1024, 768, 390, 360]) {
    await seeded.setViewportSize({ width, height: 900 });
    const overflow = await seeded.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `No horizontal page overflow at ${width}px`);
  }
  await seeded.locator('[data-input-style=typing]').click();
  await seeded.locator('[data-mode=study]').click();
  await seeded.locator('#language-select').selectOption('rust');
  await seeded.screenshot({ path: 'work/mobile.png', fullPage: true });
  assert.equal(await seeded.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await seeded.locator('[data-view=roadmap]').click();
  await seeded.locator('[data-view=workspace]').click();
  assert.ok(await seeded.locator('#type-button').isVisible());
  await seeded.locator('#help-button').click();
  assert.ok(await seeded.locator('#modal').isVisible());
  await seeded.keyboard.press('Escape');
  assert.equal(await seeded.locator('#modal').isVisible(), false);
  await seeded.locator('#settings-button').click();
  await seeded.locator('#import-file').setInputFiles({ name: 'bad-save.json', mimeType: 'application/json', buffer: Buffer.from('{"version":999}') });
  await seeded.waitForFunction(() => document.querySelector('#toasts').textContent.includes('読み込めません'));
  const imported = createState(); imported.cash = 7777;
  await seeded.locator('#import-file').setInputFiles({ name: 'valid-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await seeded.waitForFunction(() => document.querySelector('#cash').textContent.includes('7,777'));
  assert.equal(await seeded.locator('#modal').isVisible(), false);
  // A second tab must not run or overwrite the first tab's state.
  const duplicate = await seededContext.newPage();
  await duplicate.goto(url);
  await duplicate.waitForFunction(() => document.querySelector('#type-button').disabled);
  assert.match(await duplicate.locator('#save-status').textContent(), /別タブで起動中/);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: direct entry, visible editable drafts, native IME composition/commit, no duplicate rewards on edits, click income, paste/repeat guards, multiline typing, eight languages, cursor persistence, release, textbook requirements, shop, automation, export/import, five viewport sizes, mobile typing, and duplicate-tab protection.');
  await seededContext.close();
  // Actual publication controls must match the accounting shown before release.
  for (const index of [1, 5]) {
    const ready = createState(); ready.mode = 'dev'; ready.cash = 1e8; ready.projectIndex = index;
    const project = projectAt(index); ready.progress = project.target;
    Object.assign(ready.skills, project.req);
    const finance = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    try {
      await finance.addInitScript(data => {
        if (!sessionStorage.getItem('finance-seeded')) {
          localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data));
          sessionStorage.setItem('finance-seeded', 'yes');
        }
      }, ready);
      const publishing = await finance.newPage();
      publishing.on('pageerror', e => errors.push(e.message));
      await publishing.goto(url);
      await publishing.waitForSelector('#release-cost');
      assert.match(await publishing.locator('#living').textContent(), /¥0/);
      assert.match(await publishing.locator('#release-cost').textContent(), /ゲーム配信ストア.*25%/);
      if (index === 5) assert.match(await publishing.locator('#release-cost').textContent(), /ホスティング会社.*日.*公開停止/);
      await publishing.locator('#release-button').click();
      assert.match(await publishing.locator('#modal-body').textContent(), /販売手数料/);
      await publishing.locator('#modal-close').click();
      await publishing.locator('.expense-panel summary').click();
      assert.match(await publishing.locator('#expense-lines').textContent(), /ゲーム配信ストア.*25%/);
      await publishing.locator('#save-button').click();
      const started = await publishing.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
      const title = started.catalog[0];
      assert.equal(title.salesFee, title.grossPayout * .25);
      assert.equal(title.payout, title.grossPayout * .75);
      assert.ok(Math.abs(started.cash - ready.cash - started.stats.earned) < .01, 'sale fees must not be charged twice');
      if (index === 5) {
        assert.match(await publishing.locator('#expense-lines').textContent(), /ホスティング会社/);
        await publishing.locator('[data-action=catalog]').click();
        await publishing.locator('[data-publication="5"][data-active="false"]').click();
        let stopped = await publishing.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
        assert.equal(stopped.catalog[0].active, false);
        assert.match(await publishing.locator('#living').textContent(), /¥0/);
        assert.match(await publishing.locator('#catalog-list').textContent(), /公開停止中/);
        assert.equal(await publishing.locator('#published-count').textContent(), '公開作品の継続売上なし');
        if (stopped.dailyAccrued > 0) {
          assert.match(await publishing.locator('#expense-summary').textContent(), /本日精算予定/);
          assert.doesNotMatch(await publishing.locator('#expense-lines').textContent(), /支払いはありません/);
        }
        await publishing.locator('#modal-close').click();
        await publishing.waitForTimeout(350);
        await publishing.locator('#save-button').click();
        const afterStop = await publishing.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
        assert.equal(afterStop.stats.storeFees, stopped.stats.storeFees);
        assert.equal(afterStop.dailyAccrued, stopped.dailyAccrued);
        await publishing.locator('[data-action=catalog]').click();
        await publishing.locator('[data-publication="5"][data-active="true"]').click();
        await publishing.locator('#modal-close').click();
        await publishing.reload();
        await publishing.waitForSelector('#expense-summary');
        await publishing.locator('#save-button').click();
        const resumed = await publishing.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
        assert.equal(resumed.catalog[0].active, true);
        assert.ok(resumed.dailyAccrued >= afterStop.dailyAccrued);
      } else assert.doesNotMatch(await publishing.locator('#expense-lines').textContent(), /ホスティング会社/);
    } finally { await finance.close(); }
  }
  for (const [syntax, progress, debt, expected] of [[0,0,0,/まず必要な分野/],[6,0,0,/まず必要な分野/],[6.1,0,0,/試作はできる/],[12,0,0,/必要な知識が揃った/],[12,3000,100,/リファクタリング/]]) {
    const readyContext=await browser.newContext();
    const readySave=createState();Object.assign(readySave,{mode:'dev',progress,debt});readySave.skills.syntax=syntax;
    await readyContext.addInitScript(data=>localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data)),readySave);
    const readyPage=await readyContext.newPage();readyPage.on('pageerror',e=>errors.push(e.message));
    await readyPage.goto(url);await readyPage.waitForSelector('#development-readiness b');
    assert.match(await readyPage.locator('#development-readiness').textContent(),expected);
    if(syntax<12){await readyPage.locator('[data-learn=syntax]').click();assert.match(await readyPage.locator('#task-title').textContent(),/基礎文法/);}
    if(debt>75)assert.equal(await readyPage.locator('#release-button').isDisabled(),true);
    await readyContext.close();
  }
  // Exercise real course typing in every language, including literal Go tabs.
  for (const language of ['cpp','csharp','rust','go','python','java','sql','lua']) {
    const courseContext=await browser.newContext({viewport:{width:1200,height:1000}});
    const data=createState();data.mode='study';data.inputStyle='typing';for(const id of ['syntax','design','graphics','systems'])data.items[`book-${id}`]=1;
    await courseContext.addInitScript(data=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));sessionStorage.setItem('seeded','1');}},data);
    const coursePage=await courseContext.newPage();coursePage.on('pageerror',e=>errors.push(e.message));await coursePage.goto(url);
    await coursePage.waitForSelector('#study-style-picker');
    assert.equal(await coursePage.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\/course\.[a-f0-9]+\.js/.test(r.name))),false,'native play must not load the large course archive');
    await coursePage.locator('[data-study-style=course]').click();await coursePage.waitForSelector('#course-exercise');
    await coursePage.locator('#language-select').selectOption(language);
    const enter=async()=>{
      const code=await coursePage.locator('#editor-content').getAttribute('data-prompt');
      await coursePage.locator('#typing-input').click();
      for(const part of code.split(/(\t|\n)/)){
        if(part==='\t')await coursePage.keyboard.press('Tab');
        else if(part==='\n')await coursePage.keyboard.press('Enter');
        else if(part)await coursePage.keyboard.type(part);
      }
      return code;
    };
    if(language==='go'){const e=COURSE.go.exercises.find(e=>e.slug==='lasagna');const u=e.units.map(i=>COURSE.go.units[i]).find(u=>u.code.includes('\t'));await coursePage.locator('#course-exercise').selectOption(String(COURSE.go.exercises.indexOf(e)));await coursePage.locator('#course-unit').selectOption(u.id);}
    const first=await coursePage.locator('#course-unit').inputValue();
    if(language==='go')assert.ok((await coursePage.locator('#editor-content').getAttribute('data-prompt')).includes('\t'));
    await enter();
    let saved=await coursePage.evaluate(()=>JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    await coursePage.locator('#save-button').click();saved=await coursePage.evaluate(()=>JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(saved.typing.lastCompleted.courseUnit,first,language);
    assert.ok(saved.typing.courseCompleted.length>=1,language);
    assert.match(await coursePage.locator('#completed-notes').textContent(),/実行結果は未収録/);
    if(language==='python'){
      const e=COURSE.python.exercises.find(e=>e.slug==='guidos-gorgeous-lasagna');const u=e.units.map(i=>COURSE.python.units[i]).find(u=>u.comments.some(c=>c.ja.includes('残りの焼き時間')));await coursePage.locator('#course-unit').selectOption(u.id);await enter();assert.ok((await coursePage.locator('#typing-comment-notes').textContent()).includes('残りの焼き時間'));
    }
    if(language==='cpp'){
      await coursePage.locator('#course-exercise').selectOption('1');
      const selected=await coursePage.locator('#course-unit').inputValue();
      const code=await coursePage.locator('#editor-content').getAttribute('data-prompt');await coursePage.locator('#typing-input').click();await coursePage.keyboard.type(code.slice(0,5));
      await coursePage.locator('[data-subject=design]').click();await coursePage.locator('[data-subject=syntax]').click();
      assert.equal(await coursePage.locator('#course-unit').inputValue(),selected);assert.match(await coursePage.locator('#typing-round').textContent(),/^5 \/ /);
      await coursePage.locator('#language-select').selectOption('rust');await coursePage.locator('#language-select').selectOption('cpp');
      assert.equal(await coursePage.locator('#course-unit').inputValue(),selected);assert.match(await coursePage.locator('#typing-round').textContent(),/^5 \/ /);
      await coursePage.locator('#save-button').click();await coursePage.reload();await coursePage.waitForSelector('#course-unit');
      assert.equal(await coursePage.locator('#course-unit').inputValue(),selected);assert.match(await coursePage.locator('#typing-round').textContent(),/^5 \/ /);
      await coursePage.setViewportSize({width:390,height:900});assert.equal(await coursePage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await courseContext.close();
  }
  assert.deepEqual(errors, []);
  if (server) {
    // A cached legacy shell takes the migration entry without clearing storage.
    legacyHTML = true;
    const cached = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const oldSave = { ...createState(), balanceVersion: 2, cash: 98765, projectIndex: 2, day: 901, dayElapsed: 30, skills: { syntax: 123, design: 45, graphics: 6, systems: 7 } };
    await cached.addInitScript(data => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data)); sessionStorage.setItem('seeded', '1'); }
    }, oldSave);
    const updating = await cached.newPage();
    updating.on('pageerror', e => errors.push(e.message));
    await updating.goto(url);
    await updating.waitForURL(`**?v=${currentRelease.id}`);
    await updating.waitForSelector('#expense-summary');
    assert.equal(await updating.locator('.version').textContent(), `v${currentRelease.version}`);
    // Keep old module URLs in the actual HTTP cache, alongside the current build.
    await updating.evaluate(async () => { await fetch('./js/core.js'); await fetch('./js/typing.js'); });
    await updating.locator('#save-button').click();
    let preserved = await updating.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(preserved.cash, 98765); assert.equal(preserved.skills.syntax, 123); assert.equal(preserved.projectIndex, 2);
    assert.equal(preserved.day, 901); assert.ok(preserved.dayElapsed >= 1800);
    // Same origin, same profile, long-lived HTML/JS/CSS/version caches. Deploy B.
    nextDeployment = true;
    await updating.evaluate(() => window.dispatchEvent(new Event('focus')));
    await updating.locator('#update-banner:not(.hidden)').waitFor();
    await updating.evaluate(() => { window.originalStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('quota'); }; });
    await updating.locator('#update-button').click();
    assert.equal(new URL(updating.url()).searchParams.get('v'), currentRelease.id, 'failed save must prevent reload');
    await updating.evaluate(() => { Storage.prototype.setItem = window.originalStorageWrite; });
    await Promise.all([updating.waitForURL(`**?v=${nextId}`), updating.locator('#update-button').click()]);
    await updating.waitForSelector('#expense-summary');
    assert.equal(await updating.locator('.version').textContent(), `v${nextVersion}`);
    await updating.locator('#save-button').click();
    preserved = await updating.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(preserved.cash, 98765); assert.equal(preserved.skills.syntax, 123); assert.equal(preserved.projectIndex, 2);
    assert.equal(preserved.balanceVersion, BALANCE_VERSION); assert.equal(preserved.day, 901);
    assert.ok(requests.some(path => path.includes(`app.${nextId}.js`)));
    assert.ok(requests.some(path => path.includes(`core.${nextId}.js`)));
    assert.ok(requests.some(path => path.includes(`curriculum.${nextId}.js`)));
    assert.ok(requests.some(path => path.includes(`idioms.${nextId}.js`)));
    assert.ok(requests.some(path => path.includes(`style.${nextId}.css`)));
    assert.ok(requests.filter(path => path === '/version.json').length >= 3, 'version checks must bypass a previously cached version response');
    await cached.setOffline(true);
    await updating.evaluate(() => window.dispatchEvent(new Event('focus')));
    await updating.locator('#type-button').click();
    await updating.locator('#save-button').click();
    preserved = await updating.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(preserved.job.progress, 1, 'offline update checks must leave the game playable');
    assert.deepEqual(errors, []);
    await cached.close();
    // A stale app must keep a newer-format save, even if its backup is readable.
    nextDeployment = legacyHTML = false;
    const futureContext = await browser.newContext();
    const futureData = JSON.stringify({ ...oldSave, balanceVersion: 999, cash: 7654321 });
    await futureContext.addInitScript(({ data, backup }) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('code-typer-idle:save:v1', data);
        localStorage.setItem('code-typer-idle:save:v1:backup', backup);
        sessionStorage.setItem('seeded', '1');
      }
    }, { data: futureData, backup: JSON.stringify(createState()) });
    const futurePage = await futureContext.newPage();
    futurePage.on('pageerror', e => errors.push(e.message));
    await futurePage.goto(url);
    await futurePage.waitForFunction(() => document.querySelector('#toasts').textContent.includes('新しい版のセーブ'));
    nextDeployment = true;
    await futurePage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await futurePage.locator('#update-banner:not(.hidden)').waitFor();
    await Promise.all([futurePage.waitForURL(`**?v=${nextId}`), futurePage.locator('#update-button').click()]);
    await futurePage.waitForFunction(() => document.querySelector('#toasts').textContent.includes('新しい版のセーブ'));
    assert.equal(await futurePage.evaluate(() => localStorage.getItem('code-typer-idle:save:v1')), futureData);
    await futureContext.close();
    assert.deepEqual(errors, []);
    console.log('Cache update checks passed: cached legacy shell, immutable old modules and version response, deployment change, save-before-reload, failed-save protection, new complete module graph and CSS, legacy save preservation, offline play.');
  }
} finally { await browser.close(); if (server) await new Promise(r => server.close(r)); }
