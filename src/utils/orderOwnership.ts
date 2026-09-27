import type { OrderDetails, UserProfile } from '../types.ts';

export function belongsToUser(order: Pick<OrderDetails, 'customerId' | 'email'>, user: Pick<UserProfile, 'id' | 'supabaseUserId' | 'email'> | null): boolean {
  if (!user) return false;
  if (order.customerId) return order.customerId === (user.supabaseUserId || user.id);
  // Legacy local orders may lack an account ID. Shared delivery phones are not ownership.
  return Boolean(user.email?.trim() && order.email?.trim().toLowerCase() === user.email.trim().toLowerCase());
}
