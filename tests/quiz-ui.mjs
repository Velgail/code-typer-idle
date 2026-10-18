// UI and reward integration tests. Only the compiler Worker is replaced with a
// deterministic protocol fixture. Real runtime checks are a separate suite.
import assert from 'node:assert/strict';
import { quizAt } from '../src/quizcatalog.js';
import { skillKnowledge, QUIZ_UNITS } from '../src/core.js';

const SAVE = 'code-typer-idle:save:v1';
const rows = ['cpp', 'lua', 'python'].flatMap(language => [0, 1].map(index => {
  const quiz = quizAt(language, 'syntax', index);
  return { language, functionName: quiz.functionName, expected: quiz.cases.map(row => row.expected) };
}));
const fixtureWorker = `
// Protocol fixture; does not compile or evaluate user code.
const rows=${JSON.stringify(rows)};
let language;
self.onmessage=event=>{
 const message=event.data;
 if(message.type==='initialize'){
  language=message.language;
  self.postMessage({id:message.id,type:'progress',text:'実行環境を読み込み中…'});
  self.postMessage({id:message.id,type:'ready'});return;
 }
 if(message.type!=='execute')return;
 const row=rows.find(row=>row.language===language&&message.source.includes(row.functionName));
 const result=message.source.includes('CTI_COMPILE_ERROR')?{error:'構文を確認してください。',errorKind:'compile',diagnostics:[{phase:'compile',message:'test compiler diagnostic'}]}:
  message.source.includes('CTI_RUNTIME_ERROR')?{error:'実行中に例外が発生しました。',errorKind:'runtime'}:
  {stdout:(row?row.expected.map(value=>message.source.includes('CTI_TEST_CORRECT')?value:123456789):[]).join('\\n')+'\\n'};
 setTimeout(()=>self.postMessage({id:message.id,type:'result',result}),message.source.includes('CTI_DELAY')?500:30);
};`;

async function snapshot(page) {
  await page.locator('#save-button').click();
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
}

async function run(page, source, expectedStatus) {
  await page.locator('.quiz-source').fill(source);
  await page.locator('.quiz-run').click();
  await page.waitForFunction(status => document.querySelector('#quiz-panel')?.dataset.quizStatus === status, expectedStatus);
}

