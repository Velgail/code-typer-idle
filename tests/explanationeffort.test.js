import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calibratedChallengeReward} from '../src/challengerewards.js';
import {loadChallengeCalibration,validateLiveCalibration,deriveChallengeCalibration,medianNanoseconds,medianRationals,roundedWorkUnits,rewardSource,serializeCalibration,CALIBRATION_PATH} from '../scripts/challenge-calibration.mjs';

test('the compact original-clock projection reproduces every frozen family price offline',()=>{
 const calibration=loadChallengeCalibration(),derived=validateLiveCalibration(calibration);
 assert.equal(derived.families.length,321);
 assert.equal(derived.applicationAnchorSeconds,31.0368540985);
 assert.equal(readFileSync(CALIBRATION_PATH,'utf8'),serializeCalibration(calibration));
 assert.equal(readFileSync('src/challengerewards.js','utf8'),rewardSource(calibration));
 for(const row of derived.families){
  const reward=calibratedChallengeReward(row.familyId);
  assert.equal(reward.baseWorkUnits,row.baseWorkUnits,row.familyId);
  assert.equal(reward.canonicalId,row.canonicalId,row.familyId);
  assert.equal(reward.basis,'direct-raw-explanation-observation');
  assert.ok(Object.isFrozen(reward));
 }
 assert.equal(calibratedChallengeReward('unknown/family'),null);
});

test('nanosecond medians retain precision above JavaScript safe integers and between observations',()=>{
 assert.deepEqual(medianNanoseconds(['9007199254740994','9007199254740993']),{numerator:18014398509481987n,denominator:2n});
 assert.deepEqual(medianNanoseconds(['9','2','5']),{numerator:5n,denominator:1n});
 const first=medianNanoseconds(['1','2']),second=medianNanoseconds(['3','4']);
 assert.deepEqual(medianRationals([first,second]),{numerator:5n,denominator:2n});
 assert.equal(roundedWorkUnits({numerator:5n,denominator:2n},{numerator:1n,denominator:1n},1),3,'half work units round upward');
 assert.equal(roundedWorkUnits({numerator:1n,denominator:100n},{numerator:1n,denominator:1n},1),1,'positive observed work has the existing minimum');
 for(const values of [[],['0'],['-1'],['1.5'],[1],['01']])assert.throws(()=>medianNanoseconds(values));
});

test('the compact projection rejects missing observations, duplicate identities and missing catalog families',()=>{
 const calibration=loadChallengeCalibration();
 for(const mutate of [
  c=>c.families[0][2]=[],
  c=>c.families[1][2][0][0]=c.families[0][2][0][0],
  c=>c.families[1][0]=c.families[0][0],
  c=>c.applications=[],
  c=>c.families[0][2][0][1]='1.5',
  c=>c.commonWorkAnchor=0
 ]){
  const altered=structuredClone(calibration);mutate(altered);assert.throws(()=>deriveChallengeCalibration(altered));
 }
 const missing=structuredClone(calibration);missing.families.pop();
 assert.throws(()=>validateLiveCalibration(missing),/Every catalog family/);
 const scale=structuredClone(calibration);scale.commonWorkAnchor++;
 assert.throws(()=>validateLiveCalibration(scale),/game scale/);
});
