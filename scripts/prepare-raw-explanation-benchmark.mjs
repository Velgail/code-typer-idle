// Freeze public problems and the complete fresh-trial plan before observation.
// Historical task identifiers/specifications may be reused; no historical answer,
// timing, normalized text, reward or difficulty value enters this experiment.
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {challengeCatalog} from '../src/challengecatalog.js';
import {loadRawCohorts,COHORTS_PATH} from './raw-explanation-cohorts.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const protocolPath=resolve(ROOT,'research/raw-explanation-protocol.json');
const registryPath=resolve(ROOT,'research/raw-explanation-registry.json');
const contractsPath=resolve(ROOT,'research/raw-application-contracts.json');
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const LANGUAGE_ORDER=['cpp','csharp','rust','go','python','java','sql','lua'];
const MODEL_PRIMARY='gpt-6.1-sol',MODEL_COMPARISON='gpt-6-luna';

export const publicInstructions={
 language:'日本語',
 deliverable:'この問題について、対象言語の基本文法を知る読者が解法を理解できる、公開教材用の完成した解説を提出してください。どのように解くか、その方法が正しい理由、必要な状態や条件、重要な境界条件、計算量を自己完結して説明してください。非公開の内的思考過程の提出ではありません。',
 length:'説明に必要な内容を省略せずに書いてください。長さの指定や最低字数はありません。問題文の転載や同じ主張の反復で水増しせず、解法とその根拠を説明してください。コードはこの段階では提出しないでください。',
 knowledge:'基本的な変数、条件分岐、繰り返し、配列、整数演算、集合、ソートの意味は既知として構いません。高度なアルゴリズムや定理の名前だけで済ませず、ここで必要な性質と、問題の条件への適用を説明してください。',
 implementation:'解説を変更不可で提出して時計を止めた後、提示された言語・スターターのインターフェースで同じ方法を実装して別に提出します。解説や実装を提出する前に、模範解答・隠れたテスト・他の答案・採点結果を参照してはいけません。実装段階で解説を修正してはいけません。',
 access:'この試行で参照してよい問題情報はbeginが表示する公開問題のみです。リポジトリ、registry、過去の測定資料、他のファイル、ネットワークを読みません。begin/explain/codeの指定コマンドだけを使用してください。'
};

export function publicChallenge(question){
 const out={language:question.language,title:question.title,description:question.description,
  parameters:structuredClone(question.parameters??[]),resultType:question.resultType??'int',
  starterSource:question.starterSource,constraints:structuredClone(question.constraints??[])};
 if(question.functionName)out.functionName=question.functionName;
 // Do not promote private case fixtures into public examples.
 if(question.examples)out.examples=structuredClone(question.examples);
 return out;
}

export function historicalPublicContractOverrides(){
 if(!existsSync(COHORTS_PATH))return {};
 const set=loadRawCohorts(),original=read(registryPath),overrides={};
 for(const revision of set.configuration.revisions??[]){
  const prior=original.tasks.find(t=>t.id===revision.previousTaskId);
  if(!prior)continue;
  const activeId=set.activeTaskByFamily[prior.familyId],active=set.registry.tasks.find(t=>t.id===activeId);
  const q=challengeCatalog().find(q=>q.id===prior.sourceId);
  assert.ok(active&&q);assert.deepEqual(active.publicSpec,publicChallenge(q),'The declared revised contract differs from the live public problem');
  assert.deepEqual(prior.cases,q.cases,'Frozen original fixture changed');
  overrides[prior.sourceId]=prior.publicSpec;
 }
 return overrides;
}

