import assert from 'node:assert/strict';
import { createState, projectAt, runBuild } from '../src/core.js';

export async function verifyMaintenanceUI(browser,url,errors){
  const open=async(state,viewport={width:1280,height:1000})=>{
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});
    await context.addInitScript(data=>{
      if(!sessionStorage.getItem('maintenance-seeded')){
        data.savedAt=Date.now();localStorage.setItem('code-typer-idle:save:v1',JSON.stringify(data));sessionStorage.setItem('maintenance-seeded','1');
      }
    },state);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForSelector('.buy-button');
    await page.waitForSelector('#development-policy:not(.hidden)');
    return {context,page};
  };
  const developer=(index=0)=>{
    const s=createState();s.mode='dev';s.projectIndex=index;s.autoEnabled=false;
    if(index>=2)s.experience={craft:5,design:2,audience:1};
    for(const [id,value] of Object.entries(projectAt(index).req))s.skills[id]=value;
    return s;
  };
  const saved=async p=>{await p.locator('#save-button').click();return p.evaluate(()=>JSON.parse(localStorage.getItem('code-typer-idle:save:v1')));};
  const expand=async(p,id)=>{
    const details=p.locator(`#${id}`);
    assert.equal(await details.evaluate(el=>el.tagName),'DETAILS');
    if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
    assert.equal(await details.evaluate(el=>el.open),true);
  };
  const assertClosed=async(p,id)=>assert.equal(await p.locator(`#${id}`).evaluate(el=>el.open),false,`${id} must initially be collapsed`);
  const assertNeutralRelease=async p=>assert.equal(await p.locator('#release-button').innerText(),'作品を公開 ↗','technical debt alone must not turn publishing into a warning');
  const assertNoPublicWarning=async p=>{
    for(const id of ['build-status','release-hint']){
      assert.equal(await p.locator(`#${id}`).isVisible(),true);
      assert.equal(await p.locator(`#${id}`).evaluate(el=>el.matches('.danger,.warning,[role="alert"]')),false,`${id}: a releasable amount of technical debt or defects is not a blocking warning`);
    }
  };
  const {context:first,page:novice}=await open(developer());
  try{
    await assertClosed(novice,'development-policy');
    await assertClosed(novice,'development-details');
    assert.match(await novice.locator('#development-policy > summary').innerText(),/^開発方針を選ぶ/);
    assert.equal(await novice.locator('#current-policy').innerText(),'通常');
    assert.equal(await novice.locator('#development-details > summary').innerText(),'コードの状態と検証履歴');
    await expand(novice,'development-policy');
    await novice.locator('[data-development-policy=structured]').click();
    assert.match(await novice.locator('#development-policy-description').innerText(),/0.95/);
    assert.equal(await novice.locator('#current-policy').innerText(),'構造重視');
    await novice.locator('[data-development-policy=prototype]').click();
    assert.equal(await novice.locator('#current-policy').innerText(),'仮実装');
    await novice.locator('[data-development-policy=steady]').click();
    assert.equal(await novice.locator('#current-policy').innerText(),'通常');
    await novice.locator('#type-button').click();
    const code=await saved(novice);assert.ok(code.debt>0);assert.ok(code.progress>0);assert.equal(code.crashed,false);
    assert.equal(await novice.locator('#development-policy').evaluate(el=>el.open),true,'selecting a policy and entering code preserves the expanded controls');
    await expand(novice,'development-details');
    await novice.locator('#debt-summary').click();assert.match(await novice.locator('#debt-breakdown').innerText(),/仮実装.*継ぎ足した構造/s);
    await novice.locator('#type-button').click();
    assert.equal(await novice.locator('#debt-details').getAttribute('open'),'');
    await novice.waitForTimeout(1100);
    for(const id of ['development-policy','development-details','debt-details'])assert.equal(await novice.locator(`#${id}`).evaluate(el=>el.open),true,`${id} must remain open through input and periodic rendering`);
    const before=await saved(novice);
    await novice.locator('[data-mode=work]').click();await novice.locator('#type-button').click();
    const work=await saved(novice);assert.equal(work.debt,before.debt);assert.equal(work.defects,before.defects);
  }finally{await first.close();}

  for(const {complete,cash} of [{complete:false,cash:100},{complete:true,cash:100},{complete:true,cash:20000}]){
    const ordinary=developer();ordinary.progress=complete?3000:1650;ordinary.debt=83.8;ordinary.defects=10.8;
    ordinary.cash=cash;ordinary.inputStyle=complete?'typing':'click';
    ordinary.items['book-syntax']=1;
    runBuild(ordinary);
    const {context,page}=await open(ordinary,{width:390,height:844});
    try{
      await assertClosed(page,'development-policy');
      await assertClosed(page,'development-details');
      assert.equal(await page.locator('#progress-summary').isVisible(),true);
      const progress=await page.locator('#progress-summary').innerText();
      assert.match(progress,/3,?000/,'the first project always uses its 3,000-character target');
      assert.match(progress,complete?/100(?:\.0+)?%/:/55(?:\.0+)?%/);
      for(const id of ['debt-details','defect-summary','maintenance-hint','build-summary','build-history']){
        assert.equal(await page.locator(`#${id}`).evaluate(el=>el.closest('#development-details')!==null),true,`${id} belongs to the optional development details`);
        assert.equal(await page.locator(`#${id}`).isVisible(),false,`${id}: internal numeric details must not leak from the collapsed panel`);
      }
      await assertNeutralRelease(page);
      await assertNoPublicWarning(page);
      assert.doesNotMatch((await page.locator('#build-status').innerText())+' '+(await page.locator('#release-hint').innerText()),/83\.8|10\.8/);
      assert.equal(await page.locator('#release-button').isDisabled(),!complete);
      assert.match(await page.locator('#release-hint').innerText(),complete?/準備|公開できます|公開可能/:/1,?350/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(complete){
        await page.locator('#release-button').click();
        const next=page.locator('[data-action=next-project]');
        assert.equal(await next.innerText(),'次の企画へ →');
        await next.click();
        assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);
        assert.match(await page.locator('#next-goal').innerText(),/ネオン・ブロック崩し/);
        assert.equal(await page.locator('#goal-action').isDisabled(),false,'the next free material must remain accessible even without textbook money');
        assert.equal(await page.locator('#goal-action').getAttribute('data-goal-kind'),'material');
        assert.equal(await page.locator('#goal-action').getAttribute('data-goal-item'),'design');
        assert.equal(await page.locator('#goal-action').evaluate(el=>el===document.activeElement),true,'the next project must focus its free learning action');
        const box=await page.locator('#next-milestone').boundingBox();
        assert.ok(box.y>=-1 && box.y+box.height<=845,'the next project goal must return to the visible viewport');
        assert.equal(await page.locator('#typing-input').evaluate(el=>el===document.activeElement),false,'the handoff must not resume uninformed development');
        await page.keyboard.type('int');
        const nextProject=await saved(page);
        assert.equal(nextProject.projectIndex,1);
        assert.equal(nextProject.progress,0);
        assert.equal(nextProject.stats.manual,0,'typing after the modal handoff must not accidentally generate invalid code');
      }
    }finally{await context.close();}
  }

  const commercial=developer(2);commercial.progress=projectAt(2).target;commercial.debt=3500;commercial.cash=100000;
  const {context:second,page:publisher}=await open(commercial,{width:390,height:844});
  try{
    assert.equal(await publisher.locator('#release-button').isDisabled(),false);
    await assertNeutralRelease(publisher);
    await assertClosed(publisher,'development-details');
    assert.equal(await publisher.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await publisher.locator('#release-button').click();
    assert.match(await publisher.locator('#modal-body').innerText(),/NOW ON SALE/);
    await publisher.locator('#modal-close').click();
    const released=await saved(publisher);assert.ok(released.catalog[0].royalty>0);assert.equal(released.debt,0);
    await publisher.locator('[data-shop=auto]').click();
    assert.match(await publisher.locator('#library-reuse-note').innerText(),/雨のダンジョン.*25%.*875/);
    await publisher.locator('[data-buy=library]').click();const imported=await saved(publisher);
    assert.equal(imported.debt,875);assert.equal(imported.debtSources.reuse,875);
    await publisher.reload();await publisher.waitForSelector('.buy-button');
    const reloaded=await saved(publisher);assert.equal(reloaded.debt,875);
  }finally{await second.close();}

  const damaged=developer();damaged.progress=3000;damaged.debt=100;damaged.defects=750;damaged.crashed=true;runBuild(damaged);
  const {context:third,page:repair}=await open(damaged);
  try{
    assert.equal(await repair.locator('#release-button').isDisabled(),true);
    await assertNeutralRelease(repair);
    await assertClosed(repair,'development-details');
    assert.equal(await repair.locator('#build-status').isVisible(),true);
    assert.match(await repair.locator('#build-status').innerText(),/失敗|修正|不具合/);
    assert.equal(await repair.locator('#release-hint').isVisible(),true);
    assert.match(await repair.locator('#release-hint').innerText(),/失敗|修正|不具合/);
    await repair.locator('#refactor-button').click();await repair.locator('#type-button').click();
    const repaired=await saved(repair);assert.equal(repaired.defects,746);assert.equal(repaired.debt,100);assert.equal(repaired.progress,3000);
    await expand(repair,'development-details');
    assert.match(await repair.locator('#maintenance-hint').innerText(),/まず不具合を修正/);
  }finally{await third.close();}

  const blocked=developer();blocked.progress=3000;blocked.defects=100;runBuild(blocked);
  const {context:blockedContext,page:blockedRelease}=await open(blocked);
  try{
    await assertClosed(blockedRelease,'development-details');
    assert.equal(await blockedRelease.locator('#release-button').isDisabled(),true,'test failures above the public-release limit must still block release');
    for(const id of ['build-status','release-hint']){
      assert.equal(await blockedRelease.locator(`#${id}`).isVisible(),true);
      assert.match(await blockedRelease.locator(`#${id}`).innerText(),/修正|不具合|問題/);
    }
    await blockedRelease.locator('#refactor-button').click();
    await blockedRelease.locator('#type-button').click();
    assert.equal((await saved(blockedRelease)).defects,96,'repair must be reachable without first opening technical details');
  }finally{await blockedContext.close();}

  const integration=developer(2);integration.progress=1000;integration.cash=20000;
  const {context:fourth,page:build}=await open(integration,{width:390,height:844});
  try{
    assert.match(await build.locator('#build-status').innerText(),/未検証/);
    await expand(build,'development-details');
    await build.locator('#build-button').click();
    assert.match(await build.locator('#build-status').innerText(),/ビルド・テスト成功/);
    assert.equal(await build.locator('#build-button').isDisabled(),true);
    const before=await saved(build);
    await build.locator('#production-panel summary').click();
    assert.match(await build.locator('#production-services').innerText(),/素材ストア.*80 → 86/s);
    await build.locator('[data-order=graphics]').click();
    const graphics=await saved(build);assert.equal(graphics.cash,before.cash-600);assert.equal(graphics.progress,before.progress);
    assert.equal(graphics.production.graphics.paid,600);assert.ok(graphics.build.revision>before.build.checkedRevision);
    assert.match(await build.locator('#build-status').innerText(),/未検証/);
    assert.equal(await build.locator('[data-order=graphics]').isDisabled(),true);
    await build.locator('#build-button').click();const verified=await saved(build);
    assert.equal(verified.build.revision,verified.build.checkedRevision);
    await build.reload();await build.waitForSelector('.buy-button');
    const restored=await saved(build);assert.equal(restored.production.graphics.paid,600);assert.equal(restored.cash,graphics.cash);
    assert.equal(await build.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }finally{await fourth.close();}
  console.log('Maintenance UI checks passed: collapsed technical details, neutral first-release guidance, persistent expanded controls, public release, direct repair, reuse, assets and build verification.');
}
