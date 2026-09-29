"use client";

import React, { useState, useEffect } from 'react';
import { requestForToken } from '@/lib/firebase';
import { useNotification } from '@/components/providers/NotificationProvider';
import { toast } from 'sonner';

interface DismissData {
  count: number;
  lastDismissed: number;
}

export const NotificationPermissionPopup = () => {
  const [show, setShow] = useState(false);
  const { setFcmToken } = useNotification();
  const [lang, setLang] = useState<'en'|'ar'|'fr'|'zh'>('en');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentLang = window.location.pathname.split('/')[1] as any;
      if (['en', 'ar', 'fr', 'zh'].includes(currentLang)) {
        setLang(currentLang);
      }
    }
  }, []);

  const dict = {
    en: {
      title: "Stay updated!",
      desc: "Enable notifications to receive instant updates on your orders and messages.",
      allow: "Allow",
      not_now: "Not now"
    },
    ar: {
      title: "ابق على اطلاع!",
      desc: "قم بتمكين الإشعارات لتلقي تحديثات فورية حول طلباتك ورسائلك.",
      allow: "سماح",
      not_now: "ليس الآن"
    },
    fr: {
      title: "Restez informé(e) !",
      desc: "Activez les notifications pour recevoir des mises à jour instantanées sur vos commandes et messages.",
      allow: "Autoriser",
      not_now: "Pas maintenant"
    },
    zh: {
      title: "保持更新！",
      desc: "启用通知以接收有关您的订单和消息的即时更新。",
      allow: "允许",
      not_now: "以后再说"
    }
  };
  const t = dict[lang];

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // Check after a delay to let any native prompts appear first
      const timer = setTimeout(() => {
        if (Notification.permission === 'default') {
          const dismissDataStr = localStorage.getItem('ag_dismiss_notif_data');
          let shouldShow = false;

          if (!dismissDataStr) {
            // Never dismissed, show it
            shouldShow = true;
          } else {
            try {
              const data: DismissData = JSON.parse(dismissDataStr);
              const now = Date.now();
              const elapsed = now - data.lastDismissed;

              // Back-off strategy:
              // 1st dismiss -> wait 10 minutes (600,000 ms)
              // 2nd dismiss -> wait 30 minutes (1,800,000 ms)
              // 3rd dismiss -> wait 1 hour (3,600,000 ms)
              // 4th+ dismiss -> wait 24 hours (86,400,000 ms)
              
              let requiredDelay = 0;
              if (data.count === 1) requiredDelay = 10 * 60 * 1000;
              else if (data.count === 2) requiredDelay = 30 * 60 * 1000;
              else if (data.count === 3) requiredDelay = 60 * 60 * 1000;
              else requiredDelay = 24 * 60 * 60 * 1000;

              if (elapsed > requiredDelay) {
                shouldShow = true;
              }
            } catch (e) {
              shouldShow = true;
            }
          }

          if (shouldShow) {
            setShow(true);
          }
        }
      }, 10000); // 10 seconds delay so it doesn't overlap immediately

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAllow = async () => {
    setShow(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ag_dismiss_notif_data', JSON.stringify({ count: 999, lastDismissed: Date.now() }));
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await requestForToken();
        if (token) {
          setFcmToken(token);
        }
      }
    } catch (err) {
      console.warn('[FCM] requestPermission() failed.', err);
    }
  };

  const handleDismiss = () => {
    const dismissDataStr = localStorage.getItem('ag_dismiss_notif_data');
    let count = 1;
    if (dismissDataStr) {
      try {
        const data: DismissData = JSON.parse(dismissDataStr);
        count = (data.count || 0) + 1;
      } catch (e) {}
    }
    localStorage.setItem('ag_dismiss_notif_data', JSON.stringify({
      count,
      lastDismissed: Date.now()
    }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 p-4 max-w-sm w-[calc(100%-2rem)] bg-background border border-border rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <i className="fa-regular fa-bell text-lg"></i>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">{t.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t.desc}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAllow}
              className="flex-1 bg-primary text-white hover:bg-primary/90 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {t.allow}
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {t.not_now}
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground absolute top-2 right-2 p-2">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
};
