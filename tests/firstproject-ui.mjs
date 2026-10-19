// First-game assembly and save/UI bookkeeping with a deterministic Worker
// protocol fixture. Real compilation of all 24 components is checked separately.
import assert from 'node:assert/strict';
import { createState, SKILLS, skillKnowledge, startCustomProject, defectLimit } from '../src/core.js';
import { quizAt } from '../src/quizcatalog.js';
import { FIRST_PROJECT_PARTS, FIRST_PROJECT_LANGUAGES, firstProjectQuizAt, firstProjectQuizCatalog } from '../src/firstproject.js';

const SAVE = 'code-typer-idle:save:v1';
const PLAN = { genreId:'number-puzzle',presentationId:'console',audioId:'silent',inputId:'keyboard-mouse',engineId:'toolkit',targets:['browser'],features:[] };
const marker = quiz => 'CTI_FIRST_UI_'+quiz.id.replace(/[^a-z0-9]/gi,'_');
const fixtures = [...firstProjectQuizCatalog(),quizAt('lua','syntax',0)].map(quiz=>({marker:marker(quiz),expected:quiz.cases.map(test=>test.expected)}));
const worker = String.raw`
// This is only a deterministic protocol fixture, not a compiler or evaluator.
const fixtures=${JSON.stringify(fixtures)};
self.onmessage=({data:m})=>{
 if(m.type==='initialize'){self.postMessage({id:m.id,type:'ready'});return;}
 if(m.type!=='execute')return;
 const fixture=fixtures.find(row=>m.source.includes(row.marker));
 const output=fixture?.expected || [];
 setTimeout(()=>self.postMessage({id:m.id,type:'result',result:{stdout:output.join('\n')+'\n'}}),m.source.includes('CTI_DELAY')?500:20);
};`;

function readySeed() {
  const seed=createState();
  seed.autoEnabled=false;seed.mode='dev';seed.devStyle='quiz';seed.studyStyle='quiz';
  seed.typing.language='lua';seed.subject='syntax';
  seed.onlineMaterials=SKILLS.map(row=>row.id);
  for(const {id} of SKILLS)seed.skills[id]=100;
  return seed;
}

async function open(browser,url,errors,seed) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route(/\/quizworker(?:\.[a-f0-9]+)?\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/javascript',body:worker}));
  if(seed)await context.addInitScript(data=>{
    if(sessionStorage.getItem('first-project-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
    sessionStorage.setItem('first-project-seeded','1');
  },seed);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date()});await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto(url);await page.waitForSelector('.buy-button');
  return {context,page};
}

async function saved(page) {
  await page.locator('#save-button').click();
  return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
}

async function answer(page,quiz,{delay=false,advanceTo=null}={}) {
  const comment=quiz.language==='python'?'#':['lua','sql'].includes(quiz.language)?'--':'//';
  await page.locator('.quiz-source').fill(`${quiz.referenceSource}\n${comment} ${marker(quiz)}${delay?'\n'+comment+' CTI_DELAY':''}`);
  await page.locator('.quiz-run').click();
  if(delay)return;
  if(advanceTo!==null) {
    // Assembling a component selects the next one and clears the old result.
    await page.waitForFunction(({key,target})=>JSON.parse(localStorage.getItem(key)||'null')?.progress>=target,{key:SAVE,target:advanceTo});
  } else await page.waitForFunction(()=>document.querySelector('#quiz-panel')?.dataset.quizStatus==='passed');
}

async function topic(page,index) {
  await page.locator('.quiz-topic-picker select').selectOption(String(index));
}

async function expectPart(page,index,completed) {
  assert.equal(await page.locator('.quiz-topic-picker option').count(),3);
  assert.equal(await page.locator('.quiz-topic-picker select').inputValue(),String(index));
  assert.equal(await page.locator('.quiz-title').innerText(),FIRST_PROJECT_PARTS[index].title);
  assert.match(await page.locator('.quiz-position').innerText(),new RegExp(`組込済み ${completed} / 3部品`));
  assert.equal(await page.locator('#subject-picker').isVisible(),false,'first-game parts use their required syntax subject');
}

