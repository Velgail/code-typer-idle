// Research-only native replay. Solver clocks are already stopped before this
// script runs; compiler and execution costs are recorded separately.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir,mkdtemp,rm,access,realpath} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {resolve,dirname,relative,join,delimiter,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {challengeById} from '../src/challengecatalog.js';
import {measureCppImplementation,countImplementationCharacters} from './analyze-reward-calibration.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const milliseconds=value=>Math.round(value*1000)/1000;
const DEFAULTS=Object.freeze({compileTimeoutMs:30000,executionTimeoutMs:5000,outputLimitBytes:1048576,compileMemoryBytes:2147483648,executionMemoryBytes:536870912});
const COMPILE_FLAGS=Object.freeze(['-std=c++17','-O2','-pipe','-fmax-errors=5']);

function sameJSON(actual,expected){
 if(typeof actual!==typeof expected)return false;
 if(typeof expected==='number')return Number.isFinite(actual)&&Number.isFinite(expected)&&actual===expected;
 if(expected===null||typeof expected!=='object')return actual===expected;
 if(Array.isArray(actual)!==Array.isArray(expected))return false;
 const keys=Object.keys(expected);
 return Object.keys(actual).length===keys.length&&keys.every(key=>Object.hasOwn(actual,key)&&sameJSON(actual[key],expected[key]));
}

export function compareCalibrationJSONLines(stdout,expected,caseIds=[]){
 const lines=String(stdout??'').trim().split(/\r?\n/).filter(line=>line.trim()!=='');
 const cases=expected.map((value,index)=>{
  let actual=null,validJSON=false;
  try{actual=JSON.parse(lines[index]);validJSON=true;}catch{/* Missing or malformed lines fail. */}
  return {id:caseIds[index]??String(index+1),expected:value,actual,validJSON,passed:validJSON&&sameJSON(actual,value)};
 });
 return {passed:expected.length>0&&lines.length===expected.length&&cases.every(row=>row.passed),cases,extraOutput:lines.length>expected.length,outputLineCount:lines.length};
}

function cppString(value){
 const bytes=Buffer.from(value,'utf8');
 const literal=[...bytes].map(byte=>`\\x${byte.toString(16).padStart(2,'0')}`).join('');
 return `std::string("${literal}", ${bytes.length})`;
}

function cppLiteral(value,parameter){
 const type=parameter.cppType??({array:'std::vector<int>',string:'std::string',int:'int',bool:'bool',double:'double'}[parameter.type]);
 if(type==='std::vector<int>'){
  assert.ok(Array.isArray(value)&&value.every(Number.isSafeInteger),'Expected an integer vector fixture');
  return `std::vector<int>{${value.join(',')}}`;
 }
 if(type==='std::string'){assert.equal(typeof value,'string');return cppString(value);}
 if(type==='bool'){assert.equal(typeof value,'boolean');return value?'true':'false';}
 assert.ok(['int','long long','std::int64_t','double','float'].includes(type),`Unsupported calibration parameter type: ${type}`);
 assert.ok(typeof value==='number'&&Number.isFinite(value),'Expected a finite numeric fixture');
 if(!['double','float'].includes(type))assert.ok(Number.isSafeInteger(value),'Expected a safe integer fixture');
 return Number.isInteger(value)?`${value}${['long long','std::int64_t'].includes(type)?'LL':''}`:String(value);
}

const APP_JSON_PRINT=String.raw`
void ctiCalibrationValue(const std::string& value) {
    const char* digits="0123456789abcdef";
    std::cout << '"';
    for (unsigned char c : value) {
        if (c=='"'||c=='\\') std::cout << '\\' << char(c);
        else if (c<32) std::cout << "\\u00" << digits[c/16] << digits[c%16];
        else std::cout << char(c);
    }
    std::cout << '"';
}
void ctiCalibrationValue(bool value) { std::cout << (value ? "true" : "false"); }
template<class T, typename std::enable_if<std::is_arithmetic<T>::value && !std::is_same<T,bool>::value,int>::type = 0>
void ctiCalibrationValue(T value) { std::cout << std::setprecision(17) << value; }
template<class T> void ctiCalibrationValue(const std::vector<T>& values) {
    std::cout << '[';
    for (std::size_t i=0;i<values.size();++i) { if(i) std::cout << ','; ctiCalibrationValue(values[i]); }
    std::cout << ']';
}
template<class T> void ctiCalibrationPrint(const T& value) { ctiCalibrationValue(value); std::cout << '\n'; }
`;

