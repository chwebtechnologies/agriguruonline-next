/**
 * Firebase is lazily initialized — NO module-level imports or execution.
 * This prevents Firebase SDK (~300KB) from blocking the main thread on page load (TBT).
 * All functions are async and dynamically import firebase/* only when first called.
 */

let appInstance: any = null;
let messagingInstance: any = null;

const getFirebaseConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
});

const getApp = async (): Promise<any> => {
  if (appInstance) return appInstance;
  const { initializeApp, getApps, getApp: _getApp } = await import('firebase/app');
  appInstance = !getApps().length ? initializeApp(getFirebaseConfig()) : _getApp();
  return appInstance;
};

const getMessagingInstance = async (): Promise<any | null> => {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;
  try {
    const { isSupported, getMessaging } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Not supported in this browser.');
      return null;
    }
    const app = await getApp();
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('[FCM] Error getting messaging instance:', err);
    return null;
  }
};

// Wait for a SW registration to become active
const waitForSWActive = (reg: ServiceWorkerRegistration): Promise<void> => {
  return new Promise((resolve) => {
    if (reg.active) { resolve(); return; }
    const sw = reg.installing || reg.waiting;
    if (!sw) { resolve(); return; }
    sw.addEventListener('statechange', function handler() {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', handler);
        resolve();
      }
    });
  });
};

const getFirebaseSWRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const r of registrations) {
      if (r.scope.includes('firebase-cloud-messaging-push-scope')) {
        await r.unregister();
      }
    }
    const updatedRegs = await navigator.serviceWorker.getRegistrations();
    const existing = updatedRegs.find(r =>
      (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '').includes('firebase-messaging-sw') &&
      !r.scope.includes('firebase-cloud-messaging-push-scope')
    );
    if (existing) {
      await waitForSWActive(existing);
      return existing;
    }
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    await waitForSWActive(reg);
    return reg;
  } catch (err) {
    console.error('[FCM] Failed to register firebase-messaging-sw.js:', err);
    return undefined;
  }
};

export const requestForToken = async (): Promise<string | null> => {
  try {
    const msg = await getMessagingInstance();
    if (!msg) return null;
    const swRegistration = await getFirebaseSWRegistration();
    const { getToken } = await import('firebase/messaging');
    const currentToken = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (currentToken) {
      console.log('[FCM] Token generated:', currentToken);
      return currentToken;
    }
    return null;
  } catch (err) {
    console.error('[FCM] Error retrieving token:', err);
    return null;
  }
};

export const subscribeToForegroundMessages = async (
  callback: (payload: unknown) => void
): Promise<() => void> => {
  const msg = await getMessagingInstance();
  if (!msg) return () => {};
  const { onMessage } = await import('firebase/messaging');
  const unsubscribe = onMessage(msg, (payload) => {
    callback(payload);
  });
  return unsubscribe;
};

export { appInstance as app };