async function expectLockedReference(page) {
  assert.equal(await page.locator('.quiz-reference-toggle').isDisabled(),true,'an unsolved part cannot open its implementation');
  assert.equal(await page.locator('.quiz-reference').isVisible(),false);
  assert.equal(await page.locator('.quiz-reference pre').innerText(),'','the locked answer is absent from the DOM text');
}

async function checkMobile(page) {
  for(const width of [360,390]) {
    await page.setViewportSize({width,height:844});
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
    assert.ok(overflow<=1,`${width}px viewport has ${overflow}px page overflow`);
    const bounds=await page.locator('.quiz-source').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'the implementation editor stays inside the viewport');
  }
}

async function verifyFreshAssembly(browser,url,errors,capture) {
  const {context,page}=await open(browser,url,errors);
  try {
    await page.locator('[data-mode=study]').click();
    await page.locator('[data-study-style=quiz]').click();
    await page.locator('#study-lock [data-action=open-online-material]').click();
    await page.locator('#language-select').selectOption('lua');
    await page.locator('.quiz-source').waitFor({state:'visible'});
    assert.equal(await page.locator('.quiz-topic-picker option').count(),16,'study keeps its general curriculum');
    const studyQuiz=quizAt('lua','syntax',0);
    await answer(page,studyQuiz);
    const learned=await saved(page);
    assert.ok(skillKnowledge(learned,'syntax')>=12,'one genuine study-Quiz reward unlocks the first game');
    assert.equal(learned.progress,0);
    assert.ok(learned.quiz.rewarded.includes(studyQuiz.id));

    await page.locator('[data-mode=dev]').click();
    await page.locator('[data-dev-style=quiz]').click();
    await expectPart(page,0,0);
    await expectLockedReference(page);
    assert.match(await page.locator('.quiz-description').innerText(),/low|範囲/);
    assert.equal(await page.locator('.quiz-case').count(),24,'boundary cases remain available in the folded list');
    await answer(page,firstProjectQuizAt('lua',0),{advanceTo:1000});
    const first=await saved(page);
    assert.equal(first.progress,1000,'a single component cannot finish the full game');
    assert.equal(await page.locator('#release-button').isDisabled(),true);
    await expectPart(page,1,1);
    assert.match(await page.locator('#toasts').innerText(),new RegExp(FIRST_PROJECT_PARTS[0].title));
    for(const language of FIRST_PROJECT_LANGUAGES)assert.equal(first.quiz.firstParts[language],1,'assembly advances every language to the same next part');

    // Another language may teach a new implementation, but cannot assemble
    // the already-present component twice.
    await page.locator('#language-select').selectOption('python');
    await expectPart(page,1,1);await topic(page,0);
    assert.match(await page.locator('.quiz-rewards-note').innerText(),/実装は完了/);
    const beforeReplay=await saved(page),pythonPart=firstProjectQuizAt('python',0);
    await answer(page,pythonPart);const replayed=await saved(page);
    assert.equal(replayed.progress,1000);
    assert.ok(replayed.quiz.rewarded.includes(pythonPart.id));
    assert.ok(!replayed.quizWork.includes(pythonPart.id));
    assert.ok(skillKnowledge(replayed,'syntax')>skillKnowledge(beforeReplay,'syntax'));
    await page.locator('#language-select').selectOption('lua');
    await page.reload();await page.locator('.quiz-source').waitFor({state:'visible'});
    await expectPart(page,1,1);
    assert.equal((await saved(page)).progress,1000,'reload retains the assembled component and next cursor');
    await expectLockedReference(page);
    await answer(page,firstProjectQuizAt('lua',1),{advanceTo:2000});
    assert.equal((await saved(page)).progress,2000);
    assert.equal(await page.locator('#release-button').isDisabled(),true);
    await expectPart(page,2,2);
    await answer(page,firstProjectQuizAt('lua',2),{advanceTo:3000});
    const complete=await saved(page);
    assert.equal(complete.progress,3000);await expectPart(page,2,3);
    assert.equal(complete.quizWork.filter(id=>id.startsWith('first-build/')).length,3);
    assert.ok(complete.defects<=defectLimit(complete)*.1,'normal three-part assembly remains publishable');
    assert.equal(await page.locator('#release-button').isDisabled(),false);
    assert.ok(Object.values(complete.items).every(count=>count===0),'the complete free route requires no OCR or purchase');
    assert.equal(complete.stats.jobs,0);
    await checkMobile(page);
    if(capture)await capture(page,'first-project-three-parts');
    await page.locator('#release-button').click();
    await page.locator('.release-title').waitFor({state:'visible'});
    // Publication saves before opening its modal; leave that confirmation open.
    const released=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
    assert.equal(released.stats.releases,1);
    assert.equal(released.catalog[0].index,0);
    assert.equal(released.catalog[0].unitPrice,0);
  } finally {await context.close();}
}

