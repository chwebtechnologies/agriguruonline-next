'use client';

import { useState, useEffect } from 'react';
import { HeaderGuest } from './HeaderGuest';
import dynamic from 'next/dynamic';
import type { SearchProduct } from '@/types/search';

const HeaderAuth = dynamic(() => import('./HeaderAuth').then(m => m.HeaderAuth), {
  ssr: false,
});

export interface HeaderClientProps {
  dict: any;
  activeLang: string;
  categories: Array<{ name: string; href: string }>;
  initialSearchProducts: SearchProduct[];
  initialAuthState?: any;
}

export function HeaderClient({
  dict,
  activeLang,
  categories,
  initialSearchProducts,
  initialAuthState,
}: HeaderClientProps) {
  const [authState, setAuthState] = useState<any>(initialAuthState || null);

  useEffect(() => {
    if (initialAuthState) return;

    if (typeof document !== 'undefined' && document.cookie.includes('user_info=')) {
      import('@/app/actions/authData').then(({ getClientAuthData }) => {
        getClientAuthData(activeLang).then((res) => {
          if (res?.isAuthenticated) {
            setAuthState(res);
          }
        }).catch(() => {});
      });
    }
  }, [activeLang, initialAuthState]);

  if (authState?.isAuthenticated && authState?.token) {
    return (
      <HeaderAuth
        token={authState.token as string}
        dict={dict}
        activeLang={activeLang}
        categories={categories}
        profile={authState.userProfile}
        alerts={authState.alertsData}
        notifications={authState.notificationsData}
        aiPredicts={authState.aiPredictsData}
        initialSearchProducts={initialSearchProducts}
      />
    );
  }

  return (
    <HeaderGuest
      dict={dict}
      activeLang={activeLang}
      categories={categories}
      initialSearchProducts={initialSearchProducts}
    />
  );
}
