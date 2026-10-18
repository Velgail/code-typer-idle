import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, SCENARIOS, FAST_TYPING, TYPING_WITH_READING, manualInputModel } from '../scripts/simulate-balance.mjs';
import { PACING_REPORT } from '../src/pacing.js';
import { projectAt } from '../src/core.js';

const results = new Map();
const run = (scenario, options = {}) => {
  const key = JSON.stringify([scenario, options]);
  if (!results.has(key)) results.set(key, simulate(scenario, options));
  return results.get(key);
};
const share = (manual, auto) => manual / (manual + auto);
function fundedAndFinite(result) {
  assert.equal(result.reached, 5, 'AAA must remain reachable without resource injection');
  assert.ok(result.minimumCash >= -1e-6, 'OCR fees and purchases must be funded without business borrowing');
  for (const key of ['activeSeconds', 'manualInputs', 'minimumCash', 'outsourcingSpend']) assert.ok(Number.isFinite(result[key]), key);
  for (const stage of result.stages) for (const [key, value] of Object.entries(stage.output)) assert.ok(Number.isFinite(value) && value >= 0, key);
}

for (const scenario of [...SCENARIOS, TYPING_WITH_READING]) test(`first AAA pacing: ${scenario.name}`, () => {
  const result = run(scenario);
  fundedAndFinite(result);
  assert.equal(result.milestones.length, 5);
  const aaa = result.milestones[4];
  const reference = PACING_REPORT.scenarios.find(s => s.id === scenario.id);
  for (let index = 0; index < 5; index++) assert.ok(Math.abs(reference.milestones[index].seconds - result.milestones[index].seconds) <= 60, 'Regenerate the development pacing report after changing balance');
  assert.equal(result.stages.length, 5);
  assert.equal(Object.values(result.modeSeconds).reduce((sum, value) => sum + value, 0), result.activeSeconds);
  let elapsed = 0, active = 0;
  for (let index = 0; index < result.stages.length; index++) {
    const stage = result.stages[index], output = stage.output;
    assert.equal(stage.startSeconds, elapsed);
    assert.equal(Object.values(stage.modeSeconds).reduce((sum, value) => sum + value, 0), stage.activeSeconds);
    assert.equal(stage.activeSeconds + stage.inactiveSeconds, stage.elapsedSeconds);
    assert.ok(stage.correctionSeconds <= stage.modeSeconds.work);
    assert.ok(output.manualConfirmedRequiredProgress + output.autoConfirmedRequiredProgress <= 1 + 1e-8);
    const completed = output.manualDevelopmentCharacters + output.autoDevelopmentCharacters;
    assert.ok(Math.abs(completed - projectAt(index).target) / projectAt(index).target < 1e-10);
    elapsed += stage.elapsedSeconds; active += stage.activeSeconds;
    assert.equal(elapsed, result.milestones[index].seconds);
    assert.equal(active, result.milestones[index].activeSeconds);
  }
  if (scenario.typing) {
    assert.ok(result.milestones[0].seconds >= 60 && result.milestones[0].seconds <= 10 * 60, 'The first game should contain a short active session rather than finish instantly');
    assert.ok(result.milestones[1].seconds <= 20 * 60, 'Typing should reach the first paid game during the opening session');
    const final = result.stages[4].output;
    assert.ok(share(final.manualDevelopmentCharacters, final.autoDevelopmentCharacters) >= 1 / 3, 'Manual typing must keep a material share of late development alongside automation');
    assert.ok(share(final.manualConfirmedRequiredProgress, final.autoConfirmedRequiredProgress) > .5, 'Active study must contribute confirmed knowledge, including recovered gaps');
  } else {
    assert.ok(result.stages[1].modeSeconds.work <= 30 * 60, 'Click play must not require another hour of manual invoice work');
    assert.ok(result.stages[1].modeSeconds.study <= 15 * 60, 'The second project must not require an hour of mandatory manual study');
  }
  assert.ok(aaa.seconds >= 3 * 86400, `AAA too early: ${aaa.seconds / 3600} hours`);
  assert.ok(aaa.seconds <= 7 * 86400 + 60, `AAA too late: ${aaa.seconds / 3600} hours`);
  assert.ok(result.stages.some(stage => stage.output.autoOCRFees > 0), 'The benchmark must use the actual OCR loss ledger');
  assert.ok(result.stages.some(stage => stage.output.manualOCRRecovered > 0), 'Cash work should recover outstanding rejected deliveries');
  assert.ok(result.stages[4].output.autoDebtAdded > 0 && result.stages[4].output.autoDefectsIntroduced > 0, 'Automatic development must retain its quality costs');
  if (scenario.returning) assert.ok(aaa.activeSeconds < 6 * 3600, 'Returning play must not require days of continuous typing');
});

