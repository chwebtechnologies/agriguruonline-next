"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AIPredictProductCard } from '@/components/alerts/AIPredictProductCard';
import { AIPredictFreightCard } from '@/components/alerts/AIPredictFreightCard';
import { ChartBottomSheetContainer, ChartBottomSheetItem } from '@/components/ui/charts/ChartBottomSheetContainer';

export function AIPredictClient({ initialPredicts, lang }: { initialPredicts: any[], lang: string }) {
  const [predicts, setPredicts] = useState(initialPredicts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeChartData, setActiveChartData] = useState<ChartBottomSheetItem | null>(null);

  const handleOpenChart = (predict: any, isFreight: boolean) => {
    const getTitle = (obj: any, fallback = 'N/A') => {
      if (!obj) return fallback;
      if (typeof obj === 'string') return obj;
      return obj.name || obj.title || obj.label || fallback;
    };
    const getFlag = (obj: any) => {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      return obj.flag || obj.country?.flag || '';
    };

    const targetPrice = predict.alert_price || predict.target_price || predict.target_freight || predict.freight_rate || predict.price || predict.threshold || 0;
    
    const prodName = isFreight 
      ? 'Freight (PMT)' 
      : getTitle(predict.product) !== 'N/A' ? getTitle(predict.product) : (predict.product_name || predict.commodity?.name || predict.name || predict.title || 'N/A');
    
    const catName = getTitle(predict.category) !== 'N/A' ? getTitle(predict.category) : (predict.category_name || 'N/A');
    
    const originPortObj = predict.loading_port || predict.origin;
    const destPortObj = predict.destination_port || predict.destination;

    const pol = getTitle(originPortObj, 'N/A');
    const polFlag = getFlag(originPortObj);
    
    const pod = getTitle(destPortObj, 'N/A');
    const podFlag = getFlag(destPortObj);

    const shipByStr = predict.shipping_container || predict.container_type || predict.equipment_type || '';
    const shipBy = shipByStr.split(' ')[0] || '20FT';

    const term = predict.shipping_term || predict.incoterm?.name || predict.incoterm || 'FOB';

    const chartItem: ChartBottomSheetItem = {
      id: predict.favourite_product_id || predict.favourite_product?.id || predict.favourite_record_id || predict.favourite_record?.id || predict.product?.id || predict.product_id || predict.favorite_product_id || predict.freight_id || predict.id,
      category: catName,
      product: prodName,
      shipBy,
      term,
      pol,
      polFlag,
      pod,
      podFlag,
      price: predict.freight_pmt || predict.pmt_price || predict.current_price || predict.price || 0,
      change: predict.change || predict.price_change || predict.change_percentage || 0,
      chartStatus: true,
      alertPrice: targetPrice,
      alertId: predict.id,
      country: originPortObj?.country?.name || 'N/A',
      countryFlag: getFlag(originPortObj?.country),
      predictId: predict.id
    };

    setActiveChartData(chartItem);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === predicts.length && predicts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(predicts.map(p => p.id)));
    }
  };

  const handleDelete = () => {
    // Implement delete logic here later, for now just remove from state
    setPredicts(predicts.filter(p => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  };

  const isSelectionMode = selectedIds.size > 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Top Action Bar */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm transition-all h-[68px] sm:h-[80px]">
        {isSelectionMode ? (
          <>
            <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center">
              <input 
                type="checkbox"
                checked={selectedIds.size === predicts.length}
                onChange={toggleSelectAll}
                className="w-5 h-5 sm:w-6 sm:h-6 accent-brand-blue cursor-pointer rounded border-border bg-background dark:bg-background/20"
                style={{ colorScheme: 'dark light' }}
              />
            </div>
            <div className="flex-1 text-[15px] sm:text-[17px] font-bold text-foreground">
              Select all
            </div>
            <button 
              onClick={handleDelete}
              className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors active:scale-95 shadow-sm"
            >
              <i className="fa-solid fa-trash-can text-lg sm:text-xl"></i>
            </button>
          </>
        ) : (
          <>
            <button className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-95 shadow-sm">
              <i className="fa-solid fa-plus text-lg sm:text-xl"></i>
            </button>
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-brand-blue transition-colors">
                <i className="fa-solid fa-magnifying-glass text-sm sm:text-base"></i>
              </div>
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full h-11 sm:h-12 pl-10 sm:pl-12 pr-4 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-[14px] sm:text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all placeholder:text-muted-foreground font-medium"
              />
            </div>
          </>
        )}
      </div>

      {/* Predicts List Container */}
      {predicts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <i className="fa-solid fa-microchip text-3xl sm:text-4xl text-blue-500"></i>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">No AI Predictions</h3>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md">
            You don't have any AI price predictions available at the moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {predicts.map((predict: any, idx: number) => {
            const predictType = predict.predict_type || predict.type || predict.analysis_type || predict.alert_type || 'Product';
            const isFreight = predictType.toLowerCase().includes('freight') || !!(predict.freight_pmt || predict.target_freight || predict.pmt_price) || (!!predict.loading_port && !!predict.destination_port && !predict.product?.name && !predict.product_name && !predict.commodity?.name);

            if (isFreight) {
              return (
                <AIPredictFreightCard 
                  key={predict.id || idx} 
                  predict={predict} 
                  isSelected={selectedIds.has(predict.id)} 
                  onSelect={toggleSelect} 
                  onCardClick={() => handleOpenChart(predict, true)}
                />
              );
            }

            return (
              <AIPredictProductCard 
                key={predict.id || idx} 
                predict={predict} 
                isSelected={selectedIds.has(predict.id)} 
                onSelect={toggleSelect} 
                onCardClick={() => handleOpenChart(predict, false)}
              />
            );
          })}
        </div>
      )}

      {activeChartData && (
        <ChartBottomSheetContainer 
          activeItem={activeChartData} 
          onClose={() => setActiveChartData(null)} 
          lang={lang}
          swipeText="Swipe up for Commodity Details"
          initialTab="AI Predict"
          initialExpandedPredictId={activeChartData.predictId}
        />
      )}
    </div>
  );
}
