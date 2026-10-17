import assert from 'node:assert/strict';
import { createState } from '../src/core.js';
import { lessonAt } from '../src/curriculum.js';
import { COURSE } from '../src/course.js';

const replaced='#editor-content .translated-comment';
const type=async(page,text)=>{
  for(const piece of text.split(/(\t|\n)/)){
    if(piece==='\t')await page.keyboard.press('Tab');
    else if(piece==='\n')await page.keyboard.press('Enter');
    else if(piece)await page.keyboard.type(piece);
  }
};
async function openLesson(browser,url,errors,language,source,lesson,viewport={width:1100,height:1000}){
  const context=await browser.newContext({viewport}),data=createState();
  Object.assign(data,{mode:'study',inputStyle:'typing',studyStyle:source==='course'?'course':'practice',subject:lesson.subject || 'syntax'});
  Object.assign(data.typing,{language,source,courseUnit:source==='course'?lesson.id:''});
  for(const subject of ['syntax','design','graphics','systems'])data.items[`book-${subject}`]=1;
  await context.addInitScript(data=>{
    if(!sessionStorage.getItem('comment-test-seeded')){
      localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));sessionStorage.setItem('comment-test-seeded','1');
    }
  },data);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await page.waitForSelector('#typing-input:not([hidden])');
  assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'),lesson.code);
  assert.equal(await page.locator('#typing-comment-notes').count(),0,'there must be no separate translation panel');
  return {context,page};
}

