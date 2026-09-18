const SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6cFfPZrw3hfRy-RqefprLQ_c94gv3Ik';
const APP_URL = typeof window === 'undefined' ? 'https://www.uskmart.com' : window.location.origin;

export type AuthSession = { access_token: string; refresh_token?: string; user: { id: string; email?: string; email_confirmed_at?: string | null; identities?: unknown[] } };
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

export async function refreshSession(refreshToken: string) {
  return request<AuthSession>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
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
  total: number; pointsToUse?: number; items: Array<{ id: string; quantity: number }>;
}) {
  const payload = {
    requestId: crypto.randomUUID(),
    expectedTotal: Math.round(order.total),
    name: order.customerName,
    phone: order.phone.replace(/\D/g, '').slice(-8),
    address: order.address,
    note: order.notes || '',
    pointsToUse: Math.max(0, Math.floor(order.pointsToUse || 0)),
    items: order.items.map(item => ({ productId: item.id, quantity: item.quantity })),
  };
  return request('/rest/v1/rpc/store_checkout_with_points', {
    method: 'POST',
    body: JSON.stringify({ payload, save_order: true }),
  }, token);
}


export type LoyaltyWallet = { available_points: number; lifetime_earned: number };

export async function getLoyaltyWallet(token: string) {
  const rows = await request<LoyaltyWallet[]>('/rest/v1/rpc/get_loyalty_wallet', { method: 'POST', body: '{}' }, token);
  return rows[0] || { available_points: 0, lifetime_earned: 0 };
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

export async function hasStoreAdminAccess(token: string) {
  const rows = await request<Array<{ email: string }>>('/rest/v1/allowed_accounts?select=email', { method: 'GET' }, token);
  return rows.length > 0;
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


export async function saveStoreSettings(token: string, data: Record<string, unknown>) {
  const settings = await getStoreSettings();
  const nextData = { ...settings.data, ...data };
  await request('/rest/v1/store_settings?id=eq.true', {
    method: 'PATCH',
    body: JSON.stringify({ data: nextData, version: settings.version + 1, updated_at: new Date().toISOString() }),
  }, token);
  return nextData;
}

export async function saveStoreProducts(token: string, products: Array<Record<string, unknown>>) {
  const settings = await getStoreSettings();
  const normalized = products.map((product) => {
    const stock = Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0));
    const { stock_quantity, ...rest } = product;
    return { ...rest, stock: Math.max(0, stock), in_stock: Boolean(product.in_stock) && stock > 0, published: product.published ?? true };
  });
  const nextData = { ...settings.data, products: normalized };
  await request('/rest/v1/store_settings?id=eq.true', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ data: nextData, version: settings.version + 1, updated_at: new Date().toISOString() }),
  }, token);
}
