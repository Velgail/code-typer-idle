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
  assert.match(await page.locator('#cash').textContent(), /1,200/);
  await page.locator('[data-mode=dev]').click();
  await page.locator('#type-button').click();
  assert.match(await page.locator('#project-progress').textContent(), /0 \/ 3,000/);
  await page.keyboard.press('1');
  await page.keyboard.type('a'.repeat(25));
  await page.locator('[data-buy=book-syntax]').click();
  await page.keyboard.press('2');
  await page.keyboard.type('s'.repeat(20));
  assert.match(await page.locator('#skills').textContent(), /13/);
  await page.keyboard.press('3');
  await page.locator('#type-button').click();
  assert.match(await page.locator('#project-progress').textContent(), /1 \/ 3,000/);
  await page.locator('#save-button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
  assert.ok(saved.skills.syntax >= 13);
  assert.ok(saved.progress > 0);
  await page.reload();
  await page.waitForSelector('#task-title');
  assert.match(await page.locator('#task-title').textContent(), /数当て/);
  // Completed-project fixture exercises publishing, next project, and royalties UI.
  const complete = createState(); complete.mode = 'dev'; complete.skills.syntax = 12; complete.progress = projectAt(0).target;
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
  assert.equal(await seeded.locator('.roadmap-card').count(), 10);
  await seeded.locator('[data-view=achievements]').click();
  assert.equal(await seeded.locator('.achievement-card').count(), 9);
  await seeded.locator('[data-view=workspace]').click();
  await seeded.locator('[data-mode=work]').click();
  await seeded.locator('[data-shop=auto]').click();
  await seeded.locator('[data-buy=macro]').click();
  assert.match(await seeded.locator('#auto-work').textContent(), /4/);
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
  await seeded.screenshot({ path: 'work/mobile.png', fullPage: true });
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
  console.log('Browser checks passed: input, knowledge gate, shop, save/reload, release, catalog, roadmap, automation, settings, export/import, mobile layouts and navigation, dialog keyboard access, and duplicate-tab protection.');
  await seededContext.close();
} finally { await browser.close(); if (server) await new Promise(r => server.close(r)); }
