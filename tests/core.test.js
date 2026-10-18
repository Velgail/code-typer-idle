import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, projectAt, PROJECTS, SHOP, buy, input, tick, knowledgeRatio, validity, debtLimit, defectLimit, release, prestige, prestigeGain, applyOffline, serialize, deserialize, checkAchievements, handPower, royaltyRate, itemCost, OFFLINE_LIMIT, INITIAL_CASH, studyGain, studyMultiplier, unitRate, autoStudySubject, DAY, BALANCE_VERSION, operatingCost, serverCost, expenseLines, setPublicationActive, netIncome, STORE_FEE_RATE, STUDY_XP, learningGoal, needsBuild, runBuild } from '../src/core.js';
import { simulate, SCENARIOS } from '../scripts/simulate-balance.mjs';
import { acceptCharacter, currentPrompt, TYPING_REWARD } from '../src/typing.js';

function understand(s, ratio = 1) { for (const [k, v] of Object.entries(projectAt(s.projectIndex).req)) s.skills[k] = v * ratio; }

test('one million uncomprehended characters cannot complete a game', () => {
  const s = createState();
  input(s, { mode: 'dev', chars: 1e6 });
  assert.equal(s.progress, 0);
  assert.equal(s.mistakes, 1e6);
  assert.equal(release(s), null);
});
test('validity follows the 50% / 100% thresholds and the least understood subject', () => {
  const s = createState();
  s.projectIndex = 1;
  understand(s);
  s.skills.graphics *= .75;
  assert.equal(knowledgeRatio(s), .75);
  assert.equal(validity(s), .5);
  input(s, { mode: 'dev', chars: 100 });
  assert.equal(s.defects, 50.3);
  assert.equal(s.progress, 50);
  s.skills.graphics = 0;
  assert.equal(validity(s), 0);
});
test('abstraction caps at three without promising debt-free code', () => {
  const s = createState();
  understand(s, 50);
  input(s, { mode: 'dev', chars: 100 });
  assert.equal(s.progress, 300);
  assert.ok(s.debt > 0);
});
test('unreviewable automation creates defects and crashes instead of progressing', () => {
  const s = createState();
  s.items.assistant = 1;
  tick(s, 100);
  assert.equal(s.crashed, true);
  assert.equal(s.defects, defectLimit(s));
  assert.equal(s.debt, 0);
  assert.equal(s.progress, 0);
});
test('refactoring requires complete understanding and repairs a crashed build', () => {
  const s = createState();
  s.defects = defectLimit(s); s.crashed = true; s.refactor = true;
  input(s, { mode: 'dev', chars: 1e5 });
  assert.equal(s.crashed, true);
  understand(s);
  input(s, { mode: 'dev', chars: 160 });
  assert.equal(s.defects, 110);
  assert.equal(s.crashed, false);
  assert.equal(s.progress, 0);
});
test('a release requires a complete and sufficiently repaired project', () => {
  const s = createState(); understand(s);
  assert.equal(release(s), null);
  s.progress = projectAt(0).target; s.defects = defectLimit(s) * .11;
  assert.equal(release(s), null);
  s.defects = 0;
  const first = release(s);
  assert.equal(first.royalty, 0);
  assert.equal(first.payout, 0);
  assert.ok(s.skills.syntax > 12);
  assert.equal(s.projectIndex, 1);
  assert.equal(s.progress, 0);
  assert.equal(s.stats.releases, 1);
});
test('commercial releases earn persistent royalties only above the quality and understanding gates', () => {
  const s = createState(); s.projectIndex = 1; understand(s);
  s.progress = projectAt(1).target;
  const title = release(s);
  assert.ok(title.royalty > 0);
  const cash = s.cash; tick(s, 1);
  assert.ok(Math.abs(s.cash - cash - title.royalty * (1 - STORE_FEE_RATE)) < 1e-8);
  const low = createState(); low.projectIndex = 1; understand(low, .75); low.progress = projectAt(1).target;
  assert.equal(release(low).royalty, 0);
});
test('purchases respect money, gates and one-time equipment', () => {
  const s = createState();
  assert.equal(buy(s, 'book-syntax'), false);
  assert.equal(buy(s, 'macro'), false);
  s.cash = 1500;
  assert.equal(buy(s, 'macro'), true);
  assert.equal(s.cash, 1000);
  s.cash = 1e6;
  assert.equal(buy(s, 'assistant'), false);
  assert.equal(buy(s, 'kitchen'), false);
  s.projectIndex = 5;
  assert.equal(buy(s, 'kitchen'), true);
  assert.equal(buy(s, 'kitchen'), false);
  assert.equal(buy(s, 'not-an-item'), false);
});
test('solo work and free offline releases have no recurring charges', () => {
  const s = createState();
  tick(s, 8 * DAY);
  assert.equal(s.cash, INITIAL_CASH); assert.equal(operatingCost(s), 0);
  assert.deepEqual(expenseLines(s), []); assert.equal(s.stats.storeFees, 0);
  s.progress = projectAt(0).target; understand(s);
  release(s); tick(s, DAY);
  assert.equal(s.cash, INITIAL_CASH); assert.equal(s.dailyAccrued, 0);
});
test('bankruptcy from an unpaid server bill is recoverable after stopping publication', () => {
  const s = createState(); s.cash = 0;
  s.catalog = [{ name: 'online', index: 5, online: true, serverDaily: 3000, royalty: 0, active: true }];
  tick(s, DAY); assert.ok(Math.abs(s.cash + 3000) < 1e-7); assert.equal(handPower(s), .5);
  assert.equal(setPublicationActive(s, 5, false), true);
  input(s, { mode: 'work', chars: 3200 });
  assert.ok(s.cash > 0); assert.equal(handPower(s), 1);
  const cash = s.cash; tick(s, DAY); assert.equal(s.cash, cash);
});
test('automation runs independently of selected mode; OFF pauses development while the lab keeps studying', () => {
  const s = createState(); understand(s); s.mode = 'study'; s.items.macro = 1; s.items.library = 1; s.items.lab = 1; s.items['book-syntax'] = 1;
  tick(s, 2); assert.equal(s.ocrJob.progress, 20); assert.ok(s.progress > 0); assert.ok(s.skills.syntax > 12);
  s.autoEnabled = false;
  const progress = s.progress, knowledge = s.skills.syntax, work = s.ocrJob.progress;
  tick(s, 2); assert.equal(s.progress, progress); assert.ok(s.skills.syntax > knowledge); assert.ok(s.ocrJob.progress > work);
});
test('offline results match foreground simulation and cap at eight hours', () => {
  const now = 1e12, a = createState(now), b = createState(now);
  a.items.macro = 1; b.items.macro = 1;
  tick(a, 3600); applyOffline(b, now + 3600e3);
  assert.equal(a.cash, b.cash); assert.equal(a.day, b.day); assert.equal(a.stats.chars, b.stats.chars);
  const capped = createState(now);
  assert.equal(applyOffline(capped, now + 9 * 3600e3).seconds, OFFLINE_LIMIT);
  assert.equal(capped.stats.time, OFFLINE_LIMIT);
  assert.equal(applyOffline(capped, now).seconds, 0);
});
test('prestige preserves achievements and cumulative statistics, resets run progress', () => {
  const s = createState();
  assert.equal(prestige(s), null);
  s.runBest = 3; s.projectIndex = 3; s.stats.releases = 3; s.stats.valid = 221000; s.skills.syntax = 200;
  s.items.keyboard = 4; s.achievements = ['first-release'];
  const gain = prestigeGain(s), fresh = prestige(s);
  assert.ok(gain > 0); assert.equal(fresh.assets, gain); assert.ok(handPower(fresh) > 1);
  assert.equal(fresh.projectIndex, 0); assert.equal(fresh.skills.syntax, 0); assert.deepEqual(fresh.items, {});
  assert.deepEqual(fresh.achievements, s.achievements); assert.equal(fresh.stats.releases, 3);
  assert.equal(prestigeGain(fresh), 0);
});
test('post-AAA and procedural generations keep getting larger without NaN or Infinity', () => {
  assert.ok(projectAt(5).target > projectAt(4).target);
  for (let i = PROJECTS.length; i < 45; i++) {
    const p = projectAt(i), next = projectAt(i + 1);
    assert.ok(next.target > p.target);
    assert.ok(Number.isFinite(p.target)); assert.ok(Number.isFinite(p.royalty));
  }
  const huge = createState(); huge.projectIndex = 10000; huge.items.keyboard = 800; huge.items.macro = 800;
  tick(huge, 10); input(huge);
  for (const value of [huge.cash, huge.stats.chars, handPower(huge), royaltyRate(huge)]) assert.ok(Number.isFinite(value));
  for (const i of SHOP) assert.ok(Number.isFinite(itemCost(huge, i)));
});
test('save roundtrips preserve the economy and guard invalid imported values', () => {
  const s = createState(); s.items.macro = 1; s.skills.design = 77; s.mode = 'study';
  const loaded = deserialize(serialize(s));
  assert.equal(loaded.skills.design, 77); assert.equal(loaded.items.macro, 1); assert.equal(loaded.mode, 'study');
  const malformed = deserialize(JSON.stringify({ ...s, cash: 'Infinity', skills: { syntax: -9 }, items: { keyboard: 1e6 }, projectIndex: -1, dayElapsed: 1e9 }));
  assert.equal(malformed.cash, INITIAL_CASH); assert.equal(malformed.skills.syntax, 0); assert.equal(malformed.items.keyboard, 0); assert.equal(malformed.projectIndex, 0);
  assert.throws(() => deserialize('{'));
  assert.throws(() => deserialize('{"version":999}'));
  assert.throws(() => deserialize(JSON.stringify({ ...s, balanceVersion: BALANCE_VERSION + 1 })), /更新/);
  assert.throws(() => deserialize('x'.repeat(500001)));
});
test('all authored projects and ten endless generations can actually be released', () => {
  const s = createState();
  for (let i = 0; i < 17; i++) {
    understand(s);
    const p = projectAt(i);
    input(s, { mode: 'dev', chars: p.target });
    assert.equal(s.progress, p.target);
    assert.ok(release(s)); assert.equal(s.projectIndex, i + 1);
  }
  assert.ok(prestigeGain(s) > 1e7);
  assert.ok(checkAchievements(s).some(a => a.id === 'universe'));
});

