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
import AngelOneCommodityView from './AngelOneCommodityView';

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
  id
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { id: string; name?: string; title?: string }[]; 
  placeholder: string; 
  disabled?: boolean; 
  loading?: boolean;
  menuPosition?: 'top' | 'bottom';
  id?: string;
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

  return (
    <div className={`relative w-full ${isOpen && isInteractive ? 'z-[9999]' : ''}`} ref={wrapperRef} title={displayValue}>
      <div 
        id={id}
        className={`w-full h-10 rounded-md px-3 text-sm flex items-center justify-between transition-all ${
          !isInteractive
            ? 'opacity-60 cursor-not-allowed bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-400 select-none' 
            : isSelected
              ? 'bg-[#1D92EB] text-white border border-[#1D92EB] shadow-sm font-medium cursor-pointer'
              : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-sm font-medium cursor-pointer'
        }`}
        onClick={() => {
          if (isInteractive) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearch('');
          }
        }}
      >
        <span className="truncate pr-1 flex items-center gap-1.5">
          {selectLoading && (
            <i className="fa-solid fa-circle-notch fa-spin text-xs text-zinc-400 shrink-0"></i>
          )}
          <span className="truncate">{displayValue}</span>
        </span>

        {selectLoading ? null : isSelected && isInteractive ? (
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
          <i className={`fa-solid fa-chevron-right text-[10px] text-zinc-400 shrink-0 ml-1 transition-transform ${isOpen ? 'rotate-90' : ''}`}></i>
        )}
      </div>
      {isOpen && isInteractive && (
        <div className={`absolute z-50 w-full min-w-[200px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-2xl max-h-[300px] flex flex-col left-0 ${menuPosition === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="p-1.5 shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 rounded-t-md">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
              <input 
                type="text" 
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1D92EB] text-zinc-800 dark:text-zinc-200 transition-all" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="p-1 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center">No results</div>
            ) : (
              filteredOptions.map(opt => {
                const label = opt.name || opt.title || '';
                const active = String(value) === String(opt.id);
                return (
                  <div 
                    key={opt.id} 
                    className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors truncate ${active ? 'bg-[#1D92EB] text-white font-medium' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    {label}
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
  const [translateX, setTranslateX] = useState(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
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
    };

    const handleTouchMove = (e: TouchEvent) => {
      const diffX = e.touches[0].clientX - startXRef.current;
      const diffY = e.touches[0].clientY - startYRef.current;

      // Only activate horizontal swipe if X movement exceeds Y movement by 10px
      if (!isDraggingRef.current) {
        if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
          isDraggingRef.current = true;
        } else if (Math.abs(diffY) > 10) {
          // Vertical scroll — don't intercept
          return;
        } else {
          return;
        }
      }

      if (isDraggingRef.current) {
        // Prevent vertical scrolling/shaking while swiping horizontally
        if (e.cancelable) e.preventDefault();

        const maxSwipe = 120; // Ensure full visibility of action buttons
        let newTranslate = diffX;
        if (newTranslate > maxSwipe) newTranslate = maxSwipe;
        if (newTranslate < -maxSwipe) newTranslate = -maxSwipe;
        currentXRef.current = newTranslate;
        setTranslateX(newTranslate);
      }
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) {
        // Was a tap, not a swipe — reset and do nothing
        setTranslateX(0);
        currentXRef.current = 0;
        isDraggingRef.current = false;
        return;
      }

      isDraggingRef.current = false;

      const maxSwipe = 120;
      const threshold = maxSwipe * 0.5;

      if (currentXRef.current < -threshold) {
        onDelete();
      } else if (currentXRef.current > threshold) {
        onChart();
      }
      setTranslateX(0);
      currentXRef.current = 0;
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
      <div className="absolute inset-0 flex justify-between items-center z-0">
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
        className="relative z-10 w-full h-full bg-zinc-50 dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-zinc-200 dark:border-[#2a2a2c]"
        style={{ 
          transform: `translateX(${translateX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
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
    <div className={`w-full flex flex-col items-center bg-white dark:bg-zinc-900 ${isFullScreen ? 'pt-4 pb-2' : 'pt-2 pb-1'}`} onClick={onChartClick}>
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
  const [showMobileAddForm, setShowMobileAddForm] = useState(false);

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
        <div className="overflow-hidden whitespace-nowrap w-full bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 mb-4 flex items-center shadow-sm hover:[&>div]:[animation-play-state:paused]">
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
              value={isPodRequired ? selectedPOD : ''}
              onChange={handlePODSelect}
              options={destinationPorts}
              placeholder={!isPodRequired ? "POD (N/A)" : !selectedPOL ? "POD" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No POD" : "POD"}
              disabled={!isPodRequired || !selectedPOL || podLoading || destinationPorts.length === 0}
              loading={podLoading}
            />
          </div>
          
          {/* Static Column Headers - Hidden on Mobile */}
          <div className="hidden lg:flex w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Price (PMT)
          </div>
          <div className="hidden lg:flex w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Change
          </div>
          <div className="hidden lg:flex w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Chart
          </div>
          
          {/* Add Product Button */}
          <div className="w-full relative group">
            <button 
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
        <div className={`mt-2 ${addedProducts.length === 0 ? 'min-h-[240px]' : ''}`}>
          {addedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-foreground/50 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
              <i className="fa-solid fa-folder-open text-4xl mb-3 text-zinc-400"></i>
              <p className="text-sm font-medium">No products added yet. Use the dropdowns above to add a product.</p>
            </div>
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
                      onChart={() => setActiveBottomSheetId(item.id)}
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
                                setActiveBottomSheetId(item.id);
                              }}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                setActiveBottomSheetId(item.id);
                              }}
                              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-[#f4f4f5] active:bg-zinc-200 dark:active:bg-zinc-700 rounded-full transition-colors"
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
                      <div className="font-semibold truncate text-zinc-900 dark:text-zinc-100" title={item.product}>{item.product}</div>
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
                      <div className="w-full flex items-center justify-center text-center font-bold text-zinc-900 dark:text-zinc-100" title={`$${item.price}`}>${item.price}</div>
                      <div className={`w-full text-center font-semibold flex items-center justify-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`} title={`${changeVal}$`}>
                        <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
                        <span>{isPositive ? `+${changeVal}$` : `${changeVal}$`}</span>
                      </div>
                      <div className="w-full flex items-center justify-center text-center">
                        <i className={`fa-solid fa-chart-line text-lg ${item.chartStatus ? 'text-[#1D92EB]' : 'text-zinc-400'}`}></i>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        {userType === 'seller' ? (
                          <button className="px-5 py-1 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
                            Sell
                          </button>
                        ) : userType === 'buyer' ? (
                          <button className="px-5 py-1 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
                            Buy
                          </button>
                        ) : (
                          <button className="px-5 py-1 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full sm:w-max max-w-[95vw] shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
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
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet for Mobile Actions */}
      {activeBottomSheetId !== null && (() => {
        const activeItem = addedProducts.find(p => p.id === activeBottomSheetId);
        return (
          <BottomSheetContainer 
            activeItem={activeItem} 
            setActiveBottomSheetId={setActiveBottomSheetId} 
            userType={userType} 
            router={router} 
            getFlagUrl={getFlagUrl} 
          />
        );
      })()}

      {/* Full Screen Mobile Add Product Form */}
      {showMobileAddForm && (
        <div className="fixed inset-0 z-[300] bg-white dark:bg-[#121212] flex flex-col animate-in slide-in-from-bottom-2 duration-300">
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
          <div id="mobile-add-form-scroll-container" className="flex-1 overflow-y-auto relative bg-white dark:bg-[#121212] scroll-smooth scroll-pb-32">
            <div className="px-5 pt-3 pb-8 space-y-4 min-h-full flex flex-col">
              <div className="flex-1 space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Category</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-category"
                      value={selectedCategory} onChange={handleCategorySelect} options={categories}
                      placeholder="Select Category" disabled={false} loading={false}
                    />
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Country</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-country"
                      value={selectedCountry} onChange={handleCountrySelect} options={countries}
                      placeholder="Enter Country" disabled={countries.length === 0} loading={false}
                    />
                  </div>
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Product Name</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-product"
                      value={selectedProduct} onChange={handleProductSelect} options={filteredProducts}
                      placeholder="Select Product" disabled={filteredProducts.length === 0} loading={false}
                    />
                  </div>
                </div>

                {/* Ship by */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Ship by</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-shipby"
                      value={selectedShipBy} onChange={handleShipBySelect} options={shippingContainers}
                      placeholder={!selectedProduct ? "Select Ship By" : containersLoading ? "Loading..." : shippingContainers.length === 0 ? "No containers" : "Select Ship By"}
                      disabled={!selectedProduct || containersLoading || shippingContainers.length === 0} loading={containersLoading}
                    />
                  </div>
                </div>

                {/* Term */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Term</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-term"
                      value={selectedTerm} onChange={handleTermSelect} options={shippingTerms}
                      placeholder="Select Incoterm" disabled={!selectedProduct || !selectedShipBy || shippingTerms.length === 0} loading={false}
                      menuPosition="top"
                    />
                  </div>
                </div>

                {/* Port */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Port</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-port"
                      value={selectedPOL} onChange={handlePOLSelect} options={loadingPorts}
                      placeholder={!selectedTerm ? "Select Port" : polLoading ? "Loading..." : loadingPorts.length === 0 ? "No Port" : "Select Port"}
                      disabled={!selectedTerm || polLoading || loadingPorts.length === 0} loading={polLoading}
                      menuPosition="top"
                    />
                  </div>
                </div>

                {/* Destination Port */}
                <div>
                  <label className="block text-zinc-900 dark:text-zinc-100 font-semibold mb-1.5 text-[14px]">Destination Port</label>
                  <div className="mobile-add-select">
                    <SearchableSelect 
                      id="select-pod"
                      value={isPodRequired ? selectedPOD : ''} onChange={handlePODSelect} options={destinationPorts}
                      placeholder={!isPodRequired ? "Select Destination Port (N/A)" : !selectedPOL ? "Select Destination Port" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No Destination Port" : "Select Destination Port"}
                      disabled={!isPodRequired || !selectedPOL || podLoading || destinationPorts.length === 0} loading={podLoading}
                      menuPosition="top"
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
            <div className="sticky bottom-0 left-0 w-full px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#121212] z-40 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
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

// Sub-component to manage Bottom Sheet swipe-up logic (Angel One style)
const BottomSheetContainer = ({ activeItem, setActiveBottomSheetId, userType, router, getFlagUrl }: any) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const handleRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock document body scroll while bottom sheet is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  const handleDragStart = (clientY: number) => {
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    if (startYRef.current === null) return;
    currentYRef.current = clientY;
    const diff = clientY - startYRef.current;
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (startYRef.current === null || currentYRef.current === null) {
      setIsDragging(false);
      startYRef.current = null;
      currentYRef.current = null;
      return;
    }

    const diff = currentYRef.current - startYRef.current;
    const timeTaken = Date.now() - startTimeRef.current;
    const velocity = Math.abs(diff) / (timeTaken || 1);

    setIsDragging(false);
    startYRef.current = null;
    currentYRef.current = null;

    // Swiping UP towards header -> Directly navigate to the dedicated product chart page!
    if (diff < -25 || (diff < -10 && velocity > 0.25)) {
      const lang = window.location.pathname.split('/')[1] || 'en';
      setActiveBottomSheetId(null);
      router.push(`/${lang}/product-charts/${activeItem.id}`);
    } else if (diff > 50 || (diff > 20 && velocity > 0.3)) {
      // Pulled down -> Dismiss bottom sheet
      setActiveBottomSheetId(null);
      setDragOffset(0);
    } else {
      setDragOffset(0);
    }
  };

  // Non-passive touch listener to prevent default browser page scrolling
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onTouchStartNative = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      handleDragStart(e.touches[0].clientY);
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      handleDragMove(e.touches[0].clientY);
    };

    const onTouchEndNative = () => {
      handleDragEnd();
    };

    el.addEventListener('touchstart', onTouchStartNative, { passive: false });
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    el.addEventListener('touchend', onTouchEndNative, { passive: true });
    el.addEventListener('touchcancel', onTouchEndNative, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStartNative);
      el.removeEventListener('touchmove', onTouchMoveNative);
      el.removeEventListener('touchend', onTouchEndNative);
      el.removeEventListener('touchcancel', onTouchEndNative);
    };
  }, [isFullScreen]);

  const maxDrag = 250;
  const dragProgress = isFullScreen ? 1 : Math.min(Math.max(-dragOffset / maxDrag, 0), 1);
  const initialHeight = '52vh';
  const headerOffset = 64;
  const maxExpandedHeight = `calc(100dvh - ${headerOffset}px)`;

  const currentHeight = isFullScreen 
    ? maxExpandedHeight 
    : isDragging && dragOffset < 0 
      ? `calc(${initialHeight} + ${Math.min(-dragOffset, window.innerHeight * 0.45)}px)`
      : initialHeight;

  const effectiveTranslateY = dragOffset > 0 ? dragOffset : 0;

  return (
    <div className="fixed inset-0 z-40 select-none pointer-events-none">
      {/* Click-away dismiss area below header (Transparent, no dark backdrop over header) */}
      <div 
        className="absolute inset-x-0 bottom-0 top-[64px] pointer-events-auto"
        onClick={() => {
          if (isFullScreen) {
            setIsFullScreen(false);
          } else {
            setActiveBottomSheetId(null);
          }
        }}
      />

      {/* Floating Angel One "Swipe up for Commodity Details" with Chevron */}
      {!isFullScreen && dragOffset >= 0 && (
        <div 
          ref={handleRef}
          className={`absolute inset-x-0 bottom-[calc(${initialHeight}+10px)] flex flex-col items-center justify-center text-zinc-700 dark:text-zinc-300 pb-1 cursor-grab active:cursor-grabbing touch-none select-none z-50 animate-bounce pointer-events-auto`}
        >
          <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md shadow-md border border-zinc-200/80 dark:border-zinc-700/80 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold">
            <i className="fa-solid fa-chevron-up text-[10px] text-zinc-500"></i>
            <span>Swipe up for Commodity Details</span>
          </div>
        </div>
      )}

      {/* Bottom Sheet Modal Container - Anchored Flush to Bottom, Maximum Top at Header */}
      <div 
        ref={sheetRef}
        className={`fixed bottom-0 inset-x-0 w-full max-w-lg mx-auto bg-white dark:bg-[#121214] shadow-2xl overflow-hidden flex flex-col will-change-transform z-50 pointer-events-auto border-t border-zinc-200/80 dark:border-zinc-800/80 ${
          isFullScreen 
            ? 'rounded-none' 
            : 'rounded-t-[28px]'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          height: currentHeight,
          maxHeight: maxExpandedHeight,
          transform: `translateY(${effectiveTranslateY}px)`, 
          transition: isDragging ? 'none' : 'height 0.28s cubic-bezier(0.25, 1, 0.5, 1), transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' 
        }}
      >
        {/* Drag Handle Top Bar (visible when not fullscreen) */}
        {!isFullScreen && (
          <div 
            className="pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center w-full select-none bg-white dark:bg-[#121214] shrink-0"
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
          <AngelOneCommodityView 
            item={activeItem} 
            isFullScreen={isFullScreen} 
            onClose={() => {
              if (isFullScreen) {
                setIsFullScreen(false);
              } else {
                setActiveBottomSheetId(null);
              }
            }} 
            userType={userType} 
            dragProgress={dragProgress} 
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        </div>
      </div>
    </div>
  );
};
