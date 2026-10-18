// Reproduce the pinned, self-hosted browser runtimes without changing game dependencies.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = resolve(root, 'runtime-assets');
const research = resolve(root, 'work/runtime-research/python-lua-sql');
const verifyOnly = process.argv.includes('--verify');
const refresh = process.argv.includes('--refresh');

const packages = [
  {
    "id": "python",
    "package": "pyodide",
    "version": "314.0.7",
    "tarball": "https://registry.npmjs.org/pyodide/-/pyodide-314.0.7.tgz",
    "integrity": "sha512-0YvXxEhfEdpLfb/XkM2BFAeMROq0iMUX2bzzH9pOttyMcWkwq+HbE5uyuGD82LN7y2q+SNvi/6V5JEsOlD2R1A==",
    "revision": "b1e4fcc2488962f6360a97f19b9982d6fdb5d16f",
    "repository": "https://github.com/pyodide/pyodide",
    "files": [
      {
        "source": "pyodide.mjs",
        "target": "pyodide.mjs",
        "sha256": "6f1d60f7bf529beb300f0f47983c921d3982363640ba20af0e38efdddbc66109"
      },
      {
        "source": "pyodide.asm.mjs",
        "target": "pyodide.asm.mjs",
        "sha256": "f7cdc8ece80678ceb712f8e65ebe6d3a83203a180c399865f49612a051693635"
      },
      {
        "source": "pyodide.asm.wasm",
        "target": "pyodide.asm.wasm",
        "sha256": "cc36e3cab04fdfc9a63ff13eb52eae2b911bf46c025cc7b281f394bd3de1d5e6"
      },
      {
        "source": "python_stdlib.zip",
        "target": "python_stdlib.zip",
        "sha256": "fa1957e5777068fc4f7437f96d860ae2fbe9c19732ba06c84e004ec16dd7dd7a"
      },
      {
        "source": "pyodide-lock.json",
        "target": "pyodide-lock.json",
        "sha256": "5dc2fc119108bc148c7457dc86e7675b5c87e1cafd420b9c34c1eaef7b36c010"
      }
    ],
    "language": "CPython3.14.2",
    "licenses": [
      "python-Pyodide-MPL-2.0.txt",
      "python-CPython-LICENSE.txt",
      "python-Emscripten-LICENSE.txt"
    ],
    "sourceUrls": [
      "https://github.com/pyodide/pyodide/tree/b1e4fcc2488962f6360a97f19b9982d6fdb5d16f",
      "https://github.com/python/cpython/tree/v3.14.2",
      "https://github.com/emscripten-core/emscripten/tree/5.0.3"
    ]
  },
  {
    "id": "lua",
    "package": "wasmoon",
    "version": "1.16.0",
    "tarball": "https://registry.npmjs.org/wasmoon/-/wasmoon-1.16.0.tgz",
    "integrity": "sha512-FlRLb15WwAOz1A9OQDbf6oOKKSiefi5VK0ZRF2wgH9xk3o5SnU11tNPaOnQuAh1Ucr66cwwvVXaeVRaFdRBt5g==",
    "revision": "87c783a8d0bf65afeda933fa47d8dc996be53bb3",
    "repository": "https://github.com/ceifa/wasmoon",
    "files": [
      {
        "source": "dist/index.js",
        "target": "index.js",
        "sha256": "dc2dcf019449008bb224370052473dc760db28b3ba14fc604e1ca3e8646af35d"
      },
      {
        "source": "dist/glue.wasm",
        "target": "glue.wasm",
        "sha256": "95f3f19ddb740125883bc41d5ec670cd0828e7b58c8bdad385323cbff497b55c"
      }
    ],
    "language": "Lua5.4.5",
    "licenses": [
      "lua-Wasmoon-MIT.txt",
      "lua-Lua-MIT.txt",
      "lua-Emscripten-LICENSE.txt"
    ],
    "sourceUrls": [
      "https://github.com/ceifa/wasmoon/tree/87c783a8d0bf65afeda933fa47d8dc996be53bb3",
      "https://github.com/lua/lua/tree/be908a7d4d8130264ad67c5789169769f824c5d1"
    ]
  },
  {
    "id": "sql",
    "package": "@sqlite.org/sqlite-wasm",
    "version": "3.53.4-build2",
    "tarball": "https://registry.npmjs.org/@sqlite.org/sqlite-wasm/-/sqlite-wasm-3.53.4-build2.tgz",
    "integrity": "sha512-kQVArGJA4z7s56Dm8t+eTBXad4LiohuVj9pfgDNOcxa+Ic5xMrWlLPTq6cT0hw5S4MIvtpsraW+B0wD+IPvC7A==",
    "revision": "b30a8a19cab9a7928ac6b44bbc91f0b65e56324d",
    "repository": "https://github.com/sqlite/sqlite-wasm",
    "files": [
      {
        "source": "dist/index.mjs",
        "target": "index.mjs",
        "sha256": "a6d3fe46aa3f924e7686329f97b0564549ef1f787e0c19924179aef7f72bcc01"
      },
      {
        "source": "dist/sqlite3.wasm",
        "target": "sqlite3.wasm",
        "sha256": "2ee8f3dab694532afc8840e07703127287662d08b74e6ff50491ce63f00d5752"
      }
    ],
    "language": "SQLite3.53.4",
    "licenses": [
      "sql-Apache-2.0.txt",
      "sql-SQLite-NOTICE.txt",
      "sql-Emscripten-LICENSE.txt"
    ],
    "sourceUrls": [
      "https://github.com/sqlite/sqlite-wasm/tree/b30a8a19cab9a7928ac6b44bbc91f0b65e56324d",
      "https://sqlite.org/src/info/bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc",
      "https://github.com/emscripten-core/emscripten/tree/5.0.5"
    ]
  }
];

