'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ChartAddButton } from '@/components/ui/charts/ChartAddButton';
import { ChartActionButton } from '@/components/ui/charts/ChartActionButton';
import { ChartDeleteButton } from '@/components/ui/charts/ChartDeleteButton';
import { DeleteConfirmModal } from '@/components/ui/charts/DeleteConfirmModal';
import { ActionIndicationModal } from '@/components/ui/charts/ActionIndicationModal';
import { SwipeableCard } from '@/components/ui/charts/SwipeableCard';
import { ChartMobileEmptyCard } from '@/components/ui/charts/ChartMobileEmptyCard';
import { ChartMobileItemCard } from '@/components/ui/charts/ChartMobileItemCard';
import { ChartBottomSheetContainer } from '@/components/ui/charts/ChartBottomSheetContainer';
import { ChartCardOptionsBottomSheet } from '@/components/ui/charts/ChartCardOptionsBottomSheet';
import { FreightChartRowsSkeleton } from '@/components/freight-chart/FreightChartGridSkeleton';
import {
  getFreightLoadingPortsAction,
  getFreightDestinationPortsAction,
  addFavoritePortAction,
  deleteFavoritePortAction,
  getFavoritePortsAction,
  checkFreightKYCStatus
} from '@/app/actions/freight';
import { useScrollLock } from '@/lib/scroll-lock';
import { FreightInquiryModal } from '@/components/freight-chart/FreightInquiryModal';
import { prefetchPriceHistory } from '@/components/product-charts/MobileCommodityChart';

// --- Shared Interfaces ---
export interface ShippingContainer {
  id: string;
  title: string;
  default_load_capacity?: number;
  default_unit?: string;
}

export interface PortInfo {
  id: string;
  name: string;
  unlocode?: string;
  city?: string;
  flag?: string;
  country?: { id?: string; name?: string; flag?: string; iso2?: string };
  keywords?: string;
}

export interface FavoriteFreightItem {
  id: string;
  shipBy: string;
  pol: string;
  polFlag: string;
  pod: string;
  podFlag: string;
  freight: string;
  freightPmt: string;
  change: string;
  chartStatus?: boolean;
  loadCapacity?: number;
  loadUnit?: string;
  originalItem?: any;
  favourite_freight_id?: string;
}

const openNextDropdown = (mobileId: string, desktopId: string) => {
  setTimeout(() => {
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 1024;
      const targetId = isDesktop ? desktopId : mobileId;
      const el = document.getElementById(targetId) || document.getElementById(mobileId) || document.getElementById(desktopId);
      el?.click();
    }
  }, 100);
};

interface FreightChartClientProps {
  initialShippingContainers?: ShippingContainer[];
  initialFavorites?: FavoriteFreightItem[];
  initialUserType?: string | null;
  lang?: string;
  common?: any;
  isHomePage?: boolean;
}

