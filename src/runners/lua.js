// Wasmoon, Lua, and Emscripten retain the notices in runtime-assets/licenses/.
const OUTPUT_LIMIT = 64 * 1024;
let factory;
let loading;

export async function initialize(baseUrl) {
  if (factory) return;
  if (!loading) loading = (async () => {
    const directory = new URL('lua/', baseUrl);
    await import(new URL('index.js', directory).href);
    const candidate = new globalThis.wasmoon.LuaFactory(new URL('glue.wasm', directory).href);
    await candidate.getLuaModule();
    factory = candidate;
  })().catch(error => { loading = undefined; throw error; });
  await loading;
}

export async function execute(source) {
  if (!factory) throw new Error('Lua runtime has not been initialized.');
  const lua = await factory.createEngine({ injectObjects: false, enableProxy: false });
  let stdout = '', phase = 'compile', outputExceeded = false;
  const evaluate = code => {
    const base = lua.global.getTop();
    try {
      lua.global.loadString(code, 'submission.lua');
      phase = 'runtime';
      lua.global.runSync();
    } finally {
      // Both values and errors stay on Wasmoon's stack unless explicitly removed.
      lua.global.pop(Math.max(0, lua.global.getTop() - base));
    }
  };
  try {
    lua.global.set('__cti_write', line => {
      const text = String(line) + '\n';
      const available = Math.max(0, OUTPUT_LIMIT - stdout.length);
      stdout += text.slice(0, available);
      if (text.length > available) {
        outputExceeded = true;
        throw new Error('Output limit exceeded (64 KiB).');
      }
    });
    evaluate('print = function(...) local values = {} for i = 1, select("#", ...) do values[i] = tostring(select(i, ...)) end __cti_write(table.concat(values, "\\t")) end');
    phase = 'compile';
    evaluate(String(source));
    if (outputExceeded) throw new Error('Output limit exceeded (64 KiB).');
    return { stdout, stderr: '', diagnostics: [] };
  } catch (failure) {
    const message = outputExceeded ? 'Output limit exceeded (64 KiB).' : String(failure.message || failure);
    const line = message.match(/(?:submission\.lua|\[string [^\n]*\]):(\d+):/);
    return { stdout, stderr: '', error: message, diagnostics: [{ severity: 'error', phase, message, ...(line ? { line: Number(line[1]) } : {}) }] };
  } finally {
    lua.global.close();
  }
}
