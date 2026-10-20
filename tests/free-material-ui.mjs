import assert from 'node:assert/strict';
import { createState, input, projectAt, skillKnowledge, hasStudyMaterial, typingPower, developmentGain, defectLimit, readingLesson, studyMultiplier } from '../src/core.js';
import { TYPING_REWARD } from '../src/typing.js';

const SAVE='code-typer-idle:save:v1';
async function open(browser,url,errors,seed){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  if(seed)await context.addInitScript(data=>{
    if(sessionStorage.getItem('free-material-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
    sessionStorage.setItem('free-material-seeded','1');
  },seed);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date()});await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto(url);await page.waitForSelector('.buy-button');return{context,page};
}
async function snapshot(page){await page.locator('#save-button').click();return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);}
function assertNoPurchases(s){
  assert.equal(s.items.macro || 0,0,'OCR is optional throughout the free route');
  for(const id of ['syntax','design','graphics','systems'])assert.equal(s.items[`book-${id}`] || 0,0,'free materials must not silently buy a book');
  assert.equal(s.stats.jobs,0,'the free route must not depend on office work');
}
async function typeQuestion(page){
  await page.locator('#type-button').click();
  const text=await page.locator('#editor-content').getAttribute('data-prompt');
  const offset=Number((await page.locator('#typing-round').innerText()).match(/^\d+/)[0]);
  assert.ok(text && text.length>offset);
  await page.keyboard.type(text.slice(offset));
}

// Advance an actual UI save through ordinary study/development rules. This is
// a checkpoint, not a measurement of human typing speed or a direct K/cash grant.
export function freeMaterialCheckpoint(seed,index=1){
  const s=structuredClone(seed),project=projectAt(index);
  assert.equal(s.projectIndex,index);assertNoPurchases(s);
  for(const[id,required]of Object.entries(project.req)){
    assert.equal(hasStudyMaterial(s,id),true,'the UI must have opened each free subject before its checkpoint');
    for(let count=0;skillKnowledge(s,id)<required;count++){
      assert.ok(count<20000,'free study must converge without a purchase');
      input(s,{mode:'study',subject:id,chars:10});
    }
  }
  Object.assign(s,{mode:'dev',subject:'graphics',inputStyle:'typing'});
  s.typing.source='standard';s.typing.context='';
  for(let count=0;s.progress+developmentGain(s,typingPower(s,'dev')*TYPING_REWARD.character)<project.target;count++){
    assert.ok(count<20000,'free development must converge');
    input(s,{mode:'dev',chars:typingPower(s,'dev')*TYPING_REWARD.character});
  }
  if(s.defects>defectLimit(s)*.1){
    s.refactor=true;
    for(let count=0;s.defects>defectLimit(s)*.1;count++){
      assert.ok(count<10000);input(s,{mode:'dev',chars:10});
    }
    s.refactor=false;
  }
  assertNoPurchases(s);return s;
}

