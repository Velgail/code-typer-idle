// Replays immutable raw-explanation submissions. No model calls, rewriting,
// answer-size measurements, effort estimates, or reward calculations occur here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {readFile,writeFile,readdir,mkdir,rename,realpath,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,relative,extname,sep,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {challengeById} from '../src/challengecatalog.js';
import {quizExecutionBudgetMs} from '../src/quizrunner.js';
import {buildCalibrationHarness,runCalibrationProcess,compareCalibrationJSONLines} from './grade-calibration-submissions.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
const parse=raw=>JSON.parse(raw);
const utf8=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const inside=(parent,path)=>path.startsWith(parent+sep);
// JSON has a single numeric zero. Some JS reference arithmetic produces -0;
// integer game results and the frozen JSON wire format identify it with 0.
// This never normalizes explanation/source text or any observed clock.
const fixtureNumbers=value=>typeof value==='number'&&Object.is(value,-0)?0:
 Array.isArray(value)?value.map(fixtureNumbers):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,fixtureNumbers(v)])):value;
const snapshotCases=cases=>cases.map((c,i)=>({id:c.id??String(i+1),args:fixtureNumbers(c.args),expected:fixtureNumbers(c.expected)}));

export function catalogFingerprint(question){
 return sha(JSON.stringify([question.id,question.language,question.parameters,question.resultType,
  question.starterSource,question.referenceSource,question.cases,quizExecutionBudgetMs(question)]));
}

export function assertRawTaskSnapshot(task,question=challengeById(task.sourceId)){
 assert.ok(question,`${task.id}: unknown production sourceId ${task.sourceId}`);
 assert.equal(question.language,task.language,`${task.id}: language differs from production`);
 assert.deepEqual(snapshotCases(task.cases),snapshotCases(question.cases),`${task.id}: frozen fixtures differ from production`);
 if(task.publicSpec?.starterSource!==undefined)assert.equal(task.publicSpec.starterSource,question.starterSource,`${task.id}: public starter differs from production`);
 if(task.publicSpec?.parameters!==undefined)assert.deepEqual(task.publicSpec.parameters,question.parameters,`${task.id}: public parameters differ from production`);
 const resultType=task.publicSpec?.resultType??task.publicSpec?.returnType;
 if(resultType!==undefined)assert.equal(resultType,question.resultType??'int',`${task.id}: result type differs from production`);
 return {id:question.id,language:question.language,fingerprint:catalogFingerprint(question),caseCount:question.cases.length};
}

async function submittedFiles(directory){
 const result=[];
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const path=resolve(directory,entry.name);
  if(entry.isDirectory())result.push(...await submittedFiles(path));
  else if(entry.isFile()&&entry.name.endsWith('.submission.json'))result.push(path);
 }
 return result;
}