async function verifyFutureAndCancellation(browser,url,errors) {
  const future=await open(browser,url,errors,readySeed());
  try {
    await future.page.locator('.quiz-source').waitFor({state:'visible'});await topic(future.page,2);
    assert.match(await future.page.locator('.quiz-rewards-note').innerText(),/先に現在の部品/);
    const before=await saved(future.page),quiz=firstProjectQuizAt('lua',2);
    await answer(future.page,quiz);const after=await saved(future.page);
    assert.equal(after.progress,0,'solving a future component does not bypass the preceding work');
    assert.deepEqual(after.quizWork,[]);
    assert.ok(after.quiz.rewarded.includes(quiz.id),'future components can still award their one-time study reward');
    assert.ok(skillKnowledge(after,'syntax')>skillKnowledge(before,'syntax'));
    assert.match(await future.page.locator('.quiz-rewards-note').innerText(),/先に現在の部品/);
    await topic(future.page,0);await answer(future.page,firstProjectQuizAt('lua',0),{advanceTo:1000});
    assert.equal((await saved(future.page)).progress,1000);
  } finally {await future.context.close();}

  for(const change of ['language','cancelled-part']) {
    const {context,page}=await open(browser,url,errors,readySeed());
    try {
      await page.locator('.quiz-source').waitFor({state:'visible'});
      const before=await saved(page),quiz=firstProjectQuizAt('lua',0);
      await answer(page,quiz,{delay:true});
      assert.equal(await page.locator('#quiz-panel').getAttribute('data-quiz-status'),'running');
      if(change==='language')await page.locator('#language-select').selectOption('python');
      else {
        assert.equal(await page.locator('.quiz-topic-picker select').isDisabled(),true,'a running part cannot be changed without cancelling');
        await page.locator('.quiz-cancel').click();await topic(page,1);
      }
      await page.waitForTimeout(650);
      const after=await saved(page);
      assert.equal(after.progress,0,`${change} switch rejects delayed assembly`);
      assert.deepEqual(after.skills,before.skills,`${change} switch rejects delayed knowledge`);
      assert.deepEqual(after.quizWork,[]);
      assert.ok(!after.quiz.completed.includes(quiz.id));
      assert.ok(!after.quiz.rewarded.includes(quiz.id));
    } finally {await context.close();}
  }
}

async function verifyLegacyAndCustom(browser,url,errors) {
  const legacy=readySeed();legacy.progress=3000;delete legacy.quiz.firstParts;
  const restored=await open(browser,url,errors,legacy);
  try {
    await restored.page.locator('.quiz-source').waitFor({state:'visible'});
    await expectPart(restored.page,2,3);
    assert.equal((await saved(restored.page)).progress,3000,'an existing finished game is never rolled back to fit the new parts');
    assert.equal(await restored.page.locator('#release-button').isDisabled(),false);
    await restored.page.reload();await restored.page.locator('.quiz-source').waitFor({state:'visible'});
    assert.equal((await saved(restored.page)).progress,3000);
  } finally {await restored.context.close();}

  const custom=readySeed();assert.ok(startCustomProject(custom,PLAN,{name:'自由企画の最初の作品'}).ok);
  assert.equal(custom.projectIndex,0,'fixture intentionally uses the legacy first-project index');
  custom.mode='dev';custom.devStyle='quiz';
  const planned=await open(browser,url,errors,custom);
  try {
    await planned.page.locator('.quiz-source').waitFor({state:'visible'});
    assert.equal(await planned.page.locator('.quiz-topic-picker option').count(),16,'a custom first project keeps its general implementation topics');
    assert.equal(await planned.page.locator('.quiz-title').innerText(),quizAt('lua','syntax',0).title);
    assert.doesNotMatch(await planned.page.locator('.quiz-position').innerText(),/3部品/);
    assert.equal(await planned.page.locator('#subject-picker').isVisible(),true);
    const state=await saved(planned.page);
    assert.equal(state.progress,0);assert.ok(state.planner.active);
  } finally {await planned.context.close();}
}

