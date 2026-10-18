// SQLite, its Emscripten glue, and the npm wrapper retain their own license notices.
const OUTPUT_LIMIT = 64 * 1024;
let sqlite;
let loading;

export async function initialize(baseUrl) {
  if (sqlite) return;
  if (!loading) loading = (async () => {
    const directory = new URL('sql/', baseUrl);
    const { default: initializeSQLite } = await import(new URL('index.mjs', directory).href);
    sqlite = await initializeSQLite({ print: () => {}, printErr: () => {} });
  })().catch(error => { loading = undefined; throw error; });
  await loading;
}

export async function execute(source) {
  if (!sqlite) throw new Error('SQL runtime has not been initialized.');
  const db = new sqlite.oo1.DB(':memory:', 'c');
  const { wasm, capi } = sqlite;
  const scope = wasm.scopedAllocPush();
  let stdout = '', outputExceeded = false, statement = 0, phase = 'compile';
  const check = code => {
    if (code !== capi.SQLITE_OK) throw new Error(`SQLite error ${code}: ${capi.sqlite3_errmsg(db.pointer)}`);
  };
  try {
    // db.exec() deliberately returns only its first result set. Use SQLite's
    // own parser/tail pointer so every fixture SELECT is graded, including
    // statements containing semicolons inside comments and string literals.
    let cursor = wasm.scopedAllocCString(String(source));
    const [statementPointer, tailPointer] = wasm.scopedAllocPtr(2);
    while (cursor && wasm.peek8(cursor)) {
      phase = 'compile';
      wasm.pokePtr(statementPointer, 0);
      check(capi.sqlite3_prepare_v3(db.pointer, cursor, -1, 0, statementPointer, tailPointer));
      statement = wasm.peekPtr(statementPointer);
      const next = wasm.peekPtr(tailPointer);
      if (next === cursor) throw new Error('SQLite parser did not advance.');
      cursor = next;
      if (!statement) continue;
      phase = 'runtime';
      let code;
      while ((code = capi.sqlite3_step(statement)) === capi.SQLITE_ROW) {
        const value = capi.sqlite3_column_js(statement, 0);
        const text = (value === null ? 'null' : String(value)) + '\n';
        const available = Math.max(0, OUTPUT_LIMIT - stdout.length);
        stdout += text.slice(0, available);
        if (text.length > available) {
          outputExceeded = true;
          throw new Error('Output limit exceeded (64 KiB).');
        }
      }
      if (code !== capi.SQLITE_DONE) check(code);
      capi.sqlite3_finalize(statement);
      statement = 0;
    }
    return { stdout, stderr: '', diagnostics: [] };
  } catch (failure) {
    const message = outputExceeded ? 'Output limit exceeded (64 KiB).' : String(failure.message || failure);
    return { stdout, stderr: '', error: message, diagnostics: [{ severity: 'error', phase, message }] };
  } finally {
    if (statement) capi.sqlite3_finalize(statement);
    wasm.scopedAllocPop(scope);
    db.close();
  }
}
