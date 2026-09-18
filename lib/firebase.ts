import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let messagingInstance: Messaging | null = null;

const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;
  try {
    const { isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Not supported in this browser.');
      return null;
    }
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('[FCM] Error getting messaging instance:', err);
    return null;
  }
};

// Wait for a SW registration to become active (handles installing → activated transition)
const waitForSWActive = (reg: ServiceWorkerRegistration): Promise<void> => {
  return new Promise((resolve) => {
    if (reg.active) {
      resolve();
      return;
    }
    const sw = reg.installing || reg.waiting;
    if (!sw) {
      resolve();
      return;
    }
    sw.addEventListener('statechange', function handler() {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', handler);
        resolve();
      }
    });
  });
};

// Explicitly registers and returns the firebase-messaging-sw.js registration.
// This avoids conflicts with Serwist's /sw.js and makes the SW scope unambiguous.
const getFirebaseSWRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    // Check if already registered and active
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find(r =>
      (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '').includes('firebase-messaging-sw')
    );
    if (existing) {
      await waitForSWActive(existing);
      return existing;
    }

    // Register fresh with Firebase's dedicated push scope to avoid clashing with Serwist /sw.js
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
      updateViaCache: 'none',
    });
    console.log('[FCM] firebase-messaging-sw.js registered:', reg);
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

    const currentToken = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (currentToken) {
      console.log('[FCM] Token generated:', currentToken);
      return currentToken;
    } else {
      console.warn('[FCM] No token. Ensure notification permission is granted and VAPID key is correct.');
      return null;
    }
  } catch (err) {
    console.error('[FCM] Error retrieving token:', err);
    return null;
  }
};

// Persistent foreground message listener. Returns unsubscribe fn for cleanup.
export const subscribeToForegroundMessages = async (
  callback: (payload: unknown) => void
): Promise<() => void> => {
  const msg = await getMessagingInstance();
  if (!msg) return () => {};
  const unsubscribe = onMessage(msg, (payload) => {
    console.log('[FCM] Foreground message:', payload);
    callback(payload);
  });
  return unsubscribe;
};

export { app };
