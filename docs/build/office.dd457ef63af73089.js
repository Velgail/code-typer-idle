// Paper invoices are the source; the job is to normalize their fields as CSV.
// Code exercises belong to study/development, not these administrative jobs.
export const OFFICE_PROMPT_COUNT = 256;
export const OFFICE_DATA_VERSION = 2;
// Name, list price in yen, sales unit, and plausible order quantities.
const PRODUCTS = [
  ['USB CABLE', 680, '本', [1, 2, 3, 5, 10, 20]],
  ['DESK LAMP', 3280, '台', [1, 1, 2, 3, 4]],
  ['COPY PAPER', 480, '冊', [1, 2, 5, 10, 20]],
  ['BLACK INK', 1480, '個', [1, 2, 3, 5, 10]],
  ['FILE BOX', 380, '個', [2, 3, 5, 10, 20]],
  ['NOTE BOOK', 180, '冊', [3, 5, 10, 20, 30]],
  ['LAN CABLE', 980, '本', [1, 2, 3, 5, 10, 15]],
  ['DESK MAT', 1580, '枚', [1, 1, 2, 3, 5]],
  ['CARD CASE', 420, '個', [1, 2, 5, 10, 20]],
  ['PEN STAND', 580, '個', [1, 2, 3, 5, 10]],
  ['LABEL TAPE', 1080, '巻', [1, 2, 3, 5, 10]],
  ['MOUSE PAD', 880, '枚', [1, 2, 3, 5, 10]],
  ['LETTER FILE', 240, '冊', [2, 5, 10, 20, 30]],
  ['PAPER CLIP', 160, '箱', [1, 2, 3, 5, 10, 20]],
  ['CARD HOLDER', 680, '個', [1, 2, 5, 10, 20]],
  ['WHITE BOARD', 9800, '台', [1, 1, 1, 2, 3]]
];
function randomStream(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
const pick = (values, random) => values[Math.floor(random() * values.length)];
function makeOrders() {
  // Separate streams keep the calendar and purchasing decisions independent.
  // A fixed seed makes a receipt identical after reload or on another device.
  const calendar = randomStream(0x37c91a2b), products = randomStream(0x6a09e667), quantities = randomStream(0xbb67ae85);
  const issued = new Date('2026-01-05T00:00:00Z');
  let remainingToday = 2 + Math.floor(calendar() * 5);
  return Array.from({ length: OFFICE_PROMPT_COUNT }, (_, n) => {
    if (!remainingToday) {
      do { issued.setUTCDate(issued.getUTCDate() + 1); } while ([0, 6].includes(issued.getUTCDay()));
      remainingToday = 2 + Math.floor(calendar() * 5);
    }
    remainingToday--;
    const [product, listPrice, quantityUnit, amounts] = pick(PRODUCTS, products);
    const quantity = pick(amounts, quantities);
    // Normal catalogue prices with a small volume discount for bulk orders.
    const price = quantity >= 5 ? Math.round(listPrice * (quantity >= 10 ? 0.9 : 0.95) / 10) * 10 : listPrice;
    const id = `INV-${1001 + n}`, date = issued.toISOString().slice(0, 10);
    return Object.freeze({ id, date, sourceDate: `${issued.getUTCFullYear()}年${issued.getUTCMonth() + 1}月${issued.getUTCDate()}日`, product, quantity, quantityUnit, price,
      input: `${id},${date},${product},${quantity},${price}` });
  });
}
const ORDERS = makeOrders();
export function officeOrderAt(index, version = OFFICE_DATA_VERSION) {
  const n = Math.max(0, Math.floor(index)) % OFFICE_PROMPT_COUNT;
  if (version !== 1) return ORDERS[n];
  // Finish an already-started pre-update receipt without changing its answer.
  const id = `INV-${String(1001 + n)}`;
  const month = 1 + n % 12, day = 1 + n % 28;
  const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const product = PRODUCTS[n % PRODUCTS.length][0];
  const quantity = 1 + n % 9, price = 1200 + Math.floor(n / 16) * 150;
  return { id, date, sourceDate: `2026年${month}月${day}日`, product, quantity, quantityUnit: '個', price,
    input: `${id},${date},${product},${quantity},${price}` };
}
export function drawOfficeSource(canvas, order) {
  const ctx = canvas.getContext('2d');
  canvas.width = 640; canvas.height = 350;
  ctx.fillStyle = '#ede8db'; ctx.fillRect(0, 0, 640, 350);
  ctx.fillStyle = '#31362e'; ctx.font = 'bold 28px sans-serif';
  ctx.fillText('納品伝票 / 原票スキャン', 32, 48);
  ctx.strokeStyle = '#a29e90'; ctx.beginPath(); ctx.moveTo(32, 67); ctx.lineTo(608, 67); ctx.stroke();
  ctx.font = '23px sans-serif';
  [`伝票番号　${order.id}`, `発行日　　${order.sourceDate}`, `品名　　　${order.product}`, `数量　　　${order.quantity} ${order.quantityUnit}`, `単価　　　¥${order.price.toLocaleString('en-US')}`]
    .forEach((line, i) => ctx.fillText(line, 32, 108 + i * 46));
  canvas.setAttribute('aria-label', `原票。伝票番号 ${order.id}、発行日 ${order.sourceDate}、品名 ${order.product}、数量 ${order.quantity}${order.quantityUnit}、単価 ${order.price}円`);
}