async function verifyNoOCRRoute(browser,url,errors,capture){
  const {context,page}=await open(browser,url,errors);
  let secondStart,firstPublished;
  try{
    assert.match(await page.locator('#goal-action').innerText(),/無料教材を開く/);
    assert.equal(await page.locator('#goal-action').isDisabled(),false);
    assert.equal(await page.locator('#study-style-description').isVisible(),false);
    await page.locator('#goal-action').click();
    assert.equal(await page.locator('[data-mode=study]').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#study-lock').isVisible(),false);
    assert.equal(await page.locator('#study-style-picker [data-study-style=practice]').innerText(),'短いコードを写す');
    assert.equal(await page.locator('#study-style-picker [data-study-style=course]').innerText(),'演習の実装を写す');
    assert.match(await page.locator('#study-style-description').innerText(),/短い処理例を順に写します.*結果と処理の流れ/);
    assert.match(await page.locator('#study-material-label').innerText(),/短い処理例/);
    assert.match(await page.locator('#study-material-label').innerText(),/無料/);
    assert.match(await page.locator('#study-material-label').innerText(),/×\s*1/);
    assert.equal(await page.locator('#study-material-upgrade').isDisabled(),true,'a book is an optional unaffordable upgrade, not a learning gate');
    assert.equal(await page.locator('#goal-alternative').isVisible(),false,'opening a material removes the initial OCR suggestion');
    await page.locator('[data-input-style=typing]').click();
    let s=await snapshot(page);assertNoPurchases(s);assert.equal(s.cash,100);assert.ok(s.onlineMaterials.includes('syntax'));
    assert.equal(skillKnowledge(s,'syntax'),0,'opening a material supplies a resource, not free understanding');
    if(capture){await page.locator('#study-material').scrollIntoViewIfNeeded();await capture(page,'free-material-first-lesson');}
    for(let round=0;skillKnowledge(s,'syntax')<12;round++){
      assert.ok(round<20,'a few ordinary code questions must reach the first knowledge requirement');
      await typeQuestion(page);s=await snapshot(page);
    }
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'),'dev');
    await page.locator('#goal-action').click();
    assert.equal(await page.locator('#study-style-description').isVisible(),false,'copying guidance stays in the study controls');
    for(let round=0;s.progress<projectAt(0).target;round++){
      assert.ok(round<20);await typeQuestion(page);s=await snapshot(page);
    }
    assert.equal(await page.locator('#release-button').isDisabled(),false);
    await page.locator('#release-button').click();
    assert.match(await page.locator('#modal-body').innerText(),/FREE TO PLAY/);
    await page.locator('[data-action=next-project]').click();
    s=await snapshot(page);assertNoPurchases(s);assert.equal(s.cash,100);assert.equal(s.projectIndex,1);
    firstPublished=structuredClone(s);
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'),'material');
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-item'),'design');
    await page.locator('#goal-action').click();
    assert.equal(await page.locator('#study-lock').isVisible(),false);
    const prompt=await page.locator('#editor-content').getAttribute('data-prompt');
    await page.locator('#type-button').click();await page.keyboard.type(prompt[0]);
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'),'study');
    assert.equal(await page.locator('#goal-action').getAttribute('data-goal-item'),'design','one free design character must keep the selected learning goal');

    await page.locator('[data-subject=graphics]').click();
    assert.equal(await page.locator('#study-lock').isVisible(),true,'a subject still requires an actual material choice');
    await page.locator('#study-lock [data-action=open-online-material]').click();
    assert.equal(await page.locator('#study-lock').isVisible(),false);
    await page.locator('[data-study-style=reading]').click();
    assert.equal(await page.locator('#study-style-description').isVisible(),false,'reading keeps its own contextual instructions');
    s=await snapshot(page);const lesson=readingLesson(s);
    await page.locator(`[data-read-answer="${lesson.answer}"]`).click();
    const answered=await snapshot(page);assert.ok(skillKnowledge(answered,'graphics')>skillKnowledge(s,'graphics'),'free materials also support finite comprehension lessons');
    assert.match(await page.locator('#study-material-label').innerText(),/参考コード読解/);
    await page.locator('[data-study-style=course]').click();
    await page.waitForSelector('#course-exercise');
    assert.match(await page.locator('#study-material-label').innerText(),/Exercism/);
    assert.match(await page.locator('#study-style-description').innerText(),/Exercismの演習と入力区間を選び、参考実装を写します/);
    assert.equal(await page.locator('#course-panel h3').innerText(),'Exercismの参考実装');
    assert.equal(await page.locator('#course-panel summary').first().innerText(),'元の課題と参考実装を見る');
    assert.equal(await page.locator('#course-panel .course-credit a').filter({hasText:/Exercism/}).count(),1,'external course authorship stays distinct from game tutorials');
    assert.equal(await page.locator('#study-lock').isVisible(),false);
    await page.locator('[data-study-style=practice]').click();
    assert.match(await page.locator('#study-material-label').innerText(),/短い処理例/);
    secondStart=await snapshot(page);assertNoPurchases(secondStart);assert.equal(secondStart.cash,100);
    for(const id of ['syntax','design','graphics'])assert.ok(secondStart.onlineMaterials.includes(id));
    await page.reload();await page.waitForSelector('.buy-button');
    const restored=await snapshot(page);assert.deepEqual(restored.onlineMaterials,secondStart.onlineMaterials);
    assert.equal(await page.locator('#study-lock').isVisible(),false);
  }finally{await context.close();}

  const checkpoint=freeMaterialCheckpoint(secondStart);
  const finish=await open(browser,url,errors,checkpoint);
  try{
    const p=finish.page;
    assert.equal(await p.locator('#goal-action').getAttribute('data-goal-kind'),'dev');
    await p.locator('#goal-action').click();
    const prompt=await p.locator('#editor-content').getAttribute('data-prompt');
    await p.locator('#type-button').click();await p.keyboard.type(prompt[0]);
    assert.equal(await p.locator('#release-button').isDisabled(),false);
    await p.locator('#release-button').click();
    assert.match(await p.locator('#modal-body').innerText(),/FREE TO PLAY/);
    if(capture)await capture(p,'free-material-second-free-release');
    const published=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);assertNoPurchases(published);
    assert.equal(published.cash,100,'a practice breakout has no guaranteed commercial income');
    assert.ok(published.catalog.every(title=>!title.royalty && !title.payout));
    await p.locator('#modal-body [data-action=prestige]').click();
    assert.match(await p.locator('#modal-body').innerText(),/制作経験/);
    await p.locator('[data-action=confirm-prestige]').click();
    const nextLife=await snapshot(p);assertNoPurchases(nextLife);
    assert.equal(nextLife.resets,1);
    assert.deepEqual(nextLife.onlineMaterials,published.onlineMaterials,'opened materials survive a new life');
    for(const id of ['syntax','design','graphics'])assert.ok(skillKnowledge(nextLife,id)>=skillKnowledge(published,id),'confirmed knowledge survives a new life');
    assert.equal(nextLife.catalog.length,0,'past sales and cash do not survive a new life');
    assert.equal(nextLife.projectIndex,2,'remembering both practice games opens the small commercial project directly');
    const commercial=freeMaterialCheckpoint(nextLife,2);
    return {commercial,firstPublished};
  }finally{await finish.context.close();}
}

