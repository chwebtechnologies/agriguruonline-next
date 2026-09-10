import React from 'react';

interface InquiryListCardProps {
  item: any;
  type: 'product' | 'freight';
  isActive: boolean;
  isChecked?: boolean;
  onClick: () => void;
  onCheck?: (e: React.MouseEvent) => void;
}

export default function InquiryListCard({ item, type, isActive, isChecked, onClick, onCheck }: InquiryListCardProps) {
  // Title extraction with exhaustive fallbacks
  const title = 
    item?.product?.name ||
    item?.product_name ||
    item?.commodity?.name ||
    item?.commodity_name ||
    item?.crop_name ||
    item?.variety ||
    item?.title ||
    item?.name ||
    item?.inquiry_title ||
    (type === 'freight' 
      ? (item?.loading_port && item?.discharge_port ? `${item.loading_port} ➔ ${item.discharge_port}` : 'Freight Route')
      : 'Product Inquiry');

  // Status badge formatting
  const rawStatus = item?.status || item?.status_text || item?.inquiry_status || item?.state || 'Negotiation';
  const status = typeof rawStatus === 'string' 
    ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() 
    : 'Negotiation';

  // Date formatted as DD-MM-YYYY to match mockup (e.g. 11-06-2026)
  const formatDateWithTime = (val: any) => {
    if (!val) return '11-06-2026';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch {
      return '11-06-2026';
    }
  };
  const dateStr = formatDateWithTime(item?.created_at || item?.createdAt || item?.date || item?.created_on || item?.updated_at);

  const isUnread = item?.message_indication === true || item?.has_unread_messages === true || item?.unread === true || item?.is_unread === true || item?.message_indication === 1;

  // Subtitle with useful metadata
  let subtitle = '';
  if (type === 'product') {
    const parts = [];
    
    // Type
    const inqType = item?.type || item?.inquiry_type || 'Inquiry';
    if (inqType) parts.push(inqType.toUpperCase());
    
    // Crop/Commodity
    const crop = item?.crop_name || item?.commodity?.name || item?.commodity_name || item?.variety || item?.product?.name;
    if (crop && crop !== title) parts.push(crop); // Avoid duplicating the title

    // Quantity
    if (item?.quantity) parts.push(`${item.quantity} ${item.quantity_unit || item.unit || 'MT'}`);
    
    // Origin/Country
    const country = item?.product?.country?.name || item?.country?.name || item?.country || item?.origin;
    if (country && typeof country === 'string') parts.push(country);

    // Shipment / Incoterm
    const shipment = item?.shipment_term || item?.incoterm || item?.delivery_term;
    if (shipment && typeof shipment === 'string') parts.push(shipment.toUpperCase());

    // Packaging
    const packing = item?.packaging || item?.packing || item?.packaging_type;
    if (packing && typeof packing === 'string') parts.push(packing);

    // Price
    if (item?.target_price || item?.price) parts.push(`$${item.target_price || item.price}`);
    else if (item?.market_range) parts.push(item.market_range);

    // Ensure we have at least something if everything else fails
    if (parts.length === 0) parts.push('Details Available');

    subtitle = parts.slice(0, 4).join(' • ');
  } else {
    const parts = [];
    if (item?.loading_port && item?.discharge_port) {
      parts.push(`${item.loading_port} ➔ ${item.discharge_port}`);
    } else if (item?.pol && item?.pod) {
      parts.push(`${item.pol} ➔ ${item.pod}`);
    }
    if (item?.container_type || item?.shipping_container?.name) {
      parts.push(item?.container_type || item?.shipping_container?.name);
    }
    subtitle = parts.join(' • ');
  }

  return (
    <div 
      onClick={onClick}
      className={`group relative p-2.5 sm:p-3 mb-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all duration-200 select-none ${
        isActive 
          ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/25' 
          : 'bg-card border-border hover:border-brand-blue/40 text-foreground'
      }`}
    >
      {/* Square Checkbox matching mockup */}
      <div 
        className="shrink-0 flex items-center justify-center cursor-pointer"
        onClick={(e) => onCheck ? onCheck(e) : undefined}
      >
        <div 
          className={`w-[18px] h-[18px] rounded-sm border flex items-center justify-center transition-colors ${
            isChecked 
              ? (isActive ? 'bg-white border-white text-brand-blue' : 'bg-brand-blue border-brand-blue text-white')
              : (isActive ? 'border-white/50 bg-transparent' : 'border-foreground/30 bg-background/40 group-hover:border-brand-blue/60')
          }`}
        >
          {isChecked ? (
            <i className="fa-solid fa-check text-[11px] font-bold"></i>
          ) : null}
        </div>
      </div>

      {/* Middle: Title & Subtitle + Date */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 
            title={title}
            className={`font-semibold text-[14px] sm:text-[15px] leading-snug truncate min-w-0 ${
              isActive ? 'text-white font-bold' : (isUnread ? 'text-foreground font-extrabold' : 'text-foreground')
            }`}
          >
            {title}
          </h3>
          {isUnread && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </div>
        <p 
          title={subtitle ? `${subtitle} • ${dateStr}` : dateStr}
          className={`text-[11px] sm:text-[12px] truncate mt-1 ${
            isActive ? 'text-white/80' : 'text-foreground/60'
          }`}
        >
          {subtitle ? `${subtitle} • ${dateStr}` : dateStr}
        </p>
      </div>

      {/* Right: Status Pill ONLY */}
      <div className="shrink-0 flex flex-col items-end justify-center">
        <span 
          className={`text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap leading-none uppercase tracking-wide ${
            isActive 
              ? 'border-white/80 text-white bg-white/10' 
              : 'border-foreground/20 text-foreground/80 bg-foreground/5'
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
