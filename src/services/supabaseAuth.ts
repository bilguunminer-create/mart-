import type { PreorderProduct } from '../types';
import { validatePreorderProduct } from '../utils/preorderProducts';

const SUPABASE_URL = 'https://rebtikccivjcsxieeyxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6cFfPZrw3hfRy-RqefprLQ_c94gv3Ik';
const APP_URL = typeof window === 'undefined' ? 'https://www.uskmart.com' : window.location.origin;

export type AuthUser = {
  id: string; email?: string; email_confirmed_at?: string | null; identities?: unknown[];
  is_anonymous?: boolean; user_metadata?: { name?: string; phone?: string; address?: string };
};
export type AuthSession = { access_token: string; refresh_token?: string; expires_in?: number; expires_at?: number; user: AuthUser };
type Profile = { name: string; phone?: string; address?: string };

export class SupabaseRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'SupabaseRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(SUPABASE_URL + path, {
    signal: AbortSignal.timeout(20_000),
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new SupabaseRequestError(data.msg || data.error_description || data.message || 'Хүсэлт амжилтгүй боллоо.', response.status, data.error_code || data.code);
  return data as T;
}

function temporaryPassword() {
  // Keep the temporary credential comfortably within bcrypt's 72-byte limit.
  return `Aa1!${crypto.randomUUID()}`;
}

export function normalizeSignupProfile(profile: Profile): Profile {
  const name = profile.name.trim();
  let phone = (profile.phone || '').replace(/\D/g, '');
  const address = (profile.address || '').trim();
  if (phone.length === 11 && phone.startsWith('976')) phone = phone.slice(3);
  if (!name) throw new Error('Нэрээ оруулна уу.');
  if (name.length > 120) throw new Error('Нэр хамгийн ихдээ 120 тэмдэгттэй байна.');
  if (phone && !/^\d{8}$/.test(phone)) throw new Error('Утасны дугаар 8 оронтой байна.');
  if (address.length > 500) throw new Error('Хаяг хамгийн ихдээ 500 тэмдэгттэй байна.');
  return { name, phone, address };
}

function requireEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Зөв и-мэйл хаяг оруулна уу.');
  return normalized;
}

function requireAuthSession(session: AuthSession): AuthSession {
  if (!session?.access_token || !session.user?.id || !session.user.email_confirmed_at || session.user.is_anonymous) {
    throw new Error('И-мэйл баталгаажсан нэвтрэлт шаардлагатай. Дахин нэвтэрнэ үү.');
  }
  return session;
}

/** Creates a pending account. Supabase sends the confirmation OTP configured in its email template. */
export async function requestSignupOtp(email: string, profile: Profile) {
  const details = normalizeSignupProfile(profile);
  // GoTrue REST returns a User for pending signup and a token response when
  // confirmations are disabled. The SDK's { user, session } wrapper is not on the wire.
  const result = await request<AuthUser | AuthSession>(`/auth/v1/signup?redirect_to=${encodeURIComponent(APP_URL)}`, {
    method: 'POST',
    body: JSON.stringify({
      email: requireEmail(email),
      password: temporaryPassword(),
      data: details,
    }),
  });
  if ('access_token' in result) return { user: result.user, session: requireAuthSession(result) };
  if (!result.id) throw new Error('Бүртгэлийн хариу дутуу байна. Дахин оролдоно уу.');
  return { user: result, session: null };
}

export async function resendSignupOtp(email: string) {
  return request(`/auth/v1/resend?redirect_to=${encodeURIComponent(APP_URL)}`, {
    method: 'POST', body: JSON.stringify({ email: requireEmail(email), type: 'signup' }),
  });
}

/** Exchanges the six-digit confirmation token for an authenticated session. */
export async function verifySignupOtp(email: string, token: string) {
  const code = token.replace(/\s/g, '');
  if (!/^\d{6,12}$/.test(code)) throw new Error('И-мэйлээр ирсэн 6–12 оронтой кодоо оруулна уу.');
  return requireAuthSession(await request<AuthSession>('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ email: requireEmail(email), token: code, type: 'email' }),
  }));
}

export async function signIn(email: string, password: string) {
  return requireAuthSession(await request<AuthSession>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: requireEmail(email), password }),
  }));
}

export async function refreshSession(refreshToken: string) {
  return requireAuthSession(await request<AuthSession>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  }));
}

