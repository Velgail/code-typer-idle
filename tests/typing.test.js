import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, input, handPower, serialize, deserialize } from '../src/core.js';
import { LANGUAGES, SUBJECT_IDS, TEMPLATE_COUNT, PROMPT_COUNT, promptAt, currentPrompt, acceptCharacter, TYPING_REWARD } from '../src/typing.js';
import { OFFICE_PROMPT_COUNT, officeOrderAt } from '../src/office.js';

test('the embedded curriculum contains 2,048 distinct prompts across eight languages and four subjects', () => {
  const prompts = new Set();
  assert.equal(LANGUAGES.length, 8); assert.equal(TEMPLATE_COUNT, 128); assert.equal(PROMPT_COUNT, 2048);
  for (const language of LANGUAGES) for (const subject of SUBJECT_IDS) {
    for (let index = 0; index < 64; index++) {
      const prompt = promptAt(language.id, subject, index);
      assert.ok(prompt.length >= 40 && prompt.length < 2000);
      assert.ok(!/\$\w+\$/.test(prompt));
      assert.ok(/^[\x09\x0a\x20-\x7e]+$/.test(prompt));
      prompts.add(prompt);
    }
  }
  assert.equal(prompts.size, PROMPT_COUNT);
});
test('wrong characters neither advance the cursor nor generate completion rewards', () => {
  const s = createState(); const text = currentPrompt(s);
  const wrong = text[0] === 'x' ? 'y' : 'x';
  assert.deepEqual(acceptCharacter(s, wrong), { correct: false, complete: false, bonus: 0 });
  assert.equal(s.typing.offset, 0); assert.equal(s.typing.errors, 1); assert.equal(s.cash, 100);
  assert.equal(acceptCharacter(s, text[0]).correct, true);
  assert.equal(s.typing.offset, 1);
});
test('administrative work normalizes image invoice fields, independent of programming language', () => {
  const targets = new Set();
  for (let i = 0; i < OFFICE_PROMPT_COUNT; i++) {
    const order = officeOrderAt(i);
    assert.deepEqual(order.input.split(','), [order.id, order.date, order.product, String(order.quantity), String(order.price)]);
    assert.match(order.sourceDate, /^2026年\d{1,2}月\d{1,2}日$/);
    assert.match(order.date, /^2026-\d{2}-\d{2}$/);
    targets.add(order.input);
  }
  assert.equal(targets.size, OFFICE_PROMPT_COUNT);
  const s = createState(), text = currentPrompt(s);
  assert.equal(text, officeOrderAt(0).input);
  acceptCharacter(s, text[0]);
  s.typing.language = 'rust';
  assert.equal(currentPrompt(s), text); assert.equal(s.typing.offset, 1);
  s.mode = 'study';
  assert.equal(currentPrompt(s), promptAt('rust', 'syntax', 0));
  assert.equal(s.typing.offset, 0);
});
test('a perfect prompt pays 1.5 times the equivalent click work including its completion bonus', () => {
  const s = createState(), text = currentPrompt(s), cash = s.cash;
  for (const char of text) {
    const p = handPower(s), result = acceptCharacter(s, char, p);
    assert.equal(result.correct, true);
    input(s, { chars: p * TYPING_REWARD.character });
    if (result.complete) input(s, { chars: result.bonus, countManual: false });
  }
  assert.equal(s.cash - cash + s.job.progress * s.job.rate, text.length * 1.5);
  assert.equal(s.typing.completed, 1); assert.equal(s.typing.offset, 0);
  assert.equal(s.stats.manual, text.length);
});
test('errors reduce the completion bonus, and an unfinished prompt never grants it', () => {
  const clean = createState(), imperfect = createState(), text = currentPrompt(clean);
  acceptCharacter(imperfect, '!');
  let cleanBonus = 0, imperfectBonus = 0;
  for (const char of text) { cleanBonus += acceptCharacter(clean, char).bonus; imperfectBonus += acceptCharacter(imperfect, char).bonus; }
  assert.ok(imperfectBonus < cleanBonus);
  const unfinished = createState();
  for (const char of text.slice(0, -1)) assert.equal(acceptCharacter(unfinished, char).bonus, 0);
});
test('switching work context discards pending bonuses and typing cursors survive saves', () => {
  const s = createState(), text = currentPrompt(s);
  for (const char of text.slice(0, 10)) acceptCharacter(s, char, 2);
  s.inputStyle = 'typing';
  const loaded = deserialize(serialize(s));
  assert.equal(currentPrompt(loaded), text); assert.equal(loaded.typing.offset, 10); assert.equal(loaded.typing.bonusBase, 20);
  loaded.mode = 'study'; currentPrompt(loaded);
  assert.equal(loaded.typing.offset, 0); assert.equal(loaded.typing.bonusBase, 0);
});