/** Reads exact bytes; source and explanations must be files within trialsPath. */
export async function loadRawSubmissions({registry,trialsPath,root=ROOT}){
 assert.ok(Array.isArray(registry.tasks)&&registry.tasks.length,'registry.tasks required');
 assert.ok(Array.isArray(registry.trials)&&registry.trials.length,'registry.trials required');
 const tasks=new Map(registry.tasks.map(t=>[t.id,t])),planned=new Map(registry.trials.map(t=>[t.id,t]));
 assert.equal(tasks.size,registry.tasks.length,'Duplicate task ID');
 assert.equal(planned.size,registry.trials.length,'Duplicate planned trial ID');
 const directory=await realpath(resolve(trialsPath)),rows=[],seen=new Set();
 const readEvidence=async(path,label)=>{
  assert.equal(typeof path,'string',`${label}: immutable file path required`);
  const full=await realpath(resolve(root,path));
  assert.ok(inside(directory,full),`${label}: evidence file is outside trials directory`);
  const bytes=await readFile(full);
  return {text:utf8.decode(bytes),hash:sha(bytes),path:full};
 };
 for(const path of await submittedFiles(directory)){
  const bytes=await readFile(path),raw=utf8.decode(bytes),entry=parse(raw),plan=planned.get(entry.id);
  assert.ok(plan,`Unplanned submission: ${entry.id}`);
  assert.ok(!seen.has(entry.id),`Duplicate submitted trial: ${entry.id}`);seen.add(entry.id);
  for(const [key,value] of Object.entries(plan))assert.deepEqual(entry[key],value,`${entry.id}: planned ${key} differs`);
  const task=tasks.get(entry.taskId);assert.ok(task,`${entry.id}: unknown taskId`);
  if(task.promptSha256!==undefined)assert.equal(entry.promptSha256,task.promptSha256,`${entry.id}: prompt hash differs`);
  assert.equal(entry.language,task.language,`${entry.id}: task language differs`);
  const explanation=await readEvidence(entry.explanationPath,`${entry.id} explanation`);
  const source=await readEvidence(entry.sourcePath,`${entry.id} source`);
  assert.equal(entry.explanationSha256,explanation.hash,`${entry.id}: explanation hash differs`);
  assert.equal(entry.sourceSha256,source.hash,`${entry.id}: source hash differs`);
  if(entry.explanation!==undefined)assert.equal(entry.explanation,explanation.text,`${entry.id}: inline explanation differs`);
  if(entry.source!==undefined)assert.equal(entry.source,source.text,`${entry.id}: inline source differs`);
  rows.push({...entry,explanation:explanation.text,source:source.text,
   recordedSubmissionJson:raw,submissionSha256:sha(bytes),submissionFile:relative(root,path),
   taskSha256:sha(JSON.stringify(task)),casesSha256:sha(JSON.stringify(task.cases))});
 }
 const failureDirectory=resolve(directory,'../protocol-failures');
 if(existsSync(failureDirectory))for(const name of (await readdir(failureDirectory)).filter(n=>n.endsWith('.json')).sort()){
  const failureRaw=await readFile(resolve(failureDirectory,name),'utf8'),failure=parse(failureRaw),plan=planned.get(failure.trialId);
  assert.ok(plan,`Unplanned incomplete observation: ${failure.trialId}`);
  assert.ok(!seen.has(plan.id),`A received submission cannot also be declared missing: ${plan.id}`);
  assert.equal(failure.receivedOriginalExplanation,false);assert.equal(failure.receivedImplementation,false);
  const start=await readEvidence(failure.startPath,`${plan.id} start`),entry=parse(start.text),task=tasks.get(plan.taskId);
  assert.equal(start.hash,failure.startSha256,'Incomplete observer start bytes changed');
  for(const [key,value] of Object.entries(plan))assert.deepEqual(entry[key],value);
  assert.equal(entry.promptSha256,task.promptSha256);
  assert.ok(!existsSync(resolve(directory,`${plan.id}.reasoning.json`)),'A frozen explanation cannot be declared missing');
  seen.add(plan.id);rows.push({...entry,language:plan.language,phaseIncomplete:true,explanation:null,source:null,explanationSha256:null,sourceSha256:null,rawExplanationMetrics:null,
   recordedStartJson:start.text,startSha256:start.hash,incompleteFailureJson:failureRaw,incompleteFailureSha256:sha(failureRaw),
   incompleteFailure:failure,timing:{valid:false,elapsedSeconds:null,failure:failure.reason},
   taskSha256:sha(JSON.stringify(task)),casesSha256:sha(JSON.stringify(task.cases))});
 }
 return {rows,tasks,planned,missingTrialIds:[...planned.keys()].filter(id=>!seen.has(id))};
}

/** Keep expected values even when compilation failed before test execution. */
export function retainAllRawCases(task,reportedCases=[],accepted=false){
 assert.ok(Array.isArray(task.cases)&&task.cases.length,`${task.id}: nonempty fixtures required`);
 const fixtures=snapshotCases(task.cases),expected=new Map(fixtures.map(c=>[c.id,c])),reported=new Map();
 assert.equal(expected.size,fixtures.length,`${task.id}: duplicate fixture IDs`);
 for(const row of reportedCases){
  assert.ok(expected.has(row.id),`${task.id}: unplanned returned case ${row.id}`);
  assert.ok(!reported.has(row.id),`${task.id}: duplicate returned case ${row.id}`);
  assert.deepEqual(fixtureNumbers(row.expected),expected.get(row.id).expected,`${task.id}: returned expected value differs`);
  reported.set(row.id,row);
 }
 if(accepted)assert.ok(reported.size===fixtures.length&&[...reported.values()].every(c=>c.passed===true),`${task.id}: accepted with missing or failed cases`);
 return fixtures.map(c=>reported.has(c.id)?{...reported.get(c.id),resultAvailable:true}:
  {id:c.id,expected:c.expected,actual:null,passed:false,resultAvailable:false});
}

