'use client';

import React, { useState, useEffect } from 'react';
import { getWatchlistFreightAction } from '@/app/actions/watchlist';
import ProductChartsClient from '@/components/product-charts/ProductChartsClient';
import FreightChartClient from '@/components/freight-chart/FreightChartClient';
import { WATCHLIST_SCROLL_KEY, WATCHLIST_SCROLL_EVENT, WATCHLIST_REFRESH_EVENT } from '@/lib/watchlist-utils';

interface WatchlistSectionClientProps {
  dict?: any;
  lang?: string;
  initialProductData: any;
}

export default function WatchlistSectionClient({ dict, lang = 'en', initialProductData }: WatchlistSectionClientProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'freight'>('products');
  
  const [freightData, setFreightData] = useState<any>(null);
  const [isFreightLoading, setIsFreightLoading] = useState(false);

  useEffect(() => {
    const handleSwitchToProducts = () => {
      setActiveTab('products');
    };

    if (typeof window !== 'undefined') {
      try {
        if (
          window.location.hash === '#market-watchlist' || 
          sessionStorage.getItem(WATCHLIST_SCROLL_KEY) === 'true'
        ) {
          setActiveTab('products');
        }
      } catch {}
    }

    window.addEventListener(WATCHLIST_SCROLL_EVENT, handleSwitchToProducts);
    window.addEventListener(WATCHLIST_REFRESH_EVENT, handleSwitchToProducts);
    window.addEventListener('hashchange', handleSwitchToProducts);

    return () => {
      window.removeEventListener(WATCHLIST_SCROLL_EVENT, handleSwitchToProducts);
      window.removeEventListener(WATCHLIST_REFRESH_EVENT, handleSwitchToProducts);
      window.removeEventListener('hashchange', handleSwitchToProducts);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (activeTab === 'freight' && !freightData) {
      setIsFreightLoading(true);
      getWatchlistFreightAction(lang).then(data => {
        if (mounted) {
          setFreightData(data);
          setIsFreightLoading(false);
        }
      });
    }
    return () => { mounted = false; };
  }, [activeTab, lang, freightData]);

  return (
    <div className="mt-5 relative w-full">
      {/* Tabs */}
      <div className="flex w-full items-center gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-3 sm:py-4 px-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
            activeTab === 'products'
              ? 'bg-primary text-white shadow-md'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <i className="fa-solid fa-chart-line mr-2"></i>
          {dict?.home?.watchlist_tab_products || 'Products Price'}
        </button>
        <button
          onClick={() => setActiveTab('freight')}
          className={`flex-1 py-3 sm:py-4 px-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
            activeTab === 'freight'
              ? 'bg-primary text-white shadow-md'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <i className="fa-solid fa-ship mr-2"></i>
          {dict?.home?.watchlist_tab_freight || 'Freight Rate'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="w-full flex flex-col">
        {activeTab === 'products' ? (
          <div className="animate-in fade-in zoom-in-95 duration-300 w-full">
            <ProductChartsClient 
              common={dict?.common || {}}
              initialProducts={initialProductData.products}
              initialShippingTerms={initialProductData.shippingTerms}
              initialFavorites={initialProductData.favoriteProducts}
              initialUserType={initialProductData.userType}
              initialMarketedProducts={initialProductData.marketedProducts}
              lang={lang}
              isHomePage={true}
            />
          </div>
        ) : (
          isFreightLoading || !freightData ? (
            <div className="p-8 w-full flex items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300 w-full">
              <FreightChartClient
                common={dict?.common || {}}
                initialShippingContainers={freightData.shippingContainers}
                initialFavorites={freightData.favoritePorts}
                initialUserType={freightData.userType}
                lang={lang}
                isHomePage={true}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
