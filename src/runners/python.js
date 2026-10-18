// Pyodide and CPython are distributed under their own licenses in runtime-assets/licenses/.
const OUTPUT_LIMIT = 64 * 1024;
let python;
let loading;

export async function initialize(baseUrl) {
  if (python) return;
  if (!loading) loading = (async () => {
    const directory = new URL('python/', baseUrl);
    const { loadPyodide } = await import(new URL('pyodide.mjs', directory).href);
    python = await loadPyodide({ indexURL: directory.href, stdout: () => {}, stderr: () => {} });
  })().catch(error => { loading = undefined; throw error; });
  await loading;
}

export async function execute(source) {
  if (!python) throw new Error('Python runtime has not been initialized.');
  let stdout = '', stderr = '', size = 0, outputExceeded = false;
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  const write = (stream, bytes) => {
    const text = decoders[stream].decode(bytes, { stream: true });
    const available = Math.max(0, OUTPUT_LIMIT - size);
    if (stream === 'stdout') stdout += text.slice(0, available);
    else stderr += text.slice(0, available);
    size += text.length;
    if (size > OUTPUT_LIMIT) {
      outputExceeded = true;
      throw new Error('Output limit exceeded (64 KiB).');
    }
    return bytes.length;
  };
  python.setStdout({ write: bytes => write('stdout', bytes) });
  python.setStderr({ write: bytes => write('stderr', bytes) });
  const namespace = python.toPy({ __name__: '__main__' });
  let failure;
  try {
    python.runPython(String(source), { globals: namespace });
  } catch (error) {
    failure = error;
  }
  try {
    // Flush Python buffering, including writes which did not end in a newline.
    python.runPython('import sys\nsys.stdout.flush()\nsys.stderr.flush()');
  } catch (error) {
    failure ||= error;
  } finally {
    namespace.destroy();
    python.setStdout({ write: bytes => bytes.length });
    python.setStderr({ write: bytes => bytes.length });
  }
  if (failure || outputExceeded) {
    const message = outputExceeded ? 'Output limit exceeded (64 KiB).' : String(failure.message || failure);
    const syntax = /(?:SyntaxError|IndentationError|TabError):/.test(message);
    const locations = [...message.matchAll(/File "<exec>", line (\d+)/g)];
    return { stdout, stderr, error: message, diagnostics: [{ severity: 'error', phase: syntax ? 'compile' : 'runtime', message, ...(locations.length ? { line: Number(locations.at(-1)[1]) } : {}) }] };
  }
  return { stdout, stderr, diagnostics: [] };
}
