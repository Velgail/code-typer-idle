// Syntax Quiz uses the real in-page token grader. The final two Challenge
// submissions use the actual local Pyodide Worker, not a protocol fixture.
import assert from 'node:assert/strict';
import { createState, SKILLS, skillKnowledge, skillQuizRewardPreview } from '../src/core.js';
import { SKILL_QUIZ_LANGUAGES, skillQuizAt } from '../src/skillquiz.js';
import { quizAt } from '../src/quizcatalog.js';
import { challengeTopics } from '../src/challengecatalog.js';

const SAVE='code-typer-idle:save:v1';
const PANEL='#skill-quiz-panel';
const ANSWER=`${PANEL} .skill-quiz-answer`;
const SUBMIT=`${PANEL} .skill-quiz-submit`;
const TOPIC=`${PANEL} .skill-quiz-topic`;

function baseSeed() {
  const seed=createState();seed.autoEnabled=false;
  seed.mode='study';seed.studyStyle='skill-quiz';seed.typing.language='cpp';
  seed.onlineMaterials=SKILLS.map(skill=>skill.id);
  return seed;
}

async function open(browser,url,errors,seed=baseSeed()) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(data=>{
    if(sessionStorage.getItem('skill-quiz-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
    sessionStorage.setItem('skill-quiz-seeded','1');
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

function sameLearning(actual,expected,message) {
  assert.deepEqual(actual.skills,expected.skills,message);
  assert.deepEqual(actual.studyGaps,expected.studyGaps,message);
  assert.equal(actual.stats.study,expected.stats.study,message);
  assert.equal(actual.stats.chars,expected.stats.chars,message);
  assert.equal(actual.progress,expected.progress,message);
}

function close(actual,expected,message) {
  assert.ok(Math.abs(actual-expected)<1e-7*Math.max(1,Math.abs(expected)),`${message}: ${actual} vs ${expected}`);
}

async function select(page,language,subject='syntax',index=0) {
  await page.locator('#language-select').selectOption(language);
  await page.locator(`[data-subject=${subject}]`).click();
  await page.locator(TOPIC).selectOption(String(index));
  assert.equal(await page.locator(`${PANEL} .skill-quiz-title`).innerText(),skillQuizAt(language,subject,index).title);
}

async function answer(page,text,{keyboard=false}={}) {
  await page.locator(ANSWER).fill(text);
  if(keyboard)await page.locator(ANSWER).press('Control+Enter');
  else await page.locator(SUBMIT).click();
}

async function mobile(page) {
  for(const width of [360,390]) {
    await page.setViewportSize({width,height:844});
    const excess=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
    assert.ok(excess<=1,`${width}px skill Quiz has ${excess}px horizontal page overflow`);
    const box=await page.locator(ANSWER).boundingBox();
    assert.ok(box.x>=0&&box.x+box.width<=width+1,'the blank answer control remains in the viewport');
  }
}

async function verifyGradingAndControls(browser,url,errors,capture) {
  const {context,page}=await open(browser,url,errors);
  const workers=[];page.on('request',request=>{if(/quizworker|runtime-assets/.test(request.url()))workers.push(request.url());});
  try {
    await page.locator(ANSWER).waitFor({state:'visible'});
    assert.equal(await page.locator('#quiz-panel').isVisible(),false);
    assert.equal(await page.locator('[data-study-style=skill-quiz]').innerText(),'Quiz');
    assert.equal(await page.locator('[data-study-style=quiz]').innerText(),'Challenge');
    for(const language of SKILL_QUIZ_LANGUAGES) {
      await select(page,language);
      const quiz=skillQuizAt(language,'syntax',0);
      assert.equal(await page.locator(`${TOPIC} option`).count(),32);
      assert.match(await page.locator(`${PANEL} .skill-quiz-meta`).innerText(),/入門.*目安/);
      assert.match(await page.locator(`${PANEL} .skill-quiz-code`).innerText(),/⟦ 空欄 ⟧/);
      assert.equal(await page.locator('#code-editor').isVisible(),false);
      const before=await saved(page);
      // Clicking the displayed snippet and ordinary Enter cannot claim a Quiz.
      await page.locator(`${PANEL} .skill-quiz-code`).click();
      await page.keyboard.press('Enter');
      await page.locator(ANSWER).fill(quiz.answer);
      await page.locator(ANSWER).press('End');await page.locator(ANSWER).press('Enter');
      sameLearning(await saved(page),before,`${language}: Enter/click does not grade or reward`);
      assert.equal(await page.locator(PANEL).getAttribute('data-quiz-status'),'idle');
      assert.equal((await saved(page)).skillQuiz.completed.includes(quiz.id),false);

      await answer(page,quiz.incorrect[0]);
      assert.equal(await page.locator(PANEL).getAttribute('data-quiz-status'),'failed');
      assert.equal(await page.locator(`${PANEL} .skill-quiz-explanation`).innerText(),quiz.explanation);
      assert.match(await page.locator(`${PANEL} .skill-quiz-code`).innerText(),/⟦ 空欄 ⟧/);
      sameLearning(await saved(page),before,`${language}: an incorrect answer has no reward`);

      const preview=skillQuizRewardPreview(await saved(page));
      await answer(page,`  ${quiz.answer}  `,{keyboard:true});
      assert.equal(await page.locator(PANEL).getAttribute('data-quiz-status'),'passed');
      const after=await saved(page);
      close(skillKnowledge(after,'syntax')-skillKnowledge(before,'syntax'),preview.amount,`${language}: first success matches the learning preview`);
      assert.ok(after.skillQuiz.completed.includes(quiz.id));
      assert.equal(after.progress,0,'syntax Quiz never quietly writes game code');
      assert.ok(!(await page.locator(`${PANEL} .skill-quiz-code`).innerText()).includes('⟦ 空欄 ⟧'));
      assert.equal(await page.locator(`${PANEL} .skill-quiz-explanation`).innerText(),quiz.explanation);
      for(let repeat=0;repeat<3;repeat++)await page.locator(SUBMIT).click();
      sameLearning(await saved(page),after,`${language}: repeated submissions do not farm learning`);
      assert.equal((await saved(page)).skillQuiz.completed.filter(id=>id===quiz.id).length,1);
    }
    assert.deepEqual(workers,[],'syntax Quiz does not initialize a compiler or download a runtime');
    await mobile(page);
    if(capture)await capture(page,'skill-quiz-all-languages');
  } finally {await context.close();}
}

async function verifyPersistenceAndFocus(browser,url,errors) {
  const legacy=quizAt('lua','syntax',0),seed=baseSeed();
  seed.quiz.completed=[legacy.id];seed.quiz.rewarded=[legacy.id];seed.quizWork=[legacy.id];
  const {context,page}=await open(browser,url,errors,seed);
  try {
    await page.locator(ANSWER).waitFor({state:'visible'});
    await select(page,'python','systems',11);
    const quiz=skillQuizAt('python','systems',11),draft='partial_draft';
    await page.locator(ANSWER).fill(draft);await page.locator(ANSWER).focus();
    const editor=await page.locator(ANSWER).elementHandle();
    await page.locator(ANSWER).evaluate(el=>el.setSelectionRange(3,7));
    await page.clock.runFor(2200);
    assert.equal(await editor.evaluate(el=>el===document.querySelector('.skill-quiz-answer')),true,'idle rendering retains the native answer element');
    assert.equal(await page.locator(ANSWER).evaluate(el=>el===document.activeElement),true,'idle ticks keep typing focus');
    assert.deepEqual(await page.locator(ANSWER).evaluate(el=>[el.selectionStart,el.selectionEnd]),[3,7]);
    await saved(page);
    await select(page,'lua','design',5);await page.locator(ANSWER).fill('other_draft');await saved(page);
    await select(page,'python','systems',11);
    assert.equal(await page.locator(ANSWER).inputValue(),draft,'language and subject switching restores the corresponding draft');
    await page.reload();await page.locator(ANSWER).waitFor({state:'visible'});
    assert.equal(await page.locator('#language-select').inputValue(),'python');
    assert.equal(await page.locator(TOPIC).inputValue(),'11');
    assert.equal(await page.locator(ANSWER).inputValue(),draft);
    const restored=await saved(page);
    assert.equal(restored.subject,'systems');
    assert.equal(restored.skillQuiz.drafts[quiz.id],draft);
    assert.ok(restored.quiz.completed.includes(legacy.id),'old Challenge completion survives the new Quiz ledger');
    assert.ok(restored.quiz.rewarded.includes(legacy.id));assert.ok(restored.quizWork.includes(legacy.id));

    // Studying through Quiz during development changes only understanding.
    await page.locator('[data-mode=dev]').click();await page.locator('[data-dev-style=skill-quiz]').click();
    await select(page,'python','syntax',2);
    const developmentQuiz=skillQuizAt('python','syntax',2),before=await saved(page);
    await answer(page,developmentQuiz.answer);
    const after=await saved(page);
    assert.ok(skillKnowledge(after,'syntax')>skillKnowledge(before,'syntax'));
    assert.equal(after.progress,before.progress);assert.equal(after.debt,before.debt);assert.equal(after.defects,before.defects);
    assert.deepEqual(after.quizWork,before.quizWork);
    assert.doesNotMatch(await page.locator(`${PANEL} .quiz-rewards-items`).innerText(),/制作|不具合|負債/);
    assert.match(await page.locator(`${PANEL} .quiz-rewards-note`).innerText(),/Challenge|コードタイピング/);
    await page.locator('[data-dev-style=quiz]').click();
    assert.equal(await page.locator('#quiz-panel').isVisible(),true,'Challenge has its own implementation panel');
    assert.equal(await page.locator(PANEL).isVisible(),false);
    assert.match(await page.locator('#quiz-panel .quiz-position').innerText(),/Challenge/);
    await page.locator('[data-dev-style=skill-quiz]').click();
    assert.equal(await page.locator(PANEL).isVisible(),true);
    assert.equal(await page.locator('#quiz-panel').isVisible(),false);
    assert.ok((await saved(page)).quiz.completed.includes(legacy.id));
  } finally {await context.close();}
}

async function verifyMaterialGate(browser,url,errors) {
  const seed=baseSeed();seed.onlineMaterials=[];
  const {context,page}=await open(browser,url,errors,seed);
  try {
    assert.equal(await page.locator('#study-lock').isVisible(),true);
    assert.equal(await page.locator(PANEL).isVisible(),false);
    await page.locator('#study-lock [data-action=open-online-material]').click();
    await page.locator(ANSWER).waitFor({state:'visible'});
    const after=await saved(page);assert.deepEqual(after.onlineMaterials,['syntax']);
    assert.equal(after.cash,100);assert.deepEqual(after.skillQuiz.completed,[]);
  } finally {await context.close();}
}

async function verifyRealPythonChallenge(browser,url,errors,capture) {
  const seed=baseSeed();seed.typing.language='python';seed.studyStyle='quiz';
  const {context,page}=await open(browser,url,errors,seed);
  try {
    await page.locator('#quiz-panel .quiz-source').waitFor({state:'visible'});
    assert.equal(await page.locator(PANEL).isVisible(),false);
    const array=challengeTopics('python','syntax').find(q=>q.topicId==='positive-filter');
    const string=challengeTopics('python','design').find(q=>q.topicId==='ascii-lowercase');
    assert.ok(array&&string,'the runtime proof covers both arrays and strings');
    const cases=[
      {quiz:array,source:`def ${array.functionName}(values):\n    return list(filter(lambda value: value > 0, values))\n`},
      {quiz:string,source:`def ${string.functionName}(text):\n    return text.lower()\n`}
    ];
    for(const {quiz,source} of cases) {
      await page.locator(`[data-subject=${quiz.subject}]`).click();
      await page.locator('#quiz-panel .quiz-topic-picker select').selectOption(String(quiz.index));
      assert.equal(await page.locator('#quiz-panel .quiz-title').innerText(),quiz.title);
      assert.match(await page.locator('#quiz-panel .quiz-description').innerText(),/実装方法は自由/);
      await page.locator('#quiz-panel .quiz-source').fill(source);
      await page.locator('#quiz-panel .quiz-run').click();
      await page.waitForFunction(()=>!['idle','running'].includes(document.querySelector('#quiz-panel')?.dataset.quizStatus),null,{timeout:120000});
      assert.equal(await page.locator('#quiz-panel').getAttribute('data-quiz-status'),'passed',await page.locator('#quiz-panel').innerText());
      const actual=await page.locator('#quiz-panel .quiz-case[data-status=pass]').count();
      assert.equal(actual,quiz.cases.length,`${quiz.topicId}: real Python returns matching JSON values for every case`);
      assert.equal(quiz.createHarness(source).outputFormat,'json-lines');
      const state=await saved(page);
      assert.ok(state.quiz.completed.includes(quiz.id));
      assert.deepEqual(state.skillQuiz.completed,[],'an I/O Challenge does not forge a syntax-Quiz pass');
    }
    if(capture)await capture(page,'challenge-python-json-values');
  } finally {await context.close();}
}

export async function verifySkillQuizUI(browser,url,errors,capture) {
  await verifyMaterialGate(browser,url,errors);
  await verifyGradingAndControls(browser,url,errors,capture);
  await verifyPersistenceAndFocus(browser,url,errors);
  await verifyRealPythonChallenge(browser,url,errors,capture);
}
