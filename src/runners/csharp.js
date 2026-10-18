// Runs inside the grading worker. The host terminates that worker on timeout.
let runtimePromise;
let compilation;
const OUTPUT_LIMIT = 64 * 1024;

function boundedOutput(value) {
  const text = String(value ?? '');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= OUTPUT_LIMIT) return text;
  return new TextDecoder().decode(bytes.subarray(0, OUTPUT_LIMIT), { stream: true });
}

function installCompressedAssets(directory) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot decompress the C# runtime.');
  }
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input, directory);
    if (!url.href.startsWith(directory.href) || !/\.(?:dll|wasm|dat)$/.test(url.pathname)) {
      return originalFetch(input, options);
    }
    const compressed = new URL(url);
    compressed.pathname += '.gz';
    const request = input instanceof Request ? new Request(compressed, input) : compressed;
    const response = await originalFetch(request, options);
    if (!response.ok || !response.body) return response;
    const headers = new Headers(response.headers);
    headers.delete('Content-Encoding');
    headers.delete('Content-Length');
    headers.set('Content-Type', url.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip')), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

export async function initialize(baseUrl) {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const root = new URL(String(baseUrl).replace(/\/?$/, '/'), import.meta.url);
      const directory = new URL('csharp/', root);
      installCompressedAssets(directory);
      const { WasmSharpWorker } = await import(new URL('WasmSharpWorker.js', directory).href);
      return WasmSharpWorker.initializeAsync({ assembliesUrl: directory.href });
    })();
  }
  await runtimePromise;
}

export async function execute(source) {
  try {
    if (!runtimePromise) throw new Error('C# runtime is not initialized.');
    const runtime = await runtimePromise;
    // Upstream keeps compilations in a permanent cache. Reuse one entry per worker.
    if (compilation) await compilation.recompileAsync(String(source));
    else compilation = await runtime.createCompilationAsync(String(source));
    const result = await compilation.run();
    const diagnostics = (result.diagnostics ?? []).slice(0, 100).map(item => ({
      id: item.id,
      message: boundedOutput(item.message).slice(0, 2048),
      severity: item.severity,
      location: item.location,
      phase: 'compile',
    }));
    const outputTruncated = new TextEncoder().encode(String(result.stdOut ?? '')).length > OUTPUT_LIMIT ||
      new TextEncoder().encode(String(result.stdErr ?? '')).length > OUTPUT_LIMIT;
    const compileError = !result.success && diagnostics.some(item => String(item.severity).toLowerCase() === 'error');
    // The wrapper's stdErr is its caught execution exception, even when success=true.
    const runtimeError = Boolean(result.stdErr) || (!result.success && !compileError);
    const error = compileError ? 'C# compilation failed.' : outputTruncated ? 'Output limit exceeded (64 KiB).' :
      runtimeError ? boundedOutput(result.stdErr || 'C# execution failed.') : undefined;
    return {
      stdout: boundedOutput(result.stdOut),
      stderr: boundedOutput(result.stdErr),
      diagnostics,
      ...(outputTruncated ? { outputTruncated: true } : {}),
      ...(error ? { error, errorKind: compileError ? 'compile' : 'runtime' } : {}),
    };
  } catch (error) {
    return { stdout: '', stderr: '', error: boundedOutput(error?.message ?? error), errorKind: 'runtime' };
  }
}
