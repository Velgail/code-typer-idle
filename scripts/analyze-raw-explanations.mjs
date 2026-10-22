// New observations only. Never summarize an answer, infer a missing time, or
// use implementation/explanation length to price a Challenge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const rawSha = value => createHash('sha256').update(value).digest('hex');
export const rawMetrics = text => ({
  unicodeCharacters:[...text].length,
  charactersExcludingUnicodeWhiteSpace:[...text.replace(/\p{White_Space}/gu,'')].length,
  utf8Bytes:Buffer.byteLength(text,'utf8')
});
export function median(values){
  assert.ok(values.length,'Cannot invent a median for an empty sample');
  const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
export function distribution(values){
  return values.length?{count:values.length,min:Math.min(...values),median:median(values),max:Math.max(...values)}:{count:0,min:null,median:null,max:null};
}

export function validateRawRecord(row,plan,task){
  for(const key of ['id','taskId','requestedModel','requestedReasoningEffort'])assert.equal(row[key],plan[key],`${plan.id}: ${key} does not match the declaration`);
  assert.equal(row.promptSha256,task.promptSha256,`${plan.id}: another public problem`);
  if(row.phaseIncomplete===true){
    assert.equal(row.explanation,null);assert.equal(row.source,null);assert.equal(row.rawExplanationMetrics,null);
    assert.equal(row.explanationSha256,null);assert.equal(row.sourceSha256,null);assert.equal(row.accepted,false);
    assert.equal(rawSha(row.recordedStartJson),row.startSha256,'Original start bytes changed');
    assert.equal(rawSha(row.incompleteFailureJson),row.incompleteFailureSha256,'Incomplete-observation declaration changed');
    const start=JSON.parse(row.recordedStartJson),failure=JSON.parse(row.incompleteFailureJson);
    assert.equal(failure.trialId,plan.id);assert.equal(failure.startSha256,row.startSha256);
    assert.equal(failure.receivedOriginalExplanation,false);assert.equal(failure.receivedImplementation,false);
    for(const key of ['id','taskId','requestedModel','requestedReasoningEffort','promptSha256','registrySha256','protocolSha256'])assert.equal(row[key],start[key]);
    assert.equal(row.taskSha256,rawSha(JSON.stringify(task)));assert.equal(row.casesSha256,rawSha(JSON.stringify(task.cases)));
    assert.equal(Object.hasOwn(start,'endedMonotonicNs'),false,'Do not discard an existing observation endpoint');
    return {observed:{...start,timing:{valid:false,failure:failure.reason}},seconds:null,metrics:{unicodeCharacters:null,utf8Bytes:null,charactersExcludingUnicodeWhiteSpace:null}};
  }
  assert.equal(typeof row.recordedSubmissionJson,'string','Exact observer record required');
  assert.equal(row.submissionSha256,rawSha(row.recordedSubmissionJson),'Observer record bytes changed');
  const observed=JSON.parse(row.recordedSubmissionJson);
  for(const key of ['id','taskId','promptSha256','explanationSha256','sourceSha256','observerBootId','registrySha256','protocolSha256'])assert.equal(row[key],observed[key],`${plan.id}: recorded ${key} changed`);
  assert.equal(typeof row.explanation,'string');assert.equal(typeof row.source,'string');
  assert.equal(rawSha(row.explanation),row.explanationSha256,'Original explanation bytes changed');
  assert.equal(rawSha(row.source),row.sourceSha256,'Original source bytes changed');
  assert.equal(row.taskSha256,rawSha(JSON.stringify(task)),'Graded task snapshot changed');
  assert.equal(row.casesSha256,rawSha(JSON.stringify(task.cases)),'Graded fixture snapshot changed');
  const metrics=rawMetrics(row.explanation);
  for(const [key,value] of Object.entries(metrics))assert.equal(observed.rawExplanationMetrics[key],value,`${plan.id}: raw ${key} differs from original answer`);
  for(const key of ['startedMonotonicNs','endedMonotonicNs','implementationEndedMonotonicNs','startedUnixNs','endedUnixNs']){
    assert.match(observed[key],/^\d+$/,'Nanosecond timestamps must be exact decimal strings');
    if(row[key]!==undefined)assert.equal(row[key],observed[key]);
  }
  const seconds=Number(BigInt(observed.endedMonotonicNs)-BigInt(observed.startedMonotonicNs))/1e9;
  const unixSeconds=Number(BigInt(observed.endedUnixNs)-BigInt(observed.startedUnixNs))/1e9;
  assert.ok(seconds>0&&Number.isFinite(seconds));
  assert.ok(Math.abs(seconds-observed.timing.elapsedSeconds)<1e-8,'Clock differs from recorded elapsed seconds');
  assert.ok(Math.abs(unixSeconds-seconds)<.1,'Wall and monotonic clocks disagree');
  assert.ok(BigInt(observed.implementationEndedMonotonicNs)>=BigInt(observed.endedMonotonicNs),'Source phase ended before explanation');
  assert.ok(observed.observerBootId,'Observer environment identity required');
  if(row.accepted){
    const expected=task.cases??task.fixtures;
    assert.ok(Array.isArray(row.cases)&&row.cases.length===expected.length,'Every expected test must have a result');
    row.cases.forEach((c,index)=>{
      assert.equal(c.passed,true,'Accepted code has a failing test');
      assert.deepEqual(c.expected,expected[index].expected,'Expected value differs from declared game fixtures');
      assert.deepEqual(c.actual,c.expected,'Actual value differs from expected value');
    });
  }
  return {observed,seconds,metrics};
}

export function validateRawAssessment(review,row){
  assert.equal(review.trialId,row.id,'Review identifies another answer');
  assert.equal(review.explanationSha256,row.explanationSha256,'Review is not bound to original explanation');
  assert.equal(review.sourceSha256,row.sourceSha256,'Review is not bound to original implementation');
  assert.equal(typeof review.accepted,'boolean');
  assert.equal(typeof review.implementationConsistent,'boolean');
  assert.ok(typeof review.assessor==='string'&&review.assessor.trim());
  assert.ok(Array.isArray(review.claims),'Review claims must be an array');
  if(row.explanation.length===0){
    assert.equal(review.accepted,false,'An empty original cannot have an accepted explanation');
    assert.equal(review.implementationConsistent,false,'No original explanation exists to compare');
    assert.equal(review.claims.length,0,'An empty original has no possible nonempty quote');
    assert.ok(Array.isArray(review.issues)&&review.issues.some(s=>typeof s==='string'&&s.trim()),'Explain the missing original without inventing a quote');
  }else assert.ok(review.claims.length,'Review needs exact evidence from the original answer');
  for(const claim of review.claims){
    assert.ok(typeof claim.quote==='string'&&claim.quote.length,'Evidence quote cannot be empty');
    assert.ok(row.explanation.includes(claim.quote),'Review quote is not a substring of the original answer');
    assert.ok(['supported','error','missing'].includes(claim.verdict));
    assert.ok(typeof claim.reason==='string'&&claim.reason.trim());
  }
  for(const forbidden of ['normalizedSolution','summary','rewrittenExplanation','explanatoryCharacters'])assert.equal(Object.hasOwn(review,forbidden),false,`A reviewer cannot supply ${forbidden}`);
  // A correct method may be contradicted by the separately submitted code.
  // In that case an exact explanation quote can evidence implementation error;
  // neither boolean is allowed to imply the other.
  if(review.accepted&&review.implementationConsistent)assert.ok(review.claims.every(c=>c.verdict==='supported'),'Accepted consistent explanation has an unmet or erroneous claim');
  return review;
}

export function analyzeRawExplanations({registry,grades,reviews,commonWorkAnchor,anchorPolicy,observationQualifications=[],activeTaskByFamily={}}){
  assert.ok(Number.isFinite(commonWorkAnchor)&&commonWorkAnchor>0);
  assert.ok(anchorPolicy&&typeof anchorPolicy==='object');
  const byTrial=new Map(grades.submissions.map(r=>[r.id,r]));
  assert.equal(byTrial.size,grades.submissions.length,'Duplicate observations');
  assert.equal(byTrial.size,registry.trials.length,'Missing/extra trials: no silent deletion of failed answers');
  const taskMap=new Map(registry.tasks.map(t=>[t.id,t]));
  const qualifications=new Map();
  for(const q of observationQualifications){
    assert.ok(byTrial.has(q.trialId),'Qualification identifies an unknown original');
    assert.ok(!qualifications.has(q.trialId),'Duplicate original-clock qualification');
    assert.equal(q.explanationSha256,byTrial.get(q.trialId).explanationSha256);
    assert.ok(typeof q.reason==='string'&&q.reason.trim());
    qualifications.set(q.trialId,q);
  }
  const assessmentMap=new Map();
  for(const r of reviews.assessments){
    assert.ok(byTrial.has(r.trialId),'Review of an undeclared trial');
    const list=assessmentMap.get(r.trialId)??[];
    assert.ok(!list.some(a=>a.assessor===r.assessor),'Duplicate reviewer');list.push(r);assessmentMap.set(r.trialId,list);
  }
  const resolutions=new Map((reviews.resolutions??[]).map(r=>[r.trialId,r]));
  const trials=registry.trials.map(plan=>{
    const row=byTrial.get(plan.id),task=taskMap.get(plan.taskId);
    assert.ok(row&&task);const {observed,seconds,metrics}=validateRawRecord(row,plan,task);
    const assessments=assessmentMap.get(plan.id)??[];
    const noOriginal=row.phaseIncomplete===true;
    if(!noOriginal)assert.ok(assessments.length>=2,`${plan.id}: fewer than two independent original-answer assessments`);
    else assert.equal(assessments.length,0,'No original was received, so no textual review can be fabricated');
    assessments.forEach(a=>validateRawAssessment(a,row));
    const divided=assessments.some(a=>a.accepted!==assessments[0].accepted||a.implementationConsistent!==assessments[0].implementationConsistent);
    let chosen=assessments,resolution=null;
    if(divided){
      resolution=resolutions.get(plan.id);assert.ok(resolution,`${plan.id}: unresolved review disagreement`);
      assert.ok(!assessments.some(a=>a.assessor===resolution.assessor),'Resolution must be independent');
      validateRawAssessment(resolution,row);chosen=[resolution];
    }
    const explanationAccepted=!noOriginal&&chosen.every(a=>a.accepted),implementationConsistent=!noOriginal&&chosen.every(a=>a.implementationConsistent);
    const qualification=qualifications.get(plan.id);
    const timingValid=observed.timing.valid===true&&!qualification;
    const accepted=explanationAccepted&&implementationConsistent&&row.accepted===true;
    const activeContract=!task.familyId||!activeTaskByFamily[task.familyId]||activeTaskByFamily[task.familyId]===task.id;
    return {id:plan.id,taskId:plan.taskId,experimentId:row.experimentId,model:plan.requestedModel,effort:plan.requestedReasoningEffort,
      cohort:plan.cohort,independentTrial:plan.independentTrial,
      rawExplanationMetrics:metrics,elapsedExplanationSeconds:seconds,
      explanationSha256:row.explanationSha256,sourceSha256:row.sourceSha256,
      phaseIncomplete:noOriginal,publicContractActive:activeContract,explanationFile:noOriginal?null:`raw-explanation-answers/${plan.id}.md`,sourceFile:noOriginal?null:`raw-explanation-answers/${plan.id}.${({cpp:'cpp',csharp:'cs',rust:'rs',go:'go',python:'py',java:'java',sql:'sql',lua:'lua'})[row.language]}`,
      codeAccepted:row.accepted===true,codeCategory:row.category,
      observationFailure:observed.timing.failure??null,implementationSubmissionFailure:observed.implementationSubmissionFailure??null,
      explanationAccepted,implementationConsistent,accepted,timingValid,observerClockValid:observed.timing.valid===true,qualification:qualification??null,
      usedForReward:plan.cohort==='primary'&&accepted&&timingValid&&activeContract,
      reviewers:assessments.map(a=>a.assessor),resolution:resolution?.assessor??null,
      exclusionReasons:[...(activeContract?[]:['public contract superseded; original retained']),...(plan.cohort==='primary'?[]:['comparison model; not reward input']),...(explanationAccepted?[]:['original explanation rejected']),...(implementationConsistent?[]:['original explanation and implementation not consistent']),...(row.accepted?[]:['executable implementation not accepted']),...(timingValid?[]:['invalid original observation: '+(qualification?.reason??observed.timing.failure??'unspecified')])]};
  });
  const tasks=registry.tasks.map(task=>{
    const rows=trials.filter(t=>t.taskId===task.id),primary=rows.filter(t=>t.cohort==='primary');
    const used=primary.filter(t=>t.usedForReward);
    const value=used.length?median(used.map(t=>t.elapsedExplanationSeconds)):null;
    return {id:task.id,sourceId:task.sourceId,familyId:task.familyId??null,
      kind:task.analysisKind??task.kind,language:task.language,title:task.publicSpec.title,
      activeContract:!task.familyId||!activeTaskByFamily[task.familyId]||activeTaskByFamily[task.familyId]===task.id,
      primaryTrials:primary.length,primaryAccepted:primary.filter(t=>t.accepted).length,
      validAcceptedPrimaryTrials:used.length,explanationTime:{statistic:used.length===1?'single observation':used.length?'median of accepted observations':'not measured',seconds:value,distribution:distribution(used.map(t=>t.elapsedExplanationSeconds))},
      originalAnswerCharacters:distribution(used.map(t=>t.rawExplanationMetrics.unicodeCharacters)),
      originalAnswerCharactersWithoutWhitespace:distribution(used.map(t=>t.rawExplanationMetrics.charactersExcludingUnicodeWhiteSpace)),
      comparison:rows.filter(t=>t.cohort==='comparison').map(t=>({id:t.id,model:t.model,accepted:t.accepted,codeAccepted:t.codeAccepted,explanationAccepted:t.explanationAccepted,elapsedExplanationSeconds:t.elapsedExplanationSeconds,timingValid:t.timingValid,observationFailure:t.observationFailure,qualification:t.qualification})),trialIds:rows.map(t=>t.id)};
  });
  const application=tasks.filter(t=>t.kind==='application');
  assert.equal(application.length,registry.applicationTaskIds.length);
  assert.deepEqual(application.map(t=>t.id).sort(),[...registry.applicationTaskIds].sort());
  for(const t of application)assert.ok(t.explanationTime.seconds>0,`${t.id}: no valid direct app observation`);
  const anchorSeconds=median(application.map(t=>t.explanationTime.seconds));
  const familyRewards=tasks.filter(t=>t.kind==='challenge'&&t.activeContract).map(t=>{
    assert.ok(t.explanationTime.seconds>0,`${t.familyId}: no valid direct observation; prediction/fallback prohibited`);
    const relativeEffort=t.explanationTime.seconds/anchorSeconds;
    return {familyId:t.familyId,taskId:t.id,canonicalId:t.sourceId,canonicalLanguage:t.language,
      basis:'direct-raw-explanation-observation',elapsedExplanationSeconds:t.explanationTime.seconds,
      validAcceptedTrials:t.validAcceptedPrimaryTrials,statistic:t.explanationTime.statistic,
      relativeEffort,baseWorkUnits:Math.max(1,Math.round(commonWorkAnchor*relativeEffort)),
      rawTrialIds:t.trialIds};
  });
  assert.equal(new Set(familyRewards.map(r=>r.familyId)).size,familyRewards.length);
  const modelNames=[...new Set(trials.map(t=>t.model))];
    return {schemaVersion:2,experimentId:registry.experimentId,
    serialization:{derivedNumberSignificantDigits:12,rawObservationFile:'research/raw-explanation-submissions.json',rawObservationBytesUnmodified:true},
    policy:{measurement:'Raw elapsed wall time from public problem emission to immutable original public explanation receipt, including tools and model service latency.',
      originalText:'All counts are computed from exact original answer bytes; no reviewer rewrites, summaries, deduplication or normalization.',
      quantityUse:'Raw character/byte counts are diagnostics only, never reward inputs.',
      prediction:'None. Every game family requires a new accepted direct observation. No regression or missing-data fallback.',
      relativeReward:'Median accepted primary exposition time for a task / median of newly observed application-task medians.',
      absoluteReward:'Multiply that observed ratio by the separately replayed common game-work policy, then round to the nearest work unit.',
      comparisonFailures:'All failures and their original answers are retained; comparison results do not introduce an invented failure multiplier.',
      scope:'Canonical-language model exposition observations. No assertion of human solving minutes, intrinsic difficulty, or identical language-port solving time.'},
    gameScale:{commonWorkAnchor,applicationAnchorSeconds:anchorSeconds,applicationTaskIds:application.map(t=>t.id),policy:anchorPolicy,humanMinutesClaimed:false},
    summary:{tasks:tasks.length,trials:trials.length,receivedOriginals:trials.filter(t=>!t.phaseIncomplete).length,missingOriginals:trials.filter(t=>t.phaseIncomplete).length,receivedEmptyOriginals:trials.filter(t=>!t.phaseIncomplete&&t.rawExplanationMetrics.unicodeCharacters===0).length,supersededPublicContractTrials:trials.filter(t=>!t.publicContractActive).length,gameFamilies:familyRewards.length,predictedFamilies:0,
      models:modelNames.map(model=>{const rows=trials.filter(t=>t.model===model);return {model,trials:rows.length,supersededPublicContractTrials:rows.filter(t=>!t.publicContractActive).length,observationFailures:rows.filter(t=>t.observationFailure!==null||t.implementationSubmissionFailure!==null||t.qualification!==null).length,codeAccepted:rows.filter(t=>t.codeAccepted).length,explanationAccepted:rows.filter(t=>t.explanationAccepted).length,accepted:rows.filter(t=>t.accepted).length};})},
    tasks,trials,familyRewards};
}
