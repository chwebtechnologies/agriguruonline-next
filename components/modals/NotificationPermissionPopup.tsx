"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/components/providers/NotificationProvider';
import { isUserLoggedIn } from '@/lib/auth-client';
import { syncFcmTokenAction } from '@/app/actions/auth';
import { toast } from 'sonner';

interface DismissData {
  count: number;
  lastDismissed: number;
}

/**
 * Interval Strategy for reminders:
 * 1st dismissal: 5 mins
 * 2nd dismissal: 15 mins
 * 3rd dismissal: 1 hour
 * 4th dismissal: 6 hours
 * 5th+ dismissal: 24 hours (daily reminder)
 */
const getIntervalDelayMs = (count: number): number => {
  if (count <= 1) return 5 * 60 * 1000;       // 5 mins
  if (count === 2) return 15 * 60 * 1000;     // 15 mins
  if (count === 3) return 1 * 60 * 60 * 1000; // 1 hour
  if (count === 4) return 6 * 60 * 60 * 1000; // 6 hours
  return 24 * 60 * 60 * 1000;                 // 24 hours (daily)
};

/**
 * Robust detection of Incognito / Private Browsing mode
 */
const isIncognitoMode = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  // 1. detectincognitojs library detection
  try {
    const { detectIncognito } = await import('detectincognitojs');
    const result = await detectIncognito();
    if (result && result.isPrivate) {
      return true;
    }
  } catch (e) {}

  // 2. Storage quota check: In Chromium incognito, quota is capped strictly to < 125MB (normally 50GB+)
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { quota } = await navigator.storage.estimate();
      if (quota && quota < 125 * 1024 * 1024) {
        return true;
      }
    }
  } catch (e) {}

  return false;
};

