// The small numerical projection is sufficient for offline reward arithmetic.
// Original-answer acceptance and provenance are checked by the separate audit.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {challengeCatalog} from '../src/challengecatalog.js';
import {skillQuizCatalog} from '../src/skillquiz.js';
import * as game from '../src/core.js';
import {FIRST_PROJECT_FOUNDATION_WORK,FIRST_PROJECT_STUDY_BASE,FIRST_PROJECT_PARTS} from '../src/firstproject.js';

export const CALIBRATION_PATH='research/challenge-calibration.json';
export const REWARD_SOURCE_PATH='src/challengerewards.js';
export const REWARD_BASIS='direct-raw-explanation-observation';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const fraction=(numerator,denominator=1n)=>{
 assert.ok(numerator>0n&&denominator>0n,'Observed durations must be positive');
 const divisor=gcd(numerator,denominator);
 return {numerator:numerator/divisor,denominator:denominator/divisor};
};

export function medianRationals(values){
 assert.ok(values.length,'An empty observation set cannot supply a reward');
 const sorted=values.map(v=>fraction(v.numerator,v.denominator)).sort((a,b)=>{
  const difference=a.numerator*b.denominator-b.numerator*a.denominator;
  return difference<0n?-1:difference>0n?1:0;
 }),mid=Math.floor(sorted.length/2);
 if(sorted.length%2)return sorted[mid];
 const a=sorted[mid-1],b=sorted[mid];
 return fraction(a.numerator*b.denominator+b.numerator*a.denominator,2n*a.denominator*b.denominator);
}

export function medianNanoseconds(values){
 return medianRationals(values.map(value=>{
  assert.equal(typeof value,'string','Nanoseconds must remain exact decimal strings');
  assert.match(value,/^[1-9]\d*$/,'Nanoseconds must be positive decimal integers');
  return fraction(BigInt(value));
 }));
}

export function roundedWorkUnits(duration,anchor,commonWorkAnchor){
 assert.ok(Number.isSafeInteger(commonWorkAnchor)&&commonWorkAnchor>0,'The game-work anchor must be a positive safe integer');
 const numerator=BigInt(commonWorkAnchor)*duration.numerator*anchor.denominator;
 const denominator=duration.denominator*anchor.numerator;
 // All values are positive: integer division implements Math.round's half-up rule.
 const rounded=(2n*numerator+denominator)/(2n*denominator),work=rounded<1n?1n:rounded;
 assert.ok(work<=BigInt(Number.MAX_SAFE_INTEGER),'Reward exceeds exact JavaScript integer range');
 return Number(work);
}

export function curricularAnchor(){
 const state=game.createState(0);game.openOnlineMaterial(state,'syntax');
 let low=0,high=1;
 while(game.studyGain(state,high,'syntax')<game.PROJECTS[0].req.syntax)high*=2;
 for(let i=0;i<100;i++){const mid=(low+high)/2;if(game.studyGain(state,mid,'syntax')<game.PROJECTS[0].req.syntax)low=mid;else high=mid;}
 const foundationWork=Math.ceil(high);
 assert.equal(foundationWork,FIRST_PROJECT_FOUNDATION_WORK);
 assert.equal(FIRST_PROJECT_STUDY_BASE,foundationWork/FIRST_PROJECT_PARTS.length/game.QUIZ_STUDY_MULTIPLIER);
 const syntax=skillQuizCatalog().map(question=>{
  const s=game.createState(0);s.mode='study';s.subject=question.subject;s.typing.language=question.language;game.openOnlineMaterial(s,question.subject);
  return {id:question.id,studyWork:game.skillQuizRewardPreview(s,question).studyUnits};
 });
 const ceiling=Math.max(...syntax.map(q=>q.studyWork));
 const commonWorkAnchor=Math.max(foundationWork,ceiling)/game.QUIZ_STUDY_MULTIPLIER;
 return {commonWorkAnchor,anchorPolicy:{kind:'separately-replayed-game-design-policy',
  statement:'At the new median application task, full implementation study work equals the greater of current free K0-to-K12 work and the unequipped syntax-Quiz study ceiling. This is an explicit progression choice, not human time.',
  freeStudyWorkFromZeroToRequirement:foundationWork,syntaxQuizCount:syntax.length,maximumUnassistedSyntaxQuizStudyWork:ceiling,
  syntaxCeilingIds:syntax.filter(q=>q.studyWork===ceiling).map(q=>q.id),challengeStudyMultiplier:game.QUIZ_STUDY_MULTIPLIER,
  baseWorkAtApplicationMedian:commonWorkAnchor,historicalCalibrationInputs:[],humanMinutesClaimed:false}};
}

