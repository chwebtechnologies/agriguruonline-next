'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocUnderlineSelect from './DocUnderlineSelect';
import DocToggle from './DocToggle';
import DocNotesEditor from './DocNotesEditor';
import DocSegmentedToggle, { DocSegmentedToggleOption } from './DocSegmentedToggle';
import DocDocumentMultiSelect, { STANDARD_TRADE_DOCUMENTS } from './DocDocumentMultiSelect';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import ProductManageModal from './ProductManageModal';
import PaymentTermManageModal from './PaymentTermManageModal';
import InstructionManageModal from './InstructionManageModal';
import ContractSignatureSection from './ContractSignatureSection';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import {
  getSmartDocsInstructionsAction,
  getSmartDocsProductsAction,
  getSmartDocsProductDetailsAction,
  getSmartDocsPaymentTermsAction,
  getSmartDocsCurrenciesAction,
  getSmartDocsDocumentListAction,
  downloadDocPdfAction,
  saveContractDraftAction,
  getStepperListAction,
} from '@/app/actions/smart-docs';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_DOCUMENT_SELECTION_OPTIONS,
  parsePackingBagWeightKg,
  getCurrencySymbol,
  normalizeCurrencyCode,
  normalizeCurrencyOption,
  formatSignatureUrl,
  normalizeSignaturePayload,
  extractContractData,
  extractDocumentStatus,
  normalizeStepStatus,
  type SmartDocsSelectionDocumentOption,
  type StepperDocumentItem,
  isContractStep,
  getContractStep,
  extractStepId,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  getWorkflowSubmitButtonInfo,
  getWorkflowSubmitToastMessage,
  isSameWorkflowStep,
} from '@/lib/api/smart-docs.service';
import type { FormOptionItem } from './ConfirmationDocumentForm';
import { normalizeCountryString, normalizeHsnString, deduplicateValidationMessage } from './ConfirmationDocumentForm';

export interface ContractDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
  contractId?: string;
  steps?: StepperDocumentItem[];
  selectedStep?: StepperDocumentItem | null;
  onUpdateSteps?: (steps: StepperDocumentItem[]) => void;
  onSelectStep?: (step: StepperDocumentItem, index?: number) => void;
  sellers?: FormOptionItem[];
  buyers?: FormOptionItem[];
  products?: FormOptionItem[];
  loadingPorts?: FormOptionItem[];
  destinationPorts?: FormOptionItem[];
  packingOptions?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  currencies?: FormOptionItem[];
  paymentTerms?: FormOptionItem[];
  documentsList?: SmartDocsSelectionDocumentOption[];
  onSaveDraft?: (payload: any) => Promise<any>;
  onSaveSuccess?: (savedId: string, savedData?: any) => void;
  onSubmitContract?: (payload: any, id?: string, nextStep?: StepperDocumentItem | null) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

const DEFAULT_FCL_TYPES: FormOptionItem[] = [
  { value: 'FCL_20_FT', label: '20 FT' },
  { value: 'FCL_40_FT', label: '40 FT' },
  { value: 'VESSEL', label: 'Vessel' },
];

const DEFAULT_SHIPPING_TERMS: FormOptionItem[] = [
  { value: 'FOB', label: 'FOB (Free On Board)' },
  { value: 'CNF', label: 'CNF (Cost & Freight)' },
  { value: 'CIF', label: 'CIF (Cost, Insurance & Freight)' }
];

const DEFAULT_FIXED_LOADING_CONDITION: FormOptionItem = {
  value: 'Any Port Of Loading',
  label: 'Any Port Of Loading',
};

const DEFAULT_ADVANCE_TYPE_OPTIONS: DocSegmentedToggleOption<'PERCENTAGE' | 'AMOUNT'>[] = [
  { value: 'PERCENTAGE', label: '%', icon: 'fa-solid fa-percent' },
  { value: 'AMOUNT', label: 'AMOUNT', icon: 'fa-solid fa-coins' },
];

const DEFAULT_BROKER_COMMISSION_TYPE_OPTIONS: DocSegmentedToggleOption<'PERCENTAGE' | 'PMT'>[] = [
  { value: 'PERCENTAGE', label: '%', icon: 'fa-solid fa-percent' },
  { value: 'PMT', label: 'PMT', icon: 'fa-solid fa-scale-balanced' },
];

export const DEFAULT_STATIC_PACKING_OPTIONS: FormOptionItem[] = [
  { value: '50 KG PP BAGS', label: '50 KG PP BAGS', bagWeightKg: 50 },
  { value: '25 KG PP BAGS', label: '25 KG PP BAGS', bagWeightKg: 25 },
  { value: '50 KG JUTE BAGS', label: '50 KG JUTE BAGS', bagWeightKg: 50 },
  { value: '25 KG JUTE BAGS', label: '25 KG JUTE BAGS', bagWeightKg: 25 },
  { value: '1000 KG JUMBO BAGS', label: '1000 KG JUMBO BAGS', bagWeightKg: 1000 },
  { value: 'BULK IN CONTAINER', label: 'BULK IN CONTAINER' },
];

export const DEFAULT_STATIC_LOADING_PORTS: FormOptionItem[] = [
  { value: 'Mundra Port, India', label: 'Mundra Port, India', subLabel: 'India' },
  { value: 'Nhava Sheva (JNPT), India', label: 'Nhava Sheva (JNPT), India', subLabel: 'India' },
  { value: 'Kandla Port, India', label: 'Kandla Port, India', subLabel: 'India' },
  { value: 'Pipavav Port, India', label: 'Pipavav Port, India', subLabel: 'India' },
  { value: 'Chennai Port, India', label: 'Chennai Port, India', subLabel: 'India' },
  { value: 'Kolkata Port, India', label: 'Kolkata Port, India', subLabel: 'India' },
  { value: 'Any Indian Port', label: 'Any Indian Port', subLabel: 'India' },
];

export const DEFAULT_STATIC_DESTINATION_PORTS: FormOptionItem[] = [
  { value: 'Jebel Ali, UAE', label: 'Jebel Ali, UAE', subLabel: 'United Arab Emirates' },
  { value: 'Chittagong, Bangladesh', label: 'Chittagong, Bangladesh', subLabel: 'Bangladesh' },
  { value: 'Port Klang, Malaysia', label: 'Port Klang, Malaysia', subLabel: 'Malaysia' },
  { value: 'Singapore Port', label: 'Singapore Port', subLabel: 'Singapore' },
  { value: 'Mersin, Turkey', label: 'Mersin, Turkey', subLabel: 'Turkey' },
  { value: 'Rotterdam, Netherlands', label: 'Rotterdam, Netherlands', subLabel: 'Netherlands' },
  { value: 'Hai Phong, Vietnam', label: 'Hai Phong, Vietnam', subLabel: 'Vietnam' },
  { value: 'Colombo, Sri Lanka', label: 'Colombo, Sri Lanka', subLabel: 'Sri Lanka' },
];

export function getInsuranceFromIncoterm(term?: string | null, options?: FormOptionItem[]): string {
  if (!term || !String(term).trim()) return '';
  const str = String(term).trim();
  let upper = str.toUpperCase();

  // If options are provided, check if term matches an option value/id and extract its label
  if (options && options.length > 0) {
    const found = options.find(
      (opt) =>
        String(opt.value).toUpperCase() === upper ||
        String(opt.id || '').toUpperCase() === upper ||
        String(opt.label || '').toUpperCase() === upper
    );
    if (found) {
      const optionLabel = (found.label || found.name || found.value || '').toUpperCase();
      if (
        optionLabel === 'FOB' ||
        optionLabel === 'CNF' ||
        optionLabel === 'CFR' ||
        optionLabel.includes('FOB') ||
        optionLabel.includes('CNF') ||
        optionLabel.includes('CFR')
      ) {
        return 'BUYER';
      }
      return 'SELLER';
    }
  }

  if (
    upper === 'FOB' ||
    upper === 'CNF' ||
    upper === 'CFR' ||
    upper.includes('FOB') ||
    upper.includes('CNF') ||
    upper.includes('CFR')
  ) {
    return 'BUYER';
  }
  return 'SELLER';
}

export interface ContractSplitItem {
  id?: string;
  split_number: number | string;
  fcl_quantity: number | string;
  [key: string]: any;
}

/**
 * Robustly converts a base64 data URL into a binary File object.
 * Returns null if dataUrl is empty or invalid.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:')) return null;

  try {
    const parts = trimmed.split(',');
    if (parts.length < 2) return null;
    const match = parts[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/png';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new File([array], filename, { type: mime });
  } catch (e) {
    console.warn('[dataUrlToFile] Failed to convert dataUrl to File:', e);
    return null;
  }
}

/**
 * Visual order of contract fields for smooth scroll-to-focus on validation failure.
 */
export const CONTRACT_FIELD_VISUAL_ORDER = [
  'documentTitle',
  'confirmationDate',
  'contractNumber',
  'contractDate',
  'partiesHeader',
  'sellerId',
  'sellerInstruction',
  'buyerId',
  'buyerInstruction',
  'shippingInstruction',
  'productId',
  'specification',
  'shipmentPeriod',
  'paymentTerm',
  'fclType',
  'packing',
  'markingBrand',
  'loadingPort',
  'loadingCondition',
  'destinationPort',
  'fclQty',
  'fclCapacity',
  'mtQty',
  'bagQty',
  'currency',
  'price',
  'totalValue',
  'inspection',
  'incoterm',
  'partialCount',
  'partialTotal',
  'advance',
  'advanceType',
  'advanceAmount',
  'advancePercentage',
  'salesBroker',
  'brokerCommissionType',
  'brokerCommission',
  'brokerName',
  'freeDays',
  'emptyBags',
  'additionalComment',
  'otherTermsPayment',
  'documentsRequired',
  'shippingLine',
  'arbitration',
  'containerStandards',
  'forceMajeur',
  'confidentiality',
  'notes',
  'exporterSignature',
  'importerSignature',
  'brokerSignature',
];

/**
 * Smoothly scrolls to the first contract field that failed validation, focuses the input,
 * and adds an active highlight ring so the user immediately knows where input is needed.
 */
export function scrollToAndFocusContractField(fieldErrorsOrKey: string | Record<string, string>): void {
  if (typeof window === 'undefined') return;

  let targetKey = '';
  if (typeof fieldErrorsOrKey === 'string') {
    targetKey = fieldErrorsOrKey;
  } else if (fieldErrorsOrKey && typeof fieldErrorsOrKey === 'object') {
    for (const key of CONTRACT_FIELD_VISUAL_ORDER) {
      if (fieldErrorsOrKey[key]) {
        targetKey = key;
        break;
      }
    }
    if (!targetKey) {
      const keys = Object.keys(fieldErrorsOrKey);
      if (keys.length > 0) targetKey = keys[0];
    }
  }

  if (!targetKey) return;

  if (
    targetKey === 'shipmentStartDate' ||
    targetKey === 'shipmentEndDate' ||
    targetKey === 'shipment_start_date' ||
    targetKey === 'shipment_end_date'
  ) {
    targetKey = 'shipmentPeriod';
  }

  const selectors = [
    `#field-${targetKey}`,
    `#field-contract-${targetKey}`,
    `[data-field="${targetKey}"]`,
    `#${targetKey}`,
    `[name="${targetKey}"]`,
  ];

  if (targetKey === 'contractNumber') {
    selectors.unshift('#contract-number-input', '#field-contractNumber');
  }

  if (targetKey === 'partialCount' || targetKey === 'splitCount' || targetKey === 'partialTotal') {
    selectors.unshift('#field-split-count', '[data-field="partial"]');
  }

  if (targetKey === 'brokerCommissionType') {
    selectors.unshift('#toggle-broker-commission-type', '[data-field="brokerCommissionType"]', '[data-field="salesBroker"]');
  }

  if (targetKey === 'advanceType') {
    selectors.unshift('#toggle-advance-type', '[data-field="advanceType"]', '[data-field="advance"]');
  }

  if (targetKey === 'brokerCommission') {
    selectors.unshift('#field-broker-commission', '[data-field="brokerCommission"]');
  }

  if (targetKey === 'brokerName') {
    selectors.unshift('#field-broker-name', '[data-field="brokerName"]');
  }

  if (targetKey === 'advanceAmount') {
    selectors.unshift('#field-advance-amount', '[data-field="advanceAmount"]');
  }

  if (targetKey === 'advancePercentage') {
    selectors.unshift('#field-advance-percent', '[data-field="advancePercentage"]');
  }

  let el: HTMLElement | null = null;
  for (const sel of selectors) {
    const found = document.querySelector<HTMLElement>(sel);
    if (found) {
      el = found;
      break;
    }
  }

  if (!el) {
    const cleanKey = targetKey.toLowerCase().replace(/[-_.]/g, '');
    const allFieldEls = document.querySelectorAll<HTMLElement>('[data-field], [id^="field-"]');
    for (let i = 0; i < allFieldEls.length; i++) {
      const item = allFieldEls[i];
      const attr = (item.getAttribute('data-field') || item.id || '').toLowerCase().replace(/[-_.]/g, '');
      if (attr.includes(cleanKey) || cleanKey.includes(attr)) {
        el = item;
        break;
      }
    }
  }

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      const focusable =
        el!.matches('input, select, textarea, button, [tabindex="0"]')
          ? el
          : el!.querySelector<HTMLElement>('input, select, textarea, button, [tabindex="0"]');

      if (focusable) {
        focusable.focus();
        if (typeof (focusable as HTMLInputElement).select === 'function' && focusable.tagName !== 'BUTTON') {
          (focusable as HTMLInputElement).select();
        }
      }

      el!.classList.add('ring-2', 'ring-brand-red', 'ring-offset-2', 'rounded-sm', 'transition-all', 'duration-300');
      setTimeout(() => {
        el!.classList.remove('ring-2', 'ring-brand-red', 'ring-offset-2', 'rounded-sm', 'transition-all', 'duration-300');
      }, 2500);
    }, 120);
  }
}

/**
 * Detects which contract form field an error message or identifier belongs to.
 * Supports snake_case, spaced text, and lowercase camelCase matching.
 */
export function detectContractFieldInSentence(text: string): { key: string; rawField: string } | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  const normalized = lower.replace(/[-_.]/g, ' ');

  // 1. Contract Number
  if (
    normalized.includes('contract number') ||
    normalized.includes('contract no') ||
    lower.includes('contractnumber') ||
    lower.includes('contractno')
  ) {
    return { key: 'contractNumber', rawField: 'contract_number' };
  }

  // 2. Contract Date
  if (
    normalized.includes('contract date') ||
    lower.includes('contractdate')
  ) {
    return { key: 'contractDate', rawField: 'contract_date' };
  }

  // 3. Confirmation Date
  if (
    normalized.includes('confirmation date') ||
    lower.includes('confirmationdate')
  ) {
    return { key: 'confirmationDate', rawField: 'confirmation_date' };
  }

  // 4. Document / PDF Title
  if (
    normalized.includes('pdf title') ||
    normalized.includes('document title') ||
    lower.includes('pdftitle') ||
    lower.includes('documenttitle')
  ) {
    return { key: 'documentTitle', rawField: 'pdf_title' };
  }

  // 5. Party Header Label
  if (
    normalized.includes('party header') ||
    normalized.includes('parties header') ||
    lower.includes('partyheader')
  ) {
    return { key: 'partiesHeader', rawField: 'party_header_label' };
  }

  // 6. Seller / Exporter
  if (
    normalized.includes('seller instruction id') ||
    normalized.includes('seller id') ||
    lower.includes('sellerinstructionid') ||
    lower.includes('sellerid')
  ) {
    return { key: 'sellerId', rawField: 'seller_instruction_id' };
  }
  if (
    normalized.includes('seller instruction') ||
    lower.includes('sellerinstruction')
  ) {
    return { key: 'sellerInstruction', rawField: 'seller_instruction' };
  }
  if (normalized.includes('seller') || normalized.includes('exporter')) {
    return { key: 'sellerId', rawField: 'seller_instruction_id' };
  }

  // 7. Buyer / Importer
  if (
    normalized.includes('buyer instruction id') ||
    normalized.includes('buyer id') ||
    lower.includes('buyerinstructionid') ||
    lower.includes('buyerid')
  ) {
    return { key: 'buyerId', rawField: 'buyer_instruction_id' };
  }
  if (
    normalized.includes('buyer instruction') ||
    lower.includes('buyerinstruction')
  ) {
    return { key: 'buyerInstruction', rawField: 'buyer_instruction' };
  }
  if (normalized.includes('buyer') || normalized.includes('importer')) {
    return { key: 'buyerId', rawField: 'buyer_instruction_id' };
  }

  // 8. Shipping Instruction / Terms & Condition
  if (
    normalized.includes('shipping instruction') ||
    normalized.includes('terms and condition') ||
    normalized.includes('terms & condition') ||
    lower.includes('termsandcondition') ||
    lower.includes('shippinginstruction')
  ) {
    return { key: 'shippingInstruction', rawField: 'terms_and_condition' };
  }

  // 9. Product
  if (
    normalized.includes('product id') ||
    normalized.includes('product name') ||
    lower.includes('productid') ||
    normalized.includes('product')
  ) {
    return { key: 'productId', rawField: 'product_id' };
  }

  // 10. Quality Specification
  if (
    normalized.includes('quality specification') ||
    normalized.includes('specification') ||
    lower.includes('qualityspecification')
  ) {
    return { key: 'specification', rawField: 'quality_specification' };
  }

  // 11. Shipment Dates / Period
  if (
    normalized.includes('shipment start') ||
    normalized.includes('shipment end') ||
    normalized.includes('shipment period') ||
    normalized.includes('shipment date') ||
    lower.includes('shipmentstart') ||
    lower.includes('shipmentend') ||
    lower.includes('shipmentperiod')
  ) {
    return { key: 'shipmentPeriod', rawField: 'shipment_start_date' };
  }

  // 12. Payment Term
  if (
    normalized.includes('payment term') ||
    lower.includes('paymentterm')
  ) {
    return { key: 'paymentTerm', rawField: 'payment_term_id' };
  }

  // 13. FCL Type / Ship By
  if (
    normalized.includes('ship by') ||
    normalized.includes('fcl type') ||
    lower.includes('shipby') ||
    lower.includes('fcltype')
  ) {
    return { key: 'fclType', rawField: 'ship_by' };
  }

  // 14. Packing Type
  if (
    normalized.includes('packing type') ||
    normalized.includes('packing') ||
    lower.includes('packingtype')
  ) {
    return { key: 'packing', rawField: 'packing_type_id' };
  }

  // 15. Marking Brand
  if (
    normalized.includes('marking brand') ||
    lower.includes('markingbrand')
  ) {
    return { key: 'markingBrand', rawField: 'marking_brand' };
  }

  // 16. Loading Port
  if (
    normalized.includes('loading port') ||
    lower.includes('loadingport')
  ) {
    return { key: 'loadingPort', rawField: 'loading_port_id' };
  }

  // 17. Loading Condition
  if (
    normalized.includes('loading condition') ||
    lower.includes('loadingcondition')
  ) {
    return { key: 'loadingCondition', rawField: 'loading_condition' };
  }

  // 18. Destination Port
  if (
    normalized.includes('destination port') ||
    lower.includes('destinationport')
  ) {
    return { key: 'destinationPort', rawField: 'destination_port_id' };
  }

  // 19. FCL Quantity
  if (
    normalized.includes('fcl quantity') ||
    normalized.includes('fcl qty') ||
    lower.includes('fclquantity') ||
    lower.includes('fclqty')
  ) {
    return { key: 'fclQty', rawField: 'fcl_quantity' };
  }

  // 20. FCL Capacity
  if (
    normalized.includes('fcl capacity') ||
    normalized.includes('fcl cap') ||
    lower.includes('fclcapacity')
  ) {
    return { key: 'fclCapacity', rawField: 'fcl_capacity' };
  }

  // 21. MT Quantity
  if (
    normalized.includes('mt quantity') ||
    normalized.includes('mt qty') ||
    normalized.includes('metric tons') ||
    lower.includes('mtquantity') ||
    lower.includes('mtqty')
  ) {
    return { key: 'mtQty', rawField: 'mt_quantity' };
  }

  // 22. Bag Quantity
  if (
    normalized.includes('bag quantity') ||
    normalized.includes('bag qty') ||
    lower.includes('bagquantity') ||
    lower.includes('bagqty')
  ) {
    return { key: 'bagQty', rawField: 'bag_quantity' };
  }

  // 23. Currency
  if (
    normalized.includes('currency id') ||
    normalized.includes('currency code') ||
    lower.includes('currencyid') ||
    normalized.includes('currency')
  ) {
    return { key: 'currency', rawField: 'currency_id' };
  }

  // 24. Price
  if (
    normalized.includes('unit price') ||
    normalized.includes('price') ||
    lower.includes('unitprice')
  ) {
    return { key: 'price', rawField: 'price' };
  }

  // 25. Total Value
  if (
    normalized.includes('total value') ||
    normalized.includes('total amount') ||
    lower.includes('totalvalue')
  ) {
    return { key: 'totalValue', rawField: 'total_value' };
  }

  // 26. Inspection
  if (
    normalized.includes('inspection') ||
    lower.includes('inspection')
  ) {
    return { key: 'inspection', rawField: 'inspection' };
  }

  // 27. Shipping Term / Incoterm
  if (
    normalized.includes('shipping term') ||
    normalized.includes('incoterm') ||
    lower.includes('shippingterm')
  ) {
    return { key: 'incoterm', rawField: 'shipping_term' };
  }

  // 28. Splits / Partials
  if (
    normalized.includes('split') ||
    normalized.includes('partial')
  ) {
    return { key: 'partialTotal', rawField: 'splits' };
  }

  // 29. Advance
  if (
    normalized.includes('advance amount') ||
    normalized.includes('advance percent') ||
    normalized.includes('advance')
  ) {
    return { key: 'advanceAmount', rawField: 'advance_amount' };
  }

  // 30. Broker
  if (
    normalized.includes('broker commission') ||
    lower.includes('brokercommission')
  ) {
    return { key: 'brokerCommission', rawField: 'broker_commission' };
  }
  if (
    normalized.includes('broker name') ||
    lower.includes('brokername')
  ) {
    return { key: 'brokerName', rawField: 'broker_name' };
  }

  // 31. Free Days
  if (
    normalized.includes('free days') ||
    lower.includes('freedays')
  ) {
    return { key: 'freeDays', rawField: 'free_days' };
  }

  // 32. Empty Bags
  if (
    normalized.includes('empty bags') ||
    lower.includes('emptybags')
  ) {
    return { key: 'emptyBags', rawField: 'empty_bags' };
  }

  // 33. Contract Comment Title / Label
  if (
    lower.includes('comment_label') ||
    lower.includes('commentlabel') ||
    normalized.includes('comment label')
  ) {
    return { key: 'commentLabel', rawField: 'comment_label' };
  }

  // 34. Contract Comment Value
  if (
    lower.includes('comment_value') ||
    lower.includes('commentvalue') ||
    normalized.includes('comment value')
  ) {
    return { key: 'commentValue', rawField: 'comment_value' };
  }

  // 35. Additional Comment
  if (
    normalized.includes('additional comment') ||
    normalized.includes('comment') ||
    lower.includes('additionalcomment')
  ) {
    return { key: 'additionalComment', rawField: 'comment' };
  }

  // 34. Other Terms 1 (Payment / Bank Charges)
  if (
    normalized.includes('other terms 1') ||
    normalized.includes('other terms payment') ||
    lower.includes('otherterms1')
  ) {
    return { key: 'otherTermsPayment', rawField: 'other_terms_1' };
  }

  // 35. Documents Required
  if (
    normalized.includes('document') ||
    lower.includes('documentsrequired')
  ) {
    return { key: 'documentsRequired', rawField: 'documents_required' };
  }

  // 36. Shipping Line
  if (
    normalized.includes('shipping line') ||
    lower.includes('shippingline')
  ) {
    return { key: 'shippingLine', rawField: 'shipping_line' };
  }

  // 37. Arbitration
  if (
    normalized.includes('arbitration') ||
    lower.includes('arbitration')
  ) {
    return { key: 'arbitration', rawField: 'arbitration' };
  }

  // 38. Other Terms 2 (Container standards)
  if (
    normalized.includes('other terms 2') ||
    normalized.includes('container standards') ||
    lower.includes('otherterms2')
  ) {
    return { key: 'containerStandards', rawField: 'other_terms_2' };
  }

  // 39. Force Majeur
  if (
    normalized.includes('force majeur') ||
    lower.includes('forcemajeur')
  ) {
    return { key: 'forceMajeur', rawField: 'force_majeur' };
  }

  // 40. Confidentiality
  if (
    normalized.includes('confidentiality') ||
    lower.includes('confidentiality')
  ) {
    return { key: 'confidentiality', rawField: 'confidentiality' };
  }

  // 41. Notes
  if (
    normalized.includes('notes') ||
    normalized.includes('remark')
  ) {
    return { key: 'notes', rawField: 'notes' };
  }

  // 42. Signatures
  if (normalized.includes('seller signature') || lower.includes('sellersignature') || normalized.includes('exporter signature')) {
    return { key: 'exporterSignature', rawField: 'seller_signature' };
  }
  if (normalized.includes('buyer signature') || lower.includes('buyersignature') || normalized.includes('importer signature')) {
    return { key: 'importerSignature', rawField: 'buyer_signature' };
  }
  if (normalized.includes('broker signature') || lower.includes('brokersignature')) {
    return { key: 'brokerSignature', rawField: 'broker_signature' };
  }

  return null;
}

/**
 * Transforms raw backend validator messages into clean, user-friendly labels.
 * Explicitly prevents generic headers like "Form Validation Error" or technical strings from leaking.
 */
export function humanizeContractValidationMessage(rawMsg: any, fieldKey?: string): string {
  if (!rawMsg) return 'Invalid value. Please check the field.';
  let msg = typeof rawMsg === 'string' ? rawMsg : (rawMsg?.message || rawMsg?.msg || JSON.stringify(rawMsg));
  msg = String(msg).trim();

  // Known specific technical validation errors
  if (/shipment_start_date.*must be a date instance/i.test(msg)) {
    return 'Please select a valid shipment start date';
  }
  if (/shipment_end_date.*must be a date instance/i.test(msg)) {
    return 'Please select a valid shipment end date';
  }
  if (/ship_by.*must be one of/i.test(msg) || /fcl.*type.*must be one of/i.test(msg)) {
    return 'Please select a valid FCL Type (20 FT, 40 FT, Vessel)';
  }
  if (/must be a date instance/i.test(msg)) {
    msg = msg.replace(/must be a date instance/gi, 'must be a valid date');
  }
  if (/must be an? (?:isodate|iso8601|valid iso)/i.test(msg)) {
    msg = msg.replace(/must be an? (?:isodate|iso8601|valid iso)[^,]*/gi, 'must be a valid date');
  }
  if (/(?:should not|must not|cannot|is not allowed to) be empty/i.test(msg)) {
    msg = msg.replace(/(?:should not|must not|cannot|is not allowed to) be empty/gi, 'is required');
  }
  if (/must be a string/i.test(msg)) {
    msg = msg.replace(/must be a string/gi, 'is required');
  }
  if (/must be a number/i.test(msg)) {
    msg = msg.replace(/must be a number/gi, 'must be a valid number');
  }
  if (/must be an integer/i.test(msg)) {
    msg = msg.replace(/must be an integer/gi, 'must be a whole number');
  }

  // Replace technical field identifiers with clean, user-friendly names
  const replacements: [RegExp, string][] = [
    [/\bcontract_number\b/gi, 'Contract number'],
    [/\bcontract_date\b/gi, 'Contract date'],
    [/\bconfirmation_date\b/gi, 'Confirmation date'],
    [/\bparty_header_label\b/gi, 'Parties header'],
    [/\bseller_instruction_id\b/gi, 'Exporter (Seller)'],
    [/\bseller_instruction\b/gi, 'Seller instruction'],
    [/\bbuyer_instruction_id\b/gi, 'Importer (Buyer)'],
    [/\bbuyer_instruction\b/gi, 'Buyer instruction'],
    [/\bterms_and_condition\b/gi, 'Shipping instruction'],
    [/\bproduct_id\b/gi, 'Product'],
    [/\bquality_specification\b/gi, 'Specification'],
    [/\bshipment_start_date\b/gi, 'Shipment start date'],
    [/\bshipment_end_date\b/gi, 'Shipment end date'],
    [/\bpayment_term_id\b/gi, 'Payment term'],
    [/\bship_by\b/gi, 'FCL Type'],
    [/\bpacking_type_id\b/gi, 'Packing'],
    [/\bmarking_brand\b/gi, 'Marking brand'],
    [/\bloading_port_id\b/gi, 'Loading port'],
    [/\bloading_condition\b/gi, 'Loading condition'],
    [/\bdestination_port_id\b/gi, 'Destination port'],
    [/\bfcl_quantity\b/gi, 'FCL quantity'],
    [/\bfcl_capacity\b/gi, 'FCL capacity'],
    [/\bmt_quantity\b/gi, 'MT quantity'],
    [/\bbag_quantity\b/gi, 'Bag quantity'],
    [/\bcurrency_id\b/gi, 'Currency'],
    [/\bshipping_term\b/gi, 'Shipping term'],
    [/\bsplit_count\b/gi, 'Split count'],
    [/\bsplits\b/gi, 'Partial breakdown'],
    [/\bbroker_commission\b/gi, 'Broker commission'],
    [/\bbroker_name\b/gi, 'Broker name'],
    [/\bfree_days\b/gi, 'Free days'],
    [/\bempty_bags\b/gi, 'Empty bags'],
    [/\bother_terms_1\b/gi, 'Payment terms'],
    [/\bother_terms_2\b/gi, 'Container standards'],
    [/\bforce_majeur\b/gi, 'Force Majeur'],
    [/\bconfidentiality\b/gi, 'Confidentiality'],
    [/\bnotes\b/gi, 'Notes'],
    [/\bseller_signature\b/gi, 'Seller signature'],
    [/\bbuyer_signature\b/gi, 'Buyer signature'],
    [/\bbroker_signature\b/gi, 'Broker signature'],
  ];

  for (const [pattern, label] of replacements) {
    msg = msg.replace(pattern, label);
  }

  // Convert snake_case identifiers
  msg = msg.replace(/\b[a-z]+(_[a-z0-9]+)+\b/gi, (match: string) => {
    return match
      .replace(/_id$/i, '')
      .replace(/_/g, ' ')
      .trim();
  });

  const formatted = msg.charAt(0).toUpperCase() + msg.slice(1);
  return deduplicateValidationMessage(formatted);
}

/**
 * Robust helper to extract field-wise validation errors and general error from backend API response for contracts.
 * Automatically humanizes all technical field names and error messages, and maps them directly to form fields.
 * NEVER leaks generic error messages like "Form Validation Error" as the generalError or field error.
 */
