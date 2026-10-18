import test from 'node:test';
import assert from 'node:assert/strict';
import { createOCRLedger, normalizeOCRLedger, recordOCR, correctOCR, nextOCRError, ocrErrorFor, OCR_ERROR_INTERVAL, OCR_REPAIR_WORK } from '../src/officequality.js';
import { officeOrderAt, OFFICE_DATA_VERSION, OFFICE_PROMPT_COUNT } from '../src/office.js';

test('every tenth automatically processed order loses payment and incurs a real resubmission fee', () => {
  const ledger = createOCRLedger();
  assert.deepEqual(recordOCR(ledger, 9, 1), { errors: 0, cancelled: 0, fee: 0, deduction: 0 });
  assert.equal(nextOCRError(ledger), null);
  const failure = recordOCR(ledger, 1, 1);
  assert.deepEqual(failure, { errors: 1, cancelled: 100, fee: 20, deduction: 120 });
  assert.equal(1000 - failure.deduction, 880, 'nine successful orders plus one failed order net nine payments minus the fee');
  assert.equal(ledger.pending, 1);
  assert.equal(ledger.pendingReward, 100);
  assert.equal(ledger.fees, 20);
  assert.equal(ledger.fraction, 0);
  const repair = correctOCR(ledger, OCR_REPAIR_WORK);
  assert.deepEqual(repair, { completed: 1, recovered: 100, workUsed: 100 });
  assert.equal(880 + repair.recovered, 980, 'fixing the delivery restores its payment but never the fee');
  assert.equal(ledger.fees, 20);
  assert.equal(ledger.pendingReward, 0);
  assert.equal(nextOCRError(ledger), null);
});

test('foreground and offline partitions produce exactly the same OCR ledger and deductions', () => {
  const whole = createOCRLedger(), split = createOCRLedger();
  const one = recordOCR(whole, 37.5, 3);
  let errors = 0, deduction = 0;
  for (let i = 0; i < 1500; i++) {
    const part = recordOCR(split, .025, 3);
    errors += part.errors;
    deduction += part.deduction;
  }
  assert.equal(errors, one.errors);
  assert.equal(deduction, one.deduction);
  assert.deepEqual(split, whole);
});

test('partial accepted orders accumulate across calls and charge the rate of the failing delivery', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 7.5, 1);
  assert.equal(ledger.fraction, 7.5);
  const failure = recordOCR(ledger, 2.5, 2);
  assert.equal(failure.cancelled, 200);
  assert.equal(failure.fee, 40);
  assert.equal(nextOCRError(ledger).rate, 2);
  assert.equal(correctOCR(ledger, 100).recovered, 200);
});

test('old quotations and paper versions survive later rate increases and source updates', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 20, 1, { version: 1 });
  recordOCR(ledger, 10, 2, { version: OFFICE_DATA_VERSION });
  const first = nextOCRError(ledger);
  assert.equal(first.version, 1);
  assert.deepEqual(first.order, officeOrderAt(first.index, 1));
  assert.equal(first.reward, 100);
  assert.equal(correctOCR(ledger, 200).recovered, 200);
  const current = nextOCRError(ledger);
  assert.equal(current.rate, 2);
  assert.equal(current.version, OFFICE_DATA_VERSION);
  assert.deepEqual(current.order, officeOrderAt(current.index));
  assert.equal(correctOCR(ledger, 100).recovered, 200);
});

test('repair work and the exact oldest correction survive save/reload midway through a repair', () => {
  const original = createOCRLedger();
  recordOCR(original, 30, 1);
  const first = nextOCRError(original);
  assert.deepEqual(correctOCR(original, 35), { completed: 0, recovered: 0, workUsed: 35 });
  const loaded = normalizeOCRLedger(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(loaded, original);
  assert.deepEqual(nextOCRError(loaded), first);
  assert.deepEqual(correctOCR(loaded, 65), { completed: 1, recovered: 100, workUsed: 65 });
  assert.equal(loaded.repairProgress, 0);
  assert.equal(loaded.pending, 2);
  assert.notEqual(nextOCRError(loaded).cursor, first.cursor);
});

test('one repair can clear several FIFO quotations without paying ordinary work income again', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 20, 1);
  recordOCR(ledger, 20, 2);
  recordOCR(ledger, 10, 3);
  const fees = ledger.fees;
  const repair = correctOCR(ledger, 350);
  assert.deepEqual(repair, { completed: 3, recovered: 400, workUsed: 350 });
  assert.equal(ledger.pending, 2);
  assert.equal(ledger.repairProgress, 50);
  assert.equal(nextOCRError(ledger).rate, 2);
  assert.equal(correctOCR(ledger, 150).recovered, 500);
  assert.equal(ledger.pending, 0);
  assert.equal(ledger.fees, fees);
});

