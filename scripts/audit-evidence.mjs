// Optional, pinned historical evidence. Normal tests never import or fetch it.
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {constants, existsSync} from 'node:fs';
import {cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const AUDIT_LIMITS = Object.freeze({compressedBytes:128 * 1024 ** 2, tarBytes:512 * 1024 ** 2,
  fileManifestBytes:8 * 1024 ** 2, files:20000});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const utf8 = new TextDecoder('utf-8', {fatal:true});
const json = bytes => JSON.parse(utf8.decode(bytes));
const integer = (value, limit, label) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= limit, `${label}: invalid or excessive size/count`);
const hash = (value, label) => assert.match(value ?? '', /^[a-f0-9]{64}$/, `${label}: SHA-256 required`);

function httpsURL(value, label) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', `${label}: HTTPS required`);
  assert.ok(!url.username && !url.password, `${label}: credentials are not allowed`);
  return url.href;
}

export function validateAuditManifest(manifest) {
  assert.equal(manifest?.schemaVersion, 1, 'Unsupported audit manifest schema');
  assert.equal(typeof manifest.id, 'string', 'Audit id required');
  assert.ok(manifest.id.length > 0 && manifest.id.length <= 200, 'Invalid audit id');
  assert.match(manifest.sourceCommit ?? '', /^[a-f0-9]{40}$/, 'Full original source commit required');
  const archive = manifest.archive, sidecar = manifest.fileManifest;
  assert.equal(archive?.format, 'tar.gz', 'Only USTAR gzip archives are supported');
  hash(archive.sha256, 'Archive'); hash(sidecar?.sha256, 'File manifest');
  httpsURL(archive.url, 'Archive'); httpsURL(sidecar.url, 'File manifest');
  integer(archive.sizeBytes, AUDIT_LIMITS.compressedBytes, 'Compressed archive');
  integer(archive.uncompressedSizeBytes, AUDIT_LIMITS.tarBytes, 'Uncompressed TAR');
  integer(archive.fileCount, AUDIT_LIMITS.files, 'Archive file count');
  assert.ok(archive.sizeBytes > 0 && archive.uncompressedSizeBytes >= 1024 && archive.fileCount > 0, 'Empty audit archive');
  integer(sidecar.sizeBytes, AUDIT_LIMITS.fileManifestBytes, 'File manifest');
  if (archive.payloadSizeBytes !== undefined) integer(archive.payloadSizeBytes, AUDIT_LIMITS.tarBytes, 'Archive payload');
  return manifest;
}

