import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_PROMPT_COUNT, officeOrderAt, drawOfficeSource } from '../src/office.js';

const orders = Array.from({ length: OFFICE_PROMPT_COUNT }, (_, i) => officeOrderAt(i));

test('receipts use valid chronological business dates with multiple orders per day', () => {
  const dailyCounts = new Map();
  for (const [i, order] of orders.entries()) {
    assert.equal(order.id, `INV-${1001 + i}`);
    const issued = new Date(`${order.date}T00:00:00Z`);
    assert.equal(issued.toISOString().slice(0, 10), order.date);
    assert.ok(![0, 6].includes(issued.getUTCDay()));
    assert.equal(order.sourceDate, `${issued.getUTCFullYear()}年${issued.getUTCMonth() + 1}月${issued.getUTCDate()}日`);
    if (i) assert.ok(order.date >= orders[i - 1].date);
    dailyCounts.set(order.date, (dailyCounts.get(order.date) || 0) + 1);
  }
  assert.ok([...dailyCounts.values()].some(count => count > 1), 'one invoice must not force a new date');
  assert.ok(new Set(dailyCounts.values()).size > 1, 'daily order volume must vary');
  assert.ok(orders.slice(0, 12).some(o => Number(o.date.slice(5, 7)) !== Number(o.date.slice(8, 10))), 'month and day must not advance in lockstep');
});

test('product prices and quantities vary without following the invoice sequence', () => {
  assert.ok(new Set(orders.slice(0, 16).map(o => o.price)).size >= 5, 'the opening receipts must not all cost the same');
  assert.ok(new Set(orders.map(o => o.price)).size >= 16);
  assert.ok(orders.filter((o, i) => o.quantity === 1 + i % 9).length < orders.length / 2, 'quantity must not count up with the invoice ID');
  const products = Map.groupBy(orders, o => o.product);
  assert.equal(products.size, 16);
  for (const [name, receipts] of products) {
    assert.ok(new Set(receipts.map(o => o.quantity)).size > 1, name);
    for (const order of receipts) {
      assert.ok(Number.isInteger(order.price) && order.price > 0);
      assert.ok(Number.isInteger(order.quantity) && order.quantity > 0);
      assert.deepEqual(order.input.split(','), [order.id, order.date, name, String(order.quantity), String(order.price)]);
    }
  }
  assert.ok(products.get('PAPER CLIP').every(o => o.quantityUnit === '箱' && o.price <= 200));
  assert.ok(products.get('WHITE BOARD').every(o => o.quantityUnit === '台' && o.price >= 5000 && o.quantity <= 3));
});

test('receipts are identical after reloading and when queried in a different order', async () => {
  const reloaded = await import('../src/office.js?reload-test');
  for (let i = orders.length - 1; i >= 0; i--) {
    assert.deepEqual(reloaded.officeOrderAt(i), orders[i]);
    assert.deepEqual(officeOrderAt(i), orders[i]);
  }
});

test('the scanned source and accessible text contain the same fields and sales unit', () => {
  for (const order of orders) {
    const lines = [], attrs = {};
    const context = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText(text) { lines.push(text); } };
    drawOfficeSource({ getContext: () => context, setAttribute(name, value) { attrs[name] = value; } }, order);
    assert.ok(lines.includes(`数量　　　${order.quantity} ${order.quantityUnit}`));
    assert.ok(lines.includes(`単価　　　¥${order.price.toLocaleString('en-US')}`));
    for (const field of [order.id, order.sourceDate, order.product, `${order.quantity}${order.quantityUnit}`, `${order.price}円`]) assert.ok(attrs['aria-label'].includes(field));
  }
});
