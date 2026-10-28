'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FormOptionItem } from './ConfirmationDocumentForm';

export interface ProductManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  product?: FormOptionItem | null;
  onSave: (productData: {
    id: string;
    label: string;
    hsn: string;
    country: string;
    spec: string;
  }) => void;
  dict?: any;
}

export function ProductManageModal({
  isOpen,
  onClose,
  mode,
  product,
  onSave,
  dict,
}: ProductManageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [hsn, setHsn] = useState('');
  const [country, setCountry] = useState('');
  const [spec, setSpec] = useState('');
  const [error, setError] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state when modal opens or editing product changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        setName(product.label || product.product_name || product.name || '');
        setHsn(
          product.hsn ||
            product.hsn_code ||
            product.hsn_sac_code ||
            product.hsnCode ||
            ''
        );
        const rawCountry: any = product.country;
        setCountry(
          typeof rawCountry === 'string'
            ? rawCountry
            : rawCountry?.name ||
                product.country_name ||
                product.origin_country ||
                product.origin ||
                ''
        );
        setSpec(product.spec || product.specification || '');
      } else {
        setName('');
        setHsn('');
        setCountry('');
        setSpec('');
      }
      setError('');

      // Auto-focus the first input after render
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, mode, product]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(
        dict?.smart_docs?.confirmation_form?.enter_product_name ||
          'Product name is required'
      );
      nameInputRef.current?.focus();
      return;
    }

    const id =
      mode === 'edit' && product?.value
        ? product.value
        : `prod-custom-${Date.now()}`;

    onSave({
      id,
      label: trimmedName,
      hsn: hsn.trim(),
      country: country.trim(),
      spec: spec.trim(),
    });

    onClose();
  };

  const title =
    mode === 'edit'
      ? dict?.smart_docs?.confirmation_form?.edit_product || 'Edit Product'
      : dict?.smart_docs?.confirmation_form?.add_product || 'Add New Product';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-manage-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">
              <i
                className={`fa-solid ${
                  mode === 'edit' ? 'fa-pen-to-square' : 'fa-box-open'
                }`}
              />
            </span>
            <div>
              <h3
                id="product-manage-title"
                className="text-sm sm:text-base font-bold text-foreground leading-tight"
              >
                {title}
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {mode === 'edit'
                  ? 'Update product details, HSN code, and country'
                  : 'Add a new product to select in your trade confirmation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs sm:text-sm">
          {/* Product Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-xs text-foreground flex items-center gap-1">
              <span>{dict?.smart_docs?.confirmation_form?.product_name || 'Product Name'}</span>
              <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Basmati Rice, Cumin Seeds, Soybean"
              className={`w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                error
                  ? 'border-destructive focus:ring-1 focus:ring-destructive'
                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
              }`}
            />
            {error && (
              <span className="text-[11px] text-destructive font-medium animate-in fade-in">
                {error}
              </span>
            )}
          </div>

          {/* HSN Code & Country in 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* HSN Code */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-xs text-foreground">
                {dict?.smart_docs?.confirmation_form?.hsn_code || 'HSN Code'}
              </label>
              <input
                type="text"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="e.g. 1006.30, 0909"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Country */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-xs text-foreground">
                {dict?.smart_docs?.confirmation_form?.country || 'Country'}
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India, Vietnam, Brazil"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>

          {/* Specification / Description */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-xs text-foreground">
              {dict?.smart_docs?.confirmation_form?.specification || 'Specifications'}
            </label>
            <textarea
              rows={3}
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. Moisture: 12% Max, Purity: 99%, Admixture: 1%"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {dict?.common?.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <i className="fa-solid fa-check text-[11px]" />
              <span>
                {mode === 'edit'
                  ? dict?.common?.update || 'Update Product'
                  : dict?.common?.save || 'Save Product'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default ProductManageModal;
