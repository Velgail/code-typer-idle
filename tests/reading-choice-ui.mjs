import assert from 'node:assert/strict';
import { createState, SKILLS, READING_UNITS } from '../src/core.js';
import { lessonAt, questionFor } from '../src/curriculum.js';
import { readingChoiceLabel } from '../src/readingchoices.js';

const SAVE = 'code-typer-idle:save:v1';
const PANEL = '#reading-panel';

function seedReading(language='cpp',subject='syntax',index=0) {
  const seed=createState();
  seed.autoEnabled=false;seed.mode='study';seed.studyStyle='reading';
  seed.typing.language=language;seed.subject=subject;
  seed.onlineMaterials=SKILLS.map(skill=>skill.id);
  seed.reading.cursors[`${language}/${subject}`]=index;
  return seed;
}

async function open(browser,url,errors,seed) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(data=>{
    if(sessionStorage.getItem('reading-choice-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
    sessionStorage.setItem('reading-choice-seeded','1');
  },seed);
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date()});
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto(url);await page.locator('#reading-question').waitFor({state:'visible'});
  return {context,page};
}

async function saved(page) {
  await page.locator('#save-button').click();
  return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
}

async function verifySourceAndChoices(page,lesson) {
  const panel=page.locator(PANEL),question=questionFor(lesson);
  assert.equal(await panel.locator('.reference-code').textContent(),lesson.code,'reading highlighting preserves every source character');
  assert.ok(await panel.locator('.reference-code [class^=ct-syntax-]').count()>0,'reading source uses the shared syntax highlighter');
  assert.deepEqual(await panel.locator('[data-read-answer]').evaluateAll(buttons=>buttons.map(button=>button.dataset.readAnswer)),question.choices.map(String));
  assert.ok(question.choices.length>=2 && question.choices.length<=4,'only independently plausible options are shown');
  assert.equal(await panel.locator('.reading-selected-reason,.reading-choice-notes,.reading-explanation').count(),0,'misconception explanations never leak before answering');
  await page.setViewportSize({width:360,height:844});
  assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth)<=1,'reading options fit a 360px viewport');
  for(const button of await panel.locator('[data-read-answer]').all()) {
    const bounds=await button.boundingBox();
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=361,'each result option fits the viewport');
  }
}

async function verifyClamp(browser,url,errors) {
  const lesson=lessonAt('cpp','syntax',0),question=questionFor(lesson);
  assert.deepEqual([...question.choices].sort((a,b)=>a-b),[-8,0,100],'clamp distractors represent the untouched input and mistaken upper limit');
  const {context,page}=await open(browser,url,errors,seedReading());
  try {
    await verifySourceAndChoices(page,lesson);
    const before=await saved(page);
    await page.locator('[data-read-answer="-8"]').click();
    const wrongReason=question.options.find(option=>option.value===-8).reason;
    assert.equal(await page.locator('.reading-selected-reason').innerText(),`この値になる読み違いの例：${wrongReason}`);
    assert.equal(await page.locator('.reading-choice-notes').getAttribute('open'),null,'all option explanations stay collapsed initially');
    await page.locator('.reading-choice-notes summary').click();
    assert.equal(await page.locator('.reading-choice-notes dd').count(),question.options.filter(option=>!option.correct).length);
    assert.equal(await page.locator(`${PANEL} .reading-trace`).textContent(),lesson.explanation,'the actual evaluation trace is unchanged');
    assert.equal(await page.locator('[data-read-answer]:disabled').count(),question.choices.length,'a wrong first answer locks all options');
    const wrong=await saved(page);
    assert.equal(wrong.reading.answers[lesson.baseId],-8);
    assert.equal(wrong.stats.study,before.stats.study,'a wrong answer gives no learning reward');
    await page.reload();await page.locator('.reading-selected-reason').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-read-answer="-8"]').getAttribute('class').then(value=>value.includes('wrong-choice')),true);
    assert.equal((await saved(page)).stats.study,before.stats.study,'save/reload does not change the first answer');
    await page.locator('[data-action=next-reading]').click();
    const next=lessonAt('cpp','syntax',1);
    await page.locator(`[data-read-answer="${next.answer}"]`).click();
    assert.equal((await saved(page)).stats.study,before.stats.study+READING_UNITS,'the next correct first answer still earns its normal reward');
    await page.reload();await page.locator('.reading-explanation').waitFor({state:'visible'});
    assert.equal((await saved(page)).stats.study,before.stats.study+READING_UNITS,'a correct answer is not rewarded again on reload');
    await page.screenshot({path:'work/reading-choices-mobile.png',fullPage:true});
  } finally {await context.close();}
}

