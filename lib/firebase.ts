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

// Wait for a SW registration to become active (with safe 2.5s fallback timeout)
const waitForSWActive = (reg: ServiceWorkerRegistration): Promise<void> => {
  return new Promise((resolve) => {
    if (reg.active) { resolve(); return; }
    const timeout = setTimeout(() => resolve(), 2500);
    const sw = reg.installing || reg.waiting;
    if (!sw) { clearTimeout(timeout); resolve(); return; }
    sw.addEventListener('statechange', function handler() {
      if (sw.state === 'activated') {
        clearTimeout(timeout);
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
    // 1. Unregister any standalone firebase-messaging-sw registered at root '/'
    // to prevent it from evicting /sw.js or causing controller thrashing across hard refreshes.
    for (const r of registrations) {
      const swUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '';
      if (swUrl.includes('firebase-messaging-sw') && r.scope === window.location.origin + '/') {
        await r.unregister();
      }
    }

    // 2. In production, /sw.js is the primary service worker that already imports /firebase-messaging-sw.js.
    // Use navigator.serviceWorker.ready so FCM uses the single unified service worker.
    if (process.env.NODE_ENV === 'production' || navigator.serviceWorker.controller) {
      try {
        const readyReg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000)),
        ]);
        if (readyReg) return readyReg;
      } catch (e) {}
    }

    // 3. In development (where /sw.js is disabled) or fallback:
    // Check if an existing registration with push scope exists
    const updatedRegs = await navigator.serviceWorker.getRegistrations();
    const existing = updatedRegs.find(r =>
      (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '').includes('firebase-messaging-sw')
    );
    if (existing) {
      await waitForSWActive(existing);
      return existing;
    }

    // Register with isolated push scope so it NEVER intercepts or conflicts with main site '/'
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
      updateViaCache: 'none',
    });
    await waitForSWActive(reg);
    return reg;
  } catch (err) {
    console.error('[FCM] Failed to get service worker registration:', err);
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return undefined;
    }
  }
};

export const requestForToken = async (): Promise<string | null> => {
  try {
    const msg = await getMessagingInstance();
    if (!msg) return null;
    const swRegistration = await getFirebaseSWRegistration();
    const { getToken } = await import('firebase/messaging');
    
    // Add 4.5-second timeout so token generation never hangs the UI
    const tokenPromise = getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500));
    const currentToken = await Promise.race([tokenPromise, timeoutPromise]);

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
