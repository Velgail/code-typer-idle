import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('docs/runtime-assets/v1');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
let bytes=0;
for(const file of manifest.files){
  const path=resolve(root,file.path);
  assert.ok(path.startsWith(root+'/'),'runtime path must stay within the published package');
  const size=(await stat(path)).size;
  assert.ok(size<100*1024*1024,'GitHub file limit: '+file.path);
  assert.equal(size,file.bytes,file.path+' size');
  const digest=createHash('sha256').update(await readFile(path)).digest('hex');
  assert.equal(digest,file.sha256,file.path+' sha256');bytes+=size;
}
assert.ok(bytes<1024*1024*1024,'Pages asset size limit');
console.log(`Verified ${manifest.files.length} published runtime files (${bytes.toLocaleString()} bytes).`);
