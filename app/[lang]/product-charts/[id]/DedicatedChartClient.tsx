'use client';

import React from 'react';
import MobileCommodityChart, { CommodityItemData } from '@/components/product-charts/MobileCommodityChart';

interface DedicatedChartClientProps {
  productId: string;
  lang: string;
  initialItemData?: CommodityItemData;
  initialUserType?: string | null;
  initialPriceHistory?: any[];
  initialAlertRange?: { min: number; max: number } | null;
  initialApiDetails?: any;
  common?: any;
}

export default function DedicatedChartClient({ 
  productId, 
  lang, 
  initialItemData, 
  initialUserType,
  initialPriceHistory,
  initialAlertRange,
  initialApiDetails,
  common = {}
}: DedicatedChartClientProps) {
  const item = initialItemData || {
    id: productId,
    category: common?.agricultural_commodity || 'Agricultural Commodity',
    country: common?.global_origin || 'Global Origin',
    countryFlag: '',
    product: common?.commodity_details || 'Commodity Details',
    shipBy: '20 FT',
    term: 'FOB',
    pol: common?.main_port || 'Main Port',
    polFlag: '',
    pod: common?.not_available || 'N/A',
    podFlag: '',
    price: '850',
    change: '2.5',
    chartStatus: true
  };

  return (
    <div className="w-full flex flex-col bg-background">
      <MobileCommodityChart 
        item={item} 
        isFullScreen={true} 
        userType={initialUserType} 
        lang={lang}
        common={common}
        initialPriceHistory={initialPriceHistory}
        initialAlertRange={initialAlertRange}
        initialApiDetails={initialApiDetails}
      />
    </div>
  );
}
