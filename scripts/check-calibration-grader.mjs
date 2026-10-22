// Research-only controls for the native calibration grader. These are separate
// from solver trials and never enter difficulty or reward calibration results.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'cti-calibration-controls-'));
const trials=join(directory,'trials');
const registryPath=join(directory,'registry.json');
const outputPath=join(directory,'summary.json');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const task={
 id:'native-grader-control',kind:'app',entryPoint:'double_value',
 publicSpec:{
  parameters:[{name:'x',type:'int'}],resultType:'int',
  starterSource:'int double_value(int x) { return 0; }'
 },
 cases:[{id:'positive',args:[3],expected:6},{id:'zero',args:[0],expected:0}]
};
const controls=[
 {id:'accepted',category:'accepted',source:'// Byte-preservation control: café.\r\nint double_value(int x) { return x * 2; }\r\n'},
 {id:'wrong',category:'wrong-answer',source:'int double_value(int x) { return x; }'},
 {id:'syntax',category:'compile-error',source:'int double_value(int x) { return ; this is not C++; }'},
 {id:'timeout',category:'execution-timeout',source:'int double_value(int x) { volatile unsigned long long spin=0; for (;;) { ++spin; } }'},
 {id:'runtime',category:'runtime-error',source:'#include <cstdlib>\nint double_value(int x) { std::abort(); }'},
 {id:'extra-output',category:'wrong-answer',source:'#include <iostream>\nint double_value(int x) { std::cout << "123\\n"; return x * 2; }'},
 {id:'output-limit',category:'output-limit',source:'#include <iostream>\nint double_value(int x) { for (int i=0; i<200000; ++i) std::cout << "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; return x * 2; }'},
 {id:'json-boolean',category:'wrong-answer',source:'#include <iostream>\n#include <cstdlib>\nint double_value(int x) { std::cout << "true\\nfalse\\n"; std::exit(0); }'},
 {id:'json-string',category:'wrong-answer',source:'#include <iostream>\n#include <cstdlib>\nint double_value(int x) { std::cout << "\\\"6\\\"\\n\\\"0\\\"\\n"; std::exit(0); }'}
];

async function run(command,args) {
 const child=spawn(command,args,{cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
 const chunks={stdout:[],stderr:[]};
 let bytes=0;
 for(const channel of ['stdout','stderr'])child[channel].on('data',chunk=>{
  bytes+=chunk.length;
  if(bytes<=1024*1024)chunks[channel].push(chunk);
 });
 let timedOut=false;
 const timer=setTimeout(()=>{
  timedOut=true;
  try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL');}catch{/* Already exited. */}
 },120000);
 try {
  const result=await new Promise((resolve,reject)=>{
   child.once('error',reject);
   child.once('close',(code,signal)=>resolve({code,signal}));
  });
  const stdout=Buffer.concat(chunks.stdout).toString('utf8');
  const stderr=Buffer.concat(chunks.stderr).toString('utf8');
  assert.equal(timedOut,false,'the controls runner itself must finish within 120 seconds');
  assert.equal(result.code,0,`grader CLI failed: ${stderr}\n${stdout}`);
  return {stdout,stderr};
 }finally{clearTimeout(timer);}
}

try {
 await mkdir(trials);
 await writeFile(registryPath,JSON.stringify({schemaVersion:1,tasks:[task]},null,2)+'\n');
 for(const control of controls){
  const sourcePath=join(trials,`${control.id}.answer.cpp`);
  await writeFile(sourcePath,control.source);
  await writeFile(join(trials,`${control.id}.submission.json`),JSON.stringify({
   taskId:task.id,trialId:`control-${control.id}`,language:'cpp',sourcePath,
   requestedModel:'native-control-fixture',started:{monotonicNs:'1000'},ended:{monotonicNs:'2000'},
   timing:{elapsedSeconds:0.000001,scope:'fixture metadata, not a measured solver trial'}
  },null,2)+'\n');
 }
 const cli=await run(process.execPath,[
  join(root,'scripts/grade-calibration-submissions.mjs'),
  '--registry',registryPath,'--trials',trials,'--out',outputPath,
  '--compile-timeout-ms','15000','--exec-timeout-ms','150','--output-limit-bytes','4096'
 ]);
 const report=JSON.parse(await readFile(outputPath,'utf8'));
 assert.ok(Array.isArray(report.submissions),'summary includes all recorded submissions');
 assert.equal(report.submissions.length,controls.length);
 const rows=new Map(report.submissions.map(row=>[row.trialId,row]));
 for(const control of controls){
  const row=rows.get(`control-${control.id}`);
  assert.ok(row,`missing control ${control.id}`);
  assert.equal(row.category,control.category,`${control.id}: ${JSON.stringify(row)}`);
  assert.equal(row.passed,control.category==='accepted',control.id);
  assert.equal(row.requestedModel,'native-control-fixture','solver metadata survives grading');
  assert.deepEqual(row.started,{monotonicNs:'1000'});
  assert.deepEqual(row.ended,{monotonicNs:'2000'});
  assert.equal(row.source,control.source,'the original submission is preserved verbatim');
  const sourceHash=row.sourceSha256??row.hashes?.sourceSha256??row.hashes?.source;
  assert.equal(sourceHash,sha256(control.source),'source hash identifies the exact recorded bytes');
  assert.ok(Number.isFinite(row.compileMilliseconds)&&row.compileMilliseconds>=0,'compiler time is reported separately');
  if(row.category==='compile-error'||row.category==='compile-timeout'||row.phase==='compile'){
   assert.ok(row.executionMilliseconds==null,'failed compilation cannot report a fabricated execution time');
  }else{
   assert.ok(Number.isFinite(row.executionMilliseconds)&&row.executionMilliseconds>=0,'execution time is reported separately');
  }
 }
 const accepted=rows.get('control-accepted');
 assert.equal(accepted.caseCount,2);
 assert.equal(accepted.passedCaseCount,2);
 assert.equal(accepted.implementationCharacters,33,'comments and formatting do not inflate implementation characters');
 console.log(JSON.stringify({
  controls:controls.length,categories:[...new Set(controls.map(control=>control.category))],
  verified:['actual native compilation','wrong answer','syntax error','bounded execution',
   'runtime abort','extra output','bounded output','JSON boolean/string types',
   'source hash','original source and solver metadata'],
  cliStdout:cli.stdout.trim().split('\n').slice(-1)[0]||''
 }));
} finally {
 await rm(directory,{recursive:true,force:true});
}