const upstreamLicenses = [
  {
    "name": "python-Pyodide-MPL-2.0.txt",
    "url": "https://raw.githubusercontent.com/pyodide/pyodide/314.0.7/LICENSE",
    "cache": "pyodide-license.txt",
    "sha256": "1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5"
  },
  {
    "name": "python-CPython-LICENSE.txt",
    "url": "https://raw.githubusercontent.com/python/cpython/v3.14.2/LICENSE",
    "cache": "cpython-pinned-license.txt",
    "sha256": "b0e25a78cffb43f4d92de8b61ccfa1f1f98ecbc22330b54b5251e7b6ba010231"
  },
  {
    "name": "python-Emscripten-LICENSE.txt",
    "url": "https://raw.githubusercontent.com/emscripten-core/emscripten/5.0.3/LICENSE",
    "cache": "emscripten-5.0.3-license.txt",
    "sha256": "620a78084fc7ca97c0b5dea9abf891f3ffcadfdbf305276f099c9c4e12fc1d86"
  },
  {
    "name": "lua-Lua-MIT.txt",
    "url": "https://raw.githubusercontent.com/lua/lua/be908a7d4d8130264ad67c5789169769f824c5d1/lua.h",
    "cache": "lua-pinned-header.h",
    "extractLua": true,
    "sha256": "57e66d5b7ce72146ddd303e79a8498e98e30238247a417e6ec4f743f477a3cbb"
  },
  {
    "name": "lua-Emscripten-LICENSE.txt",
    "url": "https://raw.githubusercontent.com/emscripten-core/emscripten/5.0.3/LICENSE",
    "cache": "emscripten-5.0.3-license.txt",
    "sha256": "620a78084fc7ca97c0b5dea9abf891f3ffcadfdbf305276f099c9c4e12fc1d86"
  },
  {
    "name": "sql-Emscripten-LICENSE.txt",
    "url": "https://raw.githubusercontent.com/emscripten-core/emscripten/5.0.5/LICENSE",
    "cache": "emscripten-5.0.5-license.txt",
    "sha256": "620a78084fc7ca97c0b5dea9abf891f3ffcadfdbf305276f099c9c4e12fc1d86"
  },
  {
    "name": "sql-Apache-2.0.txt",
    "url": "https://raw.githubusercontent.com/apache/commons-lang/rel/commons-lang-3.18.0/LICENSE.txt",
    "cache": "apache-2.0.txt",
    "sha256": "b1d2870f1a00e4d7f56576e5f0870cba109e041f8af66866cf5b499478e654e7"
  }
];

const writeAsset = async (path, bytes) => {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, bytes);
  await rename(temporary, path);
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async path => { try { await readFile(path); return true; } catch { return false; } };
const checkedRead = async (path, digest) => {
  const bytes = await readFile(path);
  if (sha256(bytes) !== digest) throw new Error(`Checksum mismatch: ${path}`);
  return bytes;
};
const download = (url, path) => {
  const result = spawnSync('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--max-time', '120', '--output', path, url], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`Cannot download ${url}: ${result.error || result.stderr}`);
};

