// Repackage verified, pinned compiler artifacts. Never invoked by the game build.
// See runtime-assets/{cpp,java}/*/BUILD.md for upstream rebuild commands.
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const project = resolve(new URL('..', import.meta.url).pathname);
const cache = resolve(project, 'work/runtime-research');
const notices = resolve(project, 'work/runtime-integration-cpp-java');
const cpp = resolve(project, 'runtime-assets/cpp/browsercc-0.1.1');
const java = resolve(project, 'runtime-assets/java/teavm-javac-208d4c97');
const licenseRoot = resolve(project, 'runtime-assets/licenses');
const cppPackage = resolve(cache, 'cpp/browsercc-package/package');
const shimPackage = resolve(cache, 'cpp/wasi-shim/package');
const javaProject = resolve(cache, 'csharp-java/teavm-javac');
const jdkRevision = '6c48f4ed707bf0b15f9b6098de30db8aae6fa40f';
const jdk = resolve(javaProject, `javac/build/jdk/jdk25u-${jdkRevision}`);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
await Promise.all([cpp, java, licenseRoot + '/cpp', licenseRoot + '/java'].map(path => mkdir(path, { recursive: true })));
const manifest = { cpp: [], java: [] };
async function pack(kind, input, output, compressed = false) {
  const raw = await readFile(input), bytes = compressed ? gzipSync(raw, { level: 9 }) : raw;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  manifest[kind].push({ path: relative(kind === 'cpp' ? cpp : java, output), bytes: bytes.length,
    sha256: sha256(bytes), decodedBytes: raw.length, decodedSha256: sha256(raw) });
}
async function notice(source, name) {
  const target = resolve(licenseRoot, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

// Validate the downloaded npm artifacts against their pinned registry integrity.
for (const [path, integrity] of [
  ['cpp/browsercc-0.1.1.tgz', 'zKSm2b10XjqRBPkY67rS5FK+YgcXd5CH2GRVwyK2+f7EOQRmHR0IN2lQCvJZQfTytSFbwFmlIpZaxSMFcE+jxw=='],
  ['cpp/browser-wasi-shim.tgz', '/iHkCVUG3VbcbmEHn5iIUpIrh7a7WPiwZ3sHy4HZKZzBdSadwdddYDZAII2zBvQYV0Lfi8naZngPCN7WPHI/hA=='],
]) {
  const actual = createHash('sha512').update(await readFile(resolve(cache, path))).digest('base64');
  if (actual !== integrity) throw Error(`Pinned package integrity mismatch: ${path}`);
}
for (const name of ['index.js', 'clang.js', 'lld.js']) await pack('cpp', resolve(cppPackage, 'dist', name), resolve(cpp, name));
for (const name of ['clang.wasm', 'lld.wasm', 'sysroot.tar']) await pack('cpp', resolve(cppPackage, 'dist', name), resolve(cpp, name + '.gz'), true);
for (const name of (await readdir(resolve(shimPackage, 'dist'))).filter(name => name.endsWith('.js'))) {
  await pack('cpp', resolve(shimPackage, 'dist', name), resolve(cpp, 'wasi', name));
}
await notice(resolve(cppPackage, 'LICENSE'), 'cpp/browsercc-MIT.txt');
await notice(resolve(shimPackage, 'LICENSE-MIT'), 'cpp/browser-wasi-shim-MIT.txt');
await notice(resolve(shimPackage, 'LICENSE-APACHE'), 'cpp/browser-wasi-shim-APACHE.txt');
await notice(resolve(notices, 'llvm-20.1.2-LICENSE.txt'), 'cpp/LLVM-20.1.2.txt');
await notice(resolve(notices, 'emscripten-LICENSE.txt'), 'cpp/Emscripten.txt');
await notice(resolve(notices, 'wasi-sdk/LICENSE'), 'cpp/WASI-SDK-25.txt');
for (const name of ['LICENSE', 'LICENSE-APACHE', 'LICENSE-APACHE-LLVM', 'LICENSE-MIT', 'libc-bottom-half_cloudlibc_LICENSE', 'libc-top-half_musl_COPYRIGHT', 'fts-COPYING']) {
  await notice(resolve(notices, 'wasi-libc-' + name), 'cpp/wasi-libc-' + name + '.txt');
}
const dlmalloc = await readFile(resolve(notices, 'wasi-libc-dlmalloc_src_malloc.c'), 'utf8');
await writeFile(resolve(licenseRoot, 'cpp/dlmalloc-CC0.txt'), dlmalloc.split('\n').slice(0, 10).join('\n') + '\n');
const emmalloc = await readFile(resolve(notices, 'wasi-libc-emmalloc.c'), 'utf8');
await writeFile(resolve(licenseRoot, 'cpp/emmalloc-MIT.txt'), emmalloc.slice(0, emmalloc.indexOf('*/') + 2) + '\n');

const generated = resolve(javaProject, 'compiler/build/generated/teavm/wasm-gc');
await pack('java', resolve(generated, 'compiler.wasm-runtime.js'), resolve(java, 'compiler.wasm-runtime.js'));
await pack('java', resolve(generated, 'compiler.wasm'), resolve(java, 'compiler.wasm.gz'), true);
for (const name of ['compile-classlib-teavm.bin', 'runtime-classlib-teavm.bin']) {
  await pack('java', resolve(javaProject, 'compiler/build/classlib', name), resolve(java, name + '.gz'), true);
}
for (const name of ['LICENSE', 'ADDITIONAL_LICENSE_INFO', 'ASSEMBLY_EXCEPTION']) await notice(resolve(jdk, name), 'java/OpenJDK-' + name + '.txt');
await notice(resolve(licenseRoot, 'cpp/browser-wasi-shim-APACHE.txt'), 'java/TeaVM-Apache-2.0.txt');
await notice(resolve(notices, 'Unicode-CLDR-37.json-LICENSE.txt'), 'java/Unicode-CLDR-37.txt');

// Supply the OpenJDK compiler sources and build scripts with the GPL+Classpath
// binary, instead of relying only on an external repository URL or written offer.
const python = String.raw`
import sys,pathlib,tarfile,gzip,subprocess,zipfile,re,json,hashlib,io,shutil
project,upstream,jdk,out,licenses,gradle=map(pathlib.Path,sys.argv[1:])
def archive(path, entries):
 with path.open('wb') as raw:
  with gzip.GzipFile(fileobj=raw,filename='',mode='wb',mtime=0,compresslevel=9) as gz:
   with tarfile.open(fileobj=gz,mode='w') as tar:
    for source,name in sorted(entries,key=lambda x:x[1]):
     if not source.is_file():continue
     info=tar.gettarinfo(str(source),name);info.mtime=0;info.uid=info.gid=0;info.uname=info.gname=''
     with source.open('rb') as data:tar.addfile(info,data)
out.mkdir(parents=True,exist_ok=True)
files=subprocess.check_output(['git','ls-files','-z'],cwd=upstream).decode().split('\0')
entries=[(upstream/f,'teavm-javac/'+f) for f in files if f]
for f in (upstream/'javac/build/generated/java').rglob('*.java'):entries.append((f,'teavm-javac/'+str(f.relative_to(upstream))))
archive(out/'teavm-javac-source.tar.gz',entries)
entries=[]
paths=['LICENSE','ADDITIONAL_LICENSE_INFO','ASSEMBLY_EXCEPTION','make/langtools/tools',
 'src/jdk.compiler','src/java.compiler','src/jdk.internal.opt','src/java.base/share/classes/jdk/internal/jmod']
for part in paths:
 base=jdk/part
 for f in ([base] if base.is_file() else base.rglob('*')):
  if f.is_file():entries.append((f,'openjdk-javac-sources/'+str(f.relative_to(jdk))))
archive(out/'openjdk-javac-corresponding-source.tar.gz',entries)
# Preserve dependency-specific notices embedded in the actual build artifacts.
inventory=[]
source_notices={}
for jar in sorted(gradle.glob('caches/modules-2/files-2.1/**/*.jar')):
 if jar.name.endswith('-sources.jar'):
  target=out/'dependencies'/jar.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(jar,target)
  with zipfile.ZipFile(jar) as z:
   for name in z.namelist():
    if not name.endswith(('.java','.c','.h')):continue
    text=z.read(name).decode(errors='replace')
    match=re.match(r'\s*(/\*.*?\*/)',text,re.S)
    if match:
     comment=match.group(1)
     if any(k in comment.lower() for k in ('copyright','license','permission')):
      source_notices.setdefault(comment,[]).append(jar.name+':'+name)
  continue
 with zipfile.ZipFile(jar) as z:
  texts=[n for n in z.namelist() if re.search(r'(^|/)(LICENSE[^/]*|NOTICE[^/]*|COPYRIGHT[^/]*)$',n,re.I)]
  coordinate='/'.join(jar.relative_to(gradle/'caches/modules-2/files-2.1').parts[:3])
  names=[]
  for name in texts:
   if name.endswith('/'):continue
   target=licenses/'java/maven-notices'/coordinate/name
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name));names.append(str(target.relative_to(licenses)))
  inventory.append({'artifact':coordinate,'sha256':hashlib.sha256(jar.read_bytes()).hexdigest(),'notices':names})
(licenses/'java/maven-artifacts.json').write_text(json.dumps(inventory,indent=2)+'\n')
(licenses/'java/maven-source-notices.txt').write_text('\n\n'.join('Source examples: '+', '.join(names[:3])+'\n'+text for text,names in sorted(source_notices.items())))
for f in (jdk/'src/jdk.internal.opt/share/legal').glob('*'):
 if f.is_file():
  dest=licenses/'java'/('OpenJDK-jopt-'+f.name);dest.write_bytes(f.read_bytes())
`;
execFileSync('python3', ['-c', python, project, javaProject, jdk, resolve(java, 'sources'), licenseRoot,
  resolve(cache, 'java-build/gradle-cache')], { cwd: project, stdio: 'inherit' });
async function sourceFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await sourceFiles(resolve(directory, entry.name), name + '/'));
    else files.push(name);
  }
  return files;
}
for (const name of await sourceFiles(resolve(java, 'sources'))) {
  const bytes = await readFile(resolve(java, 'sources', name));
  manifest.java.push({ path: 'sources/' + name, bytes: bytes.length, sha256: sha256(bytes), role: 'corresponding-source' });
}
await writeFile(resolve(cpp, 'manifest.json'), JSON.stringify({ version: 'browsercc-0.1.1',
  compiler: 'LLVM 20.1.2', sysroot: 'WASI SDK 25.0', npmRevision: '86168bacf0fe7c662e3e65a2e3006ceb159cd0dc',
  wasiLibcRevision: '574b88da481569b65a237cb80daf9a2d5aeaf82d', files: manifest.cpp }, null, 2) + '\n');
await writeFile(resolve(java, 'manifest.json'), JSON.stringify({ version: 'teavm-javac-208d4c97',
  sourceRevision: '208d4c97a602ba0df055f16e6882059fb69d0122', teavm: '0.16.0', jdkRevision,
  strictMode: false, limitations: ['Not a full JVM', 'Array-bound/exception semantics outside the tested quiz subset are unsupported'],
  files: manifest.java }, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest).map(([kind, files]) => [kind,
  { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }]))));
