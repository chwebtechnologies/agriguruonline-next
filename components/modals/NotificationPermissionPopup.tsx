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

type PopupMode = 'prompt' | 'incognito' | 'denied';

/**
 * Interval Strategy for "Ask me later" / Reminders:
 * 1st dismissal: 5 mins
 * 2nd dismissal: 10 mins
 * 3rd dismissal: 15 mins
 * 4th dismissal: 30 mins
 * 5th dismissal: 1 hour
 * 6th dismissal: 2 hours
 * 7th dismissal: 12 hours
 * 8th+ dismissal: 24 hours (daily reminder)
 */
const getIntervalDelayMs = (count: number): number => {
  if (count <= 1) return 5 * 60 * 1000;       // 5 mins
  if (count === 2) return 10 * 60 * 1000;      // 10 mins
  if (count === 3) return 15 * 60 * 1000;      // 15 mins
  if (count === 4) return 30 * 60 * 1000;      // 30 mins
  if (count === 5) return 1 * 60 * 60 * 1000;  // 1 hour
  if (count === 6) return 2 * 60 * 60 * 1000;  // 2 hours
  if (count === 7) return 12 * 60 * 60 * 1000; // 12 hours
  return 24 * 60 * 60 * 1000;                 // 24 hours (daily)
};

/**
 * Robust detection of Incognito / Private Browsing mode
 */
const detectIsIncognito = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  // 1. Check via detectincognitojs library
  try {
    const { detectIncognito } = await import('detectincognitojs');
    const result = await detectIncognito();
    if (result && result.isPrivate) {
      return true;
    }
  } catch (e) {
    // Fallback heuristic below
  }

  // 2. Storage estimate heuristic (Chromium-based incognito restricts quota to < 130MB)
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { quota } = await navigator.storage.estimate();
      if (quota && quota < 130 * 1024 * 1024) {
        return true;
      }
    }
  } catch {}

  return false;
};

