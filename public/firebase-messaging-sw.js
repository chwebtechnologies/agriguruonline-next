importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDsZ6wXeYThSexefjjIHoPPxNVumSaXweE",
  authDomain: "agriguru-online.firebaseapp.com",
  projectId: "agriguru-online",
  storageBucket: "agriguru-online.firebasestorage.app",
  messagingSenderId: "350262688240",
  appId: "1:350262688240:web:a7bc2485399af7a613c535",
};

// Check for dynamic URL query params if present
try {
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get('apiKey')) {
    firebaseConfig.apiKey = urlParams.get('apiKey');
    firebaseConfig.authDomain = urlParams.get('authDomain') || firebaseConfig.authDomain;
    firebaseConfig.projectId = urlParams.get('projectId') || firebaseConfig.projectId;
    firebaseConfig.storageBucket = urlParams.get('storageBucket') || firebaseConfig.storageBucket;
    firebaseConfig.messagingSenderId = urlParams.get('messagingSenderId') || firebaseConfig.messagingSenderId;
    firebaseConfig.appId = urlParams.get('appId') || firebaseConfig.appId;
  }
} catch (e) {
  console.warn('[FCM SW] Could not parse location params:', e);
}

// 1. Initialize Firebase App & Messaging
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
} catch (e) {
  console.warn('[FCM SW] Firebase initialization warning:', e);
}

// 2. Persist unread status to IndexedDB so even if all tabs are closed, state is saved
function setUnreadInIndexedDB(payload) {
  try {
    const req = indexedDB.open('ag_notification_db', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('unread_state')) {
        db.createObjectStore('unread_state', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('unread_state')) return;
      const tx = db.transaction('unread_state', 'readwrite');
      tx.objectStore('unread_state').put({
        id: 'status',
        hasUnread: true,
        timestamp: Date.now(),
        payload: payload || null,
      });
    };
  } catch (err) {
    console.warn('[FCM SW] Failed to update IndexedDB:', err);
  }
}

// 3. Broadcast helper to inform all open tabs/clients
function notifyClients(payload) {
  setUnreadInIndexedDB(payload);

  // BroadcastChannel works across all tabs and workers
  try {
    const channel = new BroadcastChannel('fcm_channel');
    channel.postMessage({ payload });
  } catch (err) {
    console.warn('[FCM SW] BroadcastChannel error:', err);
  }

  // Direct postMessage to all window clients
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'FCM_MESSAGE', payload });
      client.postMessage({ type: 'FCM_BACKGROUND_MESSAGE', payload });
    });
  });
}

// 4. Firebase onBackgroundMessage handler
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] onBackgroundMessage received:', payload);
    notifyClients(payload);

    const title = payload.notification?.title || payload.data?.title || 'Agriguru Online';
    const body = payload.notification?.body || payload.data?.body || 'You have a new update';
    const icon = payload.notification?.icon || payload.data?.icon || '/logo.png';

    const options = {
      body,
      icon,
      badge: '/logo.png',
      data: payload.data || payload,
      tag: payload.messageId || 'fcm-' + Date.now(),
      renotify: true,
      requireInteraction: true,
    };

    return self.registration.showNotification(title, options);
  });
}

// 5. Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  const targetUrl = event.notification.data?.click_action || event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 6. SW Lifecycle: skipWaiting and claim clients immediately so it becomes active and running right away
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
