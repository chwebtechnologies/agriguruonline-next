'use client';

import React, { useState, useEffect, useRef } from 'react';
import DocToggle from './DocToggle';
import DocUnderlineInput from './DocUnderlineInput';
import DocUnderlineSelect from './DocUnderlineSelect';
import DocNotesEditor from './DocNotesEditor';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

export interface FormOptionItem {
  value: string;
  label: string;
  subLabel?: string;
  bagWeightKg?: number;
  hsn?: string;
  country?: string;
  spec?: string;
  [key: string]: any;
}

export interface ConfirmationDocumentFormProps {
  initialData?: any;
  sellers?: FormOptionItem[];
  buyers?: FormOptionItem[];
  products?: FormOptionItem[];
  shipByOptions?: FormOptionItem[];
  loadingPorts?: FormOptionItem[];
  destinationPorts?: FormOptionItem[];
  packingOptions?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  currencies?: FormOptionItem[];
  paymentTerms?: FormOptionItem[];
  onSaveDraft?: (data: any) => Promise<boolean | void> | void;
  onSubmitContract?: (data: any) => Promise<boolean | void> | void;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

export function ConfirmationDocumentForm({
  initialData,
  sellers,
  buyers,
  products,
  shipByOptions,
  loadingPorts,
  destinationPorts,
  packingOptions,
  shippingTerms,
  currencies,
  paymentTerms,
  onSaveDraft,
  onSubmitContract,
  lang = 'en',
  dict,
  readOnly = false,
}: ConfirmationDocumentFormProps) {
  // Document Configuration
  const [letterhead, setLetterhead] = useState<boolean>(initialData?.letterhead ?? false);
  const [watermark, setWatermark] = useState<boolean>(initialData?.watermark ?? false);
  const [documentTitle, setDocumentTitle] = useState<string>(
    initialData?.documentTitle || initialData?.title || dict?.smart_docs?.confirmation_form?.confirmation_title || 'CONFIRMATION'
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Row 1: Meta
  const [confirmationNumber, setConfirmationNumber] = useState<string>(
    initialData?.confirmationNumber || ''
  );
  const [confirmationDate, setConfirmationDate] = useState<string>(
    initialData?.confirmationDate || ''
  );

  // Row 2: Parties
  const [sellerId, setSellerId] = useState<string>(initialData?.sellerId || '');
  const [sellerInstruction, setSellerInstruction] = useState<string>(initialData?.sellerInstruction || '');
  const [buyerId, setBuyerId] = useState<string>(initialData?.buyerId || '');
  const [buyerInstruction, setBuyerInstruction] = useState<string>(initialData?.buyerInstruction || '');

  // Row 3: Product, HSN, Country
  const [productId, setProductId] = useState<string>(initialData?.productId || '');
  const [hsnCode, setHsnCode] = useState<string>(initialData?.hsnCode || '');
  const [productCountry, setProductCountry] = useState<string>(initialData?.productCountry || initialData?.country || '');

  // Row 4: Specification
  const [specification, setSpecification] = useState<string>(
    initialData?.specification || ''
  );

  // Row 5: Ship By
  const [shipBy, setShipBy] = useState<string>(initialData?.shipBy || '');

  // Row 6: Loading Port
  const [loadingPort, setLoadingPort] = useState<string>(initialData?.loadingPort || '');

  // Row 7: Destination Port
  const [destinationPort, setDestinationPort] = useState<string>(initialData?.destinationPort || '');

  // Row 8: Packing
  const [packing, setPacking] = useState<string>(initialData?.packing || '');

  // Row 9: Shipping Term
  const [shippingTerm, setShippingTerm] = useState<string>(initialData?.shippingTerm || '');

  // Row 10: Matrix Calculation
  const [fclQty, setFclQty] = useState<string | number>(initialData?.fclQty ?? '');
  const [fclCapacity, setFclCapacity] = useState<string | number>(initialData?.fclCapacity ?? '');
  const [mtQty, setMtQty] = useState<string | number>(initialData?.mtQty ?? '');
  const [bagQty, setBagQty] = useState<string | number>(initialData?.bagQty ?? '');
  const [currency, setCurrency] = useState<string>(initialData?.currency || '');
  const [price, setPrice] = useState<string | number>(initialData?.price ?? '');
  const [totalValue, setTotalValue] = useState<string | number>(initialData?.totalValue ?? '');

  // Row 11: Shipment Period (Single DateRangePicker with underline variant)
  const [shipmentRange, setShipmentRange] = useState<{ start: Date | null; end: Date | null }>({
    start: initialData?.shipmentStartDate
      ? new Date(initialData.shipmentStartDate)
      : null,
    end: initialData?.shipmentEndDate
      ? new Date(initialData.shipmentEndDate)
      : null,
  });
  const [shipmentPeriod, setShipmentPeriod] = useState<string>(
    initialData?.shipmentPeriod || ''
  );

  // Row 12: Payment Term
  const [paymentTerm, setPaymentTerm] = useState<string>(initialData?.paymentTerm || '');

  // Row 13: Notes
  const [notes, setNotes] = useState<string>(
    initialData?.notes || ''
  );

  // UI States
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Lists Data (Derived from props or initialData, empty arrays ready for real API integration)
  const sellersList: FormOptionItem[] = sellers || initialData?.sellers || initialData?.sellersList || [];
  const buyersList: FormOptionItem[] = buyers || initialData?.buyers || initialData?.buyersList || [];
  const productsList: FormOptionItem[] = products || initialData?.products || initialData?.productsList || [];
  const shipByList: FormOptionItem[] = shipByOptions || initialData?.shipByList || initialData?.shipBy || [];
  const loadingPortsList: FormOptionItem[] = loadingPorts || initialData?.loadingPorts || initialData?.loadingPortsList || [];
  const destinationPortsList: FormOptionItem[] = destinationPorts || initialData?.destinationPorts || initialData?.destinationPortsList || [];
  const packingList: FormOptionItem[] = packingOptions || initialData?.packingList || initialData?.packing || [];
  const shippingTermsList: FormOptionItem[] = shippingTerms || initialData?.shippingTerms || initialData?.shippingTermsList || [];
  const currenciesList: FormOptionItem[] = currencies || initialData?.currencies || initialData?.currenciesList || [];
  const paymentTermsList: FormOptionItem[] = paymentTerms || initialData?.paymentTerms || initialData?.paymentTermsList || [];

  // Auto-fill HSN, Country & Specification when Product is selected
  const handleProductChange = (prodId: string) => {
    setProductId(prodId);
    setErrors((prev) => ({ ...prev, productId: '' }));
    const found = productsList.find((p: any) => p.value === prodId);
    if (found) {
      if (found.hsn) setHsnCode(found.hsn);
      if (found.country) setProductCountry(found.country);
      if (found.spec) setSpecification(found.spec);
    } else {
      setHsnCode('');
      setProductCountry('');
      setSpecification('');
    }
  };

  // Synchronize with initialData if it updates (e.g. from async API load)
  useEffect(() => {
    if (!initialData) return;
    if (initialData.letterhead !== undefined) setLetterhead(Boolean(initialData.letterhead));
    if (initialData.watermark !== undefined) setWatermark(Boolean(initialData.watermark));
    if (initialData.documentTitle !== undefined) setDocumentTitle(initialData.documentTitle);
    else if (initialData.title !== undefined) setDocumentTitle(initialData.title);
    if (initialData.confirmationNumber !== undefined) setConfirmationNumber(initialData.confirmationNumber);
    if (initialData.confirmationDate !== undefined) setConfirmationDate(initialData.confirmationDate);
    if (initialData.sellerId !== undefined) setSellerId(initialData.sellerId);
    if (initialData.sellerInstruction !== undefined) setSellerInstruction(initialData.sellerInstruction);
    if (initialData.buyerId !== undefined) setBuyerId(initialData.buyerId);
    if (initialData.buyerInstruction !== undefined) setBuyerInstruction(initialData.buyerInstruction);
    if (initialData.productId !== undefined) setProductId(initialData.productId);
    if (initialData.hsnCode !== undefined) setHsnCode(initialData.hsnCode);
    if (initialData.productCountry !== undefined || initialData.country !== undefined) {
      setProductCountry(initialData.productCountry || initialData.country || '');
    }
    if (initialData.specification !== undefined) setSpecification(initialData.specification);
    if (initialData.shipBy !== undefined) setShipBy(initialData.shipBy);
    if (initialData.loadingPort !== undefined) setLoadingPort(initialData.loadingPort);
    if (initialData.destinationPort !== undefined) setDestinationPort(initialData.destinationPort);
    if (initialData.packing !== undefined) setPacking(initialData.packing);
    if (initialData.shippingTerm !== undefined) setShippingTerm(initialData.shippingTerm);
    if (initialData.fclQty !== undefined) setFclQty(initialData.fclQty);
    if (initialData.fclCapacity !== undefined) setFclCapacity(initialData.fclCapacity);
    if (initialData.mtQty !== undefined) setMtQty(initialData.mtQty);
    if (initialData.bagQty !== undefined) setBagQty(initialData.bagQty);
    if (initialData.currency !== undefined) setCurrency(initialData.currency);
    if (initialData.price !== undefined) setPrice(initialData.price);
    if (initialData.totalValue !== undefined) setTotalValue(initialData.totalValue);
    if (initialData.shipmentStartDate || initialData.shipmentEndDate) {
      setShipmentRange({
        start: initialData.shipmentStartDate ? new Date(initialData.shipmentStartDate) : null,
        end: initialData.shipmentEndDate ? new Date(initialData.shipmentEndDate) : null,
      });
    }
    if (initialData.shipmentPeriod !== undefined) setShipmentPeriod(initialData.shipmentPeriod);
    if (initialData.paymentTerm !== undefined) setPaymentTerm(initialData.paymentTerm);
    if (initialData.notes !== undefined) setNotes(initialData.notes);
  }, [initialData]);

  // Real-time calculation for MT QTY, BAG QTY & TOTAL VALUE
  useEffect(() => {
    const fcl = parseFloat(String(fclQty)) || 0;
    const capacity = parseFloat(String(fclCapacity)) || 0;
    const calcMt = fcl * capacity;
    const p = parseFloat(String(price)) || 0;
    const calcTotal = calcMt * p;

    if (!fclQty && !fclCapacity) {
      setMtQty('');
    } else {
      setMtQty(calcMt > 0 ? calcMt.toFixed(2) : '0');
    }

    const selectedPackingObj = packingList.find((pk) => pk.value === packing);
    const bagKg = selectedPackingObj?.bagWeightKg || 50;

    if (!fclQty && !fclCapacity && !packing) {
      setBagQty('');
    } else if (bagKg > 0 && calcMt > 0) {
      const calculatedBags = Math.round((calcMt * 1000) / bagKg);
      setBagQty(calculatedBags.toLocaleString());
    } else {
      setBagQty(calcMt > 0 ? '-' : '0');
    }

    if (!fclQty && !price) {
      setTotalValue('');
    } else {
      setTotalValue(
        calcTotal > 0
          ? calcTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '0.00'
      );
    }
  }, [fclQty, fclCapacity, price, packing]);

  // Form Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!confirmationNumber.trim()) newErrors.confirmationNumber = 'Required';
    if (!confirmationDate.trim()) newErrors.confirmationDate = 'Required';
    if (!sellerId) newErrors.sellerId = 'Please select a seller';
    if (!buyerId) newErrors.buyerId = 'Please select a buyer';
    if (!productId) newErrors.productId = 'Please select a product';
    if (!shipBy) newErrors.shipBy = 'Please select shipping mode';
    if (!loadingPort) newErrors.loadingPort = 'Please select loading port';
    if (!destinationPort) newErrors.destinationPort = 'Please select destination port';
    if (!packing) newErrors.packing = 'Please select packing';
    if (!shippingTerm) newErrors.shippingTerm = 'Please select shipping term';
    if (!price || Number(price) <= 0) newErrors.price = 'Valid price required';
    if (!paymentTerm) newErrors.paymentTerm = 'Please select payment term';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Export current formData
  const getFormData = () => {
    const selectedSeller = sellersList.find((s) => s.value === sellerId);
    const selectedBuyer = buyersList.find((b) => b.value === buyerId);
    const selectedProduct = productsList.find((p) => p.value === productId);
    const selectedShipBy = shipByList.find((s) => s.value === shipBy);
    const selectedLoading = loadingPortsList.find((p) => p.value === loadingPort);
    const selectedDest = destinationPortsList.find((p) => p.value === destinationPort);
    const selectedPacking = packingList.find((p) => p.value === packing);
    const selectedTerm = shippingTermsList.find((t) => t.value === shippingTerm);
    const selectedPay = paymentTermsList.find((t) => t.value === paymentTerm);

    return {
      letterhead,
      watermark,
      title: documentTitle,
      confirmationNumber,
      confirmationDate,
      sellerId,
      sellerName: selectedSeller?.label || '',
      sellerInstruction,
      buyerId,
      buyerName: selectedBuyer?.label || '',
      buyerInstruction,
      productId,
      productName: selectedProduct?.label || '',
      hsnCode,
      country: productCountry,
      specification,
      shipBy: selectedShipBy?.label || '',
      loadingPort: selectedLoading?.label || '',
      destinationPort: selectedDest?.label || '',
      packing: selectedPacking?.label || '',
      shippingTerm: selectedTerm?.label || '',
      fclQty,
      fclCapacity,
      mtQty,
      bagQty,
      currency,
      price,
      totalValue,
      shipmentStartDate: shipmentRange.start ? shipmentRange.start.toISOString().split('T')[0] : '',
      shipmentEndDate: shipmentRange.end ? shipmentRange.end.toISOString().split('T')[0] : '',
      shipmentPeriod,
      paymentTerm: selectedPay?.label || '',
      notes,
    };
  };

  // Save As Draft Action
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    setStatusMessage(null);
    try {
      const data = getFormData();
      if (onSaveDraft) {
        await onSaveDraft(data);
      }
      setStatusMessage({
        type: 'success',
        text:
          dict?.smart_docs?.confirmation_form?.saved_as_draft_success ||
          'Confirmation saved as draft successfully!',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to save draft. Please retry.',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit to Contract Action
  const handleSubmitContract = async () => {
    setStatusMessage(null);
    if (!validateForm()) {
      setStatusMessage({
        type: 'error',
        text:
          dict?.smart_docs?.confirmation_form?.validation_error ||
          'Please fill all required highlighted fields before submitting.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = getFormData();
      if (onSubmitContract) {
        await onSubmitContract(data);
      }
      setStatusMessage({
        type: 'success',
        text: 'Confirmation submitted successfully for Contract generation!',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to submit confirmation. Please retry.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-card text-foreground">
      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`shrink-0 mx-3 sm:mx-4 mt-2.5 p-2 sm:p-2.5 rounded-md border text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in duration-200 print:hidden ${
            statusMessage.type === 'success'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <i
              className={`fa-solid ${
                statusMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
              } text-xs`}
            />
            <span className="truncate">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer p-0.5"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* 
        Scrollable Table Viewport:
        No extra nested card! Document table starts directly from the top.
      */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {/* TOP BAR: Letterhead Toggle | CONFIRMATION Title | Watermark Toggle */}
        <div className="px-3 sm:px-4 py-1.5 border-b border-foreground/35 flex items-center justify-between gap-2">
          {/* Left: Letterhead Toggle */}
          <div className="flex items-center">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={setLetterhead}
              disabled={readOnly}
            />
          </div>

          {/* Center: Title (Directly Editable Field) + Dotted Accent Underline */}
          <div className="flex flex-col items-center justify-center group/title">
            <div className="relative flex items-center justify-center">
              <input
                ref={titleInputRef}
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                disabled={readOnly}
                placeholder={dict?.smart_docs?.confirmation_form?.confirmation_title || 'CONFIRMATION'}
                aria-label={dict?.smart_docs?.confirmation_form?.confirmation_title || 'Document Title'}
                style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                className="text-xs sm:text-sm md:text-[15px] font-extrabold uppercase tracking-widest text-foreground text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:bg-transparent rounded-sm px-2 py-0.5 w-48 sm:w-64 md:w-72 max-w-full cursor-text transition-all"
              />
              {!readOnly && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => titleInputRef.current?.focus()}
                  title="Edit document title"
                  aria-label="Edit document title"
                  style={{ outline: 'none' }}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-primary hover:text-primary-hover hover:bg-primary/10 text-[10px] transition-colors cursor-pointer shrink-0 outline-none focus:outline-none absolute -right-6 top-1/2 -translate-y-1/2"
                >
                  <i className="fa-solid fa-pen text-primary" />
                </button>
              )}
            </div>
            {/* Clean Underline - becomes solid and vibrant on focus */}
            <div className="w-48 sm:w-64 md:w-72 border-b-2 border-dotted border-primary/70 group-focus-within/title:border-solid group-focus-within/title:border-primary mt-1 transition-all" />
          </div>

          {/* Right: Watermark Toggle */}
          <div className="flex items-center">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.watermark || 'Watermark'}
              checked={watermark}
              onChange={setWatermark}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* 
          DOCUMENT GRID / TABLE:
          100% matches Canva paper mockup with crisp 1px borders and blue dotted input blanks.
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-foreground/35 border-b border-foreground/35 bg-card">
          {/* ROW 1: CONFIRMATION NUMBER | CONFIRMATION DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            {/* Confirmation Number */}
            <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center justify-between gap-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5">
                {dict?.smart_docs?.confirmation_form?.confirmation_number || 'CONFIRMATION NUMBER'} :
              </label>
              <div className="flex-1 min-w-0">
                <DocUnderlineInput
                  value={confirmationNumber}
                  onChange={(val) => {
                    setConfirmationNumber(val);
                    setErrors((prev) => ({ ...prev, confirmationNumber: '' }));
                  }}
                  error={errors.confirmationNumber}
                  icon="fa-solid fa-pen"
                  disabled={readOnly}
                  placeholder="e.g. CN/26-27/00142"
                />
              </div>
            </div>

            {/* Confirmation Date */}
            <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center justify-between gap-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5">
                {dict?.smart_docs?.confirmation_form?.confirmation_date || 'CONFIRMATION DATE'} :
              </label>
              <div className="flex-1 min-w-0">
                <DocUnderlineInput
                  type="date"
                  value={confirmationDate}
                  onChange={(val) => {
                    setConfirmationDate(val);
                    setErrors((prev) => ({ ...prev, confirmationDate: '' }));
                  }}
                  error={errors.confirmationDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* ROW 2: EXPORTER (SELLER) | IMPORTER (BUYER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            {/* Exporter / Seller */}
            <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col gap-1.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.exporter_seller || 'EXPORTER (SELLER)'} :
              </label>
              <DocUnderlineSelect
                options={sellersList}
                value={sellerId}
                onChange={(val) => {
                  setSellerId(val);
                  setErrors((prev) => ({ ...prev, sellerId: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_seller || 'Select Seller'
                }
                error={errors.sellerId}
                disabled={readOnly}
              />
              <DocUnderlineInput
                multiline
                rows={2}
                value={sellerInstruction}
                onChange={setSellerInstruction}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_seller_instruction ||
                  'Enter Seller Instruction'
                }
                icon="fa-solid fa-pen"
                disabled={readOnly}
              />
            </div>

            {/* Importer / Buyer */}
            <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col gap-1.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.importer_buyer || 'IMPORTER (BUYER)'} :
              </label>
              <DocUnderlineSelect
                options={buyersList}
                value={buyerId}
                onChange={(val) => {
                  setBuyerId(val);
                  setErrors((prev) => ({ ...prev, buyerId: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_buyer || 'Select Buyer'
                }
                error={errors.buyerId}
                disabled={readOnly}
              />
              <DocUnderlineInput
                multiline
                rows={2}
                value={buyerInstruction}
                onChange={setBuyerInstruction}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_buyer_instruction ||
                  'Enter Buyer Instruction'
                }
                icon="fa-solid fa-pen"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 3: PRODUCT | HSN CODE | COUNTRY */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.product || 'PRODUCT'} :
              </label>
            </div>
            <div className="md:col-span-5 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={productsList}
                value={productId}
                onChange={handleProductChange}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_product || 'Select Product'
                }
                error={errors.productId}
                disabled={readOnly}
              />
            </div>
            <div className="md:col-span-2 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center gap-1.5">
              <span className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5">
                {dict?.smart_docs?.confirmation_form?.hsn_code || 'HSN CODE'} :
              </span>
              <span className="text-xs font-semibold text-foreground">
                {hsnCode || '-'}
              </span>
            </div>
            <div className="md:col-span-2 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center gap-1.5">
              <span className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5">
                {dict?.smart_docs?.confirmation_form?.country || 'COUNTRY'} :
              </span>
              <span className="text-xs font-semibold text-foreground">
                {productCountry || '-'}
              </span>
            </div>
          </div>

          {/* ROW 4: SPECIFICATION */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-start pt-2 sm:pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.specification || 'SPECIFICATION'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                multiline
                rows={2}
                value={specification}
                onChange={setSpecification}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_specification ||
                  'Enter product specifications...'
                }
                disabled={readOnly}
                icon="fa-solid fa-pen"
              />
            </div>
          </div>

          {/* ROW 5: SHIP BY */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.ship_by || 'SHIP BY'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={shipByList}
                value={shipBy}
                onChange={(val) => {
                  setShipBy(val);
                  setErrors((prev) => ({ ...prev, shipBy: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_ship_by || 'Select Ship By'
                }
                error={errors.shipBy}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 6: LOADING PORT & COUNTRY */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.loading_port_country ||
                  'LOADING PORT & COUNTRY'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={loadingPortsList}
                value={loadingPort}
                onChange={(val) => {
                  setLoadingPort(val);
                  setErrors((prev) => ({ ...prev, loadingPort: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_loading_port ||
                  'Select Loading Port'
                }
                error={errors.loadingPort}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 7: DESTINATION PORT & COUNTRY */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.destination_port_country ||
                  'DESTINATION PORT & COUNTRY'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={destinationPortsList}
                value={destinationPort}
                onChange={(val) => {
                  setDestinationPort(val);
                  setErrors((prev) => ({ ...prev, destinationPort: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_destination_port ||
                  'Select Destination Port & Country'
                }
                error={errors.destinationPort}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 8: PACKING */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.packing || 'PACKING'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={packingList}
                value={packing}
                onChange={(val) => {
                  setPacking(val);
                  setErrors((prev) => ({ ...prev, packing: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_packing_type ||
                  'Select Packing Type'
                }
                error={errors.packing}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 9: SHIPPING TERM */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipping_term || 'SHIPPING TERM'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={shippingTermsList}
                value={shippingTerm}
                onChange={(val) => {
                  setShippingTerm(val);
                  setErrors((prev) => ({ ...prev, shippingTerm: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_shipping_term ||
                  'Select Shipping Term'
                }
                error={errors.shippingTerm}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 10: QUANTITIES & PRICING MATRIX */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y lg:divide-y-0 divide-foreground/35 text-center">
            {/* FCL QTY */}
            <div className="p-1.5 sm:p-2 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.fcl_qty || 'FCL QTY'}
              </span>
              <div className="w-full max-w-[90px]">
                <DocUnderlineInput
                  type="number"
                  value={fclQty}
                  onChange={setFclQty}
                  placeholder="0"
                  icon="fa-solid fa-pen"
                  align="center"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* FCL CAPACITY */}
            <div className="p-1.5 sm:p-2 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.fcl_capacity || 'FCL CAPACITY'}
              </span>
              <div className="w-full max-w-[90px]">
                <DocUnderlineInput
                  type="number"
                  value={fclCapacity}
                  onChange={setFclCapacity}
                  placeholder="0"
                  icon="fa-solid fa-pen"
                  align="center"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* MT QTY */}
            <div className="p-1.5 sm:p-2 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.mt_qty || 'MT QTY'}
              </span>
              <span className="text-xs sm:text-[12.5px] font-bold text-foreground py-0.5">
                {mtQty || '-'}
              </span>
            </div>

            {/* BAG QTY */}
            <div className="p-1.5 sm:p-2 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.bag_qty || 'BAG QTY'}
              </span>
              <span className="text-xs sm:text-[12.5px] font-bold text-foreground py-0.5">
                {bagQty || '-'}
              </span>
            </div>

            {/* CURRENCY */}
            <div className="p-1.5 sm:p-2 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.currency || 'CURRENCY'}
              </span>
              <div className="w-full max-w-[100px]">
                <DocUnderlineSelect
                  options={currenciesList}
                  value={currency}
                  onChange={setCurrency}
                  disabled={readOnly}
                  searchable={false}
                  placeholder="Select"
                />
              </div>
            </div>

            {/* PRICE */}
            <div className="p-1.5 sm:p-2 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.price || 'PRICE'}
              </span>
              <div className="w-full max-w-[100px]">
                <DocUnderlineInput
                  type="number"
                  value={price}
                  onChange={(val) => {
                    setPrice(val);
                    setErrors((prev) => ({ ...prev, price: '' }));
                  }}
                  error={errors.price}
                  placeholder="0.00"
                  icon="fa-solid fa-pen"
                  align="center"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* TOTAL VALUE */}
            <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
              <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                {dict?.smart_docs?.confirmation_form?.total_value || 'TOTAL VALUE'}
              </span>
              <span className="text-xs sm:text-[12.5px] font-bold text-foreground py-0.5">
                {totalValue || '-'}
              </span>
            </div>
          </div>

          {/* ROW 11: SHIPMENT PERIOD (Single DateRangePicker matching A4 paper style) */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipment_period || 'SHIPMENT PERIOD'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DateRangePicker
                variant="underline"
                startDate={shipmentRange.start}
                endDate={shipmentRange.end}
                onChange={(start, end) => {
                  setShipmentRange({ start, end });
                  if (start && end) {
                    const startFmt = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const endFmt = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    setShipmentPeriod(`${startFmt} to ${endFmt}`);
                  } else if (start) {
                    const startFmt = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    setShipmentPeriod(`From ${startFmt}`);
                  } else {
                    setShipmentPeriod('');
                  }
                }}
                formatString="dd MMM yyyy"
                placeholder={dict?.smart_docs?.confirmation_form?.select_shipment_period || 'Select Shipment Period'}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 12: PAYMENT TERM */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.payment_term || 'PAYMENT TERM'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                options={paymentTermsList}
                value={paymentTerm}
                onChange={(val) => {
                  setPaymentTerm(val);
                  setErrors((prev) => ({ ...prev, paymentTerm: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_payment_term ||
                  'Select Payment Term'
                }
                error={errors.paymentTerm}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 13: NOTES */}
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-foreground/35">
            <div className="md:col-span-3 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-start pt-2 sm:pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.notes || 'NOTES'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3">
              <DocNotesEditor
                value={notes}
                onChange={setNotes}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.write_description ||
                  'Write your description...'
                }
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 
        DOCKED BOTTOM ACTION BAR:
        Theme-compliant buttons matching AgriGuru brand system.
        Sticky on mobile for smooth scrolling without blocking view.
      */}
      <div className="shrink-0 sticky bottom-0 border-t border-foreground/35 bg-card/95 backdrop-blur-xs px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 print:hidden z-30">
        {/* Left Action Buttons: Print Preview & Download PDF (Disabled for future implementation) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button (Disabled) */}
          <button
            type="button"
            disabled
            title={dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-brand-red/35 bg-brand-red/10 text-brand-red opacity-60 cursor-not-allowed select-none shadow-2xs transition-all"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>{dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}</span>
          </button>

          {/* Download PDF Button (Disabled) */}
          <button
            type="button"
            disabled
            title={dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-brand-red/35 bg-brand-red/10 text-brand-red opacity-60 cursor-not-allowed select-none shadow-2xs transition-all"
          >
            <i className="fa-solid fa-file-pdf text-xs" />
            <span>{dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}</span>
          </button>
        </div>

        {/* Right Action Buttons: Save As Draft & Submit To Contract */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Save As Draft */}
          <button
            type="button"
            disabled={isSavingDraft || readOnly}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-md text-xs font-semibold border border-primary/35 bg-primary/10 hover:bg-primary/20 text-primary active:scale-[0.98] transition-all duration-150 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {isSavingDraft ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-regular fa-floppy-disk text-xs" />
            )}
            <span>
              {isSavingDraft
                ? 'Saving...'
                : dict?.smart_docs?.confirmation_form?.save_as_draft || 'Save As Draft'}
            </span>
          </button>

          {/* Submit To Contract */}
          <button
            type="button"
            disabled={isSubmitting || readOnly}
            onClick={handleSubmitContract}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group"
          >
            <span>
              {isSubmitting
                ? 'Submitting...'
                : dict?.smart_docs?.confirmation_form?.submit_to_contract || 'Submit To Contract'}
            </span>
            {isSubmitting ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </div>
      </div>

    </div>
  );
}

export default ConfirmationDocumentForm;
