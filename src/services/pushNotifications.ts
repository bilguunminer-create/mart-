import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerAdminPushToken } from './supabaseAuth';

let started = false;

/**
 * Registers this device for admin push notifications (new-order alerts).
 * A no-op outside the installed native app shell — there is no device token
 * to register when running in a regular browser tab.
 */
export async function initAdminPushNotifications(accessToken: string): Promise<void> {
  if (started || !Capacitor.isNativePlatform()) return;
  started = true;

  try {
    const current = await PushNotifications.checkPermissions();
    let granted = current.receive === 'granted';
    if (!granted) {
      const requested = await PushNotifications.requestPermissions();
      granted = requested.receive === 'granted';
    }
    if (!granted) {
      started = false;
      return;
    }

    PushNotifications.addListener('registration', (token) => {
      registerAdminPushToken(accessToken, token.value, Capacitor.getPlatform()).catch(() => {
        // Best-effort: a missed registration just means this device will not get pushes yet.
      });
    });
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    await PushNotifications.register();
  } catch (error) {
    console.error('[Push] Setup error:', error);
    started = false;
  }
}
