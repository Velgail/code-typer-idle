// Paper invoices are the source; the job is to normalize their fields as CSV.
// Code exercises belong to study/development, not these administrative jobs.
export const OFFICE_PROMPT_COUNT = 256;
const PRODUCTS = ['USB CABLE', 'DESK LAMP', 'COPY PAPER', 'BLACK INK', 'FILE BOX', 'NOTE BOOK', 'LAN CABLE', 'DESK MAT', 'CARD CASE', 'PEN STAND', 'LABEL TAPE', 'MOUSE PAD', 'LETTER FILE', 'PAPER CLIP', 'CARD HOLDER', 'WHITE BOARD'];
export function officeOrderAt(index) {
  const n = Math.max(0, Math.floor(index)) % OFFICE_PROMPT_COUNT;
  const id = `INV-${String(1001 + n)}`;
  const month = 1 + n % 12, day = 1 + n % 28;
  const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const product = PRODUCTS[n % PRODUCTS.length];
  const quantity = 1 + n % 9, price = 1200 + Math.floor(n / 16) * 150;
  return { id, date, sourceDate: `2026年${month}月${day}日`, product, quantity, price,
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
  [`伝票番号　${order.id}`, `発行日　　${order.sourceDate}`, `品名　　　${order.product}`, `数量　　　${order.quantity} 個`, `単価　　　¥${order.price.toLocaleString('en-US')}`]
    .forEach((line, i) => ctx.fillText(line, 32, 108 + i * 46));
  canvas.setAttribute('aria-label', `原票。伝票番号 ${order.id}、発行日 ${order.sourceDate}、品名 ${order.product}、数量 ${order.quantity}個、単価 ${order.price}円`);
}
