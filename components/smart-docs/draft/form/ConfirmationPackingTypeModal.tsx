'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { handleFormFocusScroll } from '@/components/smart-docs/form-scroll-utils';

export interface ConfirmationPackingTypeData {
  id?: string;
  title?: string;
  quantity?: string | number;
  unit_type?: string;
  conversion_factor?: string | number;
}

export interface ConfirmationPackingTypeModalProps {
  isOpen: boolean;
  productId: string;
  initialData?: ConfirmationPackingTypeData | null;
  mode: 'add' | 'edit';
  onClose: () => void;
  onSuccess: (savedData: any, title: string, fullData?: any) => void;
  onSaveAction: (payload: {
    product_id: string;
    title: string;
    quantity: number;
    unit_type: string;
    conversion_factor?: number;
    id?: string;
  }) => Promise<{ success: boolean; message?: string; data?: any }>;
  dict?: any;
}

export default function ConfirmationPackingTypeModal({
  isOpen,
  productId,
  initialData,
  mode,
  onClose,
  onSuccess,
  onSaveAction,
  dict,
}: ConfirmationPackingTypeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitType, setUnitType] = useState<'solid' | 'liquid'>('solid');
  const [density, setDensity] = useState('');
  const [netWt, setNetWt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync form when initialData or modal open state changes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setQuantity('');
      setUnitType('solid');
      setDensity('');
      setNetWt('');
      setErrors({});
      setIsSaving(false);
      return;
    }

    if (initialData) {
      const uType = String(initialData.unit_type || 'solid').toLowerCase() === 'liquid' ? 'liquid' : 'solid';
      const qty = String(initialData.quantity ?? '');
      const cf = String(initialData.conversion_factor ?? '');
      setTitle(String(initialData.title ?? ''));
      setQuantity(qty);
      setUnitType(uType);
      if (uType === 'liquid') {
        setDensity(cf);
        const calculatedNet = (Number(qty) || 0) * (Number(cf) || 0);
        setNetWt(calculatedNet > 0 ? String(calculatedNet) : '');
      } else {
        setDensity('');
        setNetWt('');
      }
    } else {
      setTitle('');
      setQuantity('');
      setUnitType('solid');
      setDensity('');
      setNetWt('');
    }
    setErrors({});

    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  }, [isOpen, initialData]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const prevBody = document.body.style.overflow;
      const prevHtml = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBody;
        document.documentElement.style.overflow = prevHtml;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleUnitTypeChange = (newType: 'solid' | 'liquid') => {
    setUnitType(newType);
    if (newType === 'solid') {
      setDensity('');
      setNetWt('');
    } else {
      const q = Number(quantity) || 0;
      const d = Number(density) || 1;
      setNetWt(q * d > 0 ? String(q * d) : '');
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.unitType;
      return next;
    });
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    if (unitType === 'liquid') {
      const q = Number(val) || 0;
      const d = Number(density) || 0;
      setNetWt(q * d > 0 ? String(q * d) : '');
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.quantity;
      return next;
    });
  };

  const handleDensityChange = (val: string) => {
    setDensity(val);
    const q = Number(quantity) || 0;
    const d = Number(val) || 0;
    setNetWt(q * d > 0 ? String(q * d) : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      newErrors.title = 'Packing title is required';
    }

    const numQty = Number(quantity);
    if (!quantity || isNaN(numQty) || numQty <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (!unitType) {
      newErrors.unitType = 'Unit type is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!productId) {
      toast.error('Select a product before adding a packing type');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        product_id: productId,
        title: trimmedTitle,
        quantity: numQty,
        unit_type: unitType.toUpperCase(),
        conversion_factor: unitType === 'solid' ? 1 : Number(density) || 1,
        id: mode === 'edit' && initialData?.id ? initialData.id : undefined,
      };

      const res = await onSaveAction(payload);
      if (res && res.success) {
        toast.success(
          res.message || (mode === 'edit' ? 'Packing type updated successfully' : 'Packing type added successfully')
        );
        onSuccess(res.data ?? res, trimmedTitle, payload);
        onClose();
      } else {
        toast.error(res?.message || 'Unable to save packing type');
      }
    } catch (err: any) {
      console.error('[ConfirmationPackingTypeModal] Error saving packing:', err);
      toast.error(err?.message || 'Error saving packing type');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="packing-modal-title"
      className="fixed inset-0 w-full h-full z-9999 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div
        className="w-full max-w-[620px] bg-card text-card-foreground border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85%] sm:max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <i className="fa-solid fa-box text-sm" />
            </div>
            <div>
              <h2 id="packing-modal-title" className="text-base font-bold text-foreground">
                {mode === 'edit' ? 'Edit Packing Type' : 'Packing Type Module'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'edit' ? 'Update packing specifications' : 'Add new packing option for selected product'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form
          onSubmit={handleSubmit}
          onFocusCapture={handleFormFocusScroll}
          className="p-5 flex flex-col gap-4 text-xs sm:text-sm overflow-y-auto custom-scrollbar flex-1 scroll-smooth"
        >
          {/* Row 1: Packing Title & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground text-xs flex items-center gap-1">
                <span>Packing Title</span>
                <span className="text-destructive">*</span>
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }}
                placeholder="e.g. 50 KG Jute Bag / 25 KG PP Bag"
                disabled={isSaving}
                className={`w-full h-10 px-3.5 rounded-lg bg-background text-foreground border text-xs sm:text-sm outline-none transition-all placeholder:text-muted-foreground/60 ${
                  errors.title
                    ? 'border-destructive ring-1 ring-destructive/30'
                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/30'
                }`}
              />
              {errors.title && <span className="text-[11px] text-destructive">{errors.title}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-foreground text-xs flex items-center gap-1">
                <span>Quantity</span>
                <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Enter quantity (e.g. 50, 25, 1000)"
                disabled={isSaving}
                className={`w-full h-10 px-3.5 rounded-lg bg-background text-foreground border text-xs sm:text-sm outline-none transition-all placeholder:text-muted-foreground/60 ${
                  errors.quantity
                    ? 'border-destructive ring-1 ring-destructive/30'
                    : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/30'
                }`}
              />
              {errors.quantity && <span className="text-[11px] text-destructive">{errors.quantity}</span>}
            </div>
          </div>

          {/* Row 2: Unit Type Toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-foreground text-xs flex items-center gap-1">
              <span>Unit Type</span>
              <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => handleUnitTypeChange('solid')}
                className={`h-8.5 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  unitType === 'solid'
                    ? 'bg-card text-foreground shadow-xs font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <i className="fa-solid fa-cube text-xs" />
                <span>Solid (Bag / Box)</span>
              </button>
              <button
                type="button"
                onClick={() => handleUnitTypeChange('liquid')}
                className={`h-8.5 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  unitType === 'liquid'
                    ? 'bg-card text-foreground shadow-xs font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <i className="fa-solid fa-droplet text-xs" />
                <span>Liquid (Drum / Tank / Flexi)</span>
              </button>
            </div>
          </div>

          {/* Row 3: Liquid parameters (Density and Net Weight) */}
          {unitType === 'liquid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-muted/20 border border-border/80 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-foreground text-xs flex items-center gap-1">
                  <span>Density (Kg/L)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={density}
                  onChange={(e) => handleDensityChange(e.target.value)}
                  placeholder="e.g. 0.92"
                  disabled={isSaving}
                  className="w-full h-10 px-3.5 rounded-lg bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 text-xs sm:text-sm outline-none transition-all placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-foreground text-xs flex items-center gap-1">
                  <span>Net WT (Kg)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={netWt}
                  onChange={(e) => setNetWt(e.target.value)}
                  placeholder="e.g. 920"
                  disabled={isSaving}
                  className="w-full h-10 px-3.5 rounded-lg bg-background text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 text-xs sm:text-sm outline-none transition-all placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9.5 px-4 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-9.5 px-6 rounded-lg bg-brand-green hover:bg-brand-green-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-xs" />
                  <span>{mode === 'edit' ? 'Update Packing' : 'Submit'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
