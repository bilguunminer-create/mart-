/**
 * useOrders — захиалга, гишүүний профайл, loyalty wallet-ийг ачаалах болон
 * 45 секунд тутам автоматаар шинэчлэх custom hook.
 * C-01 fix: App.tsx-аас хуваан гаргасан.
 * P-01 fix: polling interval 20с → 45с болгосон.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  getStoreOrders,
  getStoreCustomerProfiles,
  adminListLoyaltyWallets,
  AdminLoyaltyWallet,
  expireUnpaidOrdersAsAdmin,
} from '../services/supabaseAuth';
import { OrderDetails } from '../types';
import { formatOrderNumber } from '../data/storeData';

export interface OrdersState {
  orders: OrderDetails[];
  setOrders: React.Dispatch<React.SetStateAction<OrderDetails[]>>;
  memberProfiles: Array<{ user_id: string; name: string; phone: string; address: string; created_at?: string }>;
  loyaltyWallets: AdminLoyaltyWallet[];
  setLoyaltyWallets: React.Dispatch<React.SetStateAction<AdminLoyaltyWallet[]>>;
}

export function useOrders(
  accessToken: string | undefined,
  isAdminAuthenticated: boolean,
  showToast: (msg: string) => void
): OrdersState {
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<
    Array<{ user_id: string; name: string; phone: string; address: string; created_at?: string }>
  >([]);
  const [loyaltyWallets, setLoyaltyWallets] = useState<AdminLoyaltyWallet[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    // Tracks order IDs seen on the previous poll so a genuinely new order can be announced to the admin.
    let knownOrderIds: Set<string> | null = null;

    const loadCentralData = async () => {
      const token = accessToken;
      if (isAdminAuthenticated) {
        // Best-effort periodic sweep: cancel unpaid orders and release reserved stock.
        try { await expireUnpaidOrdersAsAdmin(token); } catch { /* not fatal */ }
      }

      const [ordersResult, profilesResult, walletsResult] = await Promise.allSettled([
        getStoreOrders(token),
        getStoreCustomerProfiles(token),
        isAdminAuthenticated ? adminListLoyaltyWallets(token) : Promise.resolve([]),
      ]);
      if (!active) return;
      const failures: string[] = [];

      if (ordersResult.status === 'fulfilled') {
        const mapped = ordersResult.value.map((order) => ({
          orderId: order.id,
          orderNumber: order.order_number,
          customerId: order.customer_id,
          customerName: order.customer_name,
          phone: order.phone,
          address: order.address,
          district: 'Өмнөговь, Даланзадгад',
          notes: order.note || '',
          paymentMethod: 'bank' as const,
          paymentStatus: order.payment_status,
          paymentReportedAt: order.payment_reported_at || undefined,
          items: (order.items || []).map((item) => ({
            type: 'product' as const,
            id: item.productId,
            name: item.title,
            price: item.price,
            originalPrice: item.price,
            image: '',
            quantity: item.quantity,
          })),
          subtotal: order.subtotal,
          dailyDiscount: order.daily_discount,
          loyaltyDiscount: order.vip_discount,
          deliveryFee: order.delivery_fee,
          total: order.total,
          date: new Date(order.created_at).toLocaleString('mn-MN'),
          status: order.status === 'Дууссан' ? 'delivered' as const
            : order.status === 'Цуцалсан' ? 'cancelled' as const
            : order.status === 'Хүргэлтэд' ? 'shipping' as const
            : order.status === 'Баталгаажсан' ? 'confirmed' as const
            : 'new' as const,
        }));

        if (isAdminAuthenticated) {
          const currentIds = new Set(mapped.map((o) => o.orderId));
          if (knownOrderIds) {
            const arrived = mapped.filter((o) => !knownOrderIds!.has(o.orderId));
            if (arrived.length > 0) {
              const names = arrived.slice(0, 3).map((o) => formatOrderNumber(o)).join(', ');
              showToast(`🔔 Шинэ захиалга ирлээ: ${names}${arrived.length > 3 ? ` (+${arrived.length - 3})` : ''}`);
            }
          }
          knownOrderIds = currentIds;
        }

        setOrders(mapped);
      } else {
        console.error('[Admin] Захиалгын түүх татахад алдаа гарлаа:', ordersResult.reason);
        failures.push('захиалгын түүх');
      }

      if (profilesResult.status === 'fulfilled') {
        setMemberProfiles(profilesResult.value);
      } else {
        console.error('[Admin] Гишүүдийн мэдээлэл татахад алдаа гарлаа:', profilesResult.reason);
        setMemberProfiles([]);
        failures.push('хэрэглэгчийн мэдээлэл');
      }

      if (walletsResult.status === 'fulfilled') {
        setLoyaltyWallets(walletsResult.value as AdminLoyaltyWallet[]);
      } else if (isAdminAuthenticated) {
        console.error('[Admin] Лояалти оноо татахад алдаа гарлаа:', walletsResult.reason);
        failures.push('лояалти оноо');
      }

      if (failures.length > 0) {
        showToast(`Төв сангаас ${failures.join(', ')} татаж чадсангүй. Дахин нэвтэрч үзнэ үү.`);
      }
    };

    void loadCentralData();
    // P-01 fix: 20с → 45с болгосон. 3 RPC × 20с = Supabase-д их ачаалал.
    // TODO: Supabase Realtime subscription-д шилжүүлэх.
    const timer = window.setInterval(
      () => { if (!document.hidden) void loadCentralData(); },
      45000
    );
    return () => { active = false; window.clearInterval(timer); };
  }, [accessToken, isAdminAuthenticated]);

  return { orders, setOrders, memberProfiles, loyaltyWallets, setLoyaltyWallets };
}
