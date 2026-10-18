// SPDX-License-Identifier: BSL-1.0
// Rebuild the original Go adapter and prepare the pinned MIT Rust/Miri assets.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {copyFile,cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {gzipSync,gunzipSync} from 'node:zlib';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=join(root,'runtime-assets');
const cache=join(root,'work','vendor-rust-go');
const flags=new Set(process.argv.slice(2));
const sha=data=>createHash('sha256').update(data).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const saveJSON=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const goArchiveSHA='9e9b755d63b36acf30c12a9a3fc379243714c1c6d3dd72861da637f336ebb35b';
const rustRef='00de75bcec3d8cf5156aef2382c738cbfe069986';

async function download(url,path){
 await mkdir(dirname(path),{recursive:true});
 execFileSync('curl',['--fail','--location','--retry','2','--silent','--show-error',url,'--output',path],{stdio:'inherit'});
}
async function record(path){const data=await readFile(path);return {bytes:data.length,sha256:sha(data)};}
async function sourceRecords(directory){
 const result={};
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const path=join(directory,entry.name);
  if(entry.isDirectory()){
   const nested=await sourceRecords(path);
   for(const [name,value]of Object.entries(nested))result[entry.name+'/'+name]=value;
  }else result[entry.name]=await record(path);
 }
 return result;
}
async function verify(){
 for(const language of ['rust','go']){
  const directory=join(assets,language),manifest=await json(join(directory,'manifest.json'));
  for(const entry of [manifest.compiler,...(manifest.libraries||[]),...(manifest.glue?[manifest.glue]:[])]){
   const actual=await record(join(directory,entry.path));
   if(actual.sha256!==entry.sha256||actual.bytes!==entry.bytes)throw new Error(`${language}/${entry.path}: checksum mismatch`);
  }
  if(manifest.runtimeModule){
   const actual=await record(join(directory,'runtime.js'));
   if(actual.sha256!==manifest.runtimeModule.sha256)throw new Error(`${language}/runtime.js: checksum mismatch`);
  }
  if(manifest.sources){
   const actual=await sourceRecords(join(directory,'source'));
   if(!isDeepStrictEqual(actual,manifest.sources))throw new Error(`${language}: source changed; rebuild the runtime`);
  }
  console.log(`${language}: pinned runtime files verified`);
 }
}

async function buildRust(){
 const directory=join(assets,'rust');
 const upstream=await json(join(directory,'source','UPSTREAM.json'));
 if(upstream.commit!==rustRef)throw new Error('Unexpected Rust/Miri upstream revision');
 const files=[];
 for(const entry of [upstream.compiler,...upstream.libraries]){
  const local=join(root,'work','runtime-research','rust-go','rubri',entry.upstreamPath);
  const cached=join(cache,'rust-upstream',entry.name+'.gz');
  let raw;
  if(existsSync(local))raw=await readFile(local);
  else if(existsSync(join(directory,entry.path)))raw=gunzipSync(await readFile(join(directory,entry.path)));
  else{
   if(!existsSync(cached))await download(`https://raw.githubusercontent.com/LyonSyonII/rubri/${rustRef}/${entry.upstreamPath}.gz`,cached);
   raw=gunzipSync(await readFile(cached));
  }
  if(sha(raw)!==entry.rawSha256)throw new Error(`${entry.name}: upstream checksum mismatch`);
  const compressed=gzipSync(raw,{level:9,mtime:0});
  const destination=join(directory,entry.path);await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination,compressed);
  files.push({...entry,bytes:compressed.length,sha256:sha(compressed)});
 }
 execFileSync('npm',['exec','--yes','--package=esbuild@0.25.5','--','esbuild',join(directory,'source','driver.js'),'--bundle','--format=esm','--target=es2022','--outfile='+join(directory,'runtime.js')],{
  cwd:root,stdio:'inherit',env:{...process.env,npm_config_cache:join(cache,'npm-cache')},
 });
 await saveJSON(join(directory,'manifest.json'),{
  format:1,runtime:'rustc-miri',version:'1.78.0-dev',upstream:'https://github.com/LyonSyonII/rubri',commit:rustRef,
  compiler:files[0],libraries:files.slice(1),runtimeModule:await record(join(directory,'runtime.js')),
  sources:await sourceRecords(join(directory,'source')),
 });
 console.log(`rust: ${files.reduce((n,file)=>n+file.bytes,0)} compressed bytes`);
}

