"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { requestForToken, subscribeToForegroundMessages } from '@/lib/firebase';
import { toast } from 'sonner';

interface NotificationContextType {
  hasUnread: boolean;
  setHasUnread: (value: boolean) => void;
  fcmToken: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  hasUnread: false,
  setHasUnread: () => {},
  fcmToken: null,
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasUnread, setHasUnread] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let unsubscribeFn: (() => void) | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      // Don't re-initialize if already done
      if (initializedRef.current) return;

      let permission = Notification.permission;

      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch {
          console.warn('[FCM] requestPermission() failed.');
          return;
        }
      }

      if (permission !== 'granted') {
        console.warn('[FCM] Notification permission denied or dismissed.');
        return;
      }

      // Get FCM token — retry up to 3 times with delay if it fails
      let token: string | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          token = await requestForToken();
          if (token) break;
        } catch (err) {
          console.warn(`[FCM] Token attempt ${attempt} failed:`, err);
        }
        if (attempt < 3) {
          await new Promise<void>((resolve) => {
            retryTimeout = setTimeout(resolve, 1500 * attempt);
          });
        }
      }

      if (token) {
        setFcmToken(token);
        initializedRef.current = true;
        console.log('[FCM] Token set in context.');
      } else {
        console.warn('[FCM] Failed to get token after retries.');
      }

      // Subscribe to foreground messages — persistent
      unsubscribeFn = await subscribeToForegroundMessages((payload) => {
        setHasUnread(true);

        const title = payload?.notification?.title || payload?.data?.title || 'New Notification';
        const body = payload?.notification?.body || payload?.data?.body || 'You received a new message.';

        toast(title, {
          description: body,
          duration: 6000,
          action: {
            label: 'View',
            onClick: () => setHasUnread(false),
          },
        });
      });
    };

    // Initialize immediately
    init();

    // Cleanup
    return () => {
      if (unsubscribeFn) unsubscribeFn();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ hasUnread, setHasUnread, fcmToken }}>
      {children}
    </NotificationContext.Provider>
  );
};