test('repairing a completed queue cannot repay it twice or bank work for future failures', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, OCR_ERROR_INTERVAL, 1);
  assert.deepEqual(correctOCR(ledger, 1000), { completed: 1, recovered: 100, workUsed: 100 });
  assert.deepEqual(correctOCR(ledger, 1000), { completed: 0, recovered: 0, workUsed: 0 });
  assert.equal(ledger.repairProgress, 0);
  recordOCR(ledger, 10, 1);
  assert.deepEqual(correctOCR(ledger, 50), { completed: 0, recovered: 0, workUsed: 50 });
  assert.equal(ledger.pending, 1);
  assert.equal(correctOCR(ledger, 50).recovered, 100);
  assert.equal(ledger.corrected, 2);
});

test('fractional repair work is independent of foreground partitioning', () => {
  const whole = createOCRLedger(), split = createOCRLedger();
  recordOCR(whole, 20, 1);
  recordOCR(split, 20, 1);
  correctOCR(whole, 137.5);
  for (let i = 0; i < 550; i++) correctOCR(split, .25);
  assert.deepEqual(split, whole);
});

test('new deliveries keep a partially repaired head stable even after a source version changes', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 10, 1, { version: 1 });
  correctOCR(ledger, 10);
  const saved = nextOCRError(ledger);
  recordOCR(ledger, 20, 1, { version: OFFICE_DATA_VERSION });
  assert.deepEqual(nextOCRError(ledger), saved);
  assert.equal(ledger.repairProgress, 10);
  correctOCR(ledger, 90);
  assert.equal(nextOCRError(ledger).version, OFFICE_DATA_VERSION);
});

test('deterministic paper corrections vary all five fields and remain ASCII', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 100, 1);
  const fields = new Set();
  for (let n = 0; n < 10; n++) {
    const correction = nextOCRError(ledger);
    fields.add(correction.field);
    assert.deepEqual(correction.order, officeOrderAt(correction.index, correction.version));
    assert.equal(correction.correctValue, String(correction.order[correction.field]));
    assert.notEqual(correction.ocrValue, correction.correctValue);
    assert.match(correction.correctValue, /^[\x20-\x7e]+$/);
    assert.match(correction.ocrValue, /^[\x20-\x7e]+$/);
    assert.equal(correction.fieldLabel.length > 0, true);
    assert.deepEqual(nextOCRError(normalizeOCRLedger(JSON.parse(JSON.stringify(ledger)))) , correction);
    correctOCR(ledger, 100);
  }
  assert.deepEqual(fields, new Set(['quantity', 'price', 'product', 'date', 'id']));
});

test('huge offline processing uses nine bounded quote buckets and finite small save data', () => {
  const ledger = createOCRLedger();
  for (const rate of [1, 2, 3, 5, 8, 12, 18, 24, 30]) {
    const result = recordOCR(ledger, 1e250, rate);
    for (const value of Object.values(result)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1e250);
  }
  assert.equal(ledger.buckets.length, 9);
  assert.ok(JSON.stringify(ledger).length < 5000);
  for (const value of Object.values(ledger).filter(value => typeof value === 'number')) assert.ok(Number.isFinite(value) && value <= 1e250);
  assert.ok(nextOCRError(ledger));
  const result = correctOCR(ledger, 1e250);
  for (const value of Object.values(result)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1e250);
  assert.ok(JSON.stringify(ledger).length < 5000);
});