test('a fresh player can fund books and finish the first game without injected resources', () => {
  const result = simulate(SCENARIOS[0], { horizon: 3600, stopAfter: 1 });
  assert.equal(result.reached, 1);
  assert.ok(result.milestones[0].seconds >= 15 * 60 && result.milestones[0].seconds <= 25 * 60);
  assert.ok(result.purchases.macro <= 60, 'the first automation must be reachable within one minute at eight clicks per second');
  assert.ok(result.purchases['book-syntax'] > result.purchases.macro && result.purchases['book-syntax'] <= 3 * 60);
});

test('the first OCR takes four delivered jobs and is a single purchase rather than an investment ladder', () => {
  const s=createState(),macro=SHOP.find(i=>i.id==='macro');
  input(s,{chars:399});
  assert.equal(s.cash,400);assert.equal(buy(s,'macro'),false);
  input(s,{chars:1});
  assert.equal(s.cash,500);assert.equal(buy(s,'macro'),true);assert.equal(s.cash,0);
  assert.equal(macro.max,1);assert.equal(itemCost(s,macro),500);
  tick(s,170);assert.equal(s.cash,1580);assert.equal(s.ocr.pending,1);assert.equal(s.ocr.fees,20);
  assert.equal(buy(s,'book-syntax'),true);assert.equal(s.cash,80);
  assert.equal(s.skills.syntax,0,'automating office work must not grant programming knowledge');
  s.cash=3750;assert.equal(buy(s,'macro'),false);assert.equal(s.cash,3750);assert.equal(s.items.macro,1);
});

