// A compiler runs only after an explicit submission, outside the UI thread.
export const QUIZ_LANGUAGES = ['cpp','csharp','rust','go','python','java','sql','lua'];
export const QUIZ_SOURCE_LIMIT = 24000;
export const QUIZ_DEFAULT_EXECUTION_BUDGET_MS = 30000;
export const QUIZ_MAX_EXECUTION_BUDGET_MS = 300000;

// The deadline includes compilation and all fixtures. Only authored task
// metadata or an explicit runner override can change it, within a fixed cap.
export function quizExecutionBudgetMs(quiz, override) {
  const value=override===undefined ? quiz?.executionBudgetMs ?? QUIZ_DEFAULT_EXECUTION_BUDGET_MS : override;
  return Number.isInteger(value) && value>0 ? Math.min(QUIZ_MAX_EXECUTION_BUDGET_MS,value) : QUIZ_DEFAULT_EXECUTION_BUDGET_MS;
}

function sameJSON(actual,expected) {
  if(typeof actual==='number' && typeof expected==='number')return Number.isFinite(actual) && Number.isFinite(expected) && actual===expected;
  if(actual===null || expected===null || typeof actual!=='object' || typeof expected!=='object')return actual===expected;
  if(Array.isArray(actual)!==Array.isArray(expected))return false;
  const keys=Object.keys(expected),other=Object.keys(actual);
  return keys.length===other.length && keys.every(key=>Object.hasOwn(actual,key)&&sameJSON(actual[key],expected[key]));
}
export function compareQuizOutput(stdout, expected, caseIds = [], outputFormat = 'numeric') {
  const lines = String(stdout ?? '').trim().split(/\r?\n/).filter(line => line.trim() !== '');
  const rows = expected.map((value, i) => {
    if(outputFormat==='json-lines'){
      let actual=null,valid=false;
      try{actual=JSON.parse(lines[i]);valid=true;}catch{/* A complete JSON value is required for each test. */}
      return {id:caseIds[i]||String(i+1),expected:value,actual,passed:valid&&sameJSON(actual,value)};
    }
    const text = lines[i]?.trim(), actual = text !== undefined && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : null;
    return { id: caseIds[i] || String(i + 1), expected: value, actual, passed: Number.isFinite(actual) && Number.isFinite(value) && (Number.isInteger(value) ? actual === value : Math.abs(actual - value) <= 1e-9 * Math.max(1, Math.abs(value))) };
  });
  const extraOutput = lines.length > expected.length;
  return { passed: expected.length > 0 && !extraOutput && rows.every(row => row.passed), cases: rows, extraOutput };
}

export class QuizRunner {
  constructor({ workerFactory = () => new Worker(new URL('./quizworker.js', import.meta.url), { type: 'module' }), loadTimeout = 300000, executionTimeout } = {}) {
    this.workerFactory = workerFactory;
    this.loadTimeout = loadTimeout;
    this.executionTimeout = quizExecutionBudgetMs(null,executionTimeout);
    this.executionTimeoutOverride = executionTimeout;
    this.worker = null;
    this.sequence = 0;
    this.pending = null;
    this.language = null;
  }
  cancel() {
    this.worker?.terminate();
    this.worker = null;
    this.language = null;
    if (this.pending) this.finish({ status: 'cancelled', passed: false, cases: [], error: '実行を中止しました。' });
  }
  finish(value) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    const resolve = this.pending.resolve;
    this.pending = null;
    resolve(value);
  }
  async run(quiz, source, { onProgress = () => {} } = {}) {
    if (!QUIZ_LANGUAGES.includes(quiz.language)) throw new Error('未対応の言語です。');
    if (typeof source !== 'string' || source.length > QUIZ_SOURCE_LIMIT) return { status: 'error', passed: false, cases: [], error: `コードは${QUIZ_SOURCE_LIMIT.toLocaleString()}文字以内で入力してください。` };
    this.cancel();
    const harness = quiz.createHarness(source);
    return new Promise(resolve => {
      const id = ++this.sequence;
      let worker;
      try { worker = this.workerFactory(); } catch (error) { resolve({ status: 'error', passed: false, cases: [], error: String(error.message || error) }); return; }
      this.worker = worker;
      const timeout = (ms, message) => setTimeout(() => {
        worker.terminate();
        this.worker = null;
        this.finish({ status: 'timeout', passed: false, cases: [], error: message });
      }, ms);
      this.pending = { resolve, timer: timeout(this.loadTimeout, '実行環境の読み込みが時間切れになりました。再実行できます。') };
      onProgress('実行環境を読み込み中…');
      worker.onmessage = event => {
        if (event.data?.id !== id || !this.pending || this.worker !== worker) return;
        const message = event.data;
        if (message.type === 'progress') { onProgress(String(message.text).slice(0, 200)); return; }
        if (message.type === 'ready') {
          clearTimeout(this.pending.timer);
          this.pending.timer = timeout(quizExecutionBudgetMs(quiz,this.executionTimeoutOverride), 'コンパイル・テストが時間切れになりました。処理量やループの終了条件を確認してください。');
          onProgress('コンパイル・テスト中…');
          worker.postMessage({ type: 'execute', id, source: harness.source, sqlChecks: harness.sqlChecks, sqlProgram: harness.sqlProgram });
          return;
        }
        if (message.type !== 'result') return;
        const result = message.result || {};
        const output = String(result.stdout || '').slice(0, 65536);
        const compared = compareQuizOutput(output, harness.expected, harness.caseIds, harness.outputFormat);
        const failed = !!result.error || result.outputTruncated === true;
        const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics.slice(0, 30) : result.diagnostics ? [String(result.diagnostics).slice(0, 8000)] : [];
        const phase = result.errorKind || diagnostics.find(row=>row?.phase)?.phase;
        this.finish({ ...compared, passed: !failed && compared.passed, status: failed ? phase === 'compile' ? 'compile-error' : phase === 'runtime' ? 'runtime-error' : 'error' : compared.passed ? 'passed' : 'failed', stdout: output, stderr: String(result.stderr || '').slice(0, 65536), diagnostics, error: result.error ? String(result.error).slice(0, 8000) : result.outputTruncated ? '出力が上限を超えました。' : '' });
        // Discard the whole process: submissions cannot contaminate later tests.
        worker.terminate();
        this.worker = null;
      };
      worker.onerror = event => {
        if (this.worker !== worker) return;
        event.preventDefault?.();
        this.finish({ status: 'error', passed: false, cases: [], error: event.message || '実行環境を起動できませんでした。再実行できます。' });
        worker.terminate(); this.worker = null;
      };
      worker.postMessage({ type: 'initialize', id, language: quiz.language });
    });
  }
}
