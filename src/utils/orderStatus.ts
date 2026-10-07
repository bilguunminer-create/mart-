import type { OrderDetails } from '../types';

export function getCustomerOrderStatusLabel(
  order: Pick<OrderDetails, 'status' | 'paymentStatus'>,
): string {
  // Fulfilment and cancellation take precedence over payment confirmation.
  switch (order.status) {
    case 'cancelled': return 'Цуцлагдсан';
    case 'delivered': return 'Хүргэгдсэн';
    case 'shipping': return 'Хүргэлтэд гарсан';
    case 'confirmed': return 'Захиалга баталгаажсан';
    default:
      return order.paymentStatus === 'Төлбөр баталгаажсан'
        ? 'Төлбөр баталгаажсан'
        : 'Төлбөр хүлээж байна';
  }
}
