'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DocToggle from './DocToggle';
import DocUnderlineInput from './DocUnderlineInput';
import DocUnderlineSelect from './DocUnderlineSelect';
import DocNotesEditor from './DocNotesEditor';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { toast } from 'sonner';
import {
  getSmartDocsInstructionsAction,
  getSmartDocsProductsAction,
  getSmartDocsProductDetailsAction,
  getSmartDocsPaymentTermsAction,
  getSmartDocsCurrenciesAction,
  saveConfirmationDraftAction,
} from '@/app/actions/smart-docs';
import {
  extractHsnCodeFromItem,
  extractSpecificationFromItem,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_CURRENCIES,
  cleanConfirmationPayload,
  type SaveConfirmationPayload,
} from '@/lib/api/smart-docs.service';
import ProductManageModal from './ProductManageModal';
import PaymentTermManageModal from './PaymentTermManageModal';

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

export const STATIC_SHIP_BY_OPTIONS: FormOptionItem[] = [
  { value: 'FCL_20_FT', label: '20 FT' },
  { value: 'FCL_40_FT', label: '40 FT' },
  { value: 'VESSEL', label: 'Vessel' },
];

/**
 * Normalizes ship_by values for backend API (e.g. FCL_20_FT, FCL_40_FT, VESSEL).
 * Returns empty string if not provided (user choice).
 */
export const normalizeShipByForApi = (val?: string | null): string => {
  if (!val) return '';
  const s = String(val).trim().toUpperCase();
  if (s.includes('VESSEL') || s.includes('BREAK BULK') || s.includes('BREAKBULK') || s.includes('BULK')) {
    return 'VESSEL';
  }
  if (s.includes('20')) return 'FCL_20_FT';
  if (s.includes('40')) return 'FCL_40_FT';
  return val.trim();
};

/**
 * Safely formats Date object into YYYY-MM-DD using local time (avoids UTC offset shifts).
 */
export const formatLocalDate = (d: Date | null): string => {
  if (!d || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Checks whether the shipping mode is container-based FCL (20 FT or 40 FT).
 * Returns true when 20 FT or 40 FT is specified (including FCL_20_FT, FCL_40_FT, 20 FT, etc.).
 * Returns false for Vessel, Breakbulk, Bulk or unspecified modes.
 */
export const isFclShipBy = (val?: string | null): boolean => {
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  if (
    s.includes('VESSEL') ||
    s.includes('BREAK BULK') ||
    s.includes('BREAKBULK') ||
    s.includes('BULK')
  ) {
    return false;
  }
  if (s.includes('20') || s.includes('40')) {
    return true;
  }
  if (s.includes('FCL') || s.includes('CONTAINER')) {
    return true;
  }
  return false;
};

export const STATIC_SHIPPING_TERM_OPTIONS: FormOptionItem[] = [
  { value: 'FOB', label: 'FOB' },
  { value: 'CNF', label: 'CNF' },
  { value: 'CIF', label: 'CIF' },
];

export const normalizeCountryString = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    return String(val.name || val.country_name || val.title || val.label || '').trim();
  }
  return String(val).trim();
};

export const normalizeHsnString = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    return String(val.code || val.hsn || val.hsn_code || '').trim();
  }
  return String(val).trim();
};

/**
 * Transforms raw backend validator messages (e.g. NestJS/class-validator strings)
 * into clean, user-friendly labels and phrases.
 * Explicitly prevents raw strings like "shipment_start_date must be a Date instance" from being shown to users.
 */
export function humanizeValidationMessage(rawMsg: any, fieldKey?: string): string {
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
  if (/must be a date instance/i.test(msg)) {
    msg = msg.replace(/must be a date instance/gi, 'must be a valid date');
  }
  if (/must be an? (?:isodate|iso8601|valid iso)/i.test(msg)) {
    msg = msg.replace(/must be an? (?:isodate|iso8601|valid iso)[^,]*/gi, 'must be a valid date');
  }
  if (/(?:should not|must not|cannot) be empty/i.test(msg)) {
    msg = msg.replace(/(?:should not|must not|cannot) be empty/gi, 'is required');
  }
  if (/must be a string/i.test(msg)) {
    msg = msg.replace(/must be a string/gi, 'is required');
  }
  if (/must be a number/i.test(msg)) {
    msg = msg.replace(/must be a number/gi, 'must be a valid number');
  }

  // Replace technical field identifiers with clean names
  const fieldLabelReplacements: [RegExp, string][] = [
    [/\bshipment_start_date\b/gi, 'Shipment start date'],
    [/\bshipment_end_date\b/gi, 'Shipment end date'],
    [/\bshipment_period\b/gi, 'Shipment period'],
    [/\bconfirmation_number\b/gi, 'Confirmation number'],
    [/\bconfirmation_date\b/gi, 'Confirmation date'],
    [/\bseller_instruction_id\b/gi, 'Exporter (Seller)'],
    [/\bseller_instruction\b/gi, 'Seller instruction'],
    [/\bbuyer_instruction_id\b/gi, 'Importer (Buyer)'],
    [/\bbuyer_instruction\b/gi, 'Buyer instruction'],
    [/\bproduct_id\b/gi, 'Product'],
    [/\bproduct_name\b/gi, 'Product name'],
    [/\bhsn_code\b/gi, 'HSN code'],
    [/\bquality_specification\b/gi, 'Specification'],
    [/\bloading_port_id\b/gi, 'Loading port'],
    [/\bdestination_port_id\b/gi, 'Destination port'],
    [/\bpacking_type_id\b/gi, 'Packing'],
    [/\bshipping_term\b/gi, 'Shipping term'],
    [/\bfcl_quantity\b/gi, 'FCL quantity'],
    [/\bfcl_capacity\b/gi, 'FCL capacity'],
    [/\bmt_quantity\b/gi, 'MT quantity'],
    [/\bbag_quantity\b/gi, 'Bag quantity'],
    [/\bcurrency_id\b/gi, 'Currency'],
    [/\bpayment_term_id\b/gi, 'Payment term'],
    [/\btotal_value\b/gi, 'Total value'],
    [/\bpdf_title\b/gi, 'Document title'],
  ];

  for (const [pattern, label] of fieldLabelReplacements) {
    msg = msg.replace(pattern, label);
  }

  // Convert any remaining snake_case identifiers like `some_field_name` to `Some field name`
  msg = msg.replace(/\b[a-z]+(_[a-z0-9]+)+\b/gi, (match: string) => {
    return match
      .replace(/_id$/i, '')
      .replace(/_/g, ' ')
      .trim();
  });

  // Capitalize sentence start
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

/**
 * Detects which form field an error message or identifier belongs to.
 */
export function detectFieldInSentence(text: string): { key: string; rawField: string } | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  if (
    lower.includes('shipment_start') ||
    lower.includes('shipmentstart') ||
    lower.includes('shipment_end') ||
    lower.includes('shipmentend') ||
    lower.includes('shipment_period') ||
    lower.includes('shipmentperiod') ||
    lower.includes('shipment_date')
  ) {
    return { key: 'shipmentPeriod', rawField: 'shipment_start_date' };
  }
  if (lower.includes('confirmation_number') || lower.includes('confirmationnumber') || lower.includes('confirm_no')) {
    return { key: 'confirmationNumber', rawField: 'confirmation_number' };
  }
  if (lower.includes('confirmation_date') || lower.includes('confirmationdate')) {
    return { key: 'confirmationDate', rawField: 'confirmation_date' };
  }
  if (lower.includes('seller_instruction_id') || lower.includes('seller_id') || lower.includes('sellerid') || lower.includes('exporter')) {
    return { key: 'sellerId', rawField: 'seller_instruction_id' };
  }
  if (lower.includes('seller_instruction')) {
    return { key: 'sellerInstruction', rawField: 'seller_instruction' };
  }
  if (lower.includes('buyer_instruction_id') || lower.includes('buyer_id') || lower.includes('buyerid') || lower.includes('importer')) {
    return { key: 'buyerId', rawField: 'buyer_instruction_id' };
  }
  if (lower.includes('buyer_instruction')) {
    return { key: 'buyerInstruction', rawField: 'buyer_instruction' };
  }
  if (lower.includes('product_id') || lower.includes('productid') || lower.includes('product_name')) {
    return { key: 'productId', rawField: 'product_id' };
  }
  if (lower.includes('hsn_code') || lower.includes('hsncode') || lower.includes('hsn')) {
    return { key: 'hsnCode', rawField: 'hsn_code' };
  }
  if (lower.includes('quality_specification') || lower.includes('specification')) {
    return { key: 'specification', rawField: 'quality_specification' };
  }
  if (lower.includes('ship_by') || lower.includes('shipby') || lower.includes('shipping_mode')) {
    return { key: 'shipBy', rawField: 'ship_by' };
  }
  if (lower.includes('loading_port_id') || lower.includes('loading_port') || lower.includes('loadingport')) {
    return { key: 'loadingPort', rawField: 'loading_port_id' };
  }
  if (lower.includes('destination_port_id') || lower.includes('destination_port') || lower.includes('destinationport')) {
    return { key: 'destinationPort', rawField: 'destination_port_id' };
  }
  if (lower.includes('packing_type_id') || lower.includes('packing_type') || lower.includes('packingtype') || lower.includes('packing')) {
    return { key: 'packing', rawField: 'packing_type_id' };
  }
  if (lower.includes('shipping_term') || lower.includes('shippingterm') || lower.includes('deliveryterm')) {
    return { key: 'shippingTerm', rawField: 'shipping_term' };
  }
  if (lower.includes('fcl_quantity') || lower.includes('fcl_qty') || lower.includes('fclquantity')) {
    return { key: 'fclQty', rawField: 'fcl_quantity' };
  }
  if (lower.includes('fcl_capacity') || lower.includes('fclcapacity')) {
    return { key: 'fclCapacity', rawField: 'fcl_capacity' };
  }
  if (lower.includes('mt_quantity') || lower.includes('mt_qty') || lower.includes('mtquantity')) {
    return { key: 'mtQty', rawField: 'mt_quantity' };
  }
  if (lower.includes('bag_quantity') || lower.includes('bag_qty') || lower.includes('bagquantity')) {
    return { key: 'bagQty', rawField: 'bag_quantity' };
  }
  if (lower.includes('currency_id') || lower.includes('currencyid') || lower.includes('currency')) {
    return { key: 'currency', rawField: 'currency_id' };
  }
  if (lower.includes('price') || lower.includes('unitprice')) {
    return { key: 'price', rawField: 'price' };
  }
  if (lower.includes('total_value') || lower.includes('totalvalue')) {
    return { key: 'totalValue', rawField: 'total_value' };
  }
  if (lower.includes('payment_term_id') || lower.includes('payment_term') || lower.includes('paymentterm')) {
    return { key: 'paymentTerm', rawField: 'payment_term_id' };
  }
  if (lower.includes('notes') || lower.includes('remarks') || lower.includes('description')) {
    return { key: 'notes', rawField: 'notes' };
  }
  if (lower.includes('pdf_title') || lower.includes('document_title')) {
    return { key: 'documentTitle', rawField: 'pdf_title' };
  }
  return null;
}

export const FORM_FIELD_VISUAL_ORDER = [
  'documentTitle',
  'confirmationNumber',
  'confirmationDate',
  'sellerId',
  'sellerInstruction',
  'buyerId',
  'buyerInstruction',
  'productId',
  'hsnCode',
  'productCountry',
  'specification',
  'shipBy',
  'loadingPort',
  'destinationPort',
  'packing',
  'shippingTerm',
  'fclQty',
  'fclCapacity',
  'mtQty',
  'bagQty',
  'currency',
  'price',
  'totalValue',
  'shipmentPeriod',
  'paymentTerm',
  'notes',
];

