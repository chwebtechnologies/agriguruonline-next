'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { logoutUser } from '@/app/actions/auth'

interface MenuItem {
  label: string;
  icon: string;
  href: string;
  iconBg: string;
  textColor?: string;
}

import { useParams } from 'next/navigation'

export function AppMenu({ children, align = 'right', profile }: { children?: React.ReactNode, align?: 'left' | 'right', profile?: any }) {
  const params = useParams();
  const lang = (params?.lang as string) || 'en';
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const syncTheme = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
    if (typeof window !== 'undefined') {
      syncTheme();
      window.addEventListener('theme-changed', syncTheme);
      return () => window.removeEventListener('theme-changed', syncTheme);
    }
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('theme-changed'));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const confirmLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setShowLogoutConfirm(true);
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    setIsOpen(false);
    await logoutUser();
    const currentLang = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] || 'en' : 'en';
    window.location.href = `/${currentLang}/`;
  };

  // Helper to safely extract user type string
  const getNormalizedType = (typeData: any) => {
    if (!typeData) return '';
    if (typeof typeData === 'string') return typeData.toLowerCase();
    if (typeof typeData === 'object') return String(typeData.name || typeData.title || '').toLowerCase();
    return String(typeData).toLowerCase();
  };

  // Determine dynamic label for My Inquiries / My Offers
  const isSeller = getNormalizedType(profile?.user_type) === 'seller' || getNormalizedType(profile?.role) === 'seller';
  const isMember = !!profile?.membership;
  const inquiriesLabel = (isMember && isSeller) ? 'My Offers' : 'My Inquiries';

  // Grouped like Agriguru Online Settings
  const MENU_GROUPS: MenuItem[][] = [
    [
      { label: 'Dashboard', icon: 'fa-solid fa-table-cells-large', href: '#', iconBg: 'bg-blue-500' },      
    ],
    [
      { label: inquiriesLabel, icon: 'fa-solid fa-comments', href: '#', iconBg: 'bg-indigo-500' },
      { label: 'Product Charts', icon: 'fa-solid fa-chart-line', href: `/${lang}/product-charts`, iconBg: 'bg-orange-500' },
      { label: 'Freight Charts', icon: 'fa-solid fa-chart-area', href: `/${lang}/freight-charts`, iconBg: 'bg-amber-500' },
    ],
    [
      { label: 'Alerts Setups', icon: 'fa-solid fa-bell', href: `/${lang}/alerts-setups`, iconBg: 'bg-rose-500' },
      { label: 'AI Predicts', icon: 'fa-solid fa-microchip', href: '#', iconBg: 'bg-purple-500' },
    ],
    [
      { label: 'Smart Docs', icon: 'fa-solid fa-file-pen', href: '#', iconBg: 'bg-cyan-500' },
      { label: 'Instructions', icon: 'fa-solid fa-person-chalkboard', href: '#', iconBg: 'bg-teal-500' },
      { label: 'Market Reports', icon: 'fa-solid fa-file-contract', href: `/${lang}/market-reports`, iconBg: 'bg-sky-500' },
    ],
    [
      { label: 'Messages', icon: 'fa-solid fa-comment-dots', href: 'https://wa.me/918980131000?text=Hey%2C%20I%20want%20to%20connect%21', iconBg: 'bg-green-500' },
      { label: 'My Settings', icon: 'fa-solid fa-gear', href: '#', iconBg: 'bg-zinc-500' },
      { label: 'My Profile', icon: 'fa-solid fa-circle-user', href: `/${lang}/profile`, iconBg: 'bg-zinc-500' },
    ]
  ];

  if (profile) {
    MENU_GROUPS.push([
      { label: 'Logout', icon: 'fa-solid fa-power-off', href: '#', iconBg: 'bg-brand-red', textColor: 'text-brand-red hover:text-brand-red-hover' },
    ]);
  }

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isRtl = lang === 'ar';
  let alignClass = '';
  if (align === 'left') {
    alignClass = isRtl ? 'right-0 origin-top-right' : 'left-0 origin-top-left';
  } else {
    alignClass = isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right';
  }

  return (
    <div className="relative" ref={menuRef} suppressHydrationWarning>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="cursor-pointer bg-transparent border-0 p-0 m-0 appearance-none outline-none"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        {children || (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background border border-border shadow-sm hover:shadow text-foreground transition-all">
            <i className="fa-solid fa-bars text-xl"></i>
          </div>
        )}
      </div>

      {/* --- DESKTOP DROPDOWN VIEW (Ultra Compact Single Column Agriguru Online Settings) --- */}
      <div className={`hidden md:block absolute top-[calc(100%+0.5rem)] ${alignClass} w-[260px] bg-background border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl overflow-hidden transition-all duration-200 z-[100] ${isOpen ? 'scale-100 opacity-100 visible translate-y-0' : 'scale-95 opacity-0 invisible -translate-y-2'}`} suppressHydrationWarning>
        <div className="max-h-[calc(100vh-100px)] overflow-y-auto px-2 py-2 space-y-1.5" suppressHydrationWarning>
          {MENU_GROUPS.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`} className="bg-background rounded-[10px] overflow-hidden border border-border/50 shadow-sm">
                <ul className="flex flex-col">
                  {group.map((item, index) => (
                    <li key={`item-${item.label}-${index}`} className="relative group">
                      {item.label === 'Logout' ? (
                        <button onClick={confirmLogout} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-[5px] ${item.iconBg} shadow-[0_1px_2px_rgba(0,0,0,0.1)]`}>
                              <i className={`${item.icon} text-[12px] text-white`}></i>
                            </div>
                            <span className={`text-[13.5px] font-semibold tracking-tight ${item.textColor || 'text-foreground'}`}>
                              {item.label}
                            </span>
                          </div>
                          <i className="fa-solid fa-chevron-right text-[9px] text-muted-foreground font-bold group-hover:translate-x-0.5 transition-transform"></i>
                        </button>
                      ) : (
                        <Link href={item.href} onClick={() => setIsOpen(false)} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-[5px] ${item.iconBg} shadow-[0_1px_2px_rgba(0,0,0,0.1)]`}>
                              <i className={`${item.icon} text-[12px] text-white`}></i>
                            </div>
                            <span className={`text-[13.5px] font-semibold tracking-tight ${item.textColor || 'text-foreground'}`}>
                              {item.label}
                            </span>
                          </div>
                          <i className="fa-solid fa-chevron-right text-[9px] text-muted-foreground font-bold group-hover:translate-x-0.5 transition-transform"></i>
                        </Link>
                      )}
                      {/* Inline separator, except for last item */}
                      {index !== group.length - 1 && (
                        <div className="absolute bottom-0 left-[2.75rem] right-0 h-[1px] bg-muted"></div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      {/* --- MOBILE/TABLET DROPDOWN VIEW (Below Header, Premium Grid Layout) --- */}
      {isOpen && (
        <div className="md:hidden absolute top-[calc(100%+14px)] -left-4 w-screen max-h-[calc(100vh-70px)] overflow-y-auto bg-background z-[100] shadow-[0_20px_40px_rgba(0,0,0,0.2)] animate-in slide-in-from-left-8 fade-in-0 duration-300 ease-out border-t border-border">
          <div className="px-3 min-[390px]:px-4 py-4 space-y-3.5 pb-24">
            
            {/* Quick Actions Row (Logout/Login, Home, Mode) */}
            <div className="grid grid-cols-3 gap-2 min-[390px]:gap-2.5">
              {profile ? (
                <button onClick={confirmLogout} className="flex items-center justify-center gap-1.5 px-1.5 min-[390px]:px-2.5 h-10 min-[390px]:h-11 bg-background rounded-lg shadow-sm border border-border active:bg-muted active:scale-95 transition-all overflow-hidden">
                  <div className="flex items-center justify-center w-5 h-5 min-[390px]:w-6 min-[390px]:h-6 rounded shrink-0 bg-brand-red shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                    <i className="fa-solid fa-power-off text-[10px] min-[390px]:text-[11px] text-white"></i>
                  </div>
                  <span className="text-[11.5px] min-[375px]:text-[13px] font-semibold text-foreground tracking-tight truncate whitespace-nowrap">Logout</span>
                </button>
              ) : (
                <Link onClick={() => setIsOpen(false)} href={`/${lang}/login`} className="flex items-center justify-center gap-1.5 px-1.5 min-[390px]:px-2.5 h-10 min-[390px]:h-11 bg-background rounded-lg shadow-sm border border-border active:bg-muted active:scale-95 transition-all overflow-hidden">
                  <div className="flex items-center justify-center w-5 h-5 min-[390px]:w-6 min-[390px]:h-6 rounded shrink-0 bg-emerald-500 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                    <i className="fa-solid fa-user text-[10px] min-[390px]:text-[11px] text-white"></i>
                  </div>
                  <span className="text-[11.5px] min-[375px]:text-[13px] font-semibold text-foreground tracking-tight truncate whitespace-nowrap">Login</span>
                </Link>
              )}
              <Link onClick={() => setIsOpen(false)} href={`/${lang}`} className="flex items-center justify-center gap-1.5 px-1.5 min-[390px]:px-2.5 h-10 min-[390px]:h-11 bg-background rounded-lg shadow-sm border border-border active:bg-muted active:scale-95 transition-all overflow-hidden">
                <div className="flex items-center justify-center w-5 h-5 min-[390px]:w-6 min-[390px]:h-6 rounded shrink-0 bg-blue-500 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                  <i className="fa-solid fa-house text-[10px] min-[390px]:text-[11px] text-white"></i>
                </div>
                <span className="text-[11.5px] min-[375px]:text-[13px] font-semibold text-foreground tracking-tight truncate whitespace-nowrap">Home</span>
              </Link>
              <button onClick={toggleTheme} className="flex items-center justify-center gap-1.5 px-1.5 min-[390px]:px-2.5 h-10 min-[390px]:h-11 bg-background rounded-lg shadow-sm border border-border active:bg-muted active:scale-95 transition-all overflow-hidden w-full">
                <div className="flex items-center justify-center w-5 h-5 min-[390px]:w-6 min-[390px]:h-6 rounded shrink-0 bg-purple-500 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                  <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-[10px] min-[390px]:text-[11px] text-white`}></i>
                </div>
                <span suppressHydrationWarning className="text-[11.5px] min-[375px]:text-[13px] font-semibold text-foreground tracking-tight truncate whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            {/* Premium Upgrade Banner */}
            <div className="flex justify-center my-1.5">
              <Link onClick={() => setIsOpen(false)} href="#" className="w-full max-w-xs mx-auto px-4 min-[390px]:px-8 bg-plan-platinum p-3 min-[390px]:p-3.5 rounded-full text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-sky-900/20 active:scale-[0.98] transition-all relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none z-0"></div>
                <i className="fa-solid fa-crown text-white drop-shadow-md relative z-10 text-[13px] min-[390px]:text-[14px]"></i>
                <span className="tracking-wider uppercase text-[12px] min-[390px]:text-[13px] relative z-10 drop-shadow-md whitespace-nowrap">
                  {profile ? 'Upgrade Plan' : 'Membership Plan'}
                </span>
                <i className="fa-solid fa-award text-white drop-shadow-md relative z-10 text-[14px] min-[390px]:text-[16px]"></i>
              </Link>
            </div>

            {/* 2-Column Menu Grid */}
            <div className="grid grid-cols-2 gap-2 min-[390px]:gap-2.5">
              {MENU_GROUPS.flat().filter(item => item.label !== 'Logout').map((item, index) => (
                <Link 
                  onClick={() => setIsOpen(false)}
                  key={`mobile-${item.label}-${index}`} 
                  href={item.href}
                  className="flex items-center gap-2 min-[390px]:gap-2.5 p-2.5 min-[390px]:p-3 bg-background rounded-lg shadow-sm border border-border active:bg-muted active:scale-95 transition-all min-w-0 overflow-hidden"
                >
                  <div className={`flex items-center justify-center w-6.5 h-6.5 min-[390px]:w-7 min-[390px]:h-7 rounded-md shrink-0 ${item.iconBg} shadow-[0_1px_2px_rgba(0,0,0,0.1)]`}>
                    <i className={`${item.icon} text-[12px] min-[390px]:text-[13px] text-white`}></i>
                  </div>
                  <span className="font-semibold text-[12.5px] min-[375px]:text-[13.5px] text-foreground tracking-tight leading-tight truncate whitespace-nowrap flex-1 min-w-0">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Advertisement Placeholder */}
            <div className="w-full mt-2 rounded-xl overflow-hidden shadow-md relative bg-brand-blue-hover border border-blue-900 h-[120px] min-[390px]:h-[140px] flex flex-col justify-center px-5 min-[390px]:px-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-30 -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500 rounded-full blur-3xl opacity-20 -ml-10 -mb-10"></div>
              <div className="relative z-10 flex flex-col gap-1">
                <span className="inline-block px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold tracking-widest uppercase rounded-sm w-max mb-1">Sponsored</span>
                <h2 className="font-extrabold text-white text-[18px] min-[390px]:text-[20px] leading-tight">HDFC Bank<br/>Business</h2>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Logout Confirmation Popup */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-background rounded-2xl p-5 w-full sm:w-max max-w-[95vw] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
            <div className="flex gap-4 items-center mb-6">
              <div className="w-12 h-12 bg-brand-red/10 dark:bg-brand-red/20 rounded-full flex items-center justify-center shrink-0 text-brand-red">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <div className="flex flex-col justify-center w-full items-center">
                <h2 className="text-[17px] font-bold text-brand-red mb-1 leading-none text-center">Logout</h2>
                <p className="text-foreground/80 text-[14px] leading-snug whitespace-nowrap text-center">Are you sure you want to log out of your account?</p>
              </div>
            </div>
            
            <div className="flex w-full gap-3">
              <button 
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-brand-red text-white font-semibold text-[15px] shadow-sm hover:bg-brand-red-hover active:scale-[0.98] transition-all"
              >
                Logout
              </button>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
