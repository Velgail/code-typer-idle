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

export async function execute(source, {sqlChecks=[],sqlProgram} = {}) {
  if (!sqlite) throw new Error('SQL runtime has not been initialized.');
  const db = new sqlite.oo1.DB(':memory:', 'c');
  const { wasm, capi } = sqlite;
  const scope = wasm.scopedAllocPush();
  let stdout = '', outputExceeded = false, statement = 0, phase = 'compile';
  const check = code => {
    if (code !== capi.SQLITE_OK) throw new Error(`SQLite error ${code}: ${capi.sqlite3_errmsg(db.pointer)}`);
  };
  try {
    const program = sqlProgram === undefined ? [{ source: String(source), captureOutput: true }] : sqlProgram;
    if (!Array.isArray(program) || !program.length || program.some(segment => !segment || typeof segment.source !== 'string' || typeof segment.captureOutput !== 'boolean')) {
      throw new Error('Invalid SQL execution program.');
    }
    // Check a submitted SELECT before JSON aggregation hides its original
    // column shape. The final harness still compares every returned value.
    for(const query of sqlChecks){
      db.exec(query.fixtureSql);
      const input=wasm.scopedAllocCString(String(query.source));
      const pointers=wasm.scopedAllocPtr(2);
      wasm.pokePtr(pointers[0],0);
      check(capi.sqlite3_prepare_v3(db.pointer,input,-1,0,pointers[0],pointers[1]));
      statement=wasm.peekPtr(pointers[0]);
      if(!statement || capi.sqlite3_column_count(statement)!==query.columns)throw new Error(`Expected ${query.columns} result columns in the submitted SELECT.`);
      capi.sqlite3_finalize(statement);statement=0;
    }
    // db.exec() deliberately returns only its first result set. Use SQLite's
    // own parser/tail pointer so every fixture SELECT is graded, including
    // statements containing semicolons inside comments and string literals.
    const [statementPointer, tailPointer] = wasm.scopedAllocPtr(2);
    for (const segment of program) {
     let cursor = wasm.scopedAllocCString(segment.source);
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
        // Do not skip stepping statements whose rows are not graded: an
        // UPDATE/INSERT/DELETE RETURNING still has to complete its changes.
        if (!segment.captureOutput) continue;
        if(capi.sqlite3_column_count(statement)!==1)throw new Error('Return exactly one output column. Structured Challenge results use a JSON value in that column.');
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
