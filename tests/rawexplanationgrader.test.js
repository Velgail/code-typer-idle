import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,mkdir,readFile,rm,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {challengeCatalog} from '../src/challengecatalog.js';
import {loadRawSubmissions,assertRawTaskSnapshot,retainAllRawCases,summarizeRawGrades,gradeRawExplanationDirectory} from '../scripts/grade-raw-explanations.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
async function fixture(t,{kind='application',source='bool result() { return false; }\n',explanation='  原文を要約しない。\n数式 tan(1°)、絵文字🧮も保持する。\n'.repeat(2000)}={}){
 const root=await mkdtemp(join(tmpdir(),'cti-raw-evidence-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const trials=join(root,'trials');await mkdir(trials);
 const task={id:'task_opaque',kind,analysisKind:'control',language:'cpp',promptSha256:'public-prompt-hash',
  publicSpec:{entryPoint:'result',parameters:[],returnType:'bool'},cases:[{id:'case-1',args:[],expected:false}]};
 const plan={id:'trial_opaque',taskId:task.id,language:'cpp',requestedModel:'test-model',requestedReasoningEffort:'low',independentTrial:1,cohort:'primary',plannedOrder:0};
 const sourcePath=join(trials,'trial_opaque.answer.cpp'),explanationPath=join(trials,'trial_opaque.explanation.md'),recordPath=join(trials,'trial_opaque.submission.json');
 await writeFile(sourcePath,source);await writeFile(explanationPath,explanation);
 const record={schemaVersion:2,...plan,promptSha256:task.promptSha256,sourcePath,explanationPath,sourceSha256:sha(source),explanationSha256:sha(explanation),startedUnixNs:1792600000000000000};
 const recordRaw=JSON.stringify(record,null,2)+'\n';await writeFile(recordPath,recordRaw);
 const registry={schemaVersion:2,tasks:[task],trials:[plan]},registryPath=join(root,'registry.json');
 await writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
 return {root,trials,task,plan,source,explanation,sourcePath,explanationPath,recordPath,record,recordRaw,registry,registryPath};
}

test('raw evidence reader preserves complete Unicode/whitespace and exact observer JSON bytes',async t=>{
 const f=await fixture(t),result=await loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root});
 assert.equal(result.rows[0].explanation,f.explanation);
 assert.equal(result.rows[0].source,f.source);
 assert.equal(result.rows[0].recordedSubmissionJson,f.recordRaw);
 assert.equal(result.rows[0].submissionSha256,sha(f.recordRaw));
 assert.deepEqual(result.missingTrialIds,[]);
});

test('raw evidence reader rejects altered answers and mislabelled model assignments',async t=>{
 const f=await fixture(t);
 await writeFile(f.sourcePath,f.source+'// changed\n');
 await assert.rejects(()=>loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root}),/source hash differs/);
 await writeFile(f.sourcePath,f.source);
 await writeFile(f.recordPath,JSON.stringify({...f.record,requestedModel:'substituted-model'}));
 await assert.rejects(()=>loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root}),/planned requestedModel differs/);
});

test('raw evidence reader rejects outside-trial files and unplanned submissions',async t=>{
 const f=await fixture(t),outside=join(f.root,'outside.cpp');await writeFile(outside,f.source);
 await writeFile(f.recordPath,JSON.stringify({...f.record,sourcePath:outside}));
 await assert.rejects(()=>loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root}),/outside trials directory/);
 await writeFile(f.recordPath,JSON.stringify({...f.record,id:'not-planned'}));
 await assert.rejects(()=>loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root}),/Unplanned submission/);
});

