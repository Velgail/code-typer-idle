import assert from 'node:assert/strict';
import { createState, projectAt, buy, input, tick, release, studyGain, developmentGain, defectLimit, typingPower, skillKnowledge } from '../src/core.js';
import { TYPING_REWARD } from '../src/typing.js';

async function open(browser, url, errors, viewport, seed, pausedClock = false) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  if (seed) await context.addInitScript(data => {
    if (sessionStorage.getItem('early-game-seeded')) return;
    data.savedAt = Date.now();
    localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data));
    sessionStorage.setItem('early-game-seeded', '1');
  }, seed);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  if (pausedClock) {
    await page.clock.install({ time: new Date() });
    await page.clock.pauseAt(new Date(Date.now() + 1000));
  }
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

function secondCycleFixtures() {
  // Fund and advance fixtures through the ordinary rules; these are checkpoints,
  // not claims about live typing speed or an optimal purchase sequence.
  const state = createState();
  state.autoEnabled = false;
  for (let count = 0; count < 400; count++) input(state, { mode: 'work' });
  assert.equal(buy(state, 'macro'), true);
  tick(state, 181);
  assert.equal(buy(state, 'book-syntax'), true);
  const learn = (s, id, target) => {
    for (let count = 0; skillKnowledge(s,id) < target; count++) {
      assert.ok(count < 20000, 'the study fixture must converge');
      input(s, { mode: 'study', subject: id, chars: 10 });
      tick(s, 1);
    }
  };
  learn(state, 'syntax', projectAt(0).req.syntax);
  while (state.progress < projectAt(0).target) {
    input(state, { mode: 'dev', chars: 10 });
    tick(state, 1);
  }
  assert.ok(release(state));
  assert.equal(state.projectIndex, 1);
  assert.equal(buy(state, 'book-design'), true);
  Object.assign(state, { mode: 'study', subject: 'design', inputStyle: 'typing' });
  const start = structuredClone(state), near = structuredClone(state);
  const project = projectAt(1);
  const studyStroke = s => typingPower(s,'study','design') * TYPING_REWARD.character;
  while (skillKnowledge(near,'design') + studyGain(near, studyStroke(near), 'design') < project.req.design) {
    input(near, { mode: 'study', subject: 'design', chars: studyStroke(near) });
    tick(near, .2);
  }

  const ready = structuredClone(state);
  learn(ready, 'syntax', project.req.syntax);
  assert.equal(buy(ready, 'book-graphics'), true);
  learn(ready, 'design', project.req.design);
  learn(ready, 'graphics', project.req.graphics);
  const devStroke = s => typingPower(s,'dev') * TYPING_REWARD.character;
  while (ready.progress + developmentGain(ready, devStroke(ready)) < project.target) {
    input(ready, { mode: 'dev', chars: devStroke(ready) });
    tick(ready, .2);
  }
  if (ready.defects > defectLimit(ready) * .1) {
    ready.refactor = true;
    while (ready.defects > defectLimit(ready) * .1) input(ready, { mode: 'dev', chars: 10 });
    ready.refactor = false;
  }
  Object.assign(ready, { mode: 'study', subject: 'graphics' });
  return { start, near, ready };
}

