'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import {
  getShippingContainersAction,
  getLoadingPortsAction,
  getDestinationPortsAction,
  addFavoriteProductAction,
  deleteFavoriteProductAction,
  getProductDetailsAction
} from '@/app/actions/charts';
import { toast } from 'sonner';
import MobileCommodityChart from './MobileCommodityChart';

interface Category {
  id: string;
  name: string;
}

interface Country {
  id: string;
  name: string;
  flag: string;
  iso2: string;
}

interface DestinationPortInfo {
  id: string;
  name: string;
  keywords?: string;
  flag?: string;
  country?: { flag?: string };
}

interface LoadingPortInfo {
  id: string;
  name: string;
  price?: number;
  keywords?: string;
  flag?: string;
  country?: { flag?: string };
}

interface Product {
  id: string;
  name: string;
  category: Category;
  country: Country;
  chart_status?: boolean | string;
  packing_types?: {
    id: string | number;
    title: string;
    is_default: boolean | number;
  }[];
}

interface ShippingTerm {
  id: string;
  title: string;
}

interface ShippingContainer {
  id: string;
  title: string;
}

interface FavoriteItem {
  id: number | string;
  category: string;
  country: string;
  countryFlag: string;
  product: string;
  shipBy: string;
  term: string;
  pol: string;
  polFlag: string;
  pod: string;
  podFlag: string;
  price: string;
  change: string;
  chartStatus: boolean;
}

function SearchableSelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder, 
  disabled,
  loading: selectLoading,
  menuPosition = 'bottom',
  id,
  variant = 'desktop'
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { id: string; name?: string; title?: string }[]; 
  placeholder: string; 
  disabled?: boolean; 
  loading?: boolean;
  menuPosition?: 'top' | 'bottom';
  id?: string;
  variant?: 'desktop' | 'mobile';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(o => String(o.id) === String(value));
  const isSelected = Boolean(selectedOption && value);
  const displayValue = selectLoading 
    ? 'Loading...' 
    : selectedOption 
      ? (selectedOption.name || selectedOption.title) 
      : placeholder;
  
  const filteredOptions = safeOptions.filter(o => {
    const label = o.name || o.title || '';
    return label.toLowerCase().includes((search || '').toLowerCase());
  });

  const isInteractive = !disabled && !selectLoading;
  const isMobile = variant === 'mobile';

  return (
    <div className={`relative w-full ${isOpen && isInteractive ? 'z-[9999]' : ''}`} ref={wrapperRef} title={displayValue}>
      <div 
        id={id}
        className={`w-full transition-all flex items-center justify-between ${
          isMobile
            ? `h-[46px] rounded-xl px-3.5 text-sm ${
                !isInteractive
                  ? 'opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-500 select-none'
                  : isSelected
                    ? 'bg-[#1D92EB] text-white border border-[#1D92EB] shadow-sm font-medium cursor-pointer'
                    : 'bg-white dark:bg-[#1c1c1e] border-2 border-zinc-300 dark:border-zinc-700 hover:border-[#1D92EB] dark:hover:border-[#1D92EB] text-zinc-800 dark:text-zinc-200 shadow-sm font-medium cursor-pointer active:scale-[0.99]'
              }`
            : `h-10 rounded-md px-3 text-sm ${
                !isInteractive
                  ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 select-none'
                  : isSelected
                    ? 'bg-[#1D92EB] text-white border border-[#1D92EB] shadow-sm font-medium cursor-pointer'
                    : 'bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-[#1D92EB] dark:hover:border-[#1D92EB] shadow-sm font-medium cursor-pointer'
              }`
        }`}
        onClick={() => {
          if (isInteractive) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearch('');
          }
        }}
      >
        <span className="truncate pr-1 flex items-center gap-2">
          {selectLoading && (
            <i className="fa-solid fa-circle-notch fa-spin text-xs text-white shrink-0"></i>
          )}
          <span className={`truncate ${!isSelected && !isInteractive ? 'text-zinc-400 dark:text-zinc-500' : !isSelected ? (isMobile ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-600 dark:text-zinc-300') : 'text-white font-medium'}`}>
            {displayValue}
          </span>
        </span>

        {selectLoading ? null : !isInteractive ? (
          <i className="fa-solid fa-lock text-[11px] text-zinc-300 dark:text-zinc-600 shrink-0 ml-1"></i>
        ) : isSelected && isInteractive ? (
          <button
            type="button"
            className="shrink-0 ml-1 text-white hover:text-white/80 transition-colors flex items-center justify-center p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setIsOpen(false);
            }}
            title="Clear selection"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        ) : (
          <i className={`fa-solid fa-chevron-down text-[11px] shrink-0 ml-1 transition-transform ${isOpen ? 'rotate-180 text-[#1D92EB]' : 'text-zinc-400 dark:text-zinc-500'}`}></i>
        )}
      </div>
      {isOpen && isInteractive && (
        <div className={`absolute z-50 w-full min-w-[200px] bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-h-[300px] flex flex-col left-0 ${menuPosition === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="p-2 shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-t-xl">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
              <input 
                type="text" 
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D92EB] text-zinc-800 dark:text-zinc-200 transition-all placeholder:text-zinc-400" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="p-1.5 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center font-medium">No results found</div>
            ) : (
              filteredOptions.map(opt => {
                const label = opt.name || opt.title || '';
                const active = String(value) === String(opt.id);
                return (
                  <div 
                    key={opt.id} 
                    className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-colors truncate flex items-center justify-between ${
                      active 
                        ? 'bg-[#1D92EB] text-white font-semibold' 
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <span className="truncate">{label}</span>
                    {active && <i className="fa-solid fa-check text-xs ml-2"></i>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SwipeableCard = ({ 
  children, 
  onDelete,
  onChart
}: { 
  children: React.ReactNode, 
  onDelete: () => void,
  onChart: () => void
}) => {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      currentXRef.current = 0;
      isDraggingRef.current = false;
      isHorizontalSwipeRef.current = null;
      if (el) el.style.transition = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      const diffX = e.touches[0].clientX - startXRef.current;
      const diffY = e.touches[0].clientY - startYRef.current;

      // Detect gesture direction early without blocking vertical scroll
      if (isHorizontalSwipeRef.current === null) {
        if (Math.abs(diffY) > 6 && Math.abs(diffY) > Math.abs(diffX)) {
          // Pure vertical scroll -> never intercept, allow 100% native smooth scrolling
          isHorizontalSwipeRef.current = false;
          return;
        }
        if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
          // Pure horizontal swipe
          isHorizontalSwipeRef.current = true;
          isDraggingRef.current = true;
        }
      }

      if (isHorizontalSwipeRef.current === true) {
        if (e.cancelable) e.preventDefault();
        const maxSwipe = 120;
        let newTranslate = diffX;
        if (newTranslate > maxSwipe) newTranslate = maxSwipe;
        if (newTranslate < -maxSwipe) newTranslate = -maxSwipe;
        currentXRef.current = newTranslate;
        el.style.transform = `translateX(${newTranslate}px)`;
      }
    };

    const handleTouchEnd = () => {
      if (isHorizontalSwipeRef.current === true && isDraggingRef.current) {
        const maxSwipe = 120;
        const threshold = maxSwipe * 0.45;

        if (currentXRef.current < -threshold) {
          onDelete();
        } else if (currentXRef.current > threshold) {
          onChart();
        }
      }

      if (el) {
        el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = 'translateX(0px)';
      }
      currentXRef.current = 0;
      isDraggingRef.current = false;
      isHorizontalSwipeRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onChart, onDelete]);

  return (
    <div className="relative overflow-hidden rounded-xl lg:hidden bg-zinc-100 dark:bg-zinc-800 touch-pan-y" ref={containerRef}>
      <div className="absolute inset-0 flex justify-between items-center z-0 pointer-events-none">
        <div className="bg-sky-400 w-1/2 h-full flex items-center pl-6 text-white font-bold rounded-l-xl">
          <i className="fa-solid fa-chart-line text-xl"></i>
          <span className="ml-3 text-[15px] tracking-wide">Chart</span>
        </div>
        <div className="bg-red-500 w-1/2 h-full flex items-center justify-end pr-6 text-white font-bold rounded-r-xl">
          <span className="mr-3 text-[15px] tracking-wide">Delete</span>
          <i className="fa-solid fa-trash text-xl"></i>
        </div>
      </div>
      <div 
        ref={swipeRef}
        className="relative z-10 w-full h-full bg-zinc-50 dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-zinc-200 dark:border-[#2a2a2c] will-change-transform"
      >
        {children}
      </div>
    </div>
  );
};

const generateDummyData = () => {
  let basePrice = 0.850;
  const data = [];
  const startDate = new Date('2025-10-01');
  for (let i = 0; i < 80; i++) {
    basePrice += (Math.random() - 0.48) * 0.015; // sharper movements
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 2);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      price: Number(basePrice.toFixed(6)),
    });
  }
  return data;
};

const dummyChartData = generateDummyData();

const PriceChart = ({ 
  onChartClick, 
  dragProgress = 1,
  isFullScreen = false 
}: { 
  onChartClick?: () => void; 
  dragProgress?: number;
  isFullScreen?: boolean;
}) => {
  const [timeRange, setTimeRange] = useState('1Y');
  const ranges = ['12H', '1D', '1W', '1M', '1Y', '2Y', '5Y', '10Y'];

  return (
    <div className={`w-full flex flex-col items-center bg-white dark:bg-[#18181b] ${isFullScreen ? 'pt-4 pb-2' : 'pt-2 pb-1'}`} onClick={onChartClick}>
      {/* Timeline Selector */}
      <div className="flex justify-center items-center gap-1.5 sm:gap-2 pt-2 pb-3 overflow-x-auto px-4 w-[95%] max-w-[380px] mx-auto scrollbar-hide text-[#71717a]" style={{ scrollbarWidth: 'none' }}>
        {ranges.map(range => (
          <button
            key={range}
            onClick={(e) => { e.stopPropagation(); setTimeRange(range); }}
            className={`px-3.5 py-1 text-[12px] font-bold rounded-full whitespace-nowrap transition-all duration-200 ${
              timeRange === range
                ? 'bg-[#1877F2] text-white shadow-sm'
                : 'bg-transparent hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
      
      {/* Chart Area */}
      <div 
        className={`mx-auto cursor-pointer transition-all duration-300 ${isFullScreen ? 'w-full px-2 sm:px-6' : 'w-[95%] max-w-[380px]'}`}
        style={{ height: isFullScreen ? '260px' : '200px' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dummyChartData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
            {/* Faint horizontal grid lines */}
            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f0f0f0" strokeOpacity={1} />
            <XAxis 
              dataKey="date" 
              axisLine={{ stroke: '#52525b', strokeWidth: 1 }}
              tickLine={{ stroke: '#52525b', strokeWidth: 1 }} 
              tick={{ fontSize: 11, fill: '#71717a' }} 
              dy={10}
              minTickGap={30}
            />
            <YAxis 
              orientation="right" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#52525b' }}
              domain={['dataMin', 'dataMax']}
              dx={0}
              tickFormatter={(val) => val.toFixed(5)}
              width={55}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ color: '#71717a', fontSize: '12px', marginBottom: '4px' }}
              itemStyle={{ color: '#1877F2', fontWeight: 'bold', fontSize: '15px' }}
            />
            <Line 
              type="linear" 
              dataKey="price" 
              stroke="#1877F2" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, fill: '#1877F2', stroke: '#fff', strokeWidth: 2 }}
            />
            <Brush 
              dataKey="date" 
              height={28} 
              stroke="#1877F2" 
              fill="#E8F4FF"
              travellerWidth={8} 
              tickFormatter={() => ''}
            >
              <AreaChart data={dummyChartData}>
                <Area type="linear" dataKey="price" stroke="none" fill="#1877F2" fillOpacity={0.5} />
              </AreaChart>
            </Brush>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Text */}
      <div 
        className="flex flex-col items-center justify-center text-[11px] sm:text-[12px] text-[#71717a] overflow-hidden transition-all text-center px-4"
        style={{ 
          height: `${dragProgress * 44}px`,
          opacity: dragProgress,
          marginTop: `${dragProgress * 14}px`,
          marginBottom: `${dragProgress * 6}px`
        }}
      >
        <p>Aug 25, 2025, 00:00 UTC - Aug 24, 2026, 12:15 UTC</p>
        <p className="mt-0.5">
          USD/EUR <span className="text-zinc-800 dark:text-zinc-200 font-semibold">close:</span> 0.857209{' '}
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">low:</span> 0.83196{' '}
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">high:</span> 0.880736
        </p>
      </div>
    </div>
  );
};

interface ChartsClientProps {
  initialProducts?: Product[];
  initialShippingTerms?: ShippingTerm[];
  initialFavorites?: FavoriteItem[];
  initialUserType?: string | null;
  lang?: string;
  initialDestinationPorts?: DestinationPortInfo[];
  initialMarketedProducts?: any[];
}

export default function ProductChartsClient({ 
  initialProducts = [], 
  initialShippingTerms = [],
  initialFavorites = [],
  initialUserType,
  initialDestinationPorts = [],
  initialMarketedProducts = [],
  lang = 'en'
}: ChartsClientProps) {
  const router = useRouter();
  const [productsData] = useState<Product[]>(initialProducts);
  const [shippingTerms] = useState<ShippingTerm[]>(initialShippingTerms);
  const [shippingContainers, setShippingContainers] = useState<ShippingContainer[]>([]);
  const [loadingPorts, setLoadingPorts] = useState<LoadingPortInfo[]>([]);
  const [destinationPorts, setDestinationPorts] = useState<DestinationPortInfo[]>(initialDestinationPorts);
  const userType = initialUserType;

  // Loading indicators for dynamic dropdowns
  const [containersLoading, setContainersLoading] = useState(false);
  const [polLoading, setPolLoading] = useState(false);
  const [podLoading, setPodLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [activeBottomSheetId, setActiveBottomSheetId] = useState<number | string | null>(null);
  const [isInitialFullScreen, setIsInitialFullScreen] = useState(false);
  const [showMobileAddForm, setShowMobileAddForm] = useState(false);

  // Open / Close bottom sheet
  const openBottomSheet = (id: number | string) => {
    setActiveBottomSheetId(id);
    setIsInitialFullScreen(false);
  };

  const closeBottomSheet = () => {
    setActiveBottomSheetId(null);
    setIsInitialFullScreen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('chart') || url.searchParams.has('full')) {
        url.searchParams.delete('chart');
        url.searchParams.delete('full');
        window.history.pushState({}, '', url.toString());
      }
    }
  };

  // Restore bottom sheet state on refresh ONLY IF it was in full-screen mode (?chart=id&full=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const chartParam = params.get('chart');
      const fullParam = params.get('full');
      if (chartParam && (fullParam === '1' || fullParam === 'true')) {
        setActiveBottomSheetId(chartParam);
        setIsInitialFullScreen(true);
      } else {
        // If it was half-sheet or no full flag, clean query and stay closed on fresh reload
        if (chartParam) {
          const url = new URL(window.location.href);
          url.searchParams.delete('chart');
          url.searchParams.delete('full');
          window.history.replaceState({}, '', url.toString());
        }
      }
    }
  }, []);

  // Handle browser / hardware back button with popstate
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const chartParam = params.get('chart');
        const fullParam = params.get('full');
        if (chartParam && (fullParam === '1' || fullParam === 'true')) {
          setActiveBottomSheetId(chartParam);
          setIsInitialFullScreen(true);
        } else {
          setActiveBottomSheetId(null);
          setIsInitialFullScreen(false);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dropdown states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedShipBy, setSelectedShipBy] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedPOL, setSelectedPOL] = useState('');
  const [selectedPOD, setSelectedPOD] = useState('');
  const [addedProducts, setAddedProducts] = useState<FavoriteItem[]>(initialFavorites);

  // Compute unique categories
  const categories = useMemo(() => {
    const map = new Map<string, Category>();
    (productsData || []).forEach(p => {
      if (p.category?.id) {
        map.set(p.category.id, p.category);
      }
    });
    return Array.from(map.values());
  }, [productsData]);

  // Compute unique countries based on selected category
  const countries = useMemo(() => {
    const map = new Map<string, Country>();
    (productsData || []).forEach(p => {
      if (!selectedCategory || p.category?.id === selectedCategory) {
        if (p.country?.id) {
          map.set(p.country.id, p.country);
        }
      }
    });
    return Array.from(map.values());
  }, [productsData, selectedCategory]);

  // Filter products based on selected category and country
  const filteredProducts = useMemo(() => {
    return (productsData || []).filter(p => {
      if (selectedCategory && p.category?.id !== selectedCategory) return false;
      if (selectedCountry && p.country?.id !== selectedCountry) return false;
      return true;
    });
  }, [productsData, selectedCategory, selectedCountry]);

  // Check if selected term requires POD (CNF/CIF)
  const selectedTermObj = useMemo(() => {
    return (shippingTerms || []).find(t => t.id === selectedTerm);
  }, [shippingTerms, selectedTerm]);

  const isPodRequired = useMemo(() => {
    if (!selectedTermObj) return false;
    const title = (selectedTermObj.title || '').trim().toUpperCase();
    return ['CNF', 'CIF'].includes(title);
  }, [selectedTermObj]);

  const [fetchedPackingTitle, setFetchedPackingTitle] = useState<string>('');

  // 1. Handle Category Select / Clear: clears Country, Product, Ship by, Term, POL, POD
  const handleCategorySelect = (val: string) => {
    setSelectedCategory(val);
    setSelectedCountry('');
    setSelectedProduct('');
    setSelectedShipBy('');
    setSelectedTerm('');
    setSelectedPOL('');
    setSelectedPOD('');
    setShippingContainers([]);
    setLoadingPorts([]);
    setDestinationPorts([]);
    setFetchedPackingTitle('');
    if (val) setTimeout(() => document.getElementById('select-country')?.click(), 100);
  };

  // 2. Handle Country Select / Clear: clears Product, Ship by, Term, POL, POD
  const handleCountrySelect = (val: string) => {
    setSelectedCountry(val);
    setSelectedProduct('');
    setSelectedShipBy('');
    setSelectedTerm('');
    setSelectedPOL('');
    setSelectedPOD('');
    setShippingContainers([]);
    setLoadingPorts([]);
    setDestinationPorts([]);
    setFetchedPackingTitle('');
    if (val) setTimeout(() => document.getElementById('select-product')?.click(), 100);
  };

  // 3. Handle Product Select / Clear: fetches all containers from API
  const handleProductSelect = useCallback(async (prodId: string) => {
    setSelectedProduct(prodId);
    setSelectedShipBy('');
    setSelectedTerm('');
    setSelectedPOL('');
    setSelectedPOD('');
    setShippingContainers([]);
    setLoadingPorts([]);
    setDestinationPorts([]);
    setFetchedPackingTitle('');

    if (!prodId) return;

    const prod = (productsData || []).find(p => p.id === prodId);
    if (prod) {
      if (prod.category?.id) setSelectedCategory(prod.category.id);
      if (prod.country?.id) setSelectedCountry(prod.country.id);
    }

    setContainersLoading(true);
    
    // Priority 1: Fetch Shipping Containers
    try {
      const res = await getShippingContainersAction(prodId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setShippingContainers(res.data);
        if (res.data.length === 1) {
          setSelectedShipBy(res.data[0].id);
          setTimeout(() => document.getElementById('select-term')?.click(), 100);
        } else {
          setTimeout(() => document.getElementById('select-shipby')?.click(), 100);
        }
      } else {
        setShippingContainers([]);
      }
    } catch (err) {
      console.error('Failed to load containers:', err);
      setShippingContainers([]);
    } finally {
      setContainersLoading(false);
    }
    
    // Priority 2: Fetch Product Details (to get packing types)
    try {
      const detailRes = await getProductDetailsAction(prodId, lang);
      if (detailRes.success && detailRes.data && Array.isArray(detailRes.data.packing_types)) {
        const pt = detailRes.data.packing_types.find((p: any) => 
          p.is_default === true || p.is_default === 1 || p.is_default === "1" || p.is_default === "true"
        );
        if (pt && pt.title) {
          setFetchedPackingTitle(pt.title);
        }
      }
    } catch (err) {
      console.error('Failed to load product details:', err);
    }
  }, [productsData, selectedCategory, selectedCountry, lang]);

  // 4. Handle Ship by Select / Clear: clears Term, POL, POD
  const handleShipBySelect = useCallback((shipById: string) => {
    setSelectedShipBy(shipById);
    setSelectedTerm('');
    setSelectedPOL('');
    setSelectedPOD('');
    setLoadingPorts([]);
    setDestinationPorts([]);
    if (shipById) setTimeout(() => document.getElementById('select-term')?.click(), 100);
  }, []);

  // 5. Handle Term (Incoterm) Select / Clear: fetches all loading ports from API
  const handleTermSelect = useCallback(async (termId: string) => {
    setSelectedTerm(termId);
    setSelectedPOL('');
    setSelectedPOD('');
    setLoadingPorts([]);
    setDestinationPorts([]);

    if (!termId || !selectedProduct || !selectedShipBy) return;

    setPolLoading(true);
    try {
      const res = await getLoadingPortsAction(selectedProduct, selectedShipBy, termId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setLoadingPorts(res.data);
        if (res.data.length === 1) {
          const singlePortId = res.data[0].id;
          setSelectedPOL(singlePortId);
          
          // If chosen term requires POD and only 1 POL exists, fetch all destination ports
          const chosenTerm = (shippingTerms || []).find(t => t.id === termId);
          const requiresPod = chosenTerm && chosenTerm.title ? ['CNF', 'CIF'].includes(chosenTerm.title.trim().toUpperCase()) : false;
          if (requiresPod) {
            setPodLoading(true);
            getDestinationPortsAction(selectedProduct, selectedShipBy, singlePortId, lang)
              .then(dRes => {
                if (dRes.success && Array.isArray(dRes.data)) {
                  setDestinationPorts(dRes.data);
                  setTimeout(() => document.getElementById('select-pod')?.click(), 100);
                }
              })
              .finally(() => setPodLoading(false));
          }
        } else {
          setTimeout(() => document.getElementById('select-port')?.click(), 100);
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
  }, [selectedProduct, selectedShipBy, shippingTerms, lang]);

  // 6. Handle POL Select / Clear: fetches all destination ports (38+ ports) from API when CNF/CIF
  const handlePOLSelect = useCallback(async (polId: string) => {
    setSelectedPOL(polId);
    setSelectedPOD('');
    setDestinationPorts([]);

    if (!polId || !selectedProduct || !selectedShipBy || !isPodRequired) return;

    setPodLoading(true);
    try {
      const res = await getDestinationPortsAction(selectedProduct, selectedShipBy, polId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setDestinationPorts(res.data);
        if (res.data.length === 1) {
          setSelectedPOD(res.data[0].id);
        } else {
          setTimeout(() => document.getElementById('select-pod')?.click(), 100);
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
  }, [selectedProduct, selectedShipBy, isPodRequired, lang]);

  // 7. Handle POD Select / Clear
  const handlePODSelect = useCallback((podId: string) => {
    setSelectedPOD(podId);
  }, []);

  // Determine if Add Product is fully ready
  const isAddProductEnabled = Boolean(
    selectedProduct &&
    selectedShipBy &&
    selectedTerm &&
    selectedPOL &&
    (!isPodRequired || selectedPOD)
  );

  // Auto-scroll to the note element of the mobile form when all required fields are selected
  // so the user can see the packing details and product price note smoothly.
  useEffect(() => {
    if (isAddProductEnabled && showMobileAddForm) {
      const scrollTimer = setTimeout(() => {
        const noteEl = document.getElementById('mobile-add-product-note');
        if (noteEl) {
          noteEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 200); // Slight delay allows DOM changes and dropdown closing animations to finish
      return () => clearTimeout(scrollTimer);
    }
  }, [isAddProductEnabled, showMobileAddForm]);

  const handleAddProduct = async () => {
    if (!isAddProductEnabled || isAdding) return;
    
    const prod = (productsData || []).find(p => p.id === selectedProduct);
    if (!prod) return;

    setIsAdding(true);
    
    try {
      const payload: any = {
        category_id: selectedCategory || prod.category?.id,
        country_id: selectedCountry || prod.country?.id,
        product_id: selectedProduct,
        shiping_container_id: selectedShipBy,
        shipping_term_id: selectedTerm,
        loading_port_id: selectedPOL
      };

      if (isPodRequired && selectedPOD) {
        payload.destination_port_id = selectedPOD;
      }

      const result = await addFavoriteProductAction(payload, lang);

      if (result.success) {
        const shipByObj = (shippingContainers || []).find(s => s.id === selectedShipBy);
        const termObj = (shippingTerms || []).find(t => t.id === selectedTerm);
        const polObj = (loadingPorts || []).find(p => p.id === selectedPOL);
        const podObj = (destinationPorts || []).find(p => p.id === selectedPOD);

        const findFlag = (port: any) => {
          if (!port) return '';
          if (port.country?.flag) return port.country.flag;
          if (port.flag) return port.flag;
          if (port.keywords) {
            const kw = (port.keywords || '').toLowerCase();
            const matched = (countries || []).find(c => kw.includes((c.name || '').toLowerCase()));
            if (matched) return matched.flag;
          }
          return '';
        };

        setAddedProducts(prev => [
          {
            id: result.data?.id || Date.now(),
            category: prod.category?.name || 'N/A',
            country: prod.country?.name || 'N/A',
            countryFlag: prod.country?.flag || '',
            product: prod.name,
            shipBy: shipByObj ? shipByObj.title : 'N/A',
            term: termObj ? termObj.title : 'N/A',
            pol: polObj ? polObj.name : 'N/A',
            polFlag: findFlag(polObj),
            pod: isPodRequired ? (podObj ? podObj.name : 'N/A') : 'N/A',
            podFlag: isPodRequired ? findFlag(podObj) : '',
            price: (result.data?.price != null ? Math.round(Number(result.data.price)) : (result.data?.current_price != null ? Math.round(Number(result.data.current_price)) : 0)).toString(),
            change: (result.data?.change != null ? Math.round(Number(result.data.change)) : (result.data?.price_change != null ? Math.round(Number(result.data.price_change)) : (result.data?.change_percentage != null ? Math.round(Number(result.data.change_percentage)) : 0))).toString(),
            chartStatus: result.data?.chart_status === true || result.data?.chart_status === 'on' || prod.chart_status === true || prod.chart_status === 'on',
          },
          ...prev
        ]);
        
        // Reset selections cleanly
        setSelectedCategory('');
        setSelectedCountry('');
        setSelectedProduct('');
        setSelectedShipBy('');
        setSelectedTerm('');
        setSelectedPOL('');
        setSelectedPOD('');
        setShippingContainers([]);
        setLoadingPorts([]);
        setDestinationPorts([]);
        
        toast.success("Product added successfully!", {
          style: { background: '#10b981', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' },
          duration: 3000
        });
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      } else {
        console.error('Failed to add product:', result.error);
        toast.error(result.error || "Failed to add product", {
          style: { background: '#ef4444', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
        });
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error("An error occurred while adding the product", {
        style: { background: '#ef4444', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
      });
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDelete = (id: number | string) => {
    setDeleteConfirmId(id);
  };

  const handleDelete = async (id: number | string) => {
    setDeleteConfirmId(null);
    setAddedProducts(prev => prev.filter((p) => p.id !== id));
    try {
      await deleteFavoriteProductAction(id, lang);
      toast.success("Product deleted successfully!", {
        style: { background: '#ef4444', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' },
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to delete favorite product:', error);
      toast.error("Failed to delete product", {
        style: { background: '#ef4444', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
      });
    }
  };

  const getFlagUrl = (flagPath?: string) => {
    if (!flagPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return flagPath.startsWith('http') ? flagPath : `${baseUrl}/${flagPath.replace(/^\//, '')}`;
  };

  const gridCols = "grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr]";

  const marqueeCopies = 5;
  const marqueeItems = initialMarketedProducts && initialMarketedProducts.length > 0 
    ? Array(marqueeCopies).fill(initialMarketedProducts).flat() 
    : [];

  // Calculate dynamic duration to maintain constant speed (e.g. 5 seconds per item)
  const itemSpeedSeconds = 5;
  const marqueeDuration = `${(initialMarketedProducts?.length || 1) * itemSpeedSeconds}s`;

  return (
    <div className="w-full overflow-visible">
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-20%, 0, 0); }
        }
      `}</style>
      
      {initialMarketedProducts && initialMarketedProducts.length > 0 && (
        <div className="overflow-hidden whitespace-nowrap w-full bg-white dark:bg-[#18181b] rounded-md border border-zinc-200 dark:border-zinc-800 mb-4 flex items-center shadow-sm hover:[&>div]:[animation-play-state:paused]">
          <div className="inline-block animate-[marquee_60s_linear_infinite]" style={{ WebkitAnimationName: 'marquee', animationName: 'marquee', willChange: 'transform', animationDuration: marqueeDuration }}>
            {marqueeItems.map((p, i) => {
              // Generate a consistent dummy change if it's 0, just to make it look realistic as requested
              let changeVal = Number(p.change) || 0;
              if (changeVal === 0) {
                changeVal = Number(((p.name.length % 7) - 2.5 + (p.price % 3)).toFixed(2));
                if (changeVal === 0) changeVal = 2.20; // Fallback
              }
              const isPositive = changeVal >= 0;
              const sign = isPositive ? '+' : '-';
              return (
                <div key={i} className="inline-flex items-center px-4 border-r border-zinc-200 dark:border-zinc-800 last:border-0 h-10 group/item">
                  {p.countryFlag && <img src={getFlagUrl(p.countryFlag)!} alt="flag" className="w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-zinc-200 dark:border-zinc-700 mr-2" />}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[13px]">{p.name}</span>
                  {p.port && <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-medium ml-2 uppercase">({p.port})</span>}
                  <span className="text-blue-600 dark:text-blue-500 font-bold text-[13px] mx-3">${p.price}</span>
                  <span className={`font-semibold text-[13px] flex items-center ${isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                    <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'} text-[11px] mr-1`}></i>
                    {sign}{Math.abs(changeVal).toFixed(2)}%
                  </span>
                  {p.id && (
                    <button 
                      onClick={() => {
                        handleProductSelect(p.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          setShowMobileAddForm(true);
                        }
                      }}
                      className="ml-4 px-2.5 py-1 bg-[#1D92EB] hover:bg-[#157dc9] text-white text-[11px] font-semibold rounded cursor-pointer transition-colors shadow-sm"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="w-full relative">
        {/* Header / Input Row */}
        <div className={`hidden lg:grid ${gridCols} gap-2 mb-3 items-end sticky top-0 z-40 bg-zinc-50/90 dark:bg-[#121212]/90 backdrop-blur-md py-3 px-2 -mx-2 border-b border-zinc-200/50 dark:border-zinc-800/50 rounded-b-lg shadow-sm`}>
          {/* 1. Category */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-category-select"
              value={selectedCategory}
              onChange={handleCategorySelect}
              options={categories}
              placeholder="Category"
              disabled={false}
              loading={false}
            />
          </div>

          {/* 2. Country */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-country-select"
              value={selectedCountry}
              onChange={handleCountrySelect}
              options={countries}
              placeholder="Country"
              disabled={countries.length === 0}
              loading={false}
            />
          </div>

          {/* 3. Product Name */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-product-select"
              value={selectedProduct}
              onChange={handleProductSelect}
              options={filteredProducts}
              placeholder="Product Name"
              disabled={filteredProducts.length === 0}
              loading={false}
            />
          </div>

          {/* 4. Ship By (Container) */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-shipby-select"
              value={selectedShipBy}
              onChange={handleShipBySelect}
              options={shippingContainers}
              placeholder={!selectedProduct ? "Ship by" : containersLoading ? "Loading..." : shippingContainers.length === 0 ? "No containers" : "Ship by"}
              disabled={!selectedProduct || containersLoading || shippingContainers.length === 0}
              loading={containersLoading}
            />
          </div>

          {/* 5. Incoterm (FOB, CNF, CIF) */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-term-select"
              value={selectedTerm}
              onChange={handleTermSelect}
              options={shippingTerms}
              placeholder="Term"
              disabled={!selectedProduct || !selectedShipBy || shippingTerms.length === 0}
              loading={false}
            />
          </div>

          {/* 6. POL (Port of Loading) */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-pol-select"
              value={selectedPOL}
              onChange={handlePOLSelect}
              options={loadingPorts}
              placeholder={!selectedTerm ? "POL" : polLoading ? "Loading..." : loadingPorts.length === 0 ? "No POL" : "POL"}
              disabled={!selectedTerm || polLoading || loadingPorts.length === 0}
              loading={polLoading}
            />
          </div>

          {/* 7. POD (Port of Destination) */}
          <div className="w-full">
            <SearchableSelect 
              id="desktop-pod-select"
              value={isPodRequired ? selectedPOD : ''}
              onChange={handlePODSelect}
              options={destinationPorts}
              placeholder={!isPodRequired ? "POD (N/A)" : !selectedPOL ? "POD" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No POD" : "POD"}
              disabled={!isPodRequired || !selectedPOL || podLoading || destinationPorts.length === 0}
              loading={podLoading}
            />
          </div>
          
          {/* Static Column Headers - Hidden on Mobile */}
          <div className="hidden lg:flex w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#18181b] items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Price (PMT)
          </div>
          <div className="hidden lg:flex w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#18181b] items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Change
          </div>
          <div className="hidden lg:flex w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#18181b] items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Chart
          </div>
          
          {/* Add Product Button */}
          <div className="w-full relative group">
            <button 
              id="desktop-add-product-btn"
              onClick={handleAddProduct}
              disabled={!isAddProductEnabled || isAdding}
              className={`w-full h-10 rounded-md bg-primary-gradient text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all whitespace-nowrap px-2 ${
                !isAddProductEnabled || isAdding 
                  ? 'opacity-40 cursor-not-allowed shadow-none' 
                  : 'opacity-100 hover:opacity-95 hover:shadow-lg cursor-pointer active:scale-[0.98]'
              }`}
            >
              {isAdding ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Adding...
                </>
              ) : (
                'Add Product'
              )}
            </button>
            {!isAddProductEnabled && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-800 text-white text-xs rounded py-1.5 px-2.5 whitespace-nowrap z-50 shadow-lg after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-zinc-800">
                Please select the options to add the product
              </div>
            )}
          </div>
        </div>

        {/* Data Rows */}
        <div className={`mt-2 ${addedProducts.length === 0 ? 'lg:min-h-[220px]' : ''}`}>
          {addedProducts.length === 0 ? (
            <>
              {/* Mobile/Tablet Compact Card Empty State - Exact 3-row card layout matching commodity cards */}
              <div 
                onClick={() => setShowMobileAddForm(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMobileAddForm(true); }}
                className="lg:hidden relative overflow-hidden bg-zinc-50 dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-[#2a2a2c] hover:border-[#2DBC84] dark:hover:border-[#2DBC84] active:scale-[0.99] transition-all cursor-pointer group"
              >
                <div className="flex flex-col p-2">
                  {/* Row 1: Watchlist Header & Count */}
                  <div className="flex justify-between items-center text-[12px] text-zinc-500 dark:text-[#a1a1aa]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <i className="fa-solid fa-chart-line text-[#2DBC84] text-[11px]"></i>
                      <span>Watchlist</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>0 Products</span>
                    </div>
                  </div>
                  
                  {/* Row 2: Title & Add Action */}
                  <div className="flex justify-between items-center gap-2 mt-1">
                    <div className="font-bold text-[14px] leading-tight text-zinc-900 dark:text-[#f4f4f5]">
                      No Products Added
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-[13px] text-[#2DBC84] group-hover:text-[#25A06F] flex items-center gap-1">
                        <i className="fa-solid fa-plus text-[11px]"></i>
                        <span>Add Product</span>
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Description & Chevron */}
                  <div className="flex justify-between items-center text-[12px] text-zinc-500 dark:text-[#a1a1aa] mt-0.5">
                    <div className="truncate">Tap to search & add commodity to chart</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <i className="fa-solid fa-chevron-right text-[10px] text-zinc-400"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Empty State with Interactive Step Pointers & Tutorial */}
              <div className="hidden lg:flex flex-col gap-3">
                {/* Step-by-Step Pointers Grid matching input columns with 100% exact alignment */}
                <div className={`grid ${gridCols} gap-2 px-2 -mx-2`}>
                  {/* Col 1: Category (Optional Filter) */}
                  <div 
                    onClick={() => document.getElementById('desktop-category-select')?.click()}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden cursor-pointer ${
                      selectedCategory
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-50/80 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-[#1D92EB]/60 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedCategory ? 'fa-check text-emerald-500' : 'fa-filter text-blue-500/80'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Filter</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedCategory ? (categories.find(c => String(c.id) === String(selectedCategory))?.name || 'Category') : 'Category'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedCategory ? '✓ Selected' : 'Optional filter'}
                    </div>
                  </div>

                  {/* Col 2: Country (Optional Filter) */}
                  <div 
                    onClick={() => document.getElementById('desktop-country-select')?.click()}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden cursor-pointer ${
                      selectedCountry
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-50/80 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-[#1D92EB]/60 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedCountry ? 'fa-check text-emerald-500' : 'fa-filter text-blue-500/80'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Filter</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedCountry ? (countries.find(c => String(c.id) === String(selectedCountry))?.name || 'Country') : 'Country'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedCountry ? '✓ Selected' : 'Optional filter'}
                    </div>
                  </div>

                  {/* Col 3: Product Name (Required / Main Step) */}
                  <div 
                    onClick={() => document.getElementById('desktop-product-select')?.click()}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden cursor-pointer ${
                      !selectedProduct
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedProduct ? 'fa-check text-emerald-500' : 'fa-arrow-up animate-bounce text-[#1D92EB]'} text-[11px]`}></i>
                      <span className={`text-[9.5px] font-bold uppercase tracking-wider ${!selectedProduct ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                        {selectedProduct ? 'Product' : '★ Step 1: Pick Product'}
                      </span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedProduct ? (filteredProducts.find(p => String(p.id) === String(selectedProduct))?.name || 'Product') : 'Select Product'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedProduct ? '✓ Selected' : 'Auto-fills Origin'}
                    </div>
                  </div>

                  {/* Col 4: Ship By (Step 2) */}
                  <div 
                    onClick={() => {
                      if (selectedProduct) document.getElementById('desktop-shipby-select')?.click();
                      else document.getElementById('desktop-product-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden ${
                      !selectedProduct 
                        ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                        : !selectedShipBy
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedShipBy ? 'fa-check text-emerald-500' : selectedProduct ? 'fa-arrow-up animate-bounce text-[#1D92EB]' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 2</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedShipBy ? (shippingContainers.find(c => String(c.id) === String(selectedShipBy))?.title || 'Ship By') : 'Ship By'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedShipBy ? '✓ Selected' : 'Container'}
                    </div>
                  </div>

                  {/* Col 5: Term (Step 3) */}
                  <div 
                    onClick={() => {
                      if (selectedShipBy) document.getElementById('desktop-term-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden ${
                      !selectedShipBy 
                        ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                        : !selectedTerm
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedTerm ? 'fa-check text-emerald-500' : selectedShipBy ? 'fa-arrow-up animate-bounce text-[#1D92EB]' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 3</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedTerm ? (shippingTerms.find(t => String(t.id) === String(selectedTerm))?.title || 'Term') : 'Term'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedTerm ? '✓ Selected' : 'FOB / CIF'}
                    </div>
                  </div>

                  {/* Col 6: POL (Step 4) */}
                  <div 
                    onClick={() => {
                      if (selectedTerm) document.getElementById('desktop-pol-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden ${
                      !selectedTerm 
                        ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                        : !selectedPOL
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedPOL ? 'fa-check text-emerald-500' : selectedTerm ? 'fa-arrow-up animate-bounce text-[#1D92EB]' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 4</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedPOL ? (loadingPorts.find(p => String(p.id) === String(selectedPOL))?.name || 'POL') : 'POL'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedPOL ? '✓ Selected' : 'Loading port'}
                    </div>
                  </div>

                  {/* Col 7: POD (Step 5) */}
                  <div 
                    onClick={() => {
                      if (isPodRequired && selectedPOL) document.getElementById('desktop-pod-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden ${
                      !isPodRequired
                        ? 'bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-600'
                        : !selectedPOL 
                          ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                          : !selectedPOD
                            ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                            : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${!isPodRequired ? 'fa-minus text-zinc-300 dark:text-zinc-700' : selectedPOD ? 'fa-check text-emerald-500' : selectedPOL ? 'fa-arrow-up animate-bounce text-[#1D92EB]' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">{!isPodRequired ? 'N/A' : 'Step 5'}</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {!isPodRequired ? 'POD (N/A)' : selectedPOD ? (destinationPorts.find(p => String(p.id) === String(selectedPOD))?.name || 'POD') : 'POD'}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {!isPodRequired ? 'Not required' : selectedPOD ? '✓ Selected' : 'Destination'}
                    </div>
                  </div>

                  {/* Col 8: Price (PMT) Preview */}
                  <div className="h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 select-none w-full overflow-hidden">
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-dollar-sign text-emerald-500/80 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Live</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-700 dark:text-zinc-300">
                      Price (PMT)
                    </div>
                    <div className="text-[9.5px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      Auto rates
                    </div>
                  </div>

                  {/* Col 9: Change Preview */}
                  <div className="h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 select-none w-full overflow-hidden">
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-arrow-trend-up text-blue-500/80 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Trend</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-700 dark:text-zinc-300">
                      Change
                    </div>
                    <div className="text-[9.5px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      Daily shift
                    </div>
                  </div>

                  {/* Col 10: Chart Preview */}
                  <div className="h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 select-none w-full overflow-hidden">
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-chart-line text-purple-500/80 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Chart</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-700 dark:text-zinc-300">
                      Price Curve
                    </div>
                    <div className="text-[9.5px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      Interactive
                    </div>
                  </div>

                  {/* Col 11: Final Step - Add Product Button Pointer */}
                  <div 
                    onClick={() => {
                      if (isAddProductEnabled) handleAddProduct();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5 transition-all flex flex-col items-center justify-center text-center border select-none w-full overflow-hidden ${
                      !isAddProductEnabled
                        ? 'opacity-40 cursor-not-allowed bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                        : 'cursor-pointer bg-primary-gradient text-white border-transparent shadow-md hover:shadow-lg ring-2 ring-emerald-500/40 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid fa-arrow-up ${isAddProductEnabled ? 'animate-bounce text-white' : 'text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className={`text-[9.5px] font-bold uppercase tracking-wider ${isAddProductEnabled ? 'text-white' : ''}`}>Final</span>
                    </div>
                    <div className={`font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight ${isAddProductEnabled ? 'text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      Add Product
                    </div>
                    <div className={`text-[9.5px] mt-0.5 truncate w-full text-center px-0.5 leading-tight ${isAddProductEnabled ? 'text-white/90 font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {isAddProductEnabled ? 'Ready! Click here' : 'Complete steps'}
                    </div>
                  </div>
                </div>

                {/* Visual Tutorial Showcase Card */}
                <div className="bg-white dark:bg-[#18181b] rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1D92EB] flex items-center justify-center text-lg shadow-sm border border-blue-100 dark:border-blue-900/40">
                        <i className="fa-solid fa-graduation-cap"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span>How to Build Your Watchlist</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">Quick Guide</span>
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Select a commodity directly or use category & country filters to configure real-time market data.
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress pill */}
                    <div className="flex items-center gap-2 self-start md:self-auto bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <i className="fa-solid fa-layer-group text-xs text-[#1D92EB]"></i>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {isAddProductEnabled ? 'All options selected! Ready to add 🚀' : !selectedProduct ? 'Step 1: Pick a Product (or filter by Category/Origin)' : !selectedShipBy ? 'Step 2: Select Container' : !selectedTerm ? 'Step 3: Select Incoterm' : 'Step 4: Select Ports'}
                      </span>
                    </div>
                  </div>

                  {/* 3 Tutorial Feature Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Step 1 */}
                    <div 
                      onClick={() => document.getElementById('desktop-product-select')?.click()}
                      className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-blue-400/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-[#1D92EB] flex items-center justify-center font-bold text-xs">
                          1
                        </div>
                        <span className="text-[11px] text-[#1D92EB] font-semibold group-hover:underline flex items-center gap-1">
                          <span>Pick Product</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                        1. Direct Product Selection or Filters
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Select a <strong>Product</strong> directly to auto-fill Category & Country, or use them as optional filters to narrow your choices.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div 
                      onClick={() => {
                        if (selectedProduct) document.getElementById('desktop-shipby-select')?.click();
                        else document.getElementById('desktop-product-select')?.click();
                      }}
                      className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-blue-400/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-[#1D92EB] flex items-center justify-center font-bold text-xs">
                          2
                        </div>
                        <span className="text-[11px] text-[#1D92EB] font-semibold group-hover:underline flex items-center gap-1">
                          <span>Configure</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                        2. Container, Incoterms & Ports
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Pick shipping container, Incoterm (FOB/CNF/CIF), and origin/destination ports.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div 
                      onClick={() => {
                        if (isAddProductEnabled) handleAddProduct();
                      }}
                      className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-emerald-400/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                          3
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline flex items-center gap-1">
                          <span>Add Now</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                        3. Live Tracking & Price Curves
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Click <strong>Add Product</strong> to monitor real-time PMT price trends, change percentages, and interactive charts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 lg:gap-2.5">
              {addedProducts.map((item, index) => {
                const changeVal = Number(item.change) || 0;
                const isPositive = changeVal >= 0;
                const desktopRowBg = index % 2 === 0 ? 'bg-white dark:bg-[#1a1a1c]' : 'bg-zinc-50 dark:bg-[#222225]';
                
                return (
                  <div key={item.id || index}>
                    {/* Mobile/Tablet Card Layout */}
                    {/* Mobile/Tablet Card Layout */}
                    <SwipeableCard 
                      onDelete={() => confirmDelete(item.id)}
                      onChart={() => openBottomSheet(item.id)}
                    >
                      <div className="flex flex-col p-2">
                        {/* Row 1: Origins and POD */}
                        <div className="flex justify-between items-center text-[12px] text-zinc-500 dark:text-[#a1a1aa]">
                          <div className="flex items-center gap-1.5 font-medium">
                            {item.countryFlag && <img src={getFlagUrl(item.countryFlag)!} alt="flag" className="w-[16px] h-[12px] object-cover rounded-[2px]" />}
                            <span>{item.country}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>{item.pod && item.pod !== 'N/A' ? 'POD' : 'POL'}: {item.pod && item.pod !== 'N/A' ? item.pod : item.pol}</span>
                            {(item.pod && item.pod !== 'N/A' ? item.podFlag : item.polFlag) && <img src={getFlagUrl(item.pod && item.pod !== 'N/A' ? item.podFlag : item.polFlag)!} alt="flag" className="w-[16px] h-[12px] object-cover rounded-[2px]" />}
                          </div>
                        </div>
                        
                        {/* Row 2: Product Name & Price */}
                        <div className="flex justify-between items-center gap-3 mt-1">
                          <div className="font-bold text-[14px] leading-tight text-zinc-900 dark:text-[#f4f4f5]">
                            {item.product}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="font-bold text-[14px] text-zinc-900 dark:text-[#f4f4f5] whitespace-nowrap">
                              {item.term}: ${item.price}
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openBottomSheet(item.id);
                              }}
                              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-[#f4f4f5] active:bg-zinc-200 dark:active:bg-zinc-700 rounded-full transition-colors cursor-pointer"
                              aria-label="Open product options"
                            >
                              <i className="fa-solid fa-ellipsis-vertical text-[17px]"></i>
                            </button>
                          </div>
                        </div>

                        {/* Row 3: POL, ShipBy, Change */}
                        <div className="flex justify-between items-center text-[12px] text-zinc-500 dark:text-[#a1a1aa] mt-0.5">
                          <div>POL: {item.pol}</div>
                          <div className="flex items-center gap-1">
                            <span>({item.shipBy} - PMT)</span>
                            <span className={`font-semibold flex items-center ${isPositive ? 'text-[#2DBC84]' : 'text-red-500'}`}>
                              <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'} mr-0.5`}></i>
                              {isPositive ? `+${changeVal}$` : `${changeVal}$`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </SwipeableCard>

                    {/* Desktop Row Layout */}
                    <div className={`hidden lg:grid grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr] gap-2 items-center px-4 py-3.5 rounded-lg ${desktopRowBg} shadow-sm border border-zinc-200/80 dark:border-zinc-800 hover:shadow-md transition-all text-sm font-medium`}>
                      <div className="font-medium truncate text-zinc-800 dark:text-zinc-200" title={item.category}>{item.category}</div>
                      <div className="flex items-center gap-2 truncate font-medium text-zinc-800 dark:text-zinc-200" title={item.country}>
                        {item.countryFlag && <img src={getFlagUrl(item.countryFlag)!} alt="flag" className="w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-zinc-200 dark:border-zinc-700" />}
                        <span className="truncate">{item.country}</span>
                      </div>
                      <div className="font-semibold truncate text-foreground" title={item.product}>{item.product}</div>
                      <div className="truncate font-medium text-zinc-700 dark:text-zinc-300" title={item.shipBy}>{item.shipBy}</div>
                      <div className="text-center truncate font-medium text-zinc-700 dark:text-zinc-300" title={item.term}>{item.term}</div>
                      <div className="flex items-center gap-2 pl-[5px] truncate font-medium text-zinc-800 dark:text-zinc-200" title={item.pol}>
                        {item.polFlag && <img src={getFlagUrl(item.polFlag)!} alt="flag" className="w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-zinc-200 dark:border-zinc-700" />}
                        <span className="truncate">{item.pol}</span>
                      </div>
                      <div className="flex items-center gap-2 pl-[5px] truncate font-medium text-zinc-800 dark:text-zinc-200" title={item.pod}>
                        {item.podFlag && <img src={getFlagUrl(item.podFlag)!} alt="flag" className="w-5 h-3.5 object-cover rounded-[2px] shrink-0 border border-zinc-200 dark:border-zinc-700" />}
                        <span className="truncate">{item.pod || '-'}</span>
                      </div>
                      <div className="w-full flex items-center justify-center text-center font-bold text-foreground" title={`$${item.price}`}>${item.price}</div>
                      <div className={`w-full text-center font-semibold flex items-center justify-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`} title={`${changeVal}$`}>
                        <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
                        <span>{isPositive ? `+${changeVal}$` : `${changeVal}$`}</span>
                      </div>
                      <div 
                        className="w-full flex items-center justify-center text-center cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => openBottomSheet(item.id)}
                        title="View Product Chart"
                      >
                        <i className={`fa-solid fa-chart-line text-lg ${item.chartStatus ? 'text-[#1D92EB]' : 'text-zinc-400'}`}></i>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        {userType === 'seller' ? (
                          <button className="px-5 py-1 bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
                            Sell
                          </button>
                        ) : userType === 'buyer' ? (
                          <button className="px-5 py-1 bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
                            Buy
                          </button>
                        ) : (
                          <button className="px-5 py-1 bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
                            Sell
                          </button>
                        )}
                        <button 
                          onClick={() => confirmDelete(item.id)}
                          className="text-red-500 hover:text-red-600 transition-colors flex items-center justify-center text-lg p-1"
                          title="Delete product"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Actions Bar for Mobile/Tablet - Sticky when products overflow */}
        <div className="flex lg:hidden justify-between items-center py-4 px-4 -mx-4 sticky bottom-[68px] z-40 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] mt-3">
          <button className="px-5 py-[9px] bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-md text-[14px] hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm transition-colors">
             Inquiry / Offer
          </button>
          <div className="relative flex items-center justify-center">
            <button onClick={() => setShowDisclaimer(true)} className="text-zinc-400 dark:text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-100 transition-colors flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-[22px]"></i>
            </button>

            {showDisclaimer && (
              <>
                <div className="absolute top-full mt-4 z-50 w-[300px] sm:w-[320px] left-1/2 -translate-x-1/2 bg-white dark:bg-[#222222] border border-[#1D92EB] rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  {/* Triangle pointer at top center */}
                  <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-[14px] h-[14px] bg-white dark:bg-[#222222] border-t border-l border-[#1D92EB] transform rotate-45"></div>
                  
                  <h3 className="text-zinc-900 dark:text-white text-center font-semibold text-[16px] mb-3">Standard Market Rate</h3>
                  <p className="text-zinc-600 dark:text-[#d1d5db] text-[13px] leading-relaxed text-justify mb-4">
                    The displayed prices/rates reflect standard market rates between buyers and sellers which may or may not buy or sell at. They are subject to reconfirmation as per AgriGuru’s Terms, conditions.
                  </p>
                  <div className="border-t border-zinc-200 dark:border-[#3f3f46] pt-3 text-center">
                    <button 
                      onClick={() => setShowDisclaimer(false)}
                      className="text-[#1D92EB] font-bold text-[15px] hover:text-blue-500 transition-colors"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => setShowMobileAddForm(true)}
            className="px-6 py-[10px] bg-[#2DBC84] hover:bg-[#25A06F] text-white font-medium rounded-md text-[14px] shadow-sm transition-colors"
          >
            Add Product
          </button>
        </div>
      </div>
      {/* Delete Confirmation Popup */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#18181b] rounded-2xl p-5 w-full sm:w-max max-w-[95vw] shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex gap-4 items-center mb-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 text-red-600">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <div className="flex flex-col justify-center w-full items-center">
                <h3 className="text-[17px] font-bold text-red-600 dark:text-red-500 mb-1 leading-none text-center">Delete Product</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-[14px] leading-snug whitespace-nowrap text-center">Are you sure you want to delete this product?</p>
              </div>
            </div>
            
            <div className="flex w-full gap-3">
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-[15px] shadow-sm hover:bg-red-700 active:scale-[0.98] transition-all"
              >
                Delete
              </button>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-foreground font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet for Mobile Actions */}
      {activeBottomSheetId !== null && (() => {
        const activeItem = addedProducts.find(p => String(p.id) === String(activeBottomSheetId));
        if (!activeItem) return null;
        return (
          <BottomSheetContainer 
            activeItem={activeItem} 
            setActiveBottomSheetId={closeBottomSheet} 
            userType={userType} 
            router={router} 
            getFlagUrl={getFlagUrl} 
            defaultFullScreen={isInitialFullScreen}
            lang={lang}
          />
        );
      })()}

      {/* Full Screen Mobile Add Product Form */}
      {showMobileAddForm && (
        <div className="fixed inset-0 z-[300] bg-background flex flex-col animate-in slide-in-from-bottom-2 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <button 
              onClick={() => setShowMobileAddForm(false)}
              className="w-7 h-7 rounded-full bg-zinc-400 dark:bg-zinc-700 text-white flex items-center justify-center transition-transform active:scale-95"
            >
              <i className="fa-solid fa-chevron-left text-xs pr-0.5"></i>
            </button>
            <h2 className="text-[19px] font-bold">
              {'Add Product'.split(' ').map((word, index, arr) => (
                <span key={index}>
                  <span className="bg-[image:var(--ag-gradient-heading)] bg-clip-text text-transparent">
                    {word}
                  </span>
                  {index < arr.length - 1 && ' '}
                </span>
              ))}
            </h2>
            <button className="w-7 h-7 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
              <i className="fa-solid fa-magnifying-glass text-zinc-600 dark:text-zinc-300 text-[13px]"></i>
            </button>
          </div>

          {/* Form Fields */}
          <div id="mobile-add-form-scroll-container" className="flex-1 overflow-y-auto relative bg-background scroll-smooth scroll-pb-32">
            <div className="px-5 pt-3 pb-8 space-y-4 min-h-full flex flex-col">
              <div className="flex-1 space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Category</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-category"
                      value={selectedCategory} onChange={handleCategorySelect} options={categories}
                      placeholder="Select Category" disabled={false} loading={false}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Country</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-country"
                      value={selectedCountry} onChange={handleCountrySelect} options={countries}
                      placeholder="Select Country" disabled={countries.length === 0} loading={false}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Product Name</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-product"
                      value={selectedProduct} onChange={handleProductSelect} options={filteredProducts}
                      placeholder="Select Product" disabled={filteredProducts.length === 0} loading={false}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Ship by */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Ship by</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-shipby"
                      value={selectedShipBy} onChange={handleShipBySelect} options={shippingContainers}
                      placeholder={!selectedProduct ? "Select Ship By" : containersLoading ? "Loading..." : shippingContainers.length === 0 ? "No containers" : "Select Ship By"}
                      disabled={!selectedProduct || containersLoading || shippingContainers.length === 0} loading={containersLoading}
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Term */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Term</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-term"
                      value={selectedTerm} onChange={handleTermSelect} options={shippingTerms}
                      placeholder="Select Incoterm" disabled={!selectedProduct || !selectedShipBy || shippingTerms.length === 0} loading={false}
                      menuPosition="top"
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Port */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Port</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-port"
                      value={selectedPOL} onChange={handlePOLSelect} options={loadingPorts}
                      placeholder={!selectedTerm ? "Select Port" : polLoading ? "Loading..." : loadingPorts.length === 0 ? "No Port" : "Select Port"}
                      disabled={!selectedTerm || polLoading || loadingPorts.length === 0} loading={polLoading}
                      menuPosition="top"
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Destination Port */}
                <div>
                  <label className="block text-foreground font-semibold mb-1.5 text-[14px]">Destination Port</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-pod"
                      value={isPodRequired ? selectedPOD : ''} onChange={handlePODSelect} options={destinationPorts}
                      placeholder={!isPodRequired ? "Select Destination Port (N/A)" : !selectedPOL ? "Select Destination Port" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No Destination Port" : "Select Destination Port"}
                      disabled={!isPodRequired || !selectedPOL || podLoading || destinationPorts.length === 0} loading={podLoading}
                      menuPosition="top"
                      variant="mobile"
                    />
                  </div>
                </div>

                {/* Additional Product Info Notes */}
                {selectedProduct && (
                  <div id="mobile-add-product-note" className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start gap-3">
                      <i className="fa-solid fa-circle-info text-blue-500 mt-1"></i>
                      <div className="space-y-1.5 flex-1">
                        {fetchedPackingTitle && (
                          <div className="text-sm">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Packing Type: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">{fetchedPackingTitle}</span>
                          </div>
                        )}
                        <div className="text-sm">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Product Price: </span>
                          <span className="text-zinc-600 dark:text-zinc-400">USD/PMT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Sticky Add Button */}
            <div className="sticky bottom-0 left-0 w-full px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-background z-40 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
              <div className="flex justify-center">
                <button 
                  onClick={async () => {
                    await handleAddProduct();
                    if (isAddProductEnabled) {
                      setShowMobileAddForm(false);
                    }
                  }}
                  disabled={!isAddProductEnabled || isAdding}
                  className={`w-[200px] h-12 rounded-lg text-white font-semibold text-[16px] shadow-sm transition-all flex items-center justify-center
                    ${!isAddProductEnabled || isAdding 
                      ? 'opacity-40 cursor-not-allowed shadow-none bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400' 
                      : 'bg-primary-gradient hover:opacity-95 active:scale-95 cursor-pointer shadow-md hover:shadow-lg'
                    }`}
                >
                  {isAdding ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Adding...</> : 'Add Product'}
                </button>
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
            .mobile-add-select .h-10:not(.bg-\\[\\#1D92EB\\]) {
              background-color: #EAEAEA !important;
              color: #4b5563 !important;
              opacity: 1 !important;
            }
            .dark .mobile-add-select .h-10:not(.bg-\\[\\#1D92EB\\]) {
              background-color: #1f1f22 !important;
              color: #d1d5db !important;
            }
          `}} />
        </div>
      )}
    </div>
  );
}

// Sub-component to manage Bottom Sheet swipe-up logic (Angel One style - Butter-smooth Hardware-Accelerated Expansion)
// Sub-component to manage Bottom Sheet swipe-up logic (Angel One style - Butter-smooth Hardware-Accelerated Expansion)
const BottomSheetContainer = ({ activeItem, setActiveBottomSheetId, userType, getFlagUrl, defaultFullScreen = false, lang = 'en' }: any) => {
  const [isFullScreen, setIsFullScreen] = useState(defaultFullScreen);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const isFullScreenRef = useRef<boolean>(defaultFullScreen);
  const mountTimeRef = useRef<number>(Date.now());
  const sheetRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(105);

  useEffect(() => {
    isFullScreenRef.current = isFullScreen;
    if (sheetRef.current && !isDraggingRef.current) {
      sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease';
      sheetRef.current.style.transform = isFullScreen ? 'translateY(0px)' : 'translateY(calc(100% - 52vh))';
    }
  }, [isFullScreen]);

  // Lock document body scroll while bottom sheet is open
  useEffect(() => {
    mountTimeRef.current = Date.now();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveBottomSheetId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveBottomSheetId]);

  const expandToFullScreen = () => {
    setIsFullScreen(true);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease';
      sheetRef.current.style.transform = 'translateY(0px)';
    }
    if (typeof window !== 'undefined' && activeItem?.id) {
      const url = new URL(window.location.href);
      url.searchParams.set('chart', String(activeItem.id));
      url.searchParams.set('full', '1');
      window.history.pushState({ chart: activeItem.id, full: '1' }, '', url.toString());
    }
  };

  const handleDragStart = (clientY: number) => {
    if (Date.now() - mountTimeRef.current < 200) return;
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientY: number) => {
    if (!isDraggingRef.current || startYRef.current === null || !sheetRef.current) return;
    currentYRef.current = clientY;
    const diff = clientY - startYRef.current;
    
    if (isFullScreenRef.current) {
      if (diff > 0) {
        sheetRef.current.style.transform = `translateY(${diff}px)`;
      }
    } else {
      sheetRef.current.style.transform = `translateY(calc(100% - 52vh + ${diff}px))`;
    }
  };

  const handleDragEnd = () => {
    if (startYRef.current === null || currentYRef.current === null || !sheetRef.current) {
      isDraggingRef.current = false;
      startYRef.current = null;
      currentYRef.current = null;
      return;
    }

    const diff = currentYRef.current - startYRef.current;
    const timeTaken = Date.now() - startTimeRef.current;
    const velocity = Math.abs(diff) / (timeTaken || 1);

    isDraggingRef.current = false;
    startYRef.current = null;
    currentYRef.current = null;

    if (!isFullScreenRef.current) {
      // Swiping UP -> Must drag at least 30px or quick flick with velocity > 0.3
      if (diff < -30 || (diff < -15 && velocity > 0.3)) {
        expandToFullScreen();
      } else if (diff > 60 || (diff > 25 && velocity > 0.35)) {
        sheetRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 1, 1)';
        sheetRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => setActiveBottomSheetId(null), 250);
      } else {
        sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = 'translateY(calc(100% - 52vh))';
      }
    } else {
      // Swiping DOWN from fullscreen
      if (diff > 70 || (diff > 35 && velocity > 0.4)) {
        sheetRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 1, 1)';
        sheetRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => setActiveBottomSheetId(null), 250);
      } else {
        sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = 'translateY(0px)';
      }
    }
  };

  // Dynamically measure header
  useEffect(() => {
    const measureHeader = () => {
      const headerEl = document.querySelector('header');
      if (headerEl) {
        const rect = headerEl.getBoundingClientRect();
        setHeaderHeight(Math.max(Math.round(rect.bottom), 64));
      }
    };
    measureHeader();
    window.addEventListener('resize', measureHeader);
    return () => {
      window.removeEventListener('resize', measureHeader);
    };
  }, []);

  if (!activeItem) return null;

  const maxExpandedHeight = `calc(100dvh - ${headerHeight}px)`;

  return (
    <>
      {/* 1. Desktop Modal Popup (>= lg screens: Full Screen Pop-up Dialog) */}
      <div className="hidden lg:flex fixed inset-0 z-[100] items-center justify-center p-4 xl:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto select-none">
        {/* Click-away backdrop */}
        <div 
          className="absolute inset-0" 
          onClick={() => setActiveBottomSheetId(null)} 
        />
        
        {/* Desktop Popup Card Container */}
        <div 
          className="relative z-10 w-full max-w-6xl xl:max-w-7xl h-[92vh] max-h-[880px] bg-white dark:bg-[#121214] rounded-2xl xl:rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <MobileCommodityChart 
            item={activeItem} 
            isFullScreen={true} 
            onClose={() => setActiveBottomSheetId(null)} 
            userType={userType} 
            lang={lang}
          />
        </div>
      </div>

      {/* 2. Mobile/Tablet Bottom Sheet (< lg screens: Smooth GPU-Accelerated Drag Sheet) */}
      <div 
        className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end pointer-events-none select-none"
        style={{ top: `${headerHeight}px` }}
      >
        {/* Click-away Backdrop below Header */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-auto transition-opacity duration-300"
          onClick={() => setActiveBottomSheetId(null)}
        />

        {/* Bottom Sheet Modal Container - Anchored Flush to Bottom, Fixed Full Height with GPU translateY */}
        <div 
          ref={sheetRef}
          className={`fixed bottom-0 inset-x-0 w-full max-w-lg mx-auto bg-white dark:bg-[#121214] shadow-2xl flex flex-col will-change-transform z-[65] pointer-events-auto ${
            isFullScreen 
              ? 'rounded-none border-t border-zinc-200/80 dark:border-zinc-800/80' 
              : 'rounded-t-[28px] border-t border-zinc-200/80 dark:border-zinc-800/80'
          }`}
          onClick={(e) => e.stopPropagation()}
          style={{ 
            height: maxExpandedHeight,
            maxHeight: maxExpandedHeight,
            transform: isFullScreen ? 'translateY(0px)' : 'translateY(calc(100% - 52vh))', 
            transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease',
          }}
        >
          {/* Exact Angel One Style "Swipe up for Commodity Details" Indicator (Attached directly on top edge) */}
          {!isFullScreen && (
            <div 
              onClick={expandToFullScreen}
              onTouchStart={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragStart(e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragMove(e.touches[0].clientY);
              }}
              onTouchEnd={handleDragEnd}
              onTouchCancel={handleDragEnd}
              className="absolute bottom-[100%] inset-x-0 flex flex-col items-center justify-center gap-1 cursor-pointer touch-none select-none z-[75] pointer-events-auto pb-2.5 transition-opacity duration-200"
            >
              {/* Angel One Signature Wide Curved Chevron */}
              <svg 
                className="w-14 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-pulse" 
                viewBox="0 0 56 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M3 13L28 3L53 13" 
                  stroke="currentColor" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
              
              {/* Centered Clean Text Directly Underneath */}
              <span className="text-[13px] font-semibold tracking-normal text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                Swipe up for Commodity Details
              </span>
            </div>
          )}

          {/* Drag Handle Top Bar (visible when not fullscreen) */}
          {!isFullScreen && (
            <div 
              className="pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center w-full select-none bg-white dark:bg-[#121214] shrink-0"
              onTouchStart={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragStart(e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragMove(e.touches[0].clientY);
              }}
              onTouchEnd={handleDragEnd}
              onTouchCancel={handleDragEnd}
              onMouseDown={(e) => {
                e.preventDefault();
                handleDragStart(e.clientY);
                const onMouseMove = (m: MouseEvent) => handleDragMove(m.clientY);
                const onMouseUp = () => {
                  handleDragEnd();
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            >
              <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
            </div>
          )}

          {/* Scrollable Commodity View inside Flex */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <MobileCommodityChart 
              item={activeItem} 
              isFullScreen={isFullScreen} 
              onClose={() => setActiveBottomSheetId(null)} 
              userType={userType} 
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              lang={lang}
            />
          </div>
        </div>
      </div>
    </>
  );
};
