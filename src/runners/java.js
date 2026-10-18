// Java source -> javac bytecode -> TeaVM Wasm GC. This is not a complete JVM.
const VERSION_PATH = 'java/teavm-javac-208d4c97/';
const OUTPUT_LIMIT = 65536;
let environment;

async function compressedAsset(url) {
  let cache;
  try { cache = await caches.open('code-typer-idle:runtime:java-teavm-208d4c97'); } catch { /* storage is optional */ }
  let response = await cache?.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`Compiler asset HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (cache) {
      try { await cache.put(url, new Response(bytes)); } catch { /* quota must not prevent compilation */ }
    }
    response = new Response(bytes);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  return new Int8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

async function prepare(baseUrl) {
  const root = new URL(VERSION_PATH, String(baseUrl).replace(/\/?$/, '/'));
  const [runtime, wasm, sdk, classlib] = await Promise.all([
    import(new URL('compiler.wasm-runtime.js', root).href),
    compressedAsset(new URL('compiler.wasm.gz', root).href),
    compressedAsset(new URL('compile-classlib-teavm.bin.gz', root).href),
    compressedAsset(new URL('runtime-classlib-teavm.bin.gz', root).href),
  ]);
  const module = await runtime.load(wasm);
  return { runtime, library: module.exports, sdk, classlib };
}

/** baseUrl is the absolute URL of the shared runtime-assets/ directory. */
export async function initialize(baseUrl) {
  if (!environment) environment = prepare(baseUrl).catch(error => { environment = undefined; throw error; });
  await environment;
}

/** Source includes public class Main and its exercise main/test harness. */
export async function execute(source) {
  if (!environment) throw new Error('Java runner is not initialized');
  const env = await environment;
  let stdout = '', stderr = '', outputTruncated = false, phase = 'compile';
  const diagnostics = [];
  try {
    const compiler = env.library.createCompiler();
    compiler.setSdk(env.sdk);
    compiler.setTeaVMClasslib(env.classlib);
    compiler.onDiagnostic(d => diagnostics.push({ severity: d.severity, message: d.message,
      line: d.lineNumber, column: d.columnNumber, file: d.fileName, type: d.type }));
    compiler.addSourceFile('Main.java', source);
    if (!compiler.compile()) return { stdout, stderr, diagnostics, error: 'compile-error', errorKind: 'compile' };
    // TeaVM 0.16's strict bound-check insertion crashes on unreachable constant
    // division by zero. This supported option makes the tested lesson subset run.
    // Java array/exception semantics outside that subset remain unsupported.
    if (!compiler.generateWebAssembly({ outputName: 'app', mainClass: 'Main', strictMode: false })) {
      return { stdout, stderr, diagnostics, error: 'unsupported-feature', errorKind: 'compile' };
    }
    phase = 'runtime';
    const app = await env.runtime.load(compiler.getWebAssemblyOutputFile('app.wasm'), {
      noAutoImports: true,
      installImports(imports) {
        imports.teavmConsole.putcharStdout = c => {
          outputTruncated ||= stdout.length + 1 > OUTPUT_LIMIT;
          stdout = (stdout + String.fromCharCode(c)).slice(0, OUTPUT_LIMIT);
        };
        imports.teavmConsole.putcharStderr = c => {
          outputTruncated ||= stderr.length + 1 > OUTPUT_LIMIT;
          stderr = (stderr + String.fromCharCode(c)).slice(0, OUTPUT_LIMIT);
        };
      },
    });
    app.exports.main([]);
    return { stdout, stderr, diagnostics, outputTruncated };
  } catch (error) {
    diagnostics.push({ severity: 'error', message: error instanceof Error ? error.message : String(error) });
    return { stdout, stderr, diagnostics, outputTruncated, error: phase === 'compile' ? 'compile-error' : 'runtime-error', errorKind: phase };
  }
}
