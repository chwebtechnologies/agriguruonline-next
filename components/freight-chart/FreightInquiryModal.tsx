'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scroll-lock';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { submitFreightInquiryAction } from '@/app/actions/freight';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export interface FreightInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  lang?: string;
  common?: any;
  shipBy?: string;
  portOfLoading?: string;
  portOfDestination?: string;
  freightRate?: number | string;
  loadCapacity?: number;
  loadUnit?: string;
  shippingContainerId?: string;
  loadingPortId?: string;
  destinationPortId?: string;
  shippingTerms?: any[];
  paymentTerms?: any[];
  products?: any[];
  linerTerms?: any[];
  favouriteFreightId?: string;
  initialMinPrice?: number;
  initialMaxPrice?: number;
}

// Default list of agricultural products for Freight Inquiries (API can override via props)
const DEFAULT_PRODUCTS = [
  { id: 'wheat', name: 'Wheat' },
  { id: 'yellow_corn', name: 'Yellow Corn (Maize)' },
  { id: 'basmati_rice', name: 'Basmati Rice' },
  { id: 'non_basmati_rice', name: 'Non-Basmati Rice' },
  { id: 'soybean_meal', name: 'Soybean Meal' },
  { id: 'raw_sugar', name: 'Raw Sugar' },
  { id: 'refined_sugar', name: 'Refined Sugar' },
  { id: 'chickpeas', name: 'Chickpeas / Garbanzo' },
  { id: 'barley', name: 'Barley' },
  { id: 'coffee_beans', name: 'Coffee Beans' },
  { id: 'palm_oil', name: 'Palm Oil' },
  { id: 'sorghum', name: 'Sorghum' },
  { id: 'pulses_lentils', name: 'Pulses & Lentils' }
];

// Standard liner terms for maritime shipping (API can override via props)
const DEFAULT_LINER_TERMS = [
  { id: 'FLT', name: 'FLT - Full Liner Terms (Hook / Hook)' },
  { id: 'FIO', name: 'FIO - Free In / Free Out' },
  { id: 'FILO', name: 'FILO - Free In / Liner Out' },
  { id: 'LIFO', name: 'LIFO - Liner In / Free Out' },
  { id: 'FIOS', name: 'FIOS - Free In / Out / Stowed' },
  { id: 'FIOST', name: 'FIOST - Free In / Out / Stowed / Trimmed' },
  { id: 'BT_BT', name: 'BT / BT - Berth Terms' }
];

// Standard shipping terms fallback
const DEFAULT_SHIPPING_TERMS = [
  { id: 'FOB', name: 'FOB - Free on Board' },
  { id: 'CNF', name: 'CNF / CFR - Cost and Freight' },
  { id: 'CIF', name: 'CIF - Cost, Insurance and Freight' },
  { id: 'EXW', name: 'EXW - Ex Works' },
  { id: 'FCA', name: 'FCA - Free Carrier' }
];

// Standard payment terms fallback
const DEFAULT_PAYMENT_TERMS = [
  { id: 'LC_AT_SIGHT', name: 'LC at Sight' },
  { id: 'TT_ADVANCE', name: 'TT Advance' },
  { id: 'DP', name: 'DP (Documents Against Payment)' },
  { id: 'DA', name: 'DA (Documents Against Acceptance)' },
  { id: 'CAD', name: 'CAD (Cash Against Documents)' }
];

// Module-level in-memory cache to prevent redundant fetches and network spam across modal toggles
let cachedProducts: any[] | null = null;
let cachedLinerTerms: any[] | null = null;
let cachedShippingTerms: any[] | null = null;
let cachedPaymentTerms: any[] | null = null;

const EMPTY_ARRAY: any[] = [];

