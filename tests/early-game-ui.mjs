import assert from 'node:assert/strict';
import { createState, projectAt } from '../src/core.js';

async function open(browser, url, errors, viewport, seed) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  if (seed) await context.addInitScript(data => {
    if (sessionStorage.getItem('early-game-seeded')) return;
    data.savedAt = Date.now();
    localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data));
    sessionStorage.setItem('early-game-seeded', '1');
  }, seed);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  // The goal CTA exists in static HTML; shop controls appear only after saved state is loaded.
  await page.waitForSelector('.buy-button');
  return { context, page };
}

async function snapshot(page) {
  await page.locator('#save-button').click();
  return page.evaluate(() => JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
}

async function assertOfficeVisible(page, label) {
  const boxes = await page.evaluate(() => {
    const rect = id => {
      const box = document.getElementById(id).getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    return {
      image: rect('office-image'), input: rect('typing-input'),
      width: innerWidth, height: innerHeight,
      focused: document.activeElement === document.getElementById('typing-input'),
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  for (const [name, box] of Object.entries({ image: boxes.image, input: boxes.input })) {
    assert.ok(box.width > 0 && box.height > 0, `${label}: ${name} must be visible`);
    assert.ok(box.x >= -1 && box.right <= boxes.width + 1, `${label}: ${name} must fit horizontally`);
    assert.ok(box.y >= -1 && box.bottom <= boxes.height + 1, `${label}: original invoice and cursor must both fit in the viewport (${name}: ${JSON.stringify(box)})`);
  }
  const overlap = Math.min(boxes.image.right, boxes.input.right) > Math.max(boxes.image.x, boxes.input.x)
    && Math.min(boxes.image.bottom, boxes.input.bottom) > Math.max(boxes.image.y, boxes.input.y);
  assert.equal(overlap, false, `${label}: the invoice must not cover the input cursor`);
  assert.equal(boxes.focused, true, `${label}: the native input must retain focus`);
  assert.equal(boxes.overflow, false, `${label}: the page must not overflow horizontally`);
}

export async function verifyEarlyGameUI(browser, url, errors) {
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    const { context, page } = await open(browser, url, errors, viewport);
    try {
      const goal = page.locator('#goal-action');
      assert.match(await goal.innerText(), /教材.*1,500/);
      assert.equal(await goal.getAttribute('data-goal-kind'), 'buy');
      assert.equal(await goal.isDisabled(), true, 'a new player cannot buy the first textbook before earning enough');
      assert.equal(await page.locator('#goal-alternative').isVisible(), true);
      assert.match(await page.locator('#goal-alternative').innerText(), /OCR.*1,500/);
      assert.equal(await page.locator('#goal-alternative').isDisabled(), true, 'the alternative OCR purchase must also require sufficient funds');
      assert.equal(await page.locator('#cash').isVisible(), true);
      for (const id of ['living', 'total-chars', 'royalty']) {
        assert.equal(await page.locator(`#${id}`).isVisible(), false, `${id}: unused zero metrics must not crowd the initial screen`);
      }
      assert.equal(await page.locator('#next-milestone').evaluate(el => {
        const resources = document.querySelector('.resource-strip');
        return el.parentElement.tagName === 'MAIN'
          && !!(el.compareDocumentPosition(resources) & Node.DOCUMENT_POSITION_FOLLOWING);
      }), true, 'the next purchase goal belongs before the resource strip');
      const box = await goal.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= viewport.height, 'the first purchase goal must be in the initial viewport');
      const start = await page.locator('#type-button').boundingBox();
      assert.ok(start.y >= 0 && start.y + start.height <= viewport.height, 'a new player must also be able to start working without first scrolling');

      if (viewport.width === 1440) {
        await page.locator('#type-button').click();
        const before = await snapshot(page);
        assert.equal(before.stats.manual, 1, 'a real pointer click must still produce one unit of work');
        await page.locator('#type-button').focus();
        for (const key of ['Enter', 'Space']) {
          await page.keyboard.press(key);
          for (let repeat = 0; repeat < 4; repeat++) await page.keyboard.down(key);
          await page.keyboard.up(key);
        }
        const after = await snapshot(page);
        assert.equal(after.stats.manual, before.stats.manual, 'moving the goal must not restore keyboard click farming');
        assert.equal(after.job.progress, before.job.progress);
      }
    } finally { await context.close(); }
  }

  const affordable = createState();
  affordable.cash = 1500;
  const purchase = await open(browser, url, errors, { width: 390, height: 844 }, affordable);
  try {
    const page = purchase.page;
    assert.equal(await page.locator('#goal-action').isDisabled(), false);
    // The normal purchase CTA must remain keyboard accessible despite the click-farming guard.
    await page.locator('#goal-action').focus();
    await page.keyboard.press('Enter');
    const bought = await snapshot(page);
    assert.equal(bought.items['book-syntax'], 1, 'the goal CTA must buy the actual textbook');
    assert.equal(bought.cash, 0, 'the purchase must charge the displayed price exactly once');
    assert.doesNotMatch(await page.locator('#goal-action').innerText(), /教材を買う/);
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'), 'study');
    await page.locator('[data-mode=study]').click();
    assert.equal(await page.locator('#study-lock').isVisible(), false);
    await page.locator('#type-button').click();
    assert.ok((await snapshot(page)).skills.syntax > 0, 'learning becomes available after purchasing the textbook');
    await page.locator('[data-mode=dev]').click();
    assert.equal(await page.locator('[data-mode=dev]').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('#development-readiness').innerText(), /あと[\d.]+学ぶ/);
  } finally { await purchase.context.close(); }

  const automate = await open(browser, url, errors, { width: 390, height: 844 }, affordable);
  try {
    const page = automate.page;
    await page.locator('#goal-alternative').click();
    const bought = await snapshot(page);
    assert.equal(bought.items.macro, 1, 'the alternative CTA must buy the OCR automation');
    assert.equal(bought.items['book-syntax'], 0, 'choosing automation must preserve the textbook as a separate purchase');
    assert.equal(bought.cash, 0);
    assert.equal(await page.locator('#goal-alternative').isVisible(), false, 'the one-time early automation shortcut disappears after purchase');
    assert.equal(await page.locator('#goal-action').isDisabled(), true);
    assert.match(await page.locator('#auto-work').innerText(), /^10(?:\.0+)?\s+作業量\/秒/, 'the purchased OCR must display its actual 10 work units per second');
  } finally { await automate.context.close(); }

  const ready = createState();
  ready.items['book-syntax'] = 1;
  ready.skills.syntax = projectAt(0).req.syntax;
  const development = await open(browser, url, errors, { width: 390, height: 844 }, ready);
  try {
    const page = development.page;
    assert.equal(await page.locator('#goal-action').isDisabled(), false);
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'), 'dev');
    assert.match(await page.locator('#goal-action').innerText(), /開発/);
    await page.locator('#goal-action').click();
    assert.equal(await page.locator('[data-mode=dev]').getAttribute('aria-selected'), 'true', 'meeting the learning condition exposes a direct route into game development');
    assert.equal(await page.locator('#office-source').isVisible(), false);
  } finally { await development.context.close(); }

  const complete = createState();
  complete.items['book-syntax'] = 1;
  complete.skills.syntax = projectAt(0).req.syntax;
  complete.progress = projectAt(0).target;
  complete.job = { progress: 50, rate: 1 };
  const release = await open(browser, url, errors, { width: 390, height: 844 }, complete);
  try {
    const page = release.page;
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'), 'release');
    await page.locator('#goal-action').click();
    await page.locator('#modal[open]').waitFor();
    const message = await page.locator('#modal-body').innerText();
    assert.match(message, /無料公開/);
    assert.match(message, /次の依頼は100作業量で\s*¥200/);
    assert.match(message, /自作ライブラリと研究ラボが解禁/);
    assert.match(message, /進行中の案件は受注時の単価で納品/);
    await page.locator('[data-action=next-project]').click();
    await page.locator('[data-mode=work]').click();
    assert.match(await page.locator('#job-payment').innerText(), /¥100/, 'the existing half-finished contract keeps its original payment');
  } finally { await release.context.close(); }

  const mobile = await open(browser, url, errors, { width: 390, height: 844 });
  try {
    const page = mobile.page;
    const details = page.locator('#office-details');
    assert.equal(await details.evaluate(el => el.tagName), 'DETAILS');
    assert.equal(await details.evaluate(el => el.open), false, 'detailed CSV formatting instructions are initially collapsed');
    await page.locator('[data-input-style=typing]').click();
    await page.locator('#type-button').click();
    const field = page.locator('#typing-input');
    const content = page.locator('#editor-content');
    await assertOfficeVisible(page, '390×844, typing start');
    assert.equal(await content.locator('.pending-code').count(), 0, 'the invoice exercise must not reveal its untyped CSV answer');
    const prompt = await content.getAttribute('data-prompt');
    assert.ok(prompt && prompt.includes(','));
    const firstImage = await page.locator('#office-image').evaluate(el => el.toDataURL());
    await page.keyboard.type(prompt[0] === 'X' ? 'Y' : 'X');
    assert.match(await page.locator('#typing-round').innerText(), /^0 \/ /);
    assert.equal(await field.evaluate(el => el.classList.contains('has-error')), true);
    await assertOfficeVisible(page, '390×844, error draft');
    await page.keyboard.press('Backspace');
    assert.equal(await field.inputValue(), '');
    await page.setViewportSize({ width: 390, height: 450 });
    await page.waitForTimeout(150);
    await assertOfficeVisible(page, '390×450, reduced viewport');
    await page.keyboard.type(prompt);
    assert.equal(await field.inputValue(), '', 'accepted office input is immediately consumed');
    assert.match(await page.locator('#typing-completed').innerText(), /1問/);
    assert.notEqual(await content.getAttribute('data-prompt'), prompt, 'completion must advance to a new invoice');
    assert.notEqual(await page.locator('#office-image').evaluate(el => el.toDataURL()), firstImage, 'the visible original invoice must advance with the input target');
    await assertOfficeVisible(page, '390×450, next invoice');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await assertOfficeVisible(page, '390×844, restored viewport');
    const next = await content.getAttribute('data-prompt');
    await page.keyboard.type(next[0]);
    await page.keyboard.down(next[1]);
    for (let repeat = 0; repeat < 4; repeat++) await page.keyboard.down(next[1]);
    await page.keyboard.up(next[1]);
    assert.match(await page.locator('#typing-round').innerText(), /^2 \/ /, 'held keys must still advance once after changing invoices');
    assert.equal(await details.evaluate(el => el.open), false);
    assert.equal(await field.evaluate(el => el === document.activeElement), true);
  } finally { await mobile.context.close(); }
  console.log('Early-game checks passed: visible purchase goal, progressive metrics, textbook purchase and development route, compact invoice/cursor visibility, error correction, next invoice focus and keyboard guards.');
}