export const NotificationPermissionPopup = () => {
  const [show, setShow] = useState(false);
  const { setFcmToken } = useNotification();
  const [lang, setLang] = useState<'en' | 'ar' | 'fr' | 'zh'>('en');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      badge: "Notifications Blocked",
      title: "Notifications are blocked",
      desc: "Notifications are blocked in your browser settings. Click the 🔒 lock or tune icon in your address bar, set Notifications to 'Allow', then click Check Permission below.",
      ask_later: "Ask me later",
      check_permission: "Check Permission",
      enabled_success: "Notifications enabled successfully!",
      will_remind: "We'll remind you later.",
      still_blocked: "Notifications are still blocked. Please allow them in your browser URL bar (lock/tune icon), then click Check Permission.",
    },
    ar: {
      badge: "الإشعارات محظورة",
      title: "تم حظر الإشعارات",
      desc: "الإشعارات محظورة حاليًا في إعدادات المتصفح. انقر على رمز القفل 🔒 بجانب شريط العناوين واسمح بالإشعارات، ثم انقر على التحقق من الإذن أدناه.",
      ask_later: "ذكّرني لاحقاً",
      check_permission: "التحقق من الإذن",
      enabled_success: "تم تفعيل الإشعارات بنجاح!",
      will_remind: "سنقوم بتذكيرك لاحقاً.",
      still_blocked: "لا تزال الإشعارات محظورة. يرجى السماح بها من رمز القفل في شريط العناوين ثم النقر على التحقق من الإذن.",
    },
    fr: {
      badge: "Notifications bloquées",
      title: "Les notifications sont bloquées",
      desc: "Les notifications sont actuellement bloquées dans votre navigateur. Cliquez sur le cadenas 🔒 dans la barre d'adresse, autorisez les notifications, puis cliquez sur Vérifier la permission.",
      ask_later: "Plus tard",
      check_permission: "Vérifier la permission",
      enabled_success: "Notifications activées avec succès !",
      will_remind: "Nous vous le rappellerons plus tard.",
      still_blocked: "Les notifications sont toujours bloquées. Veuillez les autoriser dans la barre d'adresse (icône de cadenas), puis cliquez sur Vérifier.",
    },
    zh: {
      badge: "通知已被拦截",
      title: "通知在浏览器中已被禁用",
      desc: "通知当前在您的浏览器设置中被拦截。请点击地址栏旁的锁形图标 🔒 并将通知权限设为“允许”，然后点击下方的“检查权限”。",
      ask_later: "稍后提醒",
      check_permission: "检查权限",
      enabled_success: "通知已成功开启！",
      will_remind: "稍后会再次提醒您。",
      still_blocked: "通知仍被拦截。请点击地址栏的锁形图标允许通知，然后点击“检查权限”。",
    },
  };
  const t = dict[lang] || dict.en;

  /**
   * Helper to register FCM token with the backend immediately.
   */
  const syncTokenToBackend = useCallback(async (token: string) => {
    try {
      setFcmToken(token);
      const syncResult = await syncFcmTokenAction(token);
      if (syncResult?.success) {
        console.log('[FCM] Token successfully registered with backend via API');
      } else {
        console.warn('[FCM] Set FCM token API returned warning:', syncResult?.message);
      }
    } catch (err) {
      console.error('[FCM] Error calling set FCM token API:', err);
    }
  }, [setFcmToken]);

  const checkAndSchedulePrompt = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // 1. Strictly for logged-in users only — never for guests
    if (!isUserLoggedIn()) {
      setShow(false);
      return;
    }

    // 2. Browser supports Notification API
    if (!('Notification' in window)) {
      setShow(false);
      return;
    }

    // 3. INCOGNITO / PRIVATE BROWSING: NEVER SHOW ANY POPUP!
    const isPrivate = await isIncognitoMode();
    if (isPrivate) {
      setShow(false);
      return;
    }

    // 4. If already granted, sync token if missing and NEVER show popup
    if (Notification.permission === 'granted') {
      setShow(false);
      try {
        const { requestForToken } = await import('@/lib/firebase');
        const token = await requestForToken();
        if (token) {
          await syncTokenToBackend(token);
        }
      } catch (err) {
        console.warn('[FCM] Token check error:', err);
      }
      return;
    }

    // 5. If permission is 'default' (User has not yet allowed or blocked):
    // DO NOT show custom popup! Trigger the BROWSER'S native prompt instead!
    if (Notification.permission === 'default') {
      setShow(false);

      // Trigger the browser's native prompt on the first user interaction
      const handleUserGestureForNativePrompt = async () => {
        try {
          if (Notification.permission === 'default') {
            const privateCheck = await isIncognitoMode();
            if (privateCheck) return;

            let permResult: NotificationPermission = 'default';
            if ('requestPermission' in Notification) {
              const res = Notification.requestPermission();
              if (res && typeof (res as any).then === 'function') {
                permResult = await res;
              } else {
                permResult = await new Promise((resolve) => {
                  Notification.requestPermission((p) => resolve(p));
                });
              }
            }

            if (permResult === 'granted') {
              localStorage.setItem(
                'ag_dismiss_notif_data',
                JSON.stringify({ count: 999, lastDismissed: Date.now() })
              );
              try {
                const { requestForToken } = await import('@/lib/firebase');
                const token = await requestForToken();
                if (token) {
                  await syncTokenToBackend(token);
                }
              } catch (e) {}
            } else if (permResult === 'denied') {
              // User explicitly clicked "Block" on browser native dialog!
              // Now that the browser will never open the prompt again, show the settings guidance popup!
              setShow(true);
            }
          }
        } catch (e) {}
      };

      window.addEventListener('click', handleUserGestureForNativePrompt, { once: true });
      window.addEventListener('touchstart', handleUserGestureForNativePrompt, { once: true });
      return;
    }

    // 6. ONLY if permission is 'denied' (permanently blocked by user in browser settings):
    // Show the custom popup guiding the user to allow notifications from URL lock icon / settings!
    if (Notification.permission === 'denied') {
      const dismissDataStr = localStorage.getItem('ag_dismiss_notif_data');
      if (!dismissDataStr) {
        setShow(true);
        return;
      }

      try {
        const data: DismissData = JSON.parse(dismissDataStr);
        if (data.count >= 999) return;
        const elapsed = Date.now() - (data.lastDismissed || 0);
        const requiredDelay = getIntervalDelayMs(data.count);

        if (elapsed >= requiredDelay) {
          setShow(true);
        } else {
          const remainingTime = requiredDelay - elapsed;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isUserLoggedIn() && Notification.permission === 'denied') {
              isIncognitoMode().then((incog) => {
                if (!incog) setShow(true);
              });
            }
          }, Math.min(remainingTime, 2147483647));
        }
      } catch {
        setShow(true);
      }
      return;
    }
  }, [syncTokenToBackend]);

  useEffect(() => {
    // Initial check shortly after mount
    const initialTimer = setTimeout(() => {
      checkAndSchedulePrompt();
    }, 200);

    // Re-check when auth state changes (login/logout)
    const handleAuthChange = () => {
      setTimeout(() => {
        checkAndSchedulePrompt();
      }, 100);
    };

    // Re-check when user re-opens/focuses the browser tab (e.g. after changing settings)
    const handleVisibilityOrFocus = () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          localStorage.setItem(
            'ag_dismiss_notif_data',
            JSON.stringify({ count: 999, lastDismissed: Date.now() })
          );
          setShow(false);
        } else if (document.visibilityState === 'visible') {
          checkAndSchedulePrompt();
        }
      }
    };

    window.addEventListener('auth-state-change', handleAuthChange);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('auth-state-change', handleAuthChange);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [checkAndSchedulePrompt]);

  const handleCheckPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      localStorage.setItem(
        'ag_dismiss_notif_data',
        JSON.stringify({ count: 999, lastDismissed: Date.now() })
      );
      setShow(false);
      toast.success(t.enabled_success);
      try {
        const { requestForToken } = await import('@/lib/firebase');
        const token = await requestForToken();
        if (token) {
          await syncTokenToBackend(token);
        }
      } catch (err) {}
    } else {
      toast.warning(t.still_blocked);
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

    const now = Date.now();
    localStorage.setItem(
      'ag_dismiss_notif_data',
      JSON.stringify({
        count,
        lastDismissed: now,
      })
    );

    setShow(false);
    toast.info(t.will_remind);

    // Schedule re-appearance for next interval in the current tab session
    const nextInterval = getIntervalDelayMs(count);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isUserLoggedIn() && Notification.permission === 'denied') {
        isIncognitoMode().then((incog) => {
          if (!incog) setShow(true);
        });
      }
    }, nextInterval);
  };

  if (!show) return null;

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed right-3 sm:right-6 bottom-20 lg:bottom-6 z-50 max-w-[390px] w-[calc(100%-1.5rem)] sm:w-[380px] animate-in slide-in-from-right-8 fade-in-0 duration-400 ease-out"
    >
      <div className="relative overflow-hidden rounded-2xl bg-card/95 backdrop-blur-xl border-2 border-rose-500/35 dark:border-rose-500/50 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-4 sm:p-5 ring-1 ring-rose-500/10 transition-all duration-300 hover:shadow-2xl">

        {/* Top accent gradient line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-red-400 to-rose-600" />

        {/* Ambient background glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-rose-500/15 dark:bg-rose-500/25 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Row with Badge & Close Button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
            <i className="fa-solid fa-bell-slash text-[10px]" />
            {t.badge}
          </span>

          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground hover:bg-muted w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex items-start gap-3.5 mt-1">
          {/* Icon Box */}
          <div className="relative flex-shrink-0 mt-0.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-rose-500 via-red-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 border border-white/20">
              <i className="fa-solid fa-bell-slash text-lg sm:text-xl" />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm sm:text-base tracking-tight leading-snug">
              {t.title}
            </h3>
            <p className="text-xs sm:text-sm text-foreground/85 dark:text-foreground/90 leading-relaxed mt-1 font-normal">
              {t.desc}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4 pt-0.5">
          <button
            onClick={handleCheckPermission}
            className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold py-2.5 px-3 rounded-xl shadow-md shadow-rose-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-rotate-right text-xs" />
            <span>{t.check_permission}</span>
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 sm:px-4 py-2.5 bg-muted/80 hover:bg-muted text-foreground/80 hover:text-foreground active:scale-[0.98] text-xs sm:text-sm font-medium rounded-xl border border-border/80 transition-all cursor-pointer whitespace-nowrap"
          >
            {t.ask_later}
          </button>
        </div>
      </div>
    </div>
  );
};