export function buildCalibrationHarness(task,source){
 assert.equal(typeof source,'string','Submission source must be a string');
 const cases=task.cases??task.fixtures;
 assert.ok(Array.isArray(cases)&&cases.length,`${task.id}: expected nonempty cases`);
 if(task.kind==='challenge'){
  const question=challengeById(task.sourceId);
  assert.ok(question&&question.language==='cpp',`${task.id}: expected an existing C++ Challenge sourceId`);
  const snapshot=rows=>rows.map(row=>({args:row.args,expected:row.expected}));
  assert.ok(sameJSON(snapshot(cases),snapshot(question.cases)),`${task.id}: registry cases differ from the current game catalog`);
  if(task.publicSpec?.parameters)assert.ok(sameJSON(task.publicSpec.parameters.map(p=>[p.name,p.type]),question.parameters.map(p=>[p.name,p.type])),`${task.id}: registry parameters differ from the game catalog`);
  if(task.publicSpec?.starterSource!==undefined)assert.equal(task.publicSpec.starterSource,question.starterSource,`${task.id}: starter source differs from the game catalog`);
  const resultType=task.publicSpec?.resultType??task.publicSpec?.returnType;
  if(resultType!==undefined)assert.equal(resultType,question.resultType??'int',`${task.id}: result type differs from the game catalog`);
  // Use the production harness, never its reference implementation. JSON values
  // are compared strictly below, including for the legacy scalar exercises.
  const harness=question.createHarness(source);
  assert.ok(sameJSON(harness.expected,cases.map(row=>row.expected)),`${task.id}: harness expected values differ from the snapshot`);
  return {...harness,outputFormat:'json-lines',origin:'production challengeById(sourceId).createHarness(submittedSource)'};
 }
 assert.ok(['application','app'].includes(task.kind),`${task.id}: unknown task kind ${task.kind}`);
 const spec=task.publicSpec??{},parameters=spec.parameters??[];
 const entryPoint=task.entryPoint??spec.entryPoint??spec.functionName;
 assert.match(entryPoint??'',/^[A-Za-z_][A-Za-z_0-9]*(?:::[A-Za-z_][A-Za-z_0-9]*)*$/,`${task.id}: invalid entryPoint`);
 const calls=cases.map(row=>{
  assert.ok(Array.isArray(row.args)&&row.args.length===parameters.length,`${task.id}: fixture argument count differs from parameters`);
  return `${entryPoint}(${row.args.map((value,index)=>cppLiteral(value,parameters[index])).join(', ')})`;
 });
 const headers=['algorithm','cmath','cstdint','cstdlib','iomanip','iostream','map','numeric','set','string','type_traits','utility','vector'].map(header=>`#include <${header}>`).join('\n');
 return {language:'cpp',source:`${headers}\n${task.harnessPrefix??''}\n${source}\n${APP_JSON_PRINT}\nint main() {\n${calls.map(call=>`ctiCalibrationPrint(${call});`).join('\n')}\n}\n`,expected:cases.map(row=>row.expected),caseIds:cases.map((row,index)=>row.id??`case-${index+1}`),outputFormat:'json-lines',origin:'research application entryPoint harness'};
}

async function executablePath(command){
 const candidates=isAbsolute(command)||command.includes('/')?[resolve(command)]:(process.env.PATH??'/usr/bin:/bin').split(delimiter).map(directory=>join(directory,command));
 for(const path of candidates){try{await access(path,fsConstants.X_OK);return await realpath(path);}catch{/* Try the next PATH entry. */}}
 throw Error(`Required executable not found: ${command}`);
}

