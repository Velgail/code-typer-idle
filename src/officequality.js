import { OFFICE_DATA_VERSION, OFFICE_PROMPT_COUNT, officeOrderAt } from './office.js';

// The client has already paid every completed order. A failed OCR delivery
// cancels its whole payment and charges a 20% resubmission fee. Correcting it
// restores the payment once; it never refunds that fee.
export const OCR_ERROR_INTERVAL = 10;
export const OCR_REPAIR_WORK = 100;
export const OCR_RESUBMISSION_FEE = .2;
const LIMIT = 1e250, EPSILON = 1e-9, MAX_BUCKETS = 64;
const ACCEPTED_RATES = [1, 2, 3, 5, 8, 12, 18, 24, 30];
const CURSOR_PERIOD = OFFICE_PROMPT_COUNT * 5;
const FIELDS = ['id', 'date', 'product', 'quantity', 'price'];
const LABELS = ['伝票番号', '発行日', '品名', '数量', '単価'];
const FIELD_ORDER = [3, 4, 2, 1, 0];
const amount = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(LIMIT, value)) : 0;
const add = (a, b) => Math.min(LIMIT, a + b);
const multiply = (a, b) => Math.min(LIMIT, a * b);
const cursorAt = value => Math.floor(amount(value)) % CURSOR_PERIOD;
const dataVersion = value => Number.isSafeInteger(value) && value >= 1 && value <= OFFICE_DATA_VERSION ? value : OFFICE_DATA_VERSION;
const remainder = value => Math.round(Math.max(0, value) * 1e12) / 1e12;
const noRecord = () => ({ errors: 0, cancelled: 0, fee: 0, deduction: 0 });
const noCorrection = () => ({ completed: 0, recovered: 0, workUsed: 0 });

export function createOCRLedger() {
  return { version: 1, fraction: 0, cursor: 0, repairProgress: 0, buckets: [], pending: 0, pendingReward: 0, failures: 0, corrected: 0, fees: 0 };
}

function summarize(ledger) {
  ledger.pending = 0;
  ledger.pendingReward = 0;
  for (const bucket of ledger.buckets) {
    ledger.pending = add(ledger.pending, bucket.count);
    ledger.pendingReward = add(ledger.pendingReward, multiply(bucket.count, OCR_REPAIR_WORK * bucket.rate));
  }
  if (!ledger.pending) ledger.repairProgress = 0;
  return ledger;
}

export function normalizeOCRLedger(raw) {
  const ledger = createOCRLedger();
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return ledger;
  ledger.fraction = amount(raw.fraction) % OCR_ERROR_INTERVAL;
  ledger.cursor = cursorAt(raw.cursor);
  ledger.repairProgress = amount(raw.repairProgress) % OCR_REPAIR_WORK;
  ledger.failures = Math.floor(amount(raw.failures));
  ledger.corrected = Math.floor(amount(raw.corrected));
  ledger.fees = amount(raw.fees);
  // Normal play needs at most nine rate buckets (plus a data-version boundary).
  // Bound imported arrays as well, so neither saves nor repair loops can grow
  // with the number of invoices processed during a long offline interval.
  if (Array.isArray(raw.buckets)) for (const item of raw.buckets.slice(0, MAX_BUCKETS)) {
    if (!item || typeof item !== 'object') continue;
    const count = Math.floor(amount(item.count));
    const rate = ACCEPTED_RATES.includes(item.rate) ? item.rate : 0;
    if (!count || !rate) continue;
    const version = dataVersion(item.version), last = ledger.buckets.at(-1);
    // Project rates and paper versions advance independently, but neither can
    // run backwards. This also makes a malformed imported queue harmless.
    if (last && (rate < last.rate || version < last.version)) continue;
    if (last && rate === last.rate && version === last.version) last.count = add(last.count, count);
    else ledger.buckets.push({ count, rate, version, cursor: cursorAt(item.cursor) });
  }
  return summarize(ledger);
}