test('learning goals retain the chosen subject and show progress while another requirement is still zero', () => {
  const s=createState();s.projectIndex=1;s.mode='study';s.subject='design';s.skills.syntax=12.6;s.items['book-design']=1;
  const initial=learningGoal(s);
  assert.equal(initial.next.id,'design');
  input(s,{chars:1});
  const started=learningGoal(s);
  assert.equal(started.next.id,'design');assert.ok(started.progress>initial.progress);
  assert.equal(knowledgeRatio(s),0,'the display must not loosen the actual development requirements');
  s.skills.design=projectAt(1).req.design;
  assert.equal(learningGoal(s).completed,1);assert.equal(learningGoal(s).next.id,'graphics');
  Object.assign(s.skills,projectAt(1).req);
  assert.equal(learningGoal(s).next,null);assert.equal(learningGoal(s).progress,1);
  s.skills.syntax*=3;assert.equal(learningGoal(s).progress,1,'overlearning one subject cannot fill missing subjects');
  s.skills.graphics=0;assert.ok(learningGoal(s).progress<1);
});

test('the reduced second project preserves old saves without doubling their defect or debt ratios', () => {
  const old=createState();
  Object.assign(old,{balanceVersion:10,projectIndex:1,progress:12000,debt:3000,defects:400,cash:4321});
  Object.assign(old.skills,{syntax:50,design:20,graphics:20});old.items.macro=2;
  old.debtSources.temporary=2000;old.debtSources.coupling=1000;
  const report={status:'warnings',trigger:'automatic',revision:5,progress:12000,defects:400,time:0,checks:6};
  old.build={revision:5,checkedRevision:5,changed:0,checkedProgress:12000,knownDefects:400,count:6,last:report,history:[report]};
  const loaded=deserialize(serialize(old));
  assert.equal(loaded.progress,projectAt(1).target);
  assert.equal(loaded.debt,1500);assert.equal(loaded.defects,200);
  assert.equal(loaded.debt/defectLimit(loaded),old.debt/(18000*.25));
  assert.deepEqual(loaded.skills,old.skills);assert.equal(loaded.cash,8071);assert.equal(loaded.items.macro,1);
  assert.equal(loaded.debtSources.temporary,1000);assert.equal(loaded.debtSources.coupling,500);
  assert.equal(Object.values(loaded.debtSources).reduce((sum,n)=>sum+n,0),1500);
  assert.equal(loaded.build.knownDefects,200);assert.equal(loaded.build.count,6);
  assert.equal(loaded.build.last.progress,9000);assert.equal(loaded.build.history[0].defects,200);
  assert.equal(needsBuild(loaded),true,'the new scope must not reuse a stale build certification');
  assert.equal(runBuild(loaded).status,'warnings');
  const again=deserialize(serialize(loaded));
  assert.equal(again.debt,loaded.debt);assert.equal(again.defects,loaded.defects);
  assert.deepEqual(again.debtSources,loaded.debtSources);assert.equal(needsBuild(again),false);
  assert.ok(release(again),'a previously acceptable defect ratio must still allow publication');
  old.projectIndex=2;old.progress=12000;
  const later=deserialize(serialize(old));
  assert.equal(later.progress,12000);assert.equal(later.debt,3000);assert.equal(later.defects,400);
});

