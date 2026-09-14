importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDsZ6wXeYThSexefjjIHoPPxNVumSaXweE",
  authDomain: "agriguru-online.firebaseapp.com",
  projectId: "agriguru-online",
  storageBucket: "agriguru-online.firebasestorage.app",
  messagingSenderId: "350262688240",
  appId: "1:350262688240:web:a7bc2485399af7a613c535",
  measurementId: "G-YKZE67X0J4"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

const DB_NAME = 'ag_notification_db';
const STORE_NAME = 'unread_state';

// Save unread state to IndexedDB so any tab (even if opened later or currently backgrounded) can access it
function saveUnreadToIndexedDB(payload) {
  try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) return;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: 'status',
        hasUnread: true,
        timestamp: Date.now(),
        payload: payload || null
      });
    };
  } catch (err) {
    console.warn('[SW] IndexedDB save failed:', err);
  }
}

function broadcastToClients(payload) {
  // 1. Immediately persist unread status in IndexedDB across the origin
  saveUnreadToIndexedDB(payload);

  // 2. BroadcastChannel to notify active open tabs in real time
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('fcm_channel');
      channel.postMessage({ type: 'FCM_MESSAGE', payload, timestamp: Date.now() });
    }
  } catch {}

  // 3. Direct client postMessage to all open tabs
  try {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ type: 'FCM_MESSAGE', payload });
      }
    });
  } catch {}
}

// Handle background messages (app is in background or closed)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  broadcastToClients(payload);

  // Support both notification payload and data-only payload
  const notificationTitle =
    payload?.notification?.title ||
    payload?.data?.title ||
    'AgriGuru Online';

  const notificationOptions = {
    body:
      payload?.notification?.body ||
      payload?.data?.body ||
      'You have a new message.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload?.data || {},
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Fallback push event listener to ensure zero push messages are dropped
self.addEventListener('push', (event) => {
  try {
    if (event.data) {
      const json = event.data.json();
      broadcastToClients(json);
    } else {
      broadcastToClients({});
    }
  } catch {
    // Non-JSON push payload fallback
    broadcastToClients({});
  }
});

// Open or focus the app window when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Ensure unread is recorded in IndexedDB
  saveUnreadToIndexedDB(event.notification.data);

  // Notify tabs that notification was clicked
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('fcm_channel');
      channel.postMessage({
        type: 'FCM_NOTIFICATION_CLICKED',
        data: event.notification.data,
        clicked: true,
        timestamp: Date.now()
      });
    }
  } catch {}

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
