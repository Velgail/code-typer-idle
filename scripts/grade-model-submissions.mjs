// Research-only: grade submitted answers with the production browser modules.
// Generation timings belong to the solver record; the times here are compiler/
// runtime timings and must not be added to a model's solving-time estimate.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {challengeById} from '../src/challengecatalog.js';
import {firstProjectQuizById} from '../src/firstproject.js';
import {skillQuizById} from '../src/skillquiz.js';

if(process.argv.length!==4 || process.argv.includes('--help')){
 console.log('Usage: node scripts/grade-model-submissions.mjs INPUT.json OUTPUT.json');
 console.log('Input: [{id,answer,...metadata}] or {submissions:[...]}. Grades recorded answers only; does not call a model.');
 process.exit(process.argv.includes('--help')?0:2);
}
const inputPath=resolve(process.argv[2]);
const outputPath=resolve(process.argv[3]);
if(inputPath===outputPath)throw Error('Input and output paths must differ; recorded model answers are immutable evidence.');
const input=JSON.parse(await readFile(inputPath,'utf8'));
const submissions=Array.isArray(input)?input:input.submissions;
if(!Array.isArray(submissions)||!submissions.length)throw Error('Expected a nonempty array, or {submissions:[...]}, of {id,answer,...}.');
const sourceMetadata=submissions.map((entry,index)=>{
 if(!entry||typeof entry.id!=='string'||typeof entry.answer!=='string')throw Error(`Invalid submission ${index}: id and answer must be strings.`);
 const q=challengeById(entry.id)||firstProjectQuizById(entry.id)||skillQuizById(entry.id);
 if(!q)throw Error(`Unknown question ID: ${entry.id}`);
 const model=q.kind==='skill-quiz'?[q.id,q.code,q.answer,q.alternatives||[]]:[q.id,q.referenceSource,q.starterSource,q.cases];
 return {id:q.id,kind:q.kind||'challenge',fingerprint:createHash('sha256').update(JSON.stringify(model)).digest('hex')};
});
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve('docs'),release=JSON.parse(await readFile(resolve(root,'version.json'),'utf8'));
const expectedBuild=!Array.isArray(input)?input.expectedBuild||input.build:null;
if(expectedBuild&&expectedBuild!==release.id)throw Error(`Recorded build ${expectedBuild} differs from production build ${release.id}. Rebuild/check out the recorded version before replaying.`);
const prefix='/code-typer-idle/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip','.css':'text/css'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(pathname===prefix+'luna-grade.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Research answer grading</title>');return;}
  if(!pathname.startsWith(prefix))throw Error('outside base path');
  const path=resolve(root,pathname.slice(prefix.length));
  if(!path.startsWith(root+'/'))throw Error('outside root');
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}${prefix}`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const context=await browser.newContext(),page=await context.newPage(),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(base+'luna-grade.html');
 const grades=await page.evaluate(async({submissions,sourceMetadata,base,build})=>{
  const {challengeById}=await import(base+`build/challengecatalog.${build}.js`);
  const {firstProjectQuizById}=await import(base+`build/firstproject.${build}.js`);
  const {skillQuizById,gradeSkillQuiz}=await import(base+`build/skillquiz.${build}.js`);
  const {QuizRunner}=await import(base+`build/quizrunner.${build}.js`);
  const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
  const rows=[];
  for(let i=0;i<submissions.length;i++){
   const entry=submissions[i],q=challengeById(entry.id)||firstProjectQuizById(entry.id)||skillQuizById(entry.id);
   if(!q)throw Error(`Built question missing: ${entry.id}`);
   const model=q.kind==='skill-quiz'?[q.id,q.code,q.answer,q.alternatives||[]]:[q.id,q.referenceSource,q.starterSource,q.cases];
   const fingerprint=await digest(model);
   if(fingerprint!==sourceMetadata[i].fingerprint)throw Error(`Source/build mismatch: ${entry.id}. Build before grading.`);
   const row={...entry,submissionIndex:i,id:q.id,kind:q.kind||'challenge',language:q.language,subject:q.subject,title:q.title,authoredDifficulty:q.difficulty,authoredEstimatedMinutes:q.estimatedMinutes,catalogFingerprint:fingerprint,answerCharacters:entry.answer.length,answerBytes:new TextEncoder().encode(entry.answer).length};
   if(q.kind==='skill-quiz'){
    const started=performance.now(),grade=gradeSkillQuiz(q,entry.answer);
    rows.push({...row,passed:grade.passed,status:grade.status,gradeMilliseconds:Math.round((performance.now()-started)*1000)/1000,category:grade.passed?'accepted':'wrong-answer',cases:[],caseCount:null,passedCaseCount:null});
    continue;
   }
   const runner=new QuizRunner(),started=performance.now();let ready=null;
   try{
    const grade=await runner.run(q,entry.answer,{onProgress:text=>{if(text.startsWith('コンパイル'))ready=performance.now();}});
    const ended=performance.now();
    const category=grade.passed?'accepted':grade.status==='failed'?'wrong-answer':grade.status==='compile-error'?'submission-compile-error':grade.status==='runtime-error'?'submission-runtime-error':grade.status==='timeout'?(ready===null?'infrastructure-loading-timeout':'execution-timeout-needs-inspection'):'error-needs-inspection';
    rows.push({...row,passed:grade.passed,status:grade.status,category,loadMilliseconds:ready===null?null:Math.round(ready-started),compileAndTestMilliseconds:ready===null?null:Math.round(ended-ready),gradeMilliseconds:Math.round(ended-started),caseCount:grade.cases.length,passedCaseCount:grade.cases.filter(c=>c.passed).length,cases:grade.cases,extraOutput:grade.extraOutput||false,error:grade.error||'',diagnostics:grade.diagnostics||[],stderr:grade.stderr||'',stdout:grade.stdout||''});
   }finally{runner.cancel();}
  }
  return rows;
 },{submissions,sourceMetadata,base,build:release.id});
 if(pageErrors.length)throw Error(`Page errors: ${pageErrors.join('\n')}`);
 const report={schemaVersion:1,generatedAt:new Date().toISOString(),build:release.id,version:release.version,grader:'Unmodified production browser QuizRunner; syntax Quiz uses unmodified production gradeSkillQuiz.',inputFile:relative(process.cwd(),inputPath),inputSha256:createHash('sha256').update(await readFile(inputPath)).digest('hex'),scope:'Regrades recorded answers without changing source text; does not call or time a model. Extra per-submission provenance fields are preserved. Source and production-build fingerprints must match.',timingWarning:'loadMilliseconds and compileAndTestMilliseconds are runtime/compiler costs, not model solving time. Timeout and generic error classifications require inspection before counting a model error.',submissions:grades,summary:{total:grades.length,accepted:grades.filter(r=>r.passed).length,rejected:grades.filter(r=>!r.passed).length}};
 await mkdir(resolve(outputPath,'..'),{recursive:true});await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
 for(const row of grades)console.log(JSON.stringify({id:row.id,status:row.status,passed:row.passed,passedCases:row.passedCaseCount,totalCases:row.caseCount,loadMs:row.loadMilliseconds,compileAndTestMs:row.compileAndTestMilliseconds}));
 console.log(`Wrote ${outputPath}`);
 await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