async function verifyFirstCommercial(browser,url,errors,seed,capture){
  const {context,page}=await open(browser,url,errors,seed);
  try{
    await page.locator('#goal-action').click();
    const prompt=await page.locator('#editor-content').getAttribute('data-prompt');
    await page.locator('#type-button').click();await page.keyboard.type(prompt[0]);
    assert.equal(await page.locator('#release-button').isDisabled(),false);
    await page.locator('#release-button').click();
    assert.match(await page.locator('#modal-body').innerText(),/NOW ON SALE/);
    if(capture)await capture(page,'free-material-first-commercial');
    await page.locator('[data-action=next-project]').click();
    const published=await snapshot(page);assertNoPurchases(published);
    assert.ok(published.cash>100,'a paid game funds investment without OCR or office work');
    const title=published.catalog.find(title=>title.index===2);
    assert.ok(title && title.unitPrice>0 && title.totalCopies>0 && title.salesRemaining>0);
    assert.ok(title.payout>0 && title.payout<title.unitPrice*title.totalCopies,'launch receipts are part of a finite sales budget');
    return published;
  }finally{await context.close();}
}

async function verifySQLFallback(browser,url,errors,firstPublished){
  for(const entry of ['goal','lock']){
    const seed=structuredClone(firstPublished);
    Object.assign(seed,{mode:'study',subject:'design',studyStyle:'course',inputStyle:'typing'});
    Object.assign(seed.typing,{language:'sql',source:'course',courseUnit:'',context:''});
    const {context,page}=await open(browser,url,errors,seed);
    try{
      await page.waitForSelector('#course-exercise');
      assert.equal(await page.locator('#study-lock').isVisible(),true);
      if(entry==='goal'){
        assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'),'material');
        assert.equal(await page.locator('#goal-action').getAttribute('data-goal-item'),'design');
        await page.locator('#goal-action').click();
      }else await page.locator('#study-lock [data-action=open-online-material]').click();
      assert.equal(await page.locator('[data-study-style=practice]').getAttribute('aria-pressed'),'true','opening a subject absent from the SQL course selects actual available practice material');
      assert.equal(await page.locator('#study-lock').isVisible(),false);
      const prompt=await page.locator('#editor-content').getAttribute('data-prompt');
      assert.ok(prompt?.length);
      await page.locator('#type-button').click();await page.keyboard.type(prompt[0]);
      const typed=await snapshot(page);assert.ok(skillKnowledge(typed,'design')>0);assertNoPurchases(typed);
      await page.locator('[data-study-style=course]').click();
      await page.waitForSelector('#course-panel [data-action=study-practice]');
      assert.match(await page.locator('#course-panel').innerText(),/この分野.*ありません/);
      await page.locator('#course-panel [data-action=study-practice]').click();
      assert.equal(await page.locator('[data-study-style=practice]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#typing-input').isDisabled(),false);
      assert.ok((await page.locator('#editor-content').getAttribute('data-prompt'))?.length);
    }finally{await context.close();}
  }
}

async function verifyBookInvestment(browser,url,errors,published,capture){
  const seed=structuredClone(published);Object.assign(seed,{mode:'study',subject:'syntax'});
  const {context,page}=await open(browser,url,errors,seed);
  try{
    assert.equal(studyMultiplier(seed,'syntax'),1);
    assert.match(await page.locator('#study-material-label').innerText(),/×\s*1/);
    assert.equal(await page.locator('#study-material-upgrade').isDisabled(),false);
    await page.locator('#study-material-upgrade').click();
    const bought=await snapshot(page);assert.equal(bought.items['book-syntax'],1);assert.equal(bought.cash,seed.cash-1500);
    assert.equal(studyMultiplier(bought,'syntax'),2);assert.ok(bought.onlineMaterials.includes('syntax'));
    for(const style of ['reading','course','practice']){
      await page.locator(`[data-study-style=${style}]`).click();
      if(style==='course')await page.waitForSelector('#course-exercise');
      assert.match(await page.locator('#study-material-label').innerText(),/×\s*2/,'the book remains useful while using free online content');
      assert.equal(await page.locator('#study-lock').isVisible(),false);
    }
    if(capture){await page.locator('#study-material').scrollIntoViewIfNeeded();await capture(page,'free-material-book-investment');}
    await snapshot(page);await page.reload();await page.waitForSelector('.buy-button');
    const restored=await snapshot(page);assert.equal(restored.items['book-syntax'],1);assert.equal(studyMultiplier(restored,'syntax'),2);
    assert.ok(restored.onlineMaterials.includes('syntax'));
  }finally{await context.close();}
}

export async function verifyFreeMaterialUI(browser,url,errors,{capture}={}){
  const {commercial,firstPublished}=await verifyNoOCRRoute(browser,url,errors,capture);
  const published=await verifyFirstCommercial(browser,url,errors,commercial,capture);
  await verifySQLFallback(browser,url,errors,firstPublished);
  await verifyBookInvestment(browser,url,errors,published,capture);
  console.log('Free material checks passed: explicit material selection, actual sources, free practice/reading/course, saved subjects, OCR-free first two releases, and optional book efficiency across all learning styles.');
}