test('production snapshot binding rejects changed hidden fixtures and starter source',()=>{
 const q=challengeCatalog().find(q=>q.language==='cpp');
 const task={id:'opaque',sourceId:q.id,language:q.language,cases:structuredClone(q.cases),publicSpec:{starterSource:q.starterSource,parameters:structuredClone(q.parameters),resultType:q.resultType??'int'}};
 assert.equal(assertRawTaskSnapshot(task).id,q.id);
 const wrong=structuredClone(task);wrong.cases[0].expected=['fabricated'];
 assert.throws(()=>assertRawTaskSnapshot(wrong),/frozen fixtures differ/);
 task.publicSpec.starterSource+='\n';
 assert.throws(()=>assertRawTaskSnapshot(task),/public starter differs/);
});

test('compile failures keep every expected value and distinguish unavailable results',()=>{
 const task={id:'task',cases:[{id:'empty',args:[],expected:[]},{id:'large',args:[],expected:Array.from({length:20000},(_,i)=>i)}]};
 const cases=retainAllRawCases(task,[],false);
 assert.equal(cases.length,2);assert.deepEqual(cases[1].expected,task.cases[1].expected);
 assert.equal(cases[0].actual,null);assert.equal(cases[0].resultAvailable,false);
 assert.throws(()=>retainAllRawCases(task,[{id:'empty',expected:[],actual:[],passed:true}],true),/accepted with missing/);
 assert.throws(()=>retainAllRawCases(task,[{id:'large',expected:[],actual:[],passed:true}],false),/returned expected value differs/);
});

test('frozen JSON numeric zero matches JS negative zero without relaxing a different fixture value',()=>{
 const q={id:'zero-fixture',language:'cpp',parameters:[],resultType:'array',starterSource:'',referenceSource:'',cases:[{id:'zero',args:[[-0]],expected:[-0]}]};
 const task={id:'opaque-zero',sourceId:q.id,language:'cpp',publicSpec:{starterSource:'',parameters:[],resultType:'array'},cases:[{id:'zero',args:[[0]],expected:[0]}]};
 assert.doesNotThrow(()=>assertRawTaskSnapshot(task,q));
 assert.doesNotThrow(()=>retainAllRawCases(task,[{id:'zero',expected:[-0],actual:[0],passed:true}],true));
 const wrong=structuredClone(task);wrong.cases[0].expected=[1];
 assert.throws(()=>assertRawTaskSnapshot(wrong,q),/frozen fixtures differ/);
 assert.throws(()=>retainAllRawCases(task,[{id:'zero',expected:[1],actual:[1],passed:true}],true),/returned expected value differs/);
});

test('coverage summary never calls a partial report complete',()=>{
 const registry={trials:[{id:'one'},{id:'two'}]},rows=[{id:'one',accepted:false,category:'compile-error',caseCount:1,cases:[{resultAvailable:false}]}];
 assert.deepEqual(summarizeRawGrades(registry,rows),{expectedTrials:2,total:1,accepted:0,rejected:1,plannedCases:1,reportedCases:0,byCategory:{'compile-error':1},complete:false,missingTrialIds:['two']});
});

test('a missing original has a start record and null counts, never a fabricated endpoint or empty answer',async t=>{
 const f=await fixture(t);await unlink(f.recordPath);await unlink(f.sourcePath);await unlink(f.explanationPath);
 const startPath=join(f.trials,`${f.plan.id}.start.json`),startRaw=JSON.stringify({...f.plan,promptSha256:f.task.promptSha256,startedMonotonicNs:'12345'})+'\n';
 await writeFile(startPath,startRaw);const failures=join(f.root,'protocol-failures');await mkdir(failures);
 const failure={trialId:f.plan.id,startPath,startSha256:sha(startRaw),receivedOriginalExplanation:false,receivedImplementation:false,reason:'Observation transport ended before receiving the original'};
 await writeFile(join(failures,`${f.plan.id}.json`),JSON.stringify(failure)+'\n');
 const {rows,missingTrialIds}=await loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root});
 assert.deepEqual(missingTrialIds,[]);assert.equal(rows.length,1);
 const row=rows[0];assert.equal(row.phaseIncomplete,true);assert.equal(row.explanation,null);assert.equal(row.source,null);assert.equal(row.rawExplanationMetrics,null);assert.equal(row.timing.elapsedSeconds,null);assert.equal(row.endedMonotonicNs,undefined);
 const summary=summarizeRawGrades(f.registry,[{...row,accepted:false,category:'incomplete-observation',caseCount:1,cases:[{resultAvailable:false}]}]);
 assert.equal(summary.complete,false);assert.equal(summary.allPlannedTrialsAccountedFor,true);assert.equal(summary.incompleteObservations,1);
 await writeFile(join(f.trials,`${f.plan.id}.reasoning.json`),'{}');
 await assert.rejects(()=>loadRawSubmissions({registry:f.registry,trialsPath:f.trials,root:f.root}),/frozen explanation cannot be declared missing/);
});

