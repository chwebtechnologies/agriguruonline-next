'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocUnderlineSelect from './DocUnderlineSelect';
import DocToggle from './DocToggle';
import DocSignatureBox from './DocSignatureBox';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import { dataUrlToFile } from './ContractDocumentForm';
import { convertAmountToWords } from './number-to-words';
import {
  downloadDocPdfAction,
  getSellerBankDetailsAction,
  saveProformaDraftAction,
  submitProformaAction,
  getStepperListAction,
} from '@/app/actions/smart-docs';
import {
  DEFAULT_CURRENCIES,
  getCurrencySymbol,
  normalizeCurrencyCode,
  normalizeCurrencyOption,
  formatSignatureUrl,
  normalizeSignaturePayload,
  type StepperDocumentItem,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  extractProformaData,
  getProformaStep,
  normalizeStepStatus,
  extractDocumentStatus,
  extractProformaDocumentStatus,
  extractStepId,
  getStepSelfId,
  extractStepRedirectId,
  isProformaStep,
  isValidCuidOrId,
  getWorkflowSubmitButtonInfo,
  getWorkflowSubmitToastMessage,
  isSameWorkflowStep,
} from '@/lib/api/smart-docs.service';

export interface FormOptionItem {
  value: string;
  label: string;
  subLabel?: string;
  [key: string]: any;
}

export interface ProformaDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
  proformaId?: string;
  contractId?: string;
  confirmationId?: string;
  steps?: StepperDocumentItem[];
  selectedStep?: StepperDocumentItem | null;
  onUpdateSteps?: (steps: StepperDocumentItem[]) => void;
  onSelectStep?: (step: StepperDocumentItem, index?: number) => void;
  sellers?: FormOptionItem[];
  buyers?: FormOptionItem[];
  products?: FormOptionItem[];
  loadingPorts?: FormOptionItem[];
  destinationPorts?: FormOptionItem[];
  paymentTerms?: FormOptionItem[];
  currencies?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  onSaveDraft?: (payload: any) => Promise<any>;
  onSaveSuccess?: (savedId: string, savedData?: any) => void;
  onSubmitProforma?: (payload: any, id?: string, nextStep?: StepperDocumentItem | null) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

const DEFAULT_BANK_CHARGES_NOTE =
  'PLEASE DO NOT DEDUCT BANK CHARGES FROM THE TOTAL AMOUNT OF THE PAYMENT INSTRUCTIONS. DETAILS OF CHARGES SHOULD BE MENTIONED AS "OUR"';

export const DEFAULT_SHIPPING_TERMS: FormOptionItem[] = [
  { value: 'FOB', label: 'FOB (Free On Board)' },
  { value: 'CNF', label: 'CNF (Cost & Freight)' },
  { value: 'CIF', label: 'CIF (Cost, Insurance & Freight)' },
];

// In-memory module cache for seller bank accounts to ensure instantaneous switches
const sellerBankAccountsCache = new Map<string, any[]>();

/**
 * Universal fail-safe string converter to protect React from crashing when
 * backend returns objects, numbers, arrays, or nulls instead of primitive strings.
 */
export function safeString(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
      return fallback;
    }
    return trimmed;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : String(val);
  }
  if (typeof val === 'boolean') {
    return val ? 'YES' : 'NO';
  }
  if (Array.isArray(val)) {
    const joined = val.map((x) => safeString(x)).filter(Boolean).join(', ');
    return joined || fallback;
  }
  if (typeof val === 'object') {
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? fallback : val.toISOString().slice(0, 10);
    }
    const candidate =
      val.label ||
      val.name ||
      val.port_name ||
      val.portName ||
      val.company_name ||
      val.companyName ||
      val.title ||
      val.value ||
      val.code ||
      val.instruction ||
      val.address ||
      val.number ||
      val.text;
    if (candidate && typeof candidate !== 'object') {
      return safeString(candidate, fallback);
    }
    return fallback;
  }
  return fallback;
}

export function resolveGstString(val: any): string {
  const str = safeString(val);
  if (!str) return '';
  if (str.includes('\n') || str.toLowerCase().includes('gst') || str.toLowerCase().includes('registration')) {
    return str;
  }
  return `GST Number:\n${str}`;
}

/**
 * Safely deduplicates lines in party details (seller/buyer) to prevent duplicate
 * company names or repeated consecutive lines.
 */
export function dedupePartyDetails(val: any): string {
  if (!val) return '';
  const text = typeof val === 'object'
    ? (val.details || val.address || val.instruction || val.text || '')
    : String(val);
  const trimmed = text.trim();
  if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
    return '';
  }
  const rawLines = trimmed.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  if (rawLines.length <= 1) return trimmed;

  const deduped: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const prev = deduped[deduped.length - 1];

    // 1. Skip exact or case-insensitive consecutive duplicate lines
    if (prev && cur.toLowerCase() === prev.toLowerCase()) {
      continue;
    }

    // 2. If line 1 repeats the company name from line 0 (e.g., "ARDHENDU" followed by "ARDHENDU, ABC AREA")
    if (deduped.length === 1 && cur.toLowerCase().startsWith(deduped[0].toLowerCase())) {
      const remainder = cur.slice(deduped[0].length).replace(/^[\s,:-]+/, '').trim();
      if (!remainder) {
        continue;
      }
      deduped.push(remainder);
      continue;
    }

    // 3. Normalized alphanumeric equality for consecutive lines (handles punctuation differences)
    if (prev) {
      const pClean = prev.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cClean = cur.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (pClean && cClean && pClean === cClean) {
        continue;
      }
    }

    deduped.push(cur);
  }
  return deduped.join('\n');
}

/**
 * Combines company name and address without duplicating the company name
 * if the address already begins with or contains the company name.
 */
export function formatPartyDetails(cName?: string, address?: string): string {
  const cleanName = String(cName || '').trim();
  const cleanAddr = String(address || '').trim();

  if (!cleanName && !cleanAddr) return '';
  if (!cleanName) return dedupePartyDetails(cleanAddr);
  if (!cleanAddr) return cleanName;

  const dedupedAddr = dedupePartyDetails(cleanAddr);
  const addrLines = dedupedAddr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (addrLines.length > 0) {
    const firstLineLower = addrLines[0].toLowerCase();
    const nameLower = cleanName.toLowerCase();
    if (
      firstLineLower === nameLower ||
      firstLineLower.startsWith(nameLower) ||
      nameLower.startsWith(firstLineLower)
    ) {
      if (nameLower.length > firstLineLower.length && firstLineLower.length >= 3) {
        addrLines[0] = cleanName;
        return addrLines.join('\n');
      }
      return dedupedAddr;
    }
  }

  return `${cleanName}\n${dedupedAddr}`;
}

/**
 * Safely extracts seller company name, prioritizing seller_details.company_name as explicitly requested.
 */
export function extractSellerCompanyName(
  data: any,
  sellersList?: FormOptionItem[],
  currentSellerId?: string
): string {
  if (!data && (!sellersList || sellersList.length === 0)) return '';

  // 1. Direct seller_details object (as user requested: "seller_details me company_name jo ho vo dikhana hai")
  if (data?.seller_details && typeof data.seller_details === 'object') {
    const fromSellerDetails =
      data.seller_details.company_name ||
      data.seller_details.companyName ||
      data.seller_details.name ||
      data.seller_details.business_name ||
      data.seller_details.businessName;
    if (fromSellerDetails) return safeString(fromSellerDetails);
  }

  // 2. String seller_details (JSON or plain multiline string)
  if (typeof data?.seller_details === 'string') {
    const trimmed = data.seller_details.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const fromParsed =
          parsed?.company_name || parsed?.companyName || parsed?.name || parsed?.business_name;
        if (fromParsed) return safeString(fromParsed);
      } catch {
        // Not JSON
      }
    }
    // In many contracts/confirmations, the first line of seller_details is the company name!
    const firstLine = trimmed.split('\n')[0]?.trim();
    if (
      firstLine &&
      !firstLine.toLowerCase().startsWith('gst') &&
      !firstLine.toLowerCase().startsWith('pan') &&
      !firstLine.toLowerCase().startsWith('address')
    ) {
      return safeString(firstLine);
    }
  }

  // 3. Nested contract / confirmation / data / proforma layers
  const nestedLayers = [data?.contract, data?.confirmation, data?.data, data?.proforma];
  for (const layer of nestedLayers) {
    if (!layer || typeof layer !== 'object') continue;
    if (layer.seller_details && typeof layer.seller_details === 'object') {
      const c =
        layer.seller_details.company_name ||
        layer.seller_details.companyName ||
        layer.seller_details.name ||
        layer.seller_details.business_name;
      if (c) return safeString(c);
    }
    if (typeof layer.seller_details === 'string' && layer.seller_details.trim()) {
      const firstLine = layer.seller_details.trim().split('\n')[0]?.trim();
      if (firstLine && !firstLine.toLowerCase().startsWith('gst')) return safeString(firstLine);
    }
    if (layer.company_name) return safeString(layer.company_name);
    if (layer.seller_name) return safeString(layer.seller_name);
    if (layer.seller?.company_name) return safeString(layer.seller.company_name);
    if (layer.seller?.name) return safeString(layer.seller.name);
  }

  // 4. Direct company_name / seller fields on root
  if (data?.company_name) return safeString(data.company_name);
  if (data?.seller_name) return safeString(data.seller_name);
  if (data?.seller?.company_name) return safeString(data.seller.company_name);
  if (data?.seller?.name) return safeString(data.seller.name);

  // 5. Match from sellers list by sellerId
  const effectiveSellerId = safeString(
    currentSellerId ||
      data?.seller_id ||
      data?.sellerId ||
      data?.seller_instruction_id ||
      data?.sellerInstructionId ||
      (typeof data?.seller === 'string' ? data.seller : data?.seller?.id || data?.seller?._id)
  );

  if (sellersList && sellersList.length > 0 && effectiveSellerId) {
    const matched = sellersList.find(
      (s) => String(s.value || s.id || s._id) === String(effectiveSellerId)
    );
    if (matched) {
      const fromMatched = matched.companyName || matched.company_name || matched.label || matched.name;
      if (fromMatched) return safeString(fromMatched);
    }
  }

  // 6. seller_instruction string fallback (first line)
  if (typeof data?.seller_instruction === 'string' && data.seller_instruction.trim()) {
    const firstLine = data.seller_instruction.trim().split('\n')[0]?.trim();
    if (firstLine && !firstLine.toLowerCase().startsWith('gst')) return safeString(firstLine);
  }

  return '';
}

/**
 * Resolves the Seller / Exporter instruction_id from initialData or sellers list.
 * User requirement: "is me seller_details ki instruction_id pass karni hai"
 * Prioritizes seller_details.instruction_id (and synonyms), then seller_instruction_id,
 * and matches against sellers list by company name.
 */
export function extractSellerInstructionId(data: any, sellersList?: FormOptionItem[]): string {
  if (!data && (!sellersList || sellersList.length === 0)) return '';

  const isValidId = (val: any): string => {
    if (!val) return '';
    const str = String(val).trim();
    if (
      str &&
      str !== 'undefined' &&
      str !== 'null' &&
      str !== '[object Object]' &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(str)
    ) {
      return str;
    }
    return '';
  };

  const parseJsonSafe = (raw: any): any => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  // 1. Direct seller_details object (highest priority as instructed)
  const sellerDetailsObjs = [
    data?.seller_details,
    data?.proforma?.seller_details,
    data?.proforma_invoice?.seller_details,
    data?.contract?.seller_details,
    data?.confirmation?.seller_details,
    data?.data?.seller_details,
    data?.data?.proforma?.seller_details,
    data?.data?.proforma_invoice?.seller_details,
    data?.seller,
    data?.seller_instruction,
  ];

  for (const raw of sellerDetailsObjs) {
    const obj = parseJsonSafe(raw);
    if (obj) {
      const id =
        isValidId(obj.instruction_id) ||
        isValidId(obj.instructionId) ||
        isValidId(obj.seller_instruction_id) ||
        isValidId(obj.sellerInstructionId) ||
        (isValidId(obj.id) && isValidCuidOrId(obj.id) ? isValidId(obj.id) : '') ||
        (isValidId(obj._id) && isValidCuidOrId(obj._id) ? isValidId(obj._id) : '');
      if (id) return id;
    }
  }

  // 2. Direct seller_instruction_id / instruction_id fields
  const directFields = [
    data?.seller_instruction_id,
    data?.sellerInstructionId,
    data?.instruction_id,
    data?.instructionId,
    data?.proforma?.seller_instruction_id,
    data?.proforma_invoice?.seller_instruction_id,
    data?.contract?.seller_instruction_id,
    data?.confirmation?.seller_instruction_id,
    data?.data?.seller_instruction_id,
    data?.data?.instruction_id,
  ];

  for (const f of directFields) {
    const id = isValidId(f);
    if (id) return id;
  }

  // 3. Match from sellers list by company name or sellerId
  const companyName = extractSellerCompanyName(data, sellersList);
  if (sellersList && sellersList.length > 0) {
    // A. Match by company name
    if (companyName) {
      const lowerCompany = companyName.trim().toLowerCase();
      const matched = sellersList.find((s) => {
        const sName = String(s.companyName || s.label || s.name || '').trim().toLowerCase();
        return sName && (sName === lowerCompany || sName.includes(lowerCompany) || lowerCompany.includes(sName));
      });
      if (matched) {
        const id =
          isValidId((matched as any).instruction_id) ||
          isValidId((matched as any).instructionId) ||
          isValidId((matched as any).raw?.instruction_id) ||
          isValidId((matched as any).raw?.instructionId) ||
          isValidId(matched.id) ||
          isValidId(matched.value);
        if (id) return id;
      }
    }

    // B. Match by candidate sellerId
    const candSellerId = isValidId(data?.seller_id || data?.sellerId || data?.seller);
    if (candSellerId) {
      const matched = sellersList.find(
        (s) =>
          String(s.value) === candSellerId ||
          String(s.id) === candSellerId ||
          String((s as any).instruction_id) === candSellerId
      );
      if (matched) {
        const id =
          isValidId((matched as any).instruction_id) ||
          isValidId((matched as any).instructionId) ||
          isValidId((matched as any).raw?.instruction_id) ||
          isValidId((matched as any).raw?.instructionId) ||
          isValidId(matched.id) ||
          isValidId(matched.value);
        if (id) return id;
      }
    }
  }

  // 4. Fallback: if seller_details.id or seller_id itself is a CUID (c + alphanumeric)
  const candidateCuid =
    isValidId(data?.seller_details?.id) ||
    isValidId(data?.seller_details?._id) ||
    isValidId(data?.seller_id) ||
    isValidId(data?.sellerId);
  if (candidateCuid && isValidCuidOrId(candidateCuid)) {
    return candidateCuid;
  }

  return '';
}

/**
 * Safely extracts loading port country name: loading_port.country.name
 */
export function extractLoadingPortCountry(data: any, productsList?: FormOptionItem[]): string {
  if (!data) return '';

  const cleanCountryStr = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (
        trimmed &&
        trimmed !== 'undefined' &&
        trimmed !== 'null' &&
        trimmed !== '[object Object]' &&
        trimmed !== 'N/A'
      ) {
        return trimmed;
      }
      return '';
    }
    if (typeof val === 'object') {
      const name = val.name || val.title || val.label || val.country_name || val.countryName;
      if (name && typeof name === 'string' && name.trim()) return name.trim();
    }
    return '';
  };

  const extractFromPort = (port: any): string => {
    if (!port) return '';
    if (typeof port === 'object') {
      const c = cleanCountryStr(port.country) || cleanCountryStr(port.country_name) || cleanCountryStr(port.countryName);
      if (c) return c;
      const sub = cleanCountryStr(port.subLabel);
      if (sub && !sub.includes(':')) return sub;
      const portName = safeString(port.name || port.port_name || port.label || port.title);
      if (portName && portName.includes(',')) {
        const parts = portName.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) return parts[parts.length - 1];
      }
    } else if (typeof port === 'string') {
      const trimmed = port.trim();
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) return parts[parts.length - 1];
      }
    }
    return '';
  };

  // 1. Check loading_port (root level)
  const fromPort = extractFromPort(data.loading_port || data.loadingPort || data.port_of_loading);
  if (fromPort) return fromPort;

  // 2. Direct country fields on root
  const fromDirectCountry =
    cleanCountryStr(data.loading_port_country) ||
    cleanCountryStr(data.loading_port_country_name) ||
    cleanCountryStr(data.country_of_origin) ||
    cleanCountryStr(data.origin_country) ||
    cleanCountryStr(data.product_country) ||
    cleanCountryStr(data.country) ||
    cleanCountryStr(data.place_of_receipt);
  if (fromDirectCountry) return fromDirectCountry;

  // 3. Product object country
  if (data.product && typeof data.product === 'object') {
    const pc =
      cleanCountryStr(data.product.country) ||
      cleanCountryStr(data.product.origin_country) ||
      cleanCountryStr(data.product.country_name);
    if (pc) return pc;
  }

  // 4. Nested layers (contract, confirmation, data, proforma)
  const nestedLayers = [data?.contract, data?.confirmation, data?.data, data?.proforma];
  for (const layer of nestedLayers) {
    if (!layer || typeof layer !== 'object') continue;
    const lp = extractFromPort(layer.loading_port || layer.loadingPort || layer.port_of_loading);
    if (lp) return lp;
    const lc =
      cleanCountryStr(layer.loading_port_country) ||
      cleanCountryStr(layer.country_of_origin) ||
      cleanCountryStr(layer.origin_country) ||
      cleanCountryStr(layer.product_country) ||
      cleanCountryStr(layer.country) ||
      cleanCountryStr(layer.place_of_receipt);
    if (lc) return lc;
    if (layer.product && typeof layer.product === 'object') {
      const lpc = cleanCountryStr(layer.product.country) || cleanCountryStr(layer.product.origin_country);
      if (lpc) return lpc;
    }
  }

  // 5. Match from productsList if available
  if (productsList && productsList.length > 0) {
    const prodId = String(data.product_id || data.productId || (typeof data.product === 'string' ? data.product : data.product?.id || ''));
    if (prodId) {
      const matched = productsList.find((p) => String(p.value || p.id) === prodId);
      if (matched) {
        const mc = cleanCountryStr(matched.country) || cleanCountryStr(matched.origin_country) || cleanCountryStr(matched.country_name) || cleanCountryStr(matched.subLabel);
        if (mc && !mc.includes(':')) return mc;
      }
    }
  }

  return '';
}

/**
 * Safely extracts destination port country name: destination_port.country.name
 */
export function extractDestinationPortCountry(data: any): string {
  if (!data) return '';

  const cleanCountryStr = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (
        trimmed &&
        trimmed !== 'undefined' &&
        trimmed !== 'null' &&
        trimmed !== '[object Object]' &&
        trimmed !== 'N/A'
      ) {
        return trimmed;
      }
      return '';
    }
    if (typeof val === 'object') {
      const name = val.name || val.title || val.label || val.country_name || val.countryName;
      if (name && typeof name === 'string' && name.trim()) return name.trim();
    }
    return '';
  };

  const extractFromPort = (port: any): string => {
    if (!port) return '';
    if (typeof port === 'object') {
      const c = cleanCountryStr(port.country) || cleanCountryStr(port.country_name) || cleanCountryStr(port.countryName);
      if (c) return c;
      const sub = cleanCountryStr(port.subLabel);
      if (sub && !sub.includes(':')) return sub;
      const portName = safeString(port.name || port.port_name || port.label || port.title);
      if (portName && portName.includes(',')) {
        const parts = portName.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) return parts[parts.length - 1];
      }
    } else if (typeof port === 'string') {
      const trimmed = port.trim();
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) return parts[parts.length - 1];
      }
    }
    return '';
  };

  // 1. Direct destination_port / port_of_destination / final_destination
  const fromPort = extractFromPort(data.destination_port || data.destinationPort || data.port_of_destination || data.final_destination);
  if (fromPort) return fromPort;

  // 2. Direct destination country fields on root
  const fromDirectCountry =
    cleanCountryStr(data.country_of_destination) ||
    cleanCountryStr(data.destination_country) ||
    cleanCountryStr(data.destination_port_country) ||
    cleanCountryStr(data.destination_port_country_name) ||
    cleanCountryStr(data.destinationPortCountry) ||
    cleanCountryStr(data.destinationPortCountryName);
  if (fromDirectCountry) return fromDirectCountry;

  // 3. Nested layers (contract, confirmation, data, proforma)
  const nestedLayers = [data?.contract, data?.confirmation, data?.data, data?.proforma];
  for (const layer of nestedLayers) {
    if (!layer || typeof layer !== 'object') continue;
    const dp = extractFromPort(layer.destination_port || layer.destinationPort || layer.port_of_destination || layer.final_destination);
    if (dp) return dp;
    const dc =
      cleanCountryStr(layer.country_of_destination) ||
      cleanCountryStr(layer.destination_country) ||
      cleanCountryStr(layer.destination_port_country) ||
      cleanCountryStr(layer.destination_port_country_name) ||
      cleanCountryStr(layer.destinationPortCountry);
    if (dc) return dc;
  }

  return '';
}

/**
 * Normalizes Pre-Carriage By values, removing underscores and cleaning up spaces.
 * E.g. "FCL_20_FT" -> "FCL 20 FT"
 */
