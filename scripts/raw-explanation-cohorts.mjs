// A later observation never replaces or rewrites a declared original trial.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {rawSha} from './analyze-raw-explanations.mjs';

export const COHORTS_PATH='research/raw-explanation-cohorts.json';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
export function loadRawCohorts({configPath=COHORTS_PATH}={}){
 const configuration=existsSync(configPath)?read(configPath):{schemaVersion:2,cohorts:[{
  registry:'research/raw-explanation-registry.json',protocol:'research/raw-explanation-protocol.json',
  trialsDirectory:'work/raw-explanation-calibration/trials',grades:'work/raw-explanation-calibration/grades-fixed.json'
 }],activeTaskByFamily:{},revisions:[]};
 assert.equal(configuration.schemaVersion,2);
 const tasks=new Map(),trials=new Map(),trialDirectories=new Map(),bindings=new Map(),cohorts=[];
 let registry=null,protocol=null;
 for(const cohort of configuration.cohorts){
  const registryBytes=readFileSync(cohort.registry),protocolBytes=readFileSync(cohort.protocol);
  const r=JSON.parse(registryBytes),p=JSON.parse(protocolBytes);
  assert.equal(r.experimentId,p.experimentId);
  const registrySha256=rawSha(registryBytes),protocolSha256=rawSha(protocolBytes);
  if(cohort.registrySha256)assert.equal(registrySha256,cohort.registrySha256);
  if(cohort.protocolSha256)assert.equal(protocolSha256,cohort.protocolSha256);
  if(!registry){registry={...r,tasks:[],trials:[]};protocol=p;}
  for(const task of r.tasks){
   if(tasks.has(task.id))assert.deepEqual(tasks.get(task.id),task,'A repeated task ID cannot acquire a revised contract');
   else tasks.set(task.id,task);
  }
  for(const trial of r.trials){
   assert.ok(!trials.has(trial.id),'An additional trial needs a new immutable identity');
   trials.set(trial.id,trial);trialDirectories.set(trial.id,cohort.trialsDirectory);
   bindings.set(trial.id,{registrySha256,protocolSha256,experimentId:r.experimentId,declaredAt:p.declaredAt});
  }
  cohorts.push({...cohort,experimentId:r.experimentId,registrySha256,protocolSha256,taskCount:r.tasks.length,trialCount:r.trials.length});
 }
 assert.ok(registry,'At least one declared observation cohort is required');
 registry.tasks=[...tasks.values()];registry.trials=[...trials.values()];
 for(const [familyId,taskId] of Object.entries(configuration.activeTaskByFamily??{}))assert.equal(tasks.get(taskId)?.familyId,familyId,'Active contract must identify its actual family');
 return {configuration,cohorts,registry,protocol,trialDirectories,bindings,
  activeTaskByFamily:configuration.activeTaskByFamily??{},
  observationPath:trial=>resolve(trialDirectories.get(trial.id),`${trial.id}.submission.json`),
  runDirectories:[...new Set([...trialDirectories.values()].map(dirname))]};
}
