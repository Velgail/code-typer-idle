// Re-evaluate behavioral expected values against current application logic.
// Reference code-size metadata is deliberately not copied or used.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {appCalibrationTasks,validateAppReferences} from './calibration-app-fixtures.mjs';
import {rawSha} from './analyze-raw-explanations.mjs';

const frozen=JSON.parse(readFileSync('research/raw-application-contracts.json','utf8'));
const tasks=appCalibrationTasks();
for(const task of tasks){
 const declared=frozen.tasks.find(t=>t.id===task.id);assert.ok(declared);
 assert.deepEqual(task.publicSpec,declared.publicSpec,'Application public behavior changed');
 assert.deepEqual(task.fixtures,declared.cases,'Expected values do not reproduce from current production logic and independent oracle');
}
const compiled=await validateAppReferences(tasks);
const report={schemaVersion:2,purpose:'Fresh executable check of current application behavioral contracts and fixture values; no previous effort measurement or source-size calibration is reused.',
 checks:tasks.map((task,index)=>({id:task.id,publicSpecSha256:rawSha(JSON.stringify(task.publicSpec)),casesSha256:rawSha(JSON.stringify(task.fixtures)),productionJSReplayed:true,independentJSOracleCompared:true,nativeReference:compiled[index],
 productionFiles:task.sourceEvidence.map(e=>({file:e.file,sha256:rawSha(readFileSync(e.file))}))}))};
const path='research/raw-application-contract-validation.json',serialized=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--write'))writeFileSync(path,serialized);else assert.equal(readFileSync(path,'utf8'),serialized);
console.log(JSON.stringify({tasks:tasks.length,cases:tasks.reduce((n,t)=>n+t.fixtures.length,0),passed:true}));
