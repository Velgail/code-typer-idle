// Compiler/interpreter modules stay out of the game's startup dependency graph.
const adapters = {
  cpp: () => import('./runners/cpp.js'),
  csharp: () => import('./runners/csharp.js'),
  rust: () => import('./runners/rust.js'),
  go: () => import('./runners/go.js'),
  python: () => import('./runners/python.js'),
  java: () => import('./runners/java.js'),
  sql: () => import('./runners/sql.js'),
  lua: () => import('./runners/lua.js')
};
let adapter, requestId;
self.addEventListener('message', async event => {
  const message = event.data;
  try {
    if (message?.type === 'initialize' && adapters[message.language]) {
      requestId = message.id;
      adapter = await adapters[message.language]();
      await adapter.initialize(new URL('../runtime-assets/v1/', import.meta.url).href);
      self.postMessage({ id: requestId, type: 'ready' });
    } else if (message?.type === 'execute' && adapter && message.id === requestId) {
      const result = await adapter.execute(message.source, { sqlChecks: message.sqlChecks, sqlProgram: message.sqlProgram });
      self.postMessage({ id: requestId, type: 'result', result });
    }
  } catch (error) {
    self.postMessage({ id: message?.id, type: 'result', result: { stdout: '', error: String(error?.message || error) } });
  }
});
