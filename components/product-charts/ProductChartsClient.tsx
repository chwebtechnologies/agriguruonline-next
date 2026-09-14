'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  getShippingContainersAction,
  getLoadingPortsAction,
  getDestinationPortsAction,
  addFavoriteProductAction,
  deleteFavoriteProductAction,
  getProductDetailsAction,
  getFavoriteProductsAction
} from '@/app/actions/charts';
import { toast } from 'sonner';
import { FlagIcon } from '@/components/ui/FlagIcon';



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
  const [actionIndication, setActionIndication] = useState<{ isOpen: boolean; message: string; indication: string } | null>(null);
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

  useEffect(() => {
    setAddedProducts(initialFavorites);
  }, [initialFavorites]);

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
        // Fetch fresh favorite products list from server immediately so live add matches page refresh 100%
        const favsRes = await getFavoriteProductsAction(lang);

        if (favsRes.success && Array.isArray(favsRes.data) && favsRes.data.length > 0) {
          const isChart = (val: any) => {
            if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
            return val === true || val === 1 || val === '1' || val === 'on' || val === 'true' || val === 'active' || val === 'enable' || val === 'enabled';
          };

          const mapped: FavoriteItem[] = favsRes.data.map((item: any) => ({
            id: item.id || Date.now(),
            category: item.category?.name || 'N/A',
            country: item.country?.name || 'N/A',
            countryFlag: item.country?.flag || '',
            product: item.product?.name || 'N/A',
            shipBy: item.shipping_container?.title || 'N/A',
            term: item.shipping_term?.title || 'N/A',
            pol: item.loading_port?.name || 'N/A',
            polFlag: item.loading_port?.flag || item.loading_port?.country?.flag || '',
            pod: item.destination_port?.name || 'N/A',
            podFlag: item.destination_port?.flag || item.destination_port?.country?.flag || '',
            price: (item.price != null ? Math.round(Number(item.price)) : (item.current_price != null ? Math.round(Number(item.current_price)) : 0)).toString(),
            change: (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString(),
            chartStatus: isChart(item.chart_status) || isChart(item.chartStatus) || isChart(item.product?.chart_status),
          }));

          setAddedProducts(mapped);
        } else {
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

          const isChartStatusActive = (val: any) => {
            if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false') return false;
            return true;
          };

          const finalChartStatus = 
            isChartStatusActive(result.data?.chart_status) ||
            isChartStatusActive(result.data?.chartStatus) ||
            isChartStatusActive(result.data?.product?.chart_status) ||
            isChartStatusActive(result.data?.is_chart) ||
            isChartStatusActive(prod.chart_status);

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
              chartStatus: finalChartStatus,
            },
            ...prev
          ]);
        }
        
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
          style: { background: 'var(--brand-green)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' },
          duration: 3000
        });
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      } else {
        console.error('Failed to add product:', result.error);
        if (result.response_indication) {
          setActionIndication({ 
            isOpen: true, 
            message: result.error || 'Limit over', 
            indication: result.response_indication 
          });
          toast.error(result.error || "Failed to add product", {
            style: { background: 'var(--brand-red)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
          });
        } else {
          toast.error(result.error || "Failed to add product", {
            style: { background: 'var(--brand-red)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
          });
        }
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error("An error occurred while adding the product", {
        style: { background: 'var(--brand-red)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
      });
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDelete = (id: number | string) => {
    setDeleteConfirmId(id);
  };

  const handleActionClick = () => {
    // Actions allowed for all users
  };

  const handleDelete = async (id: number | string) => {
    setDeleteConfirmId(null);
    const previousProducts = [...addedProducts];
    // Optimistic removal
    setAddedProducts(prev => prev.filter((p) => p.id !== id));

    try {
      const res = await deleteFavoriteProductAction(id, lang);
      if (res.success) {
        toast.success("Product deleted successfully!", {
          style: { background: 'var(--brand-green)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' },
          duration: 3000
        });

        // Sync fresh server state
        const favsRes = await getFavoriteProductsAction(lang);
        if (favsRes.success && Array.isArray(favsRes.data)) {
          const isChart = (val: any) => {
            if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
            return true;
          };

          const getTitle = (obj: any, fallback = 'N/A') => {
            if (!obj) return fallback;
            if (typeof obj === 'string') return obj;
            return obj.name || obj.title || obj.label || fallback;
          };

          const getFlag = (obj: any) => {
            if (!obj) return '';
            if (typeof obj === 'string') return obj;
            return obj.flag || obj.country?.flag || '';
          };

          const mapped: FavoriteItem[] = favsRes.data.map((item: any) => {
            const prodName = getTitle(item.product) !== 'N/A' ? getTitle(item.product) : (item.product_name || item.name || 'N/A');
            const catName = getTitle(item.category) !== 'N/A' ? getTitle(item.category) : (item.category_name || 'N/A');
            const countryName = getTitle(item.country) !== 'N/A' ? getTitle(item.country) : (item.country_name || 'N/A');
            const countryFlag = getFlag(item.country) || item.country_flag || item.flag || '';
            const shipBy = getTitle(item.shipping_container) !== 'N/A' ? getTitle(item.shipping_container) : (getTitle(item.shippingContainer) !== 'N/A' ? getTitle(item.shippingContainer) : (item.ship_by || item.shipBy || 'N/A'));
            const term = getTitle(item.shipping_term) !== 'N/A' ? getTitle(item.shipping_term) : (getTitle(item.shippingTerm) !== 'N/A' ? getTitle(item.shippingTerm) : (item.term || 'N/A'));
            const pol = getTitle(item.loading_port) !== 'N/A' ? getTitle(item.loading_port) : (getTitle(item.loadingPort) !== 'N/A' ? getTitle(item.loadingPort) : (item.pol || 'N/A'));
            const polFlag = getFlag(item.loading_port) || getFlag(item.loadingPort) || item.pol_flag || '';
            const pod = getTitle(item.destination_port) !== 'N/A' ? getTitle(item.destination_port) : (getTitle(item.destinationPort) !== 'N/A' ? getTitle(item.destinationPort) : (item.pod || 'N/A'));
            const podFlag = getFlag(item.destination_port) || getFlag(item.destinationPort) || item.pod_flag || '';
            const price = (item.price != null ? Math.round(Number(item.price)) : (item.current_price != null ? Math.round(Number(item.current_price)) : 0)).toString();
            const change = (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString();

            return {
              id: item.id || Date.now(),
              category: catName,
              country: countryName,
              countryFlag,
              product: prodName,
              shipBy,
              term,
              pol,
              polFlag,
              pod,
              podFlag,
              price,
              change,
              chartStatus: isChart(item.chart_status) && isChart(item.chartStatus) && isChart(item.product?.chart_status),
            };
          });

          setAddedProducts(mapped);
        }
      } else {
        // Rollback state if server deletion was unsuccessful
        setAddedProducts(previousProducts);
        toast.error(res.error || "Failed to delete product from server", {
          style: { background: 'var(--brand-red)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
        });
      }
    } catch (error) {
      // Rollback state
      setAddedProducts(previousProducts);
      console.error('Failed to delete favorite product:', error);
      toast.error("Failed to delete product", {
        style: { background: 'var(--brand-red)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }
      });
    }
  };

  const getFlagUrl = (flagPath?: string) => {
    if (!flagPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return flagPath.startsWith('http') ? flagPath : `${baseUrl}/${flagPath.replace(/^\//, '')}`;
  };

  const gridCols = "grid-cols-[0.92fr_0.98fr_1.85fr_1.0fr_0.78fr_1.22fr_1.27fr_0.68fr_0.72fr_0.5fr_1.08fr]";

  const marqueeCopies = 5;
  const marqueeItems = initialMarketedProducts && initialMarketedProducts.length > 0 
    ? Array(marqueeCopies).fill(initialMarketedProducts).flat() 
    : [];

  // Calculate dynamic duration to maintain constant speed (e.g. 5 seconds per item)
  const itemSpeedSeconds = 5;
  const marqueeDuration = `${(initialMarketedProducts?.length || 1) * itemSpeedSeconds}s`;

  return (
    <>
      <div className="w-full overflow-visible">
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-20%, 0, 0); }
        }
      `}</style>
      
      {initialMarketedProducts && initialMarketedProducts.length > 0 && (
        <div className="overflow-hidden whitespace-nowrap w-full bg-card rounded-md border border-border mb-1.5 sm:mb-4 flex items-center shadow-sm hover:[&>div]:[animation-play-state:paused]">
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
                <div key={i} className="inline-flex items-center px-4 border-r border-border last:border-0 h-10 group/item">
                  {p.countryFlag && <FlagIcon src={getFlagUrl(p.countryFlag)} alt={`${p.country || 'Country'} Flag`} title={`${p.country || 'Country'} Flag`} className="w-5 h-3.5 shrink-0 border border-border mr-2" />}
                  <span className="font-semibold text-foreground/80 text-[13px]">{p.name}</span>
                  {p.port && <span className="text-foreground/75 text-[11px] font-medium ml-2 uppercase">({p.port})</span>}
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
                      className="ml-4 px-2.5 py-1 bg-brand-blue hover:bg-brand-blue-hover text-white text-[11px] font-semibold rounded cursor-pointer  shadow-sm"
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
        <div className={`hidden lg:grid ${gridCols} gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0`}>
          {/* 1. Category */}
          <div className="w-full min-w-0">
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
          <div className="w-full min-w-0">
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
          <div className="w-full min-w-0">
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
          <div className="w-full min-w-0">
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
          <div className="w-full min-w-0">
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
          <div className="w-full min-w-0">
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
          <div className="w-full min-w-0">
            <SearchableSelect 
              id="desktop-pod-select"
              value={isPodRequired ? selectedPOD : ''}
              onChange={handlePODSelect}
              options={destinationPorts}
              placeholder={!isPodRequired ? "POD" : !selectedPOL ? "POD" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No POD" : "POD"}
              disabled={!isPodRequired || !selectedPOL || podLoading || destinationPorts.length === 0}
              loading={podLoading}
            />
          </div>
          
          {/* Static Column Headers - Hidden on Mobile */}
          <div className="hidden lg:flex flex-col w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 leading-tight select-none cursor-default">
            <span>Price</span>
            <span className="text-[12px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">(PMT)</span>
          </div>
          <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
            Change
          </div>
          <div className="hidden lg:flex w-full h-[45px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-card items-center justify-center text-zinc-400 dark:text-zinc-500 font-medium text-xs lg:text-[13px] xl:text-sm px-1 text-center shadow-xs min-w-0 select-none cursor-default">
            Chart
          </div>
          
          {/* Add Product Button */}
          <ChartAddButton
            id="desktop-add-product-btn"
            onClick={handleAddProduct}
            disabled={!isAddProductEnabled}
            loading={isAdding}
            label="Add Product"
            tooltipText="Please select the options to add the product"
            variant="desktop"
          />
        </div>

        {/* Data Rows */}
        <div className={`mt-0 lg:mt-2 ${addedProducts.length === 0 ? 'lg:min-h-[220px]' : ''}`}>
          {addedProducts.length === 0 ? (
            <>
              {/* Mobile/Tablet Compact Card Empty State */}
              <ChartMobileEmptyCard
                onClick={() => setShowMobileAddForm(true)}
                icon="fa-solid fa-chart-area"
                badgeLabel="Watchlist"
                countLabel="0 Products"
                title="No Products Added"
                actionText="Add Product"
                description="Tap to search & add commodity to chart"
              />

              {/* Desktop Empty State with Interactive Step Pointers & Tutorial */}
              <div className="hidden lg:flex flex-col gap-3">
                {/* Step-by-Step Pointers Grid matching input columns with 100% exact alignment */}
                <div className={`grid ${gridCols} gap-2 px-2 -mx-2`}>
                  {/* Col 1: Category (Optional Filter) */}
                  <div 
                    onClick={() => document.getElementById('desktop-category-select')?.click()}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden cursor-pointer ${
                      selectedCategory
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-foreground/[0.02] border-border hover:border-brand-blue/60 text-foreground/70'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedCategory ? 'fa-check text-emerald-500' : 'fa-filter text-blue-500/80'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/75">Filter</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedCategory ? (categories.find(c => String(c.id) === String(selectedCategory))?.name || 'Category') : 'Category'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedCategory ? '✓ Selected' : 'Optional filter'}
                    </div>
                  </div>

                  {/* Col 2: Country (Optional Filter) */}
                  <div 
                    onClick={() => document.getElementById('desktop-country-select')?.click()}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden cursor-pointer ${
                      selectedCountry
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-foreground/[0.02] border-border hover:border-brand-blue/60 text-foreground/70'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedCountry ? 'fa-check text-emerald-500' : 'fa-filter text-blue-500/80'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/75">Filter</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedCountry ? (countries.find(c => String(c.id) === String(selectedCountry))?.name || 'Country') : 'Country'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedCountry ? '✓ Selected' : 'Optional filter'}
                    </div>
                  </div>

                  {/* Col 3: Product Name (Required / Main Step) */}
                  <div 
                    onClick={() => document.getElementById('desktop-product-select')?.click()}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden cursor-pointer ${
                      !selectedProduct
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedProduct ? 'fa-check text-emerald-500' : 'fa-arrow-up animate-bounce text-brand-blue'} text-[11px]`}></i>
                      <span className={`text-[9.5px] font-bold uppercase tracking-wider ${!selectedProduct ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                        {selectedProduct ? 'Product' : '★ Step 1: Product'}
                      </span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedProduct ? (filteredProducts.find(p => String(p.id) === String(selectedProduct))?.name || 'Product') : 'Select Product'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedProduct ? '✓ Selected' : 'Auto-fills Origin'}
                    </div>
                  </div>

                  {/* Col 4: Ship By (Step 2) */}
                  <div 
                    onClick={() => {
                      if (selectedProduct) document.getElementById('desktop-shipby-select')?.click();
                      else document.getElementById('desktop-product-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                      !selectedProduct 
                        ? 'opacity-40 cursor-not-allowed bg-foreground/[0.05] border-border text-muted-foreground'
                        : !selectedShipBy
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedShipBy ? 'fa-check text-emerald-500' : selectedProduct ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 2</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedShipBy ? (shippingContainers.find(c => String(c.id) === String(selectedShipBy))?.title || 'Ship By') : 'Ship By'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedShipBy ? '✓ Selected' : 'Container'}
                    </div>
                  </div>

                  {/* Col 5: Term (Step 3) */}
                  <div 
                    onClick={() => {
                      if (selectedShipBy) document.getElementById('desktop-term-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                      !selectedShipBy 
                        ? 'opacity-40 cursor-not-allowed bg-foreground/[0.05] border-border text-muted-foreground'
                        : !selectedTerm
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedTerm ? 'fa-check text-emerald-500' : selectedShipBy ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 3</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedTerm ? (shippingTerms.find(t => String(t.id) === String(selectedTerm))?.title || 'Term') : 'Term'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedTerm ? '✓ Selected' : 'FOB/CIF'}
                    </div>
                  </div>

                  {/* Col 6: POL (Step 4) */}
                  <div 
                    onClick={() => {
                      if (selectedTerm) document.getElementById('desktop-pol-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                      !selectedTerm 
                        ? 'opacity-40 cursor-not-allowed bg-foreground/[0.05] border-border text-muted-foreground'
                        : !selectedPOL
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                          : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${selectedPOL ? 'fa-check text-emerald-500' : selectedTerm ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">Step 4</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {selectedPOL ? (loadingPorts.find(p => String(p.id) === String(selectedPOL))?.name || 'POL') : 'POL'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {selectedPOL ? '✓ Selected' : 'Loading port'}
                    </div>
                  </div>

                  {/* Col 7: POD (Step 5) */}
                  <div 
                    onClick={() => {
                      if (isPodRequired && selectedPOL) document.getElementById('desktop-pod-select')?.click();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                      !isPodRequired
                        ? 'bg-foreground/[0.03] border-border/80 text-muted-foreground'
                        : !selectedPOL 
                          ? 'opacity-40 cursor-not-allowed bg-foreground/[0.05] border-border text-muted-foreground'
                          : !selectedPOD
                            ? 'cursor-pointer bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                            : 'cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid ${!isPodRequired ? 'fa-minus text-zinc-300 dark:text-zinc-700' : selectedPOD ? 'fa-check text-emerald-500' : selectedPOL ? 'fa-arrow-up animate-bounce text-brand-blue' : 'fa-arrow-up text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">{!isPodRequired ? 'N/A' : 'Step 5'}</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-zinc-900 dark:text-zinc-100">
                      {!isPodRequired ? 'POD' : selectedPOD ? (destinationPorts.find(p => String(p.id) === String(selectedPOD))?.name || 'POD') : 'POD'}
                    </div>
                    <div className="text-[9.5px] text-foreground/75 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      {!isPodRequired ? 'Not required' : selectedPOD ? '✓ Selected' : 'Destination'}
                    </div>
                  </div>

                  {/* Col 8: Price (PMT) Preview */}
                  <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-border bg-foreground/[0.02] text-foreground/75 select-none w-full min-w-0 overflow-hidden">
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-dollar-sign text-emerald-500/80 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/40">Live</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                      Price (PMT)
                    </div>
                    <div className="text-[9.5px] text-foreground/40 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      Standard
                    </div>
                  </div>

                  {/* Col 9: Change Preview */}
                  <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-border bg-foreground/[0.02] text-foreground/75 select-none w-full min-w-0 overflow-hidden">
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

                  {/* Col 10: Chart Preview */}
                  <div className="h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border border-dashed border-border bg-foreground/[0.02] text-foreground/75 select-none w-full min-w-0 overflow-hidden">
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className="fa-solid fa-chart-area text-brand-blue/80 text-[11px]"></i>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-foreground/40">Chart</span>
                    </div>
                    <div className="font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight text-foreground/80">
                      Chart
                    </div>
                    <div className="text-[9.5px] text-foreground/40 mt-0.5 truncate w-full text-center px-0.5 leading-tight">
                      Price curve
                    </div>
                  </div>

                  {/* Col 11: Final Step - Add Product Button Pointer */}
                  <div 
                    onClick={() => {
                      if (isAddProductEnabled) handleAddProduct();
                    }}
                    className={`group h-[74px] rounded-xl p-1.5  flex flex-col items-center justify-center text-center border select-none w-full min-w-0 overflow-hidden ${
                      !isAddProductEnabled
                        ? 'opacity-40 cursor-not-allowed bg-foreground/[0.05] border-border text-muted-foreground'
                        : 'cursor-pointer bg-primary-gradient text-white border-transparent shadow-md hover:shadow-lg ring-2 ring-emerald-500/40 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5 shrink-0">
                      <i className={`fa-solid fa-arrow-up ${isAddProductEnabled ? 'animate-bounce text-white' : 'text-zinc-300 dark:text-zinc-700'} text-[11px]`}></i>
                      <span className={`text-[9.5px] font-bold uppercase tracking-wider ${isAddProductEnabled ? 'text-white' : ''}`}>Final</span>
                    </div>
                    <div className={`font-bold text-[11px] truncate w-full text-center px-0.5 leading-tight ${isAddProductEnabled ? 'text-white' : 'text-foreground/80'}`}>
                      Add Product
                    </div>
                    <div className={`text-[9.5px] mt-0.5 truncate w-full text-center px-0.5 leading-tight ${isAddProductEnabled ? 'text-white/90 font-medium' : 'text-foreground/75'}`}>
                      {isAddProductEnabled ? 'Ready! Click here' : 'Complete steps'}
                    </div>
                  </div>
                </div>

                {/* Visual Tutorial Showcase Card */}
                <div className="bg-card rounded-2xl p-5 shadow-sm border border-border ">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-brand-blue flex items-center justify-center text-lg shadow-sm border border-blue-100 dark:border-blue-900/40">
                        <i className="fa-solid fa-graduation-cap"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span>How to Build Your Watchlist</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">Quick Guide</span>
                        </h3>
                        <p className="text-xs text-foreground/75 mt-0.5">
                          Select a commodity directly or use category & country filters to configure real-time market data.
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress pill */}
                    <div className="flex items-center gap-2 self-start md:self-auto bg-background px-3 py-1.5 rounded-lg border border-border">
                      <i className="fa-solid fa-layer-group text-xs text-brand-blue"></i>
                      <span className="text-xs font-semibold text-foreground/80">
                        {isAddProductEnabled ? 'All options selected! Ready to add 🚀' : !selectedProduct ? 'Step 1: Pick a Product (or filter by Category/Origin)' : !selectedShipBy ? 'Step 2: Select Container' : !selectedTerm ? 'Step 3: Select Incoterm' : 'Step 4: Select Ports'}
                      </span>
                    </div>
                  </div>

                  {/* 3 Tutorial Feature Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Step 1 */}
                    <div 
                      onClick={() => document.getElementById('desktop-product-select')?.click()}
                      className="p-3.5 rounded-xl bg-foreground/[0.02] hover:bg-blue-500/10 border border-border hover:border-blue-400/50 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                          1
                        </div>
                        <span className="text-[11px] text-brand-blue font-semibold group-hover:underline flex items-center gap-1">
                          <span>Pick Product</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                        1. Direct Product Selection or Filters
                      </h4>
                      <p className="text-[11px] text-foreground/75 leading-relaxed">
                        Select a <strong>Product</strong> directly to auto-fill Category & Country, or use them as optional filters to narrow your choices.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div 
                      onClick={() => {
                        if (selectedProduct) document.getElementById('desktop-shipby-select')?.click();
                        else document.getElementById('desktop-product-select')?.click();
                      }}
                      className="p-3.5 rounded-xl bg-foreground/[0.02] hover:bg-blue-500/10 border border-border hover:border-blue-400/50 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                          2
                        </div>
                        <span className="text-[11px] text-brand-blue font-semibold group-hover:underline flex items-center gap-1">
                          <span>Configure</span> <i className="fa-solid fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                        2. Container, Incoterms & Ports
                      </h4>
                      <p className="text-[11px] text-foreground/75 leading-relaxed">
                        Pick shipping container, Incoterm (FOB/CNF/CIF), and origin/destination ports.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div 
                      onClick={() => {
                        if (isAddProductEnabled) handleAddProduct();
                      }}
                      className="p-3.5 rounded-xl bg-foreground/[0.02] hover:bg-emerald-500/10 border border-border hover:border-emerald-400/50 cursor-pointer group"
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
                      <p className="text-[11px] text-foreground/75 leading-relaxed">
                        Click <strong>Add Product</strong> to monitor real-time PMT price trends, change percentages, and interactive charts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-[7px] lg:gap-2 mt-0.5 lg:mt-1">
              {addedProducts.map((item, index) => {
                const changeVal = Number(item.change) || 0;
                const isPositive = changeVal >= 0;
                const desktopRowBg = 'bg-card hover:bg-muted';
                
                return (
                  <div key={item.id || index}>
                    {/* Mobile/Tablet Card Layout */}
                    <SwipeableCard 
                      onDelete={() => confirmDelete(item.id)}
                      onChart={() => openBottomSheet(item.id)}
                    >
                      <ChartMobileItemCard
                        row1Left={
                          <>
                            {item.countryFlag && <FlagIcon src={getFlagUrl(item.countryFlag)} alt={`${item.country} Flag`} title={`${item.country} Flag`} className="w-[16px] h-[12px]" />}
                            <span>{item.country}</span>
                          </>
                        }
                        row1Right={
                          <>
                            <span>{item.pod && item.pod !== 'N/A' ? 'POD' : 'POL'}: {item.pod && item.pod !== 'N/A' ? item.pod : item.pol}</span>
                            {(item.pod && item.pod !== 'N/A' ? item.podFlag : item.polFlag) && <FlagIcon src={getFlagUrl(item.pod && item.pod !== 'N/A' ? item.podFlag : item.polFlag)} alt={`${item.pod && item.pod !== 'N/A' ? item.pod : item.pol} Flag`} title={`${item.pod && item.pod !== 'N/A' ? item.pod : item.pol} Flag`} className="w-[16px] h-[12px]" />}
                          </>
                        }
                        title={item.product}
                        priceDisplay={`${item.term}: $${item.price}`}
                        onOptionsClick={() => openBottomSheet(item.id)}
                        row3Left={`POL: ${item.pol}`}
                        row3Middle={`(${item.shipBy} - PMT)`}
                        changeValue={item.change}
                        isPositive={isPositive}
                      />
                    </SwipeableCard>

                    {/* Desktop Row Layout */}
                    <div className={`hidden lg:grid ${gridCols} gap-1.5 items-center px-3 py-3 rounded-lg ${desktopRowBg} shadow-xs border border-border hover:shadow-sm  text-sm font-semibold`}>
                      <div className="truncate text-foreground/90 min-w-0" title={item.category}>{item.category}</div>
                      <div className="flex items-center gap-2 truncate text-foreground/90 min-w-0" title={item.country}>
                        {item.countryFlag && <FlagIcon src={getFlagUrl(item.countryFlag)} alt={`${item.country} Flag`} title={`${item.country} Flag`} className="w-5 h-3.5 shrink-0 border border-border" />}
                        <span className="truncate min-w-0">{item.country}</span>
                      </div>
                      <div className="truncate text-foreground/90 min-w-0 font-bold" title={item.product}>{item.product}</div>
                      <div className="text-center truncate text-foreground/80 min-w-0 font-medium w-full" title={item.shipBy}>{item.shipBy}</div>
                      <div className="text-center truncate text-foreground/80 min-w-0 font-medium w-full" title={item.term}>{item.term}</div>
                      <div className="flex items-center gap-2 pl-[2px] truncate text-foreground/90 min-w-0 font-medium" title={item.pol}>
                        {item.polFlag && <FlagIcon src={getFlagUrl(item.polFlag)} alt={`${item.pol} Flag`} title={`${item.pol} Flag`} className="w-5 h-3.5 shrink-0 border border-border" />}
                        <span className="truncate min-w-0">{item.pol}</span>
                      </div>
                      <div className="flex items-center gap-2 pl-[2px] truncate text-foreground/90 min-w-0 font-medium" title={item.pod}>
                        {item.podFlag && <FlagIcon src={getFlagUrl(item.podFlag)} alt={`${item.pod || 'POD'} Flag`} title={`${item.pod || 'POD'} Flag`} className="w-5 h-3.5 shrink-0 border border-border" />}
                        <span className="truncate min-w-0">{item.pod || '-'}</span>
                      </div>
                      <div className="w-full flex items-center justify-center text-center font-bold text-foreground text-sm min-w-0" title={`$${item.price}`}>${item.price}</div>
                      <div className={`w-full text-center font-bold flex items-center justify-center gap-1 min-w-0 text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`} title={`${changeVal}$`}>
                        <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'} text-xs`}></i>
                        <span className="truncate">{isPositive ? `+${changeVal}$` : `${changeVal}$`}</span>
                      </div>
                      <div 
                        className={`w-full flex items-center justify-center text-center transition-transform min-w-0 ${item.chartStatus ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50'}`}
                        onClick={() => { if (item.chartStatus) openBottomSheet(item.id); }}
                        title={item.chartStatus ? "View Product Chart" : "Chart Not Available"}
                      >
                        <i className={`fa-solid fa-chart-area text-[18px] ${item.chartStatus ? 'bg-gradient-to-tr from-brand-blue to-brand-green bg-clip-text text-transparent' : 'text-zinc-400'}`}></i>
                      </div>
                      <div className="flex items-center justify-end gap-2.5 min-w-0">
                        <ChartActionButton
                          onClick={handleActionClick}
                          userType={userType}
                          mode="product"
                        />
                        <ChartDeleteButton
                          onClick={() => confirmDelete(item.id)}
                          title="Delete product"
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

        {/* Global Actions Bar for Mobile/Tablet - Sticky when products overflow */}
        <div className="flex lg:hidden justify-between items-center py-4 px-4 -mx-4 sticky bottom-[68px] z-40 bg-background/95 border-t border-border shadow-xs mt-3 pointer-events-auto">
          <button className="px-5 py-[9px] bg-card hover:bg-muted border border-border text-foreground font-semibold rounded-md text-[14px] shadow-sm ">
             Inquiry / Offer
          </button>
          <div className="relative flex items-center justify-center">
            <button onClick={() => setShowDisclaimer(true)} className="text-zinc-400 dark:text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-100  flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-[22px]"></i>
            </button>

            {showDisclaimer && (
              <>
                <div className="absolute top-full mt-4 z-50 w-[300px] sm:w-[320px] left-1/2 -translate-x-1/2 bg-card border border-brand-blue rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in-95 ">
                  {/* Triangle pointer at top center */}
                  <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-[14px] h-[14px] bg-card border-t border-l border-brand-blue transform rotate-45"></div>
                  
                  <h3 className="text-foreground text-center font-semibold text-[16px] mb-3">Standard Market Rate</h3>
                  <p className="text-zinc-600 text-foreground/80 text-[13px] leading-relaxed text-justify mb-4">
                    The displayed prices/rates reflect standard market rates between buyers and sellers which may or may not buy or sell at. They are subject to reconfirmation as per AgriGuru’s Terms, conditions.
                  </p>
                  <div className="border-t border-border pt-3 text-center">
                    <button 
                      onClick={() => setShowDisclaimer(false)}
                      className="text-brand-blue font-bold text-[15px] hover:text-blue-500 "
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <ChartAddButton
            onClick={() => setShowMobileAddForm(true)}
            label="Add Product"
            variant="mobile-sticky"
          />
        </div>
      </div>
      {/* Delete Confirmation Popup */}
      <DeleteConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Delete Product"
        description="Are you sure you want to delete this product?"
      />

      {/* Action Indication Popup */}
      <ActionIndicationModal
        isOpen={actionIndication !== null && actionIndication.isOpen}
        onClose={() => setActionIndication(null)}
        onConfirm={() => setActionIndication(null)}
        title="Free Trial Membership"
        description={actionIndication?.message}
        indicationText={actionIndication?.indication}
      />

      {/* Bottom Sheet for Mobile Actions */}
      {activeBottomSheetId !== null && (() => {
        const activeItem = addedProducts.find(p => String(p.id) === String(activeBottomSheetId));
        if (!activeItem) return null;
        return (
          <ChartBottomSheetContainer 
            activeItem={activeItem} 
            onClose={closeBottomSheet} 
            userType={userType} 
            defaultFullScreen={isInitialFullScreen}
            lang={lang}
            swipeText="Swipe up for Commodity Details"
          />
        );
      })()}

      {/* Full Screen Mobile Add Product Form */}
      {showMobileAddForm && (
        <div className="fixed inset-0 z-[700] bg-background flex flex-col animate-in slide-in-from-bottom-2 ">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <button 
              onClick={() => setShowMobileAddForm(false)}
              className="w-8 h-8 rounded-full bg-card border border-border text-foreground flex items-center justify-center transition-transform hover:bg-muted active:scale-95 shadow-xs"
            >
              <i className="fa-solid fa-chevron-left text-[13px] pr-0.5"></i>
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
                            <span className="font-semibold text-foreground/80">Packing Type: </span>
                            <span className="text-foreground/80">{fetchedPackingTitle}</span>
                          </div>
                        )}
                        <div className="text-sm">
                          <span className="font-semibold text-foreground/80">Product Price: </span>
                          <span className="text-foreground/80">USD/PMT</span>
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
                <ChartAddButton
                  onClick={async () => {
                    await handleAddProduct();
                    if (isAddProductEnabled) {
                      setShowMobileAddForm(false);
                    }
                  }}
                  disabled={!isAddProductEnabled}
                  loading={isAdding}
                  label="Add Product"
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
            .mobile-add-select .h-10:not(.bg-\\[\\#1D92EB\\]) {
              background-color: var(--muted) !important;
              color: var(--muted-foreground) !important;
            }
            .dark .mobile-add-select .h-10:not(.bg-\\[\\#1D92EB\\]) {
              background-color: var(--muted) !important;
              color: var(--muted-foreground) !important;
            }
          `}} />
        </div>
      )}
    </>
  );
}


