// Run reference implementations through the same self-hosted browser runtimes
// as player submissions. Syntax Quiz blanks are checked separately; this runs
// executable Challenge implementations and the first game's three components.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { challengeCatalog, CHALLENGE_LANGUAGES } from '../src/challengecatalog.js';
import { firstProjectQuizCatalog } from '../src/firstproject.js';
import { quizExecutionBudgetMs } from '../src/quizrunner.js';
const {chromium}=createRequire(import.meta.url)('playwright');
const argument=name=>{const equals=process.argv.find(value=>value.startsWith(name+'='));if(equals)return equals.slice(name.length+1);const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const selected=argument('--language');
const selectedTopics=(argument('--topics') || '').split(',').filter(Boolean);
const firstProjectOnly=process.argv.includes('--first-project-only');
const newOnly=process.argv.includes('--new-only');
assert.ok(!(firstProjectOnly&&newOnly),'--first-project-only and --new-only select different catalogs');
if(selected)assert.ok(CHALLENGE_LANGUAGES.includes(selected),`Unknown language: ${selected}`);
const selectQuestions=(catalog,first)=>(firstProjectOnly?first:newOnly?catalog.filter(q=>q.id.startsWith('challenge/')):[...catalog,...first]).filter(q=>!selectedTopics.length || selectedTopics.includes(q.topicId));
const sourceQuestions=selectQuestions(challengeCatalog(),firstProjectQuizCatalog());
const languages=selected?[selected]:CHALLENGE_LANGUAGES.filter(language=>sourceQuestions.some(q=>q.language===language));
assert.ok(languages.length,'No challenges match the selected topics');
for(const topic of selectedTopics)assert.ok(sourceQuestions.some(q=>q.topicId===topic),`Unknown topic: ${topic}`);
const expectedCounts=Object.fromEntries(languages.map(language=>[language,sourceQuestions.filter(q=>q.language===language).length]));
const expectedBudgets=Object.fromEntries(sourceQuestions.map(q=>[q.id,quizExecutionBudgetMs(q)]));
// Count equality alone misses a stale build with changed cases or models.
const expectedFingerprints=Object.fromEntries(languages.map(language=>[language,createHash('sha256').update(JSON.stringify(sourceQuestions.filter(q=>q.language===language).map(q=>[q.id,q.referenceSource,q.starterSource,q.cases]))).digest('hex')]));
for(const language of languages)assert.ok(expectedCounts[language]>0,`No selected source challenges: ${language}`);
const root=resolve('docs');
const release=JSON.parse(await readFile(resolve(root,'version.json'),'utf8'));
const prefix='/code-typer-idle/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip','.css':'text/css'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(!pathname.startsWith(prefix))throw Error('outside base path');
  if(pathname===prefix+'quiz-proof.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Challenge runtime validation</title>');return;}
  const path=resolve(root,pathname.slice(prefix.length));
  if(!path.startsWith(root+'/'))throw Error('outside root');
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}${prefix}`;
let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 for(const language of languages){
  const context=await browser.newContext();const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'quiz-proof.html');
  console.log(`Checking ${language} Challenge reference implementations…`);
  const report=await page.evaluate(async({language,id,base,firstProjectOnly,newOnly,selectedTopics})=>{
   const {challengeCatalog}=await import(base+`build/challengecatalog.${id}.js`);
   const {firstProjectQuizCatalog}=await import(base+`build/firstproject.${id}.js`);
   const {compareQuizOutput,quizExecutionBudgetMs}=await import(base+`build/quizrunner.${id}.js`);
   const worker=new Worker(base+`build/quizworker.${id}.js`,{type:'module'});
   const send=(message,expectedType,timeout=30000)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker.terminate();reject(Error(`Timeout: ${message.type}`));},timeout);
    worker.onmessage=event=>{
     if(event.data?.id!==1)return;
     if(event.data.type!==expectedType && event.data.type!=='result')return;
     clearTimeout(timer);
     if(expectedType==='ready' && event.data.type==='result')reject(Error(JSON.stringify(event.data.result)));
     else resolve(event.data.result);
    };
    worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};
    // One initialized worker binds all sequential executions to this ID.
    worker.postMessage({...message,id:1});
   });
   const check=(output,harness)=>{
    const compared=compareQuizOutput(output.stdout,harness.expected,harness.caseIds,harness.outputFormat);
    return {...compared,passed:!output.error&&!output.outputTruncated&&compared.passed};
   };
   try{
    const start=performance.now();
    await send({type:'initialize',language},'ready',300000);
    const loadMs=performance.now()-start;
    const catalog=challengeCatalog(),first=firstProjectQuizCatalog();
    const questions=(firstProjectOnly?first:newOnly?catalog.filter(q=>q.id.startsWith('challenge/')):[...catalog,...first]).filter(q=>q.language===language && (!selectedTopics.length || selectedTopics.includes(q.topicId)));
    if(!questions.length)throw Error(`No built challenges selected for ${language}`);
    const catalogBytes=new TextEncoder().encode(JSON.stringify(questions.map(q=>[q.id,q.referenceSource,q.starterSource,q.cases])));
    const catalogFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',catalogBytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const rows=[];
    for(const q of questions){
     const harness=q.createHarness(q.referenceSource),at=performance.now();
     const budgetMs=quizExecutionBudgetMs(q);
     const output=await send({type:'execute',source:harness.source,sqlChecks:harness.sqlChecks,sqlProgram:harness.sqlProgram},'result',budgetMs);
     const compared=check(output,harness);
     rows.push({id:q.id,passed:compared.passed,cases:harness.expected.length,outputFormat:harness.outputFormat||'numeric',budgetMs,ms:Math.round(performance.now()-at),...(!compared.passed?{output,failures:compared.cases.filter(c=>!c.passed)}:{})});
    }
    // Replaying a validated inexpensive task checks worker isolation without
    // needlessly rerunning a several-minute interpreted reference solution.
    const firstQuestion=questions.reduce((first,q)=>quizExecutionBudgetMs(q)<quizExecutionBudgetMs(first)?q:first,questions[0]);
    const correctHarness=firstQuestion.createHarness(firstQuestion.referenceSource),wrongHarness=firstQuestion.createHarness(firstQuestion.starterSource);
    const firstBudgetMs=quizExecutionBudgetMs(firstQuestion);
    const wrong=await send({type:'execute',source:wrongHarness.source,sqlChecks:wrongHarness.sqlChecks,sqlProgram:wrongHarness.sqlProgram},'result',firstBudgetMs);
    const wrongRejected=!wrong.error&&!check(wrong,wrongHarness).passed;
    const broken=await send({type:'execute',source:language==='sql'?'SELECT ???':correctHarness.source+'\n@ syntax invalid ###'},'result',firstBudgetMs);
    let extraColumnRejected=null,sqlMutationChecks=null,sqlSelectChecks=null;
    if(language==='sql'){
     const extra=await send({type:'execute',source:'SELECT 1 AS expected_value, 2 AS unexpected_column;'},'result');
     extraColumnRejected=!!extra.error&&/one output column/i.test(String(extra.error));
     sqlMutationChecks=[];sqlSelectChecks=[];
     const verifySQL=async(q,source,name,expectedAcceptance=true)=>{
      const harness=q.createHarness(source);
      const output=await send({type:'execute',source:harness.source,sqlChecks:harness.sqlChecks,sqlProgram:harness.sqlProgram},'result',quizExecutionBudgetMs(q));
      const compared=check(output,harness),passed=compared.passed===expectedAcceptance;
      return {id:q.id,name,expectedAcceptance,actualAcceptance:compared.passed,passed,caseCount:harness.expected.length,...(!passed?{output,cases:compared.cases}:{})};
     };
     for(const q of questions.filter(q=>q.mutation)){
      // These final SELECTs are explicitly allowed by mutation task contracts.
      // Their rows must not be confused with the fixture's serialized readback.
      sqlMutationChecks.push(await verifySQL(q,q.referenceSource+'\n'+q.resultQuery+';\n','final-select'));
      sqlMutationChecks.push(await verifySQL(q,"SELECT 'literal;semicolon', 2; /* ; comment ; */\n"+q.referenceSource+'\n'+q.resultQuery+'; -- final comment','intermediate-and-final-output'));
      sqlMutationChecks.push(await verifySQL(q,q.starterSource+'\n'+q.resultQuery+';','readback-without-required-mutation',false));
     }
     const returningVariants={
      'grant-to-valid-balances':'UPDATE accounts SET coins=coins+(SELECT bonus FROM operation) WHERE coins>=0 RETURNING id,coins;',
      'remove-expired-cache':'DELETE FROM cache WHERE expires<=(SELECT now FROM clock) RETURNING id,key,value,revision,expires;',
      'idempotent-event-registration':'INSERT OR IGNORE INTO seen(id,payload) SELECT id,payload FROM incoming RETURNING id,payload;'
     };
     for(const q of questions.filter(q=>Object.hasOwn(returningVariants,q.topicId))){
      sqlMutationChecks.push(await verifySQL(q,returningVariants[q.topicId]+'\n'+q.resultQuery+';','dml-returning-and-final-select'));
     }
     const selectQuestion=questions.find(q=>q.topicId==='available-catalog');
     if(selectQuestion){
      sqlSelectChecks.push(await verifySQL(selectQuestion,'SELECT id,name,price FROM items WHERE stock>0 AND price IS NOT NULL ORDER BY id;','extra-result-column',false));
      sqlSelectChecks.push(await verifySQL(selectQuestion,selectQuestion.referenceSource+'\nSELECT 999;','extra-submitted-statement',false));
     }
     const extraRows=await send({type:'execute',source:'SELECT 1; SELECT 2;'},'result');
     sqlSelectChecks.push({name:'extra-output-after-mutation-replay',passed:!extraRows.error&&!compareQuizOutput(extraRows.stdout,[1]).passed});
    }
    // Reuse the initialized worker, but every program must start with fresh
    // language state. This is stricter than merely using new function names.
    const isolationSource={
     cpp:'#include <iostream>\nint value=0;int main(){std::cout<<++value<<"\\n";}',
     csharp:'class Program{static int value=0;static void Main(string[] args){System.Console.WriteLine(++value);}}',
     java:'public class Main{static int value=0;public static void main(String[] args){System.out.println(++value);}}',
     rust:'static VALUE:std::sync::atomic::AtomicI32=std::sync::atomic::AtomicI32::new(0);fn main(){println!("{}",VALUE.fetch_add(1,std::sync::atomic::Ordering::Relaxed)+1);}',
     go:'package main\nimport "fmt"\nvar value int\nfunc main(){value++;fmt.Println(value)}',
     python:'value = globals().get("value", 0) + 1\nprint(value)',
     lua:'value = (value or 0) + 1\nprint(value)',
     sql:'CREATE TEMP TABLE cti_state(value INTEGER);INSERT INTO cti_state VALUES(1);SELECT COUNT(*) FROM cti_state;'
    }[language];
    const isolated=[];
    for(let attempt=0;attempt<2;attempt++){
     const output=await send({type:'execute',source:isolationSource},'result');
     isolated.push({passed:!output.error&&!output.outputTruncated&&compareQuizOutput(output.stdout,[1]).passed,...(output.error?{error:output.error}:{})});
    }
    const replay=await send({type:'execute',source:correctHarness.source,sqlChecks:correctHarness.sqlChecks,sqlProgram:correctHarness.sqlProgram},'result',firstBudgetMs);
    const reusableWorkerClean=isolated.every(row=>row.passed)&&check(replay,correctHarness).passed;
    return {language,catalogFingerprint,loadMs:Math.round(loadMs),crossOriginIsolated,referenceCount:rows.length,caseCount:rows.reduce((n,r)=>n+r.cases,0),passed:rows.filter(r=>r.passed).length,wrongRejected,syntaxRejected:!!broken.error,extraColumnRejected,sqlMutationChecks,sqlSelectChecks,reusableWorkerClean,isolation:isolated,rows};
   }finally{worker.terminate();}
  },{language,id:release.id,base:url,firstProjectOnly,newOnly,selectedTopics});
  report.pageErrors=errors;results.push(report);
  await mkdir('work/quiz-validation',{recursive:true});
  await writeFile(`work/quiz-validation/${language}.json`,JSON.stringify(report,null,2)+'\n');
  console.log(`${language}: ${report.passed}/${report.referenceCount} references, ${report.caseCount} cases; wrong=${report.wrongRejected}, syntax=${report.syntaxRejected}, fresh=${report.reusableWorkerClean}${language==='sql'?`, extra-column=${report.extraColumnRejected}`:''}`);
  for(const failed of report.rows.filter(row=>!row.passed).slice(0,5))console.log(JSON.stringify(failed).slice(0,2000));
  await context.close();
 }
 const evidence={version:release.version,build:release.id,browser:browser.version(),selection:selectedTopics.length?`topics: ${selectedTopics.join(', ')}`:firstProjectOnly?'first project only':newOnly?'new Challenges only':'all Challenges and first project',expectedCounts,expectedFingerprints,transport:'ordinary static HTTP, no content encoding or cross-origin isolation; repository subpath; reused worker',results};
 await mkdir('work/quiz-validation',{recursive:true});await writeFile('work/quiz-validation/results.json',JSON.stringify(evidence,null,2)+'\n');
 for(const result of results){
  assert.equal(result.referenceCount,expectedCounts[result.language],result.language+' source/build coverage');
  assert.equal(result.catalogFingerprint,expectedFingerprints[result.language],result.language+' source/build models and fixtures (run the build script if stale)');
  assert.equal(result.passed,result.referenceCount,result.language+' reference implementations');
  for(const row of result.rows)assert.equal(row.budgetMs,expectedBudgets[row.id],row.id+' source/build execution budget');
  assert.ok(result.wrongRejected,result.language+' wrong answer');assert.ok(result.syntaxRejected,result.language+' syntax error');
  assert.ok(result.reusableWorkerClean,result.language+' reused worker isolation');
  if(result.language==='sql'){
   assert.ok(result.extraColumnRejected,'SQL must reject extra output columns');
   for(const check of [...result.sqlMutationChecks,...result.sqlSelectChecks])assert.ok(check.passed,JSON.stringify(check));
  }
  assert.deepEqual(result.pageErrors,[],result.language+' page errors');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
