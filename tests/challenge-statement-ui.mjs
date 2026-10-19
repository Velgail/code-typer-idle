import assert from 'node:assert/strict';
import {createState,SKILLS} from '../src/core.js';
import {challengeById} from '../src/challengecatalog.js';

export async function verifyChallengeStatements(browser,url,errors) {
  const seed=createState();
  seed.autoEnabled=false;seed.mode='study';seed.studyStyle='quiz';seed.typing.language='cpp';
  seed.onlineMaterials=SKILLS.map(skill=>skill.id);
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  await context.addInitScript(data=>{
    if(sessionStorage.getItem('challenge-statement-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
    sessionStorage.setItem('challenge-statement-seeded','1');
  },seed);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(url);await page.waitForSelector('#quiz-panel .quiz-source');
    await page.locator('#quiz-panel .quiz-topic-picker select').selectOption('2');
    const quiz=challengeById('quiz/v1/cpp/syntax/sum_coins');
    const panel=page.locator('#quiz-panel');
    assert.equal(await panel.locator('.quiz-title').innerText(),quiz.title);
    const statement=await panel.locator('.quiz-description').innerText();
    assert.doesNotMatch(statement,/処理仕様|1ずつ増やして|for文|0除算/);
    assert.match(await panel.locator('.quiz-constraints').innerText(),/pickups.*0以上/);
    assert.equal(await panel.locator('.quiz-examples > ol > li').count(),3);
    assert.ok(await page.evaluate(()=>!!(document.querySelector('.quiz-examples').compareDocumentPosition(document.querySelector('.quiz-source'))&Node.DOCUMENT_POSITION_FOLLOWING)),'input examples precede the implementation editor');
    const editor=panel.locator('.quiz-source');
    const run=async source=>{
      await editor.fill(source);await panel.locator('.quiz-run').click();
      await page.waitForFunction(()=>!['idle','running','stale'].includes(document.querySelector('#quiz-panel')?.dataset.quizStatus),null,{timeout:120000});
    };
    await run('int sum_coins(int pickups, int coin, int total) { return coin * pickups; }');
    assert.equal(await panel.getAttribute('data-quiz-status'),'failed','overwriting the initial total is rejected by the real C++ runtime');
    await run('int sum_coins(int pickups, int coin, int total) { return total + coin * pickups; }');
    assert.equal(await panel.getAttribute('data-quiz-status'),'passed',await panel.innerText());
    assert.match(await panel.locator('.quiz-status').innerText(),new RegExp(`${quiz.cases.length} / ${quiz.cases.length}`));
    assert.ok(await panel.locator('.code-editor .ct-syntax-keyword').count()>0,'the editable C++ implementation is highlighted');
    for(const width of [390,360]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth)<=1,`${width}px statement/editor has no page overflow`);
    }
    await page.locator('#save-button').click();
    await page.reload();await panel.locator('.quiz-source').waitFor({state:'visible'});
    assert.match(await editor.inputValue(),/return total \+ coin \* pickups/,'the arithmetic alternative remains saved');
    await page.screenshot({path:'work/challenge-sum-coins.png',fullPage:true});
    await panel.locator('.quiz-topic-picker select').selectOption('17');
    const outputs=await panel.locator('.quiz-example-result code').allTextContents();
    assert.deepEqual(outputs,['[]','[1,3,5]'],'an empty-input example is followed by an example that demonstrates filtering');
    console.log('Challenge statement checks passed: visible examples and domains, real C++ multiplication alternative, rejected lost initial total, mobile layout, and saved code.');
  } finally {await context.close();}
}
