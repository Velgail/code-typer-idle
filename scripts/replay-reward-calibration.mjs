// Regrade all frozen source answers without calling or timing a model.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {gradeCalibrationDirectory} from './grade-calibration-submissions.mjs';

const root=resolve('.'),sha=value=>createHash('sha256').update(value).digest('hex');
const registry=JSON.parse(await readFile('research/reward-calibration-registry.json','utf8'));
const evidence=JSON.parse(await readFile('research/reward-calibration-submissions.json','utf8'));
const directory=resolve(process.argv[2]||`work/calibration-replay-${Date.now()}`);
assert.ok(directory.startsWith(root+'/work/'),'Replay directory must be inside work/');
await mkdir(directory,{recursive:true});
for(const row of evidence.submissions){
 const sourcePath=resolve(directory,`${row.id}.answer.cpp`);
 await writeFile(sourcePath,row.source,{flag:'wx'});
 const original=JSON.parse(row.recordedSubmissionJson);
 const submission={...original,sourcePath:relative(root,sourcePath),sourceSha256:sha(row.source),replayOfObservedSubmissionSha256:row.submissionSha256};
 await writeFile(resolve(directory,`${row.id}.submission.json`),JSON.stringify(submission,null,2)+'\n',{flag:'wx'});
}
const registryPath=resolve(directory,'registry.json');
await writeFile(registryPath,JSON.stringify(registry,null,2)+'\n',{flag:'wx'});
const report=await gradeCalibrationDirectory({registryPath,trialsPath:directory,outputPath:resolve(directory,'grades.json')});
const digest=value=>sha(JSON.stringify(value));
function sameValue(actual,expected){
 if(expected&&typeof expected==='object'&&expected.sha256&&expected.type)return digest(actual)===expected.sha256;
 return digest(actual)===digest(expected);
}
for(const row of report.submissions){
 const observed=evidence.submissions.find(s=>s.id===row.id);
 for(const key of ['sourceSha256','implementationCharacters','accepted','category','caseCount','passedCaseCount','casesSha256','harnessSha256'])assert.deepEqual(row[key],observed[key],`${row.id}: ${key}`);
 assert.equal(row.cases.length,observed.cases.length);
 row.cases.forEach((c,i)=>{
  const prior=observed.cases[i];assert.equal(c.passed,prior.passed,`${row.id}: case ${i}`);
  assert.ok(sameValue(c.actual,prior.actual),`${row.id}: actual ${i}`);
  assert.ok(sameValue(c.expected,prior.expected),`${row.id}: expected ${i}`);
 });
}
console.log(JSON.stringify({replayed:report.summary.total,accepted:report.summary.accepted,wrongAnswers:report.summary.rejected,allRecordedResultsReproduced:true,directory:relative(root,directory)}));
