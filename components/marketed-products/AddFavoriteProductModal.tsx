'use client';

import React, { useState, useEffect } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { fetchLoadingPorts, fetchDestinationPorts } from '@/app/actions/product';
import { addFavoriteProductAction } from '@/app/actions/charts';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export interface AddFavoriteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  countryName: string;
  productId?: string;
  categoryId?: string;
  countryId?: string;
  lang?: string;
  common?: any;
  shippingTerms?: any[];
  containers?: any[];
}

export function AddFavoriteProductModal({
  isOpen,
  onClose,
  productName,
  countryName,
  productId = '',
  categoryId = '',
  countryId = '',
  lang = 'en',
  common = {},
  shippingTerms = [],
  containers = [],
}: AddFavoriteProductModalProps) {
  const [formData, setFormData] = useState({
    shipBy: '',
    shippingTerm: '',
    portOfLoading: '',
    portOfDestination: ''
  });

  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycErrorMsg, setKycErrorMsg] = useState<string>('');
  const [autoOpenNext, setAutoOpenNext] = useState<string | null>(null);

  const [dynamicLoadingPorts, setDynamicLoadingPorts] = useState<any[]>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);

  const [dynamicDestinationPorts, setDynamicDestinationPorts] = useState<any[]>([]);
  const [isLoadingDestPorts, setIsLoadingDestPorts] = useState(false);

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
    if (!isOpen) {
      setKycErrorMsg('');
      setFormData({
        shipBy: '',
        shippingTerm: '',
        portOfLoading: '',
        portOfDestination: ''
      });
      return;
    }
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

  const shipByOptions = containers.length > 0 
    ? containers.map(c => ({ id: c.shipping_container?.id || c.id, name: c.shipping_container?.title || 'Unknown Container' }))
    : [
        { id: 'Sea', name: 'Sea' },
        { id: 'Air', name: 'Air' },
        { id: 'Land', name: 'Land' }
      ];

  const isShippingTermEnabled = !!formData.shipBy;
  const isPortOfLoadingEnabled = isShippingTermEnabled && !!formData.shippingTerm;
  const isPortOfDestEnabled = isPortOfLoadingEnabled && !!formData.portOfLoading && !isFobSelected;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'shipBy') {
        next.shippingTerm = ''; next.portOfLoading = ''; next.portOfDestination = '';
        setAutoOpenNext('shippingTerm');
      } else if (field === 'shippingTerm') {
        next.portOfLoading = ''; next.portOfDestination = '';
        setAutoOpenNext('portOfLoading');
      } else if (field === 'portOfLoading') {
        next.portOfDestination = '';
        const selectedTermObj = shippingTermOptions.find(t => t.id === next.shippingTerm);
        const fobSelected = selectedTermObj?.name?.toUpperCase() === 'FOB';
        setAutoOpenNext(fobSelected ? null : 'portOfDestination');
      } else if (field === 'portOfDestination') {
        setAutoOpenNext(null);
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

  const isFormValid = !!(
    formData.shipBy &&
    formData.shippingTerm &&
    formData.portOfLoading &&
    (isFobSelected ? true : formData.portOfDestination)
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setKycErrorMsg('');
    
    const payload: any = {
      category_id: categoryId,
      country_id: countryId,
      product_id: productId,
      shiping_container_id: formData.shipBy,
      shipping_term_id: formData.shippingTerm,
      loading_port_id: formData.portOfLoading
    };

    if (!isFobSelected && formData.portOfDestination) {
      payload.destination_port_id = formData.portOfDestination;
    }
    
    try {
      const res = await addFavoriteProductAction(payload, lang);
      if (res?.success) {
        toast.success("Product added to favorites successfully!");
        onClose();
        // Option to reload or mutate state
        router.refresh();
      } else {
        const errorMsg = res?.error || res?.message || "Failed to submit. Please try again.";
        toast.error(errorMsg);
        if (errorMsg.toLowerCase().includes('kyc') || errorMsg.toLowerCase().includes('limit')) {
          setKycErrorMsg(errorMsg);
        }
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
              <i className="fa-solid fa-star"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground leading-none mb-1">
                Add to Favorites
              </h3>
              <p className="text-muted-foreground text-sm leading-none">
                Add this product to your watchlist
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
                Verify KYC / Upgrade
              </button>
            </div>
          )}
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
                placeholder={common.select_container || "Select Container"}
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
                placeholder={common.select_term || "Select Term"}
                variant="mobile"
                disabled={!isShippingTermEnabled}
                autoOpen={autoOpenNext === 'shippingTerm' && shippingTermOptions.length > 1}
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
                autoOpen={autoOpenNext === 'portOfLoading' && dynamicLoadingPorts.length > 1}
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
                autoOpen={autoOpenNext === 'portOfDestination' && dynamicDestinationPorts.length > 1}
                customTriggerClass={
                  isFobSelected
                    ? (isPortOfLoadingEnabled && !!formData.portOfLoading)
                        ? "py-2.5 px-4 text-sm rounded-xl bg-brand-blue border border-brand-blue text-white font-semibold select-none cursor-not-allowed shadow-sm"
                        : "py-2.5 px-4 text-sm rounded-xl bg-muted border border-border text-muted-foreground font-medium select-none cursor-not-allowed opacity-60"
                    : undefined
                }
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-border shrink-0 bg-muted/20">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-3.5 px-4 rounded-xl text-sm sm:text-base font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              isFormValid && !isSubmitting
                ? 'bg-primary-gradient text-white shadow-brand-blue/20 hover:shadow-brand-blue/40' 
                : 'bg-muted border border-border text-muted-foreground/60 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                Processing...
              </>
            ) : (
              <>
                <i className="fa-solid fa-plus"></i>
                Add Product
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
