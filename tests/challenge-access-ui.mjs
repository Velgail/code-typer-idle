// Book-tier UI boundaries use a deterministic Worker protocol fixture. Actual
// language execution remains covered by the real-runtime validation suite.
import assert from 'node:assert/strict';
import { createState, challengeAccess, skillKnowledge, SKILLS } from '../src/core.js';
import { challengeTopics } from '../src/challengecatalog.js';

const SAVE='code-typer-idle:save:v1';
const topics=challengeTopics('cpp','syntax');
const applied=topics.find(quiz=>quiz.difficulty===3);
const marker='CTI_BOOK_ACCESS_BOUNDARY';
const worker=`self.onmessage=({data:message})=>{
 if(message.type==='initialize'){self.postMessage({id:message.id,type:'ready'});return;}
 if(message.type!=='execute')return;
 const expected=${JSON.stringify(applied.cases.map(test=>test.expected))};
 const correct=message.source.includes('${marker}');
 const lines=expected.map(value=>JSON.stringify(correct?value:null));
 self.postMessage({id:message.id,type:'result',result:{stdout:lines.join('\\n')+'\\n'}});
};`;

async function open(browser,url,errors,seed){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  let workers=0;
  await context.route(/\/quizworker(?:\.[a-f0-9]+)?\.js(?:\?.*)?$/,route=>{workers++;return route.fulfill({status:200,contentType:'text/javascript',body:worker});});
  await context.addInitScript(data=>{
    if(sessionStorage.getItem('challenge-access-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));sessionStorage.setItem('challenge-access-seeded','1');
  },seed);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date()});await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto(url);await page.waitForSelector('.quiz-source');
  return{context,page,workers:()=>workers};
}
async function saved(page){await page.locator('#save-button').click();return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);}
async function run(page){
  await page.locator('.quiz-source').fill(`${applied.referenceSource}\n// ${marker}`);
  await page.locator('.quiz-run').click();
  await page.waitForFunction(()=>document.querySelector('#quiz-panel')?.dataset.quizStatus==='passed');
}