export function summarizeRawGrades(registry,rows){
 const seen=new Set(rows.map(r=>r.id));
 assert.equal(seen.size,rows.length,'Duplicate graded trial ID');
 const byCategory={};
 for(const row of rows)byCategory[row.category]=(byCategory[row.category]??0)+1;
 const missingTrialIds=registry.trials.filter(t=>!seen.has(t.id)).map(t=>t.id);
 const incompleteObservations=rows.filter(r=>r.phaseIncomplete).length;
 return {expectedTrials:registry.trials.length,total:rows.length,accepted:rows.filter(r=>r.accepted).length,
  rejected:rows.filter(r=>!r.accepted).length,plannedCases:rows.reduce((n,r)=>n+r.caseCount,0),
  reportedCases:rows.reduce((n,r)=>n+r.cases.filter(c=>c.resultAvailable).length,0),
  byCategory,complete:missingTrialIds.length===0&&incompleteObservations===0,missingTrialIds,
  ...(incompleteObservations?{incompleteObservations,completeOriginalSubmissions:rows.length-incompleteObservations,allPlannedTrialsAccountedFor:missingTrialIds.length===0}:{} )};
}

async function createBrowserGrader(docsRoot){
 const release=parse(await readFile(resolve(docsRoot,'version.json'),'utf8'));
 const prefix='/code-typer-idle/',mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip','.css':'text/css'};
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
   if(pathname===prefix+'raw-grade.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Immutable raw answer verification</title>');return;}
   assert.ok(pathname.startsWith(prefix));
   const file=resolve(docsRoot,pathname.slice(prefix.length));assert.ok(inside(docsRoot,file));
   res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(await readFile(file));
  }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 let browser,context;
 try{
  const {chromium}=createRequire(import.meta.url)('playwright');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  context=await browser.newContext();const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  await page.goto(base+'raw-grade.html');
  const grade=async(task,row)=>{
   const metadata=assertRawTaskSnapshot(task);
   const result=await page.evaluate(async({base,build,metadata,source})=>{
    const {challengeById}=await import(base+`build/challengecatalog.${build}.js`);
    const {QuizRunner,quizExecutionBudgetMs}=await import(base+`build/quizrunner.${build}.js`);
    const q=challengeById(metadata.id);if(!q)throw Error('Built question is missing: '+metadata.id);
    const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
    const fingerprint=await hash(JSON.stringify([q.id,q.language,q.parameters,q.resultType,q.starterSource,q.referenceSource,q.cases,quizExecutionBudgetMs(q)]));
    if(fingerprint!==metadata.fingerprint)throw Error('Source/build mismatch: '+metadata.id);
    const harness=q.createHarness(source),harnessSourceSha256=await hash(harness.source);
    const harnessSha256=await hash(JSON.stringify([harness.source,harness.sqlChecks??null,harness.sqlProgram??null]));
    let runtimeResult=null,loadReady=null;
    // Capture the worker's complete result before QuizRunner applies its normal
    // UI-facing diagnostic/output limits. The production grade is unchanged.
    const runner=new QuizRunner({workerFactory:()=>{
     const worker=new Worker(base+`build/quizworker.${build}.js`,{type:'module'});
     worker.addEventListener('message',event=>{if(event.data?.type==='result')runtimeResult=structuredClone(event.data.result);});
     return worker;
    }});
    const started=performance.now();
    try{
     const grade=await runner.run(q,source,{onProgress:text=>{if(text.startsWith('コンパイル'))loadReady=performance.now();}});
     const ended=performance.now();
     const category=grade.passed?'accepted':grade.status==='failed'?'wrong-answer':grade.status==='compile-error'?'compile-error':grade.status==='runtime-error'?'runtime-error':grade.status==='timeout'?(loadReady===null?'loading-timeout':'compile-or-execution-timeout'):'error-needs-inspection';
     return {backend:'production-browser-QuizRunner',accepted:grade.passed,passed:grade.passed,category,
      status:grade.status,productionGrade:grade,runtimeResult,cases:grade.cases,
      catalogFingerprint:fingerprint,harnessSha256,harnessSourceSha256,
      harnessHashFormat:'SHA-256 of JSON.stringify([harness.source,harness.sqlChecks??null,harness.sqlProgram??null])',executionBudgetMs:quizExecutionBudgetMs(q),
      outputFormat:harness.outputFormat??'numeric',
      verificationMilliseconds:{load:loadReady===null?null:loadReady-started,compileAndRun:loadReady===null?null:ended-loadReady,total:ended-started}};
    }finally{runner.cancel();}
   },{base,build:release.id,metadata,source:row.source});
   assert.deepEqual(pageErrors,[],`${row.id}: browser page errors`);
   return {...result,build:release.id,version:release.version,browser:browser.version()};
  };
  return {release,grade,close:async()=>{await context.close();await browser.close();await new Promise(r=>server.close(r));}};
 }catch(error){await context?.close();await browser?.close();await new Promise(r=>server.close(r));throw error;}
}