export async function getAuthUser(token: string) {
  return request<AuthUser>('/auth/v1/user', { method: 'GET' }, token);
}

export async function signOutSession(token: string) {
  await request('/auth/v1/logout?scope=local', { method: 'POST' }, token);
}

/** Resolve callback identity through Auth; decoding a JWT does not verify it. */
export async function resolveAuthCallback(hash: string, search = '') {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  const value = (key: string) => fragment.get(key) || query.get(key);
  if (value('error') || value('error_code')) throw new Error('Баталгаажуулах холбоос хүчингүй эсвэл хугацаа дууссан байна. Шинэ холбоос авна уу.');
  const token = value('access_token');
  const type = value('type');
  if (!token || !['signup', 'email', 'recovery'].includes(type || '')) return null;
  const user = await getAuthUser(token);
  const session = requireAuthSession({ access_token: token, refresh_token: value('refresh_token') || undefined, user });
  return { type: type as 'signup' | 'email' | 'recovery', session };
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof SupabaseRequestError) {
    const messages: Record<string, string> = {
      invalid_credentials: 'И-мэйл эсвэл нууц үг буруу байна.',
      email_not_confirmed: 'И-мэйлээ баталгаажуулсны дараа нэвтэрнэ үү.',
      user_already_exists: 'Энэ и-мэйл бүртгэлтэй байна. Нэвтрэх эсвэл нууц үгээ сэргээнэ үү.',
      email_exists: 'Энэ и-мэйл бүртгэлтэй байна. Нэвтрэх эсвэл нууц үгээ сэргээнэ үү.',
      signup_disabled: 'Шинэ бүртгэл түр хаалттай байна. Дэлгүүртэй холбогдоно уу.',
      email_provider_disabled: 'И-мэйл бүртгэл түр боломжгүй байна. Дэлгүүртэй холбогдоно уу.',
      otp_expired: 'Код хүчингүй эсвэл хугацаа дууссан байна. Шинэ код авна уу.',
      over_email_send_rate_limit: 'И-мэйл илгээх хязгаарт хүрлээ. Түр хүлээгээд дахин оролдоно уу.',
      over_request_rate_limit: 'Хэт олон хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу.',
      email_address_invalid: 'Зөв и-мэйл хаяг оруулна уу.',
      weak_password: 'Нууц үг хангалттай хүчтэй биш байна. Том, жижиг үсэг, тоо, тусгай тэмдэгт оруулна уу.',
      same_password: 'Өмнөхөөсөө өөр нууц үг сонгоно уу.',
    };
    if (messages[error.code || '']) return messages[error.code!];
    if (error.status === 429) return messages.over_request_rate_limit;
  }
  if (error instanceof TypeError) return 'Сүлжээтэй холбогдож чадсангүй. Холболтоо шалгаад дахин оролдоно уу.';
  return error instanceof Error ? error.message : 'Нэвтрэх боломжгүй байна.';
}

