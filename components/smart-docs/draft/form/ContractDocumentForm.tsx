'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import DocUnderlineInput from './DocUnderlineInput';
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
} from '@/app/actions/smart-docs';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_DOCUMENT_SELECTION_OPTIONS,
  parsePackingBagWeightKg,
  getCurrencySymbol,
  normalizeCurrencyCode,
  normalizeCurrencyOption,
  type SmartDocsSelectionDocumentOption,
} from '@/lib/api/smart-docs.service';
import type { FormOptionItem } from './ConfirmationDocumentForm';
import { normalizeCountryString, normalizeHsnString } from './ConfirmationDocumentForm';

export interface ContractDocumentFormProps {
  initialData?: any;
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
  onSaveSuccess?: (savedId: string) => void;
  onSubmitContract?: (payload: any) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

const DEFAULT_FCL_TYPES: FormOptionItem[] = [
  { value: '20 FT', label: '20 FT' },  
  { value: '40 FT', label: '40 FT' },
  { value: 'Vessel', label: 'Vessel' }
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

const DEFAULT_ADVANCE_TYPE_OPTIONS: DocSegmentedToggleOption<'amount' | '%'>[] = [
  { value: '%', label: '%', icon: 'fa-solid fa-percent' },
  { value: 'amount', label: 'AMOUNT', icon: 'fa-solid fa-coins' },
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

export function getPartialLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
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
    data.broker_allowed;
  return parseNullableBoolean(raw);
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

export function parseInitialSplitCount(data: any): string | number {
  if (!data) return '';
  const countRaw =
    data.split_count ??
    data.splitCount ??
    data.partial_count ??
    data.partialCount;
  if (countRaw !== undefined && countRaw !== null && String(countRaw).trim() !== '') {
    return countRaw;
  }
  const rawSplits =
    data.splits ||
    data.contract?.splits ||
    data.split_list ||
    data.partial_breakdown ||
    data.partial_quantities;
  if (Array.isArray(rawSplits) && rawSplits.length > 0) {
    return rawSplits.length;
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
    return rawSplits.map((item, idx) => {
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
          item.label ??
          idx + 1;
        return {
          ...item,
          split_number: num,
          fcl_quantity: qty !== undefined && qty !== null ? String(qty) : '',
        };
      }
      return {
        split_number: idx + 1,
        fcl_quantity: item !== undefined && item !== null ? String(item) : '',
      };
    });
  }

  // If split_count exists but splits array is not provided
  const countRaw = data.split_count ?? data.splitCount ?? data.partial_count ?? data.partialCount;
  const count = parseInt(String(countRaw), 10);
  if (!isNaN(count) && count > 0) {
    const list: ContractSplitItem[] = [];
    for (let i = 0; i < Math.min(count, 500); i++) {
      list.push({
        split_number: i + 1,
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
    return 'Vessel';
  }
  if (s.includes('40')) return '40 FT';
  if (s.includes('20')) return '20 FT';
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
    if (isRawDbId(trimmed)) return '';
    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
      return trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }
    return trimmed;
  }
  return toCleanLabel(val);
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
  }
  if (!label) {
    label = toCleanLabel(data.seller_name || data.sellerName || data.seller_company_name || data.exporter_name || '');
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
  }
  if (!label) {
    label = toCleanLabel(data.buyer_name || data.buyerName || data.buyer_company_name || data.importer_name || '');
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
  // Saved Draft / Contract ID (from API)
  const [draftId, setDraftId] = useState<string>(() =>
    toCleanId(
      initialData?.id ||
      initialData?._id ||
      initialData?.contract_id ||
      initialData?.contractId ||
      initialData?.confirmation_id ||
      initialData?.confirmationId
    )
  );

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
  const titleInputRef = useRef<HTMLInputElement>(null);

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
    toCleanLabel(initialData?.seller_instruction || initialData?.sellerInstruction || (typeof initialData?.seller === 'object' ? initialData.seller.instructionText || initialData.seller.details : ''))
  );
  const [buyerId, setBuyerId] = useState<string>(() =>
    toCleanId(initialData?.buyer_instruction_id || initialData?.buyerId || initialData?.buyer_id || initialData?.buyer)
  );
  const [buyerInstruction, setBuyerInstruction] = useState<string>(() =>
    toCleanLabel(initialData?.buyer_instruction || initialData?.buyerInstruction || (typeof initialData?.buyer === 'object' ? initialData.buyer.instructionText || initialData.buyer.details : ''))
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
    normalizeHsnString(initialData?.hsn_code || initialData?.hsnCode || initialData?.hsn || (typeof initialData?.product === 'object' ? initialData.product.hsn : ''))
  );
  const [productCountry, setProductCountry] = useState<string>(() =>
    normalizeCountryString(initialData?.country || initialData?.productCountry || initialData?.product_country || (typeof initialData?.product === 'object' ? initialData.product.country : ''))
  );

  // ROW 7: Specification
  const [specification, setSpecification] = useState<string>(() =>
    toCleanLabel(initialData?.quality_specification || initialData?.specification || (typeof initialData?.product === 'object' ? initialData.product.specification || initialData.product.quality_specification : ''))
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
  const currencySymbol = useMemo(() => {
    return getCurrencySymbol(currency);
  }, [currency]);
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
    setSplitCount(val);
    setErrors((prev) => ({ ...prev, partialCount: '', partialTotal: '' }));
    const count = parseInt(val, 10);
    if (!isNaN(count) && count > 0) {
      const safeCount = Math.min(count, 500);
      setSplits((prev) => {
        const next = [...prev];
        if (next.length < safeCount) {
          for (let i = next.length; i < safeCount; i++) {
            next.push({
              split_number: i + 1,
              fcl_quantity: '',
            });
          }
        } else if (next.length > safeCount) {
          return next.slice(0, safeCount);
        }
        return next;
      });
    } else {
      setSplits([]);
    }
  };

  const handleSplitQtyChange = (index: number, val: string) => {
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
  const [advanceType, setAdvanceType] = useState<'amount' | '%'>(() => {
    return (initialData?.advance_type || initialData?.advanceType || 'amount') as 'amount' | '%';
  });
  const [advanceAmount, setAdvanceAmount] = useState<string | number>(
    initialData?.advance_amount ?? initialData?.advanceAmount ?? ''
  );
  const [advancePercentage, setAdvancePercentage] = useState<string | number>(
    initialData?.advance_percentage ?? initialData?.advancePercentage ?? ''
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

  // ROW 27: Documents (Default Documents & Documents Required Dropdown Selection)
  const [defaultDocuments, setDefaultDocuments] = useState<string[]>(() => {
    return parseDefaultDocuments(
      initialData?.default_documents ||
      initialData?.defaultDocuments ||
      initialData?.default_document_list ||
      initialData?.defaultDocumentList
    );
  });

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
    return baseList;
  });

  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(() => {
    return extractAndResolveContractDocuments(
      initialData,
      documentsList && documentsList.length > 0
        ? documentsList
        : DEFAULT_DOCUMENT_SELECTION_OPTIONS
    );
  });

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
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '') {
        return String(data[k]).trim();
      }
      if (data.contract && data.contract[k] !== undefined && data.contract[k] !== null && String(data.contract[k]).trim() !== '') {
        return String(data.contract[k]).trim();
      }
      if (data.data && data.data[k] !== undefined && data.data[k] !== null && String(data.data[k]).trim() !== '') {
        return String(data.data[k]).trim();
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
    () =>
      resolveSigValue(
        initialData,
        ['buyer_signature', 'buyerSignature', 'importer_signature', 'importerSignature'],
        ''
      )
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
    () =>
      resolveSigValue(
        initialData,
        ['broker_signature', 'sales_broker_signature', 'brokerSignature'],
        ''
      )
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
    () =>
      resolveSigValue(
        initialData,
        ['seller_signature', 'sellerSignature', 'exporter_signature', 'exporterSignature'],
        ''
      )
  );
  const [exporterAuthorityTitle, setExporterAuthorityTitle] = useState<string>(
    () =>
      resolveSigValue(
        initialData,
        ['seller_signature_label', 'sellerSignatureLabel', 'exporter_signature_label', 'exporter_authority_title', 'exporterAuthorityTitle'],
        'AUTHORISED SIGNATURE'
      )
  );

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
    const base =
      internalCurrencies.length > 0
        ? internalCurrencies
        : currencies && currencies.length > 0
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
  }, [internalCurrencies, currencies, initialData]);

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
      setSelectedDocuments(resolved);
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
  }, [initialData]);

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
  const fetchAndApplyProductDetails = useCallback(
    async (targetProdId: string, forceOverwrite = false) => {
      if (!targetProdId || !targetProdId.trim()) return;
      const cleanId = targetProdId.trim();

      // Check cache first
      if (productDetailsCacheRef.current[cleanId]) {
        const cached = productDetailsCacheRef.current[cleanId];
        if (forceOverwrite || !hsnCode) {
          if (cached.hsnCode || cached.hsn) setHsnCode(cached.hsnCode || cached.hsn);
        }
        if (forceOverwrite || !productCountry) {
          if (cached.country) setProductCountry(cached.country);
        }
        if (forceOverwrite || !specification) {
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

          if (forceOverwrite || !hsnCode) {
            if (d.hsnCode || (d as any).hsn) setHsnCode(d.hsnCode || (d as any).hsn);
          }
          if (forceOverwrite || !productCountry) {
            if (d.country) setProductCountry(d.country);
          }
          if (forceOverwrite || !specification) {
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
    [lang, hsnCode, productCountry, specification]
  );

  const handleProductChange = (val: string) => {
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
    setSellerId(val);
    setErrors((prev) => ({ ...prev, sellerId: '' }));
    const selected = internalSellers.find(
      (s) => String(s.value) === String(val) || String(s.id) === String(val)
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
    setBuyerId(val);
    setErrors((prev) => ({ ...prev, buyerId: '' }));
    const selected = internalBuyers.find(
      (b) => String(b.value) === String(val) || String(b.id) === String(val)
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

    const id = toCleanId(
      initialData.id ||
      initialData._id ||
      initialData.contract_id ||
      initialData.contractId ||
      initialData.confirmation_id ||
      initialData.confirmationId
    );
    if (id) setDraftId(id);

    if (initialData.letterhead_space !== undefined) setLetterhead(Boolean(initialData.letterhead_space));
    else if (initialData.letterhead !== undefined) setLetterhead(Boolean(initialData.letterhead));

    if (initialData.is_watermark_enabled !== undefined) setWatermark(Boolean(initialData.is_watermark_enabled));
    else if (initialData.watermark !== undefined) setWatermark(Boolean(initialData.watermark));

    const title = toCleanLabel(initialData.pdf_title || initialData.pdfTitle || initialData.documentTitle || initialData.title);
    if (title) setDocumentTitle(title);

    const confNum = toCleanLabel(initialData.confirmation_number || initialData.confirmationNumber);
    if (confNum) setConfirmationNumber(confNum);

    const confDate = toCleanLabel(initialData.confirmation_date || initialData.confirmationDate);
    if (confDate) setConfirmationDate(confDate.includes('T') ? confDate.split('T')[0] : confDate);

    const contNum = toCleanLabel(initialData.contract_number || initialData.contractNumber);
    if (contNum) setContractNumber(contNum);

    const contDate = toCleanLabel(initialData.contract_date || initialData.contractDate);
    if (contDate) setContractDate(contDate.includes('T') ? contDate.split('T')[0] : contDate);

    const pHeader = toCleanLabel(initialData.parties_header || initialData.partiesHeader);
    if (pHeader) setPartiesHeader(pHeader);

    const sId = toCleanId(initialData.seller_instruction_id || initialData.sellerId || initialData.seller_id || initialData.seller);
    if (sId) setSellerId(sId);

    const sInst = toCleanLabel(initialData.seller_instruction || initialData.sellerInstruction || (typeof initialData.seller === 'object' ? initialData.seller.instructionText || initialData.seller.details : ''));
    if (sInst) setSellerInstruction(sInst);

    const bId = toCleanId(initialData.buyer_instruction_id || initialData.buyerId || initialData.buyer_id || initialData.buyer);
    if (bId) setBuyerId(bId);

    const bInst = toCleanLabel(initialData.buyer_instruction || initialData.buyerInstruction || (typeof initialData.buyer === 'object' ? initialData.buyer.instructionText || initialData.buyer.details : ''));
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

    const hsn = normalizeHsnString(initialData.hsn_code || initialData.hsnCode || initialData.hsn || (typeof initialData.product === 'object' ? initialData.product.hsn : ''));
    if (hsn) setHsnCode(hsn);

    const ctry = normalizeCountryString(initialData.country || initialData.productCountry || initialData.product_country || (typeof initialData.product === 'object' ? initialData.product.country : ''));
    if (ctry) setProductCountry(ctry);

    const spec = toCleanLabel(initialData.quality_specification || initialData.specification || (typeof initialData.product === 'object' ? initialData.product.specification || initialData.product.quality_specification : ''));
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

    const brand = toCleanLabel(initialData.marking_brand || initialData.markingBrand || initialData.brand);
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
      const lCond = toCleanLabel(initialData.loading_condition || initialData.loadingCondition);
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

    const insp = toCleanLabel(initialData.inspection);
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
    if (sCount !== undefined && sCount !== null && sCount !== '') {
      setSplitCount(sCount);
    }

    const initialSplits = parseInitialSplits(initialData);
    if (initialSplits.length > 0) {
      setSplits(initialSplits);
    }

    const transhipVal = parseNullableBoolean(initialData.transhipment_allowed ?? initialData.transhipment);
    setIsTranshipmentAllowed(transhipVal);

    const transitVal = parseNullableBoolean(initialData.transit_clause_allowed ?? initialData.transit_clause);
    setIsTransitClauseAllowed(transitVal);

    const advVal = parseNullableBoolean(initialData.any_advance ?? initialData.has_advance ?? initialData.advance);
    setHasAdvance(advVal);

    if (initialData.advance_type || initialData.advanceType) setAdvanceType(initialData.advance_type || initialData.advanceType);

    const advAmt = initialData.advance_amount ?? initialData.advanceAmount;
    if (advAmt !== undefined && advAmt !== null && advAmt !== '') setAdvanceAmount(advAmt);

    const advPct = initialData.advance_percentage ?? initialData.advancePercentage;
    if (advPct !== undefined && advPct !== null && advPct !== '') setAdvancePercentage(advPct);

    const brokerVal = parseInitialIsBroker(initialData);
    setIsSalesBrokerAllowed(brokerVal);

    setBrokerCommissionType(
      parseBrokerCommissionType(
        initialData.broker_commission_type ??
        initialData.sales_broker_type ??
        initialData.brokerCommissionType
      )
    );

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

    const fDays = toCleanLabel(initialData.free_days || initialData.freeDays);
    if (fDays) setFreeDays(fDays);

    const eBags = toCleanLabel(initialData.empty_bags || initialData.emptyBags);
    if (eBags) setEmptyBags(eBags);

    const aComment = toCleanLabel(initialData.additional_comment || initialData.additionalComment || initialData.comment);
    if (aComment) setAdditionalComment(aComment);

    const oTerms =
      initialData.other_terms_1 ||
      initialData.other_terms1 ||
      initialData.otherTerms1 ||
      initialData.other_terms ||
      initialData.other_terms_payment ||
      initialData.otherTerms;
    if (oTerms) setOtherTermsPayment(oTerms);

    const defDocs = parseDefaultDocuments(
      initialData.default_documents ||
      initialData.defaultDocuments ||
      initialData.default_document_list ||
      initialData.defaultDocumentList
    );
    if (defDocs.length > 0) {
      setDefaultDocuments(defDocs);
    }

    const resolvedDocs = extractAndResolveContractDocuments(
      initialData,
      internalDocumentList.length > 0 ? internalDocumentList : (documentsList || [])
    );
    if (resolvedDocs.length > 0) {
      setSelectedDocuments(resolvedDocs);
      setInternalDocumentList((prev) => {
        const existingNames = new Set(prev.map((p) => p.name.toUpperCase()));
        const toAdd: SmartDocsSelectionDocumentOption[] = [];
        for (const doc of resolvedDocs) {
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

    const sLine = initialData.shipping_line || initialData.shippingLine;
    if (sLine) setShippingLine(sLine);

    const arbit = toCleanLabel(initialData.arbitration);
    if (arbit) setArbitration(arbit);

    const cTerms =
      initialData.other_terms_2 ||
      initialData.other_terms2 ||
      initialData.otherTerms2 ||
      initialData.container_terms ||
      initialData.container_standards ||
      initialData.containerStandards;
    if (cTerms) setContainerStandards(cTerms);

    const fMajeur = initialData.force_majeur || initialData.forceMajeur;
    if (fMajeur) setForceMajeur(fMajeur);

    const conf = initialData.confidentiality;
    if (conf) setConfidentiality(conf);

    const nts = initialData.notes;
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
    if (bSig) setImporterSignature(bSig);

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
    if (brField) setBrokerTitle(brField);

    const brSig = resolveSigValue(initialData, [
      'broker_signature',
      'sales_broker_signature',
      'brokerSignature',
    ]);
    if (brSig) setBrokerSignature(brSig);

    const brLabel = resolveSigValue(initialData, [
      'broker_signature_label',
      'brokerSignatureLabel',
      'broker_authority_title',
      'sales_broker_authority_title',
      'brokerAuthorityTitle',
    ]);
    if (brLabel) setBrokerAuthorityTitle(brLabel);

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
    if (sSig) setExporterSignature(sSig);

    const sLabel = resolveSigValue(initialData, [
      'seller_signature_label',
      'sellerSignatureLabel',
      'exporter_signature_label',
      'exporter_authority_title',
      'exporterAuthorityTitle',
    ]);
    if (sLabel) setExporterAuthorityTitle(sLabel);
  }, [initialData, shippingTerms, draftId, fetchAndApplyProductDetails]);

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
      } else {
        const hasEmpty = splits.some((q) => q.fcl_quantity === '' || q.fcl_quantity === null || q.fcl_quantity === undefined);
        if (hasEmpty) {
          newErrors.partialTotal = 'All partial quantities must be entered';
        } else if (targetFclQty > 0 && Math.abs(partialSum - targetFclQty) > 0.0001) {
          newErrors.partialTotal = `Total partial quantity (${partialSum}) must equal ${isFcl ? 'FCL' : 'MT'} Quantity (${targetFclQty})`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getContractPayload = () => {
    const effectiveContractId =
      draftId ||
      toCleanId(
        initialData?.id ||
        initialData?._id ||
        initialData?.contract_id ||
        initialData?.contractId
      ) ||
      undefined;

    const confId =
      toCleanId(
        initialData?.confirmation_id ||
        initialData?.confirmationId
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
      parties_header: partiesHeader.trim(),
      seller_instruction_id: sellerId,
      seller_instruction: sellerInstruction.trim(),
      buyer_instruction_id: buyerId,
      buyer_instruction: buyerInstruction.trim(),
      shipping_instruction: shippingInstruction.trim(),
      terms_and_condition: shippingInstruction.trim(),
      product_id: productId,
      hsn_code: hsnCode,
      country: productCountry,
      quality_specification: specification.trim(),
      shipment_start_date: shipmentRange.start ? shipmentRange.start.toISOString().split('T')[0] : undefined,
      shipment_end_date: shipmentRange.end ? shipmentRange.end.toISOString().split('T')[0] : undefined,
      payment_term_id: paymentTerm,
      fcl_type: fclType,
      ship_by: fclType,
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
      split_count: isPartialAllowed && splitCount ? Number(splitCount) : (isPartialAllowed === false ? 0 : null),
      partial_count: isPartialAllowed && splitCount ? Number(splitCount) : undefined,
      splits:
        isPartialAllowed && splits.length > 0
          ? splits.map((s, idx) => ({
              ...s,
              split_number: s.split_number ?? idx + 1,
              fcl_quantity: s.fcl_quantity !== '' && s.fcl_quantity !== null && s.fcl_quantity !== undefined ? Number(s.fcl_quantity) : 0,
            }))
          : [],
      partial_breakdown:
        isPartialAllowed && splits.length > 0
          ? splits.map((s) => (s.fcl_quantity !== '' ? Number(s.fcl_quantity) : 0))
          : undefined,
      partial_quantities:
        isPartialAllowed && splits.length > 0
          ? splits.map((s) => (s.fcl_quantity !== '' ? Number(s.fcl_quantity) : 0))
          : undefined,
      transhipment_allowed: isTranshipmentAllowed !== null ? isTranshipmentAllowed : undefined,
      transit_clause_allowed: isTransitClauseAllowed !== null ? isTransitClauseAllowed : undefined,
      any_advance: hasAdvance !== null ? hasAdvance : undefined,
      advance_type: hasAdvance ? advanceType : undefined,
      advance_amount: hasAdvance
        ? advanceType === 'amount'
          ? advanceAmount ? Number(advanceAmount) : undefined
          : calculatedAdvanceAmount ? Number(calculatedAdvanceAmount) : undefined
        : undefined,
      advance_percentage: hasAdvance && advanceType === '%' && advancePercentage
        ? Number(advancePercentage)
        : undefined,
      is_broker: isSalesBrokerAllowed,
      sales_broker_allowed: isSalesBrokerAllowed,
      broker_commission_type: isSalesBrokerAllowed ? brokerCommissionType : null,
      broker_commission: isSalesBrokerAllowed && brokerCommission ? Number(brokerCommission) : undefined,
      broker_commission_amt: isSalesBrokerAllowed && (calculatedBrokerCommission || brokerCommissionAmt) ? Number(calculatedBrokerCommission || brokerCommissionAmt) : undefined,
      broker_commission_amount: isSalesBrokerAllowed && (calculatedBrokerCommission || brokerCommissionAmt) ? Number(calculatedBrokerCommission || brokerCommissionAmt) : undefined,
      broker_name: isSalesBrokerAllowed && brokerName.trim() ? brokerName.trim() : undefined,
      sales_broker_type: isSalesBrokerAllowed ? brokerCommissionType : null,
      sales_broker_commission: isSalesBrokerAllowed && brokerCommission ? Number(brokerCommission) : undefined,
      sales_broker_amount: isSalesBrokerAllowed && (calculatedBrokerCommission || brokerCommissionAmt) ? Number(calculatedBrokerCommission || brokerCommissionAmt) : undefined,
      sales_broker_name: isSalesBrokerAllowed && brokerName.trim() ? brokerName.trim() : undefined,
      free_days: freeDays.trim(),
      empty_bags: emptyBags.trim(),
      additional_comment: additionalComment.trim(),
      other_terms: otherTermsPayment.trim(),
      other_terms_1: otherTermsPayment.trim(),
      default_documents: defaultDocuments.length > 0 ? defaultDocuments : undefined,
      documents_required: selectedDocuments,
      required_documents: selectedDocuments,
      documents: selectedDocuments,
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
      seller_signature: exporterSignature,

      broker_signature_field: isSalesBrokerAllowed ? brokerTitle.trim() : undefined,
      broker_signature_label: isSalesBrokerAllowed ? brokerAuthorityTitle.trim() : undefined,
      broker_signature: isSalesBrokerAllowed ? brokerSignature : undefined,

      buyer_signature_field: importerTitle.trim(),
      buyer_signature_label: importerAuthorityTitle.trim(),
      buyer_signature: importerSignature,

      // Retain legacy keys for backward compatibility
      importer_title: importerTitle.trim(),
      importer_signature: importerSignature,
      importer_authority_title: importerAuthorityTitle.trim(),
      broker_title: isSalesBrokerAllowed ? brokerTitle.trim() : undefined,
      broker_authority_title: isSalesBrokerAllowed ? brokerAuthorityTitle.trim() : undefined,
      sales_broker_title: isSalesBrokerAllowed ? brokerTitle.trim() : undefined,
      sales_broker_signature: isSalesBrokerAllowed ? brokerSignature : undefined,
      sales_broker_authority_title: isSalesBrokerAllowed ? brokerAuthorityTitle.trim() : undefined,
      exporter_title: exporterTitle.trim(),
      exporter_signature: exporterSignature,
      exporter_authority_title: exporterAuthorityTitle.trim(),
    };
  };

  const getEffectiveContractId = (): string => {
    return (
      draftId ||
      toCleanId(
        initialData?.id ||
        initialData?._id ||
        initialData?.contract_id ||
        initialData?.contractId ||
        initialData?.confirmation_id ||
        initialData?.confirmationId
      ) ||
      (typeof window !== 'undefined'
        ? new URL(window.location.href).searchParams.get('id') || ''
        : '')
    );
  };

  const handleOpenPrintPreview = async () => {
    let effectiveId = getEffectiveContractId();

    // If draft is not yet saved, attempt auto-saving so preview template is available
    if (!effectiveId && onSaveDraft && contractNumber.trim()) {
      setIsSavingDraft(true);
      try {
        const payload = getContractPayload();
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
        const payload = getContractPayload();
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

        if (res.url) {
          try {
            const fileRes = await fetch(res.url);
            const blob = await fileRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
            toast.success('PDF downloaded successfully!');
          } catch {
            const a = document.createElement('a');
            a.href = res.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success('PDF downloaded successfully!');
          }
        } else if (res.base64) {
          const binaryStr = atob(res.base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: res.contentType || 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
          toast.success('PDF downloaded successfully!');
        } else {
          toast.error(res.message || 'Failed to generate PDF download URL');
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
      toast.error(
        dict?.smart_docs?.contract_form?.contract_number_required ||
        'Please enter contract number before saving'
      );
      contractInputRef.current?.focus();
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = getContractPayload();
      if (onSaveDraft) {
        const res = await onSaveDraft(payload);
        if (res?.success) {
          toast.success(
            dict?.smart_docs?.contract_form?.saved_as_draft_success ||
            'Contract saved as draft successfully!'
          );
          const newId = res.id || res.data?.id || res.data?.contract_id || res.contract_id;
          if (newId) {
            setDraftId(String(newId));
            if (onSaveSuccess) {
              onSaveSuccess(String(newId));
            }
          }
        } else {
          toast.error(res?.message || 'Failed to save contract draft');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while saving draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error(
        dict?.smart_docs?.confirmation_form?.validation_error ||
        'Please fill all required highlighted fields before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = getContractPayload();
      if (onSubmitContract) {
        const res = await onSubmitContract(payload);
        if (res?.success) {
          toast.success('Contract submitted successfully to Proforma Invoice!');
          const newId = res.id || res.data?.id || res.data?.proforma_id || res.data?.contract_id;
          if (newId && onSaveSuccess) {
            onSaveSuccess(String(newId));
          }
        } else {
          toast.error(res?.message || 'Failed to submit contract to Proforma');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while submitting contract');
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
        {/* TOP BAR: Letterhead Toggle | CONTRACT Title | Watermark Toggle */}
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
                placeholder={dict?.smart_docs?.contract_form?.contract_title || 'CONTRACT'}
                aria-label={dict?.smart_docs?.contract_form?.contract_title || 'Document Title'}
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
                  onChange={setConfirmationDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.confirmation_form?.select_date || 'SELECT DATE'
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
                    setContractDate(val);
                    setErrors((prev) => ({ ...prev, contractDate: '' }));
                  }}
                  error={errors.contractDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.contract_form?.select_date || 'SELECT DATE'
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
              onChange={setPartiesHeader}
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
                onChange={setSellerInstruction}
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
                onChange={setBuyerInstruction}
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
                onChange={setShippingInstruction}
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
                  {isLoadingProductDetails ? 'Loading...' : hsnCode || '-'}
                </span>
              </div>
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="productCountry">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  COUNTRY
                </span>
                <span className="text-[14px] font-semibold text-foreground uppercase truncate min-w-0 mt-0.5 leading-snug">
                  {isLoadingProductDetails ? 'Loading...' : productCountry || '-'}
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
                onChange={setSpecification}
                icon="fa-solid fa-pen"
                placeholder={dict?.smart_docs?.confirmation_form?.enter_specification || 'Enter Specification'}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 8: SHIPMENT PERIOD */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shipmentPeriod">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipment_period || 'SHIPMENT PERIOD'}
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DateRangePicker
                variant="underline"
                startDate={shipmentRange.start}
                endDate={shipmentRange.end}
                onChange={(start, end) => {
                  setShipmentRange({ start, end });
                }}
                formatString="dd/MM/yyyy"
                placeholder="SELECT SHIPMENT PERIOD"
                disabled={readOnly}
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
                onChange={setPaymentTerm}
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
                onChange={setMarkingBrand}
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
              <div className="p-1.5 sm:p-2 border-b sm:border-b lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  BAG QTY
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">{bagQty || '-'}</span>
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b-0 lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  CURRENCY
                </span>
                <div className="w-full max-w-[110px]">
                  <DocUnderlineSelect
                    id="field-contract-currency"
                    options={currenciesList}
                    value={currency}
                    onChange={handleCurrencyChange}
                    disabled={readOnly}
                    searchable={true}
                    loading={isLoadingCurrencies}
                    placeholder="Select"
                    align="center"
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
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  TOTAL VALUE ({currencySymbol})
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">
                  {formatNumberWithCommas(totalValue)}
                </span>
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
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  BAG QTY
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">{bagQty || '-'}</span>
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  CURRENCY
                </span>
                <div className="w-full max-w-[110px]">
                  <DocUnderlineSelect
                    id="field-contract-currency"
                    options={currenciesList}
                    value={currency}
                    onChange={handleCurrencyChange}
                    disabled={readOnly}
                    searchable={true}
                    loading={isLoadingCurrencies}
                    placeholder="Select"
                    align="center"
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
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-1 flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  TOTAL VALUE ({currencySymbol})
                </span>
                <span className="text-[14px] font-bold text-foreground py-0.5">
                  {formatNumberWithCommas(totalValue)}
                </span>
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
                onChange={setInspection}
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
                onChange={handleIncotermChange}
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
                    setIsPartialAllowed(val);
                    if (!val) {
                      setErrors((prev) => ({ ...prev, partialCount: '', partialTotal: '' }));
                    } else if (splits.length === 0 && (!splitCount || Number(splitCount) <= 0)) {
                      setSplitCount(2);
                      setSplits([
                        { split_number: 1, fcl_quantity: '' },
                        { split_number: 2, fcl_quantity: '' },
                      ]);
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
                        max={500}
                        value={splitCount}
                        onChange={(e) => handleSplitCountChange(e.target.value)}
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
                    {splits.map((splitItem, index) => {
                      const splitNum = splitItem.split_number ?? (index + 1);
                      const displayLabel =
                        typeof splitNum === 'string' && splitNum.toLowerCase().includes('partial')
                          ? splitNum
                          : `Partial ${splitNum}`;
                      const isLastPartial = index === splits.length - 1;
                      return (
                        <div key={`split-${index}-${splitNum}`} className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                          {/* Stacked Card: Label on top, centered input with dotted underline below */}
                          <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/50 transition-all shadow-2xs group focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 min-h-[58px]">
                            <label
                              htmlFor={`field-split-${index}`}
                              className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide select-none whitespace-nowrap cursor-pointer text-center"
                            >
                              {displayLabel}
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
                          <span className="block w-full text-center font-extrabold text-xs sm:text-sm font-mono truncate">
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
              {errors.partialTotal && (
                <div className="w-full text-[11px] text-brand-red font-semibold px-0.5 tracking-tight flex items-center gap-1.5 mt-0.5">
                  <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                  <span>{errors.partialTotal}</span>
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
                onChange={setIsTranshipmentAllowed}
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
                onChange={setIsTransitClauseAllowed}
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
                  setHasAdvance(val);
                  if (val && !advanceType) {
                    setAdvanceType('amount');
                  }
                }}
                trueLabel="YES"
                falseLabel="NO"
                disabled={readOnly}
              />

              {hasAdvance && (
                <>
                  <div className="pl-2 border-l border-border/70 flex items-center">
                    <DocSegmentedToggle
                      id="toggle-advance-type"
                      value={advanceType}
                      onChange={(val: 'amount' | '%') => setAdvanceType(val)}
                      options={DEFAULT_ADVANCE_TYPE_OPTIONS}
                      disabled={readOnly}
                    />
                  </div>

                  {advanceType === 'amount' ? (
                    <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
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
                          value={advanceAmount}
                          onChange={(val) => {
                            setAdvanceAmount(val);
                            setErrors((prev) => ({ ...prev, advanceAmount: '' }));
                          }}
                          placeholder="0.00"
                          align="center"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
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
                            value={advancePercentage}
                            onChange={(val) => {
                              setAdvancePercentage(val);
                              setErrors((prev) => ({ ...prev, advancePercentage: '' }));
                            }}
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
                onChange={(val) => setIsSalesBrokerAllowed(val)}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                allowDeselect={true}
                disabled={readOnly}
              />

              {isSalesBrokerAllowed && (
                <>
                  {/* Commission Type Segmented Toggle: % or PMT */}
                  <div className="pl-2 border-l border-border/70 flex items-center">
                    <DocSegmentedToggle<'PERCENTAGE' | 'PMT'>
                      id="toggle-broker-commission-type"
                      value={brokerCommissionType}
                      onChange={(val) => setBrokerCommissionType(val)}
                      options={DEFAULT_BROKER_COMMISSION_TYPE_OPTIONS}
                      allowDeselect={true}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Commission Rate Number Input with Label */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                    <label
                      htmlFor="field-broker-commission"
                      className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider whitespace-nowrap"
                    >
                      Commission:
                    </label>
                    <div className="w-[110px] sm:w-[125px]">
                      <DocUnderlineInput
                        id="field-broker-commission"
                        type="number"
                        min={0}
                        step="any"
                        value={brokerCommission}
                        onChange={(val) => {
                          setBrokerCommission(val);
                        }}
                        placeholder="0.00"
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
                  <div className="flex items-center gap-1.5 pl-2 border-l border-border/70 flex-1 min-w-[240px]">
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
                        onChange={setBrokerName}
                        placeholder="BROKER NAME"
                        icon="fa-solid fa-pen"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </>
              )}
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
                    onChange={setFreeDays}
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
                    onChange={setEmptyBags}
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
                    onChange={setAdditionalComment}
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
                onChange={setOtherTermsPayment}
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
                onChange={setSelectedDocuments}
                options={internalDocumentList}
                defaultDocuments={defaultDocuments}
                disabled={readOnly}
                placeholder="SELECT DOCUMENTS"
                lang={lang}
              />
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
                onChange={setShippingLine}
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
                onChange={setArbitration}
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
                onChange={setContainerStandards}
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
                onChange={setForceMajeur}
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
                onChange={setConfidentiality}
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
                onChange={setNotes}
                placeholder="WRITE YOUR DESCRIPTION..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 34: SIGNATURES - RESPONSIVE COLLAPSIBLE ON MOBILE/TABLET & SIDE-BY-SIDE ON DESKTOP */}
          <ContractSignatureSection
            isSalesBrokerAllowed={isSalesBrokerAllowed}
            exporterTitle={exporterTitle}
            onExporterTitleChange={setExporterTitle}
            exporterSignature={exporterSignature}
            onExporterSignatureChange={setExporterSignature}
            exporterAuthorityTitle={exporterAuthorityTitle}
            onExporterAuthorityTitleChange={setExporterAuthorityTitle}
            brokerTitle={brokerTitle}
            onBrokerTitleChange={setBrokerTitle}
            brokerSignature={brokerSignature}
            onBrokerSignatureChange={setBrokerSignature}
            brokerAuthorityTitle={brokerAuthorityTitle}
            onBrokerAuthorityTitleChange={setBrokerAuthorityTitle}
            importerTitle={importerTitle}
            onImporterTitleChange={setImporterTitle}
            importerSignature={importerSignature}
            onImporterSignatureChange={setImporterSignature}
            importerAuthorityTitle={importerAuthorityTitle}
            onImporterAuthorityTitleChange={setImporterAuthorityTitle}
            readOnly={readOnly}
          />

        </div>
      </div>

      {/* 
        BOTTOM ACTION BAR:
        Theme-compliant buttons matching AgriGuru brand system (exact match with confirmation).
        Sticky on mobile docked at viewport bottom, static on desktop at bottom of card.
      */}
      <div className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl">
        {/* Left Action Buttons: Print Preview & Download PDF (Disabled in Contract, Red themed like Confirmation) */}
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

        {/* Right Action Buttons: Save As Draft & Submit To Proforma */}
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

          {/* Submit To Proforma */}
          <button
            type="button"
            disabled={isSubmitting || readOnly}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group"
          >
            <span className="truncate">
              {isSubmitting ? 'Submitting...' : 'Submit To Proforma'}
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
        docNumber={contractNumber}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default ContractDocumentForm;
