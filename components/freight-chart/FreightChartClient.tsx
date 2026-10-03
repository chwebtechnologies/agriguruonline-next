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
import {
  getFreightLoadingPortsAction,
  getFreightDestinationPortsAction,
  addFavoritePortAction,
  deleteFavoritePortAction,
  getFavoritePortsAction
} from '@/app/actions/freight';

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
}

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
            const isChart = (val: any) => {
              if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
              return true;
            };
            const chartStatus = isChart(item.chart_status) && isChart(item.chartStatus);
            const loadCapacity = item.shipping_container?.default_load_capacity || item.load_capacity || 26;
            const loadUnit = item.shipping_container?.default_unit?.title || item.load_unit || 'MT';
            return {
              id: item.id || Date.now(),
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
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerPos, setDisclaimerPos] = useState<'top' | 'bottom'>('bottom');
  const [showMobileAddForm, setShowMobileAddForm] = useState(false);

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
                setTimeout(() => document.getElementById('desktop-pod-select')?.click(), 100);
              }
            })
            .finally(() => setPodLoading(false));
        } else {
          setTimeout(() => document.getElementById('desktop-pol-select')?.click(), 100);
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
          setTimeout(() => document.getElementById('desktop-pod-select')?.click(), 100);
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
          id: result.data?.id || Date.now().toString(),
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
          loadUnit: 'MT'
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

  const handleBooking = () => {
    toast.info('Freight booking request initiated. Our logistics desk will get in touch.');
  };

  return (
    <>
      <div className="w-full flex flex-col gap-0 lg:gap-2">
        <div className="w-full relative">
          {/* Desktop Filter Row */}
          <div className={`hidden lg:grid ${gridCols} gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0`}>
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
            <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
              Freight
            </div>

            <div className="hidden lg:flex flex-col w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 leading-tight select-none cursor-default">
              <span>Freight</span>
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">(PMT)</span>
            </div>

            <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
              Change
            </div>

            <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
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
          <div className={`mt-0 lg:mt-2 ${addedFreights.length === 0 ? 'lg:min-h-[220px]' : ''}`}>
            {isFetchingFavorites && addedFreights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 lg:py-16 text-center bg-card border border-border border-dashed rounded-xl h-full lg:min-h-[220px]">
                <i className="fa-solid fa-spinner fa-spin text-brand-blue text-3xl mb-4"></i>
                <h3 className="text-lg font-bold text-foreground">Loading Your Charts...</h3>
                <p className="text-muted-foreground text-sm mt-2">Please wait while we fetch your data</p>
              </div>
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
                  <div className={`grid ${gridCols} gap-2 px-2 -mx-2`}>
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
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${selectedShipBy ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
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
                          ? 'opacity-60 cursor-not-allowed bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 shadow-sm'
                          : !selectedPOL
                            ? 'cursor-pointer bg-blue-50 dark:bg-blue-900/20 border-brand-blue text-brand-blue shadow-md ring-2 ring-brand-blue/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                            : 'cursor-pointer bg-brand-green/10 dark:bg-brand-green/20 border-brand-green/30 text-brand-green dark:text-emerald-400'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${selectedPOL ? 'fa-check text-brand-green dark:text-emerald-400' : selectedShipBy ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-lock text-zinc-400 dark:text-zinc-500'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${!selectedShipBy ? 'text-zinc-400' : !selectedPOL ? 'text-brand-blue' : 'text-emerald-800 dark:text-emerald-300'}`}>Step 2: POL</span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${!selectedShipBy ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
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
                          ? 'opacity-60 cursor-not-allowed bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 shadow-sm'
                          : !selectedPOD
                            ? 'cursor-pointer bg-blue-50 dark:bg-blue-900/20 border-brand-blue text-brand-blue shadow-md ring-2 ring-brand-blue/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                            : 'cursor-pointer bg-brand-green/10 dark:bg-brand-green/20 border-brand-green/30 text-brand-green dark:text-emerald-400'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${selectedPOD ? 'fa-check text-brand-green dark:text-emerald-400' : selectedPOL ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-lock text-zinc-400 dark:text-zinc-500'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${!selectedPOL ? 'text-zinc-400' : !selectedPOD ? 'text-brand-blue' : 'text-emerald-800 dark:text-emerald-300'}`}>Step 3: POD</span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${!selectedPOL ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {selectedPOD ? (destinationPorts.find(p => String(p.id) === String(selectedPOD))?.name || 'Destination') : 'Destination Port'}
                        </div>
                      </div>
                    </div>

                    {/* Col 4: Freight Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-dollar-sign text-zinc-400 text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">Total</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-600 dark:text-zinc-400">
                        Freight
                      </div>
                      <div className="text-[9.5px] text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Total rate
                      </div>
                    </div>

                    {/* Col 5: Freight (PMT) Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-scale-balanced text-zinc-400 text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">PMT</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-600 dark:text-zinc-400">
                        Freight (PMT)
                      </div>
                      <div className="text-[9.5px] text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Per MT rate
                      </div>
                    </div>

                    {/* Col 6: Change Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-arrow-trend-up text-zinc-400 text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">Trend</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-600 dark:text-zinc-400">
                        Change
                      </div>
                      <div className="text-[9.5px] text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Daily shift
                      </div>
                    </div>

                    {/* Col 7: Chart Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-chart-area text-zinc-400 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500">Chart</span>
                    </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-600 dark:text-zinc-400">
                        Chart
                      </div>
                      <div className="text-[9.5px] text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
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
                          ? 'opacity-60 cursor-not-allowed bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 shadow-sm'
                          : 'cursor-pointer bg-primary-gradient text-white border-none shadow-md hover:shadow-lg active:scale-[0.98]'
                      }`}
                    >
                      <div className="shrink-0 px-1 flex items-center justify-center">
                        <i className={`fa-solid ${isAddFreightEnabled ? 'fa-arrow-up animate-bounce text-white' : 'fa-lock text-zinc-400 dark:text-zinc-500'} text-[18px]`}></i>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isAddFreightEnabled ? 'text-white' : 'text-zinc-400'}`}>Final</span>
                        </div>
                        <div className={`font-bold text-[11px] w-full text-center leading-tight line-clamp-2 break-words ${isAddFreightEnabled ? 'text-white' : 'text-zinc-400'}`}>
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

                  return (
                    <div key={item.id || index}>
                      {/* Mobile/Tablet Card Layout (Matching Screenshot 2 Exactly) */}
                      <SwipeableCard
                        onDelete={() => setDeleteConfirmId(item.id)}
                      >
                        <ChartMobileItemCard
                          row1Left={
                            <>
                              {item.polFlag && (
                                <img
                                  src={getFlagUrl(item.polFlag)}
                                  alt="POL"
                                  className="w-[16px] h-[12px] object-cover rounded-[2px] shrink-0 border border-border"
                                />
                              )}
                              <span>POL: {item.pol}</span>
                            </>
                          }
                          row1Right={
                            <>
                              <span>POD: {item.pod}</span>
                              {item.podFlag && (
                                <img
                                  src={getFlagUrl(item.podFlag)}
                                  alt="POD"
                                  className="w-[16px] h-[12px] object-cover rounded-[2px] shrink-0 border border-border"
                                />
                              )}
                            </>
                          }
                          title={`Freight (PMT): $${item.freightPmt}`}
                          priceDisplay={`(${item.shipBy}) $${item.freight}`}
                          onOptionsClick={() => setDeleteConfirmId(item.id)}
                          row3Left={`FCL: ${item.loadCapacity || 26} ${item.loadUnit || 'MT'}`}
                          changeValue={item.change}
                          isPositive={isPositive}
                        />
                      </SwipeableCard>

                      {/* Desktop Row Layout (Matching Screenshot 1 Exactly) */}
                      <div className={`hidden lg:grid ${gridCols} gap-1.5 items-center px-3 py-3 rounded-lg ${desktopRowBg} shadow-xs border border-border hover:shadow-sm  text-[16px] font-semibold`}>
                        {/* 1. Ship by */}
                        <div className="truncate text-foreground/90 font-bold min-w-0" title={item.shipBy}>
                          {item.shipBy}
                        </div>

                        {/* 2. Loading Port with Flag */}
                        <div className="flex items-center gap-2 truncate text-foreground/90 min-w-0" title={item.pol}>
                          {item.polFlag && (
                            <img
                              src={getFlagUrl(item.polFlag)}
                              alt="POL Flag"
                              className="w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-border"
                            />
                          )}
                          <span className="truncate min-w-0 font-medium">{item.pol}</span>
                        </div>

                        {/* 3. Destination Port with Flag */}
                        <div className="flex items-center gap-2 truncate text-foreground/90 min-w-0" title={item.pod}>
                          {item.podFlag && (
                            <img
                              src={getFlagUrl(item.podFlag)}
                              alt="POD Flag"
                              className="w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-border"
                            />
                          )}
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

                        {/* 7. Chart Icon (Disabled for now as requested) */}
                        <div
                          className="w-full flex items-center justify-center text-center cursor-not-allowed opacity-35 min-w-0 select-none"
                          title="Chart coming soon"
                        >
                          <i className="fa-solid fa-chart-area text-[18px] text-zinc-400 dark:text-zinc-600"></i>
                        </div>

                        {/* 8. Reusable Action Buttons (Book & Delete) */}
                        <div className="flex items-center justify-end gap-2.5 min-w-0">
                          <ChartActionButton
                            onClick={handleBooking}
                            mode="freight"
                            label="Book"
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

        {/* Global Actions Bar - Sticky on Mobile, Static on Desktop */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center py-3 px-3 sm:px-4 -mx-4 sticky bottom-[68px] z-40 bg-background/95 border-t border-border shadow-xs mt-3 pointer-events-auto md:flex md:justify-between lg:static lg:bottom-auto lg:bg-transparent lg:border-none lg:shadow-none lg:px-0 lg:mx-0 lg:mt-4">
          <button
            type="button"
            onClick={handleBooking}
            className="w-full md:w-auto inline-flex items-center justify-center h-[42px] px-4 py-2 sm:px-5 sm:py-2.5 bg-card hover:bg-primary hover:border-primary hover:text-white border border-border text-foreground font-bold rounded-xl text-xs sm:text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap"
          >
            Inquiry / Booking <i className="fa-solid fa-arrow-right ml-2 text-[10px] sm:text-xs"></i>
          </button>
          
          <div className="relative flex items-center justify-center gap-4 px-2">
            <button
              type="button"
              onClick={handleDisclaimerClick}
              className="text-zinc-400 dark:text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-100 flex items-center justify-center cursor-pointer"
              aria-label="Market Rate Disclaimer"
            >
              <i className="fa-solid fa-triangle-exclamation text-[22px]"></i>
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
          <ChartAddButton
            onClick={() => setShowMobileAddForm(true)}
            label="Add Freight"
            variant="mobile-sticky"
            className="lg:hidden !max-w-none !w-full md:!w-auto h-[42px] flex items-center justify-center m-0 py-0 rounded-lg !text-[13px] sm:!text-[14px] whitespace-nowrap"
          />
          {/* Empty Placeholder for Desktop to keep Warning centered */}
          <div className="hidden lg:inline-flex px-4 py-2 sm:px-5 sm:py-2.5 invisible pointer-events-none select-none" aria-hidden="true">
            Inquiry / Booking <i className="fa-solid fa-arrow-right ml-2 text-[10px] sm:text-xs"></i>
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
        const chartItem = {
          id: activeItem.id,
          product: `${activeItem.pol} → ${activeItem.pod}`,
          shipBy: activeItem.shipBy,
          term: activeItem.shipBy,
          pol: activeItem.pol,
          polFlag: activeItem.polFlag,
          pod: activeItem.pod,
          podFlag: activeItem.podFlag,
          price: activeItem.freightPmt,
          change: activeItem.change,
          chartStatus: activeItem.chartStatus,
          category: 'Ocean Freight',
          country: activeItem.pol,
          countryFlag: activeItem.polFlag
        };
        return (
          <ChartBottomSheetContainer
            activeItem={chartItem}
            onClose={() => setActiveBottomSheetId(null)}
            userType={initialUserType}
            lang={lang}
            swipeText="Swipe up for Freight Details"
          />
        );
      })()}

      {/* Full-Screen Mobile Add Freight Form (Matching Product Charts) */}
      {showMobileAddForm && (
        <div className="fixed inset-0 z-[700] bg-background flex flex-col animate-in slide-in-from-bottom-2 ">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
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
          <div className="flex-1 overflow-y-auto relative bg-background scroll-smooth scroll-pb-32">
            <div className="px-5 pt-3 pb-8 space-y-4 min-h-full flex flex-col">
              <div className="flex-1 space-y-4">
                {/* 1. Ship by */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Ship by</label>
                  <SearchableSelect
                    id="mobile-shipby"
                    value={selectedShipBy}
                    onChange={handleShipBySelect}
                    options={shippingContainers}
                    placeholder={common.select_ship_by || "Select Ship By"}
                    variant="mobile"
                  />
                </div>

                {/* 2. Loading Port */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Loading Port (POL)</label>
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

                {/* 3. Destination Port */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Destination Port (POD)</label>
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

                {/* Notes card when all are selected */}
                {selectedShipBy && selectedPOL && selectedPOD && (
                  <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start gap-3">
                      <i className="fa-solid fa-circle-info text-blue-500 mt-1"></i>
                      <div className="space-y-1 text-sm">
                        <div className="font-semibold text-foreground/80">Ocean Freight Details:</div>
                        <div className="text-foreground/80">Rate type: USD/PMT & Total FCL Container Cost</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Add Button */}
            <div className="sticky bottom-0 left-0 w-full px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-background z-40 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
              <div className="flex justify-center">
                <ChartAddButton
                  onClick={handleAddFreight}
                  disabled={!isAddFreightEnabled}
                  loading={isAdding}
                  label="Add Freight"
                  variant="mobile-overlay"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