export async function sendPasswordReset(email: string) {
  return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(APP_URL)}`, {
    method: 'POST',
    body: JSON.stringify({ email: requireEmail(email) }),
  });
}

export async function getProfile(token: string, userId: string) {
  const rows = await request<Array<{ name: string; phone: string; address: string; avatar_url?: string }>>(
    `/rest/v1/customer_profiles?user_id=eq.${encodeURIComponent(userId)}&select=name,phone,address,avatar_url`,
    { method: 'GET' },
    token,
  );
  return rows[0] || null;
}

export async function saveProfile(token: string, userId: string, profile: Profile) {
  const normalized = normalizeSignupProfile(profile);
  await request('/rest/v1/customer_profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, ...normalized }),
  }, token);
}

export async function updatePassword(token: string, password: string) {
  await request('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) }, token);
}

export async function saveStoreOrder(token: string, order: {
  customerName: string; phone: string; address: string; notes: string;
  email?: string;
  deliveryMode?: 'delivery' | 'vehicle';
  total: number; pointsToUse?: number; items: Array<{ id: string; quantity: number }>;
}) {
  const payload = {
    requestId: crypto.randomUUID(),
    expectedTotal: Math.round(order.total),
    name: order.customerName,
    phone: order.phone.replace(/\D/g, '').slice(-8),
    address: order.address,
    note: order.notes || '',
    // F-01 fix: email-г payload-д нэмсэн — хэрэглэгч email оруулсан бол DB-д хадгалагдана.
    ...(order.email ? { email: order.email.trim().toLowerCase() } : {}),
    deliveryMode: order.deliveryMode || 'delivery',
    pointsToUse: Math.max(0, Math.floor(order.pointsToUse || 0)),
    items: order.items.map(item => ({ productId: item.id, quantity: item.quantity })),
  };
  try {
    return await request('/rest/v1/rpc/store_checkout_with_points', {
      method: 'POST',
      body: JSON.stringify({ payload, save_order: true }),
    }, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const friendly = CHECKOUT_ERRORS.find(([code]) => message.includes(code));
    if (friendly) throw new Error(friendly[1]);
    throw error;
  }
}

// Database checkout exceptions are machine codes; customers need plain messages.
const CHECKOUT_ERRORS: Array<[string, string]> = [
  ['OUT_OF_STOCK', 'Сонгосон барааны үлдэгдэл өөрчлөгдсөн байна. Сагсаа шинэчлээд тухайн барааны тоог багасган дахин захиална уу.'],
  ['PRICE_CHANGED', 'Үнэ эсвэл хөнгөлөлт өөрчлөгдсөн байна. Хуудсаа дахин ачаалж шинэ дүнг шалгаад дахин захиална уу.'],
  ['PRODUCT_UNAVAILABLE', 'Сагсанд байгаа зарим бараа одоогоор худалдаанд байхгүй байна. Сагсаа шалгаад дахин оролдоно уу.'],
  ['ORDER_LIMIT', 'Нэг цагт хэт олон захиалга өгсөн байна. Түр хүлээгээд дахин оролдоно уу.'],
  ['LOGIN_REQUIRED', 'Захиалга өгөхийн тулд и-мэйлээ баталгаажуулсан бүртгэлээр дахин нэвтэрнэ үү.'],
  ['STORE_UNAVAILABLE', 'Дэлгүүрийн систем түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.'],
  ['INVALID_ORDER', 'Захиалгын мэдээлэл дутуу эсвэл буруу байна. Нэр (2+ тэмдэгт), 8 оронтой утас, хаяг (5+ тэмдэгт)-аа шалгана уу.'],
];


export type LoyaltyWallet = { available_points: number; lifetime_earned: number };

export async function getLoyaltyWallet(token: string) {
  const rows = await request<LoyaltyWallet[]>('/rest/v1/rpc/get_loyalty_wallet', { method: 'POST', body: '{}' }, token);
  return rows[0] || { available_points: 0, lifetime_earned: 0 };
}

export type AdminLoyaltyWallet = LoyaltyWallet & { user_id: string };

/** Admin-only: every member's real point balance, not just the caller's own. */
export async function adminListLoyaltyWallets(token: string) {
  return request<AdminLoyaltyWallet[]>('/rest/v1/rpc/admin_list_loyalty_wallets', { method: 'POST', body: '{}' }, token);
}

/** Admin-only: grants points that land in the member's real wallet. */
export async function adminGrantLoyaltyPoints(token: string, targetUserId: string, amount: number) {
  return request('/rest/v1/rpc/admin_grant_loyalty_points', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId, amount }),
  }, token);
}

export type StoreCustomerProfile = {
  user_id: string; name: string; phone: string; address: string; avatar_url?: string; created_at?: string;
};

export type StoreOrderRecord = {
  id: string; order_number?: number; customer_id: string; customer_name: string; phone: string; address: string;
  note: string; items: Array<{ productId: string; title: string; quantity: number; price: number }>;
  subtotal: number; daily_discount: number; vip_discount: number; delivery_fee: number;
  total: number; created_at: string; status: string; payment_status?: string; payment_reported_at?: string | null;
};

export async function getStoreOrders(token: string) {
  return request<StoreOrderRecord[]>(
    '/rest/v1/rpc/read_store_orders',
    { method: 'POST', body: '{}' },
    token,
  );
}

export async function getStoreCustomerProfiles(token: string) {
  return request<StoreCustomerProfile[]>(
    '/rest/v1/rpc/read_store_profiles',
    { method: 'POST', body: '{}' },
    token,
  );
}

export async function hasStoreAdminAccess(token: string) {
  const rows = await request<Array<{ email: string }>>('/rest/v1/allowed_accounts?select=email', { method: 'GET' }, token);
  return rows.length > 0;
}

export async function reportStoreOrderPayment(token: string, orderId: string) {
  return request<StoreOrderRecord>('/rest/v1/rpc/report_store_order_payment', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  }, token);
}

export async function confirmStoreOrderPayment(token: string, orderId: string) {
  await request('/rest/v1/rpc/confirm_store_order_payment', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  }, token);
}

export async function updateStoreOrderStatus(token: string, orderId: string, status: string) {
  await request('/rest/v1/rpc/store_order_status', {
    method: 'POST',
    body: JSON.stringify({ p_order_id: orderId, p_next_status: status }),
  }, token);
}


export type StoreSettings = { data: { products?: Array<Record<string, unknown>>; [key: string]: unknown }; version: number };

export class StoreSettingsConflictError extends Error {
  constructor() {
    super('Каталогийн мэдээлэл өөрчлөгдсөн байна. Хуучин мэдээллийг хадгалахыг хориглолоо. Хуудсаа дахин ачаалаад өөрчлөлтөө оруулна уу.');
    this.name = 'StoreSettingsConflictError';
  }
}

export async function getStoreSettings() {
  const rows = await request<StoreSettings[]>('/rest/v1/store_settings?id=eq.true&select=data,version', { method: 'GET' });
  if (!rows[0]) throw new Error('Дэлгүүрийн тохиргоо олдсонгүй.');
  return rows[0];
}


async function updateStoreSettings(token: string, settings: StoreSettings, nextData: StoreSettings['data']) {
  if (!Number.isSafeInteger(settings.version) || settings.version < 0) throw new StoreSettingsConflictError();
  // The filter is evaluated by Postgres while updating the row. A purchase or
  // another admin save between our GET and PATCH must never be overwritten.
  const rows = await request<Array<{ version: number }>>(`/rest/v1/store_settings?id=eq.true&version=eq.${settings.version}&select=version`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ data: nextData, version: settings.version + 1, updated_at: new Date().toISOString() }),
  }, token);
  if (!Array.isArray(rows) || rows.length !== 1) throw new StoreSettingsConflictError();
}

export async function saveStoreSettings(token: string, data: Record<string, unknown>) {
  // Catalog replacement requires the baseline check in saveStoreProducts.
  if (Object.prototype.hasOwnProperty.call(data, 'products')) throw new StoreSettingsConflictError();
  const settings = await getStoreSettings();
  const nextData = { ...settings.data, ...data };
  await updateStoreSettings(token, settings, nextData);
  return nextData;
}

function normalizeStoreProducts(products: Array<Record<string, unknown>>) {
  return products.map((product) => {
    const stock = Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0));
    const { stock_quantity, ...rest } = product;
    return { ...rest, stock: Math.max(0, stock), in_stock: Boolean(product.in_stock) && stock > 0, published: product.published ?? true };
  });
}

// JSON object key order differs between API and browser objects; compare values.
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item);
}

export async function saveStoreProducts(
  token: string,
  products: Array<Record<string, unknown>>,
  expectedProducts: Array<Record<string, unknown>>,
) {
  // Fail closed for callers that have not loaded a baseline catalog.
  if (!Array.isArray(expectedProducts)) throw new StoreSettingsConflictError();
  const settings = await getStoreSettings();
  if (!Array.isArray(settings.data.products) ||
      canonicalJson(normalizeStoreProducts(settings.data.products)) !== canonicalJson(normalizeStoreProducts(expectedProducts))) {
    throw new StoreSettingsConflictError();
  }
  const normalized = normalizeStoreProducts(products);
  const nextData = { ...settings.data, products: normalized };
  await updateStoreSettings(token, settings, nextData);
}


export async function savePreorderProducts(token: string, products: PreorderProduct[], expectedProducts: PreorderProduct[]) {
  if (!Array.isArray(expectedProducts)) throw new StoreSettingsConflictError();
  if (products.length > 200) throw new Error('Захиалгын хэсэгт хамгийн ихдээ 200 бараа хадгална.');
  const validated = products.map(validatePreorderProduct);
  if (new Set(validated.map((product) => product.id)).size !== validated.length) throw new Error('Барааны дугаар давхардсан байна.');
  const settings = await getStoreSettings();
  // Reject an outdated editor even if the other save completed before this GET.
  if (canonicalJson(settings.data.preorder_products ?? []) !== canonicalJson(expectedProducts)) {
    throw new StoreSettingsConflictError();
  }
  await updateStoreSettings(token, settings, { ...settings.data, preorder_products: validated });
  return validated;
}

export async function verifyAdminPin(token: string, pin: string) {
  return request<boolean>('/rest/v1/rpc/verify_admin_pin', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  }, token);
}

export async function changeAdminPin(token: string, currentPin: string, newPin: string) {
  await request('/rest/v1/rpc/change_admin_pin', {
    method: 'POST',
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  }, token);
}


export type InventoryMovement = {
  id: string; product_id: string; product_name: string; barcode_value?: string | null;
  movement_type: 'entry' | 'sale' | 'adjustment' | 'return'; quantity: number;
  stock_before: number; stock_after: number; note: string; created_at: string;
};

export async function uploadProductImage(token: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Зөвхөн JPG, PNG эсвэл WEBP зураг оруулна.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Зургийн хэмжээ 5MB-аас бага байх ёстой.');
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!response.ok) throw new Error('Барааны зургийг серверт хадгалах боломжгүй байна.');
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export async function uploadBrandingImage(token: string, file: File, kind: 'logo' | 'banner') {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Зөвхөн JPG, PNG эсвэл WEBP зураг оруулна.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Зургийн хэмжээ 8MB-аас бага байх ёстой.');
  const path = `branding/${kind}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!response.ok) throw new Error('Зургийг серверт хадгалах боломжгүй байна.');
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export async function uploadCategoryImage(token: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Зөвхөн JPG, PNG эсвэл WEBP зураг оруулна.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Зургийн хэмжээ 5MB-аас бага байх ёстой.');
  const path = `categories/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!response.ok) throw new Error('Ангилалын зургийг серверт хадгалах боломжгүй байна.');
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export async function registerInventoryProduct(token: string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>('/rest/v1/rpc/admin_register_catalog_product', {
    method: 'POST', body: JSON.stringify({ payload }),
  }, token);
}

export async function deductInventoryByBarcode(token: string, barcode: string, quantity: number, note = '') {
  return request<Record<string, unknown>>('/rest/v1/rpc/admin_inventory_deduct', {
    method: 'POST', body: JSON.stringify({ scan_code: barcode, deduction_quantity: quantity, movement_note: note }),
  }, token);
}

export async function addInventoryStock(token: string, barcode: string, quantity: number, note = '') {
  return request<Record<string, unknown>>('/rest/v1/rpc/admin_inventory_add_stock', {
    method: 'POST', body: JSON.stringify({ scan_code: barcode, addition_quantity: quantity, movement_note: note }),
  }, token);
}

export async function lookupInventoryBarcode(token: string, barcode: string) {
  return request<Record<string, unknown> | null>('/rest/v1/rpc/admin_lookup_barcode', {
    method: 'POST', body: JSON.stringify({ scan_code: barcode }),
  }, token);
}

export async function getInventoryMovements(token: string) {
  return request<InventoryMovement[]>('/rest/v1/inventory_movements?select=*&order=created_at.desc&limit=50', { method: 'GET' }, token);
}


export async function cancelMyStoreOrder(token: string, orderId: string) {
  return request('/rest/v1/rpc/cancel_my_store_order', {
    method: 'POST', body: JSON.stringify({ order_id: orderId }),
  }, token);
}

export async function expireMyUnpaidOrders(token: string) {
  return request<number>('/rest/v1/rpc/expire_my_unpaid_store_orders', { method: 'POST', body: '{}' }, token);
}

export async function expireUnpaidOrdersAsAdmin(token: string) {
  return request<number>('/rest/v1/rpc/admin_expire_unpaid_store_orders', { method: 'POST', body: '{}' }, token);
}

/** Registers this device's FCM token so it receives new-order push notifications. Admin-only. */
export async function registerAdminPushToken(token: string, deviceToken: string, platform: string) {
  return request('/rest/v1/rpc/register_admin_push_token', {
    method: 'POST',
    body: JSON.stringify({ p_token: deviceToken, p_platform: platform }),
  }, token);
}

export async function unregisterAdminPushToken(token: string, deviceToken: string) {
  return request('/rest/v1/rpc/unregister_admin_push_token', {
    method: 'POST',
    body: JSON.stringify({ p_token: deviceToken }),
  }, token);
}

/** IP and account/session identity are validated by our server, never supplied by the browser. */
export async function logSiteVisit(visitorId: string, path: string, visitKey: string, token?: string) {
  const response = await fetch('/api/site-visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ visitorId, visitKey, path }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Хандалтыг бүртгэж чадсангүй.');
}

export type SiteVisitPeriod = 'total' | 'today' | 'last7days' | 'last30days';
export type SiteVisitRecord = {
  id: number; created_at: string; path: string; visitor_id: string; user_id: string | null;
  ip_address: string | null; auth_session_id: string | null; identity_status: 'verified' | 'guest' | 'legacy';
};
/** Aggregated by Vercel IP geolocation; empty strings mean the location is unknown. */
export type SiteVisitLocation = {
  period: SiteVisitPeriod; country: string; region: string; city: string; pageviews: number; visitors: number;
};
export type SiteVisitStats = Partial<Record<`${SiteVisitPeriod}_${'unique_ips' | 'verified_login_sessions' | 'repeat_logins' | 'unverified_pageviews'}`, number>> & {
  recent_visits?: SiteVisitRecord[];
  recent_visits_error?: boolean;
  /** Undefined until supabase/add-site-visit-locations.sql is applied (or if loading failed). */
  locations?: SiteVisitLocation[];
  total_new_visitors: number;
  total_repeat_visits: number;
  today_new_visitors: number;
  today_repeat_visits: number;
  last7days_new_visitors: number;
  last7days_repeat_visits: number;
  last30days_new_visitors: number;
  last30days_repeat_visits: number;
  total_pageviews: number;
  total_unique_visitors: number;
  today_pageviews: number;
  today_unique_visitors: number;
  last7days_pageviews: number;
  last7days_unique_visitors: number;
  last30days_pageviews: number;
  last30days_unique_visitors: number;
};

export async function getSiteVisitStats(token: string): Promise<SiteVisitStats> {
  const stats = await request<SiteVisitStats>('/rest/v1/rpc/get_site_visit_stats', { method: 'POST', body: JSON.stringify({}) }, token);
  if (stats.total_verified_login_sessions !== undefined) {
    try {
      stats.recent_visits = await request<SiteVisitRecord[]>('/rest/v1/rpc/get_recent_site_visits', {
        method: 'POST', body: JSON.stringify({ p_limit: 50 }),
      }, token);
    } catch { stats.recent_visits_error = true; }
    try {
      stats.locations = await request<SiteVisitLocation[]>('/rest/v1/rpc/get_site_visit_locations', { method: 'POST', body: '{}' }, token);
    } catch { /* location report not installed yet */ }
  }
  return stats;
}

export type SupportMessage = {
  id: number;
  customer_id: string;
  sender: 'customer' | 'admin' | 'bot';
  message: string;
  created_at: string;
};

export type SupportStatus = {
  bot_enabled: boolean;
  needs_human: boolean;
};

export type ChatbotReply = {
  reply: string | null;
  needsHuman: boolean;
  botEnabled: boolean;
};

/** Customer: send a message to the store. */
export async function sendSupportMessage(token: string, message: string) {
  return request('/rest/v1/rpc/send_support_message', {
    method: 'POST',
    body: JSON.stringify({ p_message: message }),
  }, token);
}

/** Customer: read (and mark read) their own thread. */
export async function getMySupportMessages(token: string): Promise<SupportMessage[]> {
  return request('/rest/v1/rpc/get_my_support_messages', { method: 'POST', body: JSON.stringify({}) }, token);
}

/** Customer: current AI/human ownership state for their support thread. */
export async function getMySupportStatus(token: string): Promise<SupportStatus> {
  return request('/rest/v1/rpc/get_my_support_status', { method: 'POST', body: JSON.stringify({}) }, token);
}

async function chatbotRequest(token: string, body: Record<string, unknown>): Promise<ChatbotReply> {
  const response = await fetch('/api/chatbot', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Chatbot хариу өгөхөд алдаа гарлаа.');
  return data as ChatbotReply;
}

/** Customer: saves the message and asks the AI assistant for a reply. */
export async function sendChatbotMessage(token: string, message: string) {
  return chatbotRequest(token, { message });
}

/** Customer: pauses AI replies and hands the conversation to a store admin. */
export async function requestSupportHuman(token: string) {
  return chatbotRequest(token, { requestHuman: true });
}

/** Admin: reply to a specific customer's thread. */
export async function adminSendSupportMessage(token: string, customerId: string, message: string) {
  return request('/rest/v1/rpc/admin_send_support_message', {
    method: 'POST',
    body: JSON.stringify({ p_customer_id: customerId, p_message: message }),
  }, token);
}

/** Admin: read (and mark read) one customer's full thread. */
export async function adminGetSupportThread(token: string, customerId: string): Promise<SupportMessage[]> {
  return request('/rest/v1/rpc/admin_get_support_thread', {
    method: 'POST',
    body: JSON.stringify({ p_customer_id: customerId }),
  }, token);
}

export type SupportThreadSummary = {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  last_message: string;
  last_sender: 'customer' | 'admin' | 'bot';
  last_at: string;
  unread_count: number;
  bot_enabled: boolean;
  needs_human: boolean;
};

/** Admin: inbox list of every customer thread, newest activity first. */
export async function adminListSupportThreads(token: string): Promise<SupportThreadSummary[]> {
  return request('/rest/v1/rpc/admin_list_support_threads', { method: 'POST', body: JSON.stringify({}) }, token);
}

/** Admin: enable AI again or keep the thread under human ownership. */
export async function adminSetSupportBotState(token: string, customerId: string, botEnabled: boolean) {
  return request('/rest/v1/rpc/admin_set_support_bot_state', {
    method: 'POST',
    body: JSON.stringify({ p_customer_id: customerId, p_bot_enabled: botEnabled }),
  }, token);
}

export async function uploadProfileImage(token: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Зөвхөн JPG, PNG эсвэл WEBP зураг оруулна.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Зургийн хэмжээ 3MB-аас бага байх ёстой.');
  const path = `avatars/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-images/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!response.ok) throw new Error('Профайлын зургийг серверт хадгалах боломжгүй байна.');
  return `${SUPABASE_URL}/storage/v1/object/public/profile-images/${path}`;
}

