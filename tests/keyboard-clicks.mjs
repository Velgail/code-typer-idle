import assert from 'node:assert/strict';
import { createState } from '../src/core.js';

export async function verifyClickKeyboardGuard(browser, url, errors) {
  for (const mode of ['work', 'study', 'dev']) {
    const context = await browser.newContext();
    try {
      const data = createState();data.mode = mode;data.cash = 2000;
      for (const subject of ['syntax', 'design', 'graphics', 'systems']) {
        data.skills[subject] = 100;
        if (mode !== 'work') data.items[`book-${subject}`] = 1;
      }
      await context.addInitScript(data => localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data)), data);
      const page = await context.newPage();page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);await page.waitForSelector('#type-button');
      const snapshot = async () => {
        await page.locator('#save-button').click();
        return page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
      };
      await page.locator('#type-button').click();
      const before = await snapshot();
      assert.equal(before.stats.manual, 1, 'a pointer click must award exactly one manual input');
      await page.locator('#type-button').focus();
      for (const key of ['Enter', 'NumpadEnter', 'Space']) {
        await page.keyboard.press(key);
        for (let repeat = 0; repeat < 12; repeat++) await page.keyboard.down(key);
        await page.keyboard.up(key);
      }
      const after = await snapshot();
      assert.equal(after.stats.manual, before.stats.manual, `${mode}: Enter/Space and key repeats must not earn click rewards`);
      for (const key of ['chars', 'valid', 'study']) assert.equal(after.stats[key], before.stats[key]);
      assert.equal(after.job.progress, before.job.progress);assert.equal(after.progress, before.progress);
      assert.equal(await page.locator('#type-button .keycap').isVisible(), false, 'click mode must not advertise Enter as an action');
      await page.locator('#type-button').click();assert.equal((await snapshot()).stats.manual, 2);
      if (mode === 'work') {
        await page.locator('[data-buy=book-syntax]').focus();await page.keyboard.press('Enter');
        assert.equal((await snapshot()).items['book-syntax'], 1, 'Enter must still activate ordinary UI controls');
      }
      await page.locator('[data-input-style=typing]').click();
      await page.locator('#type-button').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'typing mode must still allow Enter to focus its input');
      assert.equal((await snapshot()).stats.manual, 2, 'focusing the typing input must not grant rewards');
    } finally { await context.close(); }
  }
  const touch = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  try {
    const page = await touch.newPage();await page.goto(url);await page.waitForSelector('#type-button');
    await page.locator('#type-button').tap();await page.locator('#save-button').tap();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(saved.stats.manual, 1, 'a real touch tap must still award one click');
  } finally { await touch.close(); }
  console.log('Click keyboard checks passed: Enter/Space and key repeats pay nothing in work/study/dev; mouse, touch, ordinary controls, and typing focus still work.');
}