test('syntax foundations take sustained work before the later learning curve slows', () => {
  const s = createState(); s.items['book-syntax'] = 1;
  assert.equal(studyMultiplier(s), 2);
  input(s, { mode: 'study', chars: 19 });
  assert.ok(s.skills.syntax < 1);
  input(s, { mode: 'study', chars: 5000 });
  assert.ok(s.skills.syntax < 12);
  input(s, { mode: 'study', chars: 100 });
  assert.ok(s.skills.syntax >= 12);
  const early = studyGain(s, 10); s.skills.syntax = 100;
  assert.ok(studyGain(s, 10) < early);
});
test('syntax 0 to 12 progresses evenly and costs 75% of the previous cumulative XP', () => {
  const s = createState(); s.items['book-syntax'] = 1;
  const xpPerUnit = STUDY_XP * studyMultiplier(s);
  const previousCost = 12 ** 1.5, targetUnits = previousCost * .75 / xpPerUnit;
  const gains = [0, 1, 5, 10].map(value => { s.skills.syntax = value; return studyGain(s, 100); });
  for (const gain of gains) assert.ok(Math.abs(gain - gains[0]) < 1e-14);
  s.skills.syntax = 0;
  input(s, { mode: 'study', chars: targetUnits });
  assert.ok(Math.abs(s.skills.syntax - 12) < 1e-12);
  input(s, { mode: 'study', chars: 100 });
  const expected = (previousCost + 100 * xpPerUnit) ** (2 / 3);
  assert.ok(Math.abs(s.skills.syntax - expected) < 1e-12);
});
test('foundation boundary crossing is consistent for batches, split inputs and near-boundary values', () => {
  const make = value => { const s = createState(); s.items['book-syntax'] = 1; s.skills.syntax = value; return s; };
  for (const start of [0, 11, 12 - Number.EPSILON * 8, 12, 12 + Number.EPSILON * 8]) {
    const batch = make(start), split = make(start);
    input(batch, { mode: 'study', chars: 6000 });
    for (let index = 0; index < 1000; index++) input(split, { mode: 'study', chars: 6 });
    assert.ok(Math.abs(batch.skills.syntax - split.skills.syntax) < 1e-10);
    const tiny = studyGain(make(start), 1e-300);
    assert.ok(Number.isFinite(tiny) && tiny > 0);
  }
});
test('later syntax and the other subjects retain their previous XP increments and numeric range', () => {
  const s = createState();
  for (const subject of ['syntax', 'design', 'graphics', 'systems']) {
    s.items[`book-${subject}`] = 1;
    for (const before of subject === 'syntax' ? [12, 50, 100] : [0, 1, 12, 100]) {
      s.skills[subject] = before;
      const xp = 500 * STUDY_XP * studyMultiplier(s, subject);
      const expected = (before ** 1.5 + xp) ** (2 / 3) - before;
      assert.ok(Math.abs(studyGain(s, 500, subject) - expected) < 1e-12);
    }
    s.skills[subject] = 1e150;
    const tinyGain = studyGain(s, 1, subject), hugeGain = studyGain(s, 1e250, subject);
    assert.ok(tinyGain > 0 && Number.isFinite(tinyGain));
    assert.ok(hugeGain > tinyGain && Number.isFinite(hugeGain));
    s.skills[subject] = 1e250;
    assert.ok(Number.isFinite(studyGain(s, 1e250, subject)));
    assert.equal(studyGain(s, 0, subject), 0);
  }
  const locked = createState();
  assert.equal(studyGain(locked, 1e250, 'syntax'), 0);
  input(locked, { mode: 'study', chars: 1e250 });
  assert.equal(locked.skills.syntax, 0);
});
test('pre-foundation-update saves retain every learned knowledge value', () => {
  for (const syntax of [0, 1, 6.75, 11.99, 12, 100]) {
    const s = createState(); s.balanceVersion = 9; s.skills.syntax = syntax;
    s.skills.design = 4; s.items['book-syntax'] = 1; s.cash = 4321;
    const loaded = deserialize(serialize(s));
    assert.deepEqual(loaded.skills, s.skills); assert.equal(loaded.cash, 4321);
    assert.equal(loaded.items['book-syntax'], 1); assert.equal(loaded.balanceVersion, BALANCE_VERSION);
  }
});
test('the first C++ syntax sequence reaches the first project within two complete prompts', () => {
  for (const useTab of [false, true]) {
    const s = createState(); s.mode = 'study'; s.inputStyle = 'typing'; s.items['book-syntax'] = 1;
    let prompts = 0, physicalKeys = 0;
    while (s.skills.syntax < 12 && prompts < 12) {
      const text = currentPrompt(s); let offset = 0;
      while (offset < text.length) {
        const spaces = useTab ? text.slice(offset).match(/^ {2,}/)?.[0].length || 1 : 1;
        const width = Math.min(4, spaces), power = 1 / width;
        physicalKeys++;
        for (let index = 0; index < width; index++) {
          const accepted = acceptCharacter(s, text[offset++], power);
          assert.ok(accepted.correct);
          input(s, { chars: power * TYPING_REWARD.character });
          if (accepted.complete) { input(s, { chars: accepted.bonus }); prompts++; }
        }
      }
    }
    assert.ok(s.skills.syntax >= 12); assert.ok(prompts <= 2);
    assert.ok(physicalKeys >= 450 && physicalKeys <= 600);
  }
});
test('the first local macro pays routine jobs and deducts rejected submissions without unrelated daily charges', () => {
  const s = createState(); s.items.macro = 1;
  assert.equal(unitRate(s, 'macro'), 10);
  const cash = s.cash; tick(s, 1800);
  assert.equal(s.cash - cash, 15840); assert.equal(s.job.progress, 0); assert.equal(s.ocrJob.progress,0);
  assert.equal(s.ocr.pending,18);assert.equal(s.ocr.pendingReward,1800);assert.equal(s.ocr.fees,360);
  assert.equal(operatingCost(s),0);assert.equal(s.stats.serverFees,0);
  assert.equal(netIncome(s), 8.8);
  s.items.macro = 2;assert.equal(unitRate(s,'macro'),10,'invalid extra levels cannot accelerate OCR');
  s.items.macro = 800;assert.equal(unitRate(s,'macro'),10);
  s.items.macro = 1;s.assets=16;assert.equal(unitRate(s,'macro'),30,'assets still improve the single installed tool');
});
test('the OCR upgrade refunds removed expansions and preserves partly completed manual invoices', () => {
  const s = createState(); s.balanceVersion = 8; s.cash = 4321; s.items.macro = 2; s.job = { progress: 37, rate: 1 };
  const loaded = deserialize(serialize(s));
  assert.equal(loaded.cash, 8071); assert.equal(loaded.items.macro, 1);
  assert.deepEqual(loaded.job, { progress: 37, rate: 1 });
  assert.equal(unitRate(loaded, 'macro'), 10);
  tick(loaded, 4);
  assert.equal(loaded.cash, 8071); assert.equal(loaded.job.progress, 37);
  assert.equal(loaded.ocrJob.progress,40);assert.equal(loaded.ocr.failures,0);
  input(loaded,{mode:'work',chars:63});assert.equal(loaded.cash,8171);
  assert.equal(loaded.ocrJob.progress,40,'manual invoices cannot advance the automatic queue');
});
test('research redirects to missing subjects while manual study remains selectable', () => {
  const s = createState(); s.projectIndex = 1; s.skills.syntax = 50; s.items.lab = 1; s.subject = 'syntax';
  s.items['book-design'] = 1; s.items['book-graphics'] = 1;
  assert.equal(autoStudySubject(s), 'design');
  tick(s, 10);
  assert.ok(s.skills.design > 0 && s.skills.graphics > 0);
  assert.equal(s.subject, 'syntax');
});
test('every study subject requires its own textbook, including imported knowledge and offline labs', () => {
  const s = createState(0); s.items.lab = 1; s.items.monitor = 5;
  for (const subject of ['syntax', 'design', 'graphics', 'systems']) {
    s.subject = subject;
    assert.equal(studyGain(s, 1e9), 0);
    assert.deepEqual(input(s, { mode: 'study', chars: 1e9 }), { kind: 'textbook', amount: 0 });
    assert.equal(s.skills[subject], 0);
  }
  assert.equal(s.stats.manual, 0); assert.equal(s.stats.study, 0); assert.equal(s.stats.chars, 0);
  assert.equal(autoStudySubject(s), null);
  const loaded = deserialize(serialize(s, 0));
  applyOffline(loaded, 8 * 3600e3);
  assert.deepEqual(loaded.skills, s.skills);
  s.cash = 1500; assert.equal(buy(s, 'book-syntax'), true);
  input(s, { mode: 'study', subject: 'syntax', chars: 100 });
  assert.ok(s.skills.syntax > 0);
  assert.equal(studyGain(s, 100, 'design'), 0);
  s.skills.design = 100;
  assert.equal(studyGain(s, 100, 'design'), 0, 'existing knowledge must not bypass the missing textbook');
});
test('the lab uses only owned textbooks and pauses when all missing subjects lack materials', () => {
  const s = createState(); s.projectIndex = 1; s.items.lab = 1;
  s.skills.syntax = 50; s.items['book-design'] = 1;
  assert.equal(autoStudySubject(s), 'design');
  tick(s, 10);
  assert.ok(s.skills.design > 0); assert.equal(s.skills.graphics, 0);
  s.skills.design = 20;
  assert.equal(autoStudySubject(s), null);
  tick(s, 10); assert.equal(s.skills.design, 20); assert.equal(s.skills.graphics, 0);
  s.cash = 8000; assert.equal(buy(s, 'book-graphics'), true);
  assert.equal(autoStudySubject(s), 'graphics');
  tick(s, 10); assert.ok(s.skills.graphics > 0);
});
test('previous saves retain earned resources and acquire safe typing defaults', () => {
  const previous = { ...createState(), cash: 98765, balanceVersion: 1, skills: { syntax: 123, design: 45, graphics: 6, systems: 7 }, projectIndex: 2 };
  delete previous.typing; delete previous.inputStyle;
  const loaded = deserialize(JSON.stringify(previous));
  assert.equal(loaded.cash, 98765); assert.equal(loaded.skills.syntax, 123); assert.equal(loaded.projectIndex, 2);
  assert.equal(loaded.inputStyle, 'click'); assert.equal(loaded.typing.language, 'cpp'); assert.equal(loaded.balanceVersion, BALANCE_VERSION);
});

