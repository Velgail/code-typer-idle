import assert from 'node:assert/strict';
import {createState,SKILLS} from '../src/core.js';
import {PLANNING_CATALOG} from '../src/planningcatalog.js';

const SAVE='code-typer-idle:save:v1';
async function open(browser,url,errors,{expert=false,viewport={width:1440,height:1100}}={}){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),seed=createState();seed.autoEnabled=false;
  if(expert)for(const {id} of SKILLS)seed.skills[id]=1e6;
  await context.addInitScript(data=>{
    if(sessionStorage.getItem('planner-ui-seeded'))return;
    data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));sessionStorage.setItem('planner-ui-seeded','1');
  },seed);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForSelector('.nav-button[data-view=planner]');return{context,page};
}
async function saved(page){await page.locator('#save-button').click();return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);}
async function planner(page){await page.locator('.nav-button[data-view=planner]').click();await page.waitForSelector('#planner-form');}
async function reveal(locator){await locator.evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});}
async function select(page,field,value){const el=page.locator(`[data-plan-axis=${field}]`);await reveal(el);await el.selectOption(value);}
async function feature(page,id,checked=true){const el=page.locator(`[data-plan-feature="${id}"]`);assert.equal(await el.count(),1,`${id} must be selectable`);await reveal(el);await el.setChecked(checked);}
async function check(page,field,value,checked=true){const el=page.locator(`[data-plan-list=${field}][value="${value}"]`);await reveal(el);await el.setChecked(checked);}
async function typeQuestion(page){
  await page.locator('[data-input-style=typing]').click();
  await page.locator('#type-button').click();
  const text=await page.locator('#editor-content').getAttribute('data-prompt'),offset=Number((await page.locator('#typing-round').innerText()).match(/^\d+/)[0]);
  assert.ok(text?.length>offset);await page.keyboard.type(text.slice(offset));
}

async function verifyPlannerSaveCapacity(browser,url,errors){
  for(const scenario of ['normal','backup-full','reclaim-backup','main-full']){
    const {context,page}=await open(browser,url,errors);
    try{
      await saved(page);
      const before=await page.evaluate(key=>({main:localStorage.getItem(key),backup:localStorage.getItem(`${key}:backup`)}),SAVE);
      assert.ok(before.main && before.backup,'the fixture starts with both normal save generations');
      await page.evaluate(({key,scenario})=>{
        const originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem;
        window.plannerStorageTrace=[];
        Storage.prototype.setItem=function(name,value){
          if(this===localStorage){
            window.plannerStorageTrace.push({op:'set',key:name});
            if(name===`${key}:backup` && ['backup-full','reclaim-backup'].includes(scenario))throw new DOMException('Backup exceeds storage capacity','QuotaExceededError');
            if(name===key && (scenario==='main-full' || scenario==='reclaim-backup' && localStorage.getItem(`${key}:backup`)!==null))throw new DOMException('Main exceeds storage capacity','QuotaExceededError');
          }
          return originalSet.call(this,name,value);
        };
        Storage.prototype.removeItem=function(name){if(this===localStorage)window.plannerStorageTrace.push({op:'remove',key:name});return originalRemove.call(this,name);};
        window.restorePlannerStorage=()=>{Storage.prototype.setItem=originalSet;Storage.prototype.removeItem=originalRemove;};
      },{key:SAVE,scenario});
      await page.locator('#type-button').click();await page.locator('#save-button').click();
      const after=await page.evaluate(key=>({main:localStorage.getItem(key),backup:localStorage.getItem(`${key}:backup`),trace:window.plannerStorageTrace}),SAVE);
      assert.equal(after.trace.some(row=>row.op==='remove' && row.key===SAVE),false,'a failed write never deletes the existing main save');
      const writes=after.trace.filter(row=>row.op==='set');assert.equal(writes[0].key,SAVE,'main progress is written before trying a second save generation');
      if(scenario==='main-full'){
        assert.equal(after.main,before.main,'when every main write fails, the last valid main remains byte-for-byte intact');
        assert.equal(await page.locator('#save-status').evaluate(el=>el.classList.contains('save-error')),true);
      }else{
        assert.equal(JSON.parse(after.main).job.progress,JSON.parse(before.main).job.progress+1,'backup storage pressure cannot block current progress');
        assert.equal(await page.locator('#save-status').evaluate(el=>el.classList.contains('save-error')),false);
        if(scenario==='normal')assert.equal(after.backup,before.main,'the successful normal backup contains the preceding main generation');
        if(scenario==='backup-full')assert.equal(after.backup,before.backup,'a backup-only failure leaves the older recovery copy available');
        if(scenario==='reclaim-backup'){
          assert.ok(writes.filter(row=>row.key===SAVE).length>=2,'freeing backup capacity retries the main write');
          assert.ok(after.trace.some(row=>row.op==='remove' && row.key===`${SAVE}:backup`));assert.equal(after.backup,null,'a second oversized copy is optional');
        }
      }
      // Keep the simulated capacity limit through beforeunload, which also
      // attempts a save. The new document gets an unpatched Storage prototype.
      await page.reload();await page.waitForSelector('#task-title');
      const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
      assert.equal(restored.job.progress,JSON.parse(after.main).job.progress,'the surviving main remains readable after reload');
    }finally{await context.close();}
  }
}