/**
 * Smoothly scrolls to the first field that failed validation, focuses the input,
 * and adds an active highlight ring so the user immediately knows where input is needed.
 */
export function scrollToAndFocusField(fieldErrorsOrKey: string | Record<string, string>): void {
  if (typeof window === 'undefined') return;

  let targetKey = '';
  if (typeof fieldErrorsOrKey === 'string') {
    targetKey = fieldErrorsOrKey;
  } else if (fieldErrorsOrKey && typeof fieldErrorsOrKey === 'object') {
    for (const key of FORM_FIELD_VISUAL_ORDER) {
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
    `[data-field="${targetKey}"]`,
    `#${targetKey}`,
    `[name="${targetKey}"]`,
  ];

  if (targetKey === 'confirmationNumber') {
    selectors.unshift('#confirmation-number-input');
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

      // Attention pulse animation on target field
      el!.classList.add('ring-2', 'ring-brand-red', 'ring-offset-2', 'rounded-sm', 'transition-all', 'duration-300');
      setTimeout(() => {
        el!.classList.remove('ring-2', 'ring-brand-red', 'ring-offset-2', 'rounded-sm', 'transition-all', 'duration-300');
      }, 2500);
    }, 120);
  }
}

/**
 * Robust helper to extract field-wise validation errors and general error from backend API response.
 * Automatically humanizes all technical field names and error messages.
 */
