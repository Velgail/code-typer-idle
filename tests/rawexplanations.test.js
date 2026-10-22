import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRawExplanations,rawMetrics,rawSha,validateRawAssessment,validateRawRecord} from '../scripts/analyze-raw-explanations.mjs';

function fixture(){
 const tasks=[{id:'opaque-app',kind:'application',analysisKind:'application',sourceId:'real-app',language:'cpp',publicSpec:{title:'App contract'},cases:[{args:[],expected:3}],promptSha256:'public-app'},
  {id:'opaque-game',kind:'challenge',analysisKind:'challenge',familyId:'test/family',sourceId:'test/game',language:'cpp',publicSpec:{title:'Game contract'},cases:[{args:[],expected:3}],promptSha256:'public-game'}];
 const trials=tasks.map((t,i)=>({id:`opaque-${i}`,taskId:t.id,requestedModel:'gpt-6.1-sol',requestedReasoningEffort:'low',cohort:'primary',independentTrial:1}));
 const submissions=trials.map((plan,i)=>{
  const task=tasks[i],explanation='合計は3である。空白\nと日本語、😀も原文のまま保存する。',source='int result(){return 3;}';
  const seconds=i?12:20;
  const observed={...plan,promptSha256:task.promptSha256,observerBootId:'same-boot',registrySha256:'new-manifest',protocolSha256:'new-protocol',
   explanationSha256:rawSha(explanation),sourceSha256:rawSha(source),rawExplanationMetrics:rawMetrics(explanation),
   startedMonotonicNs:'1000000000000000000',endedMonotonicNs:String(1000000000000000000n+BigInt(seconds)*1000000000n),
   implementationEndedMonotonicNs:String(1000000000000000000n+BigInt(seconds+5)*1000000000n),
   startedUnixNs:'2000000000000000000',endedUnixNs:String(2000000000000000000n+BigInt(seconds)*1000000000n),
   timing:{valid:true,elapsedSeconds:seconds}};
  const record=JSON.stringify(observed);
  return {...observed,language:'cpp',explanation,source,recordedSubmissionJson:record,submissionSha256:rawSha(record),
   taskSha256:rawSha(JSON.stringify(task)),casesSha256:rawSha(JSON.stringify(task.cases)),accepted:true,category:'accepted',cases:[{id:'1',expected:3,actual:3,passed:true}]};
 });
 const assessments=submissions.flatMap(row=>['independent-a','independent-b'].map(assessor=>({assessor,trialId:row.id,explanationSha256:row.explanationSha256,sourceSha256:row.sourceSha256,accepted:true,implementationConsistent:true,claims:[{quote:'合計は3である。',verdict:'supported',reason:'The explanation supplies the contract result.'}],issues:[]})));
 return {registry:{experimentId:'entirely-new',tasks,trials,applicationTaskIds:['opaque-app']},grades:{submissions},reviews:{assessments,resolutions:[]},commonWorkAnchor:100,anchorPolicy:{kind:'separate-game-policy'}};
}

test('raw counts describe actual Unicode text including whitespace and original UTF-8 bytes',()=>{
 const text='説明\r\nA\t😀 e\u0301\u0085\ufeff\u001c\n',m=rawMetrics(text);
 assert.equal(m.unicodeCharacters,[...text].length);
 assert.equal(m.utf8Bytes,Buffer.byteLength(text));
 assert.equal(rawMetrics('\u0085\ufeff\u001c').charactersExcludingUnicodeWhiteSpace,2);
 assert.ok(m.utf8Bytes>m.unicodeCharacters);
});

test('reviewed summaries cannot replace the original answer or supply its character count',()=>{
 const f=fixture(),row=f.grades.submissions[0],a=f.reviews.assessments[0];
 assert.doesNotThrow(()=>validateRawAssessment(a,row));
 for(const key of ['normalizedSolution','summary','rewrittenExplanation','explanatoryCharacters'])assert.throws(()=>validateRawAssessment({...a,[key]:'shorter replacement'},row));
 assert.throws(()=>validateRawAssessment({...a,claims:[{quote:'invented proof not in original',verdict:'supported',reason:'fabricated'}]},row));
});