// Limit child process groups, wall/CPU time, address space, regular-file size,
// and captured output. This is resource-bounded replay, not an adversarial VM.
export function runCalibrationProcess(command,args,{cwd,timeoutMs,memoryBytes,outputLimitBytes,prlimit='/usr/bin/prlimit'}){
 return new Promise(resolveResult=>{
  const started=performance.now(),chunks={stdout:[],stderr:[]};
  let outputBytes=0,timedOut=false,outputLimited=false,spawnError=null,finished=false;
  const env={PATH:process.env.PATH??'/usr/bin:/bin',LC_ALL:'C',LANG:'C',TMPDIR:cwd};
  const limitArgs=[`--as=${memoryBytes}`,`--cpu=${Math.max(1,Math.ceil(timeoutMs/1000)+1)}`,`--fsize=${33554432}`,'--core=0','--',command,...args];
  const child=spawn(prlimit,limitArgs,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});
  const stop=()=>{
   if(!child.pid)return;
   try{process.kill(-child.pid,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{/* Process already ended. */}}
  };
  const timer=setTimeout(()=>{timedOut=true;stop();},timeoutMs);
  for(const channel of ['stdout','stderr'])child[channel].on('data',chunk=>{
   const room=Math.max(0,outputLimitBytes-outputBytes);outputBytes+=chunk.length;
   if(room)chunks[channel].push(chunk.subarray(0,room));
   if(outputBytes>outputLimitBytes){outputLimited=true;stop();}
  });
  child.on('error',error=>{spawnError=error.message;});
  child.on('close',(exitCode,signal)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   // A submission must not leave background descendants after its main exits.
   stop();
   resolveResult({exitCode,signal,timedOut:timedOut||signal==='SIGXCPU',outputLimited,spawnError,milliseconds:milliseconds(performance.now()-started),stdout:Buffer.concat(chunks.stdout).toString('utf8'),stderr:Buffer.concat(chunks.stderr).toString('utf8')});
  });
 });
}

function metricsFor(source){
 try{
  const metrics=measureCppImplementation(source);
  assert.equal(metrics.implementationCharacters,countImplementationCharacters(source),'Shared C++ normalization disagreement');
  return metrics;
 }catch(error){
  return {sourceCharacters:[...source].length,sourceBytes:Buffer.byteLength(source),sourceSha256:sha256(source),nonemptyLines:source.split(/\r?\n/).filter(line=>line.trim()).length,implementationCharacters:null,normalizedSha256:null,measurementError:String(error.message??error)};
 }
}

export async function gradeCalibrationSubmission(task,submission,options={}){
 const policy={...DEFAULTS,...options};
 const source=submission.source??submission.answer;
 assert.equal(typeof source,'string','Expected the resolved source text');
 const row={...submission,trialId:submission.trialId??submission.id??null,taskId:task.id,taskKind:task.kind,language:'cpp',source,...metricsFor(source),accepted:false,passed:false,category:'not-graded',caseCount:(task.cases??task.fixtures)?.length??0,passedCaseCount:0,cases:[]};
 const evidenceError=submission.language&&submission.language!=='cpp'?'This calibration supports C++ submissions only.':
  submission.sourceSha256&&submission.sourceSha256!==row.sourceSha256?'Recorded source hash differs from the exact submitted text.':
  submission.promptSha256&&task.promptSha256&&submission.promptSha256!==task.promptSha256?'Recorded prompt hash differs from the registry task.':null;
 if(evidenceError)return {...row,category:'evidence-mismatch',error:evidenceError};
 let harness;
 try{harness=buildCalibrationHarness(task,source);}catch(error){return {...row,category:'fixture-error',error:String(error.message??error)};}
 Object.assign(row,{taskSha256:sha256(JSON.stringify(task)),casesSha256:sha256(JSON.stringify(task.cases??task.fixtures)),harnessSha256:sha256(harness.source),harnessOrigin:harness.origin,outputFormat:'json-lines'});
 const directory=await mkdtemp(join(tmpdir(),'cti-calibration-'));
 try{
  const sourcePath=join(directory,'submission.cpp'),binaryPath=join(directory,'submission');
  await writeFile(sourcePath,harness.source);
  const compiler=policy.compilerPath??await executablePath('g++'),prlimit=policy.prlimitPath??await executablePath('prlimit');
  const compilation=await runCalibrationProcess(compiler,[...COMPILE_FLAGS,sourcePath,'-o',binaryPath],{cwd:directory,timeoutMs:policy.compileTimeoutMs,memoryBytes:policy.compileMemoryBytes,outputLimitBytes:policy.outputLimitBytes,prlimit});
  row.compilation=compilation;row.compileMilliseconds=compilation.milliseconds;
  if(compilation.spawnError)return {...row,category:'infrastructure-error',error:compilation.spawnError};
  if(compilation.timedOut)return {...row,category:'compile-timeout'};
  if(compilation.outputLimited)return {...row,category:'output-limit',phase:'compile'};
  if(compilation.exitCode!==0)return {...row,category:'compile-error'};
  const execution=await runCalibrationProcess(binaryPath,[],{cwd:directory,timeoutMs:policy.executionTimeoutMs,memoryBytes:policy.executionMemoryBytes,outputLimitBytes:policy.outputLimitBytes,prlimit});
  row.execution=execution;row.executionMilliseconds=execution.milliseconds;row.stdout=execution.stdout;row.stderr=execution.stderr;
  if(execution.spawnError)return {...row,category:'infrastructure-error',error:execution.spawnError};
  if(execution.timedOut)return {...row,category:'execution-timeout'};
  if(execution.outputLimited)return {...row,category:'output-limit',phase:'execution'};
  if(execution.exitCode!==0)return {...row,category:'runtime-error'};
  const compared=compareCalibrationJSONLines(execution.stdout,harness.expected,harness.caseIds);
  return {...row,...compared,accepted:compared.passed,category:compared.passed?'accepted':'wrong-answer',passedCaseCount:compared.cases.filter(value=>value.passed).length};
 }finally{await rm(directory,{recursive:true,force:true});}
}