/** Record automatically completed order equivalents. Cash is changed by core. */
export function recordOCR(ledger, equivalentOrders, acceptedRate, { version = OFFICE_DATA_VERSION } = {}) {
  if (!ledger || !Array.isArray(ledger.buckets)) return noRecord();
  const equivalent = amount(equivalentOrders);
  if (!equivalent || !ACCEPTED_RATES.includes(acceptedRate)) return noRecord();
  const invoiceVersion = dataVersion(version), last = ledger.buckets.at(-1);
  if (last && (acceptedRate < last.rate || invoiceVersion < last.version)) return noRecord();
  const total = add(ledger.fraction, equivalent);
  const errors = Math.floor((total + EPSILON) / OCR_ERROR_INTERVAL);
  ledger.fraction = remainder(total - errors * OCR_ERROR_INTERVAL);
  if (!errors) return noRecord();
  if (last && last.rate === acceptedRate && last.version === invoiceVersion) last.count = add(last.count, errors);
  else {
    // Nine rates and monotonically increasing source versions bound the queue
    // independently of the number of orders or the offline duration.
    ledger.buckets.push({ count: errors, rate: acceptedRate, version: invoiceVersion, cursor: ledger.cursor });
  }
  ledger.cursor = cursorAt(ledger.cursor + errors % CURSOR_PERIOD);
  ledger.failures = add(ledger.failures, errors);
  const cancelled = multiply(errors, OCR_REPAIR_WORK * acceptedRate);
  const fee = multiply(errors, OCR_REPAIR_WORK * acceptedRate * OCR_RESUBMISSION_FEE);
  ledger.fees = add(ledger.fees, fee);
  summarize(ledger);
  return { errors, cancelled, fee, deduction: add(cancelled, fee) };
}

/** Apply repair work to the oldest orders; excess work cannot be banked. */
export function correctOCR(ledger, work) {
  if (!ledger || !Array.isArray(ledger.buckets)) return noCorrection();
  const effort = amount(work);
  if (!effort || !ledger.buckets.length) {
    if (!ledger.buckets.length) ledger.repairProgress = 0;
    return noCorrection();
  }
  const previousProgress = ledger.repairProgress;
  const total = add(previousProgress, effort);
  let remaining = Math.floor((total + EPSILON) / OCR_REPAIR_WORK), completed = 0, recovered = 0;
  while (remaining && ledger.buckets.length) {
    const bucket = ledger.buckets[0], count = Math.min(remaining, bucket.count);
    completed = add(completed, count);
    recovered = add(recovered, multiply(count, OCR_REPAIR_WORK * bucket.rate));
    remaining -= count;
    bucket.count -= count;
    bucket.cursor = cursorAt(bucket.cursor + count % CURSOR_PERIOD);
    if (!bucket.count) ledger.buckets.shift();
  }
  ledger.corrected = add(ledger.corrected, completed);
  ledger.repairProgress = ledger.buckets.length ? remainder(total - completed * OCR_REPAIR_WORK) : 0;
  const workUsed = ledger.buckets.length ? effort : Math.min(effort, Math.max(0, multiply(completed, OCR_REPAIR_WORK) - previousProgress));
  summarize(ledger);
  return { completed, recovered, workUsed };
}

function misread(value) {
  const confusions = { '0': 'O', '1': 'I', '2': 'Z', '3': '8', '4': '9', '5': 'S', '6': '0', '7': '1', '8': 'B', '9': '4', O: '0', I: '1', S: '5', B: '8', Z: '2', L: '1' };
  return String(value).replace(/[0-9OISBZL]/, character => confusions[character]);
}

/** Rebuild a saved correction without trusting imported answer strings. */
export function ocrErrorFor(reference) {
  if (!reference || typeof reference !== 'object') return null;
  const { index, version, fieldIndex, rate, cursor } = reference;
  if (!Number.isInteger(index) || index < 0 || index >= OFFICE_PROMPT_COUNT
    || !Number.isInteger(version) || version < 1 || version > OFFICE_DATA_VERSION
    || !Number.isInteger(fieldIndex) || fieldIndex < 0 || fieldIndex >= FIELDS.length
    || !ACCEPTED_RATES.includes(rate)
    || !Number.isInteger(cursor) || cursor < 0 || cursor >= CURSOR_PERIOD) return null;
  const field = FIELDS[fieldIndex], order = officeOrderAt(index, version), correctValue = String(order[field]);
  return {
    id: `${rate}:${version}:${cursor}`,
    order, index, version, cursor, field, fieldIndex, fieldLabel: LABELS[fieldIndex],
    correctValue, ocrValue: misread(correctValue), rate,
    reward: OCR_REPAIR_WORK * rate, fee: OCR_REPAIR_WORK * rate * OCR_RESUBMISSION_FEE
  };
}

/** A stable paper source and one misread field for the oldest unpaid order. */
export function nextOCRError(ledger) {
  const bucket = ledger?.buckets?.[0];
  if (!bucket || !(bucket.count > 0)) return null;
  return ocrErrorFor({
    index: (bucket.cursor * OCR_ERROR_INTERVAL + OCR_ERROR_INTERVAL - 1) % OFFICE_PROMPT_COUNT,
    version: bucket.version, fieldIndex: FIELD_ORDER[bucket.cursor % FIELDS.length],
    rate: bucket.rate, cursor: bucket.cursor
  });
}
