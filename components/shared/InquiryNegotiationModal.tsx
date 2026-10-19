'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scroll-lock';

export interface InquiryDetailsData {
  status?: string;
  details?: {
    id: string;
    product_name?: string;
    country?: string;
    shipping_container?: string;
    shipping_term?: string;
    loading_port?: string;
    destination_port?: string;
    shipment_start_date?: string;
    shipment_end_date?: string;
    packing_type?: string;
    quantity_type?: string;
    quantity?: number;
    fcl?: number;
    payment_term?: string;
    description?: string | null;
    currency?: {
      currency: string;
      symbol: string;
    };
  } | null;
  admin_price?: number;
  negotiation_bid_range?: {
    min_price_bid: number;
    max_price_bid: number;
  };
}

interface InquiryNegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InquiryDetailsData | null;
  offerType: 'BUYER' | 'SELLER';
  lang: string;
  dict?: any;
}

export function InquiryNegotiationModal({
  isOpen,
  onClose,
  data,
  offerType,
  lang,
  dict = {},
}: InquiryNegotiationModalProps) {
  useScrollLock(isOpen);

  const [counterPrice, setCounterPrice] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCounterPrice('');
      setErrorMsg('');
      setIsSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !data || !mounted || typeof document === 'undefined') return null;

  const details = data.details;
  const currencySymbol = details?.currency?.symbol || '$';
  const currencyCode = details?.currency?.currency || 'USD';
  const adminPrice = data.admin_price;
  const minBid = data.negotiation_bid_range?.min_price_bid;
  const maxBid = data.negotiation_bid_range?.max_price_bid;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
    } catch {
      return dateString;
    }
  };

  const handlePriceChange = (val: string) => {
    setCounterPrice(val);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(counterPrice);

    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg(dict?.common?.enter_valid_price || 'Please enter a valid price');
      return;
    }

    if (minBid !== undefined && maxBid !== undefined) {
      if (numPrice < minBid || numPrice > maxBid) {
        setErrorMsg(
          `Bid price must be between ${currencySymbol}${minBid} and ${currencySymbol}${maxBid}`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    }, 400);
  };

  // Logic: 
  // - On "Latest Inquiries for SELLER" (offerType === 'SELLER'): seller submits an offer -> "Submit Offer"
  // - On "Latest Offers for BUYER" (offerType === 'BUYER'): buyer submits an inquiry -> "Submit Inquiry"
  const isSellerView = offerType === 'SELLER';
  const modalTitle = isSellerView
    ? (dict?.common?.submit_offer || 'Submit Offer')
    : (dict?.common?.submit_inquiry || 'Submit Inquiry');

  const shipmentPeriod = (details?.shipment_start_date || details?.shipment_end_date)
    ? `${formatDate(details.shipment_start_date)} to ${formatDate(details.shipment_end_date)}`
    : '-';

  const content = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Matches App Theme */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Table: Product Name Colspan on top + 4 columns (Key, Value, Key, Value) without Description */}
          {/* Mobile View: 2 columns per row */}
          <div className="block sm:hidden border border-border rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-[12.5px]">
              <tbody className="divide-y divide-border">
                <tr className="bg-foreground/[0.02]">
                  <td colSpan={2} className="px-3.5 py-2.5">
                    <span className="text-[11px] text-muted-foreground block font-medium uppercase tracking-wider">Product Name</span>
                    <span className="text-sm font-bold text-foreground block uppercase mt-0.5">{details?.product_name || '-'}</span>
                  </td>
                </tr>
                {[
                  { label: 'Country', value: details?.country || '-' },
                  { label: 'Ship By', value: details?.shipping_container || '-' },
                  { label: 'Shipping Term', value: details?.shipping_term || '-' },
                  { label: 'Port of Loading', value: details?.loading_port || '-' },
                  { label: 'Port of Dest.', value: details?.destination_port || '-' },
                  { label: 'Shipment Period', value: shipmentPeriod },
                  { label: 'Packing Type', value: details?.packing_type || '-' },
                  { label: 'Quantity (MT)', value: details?.quantity ? `${details.quantity} ${details.quantity_type || 'MT'}` : '-' },
                  { label: 'Container (FCL)', value: details?.fcl !== undefined ? `${details.fcl} FCL` : '-' },
                  { label: 'Payment Term', value: details?.payment_term || '-' },
                ].map((item, idx) => (
                  <tr key={idx} className="divide-x divide-border hover:bg-foreground/[0.01]">
                    <td className="px-3 py-2 bg-foreground/[0.02] text-foreground/70 font-medium w-[40%]">{item.label}</td>
                    <td className="px-3 py-2 font-semibold text-foreground w-[60%]">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desktop View: Product Name spanning 4 columns + 4 columns (Key, Value, Key, Value) matching My Inquiries */}
          <div className="hidden sm:block border border-border rounded-xl shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs md:text-[13px]">
              <tbody className="divide-y divide-border">
                <tr className="bg-foreground/[0.02]">
                  <td className="px-3.5 py-2.5 bg-foreground/[0.04] text-foreground/70 font-semibold w-[20%] uppercase text-[11px]">Product Name</td>
                  <td colSpan={3} className="px-3.5 py-2.5 font-bold text-foreground text-sm uppercase">{details?.product_name || '-'}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium w-[20%]">Country</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground w-[30%]">{details?.country || '-'}</td>
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium w-[20%]">Ship By</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground w-[30%]">{details?.shipping_container || '-'}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Shipping Term</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.shipping_term || '-'}</td>
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Port of Loading</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.loading_port || '-'}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Port of Dest.</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.destination_port || '-'}</td>
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Shipment Period</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{shipmentPeriod}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Packing Type</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.packing_type || '-'}</td>
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Quantity (MT)</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.quantity ? `${details.quantity} ${details.quantity_type || 'MT'}` : '-'}</td>
                </tr>
                <tr className="divide-x divide-border hover:bg-foreground/[0.01]">
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Container (FCL)</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.fcl !== undefined ? `${details.fcl} FCL` : '-'}</td>
                  <td className="px-3.5 py-2.5 bg-foreground/[0.02] text-foreground/70 font-medium">Payment Term</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{details?.payment_term || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Price Negotiation Section */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            
            {/* AgriGuru Price Offer Card */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-[13px] font-bold text-foreground px-0.5">
                AgriGuru Price Offer
              </label>
              <div className="w-full bg-foreground/[0.04] dark:bg-card border border-border/80 rounded-2xl p-2.5 sm:p-3 flex items-center gap-3 shadow-2xs">
                {/* AgriGuru Brand Avatar */}
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0 border border-border/60 p-1 shadow-2xs">
                  <img
                    src="/logo.png"
                    alt="AgriGuru"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-base sm:text-lg font-black text-foreground tracking-tight">
                    {currencySymbol}{adminPrice ?? '-'}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    / MT ({currencyCode})
                  </span>
                </div>
              </div>
            </div>

            {/* Enter Your Asking Price Card */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <label className="block text-xs sm:text-[13px] font-bold text-foreground">
                  Enter Your Asking Price
                </label>
                {minBid !== undefined && maxBid !== undefined && (
                  <span className="text-[11px] font-semibold text-primary">
                    Bid Range: {currencySymbol}{minBid} – {currencySymbol}{maxBid}
                  </span>
                )}
              </div>
              <div className="w-full bg-foreground/[0.04] dark:bg-card border-2 border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-sm shadow-primary/10 transition-all">
                {/* User Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  <i className="fa-solid fa-user"></i>
                </div>
                <div className="flex-1 min-w-0 flex items-center">
                  <span className="text-xs sm:text-sm font-bold text-foreground/60 mr-1.5 shrink-0">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={counterPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="Enter Your Asking Price"
                    min={minBid}
                    max={maxBid}
                    autoFocus
                    disabled={isSubmitting || isSuccess}
                    className="w-full bg-transparent text-xs sm:text-sm font-bold text-foreground placeholder:text-muted-foreground/60 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation"></i>
                {errorMsg}
              </p>
            )}

            {isSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
                <i className="fa-solid fa-circle-check"></i>
                {dict?.common?.negotiation_submitted || 'Your asking price has been submitted successfully.'}
              </div>
            )}

            {/* Standard Theme Modal Action Buttons (Cancel / Submit) */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
              >
                {dict?.common?.cancel || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className="px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                {isSubmitting && <i className="fa-solid fa-spinner fa-spin text-sm"></i>}
                {modalTitle}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