export const NotificationPermissionPopup = () => {
  const [show, setShow] = useState(false);
  const [popupMode, setPopupMode] = useState<PopupMode>('prompt');
  const [isAllowing, setIsAllowing] = useState(false);
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
      badge: "Instant Updates",
      title: "Stay updated!",
      desc: "Enable notifications to receive instant updates on your orders and messages.",
      allow: "Allow Notifications",
      ask_later: "Ask me later",
      got_it: "Got it",
      enabling: "Enabling...",
      enabled_success: "Notifications enabled successfully!",
      will_remind: "We'll remind you later.",

      // Incognito mode scenario
      incognito_badge: "Private Browsing",
      incognito_title: "You're in Incognito / Private Mode",
      incognito_desc: "Browser notifications cannot be received in private browsing. To ensure you don't miss any updates and messages, please switch to a normal browsing window.",

      // Denied / Blocked mode scenario
      denied_badge: "Notifications Blocked",
      denied_title: "Notifications are blocked",
      denied_desc: "Notifications are currently blocked in your browser settings. To receive latest updates, click the 🔒 lock icon next to the URL bar and change Notifications to Allow.",
    },
    ar: {
      badge: "تحديثات فورية",
      title: "ابقَ على اطلاع!",
      desc: "قم بتفعيل الإشعارات لتلقي تحديثات فورية حول طلباتك ورسائلك.",
      allow: "تفعيل الإشعارات",
      ask_later: "ذكّرني لاحقاً",
      got_it: "حسناً، فهمت",
      enabling: "جارٍ التفعيل...",
      enabled_success: "تم تفعيل الإشعارات بنجاح!",
      will_remind: "سنقوم بتذكيرك لاحقاً.",

      // Incognito mode scenario
      incognito_badge: "التصفح الخاص",
      incognito_title: "أنت في وضع التصفح الخاص (Incognito)",
      incognito_desc: "لا يمكن تلقي إشعارات المتصفح في وضع التصفح الخاص. لضمان عدم تفويت تحديثات طلباتك ورسائلك، يرجى التبديل إلى نافذة تصفح عادية.",

      // Denied / Blocked mode scenario
      denied_badge: "الإشعارات محظورة",
      denied_title: "تم حظر الإشعارات",
      denied_desc: "الإشعارات محظورة حاليًا في إعدادات المتصفح. لتلقي تحديثات فورية، انقر على رمز القفل 🔒 بجانب شريط العناوين واسمح بالإشعارات.",
    },
    fr: {
      badge: "Mises à jour instantanées",
      title: "Restez informé(e) !",
      desc: "Activez les notifications pour recevoir des alertes instantanées sur vos commandes et messages.",
      allow: "Autoriser les notifications",
      ask_later: "Plus tard",
      got_it: "Compris",
      enabling: "Activation...",
      enabled_success: "Notifications activées avec succès !",
      will_remind: "Nous vous le rappellerons plus tard.",

      // Incognito mode scenario
      incognito_badge: "Navigation privée",
      incognito_title: "Mode navigation privée détecté",
      incognito_desc: "Les notifications push ne peuvent pas être reçues en navigation privée. Pour ne manquer aucune mise à jour sur vos commandes et messages, veuillez utiliser une fenêtre normale.",

      // Denied / Blocked mode scenario
      denied_badge: "Notifications bloquées",
      denied_title: "Les notifications sont bloquées",
      denied_desc: "Les notifications sont actuellement bloquées dans votre navigateur. Cliquez sur l'icône de cadenas 🔒 dans la barre d'adresse et autorisez les notifications.",
    },
    zh: {
      badge: "即时更新",
      title: "保持最新动态！",
      desc: "开启通知即可即时接收有关您的订单和消息的更新。",
      allow: "允许通知",
      ask_later: "稍后提醒",
      got_it: "知道了",
      enabling: "正在开启...",
      enabled_success: "通知已成功开启！",
      will_remind: "稍后会再次提醒您。",

      // Incognito mode scenario
      incognito_badge: "无痕/隐私浏览",
      incognito_title: "您正处于隐身/无痕模式",
      incognito_desc: "浏览器在无痕模式下无法接收推送通知。为确保您不会错过订单和消息的实时动态，请切换至常规浏览器窗口浏览。",

      // Denied / Blocked mode scenario
      denied_badge: "通知已被拦截",
      denied_title: "通知在浏览器中已被禁用",
      denied_desc: "通知当前在您的浏览器设置中被拦截。要接收实时订单动态，请点击地址栏旁的锁形图标 🔒 并将通知权限更改为“允许”。",
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

    // 2. Detect Incognito / Private Browsing mode
    const isPrivate = await detectIsIncognito();
    if (isPrivate) {
      setPopupMode('incognito');

      // Check interval for incognito reminder
      const dismissDataStr = localStorage.getItem('ag_dismiss_notif_data');
      if (!dismissDataStr) {
        setShow(true);
        return;
      }

      try {
        const data: DismissData = JSON.parse(dismissDataStr);
        if (data.count >= 999) return; // User already allowed in another context
        const elapsed = Date.now() - (data.lastDismissed || 0);
        const requiredDelay = getIntervalDelayMs(data.count);

        if (elapsed >= requiredDelay) {
          setShow(true);
        } else {
          const remainingTime = requiredDelay - elapsed;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isUserLoggedIn()) setShow(true);
          }, Math.min(remainingTime, 2147483647));
        }
      } catch {
        setShow(true);
      }
      return;
    }

    // 3. Browser supports Notification API
    if (!('Notification' in window)) return;

    // 4. If already granted, sync token if missing and never show popup
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

    // 5. If user permanently blocked notifications in browser settings
    if (Notification.permission === 'denied') {
      setPopupMode('denied');
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
              setShow(true);
            }
          }, Math.min(remainingTime, 2147483647));
        }
      } catch {
        setShow(true);
      }
      return;
    }

    // 6. Permission is 'default' (Normal browsing prompt flow)
    setPopupMode('prompt');

    // Check if permanently marked as allowed
    const dismissDataStr = localStorage.getItem('ag_dismiss_notif_data');
    if (dismissDataStr) {
      try {
        const data: DismissData = JSON.parse(dismissDataStr);
        if (data.count >= 999) return;
      } catch (e) {}
    }

    const justLoggedIn = sessionStorage.getItem('ag_just_logged_in') === '1';

    // 7. If user just logged in, trigger browser native prompt first
    if (justLoggedIn) {
      try {
        const permResult = await Notification.requestPermission();
        if (permResult === 'granted') {
          sessionStorage.removeItem('ag_just_logged_in');
          localStorage.setItem('ag_dismiss_notif_data', JSON.stringify({ count: 999, lastDismissed: Date.now() }));
          const { requestForToken } = await import('@/lib/firebase');
          const token = await requestForToken();
          if (token) {
            await syncTokenToBackend(token);
          }
          setShow(false);
          return;
        } else if (permResult === 'denied') {
          sessionStorage.removeItem('ag_just_logged_in');
          setPopupMode('denied');
          setShow(true);
          return;
        }
      } catch (err) {
        console.log('[FCM] Native prompt requires user gesture or browser deferred it');
      }

      // If browser native prompt was ignored/deferred, show our custom popup right away!
      sessionStorage.removeItem('ag_just_logged_in');
      setShow(true);
      return;
    }

    // 8. Strategy for returning visits / browser re-open:
    if (!dismissDataStr) {
      setShow(true);
      return;
    }

    // Calculate time elapsed since last dismissal
    try {
      const data: DismissData = JSON.parse(dismissDataStr);
      const elapsed = Date.now() - (data.lastDismissed || 0);
      const requiredDelay = getIntervalDelayMs(data.count);

      if (elapsed >= requiredDelay) {
        // Cooldown has passed! Show popup again
        setShow(true);
      } else {
        // Cooldown still active: schedule it to pop up when time arrives
        const remainingTime = requiredDelay - elapsed;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (isUserLoggedIn() && Notification.permission === 'default') {
            setShow(true);
          }
        }, Math.min(remainingTime, 2147483647));
      }
    } catch {
      setShow(true);
    }
  }, [syncTokenToBackend]);

  useEffect(() => {
    // Initial check shortly after mount
    const initialTimer = setTimeout(() => {
      checkAndSchedulePrompt();
    }, 400);

    // Re-check when auth state changes (login/logout)
    const handleAuthChange = () => {
      setTimeout(() => {
        checkAndSchedulePrompt();
      }, 200);
    };

    // Re-check when user re-opens/focuses the browser tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndSchedulePrompt();
      }
    };

    window.addEventListener('auth-state-change', handleAuthChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('auth-state-change', handleAuthChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAndSchedulePrompt]);

  const handleAllow = async () => {
    setIsAllowing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem(
          'ag_dismiss_notif_data',
          JSON.stringify({ count: 999, lastDismissed: Date.now() })
        );
        setShow(false);

        // 1. Retrieve FCM token
        const { requestForToken } = await import('@/lib/firebase');
        const token = await requestForToken();
        if (token) {
          // 2. Immediately call the set-fcm API to register with backend!
          await syncTokenToBackend(token);
          toast.success(t.enabled_success);
        } else {
          console.warn('[FCM] Token generation returned null');
        }
      } else if (permission === 'denied') {
        setPopupMode('denied');
      }
    } catch (err) {
      console.warn('[FCM] requestPermission() error:', err);
    } finally {
      setIsAllowing(false);
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
      if (isUserLoggedIn()) {
        setShow(true);
      }
    }, nextInterval);
  };

  if (!show) return null;

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed right-3 sm:right-6 bottom-20 lg:bottom-6 z-50 max-w-[390px] w-[calc(100%-1.5rem)] sm:w-[380px] animate-in slide-in-from-right-8 fade-in-0 duration-400 ease-out"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-card/95 backdrop-blur-xl border-2 ${
        popupMode === 'incognito'
          ? 'border-amber-500/35 dark:border-amber-500/50'
          : popupMode === 'denied'
          ? 'border-rose-500/35 dark:border-rose-500/50'
          : 'border-primary/25 dark:border-primary/40'
      } shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-4 sm:p-5 ring-1 ${
        popupMode === 'incognito'
          ? 'ring-amber-500/10'
          : popupMode === 'denied'
          ? 'ring-rose-500/10'
          : 'ring-primary/10'
      } transition-all duration-300 hover:shadow-2xl`}>

        {/* Top accent gradient line */}
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${
          popupMode === 'incognito'
            ? 'from-amber-500 via-orange-400 to-amber-600'
            : popupMode === 'denied'
            ? 'from-rose-500 via-red-400 to-rose-600'
            : 'from-primary via-emerald-400 to-primary/80'
        }`} />

        {/* Ambient background glow */}
        <div className={`absolute -top-10 -right-10 w-28 h-28 ${
          popupMode === 'incognito'
            ? 'bg-amber-500/15 dark:bg-amber-500/25'
            : popupMode === 'denied'
            ? 'bg-rose-500/15 dark:bg-rose-500/25'
            : 'bg-primary/15 dark:bg-primary/25'
        } rounded-full blur-2xl pointer-events-none`} />

        {/* Top Header Row with Badge & Close Button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {popupMode === 'incognito' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <i className="fa-solid fa-user-secret text-[11px]" />
              {t.incognito_badge}
            </span>
          ) : popupMode === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
              <i className="fa-solid fa-bell-slash text-[10px]" />
              {t.denied_badge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t.badge}
            </span>
          )}

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
            {popupMode === 'incognito' ? (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 border border-white/20">
                <i className="fa-solid fa-user-secret text-lg sm:text-xl" />
              </div>
            ) : popupMode === 'denied' ? (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-rose-500 via-red-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 border border-white/20">
                <i className="fa-solid fa-bell-slash text-lg sm:text-xl" />
              </div>
            ) : (
              <>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 border border-white/20">
                  <i className="fa-solid fa-bell text-lg sm:text-xl fa-shake" />
                </div>
                {/* Pulsing online badge */}
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-card" />
                </span>
              </>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm sm:text-base tracking-tight leading-snug">
              {popupMode === 'incognito'
                ? t.incognito_title
                : popupMode === 'denied'
                ? t.denied_title
                : t.title}
            </h3>
            <p className="text-xs sm:text-sm text-foreground/85 dark:text-foreground/90 leading-relaxed mt-1 font-normal">
              {popupMode === 'incognito'
                ? t.incognito_desc
                : popupMode === 'denied'
                ? t.denied_desc
                : t.desc}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4 pt-0.5">
          {popupMode === 'prompt' ? (
            <>
              <button
                onClick={handleAllow}
                disabled={isAllowing}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] text-xs sm:text-sm font-semibold py-2.5 px-3 rounded-xl shadow-md shadow-primary/25 hover:shadow-primary/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isAllowing ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                    <span>{t.enabling}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check text-xs" />
                    <span>{t.allow}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                disabled={isAllowing}
                className="px-3 sm:px-4 py-2.5 bg-muted/80 hover:bg-muted text-foreground/80 hover:text-foreground active:scale-[0.98] text-xs sm:text-sm font-medium rounded-xl border border-border/80 transition-all cursor-pointer whitespace-nowrap"
              >
                {t.ask_later}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                className={`flex-1 ${
                  popupMode === 'incognito'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25'
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25'
                } active:scale-[0.98] text-xs sm:text-sm font-semibold py-2.5 px-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer`}
              >
                <i className="fa-solid fa-check text-xs" />
                <span>{t.got_it}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 sm:px-4 py-2.5 bg-muted/80 hover:bg-muted text-foreground/80 hover:text-foreground active:scale-[0.98] text-xs sm:text-sm font-medium rounded-xl border border-border/80 transition-all cursor-pointer whitespace-nowrap"
              >
                {t.ask_later}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