export async function runPlannerChecks({browser,url,errors}){
  const desktop=await open(browser,url,errors,{expert:true}),page=desktop.page;
  try{
    await planner(page);
    for(const [field,axis] of [['engineId','engines'],['playModeId','playMode'],['networkId','network'],['syncId','sync'],['cameraId','camera'],['salesModelId','salesModel']]){
      const rows=axis==='engines'?PLANNING_CATALOG.engines:PLANNING_CATALOG.axes[axis];
      assert.equal(await page.locator(`[data-plan-axis=${field}] option`).count(),rows.length,field);
    }
    await page.locator('#planner-name').fill('2026年の小さな企画');
    await check(page,'themeIds','abstract');await feature(page,'stage-content');
    const quantity=page.locator('[data-plan-quantity=stage-content]');await reveal(quantity);await quantity.fill('2026');
    await page.waitForTimeout(1150);
    assert.equal(await quantity.inputValue(),'2026');assert.equal(await quantity.evaluate(el=>el===document.activeElement),true,'ticking estimates preserve the numeric field and its focus');
    assert.equal(await page.locator('#planner-view').isVisible(),true);assert.equal((await saved(page)).stats.manual,0,'numbers in planning are not typing rewards or mode shortcuts');
    await quantity.fill('4');await quantity.blur();assert.equal(await page.locator('#planner-start').isDisabled(),false);
    await select(page,'engineId','unreal');assert.equal(await page.locator('#planner-start').isDisabled(),true);assert.match(await page.locator('#planner-estimate').innerText(),/ブラウザ|browser/i);
    await select(page,'engineId','godot');await check(page,'targets','console');await check(page,'targets','browser',false);await check(page,'storeIds','console-store');await check(page,'storeIds','direct',false);await select(page,'inputId','gamepad');
    assert.equal(await page.locator('#planner-start').isDisabled(),true);
    await feature(page,'console-porting-contract');assert.equal(await page.locator('#planner-start').isDisabled(),false,'the missing Godot console port is repairable from the form');
    await page.locator('#planner-new').click();await select(page,'inputId','vr');assert.equal(await page.locator('#planner-start').isDisabled(),true);
    await feature(page,'webxr-adapter');assert.equal(await page.locator('#planner-start').isDisabled(),false,'browser VR has an explicit selectable bridge');
    await page.locator('#planner-new').click();await select(page,'playModeId','online-versus');await select(page,'networkId','p2p');await select(page,'syncId','rollback');await select(page,'cameraId','per-player');
    const capacity=page.locator('[data-plan-driver=concurrentPlayers]');await reveal(capacity);await capacity.fill('4');await capacity.blur();
    assert.equal(await page.locator('#planner-start').isDisabled(),false);assert.match(await page.locator('#planner-estimate').innerText(),/P2P|仲介/);
    await capacity.fill('9');await capacity.blur();assert.equal(await page.locator('#planner-start').isDisabled(),true,'P2P rollback capacity limits reach the actual UI');
    await page.locator('#planner-new').click();await page.locator('#planner-name').fill('小さな検証作品');await check(page,'themeIds','abstract');
    await page.locator('#planner-start').click();await page.waitForSelector('#custom-production:not(.hidden)');
    const started=await saved(page);assert.ok(started.planner.active);assert.equal(started.planner.projects.at(-1).name,'小さな検証作品');assert.deepEqual(started.planner.projects.at(-1).snapshot.plan.themeIds,['abstract']);
    const id=started.planner.active,prompt=await page.locator('#editor-content').getAttribute('data-prompt');await page.locator('[data-input-style=typing]').click();await page.locator('#type-button').click();await page.keyboard.type(prompt.slice(0,8));
    const partial=await saved(page);assert.ok(partial.progress>0);assert.equal(partial.typing.correct,8,'actual accepted code typing is credited to the custom project');assert.equal(partial.cash,100);
    await planner(page);await page.locator('#planner-projects [data-plan-action=pause]').click();const paused=await saved(page);assert.equal(paused.planner.active,null);
    await page.locator(`[data-plan-resume="${id}"]`).click();await page.waitForSelector('#custom-production:not(.hidden)');const resumed=await saved(page);assert.equal(resumed.progress,partial.progress);
    await page.reload();await page.waitForSelector('#task-title');const loaded=await saved(page);assert.equal(loaded.planner.active,id);assert.equal(loaded.progress,partial.progress);
    await page.locator('#custom-production [data-plan-action=edit]').click();await feature(page,'save-load');await page.locator('#planner-expand').click();await page.waitForSelector('#custom-production:not(.hidden)');
    const expanded=await saved(page);assert.equal(expanded.progress,partial.progress);assert.ok(expanded.planner.projects.find(row=>row.id===id).codeTarget>started.planner.projects.find(row=>row.id===id).codeTarget);
    for(let i=0;i<8;i++){
      const work=await saved(page),project=work.planner.projects.find(row=>row.id===id);if(work.progress>=project.codeTarget)break;
      await typeQuestion(page);
    }
    const implemented=await saved(page);assert.equal(implemented.progress,implemented.planner.projects.find(row=>row.id===id).codeTarget);
    if(await page.locator('#release-button').isDisabled()){
      await page.locator('#refactor-button').click();await typeQuestion(page);
      if(!await page.locator('#build-button').isDisabled())await page.locator('#build-button').click();
    }
    assert.equal(await page.locator('#release-button').isDisabled(),false);await page.locator('#release-button').click();assert.match(await page.locator('#modal-body').innerText(),/小さな検証作品/);
    await page.locator('#modal-body [data-action=planner]').click();const released=await saved(page);assert.equal(released.catalog.at(-1).custom,true);assert.equal(released.catalog.at(-1).payout,0);assert.equal(released.planner.active,null);
    assert.ok(released.planner.knowledge.genres.includes('number-puzzle'));assert.ok(released.planner.knowledge.testedFeatures.includes('save-load'));
    await page.locator('#planner-new').click();await select(page,'presentationId','pixel-2d');await page.locator('#planner-start').click();await page.waitForSelector('#custom-production:not(.hidden)');
    await page.locator('[data-plan-allocation=assets]').click();assert.equal(await page.locator('#asset-work-button').isVisible(),true);assert.equal(await page.locator('#typing-input').isDisabled(),true,'art work cannot use the hidden source-code input');
    const materialBefore=await saved(page),assetButton=page.locator('#asset-work-button');await assetButton.focus();
    for(const key of ['Enter','Space','Enter','Space'])await page.keyboard.press(key);
    const keyboard=await saved(page);assert.equal(keyboard.planner.projects.at(-1).assetProgress,materialBefore.planner.projects.at(-1).assetProgress,'Enter and Space cannot farm material clicks');
    await assetButton.click();const materialAfter=await saved(page);assert.ok(materialAfter.planner.projects.at(-1).assetProgress>materialBefore.planner.projects.at(-1).assetProgress);
    assert.equal(materialAfter.progress,materialBefore.progress);for(const key of ['chars','valid','study'])assert.equal(materialAfter.stats[key],materialBefore.stats[key],key);
    await page.locator('[data-plan-allocation=code]').click();assert.equal(await page.locator('#asset-work-button').isVisible(),false);assert.equal(await page.locator('#typing-input').isDisabled(),false);
  }finally{await desktop.context.close();}

  const mobile=await open(browser,url,errors,{viewport:{width:390,height:844}}),p=mobile.page;
  try{
    await planner(p);await p.locator('#planner-name').fill('学習から始める');await select(p,'presentationId','pixel-2d');
    await p.locator('#planner-form').evaluate(el=>el.querySelectorAll('details').forEach(details=>details.open=true));
    for(const width of [390,360]){
      await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`the full planner fits ${width}px`);
    }
    await p.locator('#planner-start').click();await p.waitForSelector('#task-title');assert.equal(await p.locator('[data-mode=study]').getAttribute('aria-selected'),'true','missing custom requirements lead to the relevant study task');
    const before=await saved(p);assert.ok(before.planner.active);assert.equal(before.progress,0);
    assert.equal(await p.locator('#goal-action').isDisabled(),false);await p.locator('#goal-action').click();
    assert.equal(await p.locator('#typing-input').isDisabled(),false);await typeQuestion(p);
    const learned=await saved(p);assert.ok(learned.stats.study>0);assert.ok(Object.values(learned.skills).some(value=>value>0));assert.equal(learned.cash,100,'free study does not require buying OCR');
  }finally{await mobile.context.close();}
  await verifyPlannerSaveCapacity(browser,url,errors);
  console.log('Planner UI checks passed: axes, editable quantities, constraints and bridges, typing, shelving, save reload, expansion, publication, free study, mobile widths and main-save priority under storage pressure.');
}
