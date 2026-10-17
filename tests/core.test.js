import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, projectAt, PROJECTS, SHOP, buy, input, tick, knowledgeRatio, validity, debtLimit, release, prestige, prestigeGain, applyOffline, serialize, deserialize, checkAchievements, handPower, royaltyRate, itemCost, OFFLINE_LIMIT, INITIAL_CASH, studyGain, studyMultiplier, unitRate, autoStudySubject, DAY, BALANCE_VERSION, operatingCost, serverCost, expenseLines, setPublicationActive, netIncome, STORE_FEE_RATE } from '../src/core.js';
import { simulate, SCENARIOS } from '../scripts/simulate-balance.mjs';

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
  assert.equal(s.debt, 50);
  assert.ok(s.progress > 45 && s.progress < 50);
  s.skills.graphics = 0;
  assert.equal(validity(s), 0);
});
test('understanding yields clean code and abstraction caps at three', () => {
  const s = createState();
  understand(s, 50);
  input(s, { mode: 'dev', chars: 100 });
  assert.equal(s.progress, 300);
  assert.equal(s.debt, 0);
});
test('unreviewable automation creates debt and crashes instead of progressing', () => {
  const s = createState();
  s.items.assistant = 1;
  tick(s, 100);
  assert.equal(s.crashed, true);
  assert.equal(s.debt, debtLimit(s));
  assert.equal(s.progress, 0);
});
test('refactoring requires complete understanding and repairs a crashed build', () => {
  const s = createState();
  s.debt = debtLimit(s); s.crashed = true; s.refactor = true;
  input(s, { mode: 'dev', chars: 1e5 });
  assert.equal(s.crashed, true);
  understand(s);
  input(s, { mode: 'dev', chars: 160 });
  assert.equal(s.debt, 110);
  assert.equal(s.crashed, false);
  assert.equal(s.progress, 0);
});
test('a release requires a complete and sufficiently repaired project', () => {
  const s = createState(); understand(s);
  assert.equal(release(s), null);
  s.progress = projectAt(0).target; s.debt = debtLimit(s) * .11;
  assert.equal(release(s), null);
  s.debt = 0;
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
  assert.equal(s.cash, 0);
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
  tick(s, 2); assert.equal(s.job.progress, .5); assert.ok(s.progress > 0); assert.ok(s.skills.syntax > 12);
  s.autoEnabled = false;
  const progress = s.progress, knowledge = s.skills.syntax, work = s.job.progress;
  tick(s, 2); assert.equal(s.progress, progress); assert.ok(s.skills.syntax > knowledge); assert.ok(s.job.progress > work);
});
test('offline results match foreground simulation and cap at eight hours', () => {
  const now = 1e12, a = createState(now), b = createState(now);
  a.items.macro = 2; b.items.macro = 2;
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
  const s = createState(); s.items.macro = 3; s.skills.design = 77; s.mode = 'study';
  const loaded = deserialize(serialize(s));
  assert.equal(loaded.skills.design, 77); assert.equal(loaded.items.macro, 3); assert.equal(loaded.mode, 'study');
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
  assert.ok(result.milestones[0].seconds > 20 * 60 && result.milestones[0].seconds < 60 * 60);
  assert.ok(result.purchases['book-syntax'] >= 5 * 60);
});

test('learning takes sustained work and slows as knowledge increases', () => {
  const s = createState(); s.items['book-syntax'] = 1;
  assert.equal(studyMultiplier(s), 2);
  input(s, { mode: 'study', chars: 19 });
  assert.ok(s.skills.syntax < 1);
  input(s, { mode: 'study', chars: 6600 });
  assert.ok(s.skills.syntax < 12);
  input(s, { mode: 'study', chars: 100 });
  assert.ok(s.skills.syntax >= 12);
  const early = studyGain(s, 10); s.skills.syntax = 100;
  assert.ok(studyGain(s, 10) < early);
});
test('the first local macro earns its work income without an unrelated daily charge', () => {
  const s = createState(); s.items.macro = 1;
  assert.equal(unitRate(s, 'macro'), .25);
  const cash = s.cash; tick(s, 1800);
  assert.equal(s.cash - cash, 400); assert.equal(s.job.progress, 50);
  assert.equal(netIncome(s), .25);
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
  assert.equal(input(loaded, { mode: 'work', chars: 251 }).amount, 500);
  assert.equal(loaded.job.progress, 50); assert.equal(loaded.job.rate, 2);
  assert.equal(loaded.stats.jobs, 3); assert.equal(loaded.cash, 600);
});

test('legacy calendar migration preserves day fraction without backdating new expenses', () => {
  const old = { ...createState(), balanceVersion: 2, day: 901, dayElapsed: 30, cash: -4321, billingDays: 29, rentAccrued: 1e6, rentFund: 1e6 };
  const s = deserialize(JSON.stringify(old));
  assert.equal(s.day, 901); assert.equal(s.dayElapsed, DAY / 2); assert.equal(s.cash, -4321);
  assert.equal(s.dailyAccrued, 0);
  tick(s, DAY / 2);
  assert.equal(s.cash, -4321);
});