async function verifySecondCycle(browser, url, errors, capture) {
  const fixtures = secondCycleFixtures();
  const first = await open(browser, url, errors, { width: 390, height: 844 }, fixtures.start, true);
  try {
    const p = first.page;
    assert.equal(await p.locator('#goal-action').getAttribute('data-goal-item'), 'design');
    assert.equal(await p.locator('#goal-action').getAttribute('data-goal-kind'), 'study');
    const before = await p.locator('#goal-bar').evaluate(el => parseFloat(el.style.width));
    await p.locator('#type-button').click();
    const prompt = await p.locator('#editor-content').getAttribute('data-prompt');
    await p.keyboard.type(prompt[0]);
    assert.equal(await p.locator('#goal-action').getAttribute('data-goal-item'), 'design', 'one correct character must not replace the chosen subject with an unaffordable textbook');
    const after = await p.locator('#goal-bar').evaluate(el => parseFloat(el.style.width));
    assert.ok(after > before && after > 0, 'learning a non-bottleneck field must visibly advance preparation');
    assert.match(await p.locator('[data-subject=design] small').innerText(), /\/ 8/);
    assert.match(await p.locator('#goal-status').innerText(), /0 \/ 3.*分野/);
    if (capture) await capture(p, 'second-design-start');
  } finally { await first.context.close(); }

  const lastCharacter = await open(browser, url, errors, { width: 390, height: 844 }, fixtures.near, true);
  try {
    const p = lastCharacter.page;
    await p.locator('#type-button').click();
    const prompt = await p.locator('#editor-content').getAttribute('data-prompt');
    await p.keyboard.type(prompt[0]);
    assert.match(await p.locator('[data-subject=design] small').innerText(), /✓/);
    assert.match(await p.locator('#goal-status').innerText(), /1 \/ 3.*分野/);
    assert.equal(await p.locator('#goal-action').getAttribute('data-goal-item'), 'book-graphics', 'completing the chosen field exposes the next unmet requirement');
  } finally { await lastCharacter.context.close(); }

  const ready = await open(browser, url, errors, { width: 390, height: 844 }, fixtures.ready, true);
  try {
    const p = ready.page;
    for (const id of ['syntax', 'design', 'graphics']) assert.match(await p.locator(`[data-subject=${id}] small`).innerText(), /✓/);
    assert.equal(await p.locator('#goal-action').getAttribute('data-goal-kind'), 'dev');
    await p.locator('#goal-action').click();
    assert.equal(await p.locator('[data-mode=dev]').getAttribute('aria-selected'), 'true');
    assert.match(await p.locator('#progress-summary').innerText(), /9,?000/);
    const prompt = await p.locator('#editor-content').getAttribute('data-prompt');
    await p.keyboard.type(prompt[0]);
    assert.equal(await p.locator('#release-button').isDisabled(), false);
    await p.locator('#release-button').click();
    assert.match(await p.locator('#modal-body').innerText(), /NOW ON SALE/);
    if (capture) await capture(p, 'second-release');
    await p.locator('[data-action=next-project]').click();
    assert.match(await p.locator('#next-goal').innerText(), /雨のダンジョン/);
    const published = await snapshot(p);
    assert.equal(published.projectIndex, 2);
    assert.ok(published.catalog.some(title => title.index === 1 && title.royalty > 0));
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { await ready.context.close(); }
}

export async function verifyEarlyGameUI(browser, url, errors, { capture } = {}) {
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    const { context, page } = await open(browser, url, errors, viewport);
    try {
      const goal = page.locator('#goal-action');
      assert.match(await goal.innerText(), /OCR.*500/);
      assert.equal(await goal.getAttribute('data-goal-kind'), 'buy');
      assert.equal(await goal.getAttribute('data-goal-item'), 'macro');
      assert.equal(await goal.isDisabled(), true, 'a new player must earn the first OCR purchase');
      assert.equal(await page.locator('#goal-alternative').isVisible(), true);
      assert.match(await page.locator('#goal-alternative').innerText(), /教材.*1,500/);
      assert.equal(await page.locator('#goal-alternative').getAttribute('data-goal-item'), 'book-syntax');
      assert.equal(await page.locator('#goal-alternative').isDisabled(), true, 'the textbook-first alternative must also require sufficient funds');
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

  let automationState;
  const purchase = await open(browser, url, errors, { width: 390, height: 844 }, undefined, true);
  try {
    const page = purchase.page;
    for (let count = 0; count < 400; count++) await page.locator('#type-button').click({ delay: 0 });
    const earned = await snapshot(page);
    assert.equal(earned.stats.manual, 400, 'the first investment must come from 400 real pointer clicks');
    assert.equal(earned.cash, 500);
    assert.equal(await page.locator('#goal-action').isDisabled(), false);
    await page.locator('#goal-action').click();
    automationState = await snapshot(page);
    assert.equal(automationState.items.macro, 1);
    assert.equal(automationState.cash, 0);
    assert.equal(automationState.subject, 'syntax', 'an automation purchase must not turn the study subject into macro');
    assert.equal(automationState.mode, 'work');
    assert.equal(await page.locator('#goal-alternative').isVisible(), false);
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-item'), 'book-syntax');
    assert.equal(await page.locator('#goal-action').isDisabled(), true);
    assert.match(await page.locator('#auto-work').innerText(), /^10(?:\.0+)?\s+作業量\/秒/);
    // Advance the clock, not resources: the normal game timer earns the textbook money.
    await page.clock.fastForward(181000);
    const automated = await snapshot(page);
    assert.ok(automated.cash >= 1500, 'OCR income must fund the first textbook without more manual work');
    assert.equal(automated.stats.manual, 400);
    if (capture) await capture(page, 'ocr-funded-textbook');
    // The normal purchase CTA must remain keyboard accessible despite the click-farming guard.
    await page.locator('#goal-action').focus();
    await page.keyboard.press('Enter');
    const bought = await snapshot(page);
    assert.equal(bought.items['book-syntax'], 1, 'the goal CTA must buy the actual textbook');
    assert.equal(bought.cash, automated.cash - 1500, 'the purchase must charge the displayed price exactly once');
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

  const affordable = createState();
  affordable.cash = 1500;
  const directBook = await open(browser, url, errors, { width: 390, height: 844 }, affordable, true);
  try {
    const page = directBook.page;
    await page.locator('#goal-alternative').click();
    const bought = await snapshot(page);
    assert.equal(bought.items['book-syntax'], 1, 'the alternative CTA must preserve the textbook-first route');
    assert.equal(bought.items.macro, 0);
    assert.equal(bought.cash, 0);
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'), 'study');
    assert.equal(await page.locator('#goal-action').isDisabled(), false);
    assert.equal(await page.locator('#goal-alternative').getAttribute('data-goal-item'), 'macro');
  } finally { await directBook.context.close(); }

  const combined = await open(browser, url, errors, { width: 390, height: 844 }, automationState, true);
  try {
    const page = combined.page;
    const workValue = s => s.cash + s.job.progress * s.job.rate;
    const before = await snapshot(page);
    await page.locator('[data-input-style=typing]').click();
    await page.locator('#type-button').click();
    const prompt = await page.locator('#editor-content').getAttribute('data-prompt');
    await page.keyboard.type(prompt);
    const typed = await snapshot(page);
    const expected = prompt.length * typingPower(before,'work') * (TYPING_REWARD.character + TYPING_REWARD.officeCompletion);
    assert.ok(Math.abs(workValue(typed) - workValue(before) - expected) < .001, 'perfect office completion must earn the current physical-key typing reward and owned-equipment capacity');
    assert.equal(typed.typing.completed, 1);
    assert.equal(typed.stats.manual, before.stats.manual + prompt.length);
    await page.clock.fastForward(10000);
    const together = await snapshot(page);
    assert.ok(Math.abs(workValue(together) - workValue(typed) - 100) < .001, 'the first clean OCR delivery must add its own payment independently of manual typing');
    assert.deepEqual(together.job,typed.job,'OCR must not consume or change the hand-entered contract');
    assert.equal(together.stats.manual, typed.stats.manual);
  } finally { await combined.context.close(); }

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
  await verifySecondCycle(browser, url, errors, capture);
  console.log('Early-game checks passed: visible purchase goal, progressive metrics, textbook purchase and development route, compact invoice/cursor visibility, error correction, next invoice focus and keyboard guards.');
}