export function parseContractBackendErrors(
  result: any
): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!result) return { fieldErrors, generalError: 'Failed to save draft' };

  const mapFieldNameToErrorKey = (field: string): string => {
    const f = String(field || '').trim();
    const clean = f.toLowerCase().replace(/[-_.]/g, '');

    switch (clean) {
      case 'contractnumber':
      case 'contractno':
      case 'contract':
        return 'contractNumber';
      case 'contractdate':
        return 'contractDate';
      case 'confirmationnumber':
      case 'confirmationno':
        return 'confirmationNumber';
      case 'confirmationdate':
        return 'confirmationDate';
      case 'partyheaderlabel':
      case 'partiesheader':
      case 'partyheader':
        return 'partiesHeader';
      case 'sellerinstructionid':
      case 'sellerid':
      case 'seller':
      case 'exporter':
      case 'exporterid':
        return 'sellerId';
      case 'sellerinstruction':
      case 'sellerinstructions':
        return 'sellerInstruction';
      case 'buyerinstructionid':
      case 'buyerid':
      case 'buyer':
      case 'importer':
      case 'importerid':
        return 'buyerId';
      case 'buyerinstruction':
      case 'buyerinstructions':
        return 'buyerInstruction';
      case 'termsandcondition':
      case 'termsandconditions':
      case 'shippinginstruction':
      case 'termscondition':
        return 'shippingInstruction';
      case 'productid':
      case 'product':
      case 'productname':
        return 'productId';
      case 'hsncode':
      case 'hsn':
        return 'hsnCode';
      case 'qualityspecification':
      case 'specification':
      case 'spec':
        return 'specification';
      case 'shipby':
      case 'fcltype':
      case 'shippingmode':
        return 'fclType';
      case 'loadingportid':
      case 'loadingport':
      case 'portofloading':
        return 'loadingPort';
      case 'loadingcondition':
        return 'loadingCondition';
      case 'destinationportid':
      case 'destinationport':
      case 'portofdestination':
        return 'destinationPort';
      case 'packingtypeid':
      case 'packingtype':
      case 'packing':
        return 'packing';
      case 'markingbrand':
      case 'brand':
        return 'markingBrand';
      case 'shippingterm':
      case 'incoterm':
      case 'deliveryterm':
        return 'incoterm';
      case 'fclquantity':
      case 'fclqty':
        return 'fclQty';
      case 'fclcapacity':
      case 'fclcap':
        return 'fclCapacity';
      case 'mtquantity':
      case 'mtqty':
        return 'mtQty';
      case 'bagquantity':
      case 'bagqty':
        return 'bagQty';
      case 'currencyid':
      case 'currency':
        return 'currency';
      case 'price':
      case 'unitprice':
      case 'rate':
        return 'price';
      case 'totalvalue':
      case 'totalamount':
      case 'total':
        return 'totalValue';
      case 'inspection':
        return 'inspection';
      case 'shipmentstartdate':
      case 'shipmentenddate':
      case 'shipmentperiod':
        return 'shipmentPeriod';
      case 'paymenttermid':
      case 'paymentterm':
      case 'paymentterms':
        return 'paymentTerm';
      case 'splitcount':
      case 'splits':
      case 'partialcount':
      case 'partialtotal':
        return 'partialTotal';
      case 'advanceamount':
      case 'advance_amount':
      case 'advancepaymentamt':
      case 'advance_payment_amt':
      case 'advancepayment':
      case 'advance_payment':
        return 'advanceAmount';
      case 'advancepercentage':
      case 'advancepercent':
      case 'advance_percentage':
      case 'advancepaymentpct':
      case 'advance_payment_pct':
      case 'advancepct':
      case 'advance_pct':
        return 'advancePercentage';
      case 'advancetype':
      case 'advance_type':
      case 'advancepaymenttype':
      case 'advance_payment_type':
        return 'advanceType';
      case 'brokercommissiontype':
      case 'broker_commission_type':
      case 'salesbrokertype':
      case 'sales_broker_type':
        return 'brokerCommissionType';
      case 'brokercommission':
      case 'broker_commission':
      case 'salesbrokercommission':
      case 'sales_broker_commission':
        return 'brokerCommission';
      case 'brokercommissionamt':
      case 'brokercommissionamount':
      case 'broker_commission_amt':
      case 'broker_commission_amount':
      case 'salesbrokeramount':
      case 'sales_broker_amount':
        return 'brokerCommissionAmt';
      case 'brokername':
      case 'broker_name':
      case 'salesbrokername':
      case 'sales_broker_name':
        return 'brokerName';
      case 'brokersignaturefield':
      case 'brokertitle':
        return 'brokerTitle';
      case 'brokersignaturelabel':
      case 'brokerauthoritytitle':
        return 'brokerAuthorityTitle';
      case 'brokersignature':
        return 'brokerSignature';
      case 'freedays':
        return 'freeDays';
      case 'emptybags':
        return 'emptyBags';
      case 'commentlabel':
      case 'comment_label':
        return 'commentLabel';
      case 'commentvalue':
      case 'comment_value':
        return 'commentValue';
      case 'comment':
      case 'additionalcomment':
        return 'additionalComment';
      case 'otherterms1':
      case 'othertermspayment':
        return 'otherTermsPayment';
      case 'documentsrequired':
      case 'documents':
        return 'documentsRequired';
      case 'shippingline':
        return 'shippingLine';
      case 'arbitration':
        return 'arbitration';
      case 'otherterms2':
      case 'containerstandards':
        return 'containerStandards';
      case 'forcemajeur':
        return 'forceMajeur';
      case 'confidentiality':
        return 'confidentiality';
      case 'notes':
        return 'notes';
      case 'sellersignaturefield':
      case 'exportertitle':
        return 'exporterTitle';
      case 'sellersignaturelabel':
      case 'exporterauthoritytitle':
        return 'exporterAuthorityTitle';
      case 'sellersignature':
      case 'exportersignature':
        return 'exporterSignature';
      case 'buyersignaturefield':
      case 'importertitle':
        return 'importerTitle';
      case 'buyersignaturelabel':
      case 'importerauthoritytitle':
        return 'importerAuthorityTitle';
      case 'buyersignature':
      case 'importersignature':
        return 'importerSignature';
      case 'pdftitle':
      case 'documenttitle':
        return 'documentTitle';
      default: {
        const detected = detectContractFieldInSentence(f);
        return detected ? detected.key : f;
      }
    }
  };

  const isGenericValidationString = (str: string): boolean => {
    const s = String(str || '').trim();
    return (
      /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
      /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
      /<(!DOCTYPE|html)/i.test(s) ||
      /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
      /^(not found|bad gateway|service unavailable)$/i.test(s)
    );
  };

  const ingestErrorItem = (fieldHint: string | undefined, msgVal: any): void => {
    if (!msgVal) return;

    if (Array.isArray(msgVal)) {
      for (const sub of msgVal) {
        ingestErrorItem(fieldHint, sub);
      }
      return;
    }

    if (typeof msgVal === 'object') {
      const fieldFromObj =
        msgVal.field ||
        msgVal.field_name ||
        msgVal.fieldName ||
        msgVal.param ||
        msgVal.name ||
        msgVal.column ||
        msgVal.property ||
        msgVal.key ||
        (Array.isArray(msgVal.path) ? msgVal.path.join('.') : msgVal.path);

      if (msgVal.constraints && typeof msgVal.constraints === 'object') {
        for (const constraintMsg of Object.values(msgVal.constraints)) {
          ingestErrorItem(fieldFromObj || fieldHint, constraintMsg);
        }
      }

      if (msgVal.children && Array.isArray(msgVal.children)) {
        for (const child of msgVal.children) {
          ingestErrorItem(undefined, child);
        }
      }

      const text = msgVal.message || msgVal.msg || msgVal.error || msgVal.text || msgVal.description;
      if (text) {
        ingestErrorItem(fieldFromObj || fieldHint, text);
      }
      return;
    }

    const rawStr = String(msgVal).trim();
    if (!rawStr) return;

    // Split compound sentences (e.g. "seller_instruction_id is required, buyer_instruction_id is required")
    const clauses = rawStr
      .split(/(?:,|\n|;)+/)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      if (isGenericValidationString(clause)) continue;

      let targetKey: string | null = null;
      if (fieldHint) {
        targetKey = mapFieldNameToErrorKey(fieldHint);
      }

      const detected = detectContractFieldInSentence(clause);
      if (detected) {
        targetKey = detected.key;
      } else if (!targetKey) {
        const keyFromClause = mapFieldNameToErrorKey(clause);
        if (keyFromClause && keyFromClause !== clause) {
          targetKey = keyFromClause;
        }
      }

      const cleanMsg = humanizeContractValidationMessage(clause, targetKey || undefined);
      if (!cleanMsg || isGenericValidationString(cleanMsg)) continue;

      if (targetKey) {
        if (!fieldErrors[targetKey]) {
          fieldErrors[targetKey] = cleanMsg;
        } else if (!fieldErrors[targetKey].includes(cleanMsg)) {
          fieldErrors[targetKey] = `${fieldErrors[targetKey]}, ${cleanMsg}`;
        }
      } else {
        if (!generalError && !isGenericValidationString(cleanMsg)) {
          generalError = cleanMsg;
        }
      }
    }
  };

  const candidates = [
    result.error_fields,
    result.data?.error_fields,
    result.raw?.error_fields,
    result.errors,
    result.data?.errors,
    result.raw?.errors,
    result.raw?.data?.error_fields,
    result.raw?.data?.errors,
    result.message,
    result.raw?.message,
    result.validation?.body,
    result.details,
    result.data,
    result.raw,
  ];

  for (const src of candidates) {
    if (!src) continue;

    if (Array.isArray(src)) {
      for (const item of src) {
        ingestErrorItem(undefined, item);
      }
      continue;
    }

    if (typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (['status', 'statusCode', 'success', 'code', 'stack', 'raw'].includes(k)) {
          continue;
        }
        if (k === 'message' || k === 'error') {
          ingestErrorItem(undefined, v);
          continue;
        }
        ingestErrorItem(k, v);
      }
    }
  }

  const rawMsg = result.error || result.message;
  if (rawMsg) {
    ingestErrorItem(undefined, rawMsg);
  }

  // If generalError happens to be generic, wipe it out
  if (generalError && isGenericValidationString(generalError)) {
    generalError = null;
  }

  if (!generalError && Object.keys(fieldErrors).length > 0) {
    generalError = Object.values(fieldErrors)[0];
  }

  return { fieldErrors, generalError };
}

export function getPartialLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function formatSplitNumber(val: any, index: number): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If it's already purely alphabetic (e.g. 'A', 'B', 'AA', 'AB')
    if (/^[A-Za-z]+$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    // If it has digits like "1", "27" or "Partial 1"
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly) {
      const num = parseInt(digitsOnly, 10);
      if (!isNaN(num) && num > 0) {
        return getPartialLabel(num - 1);
      }
    }
    const lettersOnly = trimmed.replace(/[^A-Za-z]/g, '').toUpperCase();
    const withoutPartial = lettersOnly.replace(/^PARTIAL/, '');
    if (withoutPartial && /^[A-Za-z]+$/.test(withoutPartial)) {
      return withoutPartial;
    }
  } else if (typeof val === 'number' && val > 0) {
    return getPartialLabel(val - 1);
  }
  return getPartialLabel(index);
}

export function parseInitialIsPartial(data: any): boolean | null {
  if (!data) return null;
  const raw =
    data.is_partial ??
    data.isPartial ??
    data.partial_shipment_allowed ??
    data.is_partial_allowed ??
    data.partial_shipment;
  return parseNullableBoolean(raw);
}

export function parseInitialIsBroker(data: any): boolean | null {
  if (!data || typeof data !== 'object') return null;
  const raw =
    data.is_broker ??
    data.isBroker ??
    data.sales_broker_allowed ??
    data.sales_broker ??
    data.broker_allowed ??
    data.is_sales_broker ??
    data.is_sales_broker_allowed ??
    data.has_broker ??
    data.has_sales_broker;

  const parsed = parseNullableBoolean(raw);
  if (parsed !== null) return parsed;

  // By default, sales broker is NOT allowed in contracts.
  // Never treat default template layout titles or signature field labels as an indicator of broker allowance.
  const hasRealBrokerDetails =
    Boolean(
      (typeof data.broker_name === 'string' && data.broker_name.trim()) ||
      (typeof data.sales_broker_name === 'string' && data.sales_broker_name.trim()) ||
      (typeof data.brokerName === 'string' && data.brokerName.trim())
    ) &&
    Boolean(
      data.broker_commission ||
      data.sales_broker_commission ||
      data.brokerCommission
    );

  if (hasRealBrokerDetails) {
    return true;
  }

  return null;
}

export function parseBrokerCommissionType(val: any): 'PERCENTAGE' | 'PMT' | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toUpperCase();
  if (!s || s === 'NULL' || s === 'UNDEFINED') return null;
  if (s === 'PMT' || s === 'PER_MT' || s === 'PER MT' || s === 'PER_TON' || s === 'PER TON') {
    return 'PMT';
  }
  if (s === 'PERCENTAGE' || s === '%' || s === 'PERCENT') {
    return 'PERCENTAGE';
  }
  return null;
}

export function parseInitialAdvanceType(data: any): 'PERCENTAGE' | 'AMOUNT' | null {
  if (!data || typeof data !== 'object') return null;
  const raw =
    data.advance_payment_type ??
    data.advancePaymentType ??
    data.advance_type ??
    data.advanceType;
  if (raw !== null && raw !== undefined) {
    const s = String(raw).trim().toUpperCase();
    if (s === 'PERCENTAGE' || s === '%' || s === 'PERCENT') return 'PERCENTAGE';
    if (s === 'AMOUNT' || s === 'FIXED' || s === 'AMT') return 'AMOUNT';
  }
  const pctVal =
    data.advance_payment_pct ??
    data.advancePaymentPct ??
    data.advance_percentage ??
    data.advancePercentage ??
    data.advance_pct;
  if (
    pctVal !== undefined &&
    pctVal !== null &&
    pctVal !== '' &&
    Number(pctVal) > 0
  ) {
    return 'PERCENTAGE';
  }
  const amtVal = data.advance_payment_amt ?? data.advance_payment ?? data.advance_amount ?? data.advanceAmount;
  if (amtVal !== undefined && amtVal !== null && amtVal !== '' && Number(amtVal) > 0) {
    return 'AMOUNT';
  }
  return null;
}

export function parseInitialSplitCount(data: any): string | number {
  if (!data) return '';
  const countRaw =
    data.split_count ??
    data.splitCount ??
    data.partial_count ??
    data.partialCount;
  if (countRaw !== undefined && countRaw !== null && String(countRaw).trim() !== '') {
    const count = parseInt(String(countRaw), 10);
    if (!isNaN(count) && count > 0) {
      return Math.min(count, 30);
    }
  }
  const rawSplits =
    data.splits ||
    data.contract?.splits ||
    data.split_list ||
    data.partial_breakdown ||
    data.partial_quantities;
  if (Array.isArray(rawSplits) && rawSplits.length > 0) {
    return Math.min(rawSplits.length, 30);
  }
  return '';
}

export function parseInitialSplits(data: any): ContractSplitItem[] {
  if (!data) return [];
  const rawSplits =
    data.splits ||
    data.contract?.splits ||
    data.split_list ||
    data.partial_breakdown ||
    data.partial_quantities;

  if (Array.isArray(rawSplits) && rawSplits.length > 0) {
    return rawSplits.slice(0, 30).map((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        const qty =
          item.fcl_quantity ??
          item.fclQuantity ??
          item.quantity ??
          item.qty ??
          '';
        const num =
          item.split_number ??
          item.splitNumber ??
          item.number ??
          item.label;
        return {
          ...item,
          split_number: formatSplitNumber(num, idx),
          fcl_quantity: qty !== undefined && qty !== null ? String(qty) : '',
        };
      }
      return {
        split_number: getPartialLabel(idx),
        fcl_quantity: item !== undefined && item !== null ? String(item) : '',
      };
    });
  }

  // If split_count exists but splits array is not provided
  const countRaw = data.split_count ?? data.splitCount ?? data.partial_count ?? data.partialCount;
  const count = parseInt(String(countRaw), 10);
  if (!isNaN(count) && count > 0) {
    const safeCount = Math.min(count, 30);
    const list: ContractSplitItem[] = [];
    for (let i = 0; i < safeCount; i++) {
      list.push({
        split_number: getPartialLabel(i),
        fcl_quantity: '',
      });
    }
    return list;
  }

  return [];
}

const DEFAULT_OTHER_TERMS_PAYMENT = `THE BUYER SHALL PAY 100% OF THE INVOICE WITHOUT ANY BANK CHARGES DEDUCTION FROM THE TOTAL AMOUNT. BANK CHARGES SHALL BE FOR BUYER'S ACCOUNT.
<ol>
  <li>IN CASE OF NON-PAYMENT AGAINST AT SIGHT FOR D/P THE CHARGES AT THE RATE OF 1% PER MONTH SHALL BE APPLICABLE.</li>
  <li>SUPPLIER NOT RESPONSIBLE FOR ANY LOSS OR DAMAGE DELAYED TO THE GOODS DUE TO CUSTOMS OR PORT PROCEDURES.</li>
</ol>`;

const DEFAULT_CONTAINER_TERMS = `<ol>
  <li>02% EMPTY BAGS WILL BE ADDED IN PER CONTAINER</li>
  <li>SILICA &amp; FULL SIDE CRAFT PAPER WILL BE USED PER REQUIRED STANDARD</li>
  <li>PLASTIC SHEET AT CONTAINER DOOR SIDE</li>
</ol>`;

const DEFAULT_FORCE_MAJEUR = `BOTH BUYER AND SELLER SHALL NOT BE LIABLE FOR DELAY OR NON-PERFORMANCE IN WHOLE OR IN PART OF HIS CONTRACTUAL OBLIGATION IN CONSEQUENCES OF WAR, BLOCKADE, REVOLUTION, INSURRECTION, CIVIL COMMOTION, RIOTS MOBILIZATION, ACT OF GOVERNMENT, ACT OF GOD, PLAGUE OR OTHER EPIDEMIC, FIRE , PORT CONGESTION/DROUGHT, ANY SHIPPING LINE ISSUES, MODIFICATION IN COMMERCIAL LAWS AND REGULATIONS BY THE GOVERNMENT ETC.`;

const DEFAULT_CONFIDENTIALITY = `THIS CONTRACT AND INFORMATION RELATED ONLY THERETO, SHALL BE HELD STRICTLY CONFIDENTIAL AND BUYER IS BOUND WORK TROUGH BROKER ONLY AND SELLER IS BOUND TO WORK TROUGH BROKER ONLY IF ANY PARTIES WILL BREACH BY WORKING DIRECT OR INDIRECT, WE WILL TAKE SUITABLE ACTION ACCORDINGLY WITH BROKERS SAFETY PROTECTION CLAUSE AND SHALL NOT BE DISCLOSED BY THE BUYER/SELLER TO ANY THIRD PARTY UNLESS SPECIFICALLY AUTHORIZED IN WRITING BY THE BROKER/SELLER/BUYER, OR REQUIRED/REQUESTED BY LAW OR ARBITRATION/ COMPETENT AUTHORITY IN CASE OF DISPUTE`;

export function normalizeFclType(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim().toUpperCase();
  if (s.includes('VESSEL') || s.includes('BREAK BULK') || s.includes('BREAKBULK') || s.includes('BULK')) {
    return 'VESSEL';
  }
  if (s.includes('40')) return 'FCL_40_FT';
  if (s.includes('20')) return 'FCL_20_FT';
  return '';
}

function isFclType(val?: string | null): boolean {
  if (!val) return true;
  const s = String(val).toUpperCase().trim();
  return s.includes('20') || s.includes('40') || s.includes('CONTAINER') || s.includes('FCL');
}

export function isRawDbId(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (!s || s === '[object Object]' || s === 'undefined' || s === 'null') return true;
  // CUID or CUID2 (e.g. c..., cm..., cl...)
  if (/^c[a-z0-9]{15,36}$/i.test(s)) return true;
  // Standard UUID (8-4-4-4-12)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  // Hex strings of 16-64 chars (e.g. Mongo ObjectId 24-char, MD5, SHA)
  if (/^[0-9a-f]{16,64}$/i.test(s)) return true;
  // Generic DB ID / hash / token with no spaces, 14+ alphanumeric chars
  if (!s.includes(' ') && s.length >= 14 && /^[a-z0-9_-]+$/i.test(s)) return true;
  // Common entity ID prefixes: prod_..., port_..., user_..., etc.
  if (/^(usr|user|prod|product|seller|buyer|party|port|pack|pay|conf|cont|doc)_[a-z0-9_-]+$/i.test(s)) return true;
  return false;
}

export function toCleanText(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t || t === '[object Object]' || t === 'undefined' || t === 'null') return '';
    return val;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const candidate =
      val.text ||
      val.instructionText ||
      val.instruction ||
      val.details ||
      val.comment ||
      val.notes ||
      val.description ||
      val.label ||
      val.name ||
      '';
    if (candidate && typeof candidate === 'string' && candidate !== '[object Object]') {
      return candidate;
    }
  }
  return '';
}

function toCleanLabel(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') return '';
    if (isRawDbId(trimmed)) return ''; // Never return a raw DB ID as a human display label
    return trimmed;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const label = (
      val.label ||
      val.port_name ||
      val.portName ||
      val.packing_type ||
      val.packingType ||
      val.company_name ||
      val.product_name ||
      val.name ||
      val.title ||
      val.code ||
      ''
    );
    const clean = typeof label === 'string' ? label.trim() : String(label || '');
    if (isRawDbId(clean)) return '';
    return clean;
  }
  return '';
}

function cleanShippingInstruction(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') return '';
    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
      return trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }
    return trimmed;
  }
  return toCleanText(val);
}

function parseAnyLoadingPort(data: any): boolean | null {
  if (!data || typeof data !== 'object') return null;
  const raw =
    data.any_loading_port ??
    data.anyLoadingPort ??
    data.is_any_loading_port ??
    data.isAnyLoadingPort ??
    data.contract?.any_loading_port ??
    data.contract?.anyLoadingPort ??
    data.data?.any_loading_port ??
    data.data?.anyLoadingPort;

  if (raw === undefined || raw === null || raw === '') return null;
  if (raw === true || raw === 1 || raw === 'true' || raw === '1') return true;
  if (raw === false || raw === 0 || raw === 'false' || raw === '0') return false;
  return null;
}

function getFallbackPortName(data: any, currentPortIdOrVal?: string): string {
  if (data && typeof data === 'object') {
    if (data.loading_port && typeof data.loading_port === 'object') {
      const portObj = data.loading_port;
      const name = portObj.label || portObj.name || portObj.port_name || portObj.title;
      const country = portObj.country || portObj.country_name || portObj.countryName;
      const countryStr = typeof country === 'string' ? country.trim() : (country?.name || country?.title || '');
      if (name && !isRawDbId(name)) {
        const cleanName = String(name).trim();
        return countryStr && !cleanName.toLowerCase().includes(countryStr.toLowerCase())
          ? `${cleanName}, ${countryStr}`
          : cleanName;
      }
    }
    const directName =
      data.loading_port_name ||
      data.loadingPortName ||
      data.loading_port_country_name ||
      data.loadingPortCountryName;
    if (directName && typeof directName === 'string' && !isRawDbId(directName)) {
      return directName.trim();
    }
    if (typeof data.loading_port === 'string' && !isRawDbId(data.loading_port)) {
      return data.loading_port.trim();
    }
    if (typeof data.loadingPort === 'string' && !isRawDbId(data.loadingPort)) {
      return data.loadingPort.trim();
    }
  }
  if (currentPortIdOrVal && !isRawDbId(currentPortIdOrVal)) {
    return currentPortIdOrVal.trim();
  }
  return '';
}

function getPortDisplayName(portIdOrVal: string, list: FormOptionItem[]): string {
  if (!portIdOrVal) return '';
  const item = list.find(
    (p) =>
      String(p.value).toLowerCase() === String(portIdOrVal).toLowerCase() ||
      String(p.id || '').toLowerCase() === String(portIdOrVal).toLowerCase() ||
      String(p._id || '').toLowerCase() === String(portIdOrVal).toLowerCase() ||
      String(p.label).toLowerCase() === String(portIdOrVal).toLowerCase()
  );
  if (item?.label && !isRawDbId(item.label)) return item.label;
  if (item?.name && !isRawDbId(item.name)) return item.name;
  return !isRawDbId(portIdOrVal) ? portIdOrVal : '';
}

function getFallbackSellerOption(data: any, currentId?: string): FormOptionItem | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data.seller || data.seller_instruction || data.seller_instruction_id;
  const sId = currentId || toCleanId(raw) || toCleanId(data.seller_instruction_id || data.sellerId);
  let label = '';
  let instructionText = '';
  if (typeof raw === 'object' && raw) {
    label = toCleanLabel(raw.company_name || raw.label || raw.name || raw.title || '');
    instructionText = toCleanLabel(raw.instructionText || raw.details || raw.address || raw.instruction || '');
  } else if (typeof raw === 'string' && raw.trim()) {
    const lines = raw.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 0 && !isRawDbId(lines[0])) {
      label = lines[0];
      instructionText = raw.trim();
    }
  }
  if (!label) {
    label = toCleanLabel(data.seller_name || data.sellerName || data.seller_company_name || data.exporter_name || '');
  }
  if (!instructionText) {
    instructionText = toCleanLabel(data.seller_instruction || data.seller_address || '');
  }
  if (!label && instructionText) {
    label = instructionText.split('\n')[0].trim();
  }
  if (sId && label && !isRawDbId(label)) {
    return {
      value: sId,
      id: sId,
      label,
      instructionText: instructionText || label,
    };
  }
  return null;
}

function getFallbackBuyerOption(data: any, currentId?: string): FormOptionItem | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data.buyer || data.buyer_instruction || data.buyer_instruction_id;
  const bId = currentId || toCleanId(raw) || toCleanId(data.buyer_instruction_id || data.buyerId);
  let label = '';
  let instructionText = '';
  if (typeof raw === 'object' && raw) {
    label = toCleanLabel(raw.company_name || raw.label || raw.name || raw.title || '');
    instructionText = toCleanLabel(raw.instructionText || raw.details || raw.address || raw.instruction || '');
  } else if (typeof raw === 'string' && raw.trim()) {
    const lines = raw.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 0 && !isRawDbId(lines[0])) {
      label = lines[0];
      instructionText = raw.trim();
    }
  }
  if (!label) {
    label = toCleanLabel(data.buyer_name || data.buyerName || data.buyer_company_name || data.importer_name || '');
  }
  if (!instructionText) {
    instructionText = toCleanLabel(data.buyer_instruction || data.buyer_address || '');
  }
  if (!label && instructionText) {
    label = instructionText.split('\n')[0].trim();
  }
  if (bId && label && !isRawDbId(label)) {
    return {
      value: bId,
      id: bId,
      label,
      instructionText: instructionText || label,
    };
  }
  return null;
}

function getFallbackProductOption(data: any, currentId?: string): FormOptionItem | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data.product || data.product_id;
  const pId = currentId || toCleanId(raw) || toCleanId(data.product_id || data.productId);
  let label = '';
  let hsn = '';
  let country = '';
  let spec = '';
  if (typeof raw === 'object' && raw) {
    label = toCleanLabel(raw.name || raw.product_name || raw.label || raw.title || '');
    hsn = normalizeHsnString(raw.hsn_code || raw.hsn || '');
    country = normalizeCountryString(raw.country || raw.origin_country || '');
    spec = toCleanLabel(raw.quality_specification || raw.specification || '');
  }
  if (!label) {
    label = toCleanLabel(data.product_name || data.productName || '');
  }
  if (pId && label && !isRawDbId(label)) {
    return {
      value: pId,
      id: pId,
      label,
      hsn,
      country,
      spec,
    };
  }
  return null;
}

function getFallbackDestinationPortName(data: any, currentPortIdOrVal?: string): string {
  if (data && typeof data === 'object') {
    if (data.destination_port && typeof data.destination_port === 'object') {
      const portObj = data.destination_port;
      const name = portObj.label || portObj.name || portObj.port_name || portObj.title;
      const country = portObj.country || portObj.country_name || portObj.countryName;
      const countryStr = typeof country === 'string' ? country.trim() : (country?.name || country?.title || '');
      if (name && !isRawDbId(name)) {
        const cleanName = String(name).trim();
        return countryStr && !cleanName.toLowerCase().includes(countryStr.toLowerCase())
          ? `${cleanName}, ${countryStr}`
          : cleanName;
      }
    }
    const directName =
      data.destination_port_name ||
      data.destinationPortName ||
      data.destination_port_country_name ||
      data.destinationPortCountryName;
    if (directName && typeof directName === 'string' && !isRawDbId(directName)) {
      return directName.trim();
    }
    if (typeof data.destination_port === 'string' && !isRawDbId(data.destination_port)) {
      return data.destination_port.trim();
    }
    if (typeof data.destinationPort === 'string' && !isRawDbId(data.destinationPort)) {
      return data.destinationPort.trim();
    }
  }
  if (currentPortIdOrVal && !isRawDbId(currentPortIdOrVal)) {
    return currentPortIdOrVal.trim();
  }
  return '';
}

function getFallbackPackingName(data: any, currentPackingIdOrVal?: string): string {
  if (data && typeof data === 'object') {
    if (data.packing_type && typeof data.packing_type === 'object') {
      const pObj = data.packing_type;
      const name = pObj.label || pObj.name || pObj.title || pObj.packing_type || pObj.type;
      if (name && !isRawDbId(name)) return String(name).trim();
    }
    const directName =
      data.packing_type_name ||
      data.packingTypeName ||
      data.packing_name ||
      data.packingName;
    if (directName && typeof directName === 'string' && !isRawDbId(directName)) {
      return directName.trim();
    }
    if (typeof data.packing_type === 'string' && !isRawDbId(data.packing_type)) {
      return data.packing_type.trim();
    }
    if (typeof data.packing === 'string' && !isRawDbId(data.packing)) {
      return data.packing.trim();
    }
  }
  if (currentPackingIdOrVal && !isRawDbId(currentPackingIdOrVal)) {
    return currentPackingIdOrVal.trim();
  }
  return '';
}

function getFallbackPaymentTermName(data: any, currentIdOrVal?: string): string {
  if (data && typeof data === 'object') {
    if (data.payment_term && typeof data.payment_term === 'object') {
      const pObj = data.payment_term;
      const name = pObj.label || pObj.name || pObj.title;
      if (name && !isRawDbId(name)) return String(name).trim();
    }
    const directName =
      data.payment_term_name ||
      data.paymentTermName ||
      data.payment_name;
    if (directName && typeof directName === 'string' && !isRawDbId(directName)) {
      return directName.trim();
    }
    if (typeof data.payment_term === 'string' && !isRawDbId(data.payment_term)) {
      return data.payment_term.trim();
    }
    if (typeof data.paymentTerm === 'string' && !isRawDbId(data.paymentTerm)) {
      return data.paymentTerm.trim();
    }
  }
  if (currentIdOrVal && !isRawDbId(currentIdOrVal)) {
    return currentIdOrVal.trim();
  }
  return '';
}

function toCleanId(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '[object Object]' ? '' : trimmed;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return (
      val.id ||
      val._id ||
      val.contract_id ||
      val.contractId ||
      val.confirmation_id ||
      val.confirmationId ||
      val.product_id ||
      val.value ||
      val.code ||
      ''
    );
  }
  return '';
}

function formatNumberWithCommas(num: number | string): string {
  if (num === '' || num === null || num === undefined) return '-';
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Safely parses nullable boolean values without coercing null/undefined to false.
 * Returns null if the value is null, undefined, empty string, or not explicitly filled.
 */
export function parseNullableBoolean(val: any): boolean | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') {
    if (val === 1) return true;
    if (val === 0) return false;
    return null;
  }
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'allowed' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'not allowed' || s === 'not_allowed' || s === 'no') return false;
    return null;
  }
  return null;
}

/**
 * Parses default_documents from contract API response:
 * - Can be an array of strings, array of objects, HTML list (<ol><li>...</li></ol>), or comma/newline-separated string.
 */