async function nativeGrade(task,row,options){
 assert.equal(task.language,'cpp',`${task.id}: application/control native replay requires C++`);
 const nativeTask=task.kind==='application'?task:{...task,kind:'application'};
 const harness=buildCalibrationHarness(nativeTask,row.source),directory=await mkdtemp(join(tmpdir(),'cti-raw-grade-'));
 const compiler=options.compilerPath??'g++',prlimit=options.prlimitPath??'/usr/bin/prlimit';
 const limits={compileTimeoutMs:30000,executionTimeoutMs:5000,outputLimitBytes:1048576,
  compileMemoryBytes:2147483648,executionMemoryBytes:536870912,...options};
 const result={backend:'native-g++-C++17',accepted:false,passed:false,cases:[],
  harnessSha256:sha(harness.source),harnessOrigin:harness.origin,outputFormat:harness.outputFormat,
  toolchain:{compiler,flags:['-std=c++17','-O2','-pipe']},limits};
 try{
  const sourcePath=join(directory,'submission.cpp'),binary=join(directory,'submission');
  await writeFile(sourcePath,harness.source);
  const compilation=await runCalibrationProcess(compiler,[...result.toolchain.flags,sourcePath,'-o',binary],{
   cwd:directory,timeoutMs:limits.compileTimeoutMs,memoryBytes:limits.compileMemoryBytes,outputLimitBytes:limits.outputLimitBytes,prlimit});
  result.compilation=compilation;
  if(compilation.spawnError)return {...result,category:'infrastructure-error',error:compilation.spawnError};
  if(compilation.timedOut)return {...result,category:'compile-timeout'};
  if(compilation.outputLimited)return {...result,category:'output-limit',phase:'compile'};
  if(compilation.exitCode!==0)return {...result,category:'compile-error'};
  const execution=await runCalibrationProcess(binary,[],{cwd:directory,timeoutMs:limits.executionTimeoutMs,
   memoryBytes:limits.executionMemoryBytes,outputLimitBytes:limits.outputLimitBytes,prlimit});
  result.execution=execution;result.stdout=execution.stdout;result.stderr=execution.stderr;
  if(execution.spawnError)return {...result,category:'infrastructure-error',error:execution.spawnError};
  if(execution.timedOut)return {...result,category:'execution-timeout'};
  if(execution.outputLimited)return {...result,category:'output-limit',phase:'execution'};
  if(execution.exitCode!==0)return {...result,category:'runtime-error'};
  const compared=compareCalibrationJSONLines(execution.stdout,harness.expected,harness.caseIds);
  return {...result,...compared,accepted:compared.passed,category:compared.passed?'accepted':'wrong-answer'};
 }finally{await rm(directory,{recursive:true,force:true});}
}

