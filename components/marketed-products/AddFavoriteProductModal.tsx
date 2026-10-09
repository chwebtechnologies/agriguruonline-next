'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scroll-lock';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { 
  getShippingContainersAction, 
  getProductDetailsAction, 
  getLoadingPortsAction, 
  getDestinationPortsAction, 
  addFavoriteProductAction,
  getAllProductsAction,
  getShippingTermsAction
} from '@/app/actions/charts';
import { ActionIndicationModal } from '@/components/ui/charts/ActionIndicationModal';
import { toast } from 'sonner';
import { useRouter, usePathname } from 'next/navigation';
import { 
  isHomePagePath, 
  scrollToMarketWatchlist, 
  WATCHLIST_SCROLL_KEY, 
  WATCHLIST_REFRESH_EVENT, 
  WATCHLIST_SCROLL_EVENT 
} from '@/lib/watchlist-utils';

export interface AddFavoriteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
  common?: any;
  productName?: string;
  countryName?: string;
  productId?: string;
  categoryId?: string;
  countryId?: string;
  initialProducts?: any[];
  shippingTerms?: any[];
  containers?: any[];
  onSuccess?: (data?: any) => void;
}

export function AddFavoriteProductModal({
  isOpen,
  onClose,
  lang = 'en',
  common = {},
  productName = '',
  countryName = '',
  productId = '',
  categoryId = '',
  countryId = '',
  initialProducts = [],
  shippingTerms: propShippingTerms = [],
  containers: propContainers = [],
  onSuccess,
}: AddFavoriteProductModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const openNextDropdown = (elementId: string) => {
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const el = document.getElementById(elementId);
        if (el) {
          if (!el.getAttribute('aria-disabled') && el.tabIndex !== -1) {
            el.click();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            setTimeout(() => {
              const retryEl = document.getElementById(elementId);
              if (retryEl) {
                retryEl.click();
                retryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 60);
          }
        }
      }
    }, 100);
  };

  // Core selections
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedShipBy, setSelectedShipBy] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedPOL, setSelectedPOL] = useState<string>('');
  const [selectedPOD, setSelectedPOD] = useState<string>('');

  // Data lists
  const [productsData, setProductsData] = useState<any[]>(initialProducts);
  const [shippingTerms, setShippingTerms] = useState<any[]>(propShippingTerms);
  const [shippingContainers, setShippingContainers] = useState<any[]>(propContainers);
  const [loadingPorts, setLoadingPorts] = useState<any[]>([]);
  const [destinationPorts, setDestinationPorts] = useState<any[]>([]);

  // Loading states
  const [containersLoading, setContainersLoading] = useState(false);
  const [polLoading, setPolLoading] = useState(false);
  const [podLoading, setPodLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [fetchedPackingTitle, setFetchedPackingTitle] = useState<string>('');

  // Action indication / KYC Modal
  const [actionIndication, setActionIndication] = useState<{
    isOpen: boolean;
    message: string;
    indication: string;
  }>({
    isOpen: false,
    message: '',
    indication: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProductsData(initialProducts);
    }
  }, [initialProducts]);

  useEffect(() => {
    if (propShippingTerms && propShippingTerms.length > 0) {
      setShippingTerms(propShippingTerms);
    }
  }, [propShippingTerms]);

  // Load all products and shipping terms if not passed
  useEffect(() => {
    if (!isOpen) return;

    if (!productsData || productsData.length === 0) {
      getAllProductsAction(lang).then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setProductsData(res.data);
        }
      });
    }

    if (!shippingTerms || shippingTerms.length === 0) {
      getShippingTermsAction(lang).then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setShippingTerms(res.data);
        }
      });
    }
  }, [isOpen, lang, productsData, shippingTerms]);

  // Handle scroll lock and escape key
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 1. Derived Categories
  const categories = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    (productsData || []).forEach(p => {
      const catId = p.category?.id;
      if (catId && !seen.has(catId)) {
        seen.add(catId);
        list.push({
          id: catId,
          name: p.category?.name || 'Unknown Category',
        });
      }
    });

    if (categoryId && !seen.has(categoryId)) {
      list.unshift({ id: categoryId, name: 'Current Category' });
    }

    return list;
  }, [productsData, categoryId]);

  // 2. Derived Countries
  const countries = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    (productsData || []).forEach(p => {
      if (selectedCategory && p.category?.id !== selectedCategory) return;
      const cId = p.country?.id;
      if (cId && !seen.has(cId)) {
        seen.add(cId);
        list.push({
          id: cId,
          name: p.country?.name || 'Unknown Country',
          flag: p.country?.flag || '',
        });
      }
    });

    if (countryId && !seen.has(countryId)) {
      list.unshift({ id: countryId, name: countryName || 'Current Country' });
    }

    return list;
  }, [productsData, selectedCategory, countryId, countryName]);

  // 3. Derived Filtered Products
  const filteredProducts = useMemo(() => {
    const list = (productsData || []).filter(p => {
      if (selectedCategory && p.category?.id !== selectedCategory) return false;
      if (selectedCountry && p.country?.id !== selectedCountry) return false;
      return true;
    }).map(p => ({
      id: p.id,
      name: p.name,
      flag: p.country?.flag || '',
    }));

    if (productId && !list.some(p => p.id === productId)) {
      list.unshift({ id: productId, name: productName || 'Current Product', flag: '' });
    }

    return list;
  }, [productsData, selectedCategory, selectedCountry, productId, productName]);

  // Is POD required based on incoterm (CNF or CIF)
  const isPodRequired = useMemo(() => {
    const chosenTerm = (shippingTerms || []).find(t => String(t.id) === String(selectedTerm));
    if (!chosenTerm || !chosenTerm.title) return false;
    return ['CNF', 'CIF'].includes(chosenTerm.title.trim().toUpperCase());
  }, [shippingTerms, selectedTerm]);

  // 4. Handle Product Select
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

    try {
      const res = await getShippingContainersAction(prodId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setShippingContainers(res.data);
        if (res.data.length === 1) {
          setSelectedShipBy(res.data[0].id);
          openNextDropdown('modal-select-term');
        } else {
          openNextDropdown('modal-select-shipby');
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
  }, [productsData, lang]);

  // 5. Handle Category Select (Auto selects country if only 1 exists, else auto-opens country dropdown)
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

    if (val) {
      const map = new Map<string, any>();
      (productsData || []).forEach(p => {
        if (p.category?.id === val && p.country?.id) {
          map.set(p.country.id, p.country);
        }
      });
      const availableCountries = Array.from(map.values());

      if (availableCountries.length === 1) {
        handleCountrySelect(availableCountries[0].id, val);
      } else {
        openNextDropdown('modal-select-country');
      }
    }
  };

  // 6. Handle Country Select (Auto selects product if only 1 exists, else auto-opens product dropdown)
  const handleCountrySelect = (val: string, currentCategory?: string) => {
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

    if (val) {
      const categoryToUse = currentCategory || selectedCategory;
      const availableProducts = (productsData || []).filter(p => {
        if (categoryToUse && p.category?.id !== categoryToUse) return false;
        if (p.country?.id !== val) return false;
        return true;
      });

      if (availableProducts.length === 1) {
        handleProductSelect(availableProducts[0].id);
      } else {
        openNextDropdown('modal-select-product');
      }
    }
  };

  // 7. Handle Ship By Select (Auto-opens term dropdown)
  const handleShipBySelect = useCallback((shipById: string) => {
    setSelectedShipBy(shipById);
    setSelectedTerm('');
    setSelectedPOL('');
    setSelectedPOD('');
    setLoadingPorts([]);
    setDestinationPorts([]);
    if (shipById) {
      openNextDropdown('modal-select-term');
    }
  }, []);

  // 8. Handle Term Select (Auto selects port if only 1, loads POD if CNF/CIF)
  const handleTermSelect = useCallback(async (termId: string) => {
    setSelectedTerm(termId);
    setSelectedPOL('');
    setSelectedPOD('');
    setLoadingPorts([]);
    setDestinationPorts([]);

    if (!termId || !selectedProduct || !selectedShipBy) {
      return;
    }

    setPolLoading(true);
    try {
      const res = await getLoadingPortsAction(selectedProduct, selectedShipBy, termId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setLoadingPorts(res.data);
        if (res.data.length === 1) {
          const singlePortId = res.data[0].id;
          setSelectedPOL(singlePortId);

          const chosenTerm = (shippingTerms || []).find(t => String(t.id) === String(termId));
          const requiresPod = chosenTerm && chosenTerm.title ? ['CNF', 'CIF'].includes(chosenTerm.title.trim().toUpperCase()) : false;
          if (requiresPod) {
            setPodLoading(true);
            getDestinationPortsAction(selectedProduct, selectedShipBy, singlePortId, lang)
              .then(dRes => {
                if (dRes.success && Array.isArray(dRes.data)) {
                  setDestinationPorts(dRes.data);
                  if (dRes.data.length === 1) {
                    setSelectedPOD(dRes.data[0].id);
                  } else {
                    openNextDropdown('modal-select-pod');
                  }
                }
              })
              .finally(() => setPodLoading(false));
          }
        } else {
          openNextDropdown('modal-select-port');
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

  // 9. Handle POL Select (Auto selects POD if only 1)
  const handlePOLSelect = useCallback(async (polId: string) => {
    setSelectedPOL(polId);
    setSelectedPOD('');
    setDestinationPorts([]);

    if (!polId || !selectedProduct || !selectedShipBy || !isPodRequired) {
      return;
    }

    setPodLoading(true);
    try {
      const res = await getDestinationPortsAction(selectedProduct, selectedShipBy, polId, lang);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setDestinationPorts(res.data);
        if (res.data.length === 1) {
          setSelectedPOD(res.data[0].id);
        } else {
          openNextDropdown('modal-select-pod');
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

  // 10. Handle POD Select
  const handlePODSelect = useCallback((podId: string) => {
    setSelectedPOD(podId);
  }, []);

  const hasInitializedRef = useRef(false);

  // Pre-fill state when opening with an existing product
  useEffect(() => {
    if (isOpen) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        if (productId) {
          if (categoryId) setSelectedCategory(categoryId);
          if (countryId) setSelectedCountry(countryId);
          handleProductSelect(productId);
        }
      }
    } else {
      hasInitializedRef.current = false;
      // Reset state on close
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
      setFetchedPackingTitle('');
      setIsAdding(false);
    }
  }, [isOpen, productId, categoryId, countryId, handleProductSelect]);

  // Check if form is valid to submit
  const isAddProductEnabled = Boolean(
    selectedProduct &&
    selectedShipBy &&
    selectedTerm &&
    selectedPOL &&
    (!isPodRequired || selectedPOD)
  );


  // Auto-scroll to the note element when all required fields are ready
  useEffect(() => {
    if (isAddProductEnabled && isOpen) {
      const scrollTimer = setTimeout(() => {
        const noteEl = document.getElementById('modal-add-product-note');
        if (noteEl) {
          noteEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 200);
      return () => clearTimeout(scrollTimer);
    }
  }, [isAddProductEnabled, isOpen]);

  // Submit action
  const handleSubmit = async () => {
    if (!isAddProductEnabled || isAdding) return;

    const prod = (productsData || []).find(p => p.id === selectedProduct);
    setIsAdding(true);

    try {
      const payload: any = {
        category_id: selectedCategory || prod?.category?.id || categoryId,
        country_id: selectedCountry || prod?.country?.id || countryId,
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
        toast.success("Product added successfully!");
        onClose();
        if (onSuccess) {
          onSuccess(result.data);
        }

        const isHome = isHomePagePath(pathname, lang);

        if (isHome) {
          // Immediately update home page product charts watchlist and scroll to section
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(WATCHLIST_REFRESH_EVENT));
            window.dispatchEvent(new CustomEvent(WATCHLIST_SCROLL_EVENT));
          }
          router.refresh();
          setTimeout(() => {
            scrollToMarketWatchlist({ smooth: true });
          }, 120);
        } else {
          // When adding from other pages (marketed products, product details, etc.),
          // set flag and redirect to homepage's Market Watchlist section
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(WATCHLIST_SCROLL_KEY, 'true');
            } catch {}
          }
          router.push(`/${lang}#market-watchlist`);
        }
      } else {
        console.error('Failed to add product:', result.error);
        if (result.response_indication) {
          setActionIndication({ 
            isOpen: true, 
            message: result.error || 'Limit reached or action required', 
            indication: result.response_indication 
          });
        } else {
          toast.error(result.error || "Failed to add product");
        }
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error("An error occurred while adding the product");
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <div 
        className="fixed inset-0 z-[9999] flex flex-col sm:items-center sm:justify-center bg-background sm:bg-black/80 sm:backdrop-blur-xs p-0 sm:p-4 overflow-y-auto overscroll-contain"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-background sm:bg-card w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[480px] sm:rounded-2xl sm:shadow-2xl sm:border sm:border-border flex flex-col my-0 sm:my-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          
          {/* Header (Fully Responsive - Mobile & Desktop) */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-border shrink-0 bg-background sm:bg-card">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                <i className="fa-solid fa-wheat-awn text-base sm:text-lg"></i>
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] sm:text-lg font-bold text-foreground leading-tight truncate">
                  Add to Watchlist
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-tight truncate mt-0.5">
                  Quick add & track daily prices
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center transition-colors shrink-0 cursor-pointer ml-2"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-sm sm:text-base"></i>
            </button>
          </div>

          {/* Form Body - Single Column Layout */}
          <div id="modal-add-form-scroll-container" className="flex-1 overflow-y-auto px-5 sm:px-6 pt-3 sm:pt-4 pb-28 sm:pb-16 custom-scrollbar">
            <div className="flex flex-col gap-3.5">
              
              {/* 1. Category */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-category"
                    value={selectedCategory} 
                    onChange={handleCategorySelect} 
                    options={categories}
                    placeholder={common.select_category || "Select Category"} 
                    disabled={false} 
                    loading={false}
                    variant="mobile"
                  />
                </div>
              </div>

              {/* 2. Country */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Country <span className="text-red-500">*</span>
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-country"
                    value={selectedCountry} 
                    onChange={handleCountrySelect} 
                    options={countries}
                    placeholder={common.select_country || "Select Country"} 
                    disabled={countries.length === 0} 
                    loading={false}
                    variant="mobile"
                  />
                </div>
              </div>

              {/* 3. Product Name */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-product"
                    value={selectedProduct} 
                    onChange={handleProductSelect} 
                    options={filteredProducts}
                    placeholder={common.select_product || "Select Product"} 
                    disabled={filteredProducts.length === 0} 
                    loading={false}
                    variant="mobile"
                  />
                </div>
              </div>

              {/* 4. Ship By */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Ship by <span className="text-red-500">*</span>
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-shipby"
                    value={selectedShipBy} 
                    onChange={handleShipBySelect} 
                    options={shippingContainers}
                    placeholder={!selectedProduct ? "Select Ship By" : containersLoading ? "Loading..." : shippingContainers.length === 0 ? "No containers" : "Select Ship By"}
                    disabled={!selectedProduct || containersLoading || shippingContainers.length === 0} 
                    loading={containersLoading}
                    variant="mobile"
                  />
                </div>
              </div>

              {/* 5. Incoterm */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Term <span className="text-red-500">*</span>
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-term"
                    value={selectedTerm} 
                    onChange={handleTermSelect} 
                    options={shippingTerms}
                    placeholder={common.select_incoterm || "Select Incoterm"} 
                    disabled={!selectedProduct || !selectedShipBy || shippingTerms.length === 0} 
                    loading={false}
                    variant="mobile"
                  />
                </div>
              </div>

              {/* 6. Port (POL) */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Port <span className="text-red-500">*</span>
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-port"
                    value={selectedPOL} 
                    onChange={handlePOLSelect} 
                    options={loadingPorts}
                    placeholder={!selectedTerm ? "Select Port" : polLoading ? "Loading..." : loadingPorts.length === 0 ? "No Port" : "Select Port"}
                    disabled={!selectedTerm || polLoading || loadingPorts.length === 0} 
                    loading={polLoading}
                    variant="mobile"
                  />
                </div>
              </div>

              {/* 7. Destination Port (POD) */}
              <div>
                <label className="block text-foreground font-semibold mb-1 text-sm">
                  Destination Port {isPodRequired && <span className="text-red-500">*</span>}
                </label>
                <div className="mobile-add-select">
                  <SearchableSelect 
                    id="modal-select-pod"
                    value={isPodRequired ? selectedPOD : ''} 
                    onChange={handlePODSelect} 
                    options={destinationPorts}
                    placeholder={!isPodRequired ? "Select Destination Port (N/A)" : !selectedPOL ? "Select Destination Port" : podLoading ? "Loading..." : destinationPorts.length === 0 ? "No Destination Port" : "Select Destination Port"}
                    disabled={!isPodRequired || !selectedPOL || podLoading || destinationPorts.length === 0} 
                    loading={podLoading}
                    variant="mobile"
                    customTriggerClass={
                      !isPodRequired && selectedTerm
                        ? "py-2.5 px-4 text-sm rounded-xl bg-muted border border-border text-muted-foreground font-medium select-none cursor-not-allowed opacity-60"
                        : undefined
                    }
                  />
                </div>
              </div>

              {/* Additional Product Info Notes */}
              {selectedProduct && (
                <div id="modal-add-product-note" className="mt-1 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-start gap-3">
                    <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
                    <div className="space-y-1 flex-1">
                      {fetchedPackingTitle && (
                        <div className="text-xs sm:text-sm">
                          <span className="font-semibold text-foreground/80">Packing Type: </span>
                          <span className="text-foreground/80">{fetchedPackingTitle}</span>
                        </div>
                      )}
                      <div className="text-xs sm:text-sm">
                        <span className="font-semibold text-foreground/80">Product Price: </span>
                        <span className="text-foreground/80">USD/PMT</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Mobile Sticky Add Button (Purane Wala) */}
          <div className="sm:hidden sticky bottom-0 left-0 w-full px-6 py-4 border-t border-border bg-background z-40 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isAddProductEnabled || isAdding}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                  isAddProductEnabled && !isAdding
                    ? 'bg-primary-gradient text-white shadow-brand-blue/20 hover:shadow-brand-blue/40' 
                    : 'bg-muted border border-border text-muted-foreground/60 cursor-not-allowed'
                }`}
              >
                {isAdding ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    Add to Watchlist
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Desktop Footer Button (Naya UI) */}
          <div className="hidden sm:block px-5 sm:px-6 py-4 border-t border-border shrink-0 bg-muted/20 sm:rounded-b-2xl">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isAddProductEnabled || isAdding}
              className={`w-full py-3.5 px-4 rounded-xl text-sm sm:text-base font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                isAddProductEnabled && !isAdding
                  ? 'bg-primary-gradient text-white shadow-brand-blue/20 hover:shadow-brand-blue/40' 
                  : 'bg-muted border border-border text-muted-foreground/60 cursor-not-allowed'
              }`}
            >
              {isAdding ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus"></i>
                  Add to Watchlist
                </>
              )}
            </button>
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

      {/* Action / KYC Indication Modal */}
      <ActionIndicationModal
        isOpen={actionIndication.isOpen}
        onClose={() => setActionIndication(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          setActionIndication(prev => ({ ...prev, isOpen: false }));
          router.push(`/${lang}/profile`);
        }}
        title="Action Required"
        description={actionIndication.message}
        indicationText={actionIndication.indication || 'Upgrade Plan'}
        type="warning"
      />
    </>,
    document.body
  );
}
