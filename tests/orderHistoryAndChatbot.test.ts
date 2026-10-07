import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToUser } from '../src/utils/orderOwnership.ts';
import { getConfiguredAnswer } from '../src/data/chatbotAnswers.ts';

test('account orders survive changed delivery details and reject other accounts', () => {
  const user = { id: 'local', supabaseUserId: 'account', email: 'new@example.test' };
  assert.equal(belongsToUser({ customerId: 'account', email: 'old@example.test' }, user), true);
  assert.equal(belongsToUser({ customerId: 'other', email: user.email }, user), false);
  assert.equal(belongsToUser({ email: 'NEW@example.test' }, user), true);
  assert.equal(belongsToUser({}, user), false);
  assert.equal(belongsToUser({ customerId: 'account' }, null), false);
});

test('simple answers reflect current site settings without AI', () => {
  assert.match(getConfiguredAnswer({ work_hours: '10–18' }, 'ажиллах цаг')!, /10–18/);
  assert.match(getConfiguredAnswer({ store_phone: '12345678' }, 'утас')!, /12345678/);
  assert.match(getConfiguredAnswer({ bank_accounts: { accountNumber: '987654' } }, 'данс')!, /987654/);
  assert.match(getConfiguredAnswer({ delivery_fee: 7500, rules: { free_delivery_enabled: false } }, 'хүргэлт')!, /идэвхгүй/);
  assert.match(getConfiguredAnswer({}, 'hi')!, /Сайн байна уу/);
  assert.equal(getConfiguredAnswer({}, 'админтай холбоо барих'), null);
});

test('product answers show availability without exact stock and exclude unpublished items', () => {
  const product = { name: 'Алим', price: 5000, stock: 3, published: true };
  const answer = getConfiguredAnswer({ products: [product] }, 'алим хэд вэ')!;
  assert.match(answer, /Бэлэн байгаа/);
  assert.doesNotMatch(answer, /3 ш/);
  assert.match(getConfiguredAnswer({ products: [{ ...product, stock: 0 }] }, 'алим хэд вэ')!, /дууссан/);
  assert.equal(getConfiguredAnswer({ products: [{ ...product, published: false }] }, 'алим хэд вэ'), null);
});
