import assert from 'node:assert/strict';
import { createState } from '../src/core.js';

async function open(browser,url,errors,viewport,overrides={}){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const data=createState();
  Object.assign(data,{mode:'study',inputStyle:'click',autoEnabled:false},overrides);
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

export async function verifyDirectTyping(browser,url,errors,options={}){
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
    assert.ok(Math.abs(draft.x-expected.x)<=1,'the editable suffix must start at the expected code character');
    assert.equal(await field.evaluate(el=>getComputedStyle(el).textDecorationLine),'underline','the underline belongs to the draft text, not its textarea box');
    assert.equal(await field.evaluate(el=>getComputedStyle(el).boxShadow),'none');
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
  await verifyTypoPosition(browser,url,errors,options);
  console.log('Direct typing checks passed: accepted prefix consumption, editable error selection, immutable output, reload, context reset, manual scroll and mobile resize.');
}

async function geometry(page){
  return page.evaluate(()=>{
    const field=document.querySelector('#typing-input'),mark=document.querySelector('.next-character'),pre=mark.closest('pre'),range=document.createRange();
    range.selectNodeContents(mark);
    const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom});
    const style=el=>{const s=getComputedStyle(el);return Object.fromEntries(['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','tabSize','lineHeight','textDecorationLine','textDecorationStyle','boxShadow'].map(key=>[key,s[key]]));};
    return {field:rect(field.getBoundingClientRect()),mark:rect(mark.getClientRects()[0]),glyph:rect(range.getClientRects()[0]),stage:rect(document.querySelector('#editor-stage').getBoundingClientRect()),fieldStyle:style(field),codeStyle:style(pre),buffer:field.value,feedback:document.querySelector('#input-feedback').innerText,focused:document.activeElement===field};
  });
}

