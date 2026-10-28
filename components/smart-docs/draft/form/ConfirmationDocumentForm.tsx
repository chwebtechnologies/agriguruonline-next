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
  getStepperListAction,
  getConfirmationAction,
} from '@/app/actions/smart-docs';
import {
  extractHsnCodeFromItem,
  extractSpecificationFromItem,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_CURRENCIES,
  cleanConfirmationPayload,
  normalizeCurrencyCode,
  normalizeCurrencyOption,
  getCurrencySymbol,
  parsePackingBagWeightKg,
  type SaveConfirmationPayload,
  type StepperDocumentItem,
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
 * Safely extracts a clean scalar ID string (e.g. "cmvr...").
 * Guarantees never returning "[object Object]", null, undefined, or an object.
 */
export function toCleanId(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') return isNaN(val) ? '' : String(val);
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t || t === '[object Object]' || t === 'undefined' || t === 'null') return '';
    return t;
  }
  if (typeof val === 'object') {
    if (val.$oid) return toCleanId(val.$oid);
    if (val.id !== undefined && val.id !== null) return toCleanId(val.id);
    if (val._id !== undefined && val._id !== null) return toCleanId(val._id);
    if (val.value !== undefined && val.value !== null) return toCleanId(val.value);
    if (val.code !== undefined && val.code !== null) return toCleanId(val.code);
    if (val.loading_port_id !== undefined && val.loading_port_id !== null) return toCleanId(val.loading_port_id);
    if (val.destination_port_id !== undefined && val.destination_port_id !== null) return toCleanId(val.destination_port_id);
    if (val.packing_type_id !== undefined && val.packing_type_id !== null) return toCleanId(val.packing_type_id);
    if (val.currency_id !== undefined && val.currency_id !== null) return toCleanId(val.currency_id);
    if (val.payment_term_id !== undefined && val.payment_term_id !== null) return toCleanId(val.payment_term_id);
    if (val.seller_instruction_id !== undefined && val.seller_instruction_id !== null) return toCleanId(val.seller_instruction_id);
    if (val.buyer_instruction_id !== undefined && val.buyer_instruction_id !== null) return toCleanId(val.buyer_instruction_id);
    if (val.product_id !== undefined && val.product_id !== null) return toCleanId(val.product_id);
  }
  return '';
}

/**
 * Safely extracts a clean human-readable display label.
 * Guarantees never returning "[object Object]" or raw stringified object.
 */
export function toCleanLabel(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t || t === '[object Object]' || t === 'undefined' || t === 'null') return '';
    return t;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const candidates = [
      val.label,
      val.port_name,
      val.portName,
      val.packing_type,
      val.packingType,
      val.currency,
      val.currency_name,
      val.currencyName,
      val.code,
      val.name,
      val.company_name,
      val.companyName,
      val.title,
      val.value,
      val.instructionText,
      val.instruction,
      val.details,
      val.description,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'string') {
        const tr = c.trim();
        if (tr && tr !== '[object Object]' && tr !== 'undefined' && tr !== 'null') {
          return tr;
        }
      }
    }
  }
  return '';
}

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
 * Deduplicates repeated phrases or clauses within validation strings.
 * Prevents repetitive errors like "Confirmation number is required, Confirmation number is required".
 */
export function deduplicateValidationMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  const trimmed = msg.trim();
  if (!trimmed) return '';

  // Split on commas, semicolons, newlines, or sentence-ending periods with space
  const parts = trimmed
    .split(/(?:,|\n|;|\.\s+)+/)
    .map((p) => p.trim().replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

  if (parts.length <= 1) {
    return trimmed;
  }

  const seen = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    // Normalize comparison string (lowercase, remove redundant punctuation and multiple spaces)
    const normalized = part
      .toLowerCase()
      .replace(/[.,;:!?]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueParts.push(part);
    }
  }

  if (uniqueParts.length === 0) return trimmed;
  return uniqueParts.join(', ');
}

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
  const fieldLabelReplacements: [RegExp, string][] = [
    [/\bshipment_start_date\b/gi, 'Shipment start date'],
    [/\bshipment_end_date\b/gi, 'Shipment end date'],
    [/\bshipment_period\b/gi, 'Shipment period'],
    [/\bconfirmation_number\b/gi, 'Confirmation number'],
    [/\bconfirmation_date\b/gi, 'Confirmation date'],
    [/\bseller_instruction_id\b/gi, 'Exporter (Seller)'],
    [/\bseller_instruction\b/gi, 'Seller instruction'],
    [/\bseller_id\b/gi, 'Exporter (Seller)'],
    [/\bbuyer_instruction_id\b/gi, 'Importer (Buyer)'],
    [/\bbuyer_instruction\b/gi, 'Buyer instruction'],
    [/\bbuyer_id\b/gi, 'Importer (Buyer)'],
    [/\bproduct_id\b/gi, 'Product'],
    [/\bproduct_name\b/gi, 'Product'],
    [/\bhsn_code\b/gi, 'HSN code'],
    [/\bproduct_country\b/gi, 'Country of origin'],
    [/\bquality_specification\b/gi, 'Specification'],
    [/\bship_by\b/gi, 'Shipping mode'],
    [/\bshipping_mode\b/gi, 'Shipping mode'],
    [/\bloading_port_id\b/gi, 'Loading port'],
    [/\bloading_port\b/gi, 'Loading port'],
    [/\bdestination_port_id\b/gi, 'Destination port'],
    [/\bdestination_port\b/gi, 'Destination port'],
    [/\bpacking_type_id\b/gi, 'Packing'],
    [/\bpacking_type\b/gi, 'Packing'],
    [/\bshipping_term\b/gi, 'Shipping term'],
    [/\bdelivery_term\b/gi, 'Shipping term'],
    [/\bfcl_quantity\b/gi, 'FCL quantity'],
    [/\bfcl_capacity\b/gi, 'FCL capacity'],
    [/\bmt_quantity\b/gi, 'MT quantity'],
    [/\bbag_quantity\b/gi, 'Bag quantity'],
    [/\bcurrency_id\b/gi, 'Currency'],
    [/\bpayment_term_id\b/gi, 'Payment term'],
    [/\bpayment_term\b/gi, 'Payment term'],
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
  const formatted = msg.charAt(0).toUpperCase() + msg.slice(1);
  return deduplicateValidationMessage(formatted);
}

/**
 * Detects which form field an error message or identifier belongs to.
 * Supports snake_case, spaced text, and lowercase camelCase matching.
 */