async function submissionFiles(directory){
 const paths=[];
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const path=join(directory,entry.name);
  if(entry.isDirectory())paths.push(...await submissionFiles(path));
  else if(entry.isFile()&&entry.name.endsWith('.submission.json'))paths.push(path);
 }
 return paths;
}

export async function gradeCalibrationDirectory({registryPath,trialsPath,outputPath,...options}){
 registryPath=resolve(registryPath);trialsPath=resolve(trialsPath);outputPath=resolve(outputPath);
 assert.notEqual(outputPath,registryPath,'Do not overwrite the registry');
 const registryRaw=await readFile(registryPath,'utf8'),registry=JSON.parse(registryRaw),tasks=new Map();
 assert.ok(Array.isArray(registry.tasks)&&registry.tasks.length,'Expected registry.tasks');
 for(const task of registry.tasks){assert.equal(typeof task.id,'string');assert.ok(!tasks.has(task.id),`Duplicate task ID: ${task.id}`);tasks.set(task.id,task);}
 const paths=await submissionFiles(trialsPath),policy={...DEFAULTS,...options};
 const compilerPath=await executablePath(options.compiler??'g++'),prlimitPath=await executablePath('prlimit');
 const version=await runCalibrationProcess(compilerPath,['--version'],{cwd:ROOT,timeoutMs:5000,memoryBytes:policy.compileMemoryBytes,outputLimitBytes:16384,prlimit:prlimitPath});
 assert.equal(version.exitCode,0,`Unable to inspect compiler: ${version.stderr||version.spawnError}`);
 const compilerSha256=sha256(await readFile(compilerPath));
 const submissions=[],seen=new Set();
 for(const path of paths){
  assert.notEqual(outputPath,resolve(path),'Do not overwrite a submission record');
  const raw=await readFile(path,'utf8'),entry=JSON.parse(raw);
  const taskId=entry.taskId??entry.task?.id,task=tasks.get(taskId);
  assert.ok(task,`Unknown taskId in ${relative(ROOT,path)}: ${taskId}`);
  const trialId=entry.trialId??entry.id??relative(trialsPath,path).replace(/\.submission\.json$/,'');
  assert.ok(!seen.has(trialId),`Duplicate trial ID: ${trialId}`);seen.add(trialId);
  let source=entry.source??entry.answer;
  if(entry.sourcePath){
   const pathToSource=resolve(ROOT,entry.sourcePath);
   assert.notEqual(outputPath,pathToSource,'Do not overwrite submitted code');
   const recordedSource=await readFile(pathToSource,'utf8');
   if(source!==undefined)assert.equal(source,recordedSource,`${trialId}: inline/file source mismatch`);
   source=recordedSource;
  }
  assert.equal(typeof source,'string',`${trialId}: missing source/answer/sourcePath`);
  const row=await gradeCalibrationSubmission(task,{...entry,trialId,source,submissionFile:relative(ROOT,path),submissionSha256:sha256(raw),recordedSubmissionJson:raw},{...policy,compilerPath,prlimitPath});
  submissions.push(row);
  console.log(JSON.stringify({trialId,taskId,category:row.category,passed:row.passed,passedCases:row.passedCaseCount,caseCount:row.caseCount,compileMilliseconds:row.compileMilliseconds,executionMilliseconds:row.executionMilliseconds}));
 }
 const expectedIds=(registry.trials??[]).map(trial=>trial.id),missingTrialIds=expectedIds.filter(id=>!seen.has(id));
 const categories={};for(const row of submissions)categories[row.category]=(categories[row.category]??0)+1;
 const report={schemaVersion:1,generatedAt:new Date().toISOString(),grader:'Native g++ C++17 -O2; production Challenge harnesses and a research application harness; strict JSON-line comparison.',
  timingScope:'Compiler/execution milliseconds below are replay costs after the solver clock stopped. Original solver timing metadata is retained unchanged and is never recomputed or added to replay costs.',
  metadataScope:'recordedSubmissionJson and its SHA-256 retain the exact original JSON bytes, including nanosecond integers beyond JavaScript safe-integer precision.',
  registryFile:relative(ROOT,registryPath),registrySha256:sha256(registryRaw),trialsDirectory:relative(ROOT,trialsPath),
  toolchain:{compilerPath,compilerSha256,version:version.stdout.split(/\r?\n/)[0],flags:[...COMPILE_FLAGS],platform:process.platform,architecture:process.arch},
  limits:{compileTimeoutMs:policy.compileTimeoutMs,executionTimeoutMs:policy.executionTimeoutMs,outputLimitBytes:policy.outputLimitBytes,compileMemoryBytes:policy.compileMemoryBytes,executionMemoryBytes:policy.executionMemoryBytes,childProcessGroupsKilled:true,secretEnvironmentInherited:false},
  normalization:'Shared measureCppImplementation/countImplementationCharacters from scripts/analyze-reward-calibration.mjs; excludes includes, comments and whitespace outside literals; counts submitted implementation, never harness code.',
  submissions,summary:{total:submissions.length,accepted:submissions.filter(row=>row.passed).length,rejected:submissions.filter(row=>!row.passed).length,byCategory:categories,expectedTrials:expectedIds.length||null,missingTrialIds}};
 await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
 return report;
}

async function main(){
 const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
 if(args.includes('--help')){console.log('Usage: node scripts/grade-calibration-submissions.mjs --registry REGISTRY.json --trials DIRECTORY --out SUMMARY.json [--compile-timeout-ms 30000] [--exec-timeout-ms 5000] [--output-limit-bytes 1048576]');return;}
 const registryPath=value('--registry'),trialsPath=value('--trials'),outputPath=value('--out');
 assert.ok(registryPath&&trialsPath&&outputPath,'Required flags: --registry, --trials, --out (see --help)');
 const options={};
 for(const [flag,key,max] of [['--compile-timeout-ms','compileTimeoutMs',300000],['--exec-timeout-ms','executionTimeoutMs',300000],['--output-limit-bytes','outputLimitBytes',16777216]]){
  const raw=value(flag);if(raw===undefined)continue;
  const number=Number(raw);assert.ok(Number.isInteger(number)&&number>0&&number<=max,`Invalid ${flag}`);options[key]=number;
 }
 const report=await gradeCalibrationDirectory({registryPath,trialsPath,outputPath,...options});
 console.log(JSON.stringify({output:relative(ROOT,resolve(outputPath)),...report.summary}));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(String(error.stack??error));process.exitCode=1;});