export async function saveProfileAvatar(token: string, avatarUrl: string) {
  // S-08 fix: JWT decode-д try-catch нэмсэн.
  // token.split('.')[1] эсвэл atob/JSON.parse алдаа гарвал тодорхой мессеж гарна.
  let userId: string;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload?.sub) throw new Error('sub field олдсонгүй');
    userId = payload.sub as string;
  } catch {
    throw new Error('Хэрэглэгчийн бүртгэл таних боломжгүй байна. Дахин нэвтэрнэ үү.');
  }
  await request('/rest/v1/customer_profiles?user_id=eq.' + encodeURIComponent(userId), {
    method: 'PATCH', body: JSON.stringify({ avatar_url: avatarUrl }),
  }, token);
}


export type ProductReview = {
  id: string; product_id: string; customer_id: string; customer_name: string;
  rating: number; comment: string; status: 'pending' | 'approved' | 'rejected';
  created_at: string; reviewed_at?: string | null;
};

/** Approved reviews for one product, or the site-wide feed when productId is omitted. Works for anonymous visitors. */
export async function getProductReviews(productId?: string, limit = 50) {
  return request<ProductReview[]>('/rest/v1/rpc/read_product_reviews', {
    method: 'POST',
    body: JSON.stringify({ p_product_id: productId ?? null, p_limit: limit }),
  });
}

