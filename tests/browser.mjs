// Optional UI verification. Install Playwright for development, not for hosting.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createState, projectAt } from '../docs/js/core.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve('docs');
let server;
const url = process.env.CTI_TEST_URL || await new Promise(resolveUrl => {
  server = createServer(async (req, res) => {
    try {
      const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://local').pathname)}` + (req.url.endsWith('/') ? 'index.html' : ''));
      if (!path.startsWith(root + '/')) throw Error('Invalid path');
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(path)] || 'text/plain' }); res.end(data);
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
  await page.keyboard.type('arbitrary_keyboard_spam_12345');
  await page.locator('#save-button').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.equal(saved.cash, 101, 'arbitrary keys must never produce rewards');
  await page.locator('[data-mode=work]').click();
  await page.locator('[data-input-style=typing]').click();
  assert.equal(await page.locator('#typing-input').isVisible(), true);
  const prompt = await page.locator('#editor-content').getAttribute('data-prompt');
  const wrong = prompt[0] === 'x' ? 'y' : 'x';
  await page.keyboard.type(wrong);
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /);
  assert.equal(await page.locator('#cash').textContent(), '¥101');
  // Programmatic clipboard events exercise the real paste/beforeinput guards.
  await page.locator('#typing-input').evaluate(el => {
    const clipboard = new DataTransfer(); clipboard.setData('text/plain', 'injected paste');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
    el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', data: 'injected paste', bubbles: true, cancelable: true }));
  });
  assert.match(await page.locator('#typing-round').textContent(), /^0 \/ /);
  const lines = prompt.split('\n');
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
  assert.ok(saved.cash > 101 + prompt.length * 1.25);
  assert.ok(saved.cash < 101 + prompt.length * 1.5, 'a mistake reduces the completion bonus');
  assert.equal(saved.mode, 'work', 'digits within a prompt must not trigger mode shortcuts');
  // Holding a correct key advances once; repeated keydown is rejected.
  const secondPrompt = await page.locator('#editor-content').getAttribute('data-prompt');
  await page.locator('#typing-input').focus();
  await page.keyboard.down(secondPrompt[0]);
  await page.keyboard.down(secondPrompt[0]);
  await page.keyboard.up(secondPrompt[0]);
  assert.match(await page.locator('#typing-round').textContent(), /^1 \/ /);
  // Changing languages changes the actual target, then correctly typed input works.
  for (const language of ['csharp', 'rust', 'go', 'python', 'java', 'sql', 'lua', 'cpp']) {
    await page.locator('#language-select').selectOption(language);
    const target = await page.locator('#editor-content').getAttribute('data-prompt');
    await page.keyboard.type(target.slice(0, 12));
    assert.match(await page.locator('#typing-round').textContent(), /^12 \/ /, language);
  }
  await page.locator('#save-button').click();
  await page.reload();
  await page.waitForSelector('#task-title');
  assert.match(await page.locator('#typing-round').textContent(), /^12 \/ /);
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
  await seeded.locator('[data-shop=books]').click();
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
} finally { await browser.close(); if (server) await new Promise(r => server.close(r)); }