test('direct elapsed observations reproduce rewards; no answer/source size or authored minute inputs',()=>{
 const f=fixture(),first=analyzeRawExplanations(f),game=first.familyRewards[0];
 assert.equal(game.baseWorkUnits,60);assert.equal(first.summary.predictedFamilies,0);
 assert.equal(game.statistic,'single observation');
 assert.equal(first.trials[1].rawExplanationMetrics.unicodeCharacters,[...f.grades.submissions[1].explanation].length);
 const row=f.grades.submissions[1],record=JSON.parse(row.recordedSubmissionJson);
 row.explanation+=' 長い原文。'.repeat(100);row.source+='\n// irrelevant code length'.repeat(100);
 row.explanationSha256=record.explanationSha256=rawSha(row.explanation);row.sourceSha256=record.sourceSha256=rawSha(row.source);
 row.rawExplanationMetrics=record.rawExplanationMetrics=rawMetrics(row.explanation);row.recordedSubmissionJson=JSON.stringify(record);row.submissionSha256=rawSha(row.recordedSubmissionJson);
 for(const a of f.reviews.assessments.filter(a=>a.trialId===row.id)){a.explanationSha256=row.explanationSha256;a.sourceSha256=row.sourceSha256;}
 f.registry.tasks[1].estimatedMinutes=900;f.registry.tasks[1].difficulty=7;
 row.taskSha256=rawSha(JSON.stringify(f.registry.tasks[1]));
 assert.equal(analyzeRawExplanations(f).familyRewards[0].baseWorkUnits,game.baseWorkUnits);
});

test('original record, precise clock, problem, fixture and actual result tampering are detected',()=>{
 const f=fixture(),row=f.grades.submissions[0],plan=f.registry.trials[0],task=f.registry.tasks[0];
 assert.doesNotThrow(()=>validateRawRecord(row,plan,task));
 for(const change of [r=>r.explanation+=' altered',r=>r.source+=' altered',r=>r.taskSha256='wrong',r=>r.casesSha256='wrong',r=>r.cases[0].actual=0,r=>r.recordedSubmissionJson+=' ']){
  const altered=structuredClone(row);change(altered);assert.throws(()=>validateRawRecord(altered,plan,task));
 }
 const altered=structuredClone(row),record=JSON.parse(altered.recordedSubmissionJson);record.endedMonotonicNs='1000000000000000001';altered.recordedSubmissionJson=JSON.stringify(record);altered.submissionSha256=rawSha(altered.recordedSubmissionJson);
 assert.throws(()=>validateRawRecord(altered,plan,task));
});

test('missing or entirely failed families cannot acquire a prediction, old reward, or zero fallback',()=>{
 const f=fixture();f.grades.submissions.pop();assert.throws(()=>analyzeRawExplanations(f),/Missing\/extra/);
 const g=fixture();g.grades.submissions[1].accepted=false;assert.throws(()=>analyzeRawExplanations(g),/no valid direct observation/);
});

test('a third verdict applies to either semantic or implementation-consistency disagreement',()=>{
 const f=fixture(),row=f.grades.submissions[1];
 const review=f.reviews.assessments.find(a=>a.trialId===row.id&&a.assessor==='independent-b');review.implementationConsistent=false;
 assert.throws(()=>analyzeRawExplanations(f),/unresolved/);
 const third={...structuredClone(review),assessor:'third-reviewer',accepted:false,claims:[{quote:'合計は3である。',verdict:'missing',reason:'The required general argument is absent.'}]};
 f.reviews.resolutions=[third];assert.throws(()=>analyzeRawExplanations(f),/no valid direct observation/);
});

