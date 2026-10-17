import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, SCENARIOS, FAST_TYPING } from '../scripts/simulate-balance.mjs';
import { PACING_REPORT } from '../src/pacing.js';

for (const scenario of SCENARIOS) test(`first AAA pacing: ${scenario.name}`, () => {
  const result = simulate(scenario);
  assert.equal(result.reached, 5, 'AAA must remain reachable without resource injection');
  assert.equal(result.milestones.length, 5);
  assert.ok(result.minimumCash >= 0, 'The benchmark must fund its bills without relying on business debt');
  const aaa = result.milestones[4];
  const reference = PACING_REPORT.scenarios.find(s => s.id === scenario.id);
  for (let index = 0; index < 5; index++) assert.ok(Math.abs(reference.milestones[index].seconds - result.milestones[index].seconds) <= 60, 'Regenerate the development pacing report after changing balance');
  assert.ok(aaa.seconds >= 3 * 86400, `AAA too early: ${aaa.seconds / 3600} hours`);
  assert.ok(aaa.seconds <= 7 * 86400 + 60, `AAA too late: ${aaa.seconds / 3600} hours`);
  if (scenario.returning) assert.ok(aaa.activeSeconds < 6 * 3600, 'Returning play must not require days of continuous typing');
});

test('uncapped opportunistic upgrades do not collapse the 30-character-per-second stress case', () => {
  const result = simulate(FAST_TYPING, { opportunistic: true });
  assert.equal(result.reached, 5);
  assert.ok(result.milestones[4].seconds >= 72 * 3600);
});
