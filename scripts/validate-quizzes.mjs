// Run reference implementations through the same self-hosted browser runtimes
// as player submissions. No JavaScript imitation of a submitted program.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve('docs');
const release=JSON.parse(await readFile(resolve(root,'version.json'),'utf8'));
const prefix='/code-typer-idle/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip','.css':'text/css'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(!pathname.startsWith(prefix))throw Error('outside base path');
    if(pathname===prefix+'quiz-proof.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Quiz runtime validation</title>');return;}
    const path=resolve(root,pathname.slice(prefix.length));
    if(!path.startsWith(root+'/'))throw Error('outside root');
    const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
const selected=process.argv.find(a=>a.startsWith('--language='))?.split('=')[1];
const firstProjectOnly=process.argv.includes('--first-project-only');
const languages=selected?[selected]:['cpp','csharp','rust','go','python','java','sql','lua'];
const results=[];
try{
  for(const language of languages){
    const context=await browser.newContext();const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'quiz-proof.html');
    console.log(`Checking ${language} reference implementations…`);
    const report=await page.evaluate(async({language,id,base,firstProjectOnly})=>{
      const {quizCatalog}=await import(base+`build/quizcatalog.${id}.js`);
      const {firstProjectQuizCatalog}=await import(base+`build/firstproject.${id}.js`);
      const {compareQuizOutput}=await import(base+`build/quizrunner.${id}.js`);
      const worker=new Worker(base+`build/quizworker.${id}.js`,{type:'module'});
      const send=(message,expectedType,timeout=30000)=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{worker.terminate();reject(Error(`Timeout: ${message.type}`));},timeout);
        worker.onmessage=event=>{
          if(event.data?.type!==expectedType && event.data?.type!=='result')return;
          clearTimeout(timer);
          if(expectedType==='ready' && event.data.type==='result')reject(Error(JSON.stringify(event.data.result)));
          else resolve(event.data.result);
        };
        worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};
        worker.postMessage({...message,id:1});
      });
      const start=performance.now();
      await send({type:'initialize',language},'ready',300000);
      const loadMs=performance.now()-start;
      const questions=(firstProjectOnly?firstProjectQuizCatalog():[...quizCatalog(),...firstProjectQuizCatalog()]).filter(q=>q.language===language);
      const rows=[];
      for(const q of questions){
        const harness=q.createHarness(q.referenceSource),at=performance.now();
        const output=await send({type:'execute',source:harness.source},'result');
        const compared=compareQuizOutput(output.stdout,harness.expected,harness.caseIds);
        rows.push({id:q.id,passed:!output.error && !output.outputTruncated && compared.passed,cases:q.cases.length,ms:Math.round(performance.now()-at),...(!compared.passed||output.error?{output,failures:compared.cases.filter(c=>!c.passed)}:{})});
      }
      const first=questions[0],harness=first.createHarness(first.starterSource);
      const wrong=await send({type:'execute',source:harness.source},'result');
      const wrongRejected=!wrong.error && !compareQuizOutput(wrong.stdout,harness.expected,harness.caseIds).passed;
      const broken=await send({type:'execute',source:language==='sql'?'SELECT ???':harness.source+'\n@ syntax invalid ###'},'result');
      worker.terminate();
      return {language,loadMs:Math.round(loadMs),crossOriginIsolated,referenceCount:rows.length,caseCount:rows.reduce((n,r)=>n+r.cases,0),passed:rows.filter(r=>r.passed).length,wrongRejected,syntaxRejected:!!broken.error,rows};
    },{language,id:release.id,base:url,firstProjectOnly});
    report.pageErrors=errors;results.push(report);
    await mkdir('work/quiz-validation',{recursive:true});
    await writeFile(`work/quiz-validation/${language}.json`,JSON.stringify(report,null,2)+'\n');
    console.log(`${language}: ${report.passed}/${report.referenceCount} references, ${report.caseCount} cases; wrong=${report.wrongRejected}, syntax=${report.syntaxRejected}`);
    for(const failed of report.rows.filter(r=>!r.passed).slice(0,5))console.log(JSON.stringify(failed).slice(0,2000));
    await context.close();
  }
  const evidence={version:release.version,build:release.id,browser:browser.version(),selection:firstProjectOnly?'first project only':'general and first project',transport:'ordinary static HTTP, no content encoding or cross-origin isolation; repository subpath',results};
  await mkdir('work/quiz-validation',{recursive:true});await writeFile('work/quiz-validation/results.json',JSON.stringify(evidence,null,2)+'\n');
  for(const result of results){
    assert.equal(result.referenceCount,firstProjectOnly?3:67,result.language+' coverage');
    assert.equal(result.passed,result.referenceCount,result.language+' reference implementations');
    assert.ok(result.wrongRejected,result.language+' wrong answer');assert.ok(result.syntaxRejected,result.language+' syntax error');assert.deepEqual(result.pageErrors,[],result.language+' page errors');
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
