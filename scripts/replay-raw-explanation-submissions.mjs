// Reconstruct the published immutable evidence for executable replay. This does
// not call a solver or start a new clock, and never overwrites local evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRawCohorts} from './raw-explanation-cohorts.mjs';
import {rawSha} from './analyze-raw-explanations.mjs';
import {gradeRawExplanationDirectory} from './grade-raw-explanations.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>JSON.parse(readFileSync(path,'utf8'));

export function copyExactEvidence(path,text){
 const bytes=Buffer.from(text,'utf8');
 if(existsSync(path))assert.equal(rawSha(readFileSync(path)),rawSha(bytes),'Local immutable evidence differs: '+path);
 else {mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
}

export function restorePublishedRawEvidence({root=ROOT,cohortSet=loadRawCohorts(),snapshot=read('research/raw-explanation-submissions.json')}={}){
 const seen=new Set();
 for(const row of snapshot.submissions){
  assert.ok(!seen.has(row.id),'Duplicate published original');seen.add(row.id);
  const binding=cohortSet.bindings.get(row.id);assert.ok(binding,'Undeclared published trial');
  assert.equal(row.registrySha256,binding.registrySha256);assert.equal(row.protocolSha256,binding.protocolSha256);
  const directory=resolve(root,cohortSet.trialDirectories.get(row.id));
  const evidencePath=path=>{const target=resolve(root,path);assert.ok(target.startsWith(directory+sep),'Published evidence path escapes its declared trial directory');return target;};
  if(row.phaseIncomplete){
   assert.equal(row.explanation,null);assert.equal(row.source,null);
   assert.equal(rawSha(row.recordedStartJson),row.startSha256);assert.equal(rawSha(row.incompleteFailureJson),row.incompleteFailureSha256);
   const failure=JSON.parse(row.incompleteFailureJson);assert.equal(failure.trialId,row.id);
   copyExactEvidence(evidencePath(failure.startPath),row.recordedStartJson);
   copyExactEvidence(resolve(directory,'../protocol-failures',row.id+'.json'),row.incompleteFailureJson);
  }else{
   assert.equal(rawSha(row.recordedSubmissionJson),row.submissionSha256);
   const observed=JSON.parse(row.recordedSubmissionJson);assert.equal(observed.id,row.id);
   assert.equal(rawSha(row.explanation),row.explanationSha256);assert.equal(rawSha(row.source),row.sourceSha256);
   assert.equal(observed.explanationSha256,row.explanationSha256);assert.equal(observed.sourceSha256,row.sourceSha256);
   copyExactEvidence(evidencePath(observed.explanationPath),row.explanation);
   copyExactEvidence(evidencePath(observed.sourcePath),row.source);
   copyExactEvidence(resolve(directory,row.id+'.submission.json'),row.recordedSubmissionJson);
  }
 }
 assert.equal(seen.size,cohortSet.registry.trials.length,'Every declared original, including missing originals, must be published');
 return {restoredEvidence:true,newObservations:false,trials:seen.size};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const flags=process.argv.slice(2),ids=[];let restoreOnly=false;
 for(let i=0;i<flags.length;i++){
  if(flags[i]==='--restore-only')restoreOnly=true;
  else if(flags[i]==='--id'){assert.ok(flags[i+1]);ids.push(flags[++i]);}
  else throw Error('Usage: replay-raw-explanation-submissions.mjs [--restore-only] [--id TRIAL_ID]');
 }
 const set=loadRawCohorts();for(const id of ids)assert.ok(set.bindings.has(id),'Unknown requested replay');
 console.log(JSON.stringify(restorePublishedRawEvidence({cohortSet:set})));
 if(!restoreOnly)for(const cohort of set.cohorts){
  const selected=ids.filter(id=>set.bindings.get(id).experimentId===cohort.experimentId);if(ids.length&&!selected.length)continue;
  const outputPath=`work/raw-explanation-replay/${cohort.experimentId}.json`;
  const report=await gradeRawExplanationDirectory({registryPath:cohort.registry,trialsPath:cohort.trialsDirectory,outputPath,ids:selected,partial:true});
  console.log(JSON.stringify({outputPath,summary:report.summary}));
 }
}
