'use client';

import React, { useState, useEffect } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { fetchLoadingPorts, fetchDestinationPorts, fetchTradingPrice, submitTradingInquiry } from '@/app/actions/product';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ProductInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  countryName: string;
  price: number | string;
  productId?: string;
  lang?: string;
  shippingTerms?: any[];
  packingTypes?: any[];
  containers?: any[];
  paymentTerms?: any[];
  actionType?: 'buy' | 'sell';
}

export function ProductInquiryModal({
  isOpen,
  onClose,
  productName,
  countryName,
  price,
  productId = '',
  lang = 'en',
  shippingTerms = [],
  packingTypes = [],
  containers = [],
  paymentTerms = [],
  actionType = 'buy'
}: ProductInquiryModalProps) {
  const [formData, setFormData] = useState({
    shipBy: '',
    shippingTerm: '',
    portOfLoading: '',
    portOfDestination: '',
    packingType: '',
    quantity: '',
    quantityUnit: 'MT',
    paymentTerm: '',
    offerPrice: '',
    comments: ''
  });

  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });

  const [dynamicLoadingPorts, setDynamicLoadingPorts] = useState<any[]>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);

  const [dynamicDestinationPorts, setDynamicDestinationPorts] = useState<any[]>([]);
  const [isLoadingDestPorts, setIsLoadingDestPorts] = useState(false);

  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | string>('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');

  const shippingTermOptions = shippingTerms.length > 0 
    ? shippingTerms.map(t => ({ id: t.id, name: t.title || t.name }))
    : [
        { id: 'FOB', name: 'FOB' },
        { id: 'CNF', name: 'CNF' },
        { id: 'CIF', name: 'CIF' }
      ];

  const selectedShippingTermObj = shippingTermOptions.find(t => t.id === formData.shippingTerm);
  const isFobSelected = selectedShippingTermObj?.name?.toUpperCase() === 'FOB';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const fetchPorts = async () => {
      if (formData.shipBy && formData.shippingTerm && productId && lang) {
        setIsLoadingPorts(true);
        try {
          // formData.shippingTerm is the ID, but wait, the dropdown uses ID as the value.
          // Wait, earlier the shipping options had id: 'FOB', name: 'FOB'. 
          // But now they have the actual ID from API.
          const res = await fetchLoadingPorts(productId, formData.shipBy, formData.shippingTerm, lang);
          if (res && res.success && res.data?.loading_port) {
            setDynamicLoadingPorts(res.data.loading_port);
          } else {
            setDynamicLoadingPorts([]);
          }
        } catch (error) {
          console.error(error);
          setDynamicLoadingPorts([]);
        } finally {
          setIsLoadingPorts(false);
        }
      } else {
        setDynamicLoadingPorts([]);
      }
    };
    fetchPorts();
  }, [formData.shipBy, formData.shippingTerm, productId, lang]);

  useEffect(() => {
    const fetchDestPorts = async () => {
      const selectedShippingTermObj = shippingTerms.find(t => t.id === formData.shippingTerm);
      const fob = selectedShippingTermObj?.title?.toUpperCase() === 'FOB' || selectedShippingTermObj?.name?.toUpperCase() === 'FOB';
      
      if (!fob && formData.shipBy && formData.portOfLoading && productId && lang) {
        setIsLoadingDestPorts(true);
        try {
          const res = await fetchDestinationPorts(productId, formData.shipBy, formData.portOfLoading, lang);
          if (res && res.success && res.data?.destination_ports) {
            setDynamicDestinationPorts(res.data.destination_ports);
          } else {
            setDynamicDestinationPorts([]);
          }
        } catch (error) {
          console.error(error);
          setDynamicDestinationPorts([]);
        } finally {
          setIsLoadingDestPorts(false);
        }
      } else {
        setDynamicDestinationPorts([]);
      }
    };
    fetchDestPorts();
  }, [formData.shipBy, formData.shippingTerm, formData.portOfLoading, productId, lang, shippingTerms]);

  useEffect(() => {
    const getPriceRange = async () => {
      const destPortId = isFobSelected ? 'N/A' : formData.portOfDestination;
      if (
        formData.shipBy &&
        formData.shippingTerm &&
        formData.portOfLoading &&
        (isFobSelected || destPortId) &&
        productId
      ) {
        setIsFetchingPrice(true);
        try {
          const res = await fetchTradingPrice({
            shipping_container_id: formData.shipBy,
            type: actionType === 'sell' ? 'SELLER' : 'BUYER',
            product_id: productId,
            shipping_term_id: formData.shippingTerm,
            loading_port_id: formData.portOfLoading,
            destination_port_id: destPortId === 'N/A' ? '' : destPortId,
            packing_type_id: formData.packingType,
            lang_code: lang
          });

          if (res && res.success && res.data) {
            const min = res.data.min_price_bid !== undefined ? res.data.min_price_bid : res.data.min_price;
            const max = res.data.max_price_bid !== undefined ? res.data.max_price_bid : res.data.max_price;
            const fetchedPrice = res.data.price;
            
            setMinPrice(min ?? null);
            setMaxPrice(max ?? null);
            if (fetchedPrice) {
              setCurrentPrice(fetchedPrice);
            }
            
            if (formData.offerPrice) {
              const numVal = Number(formData.offerPrice);
              if (min != null && max != null) {
                if (numVal < min || numVal > max) {
                  setPriceError(`Price must be between $${min} and $${max}`);
                } else {
                  setPriceError('');
                }
              }
            }
          } else {
            setMinPrice(null);
            setMaxPrice(null);
          }
        } catch (error) {
          console.error('Failed to fetch trading price', error);
        } finally {
          setIsFetchingPrice(false);
        }
      } else {
        setMinPrice(null);
        setMaxPrice(null);
        setPriceError('');
      }
    };
    
    getPriceRange();
  }, [
    formData.shipBy, 
    formData.shippingTerm, 
    formData.portOfLoading, 
    formData.portOfDestination, 
    formData.packingType, 
    isFobSelected, 
    productId, 
    actionType, 
    lang
  ]);

  const shipByOptions = containers.length > 0 
    ? containers.map(c => ({ id: c.shipping_container?.id || c.id, name: c.shipping_container?.title || 'Unknown Container' }))
    : [
        { id: 'Sea', name: 'Sea' },
        { id: 'Air', name: 'Air' },
        { id: 'Land', name: 'Land' }
      ];


  const paymentTermOptions = paymentTerms.length > 0
    ? paymentTerms.map(pt => ({ id: pt.id, name: pt.title }))
    : [
        { id: 'LC_AT_SIGHT', name: 'LC at Sight' },
        { id: 'TT_ADVANCE', name: 'TT Advance' },
        { id: 'DP', name: 'DP' }
      ];

  const isShippingTermEnabled = !!formData.shipBy;
  const isPortOfLoadingEnabled = isShippingTermEnabled && !!formData.shippingTerm;


  const isPortOfDestEnabled = isPortOfLoadingEnabled && !!formData.portOfLoading && !isFobSelected;
  const isPackingTypeEnabled = isFobSelected 
    ? isPortOfLoadingEnabled && !!formData.portOfLoading
    : isPortOfDestEnabled && !!formData.portOfDestination;
  const isShipmentPeriodEnabled = isPackingTypeEnabled && !!formData.packingType;
  const isQuantityEnabled = isShipmentPeriodEnabled && !!dateRange.start && !!dateRange.end;
  const isPaymentTermEnabled = isQuantityEnabled && !!formData.quantity;
  const isOfferPriceEnabled = isPaymentTermEnabled && !!formData.paymentTerm;
  const isCommentsEnabled = isOfferPriceEnabled && !!formData.offerPrice;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'shipBy') {
        next.shippingTerm = ''; next.portOfLoading = ''; next.portOfDestination = ''; next.packingType = ''; next.quantity = ''; next.paymentTerm = ''; next.offerPrice = ''; next.comments = '';
      } else if (field === 'shippingTerm') {
        next.portOfLoading = ''; next.portOfDestination = ''; next.packingType = ''; next.quantity = ''; next.paymentTerm = ''; next.offerPrice = ''; next.comments = '';
      } else if (field === 'portOfLoading') {
        next.portOfDestination = ''; next.packingType = ''; next.quantity = ''; next.paymentTerm = ''; next.offerPrice = ''; next.comments = '';
      } else if (field === 'portOfDestination') {
        next.packingType = ''; next.quantity = ''; next.paymentTerm = ''; next.offerPrice = ''; next.comments = '';
      } else if (field === 'packingType') {
        next.quantity = ''; next.paymentTerm = ''; next.offerPrice = ''; next.comments = '';
      } else if (field === 'quantity') {
        next.paymentTerm = ''; next.offerPrice = ''; next.comments = '';
      } else if (field === 'paymentTerm') {
        next.offerPrice = ''; next.comments = '';
      } else if (field === 'offerPrice') {
        next.comments = '';
      }
      return next;
    });
  };

  useEffect(() => {
    if (shipByOptions.length === 1 && !formData.shipBy) {
      handleInputChange('shipBy', shipByOptions[0].id);
    }
  }, [shipByOptions.length, formData.shipBy]);

  useEffect(() => {
    if (isShippingTermEnabled && shippingTermOptions.length === 1 && !formData.shippingTerm) {
      handleInputChange('shippingTerm', shippingTermOptions[0].id);
    }
  }, [isShippingTermEnabled, shippingTermOptions.length, formData.shippingTerm]);

  useEffect(() => {
    if (isPortOfLoadingEnabled && dynamicLoadingPorts.length === 1 && !formData.portOfLoading && !isLoadingPorts) {
      handleInputChange('portOfLoading', dynamicLoadingPorts[0].id);
    }
  }, [isPortOfLoadingEnabled, dynamicLoadingPorts.length, formData.portOfLoading, isLoadingPorts]);

  useEffect(() => {
    if (isPortOfDestEnabled && dynamicDestinationPorts.length === 1 && !formData.portOfDestination && !isLoadingDestPorts) {
      handleInputChange('portOfDestination', dynamicDestinationPorts[0].id);
    }
  }, [isPortOfDestEnabled, dynamicDestinationPorts.length, formData.portOfDestination, isLoadingDestPorts]);

  useEffect(() => {
    if (isPackingTypeEnabled && packingTypes.length === 1 && !formData.packingType) {
      handleInputChange('packingType', packingTypes[0].id);
    }
  }, [isPackingTypeEnabled, packingTypes.length, formData.packingType]);

  useEffect(() => {
    if (isPaymentTermEnabled && paymentTermOptions.length === 1 && !formData.paymentTerm) {
      handleInputChange('paymentTerm', paymentTermOptions[0].id);
    }
  }, [isPaymentTermEnabled, paymentTermOptions.length, formData.paymentTerm]);

  const isFormValid = !!(
    formData.shipBy &&
    formData.shippingTerm &&
    formData.portOfLoading &&
    (isFobSelected ? true : formData.portOfDestination) &&
    formData.packingType &&
    dateRange.start &&
    dateRange.end &&
    formData.quantity &&
    formData.quantityUnit &&
    formData.paymentTerm &&
    formData.offerPrice &&
    !priceError &&
    !isFetchingPrice
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let finalFcl = 0;
    let unitId = "";
    
    if (formData.quantity && !isNaN(Number(formData.quantity))) {
      const qty = Number(formData.quantity);
      const selectedContainer = containers.find(c => String(c.shipping_container?.id || c.id) === String(formData.shipBy));
      
      if (selectedContainer) {
        if (selectedContainer.unit?.id) {
          unitId = selectedContainer.unit.id;
        }
        
        const capacityVal = selectedContainer.loading_capacity || selectedContainer.capacity || selectedContainer.shipping_container?.loading_capacity || selectedContainer.shipping_container?.capacity;
        const capacity = parseFloat(String(capacityVal));
        
        if (formData.quantityUnit === 'FCL') {
          finalFcl = qty;
        } else if (!isNaN(capacity) && capacity > 0) {
          finalFcl = Math.ceil(qty / capacity);
        }
      }
    }

    const payload = {
      type: actionType === 'sell' ? 'SELLER' : 'BUYER',
      product_id: productId,
      description: formData.comments,
      fcl: finalFcl || undefined, 
      fob_price: isFobSelected ? formData.offerPrice : "", 
      loading_port_id: formData.portOfLoading,
      packing_type_id: formData.packingType,
      payment_term_id: formData.paymentTerm,
      price_bid: Number(formData.offerPrice),
      quantity: Number(formData.quantity),
      quantity_type: formData.quantityUnit,
      shipment_end_date: dateRange.end ? formatDate(dateRange.end) : "",
      shipment_start_date: dateRange.start ? formatDate(dateRange.start) : "",
      shipping_container_id: formData.shipBy,
      shipping_term_id: formData.shippingTerm,
      destination_port_id: isFobSelected ? undefined : formData.portOfDestination,
      unit_id: unitId,
      lang_code: lang
    };
    
    try {
      const res = await submitTradingInquiry(payload);
      if (res?.success) {
        toast.success(actionType === 'sell' ? "Offer submitted successfully!" : "Inquiry submitted successfully!");
        onClose();
        router.push(`/${lang}/${actionType === 'sell' ? 'my-offers' : 'my-inquiries'}`);
      } else {
        toast.error(res?.message || "Failed to submit. Please try again.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card rounded-2xl w-full max-w-[800px] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue shrink-0">
              <i className="fa-solid fa-paper-plane"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground leading-none mb-1">
                {actionType === 'sell' ? 'Product Offer' : 'Product Inquiry'}
              </h3>
              <p className="text-muted-foreground text-sm leading-none">
                Submit your {actionType === 'sell' ? 'offer' : 'inquiry'} details below
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center transition-colors shrink-0"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 pt-3 pb-5 sm:pb-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            
            {/* 1. Product Name */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">Product Name <span className="text-red-500 ml-0.5">*</span></label>
              <input 
                type="text" 
                value={productName} 
                readOnly 
                tabIndex={-1}
                className="w-full border border-brand-blue rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed bg-brand-blue text-white shadow-sm"
              />
            </div>
            
            {/* 2. Country */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">Country <span className="text-red-500 ml-0.5">*</span></label>
              <input 
                type="text" 
                value={countryName} 
                readOnly 
                tabIndex={-1}
                className="w-full border border-brand-blue rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed bg-brand-blue text-white shadow-sm"
              />
            </div>
            
            {/* 3. Ship By */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">Ship By <span className="text-red-500 ml-0.5">*</span></label>
              <SearchableSelect 
                value={formData.shipBy}
                onChange={(val) => handleInputChange('shipBy', val)}
                options={shipByOptions}
                placeholder="Select Container"
                variant="mobile"
              />
            </div>
            
            {/* 4. Shipping Term */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isShippingTermEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Shipping Term <span className="text-red-500 ml-0.5">*</span></label>
              <SearchableSelect 
                value={formData.shippingTerm}
                onChange={(val) => handleInputChange('shippingTerm', val)}
                options={shippingTermOptions}
                placeholder="Select Term"
                variant="mobile"
                disabled={!isShippingTermEnabled}
              />
            </div>

            {/* 5. Port of Loading */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isPortOfLoadingEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Port of Loading <span className="text-red-500 ml-0.5">*</span></label>
              <SearchableSelect 
                value={formData.portOfLoading}
                onChange={(val) => handleInputChange('portOfLoading', val)}
                options={dynamicLoadingPorts.length > 0 ? dynamicLoadingPorts.map((p: any) => ({ id: p.id, name: p.name })) : []}
                placeholder={isLoadingPorts ? "Loading..." : (dynamicLoadingPorts.length > 0 ? "Select Port" : "No ports available")}
                variant="mobile"
                disabled={!isPortOfLoadingEnabled || isLoadingPorts}
              />
            </div>
            
            {/* 6. Port of Destination */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isFobSelected || isPortOfDestEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Port of Destination <span className="text-red-500 ml-0.5">*</span></label>
              <SearchableSelect 
                value={isFobSelected ? 'N/A' : formData.portOfDestination}
                onChange={(val) => handleInputChange('portOfDestination', val)}
                options={isFobSelected ? [{ id: 'N/A', name: 'Not Applicable (FOB)' }] : (dynamicDestinationPorts.length > 0 ? dynamicDestinationPorts.map((p: any) => ({ id: p.id, name: p.name })) : [])}
                placeholder={isFobSelected ? "Not Applicable (FOB)" : isLoadingDestPorts ? "Loading..." : (dynamicDestinationPorts.length > 0 ? "Select Port" : "No ports available")}
                variant="mobile"
                disabled={isFobSelected || !isPortOfDestEnabled || isLoadingDestPorts}
                customTriggerClass={
                  isFobSelected
                    ? (isPortOfLoadingEnabled && !!formData.portOfLoading)
                        ? "py-2.5 px-4 text-sm rounded-xl bg-brand-blue border border-brand-blue text-white font-semibold select-none cursor-not-allowed shadow-sm"
                        : "py-2.5 px-4 text-sm rounded-xl bg-muted border border-border text-muted-foreground font-medium select-none cursor-not-allowed opacity-60"
                    : undefined
                }
              />
            </div>

            {/* 7. Price ($) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">Price ($) <span className="text-red-500 ml-0.5">*</span></label>
              <input 
                type="text" 
                value={currentPrice ? `$${Math.round(Number(currentPrice))}/PMT${selectedShippingTermObj?.name ? ` - ${selectedShippingTermObj.name}` : ''}` : '$0'} 
                readOnly 
                tabIndex={-1}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed shadow-sm transition-colors ${
                  isPackingTypeEnabled 
                    ? 'border-brand-blue bg-brand-blue text-white' 
                    : 'bg-muted border-border text-muted-foreground opacity-60'
                }`}
              />
            </div>

            {/* 8. Packing Type */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isPackingTypeEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Packing Type <span className="text-red-500 ml-0.5">*</span></label>
              <SearchableSelect 
                value={formData.packingType}
                onChange={(val) => handleInputChange('packingType', val)}
                options={packingTypes.length ? packingTypes.map((p: any) => ({ id: p.id, name: p.title || p.name })) : [{ id: '1', name: 'Bags' }]}
                placeholder="Select Packing"
                variant="mobile"
                disabled={!isPackingTypeEnabled}
              />
            </div>
            
            {/* 9. Shipment Period */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isShipmentPeriodEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Shipment Period <span className="text-red-500 ml-0.5">*</span></label>
              <DateRangePicker 
                startDate={dateRange.start}
                endDate={dateRange.end}
                onChange={(start, end) => {
                  setDateRange({ start, end });
                  setFormData(prev => ({ ...prev, quantity: '', paymentTerm: '', offerPrice: '', comments: '' }));
                }}
                placeholder="Select Shipment Period"
                disabled={!isShipmentPeriodEnabled}
              />
            </div>

            {/* 10. Quantity */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className={`text-sm font-semibold ${isQuantityEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Quantity <span className="text-red-500 ml-0.5">*</span></label>
                {(() => {
                  if (!formData.quantity || isNaN(Number(formData.quantity))) return null;
                  const qty = Number(formData.quantity);
                  if (qty <= 0) return null;
                  const selectedContainer = containers.find(c => String(c.shipping_container?.id || c.id) === String(formData.shipBy));
                  if (!selectedContainer) return null;
                  const capacityVal = selectedContainer.loading_capacity || selectedContainer.capacity || selectedContainer.shipping_container?.loading_capacity || selectedContainer.shipping_container?.capacity;
                  if (!capacityVal) return null;
                  const capacity = parseFloat(String(capacityVal));
                  if (isNaN(capacity) || capacity <= 0) return null;
                  
                  const calculatedValue = formData.quantityUnit === 'MT' 
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
                    value={formData.quantityUnit}
                    onChange={(val) => handleInputChange('quantityUnit', val)}
                    options={[
                      { id: 'MT', name: 'MT' },
                      { id: 'FCL', name: 'FCL' }
                    ]}
                    placeholder="Unit"
                    variant="mobile"
                    disabled={!isQuantityEnabled}
                    customTriggerClass={`py-2.5 px-3 text-sm font-semibold rounded-l-xl border border-r-0 ${!isQuantityEnabled ? 'border-border opacity-60 cursor-not-allowed bg-muted text-muted-foreground' : formData.quantityUnit && formData.quantity ? 'bg-brand-blue border-brand-blue text-white shadow-sm' : 'bg-card text-foreground border-border'}`}
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
                  disabled={!isQuantityEnabled}
                  className={`flex-1 min-w-0 border rounded-r-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue focus:z-10 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!isQuantityEnabled ? 'border-border opacity-60 cursor-not-allowed bg-muted text-muted-foreground' : formData.quantity ? 'bg-brand-blue border-brand-blue text-white shadow-sm' : 'bg-card text-foreground border-border'}`}
                />
              </div>
            </div>

            {/* 11. Payment Term */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${isPaymentTermEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Payment Term <span className="text-red-500 ml-0.5">*</span></label>
              <SearchableSelect 
                value={formData.paymentTerm}
                onChange={(val) => handleInputChange('paymentTerm', val)}
                options={paymentTermOptions}
                placeholder="Select Payment Term"
                variant="mobile"
                disabled={!isPaymentTermEnabled}
              />
            </div>

            {/* 12. Offer Price / Asking Price ($) */}
            <div className="space-y-1">
              <label className={`text-sm font-semibold ${!isOfferPriceEnabled ? 'text-muted-foreground/60' : priceError ? 'text-red-500' : 'text-foreground'}`}>
                {actionType === 'sell' ? 'Offer Price ($)' : 'Asking Price ($)'} <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input 
                type="number" 
                min="0"
                placeholder="0"
                value={formData.offerPrice}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (Number(val) < 0) return;
                  handleInputChange('offerPrice', val);
                  if (val && minPrice !== null && maxPrice !== null) {
                    const numVal = Number(val);
                    if (numVal < minPrice || numVal > maxPrice) {
                      setPriceError(`Price must be between $${minPrice} and $${maxPrice}`);
                    } else {
                      setPriceError('');
                    }
                  } else {
                    setPriceError('');
                  }
                }}
                disabled={!isOfferPriceEnabled}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/70 focus:outline-none transition-colors ${!isOfferPriceEnabled ? 'border-border opacity-60 cursor-not-allowed bg-muted text-muted-foreground' : priceError ? 'border-red-500 bg-red-500/10 text-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/50' : formData.offerPrice ? 'bg-brand-blue border-brand-blue text-white shadow-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue' : 'bg-card text-foreground border-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'}`}
              />
              {isFetchingPrice && (
                <p className="text-xs text-brand-blue mt-1">Fetching price limits...</p>
              )}
              {priceError && (
                <p className="text-xs text-red-500 mt-1">{priceError}</p>
              )}
              {!priceError && minPrice !== null && maxPrice !== null && isOfferPriceEnabled && (
                <p className="text-xs text-muted-foreground mt-1">Allowed range: ${minPrice} - ${maxPrice}</p>
              )}
            </div>

            {/* 13. Additional Comment */}
            <div className="space-y-1 md:col-span-2">
              <label className={`text-sm font-semibold ${isCommentsEnabled ? 'text-foreground' : 'text-muted-foreground/60'}`}>Additional Comment</label>
              <textarea 
                placeholder="Write your comments or specific requirements here..."
                rows={3}
                value={formData.comments}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                disabled={!isCommentsEnabled}
                className={`w-full border rounded-xl px-4 py-3 text-sm font-semibold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue resize-none transition-colors ${!isCommentsEnabled ? 'border-border opacity-60 cursor-not-allowed bg-muted text-muted-foreground' : formData.comments ? 'bg-brand-blue border-brand-blue text-white shadow-sm' : 'bg-card text-foreground border-border'}`}
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
              (!isFormValid || isSubmitting) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98] transition-all'
            }`}
          >
            <span className="relative z-10">
              {isSubmitting ? 'Submitting...' : actionType === 'sell' ? 'Submit Offer' : 'Submit Inquiry'}
            </span>
            {(isFormValid && !isSubmitting) && (
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-button-shine" />
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ProductInquiryModal;
