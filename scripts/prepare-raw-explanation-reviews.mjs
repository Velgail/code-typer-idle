// Produce review packets without model names, clocks, counts or rewards.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rawSha} from './analyze-raw-explanations.mjs';
import {loadRawCohorts} from './raw-explanation-cohorts.mjs';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const json=value=>JSON.stringify(value,null,2)+'\n';

export function prepareRawReviewPackets({batchSize=12}={}){
 const cohortSet=loadRawCohorts(),{registry}=cohortSet;
 const tasks=new Map(registry.tasks.map(t=>[t.id,t]));
 const directory=resolve(ROOT,'work/raw-explanation-calibration'),packetsPath=resolve(directory,'review-packets');
 mkdirSync(packetsPath,{recursive:true});mkdirSync(resolve(directory,'reviews'),{recursive:true});
 const assigned=new Set();
 for(const name of readdirSync(packetsPath).filter(n=>n.endsWith('.json'))){const packet=read(resolve(packetsPath,name));for(const t of packet.answers)assigned.add(`${packet.pass}/${t.trialId}`);}
 const rows=registry.trials.flatMap(plan=>{const path=cohortSet.observationPath(plan);return existsSync(path)?[read(path)]:[];});
 const created=[];
 for(const pass of ['a','b']){
  const pending=rows.filter(r=>!assigned.has(`${pass}/${r.id}`));
  for(let offset=0;offset<pending.length;offset+=batchSize){
   const group=pending.slice(offset,offset+batchSize),id=`original-review-${pass}-${rawSha(group.map(r=>r.id).join('\n')).slice(0,12)}`;
   const packet={schemaVersion:2,id,pass,
    instructions:{role:'Evaluate each exact original public educational explanation, without rewriting or summarizing it. You are an independent reviewer. Never read registry, solver metadata, old reports, times, model names, other reviewer output or unrelated files.',
     acceptance:'Accept an explanation only if its stated method solves the full public contract, its mathematical/logical claims are correct and sufficiently justified for the stated reader, and important domain/boundary cases are addressed. Different valid methods are allowed; shortness is not an error. A named advanced technique without the relevant invariant or correctness argument is insufficient. Correct code alone cannot rescue a missing or false explanation.',
     consistency:'Assess separately whether the exact implementation follows what the explanation claims. Do not modify answers or infer that code passed tests.',
     complexity:'Use ordinary asymptotic Big-O over growing positive dimensions. A stronger uniform operation bound over zero axes was not specified. Do not reject solely for omitting additive zero-dimension initialization/output terms; actual incorrect complexity or missing input storage still matters.',
     evidence:'Each assessment must cite at least one exact nonempty substring of the original explanation. Every rejected/missing claim must be explained with a relevant original quote. No normalizedSolution, summary, rewrittenExplanation or character-count field is permitted.',
     schema:{assessor:id,trialId:'from answer',explanationSha256:'from answer',sourceSha256:'from answer',accepted:'boolean',implementationConsistent:'boolean',claims:[{quote:'exact substring',verdict:'supported|error|missing',reason:'why this claim suffices or fails in this public contract'}],issues:['specific defects, empty if none']},
     outputFile:`work/raw-explanation-calibration/reviews/${id}.json`,output:'Save {schemaVersion:2,assessments:[...]} as new UTF-8 JSON with exclusive creation. Do not write other files. All answers must be assessed; retain rejection honestly.'},
    answers:group.map(row=>{
     const explanation=readFileSync(resolve(ROOT,row.explanationPath),'utf8'),source=readFileSync(resolve(ROOT,row.sourcePath),'utf8');
     assert.equal(rawSha(explanation),row.explanationSha256);assert.equal(rawSha(source),row.sourceSha256);
     return {trialId:row.id,publicProblem:tasks.get(row.taskId).publicSpec,explanation,source,explanationSha256:row.explanationSha256,sourceSha256:row.sourceSha256};
    })};
   const path=resolve(packetsPath,`${id}.json`);assert.ok(!existsSync(path));writeFileSync(path,json(packet),{flag:'wx'});created.push({id,path,pass,answers:group.length});
  }
 }
 return {completedSubmissions:rows.length,created};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareRawReviewPackets()));
