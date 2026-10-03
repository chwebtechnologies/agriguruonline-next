import React from 'react';
import { getWatchlistProductsAction } from '@/app/actions/watchlist';
import WatchlistSectionClient from './WatchlistSectionClient';

interface WatchlistSectionProps {
  dict?: any;
  lang?: string;
}

export default async function WatchlistSection({ dict, lang = 'en' }: WatchlistSectionProps) {
  // Fetch initial product data on the server with a reasonable timeout to prevent blocking SSR forever
  let productData = {
    products: [],
    shippingTerms: [],
    userType: null,
    favoriteProducts: [],
    marketedProducts: [],
  };

  try {
    const promise = getWatchlistProductsAction(lang);
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 2500)
    );
    productData = await Promise.race([promise, timeoutPromise]);
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
