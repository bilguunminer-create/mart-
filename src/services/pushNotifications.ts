import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';
import { registerAdminPushToken } from './supabaseAuth';

let started = false;

// Public Web Push key for this Firebase project (Firebase console -> Project
// settings -> Cloud Messaging tab -> Web Push certificates -> Key pair).
// This is a PUBLIC key, safe to ship in the client bundle -- it identifies
// which project can address this browser, it is not a secret credential.
// Web push silently no-ops until this is filled in.
const VAPID_PUBLIC_KEY = 'BL-7oA4DL1eN9yLtn6E_6MaXry56qasXVkziF36wtkMOdu267KwhT2gQOQlxReWCXAJC3atJtkADzRVmaEbTR6o';

/**
 * Native app path (Capacitor Android/iOS build installed on the device):
 * registers for Firebase Cloud Messaging through the native push plugin.
 */
async function initNativePush(accessToken: string): Promise<void> {
  const current = await PushNotifications.checkPermissions();
  let granted = current.receive === 'granted';
  if (!granted) {
    const requested = await PushNotifications.requestPermissions();
    granted = requested.receive === 'granted';
  }
  if (!granted) return;

  PushNotifications.addListener('registration', (token) => {
    registerAdminPushToken(accessToken, token.value, Capacitor.getPlatform()).catch(() => {
      // Best-effort: a missed registration just means this device will not get pushes yet.
    });
  });
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error);
  });

  await PushNotifications.register();
}

/**
 * Browser / installed PWA path (the normal "Add to Home Screen" install this
 * app documents, no Android Studio build required): registers a Web Push
 * token through the Firebase JS SDK, delivered via the same service worker
 * already registered in main.tsx (admin-sw.js / inventory-sw.js), which
 * handles the `push` event so notifications still show while the tab/app is
 * closed. Supported on Android Chrome, and on iOS Safari 16.4+ once the app
 * has been added to the home screen (regular Safari tabs cannot receive
 * background push on iOS).
 */
async function initWebPush(accessToken: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (!(await isSupported().catch(() => false))) return;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return;

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const messaging = getMessaging(app);
  const swRegistration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: swRegistration });
  if (token) {
    await registerAdminPushToken(accessToken, token, 'web').catch(() => {
      // Best-effort: a missed registration just means this device will not get pushes yet.
    });
  }
}

/**
 * Registers this device for admin push notifications (new-order alerts).
 * Uses the native Capacitor plugin inside an installed native app shell, and
 * falls back to Web Push in a regular browser tab or a browser-installed PWA
 * -- either way the device ends up in admin_push_tokens and gets the same
 * new-order pushes from api/notify-new-order.ts.
 */
export async function initAdminPushNotifications(accessToken: string): Promise<void> {
  if (started) return;
  started = true;

  try {
    if (Capacitor.isNativePlatform()) {
      await initNativePush(accessToken);
    } else {
      await initWebPush(accessToken);
    }
  } catch (error) {
    console.error('[Push] Setup error:', error);
    started = false;
  }
}
