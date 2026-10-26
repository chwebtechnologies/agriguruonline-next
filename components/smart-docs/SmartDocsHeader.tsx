'use client';

import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { AgriGuruLogo } from '@/components/layout/HeaderGuest';
import { AppMenu } from '@/components/layout/AppMenu';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useNotification } from '@/components/providers/NotificationProvider';
import { getAssetsUrl, getNormalizedUserType, getUserApiUrl, getTradingApiUrl } from '@/lib/api-utils';
import { customFetch } from '@/lib/api';
import { logoutUser } from '@/app/actions/auth';
import BecomeMemberModal from '@/components/membership/BecomeMemberModal';
import { setUnreadStatusInIndexedDB } from '@/lib/notificationStorage';

interface SmartDocsHeaderProps {
  activeLang: string;
  dict?: any;
  profile?: any;
  token?: string;
  initialNotifications?: any[];
  initialAlerts?: any[];
  initialAiPredicts?: any[];
}

export function SmartDocsHeader({
  activeLang = 'en',
  dict,
  profile: initialProfile,
  token,
  initialNotifications = [],
  initialAlerts = [],
  initialAiPredicts = [],
}: SmartDocsHeaderProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const { hasUnread, setHasUnread } = useNotification();

  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBecomeMemberOpen, setIsBecomeMemberOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState<'notifications' | 'alerts' | 'ai_predicts'>('notifications');

  const [notificationsData, setNotificationsData] = useState<any[]>(initialNotifications);
  const [alertsData, setAlertsData] = useState<any[]>(initialAlerts);
  const [aiPredictsData, setAiPredictsData] = useState<any[]>(initialAiPredicts);

  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingAiPredicts, setIsLoadingAiPredicts] = useState(false);

  const [localUnread, setLocalUnread] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const dir = activeLang === 'ar' ? 'rtl' : 'ltr';

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  const activeLanguage = languages.find((l) => l.code === activeLang) || languages[0];

  const getLangUrl = (newLang: string) => {
    const p = pathname || '/';
    const s = typeof window !== 'undefined' ? window.location.search : '';
    const segments = p.split('/').filter(Boolean);
    const isFirstSegmentLang = ['en', 'ar', 'zh', 'fr'].includes(segments[0]);

    if (isFirstSegmentLang) {
      segments[0] = newLang;
    } else {
      segments.unshift(newLang);
    }

    return '/' + segments.join('/') + s;
  };

  const handleLanguageSelect = (e: React.MouseEvent, targetLang: string) => {
    e.preventDefault();
    if (targetLang === activeLang) return;
    const targetUrl = getLangUrl(targetLang);
    startTransition(() => {
      router.replace(targetUrl, { scroll: false });
    });
  };

  // Keep state synced with props
  useEffect(() => {
    if (initialProfile) setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (initialNotifications?.length > 0) setNotificationsData(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    if (initialAlerts?.length > 0) setAlertsData(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    if (initialAiPredicts?.length > 0) setAiPredictsData(initialAiPredicts);
  }, [initialAiPredicts]);

  // Click outside listener for notifications, profile, and language dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setIsLoadingNotifications(true);
    try {
      const url = `${getUserApiUrl()}/custom-notification?lang_code=${activeLang}&source=web`;
      const res = await customFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        const extracted = Array.isArray(data)
          ? data
          : Array.isArray(data?.data?.notifications)
          ? data.data.notifications
          : Array.isArray(data?.data?.data)
          ? data.data.data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setNotificationsData(extracted);
      }
    } catch (err) {
      console.error('[SmartDocsHeader] notifications fetch failed:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token, activeLang]);

  // Fetch alerts
  const fetchAlerts = useCallback(async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setIsLoadingAlerts(true);
    try {
      const url = `${getTradingApiUrl()}/price-alert?lang_code=${activeLang}&source=web`;
      const res = await customFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        const extracted = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setAlertsData(extracted);
      }
    } catch (err) {
      console.error('[SmartDocsHeader] alerts fetch failed:', err);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [token, activeLang]);

  // Fetch AI predicts
  const fetchAiPredicts = useCallback(async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setIsLoadingAiPredicts(true);
    try {
      const url = `${getUserApiUrl()}/ai-predict?lang_code=${activeLang}&source=web`;
      const res = await customFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        const extracted = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setAiPredictsData(extracted);
      }
    } catch (err) {
      console.error('[SmartDocsHeader] ai-predicts fetch failed:', err);
    } finally {
      setIsLoadingAiPredicts(false);
    }
  }, [token, activeLang]);

  const handleOpenNotifications = () => {
    const nextState = !isNotificationsOpen;
    setIsNotificationsOpen(nextState);
    if (nextState) {
      setIsProfileOpen(false);
      setIsLangOpen(false);
      setHasUnread(false);
      setLocalUnread(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ag_has_unread_notif');
      }
      setUnreadStatusInIndexedDB(false);

      if (activeNotificationTab === 'notifications') {
        fetchNotifications(notificationsData.length === 0);
      } else if (activeNotificationTab === 'alerts') {
        fetchAlerts(alertsData.length === 0);
      } else if (activeNotificationTab === 'ai_predicts') {
        fetchAiPredicts(aiPredictsData.length === 0);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      window.location.href = `/${activeLang}/login`;
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = `/${activeLang}/login`;
    }
  };

  const showUnreadDot = hasUnread || localUnread;

  return (
    <>
      <div id="site-header" className="w-full flex flex-col z-[70] bg-background sticky top-0 shrink-0" dir={dir}>
        <header
          id="smart-docs-header"
          data-auth="true"
          className="relative w-full bg-card text-foreground py-2 sm:py-2.5 border-b border-border shadow-xs transition-all duration-300"
          style={{ paddingLeft: 'var(--ag-container-px)', paddingRight: 'var(--ag-container-px)' }}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-1.5 sm:gap-3">
            
            {/* LEFT SIDE: Menu Icon -> Logo -> AgriGuru Online Text (sm+) -> Smart Docs Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 min-w-0 shrink-0">
              
              {/* Menu Icon before logo - unified h-8 / h-9 */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                <AppMenu
                  dict={dict}
                  align="left"
                  profile={profile}
                  isOpen={isMenuOpen}
                  onOpenChange={setIsMenuOpen}
                  onOpenBecomeMemberModal={() => setIsBecomeMemberOpen(true)}
                >
                  <div
                    className="flex items-center justify-center text-foreground hover:text-primary rounded-lg transition-colors w-8 h-8 sm:w-9 sm:h-9 hover:bg-muted/80 cursor-pointer"
                    aria-label="Open Navigation Menu"
                    role="button"
                    tabIndex={0}
                  >
                    <i className="fa-solid fa-bars text-lg sm:text-2xl flex items-center justify-center"></i>
                  </div>
                </AppMenu>
              </div>

              {/* Logo - unified 32px / 36px sizing */}
              <Link
                href={`/${activeLang}`}
                aria-label="AgriGuru Online Home"
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 focus:outline-none rounded shrink-0"
              >
                <AgriGuruLogo size={36} className="!w-8 !h-8 sm:!w-9 sm:!h-9" />
              </Link>

              {/* AgriGuru Online Text: Visible on sm+ screens */}
              <Link
                href={`/${activeLang}`}
                className="hidden sm:inline-flex items-center focus:outline-none shrink-0"
              >
                <span className="font-extrabold text-sm sm:text-base lg:text-lg tracking-tight text-foreground whitespace-nowrap">
                  AgriGuru Online
                </span>
              </Link>

              {/* Priority #1: Smart Docs Title - Clean gradient typography, no icon, seamless brand look */}
              <Link
                href={`/${activeLang}/smart-docs`}
                className="inline-flex items-center focus:outline-none shrink-0 group"
                title="Smart Docs Workspace"
              >
                <span className="font-extrabold text-sm sm:text-base lg:text-lg tracking-tight bg-[image:var(--ag-gradient-heading)] bg-clip-text text-transparent group-hover:opacity-85 transition-opacity whitespace-nowrap">
                  {dict?.header?.smart_docs || 'Smart Docs'}
                </span>
              </Link>
            </div>

            {/* RIGHT SIDE: Marketplace Button -> Language Option -> Theme Toggle (Desktop only) -> Notifications -> Profile */}
            <div className="flex items-center gap-1 sm:gap-2 select-none sm:border-s sm:border-border/60 sm:ps-2.5 dir-none shrink-0">
              
              {/* 1. Marketplace Button - unified h-8 / h-9 */}
              <Link
                href={`/${activeLang}`}
                className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg inline-flex items-center justify-center gap-1 sm:gap-1.5 bg-primary-gradient text-xs sm:text-sm font-bold text-white shadow-xs hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
                title="Go to Marketplace"
              >
                <i className="fa-solid fa-store text-xs sm:text-sm"></i>
                <span className="hidden sm:inline">{dict?.header?.marketplace || 'Marketplace'}</span>
              </Link>

              {/* 2. Language Change Option - unified h-8 / h-9 */}
              <div className="relative inline-block text-left shrink-0" ref={langRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsLangOpen(!isLangOpen);
                    setIsNotificationsOpen(false);
                    setIsProfileOpen(false);
                  }}
                  className="h-8 sm:h-9 px-1.5 sm:px-2.5 flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 border border-border text-xs sm:text-sm font-bold transition-all focus:outline-none cursor-pointer select-none hover:scale-105 active:scale-95 duration-200 shrink-0"
                  aria-label="Select Language"
                >
                  <span className="text-sm sm:text-base leading-none">{activeLanguage.flag}</span>
                  <span className="hidden md:inline font-bold">{activeLanguage.name}</span>
                  {isPending ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-[9px] text-muted-foreground"></i>
                  ) : (
                    <i className={`fa-solid fa-chevron-down text-[8px] sm:text-[9px] text-muted-foreground transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`}></i>
                  )}
                </button>

                {isLangOpen && (
                  <div
                    className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-36 rounded-xl bg-card border border-border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150`}
                  >
                    <div className="py-1">
                      {languages.map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          onClick={(e) => {
                            setIsLangOpen(false);
                            handleLanguageSelect(e, l.code);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs sm:text-[13px] hover:bg-muted transition-colors cursor-pointer ${
                            activeLang === l.code ? 'text-primary bg-primary/10 font-bold' : 'text-foreground font-semibold'
                          }`}
                        >
                          <span className="text-base">{l.flag}</span>
                          <span>{l.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Theme Toggle (Desktop only: hidden on mobile & tablet to avoid responsive cramping!) */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle dark/light theme"
                className="w-8 h-8 sm:w-9 sm:h-9 hidden lg:flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none cursor-pointer hover:scale-105 active:scale-95 duration-200 shrink-0"
              >
                <i className={`fa-solid ${theme === 'dark' ? 'fa-sun text-amber-400' : 'fa-moon text-slate-600 dark:text-slate-300'} text-sm sm:text-base`}></i>
              </button>

              {/* 4. Notifications Dropdown - unified h-8 / h-9 */}
              <div className="relative shrink-0" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={handleOpenNotifications}
                  className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/80 transition-colors focus:outline-none hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0"
                  aria-label="Open notifications"
                >
                  <div className="relative inline-flex items-center justify-center">
                    <i className="fa-solid fa-bell text-[18px] sm:text-[20px]"></i>
                    {showUnreadDot && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-background animate-pulse z-30 pointer-events-none" />
                    )}
                  </div>
                </button>

                {/* Notifications Popover */}
                {isNotificationsOpen && (
                  <div
                    className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-2 w-[340px] sm:w-[420px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-card border border-border p-3 sm:p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200`}
                  >
                    {/* Notification Tabs */}
                    <div className="flex items-center p-1 bg-muted rounded-lg mb-2">
                      <button
                        onClick={() => {
                          setActiveNotificationTab('notifications');
                          fetchNotifications(notificationsData.length === 0);
                        }}
                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                          activeNotificationTab === 'notifications'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {dict?.header?.notifications || 'Notifications'}
                      </button>
                      <button
                        onClick={() => {
                          setActiveNotificationTab('alerts');
                          fetchAlerts(alertsData.length === 0);
                        }}
                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                          activeNotificationTab === 'alerts'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {dict?.header?.alerts || 'Alerts'}
                      </button>
                      <button
                        onClick={() => {
                          setActiveNotificationTab('ai_predicts');
                          fetchAiPredicts(aiPredictsData.length === 0);
                        }}
                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                          activeNotificationTab === 'ai_predicts'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {dict?.header?.ai_predicts || 'AI Predicts'}
                      </button>
                    </div>

                    {/* Tab Body */}
                    <div className="min-h-[140px] max-h-[360px] overflow-y-auto">
                      {activeNotificationTab === 'notifications' && (
                        <div>
                          {isLoadingNotifications && notificationsData.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                            </div>
                          ) : notificationsData.length > 0 ? (
                            <div className="flex flex-col space-y-2">
                              {notificationsData.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-foreground">{item.title || 'Notification'}</h4>
                                    <span className="text-[10px] text-muted-foreground">
                                      {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                    {item.message || item.description || ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                              <i className="fa-regular fa-bell text-2xl mb-2 opacity-50" />
                              <p className="text-xs">{dict?.header?.no_notifications || 'No notifications'}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeNotificationTab === 'alerts' && (
                        <div>
                          {isLoadingAlerts && alertsData.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                            </div>
                          ) : alertsData.length > 0 ? (
                            <div className="flex flex-col space-y-2">
                              {alertsData.map((alert, idx) => (
                                <div key={alert.id || idx} className="p-2.5 rounded-lg border border-border bg-card">
                                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                    <span>{alert.product_name || alert.commodity_name || 'Price Alert'}</span>
                                    <span className="text-primary font-mono">${alert.target_price || alert.price}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {alert.origin_country || alert.loading_port || 'Active'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                              <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 opacity-50" />
                              <p className="text-xs">{dict?.header?.no_alerts || 'No active alerts'}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeNotificationTab === 'ai_predicts' && (
                        <div>
                          {isLoadingAiPredicts && aiPredictsData.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                            </div>
                          ) : aiPredictsData.length > 0 ? (
                            <div className="flex flex-col space-y-2">
                              {aiPredictsData.map((pred, idx) => (
                                <div key={pred.id || idx} className="p-2.5 rounded-lg border border-border bg-card">
                                  <div className="text-xs font-bold text-foreground">
                                    {pred.commodity_name || pred.product_name || 'AI Market Forecast'}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                    {pred.prediction_text || pred.trend_description || 'Bullish trend predicted'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                              <i className="fa-solid fa-brain text-2xl mb-2 opacity-50" />
                              <p className="text-xs">{dict?.header?.no_ai_predictions || 'No AI predictions'}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. User Profile Button - unified 32px / 36px avatar with green dot and no cramped text */}
              <div className="relative shrink-0" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(!isProfileOpen);
                    setIsNotificationsOpen(false);
                    setIsLangOpen(false);
                  }}
                  className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-muted text-foreground hover:bg-muted/80 transition-all border border-border shadow-xs hover:scale-105 active:scale-95 duration-200 cursor-pointer overflow-hidden focus:outline-none"
                  aria-label={dict?.navigation?.profile || "User Profile"}
                >
                  {profile?.profile_image ? (
                    <Image
                      className="rounded-full object-cover"
                      src={
                        profile.profile_image.startsWith('http')
                          ? profile.profile_image
                          : `${getAssetsUrl()}${profile.profile_image.startsWith('/') ? '' : '/'}${profile.profile_image}`
                      }
                      alt="Profile"
                      title={dict?.navigation?.profile || "User Profile"}
                      fill
                      sizes="36px"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}

                  <div 
                    className="flex items-center justify-center w-full h-full"
                    style={{ display: profile?.profile_image ? 'none' : 'flex' }}
                  >
                    <i className="fa-solid fa-user text-xs sm:text-sm"></i>
                  </div>

                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-background ring-1 ring-emerald-500/20 z-10" />
                </button>

                {/* Profile Menu Popover */}
                {isProfileOpen && (
                  <div
                    className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-2 w-64 rounded-2xl bg-card border border-border p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200`}
                  >
                    {/* User Profile Card */}
                    <div className="p-2 border-b border-border/80 pb-3 mb-2 flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 overflow-hidden relative border border-border">
                        {profile?.profile_image ? (
                          <Image
                            src={
                              profile.profile_image.startsWith('http')
                                ? profile.profile_image
                                : `${getAssetsUrl()}${profile.profile_image.startsWith('/') ? '' : '/'}${profile.profile_image}`
                            }
                            alt="Profile"
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <i className="fa-solid fa-user text-sm" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {profile?.first_name ? `${profile.first_name} ${profile?.last_name || ''}` : profile?.name || 'AgriTrade User'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{profile?.email || 'Connected'}</p>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary uppercase tracking-wide mt-0.5">
                          {profile?.membership?.plan_name || 'Member'}
                        </span>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="flex flex-col space-y-1">
                      <Link
                        href={`/${activeLang}/profile`}
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-circle-user text-primary w-4" />
                        <span>{dict?.header?.my_profile || 'My Profile'}</span>
                      </Link>

                      <Link
                        href={`/${activeLang}/dashboard`}
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-table-cells-large text-emerald-600 dark:text-emerald-400 w-4" />
                        <span>{dict?.header?.dashboard || 'Dashboard'}</span>
                      </Link>

                      <Link
                        href={`/${activeLang}/my-settings`}
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-gear text-slate-500 w-4" />
                        <span>{dict?.header?.my_settings || 'Settings'}</span>
                      </Link>

                      {/* Theme switcher inside profile dropdown for mobile */}
                      <button
                        type="button"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="flex lg:hidden items-center justify-between w-full px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun text-amber-400' : 'fa-moon text-slate-600 dark:text-slate-300'} w-4`} />
                          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize">{theme}</span>
                      </button>

                      <div className="border-t border-border/80 my-1 pt-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <i className="fa-solid fa-arrow-right-from-bracket w-4" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Become Member Modal */}
      {isBecomeMemberOpen && (
        <BecomeMemberModal
          isOpen={isBecomeMemberOpen}
          onClose={() => setIsBecomeMemberOpen(false)}
          lang={activeLang}
          userProfile={profile}
          dict={dict}
        />
      )}
    </>
  );
}

export default SmartDocsHeader;