export function parseDefaultDocuments(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((item) =>
        typeof item === 'string'
          ? item.trim()
          : (item?.name || item?.document_name || item?.title || item?.label || '').trim()
      )
      .filter(Boolean);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parseDefaultDocuments(parsed);
      } catch {}
    }
    if (trimmed.includes('<li>')) {
      const items: string[] = [];
      const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let match;
      while ((match = regex.exec(trimmed)) !== null) {
        const text = match[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (text) items.push(text);
      }
      if (items.length > 0) return items;
    }
    return trimmed
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Extracts and resolves documents from contract API response:
 * - Maps document IDs and object items against master document options (documentsList)
 * - Retains custom / extra contract documents that are not in the standard dropdown options
 * - Returns normalized array of document name strings
 */
export function extractAndResolveContractDocuments(
  data: any,
  optionsList: SmartDocsSelectionDocumentOption[] = []
): string[] {
  if (!data || typeof data !== 'object') return [];

  const rawCandidates = [
    data.documents_required,
    data.documentsRequired,
    data.required_documents,
    data.requiredDocuments,
    data.documents,
    data.document_list,
    data.documents_list,
    data.documentList,
    data.documentsList,
    data.contract_documents,
    data.contractDocuments,
    data.default_documents,
    data.defaultDocuments,
    data.document_ids,
    data.documentIds,
    data.docs,
  ];

  let rawList: any[] = [];
  for (const c of rawCandidates) {
    if (Array.isArray(c) && c.length > 0) {
      rawList = c;
      break;
    } else if (typeof c === 'string' && c.trim()) {
      try {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rawList = parsed;
          break;
        }
      } catch {
        const split = c.split(',').map((s) => s.trim()).filter(Boolean);
        if (split.length > 0) {
          rawList = split;
          break;
        }
      }
    }
  }

  if (rawList.length === 0) return [];

  const resolvedDocs: string[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    if (!item) continue;

    let candidateName = '';
    let candidateId = '';

    if (typeof item === 'string') {
      const trimmed = item.trim();
      candidateName = trimmed;
      candidateId = trimmed;
    } else if (typeof item === 'object') {
      candidateName = String(
        item.document_name ||
        item.name ||
        item.title ||
        item.label ||
        item.doc_name ||
        item.documentTitle ||
        ''
      ).trim();

      candidateId = toCleanId(
        item.id ||
        item._id ||
        item.document_id ||
        item.doc_id ||
        item.documentId ||
        item.value
      );
    }

    // Attempt to match with optionsList (master list from /document-list/for-selection or default options)
    let matchedOption: SmartDocsSelectionDocumentOption | undefined;

    if (candidateId) {
      matchedOption = optionsList.find(
        (opt) =>
          String(opt.id || '').trim().toLowerCase() === candidateId.toLowerCase() ||
          String(opt.value || '').trim().toLowerCase() === candidateId.toLowerCase() ||
          String(opt._id || '').trim().toLowerCase() === candidateId.toLowerCase()
      );
    }

    if (!matchedOption && candidateName) {
      matchedOption = optionsList.find(
        (opt) =>
          String(opt.name || '').trim().toLowerCase() === candidateName.toLowerCase() ||
          String(opt.label || '').trim().toLowerCase() === candidateName.toLowerCase()
      );
    }

    const finalName = matchedOption
      ? (matchedOption.name || matchedOption.label || candidateName)
      : (candidateName && !isRawDbId(candidateName) ? candidateName : candidateId);

    if (finalName && !seen.has(finalName.toUpperCase())) {
      seen.add(finalName.toUpperCase());
      resolvedDocs.push(finalName);
    }
  }

  return resolvedDocs;
}