function evidencePath(path, directory = false) {
  assert.equal(typeof path, 'string', 'Archive path must be a string');
  if (directory && path.endsWith('/')) path = path.slice(0, -1);
  assert.ok(path && !/[\\\x00-\x1f\x7f]/.test(path), 'Unsafe archive path');
  assert.ok(path === 'research' && directory || path.startsWith('research/'), 'Archive path must stay in research/');
  assert.ok(path.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe archive path component');
  return path;
}

export function validateFileManifest(bytes, manifest) {
  assert.equal(bytes.length, manifest.fileManifest.sizeBytes, 'File manifest size differs');
  assert.equal(sha(bytes), manifest.fileManifest.sha256, 'File manifest SHA-256 differs');
  const sidecar = json(bytes);
  assert.equal(sidecar.schemaVersion, 1, 'Unsupported file manifest schema');
  assert.equal(sidecar.sourceCommit, manifest.sourceCommit, 'File manifest source commit differs');
  assert.ok(Array.isArray(sidecar.files), 'File records required');
  assert.equal(sidecar.files.length, manifest.archive.fileCount, 'File manifest count differs');
  let previous = '', total = 0;
  for (const row of sidecar.files) {
    evidencePath(row.path);
    assert.ok(row.path > previous, 'File manifest paths must be sorted and unique');
    previous = row.path;
    integer(row.sizeBytes, AUDIT_LIMITS.tarBytes, row.path); hash(row.sha256, row.path);
    total += row.sizeBytes;
    integer(total, AUDIT_LIMITS.tarBytes, 'Total payload');
  }
  if (manifest.archive.payloadSizeBytes !== undefined) assert.equal(total, manifest.archive.payloadSizeBytes, 'Payload size differs');
  return sidecar;
}

function tarString(bytes) {
  const nul = bytes.indexOf(0);
  if (nul !== -1) assert.ok(bytes.subarray(nul).every(byte => byte === 0), 'Malformed TAR string');
  return utf8.decode(nul === -1 ? bytes : bytes.subarray(0, nul));
}

function tarOctal(bytes, label) {
  const value = bytes.toString('ascii').replace(/\0.*$/, '').trim();
  assert.match(value, /^[0-7]+$/, `Invalid TAR ${label}`);
  const number = Number.parseInt(value, 8);
  integer(number, AUDIT_LIMITS.tarBytes, `TAR ${label}`);
  return number;
}

/** Parse a bounded USTAR archive before any evidence is written to disk. */
export function verifyAuditArchive(compressed, fileManifestBytes, inputManifest) {
  const manifest = validateAuditManifest(inputManifest);
  assert.equal(compressed.length, manifest.archive.sizeBytes, 'Compressed archive size differs');
  assert.equal(sha(compressed), manifest.archive.sha256, 'Archive SHA-256 differs');
  const sidecar = validateFileManifest(fileManifestBytes, manifest);
  const tar = gunzipSync(compressed, {maxOutputLength:manifest.archive.uncompressedSizeBytes});
  assert.equal(tar.length, manifest.archive.uncompressedSizeBytes, 'Uncompressed TAR size differs');
  assert.equal(tar.length % 512, 0, 'TAR length must be a multiple of 512');
  const expected = new Map(sidecar.files.map(row => [row.path, row]));
  const entries = [], seen = new Set();
  let offset = 0, ended = false;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      assert.ok(offset + 1024 <= tar.length && tar.subarray(offset).every(byte => byte === 0), 'Invalid TAR end marker or trailing data');
      ended = true; break;
    }
    const checksum = tarOctal(header.subarray(148, 156), 'checksum');
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    assert.equal(sum, checksum, 'TAR header checksum differs');
    assert.equal(header.subarray(257, 263).toString('ascii'), 'ustar\0', 'USTAR archive required');
    assert.equal(header.subarray(263, 265).toString('ascii'), '00', 'Unsupported USTAR version');
    const type = header[156];
    assert.ok(type === 0 || type === 48 || type === 53, 'TAR links, extensions and special files are forbidden');
    assert.equal(tarString(header.subarray(157, 257)), '', 'TAR links are forbidden');
    const prefix = tarString(header.subarray(345, 500));
    const name = tarString(header.subarray(0, 100));
    const path = evidencePath(prefix ? `${prefix}/${name}` : name, type === 53);
    assert.ok(!seen.has(path), 'Duplicate TAR path'); seen.add(path);
    assert.ok(seen.size <= AUDIT_LIMITS.files * 2, 'Too many TAR entries');
    const size = tarOctal(header.subarray(124, 136), 'entry size');
    offset += 512;
    assert.ok(offset + size <= tar.length, 'Truncated TAR entry');
    if (type === 53) {
      assert.equal(size, 0, 'TAR directory has data');
      assert.ok(sidecar.files.some(row => row.path.startsWith(path + '/')), 'Unlisted TAR directory');
    } else {
      const row = expected.get(path);
      assert.ok(row, `Unlisted TAR file: ${path}`);
      const bytes = tar.subarray(offset, offset + size);
      assert.equal(size, row.sizeBytes, `File size differs: ${path}`);
      assert.equal(sha(bytes), row.sha256, `File SHA-256 differs: ${path}`);
      entries.push({path, bytes});
    }
    const padded = Math.ceil(size / 512) * 512;
    assert.ok(offset + padded <= tar.length, 'Truncated TAR padding');
    assert.ok(tar.subarray(offset + size, offset + padded).every(byte => byte === 0), 'Nonzero TAR padding');
    offset += padded;
  }
  assert.ok(ended, 'Missing TAR end marker');
  assert.equal(entries.length, expected.size, 'Missing TAR files');
  // A regular file cannot also be a parent directory, even in an unusual TAR order.
  for (const {path} of entries) {
    const parts = path.split('/');
    while (parts.length > 1) { parts.pop(); assert.ok(!expected.has(parts.join('/')), 'TAR file is also a parent directory'); }
  }
  return {manifest, sidecar, entries};
}

