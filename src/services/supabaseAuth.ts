const SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6cFfPZrw3hfRy-RqefprLQ_c94gv3Ik';
const APP_URL = 'https://uskmart.vercel.app';

export type AuthSession = { access_token: string; user: { id: string; email?: string; email_confirmed_at?: string | null } };
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

function temporaryPassword() {
  return crypto.randomUUID();
}

/** Creates a pending account. Supabase sends the confirmation OTP configured in its email template. */
export async function requestSignupOtp(email: string, profile: Profile) {
  return request<{ user: AuthSession['user']; session: AuthSession | null }>('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: temporaryPassword(),
      data: { name: profile.name },
      options: { emailRedirectTo: APP_URL },
    }),
  });
}

/** Exchanges the six-digit confirmation token for an authenticated session. */
export async function verifySignupOtp(email: string, token: string) {
  return request<AuthSession>('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ email, token, type: 'signup' }),
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
    body: JSON.stringify({ email, redirect_to: APP_URL }),
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
    body: JSON.stringify({ user_id: userId, name: profile.name, phone: (profile.phone || '').replace(/\\D/g, '').slice(-8), address: profile.address || '' }),
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


export type StoreCustomerProfile = {
  user_id: string; name: string; phone: string; address: string; created_at?: string;
};

export type StoreOrderRecord = {
  id: string; customer_id: string; customer_name: string; phone: string; address: string;
  note: string; items: Array<{ productId: string; title: string; quantity: number; price: number }>;
  subtotal: number; daily_discount: number; vip_discount: number; delivery_fee: number;
  total: number; created_at: string; status: string;
};

export async function getStoreOrders(token: string) {
  return request<StoreOrderRecord[]>(
    '/rest/v1/store_orders?select=id,customer_id,customer_name,phone,address,note,items,subtotal,daily_discount,vip_discount,delivery_fee,total,created_at,status&order=created_at.desc',
    { method: 'GET' },
    token,
  );
}

export async function getStoreCustomerProfiles(token: string) {
  return request<StoreCustomerProfile[]>(
    '/rest/v1/customer_profiles?select=user_id,name,phone,address,created_at&order=created_at.desc',
    { method: 'GET' },
    token,
  );
}

export async function updateStoreOrderStatus(token: string, orderId: string, status: string) {
  await request('/rest/v1/rpc/store_order_status', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, next_status: status }),
  }, token);
}


export type StoreSettings = { data: { products?: Array<Record<string, unknown>>; [key: string]: unknown }; version: number };

export async function getStoreSettings() {
  const rows = await request<StoreSettings[]>('/rest/v1/store_settings?id=eq.true&select=data,version', { method: 'GET' });
  if (!rows[0]) throw new Error('Дэлгүүрийн тохиргоо олдсонгүй.');
  return rows[0];
}
