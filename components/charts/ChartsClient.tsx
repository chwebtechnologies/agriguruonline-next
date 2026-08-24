'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  getShippingContainersAction,
  getLoadingPortsAction,
  getDestinationPortsAction,
  addFavoriteProductAction,
  deleteFavoriteProductAction
} from '@/app/actions/charts';

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
  loading: selectLoading
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { id: string; name?: string; title?: string }[]; 
  placeholder: string; 
  disabled?: boolean; 
  loading?: boolean;
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
    <div className="relative w-full" ref={wrapperRef} title={displayValue}>
      <div 
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
        <div className="absolute z-50 w-full min-w-[200px] mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-2xl max-h-[300px] flex flex-col left-0">
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

interface ChartsClientProps {
  initialProducts?: Product[];
  initialShippingTerms?: ShippingTerm[];
  initialFavorites?: FavoriteItem[];
  initialUserType?: string | null;
  lang?: string;
}

export default function ChartsClient({
  initialProducts = [],
  initialShippingTerms = [],
  initialFavorites = [],
  initialUserType = null,
  lang = 'en'
}: ChartsClientProps) {
  const [productsData] = useState<Product[]>(initialProducts);
  const [shippingTerms] = useState<ShippingTerm[]>(initialShippingTerms);
  const [shippingContainers, setShippingContainers] = useState<ShippingContainer[]>([]);
  const [loadingPorts, setLoadingPorts] = useState<LoadingPortInfo[]>([]);
  const [destinationPorts, setDestinationPorts] = useState<DestinationPortInfo[]>([]);
  const userType = initialUserType;

  // Loading indicators for dynamic dropdowns
  const [containersLoading, setContainersLoading] = useState(false);
  const [polLoading, setPolLoading] = useState(false);
  const [podLoading, setPodLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

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

    if (!prodId) return;

    const prod = (productsData || []).find(p => p.id === prodId);
    if (prod) {
      if (prod.category?.id && !selectedCategory) setSelectedCategory(prod.category.id);
      if (prod.country?.id && !selectedCountry) setSelectedCountry(prod.country.id);
    }

    setContainersLoading(true);
    try {
      const res = await getShippingContainersAction(prodId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setShippingContainers(res.data);
        if (res.data.length === 1) {
          setSelectedShipBy(res.data[0].id);
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
  }, [productsData, selectedCategory, selectedCountry, lang]);

  // 4. Handle Ship by Select / Clear: clears Term, POL, POD
  const handleShipBySelect = useCallback((shipById: string) => {
    setSelectedShipBy(shipById);
    setSelectedTerm('');
    setSelectedPOL('');
    setSelectedPOD('');
    setLoadingPorts([]);
    setDestinationPorts([]);
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
                }
              })
              .finally(() => setPodLoading(false));
          }
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
          ...prev,
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
          }
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
      } else {
        console.error('Failed to add product:', result.error);
      }
    } catch (error) {
      console.error('Error adding product:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: number | string) => {
    setAddedProducts(prev => prev.filter((p) => p.id !== id));
    try {
      await deleteFavoriteProductAction(id, lang);
    } catch (error) {
      console.error('Failed to delete favorite product:', error);
    }
  };

  const getFlagUrl = (flagPath?: string) => {
    if (!flagPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return flagPath.startsWith('http') ? flagPath : `${baseUrl}/${flagPath.replace(/^\//, '')}`;
  };

  const gridCols = "grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr]";

  return (
    <div className="w-full overflow-visible">
      <div className="w-full">
        {/* Header / Input Row */}
        <div className={`grid ${gridCols} gap-2 mb-3 items-center px-0 relative z-30`}>
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
          
          {/* Static Column Headers */}
          <div className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Price (PMT)
          </div>
          <div className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Change
          </div>
          <div className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-medium text-sm px-1 text-center shadow-sm">
            Chart
          </div>
          
          {/* Add Product Button */}
          <div className="w-full">
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
          </div>
        </div>

        {/* Data Rows */}
        <div className="mt-2 min-h-[240px]">
          {addedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-foreground/50 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
              <i className="fa-solid fa-folder-open text-4xl mb-3 text-zinc-400"></i>
              <p className="text-sm font-medium">No products available. Add a product to view charts.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {addedProducts.map((item, index) => {
                const changeVal = Number(item.change) || 0;
                const isPositive = changeVal >= 0;
                
                return (
                  <div key={item.id || index} className={`grid ${gridCols} gap-2 items-center px-4 py-3.5 rounded-lg bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200/80 dark:border-zinc-800 hover:shadow-md transition-all text-sm font-medium`}>
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
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-600 transition-colors flex items-center justify-center text-lg p-1"
                        title="Delete product"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