// The target code itself must change at a comment boundary. Checking a separate
// explanation panel would miss both the requested replacement and stale text.
export async function verifyCommentTranslations(browser,url,errors){
  const cases=Object.keys(COURSE).flatMap(language=>[
    {language,source:'standard',lesson:lessonAt(language,'syntax',0)},
    {language,source:'course',lesson:COURSE[language].units.find(u=>u.comments.some(c=>c.end<u.code.length))}
  ]);
  cases.push({language:'rust',source:'course',lesson:COURSE.rust.units.find(u=>u.comments.length>=8 && u.comments.at(-1).end<u.code.length-1),many:true});
  for(const {language,source,lesson,many=false} of cases){
    assert.ok(lesson,`${language}/${source} needs a real comment fixture`);
    const {context,page}=await openLesson(browser,url,errors,language,source,lesson,many?{width:390,height:450}:undefined);
    try{
      const comments=[...lesson.comments].sort((a,b)=>a.end-b.end),first=comments[0];
      await page.locator('#typing-input').click();
      await type(page,lesson.code.slice(0,first.end-1));
      assert.equal(await page.locator(replaced).count(),0,'an incomplete comment must stay English');
      if(language==='cpp' && source==='standard'){
        await page.keyboard.type(lesson.code[first.end-1]==='x'?'y':'x');
        assert.equal(await page.locator(replaced).count(),0,'a wrong final character cannot replace a comment');
        await page.keyboard.press('Backspace');
      }
      await type(page,lesson.code.slice(first.end-1,first.end));
      assert.ok((await page.locator(replaced).first().textContent()).includes(first.ja));
      assert.equal(await page.locator('#editor-content .typed-code').textContent().then(t=>t.includes(first.en)),false,'the English comment must be replaced, not repeated elsewhere');
      assert.equal(await page.locator('#editor-content').getAttribute('data-prompt'),lesson.code,'the actual English input target stays stable');
      assert.equal(await page.locator('#typing-input').inputValue(),'');
      assert.equal(await page.locator('#typing-input').evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('#typing-input').evaluate(el=>el.selectionStart),0);
      const next=[...lesson.code.slice(first.end)][0];
      assert.equal(await page.locator('#editor-content .next-character').textContent(),next==='\n'?'↵\n':next);
      assert.equal(await page.locator('#editor-content .pending-code').textContent(),lesson.code.slice(first.end+next.length));
      await page.locator('#save-button').click();await page.reload();
      await page.waitForSelector(replaced);
      assert.ok((await page.locator(replaced).first().textContent()).includes(first.ja),'reload must restore only this prompt’s accepted translations');
      assert.equal(await page.locator('#typing-input').inputValue(),'');
      if(many){
        await page.locator('#typing-input').click();await page.keyboard.press('Control+End');let offset=first.end;
        for(const comment of comments.slice(1)){
          await type(page,lesson.code.slice(offset,comment.end));offset=comment.end;
          assert.ok((await page.locator(replaced).last().textContent()).includes(comment.ja));
        }
        assert.equal(await page.locator(replaced).count(),comments.length);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      if(language==='cpp' && source==='standard'){
        await page.locator('#settings-button').click();await page.locator('#comment-locale-setting').selectOption('en');
        assert.equal(await page.locator(replaced).count(),0);
        assert.equal(await page.locator('#editor-content .typed-code').textContent(),lesson.code.slice(0,first.end));
        await page.locator('#comment-locale-setting').selectOption('ja');
        assert.ok((await page.locator(replaced).textContent()).includes(first.ja));await page.locator('#modal-close').click();
        await page.locator('#typing-input').click();await page.keyboard.press('Control+End');
        const second=comments[1];await type(page,lesson.code.slice(first.end,second.end-1));
        assert.equal(await page.locator(replaced).count(),1);
        await type(page,lesson.code.slice(second.end-1,second.end));assert.equal(await page.locator(replaced).count(),2);
        await type(page,lesson.code.slice(second.end));assert.equal(await page.locator(replaced).count(),0,'the next prompt must start in English');
        assert.equal(await page.locator('#editor-content').textContent().then(t=>t.includes(second.ja)),false);
      }
      if(language==='cpp' || language==='python'){
        await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
    }finally{await context.close();}
  }
  // User reproduction: the next C++ function has no comment of its own. An old
  // lastCourseComments field must not resurrect daily_rate's translation.
  const track=COURSE.cpp,exercise=track.exercises.find(e=>e.slug==='freelancer-rates');
  const daily=exercise.units.map(i=>track.units[i]).find(u=>u.code.includes('double daily_rate'));
  const {context,page}=await openLesson(browser,url,errors,'cpp','course',daily);
  try{
    const comment=daily.comments[0];await page.locator('#typing-input').click();
    await type(page,daily.code.slice(0,comment.end-1));assert.equal(await page.locator(replaced).count(),0);
    await type(page,daily.code.slice(comment.end-1,comment.end));
    assert.equal(await page.locator(replaced).textContent(),`// ${comment.ja}`);
    await type(page,daily.code.slice(comment.end));
    assert.match(await page.locator('#editor-content').getAttribute('data-prompt'),/apply_discount/);
    assert.equal(await page.locator(replaced).count(),0);
    assert.equal(await page.locator('body').textContent().then(t=>t.includes(comment.ja)),false,'the previous translation cannot survive elsewhere on the page');
    await page.locator('#save-button').click();
    await page.evaluate(id=>{const key='code-typer-idle:save:v1',data=JSON.parse(localStorage.getItem(key));data.typing.lastCourseComments=id;localStorage.setItem(key,JSON.stringify(data));},daily.id);
    await page.reload();await page.waitForSelector('#course-unit');
    assert.equal(await page.locator(replaced).count(),0);
    assert.equal(await page.locator('body').textContent().then(t=>t.includes(comment.ja)),false);
    await page.locator('#language-select').selectOption('rust');assert.equal(await page.locator(replaced).count(),0);
    await page.locator('#language-select').selectOption('cpp');assert.equal(await page.locator(replaced).count(),0);
    await page.locator('[data-subject=design]').click();assert.equal(await page.locator(replaced).count(),0);
  }finally{await context.close();}
  // A docstring that ends its unit advances normally without retaining a panel
  // or the finished unit's Japanese text in the next code display.
  const closing=COURSE.python.units.find(u=>u.comments.length===1 && u.code.endsWith(u.comments[0].en));
  const end=await openLesson(browser,url,errors,'python','course',closing);
  try{
    await end.page.locator('#typing-input').click();await type(end.page,closing.code);
    assert.notEqual(await end.page.locator('#editor-content').getAttribute('data-prompt'),closing.code);
    assert.equal(await end.page.locator(replaced).count(),0);
    assert.equal(await end.page.locator('#editor-content').textContent().then(t=>t.includes(closing.comments[0].ja)),false);
  }finally{await end.context.close();}
  console.log('Inline comment checks passed: exact replacement in eight languages, English validation, wrong input, delimiters, Unicode positions, next prompts, stale saves, locale, focus, and mobile layout.');
}
