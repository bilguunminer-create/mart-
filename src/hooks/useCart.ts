/**
 * useCart — сагсны state болон холбогдох бүх handler-ийг удирдах custom hook.
 * C-01 fix: App.tsx-аас хуваан гаргасан.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CartItem, ComboPack, Product } from '../types';
import { getStoreSettings } from '../services/supabaseAuth';

export interface CartHandlers {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  handleAddToCart: (product: Product, quantity?: number, pricing?: { price: number; originalPrice: number; discountPercent: number }) => void;
  handleAddComboToCart: (combo: ComboPack, selectedDay: number) => void;
  handleUpdateQuantity: (id: string, quantity: number, products: Product[]) => void;
  handleRemoveItem: (id: string) => void;
  handleClearCart: () => void;
  handleProceedToCheckout: (
    products: Product[],
    comboPacks: ComboPack[],
    onShortage: (msg: string) => void,
    onReady: () => void,
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>
  ) => Promise<void>;
  cartCount: number;
  cartOriginalSubtotal: number;
  cartCurrentPriceTotal: number;
  dailyDiscountTotal: number;
}

export function useCart(showToast: (msg: string) => void): CartHandlers {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      // C-02 fix: migration from legacy 'gobi_mart_cart'
      const legacy = localStorage.getItem('gobi_mart_cart');
      if (legacy) {
        localStorage.setItem('usk_cart', legacy);
        localStorage.removeItem('gobi_mart_cart');
        return JSON.parse(legacy);
      }
      const saved = localStorage.getItem('usk_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('usk_cart', JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  const handleRemoveItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleUpdateQuantity = useCallback((id: string, quantity: number, products: Product[]) => {
    if (quantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    const product = products.find((item) => item.id === id);
    const available = product
      ? Math.max(0, Number(product.stock_quantity ?? (product.in_stock ? 1 : 0)))
      : quantity;
    if (product && quantity > available) {
      showToast(`"${product.name}"-ын үлдэгдэл ${available} ш байна.`);
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
  }, [handleRemoveItem, showToast]);

  const handleAddToCart = useCallback((
    product: Product,
    quantity = 1,
    pricing?: { price: number; originalPrice: number; discountPercent: number }
  ) => {
    const available = Math.max(0, Number(product.stock_quantity ?? (product.in_stock ? 1 : 0)));
    const alreadyInCart = cart.find((item) => item.id === product.id)?.quantity ?? 0;
    if (!product.in_stock || available < 1) {
      showToast(`"${product.name}" одоогоор дууссан байна.`);
      return;
    }
    if (alreadyInCart + quantity > available) {
      showToast(`"${product.name}"-ын үлдэгдэл ${available} ш байна. Нэг барааны тоо үлдэгдлээс их байж болохгүй.`);
      return;
    }
    const price = pricing?.price ?? product.price;
    const originalPrice = pricing?.originalPrice ?? product.price;
    const discountPct = pricing?.discountPercent ?? 0;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const next = [...prevCart];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          price,
          originalPrice,
        };
        return next;
      }
      return [...prevCart, {
        type: 'product',
        id: product.id,
        name: product.name,
        price,
        originalPrice,
        image: product.image,
        weight: product.weight,
        quantity,
        appliedDiscountPct: discountPct,
        origin: product.origin,
        flag: product.flag,
        stock_quantity: available,
      }];
    });
    showToast(`"${product.name}" сагсанд нэмэгдлээ!`);
  }, [cart, showToast]);

  const handleAddComboToCart = useCallback((combo: ComboPack, selectedDay: number) => {
    const isSundayComboDeal = selectedDay === 0;
    const finalPrice = isSundayComboDeal ? Math.round(combo.price * 0.8) : combo.price;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((i) => i.id === combo.id);
      if (existingIndex > -1) {
        const next = [...prevCart];
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + 1, price: finalPrice };
        return next;
      }
      return [...prevCart, {
        type: 'combo',
        id: combo.id,
        name: combo.name,
        price: finalPrice,
        originalPrice: combo.orig_price,
        image: combo.image,
        quantity: 1,
        appliedDiscountPct: Math.round(((combo.orig_price - finalPrice) / combo.orig_price) * 100),
      }];
    });
    showToast(`"${combo.name}" багц сагсанд нэмэгдлээ!`);
  }, [showToast]);

  const handleClearCart = useCallback(() => setCart([]), []);

  const handleProceedToCheckout = useCallback(async (
    products: Product[],
    comboPacks: ComboPack[],
    onShortage: (msg: string) => void,
    onReady: () => void,
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>
  ) => {
    try {
      const settings = await getStoreSettings();
      const remoteProducts = Array.isArray(settings.data.products)
        ? settings.data.products as Array<Record<string, unknown>>
        : [];
      const remoteCombos = Array.isArray(settings.data.combo_packs)
        ? settings.data.combo_packs as Array<Record<string, unknown>>
        : [];

      const shortages = cart.map((item) => {
        if (item.type === 'combo') {
          const combo = remoteCombos.find((entry) => String(entry.id) === item.id);
          const available = combo && combo.published !== false ? item.quantity : 0;
          return { item, available };
        }
        const product = remoteProducts.find((entry) => String(entry.id) === item.id);
        if (!product) return { item, available: 0 };
        const available = Boolean(product.in_stock) && Boolean(product.published ?? true)
          ? Math.max(0, Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0)))
          : 0;
        return { item, available };
      }).filter(({ item, available }) => item.quantity > available);

      if (shortages.length > 0) {
        setCart((previous) => previous.flatMap((item) => {
          const mismatch = shortages.find(({ item: affected }) => affected.id === item.id);
          return mismatch
            ? (mismatch.available > 0 ? [{ ...item, quantity: mismatch.available, stock_quantity: mismatch.available }] : [])
            : [item];
        }));
        const names = shortages.slice(0, 2).map(({ item, available }) => `${item.name} (${available}ш)`).join(', ');
        onShortage(`Үлдэгдэл шинэчлэгдсэн тул сагсыг заслаа: ${names}. Тоогоо шалгаад дахин үргэлжлүүлнэ үү.`);
        return;
      }

      setProducts(remoteProducts.map((product: any) => {
        const stock = Number(product.stock_quantity ?? product.stock ?? (product.in_stock ? 15 : 0));
        return { ...product, stock_quantity: stock, in_stock: Boolean(product.in_stock) && stock > 0 };
      }) as Product[]);
    } catch {
      // Checkout is still protected by the central transaction if the catalog cannot be refreshed.
    }
    onReady();
  }, [cart]);

  const cartCount = cart.reduce((cnt, item) => cnt + item.quantity, 0);
  const cartOriginalSubtotal = cart.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const cartCurrentPriceTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const dailyDiscountTotal = Math.max(0, cartOriginalSubtotal - cartCurrentPriceTotal);

  return {
    cart,
    setCart,
    handleAddToCart,
    handleAddComboToCart,
    handleUpdateQuantity,
    handleRemoveItem,
    handleClearCart,
    handleProceedToCheckout,
    cartCount,
    cartOriginalSubtotal,
    cartCurrentPriceTotal,
    dailyDiscountTotal,
  };
}