export async function verifyQuizUI(browser, url, errors, capture) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.route(/\/quizworker(?:\.[a-f0-9]+)?\.js(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: fixtureWorker }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date() });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  try {
    await page.goto(url);
    await page.waitForSelector('.buy-button');
    await page.locator('[data-mode=study]').click();
    await page.locator('[data-study-style=quiz]').click();
    assert.equal(await page.locator('#quiz-panel').isVisible(), false, 'materials still gate Quiz');
    assert.equal(await page.locator('#study-lock').isVisible(), true);
    await page.locator('#study-lock [data-action=open-online-material]').click();
    await page.locator('.quiz-source').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.quiz-source').getAttribute('maxlength'), '24000');
    assert.match(await page.locator('.quiz-save-hint').innerText(), /24,000字まで · 直近12題のコードを保存/);
    await page.locator('#language-select').selectOption('sql');
    const sqlQuiz = quizAt('sql', 'syntax', 0);
    const fixture = page.locator('.quiz-fixture-table').first();
    assert.equal(await fixture.isVisible(), true, 'SQL shows the initial database instead of an empty argument list');
    assert.equal(await fixture.locator('caption').innerText(), 'sample(id, amount, group_id, enabled)');
    assert.deepEqual(await fixture.locator('thead th').allTextContents(), ['id', 'amount', 'group_id', 'enabled']);
    assert.deepEqual(await fixture.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => Number(cell.textContent)))), sqlQuiz.cases[0].fixtureRows);
    await page.locator('[data-subject=systems]').click();
    await page.locator('#study-lock [data-action=open-online-material]').click();
    await page.locator('.quiz-topic-picker select').selectOption('3');
    const counter = page.locator('.quiz-case:visible').first().locator('.quiz-case-values > div').filter({ has: page.locator('dt', { hasText: 'quiz_config.counter_limit' }) });
    assert.equal(await counter.isVisible(), true, 'recursive SQL shows its configuration input');
    assert.equal(await counter.locator('dd').innerText(), String(quizAt('sql', 'systems', 3).cases[0].counterLimit));
    await page.locator('[data-subject=syntax]').click();
    await page.locator('#language-select').selectOption('lua');
    assert.equal(await page.locator('.quiz-topic-picker option').count(), 16, 'all topics are directly accessible');
    assert.equal(await page.locator('#typing-input').isVisible(), false, 'Quiz uses its own free editor');
    assert.equal(await page.locator('#typing-summary').isVisible(), false);
    assert.equal(await page.locator('.quiz-reference').isVisible(), false, 'reference starts closed');
    let before = await snapshot(page);
    assert.equal(skillKnowledge(before, 'syntax'), 0);
    const quiz = quizAt('lua', 'syntax', 0), correct = `${quiz.referenceSource}\n-- CTI_TEST_CORRECT`;
    assert.equal(await page.locator('.quiz-case:visible').count(), 3, 'show a compact preview instead of dozens of expanded cases');
    await page.locator('.quiz-more-cases > summary').click();
    assert.equal(await page.locator('.quiz-case:visible').count(), quiz.cases.length, 'the entire test list remains accessible');
    await page.locator('.quiz-more-cases > summary').click();
    await page.locator('.quiz-reference-toggle').click();
    assert.equal(await page.locator('.quiz-reference').isVisible(), true);
    let saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), 0, 'viewing reference does not reward');
    await page.locator('.quiz-reference-toggle').click();
    await run(page, `${quiz.starterSource}\n-- CTI_COMPILE_ERROR`, 'compile-error');
    assert.match(await page.locator('.quiz-status').innerText(), /コンパイルエラー/);
    saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), 0);
    await run(page, `${quiz.starterSource}\n-- CTI_RUNTIME_ERROR`, 'runtime-error');
    assert.match(await page.locator('.quiz-status').innerText(), /実行時エラー/);
    await run(page, quiz.starterSource, 'failed');
    assert.match(await page.locator('.quiz-status').innerText(), /不合格/);
    assert.equal(await page.locator('.quiz-next').isVisible(), false);
    saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), 0, 'a wrong answer has no reward');
    assert.equal(saved.stats.chars, before.stats.chars, 'editing and failed submissions add no work');
    await run(page, correct, 'passed');
    const first = await snapshot(page), firstKnowledge = skillKnowledge(first, 'syntax');
    assert.ok(firstKnowledge > 0, 'first complete pass awards understanding');
    assert.ok(first.quiz.completed.includes(quiz.id));
    assert.equal(first.stats.manual, before.stats.manual, 'editing and execution are not typing reward');
    assert.equal(first.stats.chars - before.stats.chars, QUIZ_UNITS, 'only the one-time successful learning work is counted');
    await page.locator('.quiz-run').click();
    await page.waitForFunction(() => document.querySelector('#quiz-panel').dataset.quizStatus === 'passed');
    const repeated = await snapshot(page);
    assert.equal(skillKnowledge(repeated, 'syntax'), firstKnowledge, 'repeating a pass never duplicates its reward');
    assert.equal(repeated.quiz.completed.filter(id => id === quiz.id).length, 1);

    await page.locator('.quiz-source').fill(correct + '\n-- edited');
    assert.equal(await page.locator('#quiz-panel').getAttribute('data-quiz-status'), 'stale');
    assert.equal(await page.locator('.quiz-next').isVisible(), false, 'a stale pass cannot advance as a fresh result');
    await page.locator('.quiz-topic-picker select').selectOption('1');
    const secondQuiz = quizAt('lua', 'syntax', 1), secondCorrect = `${secondQuiz.referenceSource}\n-- CTI_TEST_CORRECT`;
    await page.locator('.quiz-source').fill(secondCorrect + '\n-- CTI_DELAY');
    await page.locator('.quiz-run').click();
    assert.equal(await page.locator('.quiz-cancel').isVisible(), true);
    await page.locator('.quiz-cancel').click();
    await page.waitForTimeout(650);
    saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), firstKnowledge);
    assert.ok(!saved.quiz.completed.includes(secondQuiz.id), 'cancelled result cannot reward');

    await page.locator('.quiz-run').click();
    await page.locator('.quiz-source').fill('function unfinished(');
    await page.waitForTimeout(650);
    saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), firstKnowledge, 'editing cancels an in-flight pass');
    assert.ok(!saved.quiz.completed.includes(secondQuiz.id));
    assert.equal(await page.locator('.quiz-next').isVisible(), false);

    await page.locator('.quiz-source').fill(secondCorrect + '\n-- CTI_DELAY');
    await page.locator('.quiz-run').click();
    await page.locator('#language-select').selectOption('python');
    await page.waitForTimeout(650);
    saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), firstKnowledge, 'switching language rejects an old result');
    assert.ok(!saved.quiz.completed.includes(secondQuiz.id));

    await page.locator('#language-select').selectOption('lua');
    assert.equal(await page.locator('.quiz-topic-picker select').inputValue(), '1');
    const savedDraft = secondCorrect + '\n-- saved draft';
    await page.locator('.quiz-source').fill(savedDraft);
    await snapshot(page);
    await page.reload();
    await page.locator('.quiz-source').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#language-select').inputValue(), 'lua');
    assert.equal(await page.locator('.quiz-topic-picker select').inputValue(), '1');
    assert.equal(await page.locator('.quiz-source').inputValue(), savedDraft, 'unfinished source survives reload');
    saved = await snapshot(page);
    assert.equal(skillKnowledge(saved, 'syntax'), firstKnowledge);
    assert.deepEqual(saved.quiz.completed, first.quiz.completed, 'completion and one-time reward survive reload');
    await run(page, secondCorrect, 'passed');
    const second = await snapshot(page);
    assert.ok(skillKnowledge(second, 'syntax') > firstKnowledge);
    assert.equal(second.quiz.completed.length, first.quiz.completed.length + 1);

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `Quiz fits ${width}px`);
    }
    if (capture) await capture(page, 'quiz-all-passed');
  } finally { await context.close(); }
}