export default function FreightChartClient({
  initialShippingContainers = [],
  initialFavorites = [],
  initialUserType = null,
  lang = 'en',
  common = {},
  isHomePage = false
}: FreightChartClientProps) {
  const router = useRouter();

  // Dropdown source data
  const [shippingContainers] = useState<ShippingContainer[]>(initialShippingContainers);
  const [loadingPorts, setLoadingPorts] = useState<PortInfo[]>([]);
  const [destinationPorts, setDestinationPorts] = useState<PortInfo[]>([]);
  
  // List state
  const [addedFreights, setAddedFreights] = useState<FavoriteFreightItem[]>(initialFavorites);
  const [isFetchingFavorites, setIsFetchingFavorites] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    
    if (isHomePage) {
      setAddedFreights(initialFavorites);
      setIsFetchingFavorites(false);
      return;
    }

    const fetchLatestFavorites = async () => {
      try {
        setIsFetchingFavorites(true);
        const favsRes = await getFavoritePortsAction(lang);
        if (!isMounted) return;
        if (favsRes.success && Array.isArray(favsRes.data)) {
          const getTitle = (obj: any, fallback = 'N/A') => {
            if (!obj) return fallback;
            if (typeof obj === 'string') return obj;
            return obj.title || obj.name || obj.label || fallback;
          };
          const getFlag = (obj: any) => {
            if (!obj) return '';
            if (typeof obj === 'string') return obj;
            return obj.flag || obj.country?.flag || '';
          };
          const mapped: FavoriteFreightItem[] = favsRes.data.map((item: any) => {
            const shipBy = getTitle(item.shipping_container) !== 'N/A' 
              ? getTitle(item.shipping_container) 
              : (getTitle(item.shippingContainer) !== 'N/A' ? getTitle(item.shippingContainer) : (item.ship_by || item.shipBy || 'N/A'));
            const pol = getTitle(item.loading_port) !== 'N/A' 
              ? getTitle(item.loading_port) 
              : (getTitle(item.loadingPort) !== 'N/A' ? getTitle(item.loadingPort) : (item.pol || 'N/A'));
            const polFlag = getFlag(item.loading_port) || getFlag(item.loadingPort) || item.loading_port?.country?.flag || item.pol_flag || '';
            const pod = getTitle(item.destination_port) !== 'N/A' 
              ? getTitle(item.destination_port) 
              : (getTitle(item.destinationPort) !== 'N/A' ? getTitle(item.destinationPort) : (item.pod || 'N/A'));
            const podFlag = getFlag(item.destination_port) || getFlag(item.destinationPort) || item.destination_port?.country?.flag || item.pod_flag || '';
            const freight = (item.freight != null ? Math.round(Number(item.freight)) : (item.current_freight != null ? Math.round(Number(item.current_freight)) : 0)).toString();
            const freightPmt = (item.freightPMT != null ? Math.round(Number(item.freightPMT)) : (item.freight_pmt != null ? Math.round(Number(item.freight_pmt)) : (item.price != null ? Math.round(Number(item.price)) : 0))).toString();
            const change = (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString();
            const isExplicitlyDisabled = (val: any) => {
              return val === false || val === 'false' || val === 'off' || val === 'disable' || val === 'disabled';
            };
            const chartStatus = !(isExplicitlyDisabled(item.chart_status) || isExplicitlyDisabled(item.chartStatus) || isExplicitlyDisabled(item.is_chart));
            const loadCapacity = item.shipping_container?.default_load_capacity || item.load_capacity || 26;
            const loadUnit = item.shipping_container?.default_unit?.title || item.load_unit || 'MT';
            return {
              id: item.id || item.favourite_freight_id || item.favourite_port_id || item.favorite_port_id || item._id || String(Date.now()),
              shipBy,
              pol,
              polFlag,
              pod,
              podFlag,
              freight,
              freightPmt,
              change,
              chartStatus,
              loadCapacity,
              loadUnit,
              originalItem: item
            };
          });
          setAddedFreights(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch latest freight favorites", err);
      } finally {
        if (isMounted) setIsFetchingFavorites(false);
      }
    };
    fetchLatestFavorites();
    return () => { isMounted = false; };
  }, [lang, isHomePage, initialFavorites]);

  useEffect(() => {
    if (!isFetchingFavorites && addedFreights.length === 0 && initialFavorites.length > 0) {
      setAddedFreights(initialFavorites);
    }
  }, [initialFavorites, isFetchingFavorites, addedFreights.length]);

  // Loading states
  const [polLoading, setPolLoading] = useState(false);
  const [podLoading, setPodLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dropdown selection states
  const [selectedShipBy, setSelectedShipBy] = useState('');
  const [selectedPOL, setSelectedPOL] = useState('');
  const [selectedPOD, setSelectedPOD] = useState('');

  // UI modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionIndication, setActionIndication] = useState<{ isOpen: boolean; message: string; indication: string } | null>(null);
  const [activeBottomSheetId, setActiveBottomSheetId] = useState<string | null>(null);
  const [selectedInitialTab, setSelectedInitialTab] = useState<string>('Overview');
  const [selectedOptionsItem, setSelectedOptionsItem] = useState<any | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerPos, setDisclaimerPos] = useState<'top' | 'bottom'>('bottom');
  const [showMobileAddForm, setShowMobileAddForm] = useState(false);
  const [isFreightInquiryModalOpen, setIsFreightInquiryModalOpen] = useState(false);
  const [selectedFreightInquiryItem, setSelectedFreightInquiryItem] = useState<FavoriteFreightItem | null>(null);
  const [freightPriceLimits, setFreightPriceLimits] = useState<{ min?: number; max?: number } | null>(null);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [kycMessage, setKycMessage] = useState('');
  const [kycIndicationText, setKycIndicationText] = useState('Submit Documents');
  const [kycRedirectUrl, setKycRedirectUrl] = useState(`/${lang}/profile`);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingLoadingId, setBookingLoadingId] = useState<string | number | null>(null);

  useScrollLock(showMobileAddForm);

  const handleDisclaimerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceNeeded = 180;
    if (spaceBelow < spaceNeeded && rect.top > spaceNeeded) {
      setDisclaimerPos('top');
    } else {
      setDisclaimerPos('bottom');
    }
    setShowDisclaimer(true);
  };

  const gridCols = 'grid-cols-[1.2fr_1.4fr_1.4fr_0.9fr_1fr_0.9fr_0.7fr_1.3fr]';

  // Helper function to extract flag URL
  const getFlagUrl = (flagPath?: string): string => {
    if (!flagPath) return '';
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return flagPath.startsWith('http') ? flagPath : `${baseUrl}/${flagPath.replace(/^\//, '')}`;
  };

  // Helper to render flag (supports images and emojis)
  const renderFlag = (flagPath?: string, alt = '', className = 'w-[16px] h-[12px] object-cover rounded-[2px] shrink-0 border border-border') => {
    if (!flagPath) return null;
    if (!flagPath.includes('/') && !flagPath.includes('.') && !flagPath.startsWith('http')) {
      return <span className="text-[14px] leading-none shrink-0">{flagPath}</span>;
    }
    return (
      <img
        src={getFlagUrl(flagPath)}
        alt={alt}
        className={className}
      />
    );
  };

  // 1. Handle Ship By selection -> dynamically fetch Loading Ports
  const handleShipBySelect = useCallback(async (shipById: string) => {
    setSelectedShipBy(shipById);
    setSelectedPOL('');
    setSelectedPOD('');
    setLoadingPorts([]);
    setDestinationPorts([]);

    if (!shipById) return;

    setPolLoading(true);
    try {
      const res = await getFreightLoadingPortsAction(shipById, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setLoadingPorts(res.data);
        if (res.data.length === 1) {
          const singlePortId = res.data[0].id;
          setSelectedPOL(singlePortId);
          
          // Auto fetch POD
          setPodLoading(true);
          getFreightDestinationPortsAction(shipById, singlePortId, lang)
            .then(dRes => {
              if (dRes.success && Array.isArray(dRes.data)) {
                setDestinationPorts(dRes.data);
                if (dRes.data.length === 1) {
                  setSelectedPOD(dRes.data[0].id);
                } else {
                  openNextDropdown('mobile-pod', 'desktop-pod-select');
                }
              }
            })
            .finally(() => setPodLoading(false));
        } else {
          openNextDropdown('mobile-pol', 'desktop-pol-select');
        }
      } else {
        setLoadingPorts([]);
      }
    } catch (err) {
      console.error('Failed to load loading ports:', err);
      setLoadingPorts([]);
    } finally {
      setPolLoading(false);
    }
  }, [lang]);

  // 2. Handle Loading Port selection -> dynamically fetch Destination Ports
  const handlePOLSelect = useCallback(async (polId: string) => {
    setSelectedPOL(polId);
    setSelectedPOD('');
    setDestinationPorts([]);

    if (!polId || !selectedShipBy) return;

    setPodLoading(true);
    try {
      const res = await getFreightDestinationPortsAction(selectedShipBy, polId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setDestinationPorts(res.data);
        if (res.data.length === 1) {
          setSelectedPOD(res.data[0].id);
        } else {
          openNextDropdown('mobile-pod', 'desktop-pod-select');
        }
      } else {
        setDestinationPorts([]);
      }
    } catch (err) {
      console.error('Failed to load destination ports:', err);
      setDestinationPorts([]);
    } finally {
      setPodLoading(false);
    }
  }, [selectedShipBy, lang]);

  // 3. Handle Destination Port selection
  const handlePODSelect = useCallback((podId: string) => {
    setSelectedPOD(podId);
  }, []);

  // Validation
  const isAddFreightEnabled = Boolean(selectedShipBy && selectedPOL && selectedPOD);

  // Auto-scroll to the note element of the mobile form when all required fields are selected
  useEffect(() => {
    if (isAddFreightEnabled && showMobileAddForm) {
      const scrollTimer = setTimeout(() => {
        const noteEl = document.getElementById('mobile-add-freight-note');
        if (noteEl) {
          noteEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 200);
      return () => clearTimeout(scrollTimer);
    }
  }, [isAddFreightEnabled, showMobileAddForm]);

  // 4. Handle Add Freight
  const handleAddFreight = async () => {
    if (!isAddFreightEnabled || isAdding) return;

    setIsAdding(true);
    try {
      const payload = {
        shipping_container_id: selectedShipBy,
        loading_port_id: selectedPOL,
        destination_port_id: selectedPOD
      };

      const result = await addFavoritePortAction(payload, lang);

      if (result.success) {
        // Optimistic item
        const shipByObj = shippingContainers.find(s => s.id === selectedShipBy);
        const polObj = loadingPorts.find(p => p.id === selectedPOL);
        const podObj = destinationPorts.find(p => p.id === selectedPOD);

        const fallbackItem: FavoriteFreightItem = {
          id: result.data?.id || result.data?.favourite_freight_id || result.data?.favourite_port_id || result.data?._id || String(Date.now()),
          shipBy: shipByObj?.title || '20FT FCL',
          pol: polObj?.name || 'Mundra',
          polFlag: polObj?.country?.flag || polObj?.flag || '',
          pod: podObj?.name || 'Dammam',
          podFlag: podObj?.country?.flag || podObj?.flag || '',
          freight: (result.data?.freight != null ? Math.round(Number(result.data.freight)) : 2663).toString(),
          freightPmt: (result.data?.freightPMT != null ? Math.round(Number(result.data.freightPMT)) : (result.data?.freight_pmt != null ? Math.round(Number(result.data.freight_pmt)) : 102)).toString(),
          change: (result.data?.change != null ? Math.round(Number(result.data.change)) : (result.data?.price_change != null ? Math.round(Number(result.data.price_change)) : 25)).toString(),
          chartStatus: true,
          loadCapacity: shipByObj?.default_load_capacity || 26,
          loadUnit: 'MT',
          originalItem: result.data
        };
        setAddedFreights(prev => [fallbackItem, ...prev]);

        toast.success('Freight added to chart successfully!');
        setShowMobileAddForm(false);
        
        // Reset selections
        setSelectedShipBy('');
        setSelectedPOL('');
        setSelectedPOD('');
        setLoadingPorts([]);
        setDestinationPorts([]);
      } else {

        if (result.response_indication) {
          setActionIndication({ 
            isOpen: true, 
            message: result.error || 'Limit over', 
            indication: result.response_indication 
          });
        } else {
          toast.error(result.error || 'Failed to add freight');
        }
      }
    } catch (err: any) {
      console.error('Error adding freight:', err);
      toast.error('An error occurred while adding freight');
    } finally {
      setIsAdding(false);
    }
  };

  // 5. Handle Delete Freight
  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteFavoritePortAction(id, lang);
      if (result.success) {
        setAddedFreights(prev => prev.filter(item => item.id !== id));
        toast.success('Freight deleted successfully');
      } else {
        setAddedFreights(prev => prev.filter(item => item.id !== id));
        toast.success('Freight deleted');
      }
    } catch (err) {
      setAddedFreights(prev => prev.filter(item => item.id !== id));
      toast.success('Freight deleted');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleBooking = async (item?: FavoriteFreightItem, triggerId?: string | number) => {
    const hasAuth = Boolean(
      initialUserType ||
      (typeof document !== 'undefined' && (document.cookie.includes('auth_token=') || document.cookie.includes('user_info=')))
    );

    if (!hasAuth) {
      router.push(`/${lang}/login`);
      return;
    }

    if (isBookingLoading) return;

    // Resolve target freight item
    const targetItem = item || (addedFreights.length > 0 ? (addedFreights.find(f => 
      (selectedShipBy && f.shipBy?.toLowerCase().includes(selectedShipBy.toLowerCase())) ||
      (selectedPOL && f.pol?.toLowerCase().includes(selectedPOL.toLowerCase()))
    ) || addedFreights[0]) : null);

    const favFreightId = (
      targetItem?.id ? String(targetItem.id) :
      (targetItem as any)?.favourite_freight_id ? String((targetItem as any).favourite_freight_id) :
      (targetItem as any)?.favourite_port_id ? String((targetItem as any).favourite_port_id) :
      (targetItem as any)?.originalItem?.id ? String((targetItem as any).originalItem.id) :
      (targetItem as any)?.originalItem?.favourite_freight_id ? String((targetItem as any).originalItem.favourite_freight_id) :
      (targetItem as any)?.originalItem?.favourite_port_id ? String((targetItem as any).originalItem.favourite_port_id) :
      (targetItem as any)?.originalItem?._id ? String((targetItem as any).originalItem._id) :
      ''
    );

    if (!favFreightId) {
      toast.error('Please add or select a freight route first.');
      return;
    }

    setIsBookingLoading(true);
    setBookingLoadingId(triggerId || (item ? item.id : 'bottom'));

    try {
      let kycResponse: any = null;
      try {
        const abortCtrl = new AbortController();
        const timeoutId = setTimeout(() => abortCtrl.abort(), 8000);
        const kycResRaw = await fetch(`/api/freight-options?type=check-kyc&favFreightId=${encodeURIComponent(favFreightId)}&lang=${lang}`, {
          signal: abortCtrl.signal
        });
        clearTimeout(timeoutId);
        kycResponse = await kycResRaw.json();
      } catch {
        kycResponse = await checkFreightKYCStatus(favFreightId, lang).catch(() => null);
      }

      if (kycResponse?.isUnauthorized) {
        toast.error('Session expired. Please log in.');
        router.push(`/${lang}/login`);
        return;
      }

      const canCreate = kycResponse?.data?.can_create ?? kycResponse?.can_create;
      const indication = kycResponse?.response_indication || kycResponse?.data?.response_indication;
      const isVerifiedInProfile = Boolean(kycResponse?.is_kyc_verified);
      const canCreateByMsg = /can create/i.test(kycResponse?.message || '');

      // If explicitly permitted to create, do NOT block - open the inquiry modal!
      const isPermitted = canCreate === true || canCreate === 1 || canCreateByMsg;

      const isBlocked = !isPermitted && (
        canCreate === false ||
        canCreate === 0 ||
        (indication === 'NOT_VERIFIED' && !isVerifiedInProfile) ||
        indication === 'MEMBERSHIP_REQUIRED' ||
        indication === 'LIMIT_OVER' ||
        indication === 'KYC_REQUIRED' ||
        ((kycResponse?.success === false || kycResponse?.success === 0 || kycResponse?.status === false || kycResponse?.status === 0) && Boolean(indication))
      );

      if (isBlocked) {
        if (indication === 'NOT_VERIFIED' && isVerifiedInProfile) {
          // User is verified in profile, proceed smoothly
        } else {
          setKycMessage(kycResponse?.message || "You cannot proceed with freight inquiry.");
          if (indication === 'NOT_VERIFIED' && !isVerifiedInProfile) {
            setKycIndicationText('Submit Documents');
            setKycRedirectUrl(`/${lang}/profile`);
          } else {
            setKycIndicationText('Upgrade Plan');
            setKycRedirectUrl(`/${lang}/profile`);
          }
          setIsKYCModalOpen(true);
          return;
        }
      }

      if (!isPermitted && (kycResponse?.success === false || kycResponse?.status === false)) {
        toast.error(kycResponse?.message || "Unable to proceed with freight booking");
        return;
      }

      const minBid = kycResponse?.data?.min_price_bid ?? kycResponse?.min_price_bid ?? kycResponse?.data?.min_price ?? kycResponse?.min_price ?? kycResponse?.data?.min_rate;
      const maxBid = kycResponse?.data?.max_price_bid ?? kycResponse?.max_price_bid ?? kycResponse?.data?.max_price ?? kycResponse?.max_price ?? kycResponse?.data?.max_rate;
      if (minBid !== undefined || maxBid !== undefined) {
        setFreightPriceLimits({
          min: minBid != null && !isNaN(Number(minBid)) ? Number(minBid) : undefined,
          max: maxBid != null && !isNaN(Number(maxBid)) ? Number(maxBid) : undefined
        });
      } else {
        setFreightPriceLimits(null);
      }

      if (targetItem) {
        setSelectedFreightInquiryItem(targetItem);
      } else {
        setSelectedFreightInquiryItem(null);
      }

      setIsFreightInquiryModalOpen(true);
    } catch (err: any) {
      console.error("Error checking freight inquiry status:", err);
      toast.error(err?.message || "Failed to verify inquiry permissions");
    } finally {
      setIsBookingLoading(false);
      setBookingLoadingId(null);
    }
  };

  const handleFreightOptionSelect = (optionKey: 'inquiry' | 'alert' | 'predict' | 'chart') => {
    if (!selectedOptionsItem) return;
    const item = selectedOptionsItem;
    setSelectedOptionsItem(null);

    if (optionKey === 'inquiry') {
      handleBooking(item, item.id);
    } else if (item.chartStatus) {
      if (optionKey === 'alert') {
        setSelectedInitialTab('Alert Setups');
        setActiveBottomSheetId(String(item.id));
      } else if (optionKey === 'predict') {
        setSelectedInitialTab('AI Predict');
        setActiveBottomSheetId(String(item.id));
      } else if (optionKey === 'chart') {
        setSelectedInitialTab('Overview');
        setActiveBottomSheetId(String(item.id));
      }
    }
  };

  return (
    <>
      <div className="w-full flex flex-col gap-0 lg:gap-2">
        <div className="w-full relative">
          {/* Desktop Filter Row */}
          <div className={`hidden lg:grid ${gridCols} gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0 border border-transparent`}>
            {/* 1. Ship by */}
            <div className="w-full min-w-0">
              <SearchableSelect
                id="desktop-shipby-select"
                value={selectedShipBy}
                onChange={handleShipBySelect}
                options={shippingContainers}
                placeholder={common.ship_by || "Ship by"}
                disabled={shippingContainers.length === 0}
                loading={false}
              />
            </div>

            {/* 2. Loading Port */}
            <div className="w-full min-w-0">
              <SearchableSelect
                id="desktop-pol-select"
                value={selectedPOL}
                onChange={handlePOLSelect}
                options={loadingPorts}
                placeholder={common.port || "Port"}
                disabled={!selectedShipBy || polLoading}
                loading={polLoading}
              />
            </div>

            {/* 3. Destination Port */}
            <div className="w-full min-w-0">
              <SearchableSelect
                id="desktop-pod-select"
                value={selectedPOD}
                onChange={handlePODSelect}
                options={destinationPorts}
                placeholder={common.destination_port || "Destination Port"}
                disabled={!selectedPOL || podLoading}
                loading={podLoading}
              />
            </div>

            {/* Static Column Headers */}
            <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-border bg-card items-center justify-center text-foreground font-semibold text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
              Freight
            </div>

            <div className="hidden lg:flex flex-col w-full h-[45px] rounded-lg border border-border bg-card items-center justify-center text-foreground font-semibold text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 leading-tight select-none cursor-default">
              <span>Freight</span>
              <span className="text-[12px] text-muted-foreground leading-none mt-0.5">(PMT)</span>
            </div>

            <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-border bg-card items-center justify-center text-foreground font-semibold text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
              Change
            </div>

            <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-border bg-card items-center justify-center text-foreground font-semibold text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
              Chart
            </div>

            {/* Reusable Add Freight Button */}
            <ChartAddButton
              id="desktop-add-freight-btn"
              onClick={handleAddFreight}
              disabled={!isAddFreightEnabled}
              loading={isAdding}
              label="Add Freight"
              tooltipText="Please select container, loading port & destination port"
              variant="desktop"
            />
          </div>

          {/* Data Rows */}
          <div className={`mt-0 lg:mt-2 ${!isFetchingFavorites && addedFreights.length === 0 ? 'lg:min-h-[220px]' : ''}`}>
            {isFetchingFavorites && addedFreights.length === 0 ? (
              <FreightChartRowsSkeleton count={4} />
            ) : addedFreights.length === 0 ? (
              <>
                {/* Mobile/Tablet Compact Card Empty State */}
                <ChartMobileEmptyCard
                  onClick={() => setShowMobileAddForm(true)}
                  icon="fa-solid fa-ship"
                  badgeLabel="Freight Watchlist"
                  countLabel="0 Routes"
                  title="No Freight Routes Added"
                  actionText="Add Freight"
                  description="Tap to pick ship by, loading port & destination port"
                />

                {/* Desktop Empty State with Interactive Step Pointers & Tutorial Guide */}
                <div className="hidden lg:flex flex-col gap-3">
                  {/* Step-by-Step Pointers Grid matching input columns with 100% exact alignment */}
                  <div className={`grid ${gridCols} gap-1.5 px-0 border border-transparent`}>
                    {/* Col 1: Ship by (Step 1) */}
                    <div
                      onClick={() => document.getElementById('desktop-shipby-select')?.click()}
                      className={`group h-[74px] rounded-xl p-1 flex items-center justify-center border select-none w-full min-w-0 overflow-hidden cursor-pointer transition-all ${
                        !selectedShipBy
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-brand-blue text-brand-blue shadow-md ring-2 ring-brand-blue/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                          : 'bg-brand-green/10 dark:bg-brand-green/20 border-brand-green/30 text-brand-green dark:text-emerald-400'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${selectedShipBy ? 'fa-check text-brand-green dark:text-emerald-400' : 'fa-arrow-up animate-bounce text-brand-blue'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${!selectedShipBy ? 'text-brand-blue' : 'text-emerald-800 dark:text-emerald-300'}`}>
                            Step 1: Container
                          </span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words text-foreground`}>
                          {selectedShipBy ? (shippingContainers.find(c => String(c.id) === String(selectedShipBy))?.title || 'Container') : 'Select Container'}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Loading Port (Step 2) */}
                    <div
                      title={!selectedShipBy ? "Please select Container first to unlock" : ""}
                      onClick={() => {
                        if (selectedShipBy) document.getElementById('desktop-pol-select')?.click();
                        else document.getElementById('desktop-shipby-select')?.click();
                      }}
                      className={`group h-[74px] rounded-xl p-1 flex items-center justify-center border select-none w-full min-w-0 overflow-hidden transition-all ${
                        !selectedShipBy
                          ? 'opacity-60 cursor-not-allowed bg-card border border-dashed border-border text-muted-foreground shadow-xs'
                          : !selectedPOL
                            ? 'cursor-pointer bg-blue-50 dark:bg-blue-900/20 border-brand-blue text-brand-blue shadow-md ring-2 ring-brand-blue/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                            : 'cursor-pointer bg-brand-green/10 dark:bg-brand-green/20 border-brand-green/30 text-brand-green dark:text-emerald-400'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${selectedPOL ? 'fa-check text-brand-green dark:text-emerald-400' : selectedShipBy ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-lock text-muted-foreground'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${!selectedShipBy ? 'text-muted-foreground' : !selectedPOL ? 'text-brand-blue' : 'text-emerald-800 dark:text-emerald-300'}`}>Step 2: POL</span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${!selectedShipBy ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {selectedPOL ? (loadingPorts.find(p => String(p.id) === String(selectedPOL))?.name || 'Port') : 'Select Port'}
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Destination Port (Step 3) */}
                    <div
                      title={!selectedPOL ? "Please select Loading Port first to unlock" : ""}
                      onClick={() => {
                        if (selectedPOL) document.getElementById('desktop-pod-select')?.click();
                        else if (selectedShipBy) document.getElementById('desktop-pol-select')?.click();
                        else document.getElementById('desktop-shipby-select')?.click();
                      }}
                      className={`group h-[74px] rounded-xl p-1 flex items-center justify-center border select-none w-full min-w-0 overflow-hidden transition-all ${
                        !selectedPOL
                          ? 'opacity-60 cursor-not-allowed bg-card border border-dashed border-border text-muted-foreground shadow-xs'
                          : !selectedPOD
                            ? 'cursor-pointer bg-blue-50 dark:bg-blue-900/20 border-brand-blue text-brand-blue shadow-md ring-2 ring-brand-blue/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                            : 'cursor-pointer bg-brand-green/10 dark:bg-brand-green/20 border-brand-green/30 text-brand-green dark:text-emerald-400'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${selectedPOD ? 'fa-check text-brand-green dark:text-emerald-400' : selectedPOL ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-lock text-muted-foreground'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${!selectedPOL ? 'text-muted-foreground' : !selectedPOD ? 'text-brand-blue' : 'text-emerald-800 dark:text-emerald-300'}`}>Step 3: POD</span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${!selectedPOL ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {selectedPOD ? (destinationPorts.find(p => String(p.id) === String(selectedPOD))?.name || 'Destination') : 'Destination Port'}
                        </div>
                      </div>
                    </div>

                    {/* Col 4: Freight Preview */}
                    <div className="h-[74px] rounded-xl p-1.5 flex flex-col items-center justify-center text-center border border-dashed border-border bg-muted/40 text-muted-foreground select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-dollar-sign text-muted-foreground text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Freight
                      </div>
                      <div className="text-[9.5px] text-muted-foreground mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Total rate
                      </div>
                    </div>

                    {/* Col 5: Freight (PMT) Preview */}
                    <div className="h-[74px] rounded-xl p-1.5 flex flex-col items-center justify-center text-center border border-dashed border-border bg-muted/40 text-muted-foreground select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-scale-balanced text-muted-foreground text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">PMT</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Freight (PMT)
                      </div>
                      <div className="text-[9.5px] text-muted-foreground mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Per MT rate
                      </div>
                    </div>

                    {/* Col 6: Change Preview */}
                    <div className="h-[74px] rounded-xl p-1.5 flex flex-col items-center justify-center text-center border border-dashed border-border bg-muted/40 text-muted-foreground select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-arrow-trend-up text-muted-foreground text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Trend</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Change
                      </div>
                      <div className="text-[9.5px] text-muted-foreground mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Daily shift
                      </div>
                    </div>

                    {/* Col 7: Chart Preview */}
                    <div className="h-[74px] rounded-xl p-1.5 flex flex-col items-center justify-center text-center border border-dashed border-border bg-muted/40 text-muted-foreground select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-chart-area text-muted-foreground text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Chart</span>
                    </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Chart
                      </div>
                      <div className="text-[9.5px] text-muted-foreground mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Rate history
                      </div>
                    </div>

                    {/* Col 8: Final Step - Add Freight Button Pointer */}
                    <div
                      title={!isAddFreightEnabled ? "Please complete all steps to unlock" : ""}
                      onClick={() => {
                        if (isAddFreightEnabled) handleAddFreight();
                      }}
                      className={`group h-[74px] rounded-xl p-1 flex items-center justify-center border select-none w-full min-w-0 overflow-hidden transition-all ${
                        !isAddFreightEnabled
                          ? 'opacity-60 cursor-not-allowed bg-card border border-dashed border-border text-muted-foreground shadow-xs'
                          : 'cursor-pointer bg-primary-gradient text-white border-none shadow-md hover:shadow-lg active:scale-[0.98]'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${isAddFreightEnabled ? 'fa-arrow-up animate-bounce text-white' : 'fa-lock text-muted-foreground'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isAddFreightEnabled ? 'text-white' : 'text-muted-foreground'}`}>Final</span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${isAddFreightEnabled ? 'text-white' : 'text-muted-foreground'}`}>
                          Add Freight
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Tutorial Showcase Card */}
                  <div className="bg-card rounded-xl p-4 shadow-sm border border-border flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 shrink-0 rounded-full bg-blue-500/10 text-brand-blue flex items-center justify-center text-xl">
                        <i className="fa-solid fa-ship"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100 mb-1">
                          Track Global Freight Rates
                        </h3>
                        <p className="text-[13px] text-foreground/75 leading-relaxed max-w-3xl">
                          Select container type, origin port of loading, and destination port to monitor live shipping costs and historical trends. Stay ahead of market fluctuations!
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress pill */}
                    <div className="flex items-center gap-2 shrink-0 bg-background px-3.5 py-2 rounded-lg border border-border">
                      <i className="fa-solid fa-layer-group text-sm text-brand-blue"></i>
                      <span className="text-sm font-semibold text-foreground/80">
                        {isAddFreightEnabled
                          ? 'Ready to add 🚀'
                          : !selectedShipBy
                            ? 'Select Container'
                            : !selectedPOL
                              ? 'Select Loading Port'
                              : 'Select Destination Port'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-[7px] lg:gap-2 mt-0.5 lg:mt-1">
                {(isHomePage ? addedFreights.slice(0, 4) : addedFreights).map((item, index) => {
                  const changeVal = Number(item.change) || 0;
                  const isPositive = changeVal >= 0;
                  const desktopRowBg = 'bg-card hover:bg-muted';

                  // Determine Vessel/Bulk vs Container
                  const isVesselOrBulk = Boolean(
                    /vessel|bulk|break/i.test(item.shipBy || '') ||
                    /vessel|bulk|break/i.test((item as any).originalItem?.shipping_container?.title || '') ||
                    /vessel|bulk|break/i.test((item as any).originalItem?.shipping_container?.name || '') ||
                    /vessel|bulk|break/i.test((item as any).originalItem?.shipment_type || '') ||
                    /vessel|bulk|break/i.test((item as any).originalItem?.load_type || '')
                  );

                  // 1. Title: Vessel Ocean Freight or Container Ocean Freight
                  const cardTitle = isVesselOrBulk ? 'Vessel Ocean Freight' : 'Container Ocean Freight';

                  // 2. Subtitle (Row 3 Left):
                  // For Vessel: "Vessel: Break Bulk"
                  // For Container: "20ft FCL: 26 MT"
                  let row3Left = '';
                  if (isVesselOrBulk) {
                    row3Left = 'Vessel: Break Bulk';
                  } else {
                    let containerPrefix = '20ft FCL';
                    if (/40\s*(?:ft|foot)/i.test(item.shipBy || '')) {
                      containerPrefix = '40ft FCL';
                    } else if (/20\s*(?:ft|foot)/i.test(item.shipBy || '')) {
                      containerPrefix = '20ft FCL';
                    } else if (item.shipBy && item.shipBy !== 'N/A' && !/container/i.test(item.shipBy)) {
                      containerPrefix = item.shipBy.includes('FCL') ? item.shipBy : `${item.shipBy} FCL`;
                    }
                    row3Left = `${containerPrefix}: ${item.loadCapacity || 26} ${item.loadUnit || 'MT'}`;
                  }

                  // 3. Price Display (Row 2 Right): "( PMT ) $60"
                  const displayPrice = item.freightPmt && item.freightPmt !== '0' ? item.freightPmt : (item.freight || '0');

                  return (
                    <div 
                      key={item.id || index}
                      onMouseEnter={() => { if (item.chartStatus) prefetchPriceHistory(item.id, lang, true); }}
                      onTouchStart={() => { if (item.chartStatus) prefetchPriceHistory(item.id, lang, true); }}
                    >
                      {/* Mobile/Tablet Card Layout */}
                      <SwipeableCard
                        onDelete={() => setDeleteConfirmId(item.id)}
                        onChart={item.chartStatus ? () => {
                          setSelectedInitialTab('Overview');
                          setActiveBottomSheetId(String(item.id));
                        } : undefined}
                      >
                        <ChartMobileItemCard
                          row1Left={
                            <>
                              {renderFlag(item.polFlag, 'POL')}
                              <span className="truncate">POL : {item.pol}</span>
                            </>
                          }
                          row1Right={
                            <>
                              <span className="truncate">POD: {item.pod}</span>
                              {renderFlag(item.podFlag, 'POD')}
                            </>
                          }
                          title={cardTitle}
                          titleClassName="font-bold text-[15px] leading-tight text-foreground truncate min-w-0"
                          priceDisplay={
                            <span className="flex items-center gap-1 font-bold">
                              <span className="text-muted-foreground font-normal text-[13px] sm:text-[14px] tracking-tight">( PMT )</span>
                              <span className="text-[15px] sm:text-[16px] text-foreground font-bold tracking-tight">${displayPrice}</span>
                            </span>
                          }
                          priceClassName="text-foreground shrink-0"
                          onCardClick={() => {
                            if (item.chartStatus) {
                              setSelectedInitialTab('Overview');
                              setActiveBottomSheetId(String(item.id));
                            } else {
                              setSelectedOptionsItem(item);
                            }
                          }}
                          onOptionsClick={() => {
                            setSelectedOptionsItem(item);
                          }}
                          row3Left={row3Left}
                          changeValue={item.change}
                          isPositive={isPositive}
                        />
                      </SwipeableCard>

                      {/* Desktop Row Layout (Matching Screenshot 1 Exactly) */}
                      <div 
                        onMouseEnter={() => { if (item.chartStatus) prefetchPriceHistory(item.id, lang, true); }}
                        className={`hidden lg:grid ${gridCols} gap-1.5 items-center py-3 rounded-lg ${desktopRowBg} shadow-xs border border-border hover:shadow-sm text-[16px] font-semibold px-0`}
                      >
                        {/* 1. Ship by */}
                        <div className="truncate text-foreground/90 font-bold min-w-0 pl-3" title={item.shipBy}>
                          {item.shipBy}
                        </div>

                        {/* 2. Loading Port with Flag */}
                        <div className="flex items-center gap-2 truncate text-foreground/90 min-w-0" title={item.pol}>
                          {renderFlag(item.polFlag, 'POL Flag', 'w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-border')}
                          <span className="truncate min-w-0 font-medium">{item.pol}</span>
                        </div>

                        {/* 3. Destination Port with Flag */}
                        <div className="flex items-center gap-2 truncate text-foreground/90 min-w-0" title={item.pod}>
                          {renderFlag(item.podFlag, 'POD Flag', 'w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-border')}
                          <span className="truncate min-w-0 font-medium">{item.pod}</span>
                        </div>

                        {/* 4. Total Freight */}
                        <div className="w-full text-center font-bold text-foreground min-w-0" title={`$${item.freight}`}>
                          ${item.freight}
                        </div>

                        {/* 5. Freight PMT */}
                        <div className="w-full text-center font-bold text-foreground min-w-0" title={`$${item.freightPmt}`}>
                          ${item.freightPmt}
                        </div>

                        {/* 6. Change */}
                        <div className={`w-full text-center font-bold flex items-center justify-center gap-1 min-w-0 text-[16px] ${isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`} title={`${changeVal}$`}>
                          <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'} text-xs`}></i>
                          <span className="truncate">{isPositive ? `+${changeVal}$` : `${changeVal}$`}</span>
                        </div>

                        {/* 7. Chart Icon */}
                        <div
                          role="button"
                          tabIndex={item.chartStatus ? 0 : -1}
                          aria-label={item.chartStatus ? `View ${item.shipBy} chart` : "Chart not available"}
                          className={`w-full flex items-center justify-center text-center transition-transform min-w-0 ${item.chartStatus ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50'}`}
                          onClick={() => { if (item.chartStatus) { setSelectedInitialTab('Overview'); setActiveBottomSheetId(String(item.id)); } }}
                          onKeyDown={(e) => { if (item.chartStatus && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedInitialTab('Overview'); setActiveBottomSheetId(String(item.id)); } }}
                          title={item.chartStatus ? (common?.view_freight_chart || "View Freight Chart") : (common?.chart_not_available || "Chart Not Available")}
                        >
                          <i className={`fa-solid fa-chart-area text-[16px] xl:text-[18px] ${item.chartStatus ? 'text-brand-blue dark:text-blue-400' : 'text-zinc-400'}`}></i>
                        </div>

                        {/* 8. Reusable Action Buttons (Book & Delete) */}
                        <div className="flex items-center justify-end gap-2.5 min-w-0 pr-3">
                          <ChartActionButton
                            onClick={() => handleBooking(item, item.id)}
                            mode="freight"
                            label="Book"
                            isLoading={isBookingLoading && bookingLoadingId === item.id}
                          />
                          <ChartDeleteButton
                            onClick={() => setDeleteConfirmId(item.id)}
                            title="Delete freight route"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Global Actions Bar */}
        <div className="w-full flex items-center justify-between gap-2 sm:gap-3 mt-1.5 sm:mt-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => handleBooking(undefined, 'bottom')}
            disabled={isBookingLoading}
            className="flex-1 min-w-0 lg:flex-none lg:w-auto inline-flex items-center justify-center gap-1.5 h-[42px] px-3 sm:px-5 bg-card hover:bg-primary hover:border-primary hover:text-white border border-border text-foreground font-bold rounded-xl text-xs sm:text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none disabled:opacity-70 disabled:pointer-events-none"
          >
            {isBookingLoading && bookingLoadingId === 'bottom' ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-1.5 text-xs shrink-0"></i>
                <span className="truncate">Loading...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-ship text-xs text-primary shrink-0"></i>
                <span className="truncate whitespace-nowrap">Freight Inquiry</span>
                <i className="fa-solid fa-arrow-right text-[10px] sm:text-xs shrink-0 hidden min-[360px]:inline-block"></i>
              </>
            )}
          </button>
          
          <div className="flex items-center justify-center gap-2 sm:gap-4 relative px-1 sm:px-2 shrink-0">
            <button
              type="button"
              onClick={handleDisclaimerClick}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-muted/60 hover:bg-muted border border-border/80 flex items-center justify-center transition-colors w-9 h-[42px] sm:w-10 rounded-xl cursor-pointer"
              aria-label="Standard Market Freight Disclaimer"
            >
              <i className="fa-solid fa-triangle-exclamation text-[19px]"></i>
            </button>

            {/* View All Button - Desktop Only */}
            {isHomePage && addedFreights.length > 4 && (
              <button 
                onClick={() => router.push(`/${lang}/freight-charts`)}
                className="hidden xl:inline-flex items-center justify-center h-[42px] px-4 py-2 sm:px-5 sm:py-2.5 bg-card hover:bg-primary hover:border-primary hover:text-white border border-border text-foreground font-bold rounded-xl text-xs sm:text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap"
              >
                View All
              </button>
            )}

            {showDisclaimer && (
              <div className={`absolute ${disclaimerPos === 'top' ? 'bottom-[calc(100%+12px)] lg:mb-2' : 'top-[calc(100%+12px)] lg:mt-2'} z-50 w-[280px] sm:w-[320px] left-1/2 -translate-x-1/2 bg-card border border-brand-blue rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in-95`}>
                <div className={`absolute ${disclaimerPos === 'top' ? '-bottom-[7px]' : '-top-[7px]'} left-1/2 -translate-x-1/2 w-[14px] h-[14px] bg-card ${disclaimerPos === 'top' ? 'border-b border-r' : 'border-t border-l'} border-brand-blue transform rotate-45`}></div>
                <h3 className="text-foreground text-center font-semibold text-[16px] mb-2">Standard Market Freight</h3>
                <p className="text-foreground/80 text-[13px] leading-relaxed text-justify mb-3">
                  The displayed ocean freight rates reflect standard indicative rates and are subject to final reconfirmation as per AgriGuru’s shipping terms and container availability.
                </p>
                <div className="border-t border-border pt-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => setShowDisclaimer(false)}
                    className="text-brand-blue font-bold text-[14px] hover:text-blue-500 cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Action (Add Freight) - Mobile Only */}
          <div className="flex-1 min-w-0 lg:hidden">
            <ChartAddButton
              onClick={() => setShowMobileAddForm(true)}
              label="Add Freight"
              variant="mobile-sticky"
              className="!max-w-none !w-full h-[42px] flex items-center justify-center m-0 py-0 !rounded-xl !text-xs sm:!text-sm font-bold whitespace-nowrap shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            />
          </div>
          {/* Empty Placeholder for Desktop to keep Warning centered */}
          <div className="hidden lg:inline-flex px-4 py-2 sm:px-5 sm:py-2.5 invisible pointer-events-none select-none" aria-hidden="true">
            Freight Inquiry <i className="fa-solid fa-arrow-right ml-2 text-[10px] sm:text-xs"></i>
          </div>
        </div>
      </div>

      {/* Reusable Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Delete Freight"
        description="Are you sure you want to delete this freight route?"
        isDeleting={isDeleting}
      />

      {/* Action Indication Popup */}
      <ActionIndicationModal
        isOpen={actionIndication !== null && actionIndication.isOpen}
        onClose={() => setActionIndication(null)}
        onConfirm={() => {
          setActionIndication(null);
          if (initialUserType) {
            router.push(`/${lang}/pricing`);
          } else {
            router.push(`/${lang}/login`);
          }
        }}
        description={actionIndication?.message}
        indicationText={actionIndication?.indication}
      />

      {/* Bottom Sheet / Chart Modal for Freight Charts */}
      {activeBottomSheetId !== null && (() => {
        const activeItem = addedFreights.find(f => String(f.id) === String(activeBottomSheetId));
        if (!activeItem) return null;
        const favPortId = (activeItem as any).originalItem?.favourite_port_id || 
                          (activeItem as any).originalItem?.favorite_port_id || 
                          (activeItem as any).originalItem?.favourite_record_id ||
                          (activeItem as any).originalItem?.id || 
                          activeItem.id;
        const freightId = (activeItem as any).originalItem?.freight_id || 
                          (activeItem as any).originalItem?.id || 
                          activeItem.id;

        const orig = (activeItem as any).originalItem;
        const resolvedPolFlag = activeItem.polFlag || orig?.loading_port?.country?.flag || orig?.loading_port?.flag || orig?.pol_flag || '';
        const resolvedPodFlag = activeItem.podFlag || orig?.destination_port?.country?.flag || orig?.destination_port?.flag || orig?.pod_flag || '';

        const chartItem = {
          id: favPortId || activeItem.id,
          product: `${activeItem.pol} → ${activeItem.pod}`,
          shipBy: activeItem.shipBy,
          term: activeItem.shipBy,
          pol: activeItem.pol,
          polFlag: resolvedPolFlag,
          pod: activeItem.pod,
          podFlag: resolvedPodFlag,
          price: activeItem.freightPmt,
          change: activeItem.change,
          chartStatus: true,
          category: 'FREIGHT',
          country: activeItem.pol,
          countryFlag: resolvedPolFlag,
          favoritePortId: favPortId,
          favouritePortId: favPortId,
          favoriteProductId: favPortId,
          freightId: freightId,
          originalItem: orig
        };
        return (
          <ChartBottomSheetContainer
            activeItem={chartItem}
            onClose={() => setActiveBottomSheetId(null)}
            userType={initialUserType}
            lang={lang}
            initialTab={selectedInitialTab}
            swipeText="Swipe up for Freight Details"
            onFreightInquiry={() => {
              setActiveBottomSheetId(null);
              handleBooking(activeItem, activeItem.id);
            }}
          />
        );
      })()}

      {/* 3-Dots Options Bottom Sheet for Swipable Cards */}
      <ChartCardOptionsBottomSheet
        isOpen={selectedOptionsItem !== null}
        onClose={() => setSelectedOptionsItem(null)}
        itemType="freight"
        userType={initialUserType}
        onSelectOption={handleFreightOptionSelect}
        isChartAvailable={Boolean(selectedOptionsItem?.chartStatus)}
        cardNode={selectedOptionsItem && (() => {
          const item = selectedOptionsItem;
          const changeVal = Number(item.change) || 0;
          const isPositive = changeVal >= 0;
          const isVesselOrBulk = Boolean(
            /vessel|bulk|break/i.test(item.shipBy || '') ||
            /vessel|bulk|break/i.test((item as any).originalItem?.shipment_type || '') ||
            /vessel|bulk|break/i.test((item as any).originalItem?.load_type || '')
          );
          const cardTitle = isVesselOrBulk ? 'Vessel Ocean Freight' : 'Container Ocean Freight';
          let row3Left = '';
          if (isVesselOrBulk) {
            row3Left = 'Vessel: Break Bulk';
          } else {
            let containerPrefix = '20ft FCL';
            if (/40\s*(?:ft|foot)/i.test(item.shipBy || '')) {
              containerPrefix = '40ft FCL';
            } else if (/20\s*(?:ft|foot)/i.test(item.shipBy || '')) {
              containerPrefix = '20ft FCL';
            } else if (item.shipBy && item.shipBy !== 'N/A' && !/container/i.test(item.shipBy)) {
              containerPrefix = item.shipBy.includes('FCL') ? item.shipBy : `${item.shipBy} FCL`;
            }
            row3Left = `${containerPrefix}: ${item.loadCapacity || 26} ${item.loadUnit || 'MT'}`;
          }
          const displayPrice = item.freightPmt && item.freightPmt !== '0' ? item.freightPmt : (item.freight || '0');

          return (
            <ChartMobileItemCard
              row1Left={
                <>
                  {renderFlag(item.polFlag, 'POL')}
                  <span className="truncate">POL : {item.pol}</span>
                </>
              }
              row1Right={
                <>
                  <span className="truncate">POD: {item.pod}</span>
                  {renderFlag(item.podFlag, 'POD')}
                </>
              }
              title={cardTitle}
              titleClassName="font-bold text-[15px] leading-tight text-foreground truncate min-w-0"
              priceDisplay={
                <span className="flex items-center gap-1 font-bold">
                  <span className="text-muted-foreground font-normal text-[13px] sm:text-[14px] tracking-tight">( PMT )</span>
                  <span className="text-[15px] sm:text-[16px] text-foreground font-bold tracking-tight">${displayPrice}</span>
                </span>
              }
              priceClassName="text-foreground shrink-0"
              actionButton={
                <button
                  type="button"
                  onClick={() => setSelectedOptionsItem(null)}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-muted rounded-full transition-colors cursor-pointer"
                  aria-label="Close options"
                >
                  <i className="fa-solid fa-xmark text-[16px]"></i>
                </button>
              }
              row3Left={row3Left}
              changeValue={item.change}
              isPositive={isPositive}
            />
          );
        })()}
      />

      {/* Full-Screen Mobile Add Freight Form (Matching Product Charts) */}
      {showMobileAddForm && (
        <div className="fixed inset-0 z-[700] bg-background flex flex-col animate-in slide-in-from-bottom-2 overscroll-contain">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileAddForm(false)}
              className="w-8 h-8 rounded-full bg-card border border-border text-foreground flex items-center justify-center transition-transform hover:bg-muted active:scale-95 shadow-xs cursor-pointer"
            >
              <i className="fa-solid fa-chevron-left text-[13px] pr-0.5"></i>
            </button>
            <h2 className="text-[19px] font-bold">
              {'Add Freight'.split(' ').map((word, index, arr) => (
                <span key={index}>
                  <span className="bg-[image:var(--ag-gradient-heading)] bg-clip-text text-transparent">
                    {word}
                  </span>
                  {index < arr.length - 1 && ' '}
                </span>
              ))}
            </h2>
            <div className="w-8 h-8"></div>
          </div>

          {/* Form Fields */}
          <div id="mobile-add-freight-scroll-container" className="flex-1 overflow-y-auto relative bg-background scroll-smooth scroll-pb-32">
            <div className="px-5 pt-3 pb-8 space-y-4 min-h-full flex flex-col">
              <div className="flex-1 space-y-4">
                {/* 1. Ship by */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Ship by</label>
                  <div className="mobile-add-select">
                    <SearchableSelect
                      id="mobile-shipby"
                      value={selectedShipBy}
                      onChange={handleShipBySelect}
                      options={shippingContainers}
                      placeholder={common.select_ship_by || "Select Ship By"}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* 2. Loading Port */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Loading Port (POL)</label>
                  <div className="mobile-add-select">
                    <SearchableSelect
                      id="mobile-pol"
                      value={selectedPOL}
                      onChange={handlePOLSelect}
                      options={loadingPorts}
                      placeholder={!selectedShipBy ? "Select Loading Port" : polLoading ? "Loading..." : loadingPorts.length === 0 ? "No Ports Found" : "Select Loading Port"}
                      disabled={!selectedShipBy || polLoading}
                      loading={polLoading}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* 3. Destination Port */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Destination Port (POD)</label>
                  <div className="mobile-add-select">
                    <SearchableSelect
                      id="mobile-pod"
                      value={selectedPOD}
                      onChange={handlePODSelect}
                      options={destinationPorts}
                      placeholder={!selectedPOL ? "Select Destination Port" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No Destination Ports" : "Select Destination Port"}
                      disabled={!selectedPOL || podLoading}
                      loading={podLoading}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Notes card when all are selected */}
                {selectedShipBy && selectedPOL && selectedPOD && (
                  <div id="mobile-add-freight-note" className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start gap-3">
                      <i className="fa-solid fa-circle-info text-blue-500 mt-1"></i>
                      <div className="space-y-1 text-sm">
                        <div className="font-semibold text-foreground/80">Ocean Freight Details:</div>
                        <div className="text-foreground/80">Rate type: USD/PMT</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Add Button */}
            <div className="sticky bottom-0 left-0 w-full px-6 py-4 border-t border-border bg-background z-40 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
              <div className="flex justify-center">
                <ChartAddButton
                  onClick={async () => {
                    await handleAddFreight();
                    if (isAddFreightEnabled) {
                      setShowMobileAddForm(false);
                    }
                  }}
                  disabled={!isAddFreightEnabled}
                  loading={isAdding}
                  label="Add Freight"
                  variant="mobile-overlay"
                />
              </div>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            .mobile-add-select .h-10 {
              height: 48px !important;
              border-radius: 10px !important;
              font-weight: 500 !important;
              border: none !important;
            }
            .mobile-add-select .h-10:not(.bg-\[\#1D92EB\]) {
              background-color: var(--muted) !important;
              color: var(--muted-foreground) !important;
            }
            .dark .mobile-add-select .h-10:not(.bg-\[\#1D92EB\]) {
              background-color: var(--muted) !important;
              color: var(--muted-foreground) !important;
            }
          `}} />
        </div>
      )}

      {/* Freight Inquiry Modal */}
      {isFreightInquiryModalOpen && (
        <FreightInquiryModal
          isOpen={isFreightInquiryModalOpen}
          onClose={() => {
            setIsFreightInquiryModalOpen(false);
            setSelectedFreightInquiryItem(null);
          }}
          onSuccess={() => {
            setIsFreightInquiryModalOpen(false);
            setSelectedFreightInquiryItem(null);
          }}
          lang={lang}
          common={common}
          shipBy={
            selectedFreightInquiryItem?.shipBy ||
            (selectedFreightInquiryItem as any)?.originalItem?.shipping_container?.title ||
            (selectedFreightInquiryItem as any)?.originalItem?.shipping_container?.name ||
            (selectedFreightInquiryItem as any)?.originalItem?.shipment_type ||
            shippingContainers.find(c => c.id === ((selectedFreightInquiryItem as any)?.shipping_container_id || (selectedFreightInquiryItem as any)?.originalItem?.shipping_container_id))?.title ||
            shippingContainers.find(c => c.id === selectedShipBy)?.title ||
            selectedShipBy
          }
          portOfLoading={selectedFreightInquiryItem?.pol || loadingPorts.find(p => p.id === selectedPOL)?.name || selectedPOL}
          portOfDestination={selectedFreightInquiryItem?.pod || destinationPorts.find(p => p.id === selectedPOD)?.name || selectedPOD}
          freightRate={selectedFreightInquiryItem?.freight || selectedFreightInquiryItem?.freightPmt}
          loadCapacity={selectedFreightInquiryItem?.loadCapacity || 26}
          loadUnit={selectedFreightInquiryItem?.loadUnit || 'MT'}
          shippingContainerId={
            (selectedFreightInquiryItem as any)?.originalItem?.shipping_container?.id ||
            (selectedFreightInquiryItem as any)?.originalItem?.shipping_container_id ||
            (selectedFreightInquiryItem as any)?.shipping_container_id ||
            shippingContainers.find(c => c.title === selectedFreightInquiryItem?.shipBy || c.id === selectedShipBy)?.id ||
            selectedShipBy
          }
          loadingPortId={
            (selectedFreightInquiryItem as any)?.originalItem?.loading_port?.id ||
            (selectedFreightInquiryItem as any)?.originalItem?.loading_port_id ||
            (selectedFreightInquiryItem as any)?.loading_port_id ||
            selectedPOL
          }
          destinationPortId={
            (selectedFreightInquiryItem as any)?.originalItem?.destination_port?.id ||
            (selectedFreightInquiryItem as any)?.originalItem?.destination_port_id ||
            (selectedFreightInquiryItem as any)?.destination_port_id ||
            selectedPOD
          }
          initialMinPrice={freightPriceLimits?.min}
          initialMaxPrice={freightPriceLimits?.max}
          favouriteFreightId={
            (selectedFreightInquiryItem as any)?.id ||
            (selectedFreightInquiryItem as any)?.favourite_freight_id ||
            (selectedFreightInquiryItem as any)?.favourite_port_id ||
            (selectedFreightInquiryItem as any)?.originalItem?.id ||
            (selectedFreightInquiryItem as any)?.originalItem?.favourite_freight_id ||
            (selectedFreightInquiryItem as any)?.originalItem?.favourite_port_id
          }
        />
      )}

      {/* Freight KYC / Permission Action Indication Modal */}
      <ActionIndicationModal
        isOpen={isKYCModalOpen}
        onClose={() => setIsKYCModalOpen(false)}
        onConfirm={() => {
          setIsKYCModalOpen(false);
          router.push(kycRedirectUrl);
        }}
        title="Action Required"
        description={kycMessage}
        indicationText={kycIndicationText}
        type="warning"
      />
    </>
  );
}