export function parseBackendFieldErrors(
  result: any
): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!result) return { fieldErrors, generalError: 'Failed to save draft' };

  const mapFieldNameToErrorKey = (field: string): string => {
    const f = String(field || '').trim();
    const clean = f.toLowerCase().replace(/[-_.]/g, '');

    switch (clean) {
      case 'confirmationnumber':
      case 'confirmationno':
      case 'confirmno':
      case 'number':
        return 'confirmationNumber';
      case 'confirmationdate':
      case 'date':
        return 'confirmationDate';
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
      case 'productid':
      case 'product':
        return 'productId';
      case 'productname':
        return 'productName';
      case 'hsncode':
      case 'hsn':
      case 'hsnsaccode':
        return 'hsnCode';
      case 'productcountry':
      case 'country':
      case 'origincountry':
      case 'origin':
        return 'productCountry';
      case 'qualityspecification':
      case 'specification':
      case 'spec':
      case 'quality':
        return 'specification';
      case 'shipby':
      case 'shippingmode':
      case 'mode':
        return 'shipBy';
      case 'loadingportid':
      case 'loadingport':
      case 'portofloading':
      case 'pol':
        return 'loadingPort';
      case 'destinationportid':
      case 'destinationport':
      case 'portofdestination':
      case 'portofdischarge':
      case 'pod':
        return 'destinationPort';
      case 'packingtypeid':
      case 'packingtype':
      case 'packing':
      case 'packaging':
        return 'packing';
      case 'shippingterm':
      case 'deliveryterm':
      case 'incoterm':
        return 'shippingTerm';
      case 'fclquantity':
      case 'fclqty':
        return 'fclQty';
      case 'fclcapacity':
      case 'fclcap':
        return 'fclCapacity';
      case 'mtquantity':
      case 'mtqty':
      case 'metrictons':
        return 'mtQty';
      case 'bagquantity':
      case 'bagqty':
      case 'bags':
        return 'bagQty';
      case 'currencyid':
      case 'currency':
      case 'currencycode':
        return 'currency';
      case 'price':
      case 'unitprice':
      case 'rate':
        return 'price';
      case 'totalvalue':
      case 'totalamount':
      case 'total':
      case 'amount':
        return 'totalValue';
      case 'shipmentstartdate':
      case 'shipmentenddate':
      case 'shipmentperiod':
      case 'shipmentdate':
        return 'shipmentPeriod';
      case 'paymenttermid':
      case 'paymentterm':
      case 'payment':
        return 'paymentTerm';
      case 'notes':
      case 'description':
      case 'remark':
      case 'remarks':
        return 'notes';
      case 'pdftitle':
      case 'documenttitle':
      case 'title':
        return 'documentTitle';
      default: {
        const detected = detectFieldInSentence(f);
        return detected ? detected.key : f;
      }
    }
  };

  const addError = (field: string, msg: any) => {
    if (!field) return;
    const key = mapFieldNameToErrorKey(field);
    let strMsg = '';
    if (typeof msg === 'string') {
      strMsg = msg;
    } else if (Array.isArray(msg)) {
      strMsg = msg.map((m) => (typeof m === 'string' ? m : m?.message || m?.msg || JSON.stringify(m))).join(', ');
    } else if (msg && typeof msg === 'object') {
      strMsg = msg.message || msg.msg || msg.error || JSON.stringify(msg);
    }

    const cleanMsg = humanizeValidationMessage(strMsg, key);
    if (cleanMsg && !fieldErrors[key]) {
      fieldErrors[key] = cleanMsg;
    }
  };

  // Inspect all possible sources of error fields from diverse backends (Express, NestJS, class-validator)
  const candidates = [
    result.error_fields,
    result.data?.error_fields,
    result.raw?.error_fields,
    result.errors,
    result.data?.errors,
    result.raw?.errors,
    result.raw?.data?.error_fields,
    result.raw?.data?.errors,
    Array.isArray(result.message) ? result.message : null,
    Array.isArray(result.raw?.message) ? result.raw.message : null,
    result.data,
    result.validation?.body,
    result.details,
    result.raw,
  ];

  for (const src of candidates) {
    if (!src) continue;

    if (Array.isArray(src)) {
      for (const item of src) {
        if (!item) continue;
        if (typeof item === 'string') {
          const detected = detectFieldInSentence(item);
          if (detected) {
            const clean = humanizeValidationMessage(item, detected.key);
            fieldErrors[detected.key] = clean;
            if (!generalError) generalError = clean;
          } else {
            const key = mapFieldNameToErrorKey(item);
            if (key && key !== item) {
              const clean = humanizeValidationMessage(`${item.replace(/_/g, ' ')} is required`, key);
              fieldErrors[key] = clean;
              if (!generalError) generalError = clean;
            } else if (!generalError) {
              generalError = humanizeValidationMessage(item);
            }
          }
          continue;
        }

        const fieldName =
          item.field ||
          item.field_name ||
          item.fieldName ||
          item.param ||
          item.name ||
          item.column ||
          (Array.isArray(item.path) ? item.path.join('.') : item.path) ||
          item.key ||
          item.property;
        const msg =
          item.message ||
          item.msg ||
          item.error ||
          item.text ||
          item.description ||
          (fieldName ? `${fieldName.replace(/_/g, ' ')} is invalid` : '');

        if (fieldName && msg) {
          addError(fieldName, msg);
        } else if (msg) {
          const detected = detectFieldInSentence(String(msg));
          if (detected) {
            const clean = humanizeValidationMessage(msg, detected.key);
            fieldErrors[detected.key] = clean;
            if (!generalError) generalError = clean;
          } else if (!generalError) {
            generalError = humanizeValidationMessage(String(msg));
          }
        }
      }
      continue;
    }

    if (typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (['status', 'statusCode', 'success', 'code', 'stack', 'raw'].includes(k)) {
          continue;
        }
        if (k === 'message' || k === 'error') {
          if (typeof v === 'string') {
            const detected = detectFieldInSentence(v);
            if (detected) {
              const clean = humanizeValidationMessage(v, detected.key);
              fieldErrors[detected.key] = clean;
              if (!generalError) generalError = clean;
            }
          }
          continue;
        }
        if (typeof v === 'string' || Array.isArray(v)) {
          addError(k, v);
        } else if (v && typeof v === 'object') {
          const nestedMsg = (v as any).message || (v as any).msg || (v as any).error;
          if (nestedMsg) {
            addError(k, nestedMsg);
          }
        }
      }
    }
  }

  const rawMsg = result.error || result.message;
  if (rawMsg) {
    const rawStr = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
    const isGenericValidationHeader =
      /form validation error|validation error|invalid payload|invalid input/i.test(rawStr);

    const detected = detectFieldInSentence(rawStr);
    if (detected && !fieldErrors[detected.key]) {
      const clean = humanizeValidationMessage(rawStr, detected.key);
      fieldErrors[detected.key] = clean;
      if (!generalError) generalError = clean;
    }

    if (Object.keys(fieldErrors).length === 0) {
      generalError = humanizeValidationMessage(rawStr);
    } else if (!isGenericValidationHeader && !generalError) {
      generalError = humanizeValidationMessage(rawStr);
    }
  }

  // Ensure generalError is humanized
  if (generalError) {
    generalError = humanizeValidationMessage(generalError);
  }

  return { fieldErrors, generalError };
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
  onSaveDraft?: (data: any) => Promise<any> | any;
  onSubmitContract?: (data: any) => Promise<any> | any;
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
  // Saved Draft ID (generated by backend on first save, sent on subsequent saves)
  const [draftId, setDraftId] = useState<string>(
    initialData?.id || initialData?._id || initialData?.confirmation_id || ''
  );

  // Document Configuration
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
    initialData?.pdf_title ||
      initialData?.pdfTitle ||
      initialData?.documentTitle ||
      initialData?.title ||
      dict?.smart_docs?.confirmation_form?.confirmation_title ||
      'CONFIRMATION'
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Row 1: Meta
  const [confirmationNumber, setConfirmationNumber] = useState<string>(
    initialData?.confirmationNumber || initialData?.confirmation_number || ''
  );
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const [confirmationDate, setConfirmationDate] = useState<string>(
    initialData?.confirmationDate || initialData?.confirmation_date || ''
  );

  // Row 2: Parties
  const [sellerId, setSellerId] = useState<string>(
    initialData?.sellerId || initialData?.seller_instruction_id || ''
  );
  const [sellerInstruction, setSellerInstruction] = useState<string>(
    initialData?.sellerInstruction || initialData?.seller_instruction || ''
  );
  const [buyerId, setBuyerId] = useState<string>(
    initialData?.buyerId || initialData?.buyer_instruction_id || ''
  );
  const [buyerInstruction, setBuyerInstruction] = useState<string>(
    initialData?.buyerInstruction || initialData?.buyer_instruction || ''
  );

  // Row 3: Product, HSN, Country
  const [productId, setProductId] = useState<string>(
    initialData?.productId || initialData?.product_id || ''
  );
  const [hsnCode, setHsnCode] = useState<string>(() => normalizeHsnString(initialData?.hsnCode || initialData?.hsn));
  const [productCountry, setProductCountry] = useState<string>(() =>
    normalizeCountryString(initialData?.productCountry || initialData?.country)
  );

  // Row 4: Specification
  const [specification, setSpecification] = useState<string>(
    initialData?.specification || initialData?.quality_specification || ''
  );

  // Row 5: Ship By (User's choice, no default pre-selection)
  const [shipBy, setShipBy] = useState<string>(() => {
    const init = initialData?.ship_by || initialData?.shipBy || '';
    if (init) return normalizeShipByForApi(init);
    return '';
  });
  const isFcl = isFclShipBy(shipBy);

  const handleShipByChange = (val: string) => {
    setShipBy(val);
    setErrors((prev) => ({ ...prev, shipBy: '', fclQty: '', fclCapacity: '', mtQty: '' }));
    if (!isFclShipBy(val)) {
      setFclQty('');
      setFclCapacity('');
    }
  };

  // Row 6: Loading Port
  const [loadingPort, setLoadingPort] = useState<string>(
    initialData?.loadingPort || initialData?.loading_port_id || ''
  );

  // Row 7: Destination Port
  const [destinationPort, setDestinationPort] = useState<string>(
    initialData?.destinationPort || initialData?.destination_port_id || ''
  );

  // Row 8: Packing
  const [packing, setPacking] = useState<string>(
    initialData?.packing || initialData?.packing_type_id || ''
  );

  // Row 9: Shipping Term
  const [shippingTerm, setShippingTerm] = useState<string>(
    initialData?.shippingTerm ||
      initialData?.shipping_term ||
      initialData?.incoterm ||
      initialData?.delivery_term ||
      'CNF'
  );

  // Row 10: Matrix Calculation
  const [fclQty, setFclQty] = useState<string | number>(
    initialData?.fclQty ?? initialData?.fcl_quantity ?? ''
  );
  const [fclCapacity, setFclCapacity] = useState<string | number>(
    initialData?.fclCapacity ?? initialData?.fcl_capacity ?? ''
  );
  const [mtQty, setMtQty] = useState<string | number>(
    initialData?.mtQty ?? initialData?.mt_quantity ?? ''
  );
  const [bagQty, setBagQty] = useState<string | number>(
    initialData?.bagQty ?? initialData?.bag_quantity ?? ''
  );
  const [currency, setCurrency] = useState<string>(() => {
    const init = initialData?.currency || initialData?.currency_code;
    if (init && typeof init === 'string' && init.trim()) {
      return init.trim().toUpperCase();
    }
    return 'USD';
  });
  const [currencyId, setCurrencyId] = useState<string>(
    initialData?.currency_id || initialData?.currencyId || ''
  );
  const [price, setPrice] = useState<string | number>(initialData?.price ?? '');
  const [totalValue, setTotalValue] = useState<string | number>(
    initialData?.totalValue ?? initialData?.total_value ?? ''
  );

  // Row 11: Shipment Period (Single DateRangePicker with underline variant)
  const [shipmentRange, setShipmentRange] = useState<{ start: Date | null; end: Date | null }>({
    start: initialData?.shipmentStartDate || initialData?.shipment_start_date
      ? new Date(initialData.shipmentStartDate || initialData.shipment_start_date)
      : null,
    end: initialData?.shipmentEndDate || initialData?.shipment_end_date
      ? new Date(initialData.shipmentEndDate || initialData.shipment_end_date)
      : null,
  });
  const [shipmentPeriod, setShipmentPeriod] = useState<string>(
    initialData?.shipmentPeriod || ''
  );

  // Row 12: Payment Term
  const [paymentTerm, setPaymentTerm] = useState<string>(
    initialData?.paymentTerm || initialData?.payment_term_id || ''
  );

  // Row 13: Notes
  const [notes, setNotes] = useState<string>(
    initialData?.notes || ''
  );

  // UI States
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Instructions Lists State (pre-populated by SSR or fetched via server action)
  const [internalSellers, setInternalSellers] = useState<FormOptionItem[]>(sellers || []);
  const [internalBuyers, setInternalBuyers] = useState<FormOptionItem[]>(buyers || []);
  const [isLoadingInstructions, setIsLoadingInstructions] = useState<boolean>(false);

  // Dynamic Products List State (pre-populated by SSR or fetched via server action)
  const [internalProducts, setInternalProducts] = useState<FormOptionItem[]>(products || []);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  // Dynamic Product Specific Fields State (packing types, loading ports, destination ports)
  const [internalPackingOptions, setInternalPackingOptions] = useState<FormOptionItem[]>(packingOptions || []);
  const [internalLoadingPorts, setInternalLoadingPorts] = useState<FormOptionItem[]>(loadingPorts || []);
  const [internalDestinationPorts, setInternalDestinationPorts] = useState<FormOptionItem[]>(destinationPorts || []);
  const [isLoadingProductDetails, setIsLoadingProductDetails] = useState<boolean>(false);
  const productDetailsCacheRef = useRef<Record<string, any>>({});

  // Product Add / Edit Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [productModalMode, setProductModalMode] = useState<'add' | 'edit'>('add');
  const [editingProduct, setEditingProduct] = useState<FormOptionItem | null>(null);

  // Dynamic Payment Terms List State (pre-populated by SSR or fetched via server action)
  const [internalPaymentTerms, setInternalPaymentTerms] = useState<FormOptionItem[]>(() => {
    if (paymentTerms && paymentTerms.length > 0) return paymentTerms;
    if (initialData?.paymentTerms && Array.isArray(initialData.paymentTerms)) return initialData.paymentTerms;
    if (initialData?.paymentTermsList && Array.isArray(initialData.paymentTermsList)) return initialData.paymentTermsList;
    return DEFAULT_PAYMENT_TERMS;
  });
  const [isLoadingPaymentTerms, setIsLoadingPaymentTerms] = useState<boolean>(false);

  // Dynamic Currencies List State (pre-populated by SSR or fetched via server action)
  const [internalCurrencies, setInternalCurrencies] = useState<FormOptionItem[]>(() => {
    if (currencies && currencies.length > 0) return currencies;
    if (initialData?.currencies && Array.isArray(initialData.currencies)) return initialData.currencies;
    if (initialData?.currenciesList && Array.isArray(initialData.currenciesList)) return initialData.currenciesList;
    return DEFAULT_CURRENCIES;
  });
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState<boolean>(false);

  // Payment Term Add / Edit Modal states
  const [isPaymentTermModalOpen, setIsPaymentTermModalOpen] = useState<boolean>(false);
  const [paymentTermModalMode, setPaymentTermModalMode] = useState<'add' | 'edit'>('add');
  const [editingPaymentTerm, setEditingPaymentTerm] = useState<FormOptionItem | null>(null);

  // Sync with props if updated externally
  useEffect(() => {
    if (sellers && sellers.length > 0) {
      setInternalSellers(sellers);
    }
  }, [sellers]);

  useEffect(() => {
    if (buyers && buyers.length > 0) {
      setInternalBuyers(buyers);
    }
  }, [buyers]);

  useEffect(() => {
    if (products && products.length > 0) {
      setInternalProducts(products);
    }
  }, [products]);

  useEffect(() => {
    if (packingOptions && packingOptions.length > 0) {
      setInternalPackingOptions(packingOptions);
    }
  }, [packingOptions]);

  useEffect(() => {
    if (loadingPorts && loadingPorts.length > 0) {
      setInternalLoadingPorts(loadingPorts);
    }
  }, [loadingPorts]);

  useEffect(() => {
    if (destinationPorts && destinationPorts.length > 0) {
      setInternalDestinationPorts(destinationPorts);
    }
  }, [destinationPorts]);

  useEffect(() => {
    if (paymentTerms && paymentTerms.length > 0) {
      setInternalPaymentTerms(paymentTerms);
    }
  }, [paymentTerms]);

  useEffect(() => {
    if (currencies && currencies.length > 0) {
      setInternalCurrencies(currencies);
    }
  }, [currencies]);

  // Client-side self-heal: if both sellers and buyers are empty on mount, fetch via server action
  useEffect(() => {
    if ((!sellers || sellers.length === 0) && (!buyers || buyers.length === 0)) {
      setIsLoadingInstructions(true);
      getSmartDocsInstructionsAction({ lang })
        .then((res) => {
          if (res.success) {
            if (res.sellers.length > 0) setInternalSellers(res.sellers);
            if (res.buyers.length > 0) setInternalBuyers(res.buyers);
          }
        })
        .catch((err) => {
          console.error('[ConfirmationDocumentForm] Error fetching instructions:', err);
        })
        .finally(() => {
          setIsLoadingInstructions(false);
        });
    }
  }, [sellers, buyers, lang]);

  // Client-side self-heal: if products is empty on mount, fetch via server action
  useEffect(() => {
    if (!products || products.length === 0) {
      setIsLoadingProducts(true);
      getSmartDocsProductsAction({ lang })
        .then((res) => {
          if (res.success && res.products.length > 0) {
            setInternalProducts(res.products);
          }
        })
        .catch((err) => {
          console.error('[ConfirmationDocumentForm] Error fetching products:', err);
        })
        .finally(() => {
          setIsLoadingProducts(false);
        });
    }
  }, [products, lang]);

  const handleAddNewProduct = () => {
    setEditingProduct(null);
    setProductModalMode('add');
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (opt: any) => {
    const found = productsList.find((p) => p.value === opt.value) || opt;
    setEditingProduct(found);
    setProductModalMode('edit');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (savedProd: {
    id: string;
    label: string;
    hsn: string;
    country: string;
    spec: string;
  }) => {
    const cleanCountry = normalizeCountryString(savedProd.country);
    const cleanHsn = normalizeHsnString(savedProd.hsn);

    const formattedItem: FormOptionItem = {
      value: savedProd.id,
      label: savedProd.label,
      subLabel: cleanCountry ? `Origin Country: ${cleanCountry}` : undefined,
      badge: undefined,
      hsn: cleanHsn,
      country: cleanCountry,
      spec: savedProd.spec,
    };

    setInternalProducts((prev) => {
      const existsIndex = prev.findIndex((p) => p.value === savedProd.id);
      if (existsIndex >= 0) {
        const next = [...prev];
        next[existsIndex] = { ...next[existsIndex], ...formattedItem };
        return next;
      }
      return [formattedItem, ...prev];
    });

    // Auto-select the newly added / edited product & populate HSN & Country
    setProductId(savedProd.id);
    setHsnCode(cleanHsn);
    setProductCountry(cleanCountry);
    if (savedProd.spec) {
      setSpecification(savedProd.spec);
    }
    setErrors((prev) => ({ ...prev, productId: '' }));
    fetchAndApplyProductDetails(savedProd.id);
  };

  // Client-side self-heal: if paymentTerms is empty on mount, fetch via server action
  useEffect(() => {
    if (!paymentTerms || paymentTerms.length === 0) {
      setIsLoadingPaymentTerms(true);
      getSmartDocsPaymentTermsAction({ lang })
        .then((res) => {
          if (res.success && res.paymentTerms && res.paymentTerms.length > 0) {
            setInternalPaymentTerms(res.paymentTerms);
          }
        })
        .catch((err) => {
          console.error('[ConfirmationDocumentForm] Error fetching payment terms:', err);
        })
        .finally(() => {
          setIsLoadingPaymentTerms(false);
        });
    }
  }, [paymentTerms, lang]);

  // Client-side self-heal: if currencies is empty on mount, fetch via server action
  useEffect(() => {
    if (!currencies || currencies.length === 0) {
      setIsLoadingCurrencies(true);
      getSmartDocsCurrenciesAction({ lang })
        .then((res) => {
          if (res.success && res.currencies && res.currencies.length > 0) {
            setInternalCurrencies(res.currencies);
          }
        })
        .catch((err) => {
          console.error('[ConfirmationDocumentForm] Error fetching currencies:', err);
        })
        .finally(() => {
          setIsLoadingCurrencies(false);
        });
    }
  }, [currencies, lang]);

  const handleAddNewPaymentTerm = (prefillName?: string) => {
    setEditingPaymentTerm(prefillName ? { value: '', label: prefillName } : null);
    setPaymentTermModalMode('add');
    setIsPaymentTermModalOpen(true);
  };

  const handleEditPaymentTerm = (opt: any) => {
    const found =
      internalPaymentTerms.find((p) => p.value === opt.value || p.label === opt.label) || opt;
    setEditingPaymentTerm(found);
    setPaymentTermModalMode('edit');
    setIsPaymentTermModalOpen(true);
  };

  const handleSavePaymentTerm = (savedTerm: {
    id: string;
    label: string;
    days?: string;
    description?: string;
  }) => {
    const formattedItem: FormOptionItem = {
      value: savedTerm.id,
      label: savedTerm.label,
      subLabel:
        savedTerm.description ||
        (savedTerm.days ? `${savedTerm.days} Days credit period` : undefined),
      badge: savedTerm.days ? `${savedTerm.days} Days` : undefined,
      days: savedTerm.days,
      description: savedTerm.description,
    };

    setInternalPaymentTerms((prev) => {
      const existsIndex = prev.findIndex(
        (p) =>
          p.value === savedTerm.id ||
          p.label.toLowerCase() === savedTerm.label.toLowerCase()
      );
      if (existsIndex >= 0) {
        const next = [...prev];
        next[existsIndex] = { ...next[existsIndex], ...formattedItem };
        return next;
      }
      return [formattedItem, ...prev];
    });

    // Auto-select the newly added / edited payment term & clear errors
    setPaymentTerm(savedTerm.id);
    setErrors((prev) => ({ ...prev, paymentTerm: '' }));
  };

  // Dynamic Lists Data (Derived from props or state or initialData)
  const sellersList: FormOptionItem[] =
    internalSellers.length > 0
      ? internalSellers
      : sellers || initialData?.sellers || initialData?.sellersList || [];

  const buyersList: FormOptionItem[] =
    internalBuyers.length > 0
      ? internalBuyers
      : buyers || initialData?.buyers || initialData?.buyersList || [];

  const productsList: FormOptionItem[] =
    internalProducts.length > 0
      ? internalProducts
      : products || initialData?.products || initialData?.productsList || [];
  const shipByList: FormOptionItem[] =
    shipByOptions && shipByOptions.length > 0
      ? shipByOptions
      : initialData?.shipByList && initialData.shipByList.length > 0
      ? initialData.shipByList
      : STATIC_SHIP_BY_OPTIONS;
  const isProductSelected = Boolean(productId && String(productId).trim().length > 0);
  const loadingPortsList: FormOptionItem[] =
    internalLoadingPorts.length > 0
      ? internalLoadingPorts
      : loadingPorts || initialData?.loadingPorts || initialData?.loadingPortsList || [];
  const destinationPortsList: FormOptionItem[] =
    internalDestinationPorts.length > 0
      ? internalDestinationPorts
      : destinationPorts || initialData?.destinationPorts || initialData?.destinationPortsList || [];
  const packingList: FormOptionItem[] =
    internalPackingOptions.length > 0
      ? internalPackingOptions
      : packingOptions || initialData?.packingList || initialData?.packing || [];
  const shippingTermsList: FormOptionItem[] =
    shippingTerms && shippingTerms.length > 0
      ? shippingTerms
      : initialData?.shippingTerms && initialData.shippingTerms.length > 0
      ? initialData.shippingTerms
      : initialData?.shippingTermsList && initialData.shippingTermsList.length > 0
      ? initialData.shippingTermsList
      : STATIC_SHIPPING_TERM_OPTIONS;
  const currenciesList: FormOptionItem[] =
    internalCurrencies.length > 0
      ? internalCurrencies
      : currencies || initialData?.currencies || initialData?.currenciesList || DEFAULT_CURRENCIES;
  const paymentTermsList: FormOptionItem[] =
    internalPaymentTerms.length > 0
      ? internalPaymentTerms
      : paymentTerms || initialData?.paymentTerms || initialData?.paymentTermsList || DEFAULT_PAYMENT_TERMS;

  // Handle Currency selection and resolve currency ID
  const handleCurrencyChange = (val: string) => {
    setCurrency(val);
    const found = currenciesList.find(
      (c) =>
        String(c.value).toUpperCase() === String(val).toUpperCase() ||
        String(c.code || '').toUpperCase() === String(val).toUpperCase() ||
        String(c.id) === String(val) ||
        String(c.raw?.id) === String(val)
    );
    if (found) {
      const cId = found.id || found.raw?.id || found.raw?._id || found.raw?.currency_id || found.value;
      if (cId) setCurrencyId(String(cId));
    }
  };

  // Auto-resolve currencyId once currenciesList is available if not set
  useEffect(() => {
    if (currency && currenciesList.length > 0 && !currencyId) {
      const found = currenciesList.find(
        (c) =>
          String(c.value).toUpperCase() === String(currency).toUpperCase() ||
          String(c.code || '').toUpperCase() === String(currency).toUpperCase() ||
          String(c.id) === String(currency) ||
          String(c.raw?.id) === String(currency)
      );
      if (found) {
        const cId = found.id || found.raw?.id || found.raw?._id || found.raw?.currency_id || found.value;
        if (cId) setCurrencyId(String(cId));
      }
    }
  }, [currency, currenciesList, currencyId]);

  // Handle Seller selection and auto-fill "Enter Seller Instruction" input
  const handleSellerChange = (val: string) => {
    setSellerId(val);
    setErrors((prev) => ({ ...prev, sellerId: '' }));

    const selected = sellersList.find((s) => s.value === val);
    if (selected) {
      const textToFill =
        selected.instructionText ||
        selected.subLabel ||
        selected.details ||
        selected.instruction ||
        '';
      if (textToFill) {
        setSellerInstruction(textToFill);
      }
    }
  };

  // Handle Buyer selection and auto-fill "Enter Buyer Instruction" input
  const handleBuyerChange = (val: string) => {
    setBuyerId(val);
    setErrors((prev) => ({ ...prev, buyerId: '' }));

    const selected = buyersList.find((b) => b.value === val);
    if (selected) {
      const textToFill =
        selected.instructionText ||
        selected.subLabel ||
        selected.details ||
        selected.instruction ||
        '';
      if (textToFill) {
        setBuyerInstruction(textToFill);
      }
    }
  };

  // Helper to fetch and populate product specific fields (HSN, Spec, Packing Types, Loading & Destination Ports)
  const fetchAndApplyProductDetails = useCallback(
    async (targetProdId: string) => {
      if (!targetProdId || !targetProdId.trim()) return;
      const cleanId = targetProdId.trim();

      // Check cache first
      if (productDetailsCacheRef.current[cleanId]) {
        const cached = productDetailsCacheRef.current[cleanId];
        if (cached.hsnCode || cached.hsn) {
          setHsnCode(normalizeHsnString(cached.hsnCode || cached.hsn));
        }
        if (cached.country) {
          setProductCountry(normalizeCountryString(cached.country));
        }
        if (cached.specification) {
          setSpecification(cached.specification);
        }
        if (cached.packingTypes && cached.packingTypes.length > 0) {
          setInternalPackingOptions(cached.packingTypes);
        } else {
          setInternalPackingOptions([]);
        }
        if (cached.loadingPorts && cached.loadingPorts.length > 0) {
          setInternalLoadingPorts(cached.loadingPorts);
        } else {
          setInternalLoadingPorts([]);
        }
        if (cached.destinationPorts && cached.destinationPorts.length > 0) {
          setInternalDestinationPorts(cached.destinationPorts);
        } else {
          setInternalDestinationPorts([]);
        }
        return;
      }

      setInternalPackingOptions([]);
      setInternalLoadingPorts([]);
      setInternalDestinationPorts([]);
      setIsLoadingProductDetails(true);
      try {
        const res = await getSmartDocsProductDetailsAction(cleanId, { lang });
        if (res.success && res.data) {
          const d = res.data;
          productDetailsCacheRef.current[cleanId] = d;

          if (d.hsnCode || d.hsn) {
            setHsnCode(normalizeHsnString(d.hsnCode || d.hsn));
          }
          if (d.country) {
            setProductCountry(normalizeCountryString(d.country));
          }
          if (d.specification) {
            setSpecification(d.specification);
          }
          if (d.packingTypes && d.packingTypes.length > 0) {
            setInternalPackingOptions(d.packingTypes);
          }
          if (d.loadingPorts && d.loadingPorts.length > 0) {
            setInternalLoadingPorts(d.loadingPorts);
          }
          if (d.destinationPorts && d.destinationPorts.length > 0) {
            setInternalDestinationPorts(d.destinationPorts);
          }
        }
      } catch (err) {
        console.error('[ConfirmationDocumentForm] Error fetching product details:', err);
      } finally {
        setIsLoadingProductDetails(false);
      }
    },
    [lang]
  );

  // Auto-fill HSN, Country & Specification when Product is selected, and trigger product details API
  const handleProductChange = (prodId: string) => {
    const isDifferent = String(prodId || '') !== String(productId || '');
    setProductId(prodId);
    setErrors((prev) => ({ ...prev, productId: '' }));

    if (isDifferent) {
      setLoadingPort('');
      setDestinationPort('');
      setPacking('');
      setInternalLoadingPorts([]);
      setInternalDestinationPorts([]);
      setInternalPackingOptions([]);
      setErrors((prev) => ({
        ...prev,
        loadingPort: '',
        destinationPort: '',
        packing: '',
      }));
    }

    const found = productsList.find(
      (p: any) =>
        String(p.value) === String(prodId) ||
        String(p.id) === String(prodId) ||
        String(p._id) === String(prodId) ||
        String(p.label) === String(prodId)
    );
    if (found) {
      const resolvedHsn =
        normalizeHsnString(found.hsn || found.hsn_code || found.hsn_sac_code) ||
        extractHsnCodeFromItem(found) ||
        extractHsnCodeFromItem(found.raw) ||
        extractHsnCodeFromItem(found.details) ||
        extractHsnCodeFromItem(found.product);

      const resolvedCountry = normalizeCountryString(
        found.country ||
        found.origin_country ||
        found.origin ||
        found.country_name ||
        (found.raw && (found.raw.country || found.raw.origin_country || found.raw.country_name)) ||
        (found.details && (found.details.country || found.details.origin_country))
      );

      const resolvedSpec =
        (typeof found.spec === 'string' && found.spec ? found.spec : '') ||
        (typeof found.specification === 'string' && found.specification ? found.specification : '') ||
        (typeof found.quality_specification === 'string' && found.quality_specification ? found.quality_specification : '') ||
        extractSpecificationFromItem(found) ||
        extractSpecificationFromItem(found.raw) ||
        extractSpecificationFromItem(found.details) ||
        extractSpecificationFromItem(found.product);

      if (resolvedHsn) setHsnCode(resolvedHsn);
      if (resolvedCountry) setProductCountry(resolvedCountry);
      if (resolvedSpec) setSpecification(resolvedSpec);

      const targetId = String(found.id || found._id || found.value || prodId);
      fetchAndApplyProductDetails(targetId);
    } else {
      setHsnCode('');
      setProductCountry('');
      setSpecification('');
      setInternalPackingOptions([]);
      setInternalLoadingPorts([]);
      setInternalDestinationPorts([]);
      if (prodId) {
        fetchAndApplyProductDetails(prodId);
      }
    }
  };

  // If initialData has sellerId / buyerId without instructions, auto-fill once lists are available
  useEffect(() => {
    if (sellerId && !sellerInstruction && sellersList.length > 0) {
      const found = sellersList.find((s) => s.value === sellerId);
      if (found) {
        const textToFill = found.instructionText || found.subLabel || found.details || found.instruction || '';
        if (textToFill) setSellerInstruction(textToFill);
      }
    }
  }, [sellerId, sellerInstruction, sellersList]);

  useEffect(() => {
    if (buyerId && !buyerInstruction && buyersList.length > 0) {
      const found = buyersList.find((b) => b.value === buyerId);
      if (found) {
        const textToFill = found.instructionText || found.subLabel || found.details || found.instruction || '';
        if (textToFill) setBuyerInstruction(textToFill);
      }
    }
  }, [buyerId, buyerInstruction, buyersList]);

  // If initialData or state has productId without hsnCode, productCountry, or specification, auto-fill once productsList is available
  useEffect(() => {
    if (productId && productsList.length > 0) {
      const found = productsList.find(
        (p: any) =>
          String(p.value) === String(productId) ||
          String(p.id) === String(productId) ||
          String(p._id) === String(productId) ||
          String(p.label) === String(productId)
      );
      if (found) {
        if (!hsnCode) {
          const h =
            normalizeHsnString(found.hsn || found.hsn_code || found.hsn_sac_code) ||
            extractHsnCodeFromItem(found) ||
            extractHsnCodeFromItem(found.raw) ||
            extractHsnCodeFromItem(found.details) ||
            extractHsnCodeFromItem(found.product);
          if (h) setHsnCode(h);
        }
        if (!productCountry) {
          const c = normalizeCountryString(
            found.country ||
            found.origin_country ||
            found.origin ||
            found.country_name ||
            (found.raw && (found.raw.country || found.raw.origin_country || found.raw.country_name)) ||
            (found.details && (found.details.country || found.details.origin_country))
          );
          if (c) setProductCountry(c);
        }
        if (!specification) {
          const s =
            (typeof found.spec === 'string' && found.spec ? found.spec : '') ||
            (typeof found.specification === 'string' && found.specification ? found.specification : '') ||
            (typeof found.quality_specification === 'string' && found.quality_specification ? found.quality_specification : '') ||
            extractSpecificationFromItem(found) ||
            extractSpecificationFromItem(found.raw) ||
            extractSpecificationFromItem(found.details) ||
            extractSpecificationFromItem(found.product);
          if (s) setSpecification(s);
        }
        const targetId = String(found.id || found._id || found.value || productId);
        if (!productDetailsCacheRef.current[targetId]) {
          fetchAndApplyProductDetails(targetId);
        }
      } else {
        if (!productDetailsCacheRef.current[productId]) {
          fetchAndApplyProductDetails(productId);
        }
      }
    }
  }, [productId, hsnCode, productCountry, specification, productsList, fetchAndApplyProductDetails]);

  // Synchronize with initialData if it updates (e.g. from async API load)
  useEffect(() => {
    if (!initialData) return;
    if (initialData.id !== undefined || initialData._id !== undefined) {
      setDraftId(String(initialData.id || initialData._id));
    }
    if (initialData.letterhead_space !== undefined) {
      setLetterhead(Boolean(initialData.letterhead_space));
    } else if (initialData.letterhead !== undefined) {
      setLetterhead(Boolean(initialData.letterhead));
    }
    if (initialData.is_watermark_enabled !== undefined) {
      setWatermark(Boolean(initialData.is_watermark_enabled));
    } else if (initialData.watermark !== undefined) {
      setWatermark(Boolean(initialData.watermark));
    }
    if (initialData.pdf_title !== undefined) {
      setDocumentTitle(initialData.pdf_title);
    } else if (initialData.pdfTitle !== undefined) {
      setDocumentTitle(initialData.pdfTitle);
    } else if (initialData.documentTitle !== undefined) {
      setDocumentTitle(initialData.documentTitle);
    } else if (initialData.title !== undefined) {
      setDocumentTitle(initialData.title);
    }
    if (initialData.confirmationNumber !== undefined) {
      setConfirmationNumber(initialData.confirmationNumber);
    } else if (initialData.confirmation_number !== undefined) {
      setConfirmationNumber(initialData.confirmation_number);
    }
    if (initialData.confirmationDate !== undefined) {
      setConfirmationDate(initialData.confirmationDate);
    } else if (initialData.confirmation_date !== undefined) {
      setConfirmationDate(initialData.confirmation_date);
    }
    if (initialData.sellerId !== undefined) {
      setSellerId(initialData.sellerId);
    } else if (initialData.seller_instruction_id !== undefined) {
      setSellerId(initialData.seller_instruction_id);
    }
    if (initialData.sellerInstruction !== undefined) {
      setSellerInstruction(initialData.sellerInstruction);
    } else if (initialData.seller_instruction !== undefined) {
      setSellerInstruction(initialData.seller_instruction);
    }
    if (initialData.buyerId !== undefined) {
      setBuyerId(initialData.buyerId);
    } else if (initialData.buyer_instruction_id !== undefined) {
      setBuyerId(initialData.buyer_instruction_id);
    }
    if (initialData.buyerInstruction !== undefined) {
      setBuyerInstruction(initialData.buyerInstruction);
    } else if (initialData.buyer_instruction !== undefined) {
      setBuyerInstruction(initialData.buyer_instruction);
    }
    if (initialData.productId !== undefined) {
      setProductId(initialData.productId);
    } else if (initialData.product_id !== undefined) {
      setProductId(initialData.product_id);
    }
    if (initialData.hsnCode !== undefined || initialData.hsn !== undefined) {
      setHsnCode(normalizeHsnString(initialData.hsnCode || initialData.hsn));
    }
    if (initialData.productCountry !== undefined || initialData.country !== undefined) {
      setProductCountry(normalizeCountryString(initialData.productCountry || initialData.country));
    }
    if (initialData.specification !== undefined) {
      setSpecification(initialData.specification);
    } else if (initialData.quality_specification !== undefined) {
      setSpecification(initialData.quality_specification);
    }
    if (initialData.shipBy !== undefined) {
      setShipBy(normalizeShipByForApi(initialData.shipBy));
    } else if (initialData.ship_by !== undefined) {
      setShipBy(normalizeShipByForApi(initialData.ship_by));
    }
    if (initialData.loadingPort !== undefined) {
      setLoadingPort(initialData.loadingPort);
    } else if (initialData.loading_port_id !== undefined) {
      setLoadingPort(initialData.loading_port_id);
    }
    if (initialData.destinationPort !== undefined) {
      setDestinationPort(initialData.destinationPort);
    } else if (initialData.destination_port_id !== undefined) {
      setDestinationPort(initialData.destination_port_id);
    }
    if (initialData.packing !== undefined) {
      setPacking(initialData.packing);
    } else if (initialData.packing_type_id !== undefined) {
      setPacking(initialData.packing_type_id);
    }
    if (initialData.shippingTerm !== undefined) {
      setShippingTerm(initialData.shippingTerm);
    } else if (initialData.shipping_term !== undefined) {
      setShippingTerm(initialData.shipping_term);
    } else if (initialData.incoterm !== undefined) {
      setShippingTerm(initialData.incoterm);
    }
    if (initialData.fclQty !== undefined) {
      setFclQty(initialData.fclQty);
    } else if (initialData.fcl_quantity !== undefined) {
      setFclQty(initialData.fcl_quantity);
    }
    if (initialData.fclCapacity !== undefined) {
      setFclCapacity(initialData.fclCapacity);
    } else if (initialData.fcl_capacity !== undefined) {
      setFclCapacity(initialData.fcl_capacity);
    }
    if (initialData.mtQty !== undefined) {
      setMtQty(initialData.mtQty);
    } else if (initialData.mt_quantity !== undefined) {
      setMtQty(initialData.mt_quantity);
    }
    if (initialData.bagQty !== undefined) {
      setBagQty(initialData.bagQty);
    } else if (initialData.bag_quantity !== undefined) {
      setBagQty(initialData.bag_quantity);
    }
    if (initialData.currency_id !== undefined || initialData.currencyId !== undefined) {
      setCurrencyId(String(initialData.currency_id || initialData.currencyId));
    }
    if (initialData.currency !== undefined && initialData.currency !== '') {
      setCurrency(String(initialData.currency).trim().toUpperCase());
    } else if (!currency) {
      setCurrency('USD');
    }
    if (initialData.price !== undefined) setPrice(initialData.price);
    if (initialData.totalValue !== undefined) {
      setTotalValue(initialData.totalValue);
    } else if (initialData.total_value !== undefined) {
      setTotalValue(initialData.total_value);
    }
    const rawStart = initialData.shipmentStartDate || initialData.shipment_start_date;
    const rawEnd = initialData.shipmentEndDate || initialData.shipment_end_date;
    if (rawStart || rawEnd) {
      setShipmentRange({
        start: rawStart ? new Date(rawStart) : null,
        end: rawEnd ? new Date(rawEnd) : null,
      });
    }
    if (initialData.shipmentPeriod !== undefined) setShipmentPeriod(initialData.shipmentPeriod);
    if (initialData.paymentTerm !== undefined) {
      setPaymentTerm(initialData.paymentTerm);
    } else if (initialData.payment_term_id !== undefined) {
      setPaymentTerm(initialData.payment_term_id);
    }
    if (initialData.notes !== undefined) setNotes(initialData.notes);
  }, [initialData]);

  // Real-time calculation for MT QTY, BAG QTY & TOTAL VALUE
  useEffect(() => {
    const selectedPackingObj = packingList.find((pk) => pk.value === packing);
    const bagKg = selectedPackingObj?.bagWeightKg || 50;
    const p = parseFloat(String(price)) || 0;

    if (isFcl) {
      // 20 FT / 40 FT Container mode: MT QTY is calculated as FCL QTY * FCL CAPACITY
      const fcl = parseFloat(String(fclQty)) || 0;
      const capacity = parseFloat(String(fclCapacity)) || 0;
      const calcMt = fcl * capacity;
      const nextMt = !fclQty && !fclCapacity ? '' : calcMt > 0 ? (calcMt % 1 === 0 ? calcMt.toString() : calcMt.toFixed(2)) : '0';

      if (String(mtQty) !== String(nextMt)) {
        setMtQty(nextMt);
      }

      const calcTotal = calcMt * p;

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
    } else {
      // Non-FCL mode (Vessel / Bulk): MT QTY is entered directly by the user
      const numMt = parseFloat(String(mtQty)) || 0;
      const calcTotal = numMt * p;

      if (!mtQty && !packing) {
        setBagQty('');
      } else if (bagKg > 0 && numMt > 0) {
        const calculatedBags = Math.round((numMt * 1000) / bagKg);
        setBagQty(calculatedBags.toLocaleString());
      } else {
        setBagQty(numMt > 0 ? '-' : '0');
      }

      if (!mtQty && !price) {
        setTotalValue('');
      } else {
        setTotalValue(
          calcTotal > 0
            ? calcTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0.00'
        );
      }
    }
  }, [isFcl, fclQty, fclCapacity, mtQty, price, packing, packingList]);

  // Form Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const confirmationNumberRequiredMsg =
      dict?.smart_docs?.confirmation_form?.confirmation_number_required ||
      'Confirmation number is required';
    if (!confirmationNumber.trim()) newErrors.confirmationNumber = confirmationNumberRequiredMsg;
    if (!confirmationDate.trim()) newErrors.confirmationDate = 'Confirmation date is required';
    if (!sellerId) newErrors.sellerId = 'Please select a seller';
    if (!buyerId) newErrors.buyerId = 'Please select a buyer';
    if (!productId) newErrors.productId = 'Please select a product';
    if (!shipBy) newErrors.shipBy = 'Please select shipping mode';
    if (!loadingPort) newErrors.loadingPort = 'Please select loading port';
    if (!destinationPort) newErrors.destinationPort = 'Please select destination port';
    if (!packing) newErrors.packing = 'Please select packing';
    if (!shippingTerm) newErrors.shippingTerm = 'Please select shipping term';
    if (isFcl) {
      if (!fclQty || Number(fclQty) <= 0) newErrors.fclQty = 'FCL quantity is required';
      if (!fclCapacity || Number(fclCapacity) <= 0) newErrors.fclCapacity = 'FCL capacity is required';
    } else {
      if (!mtQty || Number(mtQty) <= 0) newErrors.mtQty = 'Metric tons quantity is required';
    }
    if (!price || Number(price) <= 0) newErrors.price = 'Valid price is required';
    if (!paymentTerm) newErrors.paymentTerm = 'Please select payment term';
    if (!shipmentRange.start || !shipmentRange.end) {
      newErrors.shipmentPeriod = 'Please select shipment period';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      scrollToAndFocusField(newErrors);
      const firstError = Object.values(newErrors)[0];
      if (firstError) {
        toast.error(firstError);
      }
      return false;
    }
    return true;
  };

  // Helper to construct exact backend payload for Save Confirmation draft API
  // Only passes fields that have actually been entered/filled by the user to prevent backend validation errors
  const getConfirmationSavePayload = (): SaveConfirmationPayload => {
    const selectedSeller = sellersList.find(
      (s) => String(s.value) === String(sellerId) || String(s.id) === String(sellerId)
    );
    const selectedBuyer = buyersList.find(
      (b) => String(b.value) === String(buyerId) || String(b.id) === String(buyerId)
    );
    const selectedProduct = productsList.find(
      (p) => String(p.value) === String(productId) || String(p.id) === String(productId)
    );
    const selectedLoading = loadingPortsList.find(
      (p) => String(p.value) === String(loadingPort) || p.label === loadingPort || String(p.id) === String(loadingPort)
    );
    const selectedDest = destinationPortsList.find(
      (p) => String(p.value) === String(destinationPort) || p.label === destinationPort || String(p.id) === String(destinationPort)
    );
    const selectedPacking = packingList.find(
      (p) => String(p.value) === String(packing) || p.label === packing || String(p.id) === String(packing)
    );
    const selectedTerm = shippingTermsList.find(
      (t) => String(t.value) === String(shippingTerm) || t.label === shippingTerm
    );
    const selectedPay = paymentTermsList.find(
      (t) => String(t.value) === String(paymentTerm) || t.label === paymentTerm || String(t.id) === String(paymentTerm)
    );
    const selectedCurrency = currenciesList.find(
      (c) =>
        String(c.value).toUpperCase() === String(currency).toUpperCase() ||
        String(c.code || '').toUpperCase() === String(currency).toUpperCase() ||
        String(c.id) === String(currency) ||
        (currencyId && String(c.id) === String(currencyId))
    );

    const effectiveCurrencyId = (
      currencyId ||
      selectedCurrency?.id ||
      selectedCurrency?.raw?.id ||
      selectedCurrency?.raw?._id ||
      selectedCurrency?.raw?.currency_id ||
      selectedCurrency?.value ||
      currency ||
      ''
    ).toString().trim();

    const startDateStr = formatLocalDate(shipmentRange.start);
    const endDateStr = formatLocalDate(shipmentRange.end);

    const rawPayload: SaveConfirmationPayload = {};

    // ID if editing existing draft
    if (draftId && draftId.trim()) {
      rawPayload.id = draftId.trim();
    }

    // Confirmation Number & Date
    if (confirmationNumber && confirmationNumber.trim()) {
      rawPayload.confirmation_number = confirmationNumber.trim();
    }
    if (confirmationDate && confirmationDate.trim()) {
      rawPayload.confirmation_date = confirmationDate.trim();
    }
    if (documentTitle && documentTitle.trim()) {
      rawPayload.pdf_title = documentTitle.trim();
    }

    // Toggles
    rawPayload.is_watermark_enabled = Boolean(watermark);
    rawPayload.letterhead_space = Boolean(letterhead);

    // Parties
    const sellerInstId = (selectedSeller?.id || selectedSeller?.value || sellerId || '').toString().trim();
    if (sellerInstId) {
      rawPayload.seller_instruction_id = sellerInstId;
    }
    if (sellerInstruction && sellerInstruction.trim()) {
      rawPayload.seller_instruction = sellerInstruction.trim();
    }

    const buyerInstId = (selectedBuyer?.id || selectedBuyer?.value || buyerId || '').toString().trim();
    if (buyerInstId) {
      rawPayload.buyer_instruction_id = buyerInstId;
    }
    if (buyerInstruction && buyerInstruction.trim()) {
      rawPayload.buyer_instruction = buyerInstruction.trim();
    }

    // Product & Specs
    const cleanProductId = (productId || '').trim();
    if (cleanProductId) {
      rawPayload.product_id = cleanProductId;
    }
    const cleanProductName = (selectedProduct?.label || selectedProduct?.name || '').trim();
    if (cleanProductName) {
      rawPayload.product_name = cleanProductName;
    }
    if (specification && specification.trim()) {
      rawPayload.quality_specification = specification.trim();
    }

    // Logistics & Shipping
    const cleanShipBy = normalizeShipByForApi(shipBy);
    if (cleanShipBy) {
      rawPayload.ship_by = cleanShipBy;
    }

    const cleanLoading = (selectedLoading?.id || selectedLoading?.value || loadingPort || '').toString().trim();
    if (cleanLoading) {
      rawPayload.loading_port_id = cleanLoading;
    }

    const cleanDest = (selectedDest?.id || selectedDest?.value || destinationPort || '').toString().trim();
    if (cleanDest) {
      rawPayload.destination_port_id = cleanDest;
    }

    const cleanPack = (selectedPacking?.id || selectedPacking?.value || packing || '').toString().trim();
    if (cleanPack) {
      rawPayload.packing_type_id = cleanPack;
    }

    const cleanTerm = (selectedTerm?.value || selectedTerm?.label || shippingTerm || '').toString().trim();
    if (cleanTerm) {
      rawPayload.shipping_term = cleanTerm;
    }

    const cleanPay = (selectedPay?.id || selectedPay?.value || paymentTerm || '').toString().trim();
    if (cleanPay) {
      rawPayload.payment_term_id = cleanPay;
    }

    if (effectiveCurrencyId) {
      rawPayload.currency_id = effectiveCurrencyId;
    }

    // Quantities & Pricing
    if (isFcl) {
      if (fclQty !== undefined && fclQty !== null && String(fclQty).trim() !== '') {
        const parsedFclQty = parseInt(String(fclQty), 10);
        if (!isNaN(parsedFclQty) && parsedFclQty > 0) {
          rawPayload.fcl_quantity = parsedFclQty;
        }
      }
      if (fclCapacity !== undefined && fclCapacity !== null && String(fclCapacity).trim() !== '') {
        const cleanCap = String(fclCapacity).trim();
        if (cleanCap) {
          rawPayload.fcl_capacity = cleanCap;
        }
      }
    }

    if (mtQty !== undefined && mtQty !== null && String(mtQty).trim() !== '') {
      const parsedMt = parseFloat(String(mtQty));
      if (!isNaN(parsedMt) && parsedMt > 0) {
        rawPayload.mt_quantity = parsedMt;
      }
    }

    if (bagQty !== undefined && bagQty !== null && String(bagQty).trim() !== '') {
      const parsedBag = parseInt(String(bagQty || '').replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsedBag) && parsedBag > 0) {
        rawPayload.bag_quantity = parsedBag;
      }
    }

    if (price !== undefined && price !== null && String(price).trim() !== '') {
      const parsedPrice = parseFloat(String(price));
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        rawPayload.price = parsedPrice.toFixed(2);
      }
    }

    if (totalValue !== undefined && totalValue !== null && String(totalValue).trim() !== '') {
      const cleanTv = String(totalValue).replace(/,/g, '').trim();
      const parsedTv = parseFloat(cleanTv);
      if (!isNaN(parsedTv) && parsedTv > 0) {
        rawPayload.total_value = parsedTv.toFixed(2);
      }
    }

    // Shipment Dates
    if (startDateStr) {
      rawPayload.shipment_start_date = startDateStr;
    }
    if (endDateStr) {
      rawPayload.shipment_end_date = endDateStr;
    }

    // Notes: Only send if user has entered non-empty text content
    if (notes) {
      const strippedNotes = notes.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (strippedNotes.length > 0) {
        rawPayload.notes = notes.trim();
      }
    }

    return cleanConfirmationPayload(rawPayload) as SaveConfirmationPayload;
  };

  // Export current formData
  const getFormData = () => {
    const selectedSeller = sellersList.find((s) => s.value === sellerId);
    const selectedBuyer = buyersList.find((b) => b.value === buyerId);
    const selectedProduct = productsList.find((p) => p.value === productId);
    const selectedShipBy = shipByList.find((s) => s.value === shipBy);
    const selectedLoading = loadingPortsList.find((p) => p.value === loadingPort || p.label === loadingPort);
    const selectedDest = destinationPortsList.find((p) => p.value === destinationPort || p.label === destinationPort);
    const selectedPacking = packingList.find((p) => p.value === packing || p.label === packing);
    const selectedTerm = shippingTermsList.find((t) => t.value === shippingTerm);
    const selectedPay = paymentTermsList.find((t) => t.value === paymentTerm);

    return {
      id: draftId || undefined,
      letterhead,
      letterhead_space: letterhead,
      watermark,
      is_watermark_enabled: watermark,
      title: documentTitle,
      pdf_title: documentTitle,
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
      hsnCode: normalizeHsnString(hsnCode),
      country: normalizeCountryString(productCountry),
      specification,
      quality_specification: specification,
      shipBy: selectedShipBy?.label || shipBy || '',
      ship_by: normalizeShipByForApi(shipBy),
      loadingPort: selectedLoading?.label || loadingPort || '',
      loading_port_id: selectedLoading?.id || selectedLoading?.value || loadingPort || '',
      destinationPort: selectedDest?.label || destinationPort || '',
      destination_port_id: selectedDest?.id || selectedDest?.value || destinationPort || '',
      packing: selectedPacking?.label || packing || '',
      packing_type_id: selectedPacking?.id || selectedPacking?.value || packing || '',
      shippingTerm: selectedTerm?.label || shippingTerm || '',
      shipping_term: selectedTerm?.label || shippingTerm || '',
      fclQty: isFcl ? fclQty : '',
      fclCapacity: isFcl ? fclCapacity : '',
      mtQty,
      bagQty,
      currency,
      currency_id: currencyId,
      price,
      totalValue,
      shipmentStartDate: formatLocalDate(shipmentRange.start),
      shipmentEndDate: formatLocalDate(shipmentRange.end),
      shipmentPeriod,
      paymentTerm: selectedPay?.label || paymentTerm || '',
      payment_term: selectedPay?.label || paymentTerm || '',
      payment_term_id: selectedPay?.value || paymentTerm || '',
      paymentTermId: selectedPay?.value || paymentTerm || '',
      notes,
    };
  };

  // Save As Draft Action
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    setErrors({});
    try {
      const payload = getConfirmationSavePayload();

      let result: any = null;
      if (onSaveDraft) {
        result = await onSaveDraft(payload);
      } else {
        result = await saveConfirmationDraftAction(payload, lang);
      }

      if (!result) {
        toast.error('No response received while saving draft. Please retry.');
        return;
      }

      const hasFieldErrors = Boolean(
        (Array.isArray(result.error_fields) && result.error_fields.length > 0) ||
        (Array.isArray(result.errors) && result.errors.length > 0) ||
        (result.errors && typeof result.errors === 'object' && Object.keys(result.errors).length > 0) ||
        (result.error_fields && typeof result.error_fields === 'object' && Object.keys(result.error_fields).length > 0)
      );

      const isFailed = result.success === false || result.success === 0 || hasFieldErrors;

      if (isFailed) {
        const { fieldErrors, generalError } = parseBackendFieldErrors(result);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusField(fieldErrors);
        }
        if (generalError) {
          toast.error(generalError);
        } else if (Object.keys(fieldErrors).length === 0) {
          toast.error(result.message || result.error || 'Failed to save draft. Please check the fields.');
        }
        return;
      }

      // Backend returns the generated ID; preserve it in state so subsequent saves pass this id
      setErrors({});
      const savedId =
        result?.id ||
        result?.data?.id ||
        result?.data?._id ||
        result?.raw?.id ||
        result?.raw?.data?.id ||
        result?.data?.confirmation_id ||
        result?.confirmation_id;

      if (savedId) {
        setDraftId(String(savedId));
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (url.searchParams.get('id') !== String(savedId)) {
            url.searchParams.set('id', String(savedId));
            window.history.replaceState(null, '', url.toString());
          }
        }
      }

      const successText =
        result?.message ||
        dict?.smart_docs?.confirmation_form?.saved_as_draft_success ||
        'Confirmation saved as draft successfully!';
      toast.success(successText);
    } catch (err: any) {
      console.error('[ConfirmationDocumentForm] handleSaveDraft error:', err);
      const { fieldErrors, generalError } = parseBackendFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusField(fieldErrors);
      }
      if (generalError) {
        toast.error(generalError);
      } else if (Object.keys(fieldErrors).length === 0) {
        toast.error(err?.message || 'Failed to save draft. Please retry.');
      }
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit to Contract Action
  const handleSubmitContract = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const data = getFormData();
      if (onSubmitContract) {
        await onSubmitContract(data);
      }
      toast.success('Confirmation submitted successfully for Contract generation!');
    } catch (err: any) {
      const { fieldErrors, generalError } = parseBackendFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusField(fieldErrors);
      }
      if (generalError) {
        toast.error(generalError);
      } else if (Object.keys(fieldErrors).length === 0) {
        toast.error(err?.message || 'Failed to submit confirmation. Please retry.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl">

      {/* 
        Scrollable Table Viewport:
        - Fluid on mobile (no trapped inner scroll)
        - Locked internal scrolling on desktop
      */}
      <div className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-auto lg:overscroll-contain">
        {/* TOP BAR: Letterhead Toggle | CONFIRMATION Title | Watermark Toggle */}
        <div className="px-3 sm:px-4 py-2 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
          {/* Desktop Left: Letterhead Toggle */}
          <div className="hidden sm:flex items-center">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={setLetterhead}
              disabled={readOnly}
            />
          </div>

          {/* Center: Title (Directly Editable Field) + Dotted Accent Underline */}
          <div className="flex flex-col items-center justify-center group/title w-full sm:w-auto">
            <div className="inline-flex items-center justify-center gap-1.5 max-w-full">
              <input
                ref={titleInputRef}
                type="text"
                value={documentTitle}
                onChange={(e) => {
                  setDocumentTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, documentTitle: '' }));
                }}
                disabled={readOnly}
                placeholder={dict?.smart_docs?.confirmation_form?.confirmation_title || 'CONFIRMATION'}
                aria-label={dict?.smart_docs?.confirmation_form?.confirmation_title || 'Document Title'}
                style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                className="text-xs sm:text-sm md:text-[15px] font-extrabold uppercase tracking-widest text-foreground text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:bg-transparent rounded-sm px-1.5 py-0.5 w-auto min-w-[130px] max-w-[210px] sm:max-w-xs cursor-text transition-all"
              />
              {!readOnly && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => titleInputRef.current?.focus()}
                  title="Edit document title"
                  aria-label="Edit document title"
                  style={{ outline: 'none' }}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-primary hover:text-primary-hover hover:bg-primary/10 text-[10px] transition-colors cursor-pointer shrink-0 outline-none focus:outline-none"
                >
                  <i className="fa-solid fa-pen text-primary" />
                </button>
              )}
            </div>
            {/* Clean Underline - becomes solid and vibrant on focus */}
            <div
              className={`w-36 sm:w-56 md:w-64 border-b-2 ${
                errors.documentTitle
                  ? 'border-solid border-brand-red'
                  : 'border-dotted border-primary/70 group-focus-within/title:border-solid group-focus-within/title:border-primary'
              } mt-0.5 transition-all`}
            />
            {errors.documentTitle && (
              <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                <span>{errors.documentTitle}</span>
              </span>
            )}
          </div>

          {/* Desktop Right: Watermark Toggle */}
          <div className="hidden sm:flex items-center">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.watermark || 'Watermark'}
              checked={watermark}
              onChange={setWatermark}
              disabled={readOnly}
            />
          </div>

          {/* Mobile Bottom Row: Letterhead on left, Watermark on right */}
          <div className="flex sm:hidden items-center justify-between w-full pt-1.5 border-t border-border">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={setLetterhead}
              disabled={readOnly}
            />
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
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          {/* ROW 1: CONFIRMATION NUMBER | CONFIRMATION DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Confirmation Number */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="confirmationNumber">
              <label
                htmlFor="confirmation-number-input"
                className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5 pt-1.5"
              >
                {dict?.smart_docs?.confirmation_form?.confirmation_number || 'CONFIRMATION NUMBER'}{' '}
                <span className="text-brand-red font-bold">*</span> :
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  ref={confirmationInputRef}
                  id="confirmation-number-input"
                  value={confirmationNumber}
                  onChange={(val) => {
                    setConfirmationNumber(val);
                    if (val.trim()) {
                      setErrors((prev) => ({ ...prev, confirmationNumber: '' }));
                    } else if (errors.confirmationNumber) {
                      setErrors((prev) => ({
                        ...prev,
                        confirmationNumber:
                          dict?.smart_docs?.confirmation_form?.confirmation_number_required ||
                          'Confirmation number is required',
                      }));
                    }
                  }}
                  onBlur={() => {
                    if (!confirmationNumber.trim()) {
                      setErrors((prev) => ({
                        ...prev,
                        confirmationNumber:
                          dict?.smart_docs?.confirmation_form?.confirmation_number_required ||
                          'Confirmation number is required',
                      }));
                    }
                  }}
                  error={errors.confirmationNumber}
                  icon="fa-solid fa-pen"
                  disabled={readOnly}
                  placeholder="e.g. CN/26-27/00142"
                />
              </div>
            </div>

            {/* Confirmation Date */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="confirmationDate">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5 pt-1.5">
                {dict?.smart_docs?.confirmation_form?.confirmation_date || 'CONFIRMATION DATE'} :
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  id="field-confirmationDate"
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
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Exporter / Seller */}
            <div className="py-1.5 px-2.5 sm:px-3 flex flex-col gap-1.5" data-field="sellerId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.exporter_seller || 'EXPORTER (SELLER)'} :
              </label>
              <DocUnderlineSelect
                id="field-sellerId"
                options={sellersList}
                value={sellerId}
                onChange={handleSellerChange}
                placeholder={
                  isLoadingInstructions && sellersList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_seller || 'Select Seller'
                }
                loading={isLoadingInstructions && sellersList.length === 0}
                error={errors.sellerId}
                disabled={readOnly}
                showEditOption
                showAddNew
                addNewLabel={dict?.smart_docs?.confirmation_form?.add_new || 'Add New'}
              />
              <div data-field="sellerInstruction">
                <DocUnderlineInput
                  id="field-sellerInstruction"
                  multiline
                  rows={2}
                  className="mt-0.5"
                  value={sellerInstruction}
                  onChange={(val) => {
                    setSellerInstruction(val);
                    setErrors((prev) => ({ ...prev, sellerInstruction: '' }));
                  }}
                  error={errors.sellerInstruction}
                  placeholder={
                    dict?.smart_docs?.confirmation_form?.enter_seller_instruction ||
                    'Enter Seller Instruction'
                  }
                  icon="fa-solid fa-pen"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Importer / Buyer */}
            <div className="py-1.5 px-2.5 sm:px-3 flex flex-col gap-1.5" data-field="buyerId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.importer_buyer || 'IMPORTER (BUYER)'} :
              </label>
              <DocUnderlineSelect
                id="field-buyerId"
                options={buyersList}
                value={buyerId}
                onChange={handleBuyerChange}
                placeholder={
                  isLoadingInstructions && buyersList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_buyer || 'Select Buyer'
                }
                loading={isLoadingInstructions && buyersList.length === 0}
                error={errors.buyerId}
                disabled={readOnly}
                showEditOption
                showAddNew
                addNewLabel={dict?.smart_docs?.confirmation_form?.add_new || 'Add New'}
              />
              <div data-field="buyerInstruction">
                <DocUnderlineInput
                  id="field-buyerInstruction"
                  multiline
                  rows={2}
                  className="mt-0.5"
                  value={buyerInstruction}
                  onChange={(val) => {
                    setBuyerInstruction(val);
                    setErrors((prev) => ({ ...prev, buyerInstruction: '' }));
                  }}
                  error={errors.buyerInstruction}
                  placeholder={
                    dict?.smart_docs?.confirmation_form?.enter_buyer_instruction ||
                    'Enter Buyer Instruction'
                  }
                  icon="fa-solid fa-pen"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* ROW 3: PRODUCT | HSN CODE | COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="productId">
            {/* Product Label */}
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center min-w-0">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.product || 'PRODUCT'} :
              </label>
            </div>
            {/* Product Select */}
            <div className="md:col-span-5 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-w-0">
              <DocUnderlineSelect
                id="field-productId"
                options={productsList}
                value={productId}
                onChange={handleProductChange}
                placeholder={
                  isLoadingProducts && productsList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_product || 'Select Product'
                }
                searchable={true}
                searchPlaceholder={
                  dict?.smart_docs?.confirmation_form?.search_product || 'Search product...'
                }
                loading={isLoadingProducts && productsList.length === 0}
                error={errors.productId}
                disabled={readOnly}
                showEditOption={!readOnly}
                onEditOption={(opt, e) => {
                  e.stopPropagation();
                  handleEditProduct(opt);
                }}
                showAddNew={!readOnly}
                addNewLabel={
                  dict?.smart_docs?.confirmation_form?.add_product ||
                  dict?.smart_docs?.confirmation_form?.add_new ||
                  'Add Product'
                }
                onAddNew={handleAddNewProduct}
              />
            </div>
            {/* Mobile: HSN and Country side-by-side row / Desktop: col-span-2 each */}
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border md:border-t-0 md:col-span-4 md:grid-cols-2 md:divide-x">
              {/* HSN CODE */}
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  {dict?.smart_docs?.confirmation_form?.hsn_code || 'HSN CODE'} :
                </span>
                <span
                  className="text-[13px] font-semibold text-foreground truncate min-w-0 mt-0.5 leading-snug"
                  title={normalizeHsnString(hsnCode) || '-'}
                >
                  {isLoadingProductDetails && !hsnCode ? (
                    <span className="inline-flex items-center gap-1 text-primary text-[11px]">
                      <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />
                      <span>Loading...</span>
                    </span>
                  ) : (
                    normalizeHsnString(hsnCode) || '-'
                  )}
                </span>
              </div>
              {/* COUNTRY */}
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  {dict?.smart_docs?.confirmation_form?.country || 'COUNTRY'} :
                </span>
                <span
                  className="text-[13px] font-semibold text-foreground truncate min-w-0 mt-0.5 leading-snug"
                  title={normalizeCountryString(productCountry) || '-'}
                >
                  {isLoadingProductDetails && !productCountry ? (
                    <span className="inline-flex items-center gap-1 text-primary text-[11px]">
                      <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />
                      <span>Loading...</span>
                    </span>
                  ) : (
                    normalizeCountryString(productCountry) || '-'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* ROW 4: SPECIFICATION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="specification">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-start pt-2 sm:pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.specification || 'SPECIFICATION'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-specification"
                multiline
                rows={2}
                value={specification}
                onChange={(val) => {
                  setSpecification(val);
                  setErrors((prev) => ({ ...prev, specification: '' }));
                }}
                error={errors.specification}
                placeholder={
                  isLoadingProductDetails && !specification
                    ? 'Loading specifications...'
                    : (dict?.smart_docs?.confirmation_form?.enter_specification ||
                      'Enter product specifications...')
                }
                disabled={readOnly}
                icon="fa-solid fa-pen"
              />
            </div>
          </div>

          {/* ROW 5: SHIP BY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shipBy">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.ship_by || 'SHIP BY'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-shipBy"
                options={shipByList}
                value={shipBy}
                onChange={handleShipByChange}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.select_ship_by || 'Select Ship By'
                }
                searchable={true}
                allowCustom={true}
                error={errors.shipBy}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 6: LOADING PORT & COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="loadingPort">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.loading_port_country ||
                  'LOADING PORT & COUNTRY'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-loadingPort"
                options={isProductSelected ? loadingPortsList : []}
                value={isProductSelected ? loadingPort : ''}
                onChange={(val) => {
                  setLoadingPort(val);
                  setErrors((prev) => ({ ...prev, loadingPort: '' }));
                }}
                placeholder={
                  !isProductSelected
                    ? dict?.smart_docs?.confirmation_form?.select_product_first ||
                      'Select Product first'
                    : isLoadingProductDetails && loadingPortsList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_loading_port ||
                      'Select Loading Port'
                }
                loading={isProductSelected && isLoadingProductDetails && loadingPortsList.length === 0}
                searchable={true}
                error={errors.loadingPort}
                disabled={readOnly || !isProductSelected}
              />
            </div>
          </div>

          {/* ROW 7: DESTINATION PORT & COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="destinationPort">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.destination_port_country ||
                  'DESTINATION PORT & COUNTRY'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-destinationPort"
                options={isProductSelected ? destinationPortsList : []}
                value={isProductSelected ? destinationPort : ''}
                onChange={(val) => {
                  setDestinationPort(val);
                  setErrors((prev) => ({ ...prev, destinationPort: '' }));
                }}
                placeholder={
                  !isProductSelected
                    ? dict?.smart_docs?.confirmation_form?.select_product_first ||
                      'Select Product first'
                    : isLoadingProductDetails && destinationPortsList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_destination_port ||
                      'Select Destination Port & Country'
                }
                loading={isProductSelected && isLoadingProductDetails && destinationPortsList.length === 0}
                searchable={true}
                error={errors.destinationPort}
                disabled={readOnly || !isProductSelected}
              />
            </div>
          </div>

          {/* ROW 8: PACKING */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="packing">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.packing || 'PACKING'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-packing"
                options={isProductSelected ? packingList : []}
                value={isProductSelected ? packing : ''}
                onChange={(val) => {
                  setPacking(val);
                  setErrors((prev) => ({ ...prev, packing: '' }));
                }}
                placeholder={
                  !isProductSelected
                    ? dict?.smart_docs?.confirmation_form?.select_product_first ||
                      'Select Product first'
                    : isLoadingProductDetails && packingList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_packing_type ||
                      'Select Packing Type'
                }
                loading={isProductSelected && isLoadingProductDetails && packingList.length === 0}
                searchable={true}
                allowCustom={true}
                error={errors.packing}
                disabled={readOnly || !isProductSelected}
              />
            </div>
          </div>

          {/* ROW 9: SHIPPING TERM */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shippingTerm">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipping_term || 'SHIPPING TERM'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-shippingTerm"
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
                searchable={true}
                error={errors.shippingTerm}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 10: QUANTITIES & PRICING MATRIX */}
          {isFcl ? (
            /* 7-Column Layout when Ship By is 20 FT or 40 FT (FCL Mode) */
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-collapse text-center">
              {/* FCL QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="fclQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.fcl_qty || 'FCL QTY'}
                </span>
                <div className="w-full max-w-[90px]">
                  <DocUnderlineInput
                    id="field-fclQty"
                    type="number"
                    value={fclQty}
                    onChange={(val) => {
                      setFclQty(val);
                      setErrors((prev) => ({ ...prev, fclQty: '' }));
                    }}
                    error={errors.fclQty}
                    placeholder="0"
                    icon="fa-solid fa-pen"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* FCL CAPACITY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="fclCapacity">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.fcl_capacity || 'FCL CAPACITY'}
                </span>
                <div className="w-full max-w-[90px]">
                  <DocUnderlineInput
                    id="field-fclCapacity"
                    type="number"
                    value={fclCapacity}
                    onChange={(val) => {
                      setFclCapacity(val);
                      setErrors((prev) => ({ ...prev, fclCapacity: '' }));
                    }}
                    error={errors.fclCapacity}
                    placeholder="0"
                    icon="fa-solid fa-pen"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* MT QTY (Computed in FCL Mode) */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="mtQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.mt_qty || 'MT QTY'}
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {mtQty || '-'}
                </span>
                {errors.mtQty && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center">
                    {errors.mtQty}
                  </span>
                )}
              </div>

              {/* BAG QTY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="bagQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.bag_qty || 'BAG QTY'}
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {bagQty || '-'}
                </span>
                {errors.bagQty && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center">
                    {errors.bagQty}
                  </span>
                )}
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b-0 lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="currency">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.currency || 'CURRENCY'}
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineSelect
                    id="field-currency"
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
                  />
                </div>
              </div>

              {/* PRICE */}
              <div className="p-1.5 sm:p-2 border-b sm:border-r sm:border-b-0 lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center" data-field="price">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.price || 'PRICE'}
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-price"
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
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center" data-field="totalValue">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.total_value || 'TOTAL VALUE'}
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {totalValue || '-'}
                </span>
                {errors.totalValue && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center">
                    {errors.totalValue}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* 5-Column Layout when Ship By is Vessel / Non-FCL (FCL QTY & FCL CAPACITY are hidden) */
            <div className="grid grid-cols-2 sm:grid-cols-5 border-collapse text-center">
              {/* MT QTY (Direct user input in Vessel / Non-FCL Mode) */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center" data-field="mtQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.mt_qty || 'MT QTY'}
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-mtQty"
                    type="number"
                    value={mtQty}
                    onChange={(val) => {
                      setMtQty(val);
                      setErrors((prev) => ({ ...prev, mtQty: '' }));
                    }}
                    error={errors.mtQty}
                    placeholder="0.00"
                    icon="fa-solid fa-pen"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* BAG QTY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center" data-field="bagQty">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.bag_qty || 'BAG QTY'}
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {bagQty || '-'}
                </span>
                {errors.bagQty && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center">
                    {errors.bagQty}
                  </span>
                )}
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center" data-field="currency">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.currency || 'CURRENCY'}
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineSelect
                    id="field-currency"
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
                  />
                </div>
              </div>

              {/* PRICE */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center" data-field="price">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.price || 'PRICE'}
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-price"
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
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-1 flex flex-col items-center justify-center" data-field="totalValue">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  {dict?.smart_docs?.confirmation_form?.total_value || 'TOTAL VALUE'}
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {totalValue || '-'}
                </span>
                {errors.totalValue && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center">
                    {errors.totalValue}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ROW 11: SHIPMENT PERIOD */}
          <div
            id="field-shipmentPeriod"
            data-field="shipmentPeriod"
            className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border"
          >
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipment_period || 'SHIPMENT PERIOD'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col items-start justify-center">
              <DateRangePicker
                id="shipment-period-picker"
                variant="underline"
                startDate={shipmentRange.start}
                endDate={shipmentRange.end}
                onChange={(start, end) => {
                  setShipmentRange({ start, end });
                  setErrors((prev) => ({ ...prev, shipmentPeriod: '' }));
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
                error={errors.shipmentPeriod}
              />
            </div>
          </div>

          {/* ROW 12: PAYMENT TERM */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="paymentTerm">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.payment_term || 'PAYMENT TERM'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-paymentTerm"
                options={paymentTermsList}
                value={paymentTerm}
                onChange={(val) => {
                  setPaymentTerm(val);
                  setErrors((prev) => ({ ...prev, paymentTerm: '' }));
                }}
                placeholder={
                  isLoadingPaymentTerms && paymentTermsList.length === 0
                    ? dict?.common?.loading || 'Loading...'
                    : dict?.smart_docs?.confirmation_form?.select_payment_term ||
                      'Select Payment Term'
                }
                searchable={true}
                searchPlaceholder={
                  dict?.smart_docs?.confirmation_form?.search_payment_term ||
                  'Search payment term...'
                }
                loading={isLoadingPaymentTerms && paymentTermsList.length === 0}
                error={errors.paymentTerm}
                disabled={readOnly}
                showEditOption={!readOnly}
                onEditOption={(opt, e) => {
                  e.stopPropagation();
                  handleEditPaymentTerm(opt);
                }}
                showAddNew={!readOnly}
                addNewLabel={
                  dict?.smart_docs?.confirmation_form?.add_payment_term ||
                  'Add Payment Term'
                }
                onAddNew={() => handleAddNewPaymentTerm()}
                allowCustom={true}
              />
            </div>
          </div>

          {/* ROW 13: NOTES */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="notes">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-start pt-2 sm:pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.notes || 'NOTES'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3">
              <DocNotesEditor
                id="field-notes"
                value={notes}
                onChange={(val) => {
                  setNotes(val);
                  setErrors((prev) => ({ ...prev, notes: '' }));
                }}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.write_description ||
                  'Write your description...'
                }
                disabled={readOnly}
              />
              {errors.notes && (
                <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                  <span>{errors.notes}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 
        BOTTOM ACTION BAR:
        Theme-compliant buttons matching AgriGuru brand system.
        Sticky on mobile docked at viewport bottom, static on desktop at bottom of card.
      */}
      <div className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl">
        {/* Left Action Buttons: Print Preview & Download PDF (Disabled for future implementation) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button (Disabled) */}
          <button
            type="button"
            disabled
            title={dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 text-destructive opacity-60 cursor-not-allowed select-none shadow-xs transition-all"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>{dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}</span>
          </button>

          {/* Download PDF Button (Disabled) */}
          <button
            type="button"
            disabled
            title={dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 text-destructive opacity-60 cursor-not-allowed select-none shadow-xs transition-all"
          >
            <i className="fa-solid fa-file-pdf text-xs" />
            <span>{dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}</span>
          </button>
        </div>

        {/* Right Action Buttons: Save As Draft & Submit To Contract */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Save As Draft */}
          <button
            type="button"
            disabled={isSavingDraft || readOnly}
            onClick={handleSaveDraft}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-md text-xs font-semibold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary active:scale-[0.98] transition-all duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
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

          {/* Submit To Contract */}
          <button
            type="button"
            disabled={isSubmitting || readOnly}
            onClick={handleSubmitContract}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group"
          >
            <span className="truncate">
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

      {/* Product Add / Edit Modal */}
      <ProductManageModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        mode={productModalMode}
        product={editingProduct}
        onSave={handleSaveProduct}
        dict={dict}
      />

      {/* Payment Term Add / Edit Modal */}
      <PaymentTermManageModal
        isOpen={isPaymentTermModalOpen}
        onClose={() => setIsPaymentTermModalOpen(false)}
        mode={paymentTermModalMode}
        paymentTerm={editingPaymentTerm}
        onSave={handleSavePaymentTerm}
        dict={dict}
      />
    </div>
  );
}

export default ConfirmationDocumentForm;
