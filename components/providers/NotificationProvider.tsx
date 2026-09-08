"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    let unsubscribeFn: (() => void) | null = null;
    let isMounted = true;
    let channel: BroadcastChannel | null = null;

    const handlePayload = (payload: any) => {
      console.log('[FCM] Notification payload received:', payload);
      if (!isMounted) return;
      setHasUnread(true);

      // Dispatch custom event for KYC section and other components
      window.dispatchEvent(new CustomEvent('fcm-message', { detail: payload }));

      const title = payload?.notification?.title || payload?.data?.title || 'AgriGuru Online';
      const body = payload?.notification?.body || payload?.data?.body || 'You received a new message.';

      toast(title, {
        description: body,
        duration: 6000,
        action: {
          label: 'View',
          onClick: () => {
            if (isMounted) setHasUnread(false);
          },
        },
      });
    };

    // 1. Listen via BroadcastChannel (for background SW messages and clicks)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('fcm_channel');
        channel.onmessage = (event) => {
          if (event.data) {
            handlePayload(event.data);
          }
        };
      } catch (err) {
        console.warn('[FCM] BroadcastChannel unavailable:', err);
      }
    }

    const init = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      // 2. Subscribe to foreground messages directly via Firebase SDK
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

      // 3. Request permission if needed
      let permission = Notification.permission;
      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch {
          console.warn('[FCM] requestPermission() failed.');
        }
      }

      if (permission !== 'granted') return;

      // 4. Retrieve FCM token and set in context
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
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ hasUnread, setHasUnread, fcmToken }}>
      {children}
    </NotificationContext.Provider>
  );
};
