import React, { useMemo } from 'react';
import Image from 'next/image';

export function ProductAlertCard({ 
  alert, 
  isSelected = false, 
  onSelect = () => {},
  isDropdownMode = false
}: { 
  alert: any; 
  isSelected?: boolean; 
  onSelect?: (id: string) => void; 
  isDropdownMode?: boolean;
}) {
  const isTriggered = alert.status === 'triggered' || alert.is_triggered === true;
  const dateStr = alert.created_at ? new Date(alert.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
  const alertType = alert.alert_type || alert.type || 'Price Alert';

  const title = alert.product?.name || alert.product_name || alert.commodity?.name || alert.category?.name || alert.commodity_name || alert.name || alert.title || 'Unknown Commodity';
  const price = alert.alert_price || alert.target_price || alert.price || alert.threshold || 0;
  
  const incotermStr = alert.shipping_term || alert.incoterm?.name || alert.incoterm || 'FOB';
  const incoterm = typeof incotermStr === 'string' ? incotermStr.toUpperCase() : 'FOB';
  
  const rightTargetLabel = incoterm;
  const rightTargetPrice = `$ ${Number(price).toLocaleString('en-IN')}`;
  const bottomTag = alert.shipping_container || 'Commodity';

  const originName = alert.loading_port?.name || alert.origin?.name || alert.origin_name || 'India';
  const destName = alert.destination_port?.name || alert.destination?.name || alert.destination_name || 'Global';
  
  const imageBaseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com/';
  const base = imageBaseUrl.endsWith('/') ? imageBaseUrl : `${imageBaseUrl}/`;
  
  const rawOriginFlag = alert.loading_port?.country?.flag || alert.origin?.country?.flag || '🇮🇳';
  const rawDestFlag = alert.destination_port?.country?.flag || alert.destination?.country?.flag || '🌍';
  
  const originFlag = rawOriginFlag.endsWith('.png') && !rawOriginFlag.startsWith('http') ? `${base}${rawOriginFlag}` : rawOriginFlag;
  const destFlag = rawDestFlag.endsWith('.png') && !rawDestFlag.startsWith('http') ? `${base}${rawDestFlag}` : rawDestFlag;
  
  const showDest = incoterm === 'CNF' || incoterm === 'CIF' || incoterm === 'CFR';

  const routeDisplay = (
    <div className="flex flex-row items-center gap-1.5 sm:gap-3 text-[12px] sm:text-[15px] font-medium text-muted-foreground min-w-0">
      <span className="flex items-center gap-1 sm:gap-1.5 truncate">
        {originFlag.includes('http') ? (
          <Image src={originFlag} width={22} height={16} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
        ) : (
          <span className="text-[16px] sm:text-[18px] leading-none">{originFlag}</span>
        )} 
        POL: <span className="truncate max-w-[120px]">{originName}</span>
      </span>
      {showDest && (
        <>
          <i className="fa-solid fa-arrow-right-long text-muted-foreground text-[11px] sm:text-[14px] shrink-0"></i>
          <span className="flex items-center gap-1 sm:gap-1.5 truncate">
            {destFlag.includes('http') ? (
              <Image src={destFlag} width={22} height={16} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
            ) : (
              <span className="text-[16px] sm:text-[18px] leading-none">{destFlag}</span>
            )}
            POD: <span className="truncate max-w-[120px]">{destName}</span>
          </span>
        </>
      )}
    </div>
  );

  return (
    <div 
      className={`group bg-card border ${isSelected ? 'border-brand-blue ring-1 ring-brand-blue/30' : 'border-border'} rounded-xl shadow-sm transition-all duration-300 overflow-hidden`}
    >
      <div className="p-4 sm:p-5 flex items-stretch gap-4 sm:gap-5 h-full relative">
        {/* Left Column: Icon (Top) and Checkbox (Bottom - perfectly aligned with flags row) */}
        <div className="flex flex-col items-center shrink-0 w-6">
          <div className="h-6 sm:h-7 flex items-center justify-center">
            {isTriggered ? (
              <i className="fa-solid fa-circle-check text-emerald-500 text-[24px] sm:text-[26px]"></i>
            ) : (
              <i className="fa-solid fa-bell text-amber-500 text-[24px] sm:text-[26px]"></i>
            )}
          </div>
          <div className="flex-1"></div>
          {/* Aligned with flags/tags row */}
          {!isDropdownMode && (
            <div className="mt-3 sm:mt-2.5 h-[18px] sm:h-[22px] flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={isSelected}
                onChange={() => onSelect(alert.id)}
                className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] accent-brand-blue cursor-pointer dark:scheme-dark"
                title="Select to delete"
              />
            </div>
          )}
        </div>

        {/* Right Column: Main Content */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Row 1: Status, Date (Centered), Type */}
          <div className="flex items-center justify-between w-full h-6 sm:h-7 gap-1 sm:gap-2 overflow-hidden">
            <span className="text-[13px] sm:text-[16px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
              {isTriggered ? 'Alert triggered' : 'You\'ll get an alert'}
            </span>
            
            <div className="flex-1 text-center text-[12px] sm:text-[15px] text-muted-foreground/70 whitespace-nowrap px-1 sm:px-2 truncate">
              ({dateStr})
            </div>

            <span className="text-[13px] sm:text-[16px] font-semibold text-foreground uppercase shrink-0">
              {alertType}
            </span>
          </div>



          {/* Row 2: Title & Prices */}
          <div className="flex flex-row items-center justify-between w-full mt-2 sm:mt-1.5 gap-2 sm:gap-3">
            <h3 className="text-[16px] sm:text-[20px] font-bold text-foreground tracking-tight truncate flex-1 pr-1 sm:pr-2">
              {title}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="text-[15px] sm:text-[19px] font-bold text-foreground whitespace-nowrap">
                {rightTargetLabel} : {rightTargetPrice}
              </div>
              <i className="fa-solid fa-chevron-right text-muted-foreground/40 group-hover:text-foreground transition-colors text-[16px] sm:text-[20px] ml-1 sm:ml-2"></i>
            </div>
          </div>

          {/* Row 3: Flags & Tags */}
          <div className="flex items-center justify-between w-full mt-3 sm:mt-2.5 gap-2 h-[18px] sm:h-[22px]">
            {routeDisplay}
            <span className="text-[11px] sm:text-[15px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center">
              {bottomTag}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