export function deriveChallengeCalibration(calibration){
 assert.equal(calibration.schemaVersion,1);
 assert.equal(calibration.basis,REWARD_BASIS);
 assert.ok(typeof calibration.experimentId==='string'&&calibration.experimentId);
 assert.ok(Array.isArray(calibration.applications)&&calibration.applications.length,'Application observations are required');
 assert.ok(Array.isArray(calibration.families)&&calibration.families.length,'Family observations are required');
 const seenTrials=new Set(),seenTasks=new Set(),seenFamilies=new Set();
 const observations=rows=>{
  assert.ok(Array.isArray(rows)&&rows.length,'Accepted original observations are required');
  return medianNanoseconds(rows.map(row=>{
   assert.ok(Array.isArray(row)&&row.length===2,'Each observation is [trialId, elapsedNanoseconds]');
   const [id,duration]=row;
   assert.ok(typeof id==='string'&&id&&!seenTrials.has(id),'Observation identities must be unique');seenTrials.add(id);
   return duration;
  }));
 };
 const applicationMedians=calibration.applications.map(row=>{
  assert.ok(Array.isArray(row)&&row.length===2,'Each application is [taskId, observations]');
  assert.ok(typeof row[0]==='string'&&row[0]&&!seenTasks.has(row[0]),'Application identities must be unique');seenTasks.add(row[0]);
  return observations(row[1]);
 });
 const anchor=medianRationals(applicationMedians);
 const families=calibration.families.map(row=>{
  assert.ok(Array.isArray(row)&&row.length===3,'Each family is [familyId, canonicalId, observations]');
  const [familyId,canonicalId,samples]=row;
  assert.ok(typeof familyId==='string'&&familyId&&!seenFamilies.has(familyId),'Family identities must be unique');seenFamilies.add(familyId);
  assert.ok(typeof canonicalId==='string'&&canonicalId,'A canonical implementation is required');
  const duration=observations(samples);
  return {familyId,canonicalId,canonicalLanguage:canonicalId.split('/')[2],basis:REWARD_BASIS,
   elapsedExplanationSeconds:Number(duration.numerator)/Number(duration.denominator)/1e9,
   validAcceptedTrials:samples.length,baseWorkUnits:roundedWorkUnits(duration,anchor,calibration.commonWorkAnchor)};
 });
 assert.deepEqual(families.map(r=>r.familyId),families.map(r=>r.familyId).sort(),'Family rows must be sorted for review');
 return {families,applicationAnchorNanoseconds:anchor,applicationAnchorSeconds:Number(anchor.numerator)/Number(anchor.denominator)/1e9};
}

export function validateLiveCalibration(calibration){
 const derived=deriveChallengeCalibration(calibration),catalog=challengeCatalog();
 assert.equal(calibration.commonWorkAnchor,curricularAnchor().commonWorkAnchor,'Calibration game scale differs from current progression');
 assert.deepEqual(derived.families.map(r=>r.familyId),[...new Set(catalog.map(q=>q.familyId))].sort(),'Every catalog family needs an explicit observation');
 for(const row of derived.families)assert.ok(catalog.some(q=>q.familyId===row.familyId&&q.id===row.canonicalId),'Canonical implementation is absent: '+row.familyId);
 return derived;
}

