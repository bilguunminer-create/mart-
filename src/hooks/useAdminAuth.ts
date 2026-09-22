/**
 * useAdminAuth — Админ нэвтрэлт, PIN баталгаажуулалт, admin session-ийг удирдах custom hook.
 * C-01 fix: App.tsx-аас хуваан гаргасан.
 */
import { useState, useEffect, useCallback } from 'react';
import { hasStoreAdminAccess, verifyAdminPin, changeAdminPin } from '../services/supabaseAuth';
import { UserProfile } from '../types';

export interface AdminAuthState {
  isAdminAuthenticated: boolean;
  isAdminLoginOpen: boolean;
  isAdminOpen: boolean;
  setIsAdminLoginOpen: (open: boolean) => void;
  setIsAdminOpen: (open: boolean) => void;
  handleOpenAdmin: (
    currentUser: UserProfile | null,
    onOpenProfile: () => void,
    showToast: (msg: string) => void
  ) => Promise<void>;
  handleAdminLogin: (
    pin: string,
    currentUser: UserProfile | null,
    showToast: (msg: string) => void
  ) => Promise<void>;
  handleAdminLogout: (showToast: (msg: string) => void) => void;
  handleChangePin: (currentPin: string, newPin: string, currentUser: UserProfile | null) => Promise<void>;
}

export function useAdminAuth(): AdminAuthState {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('usk_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const handleOpenAdmin = useCallback(async (
    currentUser: UserProfile | null,
    onOpenProfile: () => void,
    showToast: (msg: string) => void
  ) => {
    if (!currentUser?.accessToken) {
      onOpenProfile();
      showToast('Төв гишүүн, захиалгын мэдээлэл харахын тулд эхлээд админ и-мэйлээрээ нэвтэрнэ үү.');
      return;
    }

    try {
      if (!await hasStoreAdminAccess(currentUser.accessToken)) {
        onOpenProfile();
        // S-03 fix: specific email addresses removed from user-facing messages
        showToast('Энэ бүртгэл админ эрхгүй байна. Дэлгүүрийн ажилтны бүртгэлээр нэвтэрнэ үү.');
        return;
      }
    } catch {
      showToast('Админ эрхийг төв сангаас шалгах боломжгүй байна.');
      return;
    }

    if (isAdminAuthenticated) setIsAdminOpen(true);
    else setIsAdminLoginOpen(true);
  }, [isAdminAuthenticated]);

  const handleAdminLogin = useCallback(async (
    pin: string,
    currentUser: UserProfile | null,
    showToast: (msg: string) => void
  ) => {
    if (!currentUser?.accessToken || !await hasStoreAdminAccess(currentUser.accessToken)) {
      throw new Error('Админ и-мэйлээр дахин нэвтэрч байж төв сангийн гишүүдийг харна.');
    }
    if (!await verifyAdminPin(currentUser.accessToken, pin.trim())) {
      throw new Error('Админ ПИН код буруу байна.');
    }
    setIsAdminAuthenticated(true);
    try {
      sessionStorage.setItem('usk_admin_auth', 'true');
    } catch {
      // ignore
    }
    setIsAdminLoginOpen(false);
    setIsAdminOpen(true);
    showToast('Админ системд амжилттай нэвтэрлээ!');
  }, []);

  const handleAdminLogout = useCallback((showToast: (msg: string) => void) => {
    setIsAdminAuthenticated(false);
    setIsAdminOpen(false);
    try {
      sessionStorage.removeItem('usk_admin_auth');
    } catch {
      // ignore
    }
    showToast('Админ горимоос гарлаа. Хэрэглэгчийн цэвэр харагдац идэвхжлээ.');
  }, []);

  const handleChangePin = useCallback(async (
    currentPin: string,
    newPin: string,
    currentUser: UserProfile | null
  ) => {
    if (!currentUser?.accessToken) throw new Error('Админ и-мэйлээр дахин нэвтэрнэ үү.');
    await changeAdminPin(currentUser.accessToken, currentPin.trim(), newPin.trim());
  }, []);

  return {
    isAdminAuthenticated,
    isAdminLoginOpen,
    isAdminOpen,
    setIsAdminLoginOpen,
    setIsAdminOpen,
    handleOpenAdmin,
    handleAdminLogin,
    handleAdminLogout,
    handleChangePin,
  };
}
