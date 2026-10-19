// Practice UX and reward bookkeeping, using a deterministic Worker protocol
// fixture. These tests do not claim to validate any language runtime.
import assert from 'node:assert/strict';
import { createState, SKILLS, currentProject, skillKnowledge, quizRewardPreview, startCustomProject, resumeCustomProject, setCustomAllocation } from '../src/core.js';
import { quizAt } from '../src/quizcatalog.js';

const SAVE = 'code-typer-idle:save:v1';
const QUIZ_BUTTON = '[data-dev-style=quiz]';
const PLAN = { genreId:'number-puzzle', presentationId:'console', audioId:'silent', inputId:'keyboard-mouse', engineId:'toolkit', targets:['browser'], features:[] };
const fixtures = SKILLS.flatMap(({id:subject}) => Array.from({length:16}, (_,index) => {
  const quiz=quizAt('lua',subject,index);
  return {name:quiz.functionName,expected:quiz.cases.map(row=>row.expected)};
}));
const worker = `
// A protocol fixture: no source parsing, compilation or execution takes place.
const fixtures=${JSON.stringify(fixtures)};
self.onmessage=({data:m})=>{
 if(m.type==='initialize'){self.postMessage({id:m.id,type:'ready'});return;}
 if(m.type!=='execute')return;
 const fixture=fixtures.find(row=>new RegExp('\\\\b'+row.name+'\\\\s*\\\\(').test(m.source));
 const output=fixture?.expected.map(value=>m.source.includes('CTI_TEST_CORRECT')?value:123456789)||[];
 setTimeout(()=>self.postMessage({id:m.id,type:'result',result:{stdout:output.join('\\n')+'\\n'}}),m.source.includes('CTI_DELAY')?500:20);
};`;

function baseSeed({expert=true,materials=true}={}) {
  const seed=createState();
  seed.autoEnabled=false;seed.typing.language='lua';seed.subject='syntax';
  seed.studyStyle='quiz';seed.devStyle='quiz';seed.mode='dev';
  if(expert)for(const {id}of SKILLS)seed.skills[id]=100;
  if(materials)seed.onlineMaterials=SKILLS.map(row=>row.id);
  return seed;
}

function projectsSeed(options={}) {
  const seed=baseSeed(options);
  const first=startCustomProject(seed,PLAN,{name:'実践テスト・一作目'});
  const second=startCustomProject(seed,{...PLAN,presentationId:'pixel-2d'},{name:'実践テスト・二作目'});
  assert.ok(first.ok&&second.ok,'the two explicit project fixtures are valid');
  resumeCustomProject(seed,first.id);
  seed.mode='dev';seed.autoEnabled=false;
  return {seed,first:first.id,second:second.id};
}

