import React from 'react';
import { getWatchlistProductsAction } from '@/app/actions/watchlist';
import { withTimeout } from '@/lib/api-utils';
import WatchlistSectionClient from './WatchlistSectionClient';

interface WatchlistSectionProps {
  dict?: any;
  lang?: string;
}

export default async function WatchlistSection({ dict, lang = 'en' }: WatchlistSectionProps) {
  // Fetch initial product data on the server with a reasonable timeout to prevent blocking SSR forever
  let productData = {
    products: [] as any[],
    shippingTerms: [] as any[],
    userType: null as string | null,
    favoriteProducts: [] as any[],
    marketedProducts: [] as any[],
  };

  try {
    productData = await withTimeout(
      getWatchlistProductsAction(lang),
      4000,
      productData
    );
  } catch (err) {
    console.error('WatchlistSection failed to fetch initial data:', err);
  }

  return (
    <WatchlistSectionClient 
      dict={dict} 
      lang={lang} 
      initialProductData={productData} 
    />
  );
}