async function verifyDirectDevelopment(browser,url,errors) {
  for(const language of ['python','sql']) {
    const seed=createState();
    seed.autoEnabled=false;seed.mode='dev';seed.devStyle='quiz';
    seed.typing.language=language;seed.onlineMaterials=['syntax'];
    const {context,page}=await open(browser,url,errors,seed);
    try {
      await page.locator('.quiz-source').waitFor({state:'visible'});
      assert.equal(skillKnowledge(await saved(page),'syntax'),0,'direct development starts with no pre-awarded knowledge');
      for(let index=0;index<3;index++) {
        await expectPart(page,index,index);
        assert.match(await page.locator('.readiness-skills > span b').first().innerText(),new RegExp(`/ ${(index+1)*4}$`),`${language} exposes this component's staged knowledge requirement`);
        await expectLockedReference(page);
        await answer(page,firstProjectQuizAt(language,index),{advanceTo:(index+1)*1000});
        const state=await saved(page);
        assert.equal(state.progress,(index+1)*1000,`${language} component ${index+1} is applicable without a study detour`);
        assert.equal(state.mode,'dev');
        assert.equal(state.quiz.rewarded.length,index+1);
        assert.ok(state.quiz.rewarded.every(id=>id.startsWith(`first-build/v1/${language}/`)),'all learning comes from the dedicated components, not a general study Quiz');
        assert.ok(Object.values(state.items).every(count=>count===0));
        assert.equal(state.stats.jobs,0);
        assert.equal(await page.locator('#release-button').isDisabled(),index<2);
      }
      await expectPart(page,2,3);
      assert.match(await page.locator('.readiness-skills > span b').first().innerText(),/\/ 12$/);
    } finally {await context.close();}
  }
}

async function verifySQLInputs(browser,url,errors,capture) {
  const seed=readySeed();seed.typing.language='sql';
  const {context,page}=await open(browser,url,errors,seed);
  try {
    await page.locator('.quiz-source').waitFor({state:'visible'});
    for(let index=0;index<3;index++) {
      await topic(page,index);
      const quiz=firstProjectQuizAt('sql',index),table=page.locator('.quiz-fixture-table').first();
      assert.equal(await table.locator('caption').innerText(),`input(${quiz.fixtureColumns.join(', ')})`);
      assert.deepEqual(await table.locator('th').allTextContents(),quiz.fixtureColumns);
      assert.deepEqual(await table.locator('tbody tr').first().locator('td').allTextContents(),quiz.cases[0].fixtureRows[0].map(String));
      assert.match(await page.locator('.quiz-source').inputValue(),/SELECT 0 FROM input;/);
      await expectLockedReference(page);
    }
    await checkMobile(page);
    if(capture)await capture(page,'first-project-sql-inputs');
    await page.locator('[data-mode=study]').click();
    assert.equal(await page.locator('.quiz-topic-picker option').count(),16);
    assert.equal(await page.locator('.quiz-title').innerText(),quizAt('sql','syntax',0).title);
    assert.equal(await page.locator('.quiz-fixture-table caption').first().innerText(),'sample(id, amount, group_id, enabled)');
    assert.doesNotMatch(await page.locator('.quiz-source').inputValue(),/FROM input;/);
    await page.locator('[data-mode=dev]').click();
    await expectPart(page,2,0);
    assert.equal(await page.locator('.quiz-fixture-table caption').first().innerText(),'input(guess, secret, remaining)');
    assert.match(await page.locator('.quiz-source').inputValue(),/SELECT 0 FROM input;/);
  } finally {await context.close();}
}

export async function verifyFirstProjectUI(browser,url,errors,capture) {
  await verifyFreshAssembly(browser,url,errors,capture);
  await verifyFutureAndCancellation(browser,url,errors);
  await verifyLegacyAndCustom(browser,url,errors);
  await verifyDirectDevelopment(browser,url,errors);
  await verifySQLInputs(browser,url,errors,capture);
}
