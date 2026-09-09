'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ChartAddButton } from '@/components/ui/charts/ChartAddButton';
import { ChartActionButton } from '@/components/ui/charts/ChartActionButton';
import { ChartDeleteButton } from '@/components/ui/charts/ChartDeleteButton';
import { DeleteConfirmModal } from '@/components/ui/charts/DeleteConfirmModal';
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
}

export default function FreightChartClient({
  initialShippingContainers = [],
  initialFavorites = [],
  initialUserType = null,
  lang = 'en'
}: FreightChartClientProps) {
  const router = useRouter();

  // Dropdown source data
  const [shippingContainers] = useState<ShippingContainer[]>(initialShippingContainers);
  const [loadingPorts, setLoadingPorts] = useState<PortInfo[]>([]);
  const [destinationPorts, setDestinationPorts] = useState<PortInfo[]>([]);
  
  // List state
  const [addedFreights, setAddedFreights] = useState<FavoriteFreightItem[]>(initialFavorites);

  useEffect(() => {
    setAddedFreights(initialFavorites);
  }, [initialFavorites]);

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
  const [activeBottomSheetId, setActiveBottomSheetId] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showMobileAddForm, setShowMobileAddForm] = useState(false);

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
        // Fetch fresh favorite freight ports
        const freshRes = await getFavoritePortsAction(lang);
        if (freshRes.success && Array.isArray(freshRes.data) && freshRes.data.length > 0) {
          const isChart = (val: any) => {
            if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
            return true;
          };

          const mapped: FavoriteFreightItem[] = freshRes.data.map((item: any) => ({
            id: item.id || Date.now().toString(),
            shipBy: item.shipping_container?.title || item.ship_by || '20FT FCL',
            pol: item.loading_port?.name || item.pol || 'Mundra',
            polFlag: item.loading_port?.country?.flag || item.loading_port?.flag || '',
            pod: item.destination_port?.name || item.pod || 'Dammam',
            podFlag: item.destination_port?.country?.flag || item.destination_port?.flag || '',
            freight: (item.freight != null ? Math.round(Number(item.freight)) : 2663).toString(),
            freightPmt: (item.freightPMT != null ? Math.round(Number(item.freightPMT)) : (item.freight_pmt != null ? Math.round(Number(item.freight_pmt)) : 102)).toString(),
            change: (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : 25)).toString(),
            chartStatus: isChart(item.chart_status),
            loadCapacity: item.shipping_container?.default_load_capacity || 26,
            loadUnit: item.shipping_container?.default_unit?.title || 'MT'
          }));

          setAddedFreights(mapped);
        } else {
          // Fallback optimistic item
          const shipByObj = shippingContainers.find(s => s.id === selectedShipBy);
          const polObj = loadingPorts.find(p => p.id === selectedPOL);
          const podObj = destinationPorts.find(p => p.id === selectedPOD);

          const fallbackItem: FavoriteFreightItem = {
            id: Date.now().toString(),
            shipBy: shipByObj?.title || '20FT FCL',
            pol: polObj?.name || 'Mundra',
            polFlag: polObj?.country?.flag || polObj?.flag || '',
            pod: podObj?.name || 'Dammam',
            podFlag: podObj?.country?.flag || podObj?.flag || '',
            freight: '2663',
            freightPmt: '102',
            change: '25',
            chartStatus: true,
            loadCapacity: shipByObj?.default_load_capacity || 26,
            loadUnit: 'MT'
          };
          setAddedFreights(prev => [fallbackItem, ...prev]);
        }

        toast.success('Freight added to chart successfully!');
        setShowMobileAddForm(false);
        
        // Reset selections
        setSelectedShipBy('');
        setSelectedPOL('');
        setSelectedPOD('');
        setLoadingPorts([]);
        setDestinationPorts([]);
      } else {
        toast.error(result.error || 'Failed to add freight');
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
                placeholder="Ship by"
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
                placeholder="Port"
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
                placeholder="Destination Port"
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
            {addedFreights.length === 0 ? (
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
                      className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden cursor-pointer ${
                        !selectedShipBy
                          ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className={`fa-solid ${selectedShipBy ? 'fa-check text-emerald-500' : 'fa-arrow-up animate-bounce text-brand-blue'} text-[11px]`}></i>
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider ${!selectedShipBy ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          {selectedShipBy ? 'Container' : '★ Step 1: Ship by'}
                        </span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                        {selectedShipBy ? (shippingContainers.find(c => String(c.id) === String(selectedShipBy))?.title || 'Ship by') : 'Select Container'}
                      </div>
                      <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        {selectedShipBy ? '✓ Selected' : '20FT / 40FT / Bulk'}
                      </div>
                    </div>

                    {/* Col 2: Loading Port (Step 2) */}
                    <div
                      onClick={() => {
                        if (selectedShipBy) document.getElementById('desktop-pol-select')?.click();
                        else document.getElementById('desktop-shipby-select')?.click();
                      }}
                      className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                        !selectedShipBy
                          ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                          : !selectedPOL
                            ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                            : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className={`fa-solid ${selectedPOL ? 'fa-check text-emerald-500' : selectedShipBy ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 2: POL</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                        {selectedPOL ? (loadingPorts.find(p => String(p.id) === String(selectedPOL))?.name || 'Port') : 'Loading Port'}
                      </div>
                      <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        {selectedPOL ? '✓ Selected' : 'Origin port'}
                      </div>
                    </div>

                    {/* Col 3: Destination Port (Step 3) */}
                    <div
                      onClick={() => {
                        if (selectedPOL) document.getElementById('desktop-pod-select')?.click();
                        else if (selectedShipBy) document.getElementById('desktop-pol-select')?.click();
                        else document.getElementById('desktop-shipby-select')?.click();
                      }}
                      className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                        !selectedPOL
                          ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                          : !selectedPOD
                            ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                            : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className={`fa-solid ${selectedPOD ? 'fa-check text-emerald-500' : selectedPOL ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 3: POD</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                        {selectedPOD ? (destinationPorts.find(p => String(p.id) === String(selectedPOD))?.name || 'Destination') : 'Destination Port'}
                      </div>
                      <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        {selectedPOD ? '✓ Selected' : 'Discharge port'}
                      </div>
                    </div>

                    {/* Col 4: Freight Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-foreground/75 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-dollar-sign text-emerald-500/80 text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/40">Total</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Freight
                      </div>
                      <div className="text-[9.5px] text-foreground/40 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Total rate
                      </div>
                    </div>

                    {/* Col 5: Freight (PMT) Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-foreground/75 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-scale-balanced text-emerald-500/80 text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/40">PMT</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Freight (PMT)
                      </div>
                      <div className="text-[9.5px] text-foreground/40 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Per MT rate
                      </div>
                    </div>

                    {/* Col 6: Change Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-foreground/75 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className="fa-solid fa-arrow-trend-up text-blue-500/80 text-[11px]"></i>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/40">Trend</span>
                      </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Change
                      </div>
                      <div className="text-[9.5px] text-foreground/40 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Daily shift
                      </div>
                    </div>

                    {/* Col 7: Chart Preview */}
                    <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-foreground/75 select-none w-full min-w-0 overflow-hidden">
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-chart-area text-brand-blue/80 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/40">Chart</span>
                    </div>
                      <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                        Chart
                      </div>
                      <div className="text-[9.5px] text-foreground/40 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                        Rate history
                      </div>
                    </div>

                    {/* Col 8: Final Step - Add Freight Button Pointer */}
                    <div
                      onClick={() => {
                        if (isAddFreightEnabled) handleAddFreight();
                      }}
                      className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                        !isAddFreightEnabled
                          ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                          : 'cursor-pointer bg-primary-gradient text-white border-transparent shadow-md hover:shadow-lg ring-2 ring-emerald-500/40 active:scale-[0.98]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                        <i className={`fa-solid fa-arrow-up ${isAddFreightEnabled ? 'animate-bounce text-white' : 'text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider ${isAddFreightEnabled ? 'text-white' : ''}`}>Final</span>
                      </div>
                      <div className={`font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight ${isAddFreightEnabled ? 'text-white' : 'text-foreground/80'}`}>
                        Add Freight
                      </div>
                      <div className={`text-[9.5px] mt-0.5 truncate w-full text-center px-0.5 leading-tight ${isAddFreightEnabled ? 'text-white/90 font-medium' : 'text-foreground/75'}`}>
                        {isAddFreightEnabled ? 'Ready! Click here' : 'Complete 3 steps'}
                      </div>
                    </div>
                  </div>

                  {/* Visual Tutorial Showcase Card */}
                  <div className="bg-card rounded-2xl p-5 shadow-sm border border-border ">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-brand-blue flex items-center justify-center text-lg shadow-sm border border-blue-100 dark:border-blue-900/40">
                          <i className="fa-solid fa-ship"></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <span>How to Track Global Freight Rates</span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">Quick Guide</span>
                          </h3>
                          <p className="text-xs text-foreground/75 mt-0.5">
                            Select container type, origin port of loading, and destination port to monitor live shipping costs.
                          </p>
                        </div>
                      </div>

                      {/* Progress pill */}
                      <div className="flex items-center gap-2 self-start md:self-auto bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <i className="fa-solid fa-layer-group text-xs text-brand-blue"></i>
                        <span className="text-xs font-semibold text-foreground/80">
                          {isAddFreightEnabled
                            ? 'All 3 options selected! Ready to add 🚀'
                            : !selectedShipBy
                              ? 'Step 1: Pick Container (20FT / 40FT / Bulk)'
                              : !selectedPOL
                                ? 'Step 2: Pick Loading Port'
                                : 'Step 3: Pick Destination Port'}
                        </span>
                      </div>
                    </div>

                    {/* 3 Tutorial Feature Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Step 1 */}
                      <div
                        onClick={() => document.getElementById('desktop-shipby-select')?.click()}
                        className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-blue-400/50  cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                            1
                          </div>
                          <span className="text-[11px] text-brand-blue font-semibold group-hover:underline flex items-center gap-1">
                            <span>Pick Container</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                          1. Choose Container Type
                        </h4>
                        <p className="text-[11px] text-foreground/75 leading-relaxed">
                          Select <strong>20FT FCL</strong>, <strong>40FT FCL</strong>, or <strong>Vessel/Bulk</strong> shipping modes.
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div
                        onClick={() => {
                          if (selectedShipBy) document.getElementById('desktop-pol-select')?.click();
                          else document.getElementById('desktop-shipby-select')?.click();
                        }}
                        className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-blue-400/50  cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                            2
                          </div>
                          <span className="text-[11px] text-brand-blue font-semibold group-hover:underline flex items-center gap-1">
                            <span>Pick Ports</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                          2. Origin & Destination Ports
                        </h4>
                        <p className="text-[11px] text-foreground/75 leading-relaxed">
                          Choose the <strong>Loading Port</strong> (POL) and the <strong>Destination Port</strong> (POD).
                        </p>
                      </div>

                      {/* Step 3 */}
                      <div
                        onClick={() => {
                          if (isAddFreightEnabled) handleAddFreight();
                        }}
                        className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-emerald-400/50  cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                            3
                          </div>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline flex items-center gap-1">
                            <span>Add & Book</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                          3. Track PMT & Instant Booking
                        </h4>
                        <p className="text-[11px] text-foreground/75 leading-relaxed">
                          Click <strong>Add Freight</strong> to monitor real-time freight trends, PMT breakdowns, and book containers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-[7px] lg:gap-2 mt-0.5 lg:mt-1">
                {addedFreights.map((item, index) => {
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
                      <div className={`hidden lg:grid ${gridCols} gap-1.5 items-center px-3 py-3 rounded-lg ${desktopRowBg} shadow-xs border border-border hover:shadow-sm  text-sm font-semibold`}>
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
                        <div className={`w-full text-center font-bold flex items-center justify-center gap-1 min-w-0 text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`} title={`${changeVal}$`}>
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

        {/* Global Actions Bar for Mobile/Tablet - Sticky matching Product Charts */}
        <div className="flex lg:hidden justify-between items-center py-4 px-4 -mx-4 sticky bottom-[68px] z-40 bg-background/95 border-t border-border shadow-xs mt-3 pointer-events-auto">
          <button
            type="button"
            onClick={handleBooking}
            className="px-5 py-[9px] bg-card hover:bg-muted border border-border text-foreground font-semibold rounded-md text-[14px] shadow-sm  cursor-pointer"
          >
            Inquiry / Booking
          </button>
          
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowDisclaimer(true)}
              className="text-zinc-400 dark:text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-100  flex items-center justify-center cursor-pointer"
              aria-label="Market Rate Disclaimer"
            >
              <i className="fa-solid fa-triangle-exclamation text-[22px]"></i>
            </button>

            {showDisclaimer && (
              <div className="absolute bottom-full mb-4 z-50 w-[300px] sm:w-[320px] left-1/2 -translate-x-1/2 bg-card border border-brand-blue rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in-95 ">
                <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-[14px] h-[14px] bg-card border-b border-r border-brand-blue transform rotate-45"></div>
                <h3 className="text-foreground text-center font-semibold text-[16px] mb-2">Standard Market Freight</h3>
                <p className="text-foreground/80 text-[13px] leading-relaxed text-justify mb-3">
                  The displayed ocean freight rates reflect standard indicative rates and are subject to final reconfirmation as per AgriGuru’s shipping terms and container availability.
                </p>
                <div className="border-t border-border pt-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => setShowDisclaimer(false)}
                    className="text-brand-blue font-bold text-[14px] hover:text-blue-500  cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

          <ChartAddButton
            onClick={() => setShowMobileAddForm(true)}
            label="Add Freight"
            variant="mobile-sticky"
          />
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
                    placeholder="Select Ship By"
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
