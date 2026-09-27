import test from 'node:test';
import assert from 'node:assert/strict';
import { getLoyaltyProgress } from '../src/utils/loyaltyProgress.ts';
import { belongsToUser } from '../src/utils/orderOwnership.ts';
import type { LoyaltyTier } from '../src/types.ts';

const tiers = [
  { id: 'bronze', threshold: 500000 },
  { id: 'silver', threshold: 1000000 },
  { id: 'gold', threshold: 2000000 },
] as LoyaltyTier[];

test('gold never suggests bronze, including manual tier assignments', () => {
  assert.equal(getLoyaltyProgress(0, tiers, tiers[2]).nextTier, null);
  assert.equal(getLoyaltyProgress(2100000, tiers, tiers[2]).nextTier, null);
});
test('shows next configured tier and actual spending gap', () => {
  const result = getLoyaltyProgress(700000, [...tiers].reverse(), tiers[0]);
  assert.equal(result.nextTier?.id, 'silver');
  assert.equal(result.remaining, 300000);
  const platinum = { id: 'platinum', threshold: 3000000 } as LoyaltyTier;
  assert.equal(getLoyaltyProgress(2400000, [...tiers, platinum], tiers[2]).remaining, 600000);
});
test('exact threshold advances to the next tier', () => {
  assert.equal(getLoyaltyProgress(1000000, tiers, tiers[0]).nextTier?.id, 'gold');
});
test('VIP spend includes account purchases despite changed delivery contact', () => {
  const user = { id: 'account', email: 'new@example.test' };
  const orders = [
    { customerId: 'account', email: 'old@example.test', total: 2100000, status: 'delivered' },
    { customerId: 'other', email: user.email, total: 9000000, status: 'delivered' },
    { customerId: 'account', total: 500000, status: 'cancelled' },
  ];
  const spent = orders.filter(order => belongsToUser(order, user) && order.status === 'delivered').reduce((sum, order) => sum + order.total, 0);
  assert.equal(spent, 2100000);
  assert.equal(getLoyaltyProgress(spent, tiers, tiers[2]).nextTier, null);
});
