import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {AUDIT_LIMITS, extractAuditEvidence, loadAuditEvidence, validateAuditManifest, verifyAuditArchive, verifyReplayReports} from '../scripts/audit-evidence.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const commit = '1234567890abcdef1234567890abcdef12345678';
const original = Buffer.from('  原文\r\n🧮 e\u0301\n');
const defaults = [{path:'research/answers/original.md', bytes:original}, {path:'research/record.json', bytes:Buffer.from('{"clock":"1000000000000000001"}\n')}];
const octal = (value, width) => value.toString(8).padStart(width - 1, '0') + '\0';
function checksum(header) {
  header.fill(32, 148, 156);
  const total = header.reduce((sum, byte) => sum + byte, 0);
  header.write(total.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return header;
}
function tar(entries) {
  const chunks = [];
  for (const row of entries) {
    const bytes = row.bytes ?? Buffer.alloc(0), header = Buffer.alloc(512);
    header.write(row.path, 0, 100, 'utf8');
    header.write(octal(0o644, 8), 100, 'ascii');
    header.write(octal(0, 8), 108, 'ascii'); header.write(octal(0, 8), 116, 'ascii');
    header.write(octal(bytes.length, 12), 124, 'ascii'); header.write(octal(0, 12), 136, 'ascii');
    header[156] = (row.type ?? '0').charCodeAt(0);
    if (row.link) header.write(row.link, 157, 100, 'utf8');
    header.write('ustar\0', 257, 'ascii'); header.write('00', 263, 'ascii');
    if (row.change) row.change(header);
    chunks.push(checksum(header), bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}
function fixture({entries = defaults, records = defaults, changeTar, changeManifest, changeSidecar} = {}) {
  const sidecar = {schemaVersion:1, sourceCommit:commit, files:records.map(row => ({path:row.path, sizeBytes:row.bytes.length, sha256:sha(row.bytes)}))};
  changeSidecar?.(sidecar);
  const fileManifestBytes = Buffer.from(JSON.stringify(sidecar));
  let decoded = tar(entries);
  if (changeTar) decoded = changeTar(decoded);
  const compressed = gzipSync(decoded);
  const manifest = {schemaVersion:1, id:'test-originals', sourceCommit:commit,
    archive:{url:'https://example.invalid/audit.tar.gz', sha256:sha(compressed), sizeBytes:compressed.length,
      uncompressedSizeBytes:decoded.length, payloadSizeBytes:records.reduce((sum, row) => sum + row.bytes.length, 0), fileCount:records.length, format:'tar.gz'},
    fileManifest:{url:'https://example.invalid/files.json', sha256:sha(fileManifestBytes), sizeBytes:fileManifestBytes.length}};
  changeManifest?.(manifest);
  return {compressed, fileManifestBytes, manifest};
}
const verify = f => verifyAuditArchive(f.compressed, f.fileManifestBytes, f.manifest);
async function temporary(t) {
  const path = await mkdtemp(join(tmpdir(), 'cti-audit-test-'));
  t.after(() => rm(path, {recursive:true, force:true}));
  return path;
}

test('pinned originals retain exact Unicode bytes and extract only into an empty workspace', async t => {
  const result = verify(fixture());
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries[0].bytes, original);
  const root = await temporary(t), destination = join(root, 'isolated');
  await mkdir(destination);
  await extractAuditEvidence(result, destination);
  assert.deepEqual(await readFile(join(destination, defaults[0].path)), original);
  assert.deepEqual(await readFile(join(destination, defaults[1].path)), defaults[1].bytes);
  await assert.rejects(extractAuditEvidence(result, destination), /must be empty/);
  assert.deepEqual(await readFile(join(destination, defaults[0].path)), original);
});

test('both external assets and individual files must match their pinned hashes and sizes', () => {
  const f = fixture(), corrupt = Buffer.from(f.compressed); corrupt[20] ^= 1;
  assert.throws(() => verifyAuditArchive(corrupt, f.fileManifestBytes, f.manifest), /Archive SHA-256/);
  const changedSidecar = Buffer.from(f.fileManifestBytes); changedSidecar[20] ^= 1;
  assert.throws(() => verifyAuditArchive(f.compressed, changedSidecar, f.manifest), /File manifest SHA-256/);
  assert.throws(() => verifyAuditArchive(f.compressed.subarray(1), f.fileManifestBytes, f.manifest), /Compressed archive size/);
  assert.throws(() => verify(fixture({entries:[{...defaults[0], bytes:Buffer.from('tampered')}, defaults[1]]})), /File size differs/);
  const sameSize = Buffer.from(original); sameSize[0] = 33;
  assert.throws(() => verify(fixture({entries:[{...defaults[0], bytes:sameSize}, defaults[1]]})), /File SHA-256/);
  assert.throws(() => verify(fixture({changeManifest:m => m.archive.uncompressedSizeBytes += 512})), /Uncompressed TAR size/);
  assert.throws(() => verify(fixture({changeManifest:m => m.archive.payloadSizeBytes++})), /Payload size/);
});

test('missing, additional and duplicate originals cannot pass an internally valid archive hash', () => {
  assert.throws(() => verify(fixture({entries:[defaults[0]]})), /Missing TAR files/);
  assert.throws(() => verify(fixture({entries:[...defaults, {path:'research/extra.json', bytes:Buffer.from('extra')}]})), /Unlisted TAR file/);
  assert.throws(() => verify(fixture({entries:[...defaults, defaults[0]]})), /Duplicate TAR path/);
  assert.throws(() => verify(fixture({changeSidecar:m => m.files.reverse()})), /sorted and unique/);
  assert.throws(() => verify(fixture({changeManifest:m => m.archive.fileCount++})), /count differs/);
  assert.throws(() => verify(fixture({changeSidecar:m => m.sourceCommit = '0'.repeat(40)})), /source commit differs/);
});

test('archive traversal, links and special metadata never reach the filesystem', async t => {
  const root = await temporary(t), destination = join(root, 'empty'); await mkdir(destination);
  for (const path of ['/tmp/escaped', '../escaped', 'research/../escaped', 'research//escaped', 'research/./escaped', 'research\\escaped', 'src/challengerewards.js']) {
    assert.throws(() => verify(fixture({entries:[{path, bytes:Buffer.from('escape')}, defaults[1]]})), /Unsafe|research\//);
  }
  for (const type of ['1', '2', '3', '4', '6', 'x', 'g', 'L', 'K']) {
    assert.throws(() => verify(fixture({entries:[{...defaults[0], type, link:'../../escape'}, defaults[1]]})), /forbidden/);
  }
  const parent = {path:'research/answers', bytes:Buffer.from('file')};
  assert.throws(() => verify(fixture({entries:[parent, defaults[0]], records:[parent, defaults[0]]})), /parent directory/);
  assert.deepEqual(await readdir(destination), []);
});

test('malformed TAR headers, padding, truncation and trailing payload fail closed', () => {
  assert.throws(() => verify(fixture({changeTar:bytes => { bytes[100] ^= 1; return bytes; }})), /header checksum/);
  assert.throws(() => verify(fixture({entries:[{...defaults[0], change:h => h.write('99999999999\0', 124, 'ascii')}, defaults[1]]})), /Invalid TAR entry size/);
  assert.throws(() => verify(fixture({entries:[{...defaults[0], change:h => h.fill(0, 257, 265)}, defaults[1]]})), /USTAR/);
  assert.throws(() => verify(fixture({changeTar:bytes => { bytes[512 + original.length] = 1; return bytes; }})), /padding/);
  assert.throws(() => verify(fixture({changeTar:bytes => bytes.subarray(0, bytes.length - 512)})), /end marker/);
  assert.throws(() => verify(fixture({changeTar:bytes => Buffer.concat([bytes, Buffer.from('injected')])})), /multiple of 512/);
  assert.throws(() => verify(fixture({changeTar:bytes => { bytes[bytes.length - 1] = 1; return bytes; }})), /trailing data/);
});

test('expansion limits apply even when a compressed payload has a valid pinned hash', () => {
  const f = fixture();
  f.manifest.archive.uncompressedSizeBytes = 1024;
  assert.throws(() => verify(f), /larger than|size|length|buffer/i);
  for (const [key, value] of [['sizeBytes', AUDIT_LIMITS.compressedBytes + 1], ['uncompressedSizeBytes', AUDIT_LIMITS.tarBytes + 1], ['fileCount', AUDIT_LIMITS.files + 1]]) {
    assert.throws(() => validateAuditManifest({...f.manifest, archive:{...f.manifest.archive, [key]:value}}), /excessive/);
  }
  assert.throws(() => validateAuditManifest({...f.manifest, archive:{...f.manifest.archive, url:'http://example.invalid/archive'}}), /HTTPS/);
});

test('local archive overrides verify offline and cannot overwrite the original evidence', async t => {
  const root = await temporary(t), f = fixture(), manifestPath = join(root, 'manifest.json');
  const archivePath = join(root, 'evidence.tar.gz'), filesManifestPath = join(root, 'files.json');
  await writeFile(manifestPath, JSON.stringify(f.manifest)); await writeFile(archivePath, f.compressed); await writeFile(filesManifestPath, f.fileManifestBytes);
  let requested = false;
  const options = {manifestPath, archivePath, filesManifestPath, cacheDirectory:join(root, 'unused-cache'), fetchImpl:async () => { requested = true; throw Error('Network forbidden'); }};
  const verified = await loadAuditEvidence(options);
  assert.equal(verified.entries.length, 2); assert.equal(requested, false);
  assert.deepEqual(await readFile(archivePath), f.compressed);
  await writeFile(archivePath, Buffer.alloc(f.compressed.length));
  await assert.rejects(loadAuditEvidence(options), /SHA-256 differs/);
  assert.equal(requested, false);
  await writeFile(archivePath, f.compressed);
  await rm(filesManifestPath);
  await assert.rejects(loadAuditEvidence(options), /ENOENT/);
});

test('downloads are bounded, cached by asset SHA and rechecked before reuse', async t => {
  const root = await temporary(t), f = fixture(), manifestPath = join(root, 'manifest.json'), cacheDirectory = join(root, 'cache');
  await writeFile(manifestPath, JSON.stringify(f.manifest));
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    return new Response(url === f.manifest.archive.url ? f.compressed : f.fileManifestBytes);
  };
  const opts = {manifestPath, cacheDirectory, fetchImpl};
  await loadAuditEvidence(opts);
  assert.deepEqual(urls.sort(), [f.manifest.archive.url, f.manifest.fileManifest.url].sort());
  urls.length = 0;
  await loadAuditEvidence(opts); assert.deepEqual(urls, []);
  const cached = join(cacheDirectory, f.manifest.archive.sha256 + '.tar.gz');
  await writeFile(cached, Buffer.alloc(f.compressed.length));
  await assert.rejects(loadAuditEvidence(opts), /SHA-256 differs/); assert.deepEqual(urls, []);
  await rm(cacheDirectory, {recursive:true, force:true});
  await assert.rejects(loadAuditEvidence({...opts, fetchImpl:async () => new Response(Buffer.alloc(f.manifest.archive.sizeBytes + f.manifest.fileManifest.sizeBytes + 1))}), /exceeds pinned size/);
});

test('direct downloads validate HTTPS redirects before following and cap redirect loops', async t => {
  const root = await temporary(t), f = fixture(), manifestPath = join(root, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(f.manifest));
  const urls = [];
  const options = {manifestPath, cacheDirectory:join(root, 'cache'), fetchImpl:async (url, opts) => {
    urls.push(url); assert.equal(opts.redirect, 'manual');
    return new Response(null, {status:302, headers:{location:'http://insecure.invalid/asset'}});
  }};
  await assert.rejects(loadAuditEvidence(options), /HTTPS required/);
  assert.ok(urls.every(url => url.startsWith('https:')));
  let requests = 0;
  await assert.rejects(loadAuditEvidence({...options, fetchImpl:async () => {
    requests++; return new Response(null, {status:302, headers:{location:'/loop'}});
  }}), /Too many.*redirects/);
  assert.ok(requests <= 12);
});

test('replay must reproduce every selected judgement, case result and failure category', async t => {
  const root = await temporary(t);
  await mkdir(join(root, 'research')); await mkdir(join(root, 'work/raw-explanation-replay'), {recursive:true});
  const prior = {id:'trial_one', accepted:false, category:'wrong-answer', cases:[{id:'case-01', expected:2, actual:1, passed:false, resultAvailable:true}]};
  await writeFile(join(root, 'research/raw-explanation-submissions.json'), JSON.stringify({submissions:[prior]}));
  await writeFile(join(root, 'research/raw-explanation-cohorts.json'), JSON.stringify({cohorts:[{protocol:'research/protocol.json'}]}));
  await writeFile(join(root, 'research/protocol.json'), JSON.stringify({experimentId:'sample'}));
  const report = join(root, 'work/raw-explanation-replay/sample.json');
  const writeReport = row => writeFile(report, JSON.stringify({submissions:row ? [row] : []}));
  await writeReport(prior);
  assert.equal(await verifyReplayReports(root), 1);
  assert.equal(await verifyReplayReports(root, ['trial_one']), 1);
  for (const change of [row => row.accepted = true, row => row.category = 'runtime-error', row => row.cases[0].actual = 0, row => row.cases[0].passed = true, row => row.cases[0].resultAvailable = false]) {
    const altered = structuredClone(prior); change(altered); await writeReport(altered);
    await assert.rejects(verifyReplayReports(root), /Replayed/);
  }
  await writeReport(); await assert.rejects(verifyReplayReports(root), /did not cover/);
  await writeReport({...prior, id:'unexpected'}); await assert.rejects(verifyReplayReports(root), /Unexpected/);
});

test('proxy downloads use bounded HTTPS-only curl without a shell and retain SHA verification', async t => {
  const root = await temporary(t), f = fixture(), manifestPath = join(root, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(f.manifest));
  const invocations = []; let mode = 'valid', killed = 0;
  const spawnImpl = (command, args, options) => {
    invocations.push({command, args, options});
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = signal => { killed++; child.emit('close', null, signal); };
    queueMicrotask(() => {
      const url = args.at(-1), expected = url === f.manifest.archive.url ? f.compressed : f.fileManifestBytes;
      if (mode === 'failed') { child.stderr.write('proxy refused request'); child.emit('close', 22, null); return; }
      const bytes = mode === 'oversize' ? Buffer.alloc(expected.length + 1) : mode === 'tampered' ? Buffer.alloc(expected.length) : expected;
      child.stdout.write(bytes); child.stdout.end(); child.emit('close', 0, null);
    });
    return child;
  };
  const cacheDirectory = join(root, 'cache');
  const options = {manifestPath, cacheDirectory, downloadEnvironment:{HTTP_PROXY:'http://proxy.invalid:8080'}, spawnImpl};
  assert.equal((await loadAuditEvidence(options)).entries.length, 2);
  for (const call of invocations) {
    assert.equal(call.command, 'curl'); assert.equal(call.options.shell, false);
    assert.equal(call.options.timeout, 60000); assert.equal(call.options.killSignal, 'SIGKILL');
    assert.equal(call.options.env.HTTPS_PROXY, options.downloadEnvironment.HTTP_PROXY);
    assert.equal(call.args[0], '--disable');
    assert.equal(call.args[call.args.indexOf('--proto') + 1], '=https');
    assert.equal(call.args[call.args.indexOf('--proto-redir') + 1], '=https');
    assert.equal(call.args[call.args.indexOf('--max-time') + 1], '60');
    const record = call.args.at(-1) === f.manifest.archive.url ? f.manifest.archive : f.manifest.fileManifest;
    assert.equal(call.args[call.args.indexOf('--max-filesize') + 1], String(record.sizeBytes));
  }
  await rm(cacheDirectory, {recursive:true}); mode = 'oversize';
  await assert.rejects(loadAuditEvidence(options), /exceeds pinned size/); assert.ok(killed > 0);
  mode = 'tampered'; await assert.rejects(loadAuditEvidence(options), /SHA-256 differs/);
  mode = 'failed'; await assert.rejects(loadAuditEvidence(options), /proxy download failed.*proxy refused request/);
});
