import React from 'react';

export function FreightAlertCard({ 
  alert, 
  isSelected, 
  onSelect 
}: { 
  alert: any; 
  isSelected: boolean; 
  onSelect: (id: string) => void; 
}) {
  const isTriggered = alert.status === 'triggered' || alert.is_triggered === true;
  const dateStr = alert.created_at ? new Date(alert.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
  const alertType = alert.alert_type || alert.type || 'Price Alert';

  const title = `Freight (PMT)`;
  const pmtPrice = alert.freight_pmt || alert.pmt_price || alert.current_price || alert.price || alert.target_price || 0;
  const leftPriceDisplay = `$ ${Number(pmtPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const shippingContainer = alert.shipping_container || '';
  const containerParts = shippingContainer.split(' ');
  const rightTargetLabel = containerParts[0] || alert.container_type || alert.equipment_type || '20FT';
  
  const targetFreight = alert.alert_price || alert.target_freight || alert.freight_rate || alert.target_price || 0;
  const rightTargetPrice = `$ ${Number(targetFreight).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const bottomTag = containerParts[1] || alert.load_type || alert.shipment_type || 'FCL';
  
  const polName = alert.loading_port?.name || alert.pol?.name || alert.pol_name || 'Mundra';
  const podName = alert.destination_port?.name || alert.pod?.name || alert.pod_name || 'Mombasa';
  
  const imageBaseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com/';
  const base = imageBaseUrl.endsWith('/') ? imageBaseUrl : `${imageBaseUrl}/`;
  
  const rawPolFlag = alert.loading_port?.country?.flag || alert.pol?.country?.flag || '🇮🇳';
  const polFlag = rawPolFlag.endsWith('.png') && !rawPolFlag.startsWith('http') ? `${base}${rawPolFlag}` : rawPolFlag;
  
  const rawPodFlag = alert.destination_port?.country?.flag || alert.pod?.country?.flag || '🇰🇪';
  const podFlag = rawPodFlag.endsWith('.png') && !rawPodFlag.startsWith('http') ? `${base}${rawPodFlag}` : rawPodFlag;

  const routeDisplay = (
    <div className="flex flex-row items-center gap-1.5 sm:gap-3 text-[12px] sm:text-[15px] font-medium text-muted-foreground min-w-0">
      <span className="flex items-center gap-1 sm:gap-1.5 truncate">
        {polFlag.includes('http') ? (
          <img src={polFlag} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
        ) : (
          <span className="text-[16px] sm:text-[18px] leading-none">{polFlag}</span>
        )} 
        POL: <span className="truncate max-w-[120px]">{polName}</span>
      </span>
      <i className="fa-solid fa-arrow-right-long text-muted-foreground text-[11px] sm:text-[14px] shrink-0"></i>
      <span className="flex items-center gap-1 sm:gap-1.5 truncate">
        {podFlag.includes('http') ? (
          <img src={podFlag} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
        ) : (
          <span className="text-[16px] sm:text-[18px] leading-none">{podFlag}</span>
        )}
        POD: <span className="truncate max-w-[120px]">{podName}</span>
      </span>
    </div>
  );

  return (
    <div 
      onClick={() => onSelect(alert.id)}
      className={`group bg-card border ${isSelected ? 'border-brand-blue ring-1 ring-brand-blue/30' : 'border-border'} rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer`}
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
          <div className="mt-3 sm:mt-2.5 h-[18px] sm:h-[22px] flex items-center justify-center">
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => {}} // Handle parent click
              className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] accent-brand-blue cursor-pointer rounded border-border bg-background dark:bg-background/20"
              style={{ colorScheme: 'dark light' }}
              title="Select to delete"
            />
          </div>
        </div>

        {/* Right Column: Main Content */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Row 1: Status, Date (Centered), Type */}
          <div className="relative flex items-center justify-between w-full h-6 sm:h-7">
            <span className="text-[14px] sm:text-[16px] font-medium text-muted-foreground whitespace-nowrap">
              {isTriggered ? 'Alert triggered' : 'You\'ll get an alert'}
            </span>
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] sm:text-[16px] text-muted-foreground/70 whitespace-nowrap hidden min-[400px]:block">
              ({dateStr})
            </div>

            <span className="text-[14px] sm:text-[16px] font-semibold text-foreground capitalize shrink-0 ml-3">
              Freight
            </span>
          </div>

          <div className="min-[400px]:hidden text-[13px] text-muted-foreground/70 mb-1">
            ({dateStr})
          </div>

          {/* Row 2: Title & Prices */}
          <div className="flex flex-row items-center justify-between w-full mt-2 sm:mt-1.5 gap-2 sm:gap-3">
            <h3 className="text-[16px] sm:text-[20px] font-bold text-foreground tracking-tight truncate flex-1 pr-1 sm:pr-2">
              {title} {leftPriceDisplay ? <><span className="mx-1">:</span><span className="font-semibold">{leftPriceDisplay}</span></> : null}
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