export function calibrationFromRaw(analysis,grades){
 const byId=new Map(grades.submissions.map(row=>[row.id,row]));
 const samples=taskId=>analysis.trials.filter(t=>t.taskId===taskId&&t.usedForReward).map(t=>{
  const observed=JSON.parse(byId.get(t.id).recordedSubmissionJson);
  return [t.id,String(BigInt(observed.endedMonotonicNs)-BigInt(observed.startedMonotonicNs))];
 });
 const calibration={schemaVersion:1,experimentId:analysis.experimentId,basis:REWARD_BASIS,
  measurement:'Exact original explanation-receipt wall time, including model service and tools; not human solving time.',
  selection:'Accepted primary observations of the active public contract; original acceptance, failures and exclusions remain in the external audit archive.',
  arithmetic:'Round commonWorkAnchor * family median / median of application medians; all medians use exact rational nanoseconds.',
  familyColumns:['familyId','canonicalId','acceptedObservations'],observationColumns:['trialId','elapsedNanoseconds'],
  commonWorkAnchor:analysis.gameScale.commonWorkAnchor,
  applications:analysis.tasks.filter(t=>t.kind==='application').map(t=>[t.id,samples(t.id)]),
  families:analysis.familyRewards.map(row=>[row.familyId,row.canonicalId,samples(row.taskId)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)};
 const derived=deriveChallengeCalibration(calibration),original=new Map(analysis.familyRewards.map(row=>[row.familyId,row.baseWorkUnits]));
 for(const row of derived.families)assert.equal(row.baseWorkUnits,original.get(row.familyId),'Exact arithmetic changed a frozen reward: '+row.familyId);
 return calibration;
}

export function serializeCalibration(calibration){
 const {applications,families,...metadata}=calibration;
 const header=JSON.stringify(metadata,null,2).slice(0,-2);
 const rows=(name,values)=>`  "${name}": [\n${values.map(row=>'    '+JSON.stringify(row)).join(',\n')}\n  ]`;
 return header+',\n'+rows('applications',applications)+',\n'+rows('families',families)+'\n}\n';
}

export function rewardSource(calibration){
 const {families}=deriveChallengeCalibration(calibration);
 return '// Generated by node scripts/challenge-calibration.mjs --write.\n'+
  '// Exact observed-clock arithmetic; original evidence is verified separately.\n'+
  "export { FIRST_PROJECT_STUDY_BASE } from './firstproject.js';\n"+
  'const values = {\n'+families.map(r=>'  '+JSON.stringify(r.familyId)+': '+JSON.stringify([r.baseWorkUnits,r.canonicalId])).join(',\n')+'\n};\n'+
  'const rewards = Object.freeze(Object.fromEntries(Object.entries(values).map(([familyId,[baseWorkUnits,canonicalId]]) =>\n'+
  '  [familyId,Object.freeze({baseWorkUnits,basis:'+JSON.stringify(REWARD_BASIS)+',canonicalId,evidence:'+JSON.stringify(CALIBRATION_PATH)+'})])));\n'+
  'export const calibratedChallengeReward = familyId => rewards[familyId] || null;\n';
}

export const loadChallengeCalibration=(path=CALIBRATION_PATH)=>read(path);
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const flags=process.argv.slice(2);
 assert.ok(flags.length===1&&['--check','--write'].includes(flags[0]),'Usage: node scripts/challenge-calibration.mjs --check|--write');
 const calibration=loadChallengeCalibration(),derived=validateLiveCalibration(calibration),source=rewardSource(calibration);
 assert.equal(readFileSync(CALIBRATION_PATH,'utf8'),serializeCalibration(calibration),'Compact calibration formatting differs');
 if(flags[0]==='--write')writeFileSync(REWARD_SOURCE_PATH,source);
 else assert.equal(readFileSync(REWARD_SOURCE_PATH,'utf8'),source,'Reward map differs; run node scripts/challenge-calibration.mjs --write');
 console.log(JSON.stringify({families:derived.families.length,commonWorkAnchor:calibration.commonWorkAnchor,offline:true,mode:flags[0].slice(2)}));
}