export function ContractDocumentForm({
  initialData,
  dataVersion,
  contractId: contractIdProp,
  steps = [],
  selectedStep = null,
  onUpdateSteps,
  onSelectStep,
  sellers = [],
  buyers = [],
  products = [],
  loadingPorts = [],
  destinationPorts = [],
  packingOptions = [],
  shippingTerms = DEFAULT_SHIPPING_TERMS,
  currencies = DEFAULT_CURRENCIES,
  paymentTerms = DEFAULT_PAYMENT_TERMS,
  documentsList = [],
  onSaveDraft,
  onSaveSuccess,
  onSubmitContract,
  lang = 'en',
  dict,
  readOnly = false,
}: ContractDocumentFormProps) {
  // Helper to check for invalid placeholder IDs like "contract", "sales-contract", etc.
  const isInvalidPlaceholder = useCallback((val?: string | null): boolean => {
    if (!val) return true;
    const clean = String(val).trim().toLowerCase();
    return (
      clean === '' ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        clean
      )
    );
  }, []);

  // Safely resolve Confirmation ID (if opened from or attached to a confirmation)
  const confirmationId = toCleanId(
    initialData?.confirmation_id ||
    initialData?.confirmationId ||
    (initialData?.confirmation && typeof initialData.confirmation === 'object' ? initialData.confirmation.id || initialData.confirmation._id : '') ||
    // If initialData is a confirmation record (not a standalone contract)
    (!initialData?.contract_id && !initialData?.contractId && (initialData?.confirmation_number || initialData?.confirmation_date) ? initialData?.id || initialData?._id : '') ||
    (initialData?.confirmation_number || initialData?.confirmation_date ? initialData?.id || initialData?._id : '')
  );

  // Saved Draft / Contract ID (from Stepper / API)
  const [draftId, setDraftId] = useState<string>(() => {
    // 1. Explicit contractId prop
    if (contractIdProp && !isInvalidPlaceholder(contractIdProp)) {
      return contractIdProp.trim();
    }
    // 2. Extracted directly from Stepper list / selectedStep (user: "id tumhe stepper se milegi")
    const stepContract = getContractStep(steps, selectedStep);
    const stepperId = extractStepId(stepContract);
    if (stepperId && !isInvalidPlaceholder(stepperId)) {
      return stepperId.trim();
    }
    // 3. From initialData if strictly contract data
    const cid = toCleanId(
      initialData?.contract_id ||
      initialData?.contractId ||
      (initialData?.contract && typeof initialData.contract === 'object' ? initialData.contract.id || initialData.contract._id : '')
    );
    if (cid && !isInvalidPlaceholder(cid)) return cid.trim();
    const isExplicitContract = Boolean(
      initialData?.contract_number ||
      initialData?.contract_date ||
      initialData?.sales_contract_id ||
      initialData?._is_contract_loaded
    );
    if (isExplicitContract && initialData?.id && !isInvalidPlaceholder(initialData.id)) {
      return toCleanId(initialData.id);
    }
    if (isExplicitContract && initialData?._id && !isInvalidPlaceholder(initialData._id)) {
      return toCleanId(initialData._id);
    }
    return '';
  });

  // Document Status: 'PENDING' shows Save As Draft; 'COMPLETED' strictly hides Save As Draft
  const contractStepItem = getContractStep(steps, selectedStep);
  const [docStatus, setDocStatus] = useState<string>(() => {
    // 1. Check if contract step in stepper is completed
    if (contractStepItem) {
      const norm = normalizeStepStatus(contractStepItem.status || contractStepItem.document_status || contractStepItem.step_status);
      if (norm === 'completed') return 'COMPLETED';
    }
    // 2. Check initialData status ONLY if initialData represents a Contract (not an inherited Confirmation)
    const isExplicitContract = Boolean(
      initialData?.contract_number ||
      initialData?.contract_id ||
      initialData?.contractId ||
      initialData?.contract ||
      (initialData && !initialData.confirmation_number && !initialData.confirmation_id && initialData.status)
    );
    if (isExplicitContract) {
      const fromData = extractDocumentStatus(initialData);
      if (fromData) return fromData;
    }
    return 'PENDING';
  });

  // User interaction & dirty state tracking:
  // - hasDraftChanges: enabled only if user made edits since opening or since last successful draft save
  // - hasSubmitChanges: enabled if user made edits, or if an unconfirmed contract draft is already available to submit
  const [hasDraftChanges, setHasDraftChanges] = useState<boolean>(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState<boolean>(() => {
    const isExplicitContract = Boolean(
      initialData?.contract_number ||
      initialData?.contract_id ||
      initialData?.contractId ||
      initialData?.contract ||
      (initialData && !initialData.confirmation_number && !initialData.confirmation_id && initialData.status)
    );
    const statusFromData = isExplicitContract ? extractDocumentStatus(initialData) : 'PENDING';
    const isCompleted =
      statusFromData === 'COMPLETED' ||
      (contractStepItem && normalizeStepStatus(contractStepItem.status || contractStepItem.document_status || contractStepItem.step_status) === 'completed');
    const hasContractId = Boolean(
      contractIdProp ||
      initialData?.contract_id ||
      initialData?.contractId ||
      (initialData?.contract && typeof initialData.contract === 'object' ? initialData.contract.id || initialData.contract._id : '')
    );
    return hasContractId && !isCompleted;
  });

  const markDirty = useCallback(() => {
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Guard against blinking: if contract ID exists but data/status is still loading/unknown, wait with a smooth skeleton
  const [statusLoadTimedOut, setStatusLoadTimedOut] = useState<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => setStatusLoadTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const isStatusLoading = !statusLoadTimedOut && Boolean(
    (contractIdProp || draftId || confirmationId) &&
    !initialData &&
    !steps?.some((s) => isContractStep(s) && (s.status || s.document_status || s.step_status))
  );

  useEffect(() => {
    const currentStep = getContractStep(steps, selectedStep);
    if (currentStep) {
      const norm = normalizeStepStatus(currentStep.status || currentStep.document_status || currentStep.step_status);
      if (norm === 'completed') {
        setDocStatus('COMPLETED');
        return;
      }
    }
    const isExplicitContract = Boolean(
      initialData?.contract_number ||
      initialData?.contract_id ||
      initialData?.contractId ||
      initialData?.contract ||
      (initialData && !initialData.confirmation_number && !initialData.confirmation_id && initialData.status)
    );
    if (isExplicitContract) {
      const fromData = extractDocumentStatus(initialData);
      if (fromData) {
        setDocStatus(fromData);
      }
    }
  }, [initialData, steps, selectedStep]);

  // Keep draftId synced whenever stepper steps or contractId prop updates
  useEffect(() => {
    if (contractIdProp && !isInvalidPlaceholder(contractIdProp)) {
      setDraftId(contractIdProp.trim());
      return;
    }
    const stepContract = getContractStep(steps, selectedStep);
    const stepperId = extractStepId(stepContract);
    if (stepperId && !isInvalidPlaceholder(stepperId)) {
      setDraftId(stepperId.trim());
    }
  }, [contractIdProp, steps, selectedStep, isInvalidPlaceholder]);

  // Track document ID to prevent background RSC / API re-renders from wiping active user edits
  const lastLoadedDocIdRef = useRef<string>(
    toCleanId(
      contractIdProp ||
      initialData?.id ||
      initialData?._id ||
      initialData?.contract_id ||
      initialData?.contractId
    )
  );
  const isFormInitializedRef = useRef<boolean>(false);
  const lastDataVersionRef = useRef<number>(dataVersion ?? 0);

  // Top Header Configuration
  const [letterhead, setLetterhead] = useState<boolean>(
    initialData?.letterhead_space !== undefined
      ? Boolean(initialData.letterhead_space)
      : Boolean(initialData?.letterhead ?? false)
  );
  const [watermark, setWatermark] = useState<boolean>(
    initialData?.is_watermark_enabled !== undefined
      ? Boolean(initialData.is_watermark_enabled)
      : Boolean(initialData?.watermark ?? false)
  );
  const [documentTitle, setDocumentTitle] = useState<string>(
    () =>
      toCleanLabel(initialData?.pdf_title || initialData?.pdfTitle || initialData?.documentTitle || initialData?.title) ||
      dict?.smart_docs?.contract_form?.contract_title ||
      'CONTRACT'
  );

  // ROW 1: Confirmation Number & Date (Clean static, filled by backend/user)
  const [confirmationNumber, setConfirmationNumber] = useState<string>(
    () => toCleanLabel(initialData?.confirmation_number || initialData?.confirmationNumber) || ''
  );
  const [confirmationDate, setConfirmationDate] = useState<string>(() => {
    const raw = toCleanLabel(initialData?.confirmation_date || initialData?.confirmationDate);
    return raw && raw.includes('T') ? raw.split('T')[0] : raw;
  });

  // ROW 2: Contract Number & Date (User enters/selects or from backend)
  const [contractNumber, setContractNumber] = useState<string>(
    () => toCleanLabel(initialData?.contract_number || initialData?.contractNumber) || ''
  );
  const contractInputRef = useRef<HTMLInputElement>(null);
  const [contractDate, setContractDate] = useState<string>(() => {
    const raw = toCleanLabel(initialData?.contract_date || initialData?.contractDate);
    return raw && raw.includes('T') ? raw.split('T')[0] : raw;
  });

  // ROW 3: Parties Header
  const [partiesHeader, setPartiesHeader] = useState<string>(
    () => toCleanLabel(initialData?.parties_header || initialData?.partiesHeader) || 'THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES'
  );

  // ROW 4: Exporter (Seller) & Importer (Buyer)
  const [sellerId, setSellerId] = useState<string>(() =>
    toCleanId(initialData?.seller_instruction_id || initialData?.sellerId || initialData?.seller_id || initialData?.seller)
  );
  const [sellerInstruction, setSellerInstruction] = useState<string>(() =>
    toCleanText(initialData?.seller_instruction || initialData?.sellerInstruction || (typeof initialData?.seller === 'object' ? initialData.seller.instructionText || initialData.seller.details : ''))
  );
  const [buyerId, setBuyerId] = useState<string>(() =>
    toCleanId(initialData?.buyer_instruction_id || initialData?.buyerId || initialData?.buyer_id || initialData?.buyer)
  );
  const [buyerInstruction, setBuyerInstruction] = useState<string>(() =>
    toCleanText(initialData?.buyer_instruction || initialData?.buyerInstruction || (typeof initialData?.buyer === 'object' ? initialData.buyer.instructionText || initialData.buyer.details : ''))
  );

  // ROW 5: Shipping Instruction (Mapped from terms_and_condition from API response)
  const [shippingInstruction, setShippingInstruction] = useState<string>(
    () =>
      cleanShippingInstruction(
        initialData?.terms_and_condition ||
        initialData?.terms_and_conditions ||
        initialData?.termsAndCondition ||
        initialData?.termsAndConditions ||
        initialData?.shipping_instruction ||
        initialData?.shippingInstruction ||
        initialData?.contract?.terms_and_condition ||
        initialData?.contract?.shipping_instruction
      ) || ''
  );

  // ROW 6: Product, HSN, Country
  const [productId, setProductId] = useState<string>(() =>
    toCleanId(initialData?.product_id || initialData?.productId || initialData?.product)
  );
  const [hsnCode, setHsnCode] = useState<string>(() =>
    normalizeHsnString(initialData?.hsn_code || initialData?.hsnCode || initialData?.hsn || (typeof initialData?.product === 'object' ? initialData.product.hsn || initialData.product.hsn_code : ''))
  );
  const [productCountry, setProductCountry] = useState<string>(() =>
    normalizeCountryString(initialData?.country || initialData?.productCountry || initialData?.product_country || (typeof initialData?.product === 'object' ? initialData.product.country || initialData.product.origin_country : ''))
  );

  // ROW 7: Specification
  const [specification, setSpecification] = useState<string>(() =>
    toCleanText(initialData?.quality_specification || initialData?.specification || (typeof initialData?.product === 'object' ? initialData.product.specification || initialData.product.quality_specification : ''))
  );

  // ROW 8: Shipment Period
  const [shipmentRange, setShipmentRange] = useState<{ start: Date | null; end: Date | null }>({
    start: initialData?.shipment_start_date || initialData?.shipmentStartDate
      ? new Date(initialData.shipment_start_date || initialData.shipmentStartDate)
      : null,
    end: initialData?.shipment_end_date || initialData?.shipmentEndDate
      ? new Date(initialData.shipment_end_date || initialData.shipmentEndDate)
      : null,
  });

  // ROW 9: Payment Term
  const [paymentTerm, setPaymentTerm] = useState<string>(() => {
    const raw = initialData?.payment_term_id || initialData?.paymentTermId || initialData?.paymentTerm || initialData?.payment_term;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // ROW 10: FCL Type
  const [fclType, setFclType] = useState<string>(() => {
    const raw = initialData?.fcl_type || initialData?.fclType || initialData?.ship_by || initialData?.shipBy;
    return normalizeFclType(raw);
  });
  const isFcl = isFclType(fclType);

  const handleFclTypeChange = (val: string) => {
    markDirty();
    setFclType(val);
    setErrors((prev) => ({ ...prev, fclType: '', fclQty: '', fclCapacity: '', mtQty: '' }));
    if (!isFclType(val)) {
      setFclQty('');
      setFclCapacity('');
    }
  };

  // ROW 11: Packing
  const [packing, setPacking] = useState<string>(() => {
    const raw = initialData?.packing_type_id || initialData?.packingTypeId || initialData?.packing_type || initialData?.packing;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // ROW 12: Marking Brand
  const [markingBrand, setMarkingBrand] = useState<string>(() => {
    return toCleanLabel(initialData?.marking_brand || initialData?.markingBrand || initialData?.brand) || '';
  });

  // ROW 13: Loading Port & Country
  const [loadingPort, setLoadingPort] = useState<string>(() => {
    const raw = initialData?.loadingPort || initialData?.loading_port_id || initialData?.loadingPortId || initialData?.loading_port;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // ROW 14: Loading Condition (Selected based on any_loading_port: true -> 'Any Port Of Loading', false -> port name)
  const [loadingCondition, setLoadingCondition] = useState<string>(() => {
    const anyPortFlag = parseAnyLoadingPort(initialData);
    if (anyPortFlag === true) {
      return DEFAULT_FIXED_LOADING_CONDITION.value;
    }
    const rawPort = initialData?.loadingPort || initialData?.loading_port_id || initialData?.loadingPortId || initialData?.loading_port;
    const cleanPortId = toCleanId(rawPort) || toCleanLabel(rawPort);
    const portName = getFallbackPortName(initialData, cleanPortId);
    if (anyPortFlag === false && portName && !isRawDbId(portName)) {
      return portName;
    }
    const init = initialData?.loading_condition || initialData?.loadingCondition;
    if (init && init !== 'Select Loading Condition') return String(init).trim();
    if (portName && !isRawDbId(portName)) return portName;
    return '';
  });

  // ROW 15: Destination Port & Country
  const [destinationPort, setDestinationPort] = useState<string>(() => {
    const raw = initialData?.destinationPort || initialData?.destination_port_id || initialData?.destinationPortId || initialData?.destination_port;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // ROW 16: Matrix Calculation (FCL Qty, Capacity, MT Qty, Bag Qty, Currency, Price, Total Value)
  const [fclQty, setFclQty] = useState<string | number>(
    initialData?.fcl_quantity ?? initialData?.fcl_qty ?? initialData?.fclQty ?? ''
  );
  const [fclCapacity, setFclCapacity] = useState<string | number>(
    initialData?.fcl_capacity ?? initialData?.fclCapacity ?? ''
  );
  const [mtQty, setMtQty] = useState<string | number>(
    initialData?.mt_quantity ?? initialData?.mt_qty ?? initialData?.mtQty ?? ''
  );
  const [bagQty, setBagQty] = useState<string | number>(
    initialData?.bag_quantity ?? initialData?.bag_qty ?? initialData?.bagQty ?? ''
  );
  const [currency, setCurrency] = useState<string>(() => {
    const raw =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.currencyCode ||
      initialData?.currency_id ||
      initialData?.currencyId;
    const baseList =
      currencies && currencies.length > 0
        ? currencies
        : initialData?.currencies && Array.isArray(initialData.currencies)
        ? initialData.currencies
        : initialData?.currenciesList && Array.isArray(initialData.currenciesList)
        ? initialData.currenciesList
        : DEFAULT_CURRENCIES;
    const resolved = normalizeCurrencyOption(raw, baseList);
    return resolved.value || 'USD';
  });
  const [currencyId, setCurrencyId] = useState<string>(() => {
    const cId = toCleanId(
      initialData?.currency_id ||
      initialData?.currencyId ||
      (typeof initialData?.currency === 'object' ? initialData.currency?.id || initialData.currency?._id : '')
    );
    if (cId) return cId;
    const baseList =
      currencies && currencies.length > 0
        ? currencies
        : initialData?.currencies && Array.isArray(initialData.currencies)
        ? initialData.currencies
        : initialData?.currenciesList && Array.isArray(initialData.currenciesList)
        ? initialData.currenciesList
        : DEFAULT_CURRENCIES;
    const resolved = normalizeCurrencyOption(
      initialData?.currency || initialData?.currency_code || initialData?.currency_id || initialData?.currencyId,
      baseList
    );
    return resolved.id || '';
  });
  const [price, setPrice] = useState<string | number>(
    initialData?.price ?? initialData?.rate ?? ''
  );
  const [totalValue, setTotalValue] = useState<string | number>(
    initialData?.total_value ?? initialData?.totalValue ?? ''
  );

  // ROW 17: Inspection
  const [inspection, setInspection] = useState<string>(() => {
    return toCleanLabel(initialData?.inspection) || '';
  });

  // ROW 18: Incoterm
  const [incoterm, setIncoterm] = useState<string>(() => {
    const raw = initialData?.incoterm || initialData?.shipping_term || initialData?.shippingTerm;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // ROW 19: Insurance (FOB/CNF -> BUYER, CIF -> SELLER)
  const [insurance, setInsurance] = useState<string>(() => {
    const rawInit = initialData?.insurance;
    if (rawInit && typeof rawInit === 'string' && rawInit.trim()) {
      return rawInit.trim().toUpperCase();
    }
    const initIncoterm = initialData?.incoterm || initialData?.shipping_term || initialData?.shippingTerm;
    return getInsuranceFromIncoterm(initIncoterm, shippingTerms || DEFAULT_SHIPPING_TERMS) || '';
  });

  const effectiveInsurance = useMemo(() => {
    return getInsuranceFromIncoterm(incoterm, shippingTerms || DEFAULT_SHIPPING_TERMS) || insurance || '';
  }, [incoterm, insurance, shippingTerms]);

  const handleIncotermChange = (val: string) => {
    setIncoterm(val);
    const autoInsurance = getInsuranceFromIncoterm(val, shippingTerms || DEFAULT_SHIPPING_TERMS);
    setInsurance(autoInsurance);
  };

  useEffect(() => {
    if (initialData?.incoterm && !incoterm) {
      const clean = toCleanId(initialData.incoterm) || toCleanLabel(initialData.incoterm) || String(initialData.incoterm);
      setIncoterm(clean);
      const auto = getInsuranceFromIncoterm(clean, shippingTerms || DEFAULT_SHIPPING_TERMS);
      if (auto && !insurance) {
        setInsurance(auto);
      }
    }
    if (initialData?.insurance && !insurance) {
      setInsurance(String(initialData.insurance).trim().toUpperCase());
    }
  }, [initialData, shippingTerms, incoterm, insurance]);

  // ROW 20-24: Segmented Toggles
  const [isPartialAllowed, setIsPartialAllowed] = useState<boolean | null>(() =>
    parseInitialIsPartial(initialData)
  );
  const [splitCount, setSplitCount] = useState<string | number>(() =>
    parseInitialSplitCount(initialData)
  );
  const [splits, setSplits] = useState<ContractSplitItem[]>(() =>
    parseInitialSplits(initialData)
  );

  const handleSplitCountChange = (val: string) => {
    markDirty();
    setErrors((prev) => ({ ...prev, partialCount: '', partialTotal: '' }));

    if (val === '') {
      setSplitCount('');
      setSplits([]);
      return;
    }

    let count = parseInt(val, 10);
    if (isNaN(count)) {
      setSplitCount('');
      setSplits([]);
      return;
    }

    // Maximum 30 partial shipments allowed
    if (count > 30) {
      count = 30;
      val = '30';
    } else if (count < 1) {
      setSplitCount(val);
      setSplits([]);
      return;
    }

    setSplitCount(val);

    setSplits((prev) => {
      const next = [...prev];
      if (next.length < count) {
        for (let i = next.length; i < count; i++) {
          next.push({
            split_number: getPartialLabel(i),
            fcl_quantity: '',
          });
        }
      } else if (next.length > count) {
        return next.slice(0, count);
      }
      return next;
    });
  };

  const handleSplitQtyChange = (index: number, val: string) => {
    markDirty();
    setSplits((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          fcl_quantity: val,
        };
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, partialTotal: '' }));
  };

  const partialSum = useMemo(() => {
    return splits.reduce((acc: number, curr) => {
      const val = curr.fcl_quantity;
      if (val === '' || val === null || val === undefined) return acc;
      const n = parseFloat(String(val).replace(/[^\d.]/g, ''));
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
  }, [splits]);

  const targetFclQty = useMemo(() => {
    const rawVal = isFcl ? fclQty : mtQty;
    const n = parseFloat(String(rawVal).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }, [isFcl, fclQty, mtQty]);

  const isPartialMatch = useMemo(() => {
    if (!isPartialAllowed) return true;
    const count = parseInt(String(splitCount), 10);
    if (isNaN(count) || count <= 0) return false;
    if (targetFclQty <= 0) return true;
    return Math.abs(partialSum - targetFclQty) < 0.0001;
  }, [isPartialAllowed, splitCount, partialSum, targetFclQty]);

  const [isTranshipmentAllowed, setIsTranshipmentAllowed] = useState<boolean | null>(() =>
    parseNullableBoolean(initialData?.transhipment_allowed ?? initialData?.transhipment)
  );
  const [isTransitClauseAllowed, setIsTransitClauseAllowed] = useState<boolean | null>(() =>
    parseNullableBoolean(initialData?.transit_clause_allowed ?? initialData?.transit_clause)
  );
  const [hasAdvance, setHasAdvance] = useState<boolean | null>(() =>
    parseNullableBoolean(initialData?.any_advance ?? initialData?.has_advance ?? initialData?.advance)
  );
  const [advanceType, setAdvanceType] = useState<'PERCENTAGE' | 'AMOUNT' | null>(() => {
    return parseInitialAdvanceType(initialData);
  });
  const [advanceAmount, setAdvanceAmount] = useState<string | number>(
    initialData?.advance_payment_amt ??
      initialData?.advance_payment ??
      initialData?.advance_amount ??
      initialData?.advanceAmount ??
      ''
  );
  const [advancePercentage, setAdvancePercentage] = useState<string | number>(
    initialData?.advance_payment_pct ??
      initialData?.advance_percentage ??
      initialData?.advancePercentage ??
      initialData?.advance_pct ??
      ''
  );

  // Advance dynamic calculations based on MT and Total Contract Value
  const effectiveContractMt = useMemo(() => {
    if (isFcl) {
      const q = parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0;
      const c = parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0;
      if (q > 0 && c > 0) return q * c;
    }
    return parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
  }, [isFcl, fclQty, fclCapacity, mtQty]);

  const effectiveContractTotalValue = useMemo(() => {
    const tot = parseFloat(String(totalValue).replace(/[^\d.]/g, '')) || 0;
    if (tot > 0) return tot;
    const p = parseFloat(String(price).replace(/[^\d.]/g, '')) || 0;
    if (effectiveContractMt > 0 && p > 0) return effectiveContractMt * p;
    return 0;
  }, [totalValue, price, effectiveContractMt]);

  const calculatedAdvanceAmount = useMemo(() => {
    const pct = parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0;
    if (pct > 0 && effectiveContractTotalValue > 0) {
      return ((effectiveContractTotalValue * pct) / 100).toFixed(2);
    }
    return '';
  }, [advancePercentage, effectiveContractTotalValue]);

  const calculatedAdvanceMt = useMemo(() => {
    const pct = parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0;
    if (pct > 0 && effectiveContractMt > 0) {
      const val = (effectiveContractMt * pct) / 100;
      return Number.isInteger(val) ? String(val) : val.toFixed(2);
    }
    return '';
  }, [advancePercentage, effectiveContractMt]);

  const [isSalesBrokerAllowed, setIsSalesBrokerAllowed] = useState<boolean | null>(() =>
    parseInitialIsBroker(initialData)
  );
  const userToggledBrokerRef = useRef<boolean>(false);
  const userClearedBrokerRef = useRef<boolean>(false);
  const userToggledAdvanceRef = useRef<boolean>(false);
  const userClearedAdvanceRef = useRef<boolean>(false);
  const currentContractKey = String(contractIdProp || draftId || confirmationId || '');
  const prevContractKeyRef = useRef<string>(currentContractKey);
  useEffect(() => {
    if (currentContractKey && prevContractKeyRef.current !== currentContractKey) {
      prevContractKeyRef.current = currentContractKey;
      userToggledBrokerRef.current = false;
      userClearedBrokerRef.current = false;
      userToggledAdvanceRef.current = false;
      userClearedAdvanceRef.current = false;
    }
  }, [currentContractKey]);
  const [brokerCommissionType, setBrokerCommissionType] = useState<'PERCENTAGE' | 'PMT' | null>(() => {
    return parseBrokerCommissionType(
      initialData?.broker_commission_type ??
      initialData?.sales_broker_type ??
      initialData?.brokerCommissionType
    );
  });
  const [brokerCommission, setBrokerCommission] = useState<string>(() => {
    const bComm = initialData?.broker_commission ?? initialData?.sales_broker_commission ?? initialData?.brokerCommission;
    return bComm !== undefined && bComm !== null ? String(bComm) : '';
  });
  const [brokerCommissionAmt, setBrokerCommissionAmt] = useState<string>(() => {
    const bAmt =
      initialData?.broker_commission_amt ??
      initialData?.broker_commission_amount ??
      initialData?.sales_broker_amount ??
      initialData?.sales_broker_commission_amount;
    return bAmt !== undefined && bAmt !== null ? String(bAmt) : '';
  });
  const [brokerName, setBrokerName] = useState<string>(() => {
    return toCleanLabel(initialData?.broker_name || initialData?.sales_broker_name || initialData?.brokerName) || '';
  });

  const calculatedBrokerCommission = useMemo(() => {
    if (!isSalesBrokerAllowed) return '';
    const rate = parseFloat(String(brokerCommission).replace(/[^\d.]/g, '')) || 0;
    if (rate <= 0) return '';
    if (brokerCommissionType === 'PERCENTAGE') {
      if (effectiveContractTotalValue > 0) {
        return ((effectiveContractTotalValue * rate) / 100).toFixed(2);
      }
    } else if (brokerCommissionType === 'PMT') {
      // PMT: Per Metric Ton
      if (effectiveContractMt > 0) {
        return (effectiveContractMt * rate).toFixed(2);
      }
    }
    return '';
  }, [isSalesBrokerAllowed, brokerCommission, brokerCommissionType, effectiveContractTotalValue, effectiveContractMt]);

  // ROW: Country Required Documents (ECTN & COC)
  const [ectnField, setEctnField] = useState<boolean | null>(() => {
    const isEctn = parseNullableBoolean(
      initialData?.ectn_field ??
      initialData?.ectnField ??
      initialData?.ectn
    );
    const isCoc = parseNullableBoolean(
      initialData?.coc_fields ??
      initialData?.cocFields ??
      initialData?.coc_field ??
      initialData?.cocField ??
      initialData?.coc
    );
    if (isCoc === true) return false;
    return isEctn;
  });
  const [cocFields, setCocFields] = useState<boolean | null>(() => {
    const isEctn = parseNullableBoolean(
      initialData?.ectn_field ??
      initialData?.ectnField ??
      initialData?.ectn
    );
    const isCoc = parseNullableBoolean(
      initialData?.coc_fields ??
      initialData?.cocFields ??
      initialData?.coc_field ??
      initialData?.cocField ??
      initialData?.coc
    );
    if (isEctn === true) return false;
    return isCoc;
  });

  // ROW 25: Additional Details
  const [freeDays, setFreeDays] = useState<string>(() => {
    return toCleanLabel(initialData?.free_days || initialData?.freeDays) || '';
  });
  const [emptyBags, setEmptyBags] = useState<string>(() => {
    return toCleanLabel(initialData?.empty_bags || initialData?.emptyBags) || '';
  });
  const [additionalComment, setAdditionalComment] = useState<string>(() => {
    return toCleanLabel(initialData?.additional_comment || initialData?.additionalComment || initialData?.comment) || '';
  });

  // ROW 35: Contract Comments (comment_label & comment_value)
  const [commentLabel, setCommentLabel] = useState<string>(() => {
    return (
      toCleanLabel(
        initialData?.comment_label ??
        initialData?.commentLabel ??
        initialData?.contract_comment_label ??
        initialData?.comment_title
      ) || ''
    );
  });
  const [commentValue, setCommentValue] = useState<string>(() => {
    return (
      toCleanLabel(
        initialData?.comment_value ??
        initialData?.commentValue ??
        initialData?.contract_comment_value ??
        initialData?.comment_text
      ) || ''
    );
  });

  // ROW 26: Other Terms 1 (Payment & Charges)
  const [otherTermsPayment, setOtherTermsPayment] = useState<string>(() => {
    return (
      initialData?.other_terms_1 ||
      initialData?.other_terms1 ||
      initialData?.otherTerms1 ||
      initialData?.other_terms ||
      initialData?.other_terms_payment ||
      initialData?.otherTerms ||
      DEFAULT_OTHER_TERMS_PAYMENT
    );
  });

  // ROW 27: Documents (Documents Required - Unified List)
  const [internalDocumentList, setInternalDocumentList] = useState<SmartDocsSelectionDocumentOption[]>(() => {
    const baseList =
      documentsList && documentsList.length > 0
        ? [...documentsList]
        : [...DEFAULT_DOCUMENT_SELECTION_OPTIONS];
    const initResolved = extractAndResolveContractDocuments(initialData, baseList);
    const existingNames = new Set(baseList.map((p) => p.name.toUpperCase()));
    for (const doc of initResolved) {
      if (!existingNames.has(doc.toUpperCase())) {
        existingNames.add(doc.toUpperCase());
        baseList.push({
          id: doc,
          name: doc,
          label: doc,
          value: doc,
          isCustom: true,
        });
      }
    }
    if (!existingNames.has('ECTN CERTIFICATE')) {
      existingNames.add('ECTN CERTIFICATE');
      baseList.push({
        id: 'ECTN CERTIFICATE',
        name: 'ECTN CERTIFICATE',
        label: 'ECTN CERTIFICATE',
        value: 'ECTN CERTIFICATE',
        isCustom: true,
      });
    }
    if (!existingNames.has('COC CERTIFICATE')) {
      existingNames.add('COC CERTIFICATE');
      baseList.push({
        id: 'COC CERTIFICATE',
        name: 'COC CERTIFICATE',
        label: 'COC CERTIFICATE',
        value: 'COC CERTIFICATE',
        isCustom: true,
      });
    }
    return baseList;
  });

  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(() => {
    const fromReq = extractAndResolveContractDocuments(
      initialData,
      documentsList && documentsList.length > 0
        ? documentsList
        : DEFAULT_DOCUMENT_SELECTION_OPTIONS
    );
    const legacyDefaults = parseDefaultDocuments(
      initialData?.default_documents ||
      initialData?.defaultDocuments ||
      initialData?.default_document_list ||
      initialData?.defaultDocumentList
    );
    const combined = [...fromReq];
    const seen = new Set(fromReq.map((d) => d.trim().toUpperCase()));
    for (const d of legacyDefaults) {
      if (d && !seen.has(d.trim().toUpperCase())) {
        seen.add(d.trim().toUpperCase());
        combined.push(d.trim().toUpperCase());
      }
    }
    const isInitEctn = parseNullableBoolean(initialData?.ectn_field ?? initialData?.ectnField ?? initialData?.ectn) === true;
    const isInitCoc = parseNullableBoolean(initialData?.coc_fields ?? initialData?.cocFields ?? initialData?.coc_field ?? initialData?.cocField ?? initialData?.coc) === true;
    if (isInitEctn && !seen.has('ECTN CERTIFICATE')) {
      seen.add('ECTN CERTIFICATE');
      combined.push('ECTN CERTIFICATE');
    } else if (isInitCoc && !isInitEctn && !seen.has('COC CERTIFICATE')) {
      seen.add('COC CERTIFICATE');
      combined.push('COC CERTIFICATE');
    }
    return combined;
  });

  const ECTN_DOC_NAME = 'ECTN CERTIFICATE';
  const COC_DOC_NAME = 'COC CERTIFICATE';

  // Automatically manages ECTN & COC Certificate inclusion in selectedDocuments
  const updateCertificateDocuments = useCallback((isEctnYes: boolean, isCocYes: boolean) => {
    setSelectedDocuments((prev) => {
      // Remove both ECTN CERTIFICATE and COC CERTIFICATE first
      const next = prev.filter((doc) => {
        const upper = doc.trim().toUpperCase();
        return (
          upper !== ECTN_DOC_NAME &&
          upper !== 'ECTN' &&
          upper !== COC_DOC_NAME &&
          upper !== 'COC'
        );
      });

      // Add appropriate certificate at the end
      if (isEctnYes) {
        next.push(ECTN_DOC_NAME);
      } else if (isCocYes) {
        next.push(COC_DOC_NAME);
      }

      return next;
    });

    // Ensure options exist in internalDocumentList
    if (isEctnYes) {
      setInternalDocumentList((prev) => {
        if (prev.some((p) => p.name.toUpperCase() === ECTN_DOC_NAME)) return prev;
        return [
          ...prev,
          {
            id: ECTN_DOC_NAME,
            name: ECTN_DOC_NAME,
            label: ECTN_DOC_NAME,
            value: ECTN_DOC_NAME,
            isCustom: true,
          },
        ];
      });
    } else if (isCocYes) {
      setInternalDocumentList((prev) => {
        if (prev.some((p) => p.name.toUpperCase() === COC_DOC_NAME)) return prev;
        return [
          ...prev,
          {
            id: COC_DOC_NAME,
            name: COC_DOC_NAME,
            label: COC_DOC_NAME,
            value: COC_DOC_NAME,
            isCustom: true,
          },
        ];
      });
    }
  }, []);

  const handleEctnChange = useCallback((val: boolean | null) => {
    markDirty();
    setEctnField(val);

    if (val === true) {
      // ECTN is YES -> COC must be NO (false)
      setCocFields(false);
      updateCertificateDocuments(true, false);
    } else {
      updateCertificateDocuments(false, cocFields === true);
    }
  }, [cocFields, markDirty, updateCertificateDocuments]);

  const handleCocChange = useCallback((val: boolean | null) => {
    markDirty();
    setCocFields(val);

    if (val === true) {
      // COC is YES -> ECTN must be NO (false)
      setEctnField(false);
      updateCertificateDocuments(false, true);
    } else {
      updateCertificateDocuments(ectnField === true, false);
    }
  }, [ectnField, markDirty, updateCertificateDocuments]);

  // Component-scoped effective documents ensuring ECTN or COC Certificate is included if toggled YES
  const effectiveDocs = useMemo(() => {
    const docs = [...selectedDocuments];
    if (ectnField === true) {
      if (!docs.some((d) => d.trim().toUpperCase() === ECTN_DOC_NAME)) {
        docs.push(ECTN_DOC_NAME);
      }
    } else if (cocFields === true) {
      if (!docs.some((d) => d.trim().toUpperCase() === COC_DOC_NAME)) {
        docs.push(COC_DOC_NAME);
      }
    }
    return docs;
  }, [selectedDocuments, ectnField, cocFields]);

  // ROW 28: Shipping Line
  const [shippingLine, setShippingLine] = useState<string>(() => {
    return initialData?.shipping_line || initialData?.shippingLine || 'SHIPMENT IN CONTAINERS ( DO NOT USE NVOCC & IRANIAN SHIPPING LINE )';
  });

  // ROW 29: Arbitration
  const [arbitration, setArbitration] = useState<string>(() => {
    return toCleanLabel(initialData?.arbitration) || '';
  });

  // ROW 30: Other Terms 2 (Container & Packaging Standards)
  const [containerStandards, setContainerStandards] = useState<string>(() => {
    return (
      initialData?.other_terms_2 ||
      initialData?.other_terms2 ||
      initialData?.otherTerms2 ||
      initialData?.container_terms ||
      initialData?.container_standards ||
      initialData?.containerStandards ||
      DEFAULT_CONTAINER_TERMS
    );
  });

  // ROW 31: Force Majeur
  const [forceMajeur, setForceMajeur] = useState<string>(() => {
    return initialData?.force_majeur || initialData?.forceMajeur || DEFAULT_FORCE_MAJEUR;
  });

  // ROW 32: Confidentiality
  const [confidentiality, setConfidentiality] = useState<string>(() => {
    return initialData?.confidentiality || DEFAULT_CONFIDENTIALITY;
  });

  // ROW 33: NOTES
  const [notes, setNotes] = useState<string>(() => {
    return initialData?.notes || '';
  });

  // Print Preview & Download PDF Modal States
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Helper to extract signature fields / labels from API response
  const resolveSigValue = (data: any, keys: string[], fallback: string = ''): string => {
    if (!data) return fallback;

    const extractString = (val: any): string | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'string') {
        const s = val.trim();
        if (s !== '' && s !== 'null' && s !== 'undefined' && s !== '[object Object]') {
          return s;
        }
        return null;
      }
      if (typeof val === 'object') {
        const possibleKeys = ['url', 'path', 'src', 'image', 'file', 'endpoint', 'location'];
        for (const pk of possibleKeys) {
          if (val[pk] && typeof val[pk] === 'string') {
            const s = val[pk].trim();
            if (s !== '' && s !== 'null' && s !== 'undefined') {
              return s;
            }
          }
        }
      }
      return null;
    };

    const layers = [
      data,
      data.contract,
      data.data,
      data.data?.contract,
      data.contract?.data,
      data.contract_data,
      data.details,
      data.signatures,
      data.contract?.signatures,
    ].filter(Boolean);

    for (const k of keys) {
      for (const layer of layers) {
        if (!layer || typeof layer !== 'object') continue;
        const found = extractString(layer[k]);
        if (found) return found;
      }
    }

    return fallback;
  };

  // ROW 34: Signatures - Importer (Buyer), Broker, Exporter (Seller)
  // Input above signature: buyer_signature_field, broker_signature_field, seller_signature_field
  // Label/field below signature: buyer_signature_label, broker_signature_label, seller_signature_label
  const [importerTitle, setImporterTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['buyer_signature_field', 'buyerSignatureField', 'importer_signature_field', 'importer_title', 'importerTitle'],
        'IMPORTER SIGNATURE'
      )
  );
  const [importerSignature, setImporterSignature] = useState<string>(
    () => {
      const val = resolveSigValue(
        initialData,
        ['buyer_signature', 'buyerSignature', 'importer_signature', 'importerSignature'],
        ''
      );
      return val ? formatSignatureUrl(val) : '';
    }
  );
  const [importerAuthorityTitle, setImporterAuthorityTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['buyer_signature_label', 'buyerSignatureLabel', 'importer_signature_label', 'importer_authority_title', 'importerAuthorityTitle'],
        'AUTHORISED SIGNATURE'
      )
  );

  const [brokerTitle, setBrokerTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['broker_signature_field', 'brokerSignatureField', 'broker_title', 'sales_broker_title', 'brokerTitle'],
        'BROKER SIGNATURE'
      )
  );
  const [brokerSignature, setBrokerSignature] = useState<string>(
    () => {
      const val = resolveSigValue(
        initialData,
        ['broker_signature', 'sales_broker_signature', 'brokerSignature'],
        ''
      );
      return val ? formatSignatureUrl(val) : '';
    }
  );
  const [brokerAuthorityTitle, setBrokerAuthorityTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['broker_signature_label', 'brokerSignatureLabel', 'broker_authority_title', 'sales_broker_authority_title', 'brokerAuthorityTitle'],
        'AUTHORISED SIGNATURE'
      )
  );

  const [exporterTitle, setExporterTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['seller_signature_field', 'sellerSignatureField', 'exporter_signature_field', 'exporter_title', 'exporterTitle'],
        'EXPORTER SIGNATURE'
      )
  );
  const [exporterSignature, setExporterSignature] = useState<string>(
    () => {
      const val = resolveSigValue(
        initialData,
        ['seller_signature', 'sellerSignature', 'exporter_signature', 'exporterSignature'],
        ''
      );
      return val ? formatSignatureUrl(val) : '';
    }
  );
  const [exporterAuthorityTitle, setExporterAuthorityTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['seller_signature_label', 'sellerSignatureLabel', 'exporter_signature_label', 'exporter_authority_title', 'exporterAuthorityTitle'],
        'AUTHORISED SIGNATURE'
      )
  );

  // Track explicit user clears for signatures to prevent stale initialData from reviving them
  const hasUserClearedExporterSigRef = useRef<boolean>(false);
  const hasUserClearedImporterSigRef = useRef<boolean>(false);
  const hasUserClearedBrokerSigRef = useRef<boolean>(false);

  const handleExporterSignatureChange = useCallback((val: string) => {
    markDirty();
    if (!val) {
      hasUserClearedExporterSigRef.current = true;
    } else {
      hasUserClearedExporterSigRef.current = false;
    }
    setExporterSignature(val);
  }, [markDirty]);

  const handleImporterSignatureChange = useCallback((val: string) => {
    markDirty();
    if (!val) {
      hasUserClearedImporterSigRef.current = true;
    } else {
      hasUserClearedImporterSigRef.current = false;
    }
    setImporterSignature(val);
  }, [markDirty]);

  const handleBrokerSignatureChange = useCallback((val: string) => {
    markDirty();
    if (!val) {
      hasUserClearedBrokerSigRef.current = true;
    } else {
      hasUserClearedBrokerSigRef.current = false;
    }
    setBrokerSignature(val);
  }, [markDirty]);

  // UI States
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Options States (Options based on product or props)
  const [internalSellers, setInternalSellers] = useState<FormOptionItem[]>(sellers);
  const [internalBuyers, setInternalBuyers] = useState<FormOptionItem[]>(buyers);
  const [internalProducts, setInternalProducts] = useState<FormOptionItem[]>(products);
  const [internalLoadingPorts, setInternalLoadingPorts] = useState<FormOptionItem[]>(
    () => (loadingPorts && loadingPorts.length > 0 ? loadingPorts : [])
  );
  const [internalDestinationPorts, setInternalDestinationPorts] = useState<FormOptionItem[]>(
    () => (destinationPorts && destinationPorts.length > 0 ? destinationPorts : [])
  );
  const [internalPackingOptions, setInternalPackingOptions] = useState<FormOptionItem[]>(
    () => (packingOptions && packingOptions.length > 0 ? packingOptions : [])
  );
  const [internalPaymentTerms, setInternalPaymentTerms] = useState<FormOptionItem[]>(
    () => (paymentTerms && paymentTerms.length > 0 ? paymentTerms : DEFAULT_PAYMENT_TERMS)
  );
  const [internalCurrencies, setInternalCurrencies] = useState<FormOptionItem[]>(() => {
    const base =
      currencies && currencies.length > 0
        ? currencies
        : initialData?.currencies && Array.isArray(initialData.currencies)
        ? initialData.currencies
        : initialData?.currenciesList && Array.isArray(initialData.currenciesList)
        ? initialData.currenciesList
        : DEFAULT_CURRENCIES;
    const raw =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.currencyCode ||
      initialData?.currency_id ||
      initialData?.currencyId;
    if (!raw) return base;
    const resolved = normalizeCurrencyOption(raw, base);
    if (resolved && !base.some((c: any) => String(c.value).toUpperCase() === resolved.value.toUpperCase())) {
      return [resolved, ...base];
    }
    return base;
  });
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState<boolean>(false);

  const [isLoadingProductDetails, setIsLoadingProductDetails] = useState<boolean>(false);
  const productDetailsCacheRef = useRef<Record<string, any>>({});
  const currentProductIdRef = useRef<string>(productId);

  useEffect(() => {
    currentProductIdRef.current = productId;
  }, [productId]);

  const isProductSelected = Boolean(productId && String(productId).trim().length > 0);

  const loadingPortsList: FormOptionItem[] = useMemo(() => {
    const baseList =
      internalLoadingPorts.length > 0
        ? internalLoadingPorts
        : loadingPorts || initialData?.loadingPorts || initialData?.loadingPortsList || [];

    const fallbackName = getFallbackPortName(initialData, loadingPort);
    if (loadingPort && fallbackName && !isRawDbId(fallbackName)) {
      const exists = baseList.some(
        (p) =>
          String(p.value).toLowerCase() === String(loadingPort).toLowerCase() ||
          String(p.id || '').toLowerCase() === String(loadingPort).toLowerCase() ||
          String(p._id || '').toLowerCase() === String(loadingPort).toLowerCase() ||
          String(p.label).toLowerCase() === String(fallbackName).toLowerCase()
      );
      if (!exists) {
        return [
          {
            value: loadingPort,
            label: fallbackName,
            id: loadingPort,
          },
          ...baseList,
        ];
      }
    }
    return baseList;
  }, [internalLoadingPorts, loadingPorts, initialData, loadingPort]);
  const sellersList: FormOptionItem[] = useMemo(() => {
    const base = internalSellers.length > 0 ? internalSellers : sellers || [];
    const fallback = getFallbackSellerOption(initialData, sellerId);
    if (fallback && !base.some((s) => toCleanId(s.value || s.id) === toCleanId(fallback.value))) {
      return [fallback, ...base];
    }
    return base;
  }, [internalSellers, sellers, initialData, sellerId]);

  const buyersList: FormOptionItem[] = useMemo(() => {
    const base = internalBuyers.length > 0 ? internalBuyers : buyers || [];
    const fallback = getFallbackBuyerOption(initialData, buyerId);
    if (fallback && !base.some((b) => toCleanId(b.value || b.id) === toCleanId(fallback.value))) {
      return [fallback, ...base];
    }
    return base;
  }, [internalBuyers, buyers, initialData, buyerId]);

  const productsList: FormOptionItem[] = useMemo(() => {
    const base = internalProducts.length > 0 ? internalProducts : products || [];
    const fallback = getFallbackProductOption(initialData, productId);
    if (fallback && !base.some((p) => toCleanId(p.value || p.id) === toCleanId(fallback.value))) {
      return [fallback, ...base];
    }
    return base;
  }, [internalProducts, products, initialData, productId]);

  const paymentTermsList: FormOptionItem[] = useMemo(() => {
    const base =
      internalPaymentTerms.length > 0
        ? internalPaymentTerms
        : paymentTerms || initialData?.paymentTerms || initialData?.paymentTermsList || DEFAULT_PAYMENT_TERMS;
    const fallbackName = getFallbackPaymentTermName(initialData, paymentTerm);
    if (paymentTerm && fallbackName && !isRawDbId(fallbackName)) {
      const exists = base.some(
        (p) =>
          toCleanId(p.value || p.id) === toCleanId(paymentTerm) ||
          String(p.label).toLowerCase() === String(fallbackName).toLowerCase()
      );
      if (!exists) {
        return [{ value: paymentTerm, id: paymentTerm, label: fallbackName }, ...base];
      }
    }
    return base;
  }, [internalPaymentTerms, paymentTerms, initialData, paymentTerm]);

  const destinationPortsList: FormOptionItem[] = useMemo(() => {
    const baseList =
      internalDestinationPorts.length > 0
        ? internalDestinationPorts
        : destinationPorts || initialData?.destinationPorts || initialData?.destinationPortsList || [];

    const fallbackName = getFallbackDestinationPortName(initialData, destinationPort);
    if (destinationPort && fallbackName && !isRawDbId(fallbackName)) {
      const exists = baseList.some(
        (p) =>
          String(p.value).toLowerCase() === String(destinationPort).toLowerCase() ||
          String(p.id || '').toLowerCase() === String(destinationPort).toLowerCase() ||
          String(p._id || '').toLowerCase() === String(destinationPort).toLowerCase() ||
          String(p.label).toLowerCase() === String(fallbackName).toLowerCase()
      );
      if (!exists) {
        return [
          {
            value: destinationPort,
            label: fallbackName,
            id: destinationPort,
          },
          ...baseList,
        ];
      }
    }
    return baseList;
  }, [internalDestinationPorts, destinationPorts, initialData, destinationPort]);

  const packingList: FormOptionItem[] = useMemo(() => {
    const baseList =
      internalPackingOptions.length > 0
        ? internalPackingOptions
        : packingOptions && packingOptions.length > 0
        ? packingOptions
        : DEFAULT_STATIC_PACKING_OPTIONS;

    const fallbackName = getFallbackPackingName(initialData, packing);
    if (packing && fallbackName && !isRawDbId(fallbackName)) {
      const exists = baseList.some(
        (p) =>
          String(p.value).toLowerCase() === String(packing).toLowerCase() ||
          String(p.id || '').toLowerCase() === String(packing).toLowerCase() ||
          String(p._id || '').toLowerCase() === String(packing).toLowerCase() ||
          String(p.label).toLowerCase() === String(fallbackName).toLowerCase()
      );
      if (!exists) {
        return [
          {
            value: packing,
            label: fallbackName,
            id: packing,
          },
          ...baseList,
        ];
      }
    }
    return baseList;
  }, [internalPackingOptions, packingOptions, initialData, packing]);

  const currenciesList: FormOptionItem[] = useMemo(() => {
    const baseRaw =
      internalCurrencies.length > 0
        ? internalCurrencies
        : currencies && currencies.length > 0
        ? currencies
        : initialData?.currencies && Array.isArray(initialData.currencies)
        ? initialData.currencies
        : initialData?.currenciesList && Array.isArray(initialData.currenciesList)
        ? initialData.currenciesList
        : DEFAULT_CURRENCIES;
    const base = baseRaw.map((c: any) => ({ ...c, subLabel: undefined }));

    const raw =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.currencyCode ||
      initialData?.currency_id ||
      initialData?.currencyId;

    if (!raw) return base;
    const resolved = normalizeCurrencyOption(raw, base);
    if (resolved && !base.some((c: any) => String(c.value).toUpperCase() === resolved.value.toUpperCase())) {
      return [{ ...resolved, subLabel: undefined }, ...base];
    }
    return base;
  }, [internalCurrencies, currencies, initialData]);

  const currencySymbol = useMemo(() => {
    return getCurrencySymbol(currency, currenciesList);
  }, [currency, currenciesList]);

  const isPortSelected = Boolean(isProductSelected && loadingPort && loadingPort.trim().length > 0);

  // Loading Condition options:
  // Option 1 (fixed): 'Any Port Of Loading'
  // Option 2: Actual selected Loading Port human label (e.g. 'Mundra Port, India')
  // Available ONLY after a Loading Port is selected! Never expose raw DB IDs!
  const loadingConditionOptions = useMemo<FormOptionItem[]>(() => {
    if (!isPortSelected) return [];

    const options: FormOptionItem[] = [DEFAULT_FIXED_LOADING_CONDITION];

    const actualPortDisplay =
      getPortDisplayName(loadingPort, loadingPortsList) ||
      getFallbackPortName(initialData, loadingPort);
    const cleanPort = String(actualPortDisplay || '').trim();

    if (cleanPort && cleanPort.toLowerCase() !== 'any port of loading' && !isRawDbId(cleanPort)) {
      options.push({
        value: cleanPort,
        label: cleanPort,
      });
    }

    return options;
  }, [isPortSelected, loadingPort, loadingPortsList, initialData]);

  // Sync loadingCondition when any_loading_port is specified in API response
  useEffect(() => {
    // If form is already initialized and user has a loadingCondition, don't overwrite it
    if (isFormInitializedRef.current && loadingCondition) {
      return;
    }
    const anyPortFlag = parseAnyLoadingPort(initialData);
    if (anyPortFlag === true) {
      if (loadingCondition !== DEFAULT_FIXED_LOADING_CONDITION.value) {
        setLoadingCondition(DEFAULT_FIXED_LOADING_CONDITION.value);
      }
    } else if (anyPortFlag === false) {
      const portName =
        getPortDisplayName(loadingPort, loadingPortsList) ||
        getFallbackPortName(initialData, loadingPort);
      if (portName && !isRawDbId(portName) && loadingCondition !== portName) {
        setLoadingCondition(portName);
      }
    }
  }, [initialData, loadingPort, loadingPortsList, loadingCondition]);

  // If port is not selected, or loading condition is no longer valid, reset it immediately
  useEffect(() => {
    if (!isPortSelected) {
      if (loadingCondition) setLoadingCondition('');
      return;
    }
    if (loadingCondition && loadingCondition !== DEFAULT_FIXED_LOADING_CONDITION.value) {
      const exists = loadingConditionOptions.some(
        (opt) => opt.value === loadingCondition || opt.label === loadingCondition
      );
      if (!exists && loadingPortsList.length > 0) {
        setLoadingCondition('');
      }
    }
  }, [isPortSelected, loadingConditionOptions, loadingCondition, loadingPortsList.length]);

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [productModalMode, setProductModalMode] = useState<'add' | 'edit'>('add');
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [isPaymentTermModalOpen, setIsPaymentTermModalOpen] = useState<boolean>(false);
  const [paymentTermModalMode, setPaymentTermModalMode] = useState<'add' | 'edit'>('add');
  const [editingPaymentTerm, setEditingPaymentTerm] = useState<any>(null);

  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState<boolean>(false);
  const [instructionModalMode, setInstructionModalMode] = useState<'add' | 'edit'>('add');
  const [instructionModalPartyType, setInstructionModalPartyType] = useState<'seller' | 'buyer'>('seller');
  const [editingParty, setEditingParty] = useState<FormOptionItem | null>(null);

  // Sync external options
  useEffect(() => {
    if (sellers && sellers.length > 0) setInternalSellers(sellers);
  }, [sellers]);

  useEffect(() => {
    if (buyers && buyers.length > 0) setInternalBuyers(buyers);
  }, [buyers]);

  useEffect(() => {
    if (products && products.length > 0) setInternalProducts(products);
  }, [products]);

  useEffect(() => {
    if (paymentTerms && paymentTerms.length > 0) setInternalPaymentTerms(paymentTerms);
  }, [paymentTerms]);

  useEffect(() => {
    if (currencies && currencies.length > 0) setInternalCurrencies(currencies);
  }, [currencies]);

  useEffect(() => {
    if (packingOptions && packingOptions.length > 0) setInternalPackingOptions(packingOptions);
  }, [packingOptions]);

  useEffect(() => {
    if (loadingPorts && loadingPorts.length > 0) setInternalLoadingPorts(loadingPorts);
  }, [loadingPorts]);

  useEffect(() => {
    if (destinationPorts && destinationPorts.length > 0) setInternalDestinationPorts(destinationPorts);
  }, [destinationPorts]);

  // Client-side self-heal for options if not passed from parent
  useEffect(() => {
    if (!sellers || sellers.length === 0 || !buyers || buyers.length === 0) {
      getSmartDocsInstructionsAction({ lang })
        .then((res) => {
          if (res?.success) {
            if (res.sellers && res.sellers.length > 0) setInternalSellers(res.sellers);
            if (res.buyers && res.buyers.length > 0) setInternalBuyers(res.buyers);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching instructions:', err));
    }
  }, [sellers, buyers, lang]);

  useEffect(() => {
    if (!products || products.length === 0) {
      getSmartDocsProductsAction({ lang })
        .then((res) => {
          if (res?.success && res.products && res.products.length > 0) {
            setInternalProducts(res.products);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching products:', err));
    }
  }, [products, lang]);

  useEffect(() => {
    if (!paymentTerms || paymentTerms.length === 0) {
      getSmartDocsPaymentTermsAction({ lang })
        .then((res) => {
          if (res?.success && res.paymentTerms && res.paymentTerms.length > 0) {
            setInternalPaymentTerms(res.paymentTerms);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching payment terms:', err));
    }
  }, [paymentTerms, lang]);

  useEffect(() => {
    if (!currencies || currencies.length === 0 || currencies === DEFAULT_CURRENCIES) {
      setIsLoadingCurrencies(true);
      getSmartDocsCurrenciesAction({ lang })
        .then((res) => {
          if (res?.success && res.currencies && res.currencies.length > 0) {
            setInternalCurrencies(res.currencies);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching currencies:', err))
        .finally(() => setIsLoadingCurrencies(false));
    }
  }, [currencies, lang]);

  useEffect(() => {
    if (documentsList && documentsList.length > 0) {
      setInternalDocumentList((prev) => {
        const base = [...documentsList];
        const existingNames = new Set(base.map((p) => p.name.toUpperCase()));
        for (const p of prev) {
          if (p.isCustom && !existingNames.has(p.name.toUpperCase())) {
            existingNames.add(p.name.toUpperCase());
            base.push(p);
          }
        }
        return base;
      });

      // Re-resolve selected documents with master options
      const newlyResolved = extractAndResolveContractDocuments(initialData, documentsList);
      if (newlyResolved.length > 0) {
        setSelectedDocuments((prev) => {
          const merged = new Set([...prev, ...newlyResolved]);
          return Array.from(merged);
        });
      }
    }
  }, [documentsList, initialData]);

  useEffect(() => {
    if (!documentsList || documentsList.length === 0) {
      getSmartDocsDocumentListAction({ lang })
        .then((res) => {
          if (res?.success && res.documents && res.documents.length > 0) {
            setInternalDocumentList((prev) => {
              const base = [...res.documents];
              const existingNames = new Set(base.map((p: any) => p.name.toUpperCase()));
              for (const p of prev) {
                if (p.isCustom && !existingNames.has(p.name.toUpperCase())) {
                  existingNames.add(p.name.toUpperCase());
                  base.push(p);
                }
              }
              return base;
            });

            // Re-resolve selected documents
            const newlyResolved = extractAndResolveContractDocuments(initialData, res.documents);
            if (newlyResolved.length > 0) {
              setSelectedDocuments((prev) => {
                const merged = new Set([...prev, ...newlyResolved]);
                return Array.from(merged);
              });
            }
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching documents list:', err));
    }
  }, [documentsList, lang, initialData]);

  useEffect(() => {
    if (!initialData) return;
    const resolved = extractAndResolveContractDocuments(
      initialData,
      internalDocumentList.length > 0 ? internalDocumentList : (documentsList || [])
    );
    if (resolved.length > 0) {
      setSelectedDocuments((prev) => {
        // If the form has already been initialized and holds active documents,
        // do not discard user additions when initialData is updated or passed post-save!
        if (isFormInitializedRef.current && prev.length > 0) {
          const prevSet = new Set(prev.map((d) => d.trim().toUpperCase()));
          const toAdd = resolved.filter((d) => !prevSet.has(d.trim().toUpperCase()));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        }
        return resolved;
      });
      setInternalDocumentList((prev) => {
        const existingNames = new Set(prev.map((p) => p.name.toUpperCase()));
        const toAdd: SmartDocsSelectionDocumentOption[] = [];
        for (const doc of resolved) {
          if (!existingNames.has(doc.toUpperCase())) {
            existingNames.add(doc.toUpperCase());
            toAdd.push({
              id: doc,
              name: doc,
              label: doc,
              value: doc,
              isCustom: true,
            });
          }
        }
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  }, [initialData, documentsList]);

  const handleAddNewSeller = () => {
    setEditingParty(null);
    setInstructionModalMode('add');
    setInstructionModalPartyType('seller');
    setIsInstructionModalOpen(true);
  };

  const handleEditSeller = (opt: any) => {
    const found = internalSellers.find((s) => s.value === opt.value || s.label === opt.label) || opt;
    setEditingParty(found);
    setInstructionModalMode('edit');
    setInstructionModalPartyType('seller');
    setIsInstructionModalOpen(true);
  };

  const handleAddNewBuyer = () => {
    setEditingParty(null);
    setInstructionModalMode('add');
    setInstructionModalPartyType('buyer');
    setIsInstructionModalOpen(true);
  };

  const handleEditBuyer = (opt: any) => {
    const found = internalBuyers.find((b) => b.value === opt.value || b.label === opt.label) || opt;
    setEditingParty(found);
    setInstructionModalMode('edit');
    setInstructionModalPartyType('buyer');
    setIsInstructionModalOpen(true);
  };

  const handleSaveInstruction = (savedData: { id: string; label: string; instructionText: string }) => {
    markDirty();
    const formattedItem: FormOptionItem = {
      value: savedData.id,
      label: savedData.label,
      subLabel: savedData.instructionText,
      instructionText: savedData.instructionText,
    };

    if (instructionModalPartyType === 'seller') {
      setInternalSellers((prev) => {
        const idx = prev.findIndex(
          (p) => p.value === savedData.id || p.label.toLowerCase() === savedData.label.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...formattedItem };
          return next;
        }
        return [formattedItem, ...prev];
      });
      setSellerId(savedData.id);
      setSellerInstruction(savedData.instructionText);
      setErrors((prev) => ({ ...prev, sellerId: '' }));
    } else {
      setInternalBuyers((prev) => {
        const idx = prev.findIndex(
          (p) => p.value === savedData.id || p.label.toLowerCase() === savedData.label.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...formattedItem };
          return next;
        }
        return [formattedItem, ...prev];
      });
      setBuyerId(savedData.id);
      setBuyerInstruction(savedData.instructionText);
      setErrors((prev) => ({ ...prev, buyerId: '' }));
    }
  };

  const handleAddNewProduct = () => {
    setEditingProduct(null);
    setProductModalMode('add');
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (opt: any) => {
    const found = internalProducts.find((p) => p.value === opt.value || p.label === opt.label) || opt;
    setEditingProduct(found);
    setProductModalMode('edit');
    setIsProductModalOpen(true);
  };

  const handleAddNewPaymentTerm = () => {
    setEditingPaymentTerm(null);
    setPaymentTermModalMode('add');
    setIsPaymentTermModalOpen(true);
  };

  const handleEditPaymentTerm = (opt: any) => {
    const found = internalPaymentTerms.find((p) => p.value === opt.value || p.label === opt.label) || opt;
    setEditingPaymentTerm(found);
    setPaymentTermModalMode('edit');
    setIsPaymentTermModalOpen(true);
  };

  // Product Selection & Details Fetching
  const hsnCodeRef = useRef(hsnCode);
  hsnCodeRef.current = hsnCode;
  const productCountryRef = useRef(productCountry);
  productCountryRef.current = productCountry;
  const specificationRef = useRef(specification);
  specificationRef.current = specification;

  const fetchAndApplyProductDetails = useCallback(
    async (targetProdId: string, forceOverwrite = false) => {
      if (!targetProdId || !targetProdId.trim()) return;
      const cleanId = targetProdId.trim();

      // Check cache first
      if (productDetailsCacheRef.current[cleanId]) {
        const cached = productDetailsCacheRef.current[cleanId];
        if (forceOverwrite || !hsnCodeRef.current) {
          if (cached.hsnCode || cached.hsn) setHsnCode(cached.hsnCode || cached.hsn);
        }
        if (forceOverwrite || !productCountryRef.current) {
          if (cached.country) setProductCountry(cached.country);
        }
        if (forceOverwrite || !specificationRef.current) {
          if (cached.specification) setSpecification(cached.specification);
        }
        if (cached.packingTypes && Array.isArray(cached.packingTypes)) {
          setInternalPackingOptions(cached.packingTypes);
        }
        if (cached.loadingPorts && Array.isArray(cached.loadingPorts)) {
          setInternalLoadingPorts(cached.loadingPorts);
        }
        if (cached.destinationPorts && Array.isArray(cached.destinationPorts)) {
          setInternalDestinationPorts(cached.destinationPorts);
        }
        return;
      }

      if (currentProductIdRef.current && currentProductIdRef.current !== cleanId) {
        setInternalPackingOptions([]);
        setInternalLoadingPorts([]);
        setInternalDestinationPorts([]);
      }
      setIsLoadingProductDetails(true);

      try {
        const res = await getSmartDocsProductDetailsAction(cleanId, { lang });
        if (res?.success && res.data) {
          const d = res.data;
          productDetailsCacheRef.current[cleanId] = d;

          // Discard if user already switched product
          if (currentProductIdRef.current !== cleanId) return;

          if (forceOverwrite || !hsnCodeRef.current) {
            if (d.hsnCode || (d as any).hsn) setHsnCode(d.hsnCode || (d as any).hsn);
          }
          if (forceOverwrite || !productCountryRef.current) {
            if (d.country) setProductCountry(d.country);
          }
          if (forceOverwrite || !specificationRef.current) {
            if (d.specification) setSpecification(d.specification);
          }

          if (d.loadingPorts && Array.isArray(d.loadingPorts)) {
            setInternalLoadingPorts(d.loadingPorts);
          }
          if (d.destinationPorts && Array.isArray(d.destinationPorts)) {
            setInternalDestinationPorts(d.destinationPorts);
          }
          if (d.packingTypes && Array.isArray(d.packingTypes)) {
            setInternalPackingOptions(d.packingTypes);
          }
        }
      } catch (err) {
        console.error('[ContractDocumentForm] Product details error:', err);
      } finally {
        if (currentProductIdRef.current === cleanId) {
          setIsLoadingProductDetails(false);
        }
      }
    },
    [lang]
  );

  const handleProductChange = (val: string) => {
    markDirty();
    const isDifferent = String(val || '') !== String(productId || '');
    setProductId(val);
    currentProductIdRef.current = val;
    setErrors((prev) => ({ ...prev, productId: '' }));

    if (isDifferent) {
      setLoadingPort('');
      setDestinationPort('');
      setPacking('');
      setLoadingCondition('');
      setInternalLoadingPorts([]);
      setInternalDestinationPorts([]);
      setInternalPackingOptions([]);
      setErrors((prev) => ({
        ...prev,
        loadingPort: '',
        destinationPort: '',
        packing: '',
        loadingCondition: '',
      }));
    }

    const found = productsList.find(
      (p) =>
        String(p.value) === String(val) ||
        String(p.id) === String(val) ||
        String(p.label) === String(val)
    );
    if (found) {
      if (found.hsn) setHsnCode(found.hsn);
      if (found.country) setProductCountry(found.country);
      if (found.spec) setSpecification(found.spec);
    }

    if (val && val.trim()) {
      fetchAndApplyProductDetails(val, true);
    }
  };

  const handleSellerChange = (val: string) => {
    markDirty();
    setSellerId(val);
    setErrors((prev) => ({ ...prev, sellerId: '' }));
    const selected = internalSellers.find(
      (s) => String(s.value) === String(val) || String(s.id) === String(val) || String(s.label) === String(val)
    );
    if (selected) {
      const addressParts = [
        selected.label || selected.name || '',
        selected.address || selected.instructionText || selected.details || '',
      ].filter(Boolean);
      setSellerInstruction(addressParts.join('\n'));
    }
  };

  const handleBuyerChange = (val: string) => {
    markDirty();
    setBuyerId(val);
    setErrors((prev) => ({ ...prev, buyerId: '' }));
    const selected = internalBuyers.find(
      (b) => String(b.value) === String(val) || String(b.id) === String(val) || String(b.label) === String(val)
    );
    if (selected) {
      const addressParts = [
        selected.label || selected.name || '',
        selected.address || selected.instructionText || selected.details || '',
      ].filter(Boolean);
      setBuyerInstruction(addressParts.join('\n'));
    }
  };

  // Handle Currency selection and resolve currency ID
  const handleCurrencyChange = useCallback((val: string) => {
    const norm = normalizeCurrencyOption(val, currenciesList);
    const codeVal = norm.value || val;
    setCurrency(codeVal);
    const found = currenciesList.find(
      (c) =>
        String(c.value).toUpperCase() === String(codeVal).toUpperCase() ||
        String(c.code || '').toUpperCase() === String(codeVal).toUpperCase() ||
        String(c.id) === String(val) ||
        String(c.raw?.id) === String(val)
    );
    const cId = found?.id || found?.raw?.id || found?.raw?._id || found?.raw?.currency_id || norm.id;
    if (cId) setCurrencyId(String(cId));
  }, [currenciesList]);

  // Auto-resolve currencyId once currenciesList is available if not set
  useEffect(() => {
    if (currency && currenciesList.length > 0 && !currencyId) {
      const norm = normalizeCurrencyOption(currency, currenciesList);
      const targetVal = norm.value || currency;
      const found = currenciesList.find(
        (c) =>
          String(c.value).toUpperCase() === String(targetVal).toUpperCase() ||
          String(c.code || '').toUpperCase() === String(targetVal).toUpperCase()
      );
      const cId = found?.id || found?.raw?.id || found?.raw?._id || found?.raw?.currency_id || norm.id;
      if (cId) setCurrencyId(String(cId));
    }
  }, [currency, currenciesList, currencyId]);

  // Hydrate all form states when initialData arrives or updates (e.g. from async API fetch)
  useEffect(() => {
    if (!initialData) return;

    const statusFromDoc = extractDocumentStatus(initialData);
    if (statusFromDoc) {
      setDocStatus(statusFromDoc);
    }

    // Extract Contract ID only if strictly a contract (never overwrite draftId with confirmation id!)
    const contractIdCandidate = toCleanId(
      initialData.contract_id ||
      initialData.contractId ||
      (initialData.contract && typeof initialData.contract === 'object' ? initialData.contract.id || initialData.contract._id : '') ||
      (!initialData.confirmation_number && !initialData.confirmation_date && initialData.id !== confirmationId ? initialData.id : '')
    );

    const isExplicitContract = Boolean(
      initialData?.contract_number ||
      initialData?.contract_id ||
      initialData?.contractId ||
      initialData?.contract ||
      (initialData && !initialData.confirmation_number && !initialData.confirmation_id && initialData.status)
    );

    const isDataVersionTriggered = Boolean(
      dataVersion !== undefined && dataVersion !== lastDataVersionRef.current
    );
    const hasDocIdChanged = Boolean(contractIdCandidate && contractIdCandidate !== lastLoadedDocIdRef.current);

    // Once the form has been initialized, protect user edits IF user has active draft changes, UNLESS stepper navigation / explicit version trigger or doc ID change occurred
    if (isFormInitializedRef.current && !isDataVersionTriggered && !hasDocIdChanged && hasDraftChanges) {
      // Still update fresh signature URLs from backend if available and not cleared by user
      const sSig = resolveSigValue(initialData, [
        'seller_signature',
        'sellerSignature',
        'exporter_signature',
        'exporterSignature',
      ]);
      if (hasUserClearedExporterSigRef.current || !exporterSignature) {
        setExporterSignature('');
      } else if (sSig) {
        const formatted = formatSignatureUrl(sSig);
        setExporterSignature((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
      }

      const bSig = resolveSigValue(initialData, [
        'buyer_signature',
        'buyerSignature',
        'importer_signature',
        'importerSignature',
      ]);
      if (hasUserClearedImporterSigRef.current || !importerSignature) {
        setImporterSignature('');
      } else if (bSig) {
        const formatted = formatSignatureUrl(bSig);
        setImporterSignature((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
      }

      const brSig = resolveSigValue(initialData, [
        'broker_signature',
        'brokerSignature',
        'sales_broker_signature',
        'salesBrokerSignature',
      ]);
      if (hasUserClearedBrokerSigRef.current || !brokerSignature || userClearedBrokerRef.current || isSalesBrokerAllowed !== true) {
        setBrokerSignature('');
      } else if (brSig) {
        const formatted = formatSignatureUrl(brSig);
        setBrokerSignature((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
      }
      return;
    }

    isFormInitializedRef.current = true;
    if (dataVersion !== undefined) {
      lastDataVersionRef.current = dataVersion;
    }
    setHasDraftChanges(false);
    const isCompleted = statusFromDoc === 'COMPLETED';
    const hasId = Boolean(contractIdCandidate);
    setHasSubmitChanges(hasId && !isCompleted);
    if (contractIdCandidate && !isInvalidPlaceholder(contractIdCandidate) && contractIdCandidate !== confirmationId) {
      setDraftId(contractIdCandidate);
      lastLoadedDocIdRef.current = contractIdCandidate;
    }

    if (initialData.letterhead_space !== undefined) setLetterhead(Boolean(initialData.letterhead_space));
    else if (initialData.letterhead !== undefined) setLetterhead(Boolean(initialData.letterhead));

    if (initialData.is_watermark_enabled !== undefined) setWatermark(Boolean(initialData.is_watermark_enabled));
    else if (initialData.watermark !== undefined) setWatermark(Boolean(initialData.watermark));

    const title = toCleanText(initialData.pdf_title || initialData.pdfTitle || initialData.documentTitle || initialData.title);
    if (title) setDocumentTitle(title);

    const confNum = toCleanText(initialData.confirmation_number || initialData.confirmationNumber);
    if (confNum) setConfirmationNumber(confNum);

    const confDate = toCleanText(initialData.confirmation_date || initialData.confirmationDate);
    if (confDate) setConfirmationDate(confDate.includes('T') ? confDate.split('T')[0] : confDate);

    const contNum = toCleanText(initialData.contract_number || initialData.contractNumber);
    if (contNum) setContractNumber(contNum);

    const contDate = toCleanText(initialData.contract_date || initialData.contractDate);
    if (contDate) setContractDate(contDate.includes('T') ? contDate.split('T')[0] : contDate);

    const pHeader = toCleanText(initialData.parties_header || initialData.partiesHeader);
    if (pHeader) setPartiesHeader(pHeader);

    const sId = toCleanId(initialData.seller_instruction_id || initialData.sellerId || initialData.seller_id || initialData.seller);
    if (sId) setSellerId(sId);

    const sInst = toCleanText(
      initialData.seller_instruction ||
      initialData.sellerInstruction ||
      initialData.seller_details ||
      initialData.sellerDetails ||
      (typeof initialData.seller === 'object' ? initialData.seller.instructionText || initialData.seller.details : '')
    );
    if (sInst) setSellerInstruction(sInst);

    const bId = toCleanId(initialData.buyer_instruction_id || initialData.buyerId || initialData.buyer_id || initialData.buyer);
    if (bId) setBuyerId(bId);

    const bInst = toCleanText(
      initialData.buyer_instruction ||
      initialData.buyerInstruction ||
      initialData.buyer_details ||
      initialData.buyerDetails ||
      (typeof initialData.buyer === 'object' ? initialData.buyer.instructionText || initialData.buyer.instruction || initialData.buyer.details : '')
    );
    if (bInst) setBuyerInstruction(bInst);

    const shipInst = cleanShippingInstruction(
      initialData.terms_and_condition ||
      initialData.terms_and_conditions ||
      initialData.termsAndCondition ||
      initialData.termsAndConditions ||
      initialData.shipping_instruction ||
      initialData.shippingInstruction ||
      initialData.contract?.terms_and_condition ||
      initialData.contract?.shipping_instruction
    );
    if (shipInst) setShippingInstruction(shipInst);

    const pId = toCleanId(initialData.product_id || initialData.productId || initialData.product);
    if (pId) {
      setProductId(pId);
      currentProductIdRef.current = pId;
      fetchAndApplyProductDetails(pId, false);
    }

    const hsn = normalizeHsnString(initialData.hsn_code || initialData.hsnCode || initialData.hsn || (typeof initialData.product === 'object' ? initialData.product.hsn || initialData.product.hsn_code : ''));
    if (hsn) setHsnCode(hsn);

    const ctry = normalizeCountryString(initialData.country || initialData.productCountry || initialData.product_country || (typeof initialData.product === 'object' ? initialData.product.country || initialData.product.origin_country : ''));
    if (ctry) setProductCountry(ctry);

    const spec = toCleanText(initialData.quality_specification || initialData.specification || (typeof initialData.product === 'object' ? initialData.product.specification || initialData.product.quality_specification : ''));
    if (spec) setSpecification(spec);

    const start = initialData.shipment_start_date || initialData.shipmentStartDate;
    const end = initialData.shipment_end_date || initialData.shipmentEndDate;
    if (start || end) {
      setShipmentRange({
        start: start ? new Date(start) : null,
        end: end ? new Date(end) : null,
      });
    }

    const payTerm = toCleanId(initialData.payment_term_id || initialData.paymentTermId || initialData.paymentTerm || initialData.payment_term);
    if (payTerm) setPaymentTerm(payTerm);

    const fcl = normalizeFclType(initialData.fcl_type || initialData.fclType || initialData.ship_by || initialData.shipBy);
    if (fcl) setFclType(fcl);

    const pck = toCleanId(initialData.packing_type_id || initialData.packingTypeId || initialData.packing_type || initialData.packing) || toCleanLabel(initialData.packing_type || initialData.packing);
    if (pck) setPacking(pck);

    const brand = toCleanText(initialData.marking_brand || initialData.markingBrand || initialData.brand);
    if (brand) setMarkingBrand(brand);

    const lPort = toCleanId(initialData.loading_port_id || initialData.loadingPortId || initialData.loadingPort || initialData.loading_port) || toCleanLabel(initialData.loading_port || initialData.loadingPort);
    if (lPort) setLoadingPort(lPort);

    const anyPortFlag = parseAnyLoadingPort(initialData);
    if (anyPortFlag === true) {
      setLoadingCondition(DEFAULT_FIXED_LOADING_CONDITION.value);
    } else if (anyPortFlag === false) {
      const portName =
        getPortDisplayName(lPort, loadingPortsList) ||
        getFallbackPortName(initialData, lPort);
      if (portName && !isRawDbId(portName)) {
        setLoadingCondition(portName);
      }
    } else {
      const lCond = toCleanText(initialData.loading_condition || initialData.loadingCondition);
      if (lCond && lCond !== 'Select Loading Condition') setLoadingCondition(lCond);
    }

    const dPort = toCleanId(initialData.destination_port_id || initialData.destinationPortId || initialData.destinationPort || initialData.destination_port) || toCleanLabel(initialData.destination_port || initialData.destinationPort);
    if (dPort) setDestinationPort(dPort);

    const fQty = initialData.fcl_quantity ?? initialData.fcl_qty ?? initialData.fclQty;
    if (fQty !== undefined && fQty !== null && fQty !== '') setFclQty(fQty);

    const fCap = initialData.fcl_capacity ?? initialData.fclCapacity;
    if (fCap !== undefined && fCap !== null && fCap !== '') setFclCapacity(fCap);

    const mQty = initialData.mt_quantity ?? initialData.mt_qty ?? initialData.mtQty;
    if (mQty !== undefined && mQty !== null && mQty !== '') setMtQty(mQty);

    const bQty = initialData.bag_quantity ?? initialData.bag_qty ?? initialData.bagQty;
    if (bQty !== undefined && bQty !== null && bQty !== '') setBagQty(bQty);

    const rawCurr =
      initialData.currency ||
      initialData.currency_code ||
      initialData.currencyCode ||
      initialData.currency_id ||
      initialData.currencyId;
    if (rawCurr) {
      const normCurr = normalizeCurrencyOption(rawCurr, currenciesList);
      if (normCurr.value) setCurrency(normCurr.value);
      const cId =
        toCleanId(initialData.currency_id || initialData.currencyId) ||
        normCurr.id ||
        (typeof initialData.currency === 'object' ? toCleanId(initialData.currency?.id || initialData.currency?._id) : '');
      if (cId) setCurrencyId(String(cId));
    }

    const pr = initialData.price ?? initialData.rate;
    if (pr !== undefined && pr !== null && pr !== '') setPrice(pr);

    const tot = initialData.total_value ?? initialData.totalValue;
    if (tot !== undefined && tot !== null && tot !== '') setTotalValue(tot);

    const insp = toCleanText(initialData.inspection);
    if (insp) setInspection(insp);

    const inco = toCleanId(initialData.incoterm || initialData.shipping_term || initialData.shippingTerm) || toCleanLabel(initialData.incoterm || initialData.shipping_term || initialData.shippingTerm);
    if (inco) {
      setIncoterm(inco);
      const autoIns = getInsuranceFromIncoterm(inco, shippingTerms || DEFAULT_SHIPPING_TERMS);
      if (autoIns) setInsurance(autoIns);
    }

    if (initialData.insurance) setInsurance(String(initialData.insurance).trim().toUpperCase());

    const partialVal = parseInitialIsPartial(initialData);
    setIsPartialAllowed(partialVal);

    const sCount = parseInitialSplitCount(initialData);
    setSplitCount(sCount !== undefined && sCount !== null ? sCount : '');

    const initialSplits = parseInitialSplits(initialData);
    setSplits(initialSplits || []);

    const transhipVal = parseNullableBoolean(initialData.transhipment_allowed ?? initialData.transhipment);
    setIsTranshipmentAllowed(transhipVal);

    const transitVal = parseNullableBoolean(initialData.transit_clause_allowed ?? initialData.transit_clause);
    setIsTransitClauseAllowed(transitVal);

    const advVal = parseNullableBoolean(initialData.any_advance ?? initialData.has_advance ?? initialData.advance);
    if (!userToggledAdvanceRef.current) {
      setHasAdvance(advVal);
    }

    if (userClearedAdvanceRef.current) {
      setAdvanceType(null);
      setAdvanceAmount('');
      setAdvancePercentage('');
    } else if (!userToggledAdvanceRef.current) {
      const parsedAdvType = parseInitialAdvanceType(initialData);
      setAdvanceType(parsedAdvType);

      const advAmt =
        initialData.advance_payment_amt ??
        initialData.advance_payment ??
        initialData.advance_amount ??
        initialData.advanceAmount;
      if (advAmt !== undefined && advAmt !== null && advAmt !== '') setAdvanceAmount(advAmt);

      const advPct =
        initialData.advance_payment_pct ??
        initialData.advance_percentage ??
        initialData.advancePercentage ??
        initialData.advance_pct;
      if (advPct !== undefined && advPct !== null && advPct !== '') setAdvancePercentage(advPct);
    }

    const brokerVal = parseInitialIsBroker(initialData);
    if (!userToggledBrokerRef.current) {
      setIsSalesBrokerAllowed(brokerVal);
    }

    if (userClearedBrokerRef.current) {
      setBrokerCommissionType(null);
      setBrokerCommission('');
      setBrokerCommissionAmt('');
      setBrokerName('');
      setBrokerSignature('');
      setBrokerTitle('BROKER SIGNATURE');
      setBrokerAuthorityTitle('AUTHORISED SIGNATURE');
      hasUserClearedBrokerSigRef.current = true;
    } else if (!userToggledBrokerRef.current) {
      const bType = parseBrokerCommissionType(
        initialData.broker_commission_type ??
        initialData.sales_broker_type ??
        initialData.brokerCommissionType
      );
      setBrokerCommissionType(bType);

      const bComm = initialData.broker_commission ?? initialData.sales_broker_commission ?? initialData.brokerCommission;
      if (bComm !== undefined && bComm !== null && bComm !== '') setBrokerCommission(String(bComm));

      const bAmt =
        initialData.broker_commission_amt ??
        initialData.broker_commission_amount ??
        initialData.sales_broker_amount ??
        initialData.sales_broker_commission_amount;
      if (bAmt !== undefined && bAmt !== null && bAmt !== '') setBrokerCommissionAmt(String(bAmt));

      const bName = toCleanLabel(initialData.broker_name || initialData.sales_broker_name || initialData.brokerName);
      if (bName) setBrokerName(bName);
    }

    let ectnVal = parseNullableBoolean(
      initialData.ectn_field ??
      initialData.ectnField ??
      initialData.ectn
    );
    let cocVal = parseNullableBoolean(
      initialData.coc_fields ??
      initialData.cocFields ??
      initialData.coc_field ??
      initialData.cocField ??
      initialData.coc
    );
    // If ECTN is YES, COC is NO; if COC is YES, ECTN is NO
    if (ectnVal === true) {
      cocVal = false;
    } else if (cocVal === true) {
      ectnVal = false;
    }
    setEctnField(ectnVal);
    setCocFields(cocVal);

    if (ectnVal === true) {
      updateCertificateDocuments(true, false);
    } else if (cocVal === true) {
      updateCertificateDocuments(false, true);
    }

    const fDays = toCleanText(initialData.free_days || initialData.freeDays);
    if (fDays) setFreeDays(fDays);

    const eBags = toCleanText(initialData.empty_bags || initialData.emptyBags);
    if (eBags) setEmptyBags(eBags);

    const aComment = toCleanText(initialData.additional_comment || initialData.additionalComment || initialData.comment || initialData.comments);
    if (aComment) setAdditionalComment(aComment);

    const cLabel = toCleanText(
      initialData.comment_label ??
      initialData.commentLabel ??
      initialData.contract_comment_label ??
      initialData.comment_title
    );
    if (cLabel) setCommentLabel(cLabel);

    const cValue = toCleanText(
      initialData.comment_value ??
      initialData.commentValue ??
      initialData.contract_comment_value ??
      initialData.comment_text
    );
    if (cValue) setCommentValue(cValue);

    const oTerms = toCleanText(
      initialData.other_terms_1 ||
      initialData.other_terms1 ||
      initialData.otherTerms1 ||
      initialData.other_terms ||
      initialData.other_terms_payment ||
      initialData.otherTerms
    );
    if (oTerms) setOtherTermsPayment(oTerms);

    const legacyDefDocs = parseDefaultDocuments(
      initialData.default_documents ||
      initialData.defaultDocuments ||
      initialData.default_document_list ||
      initialData.defaultDocumentList
    );

    const resolvedDocs = extractAndResolveContractDocuments(
      initialData,
      internalDocumentList.length > 0 ? internalDocumentList : (documentsList || [])
    );

    const combinedDocs = [...resolvedDocs];
    const seenDocs = new Set(resolvedDocs.map((d) => d.trim().toUpperCase()));
    for (const d of legacyDefDocs) {
      if (d && !seenDocs.has(d.trim().toUpperCase())) {
        seenDocs.add(d.trim().toUpperCase());
        combinedDocs.push(d.trim().toUpperCase());
      }
    }

    if (combinedDocs.length > 0) {
      setSelectedDocuments(combinedDocs);
      setInternalDocumentList((prev) => {
        const existingNames = new Set(prev.map((p) => p.name.toUpperCase()));
        const toAdd: SmartDocsSelectionDocumentOption[] = [];
        for (const doc of combinedDocs) {
          if (!existingNames.has(doc.toUpperCase())) {
            existingNames.add(doc.toUpperCase());
            toAdd.push({
              id: doc,
              name: doc,
              label: doc,
              value: doc,
              isCustom: true,
            });
          }
        }
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }

    const sLine = toCleanText(initialData.shipping_line || initialData.shippingLine);
    if (sLine) setShippingLine(sLine);

    const arbit = toCleanText(initialData.arbitration);
    if (arbit) setArbitration(arbit);

    const cTerms = toCleanText(
      initialData.other_terms_2 ||
      initialData.other_terms2 ||
      initialData.otherTerms2 ||
      initialData.container_terms ||
      initialData.container_standards ||
      initialData.containerStandards
    );
    if (cTerms) setContainerStandards(cTerms);

    const fMajeur = toCleanText(initialData.force_majeur || initialData.forceMajeur);
    if (fMajeur) setForceMajeur(fMajeur);

    const conf = toCleanText(initialData.confidentiality);
    if (conf) setConfidentiality(conf);

    const nts = toCleanText(initialData.notes ?? initialData.special_notes ?? initialData.terms_notes);
    if (nts) setNotes(nts);

    // Importer / Buyer Signature Fields
    const bField = resolveSigValue(initialData, [
      'buyer_signature_field',
      'buyerSignatureField',
      'importer_signature_field',
      'importer_title',
      'importerTitle',
    ]);
    if (bField) setImporterTitle(bField);

    const bSig = resolveSigValue(initialData, [
      'buyer_signature',
      'buyerSignature',
      'importer_signature',
      'importerSignature',
    ]);
    if (hasUserClearedImporterSigRef.current || !importerSignature) {
      if (hasUserClearedImporterSigRef.current) {
        setImporterSignature('');
      } else if (bSig) {
        setImporterSignature(formatSignatureUrl(bSig));
      }
    } else if (bSig) {
      const formatted = formatSignatureUrl(bSig);
      setImporterSignature((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
    }

    const bLabel = resolveSigValue(initialData, [
      'buyer_signature_label',
      'buyerSignatureLabel',
      'importer_signature_label',
      'importer_authority_title',
      'importerAuthorityTitle',
    ]);
    if (bLabel) setImporterAuthorityTitle(bLabel);

    // Broker Signature Fields
    const brField = resolveSigValue(initialData, [
      'broker_signature_field',
      'brokerSignatureField',
      'broker_title',
      'sales_broker_title',
      'brokerTitle',
    ]);
    if (userClearedBrokerRef.current) {
      setBrokerTitle('BROKER SIGNATURE');
    } else if (brField) {
      setBrokerTitle(brField);
    }

    const brSig = resolveSigValue(initialData, [
      'broker_signature',
      'sales_broker_signature',
      'brokerSignature',
    ]);
    if (userClearedBrokerRef.current || hasUserClearedBrokerSigRef.current || isSalesBrokerAllowed !== true || !brokerSignature) {
      if (userClearedBrokerRef.current || hasUserClearedBrokerSigRef.current || isSalesBrokerAllowed !== true) {
        setBrokerSignature('');
      } else if (brSig) {
        setBrokerSignature(formatSignatureUrl(brSig));
      }
    } else if (brSig) {
      const formatted = formatSignatureUrl(brSig);
      setBrokerSignature((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
    }

    const brLabel = resolveSigValue(initialData, [
      'broker_signature_label',
      'brokerSignatureLabel',
      'broker_authority_title',
      'sales_broker_authority_title',
      'brokerAuthorityTitle',
    ]);
    if (userClearedBrokerRef.current) {
      setBrokerAuthorityTitle('AUTHORISED SIGNATURE');
    } else if (brLabel) {
      setBrokerAuthorityTitle(brLabel);
    }

    // Exporter / Seller Signature Fields
    const sField = resolveSigValue(initialData, [
      'seller_signature_field',
      'sellerSignatureField',
      'exporter_signature_field',
      'exporter_title',
      'exporterTitle',
    ]);
    if (sField) setExporterTitle(sField);

    const sSig = resolveSigValue(initialData, [
      'seller_signature',
      'sellerSignature',
      'exporter_signature',
      'exporterSignature',
    ]);
    if (hasUserClearedExporterSigRef.current || !exporterSignature) {
      if (hasUserClearedExporterSigRef.current) {
        setExporterSignature('');
      } else if (sSig) {
        setExporterSignature(formatSignatureUrl(sSig));
      }
    } else if (sSig) {
      const formatted = formatSignatureUrl(sSig);
      setExporterSignature((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
    }

    const sLabel = resolveSigValue(initialData, [
      'seller_signature_label',
      'sellerSignatureLabel',
      'exporter_signature_label',
      'exporter_authority_title',
      'exporterAuthorityTitle',
    ]);
    if (sLabel) setExporterAuthorityTitle(sLabel);
  }, [initialData, dataVersion, shippingTerms, fetchAndApplyProductDetails]);

  // Ensure product details (ports, packing) are fetched on mount if productId is present and options are not yet loaded
  useEffect(() => {
    if (productId && internalLoadingPorts.length === 0 && internalPackingOptions.length === 0) {
      fetchAndApplyProductDetails(productId, false);
    }
  }, [productId, internalLoadingPorts.length, internalPackingOptions.length, fetchAndApplyProductDetails]);

  // Real-time calculation for MT QTY, BAG QTY & TOTAL VALUE
  useEffect(() => {
    const bagKg = parsePackingBagWeightKg(packing, packingList);
    const p = parseFloat(String(price)) || 0;

    if (isFcl) {
      const fcl = parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0;
      const capacity = parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0;
      const calcMt = fcl * capacity;
      const nextMt =
        !fclQty && !fclCapacity
          ? ''
          : calcMt > 0
          ? calcMt % 1 === 0
            ? calcMt.toString()
            : calcMt.toFixed(2)
          : '0';

      if (String(mtQty) !== String(nextMt)) {
        setMtQty(nextMt);
      }

      if (calcMt > 0 && bagKg && bagKg > 0) {
        const calcBags = Math.round((calcMt * 1000) / bagKg);
        if (String(bagQty) !== String(calcBags)) {
          setBagQty(calcBags);
        }
      } else if (!nextMt) {
        setBagQty('');
      }

      if (calcMt > 0 && p > 0) {
        const calcTotal = (calcMt * p).toFixed(2);
        if (String(totalValue) !== String(calcTotal)) {
          setTotalValue(calcTotal);
        }
      } else if (!nextMt || !price) {
        setTotalValue('');
      }
    } else {
      const mt = parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
      if (mt > 0 && bagKg && bagKg > 0) {
        const calcBags = Math.round((mt * 1000) / bagKg);
        if (String(bagQty) !== String(calcBags)) {
          setBagQty(calcBags);
        }
      } else if (!mtQty) {
        setBagQty('');
      }

      if (mt > 0 && p > 0) {
        const calcTotal = (mt * p).toFixed(2);
        if (String(totalValue) !== String(calcTotal)) {
          setTotalValue(calcTotal);
        }
      } else if (!mtQty || !price) {
        setTotalValue('');
      }
    }
  }, [isFcl, fclQty, fclCapacity, mtQty, packing, price, packingList]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!contractNumber || !contractNumber.trim()) {
      newErrors.contractNumber =
        dict?.smart_docs?.contract_form?.contract_number_required || 'Contract number is required';
    }
    if (!sellerId) {
      newErrors.sellerId = 'Please select a seller';
    }
    if (!buyerId) {
      newErrors.buyerId = 'Please select a buyer';
    }
    if (!productId) {
      newErrors.productId = 'Please select a product';
    }
    if (isFcl) {
      if (!fclQty || Number(fclQty) <= 0) {
        newErrors.fclQty = 'FCL Qty required';
      }
      if (!fclCapacity || Number(fclCapacity) <= 0) {
        newErrors.fclCapacity = 'FCL Capacity required';
      }
    } else {
      if (!mtQty || Number(mtQty) <= 0) {
        newErrors.mtQty = 'MT Qty required';
      }
    }
    if (!price || Number(price) <= 0) {
      newErrors.price = 'Price is required';
    }

    if (isPartialAllowed) {
      const count = parseInt(String(splitCount), 10);
      if (!splitCount || isNaN(count) || count <= 0) {
        newErrors.partialCount = 'Partial count is required';
      } else if (count > 30) {
        newErrors.partialCount = 'Maximum 30 partial shipments allowed';
      } else {
        const hasEmpty = splits.some((q) => q.fcl_quantity === '' || q.fcl_quantity === null || q.fcl_quantity === undefined);
        if (hasEmpty) {
          newErrors.partialTotal = 'All partial quantities must be entered';
        } else if (targetFclQty > 0 && Math.abs(partialSum - targetFclQty) > 0.0001) {
          newErrors.partialTotal = `Total partial quantity (${partialSum}) must equal ${isFcl ? 'FCL' : 'MT'} Quantity (${targetFclQty})`;
        }
      }
    }

    // Advance Validation (enforced only when user explicitly enables Advance and selects type; if unselected, treated as NO advance at save/submit)
    if (hasAdvance === true && advanceType) {
      if (advanceType === 'AMOUNT') {
        const numAmt = parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0;
        if (!advanceAmount || numAmt <= 0) {
          newErrors.advanceAmount = 'Advance amount is required';
        }
      } else if (advanceType === 'PERCENTAGE') {
        const numPct = parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0;
        if (!advancePercentage || numPct <= 0) {
          newErrors.advancePercentage = 'Advance percentage is required';
        } else if (numPct > 100) {
          newErrors.advancePercentage = 'Advance percentage cannot exceed 100%';
        }
      }
    }

    // Sales Broker Validation (enforced only when user explicitly enables Broker and selects type; if unselected, treated as NOT ALLOWED at save/submit)
    if (isSalesBrokerAllowed === true && brokerCommissionType) {
      const numComm = parseFloat(String(brokerCommission).replace(/[^\d.]/g, '')) || 0;
      if (!brokerCommission || numComm <= 0) {
        newErrors.brokerCommission = 'Broker commission rate is required';
      }
      if (!brokerName || !brokerName.trim()) {
        newErrors.brokerName = 'Broker name is required';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      scrollToAndFocusContractField(newErrors);
      return false;
    }
    return true;
  };

  /**
   * Constructs the complete multipart/form-data payload for the Contract Save As Draft / Submit API.
   * Signatures are converted to binary files (seller_signature, buyer_signature, broker_signature)
   * and array fields (splits, documents_required[]) follow the exact contract API contract.
   */
  const getContractFormData = (): FormData => {
    const formData = new FormData();
    const cleanConfId = sanitizeDocId(confirmationId);
    const cleanEffectiveId = getEffectiveContractId();
    const effectiveContractId = (cleanEffectiveId && cleanEffectiveId !== cleanConfId)
      ? cleanEffectiveId
      : (draftId && draftId !== cleanConfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(draftId) ? draftId : '');

    if (effectiveContractId) {
      formData.append('id', effectiveContractId);
      formData.append('contract_id', effectiveContractId);
    }

    if (cleanConfId) {
      formData.append('confirmation_id', cleanConfId);
    }

    // Letterhead & Watermark
    formData.append('letterhead_space', String(Boolean(letterhead)));
    formData.append('is_watermark_enabled', String(Boolean(watermark)));
    formData.append('pdf_title', documentTitle.trim() || 'CONTRACT');

    // Dates & Numbers
    const formattedConfDate = confirmationDate ? String(confirmationDate).trim() : '';
    formData.append('confirmation_date', formattedConfDate);

    formData.append('contract_number', contractNumber.trim());
    const formattedContractDate = contractDate ? String(contractDate).trim() : '';
    formData.append('contract_date', formattedContractDate);

    // Parties
    const pHeader = partiesHeader.trim() || 'THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES';
    formData.append('party_header_label', pHeader);
    formData.append('parties_header', pHeader);

    formData.append('seller_instruction_id', sellerId || '');
    formData.append('seller_instruction', sellerInstruction.trim());
    formData.append('buyer_instruction_id', buyerId || '');
    formData.append('buyer_instruction', buyerInstruction.trim());

    // Terms & Conditions
    const terms = shippingInstruction.trim() || 'NOT TO BE ADVICED';
    formData.append('terms_and_condition', terms);
    formData.append('shipping_instruction', shippingInstruction.trim());

    // Product & Specifications
    formData.append('product_id', productId || '');
    formData.append('hsn_code', hsnCode || '');
    formData.append('country', productCountry || '');
    formData.append('quality_specification', specification.trim());

    // Shipment Dates
    const startDateStr = shipmentRange.start instanceof Date && !isNaN(shipmentRange.start.getTime())
      ? shipmentRange.start.toISOString().split('T')[0]
      : '';
    const endDateStr = shipmentRange.end instanceof Date && !isNaN(shipmentRange.end.getTime())
      ? shipmentRange.end.toISOString().split('T')[0]
      : '';
    formData.append('shipment_start_date', startDateStr);
    formData.append('shipment_end_date', endDateStr);

    // Payment & Shipping
    formData.append('payment_term_id', paymentTerm || '');
    formData.append('ship_by', normalizeFclType(fclType) || fclType || '');
    formData.append('packing_type_id', packing || '');
    formData.append('marking_brand', markingBrand.trim());
    formData.append('loading_port_id', loadingPort || '');
    formData.append('loading_condition', loadingCondition || '');

    const isAnyPort = Boolean(
      loadingCondition &&
      loadingCondition.trim().toLowerCase() === 'any port of loading'
    );
    formData.append('any_loading_port', String(isAnyPort));
    formData.append('destination_port_id', destinationPort || '');

    // Quantities & Pricing
    if (isFcl && fclQty) {
      formData.append('fcl_quantity', String(fclQty));
    }
    if (isFcl && fclCapacity) {
      formData.append('fcl_capacity', String(fclCapacity));
    }
    if (mtQty) {
      formData.append('mt_quantity', String(mtQty));
    }
    if (bagQty) {
      formData.append('bag_quantity', String(bagQty));
    }

    formData.append('currency_id', currencyId || currency || '');
    if (price) {
      formData.append('price', String(price));
    }
    if (totalValue) {
      formData.append('total_value', String(totalValue));
    }

    formData.append('inspection', inspection.trim());
    formData.append('shipping_term', incoterm.trim());
    formData.append('incoterm', incoterm.trim());
    formData.append('insurance', (effectiveInsurance || insurance || '').trim());

    // Splits / Partial Shipment
    formData.append('is_partial', String(Boolean(isPartialAllowed)));
    if (isPartialAllowed) {
      const sCount = splitCount ? Math.min(Number(splitCount), 30) : splits.length;
      formData.append('split_count', String(sCount || 0));

      splits.slice(0, 30).forEach((s, idx) => {
        const splitLetter = formatSplitNumber(s.split_number, idx);
        const qtyVal = s.fcl_quantity !== undefined && s.fcl_quantity !== null && s.fcl_quantity !== ''
          ? String(s.fcl_quantity)
          : '0';
        formData.append(`splits[${idx}][split_number]`, splitLetter);
        formData.append(`splits[${idx}][fcl_quantity]`, qtyVal);
      });
    } else {
      formData.append('split_count', '0');
    }

    // Transport & Advance
    formData.append('transhipment', String(Boolean(isTranshipmentAllowed)));
    formData.append('transhipment_allowed', String(Boolean(isTranshipmentAllowed)));
    formData.append('transit_clause', String(Boolean(isTransitClauseAllowed)));
    formData.append('transit_clause_allowed', String(Boolean(isTransitClauseAllowed)));

    // Advance Details - if user did not explicitly choose YES and select a type, defaults to NO advance (false) at submit/save time
    const effectiveHasAdvance = Boolean(hasAdvance === true && advanceType);
    formData.append('any_advance', String(effectiveHasAdvance));
    if (effectiveHasAdvance) {
      const advPaymentType = advanceType === 'PERCENTAGE' ? 'PERCENTAGE' : 'AMOUNT';
      formData.append('advance_payment_type', advPaymentType);
      formData.append('advance_type', advPaymentType);

      if (advanceType === 'AMOUNT') {
        const rawAmt = parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0;
        const formattedAmt = rawAmt.toFixed(2);
        formData.append('advance_payment_amt', formattedAmt);
        formData.append('advance_amount', formattedAmt);
        formData.append('advance_payment', formattedAmt);

        const calcPct = effectiveContractTotalValue > 0 && rawAmt > 0
          ? Math.min((rawAmt / effectiveContractTotalValue) * 100, 100)
          : 0;
        const formattedPct = calcPct.toFixed(2);
        formData.append('advance_payment_pct', formattedPct);
        formData.append('advance_percentage', formattedPct);
        formData.append('advance_pct', formattedPct);
      } else if (advanceType === 'PERCENTAGE') {
        const rawPct = parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0;
        const formattedPct = Math.min(rawPct, 100).toFixed(2);
        formData.append('advance_payment_pct', formattedPct);
        formData.append('advance_percentage', formattedPct);
        formData.append('advance_pct', formattedPct);

        const calcAmt = effectiveContractTotalValue > 0 && rawPct > 0
          ? (effectiveContractTotalValue * rawPct) / 100
          : parseFloat(String(calculatedAdvanceAmount).replace(/[^\d.]/g, '')) || 0;
        const formattedAmt = calcAmt.toFixed(2);
        formData.append('advance_payment_amt', formattedAmt);
        formData.append('advance_amount', formattedAmt);
        formData.append('advance_payment', formattedAmt);
      }
    } else {
      formData.append('advance_payment_type', '');
      formData.append('advance_type', '');
      formData.append('advance_payment_amt', '0');
      formData.append('advance_amount', '0');
      formData.append('advance_payment', '0');
      formData.append('advance_payment_pct', '0');
      formData.append('advance_percentage', '0');
      formData.append('advance_pct', '0');
    }

    // Broker Details - if user did not explicitly choose Allowed with a commission type, defaults to NOT ALLOWED (false) at submit/save time
    const effectiveIsBroker = Boolean(isSalesBrokerAllowed === true && brokerCommissionType);
    formData.append('is_broker', String(effectiveIsBroker));
    formData.append('sales_broker_allowed', String(effectiveIsBroker));
    if (effectiveIsBroker) {
      formData.append('broker_commission_type', brokerCommissionType!);
      formData.append('sales_broker_type', brokerCommissionType!);
      if (brokerCommission) {
        formData.append('broker_commission', String(brokerCommission));
        formData.append('sales_broker_commission', String(brokerCommission));
      }
      const cAmt = calculatedBrokerCommission || brokerCommissionAmt;
      if (cAmt) {
        const rawCAmt = parseFloat(String(cAmt).replace(/[^\d.]/g, '')) || 0;
        const formattedCAmt = rawCAmt.toFixed(2);
        formData.append('broker_commission_amt', formattedCAmt);
        formData.append('broker_commission_amount', formattedCAmt);
        formData.append('sales_broker_amount', formattedCAmt);
      }
      if (brokerName.trim()) {
        formData.append('broker_name', brokerName.trim());
        formData.append('sales_broker_name', brokerName.trim());
      }
    } else {
      formData.append('broker_commission_type', '');
      formData.append('sales_broker_type', '');
      formData.append('broker_commission', '0');
      formData.append('sales_broker_commission', '0');
      formData.append('broker_commission_amt', '0');
      formData.append('broker_commission_amount', '0');
      formData.append('sales_broker_amount', '0');
      formData.append('broker_name', '');
      formData.append('sales_broker_name', '');
    }

    // Broker Signature
    formData.append('broker_signature_field', effectiveIsBroker ? brokerTitle.trim() : '');
    formData.append('broker_signature_label', effectiveIsBroker ? brokerAuthorityTitle.trim() : '');
    if (effectiveIsBroker && brokerSignature) {
      if (brokerSignature.startsWith('data:') || brokerSignature.startsWith('blob:')) {
        const file = dataUrlToFile(brokerSignature, 'broker_signature.png');
        if (file) {
          formData.append('broker_signature', file);
        }
      } else {
        const relUrl = normalizeSignaturePayload(brokerSignature);
        if (relUrl) {
          formData.append('broker_signature_url', relUrl);
        }
      }
      formData.append('remove_broker_signature', 'false');
      formData.append('remove_sales_broker_signature', 'false');
    } else {
      formData.append('remove_broker_signature', 'true');
      formData.append('remove_sales_broker_signature', 'true');
      formData.append('broker_signature', '');
      formData.append('broker_signature_url', '');
      formData.append('sales_broker_signature', '');
      formData.append('sales_broker_signature_url', '');
    }

    // ECTN / COC fields
    if (ectnField !== null) {
      formData.append('ectn_field', String(ectnField));
    } else {
      formData.append('ectn_field', '');
    }
    if (cocFields !== null) {
      formData.append('coc_fields', String(cocFields));
    } else {
      formData.append('coc_fields', '');
    }

    // Other details
    formData.append('free_days', freeDays.trim());
    formData.append('empty_bags', emptyBags.trim());
    formData.append('comment', additionalComment.trim());
    formData.append('additional_comment', additionalComment.trim());
    formData.append('comment_label', commentLabel.trim());
    formData.append('comment_value', commentValue.trim());

    // Terms & Documents
    formData.append('other_terms_1', otherTermsPayment.trim());
    formData.append('other_terms', otherTermsPayment.trim());

    if (effectiveDocs && effectiveDocs.length > 0) {
      for (const doc of effectiveDocs) {
        if (doc && doc.trim()) {
          formData.append('documents_required[]', doc.trim());
          formData.append('documents[]', doc.trim());
          formData.append('required_documents[]', doc.trim());
        }
      }
    }

    formData.append('shipping_line', shippingLine.trim());
    formData.append('arbitration', arbitration.trim());
    formData.append('other_terms_2', containerStandards.trim());
    formData.append('container_terms', containerStandards.trim());
    formData.append('force_majeur', forceMajeur.trim());
    formData.append('confidentiality', confidentiality.trim());
    formData.append('notes', notes.trim());

    // Seller (Exporter) Signature: binary File conversion from merged/composite dataUrl
    formData.append('seller_signature_field', exporterTitle.trim());
    formData.append('seller_signature_label', exporterAuthorityTitle.trim());
    if (exporterSignature) {
      if (exporterSignature.startsWith('data:') || exporterSignature.startsWith('blob:')) {
        const file = dataUrlToFile(exporterSignature, 'seller_signature.png');
        if (file) {
          formData.append('seller_signature', file);
        }
      } else {
        const relUrl = normalizeSignaturePayload(exporterSignature);
        if (relUrl) {
          formData.append('seller_signature_url', relUrl);
        }
      }
      formData.append('remove_seller_signature', 'false');
    } else {
      formData.append('remove_seller_signature', 'true');
      formData.append('remove_exporter_signature', 'true');
      formData.append('seller_signature', '');
      formData.append('seller_signature_url', '');
      formData.append('exporter_signature', '');
      formData.append('exporter_signature_url', '');
    }

    // Buyer (Importer) Signature: binary File conversion from merged/composite dataUrl
    formData.append('buyer_signature_field', importerTitle.trim());
    formData.append('buyer_signature_label', importerAuthorityTitle.trim());
    if (importerSignature) {
      if (importerSignature.startsWith('data:') || importerSignature.startsWith('blob:')) {
        const file = dataUrlToFile(importerSignature, 'buyer_signature.png');
        if (file) {
          formData.append('buyer_signature', file);
        }
      } else {
        const relUrl = normalizeSignaturePayload(importerSignature);
        if (relUrl) {
          formData.append('buyer_signature_url', relUrl);
        }
      }
      formData.append('remove_buyer_signature', 'false');
    } else {
      formData.append('remove_buyer_signature', 'true');
      formData.append('remove_importer_signature', 'true');
      formData.append('buyer_signature', '');
      formData.append('buyer_signature_url', '');
      formData.append('importer_signature', '');
      formData.append('importer_signature_url', '');
    }

    return formData;
  };

  const getContractPayload = () => {
    const effectiveContractId = getEffectiveContractId() || undefined;

    const confId =
      confirmationId ||
      toCleanId(
        initialData?.confirmation_id ||
        initialData?.confirmationId ||
        (initialData?.confirmation_number || initialData?.confirmation_date ? initialData?.id || initialData?._id : '')
      ) || undefined;

    return {
      id: effectiveContractId,
      contract_id: effectiveContractId,
      confirmation_id: confId,
      confirmation_number: confirmationNumber.trim(),
      confirmation_date: confirmationDate,
      contract_number: contractNumber.trim(),
      contract_date: contractDate,
      pdf_title: documentTitle.trim() || 'CONTRACT',
      letterhead_space: Boolean(letterhead),
      is_watermark_enabled: Boolean(watermark),
      party_header_label: partiesHeader.trim() || 'THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES',
      parties_header: partiesHeader.trim(),
      seller_instruction_id: sellerId,
      seller_instruction: sellerInstruction.trim(),
      buyer_instruction_id: buyerId,
      buyer_instruction: buyerInstruction.trim(),
      shipping_instruction: shippingInstruction.trim(),
      terms_and_condition: shippingInstruction.trim() || 'NOT TO BE ADVICED',
      product_id: productId,
      hsn_code: hsnCode,
      country: productCountry,
      quality_specification: specification.trim(),
      shipment_start_date: shipmentRange.start ? shipmentRange.start.toISOString().split('T')[0] : undefined,
      shipment_end_date: shipmentRange.end ? shipmentRange.end.toISOString().split('T')[0] : undefined,
      payment_term_id: paymentTerm,
      fcl_type: normalizeFclType(fclType) || fclType,
      ship_by: normalizeFclType(fclType) || fclType,
      packing_type_id: packing,
      marking_brand: markingBrand.trim(),
      loading_port_id: loadingPort,
      loading_condition: loadingCondition,
      any_loading_port: Boolean(
        loadingCondition &&
        loadingCondition.trim().toLowerCase() === 'any port of loading'
      ),
      destination_port_id: destinationPort,
      fcl_quantity: isFcl && fclQty ? Number(fclQty) : undefined,
      fcl_capacity: isFcl && fclCapacity ? String(fclCapacity) : undefined,
      mt_quantity: mtQty ? Number(mtQty) : undefined,
      bag_quantity: bagQty ? Number(bagQty) : undefined,
      currency_id: currencyId || currency,
      currency: currency,
      price: price ? Number(price) : undefined,
      total_value: totalValue ? Number(totalValue) : undefined,
      inspection: inspection.trim(),
      shipping_term: incoterm,
      incoterm: incoterm,
      insurance: effectiveInsurance || insurance,
      is_partial: isPartialAllowed,
      partial_shipment_allowed: isPartialAllowed,
      is_partial_allowed: isPartialAllowed,
      split_count: isPartialAllowed && splitCount ? Math.min(Number(splitCount), 30) : (isPartialAllowed === false ? 0 : null),
      partial_count: isPartialAllowed && splitCount ? Math.min(Number(splitCount), 30) : undefined,
      splits:
        isPartialAllowed && splits.length > 0
          ? splits.slice(0, 30).map((s, idx) => ({
              ...s,
              split_number: formatSplitNumber(s.split_number, idx),
              fcl_quantity: s.fcl_quantity !== '' && s.fcl_quantity !== null && s.fcl_quantity !== undefined ? Number(s.fcl_quantity) : 0,
            }))
          : [],
      partial_breakdown:
        isPartialAllowed && splits.length > 0
          ? splits.slice(0, 30).map((s) => (s.fcl_quantity !== '' ? Number(s.fcl_quantity) : 0))
          : undefined,
      partial_quantities:
        isPartialAllowed && splits.length > 0
          ? splits.slice(0, 30).map((s) => (s.fcl_quantity !== '' ? Number(s.fcl_quantity) : 0))
          : undefined,
      transhipment: Boolean(isTranshipmentAllowed),
      transhipment_allowed: isTranshipmentAllowed !== null ? isTranshipmentAllowed : undefined,
      transit_clause: Boolean(isTransitClauseAllowed),
      transit_clause_allowed: isTransitClauseAllowed !== null ? isTransitClauseAllowed : undefined,
      any_advance: Boolean(hasAdvance === true && advanceType),
      advance_payment_type: hasAdvance === true && advanceType ? (advanceType === 'PERCENTAGE' ? 'PERCENTAGE' : 'AMOUNT') : undefined,
      advance_type: hasAdvance === true && advanceType ? (advanceType === 'PERCENTAGE' ? 'PERCENTAGE' : 'AMOUNT') : undefined,
      advance_payment_amt: hasAdvance === true && advanceType
        ? advanceType === 'AMOUNT'
          ? (parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0).toFixed(2)
          : (
              effectiveContractTotalValue > 0 && advancePercentage
                ? (effectiveContractTotalValue * (parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0)) / 100
                : parseFloat(String(calculatedAdvanceAmount).replace(/[^\d.]/g, '')) || 0
            ).toFixed(2)
        : null,
      advance_amount: hasAdvance === true && advanceType
        ? advanceType === 'AMOUNT'
          ? (parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0).toFixed(2)
          : (
              effectiveContractTotalValue > 0 && advancePercentage
                ? (effectiveContractTotalValue * (parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0)) / 100
                : parseFloat(String(calculatedAdvanceAmount).replace(/[^\d.]/g, '')) || 0
            ).toFixed(2)
        : null,
      advance_payment: hasAdvance === true && advanceType
        ? advanceType === 'AMOUNT'
          ? (parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0).toFixed(2)
          : (
              effectiveContractTotalValue > 0 && advancePercentage
                ? (effectiveContractTotalValue * (parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0)) / 100
                : parseFloat(String(calculatedAdvanceAmount).replace(/[^\d.]/g, '')) || 0
            ).toFixed(2)
        : null,
      advance_payment_pct: hasAdvance === true && advanceType
        ? advanceType === 'PERCENTAGE'
          ? Math.min(parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0, 100).toFixed(2)
          : (
              effectiveContractTotalValue > 0 && advanceAmount
                ? Math.min(((parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0) / effectiveContractTotalValue) * 100, 100)
                : 0
            ).toFixed(2)
        : null,
      advance_percentage: hasAdvance === true && advanceType
        ? advanceType === 'PERCENTAGE'
          ? Math.min(parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0, 100).toFixed(2)
          : (
              effectiveContractTotalValue > 0 && advanceAmount
                ? Math.min(((parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0) / effectiveContractTotalValue) * 100, 100)
                : 0
            ).toFixed(2)
        : null,
      advance_pct: hasAdvance === true && advanceType
        ? advanceType === 'PERCENTAGE'
          ? Math.min(parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0, 100).toFixed(2)
          : (
              effectiveContractTotalValue > 0 && advanceAmount
                ? Math.min(((parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0) / effectiveContractTotalValue) * 100, 100)
                : 0
            ).toFixed(2)
        : null,
      is_broker: Boolean(isSalesBrokerAllowed === true && brokerCommissionType),
      sales_broker_allowed: Boolean(isSalesBrokerAllowed === true && brokerCommissionType),
      broker_commission_type: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) ? brokerCommissionType : null,
      broker_commission: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && brokerCommission ? Number(brokerCommission) : null,
      broker_commission_amt: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && (calculatedBrokerCommission || brokerCommissionAmt) ? (parseFloat(String(calculatedBrokerCommission || brokerCommissionAmt).replace(/[^\d.]/g, '')) || 0).toFixed(2) : null,
      broker_commission_amount: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && (calculatedBrokerCommission || brokerCommissionAmt) ? (parseFloat(String(calculatedBrokerCommission || brokerCommissionAmt).replace(/[^\d.]/g, '')) || 0).toFixed(2) : null,
      broker_name: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && brokerName.trim() ? brokerName.trim() : null,
      sales_broker_type: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) ? brokerCommissionType : null,
      sales_broker_commission: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && brokerCommission ? Number(brokerCommission) : null,
      sales_broker_amount: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && (calculatedBrokerCommission || brokerCommissionAmt) ? (parseFloat(String(calculatedBrokerCommission || brokerCommissionAmt).replace(/[^\d.]/g, '')) || 0).toFixed(2) : null,
      sales_broker_name: Boolean(isSalesBrokerAllowed === true && brokerCommissionType) && brokerName.trim() ? brokerName.trim() : null,
      ectn_field: ectnField,
      coc_fields: cocFields,
      free_days: freeDays.trim(),
      empty_bags: emptyBags.trim(),
      comment: additionalComment.trim(),
      additional_comment: additionalComment.trim(),
      comment_label: commentLabel.trim(),
      comment_value: commentValue.trim(),
      other_terms: otherTermsPayment.trim(),
      other_terms_1: otherTermsPayment.trim(),
      documents_required: effectiveDocs,
      required_documents: effectiveDocs,
      documents: effectiveDocs,
      shipping_line: shippingLine.trim(),
      arbitration: arbitration.trim(),
      container_terms: containerStandards.trim(),
      other_terms_2: containerStandards.trim(),
      force_majeur: forceMajeur.trim(),
      confidentiality: confidentiality.trim(),
      notes: notes.trim(),

      // Signature fields for contract API (seller_signature_field, broker_signature_field, buyer_signature_field)
      seller_signature_field: exporterTitle.trim(),
      seller_signature_label: exporterAuthorityTitle.trim(),
      seller_signature: exporterSignature ? normalizeSignaturePayload(exporterSignature) : null,
      seller_signature_url: exporterSignature ? normalizeSignaturePayload(exporterSignature) : null,
      remove_seller_signature: !exporterSignature,
      remove_exporter_signature: !exporterSignature,

      broker_signature_field: isSalesBrokerAllowed === true && brokerCommissionType ? brokerTitle.trim() : null,
      broker_signature_label: isSalesBrokerAllowed === true && brokerCommissionType ? brokerAuthorityTitle.trim() : null,
      broker_signature: isSalesBrokerAllowed === true && brokerCommissionType && brokerSignature ? normalizeSignaturePayload(brokerSignature) : null,
      broker_signature_url: isSalesBrokerAllowed === true && brokerCommissionType && brokerSignature ? normalizeSignaturePayload(brokerSignature) : null,
      remove_broker_signature: isSalesBrokerAllowed !== true || !brokerCommissionType || !brokerSignature,
      remove_sales_broker_signature: isSalesBrokerAllowed !== true || !brokerCommissionType || !brokerSignature,

      buyer_signature_field: importerTitle.trim(),
      buyer_signature_label: importerAuthorityTitle.trim(),
      buyer_signature: importerSignature ? normalizeSignaturePayload(importerSignature) : null,
      buyer_signature_url: importerSignature ? normalizeSignaturePayload(importerSignature) : null,
      remove_buyer_signature: !importerSignature,
      remove_importer_signature: !importerSignature,

      // Retain legacy keys for backward compatibility
      importer_title: importerTitle.trim(),
      importer_signature: importerSignature ? normalizeSignaturePayload(importerSignature) : null,
      importer_signature_url: importerSignature ? normalizeSignaturePayload(importerSignature) : null,
      importer_authority_title: importerAuthorityTitle.trim(),
      broker_title: isSalesBrokerAllowed === true && brokerCommissionType ? brokerTitle.trim() : null,
      broker_authority_title: isSalesBrokerAllowed === true && brokerCommissionType ? brokerAuthorityTitle.trim() : null,
      sales_broker_title: isSalesBrokerAllowed === true && brokerCommissionType ? brokerTitle.trim() : null,
      sales_broker_signature: isSalesBrokerAllowed === true && brokerCommissionType && brokerSignature ? normalizeSignaturePayload(brokerSignature) : null,
      sales_broker_signature_url: isSalesBrokerAllowed === true && brokerCommissionType && brokerSignature ? normalizeSignaturePayload(brokerSignature) : null,
      sales_broker_authority_title: isSalesBrokerAllowed === true && brokerCommissionType ? brokerAuthorityTitle.trim() : null,
      exporter_title: exporterTitle.trim(),
      exporter_signature: exporterSignature ? normalizeSignaturePayload(exporterSignature) : null,
      exporter_signature_url: exporterSignature ? normalizeSignaturePayload(exporterSignature) : null,
      exporter_authority_title: exporterAuthorityTitle.trim(),
    };
  };

  const getEffectiveContractId = useCallback((): string => {
    const cleanConfId = sanitizeDocId(confirmationId);

    // 1. Explicit contractId prop
    if (contractIdProp && !isInvalidPlaceholder(contractIdProp) && contractIdProp !== cleanConfId) {
      return contractIdProp.trim();
    }
    // 2. Saved Draft ID from current session
    if (draftId && !isInvalidPlaceholder(draftId) && draftId !== cleanConfId) {
      return draftId.trim();
    }
    // 3. Extracted directly from Stepper list / selectedStep (user: "id tumhe stepper se milegi")
    const stepContract = getContractStep(steps, selectedStep);
    const stepperId = extractStepId(stepContract);
    if (stepperId && !isInvalidPlaceholder(stepperId) && stepperId !== cleanConfId) {
      return stepperId.trim();
    }
    // 4. Initial contract data fields
    const cid = toCleanId(
      initialData?.contract_id ||
      initialData?.contractId ||
      (initialData?.contract && typeof initialData.contract === 'object' ? initialData.contract.id || initialData.contract._id : '')
    );
    if (cid && !isInvalidPlaceholder(cid) && cid !== cleanConfId) {
      return cid.trim();
    }
    // 5. Initial data id (only if not a confirmation record)
    const isConfRecord = Boolean(initialData?.confirmation_number || initialData?.confirmation_date);
    if (!isConfRecord) {
      if (initialData?.id && !isInvalidPlaceholder(initialData.id) && toCleanId(initialData.id) !== cleanConfId) {
        return toCleanId(initialData.id);
      }
      if (initialData?._id && !isInvalidPlaceholder(initialData._id) && toCleanId(initialData._id) !== cleanConfId) {
        return toCleanId(initialData._id);
      }
    }

    return '';
  }, [contractIdProp, steps, selectedStep, draftId, confirmationId, initialData, isInvalidPlaceholder]);

  const handleOpenPrintPreview = async () => {
    let effectiveId = getEffectiveContractId();

    // If draft is not yet saved, attempt auto-saving so preview template is available
    if (!effectiveId && onSaveDraft && contractNumber.trim()) {
      setIsSavingDraft(true);
      try {
        const payload = getContractFormData();
        const res = await onSaveDraft(payload);
        if (res?.success) {
          const newId = String(
            res.id ||
            res.data?.id ||
            res.data?.contract_id ||
            res.contract_id ||
            res.data?.confirmation_id ||
            res.confirmation_id ||
            ''
          );
          if (newId) {
            setDraftId(newId);
            effectiveId = newId;
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            if (onSaveSuccess) onSaveSuccess(newId);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!effectiveId) {
      toast.error(
        dict?.smart_docs?.contract_form?.save_draft_first_preview ||
        dict?.smart_docs?.confirmation_form?.save_draft_first_preview ||
        'Please save the draft first to preview the document.'
      );
      return;
    }

    setIsPreviewOpen(true);
  };

  const handleDownloadPdf = async () => {
    let effectiveId = getEffectiveContractId();

    // If draft is not yet saved, attempt auto-saving so PDF can be generated
    if (!effectiveId && onSaveDraft && contractNumber.trim()) {
      setIsSavingDraft(true);
      try {
        const payload = getContractFormData();
        const res = await onSaveDraft(payload);
        if (res?.success) {
          const newId = String(
            res.id ||
            res.data?.id ||
            res.data?.contract_id ||
            res.contract_id ||
            res.data?.confirmation_id ||
            res.confirmation_id ||
            ''
          );
          if (newId) {
            setDraftId(newId);
            effectiveId = newId;
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            if (onSaveSuccess) onSaveSuccess(newId);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!effectiveId) {
      toast.error(
        dict?.smart_docs?.contract_form?.save_draft_first_download ||
        dict?.smart_docs?.confirmation_form?.save_draft_first_download ||
        'Please save the draft first to download PDF.'
      );
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const res = await downloadDocPdfAction({
        prefix: 'contract',
        id: effectiveId,
        lang,
      });

      if (res.success) {
        const numCandidate =
          contractNumber ||
          toCleanLabel(initialData?.contract_number || initialData?.contractNumber) ||
          effectiveId;

        const cleanNumber = String(numCandidate)
          .replace(/^#+/, '')
          .replace(/[/\\?%*:|"<>]/g, '-')
          .replace(/-+/g, '-')
          .trim();

        const downloadName = `CONTRACT-${cleanNumber}.pdf`;

        const downloaded = downloadPdfFromActionResponse(res, downloadName);
        if (downloaded) {
          toast.success(
            dict?.smart_docs?.pdf_download_success || 'PDF downloaded successfully!'
          );
        } else {
          toast.error(res.message || 'No PDF data received from server');
        }
      } else {
        toast.error(res.message || res.error || 'Failed to download PDF');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred while downloading PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!contractNumber.trim()) {
      setErrors((prev) => ({
        ...prev,
        contractNumber:
          dict?.smart_docs?.contract_form?.contract_number_required || 'Contract number is required',
      }));
      contractInputRef.current?.focus();
      return;
    }

    setIsSavingDraft(true);
    setErrors({});
    try {
      const formDataPayload = getContractFormData();
      const cleanConfId = sanitizeDocId(confirmationId);
      const cleanEffectiveId = getEffectiveContractId();
      const effectiveId = (cleanEffectiveId && cleanEffectiveId !== cleanConfId)
        ? cleanEffectiveId
        : (draftId && draftId !== cleanConfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(draftId) ? draftId : undefined);
      let res: any = null;
      if (onSaveDraft) {
        res = await onSaveDraft(formDataPayload);
      } else {
        res = await saveContractDraftAction(formDataPayload, lang, effectiveId);
      }

      if (!res) {
        toast.error('No response received while saving draft. Please retry.');
        return;
      }

      const hasFieldErrors = Boolean(
        (Array.isArray(res.error_fields) && res.error_fields.length > 0) ||
        (Array.isArray(res.errors) && res.errors.length > 0) ||
        (res.errors && typeof res.errors === 'object' && Object.keys(res.errors).length > 0) ||
        (res.error_fields && typeof res.error_fields === 'object' && Object.keys(res.error_fields).length > 0)
      );

      const isFailed = res.success === false || res.success === 0 || hasFieldErrors;

      if (isFailed) {
        const { fieldErrors, generalError } = parseContractBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusContractField(fieldErrors);
          const firstErr = Object.values(fieldErrors)[0];
          toast.error(firstErr || 'Please check highlighted fields.');
        } else if (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError)) {
          toast.error(generalError);
        } else {
          const fallbackMsg =
            res?.message && !/^(form validation error|validation error|bad request)$/i.test(res.message)
              ? res.message
              : res?.error && !/^(form validation error|validation error|bad request)$/i.test(res.error)
              ? res.error
              : 'Failed to save draft. Please check highlighted fields.';
          toast.error(fallbackMsg);
        }
        return;
      }

      // Success workflow
      const successText =
        res?.message ||
        dict?.smart_docs?.contract_form?.saved_as_draft_success ||
        'Contract saved as draft successfully!';
      toast.success(successText);
      setHasDraftChanges(false);
      setHasSubmitChanges(true);

      const statusFromRes = extractDocumentStatus(res?.data) || extractDocumentStatus(res);
      if (statusFromRes) {
        setDocStatus(statusFromRes);
      }

      const newId = String(
        res.id ||
        res.data?.id ||
        res.data?.contract_id ||
        res.contract_id ||
        res.data?._id ||
        res._id ||
        effectiveId ||
        ''
      );

      // Synchronize fresh signature URLs & contract number from backend response if available
      const savedContract =
        res.data && typeof res.data === 'object'
          ? extractContractData(res.data) || res.data
          : null;

      const respContNum =
        savedContract?.contract_number ||
        savedContract?.contractNumber ||
        savedContract?.contract_no ||
        res?.data?.contract_number ||
        res?.data?.contractNumber ||
        res?.contract_number ||
        (typeof formDataPayload?.get === 'function' ? formDataPayload.get('contract_number') : null);

      if (respContNum && typeof respContNum === 'string' && respContNum.trim()) {
        setContractNumber(respContNum.trim());
      }

      if (newId && !isInvalidPlaceholder(newId)) {
        setDraftId(newId);
        lastLoadedDocIdRef.current = newId;
        isFormInitializedRef.current = true;
        if (onSaveSuccess) {
          onSaveSuccess(newId, {
            ...(savedContract || res?.data || res || {}),
            ...(respContNum ? { contract_number: respContNum } : {}),
            documents_required: effectiveDocs,
            documents: effectiveDocs,
            required_documents: effectiveDocs,
          });
        }
        if (savedContract) {
          const sSellerSig = savedContract.seller_signature || savedContract.exporter_signature;
          if (hasUserClearedExporterSigRef.current || !exporterSignature) {
            setExporterSignature('');
          } else if (sSellerSig) {
            setExporterSignature(formatSignatureUrl(sSellerSig));
          }

          const sBuyerSig = savedContract.buyer_signature || savedContract.importer_signature;
          if (hasUserClearedImporterSigRef.current || !importerSignature) {
            setImporterSignature('');
          } else if (sBuyerSig) {
            setImporterSignature(formatSignatureUrl(sBuyerSig));
          }

          const sBrokerSig = savedContract.broker_signature || savedContract.sales_broker_signature;
          if (hasUserClearedBrokerSigRef.current || !brokerSignature) {
            setBrokerSignature('');
          } else if (sBrokerSig) {
            setBrokerSignature(formatSignatureUrl(sBrokerSig));
          }
        }

        // Concurrently refresh stepper list from backend so all steps stay fresh
        try {
          const stepperAction = confirmationId ? 'confirmation' : 'contract';
          const stepperParam = confirmationId || newId || 'new-confirmation';
          const stepperRes = await getStepperListAction({
            action: stepperAction,
            step: stepperParam,
            lang,
          });
          if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
            if (onUpdateSteps) {
              onUpdateSteps(stepperRes.data);
            }
          }
        } catch (postSyncErr) {
          console.error('[ContractDocumentForm] Post-save stepper update error:', postSyncErr);
        }
      }
    } catch (err: any) {
      console.error('[ContractDocumentForm] handleSaveDraft error:', err);
      const { fieldErrors, generalError } = parseContractBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusContractField(fieldErrors);
        const firstErr = Object.values(fieldErrors)[0];
        toast.error(firstErr || 'Please check highlighted fields.');
      } else if (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError)) {
        toast.error(generalError);
      } else {
        const fallbackMsg =
          err?.message && !/^(form validation error|validation error|bad request)$/i.test(err.message)
            ? err.message
            : 'Failed to save draft. Please check highlighted fields.';
        toast.error(fallbackMsg);
      }
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const submitTargetInfo = getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'contract',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;
    const targetNextStepName = submitTargetInfo.nextStepName;

    setIsSubmitting(true);
    setErrors({});
    try {
      const payload = getContractFormData();
      const cleanConfId = sanitizeDocId(confirmationId);
      const cleanEffectiveId = getEffectiveContractId();
      const effectiveId = (cleanEffectiveId && cleanEffectiveId !== cleanConfId)
        ? cleanEffectiveId
        : (draftId && draftId !== cleanConfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(draftId) ? draftId : undefined);
      if (onSubmitContract) {
        const res = await onSubmitContract(payload, effectiveId, targetNextStep);
        const hasFieldErrors = Boolean(
          (Array.isArray(res?.error_fields) && res.error_fields.length > 0) ||
          (Array.isArray(res?.errors) && res.errors.length > 0) ||
          (res?.errors && typeof res.errors === 'object' && Object.keys(res.errors).length > 0) ||
          (res?.error_fields && typeof res.error_fields === 'object' && Object.keys(res.error_fields).length > 0)
        );

        if (res?.success && !hasFieldErrors) {
          setDocStatus('COMPLETED');
          setHasDraftChanges(false);
          setHasSubmitChanges(false);
          if (hasUserClearedExporterSigRef.current || !exporterSignature) {
            setExporterSignature('');
          }
          if (hasUserClearedImporterSigRef.current || !importerSignature) {
            setImporterSignature('');
          }
          if (hasUserClearedBrokerSigRef.current || !brokerSignature) {
            setBrokerSignature('');
          }
          const successToast = getWorkflowSubmitToastMessage({
            currentDocName: 'Contract',
            nextStepName: targetNextStepName,
          });
          toast.success(successToast);
          const newId = res.id || res.data?.id || res.data?.proforma_id || res.data?.contract_id || effectiveId;
          if (newId && !isInvalidPlaceholder(String(newId))) {
            setDraftId(String(newId));
            lastLoadedDocIdRef.current = String(newId);
            isFormInitializedRef.current = true;
          }

          if (targetNextStep && onSelectStep && !onSubmitContract) {
            onSelectStep(targetNextStep);
          }
        } else {
          const { fieldErrors, generalError } = parseContractBackendErrors(res);
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            scrollToAndFocusContractField(fieldErrors);
            const firstErr = Object.values(fieldErrors)[0];
            toast.error(firstErr || 'Please check highlighted fields.');
          } else if (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError)) {
            toast.error(generalError);
          } else {
            const isCleanToastMsg = (m?: any) =>
              Boolean(
                m &&
                typeof m === 'string' &&
                !/^(form validation error|validation error|bad request)$/i.test(m.trim()) &&
                !/^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(m.trim()) &&
                !/<(!DOCTYPE|html)/i.test(m)
              );
            const fallbackMsg =
              (isCleanToastMsg(res?.message) ? res.message : null) ||
              (isCleanToastMsg(res?.error) ? res.error : null) ||
              `Failed to submit contract${targetNextStepName ? ` to ${targetNextStepName}` : ''}. Please check highlighted fields.`;
            toast.error(fallbackMsg);
          }
        }
      }
    } catch (err: any) {
      console.error('[ContractDocumentForm] handleSubmit error:', err);
      const { fieldErrors, generalError } = parseContractBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusContractField(fieldErrors);
        const firstErr = Object.values(fieldErrors)[0];
        toast.error(firstErr || 'Please check highlighted fields.');
      } else if (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError)) {
        toast.error(generalError);
      } else {
        const fallbackMsg =
          err?.message && !/^(form validation error|validation error|bad request)$/i.test(err.message)
            ? err.message
            : 'Network error while submitting contract. Please check highlighted fields.';
        toast.error(fallbackMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'contract',
      isSubmitting,
      submittingText: 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  return (
    <div
      id="contract-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* 
        Scrollable Table Viewport:
        - Fluid on mobile (no trapped inner scroll)
        - Locked internal scrolling on desktop
      */}
      <div 
        className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar"
      >
        {/* TOP BAR: Letterhead Toggle | CONTRACT Title | Watermark Toggle */}
        <div className="px-3 sm:px-4 py-2 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
          {/* Desktop Left: Letterhead Toggle */}
          <div className="hidden sm:flex items-center shrink-0 sm:w-[140px]">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={(val) => {
                markDirty();
                setLetterhead(val);
              }}
              disabled={readOnly}
            />
          </div>

          {/* Center: Title (Directly Editable Field) + Dotted Accent Underline */}
          <DocTitleInput
            value={documentTitle}
            onChange={(val) => {
              markDirty();
              setDocumentTitle(val);
              setErrors((prev) => ({ ...prev, documentTitle: '' }));
            }}
            disabled={readOnly}
            placeholder={dict?.smart_docs?.contract_form?.contract_title || 'CONTRACT'}
            ariaLabel={dict?.smart_docs?.contract_form?.contract_title || 'Document Title'}
            error={errors.documentTitle}
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Desktop Right: Watermark Toggle */}
          <div className="hidden sm:flex items-center justify-end shrink-0 sm:w-[140px]">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.watermark || 'Watermark'}
              checked={watermark}
              onChange={(val) => {
                markDirty();
                setWatermark(val);
              }}
              disabled={readOnly}
            />
          </div>

          {/* Mobile Bottom Row: Letterhead on left, Watermark on right */}
          <div className="flex sm:hidden items-center justify-between w-full pt-1.5 border-t border-border">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={(val) => {
                markDirty();
                setLetterhead(val);
              }}
              disabled={readOnly}
            />
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.watermark || 'Watermark'}
              checked={watermark}
              onChange={(val) => {
                markDirty();
                setWatermark(val);
              }}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* 
          DOCUMENT GRID / TABLE:
          100% matches Canva paper mockup with crisp 1px borders and blue dotted input blanks.
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          
          {/* ROW 1: CONFIRMATION NUMBER | CONFIRMATION DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Confirmation Number: Read-only visible text only (no input) */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="confirmationNumber">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5 pt-1.5">
                {dict?.smart_docs?.confirmation_form?.confirmation_number || 'CONFIRMATION NUMBER'}
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto flex items-center min-h-[30px] px-1">
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                  {confirmationNumber || <span className="text-muted-foreground/50 font-normal italic">N/A</span>}
                </span>
              </div>
            </div>

            {/* Confirmation Date */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="confirmationDate">
              <label
                htmlFor="field-confirmationDate"
                className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5 pt-1.5"
              >
                {dict?.smart_docs?.confirmation_form?.confirmation_date || 'CONFIRMATION DATE'}
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  id="field-confirmationDate"
                  type="date"
                  value={confirmationDate}
                  onChange={(val) => {
                    markDirty();
                    setConfirmationDate(val);
                    setErrors((prev) => ({ ...prev, confirmationDate: '' }));
                  }}
                  error={errors.confirmationDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.confirmation_form?.select_date || 'Select Date'
                  }
                />
              </div>
            </div>
          </div>

          {/* ROW 2: CONTRACT NUMBER | CONTRACT DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Contract Number */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="contractNumber">
              <label
                htmlFor="field-contractNumber"
                className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5 pt-1.5"
              >
                {dict?.smart_docs?.contract_form?.contract_number || 'CONTRACT NUMBER'}{' '}
                <span className="text-brand-red font-bold">*</span>
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  ref={contractInputRef}
                  id="field-contractNumber"
                  value={contractNumber}
                  onChange={(val) => {
                    markDirty();
                    setContractNumber(val);
                    setErrors((prev) => ({ ...prev, contractNumber: '' }));
                  }}
                  error={errors.contractNumber}
                  icon="fa-solid fa-pen"
                  disabled={readOnly}
                  placeholder="ENTER CONTRACT NUMBER"
                />
              </div>
            </div>

            {/* Contract Date */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5">
              <label
                htmlFor="field-contractDate"
                className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5 pt-1.5"
              >
                {dict?.smart_docs?.contract_form?.contract_date || 'CONTRACT DATE'}
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  id="field-contractDate"
                  type="date"
                  value={contractDate}
                  onChange={(val) => {
                    markDirty();
                    setContractDate(val);
                    setErrors((prev) => ({ ...prev, contractDate: '' }));
                  }}
                  error={errors.contractDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.contract_form?.select_date || 'Select Date'
                  }
                />
              </div>
            </div>
          </div>

          {/* ROW 3: THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES */}
          <div className="py-2 px-2.5 sm:px-3 bg-muted/20 flex items-center justify-between gap-2" data-field="partiesHeader">
            <DocUnderlineInput
              id="field-partiesHeader"
              value={partiesHeader}
              onChange={(val) => {
                markDirty();
                setPartiesHeader(val);
                setErrors((prev) => ({ ...prev, partiesHeader: '' }));
              }}
              error={errors.partiesHeader}
              disabled={readOnly}
              icon="fa-solid fa-pen"
              placeholder="THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES"
              className="w-full"
              inputClassName="font-bold text-foreground uppercase text-[14px] tracking-wider text-center sm:text-left"
            />
          </div>

          {/* ROW 4: EXPORTER (SELLER) | IMPORTER (BUYER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Exporter (Seller) */}
            <div className="py-1.5 px-2.5 sm:px-3 flex flex-col gap-1.5" data-field="sellerId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.exporter_seller || 'EXPORTER (SELLER)'}
              </label>
              <DocUnderlineSelect
                id="field-sellerId"
                options={sellersList}
                value={sellerId}
                onChange={handleSellerChange}
                placeholder="SELECT SELLER"
                error={errors.sellerId}
                disabled={readOnly}
                searchable={true}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditSeller(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Seller"
                onAddNew={handleAddNewSeller}
              />
              <DocUnderlineInput
                id="field-sellerInstruction"
                multiline
                rows={3}
                icon="fa-solid fa-pen"
                value={sellerInstruction}
                onChange={(val) => {
                  markDirty();
                  setSellerInstruction(val);
                  setErrors((prev) => ({ ...prev, sellerInstruction: '' }));
                }}
                error={errors.sellerInstruction}
                placeholder="COMPANY NAME, ADDRESS, CONTACT, EMAIL..."
                disabled={readOnly}
              />
            </div>

            {/* Importer (Buyer) */}
            <div className="py-1.5 px-2.5 sm:px-3 flex flex-col gap-1.5" data-field="buyerId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.importer_buyer || 'IMPORTER (BUYER)'}
              </label>
              <DocUnderlineSelect
                id="field-buyerId"
                options={buyersList}
                value={buyerId}
                onChange={handleBuyerChange}
                placeholder="SELECT BUYER"
                error={errors.buyerId}
                disabled={readOnly}
                searchable={true}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditBuyer(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Buyer"
                onAddNew={handleAddNewBuyer}
              />
              <DocUnderlineInput
                id="field-buyerInstruction"
                multiline
                rows={3}
                icon="fa-solid fa-pen"
                value={buyerInstruction}
                onChange={(val) => {
                  markDirty();
                  setBuyerInstruction(val);
                  setErrors((prev) => ({ ...prev, buyerInstruction: '' }));
                }}
                error={errors.buyerInstruction}
                placeholder="COMPANY NAME, ADDRESS, CONTACT, EMAIL..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 5: SHIPPING INSTRUCTION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shippingInstruction">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center min-w-0">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                SHIPPING INSTRUCTION
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-w-0">
              <DocUnderlineInput
                id="field-shippingInstruction"
                value={shippingInstruction}
                onChange={(val) => {
                  markDirty();
                  setShippingInstruction(val);
                  setErrors((prev) => ({ ...prev, shippingInstruction: '', termsAndCondition: '' }));
                }}
                error={errors.shippingInstruction || errors.termsAndCondition}
                icon="fa-solid fa-pen"
                placeholder="TO BE ADVICE"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 6: PRODUCT | HSN CODE | COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="productId">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center min-w-0">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.product || 'PRODUCT'}
              </label>
            </div>
            <div className="md:col-span-5 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-w-0">
              <DocUnderlineSelect
                id="field-productId"
                options={productsList}
                value={productId}
                onChange={handleProductChange}
                placeholder="SELECT PRODUCT"
                searchable={true}
                error={errors.productId}
                disabled={readOnly}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditProduct(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Product"
                onAddNew={handleAddNewProduct}
              />
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border md:border-t-0 md:col-span-4 md:grid-cols-2 md:divide-x">
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="hsnCode">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  HSN CODE
                </span>
                <span className="text-[14px] font-semibold text-foreground truncate min-w-0 mt-0.5 leading-snug">
                  {isLoadingProductDetails ? 'Loading...' : normalizeHsnString(hsnCode) || '-'}
                </span>
              </div>
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="productCountry">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  COUNTRY
                </span>
                <span className="text-[14px] font-semibold text-foreground uppercase truncate min-w-0 mt-0.5 leading-snug">
                  {isLoadingProductDetails ? 'Loading...' : normalizeCountryString(productCountry) || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* ROW 7: SPECIFICATION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="specification">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-start pt-2 sm:pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.specification || 'SPECIFICATION'}
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3">
              <DocUnderlineInput
                id="field-specification"
                multiline
                rows={2}
                value={specification}
                onChange={(val) => {
                  markDirty();
                  setSpecification(val);
                  setErrors((prev) => ({ ...prev, specification: '' }));
                }}
                error={errors.specification}
                icon="fa-solid fa-pen"
                placeholder={dict?.smart_docs?.confirmation_form?.enter_specification || 'Enter Specification'}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 8: SHIPMENT PERIOD */}
          <div
            id="field-shipmentPeriod"
            className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border"
            data-field="shipmentPeriod"
          >
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipment_period || 'SHIPMENT PERIOD'}
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col items-start justify-center">
              <DateRangePicker
                id="shipment-period-picker"
                variant="underline"
                startDate={shipmentRange.start}
                endDate={shipmentRange.end}
                onChange={(start, end) => {
                  markDirty();
                  setShipmentRange({ start, end });
                  setErrors((prev) => ({ ...prev, shipmentPeriod: '', shipmentStartDate: '', shipmentEndDate: '' }));
                }}
                formatString="dd/MM/yyyy"
                placeholder="SELECT SHIPMENT PERIOD"
                disabled={readOnly}
                error={errors.shipmentPeriod || errors.shipmentStartDate || errors.shipmentEndDate}
              />
            </div>
          </div>

          {/* ROW 9: PAYMENT TERM */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="paymentTerm">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.payment_term || 'PAYMENT TERM'}
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-contract-paymentTerm"
                options={paymentTermsList}
                value={paymentTerm}
                onChange={(val) => {
                  markDirty();
                  setPaymentTerm(val);
                  setErrors((prev) => ({ ...prev, paymentTerm: '' }));
                }}
                error={errors.paymentTerm}
                placeholder="SELECT PAYMENT TERM"
                searchable={true}
                disabled={readOnly}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditPaymentTerm(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Payment Term"
                onAddNew={handleAddNewPaymentTerm}
              />
            </div>
          </div>

          {/* ROW 10: FCL TYPE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="fclType">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                FCL TYPE
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-fclType"
                options={DEFAULT_FCL_TYPES}
                value={fclType}
                onChange={handleFclTypeChange}
                placeholder="SELECT FCL TYPE"
                disabled={readOnly}
                error={errors.fclType}
              />
            </div>
          </div>

          {/* ROW 11: PACKING */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="packing">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.packing || 'PACKING'}
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-packing"
                options={packingList.length > 0 ? packingList : DEFAULT_STATIC_PACKING_OPTIONS}
                value={packing}
                onChange={(val) => {
                  markDirty();
                  setPacking(val);
                  setErrors((prev) => ({ ...prev, packing: '' }));
                }}
                placeholder="SELECT PACKING"
                searchable={true}
                allowCustom={true}
                error={errors.packing}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 12: MARKING BRAND */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="markingBrand">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                MARKING BRAND
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-markingBrand"
                value={markingBrand}
                onChange={(val) => {
                  markDirty();
                  setMarkingBrand(val);
                  setErrors((prev) => ({ ...prev, markingBrand: '' }));
                }}
                error={errors.markingBrand}
                icon="fa-solid fa-pen"
                placeholder="ENTER MARKING BRAND"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 13: LOADING PORT & COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="loadingPort">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                LOADING PORT &amp; COUNTRY
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-loadingPort"
                options={isProductSelected ? loadingPortsList : []}
                value={isProductSelected ? loadingPort : ''}
                onChange={(val) => {
                  markDirty();
                  setLoadingPort(val);
                  setLoadingCondition('');
                  setErrors((prev) => ({ ...prev, loadingPort: '', loadingCondition: '' }));
                }}
                placeholder={
                  !isProductSelected
                    ? dict?.smart_docs?.confirmation_form?.select_product_first ||
                      'SELECT PRODUCT FIRST'
                    : isLoadingProductDetails && loadingPortsList.length === 0
                    ? dict?.common?.loading || 'LOADING...'
                    : 'SELECT LOADING PORT & COUNTRY'
                }
                loading={isProductSelected && isLoadingProductDetails && loadingPortsList.length === 0}
                searchable={true}
                error={errors.loadingPort}
                disabled={readOnly || !isProductSelected}
              />
            </div>
          </div>

          {/* ROW 14: LOADING CONDITION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="loadingCondition">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                LOADING CONDITION
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-loadingCondition"
                options={isPortSelected ? loadingConditionOptions : []}
                value={isPortSelected ? loadingCondition : ''}
                onChange={(val) => {
                  markDirty();
                  setLoadingCondition(val);
                  setErrors((prev) => ({ ...prev, loadingCondition: '' }));
                }}
                placeholder={
                  !isProductSelected
                    ? dict?.smart_docs?.confirmation_form?.select_product_first || 'SELECT PRODUCT FIRST'
                    : !isPortSelected
                    ? 'SELECT LOADING PORT FIRST'
                    : 'SELECT LOADING CONDITION'
                }
                disabled={readOnly || !isPortSelected}
                allowCustom={true}
                error={errors.loadingCondition}
              />
            </div>
          </div>

          {/* ROW 15: DESTINATION PORT & COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="destinationPort">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                DESTINATION PORT &amp; COUNTRY
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-destinationPort"
                options={isProductSelected ? destinationPortsList : []}
                value={isProductSelected ? destinationPort : ''}
                onChange={(val) => {
                  markDirty();
                  setDestinationPort(val);
                  setErrors((prev) => ({ ...prev, destinationPort: '' }));
                }}
                placeholder={
                  !isProductSelected
                    ? dict?.smart_docs?.confirmation_form?.select_product_first ||
                      'SELECT PRODUCT FIRST'
                    : isLoadingProductDetails && destinationPortsList.length === 0
                    ? dict?.common?.loading || 'LOADING...'
                    : 'SELECT DESTINATION PORT & COUNTRY'
                }
                loading={isProductSelected && isLoadingProductDetails && destinationPortsList.length === 0}
                searchable={true}
                error={errors.destinationPort}
                disabled={readOnly || !isProductSelected}
              />
            </div>
          </div>

          {/* ROW 16: QUANTITIES & PRICING TABLE MATRIX (Image 2) */}
          {isFcl ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-collapse text-center">
              {/* FCL QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  FCL QTY
                </span>
                <div className="w-full max-w-[90px]">
                  <DocUnderlineInput
                    id="field-contract-fclQty"
                    type="number"
                    value={fclQty}
                    onChange={(val) => {
                      markDirty();
                      setFclQty(val);
                      setErrors((prev) => ({ ...prev, fclQty: '' }));
                    }}
                    error={errors.fclQty}
                    icon="fa-solid fa-pen"
                    placeholder="0"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* FCL CAPACITY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  FCL CAPACITY
                </span>
                <div className="w-full max-w-[90px]">
                  <DocUnderlineInput
                    id="field-contract-fclCapacity"
                    type="number"
                    value={fclCapacity}
                    onChange={(val) => {
                      markDirty();
                      setFclCapacity(val);
                      setErrors((prev) => ({ ...prev, fclCapacity: '' }));
                    }}
                    error={errors.fclCapacity}
                    icon="fa-solid fa-pen"
                    placeholder="0"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* MT QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  MT QTY
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">{mtQty || '-'}</span>
              </div>

              {/* BAG QTY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="bagQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  BAG QTY
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">{bagQty || '-'}</span>
                {errors.bagQty && (
                  <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5">{errors.bagQty}</span>
                )}
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b-0 lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="currency">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  CURRENCY
                </span>
                <div className="w-full max-w-[115px]">
                  <DocUnderlineSelect
                    id="field-contract-currency"
                    options={currenciesList}
                    value={currency}
                    onChange={(val) => {
                      handleCurrencyChange(val);
                      setErrors((prev) => ({ ...prev, currency: '' }));
                    }}
                    error={errors.currency}
                    disabled={readOnly}
                    searchable={true}
                    loading={isLoadingCurrencies}
                    placeholder="Select"
                    align="center"
                    dropdownClassName="min-w-[155px] w-[165px] max-w-[195px]"
                  />
                </div>
              </div>

              {/* PRICE */}
              <div className="p-1.5 sm:p-2 border-b sm:border-r sm:border-b-0 lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  PRICE ({currencySymbol})
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-contract-price"
                    type="number"
                    value={price}
                    onChange={(val) => {
                      markDirty();
                      setPrice(val);
                      setErrors((prev) => ({ ...prev, price: '' }));
                    }}
                    error={errors.price}
                    icon="fa-solid fa-pen"
                    placeholder="0.00"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* TOTAL VALUE */}
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center" data-field="totalValue">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  TOTAL VALUE ({currencySymbol})
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">
                  {formatNumberWithCommas(totalValue)}
                </span>
                {errors.totalValue && (
                  <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5">{errors.totalValue}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 border-collapse text-center">
              {/* MT QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  MT QTY
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-contract-mtQty"
                    type="number"
                    value={mtQty}
                    onChange={(val) => {
                      markDirty();
                      setMtQty(val);
                      setErrors((prev) => ({ ...prev, mtQty: '' }));
                    }}
                    error={errors.mtQty}
                    icon="fa-solid fa-pen"
                    placeholder="0.00"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* BAG QTY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center" data-field="bagQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  BAG QTY
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">{bagQty || '-'}</span>
                {errors.bagQty && (
                  <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5">{errors.bagQty}</span>
                )}
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center" data-field="currency">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  CURRENCY
                </span>
                <div className="w-full max-w-[115px]">
                  <DocUnderlineSelect
                    id="field-contract-currency"
                    options={currenciesList}
                    value={currency}
                    onChange={(val) => {
                      handleCurrencyChange(val);
                      setErrors((prev) => ({ ...prev, currency: '' }));
                    }}
                    error={errors.currency}
                    disabled={readOnly}
                    searchable={true}
                    loading={isLoadingCurrencies}
                    placeholder="Select"
                    align="center"
                    dropdownClassName="min-w-[155px] w-[165px] max-w-[195px]"
                  />
                </div>
              </div>

              {/* PRICE */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  PRICE ({currencySymbol})
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-contract-price"
                    type="number"
                    value={price}
                    onChange={(val) => {
                      markDirty();
                      setPrice(val);
                      setErrors((prev) => ({ ...prev, price: '' }));
                    }}
                    error={errors.price}
                    icon="fa-solid fa-pen"
                    placeholder="0.00"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* TOTAL VALUE */}
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-1 flex flex-col items-center justify-center" data-field="totalValue">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  TOTAL VALUE ({currencySymbol})
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">
                  {formatNumberWithCommas(totalValue)}
                </span>
                {errors.totalValue && (
                  <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5">{errors.totalValue}</span>
                )}
              </div>
            </div>
          )}

          {/* ROW 17: INSPECTION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="inspection">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                INSPECTION
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-inspection"
                value={inspection}
                onChange={(val) => {
                  setInspection(val);
                  setErrors((prev) => ({ ...prev, inspection: '' }));
                }}
                error={errors.inspection}
                icon="fa-solid fa-pen"
                placeholder="ENTER INSPECTION"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 18: INCOTERM */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="incoterm">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                INCOTERM
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-incoterm"
                options={shippingTerms || DEFAULT_SHIPPING_TERMS}
                value={incoterm}
                onChange={(val) => {
                  markDirty();
                  handleIncotermChange(val);
                  setErrors((prev) => ({ ...prev, incoterm: '', shippingTerm: '' }));
                }}
                error={errors.incoterm || errors.shippingTerm}
                placeholder="SELECT INCOTERM"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 19: INSURANCE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="insurance">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                INSURANCE
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-h-[36px]">
              <span className="font-semibold text-[14px] text-foreground tracking-wider px-1">
                {effectiveInsurance || '-'}
              </span>
            </div>
          </div>

          {/* ROW 20: PARTIAL */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="partial">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                PARTIAL
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-col gap-2.5 justify-center">
              {/* Controls Row: Toggle, Count & Arrow */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <DocSegmentedToggle
                  id="toggle-partial"
                  value={isPartialAllowed}
                  onChange={(val) => {
                    markDirty();
                    setIsPartialAllowed(val);
                    if (!val) {
                      setErrors((prev) => ({ ...prev, partialCount: '', partialTotal: '' }));
                    }
                  }}
                  trueLabel="ALLOWED"
                  falseLabel="NOT ALLOWED"
                  disabled={readOnly}
                  allowDeselect={true}
                />

                {isPartialAllowed && (
                  <div className="flex items-center gap-2 pl-2 sm:border-l border-border/70">
                    <label
                      htmlFor="field-split-count"
                      className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap"
                    >
                      Partial Count
                    </label>
                    <div className="w-[48px] sm:w-[56px]">
                      <input
                        id="field-split-count"
                        type="number"
                        min={1}
                        max={30}
                        step={1}
                        value={splitCount}
                        onChange={(e) => handleSplitCountChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                            e.preventDefault();
                          }
                        }}
                        placeholder="0"
                        disabled={readOnly}
                        className={`w-full text-center text-[14px] font-bold text-foreground bg-transparent border-b-2 border-dotted ${
                          errors.partialCount
                            ? 'border-solid border-brand-red'
                            : 'border-primary/70 dark:border-primary/80 focus:border-solid focus:border-primary'
                        } focus:outline-none transition-colors py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-[14px] placeholder:font-normal placeholder:text-muted-foreground/50 disabled:cursor-not-allowed`}
                      />
                    </div>
                    {/* Right Arrow */}
                    <i className="fa-solid fa-arrow-right text-muted-foreground/60 text-xs sm:text-sm ml-0.5 shrink-0" />
                  </div>
                )}
              </div>

              {/* Partials Grid with + signs and = Total Card */}
              {isPartialAllowed && splits.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5 w-full">
                    {/* Render all partial input cards */}
                    {splits.slice(0, 30).map((splitItem, index) => {
                      const splitLetter = formatSplitNumber(splitItem.split_number, index);
                      const isLastPartial = index === Math.min(splits.length, 30) - 1;
                      return (
                        <div key={`split-${index}-${splitLetter}`} className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                          {/* Stacked Card: Label on top, centered input with dotted underline below */}
                          <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/50 transition-all shadow-2xs group focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 min-h-[58px]">
                            <label
                              htmlFor={`field-split-${index}`}
                              className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide select-none whitespace-nowrap cursor-pointer text-center"
                              title={`Partial ${splitLetter}`}
                            >
                              {splitLetter}
                            </label>
                            <div className="w-[52px] sm:w-[60px] mx-auto mt-1">
                              <input
                                id={`field-split-${index}`}
                                type="number"
                                min={0}
                                value={splitItem.fcl_quantity}
                                onChange={(e) => handleSplitQtyChange(index, e.target.value)}
                                placeholder="0"
                                disabled={readOnly}
                                aria-label={`Partial ${splitLetter}`}
                                className="w-full text-center text-[14px] font-bold text-foreground bg-transparent border-b-2 border-dotted border-primary/70 dark:border-primary/80 focus:border-solid focus:border-primary focus:outline-none transition-colors py-0.5 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-[14px] placeholder:font-normal placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>

                          {/* Operator: + between inputs, = after the last input */}
                          <span className="font-bold text-muted-foreground/70 select-none text-sm shrink-0 w-3 text-center">
                            {isLastPartial ? '=' : '+'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Total Card: Stacked, same exact dimensions & style, read-only answer value, no dotted line, no icons, theme brand colors */}
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                      <div
                        className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-2.5 rounded-lg border transition-all shadow-2xs min-h-[58px] ${
                          isPartialMatch
                            ? 'border-brand-green/60 bg-brand-green/10 text-brand-green'
                            : 'border-brand-red/60 bg-brand-red/10 text-brand-red'
                        }`}
                        title={
                          isPartialMatch
                            ? `Total (${partialSum}) matched with ${isFcl ? 'FCL' : 'MT'} Quantity (${targetFclQty})`
                            : targetFclQty > 0
                            ? `Total (${partialSum}) does not match ${isFcl ? 'FCL' : 'MT'} Quantity (${targetFclQty})`
                            : `Total: ${partialSum}`
                        }
                      >
                        <span className="font-bold uppercase text-[10px] sm:text-[11px] tracking-wide select-none whitespace-nowrap text-center">
                          Total
                        </span>
                        <div className="w-[52px] sm:w-[60px] mx-auto mt-1 text-center">
                          <span className="block w-full text-center font-extrabold text-xs sm:text-sm tabular-nums truncate">
                            {partialSum}
                          </span>
                        </div>
                      </div>

                      {/* Spacer to match operator width for 100% column alignment */}
                      <span className="w-3 shrink-0" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              )}

              {/* Red Client-side Validation Error */}
              {(errors.partialCount || errors.partialTotal) && (
                <div className="w-full text-[11px] text-brand-red font-semibold px-0.5 tracking-tight flex items-center gap-1.5 mt-0.5">
                  <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                  <span>{errors.partialCount || errors.partialTotal}</span>
                </div>
              )}
            </div>
          </div>

          {/* ROW 21: TRANSHIPMENT */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="transhipment">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                TRANSHIPMENT
              </label>
            </div>
            <div className="md:col-span-9 py-1.5 px-2.5 sm:px-3 flex items-center">
              <DocSegmentedToggle
                id="toggle-transhipment"
                value={isTranshipmentAllowed}
                onChange={(val) => {
                  markDirty();
                  setIsTranshipmentAllowed(val);
                }}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 22: TRANSIT CLAUSE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="transitClause">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                TRANSIT CLAUSE
              </label>
            </div>
            <div className="md:col-span-9 py-1.5 px-2.5 sm:px-3 flex items-center">
              <DocSegmentedToggle
                id="toggle-transitClause"
                value={isTransitClauseAllowed}
                onChange={(val) => {
                  markDirty();
                  setIsTransitClauseAllowed(val);
                }}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 23: ADVANCE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="advance">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                ADVANCE
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <DocSegmentedToggle
                id="toggle-advance"
                value={hasAdvance}
                onChange={(val) => {
                  markDirty();
                  userToggledAdvanceRef.current = true;
                  setHasAdvance(val);
                  if (val !== true) {
                    userClearedAdvanceRef.current = true;
                    setAdvanceType(null);
                    setAdvancePercentage('');
                    setAdvanceAmount('');
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.advanceType;
                      delete copy.advanceAmount;
                      delete copy.advancePercentage;
                      delete copy.advance;
                      delete copy.any_advance;
                      return copy;
                    });
                  } else if (userClearedAdvanceRef.current) {
                    setAdvanceType(null);
                    setAdvancePercentage('');
                    setAdvanceAmount('');
                  }
                }}
                trueLabel="YES"
                falseLabel="NO"
                allowDeselect={true}
                disabled={readOnly}
              />

              {hasAdvance && (
                <>
                  <div className="pl-2 border-l border-border/70 flex flex-col sm:flex-row sm:items-center gap-1.5" data-field="advanceType">
                    <DocSegmentedToggle<'PERCENTAGE' | 'AMOUNT'>
                      id="toggle-advance-type"
                      value={advanceType}
                      onChange={(val: 'PERCENTAGE' | 'AMOUNT') => {
                        markDirty();
                        setAdvanceType(val);
                        if (val === 'PERCENTAGE') {
                          setAdvanceAmount('');
                        } else if (val === 'AMOUNT') {
                          setAdvancePercentage('');
                        } else {
                          setAdvanceAmount('');
                          setAdvancePercentage('');
                        }
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.advanceType;
                          delete copy.advanceAmount;
                          delete copy.advancePercentage;
                          return copy;
                        });
                      }}
                      options={DEFAULT_ADVANCE_TYPE_OPTIONS}
                      allowDeselect={true}
                      disabled={readOnly}
                      error={errors.advanceType}
                    />
                    {errors.advanceType && (
                      <span className="text-[11px] text-brand-red font-semibold px-0.5">
                        {errors.advanceType}
                      </span>
                    )}
                  </div>

                  {advanceType === 'AMOUNT' && (
                    <>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70" data-field="advanceAmount">
                        <label
                          htmlFor="field-advance-amount"
                          className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap"
                        >
                          Advance ({currencySymbol})
                        </label>
                        <div className="w-[100px] sm:w-[120px]">
                          <DocUnderlineInput
                            id="field-advance-amount"
                            type="number"
                            min={0}
                            step="0.01"
                            value={advanceAmount}
                            onChange={(val) => {
                              markDirty();
                              setAdvanceAmount(val);
                              setErrors((prev) => ({ ...prev, advanceAmount: '' }));
                            }}
                            error={errors.advanceAmount}
                            placeholder="0.00"
                            align="center"
                            disabled={readOnly}
                          />
                        </div>
                      </div>

                      {/* Calculated Percentage when Amount is entered */}
                      {effectiveContractTotalValue > 0 && Number(advanceAmount) > 0 && (
                        <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                          <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap">
                            Percentage:
                          </span>
                          <span className="text-[14px] font-bold text-foreground py-0.5">
                            {Math.min(((parseFloat(String(advanceAmount).replace(/[^\d.]/g, '')) || 0) / effectiveContractTotalValue) * 100, 100).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {advanceType === 'PERCENTAGE' && (
                    <>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70" data-field="advancePercentage">
                        <label
                          htmlFor="field-advance-percent"
                          className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap"
                        >
                          Advance (%)
                        </label>
                        <div className="w-[60px] sm:w-[70px]">
                          <DocUnderlineInput
                            id="field-advance-percent"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={advancePercentage}
                            onChange={(val) => {
                              markDirty();
                              setAdvancePercentage(val);
                              setErrors((prev) => ({ ...prev, advancePercentage: '' }));
                            }}
                            error={errors.advancePercentage}
                            placeholder="0%"
                            align="center"
                            disabled={readOnly}
                          />
                        </div>
                      </div>

                      {/* Calculated Amount */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                        <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap">
                          Amount ({currencySymbol})
                        </span>
                        <span className="text-[14px] font-bold text-foreground py-0.5">
                          {calculatedAdvanceAmount ? formatNumberWithCommas(calculatedAdvanceAmount) : '-'}
                        </span>
                        {calculatedAdvanceMt && (
                          <span className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">
                            (~{calculatedAdvanceMt} MT)
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ROW 24: SALES BROKER */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="salesBroker">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                SALES BROKER
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <DocSegmentedToggle
                id="toggle-salesBroker"
                value={isSalesBrokerAllowed}
                onChange={(val) => {
                  markDirty();
                  userToggledBrokerRef.current = true;
                  setIsSalesBrokerAllowed(val);
                  if (val !== true) {
                    userClearedBrokerRef.current = true;
                    hasUserClearedBrokerSigRef.current = true;
                    setBrokerCommissionType(null);
                    setBrokerCommission('');
                    setBrokerCommissionAmt('');
                    setBrokerName('');
                    setBrokerSignature('');
                    setBrokerTitle('BROKER SIGNATURE');
                    setBrokerAuthorityTitle('AUTHORISED SIGNATURE');
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.brokerCommissionType;
                      delete copy.brokerCommission;
                      delete copy.brokerCommissionAmt;
                      delete copy.brokerName;
                      delete copy.brokerSignature;
                      delete copy.broker_signature;
                      delete copy.brokerTitle;
                      delete copy.brokerAuthorityTitle;
                      delete copy.salesBroker;
                      delete copy.sales_broker;
                      return copy;
                    });
                  } else if (userClearedBrokerRef.current) {
                    setBrokerCommissionType(null);
                    setBrokerCommission('');
                    setBrokerCommissionAmt('');
                    setBrokerName('');
                    setBrokerSignature('');
                    setBrokerTitle('BROKER SIGNATURE');
                    setBrokerAuthorityTitle('AUTHORISED SIGNATURE');
                    hasUserClearedBrokerSigRef.current = true;
                  }
                }}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                allowDeselect={true}
                disabled={readOnly}
              />

              {isSalesBrokerAllowed && (
                <>
                  {/* Commission Type Segmented Toggle: % or PMT */}
                  <div className="pl-2 border-l border-border/70 flex flex-col sm:flex-row sm:items-center gap-1.5" data-field="brokerCommissionType">
                    <DocSegmentedToggle<'PERCENTAGE' | 'PMT'>
                      id="toggle-broker-commission-type"
                      value={brokerCommissionType}
                      onChange={(val) => {
                        markDirty();
                        setBrokerCommissionType(val);
                        if (!val) {
                          setBrokerCommission('');
                          setBrokerCommissionAmt('');
                        }
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.brokerCommissionType;
                          delete copy.brokerCommission;
                          delete copy.brokerCommissionAmt;
                          return copy;
                        });
                      }}
                      options={DEFAULT_BROKER_COMMISSION_TYPE_OPTIONS}
                      allowDeselect={true}
                      disabled={readOnly}
                      error={errors.brokerCommissionType}
                    />
                    {errors.brokerCommissionType && (
                      <span className="text-[11px] text-brand-red font-semibold px-0.5">
                        {errors.brokerCommissionType}
                      </span>
                    )}
                  </div>

                  {/* ONLY SHOW COMMISSION INPUT, AMOUNT, AND BROKER NAME AFTER % OR PMT IS SELECTED */}
                  {Boolean(brokerCommissionType) && (
                    <>
                      {/* Commission Rate Number Input with Label */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70" data-field="brokerCommission">
                        <label
                          htmlFor="field-broker-commission"
                          className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap"
                        >
                          Commission {brokerCommissionType === 'PERCENTAGE' ? '(%)' : '(PMT)'}:
                        </label>
                        <div className="w-[110px] sm:w-[125px]">
                          <DocUnderlineInput
                            id="field-broker-commission"
                            type="number"
                            min={0}
                            step="any"
                            value={brokerCommission}
                            onChange={(val) => {
                              markDirty();
                              setBrokerCommission(val);
                              setErrors((prev) => ({ ...prev, brokerCommission: '' }));
                            }}
                            error={errors.brokerCommission}
                            placeholder={brokerCommissionType === 'PERCENTAGE' ? '0.00 %' : '0.00 PMT'}
                            align="center"
                            disabled={readOnly}
                          />
                        </div>
                      </div>

                      {/* Broker Commission Calculated Amount Display */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                        <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap">
                          Broker Commission:
                        </span>
                        <span className="text-[14px] font-bold text-foreground py-0.5">
                          {calculatedBrokerCommission
                            ? `${currencySymbol} ${formatNumberWithCommas(calculatedBrokerCommission)}`
                            : brokerCommissionAmt
                            ? `${currencySymbol} ${formatNumberWithCommas(brokerCommissionAmt)}`
                            : '-'}
                        </span>
                      </div>

                      {/* Broker Name Text Input */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70 flex-1 min-w-[240px]" data-field="brokerName">
                        <label
                          htmlFor="field-broker-name"
                          className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap"
                        >
                          Broker Name:
                        </label>
                        <div className="flex-1 min-w-[160px]">
                          <DocUnderlineInput
                            id="field-broker-name"
                            value={brokerName}
                            onChange={(val) => {
                              markDirty();
                              setBrokerName(val);
                              setErrors((prev) => ({ ...prev, brokerName: '' }));
                            }}
                            error={errors.brokerName}
                            placeholder="BROKER NAME"
                            icon="fa-solid fa-pen"
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ROW: COUNTRY REQUIRED DOCUMENTS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="countryRequiredDocuments">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                COUNTRY REQUIRED DOCUMENTS
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-wrap items-center gap-3 sm:gap-6">
              {/* ECTN Toggle */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap">
                  ECTN
                </span>
                <DocSegmentedToggle
                  id="toggle-ectn"
                  value={ectnField}
                  onChange={handleEctnChange}
                  trueLabel="YES"
                  falseLabel="NO"
                  allowDeselect={true}
                  disabled={readOnly}
                />
              </div>

              {/* COC Toggle */}
              <div className="flex items-center gap-2 sm:gap-2.5 pl-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-border/70 pt-2 sm:pt-0">
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap">
                  COC
                </span>
                <DocSegmentedToggle
                  id="toggle-coc"
                  value={cocFields}
                  onChange={handleCocChange}
                  trueLabel="YES"
                  falseLabel="NO"
                  allowDeselect={true}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* ROW 25: ADDITIONAL DETAILS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="additionalDetails">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                ADDITIONAL DETAILS
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-col gap-2.5">
              {/* FREE DAYS */}
              <div className="flex items-center gap-2 sm:gap-3">
                <label
                  htmlFor="field-freeDays"
                  className="w-[105px] sm:w-[120px] shrink-0 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap px-0.5"
                >
                  FREE DAYS
                </label>
                <div className="flex-1 min-w-0">
                  <DocUnderlineInput
                    id="field-freeDays"
                    value={freeDays}
                    onChange={(val) => {
                      markDirty();
                      setFreeDays(val);
                      setErrors((prev) => ({ ...prev, freeDays: '' }));
                    }}
                    error={errors.freeDays}
                    icon="fa-solid fa-pen"
                    placeholder="ENTER FREE DAYS"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* EMPTY BAGS */}
              <div className="flex items-center gap-2 sm:gap-3">
                <label
                  htmlFor="field-emptyBags"
                  className="w-[105px] sm:w-[120px] shrink-0 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap px-0.5"
                >
                  EMPTY BAGS
                </label>
                <div className="flex-1 min-w-0">
                  <DocUnderlineInput
                    id="field-emptyBags"
                    value={emptyBags}
                    onChange={(val) => {
                      markDirty();
                      setEmptyBags(val);
                      setErrors((prev) => ({ ...prev, emptyBags: '' }));
                    }}
                    error={errors.emptyBags}
                    icon="fa-solid fa-pen"
                    placeholder="ENTER EMPTY BAGS"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* COMMENT */}
              <div className="flex items-center gap-2 sm:gap-3">
                <label
                  htmlFor="field-additionalComment"
                  className="w-[105px] sm:w-[120px] shrink-0 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap px-0.5"
                >
                  COMMENT
                </label>
                <div className="flex-1 min-w-0">
                  <DocUnderlineInput
                    id="field-additionalComment"
                    value={additionalComment}
                    onChange={(val) => {
                      markDirty();
                      setAdditionalComment(val);
                      setErrors((prev) => ({ ...prev, additionalComment: '', comment: '' }));
                    }}
                    error={errors.additionalComment || errors.comment}
                    icon="fa-solid fa-pen"
                    placeholder="ENTER COMMENT"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ROW 26: OTHER TERMS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="otherTermsPayment">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                OTHER TERMS
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-otherTermsPayment"
                value={otherTermsPayment}
                onChange={(val) => {
                  markDirty();
                  setOtherTermsPayment(val);
                  setErrors((prev) => ({ ...prev, otherTermsPayment: '', other_terms_1: '' }));
                }}
                error={errors.otherTermsPayment || errors.other_terms_1}
                placeholder="PAYMENT TERMS, BANK CHARGES INSTRUCTIONS..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 27: DOCUMENTS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="documents">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                DOCUMENTS
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocDocumentMultiSelect
                value={selectedDocuments}
                onChange={(val) => {
                  markDirty();
                  setSelectedDocuments(val);
                  setErrors((prev) => ({ ...prev, documentsRequired: '', documents: '' }));
                }}
                options={internalDocumentList}
                disabled={readOnly}
                placeholder="Enter Document"
                lang={lang}
              />
              {(errors.documentsRequired || errors.documents) && (
                <div className="w-full text-[11px] text-brand-red font-semibold px-0.5 tracking-tight flex items-center gap-1.5 mt-1 select-none">
                  <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                  <span>{errors.documentsRequired || errors.documents}</span>
                </div>
              )}
            </div>
          </div>

          {/* ROW 28: SHIPPING LINE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shippingLine">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                SHIPPING LINE
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-shippingLine"
                value={shippingLine}
                onChange={(val) => {
                  markDirty();
                  setShippingLine(val);
                  setErrors((prev) => ({ ...prev, shippingLine: '' }));
                }}
                error={errors.shippingLine}
                icon="fa-solid fa-pen"
                placeholder="SHIPMENT IN CONTAINERS ( DO NOT USE NVOCC & IRANIAN SHIPPING LINE )"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 29: ARBITRATION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="arbitration">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                ARBITRATION
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-arbitration"
                value={arbitration}
                onChange={(val) => {
                  markDirty();
                  setArbitration(val);
                  setErrors((prev) => ({ ...prev, arbitration: '' }));
                }}
                error={errors.arbitration}
                icon="fa-solid fa-pen"
                placeholder="ENTER ARBITRATION"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 30: OTHER TERMS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="containerStandards">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                OTHER TERMS
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-containerStandards"
                value={containerStandards}
                onChange={(val) => {
                  markDirty();
                  setContainerStandards(val);
                  setErrors((prev) => ({ ...prev, containerStandards: '', other_terms_2: '' }));
                }}
                error={errors.containerStandards || errors.other_terms_2}
                placeholder="SPECIAL CONTAINER TERMS, EMPTY BAGS, SILICA GEL, PLASTIC SHEETS..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 31: FORCE MAJEUR */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="forceMajeur">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                FORCE MAJEUR
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-forceMajeur"
                value={forceMajeur}
                onChange={(val) => {
                  markDirty();
                  setForceMajeur(val);
                  setErrors((prev) => ({ ...prev, forceMajeur: '' }));
                }}
                error={errors.forceMajeur}
                placeholder="FORCE MAJEURE CLAUSES..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 32: CONFIDENTIALITY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="confidentiality">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                CONFIDENTIALITY
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-confidentiality"
                value={confidentiality}
                onChange={(val) => {
                  markDirty();
                  setConfidentiality(val);
                  setErrors((prev) => ({ ...prev, confidentiality: '' }));
                }}
                error={errors.confidentiality}
                placeholder="CONFIDENTIALITY AND BROKER SAFETY PROTECTION CLAUSE..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 33: NOTES */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="notes">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                NOTES
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-contract-notes"
                value={notes}
                onChange={(val) => {
                  markDirty();
                  setNotes(val);
                  setErrors((prev) => ({ ...prev, notes: '' }));
                }}
                error={errors.notes}
                placeholder="WRITE YOUR DESCRIPTION..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 34: SIGNATURES - RESPONSIVE COLLAPSIBLE ON MOBILE/TABLET & SIDE-BY-SIDE ON DESKTOP */}
          <ContractSignatureSection
            isSalesBrokerAllowed={isSalesBrokerAllowed === true}
            exporterTitle={exporterTitle}
            onExporterTitleChange={(val) => {
              markDirty();
              setExporterTitle(val);
            }}
            exporterSignature={exporterSignature}
            onExporterSignatureChange={handleExporterSignatureChange}
            exporterAuthorityTitle={exporterAuthorityTitle}
            onExporterAuthorityTitleChange={(val) => {
              markDirty();
              setExporterAuthorityTitle(val);
            }}
            brokerTitle={brokerTitle}
            onBrokerTitleChange={(val) => {
              markDirty();
              setBrokerTitle(val);
            }}
            brokerSignature={brokerSignature}
            onBrokerSignatureChange={handleBrokerSignatureChange}
            brokerAuthorityTitle={brokerAuthorityTitle}
            onBrokerAuthorityTitleChange={(val) => {
              markDirty();
              setBrokerAuthorityTitle(val);
            }}
            importerTitle={importerTitle}
            onImporterTitleChange={(val) => {
              markDirty();
              setImporterTitle(val);
            }}
            importerSignature={importerSignature}
            onImporterSignatureChange={handleImporterSignatureChange}
            importerAuthorityTitle={importerAuthorityTitle}
            onImporterAuthorityTitleChange={(val) => {
              markDirty();
              setImporterAuthorityTitle(val);
            }}
            readOnly={readOnly}
            exporterError={errors.exporterSignature || errors.seller_signature}
            brokerError={errors.brokerSignature || errors.broker_signature}
            importerError={errors.importerSignature || errors.buyer_signature}
          />

          {/* ROW 35: CONTRACT COMMENTS (comment_label & comment_value) */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border"
            data-field="commentSection"
          >
            <div className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0" data-field="commentLabel">
              <DocUnderlineInput
                id="field-commentLabel"
                value={commentLabel}
                onChange={(val) => {
                  markDirty();
                  setCommentLabel(val);
                  setErrors((prev) => ({ ...prev, commentLabel: '', comment_label: '' }));
                }}
                error={errors.commentLabel || errors.comment_label}
                icon="fa-solid fa-pen"
                disabled={readOnly}
                placeholder={dict?.smart_docs?.contract_form?.enter_title || 'Enter Title'}
                uppercase={false}
                inputClassName="text-[14px] font-semibold"
              />
            </div>
            <div
              className="sm:col-span-2 py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              data-field="commentValue"
            >
              <DocUnderlineInput
                id="field-commentValue"
                value={commentValue}
                onChange={(val) => {
                  markDirty();
                  setCommentValue(val);
                  setErrors((prev) => ({ ...prev, commentValue: '', comment_value: '' }));
                }}
                error={errors.commentValue || errors.comment_value}
                icon="fa-solid fa-pen"
                disabled={readOnly}
                placeholder={dict?.smart_docs?.contract_form?.enter_comment || 'Enter Comment'}
                uppercase={false}
                inputClassName="text-[14px] font-semibold"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 
        BOTTOM ACTION BAR:
        Theme-compliant buttons matching AgriGuru brand system (exact match with confirmation).
        Sticky on mobile docked at viewport bottom, static on desktop at bottom of card.
      */}
      <div 
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Print Preview & Download PDF (Red themed like Confirmation) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button */}
          <button
            type="button"
            onClick={handleOpenPrintPreview}
            title={dict?.smart_docs?.contract_form?.print_preview || dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>{dict?.smart_docs?.contract_form?.print_preview || dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            title={dict?.smart_docs?.contract_form?.download_pdf || dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20"
          >
            {isDownloadingPdf ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-solid fa-file-pdf text-xs" />
            )}
            <span>
              {isDownloadingPdf
                ? dict?.smart_docs?.downloading || 'Downloading...'
                : dict?.smart_docs?.contract_form?.download_pdf || dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}
            </span>
          </button>
        </div>

        {/* Right Action Buttons: Save As Draft & Submit To Proforma */}
        <div className={`grid ${docStatus === 'COMPLETED' ? 'grid-cols-1' : 'grid-cols-2'} sm:flex sm:items-center gap-2 sm:gap-2.5 transition-all duration-200`}>
          {/* Save As Draft: Shown only while status is PENDING; hidden when COMPLETED */}
          {isStatusLoading ? (
            <div className="h-7 w-28 rounded-md bg-muted/60 animate-pulse border border-border" />
          ) : docStatus !== 'COMPLETED' ? (
            <button
              type="button"
              disabled={isSavingDraft || isSubmitting || readOnly || !hasDraftChanges}
              onClick={handleSaveDraft}
              title={!hasDraftChanges ? 'No changes to save as draft' : undefined}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-md text-xs font-semibold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary active:scale-[0.98] transition-all duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 animate-in fade-in"
            >
              {isSavingDraft ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
              ) : (
                <i className="fa-regular fa-floppy-disk text-xs" />
              )}
              <span className="truncate">
                {isSavingDraft
                  ? 'Saving...'
                  : dict?.smart_docs?.confirmation_form?.save_as_draft || 'Save As Draft'}
              </span>
            </button>
          ) : null}

          {/* Submit */}
          <button
            type="button"
            disabled={isSubmitting || isSavingDraft || readOnly || (docStatus === 'COMPLETED' && !hasSubmitChanges)}
            onClick={handleSubmit}
            title={docStatus === 'COMPLETED' && !hasSubmitChanges ? 'Contract already submitted' : undefined}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group ${
              docStatus === 'COMPLETED' ? 'w-full sm:w-auto' : ''
            }`}
          >
            <span className="truncate">
              {isSubmitting ? 'Submitting...' : submitInfo.buttonLabel}
            </span>
            {isSubmitting ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      <ProductManageModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        mode={productModalMode}
        product={editingProduct}
        onSave={(savedProd) => {
          markDirty();
          const formattedItem: FormOptionItem = {
            value: savedProd.id,
            label: savedProd.label,
            subLabel: savedProd.country ? `Origin Country: ${savedProd.country}` : undefined,
            hsn: savedProd.hsn,
            country: savedProd.country,
            spec: savedProd.spec,
          };
          setInternalProducts((prev) => {
            const idx = prev.findIndex(
              (p) => p.value === savedProd.id || p.label.toLowerCase() === savedProd.label.toLowerCase()
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...formattedItem };
              return next;
            }
            return [formattedItem, ...prev];
          });
          setProductId(savedProd.id);
          setHsnCode(savedProd.hsn);
          setProductCountry(savedProd.country);
          if (savedProd.spec) setSpecification(savedProd.spec);
          setIsProductModalOpen(false);
        }}
        dict={dict}
      />

      {/* Payment Term Add / Edit Modal */}
      <PaymentTermManageModal
        isOpen={isPaymentTermModalOpen}
        onClose={() => setIsPaymentTermModalOpen(false)}
        mode={paymentTermModalMode}
        paymentTerm={editingPaymentTerm}
        onSave={(savedTerm) => {
          markDirty();
          const formattedItem: FormOptionItem = {
            value: savedTerm.id,
            label: savedTerm.label,
            subLabel: savedTerm.description || (savedTerm.days ? `${savedTerm.days} Days credit period` : undefined),
            badge: savedTerm.days ? `${savedTerm.days} Days` : undefined,
            days: savedTerm.days,
            description: savedTerm.description,
          };
          setInternalPaymentTerms((prev) => {
            const idx = prev.findIndex((p) => p.value === savedTerm.id || p.label.toLowerCase() === savedTerm.label.toLowerCase());
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...formattedItem };
              return next;
            }
            return [formattedItem, ...prev];
          });
          setPaymentTerm(savedTerm.id);
          setIsPaymentTermModalOpen(false);
        }}
        dict={dict}
      />

      {/* Party (Seller / Buyer) Add / Edit Modal */}
      <InstructionManageModal
        isOpen={isInstructionModalOpen}
        onClose={() => setIsInstructionModalOpen(false)}
        mode={instructionModalMode}
        partyType={instructionModalPartyType}
        party={editingParty}
        onSave={handleSaveInstruction}
        dict={dict}
      />

      {/* Contract Print Preview Modal */}
      <DocPrintPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        prefix="contract"
        docId={getEffectiveContractId()}
        candidateIds={[
          getEffectiveContractId(),
          draftId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        contractId={getEffectiveContractId()}
        confirmationId={confirmationId}
        docNumber={
          contractNumber ||
          toCleanLabel(
            initialData?.contract_number ||
            initialData?.contractNumber ||
            initialData?.contract_no ||
            initialData?.contractNo ||
            (initialData?.contract && typeof initialData.contract === 'object'
              ? initialData.contract.contract_number || initialData.contract.contract_no
              : '')
          ) ||
          ''
        }
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default ContractDocumentForm;