async function verifyTypedOutcome(browser,url,errors,lesson,value) {
  const {context,page}=await open(browser,url,errors,seedReading(lesson.language,lesson.subject,lesson.index));
  try {
    await verifySourceAndChoices(page,lesson);
    const option=page.locator(`[data-read-answer="${String(value)}"]`);
    assert.equal(await option.innerText(),readingChoiceLabel(value),'typed outcomes have readable labels');
    const before=await saved(page);
    await option.click();
    assert.match(await page.locator('.reading-explanation').innerText(),/不正解/);
    assert.ok(await page.locator('.reading-selected-reason').innerText(),'the selected typed outcome explains a concrete misconception');
    const after=await saved(page);
    assert.equal(after.reading.answers[lesson.baseId],value,'NULL and error outcomes retain their actual JSON type');
    assert.equal(after.stats.study,before.stats.study,'NULL and error distractors never award learning');
    await page.reload();await page.locator('.reading-explanation').waitFor({state:'visible'});
    assert.equal((await saved(page)).reading.answers[lesson.baseId],value,'typed outcomes survive reload');
    assert.ok((await option.getAttribute('class')).includes('wrong-choice'),'the persisted typed outcome is marked as the selected wrong answer');
  } finally {await context.close();}
}

async function verifyLegacyChoice(browser,url,errors) {
  const seed=seedReading(),lesson=lessonAt('cpp','syntax',0);
  seed.reading.answers[lesson.baseId]=-1;
  const {context,page}=await open(browser,url,errors,seed);
  try {
    assert.match(await page.locator('.reading-explanation').innerText(),/不正解/);
    assert.equal(await page.locator('.reading-selected-reason').count(),0,'an old arbitrary-offset answer is not assigned an unrelated new misconception');
    assert.equal(await page.locator('[data-read-answer]:disabled').count(),questionFor(lesson).choices.length,'old answers remain final even if their option no longer exists');
    assert.equal((await saved(page)).reading.answers[lesson.baseId],-1,'the original legacy answer is retained');
  } finally {await context.close();}
}

export async function verifyReadingChoices(browser,url,errors) {
  await verifyClamp(browser,url,errors);
  await verifyTypedOutcome(browser,url,errors,lessonAt('sql','syntax',8),null);
  for(const outcome of ['runtime-error','compile-error']) {
    let target;
    for(const language of ['cpp','csharp','rust','go','python','java','lua']) {
      for(const subject of SKILLS.map(skill=>skill.id)) {
        for(let index=0;index<16;index++) {
          const lesson=lessonAt(language,subject,index);
          if(questionFor(lesson).choices.includes(outcome)){target=lesson;break;}
        }
        if(target)break;
      }
      if(target)break;
    }
    assert.ok(target,`the reading bank includes a meaningful ${outcome} misconception`);
    await verifyTypedOutcome(browser,url,errors,target,outcome);
  }
  await verifyLegacyChoice(browser,url,errors);
  console.log('Reading choice checks passed: authored clamp options, post-answer misconception feedback, NULL/error labels and saved types, first-answer locks, unchanged highlighted source/trace, legacy answers, and mobile layout.');
}