async function assertDraft(page,before,label){
  const after=await geometry(page);
  assert.ok(Math.abs(after.field.x-after.glyph.x)<=1,`${label}: draft begins at the source glyph`);
  assert.ok(Math.abs(after.field.x-before.field.x)<=1,`${label}: entering an error must not move the caret to the right`);
  assert.ok(Math.abs(after.field.y+after.field.height/2-after.glyph.y-after.glyph.height/2)<=1,`${label}: text and source glyph share the same line baseline`);
  assert.equal(after.fieldStyle.textDecorationLine,'underline',`${label}: underline follows the draft text`);
  assert.equal(after.fieldStyle.textDecorationStyle,'wavy');
  assert.equal(after.fieldStyle.boxShadow,'none',`${label}: no underline at the bottom of the textarea box`);
  for(const key of ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','tabSize','lineHeight'])assert.equal(after.fieldStyle[key],after.codeStyle[key],`${label}: ${key} matches the source code`);
  assert.equal(after.focused,true);
  return after;
}

export async function verifyTypoPosition(browser,url,errors,{capture}={}){
  const {COURSE}=await import('../src/course.js');
  const unit=COURSE.cpp.units.find(u=>u.code.startsWith('// calculate_resell_price'));
  assert.ok(unit,'the user-reported C++ resell-price example must be present');
  assert.equal(unit.code[31],'l');
  const {context,page}=await open(browser,url,errors,{width:390,height:844});
  try{
    await page.locator('[data-study-style=course]').click();
    await page.waitForSelector('#course-exercise');
    await page.locator('#course-exercise').selectOption(String(unit.exercise));
    await page.locator('#course-unit').selectOption(unit.id);
    await page.locator('[data-input-style=typing]').click();
    await page.locator('#type-button').click();
    const field=page.locator('#typing-input'),content=page.locator('#editor-content');
    assert.equal(await content.getAttribute('data-prompt'),unit.code);
    const enter=async text=>{for(const part of text.split(/(\n)/)){if(part==='\n')await page.keyboard.press('Enter');else if(part)await page.keyboard.type(part);}};
    let offset=31;
    await enter(unit.code.slice(0,offset));
    const before=await geometry(page);
    await page.keyboard.type('u');
    await assertDraft(page,before,'calculate_resell_price offset31');
    assert.equal(await field.inputValue(),'u');
    assert.equal(await page.locator('#input-feedback').innerText(),'次の文字は「l」です。');
    if(capture)await capture(page,'course-offset31');
    await page.keyboard.press('Backspace');
    assert.equal(await field.inputValue(),'');
    const cleared=await geometry(page);
    assert.ok(Math.abs(cleared.field.x-cleared.glyph.x)<=1,'clearing an error returns the empty caret to the source glyph');
    assert.equal(await field.evaluate(el=>el.classList.contains('has-error')),false);

    const firstCommentEnd=unit.comments[0].end;
    let edge;
    while(offset<firstCommentEnd){
      edge=await geometry(page);
      if(edge.glyph.right>=edge.stage.right-30)break;
      await enter(unit.code[offset++]);
    }
    assert.ok(offset<firstCommentEnd,'the first comment must reach the right edge before translation');
    await page.keyboard.type(unit.code[offset]==='X'?'Y':'X');
    const edgeError=await assertDraft(page,edge,'right-edge character');
    assert.ok(Math.abs((edgeError.field.y-edgeError.stage.y)-(edge.field.y-edge.stage.y))<=1,'an error at the right edge must not be forced onto another line');
    if(capture)await capture(page,'right-edge');
    await page.keyboard.press('Backspace');

    let wrapped=false;
    while(offset<firstCommentEnd-1){
      const previous=await geometry(page),character=unit.code[offset++];
      await enter(character);
      const current=await geometry(page);
      if(character!=='\n' && current.glyph.x<previous.glyph.x-20){wrapped=true;break;}
    }
    assert.equal(wrapped,true,'the comment fixture must exercise a natural soft wrap');
    const wrap=await geometry(page);
    await page.keyboard.type(unit.code[offset]==='X'?'Y':'X');
    await assertDraft(page,wrap,'first character after soft wrap');
    await page.keyboard.press('Backspace');

    await enter(unit.code.slice(offset,firstCommentEnd));offset=firstCommentEnd;
    assert.equal(unit.code[offset],'\n');
    assert.equal(await page.locator('.translated-comment').count(),1);
    assert.match(await content.innerText(),/指定した経過年数/);
    const newline=await geometry(page);
    assert.equal(await page.locator('.next-character').innerText(),'↵\n','the expected newline remains visible as a return glyph');
    await page.keyboard.type('X');
    await assertDraft(page,newline,'newline after a translated comment');
    assert.match(await page.locator('#input-feedback').innerText(),/次の文字は.*改行.*Enter/);
    if(capture)await capture(page,'translated-comment-newline');
    await page.keyboard.press('Backspace');await page.keyboard.press('Enter');offset++;
    assert.equal(await field.inputValue(),'');
    assert.match(await page.locator('#typing-round').innerText(),new RegExp(`^${offset} / `));

    const space=unit.code.indexOf(' ',unit.comments[1].end+1);
    await enter(unit.code.slice(offset,space));offset=space;
    assert.equal(await page.locator('.translated-comment').count(),2);
    assert.equal(await page.locator('.next-character').textContent(),' ');
    const beforeSpace=await geometry(page);
    await page.keyboard.type('X');
    await assertDraft(page,beforeSpace,'space in the function declaration');
    assert.match(await page.locator('#input-feedback').innerText(),/次の文字は空白/);
    await page.keyboard.press('Backspace');await page.keyboard.press('Space');offset++;
    assert.equal(await field.inputValue(),'');

    await page.addStyleTag({content:'.editor-stage { font-size:24px !important; }'});
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(50);
    const enlarged=await geometry(page);
    assert.equal(enlarged.codeStyle.fontSize,'24px','font-size stress uses 150% of the normal 16px code font');
    await page.keyboard.type(unit.code[offset]==='X'?'Y':'X');
    await assertDraft(page,enlarged,'150% font after translated comments');
    if(capture)await capture(page,'font-150-percent');
    await page.keyboard.press('Backspace');
    assert.equal(await field.inputValue(),'');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }finally{await context.close();}

  const office=await open(browser,url,errors,{width:390,height:844},{mode:'work',inputStyle:'typing'});
  try{
    const p=office.page;
    await p.locator('#type-button').click();
    const before=await geometry(p);
    await p.keyboard.type('X');
    await assertDraft(p,before,'office input');
    const feedback=await p.locator('#input-feedback').innerText();
    assert.match(feedback,/伝票番号/);
    assert.doesNotMatch(feedback,/次の文字|「I」/,'office feedback must not reveal the expected invoice answer');
  }finally{await office.context.close();}
  console.log('Typo-position checks passed: reported course example, source baseline, right edge, soft wrap, translated comments, newline/space, 150% font and office feedback.');
}
