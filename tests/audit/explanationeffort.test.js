// The previous summarized-text experiment is withdrawn. Verify the new freeze.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRawFreeze,RAW_PATHS} from '../../scripts/freeze-explanation-rewards.mjs';
import {rawMetrics,rawSha} from '../../scripts/analyze-raw-explanations.mjs';
import {loadRawCohorts} from '../../scripts/raw-explanation-cohorts.mjs';
import {loadChallengeCalibration,serializeCalibration} from '../../scripts/challenge-calibration.mjs';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
test('every live family price reproduces from new original answers and direct observations',()=>{
 const cohortSet=loadRawCohorts();
 const result=buildRawFreeze(cohortSet.registry,read(RAW_PATHS.grades),read(RAW_PATHS.reviews),cohortSet.protocol,read(RAW_PATHS.qualifications),cohortSet);
 const frozen=read('research/challenge-explanation-rewards.json');
 assert.equal(result.report.coverage.predictedFamilies,0);
 assert.equal(result.report.coverage.directlyObservedFamilies,result.report.coverage.totalFamilies);
 assert.deepEqual(result.report.families.map(r=>[r.familyId,r.baseWorkUnits]),frozen.families.map(r=>[r.familyId,r.baseWorkUnits]));
 assert.equal(result.source,readFileSync('src/challengerewards.js','utf8'));
 assert.equal(serializeCalibration(result.calibration),serializeCalibration(loadChallengeCalibration()));
 for(const row of read(RAW_PATHS.grades).submissions){
  if(row.phaseIncomplete){assert.equal(row.explanation,null);assert.equal(row.source,null);assert.equal(row.rawExplanationMetrics,null);continue;}
  const original=readFileSync(`research/raw-explanation-answers/${row.id}.md`,'utf8');
  assert.equal(original,row.explanation);assert.equal(rawSha(original),row.explanationSha256);
  for(const [key,value] of Object.entries(rawMetrics(original)))assert.equal(row.rawExplanationMetrics[key],value);
 }
});

test('published adjudication history verifies exact predecessor bytes without private work files',()=>{
 const r=read(RAW_PATHS.reviews),evidence=new Map(r.resolutionEvidence.map(e=>[e.sha256,e]));
 assert.equal(evidence.size,r.resolutionEvidence.length);
 for(const e of evidence.values())assert.equal(rawSha(e.rawJson),e.sha256);
 for(const amendment of r.resolutionAmendments){
  const previous=evidence.get(amendment.supersedesSha256);assert.ok(previous,'Every amendment predecessor must be published');
  const parsed=JSON.parse(previous.rawJson),assessment=parsed.assessment??parsed.assessments.find(a=>a.trialId===amendment.trialId);
  assert.equal(assessment.trialId,amendment.trialId);assert.equal(assessment.assessor,amendment.assessment.assessor);
  assert.ok([...evidence.values()].some(e=>JSON.stringify(JSON.parse(e.rawJson))===JSON.stringify(amendment)));
 }
});