async function nativeGo(){
 if(process.env.CTI_GO)return process.env.CTI_GO;
 const existing=join(root,'work','runtime-research','rust-go','toolchain','go','bin','go');
 if(existsSync(existing))return existing;
 if(process.platform!=='linux'||process.arch!=='x64')throw new Error('Set CTI_GO to a native Go 1.25.5 executable on this platform');
 const binary=join(cache,'toolchain','go','bin','go');
 if(existsSync(binary))return binary;
 const archive=join(cache,'go1.25.5.linux-amd64.tar.gz');
 if(!existsSync(archive))await download('https://dl.google.com/go/go1.25.5.linux-amd64.tar.gz',archive);
 if(sha(await readFile(archive))!==goArchiveSHA)throw new Error('Go toolchain archive checksum mismatch');
 await mkdir(join(cache,'toolchain'),{recursive:true});
 execFileSync('tar',['-xzf',archive,'-C',join(cache,'toolchain')],{stdio:'inherit'});
 return binary;
}

async function buildGo(){
 const directory=join(assets,'go'),source=join(directory,'source'),go=await nativeGo();
 const version=execFileSync(go,['version'],{encoding:'utf8'}).trim();
 if(!version.startsWith('go version go1.25.5 '))throw new Error('Reproduction requires the pinned Go 1.25.5 toolchain');
 const env={...process.env,GOTOOLCHAIN:'local',GOWORK:'off',GOFLAGS:'',GOPATH:join(cache,'gopath'),GOMODCACHE:join(cache,'modules'),GOCACHE:join(cache,'build-cache')};
 execFileSync(go,['mod','download'],{cwd:source,env,stdio:'inherit'});
 const wasm=join(cache,'go-runtime.wasm');await mkdir(cache,{recursive:true});
 execFileSync(go,['build','-trimpath','-ldflags=-s -w','-o',wasm,'.'],{cwd:source,env:{...env,GOOS:'js',GOARCH:'wasm',CGO_ENABLED:'0'},stdio:'inherit'});
 const goroot=execFileSync(go,['env','GOROOT'],{env,encoding:'utf8'}).trim();
 const raw=await readFile(wasm),compressed=gzipSync(raw,{level:9,mtime:0});
 await writeFile(join(directory,'yaegi.wasm.gz'),compressed);
 await copyFile(join(goroot,'lib','wasm','wasm_exec.js'),join(directory,'wasm_exec.js'));
 await copyFile(join(goroot,'LICENSE'),join(assets,'licenses','go-BSD-3-Clause.txt'));
 await copyFile(join(env.GOMODCACHE,'github.com','traefik','yaegi@v0.16.1','LICENSE'),join(assets,'licenses','go-yaegi-Apache-2.0.txt'));
 await saveJSON(join(directory,'manifest.json'),{
  format:1,runtime:'yaegi',version:'0.16.1',toolchain:'go1.25.5',
  compiler:{path:'yaegi.wasm.gz',rawBytes:raw.length,bytes:compressed.length,sha256:sha(compressed),rawSha256:sha(raw)},
  glue:{path:'wasm_exec.js',...await record(join(directory,'wasm_exec.js'))},
  packages:['fmt','math','strings','sort','strconv','errors','unicode/utf8'],
  sources:await sourceRecords(source),
 });
 console.log(`go: ${compressed.length} compressed bytes (original wrapper, restricted exports)`);
}

// runtime-assets/ is generated and ignored. A fresh checkout contains its
// published counterpart, including the reproducible adapter sources.
for(const language of ['rust','go']){
 const destination=join(assets,language),published=join(root,'docs','runtime-assets','v1',language);
 if(!existsSync(destination)&&existsSync(published))await cp(published,destination,{recursive:true});
 else if(!existsSync(join(destination,'source'))&&existsSync(join(published,'source')))await cp(join(published,'source'),join(destination,'source'),{recursive:true});
}
await mkdir(join(assets,'licenses'),{recursive:true});
const publishedLicenses=join(root,'docs','runtime-assets','v1','licenses');
if(existsSync(publishedLicenses))for(const name of await readdir(publishedLicenses)){
 if(/^(?:go|rust)-/.test(name)&&!existsSync(join(assets,'licenses',name)))await copyFile(join(publishedLicenses,name),join(assets,'licenses',name));
}
await mkdir(cache,{recursive:true});
if(flags.has('--verify'))await verify();
else{
 if(!flags.has('--go-only'))await buildRust();
 if(!flags.has('--rust-only'))await buildGo();
 await verify();
}
