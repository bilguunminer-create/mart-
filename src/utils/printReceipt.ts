import { OrderDetails } from '../types';
import { formatMNT } from '../data/storeData';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Prints a single order's receipt in its own popup window, containing only the
// receipt itself, never the surrounding page the button was clicked from.
export function printOrderReceipt(order: OrderDetails): void {
  if (order.paymentStatus !== 'Төлбөр баталгаажсан') return;
  const rows = order.items.map((item) =>
    '<tr><td>' + escapeHtml(item.name) + ' × ' + item.quantity + '</td><td style="text-align:right">' + formatMNT(item.price * item.quantity) + '</td></tr>'
  ).join('');
  const receiptWindow = window.open('', '_blank', 'width=420,height=720');
  if (!receiptWindow) return;
  receiptWindow.document.write(
    '<!doctype html><html><head><title>Захиалгын баримт</title><style>body{font-family:Arial,sans-serif;color:#18181b;padding:24px;max-width:360px;margin:auto}h1{font-size:20px;margin:0 0 4px}p{font-size:12px;margin:6px 0}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}td{padding:7px 0;border-bottom:1px solid #ddd}.total{font-size:18px;font-weight:800;text-align:right;margin-top:12px}.ok{color:#047857;font-weight:700}@media print{body{padding:0}}</style></head><body>'
    + '<h1>US&K Family Mart</h1>'
    + '<p>Захиалгын баримт · #' + escapeHtml(order.orderId) + '</p>'
    + '<p>Огноо: ' + escapeHtml(order.date) + '</p>'
    + '<p>Харилцагч: ' + escapeHtml(order.customerName) + ' · ' + escapeHtml(order.phone) + '</p>'
    + '<p class="ok">Төлбөр баталгаажсан</p>'
    + '<table>' + rows + '</table>'
    + '<p>Хүргэлт: ' + (order.deliveryFee === 0 ? 'ҮНЭГҮЙ' : formatMNT(order.deliveryFee)) + '</p>'
    + '<p class="total">Нийт: ' + formatMNT(order.total) + '</p>'
    + '<p>Баярлалаа.</p>'
    + '</body></html>'
  );
  receiptWindow.document.close();
  receiptWindow.focus();
  receiptWindow.print();
}
