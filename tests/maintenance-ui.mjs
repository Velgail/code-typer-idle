import assert from 'node:assert/strict';
import { createState, projectAt } from '../src/core.js';

export async function verifyMaintenanceUI(browser,url,errors){
  const open=async(state,viewport={width:1280,height:1000})=>{
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});
    await context.addInitScript(data=>{
      if(!sessionStorage.getItem('maintenance-seeded')){
        data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));sessionStorage.setItem('maintenance-seeded','1');
      }
    },state);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForSelector('#development-policy:not(.hidden)');
    return {context,page};
  };
  const developer=(index=0)=>{
    const s=createState();s.mode='dev';s.projectIndex=index;s.autoEnabled=false;
    for(const [id,value] of Object.entries(projectAt(index).req))s.skills[id]=value;
    return s;
  };
  const saved=async p=>{await p.locator('#save-button').click();return p.evaluate(()=>JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));};
  const {context:first,page:novice}=await open(developer());
  try{
    await novice.locator('[data-development-policy=structured]').click();
    assert.match(await novice.locator('#development-policy-description').innerText(),/0.95/);
    await novice.locator('[data-development-policy=steady]').click();
    await novice.locator('#type-button').click();
    const code=await saved(novice);assert.ok(code.debt>0);assert.ok(code.progress>0);assert.equal(code.crashed,false);
    await novice.locator('#debt-summary').click();assert.match(await novice.locator('#debt-breakdown').innerText(),/仮実装.*継ぎ足した構造/s);
    await novice.locator('#type-button').click();
    assert.equal(await novice.locator('#debt-details').getAttribute('open'),'');
    const before=await saved(novice);
    await novice.locator('[data-mode=work]').click();await novice.locator('#type-button').click();
    const work=await saved(novice);assert.equal(work.debt,before.debt);assert.equal(work.defects,before.defects);
  }finally{await first.close();}

  const commercial=developer(1);commercial.progress=18000;commercial.debt=3500;commercial.cash=100000;
  const {context:second,page:publisher}=await open(commercial,{width:390,height:844});
  try{
    assert.equal(await publisher.locator('#release-button').isDisabled(),false);
    assert.match(await publisher.locator('#release-button').innerText(),/負債を残して公開/);
    assert.equal(await publisher.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await publisher.locator('#release-button').click();
    assert.match(await publisher.locator('#modal-body').innerText(),/NOW ON SALE/);
    await publisher.locator('#modal-close').click();
    const released=await saved(publisher);assert.ok(released.catalog[0].royalty>0);assert.equal(released.debt,0);
    await publisher.locator('[data-shop=auto]').click();
    assert.match(await publisher.locator('#library-reuse-note').innerText(),/ネオン・ブロック崩し.*25%.*875/);
    await publisher.locator('[data-buy=library]').click();const imported=await saved(publisher);
    assert.equal(imported.debt,875);assert.equal(imported.debtSources.reuse,875);
    await publisher.reload();await publisher.waitForSelector('#debt-summary');
    const reloaded=await saved(publisher);assert.equal(reloaded.debt,875);
  }finally{await second.close();}

  const damaged=developer();damaged.progress=3000;damaged.debt=100;damaged.defects=750;damaged.crashed=true;
  const {context:third,page:repair}=await open(damaged);
  try{
    assert.equal(await repair.locator('#release-button').isDisabled(),true);
    await repair.locator('#refactor-button').click();await repair.locator('#type-button').click();
    const repaired=await saved(repair);assert.equal(repaired.defects,746);assert.equal(repaired.debt,100);assert.equal(repaired.progress,3000);
    assert.match(await repair.locator('#maintenance-hint').innerText(),/まず不具合を修正/);
  }finally{await third.close();}
}
