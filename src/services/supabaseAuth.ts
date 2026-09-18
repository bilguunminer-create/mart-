const SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6cFfPZrw3hfRy-RqefprLQ_c94gv3Ik';

type AuthSession = { access_token: string; user: { id: string; email?: string; email_confirmed_at?: string | null } };
type Profile = { name: string; phone?: string; address?: string };

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(SUPABASE_URL + path, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.error_description || data.message || 'Хүсэлт амжилтгүй боллоо.');
  return data as T;
}

export async function signUp(email: string, password: string, profile: Profile) {
  return request<{ user: AuthSession['user']; session: AuthSession | null }>('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { name: profile.name }, options: { emailRedirectTo: window.location.origin } }),
  });
}

export async function signIn(email: string, password: string) {
  return request<AuthSession>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function sendPasswordReset(email: string) {
  return request('/auth/v1/recover', {
    method: 'POST',
    body: JSON.stringify({ email, redirect_to: window.location.origin }),
  });
}

export async function getProfile(token: string, userId: string) {
  const rows = await request<Array<{ name: string; phone: string; address: string }>>(
    `/rest/v1/customer_profiles?user_id=eq.${encodeURIComponent(userId)}&select=name,phone,address`,
    { method: 'GET' },
    token,
  );
  return rows[0] || null;
}

export async function saveProfile(token: string, userId: string, profile: Profile) {
  await request('/rest/v1/customer_profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, name: profile.name, phone: profile.phone || '', address: profile.address || '' }),
  }, token);
}

export async function updatePassword(token: string, password: string) {
  await request('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) }, token);
}

export async function saveStoreOrder(token: string, order: {
  customerName: string; phone: string; address: string; notes: string;
  total: number; items: Array<{ id: string; quantity: number }>;
}) {
  const payload = {
    requestId: crypto.randomUUID(),
    expectedTotal: Math.round(order.total),
    name: order.customerName,
    phone: order.phone.replace(/\D/g, '').slice(-8),
    address: order.address,
    note: order.notes || '',
    items: order.items.map(item => ({ productId: item.id, quantity: item.quantity })),
  };
  return request('/rest/v1/rpc/store_checkout', {
    method: 'POST',
    body: JSON.stringify({ payload, save_order: true }),
  }, token);
}
