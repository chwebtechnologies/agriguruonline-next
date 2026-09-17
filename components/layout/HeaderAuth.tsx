'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import CategoryLink from '@/components/category/CategoryLink'
import { usePathname, useRouter } from 'next/navigation'

import { HeaderGuest, AgriGuruLogo } from './HeaderGuest'
import { AppMenu } from '@/components/layout/AppMenu'
import { getAssetsUrl } from '@/lib/api-utils';
import { authService } from '@/lib/api';
import { HeaderSearch } from '@/components/search/HeaderSearch'
import { useNotification } from '@/components/providers/NotificationProvider'
import { getUnreadStatusFromIndexedDB, setUnreadStatusInIndexedDB } from '@/lib/notificationStorage'
import { ProductAlertCard } from '@/components/alerts/ProductAlertCard'
import { FreightAlertCard } from '@/components/alerts/FreightAlertCard'
import { AIPredictProductCard } from '@/components/alerts/AIPredictProductCard'
import { AIPredictFreightCard } from '@/components/alerts/AIPredictFreightCard'

import { SearchProduct } from '@/types/search'

interface HeaderAuthProps {
  token: string
  dict: {
    navigation: {
      login: string
      register: string
      logout: string
      dashboard?: string
      products?: string
      profile?: string
    }
    header: {
      announcement: string
      download_app: string
      contact_us: string
      search_placeholder: string
      home: string
      about_us: string
      register_here: string
      menu: string
      insights?: string
      news?: string
      events?: string
      market_updates?: string
      video_gallery?: string
      participation_gallery?: string
      upgrade_plan?: string
      free_trial?: string
      notifications?: string
      alerts?: string
      ai_predicts?: string
      no_notifications?: string
      no_alerts?: string
      no_ai_predictions?: string
      categories: {
        rice: string
        sugar: string
        grains: string
        pulses: string
        spices: string
        oil_seeds: string
        feed_meal: string
        flours: string
        edible_oil: string
        others: string
        fertilizers?: string
        pesticides?: string
        machinery?: string
      }
    }
    common?: any
  }
  activeLang: string
  categories?: Array<{ name: string; href: string }>
  profile?: any
  alerts?: any[]
  notifications?: any[]
  aiPredicts?: any[]
  initialSearchProducts?: SearchProduct[]
}