export function detectFieldInSentence(text: string): { key: string; rawField: string } | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  const normalized = lower.replace(/[-_.]/g, ' ');

  // 1. Shipment Dates / Period
  if (
    normalized.includes('shipment start') ||
    normalized.includes('shipment end') ||
    normalized.includes('shipment period') ||
    normalized.includes('shipment date') ||
    lower.includes('shipmentstart') ||
    lower.includes('shipmentend') ||
    lower.includes('shipmentperiod') ||
    lower.includes('shipmentdate')
  ) {
    return { key: 'shipmentPeriod', rawField: 'shipment_start_date' };
  }

  // 2. Confirmation Number
  if (
    normalized.includes('confirmation number') ||
    normalized.includes('confirm number') ||
    normalized.includes('confirmation no') ||
    normalized.includes('confirm no') ||
    lower.includes('confirmationnumber') ||
    lower.includes('confirmno')
  ) {
    return { key: 'confirmationNumber', rawField: 'confirmation_number' };
  }

  // 3. Confirmation Date
  if (
    normalized.includes('confirmation date') ||
    normalized.includes('confirm date') ||
    lower.includes('confirmationdate')
  ) {
    return { key: 'confirmationDate', rawField: 'confirmation_date' };
  }

  // 4. Exporter / Seller instruction & seller ID
  if (
    normalized.includes('seller instruction id') ||
    normalized.includes('seller id') ||
    lower.includes('sellerid') ||
    normalized.includes('exporter')
  ) {
    return { key: 'sellerId', rawField: 'seller_instruction_id' };
  }
  if (normalized.includes('seller instruction') || lower.includes('sellerinstruction')) {
    return { key: 'sellerInstruction', rawField: 'seller_instruction' };
  }
  if (normalized.includes('seller')) {
    return { key: 'sellerId', rawField: 'seller_instruction_id' };
  }

  // 5. Importer / Buyer instruction & buyer ID
  if (
    normalized.includes('buyer instruction id') ||
    normalized.includes('buyer id') ||
    lower.includes('buyerid') ||
    normalized.includes('importer')
  ) {
    return { key: 'buyerId', rawField: 'buyer_instruction_id' };
  }
  if (normalized.includes('buyer instruction') || lower.includes('buyerinstruction')) {
    return { key: 'buyerInstruction', rawField: 'buyer_instruction' };
  }
  if (normalized.includes('buyer')) {
    return { key: 'buyerId', rawField: 'buyer_instruction_id' };
  }

  // 6. Product
  if (
    normalized.includes('product id') ||
    normalized.includes('product name') ||
    lower.includes('productid') ||
    lower.includes('productname') ||
    normalized.includes('product')
  ) {
    return { key: 'productId', rawField: 'product_id' };
  }

  // 7. HSN Code
  if (normalized.includes('hsn') || lower.includes('hsncode')) {
    return { key: 'hsnCode', rawField: 'hsn_code' };
  }

  // 8. Quality Specification
  if (
    normalized.includes('quality specification') ||
    normalized.includes('specification') ||
    lower.includes('qualityspecification') ||
    normalized.includes('quality spec') ||
    lower.includes('spec')
  ) {
    return { key: 'specification', rawField: 'quality_specification' };
  }

  // 9. Shipping Mode (Ship By)
  if (
    normalized.includes('ship by') ||
    normalized.includes('shipping mode') ||
    normalized.includes('shipping method') ||
    lower.includes('shipby') ||
    lower.includes('shippingmode')
  ) {
    return { key: 'shipBy', rawField: 'ship_by' };
  }

  // 10. Loading Port
  if (
    normalized.includes('loading port') ||
    normalized.includes('port of loading') ||
    lower.includes('loadingport') ||
    normalized.includes(' pol ') ||
    normalized.endsWith(' pol') ||
    normalized.startsWith('pol ')
  ) {
    return { key: 'loadingPort', rawField: 'loading_port_id' };
  }

  // 11. Destination Port
  if (
    normalized.includes('destination port') ||
    normalized.includes('port of destination') ||
    normalized.includes('port of discharge') ||
    lower.includes('destinationport') ||
    normalized.includes(' pod ') ||
    normalized.endsWith(' pod') ||
    normalized.startsWith('pod ')
  ) {
    return { key: 'destinationPort', rawField: 'destination_port_id' };
  }

  // 12. Packing
  if (
    normalized.includes('packing type') ||
    normalized.includes('package type') ||
    normalized.includes('packaging') ||
    normalized.includes('packing') ||
    lower.includes('packingtype')
  ) {
    return { key: 'packing', rawField: 'packing_type_id' };
  }

  // 13. Shipping Term
  if (
    normalized.includes('shipping term') ||
    normalized.includes('delivery term') ||
    normalized.includes('incoterm') ||
    lower.includes('shippingterm')
  ) {
    return { key: 'shippingTerm', rawField: 'shipping_term' };
  }

  // 14. Payment Term
  if (
    normalized.includes('payment term') ||
    normalized.includes('payment method') ||
    lower.includes('paymentterm')
  ) {
    return { key: 'paymentTerm', rawField: 'payment_term_id' };
  }

  // 15. FCL Quantity
  if (
    normalized.includes('fcl quantity') ||
    normalized.includes('fcl qty') ||
    lower.includes('fclquantity') ||
    lower.includes('fclqty') ||
    normalized.includes('container quantity')
  ) {
    return { key: 'fclQty', rawField: 'fcl_quantity' };
  }

  // 16. FCL Capacity
  if (
    normalized.includes('fcl capacity') ||
    normalized.includes('fcl cap') ||
    lower.includes('fclcapacity') ||
    lower.includes('fclcap')
  ) {
    return { key: 'fclCapacity', rawField: 'fcl_capacity' };
  }

  // 17. MT Quantity
  if (
    normalized.includes('mt quantity') ||
    normalized.includes('mt qty') ||
    normalized.includes('metric tons') ||
    normalized.includes('metric ton') ||
    lower.includes('mtquantity') ||
    lower.includes('mtqty')
  ) {
    return { key: 'mtQty', rawField: 'mt_quantity' };
  }

  // 18. Bag Quantity
  if (
    normalized.includes('bag quantity') ||
    normalized.includes('bag qty') ||
    lower.includes('bagquantity') ||
    lower.includes('bagqty') ||
    normalized.includes('bags')
  ) {
    return { key: 'bagQty', rawField: 'bag_quantity' };
  }

  // 19. Currency
  if (
    normalized.includes('currency id') ||
    normalized.includes('currency code') ||
    lower.includes('currencyid') ||
    normalized.includes('currency')
  ) {
    return { key: 'currency', rawField: 'currency_id' };
  }

  // 20. Unit Price
  if (
    normalized.includes('unit price') ||
    normalized.includes('price') ||
    lower.includes('unitprice')
  ) {
    return { key: 'price', rawField: 'price' };
  }

  // 21. Total Value
  if (
    normalized.includes('total value') ||
    normalized.includes('total amount') ||
    lower.includes('totalvalue') ||
    lower.includes('totalamount')
  ) {
    return { key: 'totalValue', rawField: 'total_value' };
  }

  // 22. Notes
  if (
    normalized.includes('notes') ||
    normalized.includes('remarks') ||
    normalized.includes('remark')
  ) {
    return { key: 'notes', rawField: 'notes' };
  }

  // 23. Document Title
  if (
    normalized.includes('pdf title') ||
    normalized.includes('document title') ||
    lower.includes('pdftitle') ||
    lower.includes('documenttitle')
  ) {
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
 * Automatically humanizes all technical field names and error messages, and deduplicates repeated phrases.
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
      case 'productname':
        return 'productId';
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
      case 'shippingmethod':
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
      case 'packagetypeid':
      case 'packagetype':
      case 'packaging':
        return 'packing';
      case 'shippingterm':
      case 'deliveryterm':
      case 'incoterm':
        return 'shippingTerm';
      case 'fclquantity':
      case 'fclqty':
      case 'containerquantity':
      case 'containers':
        return 'fclQty';
      case 'fclcapacity':
      case 'fclcap':
      case 'containercapacity':
        return 'fclCapacity';
      case 'mtquantity':
      case 'mtqty':
      case 'metrictons':
      case 'metricton':
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
      case 'paymentterms':
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

  /**
   * Ingests any error entity (string, array, object, class-validator format).
   * Automatically splits compound error sentences across fields and deduplicates repetition.
   */
  const ingestErrorItem = (fieldHint: string | undefined, msgVal: any): void => {
    if (!msgVal) return;

    // Array of errors
    if (Array.isArray(msgVal)) {
      for (const sub of msgVal) {
        ingestErrorItem(fieldHint, sub);
      }
      return;
    }

    // Object representations (class-validator, Express-validator, NestJS)
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

      // class-validator constraints map: e.g. { isNotEmpty: '...', isString: '...' }
      if (msgVal.constraints && typeof msgVal.constraints === 'object') {
        for (const constraintMsg of Object.values(msgVal.constraints)) {
          ingestErrorItem(fieldFromObj || fieldHint, constraintMsg);
        }
      }

      // class-validator nested children
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

    // Split compound sentences / multi-error strings (e.g. "confirmation_number is required, seller_instruction_id is required")
    const clauses = rawStr
      .split(/(?:,|\n|;)+/)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      let targetKey: string | null = null;
      if (fieldHint) {
        targetKey = mapFieldNameToErrorKey(fieldHint);
      }

      const detected = detectFieldInSentence(clause);
      if (detected) {
        targetKey = detected.key;
      } else if (!targetKey) {
        const keyFromClause = mapFieldNameToErrorKey(clause);
        if (keyFromClause && keyFromClause !== clause) {
          targetKey = keyFromClause;
        }
      }

      const cleanMsg = deduplicateValidationMessage(humanizeValidationMessage(clause, targetKey || undefined));
      if (!cleanMsg) continue;

      if (targetKey) {
        if (!fieldErrors[targetKey]) {
          fieldErrors[targetKey] = cleanMsg;
        } else {
          // If already present, only append distinct info (never duplicate!)
          const existing = fieldErrors[targetKey];
          fieldErrors[targetKey] = deduplicateValidationMessage(`${existing}, ${cleanMsg}`);
        }
        if (!generalError) {
          generalError = cleanMsg;
        }
      } else {
        const isHeader = /^(form validation error|validation error|bad request|invalid input|invalid payload)$/i.test(
          cleanMsg
        );
        if (!generalError && !isHeader) {
          generalError = cleanMsg;
        }
      }
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

  if (generalError) {
    generalError = deduplicateValidationMessage(humanizeValidationMessage(generalError));
  } else if (Object.keys(fieldErrors).length > 0) {
    generalError = Object.values(fieldErrors)[0];
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
  onSaveSuccess?: (savedId: string, confirmationData: any) => Promise<void> | void;
  onUpdateSteps?: (steps: StepperDocumentItem[]) => void;
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
  onSaveSuccess,
  onUpdateSteps,
  onSubmitContract,
  lang = 'en',
  dict,
  readOnly = false,
}: ConfirmationDocumentFormProps) {
  // Saved Draft ID (generated by backend on first save, sent on subsequent saves)
  const [draftId, setDraftId] = useState<string>(() =>
    toCleanId(initialData?.id || initialData?._id || initialData?.confirmation_id || initialData?.confirmationId)
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
  const [documentTitle, setDocumentTitle] = useState<string>(() =>
    toCleanLabel(initialData?.pdf_title || initialData?.pdfTitle || initialData?.documentTitle || initialData?.title) ||
      dict?.smart_docs?.confirmation_form?.confirmation_title ||
      'CONFIRMATION'
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Row 1: Meta
  const [confirmationNumber, setConfirmationNumber] = useState<string>(() =>
    toCleanLabel(initialData?.confirmationNumber || initialData?.confirmation_number) || ''
  );
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const [confirmationDate, setConfirmationDate] = useState<string>(() => {
    const raw = toCleanLabel(initialData?.confirmationDate || initialData?.confirmation_date);
    return raw && raw.includes('T') ? raw.split('T')[0] : raw;
  });

  // Row 2: Parties
  const [sellerId, setSellerId] = useState<string>(() =>
    toCleanId(initialData?.sellerId || initialData?.seller_instruction_id || initialData?.seller)
  );
  const [sellerInstruction, setSellerInstruction] = useState<string>(() =>
    toCleanLabel(initialData?.sellerInstruction || initialData?.seller_instruction || (typeof initialData?.seller === 'object' ? initialData.seller.instructionText || initialData.seller.details : ''))
  );
  const [buyerId, setBuyerId] = useState<string>(() =>
    toCleanId(initialData?.buyerId || initialData?.buyer_instruction_id || initialData?.buyer)
  );
  const [buyerInstruction, setBuyerInstruction] = useState<string>(() =>
    toCleanLabel(initialData?.buyerInstruction || initialData?.buyer_instruction || (typeof initialData?.buyer === 'object' ? initialData.buyer.instructionText || initialData.buyer.details : ''))
  );

  // Row 3: Product, HSN, Country
  const [productId, setProductId] = useState<string>(() =>
    toCleanId(initialData?.productId || initialData?.product_id || initialData?.product)
  );
  const [hsnCode, setHsnCode] = useState<string>(() => normalizeHsnString(initialData?.hsnCode || initialData?.hsn || (typeof initialData?.product === 'object' ? initialData.product.hsn : '')));
  const [productCountry, setProductCountry] = useState<string>(() =>
    normalizeCountryString(initialData?.productCountry || initialData?.country || (typeof initialData?.product === 'object' ? initialData.product.country : ''))
  );

  // Row 4: Specification
  const [specification, setSpecification] = useState<string>(() =>
    toCleanLabel(initialData?.specification || initialData?.quality_specification || (typeof initialData?.product === 'object' ? initialData.product.specification || initialData.product.quality_specification : ''))
  );

  // Row 5: Ship By (User's choice, no default pre-selection)
  const [shipBy, setShipBy] = useState<string>(() => {
    const init = toCleanLabel(initialData?.ship_by || initialData?.shipBy);
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
  const [loadingPort, setLoadingPort] = useState<string>(() => {
    const raw = initialData?.loadingPort || initialData?.loading_port_id || initialData?.loading_port;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // Row 7: Destination Port
  const [destinationPort, setDestinationPort] = useState<string>(() => {
    const raw = initialData?.destinationPort || initialData?.destination_port_id || initialData?.destination_port;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // Row 8: Packing
  const [packing, setPacking] = useState<string>(() => {
    const raw = initialData?.packing || initialData?.packing_type_id || initialData?.packing_type;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // Row 9: Shipping Term
  const [shippingTerm, setShippingTerm] = useState<string>(() => {
    const raw = toCleanLabel(initialData?.shippingTerm || initialData?.shipping_term || initialData?.incoterm || initialData?.delivery_term);
    return raw || 'CNF';
  });

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
    const raw = initialData?.currency || initialData?.currency_code || initialData?.currency_id || initialData?.currencyId;
    const resolved = normalizeCurrencyOption(raw, currencies || initialData?.currencies || initialData?.currenciesList);
    return resolved.value || 'USD';
  });
  const [currencyId, setCurrencyId] = useState<string>(() => {
    const cId = toCleanId(initialData?.currency_id || initialData?.currencyId || (typeof initialData?.currency === 'object' ? initialData.currency?.id || initialData.currency?._id : ''));
    if (cId) return cId;
    const resolved = normalizeCurrencyOption(initialData?.currency || initialData?.currency_code, currencies);
    return resolved.id || '';
  });
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
  const [shipmentPeriod, setShipmentPeriod] = useState<string>(() =>
    toCleanLabel(initialData?.shipmentPeriod || initialData?.shipment_period) || ''
  );

  // Row 12: Payment Term
  const [paymentTerm, setPaymentTerm] = useState<string>(() => {
    const raw = initialData?.paymentTerm || initialData?.payment_term_id || initialData?.payment_term;
    return toCleanId(raw) || toCleanLabel(raw) || '';
  });

  // Row 13: Notes
  const [notes, setNotes] = useState<string>(
    initialData?.notes || ''
  );

  // UI States
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Instructions Lists State (pre-populated by SSR or fetched via server action)
  const [internalSellers, setInternalSellers] = useState<FormOptionItem[]>(() => {
    const base = sellers || [];
    const raw = initialData?.seller || initialData?.seller_instruction_id;
    if (raw && typeof raw === 'object') {
      const sId = toCleanId(raw);
      const sLbl = toCleanLabel(raw.company_name || raw.label || raw.name || raw);
      if (sId && !base.some((s) => toCleanId(s.value) === sId)) {
        return [{ value: sId, label: sLbl || sId, instructionText: toCleanLabel(raw.instructionText || raw.details || raw.instruction) }, ...base];
      }
    }
    return base;
  });
  const [internalBuyers, setInternalBuyers] = useState<FormOptionItem[]>(() => {
    const base = buyers || [];
    const raw = initialData?.buyer || initialData?.buyer_instruction_id;
    if (raw && typeof raw === 'object') {
      const bId = toCleanId(raw);
      const bLbl = toCleanLabel(raw.company_name || raw.label || raw.name || raw);
      if (bId && !base.some((b) => toCleanId(b.value) === bId)) {
        return [{ value: bId, label: bLbl || bId, instructionText: toCleanLabel(raw.instructionText || raw.details || raw.instruction) }, ...base];
      }
    }
    return base;
  });
  const [isLoadingInstructions, setIsLoadingInstructions] = useState<boolean>(false);

  // Current active product ID ref to guard against stale async responses
  const currentProductIdRef = useRef<string>(productId);
  useEffect(() => {
    currentProductIdRef.current = productId;
  }, [productId]);

  // Dynamic Products List State (pre-populated by SSR or fetched via server action)
  const [internalProducts, setInternalProducts] = useState<FormOptionItem[]>(() => {
    const base = products || [];
    const raw = initialData?.product || initialData?.product_id;
    const pId = toCleanId(initialData?.product_id || initialData?.productId || raw);
    const pLbl = toCleanLabel(
      (typeof raw === 'object' ? raw.name || raw.product_name || raw.label || raw.title : '') ||
      initialData?.product_name ||
      initialData?.productName ||
      (typeof initialData?.product === 'string' && initialData.product !== pId ? initialData.product : '') ||
      raw
    );
    if (pId && pLbl && !base.some((p) => toCleanId(p.value) === pId)) {
      return [{ value: pId, label: pLbl }, ...base];
    }
    return base;
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  // Dynamic Product Specific Fields State (packing types, loading ports, destination ports)
  const [internalPackingOptions, setInternalPackingOptions] = useState<FormOptionItem[]>(() => {
    const base = packingOptions || [];
    const raw = initialData?.packing_type || initialData?.packing_type_id || initialData?.packing;
    const pId = toCleanId(raw);
    const pLabel = toCleanLabel(raw);
    if ((pId || pLabel) && !base.some((p) => toCleanId(p.value) === (pId || pLabel) || toCleanLabel(p.label).toLowerCase() === (pLabel || pId).toLowerCase())) {
      const bagWeightKg = parsePackingBagWeightKg(raw || pLabel || pId);
      return [{
        value: pId || pLabel,
        label: pLabel || pId,
        bagWeightKg: bagWeightKg !== null ? bagWeightKg : undefined,
      }, ...base];
    }
    return base;
  });

  const [internalLoadingPorts, setInternalLoadingPorts] = useState<FormOptionItem[]>(() => {
    const base = loadingPorts || [];
    const raw = initialData?.loading_port || initialData?.loading_port_id || initialData?.loadingPort;
    const lId = toCleanId(raw);
    const lLabel = toCleanLabel(raw);
    if ((lId || lLabel) && !base.some((p) => toCleanId(p.value) === (lId || lLabel) || toCleanLabel(p.label).toLowerCase() === (lLabel || lId).toLowerCase())) {
      return [{ value: lId || lLabel, label: lLabel || lId, subLabel: typeof raw === 'object' ? raw.country : undefined }, ...base];
    }
    return base;
  });

  const [internalDestinationPorts, setInternalDestinationPorts] = useState<FormOptionItem[]>(() => {
    const base = destinationPorts || [];
    const raw = initialData?.destination_port || initialData?.destination_port_id || initialData?.destinationPort;
    const dId = toCleanId(raw);
    const dLabel = toCleanLabel(raw);
    if ((dId || dLabel) && !base.some((p) => toCleanId(p.value) === (dId || dLabel) || toCleanLabel(p.label).toLowerCase() === (dLabel || dId).toLowerCase())) {
      return [{ value: dId || dLabel, label: dLabel || dId, subLabel: typeof raw === 'object' ? raw.country : undefined }, ...base];
    }
    return base;
  });
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
    const base = DEFAULT_PAYMENT_TERMS;
    const raw = initialData?.payment_term || initialData?.payment_term_id || initialData?.paymentTerm;
    const payId = toCleanId(raw);
    const payLabel = toCleanLabel(raw);
    if ((payId || payLabel) && !base.some((p) => toCleanId(p.value) === (payId || payLabel) || toCleanLabel(p.label).toLowerCase() === (payLabel || payId).toLowerCase())) {
      return [{ value: payId || payLabel, label: payLabel || payId }, ...base];
    }
    return base;
  });
  const [isLoadingPaymentTerms, setIsLoadingPaymentTerms] = useState<boolean>(false);

  // Dynamic Currencies List State (pre-populated by SSR or fetched via server action)
  const [internalCurrencies, setInternalCurrencies] = useState<FormOptionItem[]>(() => {
    const base = currencies && currencies.length > 0
      ? currencies
      : initialData?.currencies && Array.isArray(initialData.currencies)
      ? initialData.currencies
      : initialData?.currenciesList && Array.isArray(initialData.currenciesList)
      ? initialData.currenciesList
      : DEFAULT_CURRENCIES;
    const raw = initialData?.currency || initialData?.currency_id || initialData?.currency_code;
    if (!raw) return base;
    const resolved = normalizeCurrencyOption(raw, base);
    if (resolved && !base.some((c: any) => String(c.value).toUpperCase() === resolved.value.toUpperCase())) {
      return [resolved, ...base];
    }
    return base;
  });
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState<boolean>(false);

  // Payment Term Add / Edit Modal states
  const [isPaymentTermModalOpen, setIsPaymentTermModalOpen] = useState<boolean>(false);
  const [paymentTermModalMode, setPaymentTermModalMode] = useState<'add' | 'edit'>('add');
  const [editingPaymentTerm, setEditingPaymentTerm] = useState<FormOptionItem | null>(null);

  // Sync with props if updated externally (merge to avoid losing locally added/custom items)
  useEffect(() => {
    if (sellers && sellers.length > 0) {
      setInternalSellers((prev) => {
        const incomingIds = new Set(sellers.map((s) => toCleanId(s.value || s.id)));
        const preserved = prev.filter((s) => !incomingIds.has(toCleanId(s.value || s.id)));
        return [...sellers, ...preserved];
      });
    }
  }, [sellers]);

  useEffect(() => {
    if (buyers && buyers.length > 0) {
      setInternalBuyers((prev) => {
        const incomingIds = new Set(buyers.map((b) => toCleanId(b.value || b.id)));
        const preserved = prev.filter((b) => !incomingIds.has(toCleanId(b.value || b.id)));
        return [...buyers, ...preserved];
      });
    }
  }, [buyers]);

  useEffect(() => {
    if (products && products.length > 0) {
      setInternalProducts((prev) => {
        const incomingIds = new Set(products.map((p) => toCleanId(p.value || p.id || p._id)));
        const preserved = prev.filter((p) => !incomingIds.has(toCleanId(p.value || p.id || p._id)));
        return [...products, ...preserved];
      });
    }
  }, [products]);

  useEffect(() => {
    if (packingOptions && packingOptions.length > 0) {
      setInternalPackingOptions((prev) => {
        const incomingIds = new Set(packingOptions.map((p) => toCleanId(p.value || p.id)));
        const preserved = prev.filter((p) => !incomingIds.has(toCleanId(p.value || p.id)));
        return [...packingOptions, ...preserved];
      });
    }
  }, [packingOptions]);

  useEffect(() => {
    if (loadingPorts && loadingPorts.length > 0) {
      setInternalLoadingPorts((prev) => {
        const incomingIds = new Set(loadingPorts.map((p) => toCleanId(p.value || p.id)));
        const preserved = prev.filter((p) => !incomingIds.has(toCleanId(p.value || p.id)));
        return [...loadingPorts, ...preserved];
      });
    }
  }, [loadingPorts]);

  useEffect(() => {
    if (destinationPorts && destinationPorts.length > 0) {
      setInternalDestinationPorts((prev) => {
        const incomingIds = new Set(destinationPorts.map((p) => toCleanId(p.value || p.id)));
        const preserved = prev.filter((p) => !incomingIds.has(toCleanId(p.value || p.id)));
        return [...destinationPorts, ...preserved];
      });
    }
  }, [destinationPorts]);

  useEffect(() => {
    if (paymentTerms && paymentTerms.length > 0) {
      setInternalPaymentTerms((prev) => {
        const incomingIds = new Set(paymentTerms.map((p) => toCleanId(p.value || p.id)));
        const preserved = prev.filter((p) => !incomingIds.has(toCleanId(p.value || p.id)));
        return [...paymentTerms, ...preserved];
      });
    }
  }, [paymentTerms]);

  useEffect(() => {
    if (currencies && currencies.length > 0) {
      setInternalCurrencies((prev) => {
        const incomingVals = new Set(currencies.map((c) => String(c.value).toUpperCase()));
        const preserved = prev.filter((c) => !incomingVals.has(String(c.value).toUpperCase()));
        return [...currencies, ...preserved];
      });
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
  };

  // Auto-resolve currencyId once currenciesList is available if not set
  useEffect(() => {
    if (currency && currenciesList.length > 0 && !currencyId) {
      const norm = normalizeCurrencyOption(currency, currenciesList);
      const targetVal = norm.value || currency;
      const found = currenciesList.find(
        (c) =>
          String(c.value).toUpperCase() === String(targetVal).toUpperCase() ||
          String(c.code || '').toUpperCase() === String(targetVal).toUpperCase() ||
          String(c.id) === String(currency) ||
          String(c.raw?.id) === String(currency)
      );
      const cId = found?.id || found?.raw?.id || found?.raw?._id || found?.raw?.currency_id || norm.id;
      if (cId) setCurrencyId(String(cId));
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

          // If the user already switched to another product while this request was in-flight, discard
          if (currentProductIdRef.current !== cleanId) {
            return;
          }

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
        if (currentProductIdRef.current === cleanId) {
          setIsLoadingProductDetails(false);
        }
      }
    },
    [lang]
  );

  // Auto-fill HSN, Country & Specification when Product is selected, and trigger product details API
  const handleProductChange = (prodId: string) => {
    const isDifferent = String(prodId || '') !== String(productId || '');
    setProductId(prodId);
    currentProductIdRef.current = prodId;
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

  // Track document ID to prevent background RSC re-renders from wiping active user edits
  const lastLoadedDocIdRef = useRef<string>(
    toCleanId(
      initialData?.id ||
      initialData?._id ||
      initialData?.confirmation_id ||
      initialData?.confirmationId
    )
  );
  const isFormInitializedRef = useRef<boolean>(
    Boolean(initialData && typeof initialData === 'object' && Object.keys(initialData).length > 0)
  );

  /**
   * Helper function to populate and synchronize all form state fields from a confirmation data object.
   * Can be invoked on initial mount / initialData change OR immediately after saving when backend
   * returns the fresh confirmation entity via GET /confirmation/:id.
   */
  const populateConfirmationData = useCallback(
    (rawObj: any) => {
      if (!rawObj || typeof rawObj !== 'object') return;
      const d =
        rawObj?.data && typeof rawObj.data === 'object' && !Array.isArray(rawObj.data)
          ? rawObj.data
          : rawObj;

      // Draft ID
      const savedDocId = toCleanId(
        d.id ||
        d._id ||
        d.confirmation_id ||
        d.confirmationId ||
        d.document_id ||
        d.doc_id
      );
      if (savedDocId) {
        setDraftId(savedDocId);
        lastLoadedDocIdRef.current = savedDocId;
        isFormInitializedRef.current = true;
      }

      // Document configuration
      if (d.letterhead_space !== undefined) {
        setLetterhead(Boolean(d.letterhead_space));
      } else if (d.letterhead !== undefined) {
        setLetterhead(Boolean(d.letterhead));
      }

      if (d.is_watermark_enabled !== undefined) {
        setWatermark(Boolean(d.is_watermark_enabled));
      } else if (d.watermark !== undefined) {
        setWatermark(Boolean(d.watermark));
      }

      const titleVal = toCleanLabel(d.pdf_title || d.pdfTitle || d.documentTitle || d.title);
      if (titleVal) {
        setDocumentTitle(titleVal);
      }

      // Meta
      const confNum = toCleanLabel(d.confirmation_number || d.confirmationNumber || d.number);
      if (confNum) {
        setConfirmationNumber(confNum);
      }

      const rawConfDate = toCleanLabel(d.confirmation_date || d.confirmationDate || d.date);
      if (rawConfDate) {
        setConfirmationDate(rawConfDate.includes('T') ? rawConfDate.split('T')[0] : rawConfDate);
      }

      // Parties
      const rawSeller = d.seller || d.seller_instruction || d.seller_instruction_id || d.sellerId;
      const selId = toCleanId(d.seller_instruction_id || d.sellerId || d.seller_id || rawSeller);
      const selInst = toCleanLabel(
        d.seller_instruction ||
        d.sellerInstruction ||
        (typeof rawSeller === 'object' ? rawSeller.instructionText || rawSeller.instruction || rawSeller.details : '')
      );
      if (selId) {
        setSellerId(selId);
        if (typeof rawSeller === 'object') {
          const sLabel = toCleanLabel(rawSeller.company_name || rawSeller.label || rawSeller.name);
          if (sLabel) {
            setInternalSellers((prev) => {
              if (!prev.some((s) => toCleanId(s.value) === selId)) {
                return [{ value: selId, label: sLabel, instructionText: selInst }, ...prev];
              }
              return prev;
            });
          }
        }
      }
      if (selInst) {
        setSellerInstruction(selInst);
      }

      const rawBuyer = d.buyer || d.buyer_instruction || d.buyer_instruction_id || d.buyerId;
      const buyId = toCleanId(d.buyer_instruction_id || d.buyerId || d.buyer_id || rawBuyer);
      const buyInst = toCleanLabel(
        d.buyer_instruction ||
        d.buyerInstruction ||
        (typeof rawBuyer === 'object' ? rawBuyer.instructionText || rawBuyer.instruction || rawBuyer.details : '')
      );
      if (buyId) {
        setBuyerId(buyId);
        if (typeof rawBuyer === 'object') {
          const bLabel = toCleanLabel(rawBuyer.company_name || rawBuyer.label || rawBuyer.name);
          if (bLabel) {
            setInternalBuyers((prev) => {
              if (!prev.some((b) => toCleanId(b.value) === buyId)) {
                return [{ value: buyId, label: bLabel, instructionText: buyInst }, ...prev];
              }
              return prev;
            });
          }
        }
      }
      if (buyInst) {
        setBuyerInstruction(buyInst);
      }

      // Product, HSN, Country
      const rawProd = d.product || d.product_id || d.productId;
      const prodId = toCleanId(d.product_id || d.productId || rawProd);
      const prodName = toCleanLabel(
        (typeof rawProd === 'object' ? rawProd.name || rawProd.product_name || rawProd.label || rawProd.title : '') ||
        d.product_name ||
        d.productName ||
        (typeof d.product === 'string' && d.product !== prodId ? d.product : '')
      );
      if (prodId) {
        setProductId(prodId);
        currentProductIdRef.current = prodId;
        fetchAndApplyProductDetails(prodId);
        if (prodName) {
          setInternalProducts((prev) => {
            if (!prev.some((p) => toCleanId(p.value) === prodId)) {
              return [{ value: prodId, label: prodName }, ...prev];
            }
            return prev;
          });
        }
      }

      const rawHsn = toCleanLabel(
        d.hsn_code ||
        d.hsnCode ||
        d.hsn ||
        (typeof d.product === 'object' ? d.product?.hsn || d.product?.hsn_code : '')
      );
      if (rawHsn) {
        setHsnCode(normalizeHsnString(rawHsn));
      }

      const rawCountry = toCleanLabel(
        d.country ||
        d.productCountry ||
        d.origin_country ||
        d.origin ||
        (typeof d.product === 'object' ? d.product?.country || d.product?.origin_country : '')
      );
      if (rawCountry) {
        setProductCountry(normalizeCountryString(rawCountry));
      }

      const rawSpec = toCleanLabel(
        d.quality_specification ||
        d.specification ||
        (typeof d.product === 'object' ? d.product?.quality_specification || d.product?.specification : '')
      );
      if (rawSpec) {
        setSpecification(rawSpec);
      }

      // Ship By
      const rawShipBy = toCleanLabel(d.ship_by || d.shipBy);
      if (rawShipBy) {
        setShipBy(normalizeShipByForApi(rawShipBy));
      }

      // Ports & Packing
      const rawLoadPort = d.loading_port || d.loading_port_id || d.loadingPort;
      const loadPortId = toCleanId(rawLoadPort);
      const loadPortLabel = toCleanLabel(rawLoadPort);
      const effectiveLoadVal = loadPortId || loadPortLabel;
      if (effectiveLoadVal) {
        setLoadingPort(effectiveLoadVal);
        if (loadPortLabel) {
          setInternalLoadingPorts((prev) => {
            const exists = prev.some(
              (p) =>
                toCleanId(p.value) === effectiveLoadVal ||
                toCleanLabel(p.label).toLowerCase() === loadPortLabel.toLowerCase()
            );
            if (!exists) {
              return [
                {
                  value: effectiveLoadVal,
                  label: loadPortLabel,
                  subLabel: typeof rawLoadPort === 'object' ? rawLoadPort.country || rawLoadPort.subLabel : undefined,
                },
                ...prev,
              ];
            }
            return prev;
          });
        }
      }

      const rawDestPort = d.destination_port || d.destination_port_id || d.destinationPort;
      const destPortId = toCleanId(rawDestPort);
      const destPortLabel = toCleanLabel(rawDestPort);
      const effectiveDestVal = destPortId || destPortLabel;
      if (effectiveDestVal) {
        setDestinationPort(effectiveDestVal);
        if (destPortLabel) {
          setInternalDestinationPorts((prev) => {
            const exists = prev.some(
              (p) =>
                toCleanId(p.value) === effectiveDestVal ||
                toCleanLabel(p.label).toLowerCase() === destPortLabel.toLowerCase()
            );
            if (!exists) {
              return [
                {
                  value: effectiveDestVal,
                  label: destPortLabel,
                  subLabel: typeof rawDestPort === 'object' ? rawDestPort.country || rawDestPort.subLabel : undefined,
                },
                ...prev,
              ];
            }
            return prev;
          });
        }
      }

      const rawPack = d.packing_type || d.packing_type_id || d.packing || d.packingType;
      const packId = toCleanId(rawPack);
      const packLabel = toCleanLabel(rawPack);
      const effectivePackVal = packId || packLabel;
      if (effectivePackVal) {
        setPacking(effectivePackVal);
        if (packLabel) {
          setInternalPackingOptions((prev) => {
            const exists = prev.some(
              (p) =>
                toCleanId(p.value) === effectivePackVal ||
                toCleanLabel(p.label).toLowerCase() === packLabel.toLowerCase()
            );
            if (!exists) {
              return [
                {
                  value: effectivePackVal,
                  label: packLabel,
                  bagWeightKg:
                    (typeof rawPack === 'object' && (rawPack.bagWeightKg || rawPack.weight || rawPack.bag_weight_kg)
                      ? rawPack.bagWeightKg || rawPack.weight || rawPack.bag_weight_kg
                      : parsePackingBagWeightKg(rawPack || packLabel)) ?? undefined,
                },
                ...prev,
              ];
            }
            return prev;
          });
        }
      }

      // Shipping Term
      const rawShipTerm = d.shipping_term || d.shippingTerm || d.incoterm || d.delivery_term;
      const shipTerm = toCleanLabel(rawShipTerm) || toCleanId(rawShipTerm);
      if (shipTerm) {
        setShippingTerm(shipTerm);
      }

      // Quantities
      if (d.fcl_quantity !== undefined || d.fclQty !== undefined) {
        setFclQty(d.fcl_quantity ?? d.fclQty ?? '');
      }
      if (d.fcl_capacity !== undefined || d.fclCapacity !== undefined) {
        setFclCapacity(d.fcl_capacity ?? d.fclCapacity ?? '');
      }
      if (d.mt_quantity !== undefined || d.mtQty !== undefined) {
        setMtQty(d.mt_quantity ?? d.mtQty ?? '');
      }
      if (d.bag_quantity !== undefined || d.bagQty !== undefined) {
        setBagQty(d.bag_quantity ?? d.bagQty ?? '');
      }

      // Currency & Price
      const rawCur = d.currency || d.currency_id || d.currencyId || d.currency_code;
      const curId = toCleanId(d.currency_id || d.currencyId || (typeof rawCur === 'object' ? rawCur?.id || rawCur?._id || rawCur?.currency_id : ''));
      const normCur = normalizeCurrencyOption(rawCur || curId || d.currency_code, currenciesList);
      const effectiveCode = normCur.value || 'USD';
      const effectiveLabel = normCur.label || 'USD ($)';
      const effectiveCurId = curId || normCur.id || '';

      if (effectiveCurId) {
        setCurrencyId(effectiveCurId);
      }
      setCurrency(effectiveCode);

      setInternalCurrencies((prev) => {
        const matchIdx = prev.findIndex(
          (c) =>
            String(c.value).toUpperCase() === effectiveCode.toUpperCase() ||
            String(c.code || '').toUpperCase() === effectiveCode.toUpperCase() ||
            (effectiveCurId && (String(c.id) === effectiveCurId || String(c.raw?.id || c.raw?._id) === effectiveCurId))
        );
        if (matchIdx >= 0) {
          const existing = prev[matchIdx];
          const updated = {
            ...existing,
            value: effectiveCode,
            label: existing.label && existing.label.includes('(') ? existing.label : effectiveLabel,
            code: effectiveCode,
            id: effectiveCurId || existing.id,
          };
          const copy = [...prev];
          copy[matchIdx] = updated;
          return copy;
        }
        return [
          {
            id: effectiveCurId || undefined,
            value: effectiveCode,
            label: effectiveLabel,
            code: effectiveCode,
            symbol: normCur.symbol || '$',
          },
          ...prev,
        ];
      });

      if (d.price !== undefined && d.price !== null) {
        setPrice(d.price);
      }

      if (d.total_value !== undefined && d.total_value !== null) {
        setTotalValue(d.total_value);
      } else if (d.totalValue !== undefined && d.totalValue !== null) {
        setTotalValue(d.totalValue);
      }

      // Shipment dates
      const rawStart = toCleanLabel(d.shipment_start_date || d.shipmentStartDate);
      const rawEnd = toCleanLabel(d.shipment_end_date || d.shipmentEndDate);
      if (rawStart || rawEnd) {
        setShipmentRange({
          start: rawStart ? new Date(rawStart) : null,
          end: rawEnd ? new Date(rawEnd) : null,
        });
      }
      const rawPeriod = toCleanLabel(d.shipment_period || d.shipmentPeriod);
      if (rawPeriod) {
        setShipmentPeriod(rawPeriod);
      }

      // Payment term & Notes
      const rawPay = d.payment_term || d.payment_term_id || d.paymentTerm;
      const payId = toCleanId(rawPay);
      const payLabel = toCleanLabel(rawPay);
      const effectivePayVal = payId || payLabel;
      if (effectivePayVal) {
        setPaymentTerm(effectivePayVal);
        if (payLabel) {
          setInternalPaymentTerms((prev) => {
            const exists = prev.some(
              (p) =>
                toCleanId(p.value) === effectivePayVal ||
                toCleanLabel(p.label).toLowerCase() === payLabel.toLowerCase()
            );
            if (!exists) {
              return [{ value: effectivePayVal, label: payLabel }, ...prev];
            }
            return prev;
          });
        }
      }

      if (d.notes !== undefined && d.notes !== null) {
        const cleanNotes = typeof d.notes === 'string' ? d.notes : String(d.notes);
        if (cleanNotes !== '[object Object]') {
          setNotes(cleanNotes);
        }
      }
    },
    [fetchAndApplyProductDetails]
  );

  // Synchronize with initialData ONLY on initial async load or if switching to a completely DIFFERENT document
  useEffect(() => {
    if (!initialData || typeof initialData !== 'object' || Object.keys(initialData).length === 0) {
      return;
    }

    const incomingDocId = toCleanId(
      initialData.id ||
      initialData._id ||
      initialData.confirmation_id ||
      initialData.confirmationId
    );

    // If the form was already initialized and this incoming data is for the SAME document (e.g. background RSC re-render after Server Action),
    // NEVER overwrite the user's active in-progress edits!
    if (isFormInitializedRef.current) {
      if (incomingDocId && incomingDocId === lastLoadedDocIdRef.current) {
        return;
      }
      if (!incomingDocId && !lastLoadedDocIdRef.current) {
        return;
      }
    }

    // New document or initial async load
    isFormInitializedRef.current = true;
    if (incomingDocId) {
      lastLoadedDocIdRef.current = incomingDocId;
    }
    populateConfirmationData(initialData);
  }, [initialData, populateConfirmationData]);

  // Real-time calculation for MT QTY, BAG QTY & TOTAL VALUE
  useEffect(() => {
    const bagKg = parsePackingBagWeightKg(packing, packingList);
    const p = parseFloat(String(price)) || 0;

    if (isFcl) {
      // 20 FT / 40 FT Container mode: MT QTY is calculated as FCL QTY * FCL CAPACITY
      const fcl = parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0;
      const capacity = parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0;
      const calcMt = fcl * capacity;
      const nextMt = !fclQty && !fclCapacity ? '' : calcMt > 0 ? (calcMt % 1 === 0 ? calcMt.toString() : calcMt.toFixed(2)) : '0';

      if (String(mtQty) !== String(nextMt)) {
        setMtQty(nextMt);
      }

      const calcTotal = calcMt * p;

      if (!fclQty && !fclCapacity && !packing) {
        setBagQty('');
      } else if (bagKg !== null && bagKg > 0 && calcMt > 0) {
        const calculatedBags = Math.round((calcMt * 1000) / bagKg);
        setBagQty(calculatedBags.toLocaleString());
      } else if (bagKg === 0) {
        setBagQty('0');
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
      const numMt = parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
      const calcTotal = numMt * p;

      if (!mtQty && !packing) {
        setBagQty('');
      } else if (bagKg !== null && bagKg > 0 && numMt > 0) {
        const calculatedBags = Math.round((numMt * 1000) / bagKg);
        setBagQty(calculatedBags.toLocaleString());
      } else if (bagKg === 0) {
        setBagQty('0');
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

    const cleanLoading = toCleanId(selectedLoading?.id || selectedLoading?.value || loadingPort);
    if (cleanLoading) {
      rawPayload.loading_port_id = cleanLoading;
    }

    const cleanDest = toCleanId(selectedDest?.id || selectedDest?.value || destinationPort);
    if (cleanDest) {
      rawPayload.destination_port_id = cleanDest;
    }

    const cleanPack = toCleanId(selectedPacking?.id || selectedPacking?.value || packing);
    if (cleanPack) {
      rawPayload.packing_type_id = cleanPack;
    }

    const cleanTerm = (toCleanLabel(selectedTerm?.value || selectedTerm?.label || shippingTerm) || '').trim();
    if (cleanTerm) {
      rawPayload.shipping_term = cleanTerm;
    }

    const cleanPay = toCleanId(selectedPay?.id || selectedPay?.value || paymentTerm);
    if (cleanPay) {
      rawPayload.payment_term_id = cleanPay;
    }

    const cleanCurrencyId = toCleanId(effectiveCurrencyId);
    if (cleanCurrencyId) {
      rawPayload.currency_id = cleanCurrencyId;
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

    if (isFcl) {
      const computedMt =
        (parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0) *
        (parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0);
      if (computedMt > 0) {
        rawPayload.mt_quantity = computedMt;
      } else if (mtQty !== undefined && mtQty !== null && String(mtQty).trim() !== '') {
        const parsedMt = parseFloat(String(mtQty));
        if (!isNaN(parsedMt) && parsedMt > 0) {
          rawPayload.mt_quantity = parsedMt;
        }
      }
    } else if (mtQty !== undefined && mtQty !== null && String(mtQty).trim() !== '') {
      const parsedMt = parseFloat(String(mtQty));
      if (!isNaN(parsedMt) && parsedMt > 0) {
        rawPayload.mt_quantity = parsedMt;
      }
    }

    // Calculate bag quantity accurately based on FCL / MT and packing bag weight
    const effectiveBagKg = parsePackingBagWeightKg(packing, packingList);
    let resolvedBagQty: number | undefined = undefined;
    if (effectiveBagKg !== null && effectiveBagKg > 0) {
      const effectiveMt = isFcl
        ? (parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0) *
          (parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0)
        : parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
      if (effectiveMt > 0) {
        resolvedBagQty = Math.round((effectiveMt * 1000) / effectiveBagKg);
      }
    }

    if (resolvedBagQty !== undefined && resolvedBagQty > 0) {
      rawPayload.bag_quantity = resolvedBagQty;
    } else if (effectiveBagKg === 0) {
      rawPayload.bag_quantity = 0;
    } else if (bagQty !== undefined && bagQty !== null && String(bagQty).trim() !== '') {
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
      mtQty: isFcl
        ? (() => {
            const computedMt =
              (parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0) *
              (parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0);
            return computedMt > 0 ? (computedMt % 1 === 0 ? computedMt.toString() : computedMt.toFixed(2)) : mtQty || '';
          })()
        : mtQty,
      bagQty: (() => {
        const effectiveBagKg = parsePackingBagWeightKg(packing, packingList);
        if (effectiveBagKg && effectiveBagKg > 0) {
          const effectiveMt = isFcl
            ? (parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0) *
              (parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0)
            : parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
          if (effectiveMt > 0) {
            return Math.round((effectiveMt * 1000) / effectiveBagKg).toLocaleString();
          }
        } else if (effectiveBagKg === 0) {
          return '0';
        }
        return bagQty || '';
      })(),
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
        result?.data?.id ||
        result?.data?._id ||
        result?.id ||
        result?._id ||
        result?.raw?.data?.id ||
        result?.raw?.id ||
        result?.data?.confirmation_id ||
        result?.confirmation_id;

      if (savedId) {
        const cleanId = String(savedId).trim();
        setDraftId(cleanId);
        lastLoadedDocIdRef.current = cleanId;
        isFormInitializedRef.current = true;
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (url.searchParams.get('id') !== cleanId) {
            url.searchParams.set('id', cleanId);
            window.history.replaceState(null, '', url.toString());
          }
        }

        // Concurrently trigger required post-save API workflows:
        // 1. To update stepper:
        //    GET /dms/stepper-list/confirmation/:id?lang_code=en&source=web
        // 2. Form me data fill and set karvane ke liye:
        //    GET /confirmation/:id?lang_code=en&source=web
        try {
          const [stepperRes, confirmationRes] = await Promise.all([
            getStepperListAction({
              action: 'confirmation',
              step: cleanId,
              lang,
            }),
            getConfirmationAction(cleanId, lang),
          ]);

          if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
            if (onUpdateSteps) {
              onUpdateSteps(stepperRes.data);
            }
          }

          if (confirmationRes?.success && confirmationRes.data) {
            populateConfirmationData(confirmationRes.data);
          }

          if (onSaveSuccess) {
            await onSaveSuccess(cleanId, confirmationRes?.data || result?.data);
          }
        } catch (postSyncErr) {
          console.error('[ConfirmationDocumentForm] Post-save API sync error:', postSyncErr);
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
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="hsnCode">
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
                {errors.hsnCode && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.hsnCode}</span>
                  </span>
                )}
              </div>
              {/* COUNTRY */}
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="productCountry">
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
                {errors.productCountry && (
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.productCountry}</span>
                  </span>
                )}
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
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center flex items-center justify-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.mtQty}</span>
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
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center flex items-center justify-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.bagQty}</span>
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
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center flex items-center justify-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.totalValue}</span>
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
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center flex items-center justify-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.bagQty}</span>
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
                  <span className="text-[10px] text-brand-red font-semibold mt-0.5 text-center flex items-center justify-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                    <span>{errors.totalValue}</span>
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
