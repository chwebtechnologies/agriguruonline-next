import React, { useMemo } from 'react';
import Image from 'next/image';

export function AIPredictFreightCard({ 
  predict, 
  isSelected = false, 
  onSelect = () => {},
  isDropdownMode = false
}: { 
  predict: any; 
  isSelected?: boolean; 
  onSelect?: (id: string) => void; 
  isDropdownMode?: boolean;
}) {
  const dateStr = predict.created_at ? new Date(predict.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

  const polName = predict.loading_port?.name || predict.pol?.name || predict.pol_name || 'Mundra';
  const podName = predict.destination_port?.name || predict.pod?.name || predict.pod_name || 'Mombasa';
  
  const title = predict.title || `POL: ${polName} to POD: ${podName}`;
  
  const pmtPrice = predict.freight_pmt || predict.pmt_price || predict.current_price || predict.price || predict.target_price || 0;
  const leftPriceDisplay = pmtPrice ? `$ ${Number(pmtPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  
  const shippingContainer = predict.shipping_container || predict.container_type || predict.equipment_type || '';
  const containerParts = shippingContainer.split(' ');
  const rightTargetLabel = containerParts[0] || '20FT';
  
  const targetFreight = predict.target_freight || predict.freight_rate || predict.alert_price || 0;
  const rightTargetPrice = targetFreight ? `$ ${Number(targetFreight).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  
  const bottomTag = containerParts[1] || predict.load_type || predict.shipment_type || '';
  
  const imageBaseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com/';
  const base = imageBaseUrl.endsWith('/') ? imageBaseUrl : `${imageBaseUrl}/`;
  
  const rawPolFlag = predict.loading_port?.country?.flag || predict.pol?.country?.flag || '🇮🇳';
  const polFlag = rawPolFlag.endsWith('.png') && !rawPolFlag.startsWith('http') ? `${base}${rawPolFlag}` : rawPolFlag;
  
  const rawPodFlag = predict.destination_port?.country?.flag || predict.pod?.country?.flag || '🇰🇪';
  const podFlag = rawPodFlag.endsWith('.png') && !rawPodFlag.startsWith('http') ? `${base}${rawPodFlag}` : rawPodFlag;

  const routeDisplay = (
    <div className="flex flex-row items-center gap-1.5 sm:gap-3 text-[12px] sm:text-[15px] font-medium text-muted-foreground min-w-0">
      <span className="flex items-center gap-1 sm:gap-1.5 truncate">
        {polFlag.includes('http') ? (
          <Image src={polFlag} width={22} height={16} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
        ) : (
          <span className="text-[16px] sm:text-[18px] leading-none">{polFlag}</span>
        )} 
        POL: <span className="truncate max-w-[120px]">{polName}</span>
      </span>
      <i className="fa-solid fa-arrow-right-long text-muted-foreground text-[11px] sm:text-[14px] shrink-0"></i>
      <span className="flex items-center gap-1 sm:gap-1.5 truncate">
        {podFlag.includes('http') ? (
          <Image src={podFlag} width={22} height={16} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
        ) : (
          <span className="text-[16px] sm:text-[18px] leading-none">{podFlag}</span>
        )}
        POD: <span className="truncate max-w-[120px]">{podName}</span>
      </span>
    </div>
  );

  return (
    <div 
      onClick={() => onSelect(predict.id)}
      className={`group bg-card border ${isSelected ? 'border-brand-blue ring-1 ring-brand-blue/30' : 'border-border'} rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer`}
    >
      <div className="p-4 sm:p-5 flex items-stretch gap-4 sm:gap-5 h-full relative">
        {/* Left Column: Icon (Top) and Checkbox (Bottom) */}
        <div className="flex flex-col items-center shrink-0 w-6">
          <div className="h-6 sm:h-7 flex items-center justify-center">
            <i className="fa-solid fa-microchip text-zinc-500 text-[24px] sm:text-[26px]"></i>
          </div>
          <div className="flex-1"></div>
          {!isDropdownMode && (
            <div className="mt-3 sm:mt-2.5 h-[18px] sm:h-[22px] flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={isSelected}
                onChange={(e) => { e.stopPropagation(); onSelect(predict.id); }}
                className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] accent-brand-blue cursor-pointer rounded border-border bg-background dark:bg-background/20"
                style={{ colorScheme: 'dark light' }}
                title="Select to select"
              />
            </div>
          )}
        </div>

        {/* Right Column: Main Content */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Row 1: Status, Date, Type */}
          <div className="flex items-center justify-between w-full h-6 sm:h-7 gap-1 sm:gap-2 overflow-hidden">
            <span className="text-[13px] sm:text-[16px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
              Your Data Analysis
            </span>
            
            <div className="flex-1 text-center text-[12px] sm:text-[15px] text-muted-foreground/70 whitespace-nowrap px-1 sm:px-2 truncate">
              ({dateStr})
            </div>

            <span className="text-[13px] sm:text-[16px] font-semibold text-foreground uppercase shrink-0">
              {predict.alert_type || 'DATA ANALYSIS'}
            </span>
          </div>

          {/* Row 2: Title & Prices */}
          <div className="flex flex-row items-center justify-between w-full mt-2 sm:mt-1.5 gap-2 sm:gap-3">
            <h3 className="text-[16px] sm:text-[20px] font-bold text-foreground tracking-tight truncate flex-1 pr-1 sm:pr-2">
              {title} {leftPriceDisplay ? <><span className="mx-1">:</span><span className="font-semibold">{leftPriceDisplay}</span></> : null}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {targetFreight ? (
                <div className="text-[15px] sm:text-[19px] font-bold text-foreground whitespace-nowrap">
                  {rightTargetLabel} : {rightTargetPrice}
                </div>
              ) : null}
              <div className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2">
                <span className="text-[13px] sm:text-[16px] font-semibold text-foreground">
                  AI Predict
                </span>
                <i className="fa-solid fa-chevron-right text-muted-foreground/40 group-hover:text-foreground transition-colors text-[14px] sm:text-[18px]"></i>
              </div>
            </div>
          </div>

          {/* Row 3: Flags & Tags */}
          <div className="flex items-center justify-between w-full mt-3 sm:mt-2.5 gap-2 h-[18px] sm:h-[22px]">
            {routeDisplay}
            {bottomTag ? (
              <span className="text-[11px] sm:text-[15px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center">
                {bottomTag}
              </span>
            ) : <span />}
          </div>
        </div>
      </div>
    </div>
  );
}
