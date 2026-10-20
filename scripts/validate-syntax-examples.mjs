// Validate the authored C++/Rust examples after filling their one blank.
// These are syntax/type/borrow checks: OS operations in the examples are not run.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {CPP_SKILL_QUIZZES,RUST_SKILL_QUIZZES} from '../src/skillquizdata/cpprust.js';
const equals=process.argv.find(value=>value.startsWith('--language='));
const argumentIndex=process.argv.indexOf('--language');
const selected=equals?.slice('--language='.length)||(argumentIndex>=0?process.argv[argumentIndex+1]:undefined);
if(selected)assert.ok(['cpp','rust'].includes(selected),'Syntax example validation currently supports cpp and rust');
const languages=selected?[selected]:['cpp','rust'];
const destination=resolve('work/syntax-validation');await mkdir(destination,{recursive:true});
const evidence={syntaxOnly:true,executionVerified:false,results:[]};
for(const language of languages){
 const rows=language==='cpp'?CPP_SKILL_QUIZZES:RUST_SKILL_QUIZZES;
 assert.ok(rows.length>0);
 for(const row of rows)assert.equal((row.code.match(/____/g)||[]).length,1,row.id+' blank');
 if(language==='cpp'){
  const scratch=await mkdtemp(resolve(destination,'cpp-'));
  const failures=[];
  try{
   for(const row of rows){
    const path=resolve(scratch,'example.cpp');await writeFile(path,row.code.replace('____',row.answer));
    const result=spawnSync(process.env.CXX||'g++',['-std=c++20','-fsyntax-only','-pthread',path],{encoding:'utf8',timeout:30000});
    if(result.error||result.status!==0)failures.push({id:row.id,error:String(result.error||result.stderr).slice(0,6000)});
   }
  }finally{await rm(scratch,{recursive:true,force:true});}
  const report={language,count:rows.length,passed:rows.length-failures.length,method:'g++ C++20 -fsyntax-only',failures};
  evidence.results.push(report);await writeFile(resolve(destination,'cpp.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`C++: ${report.passed}/${report.count} examples compile`);
 }else{
  const {chromium}=createRequire(import.meta.url)('playwright');
  const docs=resolve('docs'),adapter=resolve('src/runners/rust.js');
  const mime={'.js':'text/javascript','.json':'application/json','.gz':'application/gzip','.wasm':'application/wasm'};
  const server=createServer(async(req,res)=>{
   try{
    const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(pathname==='/proof.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Rust example type checks</title>');return;}
    const path=pathname==='/rust-adapter.js'?adapter:resolve(docs,pathname.slice(1));
    if(path!==adapter&&!path.startsWith(docs+'/'))throw Error('outside assets');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
   }catch{res.statusCode=404;res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/`;
  let browser;
  try{
   browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
   const page=await browser.newPage();await page.goto(base+'proof.html');
   const source=rows.map((row,i)=>`mod question_${i}{\n${row.code.replace('____',row.answer)}\n}`).join('\n')+'\nfn main(){println!("examples type checked");}\n';
   const report=await page.evaluate(async({base,source,count})=>{
    const body=`import * as adapter from '${base}rust-adapter.js';self.onmessage=async e=>{try{if(e.data.initialize){await adapter.initialize('${base}runtime-assets/v1/');postMessage({ready:true});}else postMessage(await adapter.execute(e.data.source));}catch(error){postMessage({error:String(error)});}}`;
    const worker=new Worker(URL.createObjectURL(new Blob([body],{type:'text/javascript'})),{type:'module'});
    const send=message=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Rust type-check timeout')),300000);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.postMessage(message);});
    try{
     const initialized=await send({initialize:true});
     if(!initialized.ready)throw Error(JSON.stringify(initialized));
     const output=await send({source});
     const typeControl=await send({source:'mod unused{fn invalid(){let value:i32="bad";}}fn main(){}'});
     const borrowControl=await send({source:'mod unused{fn invalid(){let mut values=vec![1];let item=&values[0];values.push(2);println!("{}",item);}}fn main(){}'});
     return {language:'rust',count,passed:!output.error&&output.stdout.trim()==='examples type checked'?count:0,method:'self-hosted rustc/Miri, isolated modules, unused example main functions',output,typeErrorRejected:typeControl.errorKind==='compile'&&String(typeControl.stderr).includes('E0308'),borrowErrorRejected:borrowControl.errorKind==='compile'&&String(borrowControl.stderr).includes('E0502'),typeControl,borrowControl,crossOriginIsolated};
    }finally{worker.terminate();}
   },{base,source,count:rows.length});
   evidence.results.push(report);await writeFile(resolve(destination,'rust.json'),JSON.stringify(report,null,2)+'\n');
   console.log(`Rust: ${report.passed}/${report.count} examples type/borrow check; invalid type=${report.typeErrorRejected}, invalid borrow=${report.borrowErrorRejected}`);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
 }
}
await writeFile(resolve(destination,'results.json'),JSON.stringify(evidence,null,2)+'\n');
for(const report of evidence.results){assert.equal(report.passed,report.count,report.language+' correct examples');if(report.language==='rust'){assert.ok(report.typeErrorRejected,'Rust must check unused function types');assert.ok(report.borrowErrorRejected,'Rust must check unused function borrows');}}