async function readPinnedFile(path, record, limit, label) {
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = await file.stat();
    assert.ok(stat.isFile(), `${label}: regular file required`);
    assert.equal(stat.size, record.sizeBytes, `${label} size differs`);
    integer(stat.size, limit, label);
    const bytes = await file.readFile();
    assert.equal(bytes.length, record.sizeBytes, `${label} size differs`);
    assert.equal(sha(bytes), record.sha256, `${label} SHA-256 differs`);
    return bytes;
  } finally { await file.close(); }
}

function proxyURL(environment) {
  return environment.HTTPS_PROXY || environment.https_proxy || environment.HTTP_PROXY || environment.http_proxy || environment.ALL_PROXY || environment.all_proxy;
}

function proxyDownload(record, {environment, spawnImpl = spawn}) {
  return new Promise((done, fail) => {
    const args = ['--disable', '--fail', '--silent', '--show-error', '--location', '--max-redirs', '5',
      '--proto', '=https', '--proto-redir', '=https', '--connect-timeout', '15', '--max-time', '60',
      '--max-filesize', String(record.sizeBytes), '--url', record.url];
    const child = spawnImpl('curl', args, {shell:false, stdio:['ignore', 'pipe', 'pipe'],
      env:{...environment, HTTPS_PROXY:proxyURL(environment)}, timeout:60000, killSignal:'SIGKILL'});
    const chunks = []; let size = 0, stderr = '', failure;
    child.stdout.on('data', chunk => {
      if (failure) return;
      size += chunk.length;
      if (size > record.sizeBytes) { failure = new Error('Audit download exceeds pinned size'); child.kill('SIGKILL'); }
      else chunks.push(chunk);
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString('utf8')).slice(0, 8192); });
    child.once('error', fail);
    child.once('close', (code, signal) => {
      if (failure) fail(failure);
      else if (code !== 0) fail(new Error(`Audit proxy download failed (${signal ?? code}): ${stderr.trim()}`));
      else done(Buffer.concat(chunks, size));
    });
  });
}

async function directDownload(record, fetchImpl) {
  const signal = AbortSignal.timeout(60000);
  let url = record.url, response;
  try {
    for (let redirects = 0; ; redirects++) {
      response = await fetchImpl(url, {signal, redirect:'manual'});
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      assert.ok(redirects < 5, 'Too many audit download redirects');
      const location = response.headers.get('location'); assert.ok(location, 'Download redirect has no location');
      const nextURL = httpsURL(new URL(location, url).href, 'Download redirect');
      await response.body?.cancel(); url = nextURL;
    }
    assert.ok(response.ok, `Audit download failed: HTTP ${response.status}`);
    if (response.url) httpsURL(response.url, 'Download redirect');
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) assert.equal(Number(declaredLength), record.sizeBytes, 'Download Content-Length differs');
    assert.ok(response.body, 'Empty audit download body');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      assert.ok(size <= record.sizeBytes, 'Audit download exceeds pinned size');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, size);
  } catch (error) {
    await response?.body?.cancel().catch(() => {});
    throw error;
  }
}

