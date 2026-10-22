import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rawSha,validateRawAssessment} from './analyze-raw-explanations.mjs';
import {loadRawCohorts} from './raw-explanation-cohorts.mjs';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const json=value=>JSON.stringify(value,null,2)+'\n';

export function collectRawReviews({partial=false}={}){
 const cohortSet=loadRawCohorts(),{registry}=cohortSet,directory='work/raw-explanation-calibration';
 const planned=new Map(registry.trials.map(p=>[p.id,p])),tasks=new Map(registry.tasks.map(t=>[t.id,t])),rows=new Map();
 const missingOriginals=new Set();
 for(const runDirectory of cohortSet.runDirectories){const failureDirectory=`${runDirectory}/protocol-failures`;
 if(existsSync(failureDirectory))for(const name of readdirSync(failureDirectory).filter(n=>n.endsWith('.json'))){
  const failure=read(`${failureDirectory}/${name}`);assert.equal(failure.receivedOriginalExplanation,false);assert.ok(planned.has(failure.trialId));missingOriginals.add(failure.trialId);
 }}
 for(const plan of registry.trials){
  const path=cohortSet.observationPath(plan);if(!existsSync(path))continue;
  const record=read(path);rows.set(plan.id,{...record,explanation:readFileSync(record.explanationPath,'utf8'),source:readFileSync(record.sourcePath,'utf8')});
 }
 const assessments=[],byTrial=new Map();
 for(const name of readdirSync(`${directory}/reviews`).filter(n=>n.endsWith('.json')).sort()){
  const packet=read(`${directory}/review-packets/${name}`),result=read(`${directory}/reviews/${name}`);
  assert.equal(result.assessments.length,packet.answers.length,'Every assigned answer needs one verdict');
  const seen=new Set();
  for(const a of result.assessments){
   assert.equal(a.assessor,packet.id);assert.ok(packet.answers.some(r=>r.trialId===a.trialId));
   assert.ok(!seen.has(a.trialId));seen.add(a.trialId);assert.ok(planned.has(a.trialId));
   const row=rows.get(a.trialId);assert.ok(row);validateRawAssessment(a,row);
   assert.equal(rawSha(row.explanation),row.explanationSha256);assert.equal(rawSha(row.source),row.sourceSha256);
   const list=byTrial.get(a.trialId)??[];assert.ok(!list.some(r=>r.pass===packet.pass),'Duplicate independent pass');
   list.push({pass:packet.pass,...a});byTrial.set(a.trialId,list);assessments.push(a);
  }
 }
 const resolutionDirectory=`${directory}/resolutions`;mkdirSync(resolutionDirectory,{recursive:true});
 const resolutionEvidence=[];
 const preserveDecisionFile=path=>{const rawJson=readFileSync(path,'utf8');resolutionEvidence.push({path,rawJson,sha256:rawSha(rawJson)});return JSON.parse(rawJson);};
 const originalResolutions=readdirSync(resolutionDirectory).filter(n=>n.endsWith('.json')).sort().flatMap(n=>preserveDecisionFile(`${resolutionDirectory}/${n}`).assessments);
 const resolutionMap=new Map();
 for(const a of originalResolutions){assert.ok(!resolutionMap.has(a.trialId));validateRawAssessment(a,rows.get(a.trialId));assert.ok(!(byTrial.get(a.trialId)??[]).some(r=>r.assessor===a.assessor));resolutionMap.set(a.trialId,a);}
 const correctionDirectory=`${directory}/resolution-corrections`,resolutionAmendments=[];
 const pending=existsSync(correctionDirectory)?readdirSync(correctionDirectory).filter(n=>n.endsWith('.json')).sort().map(name=>({path:`${correctionDirectory}/${name}`,amendment:preserveDecisionFile(`${correctionDirectory}/${name}`)})):[];
 const heads=new Map([...resolutionMap.keys()].map(id=>[id,rawSha(readFileSync(`${resolutionDirectory}/${id}.json`))]));
 while(pending.length){
  const candidates=pending.filter(({amendment:a})=>heads.get(a.trialId)===a.supersedesSha256);
  assert.ok(candidates.length,'Amendment chain must identify an existing predecessor without cycles');
  for(const {amendment:a} of candidates)assert.equal(candidates.filter(({amendment:b})=>a.trialId===b.trialId).length,1,'Amendment chain must not fork');
  const entry=candidates[0],{amendment,path}=entry,id=amendment.trialId;
  assert.ok(resolutionMap.has(id));
  assert.ok(typeof amendment.reason==='string'&&amendment.reason.trim());assert.equal(amendment.assessment.trialId,id);
  assert.equal(amendment.assessment.assessor,resolutionMap.get(id).assessor,'Only the same assessor can correct its own transcription or judgement');
  validateRawAssessment(amendment.assessment,rows.get(id));resolutionAmendments.push(amendment);resolutionMap.set(id,amendment.assessment);heads.set(id,rawSha(readFileSync(path)));pending.splice(pending.indexOf(entry),1);
 }
 const resolutions=[...resolutionMap.values()];
 const missing=registry.trials.filter(p=>!missingOriginals.has(p.id)&&(byTrial.get(p.id)?.length??0)<2).map(p=>p.id),unresolved=[];
 const adjudicationDirectory=`${directory}/adjudication-packets`;mkdirSync(adjudicationDirectory,{recursive:true});
 for(const [id,list] of byTrial){
  if(list.length!==2)continue;
  if(list[0].accepted===list[1].accepted&&list[0].implementationConsistent===list[1].implementationConsistent)continue;
  if(resolutionMap.has(id))continue;
  unresolved.push(id);const path=`${adjudicationDirectory}/${id}.json`;
  const row=rows.get(id),task=tasks.get(planned.get(id).taskId);
  if(!existsSync(path))writeFileSync(path,json({schemaVersion:2,trialId:id,publicProblem:task.publicSpec,explanation:row.explanation,source:row.source,explanationSha256:row.explanationSha256,sourceSha256:row.sourceSha256,
   instructions:'Resolve the exact original explanation and code against the public contract. Do not rewrite the answer, consult hidden metadata, or infer acceptance from code. Return one independent assessment with assessor original-resolution-<trialId>, trialId, original hashes, accepted, implementationConsistent, claims[{quote:exact original substring,verdict:supported|error|missing,reason}],issues. Decide both booleans independently; no summary/normalized text. Empty-original exception permits no fabricated quotes. Save {schemaVersion:2,assessments:[assessment]} exclusively to '+resolutionDirectory+'/'+id+'.json.'}),{flag:'wx'});
 }
 if(!partial){assert.deepEqual(missing,[],'Original answers lack two independent reviews');assert.deepEqual(unresolved,[],'Unresolved independent review disagreements');}
 return {schemaVersion:2,experimentId:registry.experimentId,scope:'Exact original answers only; no reviewer rewriting or length measurements.',
  blindness:'Independent review packets omit model, time, rewards, original length counts and other reviewer results. The initial four resolution packets disclosed both arguments without model/time/reward. A subsequent mathematical methodology audit clarified ordinary asymptotic complexity conventions; original decisions and any argument-aware amendments remain preserved as a hash-linked chain.',
  assessments,resolutions,originalResolutions,resolutionAmendments,resolutionEvidence,coverage:{expectedTrials:registry.trials.length,reviewedTrials:byTrial.size,independentAssessments:assessments.length,resolutions:resolutions.length,missingOriginalTrials:[...missingOriginals],missing,unresolved,complete:missing.length===0&&unresolved.length===0}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=collectRawReviews({partial:process.argv.includes('--partial')});
 const destination=process.argv.includes('--partial')?'work/raw-explanation-calibration/reviews-partial.json':'research/raw-explanation-assessments.json';
 writeFileSync(destination,json(result));console.log(JSON.stringify({destination,reviewedTrials:result.coverage.reviewedTrials,assessments:result.assessments.length,resolutions:result.resolutions.length,unresolved:result.coverage.unresolved}));
}