export function formatPreCarriageBy(val: any, fallback = ''): string {
  const str = safeString(val);
  if (!str) return fallback;
  const cleaned = str.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

/**
 * Robustly extracts buyer information from document payload (Contract, Confirmation, or Proforma)
 * without ever falling back to a random first buyer from the database.
 */
export function extractBuyerInfo(data: any, buyersList?: FormOptionItem[]): {
  id: string;
  name: string;
  details: string;
} {
  const result = { id: '', name: '', details: '' };
  if (!data && (!buyersList || buyersList.length === 0)) return result;

  const isValidId = (val: any): string => {
    if (!val) return '';
    const str = String(val).trim();
    if (
      str &&
      str !== 'undefined' &&
      str !== 'null' &&
      str !== '[object Object]' &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(str)
    ) {
      return str;
    }
    return '';
  };

  const parseJsonSafe = (raw: any): any => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  // 1. Direct buyer_details object (if any)
  const candidateBuyerObjs = [
    data?.buyer_details,
    data?.proforma?.buyer_details,
    data?.contract?.buyer_details,
    data?.confirmation?.buyer_details,
    data?.data?.buyer_details,
    data?.buyer,
  ];

  for (const raw of candidateBuyerObjs) {
    const obj = parseJsonSafe(raw);
    if (obj) {
      const bId =
        isValidId(obj.instruction_id) ||
        isValidId(obj.instructionId) ||
        isValidId(obj.buyer_instruction_id) ||
        isValidId(obj.buyerInstructionId) ||
        (isValidId(obj.id) && isValidCuidOrId(obj.id) ? isValidId(obj.id) : '') ||
        (isValidId(obj._id) && isValidCuidOrId(obj._id) ? isValidId(obj._id) : '');
      if (bId && !result.id) result.id = bId;

      const bName = obj.company_name || obj.companyName || obj.name || obj.business_name || obj.businessName;
      if (bName && !result.name) result.name = String(bName).trim();

      const addr = obj.address || obj.instruction || obj.details;
      if (addr && !result.details) {
        result.details = formatPartyDetails(bName, addr);
      }
    }
  }

  // 2. Direct buyer_instruction_id / buyer_id fields
  const candIds = [
    data?.buyer_instruction_id,
    data?.buyerInstructionId,
    data?.buyer_id,
    data?.buyerId,
    data?.contract?.buyer_instruction_id,
    data?.contract?.buyer_id,
    data?.confirmation?.buyer_instruction_id,
    data?.confirmation?.buyer_id,
    data?.data?.buyer_instruction_id,
    data?.data?.buyer_id,
  ];
  for (const f of candIds) {
    const id = isValidId(f);
    if (id && !result.id) {
      result.id = id;
      break;
    }
  }

  // 3. Direct buyer_name / buyer_instruction strings
  const candNames = [
    data?.buyer_name,
    data?.buyerName,
    data?.importer_name,
    data?.importerName,
    data?.buyer?.name,
    data?.buyer?.company_name,
    data?.contract?.buyer_name,
    data?.confirmation?.buyer_name,
  ];
  for (const n of candNames) {
    if (n && typeof n === 'string' && n.trim() && !result.name) {
      result.name = n.trim();
      break;
    }
  }

  // Multiline string in buyer_details or buyer_instruction
  const buyerStrings = [
    typeof data?.buyer_details === 'string' ? data.buyer_details.trim() : '',
    typeof data?.buyer_instruction === 'string' ? data.buyer_instruction.trim() : '',
    typeof data?.contract?.buyer_instruction === 'string' ? data.contract.buyer_instruction.trim() : '',
    typeof data?.confirmation?.buyer_instruction === 'string' ? data.confirmation.buyer_instruction.trim() : '',
  ].filter(Boolean);

  for (const str of buyerStrings) {
    if (!result.details) result.details = dedupePartyDetails(str);
    if (!result.name) {
      const firstLine = str.split('\n')[0].trim();
      if (
        firstLine &&
        !firstLine.toLowerCase().startsWith('gst') &&
        !firstLine.toLowerCase().startsWith('pan') &&
        !firstLine.toLowerCase().startsWith('address')
      ) {
        result.name = firstLine;
      }
    }
  }

  // 4. Match against buyersList if provided
  if (buyersList && buyersList.length > 0) {
    let matched: FormOptionItem | undefined;
    if (result.id) {
      matched = buyersList.find(
        (b) =>
          String(b.value) === result.id ||
          String(b.id) === result.id ||
          String((b as any).instruction_id) === result.id
      );
    }
    if (!matched && result.name) {
      const lower = result.name.toLowerCase();
      matched = buyersList.find((b) => {
        const bLabel = String(b.companyName || b.label || b.name || '').toLowerCase();
        return bLabel && (bLabel === lower || bLabel.includes(lower) || lower.includes(bLabel));
      });
    }

    if (matched) {
      if (!result.id) {
        result.id = String((matched as any).instruction_id || matched.value || matched.id || '');
      }
      if (!result.name) {
        result.name = String(matched.companyName || matched.label || matched.name || '');
      }
      if (!result.details && (matched.details || (matched as any).instructionText)) {
        result.details = dedupePartyDetails(String(matched.details || (matched as any).instructionText || ''));
      }
    }
  }

  result.details = dedupePartyDetails(result.details);
  return result;
}

/**
 * Extracts a human-readable port display name (e.g. "Mundra, India") from raw port objects or strings.
 */
export function extractPortDisplayName(rawPort: any, fallbackName = ''): string {
  if (!rawPort) return fallbackName;
  if (typeof rawPort === 'object') {
    const name = rawPort.name || rawPort.port_name || rawPort.label || rawPort.title;
    const country = rawPort.country || rawPort.country_name || rawPort.countryName;
    const countryStr = typeof country === 'string' ? country.trim() : (country?.name || country?.title || '');
    if (name && !isValidCuidOrId(name)) {
      const cleanName = String(name).trim();
      return countryStr && !cleanName.toLowerCase().includes(countryStr.toLowerCase())
        ? `${cleanName}, ${countryStr}`
        : cleanName;
    }
    if (countryStr) return countryStr;
  }
  if (typeof rawPort === 'string') {
    const trimmed = rawPort.trim();
    if (trimmed && !isValidCuidOrId(trimmed)) {
      return trimmed;
    }
  }
  return fallbackName;
}

/**
 * Extracts goods description cleanly without appending static placeholder text.
 */
export function extractGoodsDescription(data: any): string {
  if (data?.goods_description && typeof data.goods_description === 'string' && data.goods_description.trim()) {
    return data.goods_description.trim();
  }
  if (data?.description_of_goods && typeof data.description_of_goods === 'string' && data.description_of_goods.trim()) {
    return data.description_of_goods.trim();
  }

  const prodName = safeString(
    data?.product_name ||
      data?.product?.name ||
      data?.product?.label ||
      data?.product?.product_name ||
      data?.commodity ||
      data?.commodity_name ||
      data?.product_title ||
      data?.contract?.product_name ||
      data?.contract?.commodity ||
      data?.confirmation?.commodity,
    ''
  );
  if (!prodName) return '';

  const spec = safeString(
    data?.quality_specification ||
      data?.specification ||
      data?.product_specification ||
      data?.product?.specification ||
      data?.product?.quality_specification ||
      data?.contract?.quality_specification ||
      data?.contract?.specification ||
      data?.confirmation?.quality_specification ||
      data?.confirmation?.specification,
    ''
  );
  const pack = safeString(
    data?.packing_type ||
      data?.packing ||
      data?.packing_description ||
      data?.packing_type_id ||
      data?.contract?.packing_type ||
      data?.contract?.packing ||
      data?.confirmation?.packing_type ||
      data?.confirmation?.packing,
    ''
  );
  const mark = safeString(
    data?.marking ||
      data?.marking_brand ||
      data?.brand ||
      data?.contract?.marking_brand ||
      data?.confirmation?.marking_brand,
    ''
  );

  const lines = [`PRODUCT: ${prodName}`];
  if (spec) lines.push(`SPECIFICATION: ${spec}`);
  if (pack) lines.push(`PACKING TYPE: ${pack}`);
  if (mark) lines.push(`MARKING: ${mark}`);
  return lines.join('\n');
}

/**
 * Extracts delivery terms (incoterm, shipping terms, or payment_term.title) without hardcoding "CNF".
 * Prioritizes payment_term object title from API data as requested by user.
 */
export function extractDeliveryTerms(data: any, paymentTermsList?: FormOptionItem[] | any[]): string {
  if (!data || typeof data !== 'object') return '';

  // 1. Primary: payment_term object title from API data ("payment_term key ke andar me title key")
  const ptObj =
    (data?.payment_term && typeof data.payment_term === 'object' ? data.payment_term : null) ||
    (data?.proforma?.payment_term && typeof data.proforma.payment_term === 'object' ? data.proforma.payment_term : null) ||
    (data?.contract?.payment_term && typeof data.contract.payment_term === 'object' ? data.contract.payment_term : null) ||
    (data?.data?.payment_term && typeof data.data.payment_term === 'object' ? data.data.payment_term : null) ||
    (data?.payment_terms && typeof data.payment_terms === 'object' ? data.payment_terms : null) ||
    (data?.paymentTerm && typeof data.paymentTerm === 'object' ? data.paymentTerm : null);

  const titleFromObj = ptObj?.title || ptObj?.name || ptObj?.label;
  if (titleFromObj && typeof titleFromObj === 'string' && titleFromObj.trim()) {
    return titleFromObj.trim();
  }

  // 2. Direct string titles if available
  const directTitle =
    data?.payment_term_title ||
    data?.payment_term_name ||
    data?.paymentTermTitle ||
    data?.paymentTermName;
  if (directTitle && typeof directTitle === 'string' && directTitle.trim()) {
    return directTitle.trim();
  }

  // 3. Match payment_term_id from paymentTermsList if provided
  const ptId = data?.payment_term_id || data?.payment_term || data?.paymentTermId || data?.contract?.payment_term_id;
  if (ptId && paymentTermsList && Array.isArray(paymentTermsList)) {
    const matched = paymentTermsList.find(
      (item) => String(item.value || item.id || item._id) === String(ptId)
    );
    const matchedTitle = matched?.title || matched?.label || matched?.name;
    if (matchedTitle && typeof matchedTitle === 'string' && matchedTitle.trim()) {
      return matchedTitle.trim();
    }
  }

  // 4. Fallback to delivery/shipping terms from backend
  return safeString(
    data?.terms_of_delivery_payment ||
      data?.shipping_terms ||
      data?.shipping_term ||
      data?.incoterm ||
      data?.delivery_terms ||
      data?.contract?.terms_of_delivery_payment ||
      data?.contract?.shipping_terms ||
      '',
    ''
  );
}

/**
 * Safely extracts shipping term (incoterm) from data across all possible backend structures.
 * Supports shipping_term object, string code, id matching from shippingTerms list, and fallbacks.
 */
export function extractShippingTerm(data: any, shippingTermsList?: FormOptionItem[]): string {
  if (!data) return '';

  // 1. Check nested shipping_term / incoterm object
  const stObj =
    (data?.shipping_term && typeof data.shipping_term === 'object' ? data.shipping_term : null) ||
    (data?.shippingTerm && typeof data.shippingTerm === 'object' ? data.shippingTerm : null) ||
    (data?.shipping_terms && typeof data.shipping_terms === 'object' ? data.shipping_terms : null) ||
    (data?.incoterm && typeof data.incoterm === 'object' ? data.incoterm : null) ||
    (data?.proforma?.shipping_term && typeof data.proforma.shipping_term === 'object' ? data.proforma.shipping_term : null) ||
    (data?.proforma?.shippingTerm && typeof data.proforma.shippingTerm === 'object' ? data.proforma.shippingTerm : null) ||
    (data?.proforma?.shipping_terms && typeof data.proforma.shipping_terms === 'object' ? data.proforma.shipping_terms : null) ||
    (data?.proforma?.incoterm && typeof data.proforma.incoterm === 'object' ? data.proforma.incoterm : null) ||
    (data?.contract?.shipping_term && typeof data.contract.shipping_term === 'object' ? data.contract.shipping_term : null) ||
    (data?.contract?.shippingTerm && typeof data.contract.shippingTerm === 'object' ? data.contract.shippingTerm : null) ||
    (data?.contract?.shipping_terms && typeof data.contract.shipping_terms === 'object' ? data.contract.shipping_terms : null) ||
    (data?.contract?.incoterm && typeof data.contract.incoterm === 'object' ? data.contract.incoterm : null) ||
    (data?.confirmation?.shipping_term && typeof data.confirmation.shipping_term === 'object' ? data.confirmation.shipping_term : null) ||
    (data?.confirmation?.shippingTerm && typeof data.confirmation.shippingTerm === 'object' ? data.confirmation.shippingTerm : null) ||
    (data?.confirmation?.shipping_terms && typeof data.confirmation.shipping_terms === 'object' ? data.confirmation.shipping_terms : null) ||
    (data?.confirmation?.incoterm && typeof data.confirmation.incoterm === 'object' ? data.confirmation.incoterm : null) ||
    (data?.data?.shipping_term && typeof data.data.shipping_term === 'object' ? data.data.shipping_term : null) ||
    (data?.data?.shippingTerm && typeof data.data.shippingTerm === 'object' ? data.data.shippingTerm : null) ||
    (data?.data?.shipping_terms && typeof data.data.shipping_terms === 'object' ? data.data.shipping_terms : null) ||
    (data?.data?.incoterm && typeof data.data.incoterm === 'object' ? data.data.incoterm : null);

  if (stObj) {
    const candidate = stObj.value || stObj.code || stObj.term || stObj.title || stObj.name || stObj.label;
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  // 2. Direct string / id candidates
  const raw =
    data?.shipping_term ||
    data?.shippingTerm ||
    data?.shipping_terms ||
    data?.shippingTerms ||
    data?.shipping_term_id ||
    data?.shippingTermId ||
    data?.incoterm ||
    data?.incoterms ||
    data?.delivery_term ||
    data?.delivery_terms ||
    data?.proforma?.shipping_term ||
    data?.proforma?.shippingTerm ||
    data?.proforma?.shipping_terms ||
    data?.proforma?.shipping_term_id ||
    data?.proforma?.incoterm ||
    data?.contract?.shipping_term ||
    data?.contract?.shippingTerm ||
    data?.contract?.shipping_terms ||
    data?.contract?.shipping_term_id ||
    data?.contract?.incoterm ||
    data?.confirmation?.shipping_term ||
    data?.confirmation?.shippingTerm ||
    data?.confirmation?.shipping_terms ||
    data?.confirmation?.shipping_term_id ||
    data?.confirmation?.incoterm ||
    data?.data?.shipping_term ||
    data?.data?.shippingTerm ||
    data?.data?.shipping_terms ||
    data?.data?.shipping_term_id ||
    data?.data?.incoterm;

  if (raw && typeof raw === 'string' && raw.trim()) {
    const rawTrimmed = raw.trim();
    const listToMatch = (shippingTermsList && shippingTermsList.length > 0) ? shippingTermsList : DEFAULT_SHIPPING_TERMS;
    if (Array.isArray(listToMatch)) {
      const matched = listToMatch.find(
        (item) =>
          String(item.value || item.id || item._id).toLowerCase() === rawTrimmed.toLowerCase() ||
          String(item.label || item.name || item.title).toLowerCase() === rawTrimmed.toLowerCase()
      );
      if (matched) {
        const val = matched.value || matched.title || matched.label || matched.name;
        if (val && typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    }
    return rawTrimmed;
  }

  return '';
}

/**
 * Formats shipping term into a clean uppercase token for the table rate column header (e.g. "CIF", "FOB", "CNF").
 */
export function formatShippingTermHeader(term: string): string {
  if (!term || typeof term !== 'string') return '';
  const trimmed = term.trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^([A-Za-z0-9_-]+)/);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return trimmed.split(' ')[0].toUpperCase();
}

/**
 * Extracts vessel & voyage number without hardcoding "AS PER BL".
 */
export function extractVesselVoyageNo(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const vName = safeString(
    data?.vessel_name ??
      data?.vesselName ??
      data?.vessel ??
      data?.proforma?.vessel_name ??
      data?.proforma_invoice?.vessel_name ??
      data?.shipment_instruction?.vessel_name ??
      data?.contract?.vessel_name,
    ''
  );
  const vVoy = safeString(
    data?.voyage_number ??
      data?.voyageNumber ??
      data?.voyage_no ??
      data?.voyageNo ??
      data?.proforma?.voyage_number ??
      data?.proforma?.voyage_no ??
      data?.proforma_invoice?.voyage_number ??
      data?.proforma_invoice?.voyage_no ??
      data?.shipment_instruction?.voyage_number ??
      data?.shipment_instruction?.voyage_no,
    ''
  );
  if (vName && vVoy) return `${vName}, ${vVoy}`;
  if (vName) return vName;
  if (vVoy) return vVoy;
  return safeString(
    data?.vessel_voyage_no ||
      data?.vesselVoyageNo ||
      data?.vessel_flight_no ||
      data?.shipping_line ||
      data?.contract?.vessel_voyage_no ||
      data?.contract?.shipping_line ||
      '',
    ''
  );
}

/**
 * Extracts bank charges note without hardcoding defaults.
 * Supports both disclaimer and bank_charges_note keys from backend.
 */
export function extractBankChargesNote(data: any): string {
  const note = safeString(
    data?.bank_charges_note ??
      data?.bank_charges ??
      data?.charges_note ??
      data?.proforma?.bank_charges_note ??
      data?.proforma?.bank_charges ??
      data?.contract?.bank_charges_note ??
      data?.data?.bank_charges_note ??
      data?.data?.bank_charges ??
      '',
    ''
  );
  if (note) return note;

  // Only check disclaimer if it explicitly pertains to bank charges/fees (never leak contract arbitration/dispute clause)
  const dis = safeString(
    data?.disclaimer ??
      data?.proforma?.disclaimer ??
      data?.data?.disclaimer ??
      '',
    ''
  );
  if (dis && /bank|charge|fee/i.test(dis)) {
    return dis;
  }
  return '';
}

/**
 * Thoroughly extracts the authority / seller signature URL from backend response data across all possible layers.
 */
export function resolveSignatureValue(
  data: any,
  sellersList?: FormOptionItem[] | any[],
  currentSellerId?: string
): string {
  if (!data && (!sellersList || sellersList.length === 0)) return '';

  const sigKeys = [
    'authorised_signature',
    'authorisedSignature',
    'authority_signature',
    'authoritySignature',
    'stamp_image_url',
    'stampImageUrl',
    'stamp_url',
    'stampUrl',
    'seller_stamp_url',
    'seller_stamp',
    'sellerStamp',
    'seller_signature',
    'sellerSignature',
    'seller_signature_url',
    'exporter_signature',
    'exporterSignature',
    'exporter_signature_url',
    'signature',
    'signature_url',
    'signatureUrl',
    'stamp',
  ];

  const extractFromObject = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    for (const k of sigKeys) {
      const v = obj[k];
      if (v && typeof v === 'string') {
        const trimmed = v.trim();
        if (
          trimmed &&
          trimmed !== 'null' &&
          trimmed !== 'undefined' &&
          trimmed !== '[object Object]' &&
          trimmed !== '/brand/logo.png' &&
          !trimmed.endsWith('/brand/logo.png')
        ) {
          return trimmed;
        }
      } else if (v && typeof v === 'object') {
        const candidate = v.url || v.src || v.path || v.image;
        if (candidate && typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && !trimmed.endsWith('/brand/logo.png')) {
            return trimmed;
          }
        }
      }
    }
    return null;
  };

  const layers = [
    data,
    data?.proforma,
    data?.proforma_invoice,
    data?.contract,
    data?.data,
    data?.data?.proforma,
    data?.data?.contract,
    data?.signatures,
    data?.seller,
    data?.data?.seller,
    data?.details,
  ].filter(Boolean);

  for (const layer of layers) {
    const found = extractFromObject(layer);
    if (found) return found;
  }

  // If not found in data layers, check matched seller in sellersList
  if (Array.isArray(sellersList) && sellersList.length > 0) {
    const targetId = safeString(currentSellerId || data?.seller_id || data?.sellerId);
    let matchedSeller = targetId
      ? sellersList.find((s) => String(s?.value || s?.id || s?._id) === targetId)
      : null;
    if (!matchedSeller && sellersList.length === 1) {
      matchedSeller = sellersList[0];
    }
    if (matchedSeller) {
      const fromSeller = extractFromObject(matchedSeller);
      if (fromSeller) return fromSeller;
    }
  }

  return '';
}

/**
 * Resolves seller logo from initial data or selected seller item.
 * Supports seller_logo, seller_logo_url, company_logo, company_logo_url, and logo synonyms.
 */
export function resolveSellerLogoValue(
  data: any,
  sellersList?: FormOptionItem[] | any[],
  currentSellerId?: string
): string {
  if (!data && (!sellersList || sellersList.length === 0)) return '';

  const logoKeys = [
    'seller_logo',
    'seller_logo_url',
    'sellerLogo',
    'sellerLogoUrl',
    'company_logo',
    'company_logo_url',
    'companyLogo',
    'companyLogoUrl',
    'logo_url',
    'logoUrl',
    'logo',
  ];

  const extractFromObject = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    for (const k of logoKeys) {
      const v = obj[k];
      if (v && typeof v === 'string') {
        const trimmed = v.trim();
        if (
          trimmed &&
          trimmed !== 'null' &&
          trimmed !== 'undefined' &&
          trimmed !== '[object Object]' &&
          trimmed !== '/brand/logo.png' &&
          !trimmed.endsWith('/brand/logo.png')
        ) {
          return trimmed;
        }
      } else if (v && typeof v === 'object') {
        const candidate =
          v.seller_logo ||
          v.seller_logo_url ||
          v.company_logo ||
          v.company_logo_url ||
          v.url ||
          v.src ||
          v.path ||
          v.image ||
          v.endpoint ||
          v.location ||
          v.file ||
          v.value;
        if (candidate && typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && !trimmed.endsWith('/brand/logo.png')) {
            return trimmed;
          }
        }
      }
    }
    // Also check seller_details object if present
    if (obj.seller_details && typeof obj.seller_details === 'object') {
      for (const k of logoKeys) {
        const v = obj.seller_details[k];
        if (v && typeof v === 'string') {
          const trimmed = v.trim();
          if (
            trimmed &&
            trimmed !== 'null' &&
            trimmed !== 'undefined' &&
            trimmed !== '[object Object]' &&
            trimmed !== '/brand/logo.png' &&
            !trimmed.endsWith('/brand/logo.png')
          ) {
            return trimmed;
          }
        } else if (v && typeof v === 'object') {
          const candidate =
            v.company_logo ||
            v.seller_logo ||
            v.url ||
            v.src ||
            v.path ||
            v.image;
          if (candidate && typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && !trimmed.endsWith('/brand/logo.png')) {
              return trimmed;
            }
          }
        }
      }
    }
    return null;
  };

  const layers = [
    data,
    data?.seller_details,
    data?.proforma,
    data?.proforma?.seller_details,
    data?.proforma_invoice,
    data?.proforma_invoice?.seller_details,
    data?.contract,
    data?.contract?.seller_details,
    data?.data,
    data?.data?.seller_details,
    data?.data?.proforma,
    data?.data?.proforma?.seller_details,
    data?.data?.proforma_invoice,
    data?.data?.proforma_invoice?.seller_details,
    data?.data?.contract,
    data?.data?.data,
    data?.document,
    data?.document?.seller_details,
    data?.seller,
    data?.seller?.seller_details,
    data?.data?.seller,
    data?.details,
  ].filter(Boolean);

  for (const layer of layers) {
    const found = extractFromObject(layer);
    if (found) return found;
  }

  // If not found in data layers, check matched seller in sellersList
  if (Array.isArray(sellersList) && sellersList.length > 0) {
    const targetId = safeString(currentSellerId || data?.seller_id || data?.sellerId);
    let matchedSeller = targetId
      ? sellersList.find((s) => String(s?.value || s?.id || s?._id) === targetId)
      : null;
    if (!matchedSeller && sellersList.length === 1) {
      matchedSeller = sellersList[0];
    }
    if (matchedSeller) {
      const fromSeller = extractFromObject(matchedSeller);
      if (fromSeller) return fromSeller;
    }
  }

  return '';
}

