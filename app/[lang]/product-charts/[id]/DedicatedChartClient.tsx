'use client';

import React from 'react';
import { CommodityItemData } from '@/components/product-charts/MobileCommodityChart';
import dynamic from 'next/dynamic';

const MobileCommodityChart = dynamic(() => import('@/components/product-charts/MobileCommodityChart'), {
  loading: () => <div className="flex-1 flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
});

interface DedicatedChartClientProps {
  productId: string;
  lang: string;
  initialItemData?: CommodityItemData;
  initialUserType?: string | null;
  common?: any;
}

export default function DedicatedChartClient({ 
  productId, 
  lang, 
  initialItemData, 
  initialUserType,
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
    <div className="w-full min-h-[100dvh] flex flex-col bg-background">
      <MobileCommodityChart 
        item={item} 
        isFullScreen={true} 
        userType={initialUserType} 
        lang={lang}
        common={common}
      />
    </div>
  );
}