async function open(browser,url,errors,seed) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route(/\/quizworker(?:\.[a-f0-9]+)?\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/javascript',body:worker}));
  await context.addInitScript(data=>{
    if(sessionStorage.getItem('quiz-practice-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
    sessionStorage.setItem('quiz-practice-seeded','1');
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

function close(actual,expected,message) {
  assert.ok(Math.abs(actual-expected)<=1e-7*Math.max(1,Math.abs(expected)),`${message}: ${actual} vs ${expected}`);
}

async function selectTopic(page,subject='syntax',index=0) {
  await page.locator(`[data-subject=${subject}]`).click();
  await page.locator('.quiz-topic-picker select').selectOption(String(index));
}

async function answer(page,subject='syntax',index=0,{delay=false,wait=true}={}) {
  const quiz=quizAt('lua',subject,index);
  await page.locator('.quiz-source').fill(`${quiz.referenceSource}\n-- CTI_TEST_CORRECT${delay?'\n-- CTI_DELAY':''}`);
  await page.locator('.quiz-run').click();
  if(wait)await page.waitForFunction(()=>document.querySelector('#quiz-panel')?.dataset.quizStatus==='passed');
  return quiz;
}

async function enterQuiz(page) {
  await page.locator('[data-mode=dev]').click();
  await page.locator(QUIZ_BUTTON).click();
  await page.locator('.quiz-source').waitFor({state:'visible'});
}

async function resumeProject(page,id) {
  await page.locator('.nav-button[data-view=planner]').click();
  await page.locator(`[data-plan-resume="${id}"]`).click();
  await page.locator('[data-mode=dev]').click();
  await page.locator(QUIZ_BUTTON).click();
  await page.locator('.quiz-source').waitFor({state:'visible'});
}

async function verifyStudyAndImplementation(browser,url,errors,capture) {
  const {seed,first,second}=projectsSeed();seed.mode='study';
  const {context,page}=await open(browser,url,errors,seed);
  try {
    await page.locator('.quiz-source').waitFor({state:'visible'});
    const beforeStudy=await saved(page),studyPreview=quizRewardPreview(beforeStudy);
    const quiz=await answer(page),afterStudy=await saved(page);
    close(skillKnowledge(afterStudy,'syntax')-skillKnowledge(beforeStudy,'syntax'),studyPreview.amount,'study uses its advertised reward');
    assert.ok(afterStudy.quiz.rewarded.includes(quiz.id));
    assert.deepEqual(afterStudy.quizWork,[],'studying leaves this project implementation available');
    await enterQuiz(page);await selectTopic(page);
    assert.ok(!(await page.locator('.quiz-topic-picker option:checked').innerText()).startsWith('✓'),'the development checkmark tracks this project, not an earlier study pass');
    assert.match(await page.locator('.quiz-position').innerText(),/この作品へ適用済み\s+0\s*\/\s*16/);
    const beforeWork=await saved(page),preview=quizRewardPreview(beforeWork);
    assert.equal(preview.amount,0,'the same topic does not award understanding twice');
    assert.equal(preview.progress,currentProject(beforeWork).target-beforeWork.progress,'the preview caps work at the project target');
    assert.match(await page.locator('.quiz-rewards').innerText(),/制作/);
    await answer(page);
    const applied=await saved(page);
    close(applied.progress-beforeWork.progress,preview.progress,'the actual implementation matches its capped preview');
    assert.deepEqual(applied.skills,afterStudy.skills,'study then implementation shares the lifelong knowledge claim');
    assert.ok(applied.quizWork.includes(quiz.id));
    assert.match(await page.locator('.quiz-topic-picker option:checked').innerText(),/^✓/);
    assert.match(await page.locator('.quiz-position').innerText(),/この作品へ適用済み\s+1\s*\/\s*16/);
    assert.equal(await page.locator('.quiz-rewards').getAttribute('data-kind'),'awarded');
    await answer(page);
    const repeated=await saved(page);
    assert.equal(repeated.progress,applied.progress);
    assert.deepEqual(repeated.skills,applied.skills);
    assert.deepEqual(repeated.stats,applied.stats,'repeat success adds no hidden work or manual input');
    await page.locator('[data-input-style=click]').click();
    assert.equal(await page.locator('#quiz-panel').isVisible(),false);
    assert.equal(await page.locator('#code-editor').isVisible(),true);
    await page.locator('[data-input-style=typing]').click();
    assert.equal(await page.locator('#quiz-panel').isVisible(),false);
    assert.equal((await saved(page)).inputStyle,'typing');
    await page.locator(QUIZ_BUTTON).click();
    assert.equal(await page.locator('.quiz-source').isVisible(),true);
    await resumeProject(page,second);await selectTopic(page);
    const secondBefore=await saved(page),secondPreview=quizRewardPreview(secondBefore);
    assert.equal(secondBefore.planner.active,second);
    assert.ok(!(await page.locator('.quiz-topic-picker option:checked').innerText()).startsWith('✓'),'a new project starts with the topic application available');
    assert.match(await page.locator('.quiz-position').innerText(),/この作品へ適用済み\s+0\s*\/\s*16/);
    assert.equal(secondPreview.amount,0);
    assert.ok(secondPreview.progress>0,'a different project has its own implementation claim');
    await answer(page);const secondAfter=await saved(page);
    close(secondAfter.progress-secondBefore.progress,secondPreview.progress,'the new project receives the same topic work once');
    assert.deepEqual(secondAfter.skills,applied.skills);
    assert.ok(secondAfter.planner.projects.find(row=>row.id===first).work.quizWork.includes(quiz.id),'shelved work retains its own claim');
    await page.reload();await page.locator('.quiz-source').waitFor({state:'visible'});
    const restored=await saved(page);
    assert.equal(restored.devStyle,'quiz');
    assert.ok(restored.quizWork.includes(quiz.id));
    assert.deepEqual(restored.quiz.rewarded,secondAfter.quiz.rewarded);
    if(capture)await capture(page,'quiz-practice-applied');
  } finally {await context.close();}
}

async function verifyGatesAndDeferredApplication(browser,url,errors) {
  const noMaterial=baseSeed({materials:false});
  const gated=await open(browser,url,errors,noMaterial);
  try {
    assert.equal(await gated.page.locator('#study-lock').isVisible(),true,'practice still requires its free material');
    assert.equal(await gated.page.locator('#quiz-panel').isVisible(),false);
    await gated.page.locator('#study-lock [data-action=open-online-material]').click();
    await gated.page.locator('.quiz-source').waitFor({state:'visible'});
    assert.equal((await saved(gated.page)).mode,'dev','opening material does not move the player to another mode');
  } finally {await gated.context.close();}
  const novice=baseSeed({expert:false});
  assert.ok(startCustomProject(novice,{...PLAN,presentationId:'pixel-2d'},{name:'理解度を揃えて実装'}).ok);
  const run=await open(browser,url,errors,novice);
  try {
    await run.page.locator('.quiz-source').waitFor({state:'visible'});
    const quiz=await answer(run.page),first=await saved(run.page);
    assert.equal(first.progress,0);
    assert.ok(first.quiz.rewarded.includes(quiz.id));
    assert.ok(!first.quizWork.includes(quiz.id),'insufficient knowledge does not consume implementation');
    assert.match(await run.page.locator('.quiz-rewards').innerText(),/理解度/);
    for(const subject of ['design','graphics','systems']) {
      for(let index=0;index<4;index++) {
        const checkpoint=await saved(run.page),required=currentProject(checkpoint).req[subject] || 0;
        if(skillKnowledge(checkpoint,subject)>=required)break;
        await selectTopic(run.page,subject,index);await answer(run.page,subject,index);
      }
    }
    await selectTopic(run.page);
    const before=await saved(run.page),preview=quizRewardPreview(before);
    assert.equal(preview.amount,0);
    assert.ok(preview.progress>0,'the earlier topic becomes applicable once all project knowledge is ready');
    await answer(run.page);const after=await saved(run.page);
    close(after.progress-before.progress,preview.progress,'deferred implementation uses its still-available claim');
    assert.deepEqual(after.skills,before.skills);
    assert.ok(after.quizWork.includes(quiz.id));
  } finally {await run.context.close();}
  const {seed,second}=projectsSeed();resumeCustomProject(seed,second);setCustomAllocation(seed,'assets');
  const assets=await open(browser,url,errors,seed);
  try {
    assert.equal(await assets.page.locator('#asset-work-button').isVisible(),true);
    assert.equal(await assets.page.locator('#quiz-panel').isVisible(),false,'code Quiz cannot manufacture art');
    const before=await saved(assets.page);
    await assets.page.locator('[data-plan-allocation=code]').click();
    await assets.page.locator(QUIZ_BUTTON).click();
    await assets.page.locator('.quiz-source').waitFor({state:'visible'});
    const after=await saved(assets.page);
    assert.equal(after.planner.projects.find(row=>row.id===second).assetProgress,before.planner.projects.find(row=>row.id===second).assetProgress);
  } finally {await assets.context.close();}
}

async function verifyCappedRepair(browser,url,errors) {
  const seed=baseSeed();seed.refactor=true;seed.progress=100;seed.debt=2;seed.debtSources.coupling=2;seed.defects=1;seed.build.knownDefects=1;
  const {context,page}=await open(browser,url,errors,seed);
  try {
    await page.locator('.quiz-source').waitFor({state:'visible'});
    const before=await saved(page),preview=quizRewardPreview(before);
    assert.ok(preview.fixed>0&&preview.debtRemoved>0);
    assert.ok(preview.fixed<=before.defects&&preview.debtRemoved<=before.debt);
    assert.match(await page.locator('.quiz-rewards').innerText(),/修正|整理/);
    await answer(page);const after=await saved(page);
    close(before.defects-after.defects,preview.fixed,'repair cannot exceed real defects');
    close(before.debt-after.debt,preview.debtRemoved,'debt reduction cannot exceed real debt');
    assert.equal(after.progress,before.progress,'repair does not quietly add code');
  } finally {await context.close();}
}

async function verifyLiveDeferredPreview(browser,url,errors) {
  const {seed}=projectsSeed();seed.skills.design=7.999;seed.items.lab=1;
  const {context,page}=await open(browser,url,errors,seed);
  try {
    await page.locator('.quiz-source').waitFor({state:'visible'});
    const quiz=await answer(page),waiting=await saved(page);
    assert.equal(waiting.progress,0);
    assert.ok(!waiting.quizWork.includes(quiz.id));
    assert.match(await page.locator('.quiz-rewards-note').innerText(),/理解度を揃える/);
    // Advance the real game loop, not the saved skills or the compiler output.
    // The equipped lab closes this tiny design gap while the same result stays.
    await page.clock.runFor(2200);
    const ready=await saved(page),preview=quizRewardPreview(ready);
    assert.ok(skillKnowledge(ready,'design')>=currentProject(ready).req.design);
    assert.equal(preview.amount,0);assert.ok(preview.progress>0);
    assert.equal(await page.locator('.quiz-rewards').getAttribute('data-kind'),'preview','a newly applicable implementation replaces the old blocked reward summary');
    assert.match(await page.locator('.quiz-rewards-items').innerText(),/制作/);
    assert.doesNotMatch(await page.locator('.quiz-rewards-note').innerText(),/理解度を揃える/);
    assert.ok(!ready.quizWork.includes(quiz.id),'the preview itself never claims work');
    await answer(page);const after=await saved(page);
    close(after.progress-ready.progress,preview.progress,'the deferred reward can be explicitly applied');
    assert.ok(after.quizWork.includes(quiz.id));
  } finally {await context.close();}
}

async function verifyContextCancellation(browser,url,errors) {
  for(const change of ['mode','policy','refactor','project']) {
    const {seed,second}=projectsSeed();
    const {context,page}=await open(browser,url,errors,seed);
    try {
      await page.locator('.quiz-source').waitFor({state:'visible'});
      const before=await saved(page),quiz=await answer(page,'syntax',0,{delay:true,wait:false});
      assert.equal(await page.locator('#quiz-panel').getAttribute('data-quiz-status'),'running');
      if(change==='mode')await page.locator('[data-mode=study]').click();
      if(change==='policy'){
        await page.locator('#development-policy > summary').click();
        await page.locator('[data-development-policy=prototype]').click();
      }
      if(change==='refactor')await page.locator('#refactor-button').click();
      if(change==='project')await resumeProject(page,second);
      await page.waitForTimeout(650);
      const after=await saved(page);
      assert.deepEqual(after.skills,before.skills,`${change} change rejects a pending knowledge reward`);
      assert.ok(!after.quiz.rewarded.includes(quiz.id),`${change} change does not claim the topic`);
      assert.ok(!after.quizWork.includes(quiz.id),`${change} change rejects the implementation reward`);
      assert.equal(after.progress,0,`${change} change receives no delayed code`);
      for(const project of after.planner.projects)assert.ok(!project.work?.quizWork?.includes(quiz.id));
    } finally {await context.close();}
  }
}

export async function verifyQuizPracticeUI(browser,url,errors,capture) {
  await verifyStudyAndImplementation(browser,url,errors,capture);
  await verifyGatesAndDeferredApplication(browser,url,errors);
  await verifyCappedRepair(browser,url,errors);
  await verifyLiveDeferredPreview(browser,url,errors);
  await verifyContextCancellation(browser,url,errors);
}
