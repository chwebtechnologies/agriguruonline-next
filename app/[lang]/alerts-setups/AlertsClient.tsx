"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ProductAlertCard } from '@/components/alerts/ProductAlertCard';
import { FreightAlertCard } from '@/components/alerts/FreightAlertCard';
import { ChartBottomSheetContainer, ChartBottomSheetItem } from '@/components/ui/charts/ChartBottomSheetContainer';

export function AlertsClient({ initialAlerts, lang, dict }: { initialAlerts: any[], lang: string, dict?: any }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeChartData, setActiveChartData] = useState<ChartBottomSheetItem | null>(null);

  const handleOpenChart = (alert: any, isFreight: boolean) => {
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

    const targetPrice = alert.alert_price || alert.target_price || alert.target_freight || alert.freight_rate || alert.price || alert.threshold || 0;
    
    const prodName = isFreight 
      ? 'Freight (PMT)' 
      : getTitle(alert.product) !== 'N/A' ? getTitle(alert.product) : (alert.product_name || alert.commodity?.name || alert.name || alert.title || 'N/A');
    
    const catName = getTitle(alert.category) !== 'N/A' ? getTitle(alert.category) : (alert.category_name || 'N/A');
    
    const originPortObj = alert.loading_port || alert.origin;
    const destPortObj = alert.destination_port || alert.destination;

    const pol = getTitle(originPortObj, 'N/A');
    const polFlag = getFlag(originPortObj);
    
    const pod = getTitle(destPortObj, 'N/A');
    const podFlag = getFlag(destPortObj);

    const shipByStr = alert.shipping_container || alert.container_type || alert.equipment_type || '';
    const shipBy = shipByStr.split(' ')[0] || '20FT';

    const term = alert.shipping_term || alert.incoterm?.name || alert.incoterm || 'FOB';

    const favId = alert.favourite_product_id || alert.favourite_product?.id || alert.favourite_record_id || alert.favourite_record?.id || alert.favorite_product_id;
    const prodId = alert.product_id || alert.product?.id;

    const chartItem: ChartBottomSheetItem = {
      id: favId || prodId || alert.freight_id || alert.id,
      productId: prodId,
      favoriteProductId: favId,
      category: catName,
      product: prodName,
      shipBy,
      term,
      pol,
      polFlag,
      pod,
      podFlag,
      price: alert.freight_pmt || alert.pmt_price || alert.current_price || alert.price || 0,
      change: alert.change || alert.price_change || alert.change_percentage || 0,
      chartStatus: true,
      alertPrice: targetPrice,
      alertId: alert.id,
      country: originPortObj?.country?.name || 'N/A',
      countryFlag: getFlag(originPortObj?.country)
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
    if (selectedIds.size === alerts.length && alerts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(alerts.map(a => a.id)));
    }
  };

  const handleDelete = () => {
    // Implement delete logic here later, for now just remove from state
    setAlerts(alerts.filter(a => !selectedIds.has(a.id)));
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
                checked={selectedIds.size === alerts.length}
                onChange={toggleSelectAll}
                className="w-5 h-5 sm:w-6 sm:h-6 accent-brand-blue cursor-pointer dark:scheme-dark"
              />
            </div>
            <div className="flex-1 text-[15px] sm:text-[17px] font-bold text-foreground">
              {dict?.select_all || "Select all"}
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
                placeholder={dict?.search || "Search"} 
                className="w-full h-11 sm:h-12 pl-10 sm:pl-12 pr-4 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-[14px] sm:text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all placeholder:text-muted-foreground font-medium"
              />
            </div>
          </>
        )}
      </div>

      {/* Alerts List Container */}
      {alerts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <i className="fa-solid fa-bell-slash text-3xl sm:text-4xl text-blue-500"></i>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">{dict?.no_active_alerts || "No active alerts"}</h3>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md">
            {dict?.no_alerts_desc || "You haven't set up any alerts yet. Stay ahead of the market by creating your first alert."}
          </p>
          <button className="mt-6 bg-brand-blue hover:bg-brand-blue-hover text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 text-sm sm:text-base">
            <i className="fa-solid fa-plus"></i> {dict?.create_alert || "Create Alert"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {alerts.map((alert: any, idx: number) => {
            const alertType = alert.alert_type || alert.type || 'Price Alert';
            const isFreight = alertType.toLowerCase().includes('freight');
            
            if (isFreight) {
              return (
                <FreightAlertCard 
                key={alert.id || idx} 
                alert={alert} 
                isSelected={selectedIds.has(alert.id)} 
                onSelect={toggleSelect} 
                onCardClick={() => handleOpenChart(alert, true)}
              />
            );
          }

          return (
            <ProductAlertCard 
              key={alert.id || idx} 
              alert={alert} 
              isSelected={selectedIds.has(alert.id)} 
              onSelect={toggleSelect} 
              onCardClick={() => handleOpenChart(alert, false)}
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
          swipeText={dict?.swipe_up_details || "Swipe up for Commodity Details"}
          initialTab={dict?.alerts_setups || "Alert Setups"}
        />
      )}
    </div>
  );
}
