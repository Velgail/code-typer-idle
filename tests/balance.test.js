import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, SCENARIOS, FAST_TYPING, TYPING_WITH_READING, manualInputModel } from '../scripts/simulate-balance.mjs';
import { PACING_REPORT } from '../src/pacing.js';

for (const scenario of [...SCENARIOS, TYPING_WITH_READING]) test(`first AAA pacing: ${scenario.name}`, () => {
  const result = simulate(scenario);
  assert.equal(result.reached, 5, 'AAA must remain reachable without resource injection');
  assert.equal(result.milestones.length, 5);
  assert.ok(result.minimumCash >= 0, 'The benchmark must fund its bills without relying on business debt');
  const aaa = result.milestones[4];
  const reference = PACING_REPORT.scenarios.find(s => s.id === scenario.id);
  for (let index = 0; index < 5; index++) assert.ok(Math.abs(reference.milestones[index].seconds - result.milestones[index].seconds) <= 60, 'Regenerate the development pacing report after changing balance');
  assert.equal(result.stages.length, 5);
  assert.equal(Object.values(result.modeSeconds).reduce((sum, value) => sum + value, 0), result.activeSeconds);
  let elapsed = 0, active = 0;
  for (let index = 0; index < result.stages.length; index++) {
    const stage = result.stages[index];
    assert.equal(stage.startSeconds, elapsed);
    assert.equal(Object.values(stage.modeSeconds).reduce((sum, value) => sum + value, 0), stage.activeSeconds);
    assert.equal(stage.activeSeconds + stage.inactiveSeconds, stage.elapsedSeconds);
    elapsed += stage.elapsedSeconds; active += stage.activeSeconds;
    assert.equal(elapsed, result.milestones[index].seconds);
    assert.equal(active, result.milestones[index].activeSeconds);
  }
  if (scenario.id !== TYPING_WITH_READING.id) assert.ok(result.stages[1].modeSeconds.work <= 25 * 60, 'The first paid game must not require another hour of manual invoice work');
  assert.ok(result.milestones[1].seconds <= 3600, 'the first paid game must be reachable in the initial session under the reference purchase policy');
  assert.ok(result.stages[1].modeSeconds.study <= 12 * 60, 'adding design and graphics must not introduce an hour of mandatory manual study');
  assert.ok(aaa.seconds >= 3 * 86400, `AAA too early: ${aaa.seconds / 3600} hours`);
  assert.ok(aaa.seconds <= 7 * 86400 + 60, `AAA too late: ${aaa.seconds / 3600} hours`);
  if (scenario.returning) assert.ok(aaa.activeSeconds < 6 * 3600, 'Returning play must not require days of continuous typing');
});

test('typing sensitivity accounts for invoice reading, wrong attempts and additional correction time', () => {
  assert.equal(manualInputModel(SCENARIOS[1], 'work').unitsPerSecond, 20);
  assert.equal(manualInputModel(SCENARIOS[1], 'study').unitsPerSecond, 10);
  const realistic = manualInputModel(TYPING_WITH_READING, 'work');
  assert.ok(realistic.unitsPerSecond > 13 && realistic.unitsPerSecond < 14, 'Invoice reading and correction must still leave a clear advantage over eight clicks per second');
  assert.ok(manualInputModel(TYPING_WITH_READING, 'study').unitsPerSecond > 8, 'The reading delay belongs to invoices, not code');
  assert.ok(manualInputModel({ ...TYPING_WITH_READING, officeReadingSeconds: 6 }, 'work').unitsPerSecond < realistic.unitsPerSecond);
  assert.ok(manualInputModel({ ...TYPING_WITH_READING, correctionSeconds: 1 }, 'work').unitsPerSecond < realistic.unitsPerSecond);
  assert.ok(manualInputModel({ ...TYPING_WITH_READING, accuracy: 1 }, 'work').unitsPerSecond > realistic.unitsPerSecond);
  for (const invalid of [{ rate: 0 }, { accuracy: 0 }, { accuracy: 1.1 }, { correctionSeconds: -1 }, { officeReadingSeconds: Infinity }]) assert.throws(() => manualInputModel({ ...TYPING_WITH_READING, ...invalid }, 'work'), RangeError);
});

test('uncapped opportunistic upgrades do not collapse the 30-character-per-second stress case', () => {
  const result = simulate(FAST_TYPING, { opportunistic: true });
  assert.equal(result.reached, 5);
  assert.ok(result.milestones[4].seconds >= 72 * 3600);
});

test('a prototype trades implementation time for reviews while structured work pays off through reuse',()=>{
  const prototype=simulate(SCENARIOS[1],{policy:'prototype'});
  const structured=simulate(SCENARIOS[1],{policy:'structured'});
  assert.equal(prototype.reached,5);assert.equal(structured.reached,5);
  assert.ok(prototype.stages[0].modeSeconds.development < structured.stages[0].modeSeconds.development);
  assert.ok(prototype.stages[0].modeSeconds.review > structured.stages[0].modeSeconds.review);
  assert.ok(prototype.milestones[0].seconds <= structured.milestones[0].seconds);
  assert.ok(structured.milestones[4].seconds<prototype.milestones[4].seconds);
});

test('outsourcing remains funded and cannot bypass the pacing floor through extra sale quality',()=>{
  const result=simulate(FAST_TYPING,{opportunistic:true,outsource:true});
  assert.equal(result.reached,5);assert.ok(result.minimumCash>=0);
  assert.ok(result.milestones[4].seconds>=72*3600);assert.ok(result.milestones[4].seconds<=7*86400);
});
