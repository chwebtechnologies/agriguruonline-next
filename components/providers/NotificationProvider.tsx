"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { requestForToken, subscribeToForegroundMessages } from '@/lib/firebase';
import { getUnreadStatusFromIndexedDB, setUnreadStatusInIndexedDB } from '@/lib/notificationStorage';
import { toast } from 'sonner';

interface NotificationContextType {
  hasUnread: boolean;
  setHasUnread: (value: boolean) => void;
  fcmToken: string | null;
  setFcmToken: (token: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  hasUnread: false,
  setHasUnread: () => {},
  fcmToken: null,
  setFcmToken: () => {},
});

export const useNotification = () => useContext(NotificationContext);

const UNREAD_KEY = 'ag_has_unread_notif';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize from localStorage so it persists across navigations and page loads
  const [hasUnread, setHasUnreadState] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const hasUnreadRef = useRef(hasUnread);
  const recentMessageIds = useRef<Set<string>>(new Set());
  hasUnreadRef.current = hasUnread;

  const setHasUnread = useCallback((value: boolean) => {
    setHasUnreadState(value);
    if (typeof window !== 'undefined') {
      if (value) {
        localStorage.setItem(UNREAD_KEY, '1');
      } else {
        localStorage.removeItem(UNREAD_KEY);
      }
      // Sync with IndexedDB across worker/tab boundaries
      setUnreadStatusInIndexedDB(value);
    }
  }, []);

  useEffect(() => {
    let unsubscribeFn: (() => void) | null = null;
    let isMounted = true;
    let channel: BroadcastChannel | null = null;

    const syncUnreadFromStorage = async () => {
      if (!isMounted) return;
      const isIdbUnread = await getUnreadStatusFromIndexedDB();
      const isLocalUnread = typeof window !== 'undefined' && localStorage.getItem(UNREAD_KEY) === '1';
      setHasUnreadState(isIdbUnread || isLocalUnread);
    };

    const handlePayload = (payload: any) => {
      console.log('[FCM] Notification payload received:', payload);
      if (!isMounted) return;
      
      const messageId = payload?.messageId || payload?.fcmMessageId || JSON.stringify(payload);
      if (recentMessageIds.current.has(messageId)) {
        return;
      }
      
      recentMessageIds.current.add(messageId);
      setTimeout(() => {
        if (isMounted) {
          recentMessageIds.current.delete(messageId);
        }
      }, 5000);

      setHasUnread(true);

      // Dispatch custom event for KYC section, Header, and other components
      window.dispatchEvent(new CustomEvent('fcm-message', { detail: payload }));
      window.dispatchEvent(new CustomEvent('new-notification', { detail: payload }));

      const title = payload?.notification?.title || payload?.data?.title;
      const body = payload?.notification?.body || payload?.data?.body || 'You received a new message.';

      const contentStr = ((title || '') + ' ' + body).toLowerCase();
      
      const toastTitle = title || body;
      const toastDesc = title ? body : undefined;
      
      if (contentStr.includes('approv') || contentStr.includes('success') || contentStr.includes('verif')) {
        toast.success(toastTitle, { description: toastDesc, duration: 6000 });
      } else if (contentStr.includes('reject') || contentStr.includes('fail') || contentStr.includes('expir') || contentStr.includes('error')) {
        toast.error(toastTitle, { description: toastDesc, duration: 6000 });
      } else if (contentStr.includes('warn')) {
        toast.warning(toastTitle, { description: toastDesc, duration: 6000 });
      } else {
        toast.info(toastTitle, { description: toastDesc, duration: 6000 });
      }

      // Display native desktop/browser notification banner
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title || 'Agriguru Online', {
              body: body,
              icon: '/logo.png',
              badge: '/logo.png',
              tag: messageId,
            });
          }).catch(() => {
            try {
              new Notification(title || 'Agriguru Online', {
                body: body,
                icon: '/logo.png',
                tag: messageId,
              });
            } catch (e) {}
          });
        } else {
          try {
            new Notification(title || 'Agriguru Online', {
              body: body,
              icon: '/logo.png',
              tag: messageId,
            });
          } catch (e) {}
        }
      }
    };

    // 1. Initial sync from IndexedDB
    syncUnreadFromStorage();

    // 2. Listen via BroadcastChannel (for background SW messages, push events, and clicks)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('fcm_channel');
        channel.onmessage = (event) => {
          if (event.data) {
            handlePayload(event.data.payload || event.data);
          }
        };
      } catch (err) {
        console.warn('[FCM] BroadcastChannel unavailable:', err);
      }
    }

    // 3. Direct Service Worker message listener (guaranteed delivery across SW scopes)
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'FCM_MESSAGE' || event.data.type === 'FCM_BACKGROUND_MESSAGE')) {
        handlePayload(event.data.payload || event.data);
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    const init = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      // 5. Subscribe to foreground messages directly via Firebase SDK
      try {
        const unsub = await subscribeToForegroundMessages((payload) => {
          handlePayload(payload);
        });

        if (isMounted) {
          unsubscribeFn = unsub;
        } else if (unsub) {
          unsub();
        }
      } catch (err) {
        console.warn('[FCM] Error subscribing to foreground messages:', err);
      }

      // 6. Request permission if needed
      let permission = Notification.permission;
      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch {
          console.warn('[FCM] requestPermission() failed.');
        }
      }

      if (permission !== 'granted') return;

      // 7. Retrieve FCM token and set in context
      try {
        const token = await requestForToken();
        if (token && isMounted) {
          setFcmToken(token);
          console.log('[FCM] Token active:', token);
        }
      } catch (err) {
        console.warn('[FCM] Token retrieval failed:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (channel) channel.close();
      if (unsubscribeFn) unsubscribeFn();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [setHasUnread]);

  return (
    <NotificationContext.Provider value={{ hasUnread, setHasUnread, fcmToken, setFcmToken }}>
      {children}
    </NotificationContext.Provider>
  );
};