async function pinnedAsset(record, {localPath, cacheDirectory, suffix, limit, fetchImpl, downloadEnvironment = process.env, spawnImpl}) {
  if (localPath) return readPinnedFile(resolve(localPath), record, limit, suffix);
  const path = join(cacheDirectory, record.sha256 + suffix);
  if (existsSync(path)) return readPinnedFile(path, record, limit, suffix);
  await mkdir(cacheDirectory, {recursive:true});
  const bytes = !fetchImpl && proxyURL(downloadEnvironment)
    ? await proxyDownload(record, {environment:downloadEnvironment, spawnImpl})
    : await directDownload(record, fetchImpl ?? fetch);
  assert.equal(bytes.length, record.sizeBytes, 'Audit download size differs');
  integer(bytes.length, limit, 'Audit download');
  assert.equal(sha(bytes), record.sha256, 'Audit download SHA-256 differs');
  const temporary = path + '.' + randomUUID() + '.tmp';
  try { await writeFile(temporary, bytes, {flag:'wx', mode:0o600}); await rename(temporary, path); }
  finally { await rm(temporary, {force:true}); }
  return bytes;
}

export async function loadAuditEvidence({manifestPath = join(ROOT, 'research/audit-evidence.json'), archivePath,
  filesManifestPath, cacheDirectory = join(ROOT, 'work/audit-cache'), fetchImpl, downloadEnvironment, spawnImpl} = {}) {
  const manifest = validateAuditManifest(json(await readFile(manifestPath)));
  const [compressed, sidecar] = await Promise.all([
    pinnedAsset(manifest.archive, {localPath:archivePath, cacheDirectory, suffix:'.tar.gz', limit:AUDIT_LIMITS.compressedBytes, fetchImpl, downloadEnvironment, spawnImpl}),
    pinnedAsset(manifest.fileManifest, {localPath:filesManifestPath, cacheDirectory, suffix:'.files.json', limit:AUDIT_LIMITS.fileManifestBytes, fetchImpl, downloadEnvironment, spawnImpl})
  ]);
  return verifyAuditArchive(compressed, sidecar, manifest);
}

/** The destination must be a newly created empty directory, never the checkout. */
export async function extractAuditEvidence(verified, destination) {
  assert.equal((await lstat(destination)).isDirectory(), true, 'Extraction directory required');
  assert.deepEqual(await readdir(destination), [], 'Extraction destination must be empty');
  for (const {path, bytes} of verified.entries) {
    const target = resolve(destination, path);
    assert.ok(target.startsWith(resolve(destination) + sep), 'Extraction path escapes destination');
    await mkdir(dirname(target), {recursive:true});
    await writeFile(target, bytes, {flag:'wx', mode:0o644});
  }
}

function runNode(workspace, args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, {cwd:workspace, stdio:'inherit', env:process.env});
    child.on('error', fail);
    child.on('exit', (code, signal) => code === 0 ? done() : fail(new Error(`Audit command failed (${signal ?? code}): node ${args.join(' ')}`)));
  });
}

async function compareFile(workspace, repository, path) {
  assert.deepEqual(await readFile(join(workspace, path)), await readFile(join(repository, path)), `Recomputed file differs from checkout: ${path}`);
}

export async function verifyReplayReports(workspace, ids = []) {
  const published = json(await readFile(join(workspace, 'research/raw-explanation-submissions.json')));
  const configuration = json(await readFile(join(workspace, 'research/raw-explanation-cohorts.json')));
  const expected = new Map(published.submissions.filter(row => !ids.length || ids.includes(row.id)).map(row => [row.id, row]));
  let checked = 0;
  for (const cohort of configuration.cohorts) {
    const protocol = json(await readFile(join(workspace, cohort.protocol)));
    const path = join(workspace, 'work/raw-explanation-replay', protocol.experimentId + '.json');
    if (!existsSync(path)) continue;
    const replay = json(await readFile(path));
    for (const actual of replay.submissions) {
      const prior = expected.get(actual.id); assert.ok(prior, 'Unexpected replayed trial');
      assert.equal(actual.accepted, prior.accepted, `Replayed acceptance differs: ${actual.id}`);
      assert.equal(actual.category, prior.category, `Replayed result category differs: ${actual.id}`);
      const cases = rows => rows.map(row => [row.id, row.expected, row.actual, row.passed, row.resultAvailable]);
      assert.deepEqual(cases(actual.cases), cases(prior.cases), `Replayed case verdict differs: ${actual.id}`);
      expected.delete(actual.id); checked++;
    }
  }
  assert.equal(expected.size, 0, 'Replay did not cover all selected published trials');
  return checked;
}

