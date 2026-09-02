'use client'

import React, { useState, useEffect, useRef, useId } from 'react'
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
  const menuId = useId();
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
    alignClass = isRtl ? 'md:right-0 md:origin-top-right' : 'md:left-0 md:origin-top-left';
  } else {
    alignClass = isRtl ? 'md:left-0 md:origin-top-left' : 'md:right-0 md:origin-top-right';
  }

  return (
    <div className="md:relative" ref={menuRef} suppressHydrationWarning>
      <input 
        type="checkbox" 
        id={menuId} 
        className="peer sr-only" 
        checked={isOpen} 
        onChange={(e) => setIsOpen(e.target.checked)} 
        aria-label="Toggle menu"
      />
      {/* Trigger */}
      <label
        htmlFor={menuId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="block cursor-pointer bg-transparent border-0 p-0 m-0 appearance-none outline-none"
      >
        {children || (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background border border-border shadow-sm hover:shadow text-foreground transition-all">
            <span className="sr-only">Toggle menu</span>
            <i className="fa-solid fa-bars text-xl" aria-hidden="true"></i>
          </div>
        )}
      </label>

      {/* --- RESPONSIVE UNIFIED DROPDOWN VIEW --- */}
      <div className={`
        /* Mobile: Absolute drawer below header */
        hidden peer-checked:block absolute top-[100%] left-0 right-0 h-[calc(100vh-65px)] bg-background z-[100] border-t border-border overflow-y-auto animate-in slide-in-from-left-8 fade-in-0 duration-300 ease-out
        
        /* Desktop: Absolute popover */
        md:block md:absolute md:top-[calc(100%+0.5rem)] ${alignClass} md:w-[260px] md:h-auto md:bottom-auto md:border md:rounded-2xl md:overflow-hidden md:shadow-[0_8px_30px_rgb(0,0,0,0.12)]
        md:transition-all md:duration-200 md:animate-none md:z-[100]
        md:scale-95 md:opacity-0 md:invisible md:-translate-y-2
        md:peer-checked:scale-100 md:peer-checked:opacity-100 md:peer-checked:visible md:peer-checked:translate-y-0
      `} suppressHydrationWarning>
        <div className="px-3 min-[390px]:px-4 py-4 md:p-2 space-y-3.5 md:space-y-0 pb-24 md:max-h-[calc(100vh-100px)] md:overflow-y-auto" suppressHydrationWarning>
            
            {/* Quick Actions Row (Mobile Only) */}
            <div className="md:hidden grid grid-cols-3 gap-2 min-[390px]:gap-2.5 mb-3.5">
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

            {/* Premium Upgrade Banner (Mobile Only) */}
            <div className="md:hidden flex justify-center my-1.5 mb-3.5">
              <Link onClick={() => setIsOpen(false)} href="#" className="w-full max-w-xs mx-auto px-4 min-[390px]:px-8 bg-plan-platinum p-3 min-[390px]:p-3.5 rounded-full text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-sky-900/20 active:scale-[0.98] transition-all relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none z-0"></div>
                <i className="fa-solid fa-crown text-white drop-shadow-md relative z-10 text-[13px] min-[390px]:text-[14px]"></i>
                <span className="tracking-wider uppercase text-[12px] min-[390px]:text-[13px] relative z-10 drop-shadow-md whitespace-nowrap">
                  {profile ? 'Upgrade Plan' : 'Membership Plan'}
                </span>
                <i className="fa-solid fa-award text-white drop-shadow-md relative z-10 text-[14px] min-[390px]:text-[16px]"></i>
              </Link>
            </div>

            {/* Unified Menu Links */}
            <div className="grid grid-cols-2 gap-2 min-[390px]:gap-2.5 md:flex md:flex-col md:gap-0 md:space-y-1.5">
              {MENU_GROUPS.map((group, groupIndex) => (
                <div key={`group-${groupIndex}`} className="contents md:block md:bg-background md:rounded-[10px] md:overflow-hidden md:border md:border-border/50 md:shadow-sm">
                  <ul className="contents md:flex md:flex-col">
                    {group.map((item, index) => (
                      <li key={`item-${item.label}-${index}`} className="contents md:block md:relative md:group">
                        <Link href={item.href} onClick={() => setIsOpen(false)} className="
                          flex items-center gap-2 min-[390px]:gap-2.5 p-2.5 min-[390px]:p-3 bg-background rounded-lg shadow-sm border border-border active:bg-muted active:scale-95 transition-all min-w-0 overflow-hidden
                          md:justify-between md:px-3 md:py-1.5 md:hover:bg-muted md:border-none md:rounded-none md:shadow-none
                        ">
                          <div className="flex items-center gap-2 min-[390px]:gap-2.5 md:gap-3">
                            <div className={`flex items-center justify-center w-6.5 h-6.5 min-[390px]:w-7 min-[390px]:h-7 md:w-6 md:h-6 rounded-md md:rounded-[5px] shrink-0 ${item.iconBg} shadow-[0_1px_2px_rgba(0,0,0,0.1)]`}>
                              <i className={`${item.icon} text-[12px] min-[390px]:text-[13px] md:text-[12px] text-white`}></i>
                            </div>
                            <span className={`font-semibold text-[12.5px] min-[375px]:text-[13.5px] md:text-[13.5px] md:tracking-tight ${item.textColor || 'text-foreground'} tracking-tight leading-tight truncate whitespace-nowrap flex-1 min-w-0`}>
                              {item.label}
                            </span>
                          </div>
                          <i className="hidden md:block fa-solid fa-chevron-right text-[9px] text-muted-foreground font-bold group-hover:translate-x-0.5 transition-transform"></i>
                        </Link>
                        {index !== group.length - 1 && (
                          <div className="hidden md:block absolute bottom-0 left-[2.75rem] right-0 h-[1px] bg-muted"></div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              
              {/* Desktop Logout Appended manually */}
              {profile && (
                <div className="hidden md:block bg-background rounded-[10px] overflow-hidden border border-border/50 shadow-sm mt-1.5">
                  <ul className="flex flex-col">
                    <li className="relative group">
                      <button onClick={confirmLogout} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-6 h-6 rounded-[5px] bg-brand-red shadow-[0_1px_2px_rgba(0,0,0,0.1)]`}>
                            <i className={`fa-solid fa-power-off text-[12px] text-white`}></i>
                          </div>
                          <span className={`text-[13.5px] font-semibold tracking-tight text-brand-red hover:text-brand-red-hover`}>
                            Logout
                          </span>
                        </div>
                        <i className="fa-solid fa-chevron-right text-[9px] text-muted-foreground font-bold group-hover:translate-x-0.5 transition-transform"></i>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Advertisement Placeholder (Mobile Only) */}
            <div className="md:hidden w-full mt-3.5 rounded-xl overflow-hidden shadow-md relative bg-brand-blue-hover border border-blue-900 h-[120px] min-[390px]:h-[140px] flex flex-col justify-center px-5 min-[390px]:px-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-30 -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500 rounded-full blur-3xl opacity-20 -ml-10 -mb-10"></div>
              <div className="relative z-10 flex flex-col gap-1">
                <span className="inline-block px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold tracking-widest uppercase rounded-sm w-max mb-1">Sponsored</span>
                <h2 className="font-extrabold text-white text-[18px] min-[390px]:text-[20px] leading-tight">HDFC Bank<br/>Business</h2>
              </div>
            </div>
            
          </div>
        </div>

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