export function prepareRawBenchmark({seed,declaredAt,sourceCommit,workerSha256,publicContractOverrides=historicalPublicContractOverrides()}){
 const contracts=read(contractsPath);
 const repeatedFamilies=[...contracts.repeatedChallengeFamilies].sort();
 assert.equal(repeatedFamilies.length,12);
 assert.equal(new Set(repeatedFamilies).size,12);
 const canonical=new Map();
 for(const language of LANGUAGE_ORDER){
  for(const q of challengeCatalog().filter(q=>q.language===language).sort((a,b)=>a.id.localeCompare(b.id))){
   if(!canonical.has(q.familyId))canonical.set(q.familyId,q);
  }
 }
 assert.equal(canonical.size,321,'The frozen all-family experiment must cover exactly the catalog families');
 const tasks=[...canonical.values()].sort((a,b)=>a.familyId.localeCompare(b.familyId)).map(q=>({
  kind:'challenge',analysisKind:'challenge',sourceId:q.id,familyId:q.familyId,language:q.language,subject:q.subject,
  publicSpec:structuredClone(publicContractOverrides[q.id]??publicChallenge(q)),cases:structuredClone(q.cases),
  repeatPrimary:repeatedFamilies.includes(q.familyId),compare:repeatedFamilies.includes(q.familyId)
 }));
 const apps=contracts.tasks;
 assert.equal(apps.length,6);
 for(const app of apps){
  // These are executable behavioral contracts of the real application. Formulae,
  // field order and state changes specify required behavior, not an answer key.
  const spec=structuredClone(app.publicSpec);
  delete spec.prerequisites;
  tasks.push({kind:'application',analysisKind:'application',sourceId:app.id,familyId:null,language:'cpp',subject:null,
   publicSpec:spec,cases:structuredClone(app.cases),repeatPrimary:true,compare:true});
 }
 for(const [sourceId,statement] of [
  ['control-tan-one-degree','tan(1°)は有理数か。結論を証明してください。戻り値は有理数ならtrue、そうでなければfalseです。'],
  ['control-literal-false','どの呼び出しでもfalseを返す関数を作ってください。なぜその実装が仕様を満たすか説明してください。']
 ]){
  tasks.push({kind:'application',analysisKind:'control',sourceId,familyId:null,language:'cpp',subject:null,
   publicSpec:{language:'cpp',statement,parameters:[],returnType:'bool',entryPoint:'is_tan1deg_rational',
    starterSource:'bool is_tan1deg_rational() { /* implement */ }'},
   cases:[{id:'case-01',args:[],expected:false}],repeatPrimary:true,compare:true});
 }
 for(const task of tasks){
  task.id='task_'+sha(seed+'\0task\0'+task.sourceId).slice(0,16);
  task.promptSha256=sha(json({instructions:publicInstructions,problem:task.publicSpec}));
 }
 const trials=[];
 for(const task of tasks){
  const append=(model,repeat,cohort)=>trials.push({
   id:'trial_'+sha(seed+'\0trial\0'+task.id+'\0'+model+'\0'+repeat).slice(0,20),taskId:task.id,
   language:task.language,requestedModel:model,requestedReasoningEffort:'low',independentTrial:repeat,cohort
  });
  for(let i=1;i<=(task.repeatPrimary?3:1);i++)append(MODEL_PRIMARY,i,'primary');
  if(task.compare)append(MODEL_COMPARISON,1,'comparison');
 }
 trials.sort((a,b)=>sha(seed+'\0order\0'+a.id).localeCompare(sha(seed+'\0order\0'+b.id)));
 trials.forEach((trial,index)=>trial.plannedOrder=index+1);
 assert.equal(tasks.length,329);assert.equal(trials.length,389);
 const protocol={
  schemaVersion:2,experimentId:'raw-public-explanations-'+sha(seed).slice(0,12),declaredAt,sourceCommit,
  status:'fresh-data-only; all earlier calibration numbers excluded',
  declaration:'Locally frozen manifest and exact worker hashes before first observation; not a claim of an independently timestamped public preregistration.',
  randomness:{seed,ordering:'Ascending SHA-256(seed + NUL + order + NUL + opaque trial ID); fixed before measurements'},
  models:{primary:MODEL_PRIMARY,comparison:MODEL_COMPARISON,reasoningEffort:'low',
   instantAvailability:'No separately selectable instant setting is exposed; low is recorded explicitly, not relabeled instant.',exactRevisionExposed:false},
  plan:{challengeFamilies:321,applicationTasks:6,controlTasks:2,totalTasks:329,primaryTrials:369,comparisonTrials:20,totalTrials:389,
   repeatedChallengeFamilies:repeatedFamilies,applicationSourceIds:apps.map(x=>x.id),controlSourceIds:['control-tan-one-degree','control-literal-false'],
   allFamilyTrials:'One fresh independent primary trial for every canonical family.',
   repeatedTrials:'Three independent primary trials for the twelve preselected Challenge families, six application contracts and two controls.',
   comparisonTrialsPolicy:'One fresh independent comparison-model trial for each of those twenty tasks.',
   context:'One problem per fresh fork_none solver. No answer, hidden fixtures, former report or feedback is shown.',
   additionalTrials:'No rescue answer may replace a planned observation. Any later new trials form an explicitly identified additional cohort and all failed originals remain.'},
  languageCanonicalOrder:LANGUAGE_ORDER,
  publicInstructions,
  promptPolicy:'Worker emits only public instructions and publicSpec. Catalog cases, registry metadata, model labels, difficulty labels, rewards and reference implementations are not in its prompt.',
  tanControl:'No addition theorem, special-angle hint, irrationality theorem, reference proof or old answer is supplied.',
  phases:['Observer samples OS monotonic and wall clocks immediately before public prompt emission.','Unedited UTF-8 explanation is received and clock stops before validation or file writes.','Separate same-language implementation is received after the explanation is immutable.','Blind reviewers accept or reject that exact original explanation with exact quoted evidence, without rewriting or summarizing it.','The exact separate implementation is evaluated by the real language runtime or native application harness.'],
  measurements:{
   primaryTime:'OS monotonic elapsed seconds from public prompt emission boundary to complete explanation receipt. Includes solver, tool and transport latency; excludes later code and grading. Not pure reasoning time and not human solving minutes.',
   rawExplanation:'Exact received UTF-8 bytes are preserved and SHA-256 bound. No trimming, newline rewriting, NFC normalization, deduplication, summarization or rewriting occurs.',
   unicodeCharacters:'Unicode scalar/code-point count of the decoded original, including all whitespace and final newlines.',
   utf8Bytes:'Byte count of the original UTF-8 payload.',
   charactersExcludingUnicodeWhiteSpace:'Diagnostic count after excluding only the fixed Unicode White_Space property code points listed in the worker; original text is unchanged.',
   lengthUse:'Raw lengths are observable diagnostics only, never inputs to rewards or a claim of intrinsic conceptual difficulty.',
   noInference:'No guide length, fitted regression, extrapolation, imputed time, old answer, old measurement or old calibrated reward can provide a missing family value.'},
  acceptance:{
   semantic:'Blind acceptance/rejection of the exact original explanation, supported by substring quotes and contract-specific reasoning. No normalizedSolution or shorter replacement text is produced.',
   code:'Exact separately submitted source must pass its production runtime/harness and match the explanation.',
   infrastructure:'Missing observations, wrong worker usage, interrupted clocks, UTF-8 failures and runtime infrastructure errors are retained and distinguished from an incorrect solution.',
   failure:'Rejected explanation, wrong implementation or invalid observation is excluded from accepted-time aggregation, never deleted. A family with no valid accepted primary time is unresolved, not assigned an invented reward or a zero reward.'},
  aggregation:{individual:'Raw values per immutable trial are published. A single observation is labeled single-trial, not median uncertainty.',repeated:'Accepted-time and raw-length distributions are summarized with count/min/median/max; failures and exclusions have their own counts.',modelComparison:'One comparison failure is an observed result under this protocol, not proof of universal human difficulty.'},
  rewardPolicy:{
   relative:'For each resolved game family, use its directly observed accepted primary explanation time (median when there are repetitions), divided by the median of the six new application-task accepted-time medians.',
   gameScale:'The common game-work anchor is independently recomputed from current clean-save progression and syntax-Quiz rewards; it is an explicit game-design policy and is published separately. No historical calibration number is imported.',
   formula:'round(newCommonGameWorkAnchor * newDirectFamilyExplanationSeconds / newApplicationMedianSeconds), with minimum 1 only for a finite positive measured ratio.',
   scope:'Shared-family game rewards use the measured canonical language, explicitly recorded. No claim of separately measuring each of the 1,143 language implementations.',
   prohibited:['implementation/source/reference code size','raw or summarized explanation length','human-minute conversion','player response size','player wait time','prediction for an unmeasured family']},
  worker:{path:'scripts/raw-explanation-worker.py',sha256:workerSha256},
  countsArePlanOnly:'Numbers above count the manifest, not results. Measured results will be separate immutable observations.'
 };
 const registry={schemaVersion:2,experimentId:protocol.experimentId,declaredAt,publicInstructions,
  applicationTaskIds:tasks.filter(task=>task.analysisKind==='application').map(task=>task.id),tasks,trials,
  graderOnlyFields:['tasks[].cases','tasks[].sourceId','tasks[].familyId','tasks[].repeatPrimary','tasks[].compare','trials[]'],
  reuseScope:'Only current public game contracts, current hidden correctness fixtures and six real-application behavioral contracts are reused. No prior answer, summary, measured quantity, inferred quantity or reward enters this registry.'};
 return {protocol,registry};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const flags=process.argv.slice(2);assert.ok(flags.length===1&&['--write','--verify'].includes(flags[0]),'Usage: node scripts/prepare-raw-explanation-benchmark.mjs --write|--verify');
 const prior=existsSync(protocolPath)?read(protocolPath):null;
 const seed=prior?.randomness.seed??randomBytes(32).toString('hex');
 const declaredAt=prior?.declaredAt??new Date().toISOString();
 let sourceCommit=prior?.sourceCommit;
 if(!sourceCommit){try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}catch{sourceCommit='unavailable; exact manifest and worker hashes still frozen';}}
 const workerSha256=sha(readFileSync(resolve(ROOT,'scripts/raw-explanation-worker.py')));
 const result=prepareRawBenchmark({seed,declaredAt,sourceCommit,workerSha256});
 if(flags[0]==='--verify'){
  assert.equal(readFileSync(protocolPath,'utf8'),json(result.protocol));assert.equal(readFileSync(registryPath,'utf8'),json(result.registry));
  console.log('Fresh raw benchmark manifest reproduces exactly.');
 }else{
  if(prior){assert.equal(readFileSync(protocolPath,'utf8'),json(result.protocol),'Frozen protocol changed; use a new experiment rather than rewriting an existing plan.');assert.equal(readFileSync(registryPath,'utf8'),json(result.registry),'Frozen registry changed.');}
  else {writeFileSync(protocolPath,json(result.protocol),{flag:'wx'});writeFileSync(registryPath,json(result.registry),{flag:'wx'});}
  console.log(JSON.stringify({protocol:protocolPath,registry:registryPath,tasks:result.registry.tasks.length,trials:result.registry.trials.length,experimentId:result.protocol.experimentId}));
 }
}
