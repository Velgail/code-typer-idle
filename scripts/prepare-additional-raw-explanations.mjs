// Outcome-selected additional cohorts are declared separately, never passed off
// as preselected replications or substituted for failed originals.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rawSha} from './analyze-raw-explanations.mjs';
import {loadRawCohorts,COHORTS_PATH} from './raw-explanation-cohorts.mjs';
import {challengeById} from '../src/challengecatalog.js';

const json=value=>JSON.stringify(value,null,2)+'\n',read=path=>JSON.parse(readFileSync(path,'utf8'));
export function additionalRawPlan({cohort,selection,seed,declaredAt,prior,revisedPublicSpecOverrides={}}){
 assert.match(cohort,/^additional-[a-z0-9-]+$/);
 const experimentId=`raw-public-explanations-${cohort}-${rawSha(seed).slice(0,12)}`;
 const original=new Map(prior.registry.tasks.map(t=>[t.id,t])),tasks=[],trials=[],revisions=[],selectionKeys=new Set();
 for(const item of selection.tasks){
  const old=original.get(item.taskId);assert.ok(old,'Only a declared source task can be revisited');
  assert.ok(typeof item.reason==='string'&&item.reason.trim());
  assert.ok(Number.isInteger(item.repeat)&&item.repeat>=1&&item.repeat<=3);
  const task=structuredClone(old);
  if(item.revisedPublicContract){
   const q=challengeById(old.sourceId);assert.ok(q);
   task.publicSpec={language:q.language,title:q.title,description:q.description,parameters:structuredClone(q.parameters??[]),resultType:q.resultType??'int',starterSource:q.starterSource,constraints:structuredClone(q.constraints??[])};
   if(q.functionName)task.publicSpec.functionName=q.functionName;
   if(q.examples)task.publicSpec.examples=structuredClone(q.examples);
   if(revisedPublicSpecOverrides[old.id])task.publicSpec=structuredClone(revisedPublicSpecOverrides[old.id]);
   assert.notDeepEqual(task.publicSpec,old.publicSpec,'A revised contract must actually change the public specification');
   assert.deepEqual(q.cases,old.cases,'Fixture revisions require their own explicit experiment design');
   task.id='task_'+rawSha(seed+'\0revised\0'+old.id+'\0'+JSON.stringify(task.publicSpec)).slice(0,16);
   task.promptSha256=rawSha(json({instructions:prior.registry.publicInstructions,problem:task.publicSpec}));
   revisions.push({familyId:old.familyId,sourceId:old.sourceId,previousTaskId:old.id,activeTaskId:task.id,reason:item.reason,previousPromptSha256:old.promptSha256,activePromptSha256:task.promptSha256});
  }
  const existing=tasks.find(t=>t.id===task.id);if(existing)assert.deepEqual(existing,task);else tasks.push(task);
  const model=item.requestedModel??'gpt-6.1-sol';assert.ok(['gpt-6.1-sol','gpt-6-luna'].includes(model));
  const selectionKey=task.id+'/'+model;assert.ok(!selectionKeys.has(selectionKey),'Duplicate selected task/model');selectionKeys.add(selectionKey);
  const count=prior.registry.trials.filter(t=>t.taskId===task.id&&t.requestedModel===model).reduce((n,t)=>Math.max(n,t.independentTrial),0);
  for(let i=1;i<=item.repeat;i++)trials.push({id:'trial_'+rawSha(seed+'\0'+task.id+'\0'+model+'\0'+i).slice(0,20),taskId:task.id,language:task.language,requestedModel:model,requestedReasoningEffort:'low',independentTrial:count+i,cohort:model==='gpt-6.1-sol'?'primary':'comparison'});
 }
 assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);
 trials.sort((a,b)=>rawSha(seed+'\0order\0'+a.id).localeCompare(rawSha(seed+'\0order\0'+b.id)));trials.forEach((t,i)=>t.plannedOrder=i+1);
 const registry={schemaVersion:2,experimentId,declaredAt,publicInstructions:prior.registry.publicInstructions,applicationTaskIds:[],tasks,trials,selection:structuredClone(selection),revisions};
 const protocol={schemaVersion:2,experimentId,declaredAt,cohort,selection:structuredClone(selection),randomSeed:seed,
  status:'Additional observations selected after inspecting original outcomes; not a preregistered independent holdout.',
  originalCohorts:prior.cohorts.map(c=>({experimentId:c.experimentId,registry:c.registry,registrySha256:c.registrySha256,protocol:c.protocol,protocolSha256:c.protocolSha256})),
  originalRetention:'All previous trials, failures, original text and clocks remain. New answers are fresh and receive no answer, critique, fixtures or feedback.',
  measurement:'The exact original observer and public instructions are reused. Time remains observed explanation receipt wall time, never human solving minutes. No answer edits or length-based pricing.',
  plannedTasks:tasks.length,plannedTrials:trials.length,
  worker:{path:'scripts/raw-explanation-worker.py',sha256:rawSha(readFileSync('scripts/raw-explanation-worker.py'))},
  launcher:{path:'scripts/raw-explanation-additional-worker.py',sha256:rawSha(readFileSync('scripts/raw-explanation-additional-worker.py'))}};
 return {registry,protocol,revisions};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [cohort,selectionPath,flag]=process.argv.slice(2);assert.ok(['--write','--verify'].includes(flag),'Usage: prepare-additional-raw-explanations.mjs additional-N SELECTION.json --write|--verify');
 const protocolPath=`research/raw-explanation-${cohort}-protocol.json`,registryPath=`research/raw-explanation-${cohort}-registry.json`;
 const prior=loadRawCohorts();
 // For verification, reconstruct only the cohorts declared before this one.
 const current=existsSync(protocolPath)?read(protocolPath):null;
 const declaredRegistries=current?current.originalCohorts.map(o=>read(o.registry)):[];
 const taskIds=new Set(declaredRegistries.flatMap(r=>r.tasks.map(t=>t.id))),trialIds=new Set(declaredRegistries.flatMap(r=>r.trials.map(t=>t.id)));
 const before=current?{...prior,cohorts:prior.cohorts.filter(c=>current.originalCohorts.some(o=>o.experimentId===c.experimentId)),registry:{...prior.registry,tasks:prior.registry.tasks.filter(t=>taskIds.has(t.id)),trials:prior.registry.trials.filter(t=>trialIds.has(t.id))}}:prior;
 const ownRegistry=current?read(registryPath):null;
 const revisedPublicSpecOverrides=Object.fromEntries((ownRegistry?.revisions??[]).map(v=>[v.previousTaskId,ownRegistry.tasks.find(t=>t.id===v.activeTaskId).publicSpec]));
 const selection=read(selectionPath),result=additionalRawPlan({cohort,selection,seed:current?.randomSeed??randomBytes(32).toString('hex'),declaredAt:current?.declaredAt??new Date().toISOString(),prior:before,revisedPublicSpecOverrides});
 if(current||flag==='--verify'){
  assert.equal(readFileSync(protocolPath,'utf8'),json(result.protocol),'An additional declaration cannot be rewritten');
  assert.equal(readFileSync(registryPath,'utf8'),json(result.registry),'An additional task or trial cannot be rewritten');
 }else{
  writeFileSync(protocolPath,json(result.protocol),{flag:'wx'});writeFileSync(registryPath,json(result.registry),{flag:'wx'});
  const configuration={...prior.configuration,activeTaskByFamily:{...(prior.configuration.activeTaskByFamily??{})},revisions:[...(prior.configuration.revisions??[]),...result.revisions],cohorts:[...prior.cohorts.map(({taskCount,trialCount,experimentId,...rest})=>rest),{registry:registryPath,protocol:protocolPath,selection:selectionPath,registrySha256:rawSha(readFileSync(registryPath)),protocolSha256:rawSha(readFileSync(protocolPath)),trialsDirectory:`work/raw-explanation-${cohort}/trials`,grades:`work/raw-explanation-${cohort}/grades.json`}]};
  for(const revision of result.revisions)configuration.activeTaskByFamily[revision.familyId]=revision.activeTaskId;
  writeFileSync(COHORTS_PATH,json(configuration));
 }
 console.log(JSON.stringify({experimentId:result.registry.experimentId,tasks:result.registry.tasks.length,trials:result.registry.trials.length,registryPath,protocolPath}));
}
