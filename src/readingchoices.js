// Wrong options are authored models of a particular misreading of the shown
// code. Never fabricate nearby numbers to fill a fixed number of buttons.
import { sharedReadingDistractors } from './readingchoices/shared.js';
import { idiomReadingDistractors } from './readingchoices/idioms.js';
import { sqlReadingDistractors } from './readingchoices/sql.js';

export function isReadingChoice(value) {
  return (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) || value === null || value === 'runtime-error' || value === 'compile-error';
}

export function readingChoiceLabel(value) {
  return value === null ? 'NULL' : value === 'runtime-error' ? '実行時エラー' : value === 'compile-error' ? 'コンパイルエラー' : String(value);
}

export function authoredReadingOptions(lesson, variant, rows) {
  const candidates = lesson.language === 'sql'
    ? sqlReadingDistractors(lesson, variant, rows)
    : sharedReadingDistractors(lesson, variant) ?? idiomReadingDistractors(lesson, variant);
  if (!Array.isArray(candidates)) throw new RangeError(`Missing reading-choice models: ${lesson.baseId}`);
  const options = [{value:lesson.answer, correct:true, reason:null, misconception:null}];
  const values = new Set([lesson.answer]);
  for (const candidate of candidates) {
    if (!isReadingChoice(candidate.value) || typeof candidate.reason !== 'string' || !candidate.reason.trim() || typeof candidate.misconception !== 'string' || !candidate.misconception.trim()) {
      throw new TypeError(`Invalid reading-choice model: ${lesson.id}`);
    }
    if (values.has(candidate.value)) continue;
    values.add(candidate.value);
    options.push({...candidate, correct:false});
  }
  if (options.length < 2) throw new RangeError(`No distinct misconception for reading question: ${lesson.id}`);
  return options.slice(0, 4);
}
