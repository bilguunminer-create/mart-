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
  const rows = await request<Array<{ name: string; phone: string; address: string; avatar_url?: string }>>(
    `/rest/v1/customer_profiles?user_id=eq.${encodeURIComponent(userId)}&select=name,phone,address,avatar_url`,
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
    if (message.includes('OUT_OF_STOCK')) {
      throw new Error('Сонгосон барааны үлдэгдэл өөрчлөгдсөн байна. Сагсаа шинэчлээд тухайн барааны тоог багасган дахин захиална уу.');
    }
    throw error;
  }
}


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
  return request('/rest/v1/rpc/report_store_order_payment', {
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

/** Logs one storefront pageview. Anonymous -- no token, no PII, just a random per-browser id. */
export async function logSiteVisit(visitorId: string, path: string) {
  return request('/rest/v1/rpc/log_site_visit', {
    method: 'POST',
    body: JSON.stringify({ p_visitor_id: visitorId, p_path: path }),
  });
}

export type SiteVisitStats = {
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
  return request('/rest/v1/rpc/get_site_visit_stats', { method: 'POST', body: JSON.stringify({}) }, token);
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
