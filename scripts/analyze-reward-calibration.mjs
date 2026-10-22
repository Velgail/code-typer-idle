// ARCHIVED v2.8 methodology; withdrawn. Never generates current game rewards.
// Current evidence and generation: freeze-explanation-rewards.mjs.
// Offline research only. Never uses a player's source length or waiting time.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CALIBRATION_POLICY = Object.freeze({
 normalization:'cpp-implementation-characters-v1',
 fit:'median-of-training-task-median-code-characters / median-accepted-valid-wall-seconds',
 conversion:'max(accepted implementation characters, training characters-per-second * accepted valid wall seconds)',
 baseWorkPerImplementationCharacter:16,
 studyMultiplier:4,
 implementationMultiplier:2,
});

export function median(values){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function distribution(values){
 return values.length?{count:values.length,min:Math.min(...values),median:median(values),max:Math.max(...values)}:{count:0,min:null,median:null,max:null};
}
const hash=value=>createHash('sha256').update(value).digest('hex');

// Preserve string/character literal contents, including spaces and comment-like
// text. Remove only #include directives, comments and whitespace outside literals.
// No claimed AST equivalence: identifiers, helper functions and macros still count.
export function normalizeCppImplementation(source){
 assert.equal(typeof source,'string','C++ source must be a string');
 const text=source.replace(/^\uFEFF/,'');
 let normalized='',state='code';
 for(let i=0;i<text.length;){
  const c=text[i],next=text[i+1];
  if(state==='line-comment'){
   if(c==='\n')state='code';
   i++;continue;
  }
  if(state==='block-comment'){
   if(c==='*'&&next==='/'){state='code';i+=2;}else i++;
   continue;
  }
  if(state==='string'||state==='character'){
   normalized+=c;i++;
   if(c==='\\'&&i<text.length){normalized+=text[i++];continue;}
   if(c===(state==='string'?'"':"'"))state='code';
   continue;
  }
  if(c==='/'&&next==='/'){state='line-comment';i+=2;continue;}
  if(c==='/'&&next==='*'){state='block-comment';i+=2;continue;}
  if(c==='#'&&/^[ \t]*$/.test(text.slice(text.lastIndexOf('\n',i-1)+1,i))){
   const include=/^#[ \t]*include\b[^\r\n]*(?:\r?\n|$)/.exec(text.slice(i));
   if(include){i+=include[0].length;continue;}
  }
  if(c==='R'&&next==='"'){
   const raw=/^R"([^\s()\\]{0,16})\(/.exec(text.slice(i));
   if(raw){
    const end=text.indexOf(`)${raw[1]}"`,i+raw[0].length);
    assert.notEqual(end,-1,'Unterminated C++ raw string literal');
    const after=end+raw[1].length+2;normalized+=text.slice(i,after);i=after;continue;
   }
  }
  if(/[0-9]/.test(c)){
   const number=/^(?:0[xX][0-9a-fA-F']+|0[bB][01']+|[0-9][0-9']*(?:\.[0-9']*)?(?:[eEpP][+-]?[0-9']+)?)/.exec(text.slice(i));
   normalized+=number[0];i+=number[0].length;continue;
  }
  if(c==='"'||c==="'"){state=c==='"'?'string':'character';normalized+=c;i++;continue;}
  if(!/\s/.test(c))normalized+=c;
  i++;
 }
 assert.ok(state==='code'||state==='line-comment',`Unterminated C++ ${state}`);
 return normalized;
}

export function measureCppImplementation(source){
 const normalized=normalizeCppImplementation(source);
 return {sourceCharacters:[...source].length,sourceBytes:Buffer.byteLength(source),sourceSha256:hash(source),
  nonemptyLines:source.split(/\r?\n/).filter(line=>line.trim()).length,
  implementationCharacters:[...normalized].length,normalizedSha256:hash(normalized)};
}
export const countImplementationCharacters=source=>[...normalizeCppImplementation(source)].length;

function describeTrial(trial,task,index,benchmark){
 const source=trial.source??trial.answer;
 assert.equal(typeof source,'string',`${task.id} trial ${index}: expected source or answer`);
 const accepted=trial.accepted??trial.passed;
 assert.equal(typeof accepted,'boolean',`${task.id} trial ${index}: accepted/passed must be boolean`);
 let measured,measurementError=null;
 try{measured=measureCppImplementation(source);}catch(error){
  measurementError=error.message;
  measured={sourceCharacters:[...source].length,sourceBytes:Buffer.byteLength(source),sourceSha256:hash(source),
   nonemptyLines:source.split(/\r?\n/).filter(line=>line.trim()).length,implementationCharacters:null,normalizedSha256:null};
 }
 if(trial.sourceSha256)assert.equal(measured.sourceSha256,trial.sourceSha256,`${task.id}: source hash mismatch`);
 if(trial.implementationCharacters!==undefined)assert.equal(measured.implementationCharacters,trial.implementationCharacters,`${task.id}: supplied implementationCharacters differs from normalization`);
 const requestedModel=trial.requestedModel??trial.model??benchmark.requestedModel;
 const requestedReasoningEffort=trial.requestedReasoningEffort??trial.reasoningEffort??benchmark.requestedReasoningEffort;
 const matchesCohort=requestedModel===benchmark.requestedModel&&requestedReasoningEffort===benchmark.requestedReasoningEffort;
 const timing=trial.timing??{},seconds=timing.elapsedSeconds;
 let timingInvalidReason=null;
 if(timing.valid!==true)timingInvalidReason=timing.reason??'timing.valid was not explicitly true';
 else if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)timingInvalidReason='elapsedSeconds must be a positive finite number';
 if(!timingInvalidReason&&timing.startMonotonicNs!==undefined&&timing.finishMonotonicNs!==undefined){
  try{
   const elapsed=Number(BigInt(timing.finishMonotonicNs)-BigInt(timing.startMonotonicNs))/1e9;
   if(elapsed<=0||Math.abs(elapsed-seconds)>Math.max(1e-6,seconds*1e-6))timingInvalidReason='monotonic timestamp interval differs from elapsedSeconds';
  }catch{timingInvalidReason='invalid monotonic timestamps';}
 }
 const usedForFit=accepted&&matchesCohort&&!timingInvalidReason&&!measurementError;
 return {id:trial.id??`${task.id}/${index+1}`,requestedModel,requestedReasoningEffort,accepted,
  category:trial.category??trial.grading?.category??(accepted?'accepted':'rejected-unspecified'),
  ...measured,measurementError,elapsedSeconds:typeof seconds==='number'&&Number.isFinite(seconds)?seconds:null,
  timingValid:!timingInvalidReason,timingInvalidReason,matchesCohort,usedForFit,
  exclusionReason:usedForFit?null:!matchesCohort?'different model or reasoning setting':!accepted?'answer rejected':timingInvalidReason??measurementError};
}

function summarizeTask(task,benchmark){
 assert.equal(typeof task.id,'string','Task must have an ID');
 assert.ok(['challenge','application'].includes(task.kind),`${task.id}: kind must be challenge or application`);
 assert.ok(Array.isArray(task.trials)&&task.trials.length,`${task.id}: missing trials`);
 const trials=task.trials.map((trial,index)=>describeTrial(trial,task,index,benchmark));
 const fitTrials=trials.filter(t=>t.usedForFit),cohort=trials.filter(t=>t.matchesCohort);
 const models=[...new Set(trials.map(t=>`${t.requestedModel}/${t.requestedReasoningEffort}`))].map(key=>{
  const rows=trials.filter(t=>`${t.requestedModel}/${t.requestedReasoningEffort}`===key);
  return {configuration:key,trials:rows.length,accepted:rows.filter(t=>t.accepted).length,
   validTimedTrials:rows.filter(t=>t.timingValid).length,acceptedValidTimedTrials:rows.filter(t=>t.accepted&&t.timingValid).length};
 });
 const implementationCharacters=median(fitTrials.map(t=>t.implementationCharacters)),elapsedSeconds=median(fitTrials.map(t=>t.elapsedSeconds));
 return {id:task.id,kind:task.kind,familyId:task.familyId??task.id,subject:task.subject??null,
  cohort:{requestedModel:benchmark.requestedModel,requestedReasoningEffort:benchmark.requestedReasoningEffort,
   total:cohort.length,accepted:cohort.filter(t=>t.accepted).length,acceptedValidTimed:fitTrials.length},models,
  measurement:fitTrials.length?{implementationCharacters,elapsedSeconds,charactersPerSecond:implementationCharacters/elapsedSeconds,
   implementationCharacterDistribution:distribution(fitTrials.map(t=>t.implementationCharacters)),wallSecondDistribution:distribution(fitTrials.map(t=>t.elapsedSeconds))}:null,
  trials};
}

function evaluatePrediction(task,rho){
 const actual=task.measurement.implementationCharacters,predicted=rho*task.measurement.elapsedSeconds,ratio=predicted/actual;
 return {id:task.id,actualImplementationCharacters:actual,predictedImplementationCharacters:predicted,predictedToActualRatio:ratio,
  relativeError:ratio-1,absoluteRelativeError:Math.abs(ratio-1),multiplicativeError:Math.exp(Math.abs(Math.log(ratio)))};
}
function errorSummary(rows){
 return {count:rows.length,absoluteRelativeError:distribution(rows.map(r=>r.absoluteRelativeError)),multiplicativeError:distribution(rows.map(r=>r.multiplicativeError))};
}

// Research candidate added after inspecting proportional-fit residuals. It is
// deliberately not a replacement for the predeclared application-time bridge.
export function fitLogPowerLaw(points){
 assert.ok(Array.isArray(points),'Power-law points must be an array');
 if(points.length<2)return null;
 const logs=points.map(({x,y})=>{
  assert.ok(Number.isFinite(x)&&x>0&&Number.isFinite(y)&&y>0,'Power-law values must be positive and finite');
  return {x:Math.log(x),y:Math.log(y)};
 });
 const xMean=logs.reduce((n,p)=>n+p.x,0)/logs.length,yMean=logs.reduce((n,p)=>n+p.y,0)/logs.length;
 const sumSquares=logs.reduce((n,p)=>n+(p.x-xMean)**2,0);
 if(sumSquares<=Number.EPSILON)return null;
 const exponent=logs.reduce((n,p)=>n+(p.x-xMean)*(p.y-yMean),0)/sumSquares;
 const logIntercept=yMean-exponent*xMean,coefficient=Math.exp(logIntercept);
 assert.ok(Number.isFinite(coefficient)&&coefficient>0&&Number.isFinite(exponent),'Invalid power-law fit');
 return {coefficient,exponent,logIntercept,sampleCount:points.length,
  trainingLogRmse:Math.sqrt(logs.reduce((n,p)=>n+(p.y-logIntercept-exponent*p.x)**2,0)/logs.length)};
}
function powerLawCandidate(rows,samples){
 const point=r=>({x:r.referenceImplementationCharacters,y:r.measured.codeEquivalentImplementationCharacters});
 const fit=fitLogPowerLaw(samples.map(point));
 const metadata={candidateId:'power-law-log-ols',proposedAfterObservingProportionalResiduals:true,
  method:'OLS log(C)=a+b*log(R); C=exp(a)*R^b. No authored minutes or difficulty labels as inputs.',
  selectionLimit:'This candidate was proposed after examining the same sampled tasks. Leave-one-out refits both coefficients without the held-out task, but comparing/selecting models on these same cross-validation residuals reuses validation data. Its apparent advantage can be optimistic; these errors are not an independent prospective validation or a human-time estimate.',
  domainLimit:'Reference-size proxy is most defensible for unmeasured families with the same generator/representation as sampled families. Code size alone does not establish conceptual difficulty, and model measurements are C++ canonical-family measurements.',
  automaticallySelected:false};
 if(!fit)return {...metadata,status:'unavailable-insufficient-distinct-reference-sizes',fit:null,leaveOneOut:null,rewards:[]};
 const predict=(localFit,r)=>localFit.coefficient*r.referenceImplementationCharacters**localFit.exponent;
 const predictions=[],unavailable=[];
 for(const row of samples){
  const localFit=fitLogPowerLaw(samples.filter(other=>other!==row).map(point));
  if(!localFit){unavailable.push(row.id);continue;}
  const actual=row.measured.codeEquivalentImplementationCharacters,predicted=predict(localFit,row),ratio=predicted/actual;
  predictions.push({id:row.id,actualCodeEquivalentCharacters:actual,predictedCodeEquivalentCharacters:predicted,
   fitCoefficient:localFit.coefficient,fitExponent:localFit.exponent,predictedToActualRatio:ratio,relativeError:ratio-1,
   absoluteRelativeError:Math.abs(ratio-1),multiplicativeError:Math.exp(Math.abs(Math.log(ratio)))});
 }
 const referenceRange=distribution(samples.map(r=>r.referenceImplementationCharacters));
 return {...metadata,status:'available',fit,
  leaveOneOut:{predictions,errors:errorSummary(predictions),unavailableTaskIds:unavailable},
  rewards:rows.map(r=>{
   const predicted=predict(fit,r),equivalent=r.measured?.codeEquivalentImplementationCharacters??predicted;
   assert.ok(Number.isFinite(equivalent)&&equivalent>0,`${r.id}: invalid power-law prediction`);
   const baseWorkUnits=r.measured?.reward.baseWorkUnits??Math.round(CALIBRATION_POLICY.baseWorkPerImplementationCharacter*equivalent);
   return {id:r.id,familyId:r.familyId,status:r.measured?'measured':'reference-power-law-estimate',
    referenceImplementationCharacters:r.referenceImplementationCharacters,predictedCodeEquivalentCharacters:predicted,
    codeEquivalentImplementationCharacters:equivalent,
    referenceRangeExtrapolation:r.referenceImplementationCharacters<referenceRange.min||r.referenceImplementationCharacters>referenceRange.max,
    reward:{baseWorkUnits,studyWorkUnits:baseWorkUnits*CALIBRATION_POLICY.studyMultiplier,implementationWorkUnits:baseWorkUnits*CALIBRATION_POLICY.implementationMultiplier}};
  })};
}

function referenceCatalogEstimate(catalog,rewards){
 if(catalog===undefined)return null;
 assert.ok(Array.isArray(catalog)&&catalog.length,'catalog must be a nonempty representative C++ family list');
 const measured=new Map(rewards.filter(r=>r.reward).map(r=>[r.familyId,r]));
 const rows=catalog.map(q=>{
  assert.equal(typeof q.referenceSource,'string',`${q.id}: referenceSource required`);
  const familyId=q.familyId??q.id,referenceImplementationCharacters=countImplementationCharacters(q.referenceSource);
  assert.ok(referenceImplementationCharacters>0,`${q.id}: reference has no implementation characters`);
  return {id:q.id,familyId,referenceImplementationCharacters,measured:measured.get(familyId)};
 });
 assert.equal(new Set(rows.map(r=>r.familyId)).size,rows.length,'catalog must have one C++ representative per family');
 const samples=rows.filter(r=>r.measured);
 assert.ok(samples.length>=2,'At least two measured families must occur in catalog');
 assert.equal(samples.length,measured.size,'Every measured family must occur in catalog');
 const scale=r=>r.measured.codeEquivalentImplementationCharacters/r.referenceImplementationCharacters;
 const factor=median(samples.map(scale));
 const referenceRange=distribution(samples.map(r=>r.referenceImplementationCharacters));
 const leaveOneOut=samples.map(row=>{
  const localFactor=median(samples.filter(other=>other!==row).map(scale)),actual=row.measured.codeEquivalentImplementationCharacters;
  const predicted=localFactor*row.referenceImplementationCharacters,ratio=predicted/actual;
  return {id:row.id,actualCodeEquivalentCharacters:actual,predictedCodeEquivalentCharacters:predicted,referenceScale:localFactor,
   predictedToActualRatio:ratio,relativeError:ratio-1,absoluteRelativeError:Math.abs(ratio-1),multiplicativeError:Math.exp(Math.abs(Math.log(ratio)))};
 });
 return {method:'median(measured code-equivalent / normalized C++ reference characters); same scale for all unmeasured families',
  interpretation:'Measured families use their model/application observations. Other families are reference-size predictions with reported cross-validation errors, not individually measured solve-time or difficulty estimates. Authored minutes and difficulty labels are not inputs.',
  referenceScale:factor,sampleCount:samples.length,sampledReferenceRange:referenceRange,
  leaveOneOut:{predictions:leaveOneOut,errors:errorSummary(leaveOneOut)},
  samples:samples.map(r=>({id:r.id,familyId:r.familyId,referenceImplementationCharacters:r.referenceImplementationCharacters,
   measuredCodeEquivalentCharacters:r.measured.codeEquivalentImplementationCharacters,scale:scale(r)})),
  powerLaw:powerLawCandidate(rows,samples),
  candidateComparison:{automaticallySelected:false,
   interpretation:'The proportional projection is the original candidate. Power-law is a posthoc alternative. Cross-validation compares predictions on the sampled tasks; reusing that comparison for selection does not create a fresh holdout.',
   metrics:'Use multiplicative prediction error (exp(abs(log(predicted/observed)))) so under- and over-estimation by the same factor have the same error.'},
  rewards:rows.map(r=>{
   const equivalent=r.measured?.codeEquivalentImplementationCharacters??factor*r.referenceImplementationCharacters;
   const baseWorkUnits=r.measured?.reward.baseWorkUnits??Math.round(CALIBRATION_POLICY.baseWorkPerImplementationCharacter*equivalent);
   return {id:r.id,familyId:r.familyId,status:r.measured?'measured':'reference-scaled-estimate',referenceImplementationCharacters:r.referenceImplementationCharacters,
    codeEquivalentImplementationCharacters:equivalent,referenceRangeExtrapolation:r.referenceImplementationCharacters<referenceRange.min||r.referenceImplementationCharacters>referenceRange.max,
    reward:{baseWorkUnits,studyWorkUnits:baseWorkUnits*CALIBRATION_POLICY.studyMultiplier,implementationWorkUnits:baseWorkUnits*CALIBRATION_POLICY.implementationMultiplier}};
  })};
}

export function analyzeRewardCalibration(input){
 assert.equal(input.schemaVersion,1,'Expected input schemaVersion: 1');
 const benchmark=input.benchmark;
 assert.equal(benchmark?.language,'cpp','This normalization is defined only for C++');
 assert.equal(typeof benchmark.requestedModel,'string','Missing benchmark.requestedModel');
 assert.equal(typeof benchmark.requestedReasoningEffort,'string','Missing benchmark.requestedReasoningEffort');
 assert.ok(Array.isArray(input.tasks)&&input.tasks.length,'Expected nonempty tasks');
 const tasks=input.tasks.map(task=>summarizeTask(task,benchmark)),byId=new Map(tasks.map(t=>[t.id,t]));
 assert.equal(byId.size,tasks.length,'Task IDs must be unique');
 const trainIds=input.appSplit?.train,holdoutIds=input.appSplit?.holdout;
 assert.ok(Array.isArray(trainIds)&&trainIds.length>=2,'Declare at least two train application IDs');
 assert.ok(Array.isArray(holdoutIds)&&holdoutIds.length>=1,'Declare holdout application IDs before examining results');
 assert.equal(new Set([...trainIds,...holdoutIds]).size,trainIds.length+holdoutIds.length,'Train and holdout IDs must be unique/disjoint');
 const select=ids=>ids.map(id=>{
  const task=byId.get(id);assert.equal(task?.kind,'application',`Not an application task: ${id}`);
  assert.ok(task.measurement,`Application ${id} has no accepted valid timed cohort`);
  return task;
 });
 const train=select(trainIds),holdout=select(holdoutIds);
 const applicationIds=tasks.filter(t=>t.kind==='application').map(t=>t.id);
 assert.deepEqual([...trainIds,...holdoutIds].sort(),applicationIds.sort(),'Every application must belong to the predeclared train/holdout split');
 const rho=median(train.map(t=>t.measurement.charactersPerSecond));
 assert.ok(Number.isFinite(rho)&&rho>0,'Invalid characters-per-second fit');
 const holdoutPredictions=holdout.map(t=>evaluatePrediction(t,rho));
 const trainingLeaveOneOut=train.map(t=>{
  const localRho=median(train.filter(other=>other!==t).map(other=>other.measurement.charactersPerSecond));
  return {...evaluatePrediction(t,localRho),fitCharactersPerSecond:localRho};
 });
 const allApplicationLeaveOneOut=[...train,...holdout].map(t=>{
  const localRho=median([...train,...holdout].filter(other=>other!==t).map(other=>other.measurement.charactersPerSecond));
  return {...evaluatePrediction(t,localRho),fitCharactersPerSecond:localRho};
 });
 const trainingTimeRange=distribution(train.map(t=>t.measurement.elapsedSeconds));
 const rewards=tasks.filter(t=>t.kind==='challenge').map(t=>{
  if(!t.measurement)return {id:t.id,familyId:t.familyId,status:'uncalibrated-no-accepted-valid-timed-answer',reward:null};
  const {implementationCharacters:k,elapsedSeconds:e}=t.measurement,timeEquivalent=rho*e,codeEquivalent=Math.max(k,timeEquivalent);
  const baseWorkUnits=Math.round(CALIBRATION_POLICY.baseWorkPerImplementationCharacter*codeEquivalent);
  return {id:t.id,familyId:t.familyId,status:'measured',acceptedValidTimedTrials:t.cohort.acceptedValidTimed,
   implementationCharacters:k,elapsedSeconds:e,timeEquivalentImplementationCharacters:timeEquivalent,
   codeEquivalentImplementationCharacters:codeEquivalent,activeBasis:timeEquivalent>k?'application-normalized-time':'accepted-code-lower-bound',
   timeRangeExtrapolation:e<trainingTimeRange.min||e>trainingTimeRange.max,
   reward:{baseWorkUnits,studyWorkUnits:baseWorkUnits*CALIBRATION_POLICY.studyMultiplier,implementationWorkUnits:baseWorkUnits*CALIBRATION_POLICY.implementationMultiplier}};
 });
 return {schemaVersion:1,benchmark,policy:CALIBRATION_POLICY,
  interpretation:'Observed model-and-tool wall time normalized to accepted application implementation characters. Not a human solve-time estimate. max(code,time-derived code) and the work conversion are explicit game policies, not empirically proved laws.',
  appSplit:{train:trainIds,holdout:holdoutIds,declaredAt:input.appSplit.declaredAt??null},
  fit:{charactersPerSecond:rho,trainingTimeRange,trainingApplications:train.map(t=>({id:t.id,...t.measurement})),
   holdout:{predictions:holdoutPredictions,errors:errorSummary(holdoutPredictions)},
   trainingLeaveOneOut:{predictions:trainingLeaveOneOut,errors:errorSummary(trainingLeaveOneOut)},
   allApplicationLeaveOneOut:{interpretation:'Diagnostic only; includes the held-out applications and is not an independent holdout estimate.',predictions:allApplicationLeaveOneOut,errors:errorSummary(allApplicationLeaveOneOut)}},
  summary:{tasks:tasks.length,applications:applicationIds.length,challenges:rewards.length,calibratedChallenges:rewards.filter(t=>t.reward).length,
   extrapolatedChallenges:rewards.filter(t=>t.timeRangeExtrapolation).map(t=>t.id),
   trials:tasks.reduce((n,t)=>n+t.trials.length,0),includedTrials:tasks.reduce((n,t)=>n+t.trials.filter(r=>r.usedForFit).length,0)},
  catalogEstimate:referenceCatalogEstimate(input.catalog,rewards),rewards,tasks};
}

function selfTest(){
 assert.equal(median([2,6,4]),4);assert.equal(median([6,2]),4);
 const knownPower=fitLogPowerLaw([{x:1,y:3},{x:4,y:6},{x:9,y:9}]);
 assert.ok(Math.abs(knownPower.coefficient-3)<1e-10);assert.ok(Math.abs(knownPower.exponent-.5)<1e-10);
 assert.equal(fitLogPowerLaw([{x:2,y:3},{x:2,y:9}]),null,'A constant reference size cannot identify an exponent');
 assert.equal(normalizeCppImplementation('#include <x>\n// comment\nint f() { /* x */ return 2; }'),'intf(){return2;}');
 assert.equal(normalizeCppImplementation('const char*s="a // b"; char c=\' \';'),'constchar*s="a // b";charc=\' \';');
 assert.equal(normalizeCppImplementation('auto s=R"tag(a /* x */ b)tag";'),'autos=R"tag(a /* x */ b)tag";');
 assert.equal(normalizeCppImplementation('auto s=R"(a\n#include <inside>\nb)";'),'autos=R"(a\n#include <inside>\nb)";');
 assert.equal(normalizeCppImplementation("int n=1'000;"),"intn=1'000;");
 const benchmark={language:'cpp',requestedModel:'test-model',requestedReasoningEffort:'low'};
 const task=(id,kind,source,seconds)=>({id,kind,trials:[{source,accepted:true,timing:{valid:true,elapsedSeconds:seconds}}]});
 const input={schemaVersion:1,benchmark,appSplit:{train:['a','b'],holdout:['h']},tasks:[task('a','application','intx;',1),task('b','application','intx;inty;',2),task('h','application','intx;inty;intz;',3),task('q','challenge','intq;',4)]};
 const report=analyzeRewardCalibration(input);
 assert.equal(report.fit.charactersPerSecond,5);assert.equal(report.fit.holdout.predictions[0].predictedToActualRatio,1);
 assert.equal(report.rewards[0].reward.baseWorkUnits,320);assert.equal(report.rewards[0].timeRangeExtrapolation,true);
 input.tasks.at(-1).trials.push({source:'intbad;',accepted:false,timing:{valid:true,elapsedSeconds:999}});
 assert.equal(analyzeRewardCalibration(input).rewards[0].reward.baseWorkUnits,320,'Rejected answers do not inflate reward');
 input.tasks.at(-1).trials[0].timing.valid=false;
 assert.equal(analyzeRewardCalibration(input).rewards[0].reward,null,'Invalid timing cannot become a measured reward');
 input.tasks.at(-1).trials.push({source:'"',accepted:false,timing:{valid:true,elapsedSeconds:3}});
 assert.equal(analyzeRewardCalibration(input).tasks.at(-1).trials.at(-1).implementationCharacters,null,'Malformed rejected source does not abort the report');
 input.tasks.at(-1).trials[0].timing.valid=true;
 input.tasks.push(task('q2','challenge','intq;',2));
 input.catalog=[{id:'q',referenceSource:'intq;'},{id:'q2',referenceSource:'intq;'},{id:'unmeasured',referenceSource:'intx;inty;'}];
 const projection=analyzeRewardCalibration(input).catalogEstimate;
 assert.equal(projection.referenceScale,3);assert.equal(projection.rewards.at(-1).reward.baseWorkUnits,480);
 assert.equal(projection.rewards.at(-1).status,'reference-scaled-estimate');assert.equal(projection.leaveOneOut.predictions.length,2);
 assert.equal(projection.powerLaw.status,'unavailable-insufficient-distinct-reference-sizes');
 input.catalog[1].referenceSource='intq;intx;';
 const alternative=analyzeRewardCalibration(input).catalogEstimate.powerLaw;
 assert.equal(alternative.status,'available');assert.equal(alternative.leaveOneOut.unavailableTaskIds.length,2,'Two-point fit has no identifiable LOO exponent');
 assert.equal(alternative.rewards.at(-1).status,'reference-power-law-estimate');
 console.log('Calibration normalization, cohort filtering, fit, holdout, failure handling and conversion checks passed.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--self-test')selfTest();
 else if(args.length!==2||args.includes('--help')){
  console.log('Usage: node scripts/analyze-reward-calibration.mjs INPUT.json OUTPUT.json');
  console.log('       node scripts/analyze-reward-calibration.mjs --self-test');
  console.log('Input: {schemaVersion:1,benchmark:{language:"cpp",requestedModel,requestedReasoningEffort},appSplit:{train:[IDs],holdout:[IDs]},tasks:[{id,kind:"application"|"challenge",trials:[{source,accepted,timing:{valid,elapsedSeconds}}]}]}');
  process.exitCode=args.includes('--help')?0:2;
 }else{
  const inputPath=resolve(args[0]),outputPath=resolve(args[1]);
  assert.notEqual(inputPath,outputPath,'Input evidence must not be overwritten');
  const raw=await readFile(inputPath,'utf8'),report=analyzeRewardCalibration(JSON.parse(raw));
  report.provenance={inputFile:relative(process.cwd(),inputPath),inputSha256:hash(raw),reproduce:`node scripts/analyze-reward-calibration.mjs ${args[0]} ${args[1]}`};
  await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({output:relative(process.cwd(),outputPath),fitCharactersPerSecond:report.fit.charactersPerSecond,...report.summary,holdoutErrors:report.fit.holdout.errors}));
 }
}