export async function gradeRawExplanationDirectory({registryPath,trialsPath,outputPath,ids=[],partial=false,merge=false,docsRoot=resolve(ROOT,'docs'),nativeOptions={},log=console.log}){
 registryPath=resolve(registryPath);trialsPath=resolve(trialsPath);outputPath=resolve(outputPath);docsRoot=resolve(docsRoot);
 assert.notEqual(outputPath,registryPath,'Do not overwrite the registry');
 assert.ok(!inside(trialsPath,outputPath),'Output must be outside immutable trials directory');
 const registryRaw=await readFile(registryPath),registry=parse(utf8.decode(registryRaw)),registrySha256=sha(registryRaw);
 const {rows,tasks,planned,missingTrialIds}=await loadRawSubmissions({registry,trialsPath});
 assert.equal(new Set(ids).size,ids.length,'Duplicate --id');
 for(const id of ids)assert.ok(planned.has(id),`Unplanned --id ${id}`);
 const wanted=new Set(ids.length?ids:[...planned.keys()]);
 const missingSelected=missingTrialIds.filter(id=>wanted.has(id));
 if(!partial)assert.deepEqual(missingSelected,[],'Selected immutable submissions are missing; --partial records incomplete coverage explicitly');
 const byId=new Map(rows.map(r=>[r.id,r])),grades=new Map();
 if(merge&&existsSync(outputPath)){
  const previous=parse(await readFile(outputPath,'utf8'));
  assert.equal(previous.schemaVersion,2,'Merge only raw schema2 reports');
  assert.equal(previous.registrySha256,registrySha256,'Cannot merge grades from another registry');
  for(const old of previous.submissions){
   assert.ok(!grades.has(old.id),`Duplicate previous grade ${old.id}`);
   const original=byId.get(old.id);assert.ok(original,`Previous grade lacks immutable submission: ${old.id}`);
   for(const key of ['submissionSha256','explanationSha256','sourceSha256','taskSha256','casesSha256','recordedSubmissionJson','source','explanation','recordedStartJson','startSha256','incompleteFailureJson','incompleteFailureSha256'])assert.equal(old[key],original[key],`${old.id}: previous ${key} differs from immutable evidence`);
   if(old.backend==='production-browser-QuizRunner'){
    const release=parse(await readFile(resolve(docsRoot,'version.json'),'utf8'));
    assert.equal(old.build,release.id,`${old.id}: previous build differs; use a new output path to regrade`);
    assert.equal(old.catalogFingerprint,assertRawTaskSnapshot(tasks.get(old.taskId)).fingerprint,`${old.id}: previous catalog differs`);
   }
   retainAllRawCases(tasks.get(old.taskId),old.cases.filter(c=>c.resultAvailable),old.accepted);
   grades.set(old.id,old);
  }
 }
 let browserGrader=null;
 const persist=async()=>{
  const submissions=[...grades.values()].sort((a,b)=>planned.get(a.id).plannedOrder-planned.get(b.id).plannedOrder||a.id.localeCompare(b.id));
  const report={schemaVersion:2,generatedAt:new Date().toISOString(),registryFile:relative(ROOT,registryPath),registrySha256,
   trialsDirectory:relative(ROOT,trialsPath),selection:{ids,partialAllowed:partial,merged:merge},
   grader:'Unmodified production browser QuizRunner for game Challenges; resource-bounded native C++17 for application and Boolean controls.',
   rawEvidence:'Complete immutable explanation, source, observer JSON, expected and available actual case values. No rewriting, normalization, truncation, or compact hashes replace these contents.',
   timingScope:'All verification costs occur after immutable explanation submission. They are compiler/runtime costs, not solving effort, reward inputs, or human-time estimates.',
   runtimeLimits:'Production compiler/runtime output limits remain unchanged. Complete worker result and outputTruncated/error flags are retained when available; missing test results are explicitly resultAvailable:false.',
   semanticScope:'accepted refers only to executable-code tests. Independent semantic assessment of the original explanation is a separate required step.',
   submissions,summary:summarizeRawGrades(registry,submissions)};
  await mkdir(dirname(outputPath),{recursive:true});const temporary=outputPath+'.tmp';
  await writeFile(temporary,JSON.stringify(report,null,2)+'\n');await rename(temporary,outputPath);
  return report;
 };
 try{
  for(const row of rows.filter(r=>wanted.has(r.id)).sort((a,b)=>planned.get(a.id).plannedOrder-planned.get(b.id).plannedOrder||a.id.localeCompare(b.id))){
   if(grades.has(row.id))continue;
   const task=tasks.get(row.taskId);
   let result;
   if(row.phaseIncomplete){
    result={backend:'no-implementation-received',accepted:false,passed:false,category:'incomplete-observation',cases:[],reason:row.incompleteFailure.reason};
   }else if(task.kind==='challenge'){
    browserGrader??=await createBrowserGrader(docsRoot);
    result=await browserGrader.grade(task,row);
   }else result=await nativeGrade(task,row,nativeOptions);
   const cases=retainAllRawCases(task,result.cases,result.accepted);
   grades.set(row.id,{...row,...result,cases,caseCount:task.cases.length,passedCaseCount:cases.filter(c=>c.passed).length});
   await persist();
   log(JSON.stringify({id:row.id,taskId:row.taskId,language:row.language,accepted:result.accepted,category:result.category,passedCases:cases.filter(c=>c.passed).length,caseCount:cases.length}));
  }
  return await persist();
 }finally{await browserGrader?.close();}
}

async function main(){
 const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
 if(args.includes('--help')){console.log('Usage: node scripts/grade-raw-explanations.mjs --registry REGISTRY.json --trials DIRECTORY --out REPORT.json [--id opaqueTrialId,anotherId] [--partial] [--merge] [--docs DIRECTORY]');return;}
 const registryPath=value('--registry'),trialsPath=value('--trials'),outputPath=value('--out');
 assert.ok(registryPath&&trialsPath&&outputPath,'Required: --registry, --trials, --out (see --help)');
 const report=await gradeRawExplanationDirectory({registryPath,trialsPath,outputPath,ids:(value('--id')??'').split(',').filter(Boolean),partial:args.includes('--partial'),merge:args.includes('--merge'),...(value('--docs')?{docsRoot:resolve(value('--docs'))}:{})});
 console.log(JSON.stringify({output:relative(ROOT,resolve(outputPath)),...report.summary}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.stack??String(error));process.exitCode=1;});