export async function verifyChallengeAccessUI(browser,url,errors){
  const seed=createState();seed.autoEnabled=false;seed.mode='study';seed.studyStyle='quiz';seed.typing.language='cpp';seed.onlineMaterials=SKILLS.map(skill=>skill.id);seed.cash=100000;
  const draft='// Saved before the textbook-tier update.\n'+applied.starterSource;
  seed.quiz.drafts[applied.id]=draft;
  const {context,page,workers}=await open(browser,url,errors,seed);
  let completed;
  try{
    assert.equal(await page.locator('#quiz-panel').getAttribute('data-challenge-access'),'available');
    assert.equal(await page.locator('.quiz-run').isEnabled(),true,'free material opens the basic Challenges without buying a book');
    assert.equal(await page.locator('.quiz-source').getAttribute('readonly'),null);
    const input=await page.locator('.quiz-source').elementHandle();
    const before=await saved(page);
    for(const difficulty of [3,4,5,6]){
      const subject=SKILLS.find(skill=>challengeTopics('cpp',skill.id).some(quiz=>quiz.difficulty===difficulty))?.id;
      assert.ok(subject,`C++ contains real difficulty ${difficulty} tasks`);
      const pool=challengeTopics('cpp',subject);
      await page.locator(`[data-subject=${subject}]`).click();
      await page.locator('.quiz-difficulty-select').selectOption(String(difficulty));
      const selected=Number(await page.locator('.quiz-topic-picker select').inputValue());
      assert.equal(pool[selected].difficulty,difficulty,'difficulty navigation reaches advanced tasks without advancing through the basic bank');
      assert.equal(await page.locator('#quiz-panel').getAttribute('data-challenge-access'),'locked');
      assert.match(await page.locator('.quiz-access-reason').innerText(),new RegExp(`Lv\\.${difficulty-2}.*現在 Lv\\.0`));
      assert.equal(await page.locator('.quiz-source').getAttribute('readonly'),'');
      assert.equal(await page.locator('.quiz-run').isDisabled(),true);
      assert.equal(await page.locator('.quiz-reference-toggle').isDisabled(),true);
      assert.equal(await page.locator('.quiz-reference pre').innerText(),'','preview never reveals the reference solution');
      assert.equal(await page.locator('#quiz-panel > .quiz-rewards').isVisible(),false,'locked tasks display no reward offer');
    }
    await page.locator('[data-subject=syntax]').click();
    await page.locator('.quiz-topic-picker select').selectOption(String(applied.index));
    assert.equal(await page.locator('.quiz-source').inputValue(),draft,'a pre-existing locked-task draft is preserved for preview');
    assert.match(await page.locator('.quiz-topic-picker option:checked').innerText(),/未解禁.*教本 Lv\.1/);
    await page.locator('.quiz-source').focus();await page.keyboard.type('injected edits');await page.keyboard.press('Tab');
    assert.equal(await page.locator('.quiz-source').inputValue(),draft,'typing and custom Tab completion cannot edit a locked preview');
    // Removing a disabled DOM flag must not launch a worker or award anything.
    await page.locator('.quiz-run').evaluate(button=>button.disabled=false);await page.locator('.quiz-run').click();
    await page.locator('.quiz-source').focus();await page.keyboard.press('Control+Enter');
    assert.equal(workers(),0,'the access guard runs before loading any compiler');
    const locked=await saved(page);
    assert.deepEqual(locked.skills,before.skills);assert.equal(locked.progress,before.progress);assert.deepEqual(locked.quiz.completed,before.quiz.completed);
    assert.equal(locked.quiz.drafts[applied.id],draft);
    for(const width of [360,390]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth<=1),`${width}px locked Challenge controls stay inside the viewport`);
    }
    await page.locator('.quiz-open-book').click();
    assert.equal(await page.locator('[data-shop=books]').getAttribute('aria-selected'),'true');
    assert.match(await page.evaluate(()=>document.activeElement.textContent),/プログラミング基礎教本/,'the unlock action focuses the required subject book');
    await page.locator('[data-buy=book-syntax]').click();
    assert.equal((await saved(page)).items['book-syntax'],1);
    assert.equal(await page.locator('#quiz-panel').getAttribute('data-challenge-access'),'available');
    assert.equal(await page.locator('.quiz-access').isVisible(),false);
    assert.equal(await page.locator('.quiz-source').inputValue(),draft,'buying the book unlocks the same saved editor');
    assert.equal(await input.evaluate(el=>el===document.querySelector('.quiz-source')),true,'unlocking never replaces the editor');
    assert.equal(await page.locator('.quiz-run').isEnabled(),true);
    assert.equal(await page.locator('.quiz-source').getAttribute('readonly'),null);
    await page.locator('.quiz-source').focus();await page.locator('.quiz-source').evaluate(el=>el.setSelectionRange(3,7));await page.clock.runFor(2200);
    assert.equal(await page.locator('.quiz-source').evaluate(el=>el===document.activeElement),true);
    assert.deepEqual(await page.locator('.quiz-source').evaluate(el=>[el.selectionStart,el.selectionEnd]),[3,7],'idle book checks preserve focus and selection');
    await run(page);completed=await saved(page);
    assert.ok(completed.quiz.completed.includes(applied.id));assert.ok(skillKnowledge(completed,'syntax')>skillKnowledge(before,'syntax'));
    assert.equal(workers(),1,'only an unlocked explicit submission loads the worker');
    await page.reload();await page.waitForSelector('.quiz-source');
    assert.equal(await page.locator('.quiz-topic-picker select').inputValue(),String(applied.index));
    assert.equal(await page.locator('#quiz-panel').getAttribute('data-challenge-access'),'review');
    assert.equal(await page.locator('.quiz-source').inputValue(),completed.quiz.drafts[applied.id]);
  }finally{await context.close();}

  // Prestige drops purchased books but preserves completed exercise knowledge.
  // This fixture isolates the persisted access rule from the release ceremony.
  delete completed.items['book-syntax'];completed.cash=100;completed.resets++;
  assert.equal(challengeAccess(completed,applied).review,true);assert.equal(challengeAccess(completed,applied).available,true);
  const review=await open(browser,url,errors,completed);
  try{
    assert.equal(await review.page.locator('#quiz-panel').getAttribute('data-challenge-access'),'review');
    assert.equal(await review.page.locator('.quiz-run').isEnabled(),true,'a completed task remains reviewable after its book is gone');
    assert.equal(await review.page.locator('.quiz-reference-toggle').isEnabled(),true);
    const before=await saved(review.page);await run(review.page);const after=await saved(review.page);
    assert.deepEqual(after.skills,before.skills,'review does not grant a second first-clear learning reward');
    assert.equal(after.quiz.completed.filter(id=>id===applied.id).length,1);
    await review.page.locator('.quiz-difficulty-select').selectOption('5');
    assert.equal(await review.page.locator('#quiz-panel').getAttribute('data-challenge-access'),'locked','an uncompleted harder task still needs its book tier');
  }finally{await review.context.close();}
  console.log('Challenge access UI checks passed: free basics, visible locked tiers, difficulty jump, book navigation and unlock, guarded worker/reward, saved draft/focus, and completed review without books.');
}