test('native control replay retains raw evidence and rejects an incorrect constant',async t=>{
 const f=await fixture(t,{source:'bool result() { return true; }\n',explanation:'For the test, an intentionally wrong executable answer.\n'});
 const out=join(f.root,'report.json');
 const report=await gradeRawExplanationDirectory({registryPath:f.registryPath,trialsPath:f.trials,outputPath:out,log:()=>{}});
 assert.equal(report.schemaVersion,2);assert.equal(report.summary.complete,true);
 const row=report.submissions[0];
 assert.equal(row.accepted,false);assert.equal(row.category,'wrong-answer');
 assert.equal(row.explanation,f.explanation);assert.equal(row.source,f.source);assert.equal(row.recordedSubmissionJson,f.recordRaw);
 assert.equal(row.cases[0].expected,false);assert.equal(row.cases[0].actual,true);assert.equal(row.cases[0].resultAvailable,true);
 assert.equal('implementationCharacters' in row,false);
 assert.deepEqual(JSON.parse(await readFile(out,'utf8')),report);
 await writeFile(f.explanationPath,f.explanation+'changed');
 await assert.rejects(()=>gradeRawExplanationDirectory({registryPath:f.registryPath,trialsPath:f.trials,outputPath:out,merge:true,log:()=>{}}),/explanation hash differs/);
});

test('native syntax failures preserve compiler diagnostics and unexecuted expected cases',async t=>{
 const f=await fixture(t,{source:'bool result( { syntax error\n',explanation:'This deliberately malformed implementation tests failure retention.\n'});
 const report=await gradeRawExplanationDirectory({registryPath:f.registryPath,trialsPath:f.trials,outputPath:join(f.root,'failed.json'),log:()=>{}});
 const row=report.submissions[0];
 assert.equal(row.accepted,false);assert.equal(row.category,'compile-error');
 assert.notEqual(row.compilation.exitCode,0);assert.ok(row.compilation.stderr.length>0);
 assert.equal(row.cases.length,1);assert.equal(row.cases[0].expected,false);assert.equal(row.cases[0].resultAvailable,false);
});

test('incremental ID selections merge without losing original rows or asserting complete coverage early',async t=>{
 const f=await fixture(t,{explanation:'An unchanged infrastructure test explanation.\n'});
 const second={...f.plan,id:'trial_second',plannedOrder:1},secondRecord={...f.record,...second};
 f.registry.trials.push(second);await writeFile(f.registryPath,JSON.stringify(f.registry,null,2)+'\n');
 await writeFile(join(f.trials,second.id+'.submission.json'),JSON.stringify(secondRecord,null,2)+'\n');
 const out=join(f.root,'incremental.json');
 const initial=await gradeRawExplanationDirectory({registryPath:f.registryPath,trialsPath:f.trials,outputPath:out,ids:[f.plan.id],log:()=>{}});
 assert.equal(initial.summary.complete,false);assert.deepEqual(initial.summary.missingTrialIds,[second.id]);
 const combined=await gradeRawExplanationDirectory({registryPath:f.registryPath,trialsPath:f.trials,outputPath:out,ids:[second.id],merge:true,log:()=>{}});
 assert.equal(combined.summary.complete,true);assert.equal(combined.summary.accepted,2);
 assert.deepEqual(combined.submissions[0],initial.submissions[0]);
});