export function FreightInquiryModal({
  isOpen,
  onClose,
  onSuccess,
  lang = 'en',
  common = {},
  shipBy = '',
  portOfLoading = '',
  portOfDestination = '',
  freightRate = '',
  loadCapacity = 26,
  loadUnit = 'MT',
  shippingContainerId = '',
  loadingPortId = '',
  destinationPortId = '',
  shippingTerms: initialShippingTerms = EMPTY_ARRAY,
  paymentTerms: initialPaymentTerms = EMPTY_ARRAY,
  products: initialProducts = EMPTY_ARRAY,
  linerTerms: initialLinerTerms = EMPTY_ARRAY,
  favouriteFreightId = '',
  initialMinPrice = undefined,
  initialMaxPrice = undefined
}: FreightInquiryModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycErrorMsg, setKycErrorMsg] = useState<string>('');
  const [autoOpenNext, setAutoOpenNext] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingLinerTerms, setIsLoadingLinerTerms] = useState(false);

  const hasFetchedProductsRef = React.useRef(false);
  const hasFetchedLinerTermsRef = React.useRef(false);
  const hasFetchedShippingTermsRef = React.useRef(false);
  const hasFetchedPaymentTermsRef = React.useRef(false);

  const hasInitialShippingTerms = Boolean(initialShippingTerms && initialShippingTerms.length > 0);
  const hasInitialPaymentTerms = Boolean(initialPaymentTerms && initialPaymentTerms.length > 0);
  const hasInitialProducts = Boolean(initialProducts && initialProducts.length > 0);
  const hasInitialLinerTerms = Boolean(initialLinerTerms && initialLinerTerms.length > 0);

  const isVesselOrBulk = Boolean(
    shipBy && /vessel|bulk|break/i.test(shipBy)
  );

  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  const [formData, setFormData] = useState({
    quantity: '',
    quantityUnit: isVesselOrBulk ? 'MT' : (loadUnit || 'MT'),
    shippingTerm: '',
    productName: '',
    linerTerm: '',
    paymentTerm: '',
    askingFreightRate: '',
    comments: ''
  });

  // When ShipBy is Vessel/Bulk, strictly enforce unit to MT
  useEffect(() => {
    if (isVesselOrBulk && formData.quantityUnit !== 'MT') {
      setFormData((prev) => ({ ...prev, quantityUnit: 'MT' }));
    }
  }, [isVesselOrBulk, formData.quantityUnit]);

  // Synchronize unit when modal opens or shipBy/loadUnit changes
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        quantityUnit: isVesselOrBulk ? 'MT' : (prev.quantityUnit || loadUnit || 'MT')
      }));
    }
  }, [isOpen, isVesselOrBulk, loadUnit]);

  const [minPrice, setMinPrice] = useState<number | null>(() => (initialMinPrice != null && !isNaN(Number(initialMinPrice)) ? Number(initialMinPrice) : null));
  const [maxPrice, setMaxPrice] = useState<number | null>(() => (initialMaxPrice != null && !isNaN(Number(initialMaxPrice)) ? Number(initialMaxPrice) : null));
  const [priceError, setPriceError] = useState<string>('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  useEffect(() => {
    if (initialMinPrice != null && !isNaN(Number(initialMinPrice))) setMinPrice(Number(initialMinPrice));
    if (initialMaxPrice != null && !isNaN(Number(initialMaxPrice))) setMaxPrice(Number(initialMaxPrice));
  }, [initialMinPrice, initialMaxPrice]);

  // Dynamic dropdown options with immediate session cache availability and instant fallbacks
  const [shippingTermOptions, setShippingTermOptions] = useState<any[]>(() => cachedShippingTerms || DEFAULT_SHIPPING_TERMS);
  const [paymentTermOptions, setPaymentTermOptions] = useState<any[]>(() => cachedPaymentTerms || DEFAULT_PAYMENT_TERMS);
  const [productOptions, setProductOptions] = useState<any[]>(() => cachedProducts || DEFAULT_PRODUCTS);
  const [linerTermOptions, setLinerTermOptions] = useState<any[]>(() => cachedLinerTerms || DEFAULT_LINER_TERMS);

  useScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Progressive Sequential Field Dependencies (Strict Step-by-Step Sequence)
  // 1-4 are auto read-only
  // 5. Quantity
  const isQuantityEnabled = true;
  // 6. Shipping Term
  const isShippingTermEnabled = isQuantityEnabled && !!formData.quantity && Number(formData.quantity) > 0 && !!formData.quantityUnit;
  // 7. Shipment Period
  const isShipmentPeriodEnabled = isShippingTermEnabled && !!formData.shippingTerm;
  // 8. Product Name
  const isProductNameEnabled = isShipmentPeriodEnabled && !!dateRange.start && !!dateRange.end;
  // 9. Liner Term
  const isLinerTermEnabled = isProductNameEnabled && !!formData.productName;
  // 10. Payment Term
  const isPaymentTermEnabled = isLinerTermEnabled && !!formData.linerTerm;
  // 11. Asking Freight Rate
  const isAskingRateEnabled = isPaymentTermEnabled && !!formData.paymentTerm;
  // 12. Additional Comment
  const isCommentsEnabled = isAskingRateEnabled && !!formData.askingFreightRate && Number(formData.askingFreightRate) > 0 && !priceError;

  // Real-time dynamic fetch of price limits when Asking Freight Rate activates (Step 11)
  useEffect(() => {
    if (!isOpen || !isAskingRateEnabled) return;

    let isMounted = true;
    setIsFetchingPrice(true);

    const query = new URLSearchParams({
      type: 'price',
      favourite_freight_id: String(favouriteFreightId || ''),
      shipping_container_id: String(shippingContainerId || ''),
      loading_port_id: String(loadingPortId || ''),
      destination_port_id: String(destinationPortId || ''),
      shipping_term_id: String(formData.shippingTerm || ''),
      liner_term_id: String(formData.linerTerm || ''),
      product_id: String(formData.productName || ''),
      lang: lang
    });

    fetch(`/api/freight-options?${query.toString()}`)
      .then((res) => res.json())
      .then((res) => {
        if (!isMounted) return;
        if (res && (res.success === 1 || res.success === true || res.data)) {
          const d = res.data || res;
          const min = d.min_price_bid !== undefined ? d.min_price_bid : (d.min_price !== undefined ? d.min_price : d.min_rate);
          const max = d.max_price_bid !== undefined ? d.max_price_bid : (d.max_price !== undefined ? d.max_price : d.max_rate);

          if (min !== undefined && min !== null && !isNaN(Number(min))) {
            setMinPrice(Number(min));
          }
          if (max !== undefined && max !== null && !isNaN(Number(max))) {
            setMaxPrice(Number(max));
          }

          if (formData.askingFreightRate) {
            const numVal = Number(formData.askingFreightRate);
            const effMin = min !== undefined && min !== null ? Number(min) : minPrice;
            const effMax = max !== undefined && max !== null ? Number(max) : maxPrice;
            if (effMin != null && effMax != null) {
              if (numVal < effMin || numVal > effMax) {
                setPriceError(`Price must be between $${effMin} and $${effMax}`);
              } else {
                setPriceError('');
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching freight price limits:', err);
      })
      .finally(() => {
        if (isMounted) setIsFetchingPrice(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    isAskingRateEnabled,
    favouriteFreightId,
    shippingContainerId,
    loadingPortId,
    destinationPortId,
    formData.shippingTerm,
    formData.linerTerm,
    formData.productName,
    lang
  ]);

  // Sync / fetch shipping terms ONLY when Shipping Term field activates (Step 6)
  useEffect(() => {
    if (!isOpen || !isShippingTermEnabled) return;

    if (hasInitialShippingTerms) {
      setShippingTermOptions(
        initialShippingTerms.map((t: any) => ({
          id: String(t.id || t.code || t.name),
          name: t.title || t.name || t.label || String(t.id)
        }))
      );
      return;
    }

    if (cachedShippingTerms && cachedShippingTerms.length > 0) {
      setShippingTermOptions(cachedShippingTerms);
      return;
    }

    if (hasFetchedShippingTermsRef.current) return;
    hasFetchedShippingTermsRef.current = true;

    fetch(`/api/freight-options?type=shipping-terms&lang=${lang}`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.success && res.data) {
          const list = res.data.shipping_term || res.data || [];
          if (Array.isArray(list) && list.length > 0) {
            const mapped = list.map((t: any) => ({
              id: String(t.id || t.code || t.name),
              name: t.title || t.name || t.label || String(t.id)
            }));
            cachedShippingTerms = mapped;
            setShippingTermOptions(mapped);
            return;
          }
        }
        cachedShippingTerms = DEFAULT_SHIPPING_TERMS;
        setShippingTermOptions(DEFAULT_SHIPPING_TERMS);
      })
      .catch(() => {
        cachedShippingTerms = DEFAULT_SHIPPING_TERMS;
        setShippingTermOptions(DEFAULT_SHIPPING_TERMS);
      });
  }, [isOpen, isShippingTermEnabled, hasInitialShippingTerms, lang]);

  // Sync / fetch payment terms ONLY when Payment Term field activates (Step 10)
  useEffect(() => {
    if (!isOpen || !isPaymentTermEnabled) return;

    if (hasInitialPaymentTerms) {
      setPaymentTermOptions(
        initialPaymentTerms.map((pt: any) => ({
          id: String(pt.id || pt.code || pt.name),
          name: pt.title || pt.name || pt.label || String(pt.id)
        }))
      );
      return;
    }

    if (cachedPaymentTerms && cachedPaymentTerms.length > 0) {
      setPaymentTermOptions(cachedPaymentTerms);
      return;
    }

    if (hasFetchedPaymentTermsRef.current) return;
    hasFetchedPaymentTermsRef.current = true;

    fetch(`/api/freight-options?type=payment-terms&lang=${lang}`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.success && res.data) {
          const list = res.data.payment_term || res.data || [];
          if (Array.isArray(list) && list.length > 0) {
            const mapped = list.map((pt: any) => ({
              id: String(pt.id || pt.code || pt.name),
              name: pt.title || pt.name || pt.label || String(pt.id)
            }));
            cachedPaymentTerms = mapped;
            setPaymentTermOptions(mapped);
            return;
          }
        }
        cachedPaymentTerms = DEFAULT_PAYMENT_TERMS;
        setPaymentTermOptions(DEFAULT_PAYMENT_TERMS);
      })
      .catch(() => {
        cachedPaymentTerms = DEFAULT_PAYMENT_TERMS;
        setPaymentTermOptions(DEFAULT_PAYMENT_TERMS);
      });
  }, [isOpen, isPaymentTermEnabled, hasInitialPaymentTerms, lang]);

  // Sync / fetch products ONLY when Product Name activates (Step 8: isProductNameEnabled)
  useEffect(() => {
    if (!isOpen || !isProductNameEnabled) return;

    if (hasInitialProducts) {
      setProductOptions(
        initialProducts.map((p: any) => ({
          id: String(p.id || p.name),
          name: p.name || p.title || p.product_name || String(p.id),
          country: p.country,
          flag: p.flag || p.country?.flag
        }))
      );
      return;
    }

    if (cachedProducts && cachedProducts.length > 0) {
      setProductOptions(cachedProducts);
      setIsLoadingProducts(false);
      return;
    }

    if (hasFetchedProductsRef.current) return;
    hasFetchedProductsRef.current = true;

    setIsLoadingProducts(true);
    const prodAbort = new AbortController();
    const prodTimer = setTimeout(() => prodAbort.abort(), 4000);

    fetch(`/api/freight-options?type=products&lang=${lang}`, { signal: prodAbort.signal })
      .then((res) => res.json())
      .then((res) => {
        clearTimeout(prodTimer);
        if (res && res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.products || []);
          if (Array.isArray(list) && list.length > 0) {
            const mapped = list.map((p: any) => ({
              id: String(p.id || p.name),
              name: p.name || p.title || p.product_name || String(p.id),
              country: p.country,
              flag: p.flag || p.country?.flag
            }));
            cachedProducts = mapped;
            setProductOptions(mapped);
            return;
          }
        }
        cachedProducts = DEFAULT_PRODUCTS;
        setProductOptions(DEFAULT_PRODUCTS);
      })
      .catch((err) => {
        clearTimeout(prodTimer);
        console.error('Error fetching freight products:', err);
        cachedProducts = DEFAULT_PRODUCTS;
        setProductOptions(DEFAULT_PRODUCTS);
      })
      .finally(() => {
        setIsLoadingProducts(false);
      });
  }, [isOpen, isProductNameEnabled, hasInitialProducts, lang]);

  // Sync / fetch liner terms ONLY when Liner Term activates (Step 9: isLinerTermEnabled)
  useEffect(() => {
    if (!isOpen || !isLinerTermEnabled) return;

    if (hasInitialLinerTerms) {
      setLinerTermOptions(
        initialLinerTerms.map((lt: any) => ({
          id: String(lt.id || lt.name),
          name: lt.title || lt.name || lt.description || String(lt.id)
        }))
      );
      return;
    }

    if (cachedLinerTerms && cachedLinerTerms.length > 0) {
      setLinerTermOptions(cachedLinerTerms);
      setIsLoadingLinerTerms(false);
      return;
    }

    if (hasFetchedLinerTermsRef.current) return;
    hasFetchedLinerTermsRef.current = true;

    setIsLoadingLinerTerms(true);
    const linerAbort = new AbortController();
    const linerTimer = setTimeout(() => linerAbort.abort(), 4000);

    fetch(`/api/freight-options?type=liner-terms&lang=${lang}`, { signal: linerAbort.signal })
      .then((res) => res.json())
      .then((res) => {
        clearTimeout(linerTimer);
        if (res && res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.liner_term || res.data?.liner_terms || []);
          if (Array.isArray(list) && list.length > 0) {
            const mapped = list.map((lt: any) => ({
              id: String(lt.id || lt.name),
              name: lt.title || lt.name || lt.description || String(lt.id)
            }));
            cachedLinerTerms = mapped;
            setLinerTermOptions(mapped);
            return;
          }
        }
        cachedLinerTerms = DEFAULT_LINER_TERMS;
        setLinerTermOptions(DEFAULT_LINER_TERMS);
      })
      .catch((err) => {
        clearTimeout(linerTimer);
        console.error('Error fetching freight liner terms:', err);
        cachedLinerTerms = DEFAULT_LINER_TERMS;
        setLinerTermOptions(DEFAULT_LINER_TERMS);
      })
      .finally(() => {
        setIsLoadingLinerTerms(false);
      });
  }, [isOpen, isLinerTermEnabled, hasInitialLinerTerms, lang]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) {
      setKycErrorMsg('');
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);


  // Input change handler with strict sequential reset and autoOpenNext
  const handleInputChange = (field: string, value: string) => {
    // If Vessel/Bulk cargo, quantityUnit is strictly locked to MT
    if (field === 'quantityUnit' && isVesselOrBulk) {
      return;
    }

    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === 'quantity' || field === 'quantityUnit') {
        if (!value || Number(next.quantity) <= 0) {
          next.shippingTerm = '';
          next.productName = '';
          next.linerTerm = '';
          next.paymentTerm = '';
          next.askingFreightRate = '';
          next.comments = '';
          setDateRange({ start: null, end: null });
          setAutoOpenNext(null);
        } else if (next.quantity && Number(next.quantity) > 0 && next.quantityUnit) {
          setAutoOpenNext('shippingTerm');
        }
      } else if (field === 'shippingTerm') {
        next.productName = '';
        next.linerTerm = '';
        next.paymentTerm = '';
        next.askingFreightRate = '';
        next.comments = '';
        setDateRange({ start: null, end: null });
        setAutoOpenNext(null);
      } else if (field === 'productName') {
        next.linerTerm = '';
        next.paymentTerm = '';
        next.askingFreightRate = '';
        next.comments = '';
        if (value) {
          setAutoOpenNext('linerTerm');
        } else {
          setAutoOpenNext(null);
        }
      } else if (field === 'linerTerm') {
        next.paymentTerm = '';
        next.askingFreightRate = '';
        next.comments = '';
        if (value) {
          setAutoOpenNext('paymentTerm');
        } else {
          setAutoOpenNext(null);
        }
      } else if (field === 'paymentTerm') {
        next.askingFreightRate = '';
        next.comments = '';
        setPriceError('');
        setAutoOpenNext(null);
      } else if (field === 'askingFreightRate') {
        if (!value || value.trim() === '') {
          setPriceError('');
          next.comments = '';
        } else {
          const numVal = Number(value);
          if (isNaN(numVal) || numVal <= 0) {
            setPriceError('Please enter a valid rate greater than 0');
            next.comments = '';
          } else if (minPrice !== null && maxPrice !== null) {
            if (numVal < minPrice || numVal > maxPrice) {
              setPriceError(`Price must be between $${minPrice} and $${maxPrice}`);
            } else {
              setPriceError('');
            }
          } else {
            setPriceError('');
          }
        }
        setAutoOpenNext(null);
      }

      return next;
    });
  };

  // Auto-select single option when enabled
  useEffect(() => {
    if (isShippingTermEnabled && shippingTermOptions.length === 1 && !formData.shippingTerm) {
      handleInputChange('shippingTerm', shippingTermOptions[0].id);
    }
  }, [isShippingTermEnabled, shippingTermOptions.length, formData.shippingTerm]);

  useEffect(() => {
    if (isPaymentTermEnabled && paymentTermOptions.length === 1 && !formData.paymentTerm) {
      handleInputChange('paymentTerm', paymentTermOptions[0].id);
    }
  }, [isPaymentTermEnabled, paymentTermOptions.length, formData.paymentTerm]);

  useEffect(() => {
    if (isLinerTermEnabled && linerTermOptions.length === 1 && !formData.linerTerm) {
      handleInputChange('linerTerm', linerTermOptions[0].id);
    }
  }, [isLinerTermEnabled, linerTermOptions.length, formData.linerTerm]);

  // Overall form validity check
  const isFormValid = Boolean(
    isCommentsEnabled &&
    !priceError &&
    formData.quantity &&
    Number(formData.quantity) > 0 &&
    formData.quantityUnit &&
    formData.shippingTerm &&
    dateRange.start &&
    dateRange.end &&
    formData.productName &&
    formData.linerTerm &&
    formData.paymentTerm &&
    formData.askingFreightRate &&
    Number(formData.askingFreightRate) > 0 &&
    (minPrice === null || maxPrice === null || (Number(formData.askingFreightRate) >= minPrice && Number(formData.askingFreightRate) <= maxPrice))
  );

  // Format freight rate display
  const formattedFreightRate = (() => {
    if (!freightRate) return '$0';
    const unitSuffix = isVesselOrBulk ? '/ PMT' : '/ FCL';
    const rateNum = Number(freightRate);
    if (!isNaN(rateNum)) {
      return `$${Math.round(rateNum)} ${unitSuffix}`;
    }
    const cleanRate = String(freightRate).startsWith('$') ? String(freightRate) : `$${freightRate}`;
    return `${cleanRate} ${unitSuffix}`;
  })();

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setKycErrorMsg('');

    try {
      const qtyNum = Number(formData.quantity);
      const capacity = Number(loadCapacity) > 0 ? Number(loadCapacity) : 26;
      const calculatedFcl = isVesselOrBulk
        ? Math.ceil(qtyNum / capacity)
        : (formData.quantityUnit === 'MT'
            ? Math.ceil(qtyNum / capacity)
            : qtyNum);
      const finalFcl = Math.max(1, Math.round(calculatedFcl) || 1);

      let shippingStartDateIso = '';
      if (dateRange.start) {
        const start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);
        shippingStartDateIso = start.toISOString();
      }

      let shippingEndDateIso = '';
      if (dateRange.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        shippingEndDateIso = end.toISOString();
      }

      // Prepare payload matching exact backend specification:
      // POST /freight-inquiry?lang_code=${lang}&source=web
      const payload: any = {
        destination_port_id: destinationPortId || undefined,
        loading_port_id: loadingPortId || undefined,
        shipping_container_id: shippingContainerId || undefined,
        freight: Number(freightRate) || 0,
        is_active: true,
        fcl: finalFcl,
        load_capacity: capacity,
        liner_term_id: formData.linerTerm,
        payment_term_id: formData.paymentTerm,
        shipping_term_id: formData.shippingTerm,
        product_id: formData.productName,
        price_bid: Number(formData.askingFreightRate),
        quantity: qtyNum,
        quantity_type: isVesselOrBulk ? 'MT' : (formData.quantityUnit || 'MT'),
        shipping_start_date: shippingStartDateIso,
        shipping_end_date: shippingEndDateIso,
        comment: formData.comments ? formData.comments.trim() : ''
      };

      let res: any = null;
      try {
        const submitRaw = await fetch(`/api/freight-options?type=submit-inquiry&lang=${lang}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        res = await submitRaw.json();
      } catch {
        res = await submitFreightInquiryAction(payload, lang);
      }

      if (res && (res.success === 1 || res.success === true)) {
        toast.success(res.message || 'Freight inquiry created successfully!');
        onSuccess?.();
        onClose();
        router.push(`/${lang}/my-inquiries?tab=freight`);
      } else {
        toast.error(res?.error || res?.message || 'Failed to submit freight inquiry.');
      }
    } catch (err: any) {
      console.error('Error submitting freight inquiry:', err);
      toast.error(err?.message || 'Failed to submit freight inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-[800px] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue shrink-0">
              <i className="fa-solid fa-ship"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground leading-none mb-1">
                Freight Inquiry
              </h3>
              <p className="text-muted-foreground text-sm leading-none">
                Submit your freight inquiry details below
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 pt-3 pb-5 sm:pb-6 overflow-y-auto custom-scrollbar flex-1">
          {kycErrorMsg && (
            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <div className="text-orange-500 mt-0.5 shrink-0">
                  <i className="fa-solid fa-triangle-exclamation text-lg"></i>
                </div>
                <p className="text-sm text-orange-800 dark:text-orange-200 font-medium leading-relaxed">
                  {kycErrorMsg}
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  router.push(`/${lang}/profile`);
                }}
                className="shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 w-full sm:w-auto"
              >
                Verify KYC
              </button>
            </div>
          )}

          {/* EXACT SEQUENCE FORM GRID (Fields 1 to 12) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            
            {/* 1. Ship By (Auto Read Only) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Ship By <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={shipBy || 'Container'}
                readOnly
                tabIndex={-1}
                className="w-full border border-brand-blue rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed bg-brand-blue text-white shadow-sm"
              />
            </div>

            {/* 2. Port of Loading (Auto Read Only) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Port of Loading <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={portOfLoading || 'Loading Port'}
                readOnly
                tabIndex={-1}
                className="w-full border border-brand-blue rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed bg-brand-blue text-white shadow-sm"
              />
            </div>

            {/* 3. Port of Destination (Auto Read Only) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Port of Destination <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={portOfDestination || 'Destination Port'}
                readOnly
                tabIndex={-1}
                className="w-full border border-brand-blue rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed bg-brand-blue text-white shadow-sm"
              />
            </div>

            {/* 4. Freight Rate (Auto Read Only) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Freight Rate ($) <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={formattedFreightRate}
                readOnly
                tabIndex={-1}
                className="w-full border border-brand-blue rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed bg-brand-blue text-white shadow-sm"
              />
            </div>

            {/* 5. Quantity (same like Product Inquirey/Offer popup mtfcl and number) */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-foreground">
                  Quantity <span className="text-red-500 ml-0.5">*</span>
                </label>
                {(() => {
                  if (isVesselOrBulk) return null;
                  if (!formData.quantity || isNaN(Number(formData.quantity)) || !formData.quantityUnit) return null;
                  const qty = Number(formData.quantity);
                  if (qty <= 0) return null;
                  const capacity = Number(loadCapacity) > 0 ? Number(loadCapacity) : 26;

                  const calculatedValue =
                    formData.quantityUnit === 'MT'
                      ? Math.ceil(qty / capacity) + ' FCL'
                      : Number((qty * capacity).toFixed(2)) + ' MT';

                  return (
                    <span className="text-[12px] text-brand-blue font-bold bg-brand-blue/10 px-2 py-0.5 rounded-md">
                      <i className="fa-solid fa-calculator mr-1"></i> ≈ {calculatedValue}
                    </span>
                  );
                })()}
              </div>
              <div className="flex w-full">
                <div className="w-[100px] shrink-0">
                  <SearchableSelect
                    value={isVesselOrBulk ? 'MT' : formData.quantityUnit}
                    onChange={(val) => handleInputChange('quantityUnit', val)}
                    options={
                      isVesselOrBulk
                        ? [{ id: 'MT', name: 'MT' }]
                        : [
                            { id: 'MT', name: 'MT' },
                            { id: 'FCL', name: 'FCL' }
                          ]
                    }
                    placeholder={common.unit || 'Unit'}
                    variant="mobile"
                    disabled={isVesselOrBulk}
                    customTriggerClass={`py-2.5 px-3 text-sm font-semibold rounded-l-xl border border-r-0 transition-colors ${
                      isVesselOrBulk
                        ? (formData.quantityUnit && formData.quantity
                            ? 'bg-brand-blue border-brand-blue text-white shadow-sm cursor-not-allowed select-none [&_.fa-chevron-right]:opacity-40 [&_.fa-chevron-right]:cursor-not-allowed'
                            : 'bg-muted/70 text-foreground border-border cursor-not-allowed select-none [&_.fa-chevron-right]:opacity-40 [&_.fa-chevron-right]:cursor-not-allowed')
                        : (formData.quantityUnit && formData.quantity
                            ? 'bg-brand-blue border-brand-blue text-white shadow-sm cursor-pointer'
                            : 'bg-card text-foreground border-border cursor-pointer')
                    }`}
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.quantity}
                  onKeyDown={(e) => {
                    if (e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (Number(val) < 0) return;
                    handleInputChange('quantity', val);
                  }}
                  className={`flex-1 min-w-0 border rounded-r-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue focus:z-10 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    formData.quantity
                      ? 'bg-brand-blue border-brand-blue text-white shadow-sm'
                      : 'bg-card text-foreground border-border'
                  }`}
                />
              </div>
            </div>

            {/* 6. Shipping Term (same like product inquirey/offer dropdown) */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isShippingTermEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Shipping Term <span className="text-red-500 ml-0.5">*</span>
              </label>
              <SearchableSelect
                value={formData.shippingTerm}
                onChange={(val) => handleInputChange('shippingTerm', val)}
                options={shippingTermOptions}
                placeholder={common.select_term || 'Select Term'}
                variant="mobile"
                disabled={!isShippingTermEnabled}
                autoOpen={autoOpenNext === 'shippingTerm' && shippingTermOptions.length > 1}
              />
            </div>

            {/* 7. Shipment Period (same like product inquirey offer daterange picker) */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isShipmentPeriodEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Shipment Period <span className="text-red-500 ml-0.5">*</span>
              </label>
              <DateRangePicker
                startDate={dateRange.start}
                endDate={dateRange.end}
                disabled={!isShipmentPeriodEnabled}
                onChange={(start, end) => {
                  setDateRange({ start, end });
                  setFormData((prev) => ({
                    ...prev,
                    productName: '',
                    linerTerm: '',
                    paymentTerm: '',
                    askingFreightRate: '',
                    comments: ''
                  }));
                  if (start && end) {
                    setAutoOpenNext('productName');
                  }
                }}
                placeholder={common.select_shipment_period || 'Select Shipment Period'}
              />
            </div>

            {/* 8. Product Name (API: /product?is_active=true&lang_code=...&source=web) */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isProductNameEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Product Name <span className="text-red-500 ml-0.5">*</span>
              </label>
              <SearchableSelect
                value={formData.productName}
                onChange={(val) => handleInputChange('productName', val)}
                options={productOptions}
                placeholder="Select Product"
                variant="mobile"
                loading={isLoadingProducts && productOptions.length === 0}
                disabled={!isProductNameEnabled}
                autoOpen={autoOpenNext === 'productName' && productOptions.length > 1}
              />
            </div>

            {/* 9. Liner Term (API: /liner-term?is_active=true&lang_code=...&source=web) */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isLinerTermEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Liner Term <span className="text-red-500 ml-0.5">*</span>
              </label>
              <SearchableSelect
                value={formData.linerTerm}
                onChange={(val) => handleInputChange('linerTerm', val)}
                options={linerTermOptions}
                placeholder="Select Liner Term"
                variant="mobile"
                loading={isLoadingLinerTerms && linerTermOptions.length === 0}
                disabled={!isLinerTermEnabled}
                autoOpen={autoOpenNext === 'linerTerm' && linerTermOptions.length > 1}
              />
            </div>

            {/* 10. Payment Term (same like product inquirey/offer dropdown) */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isPaymentTermEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Payment Term <span className="text-red-500 ml-0.5">*</span>
              </label>
              <SearchableSelect
                value={formData.paymentTerm}
                onChange={(val) => handleInputChange('paymentTerm', val)}
                options={paymentTermOptions}
                placeholder={common.select_payment_term || 'Select Payment Term'}
                variant="mobile"
                disabled={!isPaymentTermEnabled}
                autoOpen={autoOpenNext === 'paymentTerm' && paymentTermOptions.length > 1}
              />
            </div>

            {/* 11. Asking Freight Rate (Number input with price validation) */}
            <div className="space-y-1 md:col-span-2">
              <label className={`text-sm font-semibold ${!isAskingRateEnabled ? 'text-muted-foreground/60' : priceError ? 'text-red-500' : 'text-foreground'}`}>
                Asking Freight Rate ($) <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder={minPrice !== null && maxPrice !== null ? `Enter asking freight rate ($${minPrice} - $${maxPrice})` : "Enter asking freight rate ($)"}
                value={formData.askingFreightRate}
                disabled={!isAskingRateEnabled}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (Number(val) < 0) return;
                  handleInputChange('askingFreightRate', val);
                }}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/70 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  !isAskingRateEnabled
                    ? 'border-border opacity-60 cursor-not-allowed bg-muted text-muted-foreground'
                    : priceError
                    ? 'border-red-500 bg-red-500/10 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/50'
                    : formData.askingFreightRate
                    ? 'bg-brand-blue border-brand-blue text-white shadow-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'
                    : 'bg-card text-foreground border-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'
                }`}
              />
              {isFetchingPrice && (
                <p className="text-xs text-brand-blue mt-1">Fetching rate limits...</p>
              )}
              {priceError && (
                <p className="text-xs text-red-500 mt-1">{priceError}</p>
              )}
              {!priceError && minPrice !== null && maxPrice !== null && isAskingRateEnabled && (
                <p className="text-xs text-muted-foreground mt-1">Allowed range: ${minPrice} - ${maxPrice}</p>
              )}
            </div>

            {/* 12. Additional Comment like product/freight inquirey preprep */}
            <div className="space-y-1 md:col-span-2">
              <label className={`text-sm font-semibold ${isCommentsEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Additional Comment
              </label>
              <textarea
                placeholder={common.write_comments || 'Write your comments or specific requirements here...'}
                rows={3}
                value={formData.comments}
                disabled={!isCommentsEnabled}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 text-sm font-semibold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue resize-none transition-colors ${
                  !isCommentsEnabled
                    ? 'border-border opacity-60 cursor-not-allowed bg-muted text-muted-foreground'
                    : formData.comments
                    ? 'bg-brand-blue border-brand-blue text-white shadow-sm'
                    : 'bg-card text-foreground border-border'
                }`}
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-muted/20 shrink-0 flex gap-3 justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-[15px] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isFormValid || isSubmitting}
            onClick={handleSubmit}
            className={`px-8 py-2.5 rounded-xl text-white font-semibold text-[15px] shadow-sm relative overflow-hidden group focus:outline-none focus:ring-2 focus:ring-brand-blue/50 bg-gradient-to-r from-brand-blue to-brand-green ${
              !isFormValid || isSubmitting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:opacity-90 active:scale-[0.98] transition-all'
            }`}
          >
            <span className="relative z-10">
              {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
            </span>
            {isFormValid && !isSubmitting && (
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-button-shine" />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default FreightInquiryModal;