export function HeaderAuth({ token, dict, activeLang, categories: apiCategories, profile: initialProfile, alerts: initialAlerts = [], notifications: initialNotifications = [], aiPredicts: initialAiPredicts = [], initialSearchProducts = [] }: HeaderAuthProps) {
  const currentPath = usePathname()
  const isGuestPage = currentPath ? (currentPath.includes('/login') || currentPath.includes('/register')) : false

  const [profile] = useState<any>(initialProfile || null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [activeNotificationTab, setActiveNotificationTab] = useState<'notifications' | 'alerts' | 'ai_predicts'>('notifications')

  // All data is initialized from SSR props — no client-side fetching
  const [notificationsData] = useState<any[]>(initialNotifications)

  const [alertsData] = useState<any[]>(initialAlerts)

  const [aiPredictsData] = useState<any[]>(initialAiPredicts)

  const { hasUnread, setHasUnread, fcmToken } = useNotification()

  // Local unread state synced with localStorage, IndexedDB, and real-time events
  const [localUnread, setLocalUnread] = useState(false)

  useEffect(() => {
    let isMounted = true;

    // 1. Sync from both localStorage and IndexedDB
    const syncUnreadState = async () => {
      if (!isMounted) return;
      const isIdbUnread = await getUnreadStatusFromIndexedDB();
      const isLocalUnread = typeof window !== 'undefined' && localStorage.getItem('ag_has_unread_notif') === '1';
      if (isIdbUnread || isLocalUnread) {
        setLocalUnread(true);
        setHasUnread(true);
      }
    };

    syncUnreadState();

    // 2. Check SSR notifications for unread status on mount
    const checkInitialUnread = () => {
      if (initialNotifications && initialNotifications.length > 0) {
        const isItemRead = (item: any) => {
          if (!item || typeof item !== 'object') return true;
          return item.is_read === true || item.is_read === 1 || item.is_read === '1' ||
                 item.read === true || item.read === 1 || item.read === '1';
        };
        
        let hasUnreadItem = false;
        const lastSeenId = typeof window !== 'undefined' ? localStorage.getItem('ag_last_seen_notif_id') : null;

        for (const item of initialNotifications) {
          if (lastSeenId && item.id && item.id.toString() === lastSeenId) {
            break;
          }
          if (!isItemRead(item)) {
            hasUnreadItem = true;
            break;
          }
        }

        if (hasUnreadItem) {
          setLocalUnread(true);
          setHasUnread(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ag_has_unread_notif', '1');
          }
          setUnreadStatusInIndexedDB(true);
        }
      }
    };

    checkInitialUnread();

    const triggerUnread = () => {
      setLocalUnread(true);
      setHasUnread(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ag_has_unread_notif', '1');
      }
      setUnreadStatusInIndexedDB(true);
    };

    const onKycUpdate = (e: any) => {
      const docs = e.detail?.docs;
      if (Array.isArray(docs)) {
        const hasRejected = docs.some((d: any) => d.status?.toUpperCase() === 'REJECTED');
        if (hasRejected) {
          triggerUnread();
        }
      } else {
        triggerUnread();
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ag_has_unread_notif') {
        const val = e.newValue === '1';
        setLocalUnread(val);
        setHasUnread(val);
      }
    };

    const onFocusOrVis = () => {
      syncUnreadState();
      // checkBackendUnread(); // Removed to prevent multiple API calls on window focus
    };

    window.addEventListener('fcm-message', triggerUnread);
    window.addEventListener('new-notification', triggerUnread);
    window.addEventListener('notification-received', triggerUnread);
    window.addEventListener('kyc-notification', triggerUnread);
    window.addEventListener('kyc-docs-updated', onKycUpdate);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocusOrVis);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        onFocusOrVis();
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('fcm-message', triggerUnread);
      window.removeEventListener('new-notification', triggerUnread);
      window.removeEventListener('notification-received', triggerUnread);
      window.removeEventListener('kyc-notification', triggerUnread);
      window.removeEventListener('kyc-docs-updated', onKycUpdate);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocusOrVis);
      document.removeEventListener('visibilitychange', onFocusOrVis);
    };
  }, [token, activeLang, setHasUnread]);

  // Removed silent heartbeat as the interceptor flow is now working perfectly with web_refresh_token

  // Combined: show dot if either context OR local listener has unread
  const showUnreadDot = hasUnread || localUnread


  const categoriesRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const pathname = usePathname()
  const isHomeActive = pathname === `/${activeLang}` || pathname === `/` || pathname === `/${activeLang}/`
  const isAboutActive = pathname === `/${activeLang}/about` || pathname === `/about`
  const isDashboardActive = pathname === `/${activeLang}/dashboard` || pathname === `/dashboard`
  
  const [hideInsights, setHideInsights] = useState(false)
  const isNewsActive = pathname === `/${activeLang}/news` || pathname === `/news`
  const isEventsActive = pathname === `/${activeLang}/events` || pathname === `/events`
  const isMarketUpdatesActive = pathname === `/${activeLang}/market-updates` || pathname === `/market-updates`
  const isVideoGalleryActive = pathname === `/${activeLang}/video-gallery` || pathname === `/video-gallery`
  const isParticipationGalleryActive = pathname === `/${activeLang}/participation-gallery` || pathname === `/participation-gallery` || pathname?.startsWith(`/${activeLang}/participation-gallery/`) || pathname?.startsWith('/participation-gallery/') || pathname === `/${activeLang}/photo-gallery` || pathname === `/photo-gallery`
  const isInsightsActive = isNewsActive || isEventsActive || isMarketUpdatesActive || isVideoGalleryActive || isParticipationGalleryActive
  
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  // SSR props are used directly for state initialization above.
  // No useEffect needed to sync them — they are passed once at mount time from the Server Component.

  // Scroll listener for sticky collapse behavior with hysteresis to prevent blinking loops
  useEffect(() => {
    let scrolled = false
    const handleScroll = () => {
      const sy = window.scrollY

      if (scrolled) {
        if (sy < 20) {
          scrolled = false
          setIsScrolled(false)
        }
      } else {
        // Protect against Mac rubber-banding collapsing the bar on short pages
        if (document.documentElement.scrollHeight > window.innerHeight + 150) {
          // Use a threshold gap (120px vs 20px) that exceeds the header shrink amount (~80px).
          // This prevents the browser's scroll anchoring from forcing an infinite loop.
          if (sy > 120) {
            scrolled = true
            setIsScrolled(true)
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])



  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(navigator.userAgent.toUpperCase().indexOf('MAC') >= 0)
  }, [])



  const categoriesList = apiCategories || []

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // All notification data is provided by SSR. No client-side fetching needed.
  // The refs hasFetchedNotificationsRef, hasFetchedAlertsRef, hasFetchedAiPredictsRef are always true.

  // Sync FCM Token with backend reliably (at most once per session)
  const fcmSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (fcmToken && token) {
      if (typeof window !== 'undefined' && sessionStorage.getItem('ag_fcm_synced') === fcmToken) {
        return;
      }
      if (fcmSyncedRef.current === fcmToken) return;
      fcmSyncedRef.current = fcmToken;

      authService.setFcmToken(fcmToken, token)
      .then(res => {
        if (res.ok) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('ag_fcm_synced', fcmToken);
          }
          console.log('[FCM] Token synced with backend successfully.');
        }
      })
      .catch(err => {
        console.error("Failed to sync FCM token to backend:", err);
      });
    }
  }, [fcmToken, token]);

  // Hydration-safe responsive logic to prevent category item overflow
  const [mounted, setMounted] = useState(false)
  const [width, setWidth] = useState(1280)

  useEffect(() => {
    setTimeout(() => {
      setMounted(true)
      setWidth(window.innerWidth)
    }, 0)
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate dynamic fit based on estimated text width to keep items within bounds
  // Available width is screen width minus spacing for logo, dropdowns, and margins
  const availableWidth = mounted ? Math.max(200, width - 220) : 950
  let accumulatedWidth = 0
  let fitCount = 0
  const othersWidth = 100

  for (let i = 0; i < categoriesList.length; i++) {
    const cat = categoriesList[i]
    // Estimation formula: charLength * 7.5px + 20px (paddings and gaps)
    const estimatedWidth = cat.name.length * 7.5 + 20
    // If it is the last item and all fit, we don't reserve space for "Others" trigger
    const neededSpace = (i === categoriesList.length - 1) ? estimatedWidth : (estimatedWidth + othersWidth)

    if (accumulatedWidth + neededSpace <= availableWidth) {
      accumulatedWidth += estimatedWidth
      fitCount++
    } else {
      break
    }
  }

  const finalFitCount = categoriesList.length > 0 ? Math.max(1, fitCount) : 0
  const displayCategories = categoriesList.slice(0, finalFitCount)
  const dropdownCategories = categoriesList.slice(finalFitCount)

  if (isGuestPage) {
    return <HeaderGuest dict={dict} activeLang={activeLang} categories={apiCategories} initialSearchProducts={initialSearchProducts} />
  }

  return (
    <div id="site-header" className="w-full flex flex-col z-50 bg-background transition-theme sticky top-0 md:top-10" dir={dir}>

        {/* 2. Main Header Bar (Always sticky) */}
      <header className="relative w-full bg-card text-foreground py-2.5 px-4 border-b border-border shadow-sm transition-all duration-300">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">

          {/* Left side group containing Logo/Menu and Search bar with short spacing */}
          <div className="flex items-center flex-1 gap-3 md:gap-4">
            {/* Mobile & Desktop Menu Trigger and Logo inline */}
            <div className="flex items-center shrink-0 md:w-[110px] rtl:md:w-[130px] w-auto">
              {/* On Mobile: Always show Hamburger Menu.
                  On Desktop (md+): Only show Hamburger Menu when scrolled (replacing Logo). */}
              <div className="md:hidden">
                <AppMenu align="left" profile={profile}>
                  <div className="flex items-center gap-3 text-foreground hover:text-primary p-1.5 -ml-1.5 rounded transition-colors pointer-events-none">
                    <i className="fa-solid fa-bars text-3xl"></i>
                  </div>
                </AppMenu>
              </div>
              {isScrolled && (
                <div className="hidden md:block animate-in fade-in duration-300">
                  <AppMenu align="left" profile={profile}>
                    <div className="flex items-center gap-3 text-foreground hover:text-primary p-1.5 -ml-1.5 rounded transition-colors pointer-events-none">
                      <i className="fa-solid fa-bars text-3xl"></i>
                      <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
                    </div>
                  </AppMenu>
                </div>
              )}

              {/* Logo:
                  On Mobile: Always show.
                  On Desktop (md+): Show ONLY when NOT scrolled (replaced by Hamburger Menu when scrolled). */}
              {!isScrolled ? (
                <Link href={`/${activeLang}`} aria-label="AgriGuru Online Home" className="flex items-center gap-1.5 focus:outline-none rounded shrink-0">
                  <AgriGuruLogo size={42} />
                </Link>
              ) : (
                <div className="md:hidden">
                  <Link href={`/${activeLang}`} aria-label="AgriGuru Online Home" className="flex items-center gap-1.5 focus:outline-none rounded shrink-0">
                    <AgriGuruLogo size={42} />
                  </Link>
                </div>
              )}
            </div>

            {/* Search bar next to logo */}
            <div className="flex-1 max-w-sm md:max-w-md lg:max-w-lg">
              <HeaderSearch
                placeholder={dict.header?.search_placeholder}
                lang={activeLang}
                categories={categoriesList}
                dict={dict.common}
                initialSearchProducts={initialSearchProducts}
              />
            </div>
          </div>

          {/* Right Section: Navigation Links & Profile */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Desktop link shortcuts - matching category styling but in main header */}
            <nav className="hidden lg:flex items-center gap-8 text-[18px] whitespace-nowrap">
              <Link
                href={`/${activeLang}`}
                className={`transition-colors duration-150 font-extrabold ${isHomeActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {dict.header.home}
              </Link>
              <Link
                href="#"
                className="transition-colors duration-150 font-extrabold text-muted-foreground hover:text-foreground"
              >
                {dict.navigation.products || 'Products'}
              </Link>
              <div className="relative group" onMouseLeave={() => setHideInsights(false)}>
                <button className={`flex items-center gap-1.5 transition-colors duration-150 font-extrabold focus:outline-none ${isInsightsActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  <span>{dict.header.insights || 'Insights'}</span>
                  <i className={`fa-solid fa-chevron-down text-[11px] ml-0.5 ${isInsightsActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}></i>
                </button>
                <div className={`absolute ${activeLang === 'ar' ? 'right-0' : 'left-0'} mt-5 w-48 rounded-md bg-card border border-border p-1.5 shadow-xl transition-all duration-150 z-50 ${hideInsights ? 'hidden' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'}`}>
                  <Link href={`/${activeLang}/news`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isNewsActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.news || 'News'}</Link>
                  <Link href={`/${activeLang}/events`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isEventsActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.events || 'Events'}</Link>
                  <Link href={`/${activeLang}/market-updates`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isMarketUpdatesActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.market_updates || 'Market Updates'}</Link>
                  <Link href={`/${activeLang}/video-gallery`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isVideoGalleryActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.video_gallery || 'Video Gallery'}</Link>
                  <Link href={`/${activeLang}/participation-gallery`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isParticipationGalleryActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.participation_gallery || 'Participation Gallery'}</Link>
                </div>
              </div>
            </nav>

            <div className="flex items-center gap-4 select-none border-l border-border pl-4 dir-none">
              <div className="flex items-center gap-3">
                <Link
                  href="#"
                  className="h-10 px-5 hidden lg:inline-flex items-center justify-center rounded-lg bg-primary-gradient text-[15px] font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {profile?.membership ? (dict.header.upgrade_plan || 'Upgrade Plan') : (dict.header.free_trial || 'Free Trial')}
                </Link>

                <div className="relative" ref={notificationsRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsNotificationsOpen(prev => !prev);
                      if (!isNotificationsOpen) {
                        setHasUnread(false);
                        setLocalUnread(false);
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem('ag_has_unread_notif');
                          if (notificationsData && notificationsData.length > 0) {
                            const firstId = notificationsData[0].id;
                            if (firstId) {
                              localStorage.setItem('ag_last_seen_notif_id', firstId.toString());
                            }
                          }
                        }
                        setUnreadStatusInIndexedDB(false);
                      }
                    }}
                    className="relative flex items-center justify-center p-2 text-muted-foreground hover:text-primary transition-colors focus:outline-none hover:scale-110 active:scale-95 duration-200 cursor-pointer"
                    aria-label="Open notifications"
                  >
                    <div className="relative inline-flex items-center justify-center">
                      <i className="fa-solid fa-bell text-[28px]"></i>
                      {showUnreadDot && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-red-600 border-2 border-background animate-notif-blink z-30 pointer-events-none" />
                      )}
                    </div>
                  </button>

                  {isNotificationsOpen && (
                  <div className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-3 w-[360px] sm:w-[420px] md:w-[520px] rounded-2xl bg-card border border-border p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200`}>

                      <div className="flex items-center p-1 bg-muted rounded-lg mb-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveNotificationTab('notifications'); }}
                          className={`flex-1 py-1.5 text-[13px] font-bold rounded-md transition-all ${activeNotificationTab === 'notifications' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-background'}`}
                        >
                          {dict.header.notifications || 'Notifications'}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveNotificationTab('alerts'); }}
                          className={`flex-1 py-1.5 text-[13px] font-bold rounded-md transition-all ${activeNotificationTab === 'alerts' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-background'}`}
                        >
                          {dict.header.alerts || 'Alerts'}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveNotificationTab('ai_predicts'); }}
                          className={`flex-1 py-1.5 text-[13px] font-bold rounded-md transition-all ${activeNotificationTab === 'ai_predicts' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-background'}`}
                        >
                          {dict.header.ai_predicts || 'AI Predicts'}
                        </button>
                      </div>
                      
                      <div className="mt-2 min-h-[120px] flex flex-col justify-center">
                        {activeNotificationTab === 'notifications' && (
                          <div className="flex flex-col w-full max-h-[350px] overflow-y-auto custom-scrollbar animate-in fade-in duration-200 mt-2">
                            {notificationsData.length > 0 ? (
                              <div className="flex flex-col w-full space-y-2">
                                {notificationsData.map((item, idx) => {
                                  // If the API structure is completely unexpected, this item might be the raw JSON
                                  if (!item || typeof item !== 'object') return null;

                                  const isRead = item.is_read || item.read || false;
                                  const title = item.title || item.heading || 'Notification';
                                  const message = item.message || item.description || item.short_message || '';
                                  const image = item.image || item.thumbnail;
                                  
                                  const getActionText = (type: string, notificationType: string) => {
                                    const nt = (notificationType || '').toUpperCase();
                                    const t = (type || '').toUpperCase();
                                    
                                    if (nt.includes('INQUIRY') || nt.includes('OFFER') || nt.includes('NEGOTIATION') || nt.includes('ASSIGN')) {
                                      return 'Review Updates';
                                    }
                                    if (nt.includes('KYC')) {
                                      return 'Check Status';
                                    }
                                    if (nt.includes('MARKET') || nt.includes('REPORT') || nt.includes('PRICE')) {
                                      return 'Read Report';
                                    }
                                    if (nt.includes('NEWS') || nt.includes('EVENT')) {
                                      return 'Read More';
                                    }
                                    return 'Read More';
                                  };
                                  
                                  const notificationType = item.meta_data?.notification_type || '';
                                  const actionText = getActionText(item.type, notificationType);
                                  
                                  const handleNotificationClick = () => {
                                    let link = item.url || item.meta_data?.redirect_link;
                                    if (link) {
                                      try {
                                        const urlObj = new URL(link);
                                        if (urlObj.hostname.includes('agriguruonline.cloud')) {
                                          router.push(`/${activeLang}${urlObj.pathname}${urlObj.search}`);
                                        } else {
                                          window.location.href = link;
                                        }
                                      } catch (e) {
                                        router.push(`/${activeLang}${link.startsWith('/') ? link : '/' + link}`);
                                      }
                                    }
                                    setIsNotificationsOpen(false);
                                  };
                                  
                                  const cleanMessage = message ? message.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, ' ') : '';
                                  
                                  return (
                                    <div 
                                      key={item.id || idx} 
                                      onClick={handleNotificationClick}
                                      className={`group flex gap-3 p-3 rounded-lg border border-border transition-colors cursor-pointer ${
                                        !isRead 
                                          ? 'bg-muted/60 hover:bg-muted' 
                                          : 'bg-transparent hover:bg-muted/30'
                                      }`}
                                    >
                                      
                                      {image ? (
                                        <div className="shrink-0 w-[108px] h-[72px] rounded-md bg-muted flex items-center justify-center border border-border/50 shadow-sm overflow-hidden relative">
                                          <Image 
                                            src={image.startsWith('http') ? image : `${getAssetsUrl()}${image.startsWith('/') ? '' : '/'}${image}`} 
                                            alt={title} 
                                            fill
                                            sizes="108px"
                                            className="object-cover" 
                                          />
                                        </div>
                                      ) : (
                                        <div className="shrink-0 w-[108px] h-[72px] rounded-md bg-white flex items-center justify-center border border-border/60 shadow-sm overflow-hidden relative">
                                          <Image src="/logo.webp" alt="AgriGuru Logo" fill className="object-contain p-3" sizes="108px" />
                                        </div>
                                      )}
                                      
                                      <div className="flex-1 min-w-0 flex flex-col h-[72px] justify-start">
                                        <h4 className={`text-[13.5px] leading-tight ${!isRead ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'} truncate`}>
                                          {title}
                                        </h4>
                                        {cleanMessage && (
                                          <p className={`text-[12.5px] mt-0.5 line-clamp-2 leading-snug ${!isRead ? 'font-medium text-foreground/90' : 'text-muted-foreground'}`}>
                                            {cleanMessage}
                                          </p>
                                        )}
                                        <div className="mt-auto flex items-center justify-between pt-1">
                                          {item.created_at ? (
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium flex items-center gap-1.5">
                                              <i className="fa-regular fa-clock text-[9.5px]"></i>
                                              {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                            </span>
                                          ) : (
                                            <span />
                                          )}
                                          <span className="text-[10.5px] font-bold text-primary group-hover:underline flex items-center gap-1">
                                            {actionText} <i className="fa-solid fa-chevron-right text-[8px]"></i>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-6 text-center">
                                <i className="fa-regular fa-bell-slash text-3xl text-zinc-400 mb-3"></i>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.header.no_notifications || 'No notifications'}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {activeNotificationTab === 'alerts' && (
                          <div className="flex flex-col w-full max-h-[350px] overflow-y-auto custom-scrollbar animate-in fade-in duration-200 mt-2">
                            {alertsData.length > 0 ? (
                              <div className="flex flex-col w-full space-y-2">
                                {alertsData.map((item, idx) => {
                                  if (!item || typeof item !== 'object') return null;

                                  const alertType = item.alert_type || item.type || 'Price Alert';
                                  const isFreight = alertType.toLowerCase().includes('freight');
                                  
                                  const handleAlertClick = (id?: string) => {
                                    let link = item.url || item.redirect_link || item.meta_data?.redirect_link;
                                    if (link) {
                                      try {
                                        const urlObj = new URL(link);
                                        if (urlObj.hostname.includes('agriguruonline.cloud') || urlObj.hostname.includes('agriguruonline.com')) {
                                          router.push(`/${activeLang}${urlObj.pathname}${urlObj.search}`);
                                        } else {
                                          window.location.href = link;
                                        }
                                      } catch (e) {
                                        router.push(`/${activeLang}${link.startsWith('/') ? link : '/' + link}`);
                                      }
                                    } else {
                                      router.push(`/${activeLang}/alerts-setups`);
                                    }
                                    setIsNotificationsOpen(false);
                                  };

                                  return (
                                    <div key={item.id || idx} style={{ zoom: 0.85 }} className="w-full">
                                      {isFreight ? (
                                        <FreightAlertCard 
                                          alert={item} 
                                          isDropdownMode={true} 
                                          onSelect={handleAlertClick} 
                                        />
                                      ) : (
                                        <ProductAlertCard 
                                          alert={item} 
                                          isDropdownMode={true} 
                                          onSelect={handleAlertClick} 
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-6 text-center">
                                <i className="fa-regular fa-bell text-3xl text-zinc-400 mb-3"></i>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.header.no_alerts || 'No alerts'}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {activeNotificationTab === 'ai_predicts' && (
                          <div className="flex flex-col w-full max-h-[350px] overflow-y-auto custom-scrollbar animate-in fade-in duration-200 mt-2">
                            {aiPredictsData.length > 0 ? (
                              <div className="flex flex-col w-full space-y-2">
                                {aiPredictsData.map((item, idx) => {
                                  if (!item || typeof item !== 'object') return null;

                                  const handlePredictClick = (id?: string) => {
                                    router.push(`/${activeLang}/ai-predict`);
                                    setIsNotificationsOpen(false);
                                  };

                                  const predictType = item.predict_type || item.type || item.analysis_type || item.alert_type || 'Product';
                                  const isFreight = predictType.toLowerCase().includes('freight') || !!(item.freight_pmt || item.target_freight || item.pmt_price) || (!!item.loading_port && !!item.destination_port && !item.product?.name && !item.product_name && !item.commodity?.name);

                                  return (
                                    <div key={item.id || idx} style={{ zoom: 0.85 }} className="w-full">
                                      {isFreight ? (
                                        <AIPredictFreightCard 
                                          predict={item} 
                                          isDropdownMode={true} 
                                          onSelect={handlePredictClick} 
                                        />
                                      ) : (
                                        <AIPredictProductCard 
                                          predict={item} 
                                          isDropdownMode={true} 
                                          onSelect={handlePredictClick} 
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4 text-center animate-in fade-in duration-200">
                                <i className="fa-solid fa-brain text-3xl text-zinc-400 mb-3"></i>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.header.no_ai_predictions || 'No AI predictions'}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Link href={`/${activeLang}/profile`} prefetch={false}>
                  <div
                    className="relative flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-full bg-muted text-foreground hover:opacity-80 transition-all border border-border shadow-lg hover:scale-105 active:scale-95 duration-200"
                  >
                    {profile?.profile_image ? (
                      <Image
                        className="rounded-full border border-border object-cover"
                        src={profile.profile_image.startsWith('http') ? profile.profile_image : `${getAssetsUrl()}${profile.profile_image.startsWith('/') ? '' : '/'}${profile.profile_image}`}
                        alt="Profile"
                        title={dict.navigation.profile || "User Profile"}
                        fill
                        sizes="48px"
                        onError={(e) => {
                          // Fallback to icon on error
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    
                    <div 
                      className="flex flex-col items-center justify-center w-full h-full"
                      style={{ display: profile?.profile_image ? 'none' : 'flex' }}
                    >
                      <i className="fa-solid fa-user text-[15px] mb-0.5"></i>
                      <span className="text-[9px] font-extrabold leading-none mt-0.5">{dict.navigation.profile || 'Profile'}</span>
                    </div>
                    
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-ag-header-bg ring-2 ring-emerald-500/20" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Categories Subheader Bar */}
      <div
        className={`hidden md:block w-full bg-card text-muted-foreground px-4 transition-all duration-300 ease-in-out border-b border-border ${
          isScrolled ? 'max-h-0 py-0 border-b-0 opacity-0 overflow-hidden' : 'max-h-[100px] py-1 opacity-100 overflow-visible'
        }`}
      >
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-6">
          {/* Left-aligned Menu Trigger */}
          <div className="shrink-0 border-e border-border pe-5 flex items-center">
            <AppMenu align="left" profile={profile}>
              <div className="flex items-center gap-3 text-foreground hover:text-primary p-1.5 -ml-1.5 rounded transition-colors pointer-events-none">
                <i className="fa-solid fa-bars text-3xl"></i>
                <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
              </div>
            </AppMenu>
          </div>

          {/* Right-aligned container containing all categories with Others at the very last */}
          <div ref={categoriesRef} className="flex-1 flex justify-end items-center gap-6 overflow-visible">
            <nav className="flex items-center gap-5 text-[16px] font-bold tracking-wide whitespace-nowrap">
              {displayCategories.map((category, index) => {
                const isActive = pathname === category.href
                return (
                  <CategoryLink
                    key={index}
                    href={category.href}
                    isActive={isActive}
                    baseClassName="transition-colors border-y-2 border-t-transparent pt-1 pb-1"
                    activeClassName="text-primary border-b-primary font-extrabold"
                    inactiveClassName="text-muted-foreground border-b-transparent hover:text-foreground hover:border-b-primary font-bold"
                  >
                    {category.name}
                  </CategoryLink>
                )
              })}

              {/* "Others" Dropdown inside the same row, at the very last (on the right) */}
              {dropdownCategories.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-bold text-[16px] focus:outline-none border-y-2 border-t-transparent border-b-transparent hover:border-b-primary pt-1 pb-1">
                    <span>{dict.header.categories.others}</span>
                    <i className="fa-solid fa-chevron-down text-[11px] ml-1 text-muted-foreground group-hover:text-foreground"></i>
                  </button>
                  <div className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-3.5 w-48 rounded-md bg-card border border-border p-1.5 shadow-xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 z-50`}>
                    {dropdownCategories.map((category, index) => (
                      <Link
                        key={index}
                        href={category.href}
                        className="block px-3.5 py-2.5 text-sm text-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}
