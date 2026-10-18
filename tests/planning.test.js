import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatePlan,amendPlan,PlanningError} from '../src/planning.js';
import {PLANNING_CATALOG,PLANNING_EXAMPLES} from '../src/planningcatalog.js';

const copy=value=>structuredClone(value);
const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`);
const error=(fn,code)=>assert.throws(fn,value=>value instanceof PlanningError && value.code===code);
const ids=rows=>rows.map(row=>row.id);
function frozen(value){if(value && typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function simpleCatalog(){
  return {
    version:'fixture-1',
    genres:[{id:'walk',requiredFeatures:['walk']},{id:'menus',requiredFeatures:['walk',{id:'menu',quantity:5}]}],
    engines:[{id:'custom',provides:{runtime:'runtime'}},{id:'sdk',requiredFeatures:['sdk-runtime'],provides:{runtime:'sdk-runtime'}}],
    axes:{presentation:[{id:'pixel'}],audio:[{id:'chip'}],input:[{id:'keyboard'}],platform:[{id:'linux'},{id:'windows',requiredFeatures:['windows-adapter','windows-tests']}]},
    features:[
      {id:'runtime',baseLines:1000,requirements:{syntax:2,systems:3}},
      {id:'sdk-runtime',baseLines:100,costs:[{id:'engine-license',kind:'upfront',per:'project',amount:500,payee:'engine vendor'}]},
      {id:'walk',baseLines:2000,requires:['capability:runtime'],requirements:{syntax:10}},
      {id:'inventory',baseLines:2000,requires:['capability:runtime'],requirements:{design:8}},
      {id:'menu',baseLines:500,linesPerUnit:10,quantity:{min:1,max:100,default:1},requires:['capability:runtime']},
      {id:'windows-adapter',baseLines:200,requires:['capability:runtime']},
      {id:'windows-tests',baseLines:100,requires:['capability:runtime']},
      {id:'portraits',baseLines:0,quantity:{min:1,max:10000,default:1},assets:[{id:'portrait',count:1,selfWorkPerUnit:3,sourcing:{self:{unitCost:0},license:{unitCost:10,payee:'asset shop'},commission:{unitCost:50,payee:'artist'}}}]},
      {id:'server',baseLines:800,requires:['capability:runtime'],costs:[{id:'hosting',kind:'recurring',per:'day',amount:100,perUnit:.5,includedUnits:100,driver:'concurrentPlayers',payee:'hosting provider'}]}
    ],
    integrations:[{id:'cross-platform-test',requires:['walk'],minTargets:2,baseLines:50,requirementsAdd:{systems:2}}],
    affinities:[{genreId:'walk',featureId:'menu',relation:'supports',note:'The menu exposes available actions.'}]
  };
}
const simplePlan=()=>({genreId:'walk',presentationId:'pixel',audioId:'chip',inputId:'keyboard',engineId:'custom',targets:['linux'],features:[],quantities:{},assetSources:{}});
const example=id=>{const value=PLANNING_EXAMPLES.find(example=>example.id===id);assert.ok(value,id);return copy(value.plan);};
function reconcile(snapshot){
  near(snapshot.features.reduce((sum,row)=>sum+row.codeLines,0)+snapshot.integrations.reduce((sum,row)=>sum+row.codeLines,0),snapshot.totals.codeLines);
  assert.equal(snapshot.totals.codeCharacters,snapshot.totals.codeLines*40);
  near(snapshot.assets.reduce((sum,row)=>sum+row.selfWork,0),snapshot.totals.assetWork);
  near(snapshot.assets.reduce((sum,row)=>sum+row.cost,0)+snapshot.costs.filter(row=>row.kind==='upfront').reduce((sum,row)=>sum+row.amount,0),snapshot.totals.upfrontCost);
  near(snapshot.costs.filter(row=>row.kind==='recurring').reduce((sum,row)=>sum+row.amount,0),snapshot.totals.recurringCostPerDay);
  assert.equal(new Set(ids(snapshot.features)).size,snapshot.features.length);
  assert.equal(new Set(ids(snapshot.integrations)).size,snapshot.integrations.length);
  for(const n of Object.values(snapshot.totals))assert.ok(Number.isFinite(n)&&n>=0);
  for(const n of Object.values(snapshot.requirements))assert.ok(Number.isFinite(n)&&n>=0);
  for(const row of snapshot.costs)assert.ok(row.payee && ['project','day'].includes(row.per));
  for(const row of snapshot.assets)if(row.cost>0)assert.ok(row.payee);
}

test('the six main example estimates have stable, printable code, asset-work and payment totals',()=>{
  const expected=[
    ['small-puzzle',535,21400,8,0,0],
    ['pixel-roguelite',3611,144440,278,0,0],
    ['visual-novel',1525,61000,606,0,0],
    ['city-3d',27501,1100040,264,0,0],
    ['mmorpg',77043,3081720,1448,0,4650],
    ['full-dive-vrmmo',784543,31381720,1448,15000000,65160]
  ];
  const actual=expected.map(([id])=>{
    const estimate=estimatePlan(example(id));reconcile(estimate);
    return[id,estimate.totals.codeLines,estimate.totals.codeCharacters,estimate.totals.assetWork,estimate.totals.upfrontCost,estimate.totals.recurringCostPerDay];
  });
  assert.deepEqual(actual,expected);assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
});

test('every listed genre works with each engine on Linux without hidden genre or rendering multipliers',()=>{
  const before=JSON.stringify(PLANNING_CATALOG),plans=JSON.stringify(PLANNING_EXAMPLES);
  for(const genre of PLANNING_CATALOG.genres)for(const engine of PLANNING_CATALOG.engines){
    const plan={genreId:genre.id,engineId:engine.id,presentationId:'pixel-2d',audioId:'chiptune',inputId:'keyboard-mouse',targets:['linux']};
    const estimate=estimatePlan(plan);reconcile(estimate);
    assert.deepEqual(estimate.plan.targets,['linux']);assert.ok(estimate.features.some(row=>row.id==='pixel-art'));
    assert.ok(estimate.features.some(row=>row.id==='chiptune'));
  }
  assert.equal(JSON.stringify(PLANNING_CATALOG),before);assert.equal(JSON.stringify(PLANNING_EXAMPLES),plans);
});

test('shared dependencies count once even when required by a genre, explicit features and two target adapters',()=>{
  const catalog=simpleCatalog(),plan=simplePlan();plan.genreId='menus';plan.targets=['linux','windows'];plan.features=[{id:'menu',quantity:8},{id:'runtime'}];
  const result=estimatePlan(plan,catalog);reconcile(result);
  assert.equal(result.features.find(row=>row.id==='runtime').quantity,1);
  assert.equal(result.features.filter(row=>row.id==='runtime').length,1);
  assert.equal(result.features.find(row=>row.id==='menu').quantity,8);
  assert.equal(result.totals.codeLines,1000+2000+570+200+100+50);
  assert.equal(result.requirements.systems,5);
});

test('engine-provided foundations replace custom foundations while preserving game logic and a single license charge',()=>{
  const catalog=simpleCatalog(),plan=simplePlan(),custom=estimatePlan(plan,catalog),sdk=estimatePlan({...plan,engineId:'sdk',targets:['windows','linux']},catalog);
  assert.equal(custom.totals.codeLines,3000);assert.equal(custom.totals.upfrontCost,0);
  assert.equal(sdk.totals.codeLines,2100+200+100+50);assert.equal(sdk.totals.upfrontCost,500);
  assert.ok(ids(custom.features).includes('runtime'));assert.ok(!ids(sdk.features).includes('runtime'));
  assert.equal(sdk.features.filter(row=>row.id==='sdk-runtime').length,1);assert.equal(sdk.features.find(row=>row.id==='walk').codeLines,2000);
  assert.equal(sdk.costs.filter(row=>row.id==='engine-license').length,1);
  const actualCustom=estimatePlan(example('small-puzzle-custom')),commercial=estimatePlan(example('small-puzzle-commercial'));
  assert.ok(actualCustom.totals.codeLines>commercial.totals.codeLines);assert.equal(actualCustom.totals.upfrontCost,0);assert.equal(commercial.totals.upfrontCost,24000);
  assert.equal(actualCustom.totals.assetWork,commercial.totals.assetWork);
});

test('Linux-only custom-engine pixel art and chiptune is legal and retains real asset production work',()=>{
  const plan=example('pixel-roguelite');plan.engineId='custom';const result=estimatePlan(plan);
  assert.deepEqual(result.plan.targets,['linux']);assert.equal(result.plan.presentationId,'pixel-2d');assert.equal(result.plan.audioId,'chiptune');
  assert.ok(result.totals.assetWork>0);assert.equal(result.totals.upfrontCost,0);assert.ok(ids(result.features).includes('custom-audio'));
  assert.ok(ids(result.features).includes('custom-render2d'));assert.ok(!ids(result.features).some(id=>id.startsWith('sdk-') || id.startsWith('engine-')));
});

test('adding Windows to Linux adds only its adapter and shared regression work, while duplicate OS selections count once',()=>{
  const linux=example('small-puzzle'),single=estimatePlan(linux),both=estimatePlan({...linux,targets:['windows','linux','windows','linux']});
  assert.deepEqual(both.plan.targets,['linux','windows']);assert.equal(both.totals.codeLines-single.totals.codeLines,90);
  assert.deepEqual(both.features.filter(row=>!single.features.some(old=>old.id===row.id)).map(row=>[row.id,row.codeLines]),[['target-windows',30]]);
  assert.deepEqual(both.integrations.map(row=>[row.id,row.codeLines]),[['cross-desktop',60]]);
  assert.equal(both.totals.assetWork,single.totals.assetWork);assert.equal(both.totals.upfrontCost,single.totals.upfrontCost);
  assert.deepEqual(estimatePlan({...linux,targets:['linux','linux']}),single);
  const delta=amendPlan(single,{addTargets:['windows','linux','windows']});assert.equal(delta.delta.codeLines,90);
  assert.equal(amendPlan(delta.snapshot,{addTargets:['windows']}).delta.codeLines,0);
});

test('a reckless full-dive VRMMO can be estimated without a player level gate and exposes its substantial technical and operating burden',()=>{
  const small=estimatePlan(example('small-puzzle')),mmo=estimatePlan(example('mmorpg')),dive=estimatePlan(example('full-dive-vrmmo'));
  assert.ok(dive.totals.codeLines>mmo.totals.codeLines*5);assert.ok(dive.totals.upfrontCost>1000000);
  assert.ok(dive.totals.recurringCostPerDay>mmo.totals.recurringCostPerDay);assert.ok(dive.requirements.systems>small.requirements.systems*100);
  assert.ok(dive.costs.some(row=>row.kind==='recurring' && row.payee));
  for(const key of ['quality','sales','playTime','experience','reward'])assert.equal(Object.hasOwn(dive,key),false,key);
});

test('self-made assets have zero cash cost but nonzero work, and licensing or commissioning changes the payee and cost',()=>{
  const catalog=simpleCatalog(),plan={...simplePlan(),features:[{id:'portraits',quantity:3}]};
  const self=estimatePlan(plan,catalog),licensed=estimatePlan({...plan,assetSources:{portrait:'license'}},catalog),commissioned=estimatePlan({...plan,assetSources:{portrait:'commission'}},catalog);
  assert.equal(self.totals.assetWork,9);assert.equal(self.totals.upfrontCost,0);
  assert.equal(licensed.totals.assetWork,0);assert.equal(licensed.totals.upfrontCost,30);assert.equal(licensed.assets[0].payee,'asset shop');
  assert.equal(commissioned.totals.upfrontCost,150);assert.equal(commissioned.assets[0].payee,'artist');
  assert.equal(self.totals.codeLines,licensed.totals.codeLines);assert.equal(licensed.totals.codeLines,commissioned.totals.codeLines);
});

test('more asset content does not automatically duplicate game code or add quality and play-time rewards',()=>{
  const catalog=simpleCatalog(),few=estimatePlan({...simplePlan(),features:[{id:'portraits',quantity:1}]},catalog),many=estimatePlan({...simplePlan(),features:[{id:'portraits',quantity:100}]},catalog);
  assert.equal(few.totals.codeLines,3000);assert.equal(many.totals.codeLines,3000);assert.equal(many.totals.assetWork,300);
  for(const result of [few,many])for(const key of ['quality','playTime','sales','reward'])assert.equal(Object.hasOwn(result,key),false);
});

test('expanding a 3000-line snapshot to 5000 charges only the new 2000-line feature and leaves all inputs intact',()=>{
  const catalog=frozen(simpleCatalog()),plan=frozen(simplePlan()),beforePlan=JSON.stringify(plan),snapshot=estimatePlan(plan,catalog),before=JSON.stringify(snapshot),changes=frozen({addFeatures:[{id:'inventory'}]});
  const amended=amendPlan(snapshot,changes,catalog);
  assert.equal(snapshot.totals.codeLines,3000);assert.equal(amended.snapshot.totals.codeLines,5000);assert.equal(amended.delta.codeLines,2000);assert.equal(amended.delta.codeCharacters,80000);
  assert.deepEqual(amended.addedFeatures,['inventory']);assert.deepEqual(amended.changedFeatures,[]);
  assert.equal(amended.snapshot.features.filter(row=>row.id==='runtime').length,1);
  assert.equal(JSON.stringify(snapshot),before);assert.equal(JSON.stringify(plan),beforePlan);assert.deepEqual(changes,{addFeatures:[{id:'inventory'}]});
  assert.throws(()=>{snapshot.totals.codeLines=0;},TypeError);
  const again=amendPlan(amended.snapshot,changes,catalog);assert.equal(again.delta.codeLines,0);assert.deepEqual(again.addedFeatures,[]);
});

test('an added feature also charges newly necessary integrations once and shows a matching delta breakdown',()=>{
  const catalog=simpleCatalog();catalog.integrations.push({id:'walk-inventory',requires:['walk','inventory'],baseLines:75});
  const snapshot=estimatePlan(simplePlan(),catalog),result=amendPlan(snapshot,{addFeatures:[{id:'inventory'}]},catalog);
  assert.equal(snapshot.totals.codeLines,3000);assert.equal(result.snapshot.totals.codeLines,5075);assert.equal(result.delta.codeLines,2075);
  assert.deepEqual(result.delta.integrations.map(row=>[row.id,row.codeLines]),[['walk-inventory',75]]);
  assert.equal(result.delta.features.reduce((sum,row)=>sum+row.codeLines,0)+result.delta.integrations.reduce((sum,row)=>sum+row.codeLines,0),result.delta.codeLines);
  assert.equal(amendPlan(result.snapshot,{addFeatures:[{id:'inventory'}]},catalog).delta.codeLines,0);
});

test('asset expansion delta rows contain additional quantities, cash and self-work rather than the new project totals',()=>{
  for(const source of ['self','license','commission']){
    const catalog=simpleCatalog(),plan={...simplePlan(),features:[{id:'portraits',quantity:1}],assetSources:{portrait:source}},old=estimatePlan(plan,catalog);
    const result=amendPlan(old,{addFeatures:[{id:'portraits',quantity:3}]},catalog),asset=result.delta.assets[0];
    assert.equal(asset.quantity,2);assert.equal(asset.cost,source==='self'?0:source==='license'?20:100);assert.equal(asset.selfWork,source==='self'?6:0);
    assert.equal(result.delta.upfrontCost,asset.cost);assert.equal(result.delta.assetWork,asset.selfWork);assert.equal(result.delta.codeLines,0);
    assert.equal(result.snapshot.assets[0].quantity,3);assert.equal(old.assets[0].quantity,1);
  }
});

test('capacity expansion from 3000 to 5000 players changes only declared operating capacity and preserves the earlier estimate',()=>{
  const catalog=simpleCatalog(),plan={...simplePlan(),features:[{id:'server'}],quantities:{concurrentPlayers:3000}},old=estimatePlan(plan,catalog),before=JSON.stringify(old);
  const result=amendPlan(old,{quantities:{concurrentPlayers:5000}},catalog);
  assert.equal(old.totals.recurringCostPerDay,1550);assert.equal(result.snapshot.totals.recurringCostPerDay,2550);assert.equal(result.delta.recurringCostPerDay,1000);
  assert.equal(result.delta.codeLines,0);assert.equal(result.delta.assetWork,0);assert.equal(result.delta.upfrontCost,0);
  assert.equal(result.delta.costs[0].amount,1000);assert.equal(result.snapshot.plan.quantities.concurrentPlayers,5000);assert.equal(JSON.stringify(old),before);
});

test('amendments cannot shrink quantities, swap genre or engine, remove targets, change existing asset sourcing or create refunds',()=>{
  const catalog=simpleCatalog(),old=estimatePlan({...simplePlan(),features:[{id:'portraits',quantity:3},{id:'server'}],quantities:{concurrentPlayers:3000}},catalog);
  error(()=>amendPlan(old,{addFeatures:[{id:'portraits',quantity:2}]},catalog),'SCOPE_REDUCTION');
  error(()=>amendPlan(old,{quantities:{concurrentPlayers:2999}},catalog),'SCOPE_REDUCTION');
  for(const changes of [{genreId:'menus'},{engineId:'sdk'},{removeFeatures:['server']},{targets:['windows']},{assetSources:{portrait:'license'}}])error(()=>amendPlan(old,changes,catalog),'UNSUPPORTED_AMENDMENT');
  assert.equal(old.plan.features.find(feature=>feature.id==='portraits').quantity,3);assert.equal(old.totals.assetWork,9);
});

test('catalog version or coefficient changes cannot silently reprice a saved estimate',()=>{
  const catalog=simpleCatalog(),old=estimatePlan(simplePlan(),catalog),saved=JSON.stringify(old),changed=copy(catalog);changed.version='fixture-2';changed.features[0].baseLines=9000;
  error(()=>amendPlan(old,{addFeatures:[{id:'inventory'}]},changed),'CATALOG_VERSION_MISMATCH');
  changed.version=catalog.version;error(()=>amendPlan(old,{},changed),'CATALOG_VERSION_MISMATCH');
  assert.equal(JSON.stringify(old),saved);assert.equal(old.totals.codeLines,3000);
  assert.equal(estimatePlan(simplePlan(),changed).totals.codeLines,11000);
  const portable=JSON.parse(saved);assert.equal(amendPlan(portable,{addFeatures:[{id:'inventory'}]},catalog).snapshot.totals.codeLines,5000);
});

test('requirements combine the strongest baseline and all integration additions independent of feature identifiers',()=>{
  for(const early of [true,false]){
    const catalog=simpleCatalog();catalog.features.push({id:early?'aaa-bonus':'zzz-bonus',baseLines:0,requirementsAdd:{syntax:2}});
    const result=estimatePlan({...simplePlan(),features:[{id:early?'aaa-bonus':'zzz-bonus'}]},catalog);
    assert.equal(result.requirements.syntax,12);
  }
});

test('known and unknown compatibility remain explanatory facts rather than automatic quality points',()=>{
  const result=estimatePlan({...simplePlan(),features:[{id:'menu'},{id:'inventory'}]},simpleCatalog());
  assert.equal(result.compatibility.known.find(row=>row.featureId==='menu').relation,'supports');
  assert.ok(result.compatibility.unknown.some(row=>row.featureId==='inventory' && row.status==='unknown'));
  assert.equal(Object.hasOwn(result.compatibility,'score'),false);assert.equal(Object.hasOwn(result,'quality'),false);
});

test('missing optional engine capabilities do not invalidate unrelated features or integration conditions',()=>{
  const catalog=simpleCatalog();catalog.features.push({id:'vr',baseLines:100000,requires:['capability:vr']});
  catalog.integrations.push({id:'vr-only',requires:['capability:vr'],baseLines:1000},{id:'any-input',requires:['walk'],anyOf:['capability:vr','walk'],baseLines:25});
  const result=estimatePlan(simplePlan(),catalog);assert.equal(result.totals.codeLines,3025);assert.ok(!ids(result.integrations).includes('vr-only'));
  error(()=>estimatePlan({...simplePlan(),features:[{id:'vr'}]},catalog),'UNSUPPORTED_CAPABILITY');
});

test('cycles, dangling dependencies, explicit duplicate features and unknown selection identifiers fail clearly',()=>{
  const cycle=simpleCatalog();cycle.features.push({id:'cycle-a',requires:['cycle-b']},{id:'cycle-b',requires:['cycle-a']});
  error(()=>estimatePlan({...simplePlan(),features:[{id:'cycle-a'}]},cycle),'DEPENDENCY_CYCLE');
  const missing=simpleCatalog();missing.features.find(feature=>feature.id==='walk').requires.push('missing-node');error(()=>estimatePlan(simplePlan(),missing),'UNKNOWN_ID');
  error(()=>estimatePlan({...simplePlan(),features:[{id:'menu'},{id:'menu'}]},simpleCatalog()),'DUPLICATE_ID');
  for(const field of ['genreId','presentationId','audioId','inputId','engineId'])error(()=>estimatePlan({...simplePlan(),[field]:'unknown'},simpleCatalog()),'UNKNOWN_ID');
  error(()=>estimatePlan({...simplePlan(),targets:['unknown']},simpleCatalog()),'UNKNOWN_ID');
  error(()=>estimatePlan({...simplePlan(),features:[{id:'unknown'}]},simpleCatalog()),'UNKNOWN_ID');
  error(()=>estimatePlan({...simplePlan(),assetSources:{unused:'license'}},simpleCatalog()),'UNKNOWN_ID');
});

test('negative, fractional, nonnumeric, unsafe and nonfinite quantities are rejected without mutating the request',()=>{
  for(const quantity of [-1,0,.5,NaN,Infinity,-Infinity,'2',10001,Number.MAX_SAFE_INTEGER+1,1e100]){
    const plan={...simplePlan(),features:[{id:'portraits',quantity}]};error(()=>estimatePlan(plan,simpleCatalog()),'INVALID_QUANTITY');
    assert.equal(plan.features[0].quantity,quantity);
  }
  for(const concurrentPlayers of [-1,.5,NaN,Infinity,'3000',Number.MAX_SAFE_INTEGER+1])error(()=>estimatePlan({...simplePlan(),features:[{id:'server'}],quantities:{concurrentPlayers}},simpleCatalog()),'INVALID_QUANTITY');
  error(()=>estimatePlan({...simplePlan(),features:[{id:'server'}]},simpleCatalog()),'MISSING_QUANTITY');
});

test('a malformed catalog or unsupported source produces a planning error rather than NaN totals or a native exception',()=>{
  const bad=simpleCatalog();bad.features[0].baseLines=Infinity;error(()=>estimatePlan(simplePlan(),bad),'INVALID_QUANTITY');
  error(()=>estimatePlan({...simplePlan(),features:[{id:'portraits'}],assetSources:{portrait:'stolen'}},simpleCatalog()),'INVALID_SOURCE');
  const conflict=simpleCatalog();conflict.features.push({id:'solo',baseLines:0,conflicts:['server']});
  error(()=>estimatePlan({...simplePlan(),features:[{id:'server'},{id:'solo'}],quantities:{concurrentPlayers:1}},conflict),'CONFLICT');
});

test('saved totals and detailed rows cannot be edited to erase previously estimated work or costs',()=>{
  const catalog=simpleCatalog(),original=estimatePlan({...simplePlan(),features:[{id:'portraits'},{id:'server'}],quantities:{concurrentPlayers:3000}},catalog);
  const mutations=[
    snapshot=>{snapshot.totals.codeLines--;},
    snapshot=>{snapshot.requirements.syntax++;},
    snapshot=>{snapshot.features[0].codeLines++;},
    snapshot=>{snapshot.integrations.push({id:'fake',codeLines:0});},
    snapshot=>{snapshot.assets[0].quantity++;},
    snapshot=>{snapshot.costs[0].amount++;}
  ];
  for(const mutate of mutations){const changed=JSON.parse(JSON.stringify(original));mutate(changed);error(()=>amendPlan(changed,{addFeatures:[{id:'inventory'}]},catalog),'INVALID_SNAPSHOT');}
  assert.equal(original.totals.codeLines,3800);assert.equal(original.totals.recurringCostPerDay,1550);
});

test('silent audio rejects an audio-dependent game through its selected capability rather than a special genre-name check',()=>{
  for(const engineId of ['toolkit','commercial','custom']){
    const rhythm={...example('small-puzzle'),genreId:'rhythm',engineId,features:[],audioId:'silent'};
    error(()=>estimatePlan(rhythm),'CONFLICT');
    assert.ok(estimatePlan({...rhythm,audioId:'chiptune'}).features.some(row=>row.id==='rhythm-judgement'));
    error(()=>estimatePlan({...example('small-puzzle'),engineId,features:[{id:'rhythm-judgement'}]}),'CONFLICT');
    assert.equal(estimatePlan({...example('small-puzzle'),engineId}).plan.audioId,'silent');
  }
});

test('browser plus Linux performs browser/native integration once and adding Windows shares that integration',()=>{
  const linux=estimatePlan(example('small-puzzle')),browser=estimatePlan({...example('small-puzzle'),targets:['linux','browser']}),windows=amendPlan(browser,{addTargets:['windows']});
  assert.equal(browser.totals.codeLines-linux.totals.codeLines,120,'browser adapter 20 plus native/browser testing 100');
  assert.equal(browser.integrations.filter(row=>row.id==='cross-browser-native').length,1);
  assert.equal(windows.snapshot.integrations.filter(row=>row.id==='cross-browser-native').length,1);
  assert.equal(windows.delta.codeLines,90,'adding Windows reuses browser/native checks and adds its 30-line adapter and 60-line desktop checks');
});

test('silent audio forbids an explicitly added audio provider even when it differs from the chosen engine default',()=>{
  for(const engineId of ['toolkit','commercial','custom'])for(const provider of ['sdk-audio','engine-audio','custom-audio']){
    const plan={...example('small-puzzle'),engineId,features:[{id:provider}]};
    error(()=>estimatePlan(plan),'CONFLICT');
    const snapshot=estimatePlan({...example('small-puzzle'),engineId});
    error(()=>amendPlan(snapshot,{addFeatures:[{id:provider}]}),'CONFLICT');
  }
});

test('Linux and macOS include their desktop-pair regression work even when Windows is not targeted',()=>{
  const linux=estimatePlan(example('small-puzzle')),both=estimatePlan({...example('small-puzzle'),targets:['linux','macos']});
  const pair=PLANNING_CATALOG.integrations.find(row=>row.requires?.includes('target-linux') && row.requires?.includes('target-macos'));
  assert.ok(pair,'the catalog must explicitly account for the Linux/macOS pair');
  assert.ok(both.integrations.some(row=>row.id===pair.id));
  assert.equal(both.totals.codeLines-linux.totals.codeLines,45+(pair.baseLines ?? pair.lines));
  assert.equal(both.totals.upfrontCost-linux.totals.upfrontCost,10000);assert.equal(both.totals.assetWork,linux.totals.assetWork);
});

test('increasing a genre-required feature adds only its unit increment and does not rebuild its shared implementation',()=>{
  const catalog=simpleCatalog(),old=estimatePlan({...simplePlan(),genreId:'menus'},catalog),result=amendPlan(old,{addFeatures:[{id:'menu',quantity:8}]},catalog);
  assert.equal(old.features.find(row=>row.id==='menu').quantity,5);assert.equal(old.totals.codeLines,3540);
  assert.equal(result.snapshot.totals.codeLines,3570);assert.equal(result.delta.codeLines,30);
  assert.deepEqual(result.addedFeatures,[]);assert.deepEqual(result.changedFeatures,['menu']);
  assert.equal(result.snapshot.features.filter(row=>row.id==='runtime').length,1);
});

test('an offline full-dive game needs only its sensory gateway capacity and does not silently become a multiplayer service',()=>{
  const plan={...example('small-puzzle'),inputId:'full-dive'},snapshot=estimatePlan(plan);
  for(const id of ['network-authority','accounts','persistent-world','live-operations','sharding'])assert.ok(!ids(snapshot.features).includes(id),id);
  const recurring=snapshot.costs.filter(row=>row.kind==='recurring');assert.equal(recurring.length,1);
  assert.equal(recurring[0].id,'sensory-gateway');assert.equal(recurring[0].driver,'sensorySessions');assert.equal(recurring[0].driverQuantity,1);
  assert.equal(snapshot.totals.recurringCostPerDay,10050);assert.deepEqual(snapshot.plan.quantities,{});
  const expanded=amendPlan(snapshot,{quantities:{sensorySessions:3}});
  assert.equal(expanded.snapshot.totals.recurringCostPerDay,10150);assert.equal(expanded.delta.recurringCostPerDay,100);assert.equal(expanded.delta.codeLines,0);
  assert.equal(snapshot.totals.recurringCostPerDay,10050);assert.ok(!ids(expanded.snapshot.costs).includes('game-servers'));
});

test('a cost may declare default capacity but an explicit plan capacity, including zero, always takes precedence',()=>{
  const catalog=simpleCatalog();catalog.features.find(row=>row.id==='server').costs[0].defaultUnits=1000;
  const plan={...simplePlan(),features:[{id:'server'}]},fallback=estimatePlan(plan,catalog);
  assert.equal(fallback.totals.recurringCostPerDay,550);assert.equal(fallback.costs[0].driverQuantity,1000);
  const explicit=estimatePlan({...plan,quantities:{concurrentPlayers:3000}},catalog);
  assert.equal(explicit.totals.recurringCostPerDay,1550);assert.equal(explicit.costs[0].driverQuantity,3000);
  const zero=estimatePlan({...plan,quantities:{concurrentPlayers:0}},catalog);
  assert.equal(zero.totals.recurringCostPerDay,100);assert.equal(zero.costs[0].driverQuantity,0);
  for(const invalid of [-1,.5,NaN,Infinity,'1000',Number.MAX_SAFE_INTEGER+1]){
    const malformed=copy(catalog);malformed.features.find(row=>row.id==='server').costs[0].defaultUnits=invalid;
    error(()=>estimatePlan(plan,malformed),'INVALID_QUANTITY');
  }
});
