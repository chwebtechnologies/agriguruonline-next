'use client';

import React from 'react';
import AngelOneCommodityView, { CommodityItemData } from '@/components/product-charts/AngelOneCommodityView';

interface DedicatedChartClientProps {
  productId: string;
  lang: string;
  initialItemData?: CommodityItemData;
  initialUserType?: string | null;
}

export default function DedicatedChartClient({ 
  productId, 
  lang, 
  initialItemData, 
  initialUserType 
}: DedicatedChartClientProps) {
  const item = initialItemData || {
    id: productId,
    category: 'Agricultural Commodity',
    country: 'Global Origin',
    countryFlag: '',
    product: 'Commodity Details',
    shipBy: '20 FT',
    term: 'FOB',
    pol: 'Main Port',
    polFlag: '',
    pod: 'N/A',
    podFlag: '',
    price: '850',
    change: '2.5',
    chartStatus: true
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col bg-white dark:bg-[#121214]">
      <AngelOneCommodityView 
        item={item} 
        isFullScreen={true} 
        userType={initialUserType} 
        lang={lang}
      />
    </div>
  );
}