test('store fees apply once to initial and ongoing commercial sales with a named payee', () => {
  const s = createState(); s.projectIndex = 1; understand(s); s.progress = projectAt(1).target;
  const before = s.cash, title = release(s);
  assert.equal(title.salesFee, title.grossPayout * STORE_FEE_RATE);
  assert.equal(s.cash - before, title.grossPayout * (1 - STORE_FEE_RATE));
  const afterRelease = s.cash; tick(s, 10);
  assert.ok(Math.abs(s.cash - afterRelease - title.royalty * 10 * (1 - STORE_FEE_RATE)) < 1e-7);
  assert.ok(Math.abs(s.stats.storeFees - title.salesFee - title.royalty * 10 * STORE_FEE_RATE) < 1e-7);
  assert.equal(operatingCost(s), 0, 'an offline sale must not create a server contract');
  assert.equal(expenseLines(s)[0].payee, 'ゲーム配信ストア');
  assert.match(expenseLines(s)[0].terms, /25%/);
});

test('only published online titles create fixed server costs, even with no sales', () => {
  const s = createState(); s.projectIndex = 5; s.cash = 1e8;
  assert.equal(operatingCost(s), 0, 'development alone must not rent a server');
  s.progress = projectAt(5).target;
  const free = release(s);
  assert.equal(free.royalty, 0); assert.equal(free.online, true);
  assert.equal(operatingCost(s), 3e6);
  assert.equal(expenseLines(s)[0].payee, 'ホスティング会社');
  s.items.kitchen = 1;
  assert.equal(serverCost(s, free), 2250000);
  assert.equal(setPublicationActive(s, 5, false), true); assert.equal(operatingCost(s), 0);
  assert.equal(setPublicationActive(s, 5, true), true); assert.equal(operatingCost(s), 2250000);
});

