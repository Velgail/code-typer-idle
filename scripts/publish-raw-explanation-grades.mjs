import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadRawCohorts} from './raw-explanation-cohorts.mjs';
import {summarizeRawGrades} from './grade-raw-explanations.mjs';
import {rawSha} from './analyze-raw-explanations.mjs';

const cohortSet=loadRawCohorts(),submissions=[],sourceReports=[];
for(const cohort of cohortSet.cohorts){
 const bytes=readFileSync(cohort.grades),report=JSON.parse(bytes);
 assert.equal(report.schemaVersion,2);assert.equal(report.registrySha256,cohort.registrySha256);
 assert.deepEqual(report.summary.missingTrialIds,[],'Do not publish a partially collected cohort');
 for(const row of report.submissions){
  const binding=cohortSet.bindings.get(row.id);assert.ok(binding);
  assert.equal(row.registrySha256,binding.registrySha256);assert.equal(row.protocolSha256,binding.protocolSha256);
  assert.equal(row.experimentId,binding.experimentId);submissions.push(row);
 }
 sourceReports.push({experimentId:cohort.experimentId,registry:cohort.registry,registrySha256:cohort.registrySha256,protocol:cohort.protocol,protocolSha256:cohort.protocolSha256,sourceGradeReportSha256:rawSha(bytes),summary:report.summary});
}
const order=new Map(cohortSet.registry.trials.map((t,i)=>[t.id,i]));submissions.sort((a,b)=>order.get(a.id)-order.get(b.id));
const result={schemaVersion:2,experimentId:cohortSet.registry.experimentId,sourceReports,
 scope:'Exact original observed explanations, sources and executable results; includes every original failure and separately declared additional cohort.',
 summary:summarizeRawGrades(cohortSet.registry,submissions),submissions};
writeFileSync('research/raw-explanation-submissions.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary));
