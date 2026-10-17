// Optional UI verification. Install Playwright for development, not for hosting.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createState, projectAt, BALANCE_VERSION } from '../src/core.js';
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForSelector('.buy-button');
  assert.match(await page.title(), /Code Typer Idle/);
  assert.equal(await page.locator('#cash').textContent(), '¥100');
  await page.locator('#type-button').click();
  await page.keyboard.type('arbitrary_keyboard_spam_');
  await page.locator('h1').click();
  await page.keyboard.type('2026');
  await page.locator('#save-button').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(saved.cash, 100); assert.equal(saved.job.progress, 1, 'arbitrary keys must never produce rewards');
  assert.equal(saved.mode, 'work', 'typing a year outside the input must never switch to the study tab');
  await page.locator('[data-mode=work]').click();
  await page.locator('[data-input-style=typing]').click();
  assert.equal(await page.locator('#typing-input').isVisible(), true);
  await page.locator('[data-mode=study]').click();
  await page.locator('[data-mode=work]').click();
  assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'switching task tabs must restore typing focus');
  const prompt = await page.locator('#editor-content').getAttribute('data-prompt');
  const wrong = prompt[0] === 'x' ? 'y' : 'x';
  await page.keyboard.type(wrong);
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /);
  assert.equal(await page.locator('#cash').textContent(), '¥100');
  // Programmatic clipboard events exercise the real paste/beforeinput guards.
  await page.locator('#typing-input').evaluate(el => {
    const clipboard = new DataTransfer(); clipboard.setData('text/plain', 'injected paste');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
    el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', data: 'injected paste', bubbles: true, cancelable: true }));
  });
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /);
  const dateStart = prompt.indexOf(',') + 1;
  await page.keyboard.type(prompt.slice(0, dateStart));
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
  assert.ok(workValue > 101 + prompt.length * 1.25);
  assert.ok(workValue < 101 + prompt.length * 1.5, 'a mistake reduces the completion bonus');
  assert.equal(saved.mode, 'work', 'digits within a prompt must not trigger mode shortcuts');
  // Holding a correct key advances once; repeated keydown is rejected.
  const secondPrompt = await page.locator('#editor-content').getAttribute('data-prompt');
  await page.locator('#typing-input').focus();
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
  assert.match(await seeded.locator('.pacing-panel').textContent(), /3〜7日/);
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
  for (let line = 0; line < studyLines.length; line++) {
    if (line) await seeded.keyboard.press('Enter');
    await seeded.keyboard.type(studyLines[line]);
  }
  assert.match(await seeded.locator('#typing-completed').textContent(), /1問/);
  const nextStudyPrompt = await seeded.locator('#editor-content').getAttribute('data-prompt');
  await seeded.keyboard.type(nextStudyPrompt.slice(0, 12));
  await seeded.locator('#save-button').click();
  await seeded.reload();
  await seeded.waitForSelector('#task-title');
  assert.match(await seeded.locator('#typing-round').textContent(), /^12 \/ /);
  await seeded.locator('#settings-button').click();
  await seeded.locator('#motion-setting').check();
  const [download] = await Promise.all([seeded.waitForEvent('download'), seeded.locator('[data-action=export]').click()]);
  assert.match(download.suggestedFilename(), /^code-typer-idle-day\d+\.json$/);
  await seeded.locator('#modal-close').click();
  assert.ok(await seeded.locator('body').evaluate(el => el.classList.contains('reduce-motion')));
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
  console.log('Browser checks passed: click income, rejection of arbitrary keys/paste/repeat/wrong characters, exact multiline typing and completion bonuses, all eight languages, cursor persistence, release, pacing guide, shop, automation, export/import, five viewport sizes, mobile typing, and duplicate-tab protection.');
  await seededContext.close();
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
    await updating.waitForSelector('#business-stage');
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
    await updating.waitForSelector('#business-stage');
    assert.equal(await updating.locator('.version').textContent(), `v${nextVersion}`);
    await updating.locator('#save-button').click();
    preserved = await updating.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(preserved.cash, 98765); assert.equal(preserved.skills.syntax, 123); assert.equal(preserved.projectIndex, 2);
    assert.equal(preserved.balanceVersion, BALANCE_VERSION); assert.equal(preserved.day, 901);
    assert.ok(requests.some(path => path.includes(`app.${nextId}.js`)));
    assert.ok(requests.some(path => path.includes(`core.${nextId}.js`)));
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
