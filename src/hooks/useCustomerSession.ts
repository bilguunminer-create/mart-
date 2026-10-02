import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { getAuthUser, refreshSession, signOutSession, SupabaseRequestError, type AuthSession } from '../services/supabaseAuth';

const STORAGE_KEY = 'usk_current_user';
const REFRESH_MARGIN = 60_000;
const RECHECK_INTERVAL = 5 * 60_000;
const refreshing = new Map<string, Promise<AuthSession>>();

export function accessTokenExpiresAt(token?: string): number | null {
  try {
    const encoded = token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(encoded));
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isInvalidSession(error: unknown): boolean {
  return error instanceof SupabaseRequestError && (
    error.status === 401 || error.status === 403 ||
    ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'bad_jwt'].includes(error.code || '')
  );
}

function refreshOnce(token: string) {
  let pending = refreshing.get(token);
  if (!pending) {
    pending = refreshSession(token).finally(() => { refreshing.delete(token); });
    refreshing.set(token, pending);
  }
  return pending;
}

/** Token decoding is used only for scheduling; identity always comes from Auth. */
export async function validateCustomerSession(profile: UserProfile): Promise<UserProfile> {
  if (!profile.accessToken || !profile.supabaseUserId) throw new SupabaseRequestError('Invalid saved session', 401);
  let accessToken = profile.accessToken;
  let refreshToken = profile.refreshToken;
  let renewed = false;
  const renew = async () => {
    if (!refreshToken) throw new SupabaseRequestError('Session expired', 401);
    const session = await refreshOnce(refreshToken);
    if (session.user.id !== profile.supabaseUserId) throw new SupabaseRequestError('Session identity mismatch', 401);
    accessToken = session.access_token;
    refreshToken = session.refresh_token || refreshToken;
    renewed = true;
  };
  const expiresAt = accessTokenExpiresAt(accessToken);
  if (refreshToken && (expiresAt === null || expiresAt <= Date.now() + REFRESH_MARGIN)) await renew();
  let user;
  try {
    user = await getAuthUser(accessToken);
  } catch (error) {
    if (renewed || !refreshToken || !isInvalidSession(error)) throw error;
    await renew();
    user = await getAuthUser(accessToken);
  }
  if (user.id !== profile.supabaseUserId || !user.email_confirmed_at || user.is_anonymous) {
    throw new SupabaseRequestError('Session identity is not verified', 401);
  }
  return {
    ...profile,
    id: user.id,
    supabaseUserId: user.id,
    email: user.email || '',
    isVerified: true,
    accessToken,
    refreshToken,
  };
}

function readSavedProfile(): UserProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed && typeof parsed.accessToken === 'string' && typeof parsed.supabaseUserId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function persist(profile: UserProfile | null) {
  try {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch { return false; /* Private browsing can disable persistent storage. */ }
}

export function useCustomerSession() {
  const [currentUser, publishUser] = useState<UserProfile | null>(null);
  const [revision, setRevision] = useState(0);
  const candidate = useRef<UserProfile | null | undefined>(undefined);
  const generation = useRef(0);
  const storageBacked = useRef(true);
  if (candidate.current === undefined) candidate.current = readSavedProfile();

  const setCurrentUser = useCallback((profile: UserProfile | null) => {
    generation.current++;
    const previous = candidate.current;
    candidate.current = profile;
    storageBacked.current = persist(profile);
    // Profile edits keep an already verified session; account/token changes revalidate.
    publishUser((verified) => verified && profile && previous?.accessToken === profile.accessToken &&
      verified.supabaseUserId === profile.supabaseUserId ? { ...profile, isVerified: true } : null);
    setRevision((value) => value + 1);
  }, []);

  const logoutUser = useCallback(async () => {
    const previous = candidate.current;
    setCurrentUser(null);
    if (!previous?.accessToken) return true;
    try {
      let token = previous.accessToken;
      if (previous.refreshToken && (accessTokenExpiresAt(token) || 0) <= Date.now()) {
        token = (await refreshOnce(previous.refreshToken)).access_token;
      }
      await signOutSession(token);
      return true;
    } catch (error) {
      // Invalid/revoked sessions are already signed out. Network failures still
      // clear this browser, but callers can explain that server revocation failed.
      return isInvalidSession(error);
    }
  }, [setCurrentUser]);

  useEffect(() => {
    let active = true;
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;
    let retryDelay = 5_000;
    const epoch = generation.current;
    const isCurrent = () => active && epoch === generation.current;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (isCurrent()) timer = setTimeout(() => { void check(); }, delay);
    };
    const check = async () => {
      if (pending || !isCurrent() || !candidate.current) return;
      pending = true;
      try {
        const validate = async () => {
          if (!isCurrent() || !candidate.current) return;
          // A different tab may have rotated the shared token while this tab
          // waited for the lock. Always adopt that newer token before refreshing.
          const saved = readSavedProfile();
          try {
            if (storageBacked.current && !localStorage.getItem(STORAGE_KEY)) {
              setCurrentUser(null);
              return;
            }
          } catch { /* Keep in-memory sessions usable when storage is unavailable. */ }
          if (saved && saved.supabaseUserId !== candidate.current.supabaseUserId) {
            setCurrentUser(saved);
            return;
          }
          if (saved?.supabaseUserId === candidate.current.supabaseUserId && saved.refreshToken !== candidate.current.refreshToken) {
            candidate.current = saved;
          }
          const checked = await validateCustomerSession(candidate.current);
          if (!isCurrent()) return;
          candidate.current = checked;
          publishUser(checked);
          storageBacked.current = persist(checked);
          retryDelay = 5_000;
          const expiresAt = accessTokenExpiresAt(checked.accessToken);
          schedule(expiresAt === null ? RECHECK_INTERVAL : Math.max(5_000, Math.min(RECHECK_INTERVAL, expiresAt - Date.now() - REFRESH_MARGIN)));
        };
        if (navigator.locks) await navigator.locks.request('usk-customer-session', validate);
        else await validate();
      } catch (error) {
        if (!isCurrent()) return;
        if (isInvalidSession(error)) setCurrentUser(null);
        else {
          // An offline/429/5xx response does not invalidate a refresh token.
          schedule(retryDelay);
          retryDelay = Math.min(retryDelay * 2, REFRESH_MARGIN);
        }
      } finally {
        pending = false;
      }
    };
    const resume = () => { if (!document.hidden) void check(); };
    void check();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [revision, setCurrentUser]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const saved = readSavedProfile();
      if (JSON.stringify(saved) === JSON.stringify(candidate.current)) return;
      generation.current++;
      candidate.current = saved;
      storageBacked.current = true;
      publishUser((previous) => previous?.supabaseUserId === saved?.supabaseUserId ? previous : null);
      setRevision((value) => value + 1);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return { currentUser, setCurrentUser, logoutUser };
}
