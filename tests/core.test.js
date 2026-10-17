import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, projectAt, PROJECTS, SHOP, buy, input, tick, knowledgeRatio, validity, debtLimit, release, prestige, prestigeGain, applyOffline, serialize, deserialize, checkAchievements, handPower, royaltyRate, itemCost, OFFLINE_LIMIT } from '../docs/js/core.js';

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
  tick(s, 3);
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
  assert.equal(s.cash - cash, title.royalty);
  const low = createState(); low.projectIndex = 1; understand(low, .75); low.progress = projectAt(1).target;
  assert.equal(release(low).royalty, 0);
});
test('purchases respect money, gates and one-time equipment', () => {
  const s = createState();
  assert.equal(buy(s, 'book-syntax'), false);
  assert.equal(buy(s, 'macro'), true);
  assert.equal(s.cash, 300);
  s.cash = 1e6;
  assert.equal(buy(s, 'assistant'), false);
  assert.equal(buy(s, 'kitchen'), true);
  assert.equal(buy(s, 'kitchen'), false);
  assert.equal(buy(s, 'not-an-item'), false);
});
test('food and monthly rent are charged on their exact days', () => {
  const s = createState(); s.cash = 10000;
  tick(s, 59); assert.equal(s.cash, 10000); assert.equal(s.day, 1);
  tick(s, 1); assert.equal(s.cash, 9880); assert.equal(s.day, 2);
  tick(s, 29 * 60); assert.equal(s.day, 31); assert.equal(s.cash, 2800);
});
test('bankruptcy is recoverable and halves manual efficiency', () => {
  const s = createState(); s.cash = 0;
  tick(s, 60); assert.equal(s.cash, -120); assert.equal(handPower(s), .5);
  for (let i = 0; i < 21; i++) input(s, { mode: 'work' });
  assert.ok(s.cash > 0); assert.equal(handPower(s), 1);
});
test('automation runs independently of selected mode; OFF pauses development while the lab keeps studying', () => {
  const s = createState(); understand(s); s.mode = 'study'; s.items.macro = 1; s.items.library = 1; s.items.lab = 1;
  tick(s, 2); assert.ok(s.cash > 1200); assert.ok(s.progress > 0); assert.ok(s.skills.syntax > 12);
  s.autoEnabled = false;
  const progress = s.progress, knowledge = s.skills.syntax, cash = s.cash;
  tick(s, 2); assert.equal(s.progress, progress); assert.ok(s.skills.syntax > knowledge); assert.ok(s.cash > cash);
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
  assert.equal(malformed.cash, 1200); assert.equal(malformed.skills.syntax, 0); assert.equal(malformed.items.keyboard, 0); assert.equal(malformed.projectIndex, 0);
  assert.throws(() => deserialize('{'));
  assert.throws(() => deserialize('{"version":999}'));
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
  const s = createState();
  let releasedAt = 0;
  for (let t = 0; t < 600 && !releasedAt; t++) {
    for (const id of ['macro', 'book-syntax', 'keyboard', 'monitor']) {
      const item = SHOP.find(i => i.id === id);
      if (s.cash > itemCost(s, item) + 250 && (!s.items[id] || s.cash > itemCost(s, item) * 4)) buy(s, id);
    }
    s.mode = !s.items['book-syntax'] ? 'work' : s.skills.syntax < 12 ? 'study' : 'dev';
    for (let tap = 0; tap < 4; tap++) input(s);
    tick(s, 1);
    assert.ok(s.cash >= 0);
    if (s.progress >= projectAt(0).target && release(s)) releasedAt = t + 1;
  }
  assert.ok(releasedAt > 0 && releasedAt < 600);
  assert.equal(s.projectIndex, 1);
  assert.ok(s.items.macro > 0);
});
