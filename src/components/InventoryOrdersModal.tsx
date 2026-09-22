import React, { useMemo, useState } from 'react';
import { X, Phone, MapPin, Clock, Package, Bell, CheckCircle2, Truck, History } from 'lucide-react';
import { OrderDetails } from '../types';
import { formatMNT, formatOrderNumber } from '../data/storeData';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderDetails[];
  onUpdateStatus: (orderId: string, status: 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled') => void;
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Шинэ',
  confirmed: 'Баталгаажсан',
  shipping: 'Хүргэлтэд',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

export const InventoryOrdersModal: React.FC<Props> = ({ isOpen, onClose, orders, onUpdateStatus }) => {
  const [showHistory, setShowHistory] = useState(false);

  const activeOrders = useMemo(
    () => orders.filter((o) => !o.status || o.status === 'new' || o.status === 'confirmed'),
    [orders]
  );
  const dispatchedOrders = useMemo(
    () => orders.filter((o) => o.status === 'shipping'),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled'),
    [orders]
  );

  if (!isOpen) return null;

  const visibleOrders = showHistory ? historyOrders : [...activeOrders, ...dispatchedOrders];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-stone-950/90 p-3 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-stone-950 p-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bell className="h-6 w-6 text-amber-400" />
              {activeOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
                  {activeOrders.length}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base font-black">Захиалгын мэдэгдэл</h2>
              <p className="text-[11px] text-stone-400">Шинэ болон бэлтгэж буй захиалгууд</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-400 hover:bg-stone-800 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="bg-stone-900 px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold cursor-pointer transition-colors ${!showHistory ? 'bg-amber-400 text-stone-950' : 'bg-stone-800 text-stone-300'}`}
          >
            Идэвхтэй ({activeOrders.length + dispatchedOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${showHistory ? 'bg-amber-400 text-stone-950' : 'bg-stone-800 text-stone-300'}`}
          >
            <History className="h-3.5 w-3.5" /> Түүх
          </button>
        </div>

        <div className="space-y-3 rounded-b-3xl bg-stone-100 p-3 sm:p-4">
          {visibleOrders.length === 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white py-14 text-center">
              <Package className="mx-auto mb-2 h-10 w-10 text-stone-300" />
              <p className="text-sm font-bold text-stone-600">
                {showHistory ? 'Түүх хоосон байна' : 'Одоогоор шинэ захиалга байхгүй'}
              </p>
            </div>
          )}

          {visibleOrders.map((order) => {
            const status = order.status || 'new';
            return (
              <div key={order.orderId} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs font-black text-stone-900">
                      {formatOrderNumber(order)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        status === 'new'
                          ? 'bg-rose-100 text-rose-700'
                          : status === 'confirmed'
                          ? 'bg-amber-100 text-amber-700'
                          : status === 'shipping'
                          ? 'bg-sky-100 text-sky-700'
                          : status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-stone-400">
                    <Clock className="h-3.5 w-3.5" /> {order.date}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-bold text-stone-900">{order.customerName}</p>
                    <a href={`tel:${order.phone}`} className="inline-flex items-center gap-1 font-bold text-rose-600 hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {order.phone}
                    </a>
                  </div>
                  <div className="flex items-start gap-1 text-stone-600 sm:justify-end sm:text-right">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <span>{order.district}, {order.address}</span>
                  </div>
                </div>

                {order.notes && (
                  <p className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-[11px] italic text-stone-500">
                    Тэмдэглэл: {order.notes}
                  </p>
                )}

                <div className="rounded-xl border border-stone-200/80 bg-stone-50 p-2.5">
                  <p className="mb-1.5 text-[11px] font-bold text-stone-600">
                    Бараа ({order.items.reduce((sum, i) => sum + i.quantity, 0)} ширхэг):
                  </p>
                  <ul className="space-y-1">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="truncate pr-2 text-stone-800">{item.name}</span>
                        <span className="shrink-0 font-bold text-stone-900">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-sm font-black text-rose-600">{formatMNT(order.total)}</span>
                  <div className="flex items-center gap-2">
                    {status === 'new' && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.orderId, 'confirmed')}
                        className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white cursor-pointer hover:bg-stone-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Баталгаажуулах
                      </button>
                    )}
                    {status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.orderId, 'shipping')}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-stone-950 cursor-pointer hover:bg-amber-300"
                      >
                        <Truck className="h-3.5 w-3.5" /> Хүргэлтэд гаргах
                      </button>
                    )}
                    {(status === 'new' || status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`${formatOrderNumber(order)} захиалгыг цуцлах уу?`)) onUpdateStatus(order.orderId, 'cancelled');
                        }}
                        className="rounded-xl px-2.5 py-2 text-[11px] font-bold text-stone-400 cursor-pointer hover:text-rose-600"
                      >
                        Цуцлах
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
