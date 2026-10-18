import assert from 'node:assert/strict';
import { experienceRequirements } from '../src/career.js';
import { createState, tick, projectAt, typingPower, skillKnowledge, readingLesson, input, BALANCE_VERSION } from '../src/core.js';
import { currentOCRReview, TYPING_REWARD } from '../src/typing.js';

const SAVE = 'code-typer-idle:save:v1';

async function open(browser, url, errors, seed, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await context.addInitScript(data => {
    if (sessionStorage.getItem('automation-quality-seeded')) return;
    data.savedAt = Date.now();
    localStorage.setItem('code-typer-idle:save:v1', JSON.stringify(data));
    sessionStorage.setItem('automation-quality-seeded', '1');
  }, seed);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date() });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto(url);
  await page.waitForSelector('.buy-button');
  return { context, page };
}

async function snapshot(page) {
  await page.locator('#save-button').click();
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
}

async function focus(page) {
  await page.locator('#type-button').click();
  assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true);
}

async function assertReviewVisible(page, label) {
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return { image: rect('#office-image'), wrong: rect('#ocr-review .ocr-row mark'), input: rect('#typing-input'), width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  for (const [name, r] of Object.entries({ image: layout.image, wrong: layout.wrong, input: layout.input })) {
    assert.ok(r.width > 0 && r.height > 0, `${label}: ${name} is visible`);
    assert.ok(r.x >= -1 && r.right <= layout.width + 1 && r.y >= -1 && r.bottom <= layout.height + 1, `${label}: source, OCR error and caret fit together: ${name} ${JSON.stringify(r)}`);
  }
  assert.ok(layout.input.y >= layout.image.bottom - 1, `${label}: the original must not cover the input`);
  assert.equal(layout.overflow, false, `${label}: no horizontal page overflow`);
}

function ocrState() {
  const s = createState();
  s.cash = 0;
  s.items.macro = 1;
  s.autoEnabled = false;
  s.inputStyle = 'typing';
  s.job = { progress: 37, rate: 1 };
  s.office.remaining-=37;
  // Pick a multi-character price correction, so partial input can be tested.
  s.ocr.cursor = 1;
  return s;
}

async function verifyOCR(browser, url, errors, capture) {
  const { context, page } = await open(browser, url, errors, ocrState());
  try {
    await page.clock.fastForward(100000);
    const delivered = await snapshot(page);
    assert.equal(delivered.cash, 880, 'ten OCR orders pay 1000, cancel one 100 payment and charge a 20 fee');
    assert.equal(delivered.ocr.pending, 1);
    assert.equal(delivered.ocr.pendingReward, 100);
    assert.equal(delivered.ocr.fees, 20);
    assert.deepEqual(delivered.job, { progress: 37, rate: 1 }, 'automatic deliveries must leave the manual contract untouched');
    assert.match(await page.locator('#ocr-status').innerText(), /誤納品 1件.*回収待ち ¥100.*手数料 ¥20/);
    assert.ok(delivered.log.some(row => /報酬 100円を取消/.test(row.text)), 'the cancelled OCR payment is explained separately from the fee');

    await page.locator('[data-work-task=correction]').click();
    await focus(page);
    const before = await snapshot(page), review = currentOCRReview(before);
    assert.ok(review && review.correctValue.length > 1);
    assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'), review.correctValue, 'only the misread field is an input target');
    assert.equal(await page.locator('#ocr-review .ocr-row mark').innerText(), review.ocrValue);
    assert.notEqual(review.ocrValue, review.correctValue);
    await focus(page);
    await assertReviewVisible(page, '390×844');
    if (capture) await capture(page, 'ocr-correction-844');
    const details = page.locator('#ocr-review details'), summary = details.locator('summary');
    await summary.click();
    assert.equal(await details.evaluate(el => el.open), true);
    assert.equal(await summary.evaluate(el => el === document.activeElement), true);
    await page.clock.fastForward(1250);
    assert.equal(await details.evaluate(el => el.open), true, 'periodic OCR rendering must preserve expanded settlement details');
    assert.equal(await summary.evaluate(el => el === document.activeElement), true, 'periodic OCR rendering must preserve summary focus');
    await focus(page);
    await page.keyboard.type('?');
    await page.clock.fastForward(1250);
    assert.equal(await page.locator('#typing-input').inputValue(), '?', 'periodic OCR rendering must not discard an unaccepted draft');
    assert.equal(await page.locator('#typing-input').evaluate(el => el === document.activeElement), true, 'periodic OCR rendering must preserve the typing focus');
    assert.equal(await details.evaluate(el => el.open), true, 'typing and periodic rendering must not collapse settlement details');
    await page.keyboard.press('Backspace');
    await summary.click();
    await page.setViewportSize({ width: 390, height: 450 });
    await page.clock.fastForward(1);
    await focus(page);
    await assertReviewVisible(page, '390×450');
    if (capture) await capture(page, 'ocr-correction-450');

    const mark = await page.locator('.next-character').boundingBox();
    await page.keyboard.type('?');
    assert.equal(await page.locator('#typing-input').inputValue(), '?');
    const draft = await page.locator('#typing-input').boundingBox();
    assert.ok(Math.abs(draft.x - mark.x) <= 1, 'an office typo stays at the expected position');
    assert.equal(await page.locator('#typing-input').evaluate(el => getComputedStyle(el).textDecorationLine), 'underline');
    assert.match(await page.locator('#input-feedback').innerText(), new RegExp(review.fieldLabel));
    await page.keyboard.press('Backspace');
    await page.keyboard.type(review.correctValue.slice(0, 1));
    const partial = await snapshot(page);
    assert.equal(partial.cash, before.cash, 'unsubmitted correction input must not pay or fine');
    assert.equal(partial.ocr.pending, 1);
    assert.equal(partial.typing.offset, 1);
    assert.ok(partial.typing.bonusBase > 0);
    assert.deepEqual(partial.typing.correction, before.typing.correction, 'the paper/version/quote snapshot stays stable');
    assert.deepEqual(partial.job, before.job);

    await page.reload();
    await page.waitForSelector('.buy-button');
    const restored = await snapshot(page);
    assert.equal(restored.typing.offset, partial.typing.offset);
    assert.equal(restored.typing.bonusBase, partial.typing.bonusBase);
    assert.deepEqual(restored.typing.correction, partial.typing.correction);
    assert.equal(await page.locator('#typing-input').inputValue(), '');
    await page.locator('[data-mode=study]').click();
    await page.locator('[data-mode=work]').click();
    const switched = await snapshot(page);
    assert.equal(switched.cash, before.cash, 'changing modes must not submit a partial correction');
    assert.deepEqual(switched.typing.correction, before.typing.correction);
    assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'), review.correctValue);
    await focus(page);
    const current = await page.locator('#typing-round').innerText();
    const offset = Number(current.match(/^\d+/)[0]);
    await page.keyboard.type(review.correctValue.slice(offset));
    const fixed = await snapshot(page);
    assert.equal(fixed.cash, before.cash + 100, 'resubmission recovers exactly the cancelled payment');
    assert.equal(fixed.ocr.pending, 0);
    assert.equal(fixed.ocr.pendingReward, 0);
    assert.equal(fixed.ocr.corrected, 1);
    assert.equal(fixed.ocr.fees, 20, 'the already charged fee is not refunded');
    assert.deepEqual(fixed.job, before.job, 'correction must not also receive normal office work');
    assert.equal(await page.locator('#type-button').isDisabled(), true);
    assert.equal(await page.locator('#typing-input').isVisible(), false);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    const empty = await snapshot(page);
    assert.equal(empty.cash, fixed.cash, 'an empty correction queue cannot pay twice');
    assert.equal(empty.ocr.corrected, fixed.ocr.corrected);
  } finally { await context.close(); }

  const legacy = ocrState();
  tick(legacy, 100);
  legacy.projectIndex = 1;
  legacy.workTask = 'correction';
  legacy.ocr.buckets[0].version = 1;
  legacy.ocr.buckets[0].rate = 3;
  legacy.ocr.pendingReward = 300;
  const oldReview = currentOCRReview(legacy);
  const old = await open(browser, url, errors, legacy);
  try {
    const p = old.page;
    assert.equal(await p.locator('#editor-content').getAttribute('data-prompt'), oldReview.correctValue);
    await focus(p);
    await p.keyboard.type(oldReview.correctValue);
    const after = await snapshot(p);
    assert.equal(after.cash, legacy.cash + 300, 'old corrections keep their 300-yen quote after new office work is fixed at 100');
    assert.deepEqual(after.job, legacy.job);
  } finally { await old.context.close(); }
}

async function verifyLegacyOCR(browser, url, errors, capture) {
  const legacy=ocrState();
  tick(legacy,100);
  Object.assign(legacy,{balanceVersion:12,cash:1234,projectIndex:2,items:{macro:3,'book-syntax':1,'book-design':1,'book-graphics':1},job:{progress:37,rate:3},ocrJob:{progress:25,rate:2},runReleased:2,runBest:2});
  Object.assign(legacy.skills,{syntax:25.2,design:8.4,graphics:8.4});
  legacy.stats.releases=2;
  legacy.ocr.buckets[0].rate=3;
  legacy.ocr.buckets[0].version=1;
  legacy.ocr.pendingReward=300;
  legacy.catalog=[{name:projectAt(0).name,index:0,quality:80,royalty:0,payout:0,active:true},{name:projectAt(1).name,index:1,quality:80,royalty:1.6,payout:21000,active:true}];
  const {context,page}=await open(browser,url,errors,legacy,{width:1100,height:1000});
  try{
    const migrated=await snapshot(page);
    assert.equal(migrated.balanceVersion,BALANCE_VERSION);
    assert.equal(migrated.items.macro,1,'old OCR expansions become one owned license');
    assert.equal(migrated.cash,1234+3750+9375,'removed expansions refund their actual historical purchase prices');
    assert.deepEqual(migrated.job,legacy.job);
    assert.deepEqual(migrated.ocrJob,legacy.ocrJob);
    assert.equal(migrated.ocr.pendingReward,300,'unrecovered old contracts keep their agreed value');
    assert.equal(migrated.catalog.find(title=>title.index===1).royalty,32,'the old commercial title receives the new recurring game revenue');
    assert.match(await page.locator('#event-log').innerText(),/13,125.*返金/);
    assert.match(await page.locator('#auto-work').innerText(),/^10(?:\.0+)?\s+作業量\/秒/);
    assert.match(await page.locator('#royalty').innerText(),/¥24\s*\/ 秒/);
    assert.match(await page.locator('#net-income').innerText(),/¥32\.8\s*\/ 秒/);
    await page.locator('[data-shop=auto]').click();
    assert.equal(await page.locator('[data-buy=macro]').isDisabled(),true);
    assert.match(await page.locator('[data-buy=macro]').innerText(),/導入済み/);
    if(capture)await capture(page,'legacy-ocr-license');
    await page.reload();
    await page.waitForSelector('.buy-button');
    const again=await snapshot(page);
    assert.equal(again.cash,migrated.cash,'reloading a migrated save must not repeat the refund');
    assert.equal(again.catalog.find(title=>title.index===1).royalty,migrated.catalog.find(title=>title.index===1).royalty,'reloading must not repeat the royalty conversion');
    assert.equal(again.items.macro,1);
    assert.equal(again.ocr.pendingReward,300);
  }finally{await context.close();}
}

async function verifyContractCompletion(browser,url,errors){
  const seed=ocrState();
  tick(seed,500);
  assert.equal(seed.office.remaining,0);
  const {context,page}=await open(browser,url,errors,seed);
  try{
    assert.match(await page.locator('#office-contract').innerText(),/納品(?:は)?完了|契約完了/);
    assert.equal(await page.locator('#type-button').isDisabled(),true,'finished contracts explain why ordinary office entry stops');
    assert.equal(await page.locator('#typing-input').isVisible(),false);
    assert.equal(await page.locator('#goal-action').isDisabled(),false,'learning remains available when office work is finished');
    const before=await snapshot(page);
    await page.clock.fastForward(3600000);
    const after=await snapshot(page);
    assert.equal(after.office.remaining,0,'a new game day does not invent new contracts');
    assert.equal(after.stats.jobs,before.stats.jobs);
    assert.equal(after.cash,before.cash);
    await page.locator('[data-work-task=correction]').click();
    await focus(page);
    const reviewing=await snapshot(page),review=currentOCRReview(reviewing);assert.ok(review);
    await focus(page);
    await page.keyboard.type(review.correctValue);
    const fixed=await snapshot(page);
    assert.equal(fixed.cash,after.cash+100,'finished contracts still permit correction of already submitted invoices');
    assert.equal(fixed.office.remaining,0);
  }finally{await context.close();}
}

async function verifyStudy(browser, url, errors, capture) {
  const seed = createState();
  Object.assign(seed, { mode: 'study', inputStyle: 'typing', autoEnabled: false });
  seed.items['book-syntax'] = 1;
  seed.items.lab = 1;
  seed.skills.syntax = projectAt(0).req.syntax;
  seed.studyGaps.syntax = 4;
  const { context, page } = await open(browser, url, errors, seed, { width: 1100, height: 1000 });
  try {
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'), 'study', 'nominal target alone must not unlock development');
    assert.match(await page.locator('[data-subject=syntax] small').innerText(), /8 \/ 12/);
    assert.doesNotMatch(await page.locator('[data-subject=syntax] small').innerText(), /✓/);
    assert.match(await page.locator('#development-readiness').innerText(), /8 \/ 12/);
    assert.match(await page.locator('#auto-study').innerText(), /基礎文法|文法/);
    assert.match(await page.locator('#task-description').innerText(), /未確認/);
    const initial = await snapshot(page);
    await page.clock.fastForward(1000);
    const lab = await snapshot(page);
    assert.ok(skillKnowledge(lab,'syntax') > skillKnowledge(initial,'syntax'), 'automatic learning still makes confirmed progress');
    assert.ok(lab.studyGaps.syntax > initial.studyGaps.syntax, 'automatic learning exposes its unconfirmed share');
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'), 'study');
    await focus(page);
    const prompt = await page.locator('#editor-content').getAttribute('data-prompt');
    await page.keyboard.type(prompt[0]);
    const typed = await snapshot(page);
    assert.ok(typed.studyGaps.syntax < lab.studyGaps.syntax, 'correct manual code confirms existing unverified learning');
    assert.ok(skillKnowledge(typed,'syntax') > skillKnowledge(lab,'syntax'));

    await page.locator('[data-study-style=reading]').click();
    const lesson = readingLesson(typed);
    const before = await snapshot(page);
    await page.locator(`[data-read-answer="${lesson.answer}"]`).click();
    const answered = await snapshot(page);
    assert.ok(answered.studyGaps.syntax < before.studyGaps.syntax, 'finite comprehension questions count as manual understanding, not automation');
    assert.ok(skillKnowledge(answered,'syntax') > skillKnowledge(before,'syntax'));
    assert.equal(await page.locator(`[data-read-answer="${lesson.answer}"]`).isDisabled(), true);
    await page.reload();
    await page.waitForSelector('.buy-button');
    const saved = await snapshot(page);
    assert.equal(saved.studyGaps.syntax, answered.studyGaps.syntax);
    assert.equal(saved.skills.syntax, answered.skills.syntax);
    assert.equal(await page.locator(`[data-read-answer="${lesson.answer}"]`).isDisabled(), true, 'reloading must not reuse a comprehension reward');
    if (capture) await capture(page, 'confirmed-study-reading');
  } finally { await context.close(); }
}

async function verifyCapacityAndQuality(browser, url, errors, capture) {
  const seed = createState();
  Object.assign(seed, { projectIndex: 4, mode: 'dev', inputStyle: 'typing', autoEnabled: false });
  const access=experienceRequirements(4);seed.experience={...access.experience};Object.assign(seed.items,access.items);
  seed.items.cluster = 4;
  for (const [id, required] of Object.entries(projectAt(4).req)) { seed.skills[id] = required; seed.items[`book-${id}`] = 1; }
  const { context, page } = await open(browser, url, errors, seed, { width: 1440, height: 1100 });
  try {
    const expected = typingPower(seed) * TYPING_REWARD.character;
    assert.ok(expected > TYPING_REWARD.character * 100, 'owned late-game capacity materially increases a correct key');
    const before = await snapshot(page);
    const display = await page.locator('#input-power').innerText();
    assert.match(display, /正解キー/);
    const match=display.match(/([\d,.]+)(万|億|兆)?/),scale=({万:1e4,億:1e8,兆:1e12})[match[2]] || 1;
    const displayed = Number(match[1].replaceAll(',',''))*scale;
    assert.ok(Math.abs(displayed - expected) <= .01*scale, 'the displayed key power includes owned cluster capacity, with its displayed rounding');
    await page.locator('#automation-toggle').click();
    assert.equal(await page.locator('#input-power').innerText(), display, 'turning automatic development on must not increase typing pay');
    await page.locator('#automation-toggle').click();
    assert.equal(await page.locator('#input-power').innerText(), display);
    await focus(page);
    const prompt = await page.locator('#editor-content').getAttribute('data-prompt');
    await page.keyboard.type(prompt[0]);
    const after = await snapshot(page);
    assert.ok(Math.abs(after.stats.chars - before.stats.chars - expected) < .001, 'the real input receives the displayed equipment-aware power');
    assert.ok(after.progress > before.progress);
    const generated = structuredClone(before);
    input(generated, { mode: 'dev', chars: expected, manual: false, automation: true });
    assert.ok(generated.debt > after.debt, 'the same amount of unattended code leaves more technical debt');
    assert.ok(generated.defects > after.defects, 'the same amount of unattended code leaves more defects');
    await focus(page);
    await page.keyboard.type('?');
    const typo = await page.evaluate(() => {
      const field = document.querySelector('#typing-input'), mark = document.querySelector('.next-character');
      const range = document.createRange();
      range.selectNodeContents(mark);
      const source = range.getClientRects()[0], draft = field.getBoundingClientRect(), style = getComputedStyle(field);
      return { x: draft.x, sourceX: source.x, center: draft.y + draft.height / 2, sourceCenter: source.y + source.height / 2, decoration: style.textDecorationLine, shadow: style.boxShadow };
    });
    assert.ok(Math.abs(typo.x - typo.sourceX) <= 1 && Math.abs(typo.center - typo.sourceCenter) <= 1, 'equipment-aware code input preserves typo position and baseline');
    assert.equal(typo.decoration, 'underline');
    assert.equal(typo.shadow, 'none');
    assert.match(await page.locator('#input-feedback').innerText(), /次の文字は/);
    await page.keyboard.press('Backspace');
    if (capture) await capture(page, 'cluster-typing');
  } finally { await context.close(); }
}

export async function verifyAutomationQuality(browser, url, errors, { capture } = {}) {
  await verifyOCR(browser, url, errors, capture);
  await verifyLegacyOCR(browser, url, errors, capture);
  await verifyContractCompletion(browser,url,errors);
  await verifyStudy(browser, url, errors, capture);
  await verifyCapacityAndQuality(browser, url, errors, capture);
  console.log('Automation quality checks passed: OCR cancellation/fee, field-only resubmission and one-time recovery, mobile source/error/caret, save/version/quote, confirmed learning and finite reading, equipment-aware typing and automatic code quality.');
}
