import test from 'node:test';
import assert from 'node:assert/strict';
import { getCustomerOrderStatusLabel } from '../src/utils/orderStatus.ts';

test('payment confirmation is visible before fulfilment advances', () => {
  assert.equal(getCustomerOrderStatusLabel({ status: 'new' }), 'Төлбөр хүлээж байна');
  assert.equal(getCustomerOrderStatusLabel({
    status: 'new', paymentStatus: 'Төлбөр баталгаажсан',
  }), 'Төлбөр баталгаажсан');
  assert.equal(getCustomerOrderStatusLabel({
    paymentStatus: 'Төлбөр баталгаажсан',
  }), 'Төлбөр баталгаажсан');
});

test('fulfilment and cancellation remain visible after payment', () => {
  for (const [status, label] of [
    ['confirmed', 'Захиалга баталгаажсан'],
    ['shipping', 'Хүргэлтэд гарсан'],
    ['delivered', 'Хүргэгдсэн'],
    ['cancelled', 'Цуцлагдсан'],
  ] as const) {
    assert.equal(getCustomerOrderStatusLabel({
      status, paymentStatus: 'Төлбөр баталгаажсан',
    }), label);
  }
});