export async function verifyAuditWorkspace(verified, {repository = ROOT, docsPath = join(repository, 'docs'), replay = false, ids = []} = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'code-typer-audit-'));
  try {
    await extractAuditEvidence(verified, workspace);
    for (const path of ['src', 'scripts', 'tests', 'package.json']) await cp(join(repository, path), join(workspace, path), {recursive:true});
    if (existsSync(join(repository, 'node_modules'))) await symlink(resolve(repository, 'node_modules'), join(workspace, 'node_modules'), 'dir');
    if (existsSync(docsPath)) await symlink(resolve(docsPath), join(workspace, 'docs'), 'dir');
    await runNode(workspace, ['scripts/prepare-raw-explanation-benchmark.mjs', '--verify']);
    await runNode(workspace, ['scripts/verify-raw-explanation-cohorts.mjs']);
    await runNode(workspace, ['scripts/check-raw-application-contracts.mjs']);
    await runNode(workspace, ['scripts/freeze-explanation-rewards.mjs']);
    await compareFile(workspace, repository, 'research/challenge-calibration.json');
    await compareFile(workspace, repository, 'src/challengerewards.js');
    await runNode(workspace, ['scripts/challenge-calibration.mjs', '--check']);
    const tests = (await readdir(join(workspace, 'tests/audit'))).filter(name => name.endsWith('.test.js')).sort();
    assert.ok(tests.length, 'No historical audit tests found');
    await runNode(workspace, ['--test', ...tests.map(name => 'tests/audit/' + name)]);
    let replayedTrials = 0;
    if (replay) {
      await runNode(workspace, ['scripts/replay-raw-explanation-submissions.mjs', ...ids.flatMap(id => ['--id', id])]);
      replayedTrials = await verifyReplayReports(workspace, ids);
    }
    return {verified:true, fileCount:verified.entries.length, deterministicChecks:true, replayedTrials};
  } finally { await rm(workspace, {recursive:true, force:true}); }
}

function options(args) {
  const result = {ids:[]};
  const values = new Map([['--manifest','manifestPath'], ['--archive','archivePath'], ['--files-manifest','filesManifestPath'], ['--cache-dir','cacheDirectory'], ['--docs','docsPath']]);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--id') { assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), 'Missing --id value'); result.ids.push(args[++i]); continue; }
    assert.ok(!seen.has(arg), `Duplicate option: ${arg}`); seen.add(arg);
    if (values.has(arg)) { assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing ${arg} value`); result[values.get(arg)] = resolve(args[++i]); }
    else if (arg === '--verify') result.verify = true;
    else if (arg === '--replay') result.replay = true;
    else if (arg === '--help') result.help = true;
    else throw Error(`Unknown option: ${arg}`);
  }
  assert.ok(!result.ids.length || result.replay, '--id requires --replay');
  assert.equal(new Set(result.ids).size, result.ids.length, 'Duplicate replay trial id');
  return result;
}

export async function main(args = process.argv.slice(2)) {
  const opts = options(args);
  if (opts.help) {
    console.log('Usage: node scripts/audit-evidence.mjs --verify|--replay [--manifest FILE] [--archive FILE --files-manifest FILE] [--cache-dir DIR] [--docs DIR] [--id TRIAL_ID]');
    console.log('--verify pins and checks all archived files, declarations, contracts, reward regeneration and historical audit tests in a temporary workspace. --replay also executes archived implementations (all trials unless --id is supplied). No new model observations are collected.');
    return;
  }
  assert.ok(opts.verify || opts.replay, 'Choose --verify or --replay (see --help)');
  const verified = await loadAuditEvidence(opts);
  console.log(JSON.stringify({archiveSha256:verified.manifest.archive.sha256, archiveVerified:true, fileCount:verified.entries.length}));
  const result = await verifyAuditWorkspace(verified, opts);
  console.log(JSON.stringify({audit:verified.manifest.id, ...result}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