test('old missing or foreign ledgers normalize to empty and malformed values cannot create claims', () => {
  for (const raw of [undefined, null, false, 1, [], {}, { version: 99, buckets: [{ rate: 1, count: 1e250 }] }]) assert.deepEqual(normalizeOCRLedger(raw), createOCRLedger());
  const ledger = normalizeOCRLedger({ version: 1, fraction: -1, repairProgress: Infinity, fees: '1000', pending: 99999, pendingReward: 1e250,
    buckets: [null, { rate: 1, count: -1 }, { rate: Infinity, count: 3 }, { rate: '2', count: 3 }, { rate: 2, count: NaN }, { rate: 31, count: 10 }] });
  assert.deepEqual(ledger, createOCRLedger());
  for (const bad of [NaN, Infinity, -1, '10']) {
    assert.deepEqual(recordOCR(ledger, bad, 1), { errors: 0, cancelled: 0, fee: 0, deduction: 0 });
    assert.deepEqual(correctOCR(ledger, bad), { completed: 0, recovered: 0, workUsed: 0 });
  }
});

test('normalization derives claims from bounded FIFO buckets instead of trusting imported totals', () => {
  const ledger = normalizeOCRLedger({ version: 1, pending: 1e250, pendingReward: 1e250, buckets: [{ count: 2, rate: 3, version: 1, cursor: 1283 }] });
  assert.equal(ledger.pending, 2);
  assert.equal(ledger.pendingReward, 600);
  assert.equal(nextOCRError(ledger).cursor, 3);
  assert.equal(correctOCR(ledger, 1e9).recovered, 600);
  assert.equal(correctOCR(ledger, 1e9).recovered, 0);
});

test('a compact correction reference restores the same field after new OCR deliveries and reload', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 10, 1);
  const original = nextOCRError(ledger);
  const reference = Object.fromEntries(['index', 'version', 'fieldIndex', 'rate', 'cursor'].map(key => [key, original[key]]));
  const saved = JSON.stringify(reference);
  assert.ok(saved.length < 100);
  recordOCR(ledger, 100, 2);
  assert.deepEqual(ocrErrorFor(JSON.parse(saved)), original);
  assert.deepEqual(ocrErrorFor(reference), nextOCRError(normalizeOCRLedger(JSON.parse(JSON.stringify(ledger)))));
  assert.deepEqual(ocrErrorFor({ ...reference, correctValue: 'injected answer', ocrValue: 'other text', field: 'price', reward: 1e250 }), original);
});

test('saved correction references restore old source data rather than replacing it with the current receipt', () => {
  const ledger = createOCRLedger();
  recordOCR(ledger, 20, 3, { version: 1 });
  const original = nextOCRError(ledger);
  const { index, version, fieldIndex, rate, cursor } = original;
  const restored = ocrErrorFor(JSON.parse(JSON.stringify({ index, version, fieldIndex, rate, cursor })));
  assert.deepEqual(restored, original);
  assert.deepEqual(restored.order, officeOrderAt(index, 1));
  assert.notDeepEqual(restored.order, officeOrderAt(index, OFFICE_DATA_VERSION));
});

test('foreign or malformed correction references cannot supply arbitrary answers or invalid receipts', () => {
  const valid = { index: 9, version: OFFICE_DATA_VERSION, fieldIndex: 3, rate: 1, cursor: 0 };
  assert.ok(ocrErrorFor(valid));
  for (const invalid of [null, undefined, false, {}, [], { ...valid, index: -1 }, { ...valid, index: OFFICE_PROMPT_COUNT }, { ...valid, index: 1.5 },
    { ...valid, version: 0 }, { ...valid, version: OFFICE_DATA_VERSION + 1 }, { ...valid, version: '1' },
    { ...valid, fieldIndex: -1 }, { ...valid, fieldIndex: 5 }, { ...valid, fieldIndex: 1.5 },
    { ...valid, rate: 4 }, { ...valid, rate: Infinity }, { ...valid, rate: '1' },
    { ...valid, cursor: -1 }, { ...valid, cursor: OFFICE_PROMPT_COUNT * 5 }, { ...valid, cursor: 1.5 },
    { ...valid, cursor: NaN }, { ...valid, cursor: undefined }]) assert.equal(ocrErrorFor(invalid), null);
});