export async function getMyProductReview(token: string, productId: string) {
  const rows = await request<ProductReview[] | ProductReview | null>('/rest/v1/rpc/read_my_product_review', {
    method: 'POST',
    body: JSON.stringify({ p_product_id: productId }),
  }, token);
  if (Array.isArray(rows)) return rows[0] || null;
  return rows || null;
}

export async function submitProductReview(token: string, productId: string, rating: number, comment: string) {
  return request<ProductReview>('/rest/v1/rpc/submit_product_review', {
    method: 'POST',
    body: JSON.stringify({ p_product_id: productId, p_rating: rating, p_comment: comment }),
  }, token);
}

export async function getAllReviewsForAdmin(token: string) {
  return request<ProductReview[]>('/rest/v1/rpc/read_all_reviews_admin', { method: 'POST', body: '{}' }, token);
}

export async function moderateProductReview(token: string, reviewId: string, approve: boolean) {
  await request('/rest/v1/rpc/moderate_product_review', {
    method: 'POST',
    body: JSON.stringify({ p_review_id: reviewId, p_approve: approve }),
  }, token);
}

export async function deleteProductReview(token: string, reviewId: string) {
  await request('/rest/v1/rpc/delete_product_review', {
    method: 'POST',
    body: JSON.stringify({ p_review_id: reviewId }),
  }, token);
}