await mkdir(resolve(root, 'work'), { recursive: true });
const scratch = verifyOnly ? undefined : await mkdtemp(resolve(root, 'work/vendor-browser-runtimes-'));
try {
  if (!verifyOnly) await mkdir(resolve(assets, 'licenses'), { recursive: true });
  for (const definition of packages) {
    const target = resolve(assets, definition.id);
    if (!verifyOnly) {
      await mkdir(target, { recursive: true });
      let packageRoot = resolve(research, 'node_modules', definition.package);
      const cacheExists = !refresh && await exists(join(packageRoot, 'package.json'));
      if (!cacheExists) {
        const archive = join(scratch, `${definition.id}.tgz`);
        download(definition.tarball, archive);
        const content = await readFile(archive);
        const integrity = 'sha512-' + createHash('sha512').update(content).digest('base64');
        if (integrity !== definition.integrity) throw new Error(`Archive integrity mismatch: ${definition.package}`);
        const extracted = join(scratch, definition.id);
        await mkdir(extracted, { recursive: true });
        const unpack = spawnSync('tar', ['-xzf', archive, '--directory', extracted, '--no-same-owner', '--no-same-permissions'], { encoding: 'utf8' });
        if (unpack.error || unpack.status !== 0) throw new Error(`Cannot unpack ${definition.package}: ${unpack.error || unpack.stderr}`);
        packageRoot = join(extracted, 'package');
      }
      const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
      if (metadata.version !== definition.version) throw new Error(`Wrong package version: ${definition.package}`);
      for (const file of definition.files) {
        const bytes = await checkedRead(join(packageRoot, file.source), file.sha256);
        await writeAsset(join(target, file.target), bytes);
      }
      if (definition.id === 'lua') await writeAsset(resolve(assets, 'licenses/lua-Wasmoon-MIT.txt'), await readFile(join(packageRoot, 'LICENSE')));
      if (definition.id === 'sql') {
        const bundle = await readFile(join(target, 'index.mjs'), 'utf8');
        const start = bundle.indexOf('/* @preserve');
        const end = bundle.indexOf('*/', start) + 2;
        await writeAsset(resolve(assets, 'licenses/sql-SQLite-NOTICE.txt'), bundle.slice(start, end) + '\n');
      }
      await writeAsset(join(target, 'source.json'), JSON.stringify({
        package: definition.package, version: definition.version, language: definition.language,
        repository: definition.repository, revision: definition.revision,
        tarball: definition.tarball, integrity: definition.integrity,
        sources: definition.sourceUrls, licenses: definition.licenses,
        files: definition.files.map(({ target: path, sha256 }) => ({ path, sha256 })),
        modifications: 'None. Upstream runtime files are copied byte for byte. Game adapters are separate files.',
        sourceAvailability: 'Corresponding source and build instructions are available at the exact upstream revisions linked above. Pyodide covered files retain MPL-2.0; they are not relicensed under the game license.'
      }, null, 2) + '\n');
    }
    for (const file of definition.files) await checkedRead(join(target, file.target), file.sha256);
    const provenance = JSON.parse(await readFile(join(target, 'source.json'), 'utf8'));
    if (provenance.version !== definition.version || provenance.revision !== definition.revision) throw new Error(`Provenance mismatch: ${definition.id}`);
    console.log(`${verifyOnly ? 'Verified' : 'Vendored'} ${definition.package}@${definition.version}`);
  }
  if (!verifyOnly) for (const license of upstreamLicenses) {
    let path = resolve(research, 'sources', license.cache);
    if (refresh || !await exists(path)) {
      path = join(scratch, license.name);
      download(license.url, path);
    }
    const bytes = await checkedRead(path, license.sha256);
    let text = bytes.toString('utf8');
    if (license.extractLua) {
      const start = text.indexOf('Copyright (C)', text.indexOf('LUA_API'));
      const end = text.indexOf('******************************************************************************/', start);
      if (start < 0 || end < 0) throw new Error('Cannot locate the Lua license notice.');
      text = text.slice(start, end).replace(/^\* ?/gm, '').trim() + '\n';
    }
    await writeAsset(resolve(assets, 'licenses', license.name), text);
  }
  // Check all package-specific license texts, including the standard Apache-2.0 text.
  for (const definition of packages) for (const name of definition.licenses) {
    if (!await exists(resolve(assets, 'licenses', name))) throw new Error(`Missing dependency license: ${name}`);
  }
} finally {
  if (scratch) await rm(scratch, { recursive: true, force: true });
}
