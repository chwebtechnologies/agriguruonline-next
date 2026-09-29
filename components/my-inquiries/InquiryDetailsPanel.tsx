'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getInquiryDetailsAction, submitInquiryNegotiationAction, respondInquiryAction } from '@/app/actions/inquiries';
import { getAssetsUrl } from '@/lib/api-utils';

interface InquiryDetailsPanelProps {
  selectedItem?: any;
  selectedItemId: string | null;
  activeTab: 'product' | 'freight';
  lang: string;
  token?: string;
  userProfile?: any;
  dict?: any;
  onBack?: () => void;
}

/**
 * Universal safe string extractor that handles strings, numbers, booleans,
 * and relation objects (e.g. { id, name }, { id, title }, { port_name }, etc.)
 */
function resolveStringValue(val: any, fallback: string = '—'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    const candidate =
      val.name ||
      val.title ||
      val.label ||
      val.port_name ||
      val.country_name ||
      val.value ||
      val.description ||
      val.code ||
      val.slug;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number') return String(candidate);
    
    if (Array.isArray(val)) {
      const parts = val.map((v) => resolveStringValue(v, '')).filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : fallback;
    }
  }
  return fallback;
}

/**
 * Resolve avatar image URL using the assets CDN domain if relative
 */
function resolveImageUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const assetsUrl = getAssetsUrl();
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${assetsUrl}/${cleanPath}`;
}

/**
 * Formats date into DD/MM/YYYY
 */
function formatDateSimple(dateVal: any): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
}

/**
 * Formats date and time into "11, Jun 26 | Time: 16.06.28"
 */
function formatDateTimeDisplay(dateVal: any) {
  if (!dateVal) return { full: '—', date: '—', time: '—' };
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return { full: String(dateVal), date: String(dateVal), time: '—' };
    
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[d.getMonth()];
    const yearShort = String(d.getFullYear()).slice(-2);
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    const datePart = `${day}, ${monthStr} ${yearShort}`;
    const timePart = `${hours}.${minutes}.${seconds}`;
    return {
      full: `${datePart} | Time: ${timePart}`,
      date: datePart,
      time: timePart,
    };
  } catch {
    return { full: String(dateVal), date: String(dateVal), time: '—' };
  }
}

/**
 * Format price cleanly with commas and optional decimal places
 */
function formatPrice(val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return String(val);
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// User Avatar component with error fallback
function UserAvatar({
  src,
  name,
  className = 'w-9 h-9',
}: {
  src?: string | null;
  name?: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return (
      <div
        className={`${className} rounded-full bg-brand-blue/15 border border-brand-blue/30 text-brand-blue flex items-center justify-center shrink-0 shadow-2xs`}
        title={name || 'You'}
      >
        <i className="fa-solid fa-user text-xs"></i>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'User'}
      onError={() => setImgError(true)}
      className={`${className} rounded-full object-cover border border-brand-blue/30 shrink-0 shadow-2xs`}
    />
  );
}

// Admin Avatar component with AgriGuru brand
function AdminAvatar({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <div
      className={`${className} rounded-full bg-black flex items-center justify-center shrink-0 border border-border/60 p-1 shadow-2xs`}
      title="AgriGuru Desk"
    >
      <img
        src="/logo.png"
        alt="AgriGuru"
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export default function InquiryDetailsPanel({
  selectedItem,
  selectedItemId,
  activeTab,
  lang,
  token,
  userProfile,
  dict,
  onBack,
}: InquiryDetailsPanelProps) {
  const [apiData, setApiData] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [userPriceInput, setUserPriceInput] = useState('');
  const [isRenegotiating, setIsRenegotiating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [localOffers, setLocalOffers] = useState<any[]>([]);
  const [offerStatus, setOfferStatus] = useState<'normal' | 'confirmed' | 'rejected'>('normal');

  // Reset state when selected item changes
  useEffect(() => {
    setUserPriceInput('');
    setIsRenegotiating(false);
    setActionNotice(null);
    setLocalOffers([]);
    setOfferStatus('normal');
    setApiData(null);
  }, [selectedItemId]);

  // Fetch complete details from backend API
  useEffect(() => {
    const idToFetch = selectedItemId || selectedItem?.id || selectedItem?._id;
    if (!idToFetch) return;

    let isMounted = true;
    const fetchDetails = async () => {
      setIsFetching(true);
      try {
        const response = await getInquiryDetailsAction(idToFetch, lang, token, activeTab);
        if (!isMounted) return;

        if (response.success && response.data && typeof response.data === 'object') {
          setApiData(response.data);
        }
      } catch (err) {
        console.error('[InquiryDetailsPanel] Fetch details error:', err);
      } finally {
        if (isMounted) setIsFetching(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedItemId, selectedItem?.id, selectedItem?._id, lang, token, activeTab]);

  // 1. Resolve Details Object from API response (apiData.details) or selectedItem
  const details = useMemo(() => {
    return {
      ...(selectedItem || {}),
      ...(apiData?.details || {}),
      ...(apiData?.inquiry || {}),
      ...(apiData?.trading_inquiry || {}),
    };
  }, [selectedItem, apiData]);

  // Currency symbol (e.g. "$" or "USD")
  const currencySymbol = details?.currency?.symbol || (typeof details?.currency === 'string' ? details.currency : '$');

  // Title
  const title = resolveStringValue(
    details?.product_name ||
    details?.product?.name ||
    selectedItem?.product?.name ||
    selectedItem?.product_name ||
    details?.commodity?.name ||
    details?.commodity_name ||
    details?.crop_name ||
    details?.title ||
    details?.name ||
    (activeTab === 'freight' ? 'Freight Route Inquiry' : 'Product Inquiry')
  );

  // Status calculation
  const rawStatus = String(
    apiData?.status_text ||
    details?.status_text ||
    apiData?.tag ||
    details?.tag ||
    apiData?.inquiry_status ||
    details?.inquiry_status ||
    apiData?.state ||
    details?.state ||
    apiData?.status ||
    details?.status ||
    selectedItem?.status ||
    'NEGOTIATION'
  ).toUpperCase();

  const itemType = String(details?.type || details?.inquiry_type || 'Inquiry');
  const formattedItemType = itemType.charAt(0).toUpperCase() + itemType.slice(1).toLowerCase();

  const displayStatus = (() => {
    if (offerStatus === 'confirmed') return 'Confirmed';
    if (offerStatus === 'rejected') return 'Rejected';
    if (rawStatus === 'DETAILS') return formattedItemType; // Show 'Inquiry' or 'Offer' instead of Details
    if (rawStatus === 'NEGOTIATION') return 'Negotiation';
    if (rawStatus === 'CONFIRMATION' || rawStatus === 'CONFIRMED') return 'Confirmation';
    if (rawStatus === 'CONTRACT') return 'Contract';
    return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  })();

  // 4. Negotiation History from API (apiData.negotiation array)
  const apiNegotiations: any[] = Array.isArray(apiData?.negotiation)
    ? apiData.negotiation
    : Array.isArray(apiData?.negotiations)
    ? apiData.negotiations
    : [];

  const combinedHistory = useMemo(() => {
    return [...apiNegotiations, ...localOffers];
  }, [apiNegotiations, localOffers]);

  const hasNegotiationData = combinedHistory.length > 0 || (details?.price !== undefined && details?.price !== null && details?.price !== '');

  // 2. Stepper Calculation (4 Parts: Details, Negotiation, Confirmation, Contract)
  let currentStep = 1;
  if (
    rawStatus.includes('CONTRACT') ||
    rawStatus.includes('EXECUTED') ||
    rawStatus.includes('CLOSED') ||
    offerStatus === 'confirmed'
  ) {
    currentStep = 4;
  } else if (
    rawStatus.includes('CONFIRM') ||
    rawStatus.includes('ACCEPTED') ||
    rawStatus.includes('DEAL')
  ) {
    currentStep = 3;
  } else if (
    rawStatus.includes('NEGOTIAT') ||
    rawStatus.includes('COUNTER') ||
    rawStatus.includes('OFFER') ||
    rawStatus.includes('REVIEW') ||
    rawStatus.includes('PROGRESS') ||
    rawStatus.includes('PENDING') ||
    hasNegotiationData
  ) {
    currentStep = 2;
  } else {
    currentStep = 1;
  }

  const firstStepLabel = (rawStatus.includes('FRESH') || rawStatus.includes('ASSIGNED') || rawStatus === 'DETAILS') 
    ? displayStatus 
    : formattedItemType;

  const steps = [
    { id: 1, stepNumber: '01', label: firstStepLabel },
    { id: 2, stepNumber: '02', label: 'Negotiation' },
    { id: 3, stepNumber: '03', label: 'Confirmation' },
    { id: 4, stepNumber: '04', label: 'Contract' },
  ];

  const rawDate = details?.created_at || details?.createdAt || details?.date || details?.shipment_start_date;
  const formattedHeaderDate = formatDateTimeDisplay(rawDate).full;
  const refId = String(details?.id || selectedItemId || '').slice(-8).toUpperCase();

  // 3. Trade Specifications (The 12 Exact Fields from details API)
  const productNameVal = title;
  const countryVal = resolveStringValue(details?.country || details?.product?.country);
  const shipByVal = resolveStringValue(details?.shipping_container || details?.ship_by || details?.container_type);
  const shippingTermVal = resolveStringValue(details?.shipping_term || details?.shipment_term || details?.incoterm);
  const portOfLoadingVal = resolveStringValue(details?.loading_port || details?.port_of_loading || details?.pol);
  const portOfDestinationVal = resolveStringValue(details?.destination_port || details?.discharge_port || details?.pod);

  const shipmentPeriodVal = (() => {
    if (details?.shipment_start_date && details?.shipment_end_date) {
      return `${formatDateSimple(details.shipment_start_date)} – ${formatDateSimple(details.shipment_end_date)}`;
    }
    if (details?.shipment_period) return resolveStringValue(details.shipment_period);
    if (details?.delivery_period) return resolveStringValue(details.delivery_period);
    return '—';
  })();

  const packingTypeVal = resolveStringValue(details?.packing_type || details?.packaging_type || details?.packaging);

  const quantityVal = (() => {
    const q = details?.quantity ?? details?.qty;
    return q !== undefined && q !== null && q !== '' ? `${q} MT` : '—';
  })();

  const containerRaw = resolveStringValue(details?.fcl ?? details?.container_count ?? details?.container_fcl);
  const containerFclVal = containerRaw !== '—' ? `${containerRaw} FCLs` : '—';
  const paymentTermVal = resolveStringValue(details?.payment_term || details?.payment_terms || details?.payment_type);
  const descriptionVal = resolveStringValue(details?.description || details?.desc || details?.note, '—');

  // Last User offer
  const lastUser = combinedHistory
    .slice()
    .reverse()
    .find((h) => {
      const type = String(h.requester_type || h.sender || '').toUpperCase();
      return type === 'S' || type === 'B' || type === 'U' || type === 'USER' || type === 'SELLER' || type === 'BUYER' || h.is_admin === false;
    });

  const userCounterName = lastUser?.requester?.name || userProfile?.name || 'You';

  // Recommended bid range
  const bidRange = apiData?.negotiation_bid_range;

  // Determine who submitted the LAST offer
  const lastOverallOffer = combinedHistory.length > 0 ? combinedHistory[combinedHistory.length - 1] : null;
  let isLastOfferFromUser = false;
  if (lastOverallOffer) {
    const type = String(lastOverallOffer.requester_type || lastOverallOffer.sender || '').toUpperCase();
    isLastOfferFromUser = type === 'S' || type === 'B' || type === 'U' || type === 'USER' || type === 'SELLER' || type === 'BUYER' || lastOverallOffer.is_admin === false;
  }

  // Resolved User Profile Avatar URL
  const rawUserAvatar =
    userProfile?.profile_image ||
    userProfile?.profile_picture ||
    userProfile?.avatar ||
    userProfile?.image ||
    userProfile?.photo;
  const resolvedUserAvatar = resolveImageUrl(rawUserAvatar);

  // Group combined history into paired rounds (Admin offer vs User offer)
  const rounds = useMemo(() => {
    const result: { roundNumber: number; adminOffer?: any; userOffer?: any }[] = [];
    let current: { roundNumber: number; adminOffer?: any; userOffer?: any } = { roundNumber: 1 };

    for (const item of combinedHistory) {
      const type = String(item.requester_type || item.sender || '').toUpperCase();
      const isAdmin = type === 'A' || type === 'ADMIN' || type === 'AGRIGURU' || item.is_admin === true;

      if (isAdmin) {
        if (current.adminOffer) {
          result.push(current);
          current = { roundNumber: result.length + 1, adminOffer: item };
        } else {
          current.adminOffer = item;
        }
      } else {
        if (current.userOffer) {
          result.push(current);
          current = { roundNumber: result.length + 1, userOffer: item };
        } else {
          current.userOffer = item;
        }
      }
    }

    if (current.adminOffer || current.userOffer) {
      result.push(current);
    }

    // Default fallback if completely empty
    if (result.length === 0) {
      result.push({
        roundNumber: 1,
        adminOffer: details?.price ? { price: details.price, requester_type: 'A', created_at: details.created_at } : undefined,
      });
    }

    return result;
  }, [combinedHistory, details]);

  // Handle Renegotiate / Counter submission
  const handleRenegotiateSubmit = async () => {
    const priceNum = parseFloat(userPriceInput);
    if (!priceNum || priceNum <= 0) {
      setActionNotice({ type: 'error', message: 'Please enter a valid counter price.' });
      return;
    }

    setIsSubmitting(true);
    setActionNotice(null);

    try {
      const inquiryId = details?.id || selectedItemId || '';
      const response = await submitInquiryNegotiationAction(
        inquiryId,
        priceNum,
        `User counter: ${currencySymbol}${priceNum}`,
        lang,
        token
      );

      const newOffer = {
        id: `local-${Date.now()}`,
        requester_type: 'S',
        requester: { name: userCounterName },
        price: priceNum,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      setLocalOffers((prev) => [...prev, newOffer]);
      setUserPriceInput('');
      setIsRenegotiating(false);
      setActionNotice({
        type: 'success',
        message: response.message || `Your counter of ${currencySymbol}${priceNum} has been submitted to AgriGuru!`,
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to submit counter offer.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Confirm Offer
  const handleConfirm = async () => {
    if (!confirm('Are you sure you want to confirm and accept this price offer?')) return;

    setIsActionLoading(true);
    setActionNotice(null);

    try {
      const inquiryId = details?.id || selectedItemId || '';
      await respondInquiryAction(inquiryId, 'CONFIRM', lang, token);
      setOfferStatus('confirmed');
      setIsRenegotiating(false);
      setActionNotice({
        type: 'success',
        message: 'Offer accepted and confirmed! The formal Trade Contract is being generated.',
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to confirm offer.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Reject Offer
  const handleReject = async () => {
    if (!confirm('Are you sure you want to decline this price offer?')) return;

    setIsActionLoading(true);
    setActionNotice(null);

    try {
      const inquiryId = details?.id || selectedItemId || '';
      await respondInquiryAction(inquiryId, 'REJECT', lang, token);
      setOfferStatus('rejected');
      setIsRenegotiating(false);
      setActionNotice({
        type: 'info',
        message: 'Offer declined. You may enter a new counter price or contact support.',
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to reject offer.' });
    } finally {
      setIsActionLoading(false);
    }
  };



  const hasNegotiation = currentStep >= 2;

  if (!selectedItem && !selectedItemId && !apiData) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 min-h-[420px] shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4 border border-border text-foreground/40 text-2xl">
          <i className="fa-solid fa-hand-pointer"></i>
        </div>
        <h3 className="text-lg font-bold text-foreground">Select an Inquiry</h3>
        <p className="text-xs text-foreground/60 mt-1 max-w-sm leading-relaxed">
          Choose an inquiry or offer from the list to view its complete specifications, progress, and negotiate pricing.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col min-h-full shadow-sm relative">


      {/* --- 2. DETAILS & NEGOTIATION --- */}
      <div className="p-3 sm:p-4 flex flex-col gap-4">

        {/* 1. Header Card Top Section */}
        <div className="border-b border-border pb-3 flex flex-row justify-between items-center gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="lg:hidden flex items-center justify-center w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/80 transition-colors shrink-0"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
            )}
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight break-words truncate">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs px-3 py-1 rounded-full border font-bold uppercase tracking-wider ${
              offerStatus === 'confirmed' || currentStep === 3 || currentStep === 4
                ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
                : offerStatus === 'rejected'
                ? 'border-brand-red/30 bg-brand-red/10 text-brand-red'
                : 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue'
            }`}
          >
            {displayStatus}
          </span>
          </div>
        </div>

      {/* --- Stepper & Details Toggle Group --- */}
      <div className="flex flex-col gap-4">
        {/* --- 1. HORIZONTAL STEPPER --- */}
        <div className="flex items-center justify-between relative max-w-lg mx-auto w-full px-2">
          {/* Progress Lines Container */}
          <div className="absolute top-[14px] sm:top-[18px] left-8 sm:left-12 right-8 sm:right-12 h-[2px] z-0 hidden sm:block">
            <div className="absolute inset-0 bg-border/50"></div>
            <div 
              className="absolute top-0 bottom-0 left-0 bg-brand-green transition-all duration-500 shadow-sm shadow-brand-green/30" 
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
          
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5 bg-card sm:px-2">
                <div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    isActive
                      ? 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/20'
                      : isCompleted
                      ? 'bg-brand-green border-brand-green text-white'
                      : 'bg-card border-border text-foreground/40'
                  }`}
                >
                  {isCompleted ? <i className="fa-solid fa-check text-[10px] sm:text-xs"></i> : step.id}
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-semibold ${
                    isActive ? 'text-brand-blue' : isCompleted ? 'text-brand-green' : 'text-foreground/40'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Hide Details / Show Details Toggle Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold text-foreground/80 bg-foreground/5 hover:bg-foreground/10 border border-border rounded-lg transition-all active:scale-95 shadow-2xs cursor-pointer"
          >
            <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
            <i className={`fa-solid fa-chevron-${showDetails ? 'up' : 'down'} text-[10px]`}></i>
          </button>
        </div>
      </div>

      {/* 3. Collapsible Specifications Table */}
      {showDetails && (
        <>
          {/* Mobile View: 2 columns (1 Key, 1 Value) per row */}
          <div className="block sm:hidden border border-border rounded-xl mb-3 shadow-sm overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-border">
                {[
                  { label: 'Product Name', value: productNameVal },
                  { label: 'Country', value: countryVal },
                  { label: 'Ship By', value: shipByVal },
                  { label: 'Shipping Term', value: shippingTermVal },
                  { label: 'Port of Loading', value: portOfLoadingVal },
                  { label: 'Port of Dest.', value: portOfDestinationVal },
                  { label: 'Shipment Period', value: shipmentPeriodVal },
                  { label: 'Packing Type', value: packingTypeVal },
                  { label: 'Quantity (MT)', value: quantityVal },
                  { label: 'Container (FCL)', value: containerFclVal },
                  { label: 'Payment Term', value: paymentTermVal },
                  { label: 'Description', value: descriptionVal },
                ].map((item, idx) => (
                  <tr key={idx} className="divide-x divide-border hover:bg-foreground/[0.01]">
                    <td className="px-3 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium w-[40%]">{item.label}</td>
                    <td className="px-3 py-2.5 font-semibold text-foreground w-[60%]">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desktop View: Original 4 columns (2 Keys, 2 Values) per row */}
          <div className="hidden sm:block border border-border rounded-xl mb-3 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-sm min-w-[600px]">
              <tbody className="divide-y divide-border">
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium w-[20%]">Product Name</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground w-[30%]">{productNameVal}</td>
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium w-[20%]">Country</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground w-[30%]">{countryVal}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Ship By</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{shipByVal}</td>
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Shipping Term</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{shippingTermVal}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Port of Loading</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{portOfLoadingVal}</td>
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Port of Dest.</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{portOfDestinationVal}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Shipment Period</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{shipmentPeriodVal}</td>
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Packing Type</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{packingTypeVal}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Quantity (MT)</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{quantityVal}</td>
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Container (FCL)</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{containerFclVal}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Payment Term</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{paymentTermVal}</td>
                  <td className="px-4 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Description</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{descriptionVal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 4. Negotiation Process Section (Compact & Well-Proportioned) */}
      {hasNegotiation && (
      <div className="w-full max-w-2xl mx-auto mt-1 mb-2">
        <div className="text-center mb-3">
          <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
            Negotiation Process
          </h3>
          {bidRange && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-[11px] font-semibold text-brand-blue">
              <i className="fa-solid fa-chart-line text-[10px]"></i>
              <span>Bid Range: {currencySymbol}{formatPrice(bidRange.min_price_bid)} – {currencySymbol}{formatPrice(bidRange.max_price_bid)}</span>
            </div>
          )}
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div
            className={`p-3 mb-4 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed animate-in fade-in duration-200 ${
              actionNotice.type === 'success'
                ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                : actionNotice.type === 'error'
                ? 'bg-brand-red/10 border-brand-red/30 text-brand-red'
                : 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue'
            }`}
          >
            <i
              className={`fa-solid ${
                actionNotice.type === 'success'
                  ? 'fa-circle-check'
                  : actionNotice.type === 'error'
                  ? 'fa-triangle-exclamation'
                  : 'fa-circle-info'
              } text-sm mt-0.5 shrink-0`}
            ></i>
            <span className="font-medium">{actionNotice.message}</span>
          </div>
        )}

        {/* Two-Column Titles: Admin (AgriGuru) vs User */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-2.5">
          {/* Admin Header */}
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs sm:text-[13px] font-bold text-foreground">
              AgriGuru Price Offer
            </span>
          </div>

          {/* User Header */}
          <div className="flex items-center justify-end sm:justify-start gap-1.5 px-1">
            <span className="text-xs sm:text-[13px] font-bold text-foreground text-right sm:text-left">
              Your Asking Price
            </span>
          </div>
        </div>

        {/* Paired Rounds Thread */}
        <div className="flex flex-col gap-3 mb-6">
          {rounds.map((round, rIdx) => {
            const isLatestRound = rIdx === rounds.length - 1;
            const adminOffer = round.adminOffer;
            const userOffer = round.userOffer;
            const adminTime = formatDateTimeDisplay(adminOffer?.created_at || adminOffer?.timestamp);
            const userTime = formatDateTimeDisplay(userOffer?.created_at || userOffer?.timestamp);

            return (
              <div key={round.roundNumber} className="grid grid-cols-2 gap-3 sm:gap-4">
                
                {/* Left Column: AgriGuru Price Offer */}
                {adminOffer ? (
                  <div className="bg-foreground/[0.04] dark:bg-card border border-border/80 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 transition-all shadow-2xs">
                    <AdminAvatar className="w-6 h-6 sm:w-9 sm:h-9 hidden sm:flex" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold text-foreground/85 truncate" suppressHydrationWarning>
                        {adminTime.full}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-sm sm:text-base font-black text-foreground tracking-tight">
                        {currencySymbol}{formatPrice(adminOffer.price)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="block" />
                )}

                {/* Right Column: User Asking Price */}
                {userOffer ? (
                  <div className="bg-foreground/[0.04] dark:bg-card border border-border/80 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center items-end sm:items-start text-right sm:text-left gap-1 sm:gap-3 transition-all shadow-2xs">
                    <UserAvatar
                      src={resolvedUserAvatar}
                      name={userCounterName}
                      className="w-6 h-6 sm:w-9 sm:h-9 hidden sm:flex"
                    />
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-[10px] sm:text-xs font-semibold text-foreground/85 truncate" suppressHydrationWarning>
                        {userTime.full}
                      </p>
                    </div>
                    <div className="text-right sm:text-left shrink-0">
                      <span className="text-sm sm:text-base font-black text-brand-blue tracking-tight">
                        {currencySymbol}{formatPrice(userOffer.price)}
                      </span>
                    </div>
                  </div>
                ) : isLatestRound && isRenegotiating ? (
                  /* Active Renegotiation Input Card right inside User's slot */
                  <div className="bg-foreground/[0.04] dark:bg-card border-2 border-brand-blue rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 shadow-md shadow-brand-blue/10 animate-in fade-in zoom-in-95 duration-200">
                    <UserAvatar
                      src={resolvedUserAvatar}
                      name={userCounterName}
                      className="w-8 h-8 sm:w-9 sm:h-9 ring-2 ring-brand-blue/40"
                    />
                    <div className="flex-1 min-w-0 flex items-center">
                      <span className="text-xs sm:text-sm font-bold text-foreground/60 mr-1.5 shrink-0">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        min={bidRange?.min_price_bid || 1}
                        max={bidRange?.max_price_bid || undefined}
                        autoFocus
                        value={userPriceInput}
                        onChange={(e) => setUserPriceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRenegotiateSubmit();
                          } else if (e.key === 'Escape') {
                            setIsRenegotiating(false);
                          }
                        }}
                        placeholder="Enter Your Asking Price"
                        className="w-full bg-transparent text-xs sm:text-sm font-bold text-foreground placeholder:text-foreground/45 placeholder:font-normal focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}

              </div>
            );
          })}
        </div>

        {/* Informational banner when user submitted the last offer */}
        {isLastOfferFromUser && offerStatus === 'normal' && !isRenegotiating && (
          <div className="mb-2 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-blue/10 border border-brand-blue/20 text-xs text-foreground text-center">
            <i className="fa-solid fa-clock text-brand-blue text-xs"></i>
            <span>Waiting for AgriGuru Online Admin to respond before you can negotiate again.</span>
          </div>
        )}
      </div>
      )}
      {/* End of SCROLLABLE MIDDLE */}
      </div>

      {/* --- 3. STICKY BOTTOM: ACTION BUTTONS BAR --- */}
      {hasNegotiation && (
      <div className="p-4 sm:p-5 border-t border-border/50 bg-card shrink-0 z-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isRenegotiating ? (
            /* Renegotiating Mode: Cancel & Submit Buttons */
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRenegotiating(false);
                  setUserPriceInput('');
                }}
                disabled={isSubmitting}
                className="px-7 py-2.5 rounded-xl bg-brand-red hover:bg-brand-red-hover text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <span>Cancel</span>
              </button>

              <button
                type="button"
                onClick={handleRenegotiateSubmit}
                disabled={isSubmitting || !userPriceInput}
                className="px-7 py-2.5 rounded-xl bg-brand-green hover:bg-brand-green-hover text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit</span>
                )}
              </button>
            </>
          ) : (
            /* Standard Mode: Reject, Renegotiate, Confirm Buttons */
            <>
              <button
                type="button"
                onClick={handleReject}
                disabled={isActionLoading || offerStatus !== 'normal'}
                className="px-6 sm:px-7 py-2.5 rounded-xl bg-brand-red hover:bg-brand-red-hover text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <span>Reject</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRenegotiating(true);
                  setUserPriceInput('');
                }}
                disabled={isLastOfferFromUser || isActionLoading || offerStatus !== 'normal'}
                title={isLastOfferFromUser ? 'Waiting for AgriGuru Desk to respond' : 'Submit counter offer'}
                className="px-6 sm:px-7 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <span>Renegotiate</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isActionLoading || offerStatus !== 'normal'}
                className="px-6 sm:px-7 py-2.5 rounded-xl bg-brand-green hover:bg-brand-green-hover text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <span>Confirm</span>
              </button>
            </>
          )}
        </div>
      </div>
      )}

    </div>
  );
}