test('typing is ten times click throughput at the reference speed before installed equipment', () => {
  const click = manualInputModel(SCENARIOS[0], 'work').unitsPerSecond;
  for (const mode of ['work', 'study', 'dev']) assert.equal(manualInputModel(SCENARIOS[1], mode).unitsPerSecond, click * 10);
  const realistic = manualInputModel(TYPING_WITH_READING, 'work');
  assert.ok(realistic.unitsPerSecond > 50 && realistic.unitsPerSecond < 60);
  assert.ok(manualInputModel(TYPING_WITH_READING, 'study').unitsPerSecond > 70);
  assert.ok(manualInputModel(TYPING_WITH_READING, 'work', { workLength: 2 }).unitsPerSecond < realistic.unitsPerSecond, 'Short correction fields pay their own reading delay');
  assert.ok(manualInputModel({ ...TYPING_WITH_READING, officeReadingSeconds: 6 }, 'work').unitsPerSecond < realistic.unitsPerSecond);
  assert.ok(manualInputModel({ ...TYPING_WITH_READING, correctionSeconds: 1 }, 'work').unitsPerSecond < realistic.unitsPerSecond);
  assert.ok(manualInputModel({ ...TYPING_WITH_READING, accuracy: 1 }, 'work').unitsPerSecond > realistic.unitsPerSecond);
  for (const invalid of [{ rate: 0 }, { accuracy: 0 }, { accuracy: 1.1 }, { correctionSeconds: -1 }, { officeReadingSeconds: Infinity }]) assert.throws(() => manualInputModel({ ...TYPING_WITH_READING, ...invalid }, 'work'), RangeError);
  assert.throws(() => manualInputModel(TYPING_WITH_READING, 'work', { workLength: 0 }), RangeError);
});

test('faster correct typing progresses faster with finite, funded opportunistic upgrades', () => {
  const reference = run(SCENARIOS[1], { opportunistic: true });
  const fast = run(FAST_TYPING, { opportunistic: true });
  const extreme = run({ ...FAST_TYPING, id: 'typing-extreme', rate: 120 }, { opportunistic: true });
  for (const result of [reference, fast, extreme]) fundedAndFinite(result);
  assert.ok(fast.milestones[4].seconds < reference.milestones[4].seconds);
  assert.ok(extreme.milestones[4].seconds < fast.milestones[4].seconds);
});

test('development policies trade implementation time for review work without unfunded resources', () => {
  const prototype = run(SCENARIOS[1], { policy: 'prototype' });
  const structured = run(SCENARIOS[1], { policy: 'structured' });
  for (const result of [prototype, structured]) fundedAndFinite(result);
  const seconds = (result, mode) => result.stages.reduce((sum, stage) => sum + stage.modeSeconds[mode], 0);
  assert.ok(seconds(prototype, 'development') < seconds(structured, 'development'));
  assert.ok(seconds(prototype, 'review') > seconds(structured, 'review'));
});

test('outsourcing remains funded with finite high-speed progress', () => {
  const result = run(FAST_TYPING, { opportunistic: true, outsource: true });
  fundedAndFinite(result);
  assert.ok(result.outsourcingSpend > 0);
  assert.ok(result.milestones[4].seconds > 0 && result.milestones[4].seconds <= 7 * 86400);
});
