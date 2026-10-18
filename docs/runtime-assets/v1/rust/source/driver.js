// SPDX-License-Identifier: BSL-1.0
// Original Code Typer Idle driver around Rubri's MIT WASI implementation.
import WASI from './wasi/wasi.ts';
import {Fd} from './wasi/fd.ts';
import {File,Directory,PreopenDirectory} from './wasi/fs_mem.ts';

const OUTPUT_LIMIT = 64 * 1024;
const CACHE_NAME = 'code-typer-rust-00de75b-r1';
const encoder = new TextEncoder();

class Capture extends Fd {
 constructor() { super(); this.chunks=[]; this.length=0; this.truncated=false; }
 fd_write(data) {
  const keep = Math.min(data.length, OUTPUT_LIMIT-this.length);
  if (keep) { this.chunks.push(data.slice(0,keep)); this.length+=keep; }
  if (keep<data.length) this.truncated=true;
  return {ret:0,nwritten:data.length};
 }
 text() {
  const bytes=new Uint8Array(this.length);let position=0;
  for(const chunk of this.chunks){bytes.set(chunk,position);position+=chunk.length;}
  return new TextDecoder().decode(bytes);
 }
 fd_read() {return {ret:0,data:new Uint8Array()};}
}

async function loadBytes(url) {
 let cache;
 try { if(globalThis.caches)cache=await caches.open(CACHE_NAME); } catch { /* Storage is optional. */ }
 let response=await cache?.match(url);
 if(!response){
  response=await fetch(url);
  if(!response.ok)throw new Error(`Rust runtime download failed (${response.status})`);
  if(cache)try {await cache.put(url,response.clone());}catch{/* A full cache must not prevent execution. */}
 }
 let bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  if(typeof DecompressionStream!=='function')throw new Error('This browser cannot decompress the Rust runtime');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 return bytes;
}

export async function createRuntime(baseUrl) {
 const root=new URL(baseUrl);
 const response=await fetch(new URL('manifest.json',root));
 if(!response.ok)throw new Error(`Rust manifest download failed (${response.status})`);
 const manifest=await response.json();
 const [module,libraries]=await Promise.all([
  loadBytes(new URL(manifest.compiler.path,root)).then(bytes=>WebAssembly.compile(bytes)),
  Promise.all(manifest.libraries.map(async entry=>({name:entry.name,bytes:await loadBytes(new URL(entry.path,root))}))),
 ]);
 return {
  async execute(source) {
   const stdin=new Capture(),stdout=new Capture(),stderr=new Capture();
   const rootDirectory=new PreopenDirectory('/',[['main.rs',new File(encoder.encode(String(source)))]]);
   const tmp=new PreopenDirectory('/tmp',[]);
   const sysroot=new PreopenDirectory('/sysroot',[
    ['lib',new Directory([
     ['rustlib',new Directory([
      ['wasm32-wasi',new Directory([['lib',new Directory([])]])],
      ['x86_64-unknown-linux-gnu',new Directory([
       ['lib',new Directory(libraries.map(entry=>[entry.name,new File(entry.bytes.buffer,{readonly:true})]))],
      ])],
     ])],
    ])],
   ]);
   const wasi=new WASI([
    'miri','--sysroot','/sysroot','main.rs','--target','x86_64-unknown-linux-gnu',
    '--edition=2021','-Awarnings','-Zmir-opt-level=3','-Zmiri-ignore-leaks',
    '-Zmiri-permissive-provenance','-Zmiri-preemption-rate=0',
    '-Zmiri-disable-alignment-check','-Zmiri-disable-data-race-detector',
    '-Zmiri-disable-stacked-borrows','-Zmiri-disable-validation',
    '-Zmir-emit-retag=false','-Zmiri-disable-isolation','-Zmiri-panic-on-unsupported','--color=never',
   ],[],[stdin,stdout,stderr,tmp,sysroot,rootDirectory],{debug:false});
   let instance,status=0,failure;
   try {
    let nextThread=1;
    instance=await WebAssembly.instantiate(module,{
     env:{memory:new WebAssembly.Memory({initial:256,maximum:4096,shared:false})},
     wasi:{'thread-spawn':argument=>{const id=nextThread++;instance.exports.wasi_thread_start(id,argument);return id;}},
     wasi_snapshot_preview1:wasi.wasiImport,
    });
    status=wasi.start(instance);
   }catch(error){failure=String(error);}
   const result={stdout:stdout.text(),stderr:stderr.text()};
   if(status||failure){
    result.error=failure||`Rust evaluation failed (status ${status})`;
    result.diagnostics=result.stderr||result.error;
    const runtimeDiagnostic=/panicked|unsupported Miri functionality|undefined behavior|unsupported operation|abnormal termination|program aborted/i.test(result.diagnostics);
    result.errorKind=!failure&&!runtimeDiagnostic&&/\berror(?:\[E\d+\])?:/.test(result.diagnostics)?'compile':'runtime';
   }
   if(stdout.truncated||stderr.truncated)result.outputTruncated=true;
   return result;
  },
 };
}