test('server bills accrue only while a title is live and retain fees incurred before stopping', () => {
  const s = createState(); s.cash = 1e7;
  s.catalog = [{ ...projectAt(5), index: 5, royalty: 0, active: true }];
  tick(s, DAY / 2);
  assert.equal(s.cash, 1e7); assert.ok(Math.abs(s.dailyAccrued - 1500000) < .001);
  setPublicationActive(s, 5, false); tick(s, DAY / 2);
  assert.ok(Math.abs(s.cash - 8500000) < .001); assert.equal(s.dailyAccrued, 0);
  const loaded = deserialize(serialize(s)); tick(loaded, DAY);
  assert.equal(loaded.cash, s.cash); assert.equal(loaded.catalog[0].active, false);
  assert.ok(Math.abs(loaded.stats.serverFees - 1500000) < .001);
});

test('server fees and sales are identical in foreground and offline play', () => {
  const s = createState(0); s.cash = 1e8;
  s.catalog = [{ ...projectAt(5), index: 5, royalty: 100, active: true }];
  const loaded = deserialize(serialize(s, 0));
  tick(s, DAY); applyOffline(loaded, DAY * 1000);
  const expected = 1e8 + 100 * (1 - STORE_FEE_RATE) * DAY - 3e6;
  assert.ok(Math.abs(s.cash - expected) < .001);
  assert.ok(Math.abs(loaded.cash - s.cash) < .001);
  assert.equal(netIncome(s), 100 * (1 - STORE_FEE_RATE) - 3e6 / DAY);
});

