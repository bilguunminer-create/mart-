import type { LoyaltyTier } from '../types.ts';

export function getLoyaltyProgress(totalSpent: number, tiers: LoyaltyTier[], currentTier: LoyaltyTier | null) {
  const floor = Math.max(totalSpent, currentTier?.threshold ?? 0);
  const nextTier = [...tiers].sort((a, b) => a.threshold - b.threshold)
    .find(tier => tier.threshold > floor) ?? null;
  return { nextTier, remaining: nextTier ? Math.max(0, nextTier.threshold - totalSpent) : 0 };
}
