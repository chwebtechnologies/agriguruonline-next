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

// Handle background messages (app is in background or closed)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

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

// Open or focus the app window when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
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
