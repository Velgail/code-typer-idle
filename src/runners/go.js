// SPDX-License-Identifier: BSL-1.0
// The Go interpreter is loaded only inside the exercise worker.
let initialized;

function rootUrl(baseUrl) {
 const url = new URL(baseUrl, globalThis.location?.href || import.meta.url);
 if (!url.pathname.endsWith('/')) url.pathname += '/';
 return url;
}

async function fetchBytes(url) {
 const response = await fetch(url);
 if (!response.ok) throw new Error(`Go runtime download failed (${response.status})`);
 let bytes = new Uint8Array(await response.arrayBuffer());
 if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress the Go runtime');
  bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 return bytes;
}

export async function initialize(baseUrl) {
 if (initialized) return initialized;
 initialized = (async () => {
  const root = rootUrl(baseUrl);
  await import(new URL('go/wasm_exec.js', root).href);
  const go = new globalThis.Go();
  const binary = await fetchBytes(new URL('go/yaegi.wasm.gz', root));
  const {instance} = await WebAssembly.instantiate(binary, go.importObject);
  // The original wrapper stays alive on a channel. Never await this promise.
  go.run(instance).catch(error => { globalThis.codeTyperGoFailure = String(error); });
  if (typeof globalThis.codeTyperGoExecute !== 'function') throw new Error('Go runtime did not initialize');
 })();
 try { await initialized; } catch (error) { initialized = undefined; throw error; }
}

export async function execute(source) {
 if (!initialized) throw new Error('Go runtime has not been initialized');
 await initialized;
 if (globalThis.codeTyperGoFailure) return {stdout:'', error:globalThis.codeTyperGoFailure,errorKind:'runtime'};
 try { return JSON.parse(globalThis.codeTyperGoExecute(String(source))); }
 catch (error) { return {stdout:'', error:String(error),errorKind:'runtime'}; }
}