/**
 * Deduplicates repeated phrases or clauses within validation strings.
 */
export function deduplicateValidationMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  const trimmed = msg.trim();
  if (!trimmed) return '';

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
 * Transforms raw backend validator messages into clean, user-friendly labels.
 */
export function humanizeProformaValidationMessage(rawMsg: any, fieldKey?: string): string {
  if (!rawMsg) return 'Invalid value. Please check the field.';
  let msg = typeof rawMsg === 'string' ? rawMsg : (rawMsg?.message || rawMsg?.msg || JSON.stringify(rawMsg));
  msg = String(msg).trim();

  // Known specific technical validation errors
  if (/invoice_number.*(?:is required|should not be empty|must be a string)/i.test(msg)) {
    return 'Invoice number is required';
  }
  if (/invoice_date.*(?:is required|should not be empty|must be a date)/i.test(msg)) {
    return 'Please select a valid invoice date';
  }
  if (/bank_account.*(?:is required|should not be empty|select)/i.test(msg)) {
    return 'Please select a bank account';
  }
  if (/(?:stamp|signature).*(?:is required|should not be empty)/i.test(msg)) {
    return 'Official signature / stamp is required';
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
    [/\binvoice_number\b/gi, 'Invoice number'],
    [/\binvoice_date\b/gi, 'Invoice date'],
    [/\bgst_number\b/gi, 'Registration / GST number'],
    [/\bregistration_number\b/gi, 'Registration number'],
    [/\bbuyer_order_no_date\b/gi, "Buyer's order no & date"],
    [/\bbuyer_order_no\b/gi, "Buyer's order no"],
    [/\bother_references\b/gi, 'Other references'],
    [/\bbank_details_id\b/gi, 'Bank account'],
    [/\bbank_account_id\b/gi, 'Bank account'],
    [/\bbank_details\b/gi, 'Bank account details'],
    [/\bstamp_image_url\b/gi, 'Official signature / stamp'],
    [/\bauthorised_signature\b/gi, 'Official signature / stamp'],
    [/\bauthority_signature\b/gi, 'Official signature / stamp'],
    [/\bsignature\b/gi, 'Signature'],
    [/\bstamp\b/gi, 'Stamp'],
    [/\bauthority_signature_title\b/gi, 'Authority title'],
    [/\bbank_charges_note\b/gi, 'Bank charges note'],
    [/\bcomment_label\b/gi, 'Comment title'],
    [/\bcomment_value\b/gi, 'Comment value'],
    [/\bdocument_title\b/gi, 'Document title'],
    [/\bcompany_name\b/gi, 'Company name'],
    [/\bseller_id\b/gi, 'Exporter (Seller)'],
    [/\bbuyer_id\b/gi, 'Importer (Buyer)'],
    [/\bquantity_mt\b/gi, 'Quantity in MT'],
    [/\brate_price\b/gi, 'Rate / price'],
    [/\btotal_amount\b/gi, 'Total amount'],
    [/\badvance_payment\b/gi, 'Advance payment'],
  ];

  for (const [pattern, label] of fieldLabelReplacements) {
    msg = msg.replace(pattern, label);
  }

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
 * Detects which form field an error message or identifier belongs to.
 */
export function detectProformaFieldInSentence(text: string): { key: string; rawField: string } | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  const normalized = lower.replace(/[-_.]/g, ' ');

  if (
    normalized.includes('invoice number') ||
    normalized.includes('invoice no') ||
    lower.includes('invoicenumber') ||
    lower.includes('invoiceno')
  ) {
    return { key: 'invoiceNumber', rawField: 'invoice_number' };
  }
  if (normalized.includes('invoice date') || lower.includes('invoicedate')) {
    return { key: 'invoiceDate', rawField: 'invoice_date' };
  }
  if (
    normalized.includes('gst') ||
    normalized.includes('registration no') ||
    normalized.includes('registration number') ||
    lower.includes('gstnumber') ||
    lower.includes('registrationnumber')
  ) {
    return { key: 'gstNumber', rawField: 'gst_number' };
  }
  if (
    normalized.includes('buyer order') ||
    normalized.includes('order no') ||
    lower.includes('buyerorder')
  ) {
    return { key: 'buyerOrderNoDate', rawField: 'buyer_order_no_date' };
  }
  if (normalized.includes('other reference') || lower.includes('otherreference') || lower.includes('other_reference')) {
    return { key: 'other_reference', rawField: 'other_reference' };
  }
  if (
    normalized.includes('bank account') ||
    normalized.includes('bank detail') ||
    lower.includes('bankaccount') ||
    lower.includes('bankdetails') ||
    lower.includes('bank_details_id') ||
    lower.includes('bankdetailsid')
  ) {
    return { key: 'selectedBankId', rawField: 'bank_details_id' };
  }
  if (
    normalized.includes('signature label') ||
    normalized.includes('authority label') ||
    normalized.includes('authority title') ||
    lower.includes('signaturelabel') ||
    lower.includes('sellersignaturelabel')
  ) {
    return { key: 'seller_signature_label', rawField: 'seller_signature_label' };
  }
  if (
    normalized.includes('signature') ||
    normalized.includes('stamp') ||
    lower.includes('stampimage') ||
    lower.includes('sellersignature') ||
    lower.includes('authorisedsignature')
  ) {
    return { key: 'seller_signature', rawField: 'seller_signature' };
  }
  if (
    normalized.includes('bank charge') ||
    normalized.includes('charges note') ||
    normalized.includes('disclaimer') ||
    lower.includes('bankcharges') ||
    lower.includes('disclaimer')
  ) {
    return { key: 'bankChargesNote', rawField: 'disclaimer' };
  }
  if (
    normalized.includes('comment label') ||
    normalized.includes('comment title') ||
    lower.includes('commentlabel')
  ) {
    return { key: 'commentLabel', rawField: 'comment_label' };
  }
  if (
    normalized.includes('comment value') ||
    normalized.includes('comment text') ||
    lower.includes('commentvalue')
  ) {
    return { key: 'commentValue', rawField: 'comment_value' };
  }
  if (
    normalized.includes('document title') ||
    normalized.includes('pdf title') ||
    lower.includes('documenttitle')
  ) {
    return { key: 'documentTitle', rawField: 'document_title' };
  }
  if (normalized.includes('seller') || normalized.includes('exporter')) {
    return { key: 'sellerId', rawField: 'seller_id' };
  }
  if (normalized.includes('buyer') || normalized.includes('consignee') || normalized.includes('importer')) {
    return { key: 'buyerId', rawField: 'buyer_id' };
  }
  return null;
}

export const PROFORMA_FORM_FIELD_VISUAL_ORDER: string[] = [
  'documentTitle',
  'invoiceNumber',
  'invoiceDate',
  'gstNumber',
  'buyerOrderNoDate',
  'other_reference',
  'otherReferences',
  'otherReference',
  'sellerId',
  'buyerId',
  'selectedBankId',
  'seller_signature',
  'stampImageUrl',
  'seller_signature_label',
  'authoritySignatureTitle',
  'bankChargesNote',
  'commentLabel',
  'commentValue',
  'goodsDescription',
  'quantityMt',
  'ratePrice',
];

