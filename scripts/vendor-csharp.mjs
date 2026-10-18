// Reproduce the self-hosted C# pack. Downloads are pinned and SHA-256 checked.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir, rm, copyFile } from 'node:fs/promises';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = resolve(root, 'work/vendor-csharp');
const destination = resolve(root, 'runtime-assets/csharp');
const licenses = resolve(root, 'runtime-assets/licenses');
const research = resolve(root, 'work/runtime-research/csharp-java');
await mkdir(scratch, { recursive: true });
await mkdir(licenses, { recursive: true });

const sha256 = data => createHash('sha256').update(data).digest('hex');
async function acquire(name, url, hash, cachedName = name) {
  const target = resolve(scratch, name);
  for (const candidate of [target, resolve(research, cachedName)]) {
    try {
      const data = await readFile(candidate);
      if (sha256(data) === hash) {
        if (candidate !== target) await copyFile(candidate, target);
        return target;
      }
    } catch { /* Download below when no verified cache is available. */ }
  }
  execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--output', target, url], { stdio: 'inherit' });
  if (sha256(await readFile(target)) !== hash) throw new Error(`Checksum mismatch: ${name}`);
  return target;
}

const wasmSharp = await acquire('wasmsharp-core-0.10.2.tgz',
  'https://registry.npmjs.org/@wasmsharp/core/-/core-0.10.2.tgz',
  '2f1491d5409a5d6f1e5c338187a4d279d359682f61285f2631a72544a95b8a15');
const comlink = await acquire('comlink-4.4.2.tgz',
  'https://registry.npmjs.org/comlink/-/comlink-4.4.2.tgz',
  '9a0285450949cea22739f0a6d67e004fd4cac8de9ed69daa2e104a5fe4a8bc94');
const dotnet = await acquire('runtime-preview6.nupkg',
  'https://api.nuget.org/v3-flatcontainer/microsoft.netcore.app.runtime.mono.browser-wasm/10.0.0-preview.6.25358.103/microsoft.netcore.app.runtime.mono.browser-wasm.10.0.0-preview.6.25358.103.nupkg',
  'e91ef6db1387c9c0a364b8c9d31214bbccefba8cc670280f185d5f3f4b03bdeb');
const roslyn = await acquire('roslyn-common-4.14.0.nupkg',
  'https://api.nuget.org/v3-flatcontainer/microsoft.codeanalysis.common/4.14.0/microsoft.codeanalysis.common.4.14.0.nupkg',
  '9deff3c47dc6aa8181e0e7a69c4f28244946e666a2fbfebb01268aab098bd811');
const roslynLicense = await acquire('roslyn-license.txt',
  'https://raw.githubusercontent.com/dotnet/roslyn/8edf7bcd4f1594c3d68a6a567469f41dbd33dd1b/License.txt',
  'ae48df11a335dc1a615f4f938b69cba73bcf4485c4f97af49b38efb0f216353b', 'roslyn-pinned-license.txt');
const humanizerLicense = await acquire('humanizer-license.txt',
  'https://raw.githubusercontent.com/Humanizr/Humanizer/v2.14.1/LICENSE',
  'e24ec7f2eea5c5f4b3e2c08308109ba99b49b4b56ea7ff0e0a178f2bdd4bbce8', 'humanizer-license');

for (const [folder, archive] of [['wasmsharp', wasmSharp], ['comlink', comlink]]) {
  const target = resolve(scratch, folder);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', target]);
}
const source = resolve(scratch, 'wasmsharp/package');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

async function* files(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

const manifest = [];
for await (const file of files(source)) {
  const extension = extname(file);
  if (!['.js', '.mjs', '.dll', '.wasm', '.dat'].includes(extension)) continue;
  const name = relative(source, file).replaceAll('\\', '/');
  let data = await readFile(file);
  const binary = ['.dll', '.wasm', '.dat'].includes(extension);
  if (!binary) {
    let script = data.toString()
      .replace(/^\/\/# sourceMappingURL=.*$/gm, '')
      .replace(/^import (\w+) from "([^"\r\n]+\.(?:dll|wasm|dat))";/gm,
        (_, identifier, url) => `const ${identifier} = new URL(${JSON.stringify(url)}, import.meta.url).href;`)
      .replaceAll('https://unpkg.com/comlink/dist/esm/comlink.mjs', './comlink.mjs')
      .replace(/\bfrom\s+(["'])(\.[^"'\r\n]+)\1/g, (match, quote, url) =>
        /\.[a-z0-9]+$/i.test(url) ? match : `from ${quote}${url}.js${quote}`);
    data = Buffer.from(script);
  }
  const output = name + (binary ? '.gz' : '');
  const packed = binary ? gzipSync(data, { level: 9 }) : data;
  await mkdir(dirname(resolve(destination, output)), { recursive: true });
  await writeFile(resolve(destination, output), packed);
  manifest.push({ path: output, bytes: packed.length, unpackedBytes: data.length, sha256: sha256(packed) });
}
await copyFile(resolve(scratch, 'comlink/package/dist/esm/comlink.mjs'), resolve(destination, 'comlink.mjs'));
await copyFile(resolve(source, 'LICENSE'), resolve(licenses, 'csharp-wasmsharp-APACHE-2.0.txt'));
await copyFile(resolve(scratch, 'comlink/package/LICENSE'), resolve(licenses, 'csharp-comlink-APACHE-2.0.txt'));
await copyFile(roslynLicense, resolve(licenses, 'csharp-roslyn-MIT.txt'));
await copyFile(humanizerLicense, resolve(licenses, 'csharp-humanizer-MIT.txt'));
// Zip parsing uses Python's standard library; no package installation is needed.
execFileSync('python3', ['-c',
  'import sys,zipfile,pathlib\nfor archive,member,dest in zip(sys.argv[1::3],sys.argv[2::3],sys.argv[3::3]): pathlib.Path(dest).write_bytes(zipfile.ZipFile(archive).read(member))',
  dotnet, 'LICENSE.TXT', resolve(licenses, 'csharp-dotnet-MIT.txt'),
  dotnet, 'THIRD-PARTY-NOTICES.TXT', resolve(licenses, 'csharp-dotnet-THIRD-PARTY-NOTICES.txt'),
  roslyn, 'ThirdPartyNotices.rtf', resolve(licenses, 'csharp-roslyn-THIRD-PARTY-NOTICES.rtf'),
]);
const comlinkBytes = await readFile(resolve(destination, 'comlink.mjs'));
manifest.push({ path: 'comlink.mjs', bytes: comlinkBytes.length, unpackedBytes: comlinkBytes.length, sha256: sha256(comlinkBytes) });
await writeFile(resolve(destination, 'manifest.json'), JSON.stringify({
  name: '@wasmsharp/core', version: '0.10.2', roslyn: '4.14.0', languageVersion: 'C# 13',
  dotnet: '10.0.0-preview.6.25358.103', compression: 'gzip; decompressed in the grading worker',
  source: 'https://github.com/JakeYallop/WasmSharp',
  changes: ['Binary imports use local asset URLs.', 'Extensionless imports gain .js.', 'Comlink is self-hosted.', 'Inline source maps removed.', 'Binary assets gzip compressed without changing their contents.'],
  limitations: ['The upstream trimmed runtime omits some standard-library overloads, including Enumerable.Sum(IEnumerable<int>).'],
  files: manifest,
}, null, 2) + '\n');
console.log(`C# runtime: ${manifest.length} files, ${manifest.reduce((total, file) => total + file.bytes, 0)} bytes.`);