test('an original that was never received remains null, with no fabricated text, clock endpoint or review',()=>{
 const f=fixture(),task=f.registry.tasks[0];
 const plan={id:'opaque-missing',taskId:task.id,requestedModel:'gpt-6-luna',requestedReasoningEffort:'low',cohort:'comparison',independentTrial:1};
 f.registry.trials.push(plan);
 const start={...plan,promptSha256:task.promptSha256,registrySha256:'new-manifest',protocolSha256:'new-protocol',startedMonotonicNs:'1000000000000000000',startedUnixNs:'2000000000000000000'};
 const recordedStartJson=JSON.stringify(start),startSha256=rawSha(recordedStartJson);
 const failure={trialId:plan.id,startSha256,receivedOriginalExplanation:false,receivedImplementation:false,reason:'Original stdin never finalized; no endpoint or source was received.'};
 const incompleteFailureJson=JSON.stringify(failure);
 f.grades.submissions.push({...start,language:'cpp',phaseIncomplete:true,explanation:null,source:null,explanationSha256:null,sourceSha256:null,rawExplanationMetrics:null,
  recordedStartJson,startSha256,incompleteFailureJson,incompleteFailureSha256:rawSha(incompleteFailureJson),accepted:false,category:'incomplete-observation',taskSha256:rawSha(JSON.stringify(task)),casesSha256:rawSha(JSON.stringify(task.cases))});
 const result=analyzeRawExplanations(f),missing=result.trials.find(t=>t.id===plan.id);
 assert.equal(missing.elapsedExplanationSeconds,null);assert.equal(missing.explanationFile,null);
 assert.equal(missing.rawExplanationMetrics.unicodeCharacters,null);assert.equal(missing.usedForReward,false);
 assert.deepEqual(missing.reviewers,[]);assert.equal(result.familyRewards[0].baseWorkUnits,60);
 const falsified=structuredClone(f);falsified.grades.submissions.at(-1).explanation='fabricated recovered answer';
 assert.throws(()=>analyzeRawExplanations(falsified));
});

test('an explicit delivery failure can disqualify an interval without rewriting its measured wall time',()=>{
 const f=fixture(),row=f.grades.submissions[1];
 const qualification={trialId:row.id,explanationSha256:row.explanationSha256,reason:'Documented stdin EOF intervention during the explanation interval.'};
 // A failed sole primary interval cannot be silently reused or predicted.
 assert.throws(()=>analyzeRawExplanations({...f,observationQualifications:[qualification]}),/no valid direct observation/);
 assert.equal(row.timing.elapsedSeconds,12);
});

test('a revised public contract receives a new task and trial while every old observation remains visible',()=>{
 const f=fixture(),old=structuredClone(f.grades.submissions[1]),task={...structuredClone(f.registry.tasks[1]),id:'new-contract-task',promptSha256:'new-public-contract',publicSpec:{title:'Explicitly revised public contract'}};
 const plan={...f.registry.trials[1],id:'additional-original',taskId:task.id};
 const row={...structuredClone(old),...plan,promptSha256:task.promptSha256,taskSha256:rawSha(JSON.stringify(task))};
 const observer={...JSON.parse(old.recordedSubmissionJson),...plan,promptSha256:task.promptSha256};
 observer.endedMonotonicNs='1000000018000000000';observer.endedUnixNs='2000000018000000000';observer.implementationEndedMonotonicNs='1000000020000000000';observer.timing.elapsedSeconds=18;
 Object.assign(row,observer);row.recordedSubmissionJson=JSON.stringify(observer);row.submissionSha256=rawSha(row.recordedSubmissionJson);
 f.registry.tasks.push(task);f.registry.trials.push(plan);f.grades.submissions.push(row);
 f.reviews.assessments.push(...f.reviews.assessments.filter(a=>a.trialId===old.id).map(a=>({...a,trialId:plan.id})));
 const result=analyzeRawExplanations({...f,activeTaskByFamily:{'test/family':task.id}});
 assert.equal(result.familyRewards.length,1);assert.equal(result.familyRewards[0].taskId,task.id);assert.equal(result.familyRewards[0].baseWorkUnits,90);
 assert.equal(result.trials.length,3);assert.equal(result.trials.find(t=>t.id===old.id).usedForReward,false);
 assert.equal(result.trials.find(t=>t.id===old.id).elapsedExplanationSeconds,12);
 assert.ok(result.trials.find(t=>t.id===old.id).exclusionReasons.includes('public contract superseded; original retained'));
 assert.deepEqual(f.grades.submissions[1],old);
});