export function scrollToAndFocusProformaField(fieldErrorsOrKey: string | Record<string, string>): void {
  if (typeof window === 'undefined') return;

  let targetKey = '';
  if (typeof fieldErrorsOrKey === 'string') {
    targetKey = fieldErrorsOrKey;
  } else if (fieldErrorsOrKey && typeof fieldErrorsOrKey === 'object') {
    for (const key of PROFORMA_FORM_FIELD_VISUAL_ORDER) {
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

  const selectors = [
    `#field-${targetKey}`,
    `[data-field="${targetKey}"]`,
    `#${targetKey}`,
    `[name="${targetKey}"]`,
  ];

  if (targetKey === 'invoiceNumber') {
    selectors.unshift('#field-invoiceNumber', '#invoice-number-input');
  } else if (targetKey === 'selectedBankId' || targetKey === 'bankAccountId') {
    selectors.unshift('#field-selectedBankId', '#field-bankAccount', '[data-field="bankAccount"]');
  } else if (targetKey === 'seller_signature' || targetKey === 'stampImageUrl' || targetKey === 'signature') {
    selectors.unshift(
      '#field-seller_signature',
      '#field-stampImageUrl',
      '#field-signature',
      '[data-field="seller_signature"]',
      '[data-field="stampImageUrl"]',
      '[data-field="signature"]',
      '[name="seller_signature"]'
    );
  } else if (targetKey === 'seller_signature_label' || targetKey === 'authoritySignatureTitle') {
    selectors.unshift(
      '#field-seller_signature_label',
      '#field-authoritySignatureTitle',
      '[name="seller_signature_label"]'
    );
  } else if (targetKey === 'other_reference' || targetKey === 'otherReferences' || targetKey === 'otherReference') {
    selectors.unshift(
      '#field-other_reference',
      '#field-otherReferences',
      '#field-otherReferences-input',
      '[name="other_reference"]',
      '[data-field="otherReferences"]',
      '[data-field="other_reference"]'
    );
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
 * Robust helper to extract field-wise validation errors and general error from backend API response for proforma invoices.
 * NEVER leaks generic error messages like "Form Validation Error" as the generalError or field error.
 */
export function parseProformaBackendErrors(
  result: any
): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!result) return { fieldErrors, generalError: 'Failed to save draft' };

  const mapFieldNameToErrorKey = (field: string): string => {
    const f = String(field || '').trim();
    const clean = f.toLowerCase().replace(/[-_.]/g, '');

    switch (clean) {
      case 'invoicenumber':
      case 'invoiceno':
      case 'number':
      case 'invoice':
        return 'invoiceNumber';
      case 'invoicedate':
      case 'date':
        return 'invoiceDate';
      case 'gstnumber':
      case 'registrationnumber':
      case 'gst':
      case 'registration':
      case 'gstno':
      case 'registrationno':
        return 'gstNumber';
      case 'buyerordernodate':
      case 'buyerorderno':
      case 'buyerorderdate':
      case 'orderdate':
      case 'orderno':
        return 'buyerOrderNoDate';
      case 'otherreferences':
      case 'otherreference':
      case 'other_reference':
      case 'reference':
      case 'references':
        return 'other_reference';
      case 'bankdetailsid':
      case 'bank_details_id':
      case 'bankaccountid':
      case 'bank_account_id':
      case 'bankaccount':
      case 'bankdetails':
      case 'bankid':
      case 'bank':
      case 'selectedbankid':
        return 'selectedBankId';
      case 'stampimageurl':
      case 'signature':
      case 'stamp':
      case 'authoritysignature':
      case 'sellersignature':
      case 'seller_signature':
      case 'authorisedsignature':
      case 'authorsignature':
        return 'seller_signature';
      case 'authoritysignaturetitle':
      case 'authorisedsignaturetitle':
      case 'signaturetitle':
      case 'sellersignaturelabel':
      case 'seller_signature_label':
      case 'sellersignaturetitle':
      case 'sellerlabel':
        return 'seller_signature_label';
      case 'bankchargesnote':
      case 'bankcharges':
      case 'chargesnote':
      case 'disclaimer':
      case 'disclaimernote':
      case 'note':
        return 'bankChargesNote';
      case 'commentlabel':
      case 'commenttitle':
        return 'commentLabel';
      case 'commentvalue':
      case 'commenttext':
      case 'comment':
        return 'commentValue';
      case 'balancepayment':
      case 'balanceamount':
        return 'balancePayment';
      case 'totalvalue':
        return 'totalValue';
      case 'iswatermarkenabled':
      case 'watermarkenabled':
      case 'watermark':
        return 'is_watermark_enabled';
      case 'headerenabled':
      case 'letterheadspace':
      case 'letterhead':
        return 'header_enabled';
      case 'sellerlogo':
      case 'companylogo':
        return 'seller_logo';
      case 'documenttitle':
      case 'pdftitle':
      case 'title':
        return 'documentTitle';
      case 'companyname':
      case 'sellername':
      case 'sellerdetails':
      case 'sellerid':
      case 'seller':
      case 'exporter':
        return 'sellerId';
      case 'buyername':
      case 'buyerdetails':
      case 'buyerid':
      case 'buyer':
      case 'consignee':
      case 'importer':
        return 'buyerId';
      case 'purchaseorderno':
      case 'purchaseorder':
        return 'purchaseOrderNo';
      case 'contractdate':
        return 'contractDate';
      case 'goodsdescription':
      case 'description':
        return 'goodsDescription';
      case 'quantitymt':
      case 'quantity':
        return 'quantityMt';
      case 'rateprice':
      case 'price':
      case 'rate':
        return 'ratePrice';
      case 'totalamount':
      case 'total':
        return 'totalAmount';
      case 'advancepayment':
      case 'advance':
        return 'advancePayment';
      default: {
        const detected = detectProformaFieldInSentence(f);
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

      const detected = detectProformaFieldInSentence(clause);
      if (detected) {
        targetKey = detected.key;
      } else if (!targetKey) {
        const keyFromClause = mapFieldNameToErrorKey(clause);
        if (keyFromClause && keyFromClause !== clause) {
          targetKey = keyFromClause;
        }
      }

      const cleanMsg = humanizeProformaValidationMessage(clause, targetKey || undefined);
      if (!cleanMsg || isGenericValidationString(cleanMsg)) continue;

      if (targetKey) {
        if (!fieldErrors[targetKey]) {
          fieldErrors[targetKey] = cleanMsg;
        } else if (!fieldErrors[targetKey].includes(cleanMsg)) {
          fieldErrors[targetKey] = `${fieldErrors[targetKey]}, ${cleanMsg}`;
        }
        if (targetKey === 'seller_signature' || targetKey === 'stampImageUrl') {
          fieldErrors['seller_signature'] = fieldErrors[targetKey];
          fieldErrors['stampImageUrl'] = fieldErrors[targetKey];
        }
        if (targetKey === 'seller_signature_label' || targetKey === 'authoritySignatureTitle') {
          fieldErrors['seller_signature_label'] = fieldErrors[targetKey];
          fieldErrors['authoritySignatureTitle'] = fieldErrors[targetKey];
        }
        if (targetKey === 'other_reference' || targetKey === 'otherReferences') {
          fieldErrors['other_reference'] = fieldErrors[targetKey];
          fieldErrors['otherReferences'] = fieldErrors[targetKey];
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
        const lowerKey = k.toLowerCase();
        if (['status', 'statuscode', 'status_code', 'success', 'code', 'stack', 'raw', 'path', 'timestamp', 'method', 'errorcode', 'error_code', 'ok'].includes(lowerKey)) {
          continue;
        }
        if (
          [
            'message',
            'error',
            'id',
            '_id',
            'proforma_id',
            'proformaid',
            'proforma_invoice_id',
            'contract_id',
            'confirmation_id',
            'commercial_invoice_id',
            'commercialinvoiceid',
            'custom_invoice_id',
            'packing_list_id',
            'bill_of_lading_id',
            'shipment_instruction_id',
            'phyto_certificate_id',
          ].includes(lowerKey)
        ) {
          if (lowerKey === 'message' || lowerKey === 'error') {
            ingestErrorItem(undefined, v);
          }
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

  if (generalError && isGenericValidationString(generalError)) {
    generalError = null;
  }

  if (!generalError && Object.keys(fieldErrors).length > 0) {
    generalError = Object.values(fieldErrors)[0];
  }

  return { fieldErrors, generalError };
}

export function ProformaDocumentForm({
  initialData,
  dataVersion,
  proformaId,
  contractId,
  confirmationId,
  steps = [],
  selectedStep,
  onUpdateSteps,
  onSelectStep,
  sellers = [],
  buyers = [],
  products = [],
  loadingPorts = [],
  destinationPorts = [],
  paymentTerms = [],
  currencies = DEFAULT_CURRENCIES,
  shippingTerms = [],
  onSaveDraft,
  onSaveSuccess,
  onSubmitProforma,
  lang = 'en',
  dict,
  readOnly = false,
}: ProformaDocumentFormProps) {
  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gstInputRef = useRef<any>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isInitialDataRealProforma = Boolean(
    initialData?.invoice_number ||
    initialData?.invoice_no ||
    initialData?.invoice_date ||
    initialData?.disclaimer ||
    initialData?.bank_charges_note ||
    initialData?.goods_description ||
    (initialData?.proforma && typeof initialData.proforma === 'object') ||
    initialData?._is_proforma_loaded
  );
  const hasLoadedRealProformaRef = useRef<boolean>(isInitialDataRealProforma);
  const isFormInitializedRef = useRef<boolean>(isInitialDataRealProforma);
  const lastDataVersionRef = useRef<number>(dataVersion ?? 0);
  const isSavingOrSubmittingRef = useRef<boolean>(false);
  const lastLoadedDocIdRef = useRef<string>(
    sanitizeDocId(
      isInitialDataRealProforma
        ? initialData?.proforma_id ||
          initialData?.proformaId ||
          initialData?.proforma_invoice_id ||
          initialData?.id ||
          initialData?._id ||
          proformaId ||
          ''
        : proformaId || ''
    )
  );

  // Document Status: 'PENDING' shows Save As Draft; 'COMPLETED' strictly hides Save As Draft
  const proformaStepItem = getProformaStep(steps, selectedStep);
  const [docStatus, setDocStatus] = useState<string>(() => {
    return extractProformaDocumentStatus(initialData, proformaStepItem);
  });

  // User interaction & dirty state tracking:
  // - hasDraftChanges: enabled only if user made edits since opening or since last successful draft save
  // - hasSubmitChanges: enabled if user made edits, or if an unconfirmed proforma draft is already available to submit
  const [hasDraftChanges, setHasDraftChanges] = useState<boolean>(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState<boolean>(() => {
    const statusFromData = extractProformaDocumentStatus(initialData, proformaStepItem);
    const isCompleted = statusFromData === 'COMPLETED';
    return !isCompleted;
  });

  // Dirty State Tracking & User edit protection
  const isUserDirtyRef = useRef<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = useCallback(() => {
    isUserDirtyRef.current = true;
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Operation States & Draft ID
  const [draftId, setDraftId] = useState<string>(() => sanitizeDocId(proformaId) || '');

  useEffect(() => {
    if (proformaId) {
      const clean = sanitizeDocId(proformaId);
      if (clean && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(clean)) {
        setDraftId(clean);
      }
    }
  }, [proformaId]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Guard against blinking: if proforma ID exists but data/status is still loading, wait with a smooth skeleton
  const [statusLoadTimedOut, setStatusLoadTimedOut] = useState<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => setStatusLoadTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const isStatusLoading = !statusLoadTimedOut && Boolean(
    (proformaId || draftId) &&
    !initialData &&
    !steps?.some((s) => isProformaStep(s) && (s.status || s.document_status || s.step_status))
  );

  // Sync docStatus when steps or initialData updates
  useEffect(() => {
    const currentStep = getProformaStep(steps, selectedStep);
    const resolvedStatus = extractProformaDocumentStatus(initialData, currentStep);
    if (resolvedStatus) {
      setDocStatus(resolvedStatus);
    }
  }, [initialData, steps, selectedStep]);

  // Auto-scroll viewport to top whenever step or document changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedStep?.id, initialData?.id, initialData?.proforma_id]);

  // Form Header State
  const [documentTitle, setDocumentTitle] = useState<string>(() =>
    safeString(
      initialData?.pdf_title ||
        initialData?.pdfTitle ||
        initialData?.document_title ||
        initialData?.documentTitle ||
        initialData?.title,
      'PROFORMA INVOICE'
    )
  );
  const [letterhead, setLetterhead] = useState<boolean>(() => {
    if (initialData?.header_enabled !== undefined) return Boolean(initialData.header_enabled);
    if (initialData?.letterhead !== undefined) return Boolean(initialData.letterhead);
    if (initialData?.letterhead_space !== undefined) return Boolean(initialData.letterhead_space);
    return true;
  });
  const [watermark, setWatermark] = useState<boolean>(() => {
    if (initialData?.is_watermark_enabled !== undefined) return Boolean(initialData.is_watermark_enabled);
    if (initialData?.watermark !== undefined) return Boolean(initialData.watermark);
    return true;
  });


  // Parties: Seller / Exporter Instruction ID (strictly passed to /dms-fields/bank-details/:sellerId)
  const [sellerInstructionId, setSellerInstructionId] = useState<string>(() => {
    return extractSellerInstructionId(initialData, sellers);
  });

  const [sellerId, setSellerId] = useState<string>(() => {
    return (
      extractSellerInstructionId(initialData, sellers) ||
      safeString(
        initialData?.seller_instruction_id ||
          initialData?.sellerInstructionId ||
          initialData?.seller_id ||
          initialData?.sellerId ||
          (typeof initialData?.seller === 'string' ? initialData.seller : initialData?.seller?.id || initialData?.seller?._id),
        ''
      )
    );
  });

  // Company Logo (seller_logo) State & Removal Ref
  const hasUserClearedLogoRef = useRef<boolean>(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(() => {
    const rawLogo = resolveSellerLogoValue(
      initialData,
      sellers,
      extractSellerInstructionId(initialData, sellers) ||
      safeString(
        initialData?.seller_instruction_id ||
          initialData?.sellerInstructionId ||
          initialData?.seller_id ||
          initialData?.sellerId,
        ''
      )
    );
    return rawLogo ? (formatSignatureUrl(rawLogo) || rawLogo) : '';
  });

  // Keep sellerInstructionId & sellerId updated when initialData or sellers prop updates, but do not overwrite user edits
  useEffect(() => {
    const resolvedInstId = extractSellerInstructionId(initialData, sellers);
    if (resolvedInstId) {
      if (resolvedInstId !== sellerInstructionId) {
        setSellerInstructionId(resolvedInstId);
      }
      if (!isUserDirtyRef.current || !sellerId || sellerId !== resolvedInstId) {
        setSellerId(resolvedInstId);
      }
    }
  }, [initialData, sellers, sellerInstructionId, sellerId]);

  // Company / Exporter Name (strictly avoiding static first-seller fallback)
  const [companyName, setCompanyName] = useState<string>(() => {
    const sId = safeString(
      initialData?.seller_id ||
        initialData?.sellerId ||
        initialData?.seller_instruction_id ||
        initialData?.sellerInstructionId ||
        (typeof initialData?.seller === 'string' ? initialData.seller : initialData?.seller?.id || initialData?.seller?._id),
      ''
    );
    return extractSellerCompanyName(initialData, sellers, sId);
  });

  const [sellerDetails, setSellerDetails] = useState<string>(() => {
    if (initialData?.seller_details && typeof initialData.seller_details === 'object') {
      const addr = initialData.seller_details.address || initialData.seller_details.instruction || initialData.seller_details.details;
      const cName = initialData.seller_details.company_name || initialData.seller_details.name;
      const combined = formatPartyDetails(cName, addr);
      if (combined) return safeString(combined);
    }
    const raw =
      initialData?.seller_details ||
      initialData?.seller_instruction ||
      initialData?.seller?.address ||
      initialData?.seller?.instruction;
    return dedupePartyDetails(safeString(raw, ''));
  });

  // Parties: Buyer / Consignee (strictly extracted from document data, never defaulting to buyers[0])
  const [buyerId, setBuyerId] = useState<string>(() => {
    const info = extractBuyerInfo(initialData, buyers);
    return info.id;
  });

  const [buyerName, setBuyerName] = useState<string>(() => {
    const info = extractBuyerInfo(initialData, buyers);
    return info.name;
  });

  const [buyerDetails, setBuyerDetails] = useState<string>(() => {
    const info = extractBuyerInfo(initialData, buyers);
    return info.details;
  });

  // Invoicing Details: Box 1 Right (Editable Inputs)
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() =>
    safeString(initialData?.invoice_number || initialData?.invoice_no, '')
  );
  const [gstNumber, setGstNumber] = useState<string>(() => {
    const fromData = resolveGstString(
      initialData?.registration_number ||
        initialData?.gst_number ||
        initialData?.seller?.gst ||
        initialData?.seller?.registration_number
    );
    if (fromData) return fromData;
    const sId =
      extractSellerInstructionId(initialData, sellers) ||
      safeString(
        initialData?.seller_instruction_id ||
          initialData?.sellerInstructionId ||
          initialData?.seller_id ||
          initialData?.sellerId,
        ''
      );
    if (sId && sellers?.length) {
      const matched = sellers.find((s: any) => String(s.id || s._id || s.instruction_id || s.value) === String(sId));
      if (matched?.gst || matched?.registration_number || matched?.gst_number) {
        return resolveGstString(matched.gst || matched.registration_number || matched.gst_number);
      }
    }
    return '';
  });
  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    if (initialData?.invoice_date) return safeString(initialData.invoice_date).slice(0, 10);
    return '';
  });
  const [buyerOrderNoDate, setBuyerOrderNoDate] = useState<string>(() =>
    safeString(initialData?.buyer_order_no_date || initialData?.buyer_order_no, '')
  );

  // Reference Details: Box 2 Right (Purchase Order & Contract Date)
  const [purchaseOrderNo, setPurchaseOrderNo] = useState<string>(() => {
    return safeString(
      initialData?.purchase_order_no ||
        initialData?.purchaseOrderNo ||
        initialData?.po_number ||
        initialData?.poNumber ||
        initialData?.buyer_order_no ||
        initialData?.buyerOrderNo ||
        initialData?.contract_number ||
        initialData?.contractNumber ||
        initialData?.contract_no ||
        initialData?.confirmation_number ||
        initialData?.confirmationNumber,
      ''
    );
  });
  const [contractDate, setContractDate] = useState<string>(() => {
    const raw =
      initialData?.contract_date ||
      initialData?.contractDate ||
      initialData?.confirmation_date ||
      initialData?.confirmationDate;
    if (raw) return safeString(raw).slice(0, 10);
    return '';
  });
  const [otherReferences, setOtherReferences] = useState<string>(() => {
    const raw =
      initialData?.other_reference ??
      initialData?.other_references ??
      initialData?.otherReference ??
      initialData?.otherReferences ??
      initialData?.proforma?.other_reference ??
      initialData?.proforma?.other_references ??
      initialData?.contract?.other_reference ??
      initialData?.contract?.other_references ??
      initialData?.data?.other_reference ??
      initialData?.data?.other_references;
    return safeString(raw, '');
  });

  // 4-Column Shipping Info Row (NON-INPUT display values) - Clean extraction without forced defaults
  const [preCarriageBy, setPreCarriageBy] = useState<string>(() => {
    const raw =
      initialData?.pre_carriage_by ||
      initialData?.pre_carriage ||
      initialData?.preCarriageBy ||
      initialData?.container_type ||
      initialData?.fcl_type ||
      (initialData?.ship_by ? `BY ${safeString(initialData.ship_by)}` : '');
    return formatPreCarriageBy(raw, '');
  });
  // 17. Place of Receipt (Loading Port Country: loading_port.country.name)
  const [placeOfReceipt, setPlaceOfReceipt] = useState<string>(() => {
    return (
      extractLoadingPortCountry(initialData, products) ||
      safeString(
        initialData?.place_of_receipt ||
          initialData?.loading_port_country ||
          initialData?.origin_country ||
          initialData?.country_of_origin,
        ''
      )
    );
  });

  // 18. Country of Origin of Goods (Loading Port Country: loading_port.country.name)
  const [countryOfOrigin, setCountryOfOrigin] = useState<string>(() => {
    return (
      extractLoadingPortCountry(initialData, products) ||
      safeString(
        initialData?.country_of_origin ||
          initialData?.origin_country ||
          initialData?.product_country,
        ''
      )
    );
  });

  // 19. Country of Final Destination (Destination Port Country: destination_port.country.name)
  const [countryOfDestination, setCountryOfDestination] = useState<string>(() => {
    return (
      extractDestinationPortCountry(initialData) ||
      safeString(
        initialData?.country_of_destination ||
          initialData?.destination_country ||
          initialData?.destination_port_country,
        ''
      )
    );
  });

  // 3-Column Vessel Info Row (NON-INPUT display values)
  const [vesselVoyageNo, setVesselVoyageNo] = useState<string>(() => {
    return extractVesselVoyageNo(initialData);
  });
  const [portOfLoading, setPortOfLoading] = useState<string>(() => {
    return extractPortDisplayName(
      initialData?.port_of_loading || initialData?.loading_port,
      safeString(initialData?.loading_port_name, '')
    );
  });
  const [termsDeliveryPayment, setTermsDeliveryPayment] = useState<string>(() => {
    return extractDeliveryTerms(initialData, paymentTerms);
  });

  // Synchronize termsDeliveryPayment when paymentTerms list loads asynchronously
  useEffect(() => {
    if (paymentTerms && paymentTerms.length > 0) {
      const resolved = extractDeliveryTerms(initialData, paymentTerms);
      if (resolved && resolved !== termsDeliveryPayment) {
        setTermsDeliveryPayment(resolved);
      }
    }
  }, [paymentTerms, initialData]);

  // Shipping Term for Proforma (e.g. FOB, CNF, CIF)
  const [shippingTerm, setShippingTerm] = useState<string>(() => {
    return extractShippingTerm(initialData, shippingTerms);
  });

  // Synchronize shippingTerm when shippingTerms list loads asynchronously or initialData changes
  useEffect(() => {
    const resolved = extractShippingTerm(initialData, shippingTerms);
    if (resolved && resolved !== shippingTerm) {
      setShippingTerm(resolved);
    }
  }, [shippingTerms, initialData]);

  // 2-Column Destination Ports Row (NON-INPUT display values)
  const [portOfDestination, setPortOfDestination] = useState<string>(() => {
    return extractPortDisplayName(
      initialData?.port_of_destination || initialData?.destination_port,
      safeString(initialData?.destination_port_name, '')
    );
  });
  const [finalDestination, setFinalDestination] = useState<string>(() => {
    return extractPortDisplayName(
      initialData?.final_destination || initialData?.destination_port,
      safeString(initialData?.destination_port_name || initialData?.port_of_destination, '')
    );
  });

  // Goods Table (NON-INPUT display values)
  const [countVessel, setCountVessel] = useState<string>(() => {
    if (initialData?.count_vessel) return safeString(initialData.count_vessel);
    if (initialData?.fcl_quantity) {
      const typeStr = initialData?.fcl_type ? ` ${safeString(initialData.fcl_type)}` : '';
      return `${safeString(initialData.fcl_quantity)}${typeStr} FCLS`;
    }
    if (initialData?.quantity_mt || initialData?.mt_quantity) {
      return `${safeString(initialData.quantity_mt || initialData.mt_quantity)} MT`;
    }
    return '';
  });
  const [goodsDescription, setGoodsDescription] = useState<string>(() => {
    return extractGoodsDescription(initialData);
  });
  const [quantityMt, setQuantityMt] = useState<number | string>(() => {
    return initialData?.quantity_mt || initialData?.mt_quantity || initialData?.quantity || '';
  });
  const [currency, setCurrency] = useState<string>(() => {
    const raw =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.currencyCode ||
      initialData?.currency_id ||
      initialData?.currencyId ||
      'USD';
    return normalizeCurrencyOption(raw, currencies).value || normalizeCurrencyCode(raw);
  });
  const currencySymbol = useMemo(
    () => getCurrencySymbol(currency, currencies),
    [currency, currencies]
  );
  const [ratePrice, setRatePrice] = useState<string>(() => {
    const rawR = initialData?.rate_price ?? initialData?.price ?? initialData?.rate;
    if (rawR !== undefined && rawR !== null && String(rawR).trim() !== '') {
      return String(rawR).trim().replace(/,/g, '');
    }
    return '';
  });
  const [advancePayment, setAdvancePayment] = useState<string>(() => {
    const rawAdv =
      initialData?.advance_payment_amt ??
      initialData?.advance_payment ??
      initialData?.advance_amount ??
      initialData?.advancePaymentAmt ??
      initialData?.advancePayment ??
      initialData?.advanceAmount ??
      initialData?.proforma?.advance_payment_amt ??
      initialData?.proforma?.advance_payment ??
      initialData?.proforma?.advance_amount ??
      initialData?.contract?.advance_payment_amt ??
      initialData?.contract?.advance_payment ??
      initialData?.contract?.advance_amount ??
      initialData?.data?.advance_payment_amt ??
      initialData?.data?.advance_payment ??
      initialData?.data?.advance_amount;
    if (rawAdv !== undefined && rawAdv !== null && String(rawAdv).trim() !== '') {
      return String(rawAdv).trim().replace(/,/g, '');
    }
    return '';
  });

  // Helper: displays backend amounts cleanly without commas (matching API response) and without adding artificial .00 zeros
  const formatAmountWithoutExtraZeros = useCallback((val: number | string): string => {
    if (val === undefined || val === null || val === '') return '';
    const cleanStr = String(val).replace(/,/g, '').trim();
    if (!cleanStr) return '';
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return cleanStr;
    return num.toLocaleString('en-US', {
      useGrouping: false,
      maximumFractionDigits: 2,
    });
  }, []);

  // Computed Item Amount & Total (Accounting Precision)
  const computedItemAmount = useMemo(() => {
    const q = parseFloat(String(quantityMt || 0).replace(/,/g, '')) || 0;
    const r = parseFloat(String(ratePrice || 0).replace(/,/g, '')) || 0;
    return q * r;
  }, [quantityMt, ratePrice]);

  // Proforma rule: Total is computed from quantity and rate. Advance payment is purely informational and not deducted from total.
  const computedTotal = useMemo(() => {
    return computedItemAmount;
  }, [computedItemAmount]);

  // Amount in Words (Standard Trade Banking Accounting Rule - NON-INPUT display)
  const effectiveAmountInWords = useMemo(() => {
    return convertAmountToWords(computedTotal, currency);
  }, [computedTotal, currency]);

  // Bank Accounts Management (Fetched via /dms-fields/bank-details/:sellerId)
  const [sellerBankAccounts, setSellerBankAccounts] = useState<any[]>(() => {
    const cleanSellerInstId =
      extractSellerInstructionId(initialData, sellers) ||
      safeString(initialData?.seller_instruction_id || initialData?.sellerInstructionId || '', '');
    return cleanSellerInstId && sellerBankAccountsCache.has(cleanSellerInstId)
      ? sellerBankAccountsCache.get(cleanSellerInstId)!
      : [];
  });
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState<boolean>(false);
  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    const cleanParentContractId = sanitizeDocId(contractId || initialData?.contract_id || initialData?.contractId);
    const cleanParentConfId = sanitizeDocId(confirmationId || initialData?.confirmation_id || initialData?.confirmationId);
    const isRealProformaInit = Boolean(
      initialData?.invoice_number ||
      initialData?.invoice_no ||
      initialData?._is_proforma_loaded ||
      initialData?.is_proforma_loaded ||
      initialData?.document_type === 'proforma' ||
      initialData?.doc_type === 'proforma' ||
      (initialData?.proforma && typeof initialData.proforma === 'object') ||
      (initialData?.proforma_id && initialData.proforma_id !== cleanParentContractId && initialData.proforma_id !== cleanParentConfId) ||
      (initialData?.proforma_invoice_id && initialData.proforma_invoice_id !== cleanParentContractId && initialData.proforma_invoice_id !== cleanParentConfId)
    );
    // Never inherit or pre-select bank details from Contract/Confirmation fallback data
    if (!isRealProformaInit) return '';
    return safeString(
      initialData?.bank_details_id ??
        initialData?.bankDetailsId ??
        initialData?.bank_account_id ??
        initialData?.bankAccountId ??
        initialData?.bank_id ??
        initialData?.bankId ??
        initialData?.proforma?.bank_details_id ??
        initialData?.proforma?.bank_account_id ??
        initialData?.data?.bank_details_id ??
        initialData?.data?.bank_account_id,
      ''
    );
  });
  const [bankAccountDetails, setBankAccountDetails] = useState<string>(() => {
    const cleanParentContractId = sanitizeDocId(contractId || initialData?.contract_id || initialData?.contractId);
    const cleanParentConfId = sanitizeDocId(confirmationId || initialData?.confirmation_id || initialData?.confirmationId);
    const isRealProformaInit = Boolean(
      initialData?.invoice_number ||
      initialData?.invoice_no ||
      initialData?._is_proforma_loaded ||
      initialData?.is_proforma_loaded ||
      initialData?.document_type === 'proforma' ||
      initialData?.doc_type === 'proforma' ||
      (initialData?.proforma && typeof initialData.proforma === 'object') ||
      (initialData?.proforma_id && initialData.proforma_id !== cleanParentContractId && initialData.proforma_id !== cleanParentConfId) ||
      (initialData?.proforma_invoice_id && initialData.proforma_invoice_id !== cleanParentContractId && initialData.proforma_invoice_id !== cleanParentConfId)
    );
    // Never inherit or pre-select bank details from Contract/Confirmation fallback data
    if (!isRealProformaInit) return '';
    return safeString(
      initialData?.bank_details ??
        initialData?.bankAccountDetails ??
        initialData?.bank_account_details ??
        initialData?.account_details ??
        initialData?.proforma?.bank_details ??
        initialData?.data?.bank_details,
      ''
    );
  });

  const formatBankDetails = useCallback((item: any): string => {
    if (!item) return '';
    if (item.account_details && typeof item.account_details === 'string' && item.account_details.trim()) {
      return item.account_details.trim();
    }
    const lines: string[] = [];
    if (item.name || item.account_name) {
      lines.push(`A/C HOLDER NAME: ${safeString(item.name || item.account_name)}`);
    }
    if (item.account_number || item.account_no) {
      lines.push(`A/C NUMBER: ${safeString(item.account_number || item.account_no)}`);
    }
    if (item.bank_name || item.bankName) {
      lines.push(`BANK NAME: ${safeString(item.bank_name || item.bankName)}`);
    }
    if (item.branch || item.branch_name) {
      lines.push(`BRANCH: ${safeString(item.branch || item.branch_name)}`);
    }
    if (item.swift_code || item.swift) {
      lines.push(`SWIFT CODE: ${safeString(item.swift_code || item.swift)}`);
    }
    if (item.ifsc_code || item.ifsc) {
      lines.push(`IFSC CODE: ${safeString(item.ifsc_code || item.ifsc)}`);
    }
    if (item.iban) {
      lines.push(`IBAN: ${safeString(item.iban)}`);
    }
    if (item.address || item.bank_address) {
      lines.push(`BANK ADDRESS: ${safeString(item.address || item.bank_address)}`);
    }
    return lines.length > 0 ? lines.join('\n') : safeString(item?.name, '');
  }, []);

  // Fetch seller bank accounts from /dms-fields/bank-details/:sellerId
  // User Requirement: "is me seller_details ki instruction_id pass karni hai make sure properly karna isko.."
  useEffect(() => {
    const effectiveInstructionId =
      sellerInstructionId ||
      extractSellerInstructionId(initialData, sellers) ||
      sellerId;

    if (!effectiveInstructionId) {
      setSellerBankAccounts([]);
      return;
    }

    // Immediate cached return for zero latency only if cached bank list is non-empty
    if (sellerBankAccountsCache.has(effectiveInstructionId) && (sellerBankAccountsCache.get(effectiveInstructionId)?.length || 0) > 0) {
      const cached = sellerBankAccountsCache.get(effectiveInstructionId)!;
      setSellerBankAccounts(cached);
      if (selectedBankId) {
        const matched = cached.find(
          (b: any) =>
            String(b.bank_details_id || b.id || b._id) === String(selectedBankId) ||
            String(b.id) === String(selectedBankId) ||
            String(b.bank_details_id) === String(selectedBankId) ||
            String(b.bank_account_id) === String(selectedBankId)
        );
        if (matched) {
          const effectiveBankId = String(matched.bank_details_id || matched.id || selectedBankId);
          if (effectiveBankId && effectiveBankId !== selectedBankId) {
            setSelectedBankId(effectiveBankId);
          }
          setBankAccountDetails((prev) => prev || formatBankDetails(matched));
        }
      } else if (bankAccountDetails) {
        const matchedByText = cached.find((b: any) => {
          const formatted = formatBankDetails(b);
          return (
            (formatted && formatted.trim() === bankAccountDetails.trim()) ||
            (b.account_details && b.account_details.trim() === bankAccountDetails.trim())
          );
        });
        if (matchedByText) {
          setSelectedBankId(String(matchedByText.bank_details_id || matchedByText.id));
        }
      }
      // Explicit requirement: NEVER auto-select a bank account. User must intentionally pick one.
      return;
    }

    let isSubscribed = true;
    setIsLoadingBankAccounts(true);

    getSellerBankDetailsAction(effectiveInstructionId, { lang, source: 'web' })
      .then((res) => {
        if (!isSubscribed) return;
        const items = res?.data?.items || [];
        if (res?.success && Array.isArray(items)) {
          sellerBankAccountsCache.set(effectiveInstructionId, items);
          setSellerBankAccounts(items);

          // If a bank account was already chosen, ensure its details are formatted
          if (selectedBankId) {
            const matched = items.find(
              (b: any) =>
                String(b.bank_details_id || b.id || b._id) === String(selectedBankId) ||
                String(b.id) === String(selectedBankId) ||
                String(b.bank_details_id) === String(selectedBankId) ||
                String(b.bank_account_id) === String(selectedBankId)
            );
            if (matched) {
              const effectiveBankId = String((matched as any).bank_details_id || matched.id || selectedBankId);
              if (effectiveBankId && effectiveBankId !== selectedBankId) {
                setSelectedBankId(effectiveBankId);
              }
              setBankAccountDetails((prev) => prev || formatBankDetails(matched));
            }
          } else if (bankAccountDetails) {
            const matchedByText = items.find((b: any) => {
              const formatted = formatBankDetails(b);
              return (
                (formatted && formatted.trim() === bankAccountDetails.trim()) ||
                (b.account_details && b.account_details.trim() === bankAccountDetails.trim())
              );
            });
            if (matchedByText) {
              setSelectedBankId(String((matchedByText as any).bank_details_id || matchedByText.id));
            }
          }
          // Explicit requirement: NEVER auto-select a bank account. User must intentionally pick one.
        }
      })
      .catch((err) => {
        console.warn('[ProformaDocumentForm] Failed to load seller bank details:', err);
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoadingBankAccounts(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [sellerInstructionId, sellerId, initialData, sellers, lang, formatBankDetails, selectedBankId, bankAccountDetails]);

  // Track if user explicitly cleared authority signature in current session
  const hasUserClearedSignatureRef = useRef<boolean>(false);

  // Authority Signature & Stamp
  const [stampImageUrl, setStampImageUrl] = useState<string>(() => {
    const rawSig = resolveSignatureValue(initialData, sellers, sellerId);
    return rawSig ? formatSignatureUrl(rawSig) : '';
  });
  const [authoritySignatureTitle, setAuthoritySignatureTitle] = useState<string>(() =>
    safeString(
      initialData?.seller_signature_label ||
        initialData?.authority_signature_title ||
        initialData?.authorised_signature_title ||
        initialData?.authority_title,
      'AUTHORISED SIGNATURE'
    )
  );

  // Synchronize signature when seller changes if not already set
  useEffect(() => {
    if (!sellerId) return;
    if (!stampImageUrl && !hasUserClearedSignatureRef.current) {
      const sellerSig = resolveSignatureValue(null, sellers, sellerId);
      if (sellerSig) {
        setStampImageUrl(formatSignatureUrl(sellerSig));
      }
    }
    if (!companyLogoUrl && !hasUserClearedLogoRef.current) {
      const sellerLogo = resolveSellerLogoValue(null, sellers, sellerId);
      if (sellerLogo) {
        setCompanyLogoUrl(sellerLogo);
      }
    }
  }, [sellerId, sellers, stampImageUrl, companyLogoUrl]);

  // Bank Charges Disclaimer Note
  const [bankChargesNote, setBankChargesNote] = useState<string>(() =>
    extractBankChargesNote(initialData)
  );

  // Additional Comment Row (Matching Confirmation & Contract pattern)
  const [commentLabel, setCommentLabel] = useState<string>(() => {
    return safeString(
      initialData?.comment_label ||
        initialData?.commentLabel ||
        initialData?.comment_title ||
        initialData?.commentTitle,
      ''
    );
  });
  const [commentValue, setCommentValue] = useState<string>(() => {
    return safeString(
      initialData?.comment_value ||
        initialData?.commentValue ||
        initialData?.comment_text ||
        initialData?.commentText,
      ''
    );
  });

  // Synchronize state when initialData loads asynchronously or updates on refresh
  useEffect(() => {
    const isDataVersionTriggered = Boolean(
      dataVersion !== undefined && dataVersion !== lastDataVersionRef.current
    );

    if (!initialData) {
      if (isDataVersionTriggered) {
        setCommentLabel('');
        setCommentValue('');
      }
      return;
    }

    const cleanParentContractId = sanitizeDocId(contractId || initialData?.contract_id || initialData?.contractId);
    const cleanParentConfId = sanitizeDocId(confirmationId || initialData?.confirmation_id || initialData?.confirmationId);

    // A real Proforma Invoice record must have proforma-specific markers and MUST NOT be a contract or confirmation
    const isIncomingRealProforma = Boolean(
      initialData?.invoice_number ||
      initialData?.invoice_no ||
      initialData?._is_proforma_loaded ||
      initialData?.is_proforma_loaded ||
      initialData?.document_type === 'proforma' ||
      initialData?.doc_type === 'proforma' ||
      (initialData?.proforma && typeof initialData.proforma === 'object') ||
      (initialData?.proforma_id && initialData.proforma_id !== cleanParentContractId && initialData.proforma_id !== cleanParentConfId) ||
      (initialData?.proforma_invoice_id && initialData.proforma_invoice_id !== cleanParentContractId && initialData.proforma_invoice_id !== cleanParentConfId)
    );

    const currentIncomingDocId = isIncomingRealProforma
      ? sanitizeDocId(
          initialData?.proforma_id ||
          initialData?.proformaId ||
          initialData?.proforma_invoice_id ||
          initialData?.id ||
          initialData?._id
        )
      : '';

    const hasDocChanged = Boolean(
      currentIncomingDocId &&
      lastLoadedDocIdRef.current &&
      currentIncomingDocId !== lastLoadedDocIdRef.current
    );

    const needsProformaUpgrade = isIncomingRealProforma && !hasLoadedRealProformaRef.current;

    // When genuine proforma data arrives (e.g. upgrading from ancestor contract fallback), when stepper navigation triggers, or when document ID changes,
    // we MUST reset dirty flags so that the actual proforma data populates all form states cleanly!
    if (needsProformaUpgrade || hasDocChanged || isDataVersionTriggered) {
      isUserDirtyRef.current = false;
      isSavingOrSubmittingRef.current = false;
      hasLoadedRealProformaRef.current = true;
      if (dataVersion !== undefined) {
        lastDataVersionRef.current = dataVersion;
      }
    }

    // Protect user edits and prevent overwriting active entries when user has typed in the form
    if (!isDataVersionTriggered && !hasDocChanged && (isUserDirtyRef.current || isSavingOrSubmittingRef.current || (isFormInitializedRef.current && hasDraftChanges))) {
      // Still update fresh signature / logo from backend if available and not cleared by user
      const resolvedSig = resolveSignatureValue(initialData, sellers, sellerId);
      if (resolvedSig && !hasUserClearedSignatureRef.current && !stampImageUrl) {
        setStampImageUrl(formatSignatureUrl(resolvedSig));
      }
      if (!hasUserClearedLogoRef.current) {
        const resolvedLogo = resolveSellerLogoValue(initialData, sellers, sellerId);
        if (resolvedLogo) {
          const formatted = formatSignatureUrl(resolvedLogo) || resolvedLogo;
          if (formatted && formatted !== companyLogoUrl && !companyLogoUrl.startsWith('blob:')) {
            setCompanyLogoUrl(formatted);
          } else if (!companyLogoUrl && formatted) {
            setCompanyLogoUrl(formatted);
          }
        }
      }
      return;
    }

    if (isIncomingRealProforma && currentIncomingDocId) {
      hasLoadedRealProformaRef.current = true;
      setDraftId(currentIncomingDocId);
    } else if (!isIncomingRealProforma) {
      setDraftId('');
    }
    isFormInitializedRef.current = true;
    lastLoadedDocIdRef.current = currentIncomingDocId || sanitizeDocId(draftId || proformaId) || '';

    // Header & Watermark toggles sync
    if (initialData.header_enabled !== undefined) {
      setLetterhead(Boolean(initialData.header_enabled));
    } else if (initialData.letterhead !== undefined) {
      setLetterhead(Boolean(initialData.letterhead));
    } else if (initialData.letterhead_space !== undefined) {
      setLetterhead(Boolean(initialData.letterhead_space));
    }

    if (initialData.is_watermark_enabled !== undefined) {
      setWatermark(Boolean(initialData.is_watermark_enabled));
    } else if (initialData.watermark !== undefined) {
      setWatermark(Boolean(initialData.watermark));
    }

    if (initialData.invoice_number || initialData.invoice_no) {
      setInvoiceNumber(safeString(initialData.invoice_number || initialData.invoice_no));
    }
    if (initialData.invoice_date) {
      setInvoiceDate(safeString(initialData.invoice_date).slice(0, 10));
    } else if (hasDocChanged) {
      setInvoiceDate('');
    }
    const resolvedInstId = extractSellerInstructionId(initialData, sellers);
    if (
      initialData.registration_number ||
      initialData.gst_number ||
      initialData?.seller?.gst ||
      initialData?.seller?.registration_number
    ) {
      setGstNumber(
        resolveGstString(
          initialData.registration_number ||
            initialData.gst_number ||
            initialData?.seller?.gst ||
            initialData?.seller?.registration_number
        )
      );
    } else if (!gstNumber) {
      const sId = resolvedInstId || sellerId;
      const matchedSeller = sellers?.find(
        (s: any) =>
          String(s.id || s._id || s.instruction_id || s.value) === String(sId)
      );
      if (matchedSeller?.gst || matchedSeller?.registration_number || matchedSeller?.gst_number) {
        setGstNumber(resolveGstString(matchedSeller.gst || matchedSeller.registration_number || matchedSeller.gst_number));
      }
    }
    if (initialData.buyer_order_no_date || initialData.buyer_order_no) {
      setBuyerOrderNoDate(safeString(initialData.buyer_order_no_date || initialData.buyer_order_no));
    }
    const rawOtherRef =
      initialData?.other_reference ??
      initialData?.other_references ??
      initialData?.otherReference ??
      initialData?.otherReferences ??
      initialData?.proforma?.other_reference ??
      initialData?.proforma?.other_references ??
      initialData?.contract?.other_reference ??
      initialData?.contract?.other_references ??
      initialData?.data?.other_reference ??
      initialData?.data?.other_references;
    if (rawOtherRef !== undefined && rawOtherRef !== null && String(rawOtherRef).trim() !== '') {
      setOtherReferences(safeString(rawOtherRef));
    }
    if (
      initialData.purchase_order_no ||
      initialData.po_number ||
      initialData.contract_number ||
      initialData.contract_no ||
      initialData.confirmation_number
    ) {
      setPurchaseOrderNo(
        safeString(
          initialData.purchase_order_no ||
            initialData.po_number ||
            initialData.contract_number ||
            initialData.contract_no ||
            initialData.confirmation_number,
          ''
        )
      );
    }
    if (initialData.contract_date || initialData.confirmation_date) {
      const d = initialData.contract_date || initialData.confirmation_date;
      setContractDate(safeString(d).slice(0, 10));
    }

    // Seller / Exporter
    if (resolvedInstId) {
      setSellerInstructionId(resolvedInstId);
      setSellerId(resolvedInstId);
    }
    const resolvedCompanyName = extractSellerCompanyName(initialData, sellers, resolvedInstId || sellerId);
    if (resolvedCompanyName) {
      setCompanyName(resolvedCompanyName);
    }

    if (initialData.seller_details || initialData.seller_instruction) {
      if (typeof initialData.seller_details === 'object') {
        const addr = initialData.seller_details.address || initialData.seller_details.instruction || initialData.seller_details.details;
        const cName = initialData.seller_details.company_name || initialData.seller_details.name || resolvedCompanyName;
        const combined = formatPartyDetails(cName, addr);
        if (combined && combined.trim()) setSellerDetails(combined);
      } else {
        const raw = initialData.seller_details || initialData.seller_instruction;
        const clean = dedupePartyDetails(raw);
        if (clean && clean.trim()) setSellerDetails(clean);
      }
    }

    // Buyer / Consignee (strictly extracted, never defaulting to buyers[0])
    const buyerInfo = extractBuyerInfo(initialData, buyers);
    if (buyerInfo.id) setBuyerId(buyerInfo.id);
    if (buyerInfo.name) setBuyerName(buyerInfo.name);
    if (buyerInfo.details) setBuyerDetails(buyerInfo.details);

    // Delivery & Shipping Terms
    const delTerms = extractDeliveryTerms(initialData, paymentTerms);
    if (delTerms) setTermsDeliveryPayment(delTerms);

    const portLoad = extractPortDisplayName(
      initialData.port_of_loading || initialData.loading_port,
      safeString(initialData.loading_port_name, '')
    );
    if (portLoad) setPortOfLoading(portLoad);

    const portDest = extractPortDisplayName(
      initialData.port_of_destination || initialData.destination_port,
      safeString(initialData.destination_port_name, '')
    );
    if (portDest) {
      setPortOfDestination(portDest);
      const finDest = extractPortDisplayName(
        initialData.final_destination || initialData.destination_port,
        safeString(initialData.destination_port_name || initialData.port_of_destination, portDest)
      );
      setFinalDestination(finDest);
    }

    // Loading Port Country for Place of Receipt and Country of Origin: loading_port.country.name
    const resolvedLoadingCountry = extractLoadingPortCountry(initialData, products);
    if (resolvedLoadingCountry) {
      setPlaceOfReceipt(resolvedLoadingCountry);
      setCountryOfOrigin(resolvedLoadingCountry);
    } else {
      const rec = safeString(initialData.place_of_receipt);
      const orig = safeString(initialData.country_of_origin || initialData.origin_country || initialData.product_country);
      if (rec) setPlaceOfReceipt(rec);
      if (orig) setCountryOfOrigin(orig);
    }

    // Destination Port Country for Country of Final Destination: destination_port.country.name
    const resolvedDestCountry = extractDestinationPortCountry(initialData);
    if (resolvedDestCountry) {
      setCountryOfDestination(resolvedDestCountry);
    } else if (initialData.country_of_destination || initialData.destination_country || initialData.destination_port_country) {
      setCountryOfDestination(safeString(initialData.country_of_destination || initialData.destination_country || initialData.destination_port_country));
    }

    // Vessel / Voyage No
    const vNo = extractVesselVoyageNo(initialData);
    if (vNo) setVesselVoyageNo(vNo);

    // Pre-Carriage By
    const preCarriage =
      initialData.pre_carriage_by ||
      initialData.pre_carriage ||
      initialData.preCarriageBy ||
      initialData.container_type ||
      initialData.ship_by;
    if (preCarriage) {
      const raw =
        initialData.pre_carriage_by ||
        initialData.pre_carriage ||
        initialData.preCarriageBy ||
        initialData.container_type ||
        (initialData.ship_by ? `BY ${safeString(initialData.ship_by)}` : '');
      if (raw) setPreCarriageBy(formatPreCarriageBy(raw, ''));
    }

    // Quantity, Price, Currency
    if (initialData.quantity_mt || initialData.mt_quantity || initialData.quantity) {
      setQuantityMt(initialData.quantity_mt || initialData.mt_quantity || initialData.quantity || '');
    }
    const rawCur =
      initialData.currency ||
      initialData.currency_code ||
      initialData.currencyCode ||
      initialData.currency_id ||
      initialData.currencyId;
    if (rawCur) {
      setCurrency(normalizeCurrencyOption(rawCur, currencies).value || normalizeCurrencyCode(rawCur));
    }
    if (initialData.rate_price !== undefined || initialData.price !== undefined || initialData.rate !== undefined) {
      const rawR = initialData.rate_price ?? initialData.price ?? initialData.rate;
      if (rawR !== undefined && rawR !== null && String(rawR).trim() !== '') {
        setRatePrice(String(rawR).trim().replace(/,/g, ''));
      }
    }
    if (initialData.fcl_quantity) {
      const typeStr = initialData.fcl_type ? ` ${safeString(initialData.fcl_type)}` : '';
      setCountVessel(`${safeString(initialData.fcl_quantity)}${typeStr} FCLS`);
    } else if (initialData.count_vessel) {
      setCountVessel(safeString(initialData.count_vessel));
    }
    const rawAdv =
      initialData?.advance_payment_amt ??
      initialData?.advance_payment ??
      initialData?.advance_amount ??
      initialData?.advancePaymentAmt ??
      initialData?.advancePayment ??
      initialData?.advanceAmount ??
      initialData?.proforma?.advance_payment_amt ??
      initialData?.proforma?.advance_payment ??
      initialData?.proforma?.advance_amount ??
      initialData?.contract?.advance_payment_amt ??
      initialData?.contract?.advance_payment ??
      initialData?.contract?.advance_amount ??
      initialData?.data?.advance_payment_amt ??
      initialData?.data?.advance_payment ??
      initialData?.data?.advance_amount;
    if (rawAdv !== undefined && rawAdv !== null && String(rawAdv).trim() !== '') {
      setAdvancePayment(String(rawAdv).trim().replace(/,/g, ''));
    }

    // Bank charges note
    const bNote = extractBankChargesNote(initialData);
    if (bNote) setBankChargesNote(bNote);

    // Shipping term
    const sTerm = extractShippingTerm(initialData, shippingTerms);
    if (sTerm) setShippingTerm(sTerm);

    // Goods description (clean without static text)
    const gDesc = extractGoodsDescription(initialData);
    if (gDesc) setGoodsDescription(gDesc);

    if (isIncomingRealProforma) {
      const incomingBankId = safeString(
        initialData?.bank_details_id ??
          initialData?.bankDetailsId ??
          initialData?.proforma?.bank_details_id ??
          initialData?.data?.bank_details_id ??
          initialData?.bank_account_id ??
          initialData?.bankAccountId ??
          initialData?.bank_id ??
          initialData?.bankId
      );
      if (incomingBankId) {
        setSelectedBankId(incomingBankId);
      } else if (hasDocChanged || isDataVersionTriggered) {
        setSelectedBankId('');
      }
      const incomingBankDetails = safeString(
        initialData?.bank_details ??
          initialData?.bankAccountDetails ??
          initialData?.bank_account_details ??
          initialData?.account_details ??
          initialData?.proforma?.bank_details ??
          initialData?.data?.bank_details
      );
      if (incomingBankDetails) {
        setBankAccountDetails(incomingBankDetails);
      } else if (!incomingBankId && (hasDocChanged || isDataVersionTriggered)) {
        setBankAccountDetails('');
      }
    } else {
      // Never auto-select or inherit bank details from Contract / Confirmation fallback data
      setSelectedBankId('');
      setBankAccountDetails('');
    }
    const resolvedSig = resolveSignatureValue(initialData, sellers, sellerId);
    if (resolvedSig && !hasUserClearedSignatureRef.current) {
      const formatted = formatSignatureUrl(resolvedSig);
      setStampImageUrl((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
    }
    const initialLabel =
      initialData.seller_signature_label ||
      initialData.authority_signature_title ||
      initialData.authorised_signature_title ||
      initialData.authority_title;
    if (initialLabel) {
      setAuthoritySignatureTitle(safeString(initialLabel));
    }
    if (!hasUserClearedLogoRef.current) {
      const resolvedInitLogo = resolveSellerLogoValue(initialData, sellers, sellerId);
      if (resolvedInitLogo) {
        setCompanyLogoUrl(formatSignatureUrl(resolvedInitLogo) || resolvedInitLogo);
      }
    }
    const cLabel = safeString(
      initialData.comment_label ||
      initialData.comment_title ||
      initialData.commentLabel ||
      initialData.commentTitle,
      ''
    );
    setCommentLabel(cLabel);

    const cVal = safeString(
      initialData.comment_value ||
      initialData.comment_text ||
      initialData.commentValue ||
      initialData.commentText,
      ''
    );
    setCommentValue(cVal);
    const titleFromInit =
      initialData.pdf_title ||
      initialData.pdfTitle ||
      initialData.document_title ||
      initialData.documentTitle ||
      initialData.title;
    if (titleFromInit) {
      setDocumentTitle(safeString(titleFromInit, 'PROFORMA INVOICE'));
    }
  }, [initialData, dataVersion, sellers, buyers, products]);

  // Handle Logo Upload & Removal
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      hasUserClearedLogoRef.current = false;
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setCompanyLogoUrl(previewUrl);
      markDirty();
    }
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    hasUserClearedLogoRef.current = true;
    setLogoFile(null);
    setCompanyLogoUrl('');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
    markDirty();
    toast.info('Company logo removed');
  };

  const getEffectiveProformaId = useCallback(() => {
    const cleanContractId = sanitizeDocId(contractId || initialData?.contract_id || initialData?.contractId);
    const cleanConfId = sanitizeDocId(confirmationId || initialData?.confirmation_id || initialData?.confirmationId);

    // 1. Direct explicit proforma draft ID or prop
    const cleanDraft = sanitizeDocId(draftId);
    if (
      cleanDraft &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanDraft)
    ) {
      return cleanDraft;
    }

    const cleanProp = sanitizeDocId(proformaId);
    if (
      cleanProp &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanProp)
    ) {
      return cleanProp;
    }

    // 2. Stepper proforma step
    const proformaStep = getProformaStep(steps, selectedStep);
    if (proformaStep) {
      const stepId = sanitizeDocId(
        getStepSelfId(proformaStep) ||
        extractStepRedirectId(proformaStep) ||
        extractStepId(proformaStep) ||
        proformaStep.redirect_id ||
        (proformaStep as any).redirectId ||
        proformaStep.proforma_id ||
        (proformaStep as any).proformaId ||
        proformaStep.proforma_invoice_id ||
        (proformaStep as any).proformaInvoiceId
      );
      if (
        stepId &&
        stepId !== cleanContractId &&
        stepId !== cleanConfId &&
        !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(stepId)
      ) {
        return stepId;
      }
    }

    // 3. Explicit proforma keys on initialData
    const pId = sanitizeDocId(
      initialData?.proforma_id ||
      initialData?.proformaId ||
      initialData?.proforma_invoice_id ||
      initialData?.proformaInvoiceId ||
      initialData?.proforma?.id ||
      initialData?.proforma?._id
    );
    if (
      pId &&
      pId !== cleanContractId &&
      pId !== cleanConfId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(pId)
    ) {
      return pId;
    }

    // 4. InitialData id/_id (strictly ensuring it is not the parent contract or confirmation ID, and is a real proforma record)
    const isConfOrContractRecord = Boolean(
      initialData?.confirmation_number ||
      initialData?.confirmation_date ||
      initialData?.contract_number ||
      initialData?.contract_no
    );
    const hasProformaMarkers = Boolean(
      initialData?.invoice_number ||
      initialData?.invoice_no ||
      initialData?._is_proforma_loaded
    );
    if (!isConfOrContractRecord && hasProformaMarkers) {
      const dataId = sanitizeDocId(initialData?.id || initialData?._id);
      if (
        dataId &&
        dataId !== cleanContractId &&
        dataId !== cleanConfId &&
        !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(dataId)
      ) {
        return dataId;
      }
    }

    // 5. Fallback candidate from contract or confirmation for linked workflow backend submission
    if (cleanContractId && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(cleanContractId)) {
      return cleanContractId;
    }

    if (cleanConfId && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(cleanConfId)) {
      return cleanConfId;
    }

    return '';
  }, [draftId, proformaId, steps, selectedStep, initialData, contractId, confirmationId]);

  /**
   * Constructs the complete multipart/form-data payload for Proforma Save As Draft / Submit API,
   * matching ContractDocumentForm.
   * Signatures are converted to binary files (seller_signature, signature, authorised_signature)
   * and keys (including other_reference) are explicitly included.
   */
  const getProformaFormData = useCallback((): FormData => {
    const formData = new FormData();
    const activeDocId = getEffectiveProformaId();
    const cleanContractId = sanitizeDocId(contractId);
    const cleanConfId = sanitizeDocId(confirmationId);

    const effectiveId =
      activeDocId ||
      cleanContractId ||
      cleanConfId ||
      (draftId && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(draftId) ? draftId : '');

    if (effectiveId && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(effectiveId)) {
      formData.append('id', effectiveId);
      formData.append('proforma_id', effectiveId);
      formData.append('proforma_invoice_id', effectiveId);
    }

    if (cleanContractId) {
      formData.append('contract_id', cleanContractId);
    }
    if (cleanConfId) {
      formData.append('confirmation_id', cleanConfId);
    }

    const titleVal = safeString(documentTitle).trim() || 'PROFORMA INVOICE';
    formData.append('pdf_title', titleVal);
    formData.append('pdfTitle', titleVal);
    formData.append('document_title', titleVal);
    formData.append('documentTitle', titleVal);
    formData.append('title', titleVal);

    formData.append('letterhead_space', String(Boolean(letterhead)));
    formData.append('header_enabled', String(Boolean(letterhead)));
    formData.append('letterhead', String(Boolean(letterhead)));

    formData.append('is_watermark_enabled', String(Boolean(watermark)));
    formData.append('watermark', String(Boolean(watermark)));

    formData.append('company_name', safeString(companyName));
    formData.append('seller_name', safeString(companyName));
    formData.append('seller_id', safeString(sellerId));
    formData.append('seller_details', safeString(formatPartyDetails(companyName, sellerDetails)));

    const effectiveSellerInstId = sellerInstructionId || sellerId || '';
    if (effectiveSellerInstId) {
      formData.append('seller_instruction_id', effectiveSellerInstId);
      formData.append('instruction_id', effectiveSellerInstId);
    }

    formData.append('buyer_id', safeString(buyerId));
    formData.append('buyer_name', safeString(buyerName));
    formData.append('buyer_details', safeString(formatPartyDetails(buyerName, buyerDetails)));
    if (buyerId) {
      formData.append('buyer_instruction_id', safeString(buyerId));
    }

    formData.append('invoice_number', safeString(invoiceNumber));
    formData.append('invoice_no', safeString(invoiceNumber));

    formData.append('gst_number', safeString(gstNumber));
    formData.append('registration_number', safeString(gstNumber));
    formData.append('gst_label', safeString(gstNumber).includes('\n') ? safeString(gstNumber).split('\n')[0] : 'GST Number:');
    formData.append('registration_label', safeString(gstNumber).includes('\n') ? safeString(gstNumber).split('\n')[0] : 'Registration Number:');

    formData.append('invoice_date', safeString(invoiceDate));
    formData.append('buyer_order_no_date', safeString(buyerOrderNoDate));
    formData.append('buyer_order_no', safeString(buyerOrderNoDate));

    formData.append('purchase_order_no', safeString(purchaseOrderNo));
    formData.append('po_number', safeString(purchaseOrderNo));
    formData.append('contract_date', safeString(contractDate));

    // OTHER REFERENCE: Strictly support other_reference and other_references
    const cleanOtherRef = safeString(otherReferences);
    formData.append('other_reference', cleanOtherRef);
    formData.append('other_references', cleanOtherRef);
    formData.append('otherReference', cleanOtherRef);
    formData.append('otherReferences', cleanOtherRef);

    formData.append('pre_carriage_by', formatPreCarriageBy(preCarriageBy, 'BY SEA'));
    formData.append('place_of_receipt', safeString(placeOfReceipt));
    formData.append('country_of_origin', safeString(countryOfOrigin));
    formData.append('country_of_destination', safeString(countryOfDestination));
    formData.append('vessel_voyage_no', safeString(vesselVoyageNo, ''));
    formData.append('port_of_loading', safeString(portOfLoading));
    formData.append('terms_of_delivery_payment', safeString(termsDeliveryPayment));
    formData.append('shipping_term', safeString(shippingTerm));
    formData.append('shipping_terms', safeString(shippingTerm));
    formData.append('port_of_destination', safeString(portOfDestination));
    formData.append('final_destination', safeString(finalDestination));
    formData.append('count_vessel', safeString(countVessel));
    formData.append('goods_description', safeString(goodsDescription));

    const numQty = parseFloat(String(quantityMt || 0).replace(/,/g, '')) || 0;
    formData.append('quantity_mt', String(numQty));
    formData.append('quantity', String(numQty));
    formData.append('mt_quantity', String(numQty));

    const cleanCurr = safeString(currency, 'USD');
    formData.append('currency', cleanCurr);

    const numRate = parseFloat(String(ratePrice || 0).replace(/,/g, '')) || 0;
    formData.append('rate_price', String(numRate));
    formData.append('rate', String(numRate));
    formData.append('price', String(numRate));

    formData.append('item_amount', String(computedItemAmount));

    const numAdv = parseFloat(String(advancePayment || 0).replace(/,/g, '')) || 0;
    formData.append('advance_payment', String(numAdv));
    formData.append('advance_payment_amt', String(numAdv));
    formData.append('advance_amount', String(numAdv));

    formData.append('total_amount', String(computedTotal));
    formData.append('amount_in_words', safeString(effectiveAmountInWords));

    if (selectedBankId && !/^select bank account$/i.test(selectedBankId.trim())) {
      formData.append('bank_details_id', safeString(selectedBankId));
      formData.append('bank_account_id', safeString(selectedBankId));
    }
    if (bankAccountDetails) {
      formData.append('bank_details', safeString(bankAccountDetails));
    }

    const cleanDisclaimer = safeString(bankChargesNote);
    formData.append('disclaimer', cleanDisclaimer);
    formData.append('bank_charges_note', cleanDisclaimer);
    formData.append('bank_charges', cleanDisclaimer);
    formData.append('comment_label', safeString(commentLabel).slice(0, 20));
    formData.append('comment_value', safeString(commentValue));
    formData.append('comment_title', safeString(commentLabel).slice(0, 20));
    formData.append('comment_text', safeString(commentValue));

    // Seller Logo (seller_logo ONLY - NEVER send company_logo in FormData to prevent multer unexpected field error):
    if (logoFile) {
      formData.append('seller_logo', logoFile);
      formData.append('remove_seller_logo', 'false');
    } else if (companyLogoUrl && !hasUserClearedLogoRef.current && !companyLogoUrl.startsWith('blob:')) {
      const cleanLogo = normalizeSignaturePayload(companyLogoUrl) || safeString(companyLogoUrl);
      formData.append('seller_logo', cleanLogo);
      formData.append('seller_logo_url', cleanLogo);
      formData.append('remove_seller_logo', 'false');
    } else if (hasUserClearedLogoRef.current || !companyLogoUrl) {
      formData.append('remove_seller_logo', 'true');
      formData.append('seller_logo', '');
      formData.append('seller_logo_url', '');
    }

    // SIGNATURE IMPLEMENTATION - 100% IDENTICAL TO CONTRACT:
    formData.append('authority_signature_title', safeString(authoritySignatureTitle));
    formData.append('authorised_signature_title', safeString(authoritySignatureTitle));
    formData.append('seller_signature_label', safeString(authoritySignatureTitle));
    formData.append('seller_signature_field', safeString(companyName));

    if (stampImageUrl && !hasUserClearedSignatureRef.current) {
      if (stampImageUrl.startsWith('data:') || stampImageUrl.startsWith('blob:')) {
        const file = dataUrlToFile(stampImageUrl, 'seller_signature.png');
        if (file) {
          formData.append('seller_signature', file);
        }
      } else {
        const relUrl = normalizeSignaturePayload(stampImageUrl);
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
    }

    return formData;
  }, [
    getEffectiveProformaId,
    draftId,
    proformaId,
    contractId,
    confirmationId,
    documentTitle,
    letterhead,
    watermark,
    companyName,
    companyLogoUrl,
    logoFile,
    sellerId,
    sellerDetails,
    buyerId,
    buyerName,
    buyerDetails,
    invoiceNumber,
    gstNumber,
    invoiceDate,
    buyerOrderNoDate,
    purchaseOrderNo,
    contractDate,
    otherReferences,
    preCarriageBy,
    placeOfReceipt,
    countryOfOrigin,
    countryOfDestination,
    vesselVoyageNo,
    portOfLoading,
    termsDeliveryPayment,
    shippingTerm,
    portOfDestination,
    finalDestination,
    countVessel,
    goodsDescription,
    quantityMt,
    currency,
    ratePrice,
    computedItemAmount,
    advancePayment,
    computedTotal,
    effectiveAmountInWords,
    selectedBankId,
    bankAccountDetails,
    stampImageUrl,
    authoritySignatureTitle,
    bankChargesNote,
    commentLabel,
    commentValue,
  ]);

  // Construct Plain Object Payload
  const buildPayload = useCallback(() => {
    const activeDocId = getEffectiveProformaId();
    const cleanContractId = sanitizeDocId(contractId);
    const cleanConfId = sanitizeDocId(confirmationId);
    const effectiveId =
      activeDocId ||
      cleanContractId ||
      cleanConfId ||
      (draftId && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(draftId) ? draftId : '');
    const validEffectiveId =
      effectiveId && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(effectiveId)
        ? effectiveId
        : undefined;

    const titleVal = safeString(documentTitle).trim() || 'PROFORMA INVOICE';
    const effectiveSellerInstId = sellerInstructionId || sellerId || '';
    return {
      id: validEffectiveId,
      proforma_id: validEffectiveId,
      proforma_invoice_id: validEffectiveId,
      contract_id: cleanContractId || undefined,
      confirmation_id: cleanConfId || undefined,
      seller_instruction_id: effectiveSellerInstId || undefined,
      instruction_id: effectiveSellerInstId || undefined,
      buyer_instruction_id: safeString(buyerId) || undefined,
      pdf_title: titleVal,
      pdfTitle: titleVal,
      document_title: titleVal,
      documentTitle: titleVal,
      title: titleVal,
      letterhead_space: Boolean(letterhead),
      header_enabled: Boolean(letterhead),
      letterhead: Boolean(letterhead),
      is_watermark_enabled: Boolean(watermark),
      watermark: Boolean(watermark),
      company_name: safeString(companyName),
      seller_logo: (!hasUserClearedLogoRef.current && companyLogoUrl && !companyLogoUrl.startsWith('blob:'))
        ? (normalizeSignaturePayload(companyLogoUrl) || safeString(companyLogoUrl))
        : '',
      seller_logo_url: (!hasUserClearedLogoRef.current && companyLogoUrl && !companyLogoUrl.startsWith('blob:'))
        ? (normalizeSignaturePayload(companyLogoUrl) || safeString(companyLogoUrl))
        : '',
      remove_seller_logo: hasUserClearedLogoRef.current || !companyLogoUrl,
      seller_id: safeString(sellerId),
      seller_name: safeString(companyName),
      seller_details: safeString(formatPartyDetails(companyName, sellerDetails)),
      buyer_id: safeString(buyerId),
      buyer_name: safeString(buyerName),
      buyer_details: safeString(formatPartyDetails(buyerName, buyerDetails)),
      invoice_number: safeString(invoiceNumber),
      gst_number: safeString(gstNumber),
      registration_number: safeString(gstNumber),
      gst_label: safeString(gstNumber).includes('\n') ? safeString(gstNumber).split('\n')[0] : 'GST Number:',
      registration_label: safeString(gstNumber).includes('\n') ? safeString(gstNumber).split('\n')[0] : 'Registration Number:',
      invoice_date: safeString(invoiceDate),
      buyer_order_no_date: safeString(buyerOrderNoDate),
      buyer_order_no: safeString(buyerOrderNoDate),
      purchase_order_no: safeString(purchaseOrderNo),
      contract_date: safeString(contractDate),
      other_reference: safeString(otherReferences),
      other_references: safeString(otherReferences),
      otherReference: safeString(otherReferences),
      otherReferences: safeString(otherReferences),
      pre_carriage_by: formatPreCarriageBy(preCarriageBy, 'BY SEA'),
      place_of_receipt: safeString(placeOfReceipt),
      country_of_origin: safeString(countryOfOrigin),
      country_of_destination: safeString(countryOfDestination),
      vessel_voyage_no: safeString(vesselVoyageNo, ''),
      port_of_loading: safeString(portOfLoading),
      terms_of_delivery_payment: safeString(termsDeliveryPayment),
      shipping_term: safeString(shippingTerm),
      shipping_terms: safeString(shippingTerm),
      port_of_destination: safeString(portOfDestination),
      final_destination: safeString(finalDestination),
      count_vessel: safeString(countVessel),
      goods_description: safeString(goodsDescription),
      quantity_mt: parseFloat(String(quantityMt || 0).replace(/,/g, '')) || 0,
      currency: safeString(currency, 'USD'),
      rate_price: parseFloat(String(ratePrice || 0).replace(/,/g, '')) || 0,
      item_amount: computedItemAmount,
      advance_payment: parseFloat(String(advancePayment || 0).replace(/,/g, '')) || 0,
      advance_payment_amt: parseFloat(String(advancePayment || 0).replace(/,/g, '')) || 0,
      advance_amount: parseFloat(String(advancePayment || 0).replace(/,/g, '')) || 0,
      total_amount: computedTotal,
      amount_in_words: effectiveAmountInWords,
      bank_details_id: (selectedBankId && !/^select bank account$/i.test(selectedBankId.trim())) ? safeString(selectedBankId) : undefined,
      bank_account_id: (selectedBankId && !/^select bank account$/i.test(selectedBankId.trim())) ? safeString(selectedBankId) : undefined,
      bank_details: safeString(bankAccountDetails) || undefined,
      seller_signature_field: safeString(companyName),
      seller_signature_label: safeString(authoritySignatureTitle),
      authority_signature_title: safeString(authoritySignatureTitle),
      authorised_signature_title: safeString(authoritySignatureTitle),
      remove_seller_signature: !stampImageUrl || hasUserClearedSignatureRef.current,
      remove_signature: !stampImageUrl || hasUserClearedSignatureRef.current,
      stamp_image_url: safeString(stampImageUrl),
      authorised_signature: normalizeSignaturePayload(stampImageUrl) || safeString(stampImageUrl),
      authority_signature: normalizeSignaturePayload(stampImageUrl) || safeString(stampImageUrl),
      signature: normalizeSignaturePayload(stampImageUrl) || safeString(stampImageUrl),
      seller_signature: normalizeSignaturePayload(stampImageUrl) || safeString(stampImageUrl),
      stamp: normalizeSignaturePayload(stampImageUrl) || safeString(stampImageUrl),
      disclaimer: safeString(bankChargesNote),
      bank_charges_note: safeString(bankChargesNote),
      bank_charges: safeString(bankChargesNote),
      comment_label: safeString(commentLabel).slice(0, 20),
      comment_value: safeString(commentValue),
      comment_title: safeString(commentLabel).slice(0, 20),
      comment_text: safeString(commentValue),
    };
  }, [
    getEffectiveProformaId,
    draftId,
    proformaId,
    contractId,
    confirmationId,
    documentTitle,
    letterhead,
    watermark,
    companyName,
    companyLogoUrl,
    sellerId,
    sellerDetails,
    buyerId,
    buyerName,
    buyerDetails,
    invoiceNumber,
    gstNumber,
    invoiceDate,
    buyerOrderNoDate,
    purchaseOrderNo,
    contractDate,
    otherReferences,
    preCarriageBy,
    placeOfReceipt,
    countryOfOrigin,
    countryOfDestination,
    vesselVoyageNo,
    portOfLoading,
    termsDeliveryPayment,
    shippingTerm,
    portOfDestination,
    finalDestination,
    countVessel,
    goodsDescription,
    quantityMt,
    currency,
    ratePrice,
    computedItemAmount,
    advancePayment,
    computedTotal,
    effectiveAmountInWords,
    selectedBankId,
    bankAccountDetails,
    stampImageUrl,
    authoritySignatureTitle,
    bankChargesNote,
    commentLabel,
    commentValue,
  ]);

  // Client-side validation function for Proforma Invoice
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!invoiceNumber || !invoiceNumber.trim()) {
      newErrors.invoiceNumber = 'Invoice number is required';
    }
    if (!invoiceDate || !invoiceDate.trim()) {
      newErrors.invoiceDate = 'Please select a valid invoice date';
    }
    const cleanSelectedBankId = safeString(selectedBankId).trim();
    if (
      !cleanSelectedBankId ||
      /^select bank account$/i.test(cleanSelectedBankId) ||
      /^loading bank accounts/i.test(cleanSelectedBankId)
    ) {
      newErrors.selectedBankId = 'Please select a bank account';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      scrollToAndFocusProformaField(newErrors);
      const firstErrorMessage = Object.values(newErrors)[0];
      toast.error(firstErrorMessage || 'Please fill in all required fields');
      return false;
    }
    return true;
  };

  // Handle Save As Draft
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting) return;
    isSavingOrSubmittingRef.current = true;
    setIsSavingDraft(true);
    setErrors({});
    try {
      const formDataPayload = getProformaFormData();
      const plainPayload = buildPayload();
      let res: any;
      if (onSaveDraft) {
        res = await onSaveDraft(formDataPayload);
      } else {
        res = await saveProformaDraftAction(formDataPayload, lang, getEffectiveProformaId() || undefined);
      }

      if (!res) {
        toast.error('No response received while saving draft. Please retry.');
        return;
      }

      const hasFieldErrors = Boolean(
        (Array.isArray(res?.error_fields) && res.error_fields.length > 0) ||
        (Array.isArray(res?.errors) && res.errors.length > 0) ||
        (res?.errors && typeof res.errors === 'object' && Object.keys(res.errors).length > 0) ||
        (res?.error_fields && typeof res.error_fields === 'object' && Object.keys(res.error_fields).length > 0)
      );

      const isFailed = res?.success === false || res?.success === 0 || hasFieldErrors;

      if (isFailed) {
        const { fieldErrors, generalError } = parseProformaBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusProformaField(fieldErrors);
        }
        const firstFieldErr = Object.values(fieldErrors)[0];
        const isCleanToastMsg = (m?: any) =>
          Boolean(
            m &&
            typeof m === 'string' &&
            !/^(form validation error|validation error|bad request)$/i.test(m.trim()) &&
            !/^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(m.trim()) &&
            !/<(!DOCTYPE|html)/i.test(m)
          );
        const hasHighlightedFields = Object.keys(fieldErrors).length > 0;
        const toastMsg =
          (isCleanToastMsg(generalError) ? generalError : null) ||
          firstFieldErr ||
          (isCleanToastMsg(res?.message) ? res.message : null) ||
          (isCleanToastMsg(res?.error) ? res.error : null) ||
          (hasHighlightedFields
            ? 'Failed to save draft. Please check highlighted fields.'
            : 'Failed to save draft. Please try again.');
        toast.error(toastMsg);
        return;
      }

      const savedId = String(
        res?.id ||
        res?.data?.id ||
        res?.data?.proforma_id ||
        res?.data?.proforma_invoice_id ||
        draftId ||
        proformaId ||
        ''
      );
      if (savedId) {
        lastLoadedDocIdRef.current = savedId;
        setDraftId(savedId);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('id', savedId);
          url.searchParams.set('step', 'proforma');
          window.history.replaceState(null, '', url.toString());
        }
      }
      isFormInitializedRef.current = true;
      isUserDirtyRef.current = false;
      isDraftSavedToBackendRef.current = true;
      setIsDirty(false);
      setHasDraftChanges(false);
      setHasSubmitChanges(true);
      const statusFromRes = extractDocumentStatus(res?.data) || extractDocumentStatus(res);
      if (statusFromRes) {
        setDocStatus(statusFromRes);
      }
      setErrors({});
      toast.success(res?.message || 'Proforma Invoice saved as draft!');
      if (savedId) {
        const extracted =
          extractProformaData(res?.data) ||
          (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
        // Synchronize fresh signature URL from backend response if available (exactly like in Contract)
        const sSellerSig =
          extracted?.seller_signature ||
          extracted?.seller_signature_url ||
          extracted?.signature ||
          extracted?.authorised_signature ||
          extracted?.stamp_image_url ||
          res?.data?.seller_signature ||
          res?.data?.seller_signature_url ||
          res?.data?.signature ||
          res?.data?.authorised_signature ||
          res?.data?.stamp_image_url;

        if (hasUserClearedSignatureRef.current || !stampImageUrl) {
          setStampImageUrl('');
        } else if (sSellerSig) {
          setStampImageUrl(formatSignatureUrl(sSellerSig));
        }

        // Synchronize fresh seller logo URL from backend response if available
        const sSellerLogo =
          resolveSellerLogoValue(res?.data?.seller_details, sellers, sellerId) ||
          resolveSellerLogoValue(res?.seller_details, sellers, sellerId) ||
          resolveSellerLogoValue(extracted?.seller_details, sellers, sellerId) ||
          resolveSellerLogoValue(res?.data, sellers, sellerId) ||
          resolveSellerLogoValue(extracted, sellers, sellerId) ||
          resolveSellerLogoValue(res, sellers, sellerId) ||
          res?.data?.seller_details?.company_logo ||
          res?.seller_details?.company_logo ||
          extracted?.seller_details?.company_logo ||
          extracted?.seller_logo ||
          extracted?.seller_logo_url ||
          res?.data?.seller_logo ||
          res?.data?.seller_logo_url ||
          res?.data?.proforma?.seller_logo ||
          res?.data?.proforma?.seller_logo_url ||
          res?.data?.proforma_invoice?.seller_logo ||
          res?.data?.proforma_invoice?.seller_logo_url ||
          res?.data?.data?.seller_logo ||
          res?.data?.data?.seller_logo_url ||
          res?.seller_logo ||
          res?.seller_logo_url;

        let effectiveFinalLogo = companyLogoUrl || '';
        if (hasUserClearedLogoRef.current) {
          effectiveFinalLogo = '';
          setCompanyLogoUrl('');
          setLogoFile(null);
        } else if (sSellerLogo) {
          const formattedLogo = formatSignatureUrl(sSellerLogo) || sSellerLogo;
          if (formattedLogo) {
            effectiveFinalLogo = formattedLogo;
            setCompanyLogoUrl(formattedLogo);
            setLogoFile(null);
          }
        }

        const mergedSavedData = {
          ...plainPayload,
          ...extracted,
          seller_logo: effectiveFinalLogo,
          seller_logo_url: effectiveFinalLogo,
          id: savedId,
          proforma_id: savedId,
        };
        if (onSaveSuccess) {
          onSaveSuccess(savedId, mergedSavedData);
        }
      }
      return res;
    } catch (err: any) {
      console.error('[ProformaDocumentForm] Save draft error:', err);
      const { fieldErrors, generalError } = parseProformaBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusProformaField(fieldErrors);
      }
      const firstFieldErr = Object.values(fieldErrors)[0];
      const toastMsg =
        (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError) ? generalError : null) ||
        firstFieldErr ||
        (err?.message && !/^(form validation error|validation error|bad request)$/i.test(err.message) ? err.message : null) ||
        'Error occurred while saving draft. Please check highlighted fields.';
      toast.error(toastMsg);
    } finally {
      isSavingOrSubmittingRef.current = false;
      setIsSavingDraft(false);
    }
  };

  // Handle Submit Proforma
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft) return;

    if (!validateForm()) {
      return;
    }

    const submitTargetInfo = getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'proforma',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;
    const targetNextStepName = submitTargetInfo.nextStepName;

    isSavingOrSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    try {
      const formDataPayload = getProformaFormData();
      const plainPayload = buildPayload();
      let res: any;
      if (onSubmitProforma) {
        res = await onSubmitProforma(formDataPayload, getEffectiveProformaId() || undefined, targetNextStep);
      } else {
        res = await submitProformaAction(formDataPayload, lang, getEffectiveProformaId() || undefined);
      }

      if (!res) {
        toast.error('No response received while submitting proforma. Please retry.');
        return;
      }

      const hasFieldErrors = Boolean(
        (Array.isArray(res?.error_fields) && res.error_fields.length > 0) ||
        (Array.isArray(res?.errors) && res.errors.length > 0) ||
        (res?.errors && typeof res.errors === 'object' && Object.keys(res.errors).length > 0) ||
        (res?.error_fields && typeof res.error_fields === 'object' && Object.keys(res.error_fields).length > 0)
      );

      const isFailed = res?.success === false || res?.success === 0 || hasFieldErrors;

      if (isFailed) {
        const { fieldErrors, generalError } = parseProformaBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusProformaField(fieldErrors);
        }
        const firstFieldErr = Object.values(fieldErrors)[0];
        const isCleanToastMsg = (m?: any) =>
          Boolean(
            m &&
            typeof m === 'string' &&
            !/^(form validation error|validation error|bad request)$/i.test(m.trim()) &&
            !/^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(m.trim()) &&
            !/<(!DOCTYPE|html)/i.test(m)
          );
        const hasHighlightedFields = Object.keys(fieldErrors).length > 0;
        const toastMsg =
          (isCleanToastMsg(generalError) ? generalError : null) ||
          firstFieldErr ||
          (isCleanToastMsg(res?.message) ? res.message : null) ||
          (isCleanToastMsg(res?.error) ? res.error : null) ||
          (hasHighlightedFields
            ? 'Failed to submit Proforma Invoice. Please check highlighted fields.'
            : 'Failed to submit Proforma Invoice. Please try again.');
        toast.error(toastMsg);
        return;
      }

      const savedId = String(
        res?.id ||
        res?.data?.id ||
        res?.data?.proforma_id ||
        res?.data?.proforma_invoice_id ||
        draftId ||
        proformaId ||
        ''
      );
      if (savedId) {
        lastLoadedDocIdRef.current = savedId;
        setDraftId(savedId);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('id', savedId);
          url.searchParams.set('step', 'proforma');
          window.history.replaceState(null, '', url.toString());
        }
      }
      isFormInitializedRef.current = true;
      isUserDirtyRef.current = false;
      isDraftSavedToBackendRef.current = true;
      setIsDirty(false);
      setHasDraftChanges(false);
      setHasSubmitChanges(false);
      setDocStatus('COMPLETED');
      setErrors({});
      const successToast = getWorkflowSubmitToastMessage({
        currentDocName: 'Proforma Invoice',
        nextStepName: targetNextStepName,
      });
      toast.success(successToast);

      if (targetNextStep && onSelectStep && !onSubmitProforma) {
        onSelectStep(targetNextStep);
      }
      if (savedId) {
        const extracted =
          extractProformaData(res?.data) ||
          (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
        // Synchronize fresh signature URL from backend response if available (exactly like in Contract)
        const sSellerSig =
          extracted?.seller_signature ||
          extracted?.seller_signature_url ||
          extracted?.signature ||
          extracted?.authorised_signature ||
          extracted?.stamp_image_url ||
          res?.data?.seller_signature ||
          res?.data?.seller_signature_url ||
          res?.data?.signature ||
          res?.data?.authorised_signature ||
          res?.data?.stamp_image_url;

        if (hasUserClearedSignatureRef.current || !stampImageUrl) {
          setStampImageUrl('');
        } else if (sSellerSig) {
          setStampImageUrl(formatSignatureUrl(sSellerSig));
        }

        // Synchronize fresh seller logo URL from backend response if available
        const sSellerLogo =
          resolveSellerLogoValue(res?.data?.seller_details, sellers, sellerId) ||
          resolveSellerLogoValue(res?.seller_details, sellers, sellerId) ||
          resolveSellerLogoValue(extracted?.seller_details, sellers, sellerId) ||
          resolveSellerLogoValue(res?.data, sellers, sellerId) ||
          resolveSellerLogoValue(extracted, sellers, sellerId) ||
          resolveSellerLogoValue(res, sellers, sellerId) ||
          res?.data?.seller_details?.company_logo ||
          res?.seller_details?.company_logo ||
          extracted?.seller_details?.company_logo ||
          extracted?.seller_logo ||
          extracted?.seller_logo_url ||
          res?.data?.seller_logo ||
          res?.data?.seller_logo_url ||
          res?.data?.proforma?.seller_logo ||
          res?.data?.proforma?.seller_logo_url ||
          res?.data?.proforma_invoice?.seller_logo ||
          res?.data?.proforma_invoice?.seller_logo_url ||
          res?.data?.data?.seller_logo ||
          res?.data?.data?.seller_logo_url ||
          res?.seller_logo ||
          res?.seller_logo_url;

        let effectiveFinalLogo = companyLogoUrl || '';
        if (hasUserClearedLogoRef.current) {
          effectiveFinalLogo = '';
          setCompanyLogoUrl('');
          setLogoFile(null);
        } else if (sSellerLogo) {
          const formattedLogo = formatSignatureUrl(sSellerLogo) || sSellerLogo;
          if (formattedLogo) {
            effectiveFinalLogo = formattedLogo;
            setCompanyLogoUrl(formattedLogo);
            setLogoFile(null);
          }
        }

        const mergedSavedData = {
          ...plainPayload,
          ...extracted,
          seller_logo: effectiveFinalLogo,
          seller_logo_url: effectiveFinalLogo,
          id: savedId,
          proforma_id: savedId,
        };
        if (onSaveSuccess) {
          onSaveSuccess(savedId, mergedSavedData);
        }
      }
      return res;
    } catch (err: any) {
      console.error('[ProformaDocumentForm] Submit error:', err);
      const { fieldErrors, generalError } = parseProformaBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusProformaField(fieldErrors);
      }
      const firstFieldErr = Object.values(fieldErrors)[0];
      const toastMsg =
        (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError) ? generalError : null) ||
        firstFieldErr ||
        (err?.message && !/^(form validation error|validation error|bad request)$/i.test(err.message) ? err.message : null) ||
        'Error occurred while submitting invoice. Please check highlighted fields.';
      toast.error(toastMsg);
    } finally {
      isSavingOrSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Track whether proforma has been explicitly saved to the backend at least once
  const isDraftSavedToBackendRef = useRef<boolean>(
    Boolean(
      initialData?.proforma_id ||
      initialData?.proforma_invoice_id ||
      initialData?.invoice_number ||
      initialData?.invoice_no
    )
  );

  // Handle Print Preview
  const handleOpenPrintPreview = async () => {
    let effectiveId = getEffectiveProformaId();

    // Auto-save draft if no ID exists, user made unsaved changes, or document not yet persisted
    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getProformaFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await saveProformaDraftAction(formDataPayload, lang, effectiveId || undefined);
        }
        if (res?.success) {
          const newId = String(
            res.id ||
            res.data?.id ||
            res.data?._id ||
            res.data?.proforma_id ||
            res.data?.proforma_invoice_id ||
            res.proforma_id ||
            ''
          );
          if (newId) {
            setDraftId(newId);
            effectiveId = newId;
            isDraftSavedToBackendRef.current = true;
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            setIsDirty(false);
            if (onSaveSuccess) onSaveSuccess(newId, res.data);
          }
        }
      } catch (saveErr) {
        console.error('[ProformaDocumentForm] Auto-save before preview failed:', saveErr);
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

    setIsPrintPreviewOpen(true);
  };

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    let effectiveId = getEffectiveProformaId();

    // Auto-save draft if no ID exists, user made unsaved changes, or document not yet persisted
    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getProformaFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await saveProformaDraftAction(formDataPayload, lang, effectiveId || undefined);
        }
        if (res?.success) {
          const newId = String(
            res.id ||
            res.data?.id ||
            res.data?._id ||
            res.data?.proforma_id ||
            res.data?.proforma_invoice_id ||
            res.proforma_id ||
            ''
          );
          if (newId) {
            setDraftId(newId);
            effectiveId = newId;
            isDraftSavedToBackendRef.current = true;
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            setIsDirty(false);
            if (onSaveSuccess) onSaveSuccess(newId, res.data);
          }
        }
      } catch (saveErr) {
        console.error('[ProformaDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!effectiveId) {
      toast.error(
        dict?.smart_docs?.contract_form?.save_draft_first_download ||
        dict?.smart_docs?.confirmation_form?.save_draft_first_download ||
        'Please save as draft first before downloading PDF.'
      );
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const res = await downloadDocPdfAction({
        prefix: 'proforma',
        id: effectiveId,
        candidateIds: [
          effectiveId,
          draftId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x)),
        contractId,
        confirmationId,
        lang,
      });

      if (res?.success) {
        const numCandidate =
          invoiceNumber ||
          purchaseOrderNo ||
          initialData?.invoice_number ||
          initialData?.invoice_no ||
          effectiveId;

        const cleanNumber = String(numCandidate)
          .replace(/^#+/, '')
          .replace(/[/\\?%*:|"<>]/g, '-')
          .replace(/-+/g, '-')
          .trim();

        const downloadName = `PROFORMA-INVOICE-${cleanNumber}.pdf`;

        const downloaded = downloadPdfFromActionResponse(res, downloadName);
        if (downloaded) {
          toast.success(
            dict?.smart_docs?.pdf_download_success || 'Proforma Invoice PDF downloaded!'
          );
        } else {
          toast.error(res?.message || 'No PDF data received from server');
        }
      } else {
        toast.error(res?.message || res?.error || 'Failed to download PDF');
      }
    } catch (err: any) {
      console.error('[ProformaDocumentForm] Download PDF error:', err);
      toast.error(err?.message || 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const deliveryTermsDisplay = safeString(termsDeliveryPayment, '');
  const shippingTermHeader = formatShippingTermHeader(shippingTerm);

  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'proforma',
      isSubmitting,
      submittingText: dict?.smart_docs?.submitting || 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.proforma_form?.submit || dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  return (
    <div
      id="proforma-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollContainerRef}
        id="proforma-scroll-viewport"
        className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar"
      >
        {/* 
          TOP HEADER BAR:
          - Left: Round Company Logo (seller_logo) with Change & Remove
          - Center: Seller Name + PROFORMA INVOICE Title (Centered Properly)
          - Right: Letterhead on top, and Watermark underneath in proper vertical alignment
        */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 bg-card">
          {/* Left: Round Company Logo (seller_logo) */}
          <div className="flex items-center shrink-0 min-w-[50px] sm:w-[140px]">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {companyLogoUrl ? (
              <div className="relative group/logo shrink-0">
                {/* Round Avatar Container */}
                <div
                  onClick={() => !readOnly && logoInputRef.current?.click()}
                  title={readOnly ? 'Company Logo' : 'Click to change logo'}
                  className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 aspect-square rounded-full border-2 border-border/80 hover:border-primary/80 bg-background/90 hover:bg-background shadow-xs transition-all flex items-center justify-center overflow-hidden cursor-pointer group"
                >
                  <img
                    src={formatSignatureUrl(companyLogoUrl) || companyLogoUrl}
                    alt="Company Logo"
                    className="w-full h-full max-w-full max-h-full object-contain p-1.5 rounded-full filter drop-shadow-2xs select-none"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (companyLogoUrl && target.src !== companyLogoUrl && !companyLogoUrl.startsWith('blob:')) {
                        target.src = companyLogoUrl;
                      }
                    }}
                  />
                  {!readOnly && (
                    <div className="absolute inset-0 bg-black/45 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full backdrop-blur-[0.5px]">
                      <i className="fa-solid fa-camera text-[10px]" />
                      <span className="text-[7.5px] font-medium leading-none mt-0.5">Edit</span>
                    </div>
                  )}
                </div>

                {/* Corner Badges: Top-Right (Remove) & Bottom-Right (Edit) */}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      title="Remove logo"
                      aria-label="Remove logo"
                      className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-destructive text-white flex items-center justify-center shadow-xs text-[8px] hover:bg-destructive/90 hover:scale-110 transition-all cursor-pointer z-10"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      title="Change logo"
                      aria-label="Change logo"
                      className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs text-[7.5px] hover:bg-primary-hover hover:scale-110 transition-all cursor-pointer z-10"
                    >
                      <i className="fa-solid fa-camera" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div
                onClick={() => !readOnly && logoInputRef.current?.click()}
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-border/90 hover:border-primary/80 bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all shadow-2xs cursor-pointer group/avatar shrink-0"
                title={readOnly ? 'Company Logo' : 'Click to upload logo'}
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover/avatar:scale-110 transition-transform">
                  <i className="fa-regular fa-image text-[11px]" />
                </div>
                <span className="text-[7.5px] sm:text-[8px] font-bold text-muted-foreground group-hover/avatar:text-primary mt-0.5 tracking-wider uppercase leading-none">
                  LOGO
                </span>
              </div>
            )}
          </div>

          {/* Center: Seller Name & PROFORMA INVOICE Title (Centered Properly) */}
          <DocTitleInput
            value={documentTitle}
            onChange={(val) => {
              markDirty();
              setDocumentTitle(val);
              if (val.trim()) {
                setErrors((prev) => ({
                  ...prev,
                  documentTitle: '',
                  document_title: '',
                  pdf_title: '',
                  pdfTitle: '',
                  title: '',
                }));
              }
            }}
            companyName={companyName}
            disabled={readOnly}
            placeholder="PROFORMA INVOICE"
            ariaLabel="Document Title"
            error={
              errors.documentTitle ||
              errors.document_title ||
              errors.pdf_title ||
              errors.pdfTitle ||
              errors.title
            }
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Desktop Right: Letterhead on top, Watermark underneath in proper alignment */}
          <div className="hidden sm:flex flex-col items-end justify-center gap-1.5 shrink-0 min-w-[120px] sm:w-[140px]">
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

          {/* Mobile Right: Letterhead on top, Watermark underneath */}
          <div className="flex sm:hidden flex-col items-end gap-1.5 shrink-0">
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
          Strict Theme & Font-Size Compliance:
          - Every label: font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
          - Fields without input (Purchase Order No, Contract Date, Ports, Origin, Vessel, Count, Goods, etc.):
            Clean select-all text display with span/div, NO raw inputs that can be deleted!
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          {/* 
            ROW 1 & 2: 
            Left Side (37%): EXPORTER / SELLER (Top) & CONSIGNEE / BUYER (Bottom)
            Right Side (63%): Invoicing & Reference Info
          */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
            {/* LEFT COLUMN: Exporter (Top) & Importer (Bottom) */}
            <div className="w-full md:w-[37%] shrink-0 flex flex-col divide-y divide-border">
              {/* EXPORTER / SELLER: NON-INPUT TEXT DISPLAY ONLY */}
              <div className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-[140px] justify-start bg-card" id="field-sellerId" data-field="sellerId">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                  EXPORTER / SELLER:
                </label>

                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide px-0.5 whitespace-pre-line leading-relaxed select-all">
                  {formatPartyDetails(companyName, sellerDetails) || '-'}
                </div>
                {(errors.sellerId || errors.seller_id) && (
                  <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                    <span className="text-brand-red">{errors.sellerId || errors.seller_id}</span>
                  </span>
                )}
              </div>

              {/* IMPORTER (BUYER): NON-INPUT TEXT DISPLAY ONLY */}
              <div className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-[140px] justify-start bg-card" id="field-buyerId" data-field="buyerId">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                  CONSIGNEE / BUYER:
                </label>                

                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide px-0.5 whitespace-pre-line leading-relaxed select-all">
                  {formatPartyDetails(buyerName, buyerDetails) || '-'}
                </div>
                {(errors.buyerId || errors.buyer_id) && (
                  <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                    <span className="text-brand-red">{errors.buyerId || errors.buyer_id}</span>
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Invoicing & Reference Mini-Grids */}
            <div className="w-full md:w-[63%] min-w-0 flex-1 flex flex-col divide-y divide-border bg-card">
              {/* Row 1 & 2: INVOICE NO & INVOICE DATE + REGISTRATION NO / GST */}
              <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {/* Left Sub-Column (INVOICE NO & INVOICE DATE) */}
                <div className="sm:col-span-7 flex flex-col divide-y divide-border">
                  {/* INVOICE NO: */}
                  <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]" id="field-invoiceNumber" data-field="invoiceNumber">
                    <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                      INVOICE NO:
                    </label>
                    <div className="flex-1 min-w-0">
                      <DocUnderlineInput
                        id="invoice-number-input"
                        value={invoiceNumber}
                        onChange={(v) => {
                          markDirty();
                          setInvoiceNumber(v);
                          if (v.trim()) {
                            setErrors((prev) => ({ ...prev, invoiceNumber: '', invoice_number: '' }));
                          }
                        }}
                        error={errors.invoiceNumber || errors.invoice_number}
                        disabled={readOnly}
                        placeholder="Enter Invoice No"
                        icon="fa-solid fa-pen"
                        inputClassName="text-[14px] font-semibold"
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* INVOICE DATE: */}
                  <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]" id="field-invoiceDate" data-field="invoiceDate">
                    <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                      INVOICE DATE:
                    </label>
                    <div className="flex-1 min-w-0">
                      <DocUnderlineInput
                        id="field-invoiceDate-input"
                        type="date"
                        value={invoiceDate}
                        onChange={(v) => {
                          markDirty();
                          setInvoiceDate(v);
                          if (v.trim()) {
                            setErrors((prev) => ({ ...prev, invoiceDate: '', invoice_date: '' }));
                          }
                        }}
                        error={errors.invoiceDate || errors.invoice_date}
                        disabled={readOnly}
                        placeholder="Select Invoice Date"
                        icon="fa-regular fa-calendar"
                        inputClassName="text-[14px] font-semibold"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Sub-Column (Registration / GST Number) */}
                <div className="sm:col-span-5 p-2 sm:p-2.5 flex flex-col justify-between min-h-[80px]" id="field-gstNumber" data-field="gstNumber">
                  <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5 leading-tight">
                    REGISTRATION NO / GST:
                  </label>
                  <DocUnderlineInput
                    ref={gstInputRef}
                    id="field-gstNumber-input"
                    multiline
                    rows={2}
                    value={gstNumber}
                    onChange={(v) => {
                      markDirty();
                      setGstNumber(v);
                      if (v.trim()) {
                        setErrors((prev) => ({ ...prev, gstNumber: '', gst_number: '', registration_number: '' }));
                      }
                    }}
                    error={errors.gstNumber || errors.gst_number || errors.registration_number}
                    disabled={readOnly}
                    placeholder="Enter Registration / GST Number"
                    icon="fa-solid fa-pen"
                    uppercase={false}
                    inputClassName="text-[14px] font-semibold text-foreground resize-none leading-relaxed"
                    className="w-full mt-1"
                  />
                </div>
              </div>

              {/* Row 3: BUYER'S ORDER NO & DATE */}
              <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]" id="field-buyerOrderNoDate" data-field="buyerOrderNoDate">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  BUYER&apos;S ORDER NO &amp; DATE:
                </label>
                <div className="flex-1 min-w-0">
                  <DocUnderlineInput
                    id="field-buyerOrderNoDate-input"
                    value={buyerOrderNoDate}
                    onChange={(v) => {
                      markDirty();
                      setBuyerOrderNoDate(v);
                      if (v.trim()) {
                        setErrors((prev) => ({ ...prev, buyerOrderNoDate: '', buyer_order_no_date: '', buyer_order_no: '' }));
                      }
                    }}
                    error={errors.buyerOrderNoDate || errors.buyer_order_no_date || errors.buyer_order_no}
                    disabled={readOnly}
                    placeholder="Enter Order No & Date"
                    icon="fa-solid fa-pen"
                    inputClassName="text-[14px] font-semibold"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Row 4: PURCHASE ORDER NO */}
              <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]" id="field-purchaseOrderNo" data-field="purchaseOrderNo">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  PURCHASE ORDER NO:
                </label>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(purchaseOrderNo, '') || '-'}
                  </span>
                  {(errors.purchaseOrderNo || errors.purchase_order_no) && (
                    <span className="text-[11px] text-brand-red font-semibold ml-2 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                      <span className="text-brand-red">{errors.purchaseOrderNo || errors.purchase_order_no}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row 5: CONTRACT DATE */}
              <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]" id="field-contractDate" data-field="contractDate">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  CONTRACT DATE:
                </label>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(contractDate, '') || '-'}
                  </span>
                  {(errors.contractDate || errors.contract_date) && (
                    <span className="text-[11px] text-brand-red font-semibold ml-2 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                      <span className="text-brand-red">{errors.contractDate || errors.contract_date}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row 6: OTHER REFERENCE (S): Editable Input */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-other_reference"
                data-field="other_reference"
              >
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  OTHER REFERENCE (S):
                </label>
                <div className="flex-1 min-w-0">
                  <DocUnderlineInput
                    id="field-otherReferences-input"
                    name="other_reference"
                    value={otherReferences}
                    onChange={(v) => {
                      markDirty();
                      setOtherReferences(v);
                      if (v.trim()) {
                        setErrors((prev) => ({
                          ...prev,
                          other_reference: '',
                          otherReferences: '',
                          other_references: '',
                          otherReference: '',
                        }));
                      }
                    }}
                    error={errors.other_reference || errors.otherReferences || errors.other_references || errors.otherReference}
                    disabled={readOnly}
                    placeholder="Enter Other References"
                    icon="fa-solid fa-pen"
                    inputClassName="text-[14px] font-semibold"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 
            ROW 3: 4-COLUMN SHIPPING & ORIGIN ROW:
            Headers: font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: NON-INPUT DISPLAY VALUES (clean text, no <input> tags to remove)
          */}
          <div className="flex flex-col divide-y divide-border">
            {/* Header Row */}
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              {/* Left 37% Headers */}
              <div className="w-full md:w-[37%] shrink-0 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  PRE-CARRIAGE BY
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  PLACE OF RECEIPT<br className="hidden sm:inline" /> BY PRE-CARRIER
                </div>
              </div>

              {/* Right 63% Headers */}
              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  COUNTRY OF ORIGIN
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  COUNTRY OF DESTINATION
                </div>
              </div>
            </div>

            {/* Values Row (NON-INPUT Text Display) */}
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left 37% Values */}
              <div className="w-full md:w-[37%] shrink-0 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {formatPreCarriageBy(preCarriageBy, '') || '-'}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(placeOfReceipt || countryOfOrigin, '') || '-'}
                  </span>
                </div>
              </div>

              {/* Right 63% Values */}
              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(countryOfOrigin || placeOfReceipt, '') || '-'}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(countryOfDestination, '') || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 
            ROW 4: 3-COLUMN VESSEL & LOADING ROW:
            Headers: font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: NON-INPUT DISPLAY VALUES (clean text, no <input> tags to remove)
          */}
          <div className="flex flex-col divide-y divide-border">
            {/* Header Row */}
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              {/* Left 37% Header */}
              <div className="w-full md:w-[37%] shrink-0 p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                VESSEL / VOYAGE NO.
              </div>

              {/* Right 63% Headers */}
              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  PORT OF LOADING
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  TERMS OF DELIVERY & PAYMENT
                </div>
              </div>
            </div>

            {/* Values Row (NON-INPUT Text Display) */}
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left 37% Value: Vessel / Flight No */}
              <div className="w-full md:w-[37%] shrink-0 p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                  {safeString(vesselVoyageNo, '') || 'AS PER BL'}
                </span>
              </div>

              {/* Right 63% Values */}
              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(portOfLoading, '') || '-'}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {deliveryTermsDisplay || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 
            ROW 5: 2-COLUMN DESTINATION PORTS ROW:
            Headers: font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: NON-INPUT DISPLAY VALUES (clean text, no <input> tags to remove)
          */}
          <div className="flex flex-col divide-y divide-border">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                PORT OF DESTINATION
              </div>
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                FINAL DESTINATION
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all whitespace-pre-line leading-relaxed">
                  {safeString(portOfDestination, '') || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all whitespace-pre-line leading-relaxed">
                  {safeString(finalDestination, '') || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 
            ROW 6: GOODS & SERVICES TABLE:
            Headers: font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: NON-INPUT DISPLAY VALUES (clean text, no <input> tags to remove)
            Accounting Standard: All numerical amounts, rates, and quantities are strictly RIGHT ALIGNED (text-right)
            and vertically maintained at the TOP (align-top).
            table-fixed with strict colgroup percentage widths guarantees columns never blow out or squash.
          */}
          <div className="w-full border-b border-border overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed text-left min-w-[700px]">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '43%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  <th className="py-2.5 px-3 border-r border-border w-[15%] text-left">
                    COUNT / VESSEL
                  </th>
                  <th className="py-2.5 px-3 border-r border-border w-[43%] text-left">
                    DESCRIPTIONS OF GOODS AND SERVICES
                  </th>
                  <th className="py-2.5 px-3 border-r border-border w-[14%] text-right">
                    QUANTITY IN MT
                  </th>
                  <th className="py-2.5 px-3 border-r border-border w-[14%] text-right">
                    {currency} {shippingTermHeader || 'RATE'}
                  </th>
                  <th className="py-2.5 px-3 w-[14%] text-right">
                    AMOUNT IN {currency} ({currencySymbol})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Main Product Item Row: Quantity MT, USD CNF, and Amount are all maintained at the TOP (align-top) and RIGHT ALIGNED (text-right) */}
                <tr className="divide-x divide-border">
                  {/* COUNT / VESSEL (NON-INPUT Text) - Vertically merged across row 1 & row 2 */}
                  <td rowSpan={2} className="py-3 px-3 align-top text-left">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                      {safeString(countVessel, '') || '-'}
                    </span>
                  </td>

                  {/* DESCRIPTIONS OF GOODS AND SERVICES (NON-INPUT Text) */}
                  <td className="py-3 px-3 align-top text-left pb-6" id="field-goodsDescription" data-field="goodsDescription">
                    <div className="font-semibold text-[14px] text-foreground leading-relaxed whitespace-pre-line select-all pb-2">
                      {safeString(goodsDescription, '') || '-'}
                    </div>
                    {(errors.goodsDescription || errors.goods_description) && (
                      <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                        <span className="text-brand-red">{errors.goodsDescription || errors.goods_description}</span>
                      </span>
                    )}
                  </td>

                  {/* QUANTITY IN MT (NON-INPUT Text - Accounting Right Align) */}
                  <td className="py-3 px-3 align-top text-right" id="field-quantityMt" data-field="quantityMt">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {quantityMt ? `${safeString(quantityMt).replace(/,/g, '')} MT` : ''}
                    </span>
                    {(errors.quantityMt || errors.quantity_mt) && (
                      <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center justify-end gap-1.5">
                        <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                        <span className="text-brand-red">{errors.quantityMt || errors.quantity_mt}</span>
                      </span>
                    )}
                  </td>

                  {/* RATE (NON-INPUT Text - Accounting Right Align) */}
                  <td className="py-3 px-3 align-top text-right" id="field-ratePrice" data-field="ratePrice">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {ratePrice ? `${currencySymbol} ${formatAmountWithoutExtraZeros(ratePrice)}` : ''}
                    </span>
                    {(errors.ratePrice || errors.rate_price || errors.price) && (
                      <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center justify-end gap-1.5">
                        <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                        <span className="text-brand-red">{errors.ratePrice || errors.rate_price || errors.price}</span>
                      </span>
                    )}
                  </td>

                  {/* AMOUNT (NON-INPUT Text - Accounting Right Align & Top Align) */}
                  <td className="py-3 px-3 align-top text-right">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {computedItemAmount > 0
                        ? `${currencySymbol} ${formatAmountWithoutExtraZeros(computedItemAmount)}`
                        : ''}
                    </span>
                  </td>
                </tr>

                {/* Advance Payment Row: Count/Vessel vertically merged from above; Description contains [5% MORE OR LESS AT CONTRACT QUANTITY] aligned with ADVANCE PAYMENT */}
                <tr className="divide-x divide-border bg-card">
                  <td className="py-2.5 px-3 align-middle text-left">
                    <span className="font-semibold text-[13px] sm:text-[14px] text-foreground tracking-wide select-all">
                      [5% MORE OR LESS AT CONTRACT QUANTITY]
                    </span>
                  </td>
                  <td
                    colSpan={2}
                    className="py-2.5 px-3 text-right font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider pr-4"
                  >
                    ADVANCE PAYMENT
                  </td>
                  <td className="py-2.5 px-3 align-top text-right">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {parseFloat(String(advancePayment || 0)) > 0
                        ? `${currencySymbol} ${formatAmountWithoutExtraZeros(advancePayment)}`
                        : `${currencySymbol} 0`}
                    </span>
                  </td>
                </tr>

                {/* Total & Amount in Words Row */}
                <tr className="divide-x divide-border bg-muted/20">
                  <td colSpan={2} className="py-2.5 px-3 align-top">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                      <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 leading-normal">
                        AMOUNT IN WORDS:
                      </span>
                      <span className="font-bold text-[14px] text-foreground tracking-wide select-all leading-normal">
                        {effectiveAmountInWords || '-'}
                      </span>
                    </div>
                  </td>
                  <td
                    colSpan={2}
                    className="py-2.5 px-3 align-top text-right font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider pr-4"
                  >
                    TOTAL
                  </td>
                  <td className="py-2.5 px-3 align-top text-right">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {currencySymbol}{' '}
                      {formatAmountWithoutExtraZeros(computedTotal)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 
            ROW 7: BANK ACCOUNT & AUTHORITY SIGNATURE / STAMP
            Split: Left 58% (Bank Account Details) and Right 42% (Authority Signature & Stamp)
            Aligned 100% identically with the 58% / 42% split of the Goods table above!
          */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border border-b border-border bg-card">
            {/* Left Column (58%): Bank Account Details */}
            <div className="w-full md:w-[58%] p-2.5 sm:p-3 flex flex-col justify-start gap-2 bg-card" id="field-selectedBankId" data-field="selectedBankId">
              <input type="hidden" name="bank_details_id" value={selectedBankId} />
              <input type="hidden" name="bank_account_id" value={selectedBankId} />
              <div className="flex flex-col justify-start gap-2 h-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-h-[30px] sm:min-h-[32px]">
                  <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5 leading-normal">
                    SELECT BANK ACCOUNT:
                  </label>
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <DocUnderlineSelect
                      id="field-selectedBankId-select"
                      loading={isLoadingBankAccounts}
                      options={(() => {
                        if (sellerBankAccounts.length > 0) {
                          const opts = sellerBankAccounts.map((b) => {
                            const bankTitle = safeString(
                              b.name || b.bank_name || b.bankName || b.account_name,
                              'Bank Account'
                            );
                            let bankSub = '';
                            if (b.account_number || b.account_no) {
                              bankSub = `A/C: ${b.account_number || b.account_no}`;
                            } else if (b.branch || b.branch_name) {
                              bankSub = `Branch: ${b.branch || b.branch_name}`;
                            } else if (b.account_details && typeof b.account_details === 'string') {
                              const firstLine = b.account_details.split('\n')[0]?.trim();
                              if (firstLine && firstLine !== bankTitle) {
                                bankSub = firstLine;
                              }
                            }
                            const primaryId = safeString(b.bank_details_id || b.id || b._id);
                            return {
                              value: primaryId,
                              id: safeString(b.id || b.bank_details_id || b._id),
                              bank_details_id: primaryId,
                              bank_account_id: primaryId,
                              label: bankTitle,
                              subLabel: bankSub,
                            };
                          });

                          if (
                            selectedBankId &&
                            !opts.some(
                              (o) =>
                                String(o.value) === String(selectedBankId) ||
                                String((o as any).id) === String(selectedBankId) ||
                                String((o as any).bank_details_id) === String(selectedBankId) ||
                                String((o as any).bank_account_id) === String(selectedBankId)
                            )
                          ) {
                            let fallbackLabel = 'Selected Bank Account';
                            if (bankAccountDetails) {
                              const matchLine = bankAccountDetails
                                .split('\n')
                                .find((l) => /bank name/i.test(l) || /a\/c holder/i.test(l));
                              if (matchLine) {
                                fallbackLabel = matchLine.replace(/^[^:]+:\s*/, '').trim();
                              }
                            }
                            opts.push({
                              value: selectedBankId,
                              id: selectedBankId,
                              bank_details_id: selectedBankId,
                              bank_account_id: selectedBankId,
                              label: fallbackLabel,
                              subLabel: '',
                            });
                          }

                          return opts;
                        }

                        if (selectedBankId) {
                          let fallbackLabel = isLoadingBankAccounts ? 'Loading bank accounts...' : 'Selected Bank Account';
                          if (bankAccountDetails) {
                            const matchLine = bankAccountDetails
                              .split('\n')
                              .find((l) => /bank name/i.test(l) || /a\/c holder/i.test(l));
                            if (matchLine) {
                              fallbackLabel = matchLine.replace(/^[^:]+:\s*/, '').trim();
                            }
                          }
                          return [
                            {
                              value: selectedBankId,
                              id: selectedBankId,
                              bank_details_id: selectedBankId,
                              bank_account_id: selectedBankId,
                              label: fallbackLabel,
                              subLabel: '',
                            },
                          ];
                        }

                        return [];
                      })()}
                      value={selectedBankId}
                      onChange={(val) => {
                        const cleanVal =
                          !val ||
                          /^select bank account$/i.test(String(val).trim()) ||
                          /^loading bank accounts/i.test(String(val).trim())
                            ? ''
                            : String(val).trim();
                        markDirty();
                        setSelectedBankId(cleanVal);
                        setErrors((prev) => ({
                          ...prev,
                          selectedBankId: '',
                          bank_details_id: '',
                          bank_account_id: '',
                          bankDetails: '',
                          bank_details: '',
                        }));
                        const matched = cleanVal
                          ? sellerBankAccounts.find(
                              (b) =>
                                String(b.bank_details_id || b.id || b._id) === cleanVal ||
                                String(b.id) === cleanVal ||
                                String(b.bank_details_id) === cleanVal ||
                                String(b.bank_account_id) === cleanVal
                            )
                          : undefined;
                        if (matched) {
                          setBankAccountDetails(formatBankDetails(matched));
                        } else {
                          setBankAccountDetails('');
                        }
                      }}
                      error={errors.selectedBankId || errors.bank_details_id || errors.bank_account_id || errors.bankDetails || errors.bank_details}
                      placeholder="Select Bank Account"
                      className="w-full font-bold text-foreground text-[14px]"
                    />
                  </div>
                </div>

                {/* Formatted Bank Account Details: NON-INPUT normal text display only */}
                <div className="flex-1 flex flex-col mt-1.5 min-h-[90px] justify-start px-0.5">
                  {bankAccountDetails ? (
                    <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {bankAccountDetails}
                    </div>
                  ) : (
                    <div className="text-[13px] text-muted-foreground/60 italic pt-1">
                      {selectedBankId ? 'No details available for selected bank account' : 'Select a bank account from above to view details'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (42%): Official Seller Stamp & Signature Box */}
            <div className="w-full md:w-[42%] p-2.5 sm:p-3 flex flex-col justify-start bg-card" id="field-seller_signature" data-field="seller_signature">
              <div className="flex flex-col justify-start h-full">
                <DocSignatureBox
                  partyType="exporter"
                  title={companyName}
                  titleAsText={true}
                  onTitleChange={(val) => {
                    markDirty();
                    setCompanyName(val);
                    setErrors((prev) => ({ ...prev, companyName: '', seller_name: '' }));
                  }}
                  signatureUrl={stampImageUrl}
                  onSignatureChange={(url) => {
                    markDirty();
                    if (!url) {
                      hasUserClearedSignatureRef.current = true;
                    } else {
                      hasUserClearedSignatureRef.current = false;
                    }
                    setStampImageUrl(url);
                    setErrors((prev) => ({
                      ...prev,
                      seller_signature: '',
                      sellerSignature: '',
                      stampImageUrl: '',
                      signature: '',
                      stamp: '',
                      authorised_signature: '',
                      authority_signature: '',
                    }));
                  }}
                  authorityTitle={authoritySignatureTitle}
                  onAuthorityTitleChange={(val) => {
                    markDirty();
                    setAuthoritySignatureTitle(val);
                    setErrors((prev) => ({
                      ...prev,
                      seller_signature_label: '',
                      sellerSignatureLabel: '',
                      authoritySignatureTitle: '',
                      authority_signature_title: '',
                    }));
                  }}
                  titlePlaceholder="SELLER / EXPORTER"
                  authorityPlaceholder="AUTHORISED SIGNATURE"
                  error={
                    errors.seller_signature ||
                    errors.sellerSignature ||
                    errors.stampImageUrl ||
                    errors.signature ||
                    errors.stamp ||
                    errors.authorised_signature ||
                    errors.authority_signature
                  }
                  authorityError={
                    errors.seller_signature_label ||
                    errors.sellerSignatureLabel ||
                    errors.authoritySignatureTitle ||
                    errors.authority_signature_title
                  }
                  readOnly={readOnly}
                  uploadButtonLabel="Upload Stamp / Signature"
                  clearButtonLabel="Clear"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* 
            ROW 8: BANK CHARGES DISCLAIMER NOTE
            Full-width document block aligned perfectly with ROW 9 (COMMENTS)
          */}
          <div
            className="w-full py-2.5 px-2.5 sm:px-3 flex flex-col gap-1.5 justify-start bg-card"
            id="field-bankChargesNote"
            data-field="bankChargesNote"
          >
            <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
              NOTE / BANK CHARGES:
            </label>
            <div className="w-full">
              <DocUnderlineInput
                id="field-bankChargesNote-input"
                multiline
                rows={2}
                value={bankChargesNote}
                onChange={(val) => {
                  markDirty();
                  setBankChargesNote(val);
                  setErrors((prev) => ({ ...prev, bankChargesNote: '', bank_charges_note: '', disclaimer: '' }));
                }}
                error={errors.bankChargesNote || errors.bank_charges_note || errors.disclaimer}
                disabled={readOnly}
                placeholder="PLEASE DO NOT DEDUCT BANK CHARGES FROM THE TOTAL AMOUNT..."
                icon="fa-solid fa-pen"
                uppercase={false}
                inputClassName="text-[13px] sm:text-[14px] font-semibold !text-amber-600 dark:!text-amber-400 leading-relaxed resize-none"
                className="w-full"
              />
            </div>
          </div>

          {/* 
            ROW 9: COMMENTS (comment_label & comment_value - 100% identical to Confirmation & Contract)
          */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border"
            data-field="commentSection"
          >
            <div className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0" data-field="commentLabel" id="field-commentLabel">
              <DocUnderlineInput
                id="field-commentLabel-input"
                value={commentLabel}
                maxLength={20}
                onChange={(val) => {
                  markDirty();
                  setCommentLabel(val.slice(0, 20));
                  setErrors((prev) => ({ ...prev, commentLabel: '', comment_label: '', comment_title: '' }));
                }}
                error={errors.commentLabel || errors.comment_label || errors.comment_title}
                icon="fa-solid fa-pen"
                disabled={readOnly}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_title ||
                  dict?.smart_docs?.contract_form?.enter_title ||
                  'Enter Title'
                }
                uppercase={false}
                inputClassName="text-[14px] font-semibold"
              />
            </div>
            <div
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0 sm:col-span-2"
              data-field="commentValue"
              id="field-commentValue"
            >
              <DocUnderlineInput
                id="field-commentValue-input"
                value={commentValue}
                onChange={(val) => {
                  markDirty();
                  setCommentValue(val);
                  setErrors((prev) => ({ ...prev, commentValue: '', comment_value: '', comment_text: '' }));
                }}
                error={errors.commentValue || errors.comment_value || errors.comment_text}
                icon="fa-solid fa-pen"
                disabled={readOnly}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_comment ||
                  dict?.smart_docs?.contract_form?.enter_comment ||
                  'Enter Comment'
                }
                uppercase={false}
                inputClassName="text-[14px] font-semibold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 
        BOTTOM ACTION BAR:
        Theme-compliant buttons matching AgriGuru brand system (exact match with Confirmation & Contract).
        Sticky on mobile docked at viewport bottom, static on desktop at bottom of card.
      */}
      <div
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Print Preview & Download PDF (Red themed like Confirmation & Contract) */}
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

        {/* Right Action Buttons: Save As Draft & Submit */}
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
            title={docStatus === 'COMPLETED' && !hasSubmitChanges ? 'Proforma Invoice already submitted' : undefined}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group ${
              docStatus === 'COMPLETED' ? 'w-full sm:w-auto' : ''
            }`}
          >
            <span className="truncate">
              {isSubmitting
                ? dict?.smart_docs?.submitting || 'Submitting...'
                : submitInfo.buttonLabel}
            </span>
            {isSubmitting ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Print Preview Modal */}
      <DocPrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        prefix="proforma"
        docId={getEffectiveProformaId()}
        candidateIds={[
          getEffectiveProformaId(),
          draftId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        contractId={contractId}
        confirmationId={confirmationId}
        docNumber={safeString(invoiceNumber || purchaseOrderNo, '')}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default ProformaDocumentForm;
