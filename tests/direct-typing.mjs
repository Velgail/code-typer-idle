import assert from 'node:assert/strict';
import { createState } from '../src/core.js';

async function open(browser,url,errors,viewport){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const data=createState();
  Object.assign(data,{mode:'study',inputStyle:'click',autoEnabled:false});
  data.items['book-syntax']=1;
  await context.addInitScript(data=>{
    if(!sessionStorage.getItem('direct-typing-seeded')){
      data.savedAt=Date.now();
      localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));
      sessionStorage.setItem('direct-typing-seeded','1');
    }
  },data);
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('#typing-input:not([hidden])');
  return {context,page};
}

export async function verifyDirectTyping(browser,url,errors){
  const {context,page}=await open(browser,url,errors,{width:1100,height:1000});
  try{
    const field=page.locator('#typing-input'),content=page.locator('#editor-content');
    const prompt=await content.getAttribute('data-prompt');
    assert.equal(await page.locator('#typing-label').count(),0);
    await content.click();
    assert.equal(await page.locator('[data-input-style=typing]').getAttribute('aria-pressed'),'true','clicking code starts typing directly');
    assert.equal(await field.evaluate(el=>el===document.activeElement),true);
    assert.ok((await field.boundingBox()).width<=20,'an empty buffer must not be a separate large input box');

    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.insertText',{text:prompt.slice(0,3)+'XZZ'});
    assert.match(await page.locator('#typing-round').textContent(),/^3 \/ /);
    assert.equal(await field.inputValue(),'XZZ','only the unaccepted suffix remains editable');
    const expected=await page.locator('.next-character').boundingBox(),draft=await field.boundingBox();
    assert.ok(draft.x>=expected.x+expected.width,'an error must not cover the expected character');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.type(prompt[3]);
    assert.equal(await field.inputValue(),'ZZ');
    assert.equal(await field.evaluate(el=>el.selectionStart),0,'consuming a corrected prefix preserves the remaining selection position');
    await page.keyboard.press('Delete');
    assert.equal(await field.inputValue(),'Z');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(prompt.slice(4,9));
    assert.equal(await field.inputValue(),'');
    assert.match(await page.locator('#typing-round').textContent(),/^9 \/ /);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    assert.match(await page.locator('#typing-round').textContent(),/^9 \/ /,'accepted output cannot be rewound');
    await page.keyboard.type('X');
    await page.locator('#save-button').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));
    assert.equal(saved.typing.correct,9);
    await page.reload();
    await page.waitForSelector('#typing-input:not([hidden])');
    assert.equal(await field.inputValue(),'','reload restores accepted code without a stale error draft');
    assert.match(await page.locator('#typing-round').textContent(),/^9 \/ /);
    await content.click();
    await page.keyboard.type('X');
    assert.equal(await field.evaluate(el=>el.classList.contains('has-error')),true);
    await page.locator('#language-select').selectOption('rust');
    assert.equal(await field.inputValue(),'');
    assert.equal(await field.evaluate(el=>el.classList.contains('has-error')),false,'changing prompts clears stale error styling');
  }finally{await context.close();}

  const mobile=await open(browser,url,errors,{width:390,height:844});
  try{
    const p=mobile.page,field=p.locator('#typing-input'),content=p.locator('#editor-content');
    const prompt=await content.getAttribute('data-prompt');
    await content.click();
    await field.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await content.evaluate(el=>{el.scrollTop=180;});
    const scrolled=await content.evaluate(el=>el.scrollTop);
    assert.ok(scrolled>80,'the fixture must contain enough code to scroll');
    await p.waitForTimeout(1200);
    assert.ok(Math.abs(await content.evaluate(el=>el.scrollTop)-scrolled)<1,'periodic updates must preserve manual code scrolling');
    await p.keyboard.type(prompt[0]);
    assert.equal(await field.inputValue(),'');
    assert.ok(await content.evaluate(el=>el.scrollTop)<scrolled,'typing returns the cursor to view');
    await field.evaluate(el=>el.scrollIntoView({block:'end',behavior:'instant'}));
    await p.setViewportSize({width:390,height:450});
    await p.waitForTimeout(100);
    const rect=await field.boundingBox();
    assert.ok(rect.y>=0 && rect.y+rect.height<=451,'a focused cursor remains visible when the viewport shrinks');
    assert.equal(await field.evaluate(el=>el===document.activeElement),true);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }finally{await mobile.context.close();}
  console.log('Direct typing checks passed: accepted prefix consumption, editable error selection, immutable output, reload, context reset, manual scroll and mobile resize.');
}