test('new contracts do not backdate fees and old unspent rent reserves are returned once', () => {
  const old = { ...createState(0), balanceVersion: 5, cash: 1000, dailyAccrued: 600, rentAccrued: 900, rentFund: 800, billingDays: 10,
    catalog: [{ ...projectAt(5), index: 5, royalty: 1, active: true }] };
  const s = deserialize(JSON.stringify(old));
  assert.equal(s.cash, 1800); assert.equal(s.dailyAccrued, 0);
  applyOffline(s, DAY * 1000);
  assert.ok(Math.abs(s.cash - (1800 + DAY)) < 1e-7, 'the first migrated absence must not apply a new fee retroactively');
  const loaded = deserialize(serialize(s, DAY * 1000));
  assert.equal(loaded.cash, s.cash, 'loading the migrated save must not refund again');
  const cash = loaded.cash; tick(loaded, DAY);
  assert.ok(Math.abs(loaded.cash - cash - DAY * (1 - STORE_FEE_RATE) + 3e6) < .001);
});

test('archiving an old portfolio preserves active server bills and selling income', () => {
  const s = createState();
  s.catalog = Array.from({ length: 100 }, (_, index) => ({ name: `old-${index}`, index: index + 5, royalty: 100, online: true, serverDaily: 3000, active: true }));
  const costs = operatingCost(s), sales = royaltyRate(s);
  understand(s); s.progress = projectAt(0).target; release(s);
  assert.equal(s.catalog.length, 100); assert.equal(operatingCost(s), costs); assert.equal(royaltyRate(s), sales);
  assert.equal(s.catalog[0].archived, true);
  setPublicationActive(s, -1, false);
  assert.equal(operatingCost(s), costs - 6000); assert.equal(royaltyRate(s), sales - 200);
});

test('a completed work order pays its accepted quote and carries progress across modes and saves', () => {
  const s = createState();
  assert.equal(input(s, { mode: 'work', chars: 99 }).amount, 0);
  assert.equal(s.cash, 100);
  s.projectIndex = 1;
  input(s, { mode: 'study', chars: 1 });
  const loaded = deserialize(serialize(s));
  assert.equal(input(loaded, { mode: 'work', chars: 251 }).amount, 300);
  assert.equal(loaded.job.progress, 50); assert.equal(loaded.job.rate, 1);
  assert.equal(loaded.stats.jobs, 3); assert.equal(loaded.cash, 400);
});

test('legacy calendar migration preserves day fraction without backdating new expenses', () => {
  const old = { ...createState(), balanceVersion: 2, day: 901, dayElapsed: 30, cash: -4321, billingDays: 29, rentAccrued: 1e6, rentFund: 1e6 };
  const s = deserialize(JSON.stringify(old));
  assert.equal(s.day, 901); assert.equal(s.dayElapsed, DAY / 2); assert.equal(s.cash, -4321);
  assert.equal(s.dailyAccrued, 0);
  tick(s, DAY / 2);
  assert.equal(s.cash, -4321);
});
