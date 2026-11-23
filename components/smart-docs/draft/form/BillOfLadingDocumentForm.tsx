'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocUnderlineSelect, { DocSelectOption, isRawDbId } from './DocUnderlineSelect';
import DocToggle from './DocToggle';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import { toast } from 'sonner';
import {
  downloadDocPdfAction,
  getSmartDocsLoadingPortsByCountryAction,
  saveBillOfLadingDraftAction,
  submitBillOfLadingAction,
} from '@/app/actions/smart-docs';
import {
  type StepperDocumentItem,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  extractApiValidationErrors,
  getBillOfLadingStep,
  getBillOfLadingIdFromStepper,
  isBillOfLadingStep,
  getStepSelfId,
  extractStepRedirectId,
  extractLinkedBillOfLadingId,
  getWorkflowSubmitButtonInfo,
  isSameWorkflowStep,
  isValidCuidOrId,
} from '@/lib/api/smart-docs.service';
import { extractPortDisplayName } from './ProformaDocumentForm';

export interface FormOptionItem {
  value: string;
  label: string;
  subLabel?: string;
  [key: string]: any;
}

export interface ContainerItem {
  id?: string;
  index?: number;
  container_no: string;
  seal_no: string;
  bags: string | number;
  gross_weight: string | number;
  net_weight: string | number;
}

export interface BillOfLadingDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
  billOfLadingId?: string;
  shipmentInstructionId?: string;
  customInvoiceId?: string;
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
  currencies?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  onSaveDraft?: (payload: any) => Promise<any>;
  onSaveSuccess?: (savedId: string, savedData?: any) => void;
  onSubmitLading?: (payload: any, id?: string, nextStep?: StepperDocumentItem | null) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

export function safeString(val: any, fallback = ''): string {
  if (val === undefined || val === null) return fallback;
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
  if (typeof val === 'object') {
    const text =
      val.name ||
      val.title ||
      val.label ||
      val.value ||
      val.details ||
      val.address ||
      val.port_name ||
      val.company_name ||
      '';
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return fallback;
}

export function formatNumberWithCommas(val: number | string): string {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

export function formatWeightWithDecimals(val: number | string, decimals = 3): string {
  if (val === undefined || val === null || val === '') return '0.000';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0.000';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPartyBlock(party: any): { name: string; lines: string[] } {
  if (!party) return { name: '', lines: [] };
  if (typeof party === 'string') {
    const lines = party.split('\n').map((l) => l.trim()).filter(Boolean);
    const name = lines[0] || '';
    return { name, lines: lines.slice(1) };
  }
  if (typeof party === 'object') {
    const name =
      party.company_name ||
      party.name ||
      party.title ||
      party.label ||
      '';
    const lines: string[] = [];
    const addr = party.address || party.street || party.details || '';
    if (addr) lines.push(addr);

    const cityStateZip = [party.city, party.state, party.country, party.pincode || party.postal_code]
      .filter(Boolean)
      .join(', ');
    if (cityStateZip && !addr.includes(cityStateZip)) lines.push(cityStateZip);

    if (party.email) lines.push(`EMAIL: ${party.email}`);
    if (party.phone || party.contact || party.mobile || party.contact_no) {
      lines.push(`CONTACT: ${party.phone || party.contact || party.mobile || party.contact_no}`);
    }
    if (party.tax_id || party.reg_id || party.vat_number || party.gst_number) {
      lines.push(`TAX/REG ID: ${party.tax_id || party.reg_id || party.vat_number || party.gst_number}`);
    }

    return { name: name.trim(), lines };
  }
  return { name: '', lines: [] };
}

/**
 * Resolves initial shipping line value safely across BL API keys only
 * and ensures contract clauses like "SHIPMENT IN CONTAINERS ( DO NOT USE NVOCC & IRANIAN SHIPPING LINE )"
 * are never mistaken for the actual shipping line carrier.
 */
export function extractShippingLineValue(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};

  const candidates = [
    blObj?.shipping_line,
    blObj?.shipping_company,
    blObj?.shipping_company_name,
    blObj?.shipping_line_name,
    blObj?.carrier,
    blObj?.carrier_name,
    blObj?.liner,
    blObj?.liner_name,
    blObj?.shippingLine,
    blObj?.shippingCompany,
    data?.shipping_line,
    data?.shipping_company,
    data?.shipping_company_name,
    data?.shipping_line_name,
    data?.carrier,
    data?.carrier_name,
    data?.liner,
    data?.liner_name,
    data?.shipping_carrier,
    data?.shipping_agent,
    data?.shippingLine,
    data?.shippingCompany,
    data?.shippingLineName,
    data?.carrierName,
    data?.line_name,
    data?.line,
  ];

  for (const cand of candidates) {
    const val = safeString(cand);
    if (!val) continue;
    // Exclude the contract clause "SHIPMENT IN CONTAINERS ( DO NOT USE NVOCC & IRANIAN SHIPPING LINE )"
    if (/DO NOT USE NVOCC/i.test(val) || /SHIPMENT IN CONTAINERS/i.test(val) || /IRANIAN SHIPPING/i.test(val)) {
      continue;
    }
    return val;
  }

  return '';
}

/**
 * Resolves place_of_delivery strictly from Bill of Lading API response.
 */
export function resolvePlaceOfDelivery(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};

  const candidates = [
    blObj?.place_of_delivery,
    blObj?.placeOfDelivery,
    data?.place_of_delivery,
    data?.placeOfDelivery,
    blObj?.final_destination,
    data?.final_destination,
    data?.finalDestination,
    blObj?.place_of_receipt,
    data?.place_of_receipt,
    data?.receipt_place,
  ];

  for (const cand of candidates) {
    if (!cand) continue;
    if (typeof cand === 'object') {
      const extracted = extractPortDisplayName(cand);
      if (extracted) return extracted;
    }
    if (typeof cand === 'string') {
      const trimmed = cand.trim();
      if (
        trimmed &&
        trimmed !== 'undefined' &&
        trimmed !== 'null' &&
        trimmed !== '[object Object]' &&
        !isValidCuidOrId(trimmed)
      ) {
        return trimmed;
      }
    }
  }

  return '';
}

/**
 * Resolves origin country ID strictly from Bill of Lading API response (`country_of_origin.id`).
 */
export function extractOriginCountryId(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};
  const originCandidates = [
    blObj?.country_of_origin,
    data?.country_of_origin,
    blObj?.origin_country,
    data?.origin_country,
  ];

  for (const orig of originCandidates) {
    if (orig && typeof orig === 'object') {
      const id = sanitizeDocId(orig.id || orig._id || orig.country_id || orig.countryId);
      if (id) return id;
    }
  }

  const directIdCandidates = [
    blObj?.country_of_origin_id,
    data?.country_of_origin_id,
    blObj?.origin_country_id,
    data?.origin_country_id,
  ];

  for (const cid of directIdCandidates) {
    const id = sanitizeDocId(cid);
    if (id) return id;
  }

  return '';
}

/**
 * Checks whether Bill of Lading API response explicitly enables `any_loading_port`.
 * Dropdown input is rendered ONLY when `any_loading_port` is true; otherwise plain text is shown.
 */
export function parseBillOfLadingAnyLoadingPort(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};
  const raw =
    blObj?.any_loading_port ??
    blObj?.anyLoadingPort ??
    blObj?.is_any_loading_port ??
    data?.any_loading_port ??
    data?.anyLoadingPort ??
    data?.is_any_loading_port ??
    data?.isAnyLoadingPort ??
    data?.contract?.any_loading_port ??
    data?.shipment_instruction?.any_loading_port;

  return raw === true || raw === 1 || raw === 'true' || raw === '1';
}

/**
 * Checks whether Bill of Lading API response explicitly enables `ectn_field`.
 * Shows `ECTN NO:` input right below `SB.NO:` ONLY when `ectn_field` is true.
 */
export function parseBillOfLadingEctnField(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};
  const raw =
    blObj?.ectn_field ??
    blObj?.ectnField ??
    data?.ectn_field ??
    data?.ectnField ??
    data?.contract?.ectn_field ??
    data?.shipment_instruction?.ectn_field;

  return raw === true || raw === 1 || raw === 'true' || raw === '1';
}

/**
 * Resolves saved loading port ID/value strictly from Bill of Lading API response (no auto-selection).
 */
export function extractBillOfLadingPortValue(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};

  const idCandidates = [
    blObj?.loading_port_id,
    blObj?.loadingPortId,
    blObj?.port_of_loading_id,
    blObj?.portOfLoadingId,
    data?.loading_port_id,
    data?.loadingPortId,
    data?.port_of_loading_id,
    data?.portOfLoadingId,
  ];
  for (const c of idCandidates) {
    const clean = sanitizeDocId(c);
    if (clean) return clean;
  }

  const objCandidates = [
    blObj?.loading_port,
    blObj?.port_of_loading,
    blObj?.loadingPort,
    blObj?.portOfLoading,
    data?.loading_port,
    data?.port_of_loading,
    data?.loadingPort,
    data?.portOfLoading,
    data?.pol,
  ];
  for (const c of objCandidates) {
    if (!c) continue;
    if (typeof c === 'object') {
      const id = sanitizeDocId(c.id || c._id || c.port_id || c.value);
      if (id) return id;
      const label = extractPortDisplayName(c);
      if (label) return label;
    }
    if (typeof c === 'string') {
      const trimmed = c.trim();
      if (trimmed && trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== '[object Object]') {
        return trimmed;
      }
    }
  }

  return '';
}

/**
 * Resolves human-readable fallback display label for a saved loading port on Bill of Lading.
 */
export function extractBillOfLadingPortLabel(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};
  const candidates = [
    blObj?.loading_port,
    blObj?.port_of_loading,
    data?.loading_port,
    data?.port_of_loading,
    data?.port_of_loading_name,
    data?.loading_port_name,
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'object') {
      const name = safeString(c.name || c.port_name || c.label || c.title);
      const countryName =
        typeof c.country === 'object' && c.country !== null
          ? safeString(c.country.name || c.country.title || c.country.label)
          : safeString(c.country || c.country_name || c.countryName);
      if (name && !isRawDbId(name)) {
        if (countryName && !name.toLowerCase().includes(countryName.toLowerCase())) {
          return `${name}, ${countryName}`;
        }
        return name;
      }
    }
    if (typeof c === 'string') {
      const trimmed = c.trim();
      if (trimmed && !isRawDbId(trimmed) && trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== '[object Object]') {
        return trimmed;
      }
    }
  }

  return '';
}

/**
 * Resolves destination country from destination_port.country.name strictly from BL API response.
 */
export function resolveCountryOfDestination(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};

  const portCandidates = [
    blObj?.destination_port,
    blObj?.port_of_destination,
    data?.destination_port,
    data?.port_of_destination,
    data?.destinationPort,
    data?.discharge_port,
    data?.pod,
  ];

  for (const dp of portCandidates) {
    if (dp && typeof dp === 'object') {
      // destination_port.country.name
      if (dp.country && typeof dp.country === 'object') {
        const cName = dp.country.name || dp.country.title || dp.country.label;
        if (cName && typeof cName === 'string' && cName.trim()) {
          return cName.trim();
        }
      } else if (typeof dp.country === 'string' && dp.country.trim()) {
        const cStr = dp.country.trim();
        if (cStr && cStr !== 'undefined' && cStr !== 'null') return cStr;
      }
      if (dp.country_name || dp.countryName) {
        const cName = dp.country_name || dp.countryName;
        if (cName && typeof cName === 'string' && cName.trim()) {
          return cName.trim();
        }
      }
    }
  }

  const direct =
    blObj?.country_of_destination ||
    data?.country_of_destination ||
    data?.destination_country ||
    data?.country_destination ||
    data?.destination_port_country ||
    data?.destination_port_country_name ||
    data?.final_destination_country;

  if (direct && typeof direct === 'object') {
    const cName = safeString(direct.name || direct.title || direct.label);
    if (cName) return cName;
  }
  if (direct && typeof direct === 'string' && direct.trim()) {
    const t = direct.trim();
    if (t !== 'undefined' && t !== 'null' && t !== '[object Object]') return t;
  }

  return '';
}

/**
 * Resolves destination port name formatted with country: `${destination_port.name}, ${country}` strictly from BL API response.
 */
export function resolvePortOfDestination(data: any, resolvedCountry = ''): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};

  const portCandidates = [
    blObj?.destination_port,
    blObj?.port_of_destination,
    data?.destination_port,
    data?.port_of_destination,
    data?.destinationPort,
    data?.discharge_port,
    data?.pod,
    data?.destination_port_name,
  ];

  for (const dp of portCandidates) {
    if (!dp) continue;

    if (typeof dp === 'object') {
      const name = dp.name || dp.port_name || dp.label || dp.title;
      const c = dp.country;
      const cName =
        (typeof c === 'object' && c !== null ? c.name || c.title || c.label : typeof c === 'string' ? c : '') ||
        dp.country_name ||
        dp.countryName ||
        resolvedCountry;

      const cleanPortName = name && typeof name === 'string' ? name.trim() : '';
      const cleanCountry = cName && typeof cName === 'string' ? cName.trim() : '';

      if (cleanPortName && !isValidCuidOrId(cleanPortName)) {
        if (cleanCountry && !cleanPortName.toLowerCase().includes(cleanCountry.toLowerCase())) {
          return `${cleanPortName}, ${cleanCountry}`;
        }
        return cleanPortName;
      }
      if (cleanCountry) return cleanCountry;
    }

    if (typeof dp === 'string') {
      const trimmed = dp.trim();
      if (
        trimmed &&
        trimmed !== 'undefined' &&
        trimmed !== 'null' &&
        trimmed !== '[object Object]' &&
        !isValidCuidOrId(trimmed)
      ) {
        if (resolvedCountry && !trimmed.toLowerCase().includes(resolvedCountry.toLowerCase())) {
          return `${trimmed}, ${resolvedCountry}`;
        }
        return trimmed;
      }
    }
  }

  if (resolvedCountry) return resolvedCountry;
  return '';
}

function hasNonEmptyContainerValue(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
}

function parseContainerIndex(rawIndex: any, fallback: number): number {
  if (rawIndex !== undefined && rawIndex !== null && String(rawIndex).trim() !== '') {
    const parsed = Number(rawIndex);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

function formatContainerWeightForPayload(val: string | number | undefined | null): string | undefined {
  if (!hasNonEmptyContainerValue(val)) return undefined;
  const cleaned = String(val).replace(/,/g, '').trim();
  // Normalize valid decimal inputs (up to 5 digits before decimal and up to 3 after)
  // to fixed 3 decimal places as string (e.g. "26200" -> "26200.000", "26200.5" -> "26200.500")
  // while keeping invalid/out-of-range values verbatim so backend validation reports them accurately.
  if (/^\d{1,5}(?:\.\d{1,3})?$/.test(cleaned)) {
    const [intPart, decPart = ''] = cleaned.split('.');
    return `${intPart}.${decPart.padEnd(3, '0')}`;
  }
  return cleaned;
}

function formatWeightMtsForPayload(mts: number): string {
  if (!isFinite(mts) || isNaN(mts) || mts <= 0) return '0.000';
  return mts.toFixed(3);
}

function normalizeDisplayWeightMts(raw: any): string {
  if (!hasNonEmptyContainerValue(raw)) return '';
  const str = String(raw).replace(/,/g, '').replace(/\s*(?:MTS?|KGS?)\s*$/i, '').trim();
  const parsed = Number(str);
  if (!isNaN(parsed) && isFinite(parsed)) {
    return parsed > 0 ? parsed.toFixed(3) : '';
  }
  return str;
}

function normalizeContainerDisplayValue(val: any): string {
  if (!hasNonEmptyContainerValue(val)) return '';
  return String(val).trim();
}

function buildInitialContainers(data: any): ContainerItem[] {
  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading;
  const existing =
    data?.containers ||
    blObj?.containers ||
    data?.container_details ||
    data?.container_list;
  const rawFcl =
    data?.fcl ||
    blObj?.fcl ||
    data?.no_of_containers ||
    data?.fcl_quantity ||
    data?.total_fcl;
  const fclCount = Number(rawFcl);

  const existingArr = Array.isArray(existing) ? existing : [];
  const maxExistingIndex = existingArr.reduce((max: number, c: any, i: number) => {
    const idx = parseContainerIndex(c?.index, i);
    return Math.max(max, idx);
  }, -1);

  const targetCount = Math.max(
    !isNaN(fclCount) && fclCount > 0 ? fclCount : 0,
    existingArr.length,
    maxExistingIndex + 1,
    1
  );

  const slots: ContainerItem[] = [];
  for (let i = 0; i < targetCount; i++) {
    slots.push({
      id: `c-${i}`,
      index: i,
      container_no: '',
      seal_no: '',
      bags: '',
      gross_weight: '',
      net_weight: '',
    });
  }

  existingArr.forEach((c: any, i: number) => {
    const parsedIdx = parseContainerIndex(c?.index, i);
    const slotIdx = parsedIdx >= 0 && parsedIdx < targetCount ? parsedIdx : i;
    if (slotIdx >= 0 && slotIdx < slots.length) {
      slots[slotIdx] = {
        id: c.id || `c-${slotIdx}`,
        index: slotIdx,
        container_no: safeString(c.container_number || c.container_no || c.containerNo),
        seal_no: safeString(c.seal_number || c.seal_no || c.sealNo),
        bags: normalizeContainerDisplayValue(c.bags ?? c.total_bags),
        gross_weight: normalizeContainerDisplayValue(c.gross_weight ?? c.grossWeight ?? c.gross_wt),
        net_weight: normalizeContainerDisplayValue(c.net_weight ?? c.netWeight ?? c.net_wt),
      };
    }
  });

  return slots;
}

const BILL_OF_LADING_FIELD_PRIORITY = [
  'documentTitle',
  'is_watermark_enabled',
  'vessel_name',
  'shipping_line',
  'voyage_no',
  'bl_no',
  'sailing_date',
  'arrival_date',
  'booking_no',
  'tracking_link',
  'port_of_loading',
  'sb_no',
  'ectn_number',
  'containers',
  'notes_title',
  'notes_comment',
] as const;

export function scrollToAndFocusBillOfLadingField(
  fieldErrorsOrKey: string | Record<string, string>
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let targetKey = '';
  if (typeof fieldErrorsOrKey === 'string') {
    targetKey = fieldErrorsOrKey;
  } else if (fieldErrorsOrKey && typeof fieldErrorsOrKey === 'object') {
    for (const key of BILL_OF_LADING_FIELD_PRIORITY) {
      if (fieldErrorsOrKey[key]) {
        targetKey = key;
        break;
      }
    }
    if (!targetKey) {
      const containerKey = Object.keys(fieldErrorsOrKey).find(
        (k) => k.startsWith('containers.') && fieldErrorsOrKey[k]
      );
      targetKey = containerKey || Object.keys(fieldErrorsOrKey).find((k) => fieldErrorsOrKey[k]) || '';
    }
  }

  if (!targetKey) return;

  const domIdCandidates: string[] = [];
  if (targetKey.startsWith('containers.')) {
    const parts = targetKey.split('.');
    if (parts.length === 3) {
      domIdCandidates.push(`field-containers-${parts[1]}-${parts[2]}`);
    }
    domIdCandidates.push('field-containers');
  } else {
    domIdCandidates.push(`field-${targetKey}`);
  }

  let el: HTMLElement | null = null;
  for (const candidateId of domIdCandidates) {
    el =
      document.getElementById(candidateId) ||
      document.querySelector<HTMLElement>(`[data-field="${candidateId.replace(/^field-/, '')}"]`);
    if (el) break;
  }

  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusTarget =
    el.matches('input, select, textarea, button')
      ? el
      : el.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');

  if (focusTarget) {
    setTimeout(() => {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        focusTarget.focus();
      }
    }, 150);
  }
}

function normalizeContainerColumnKey(rawCol: string): keyof ContainerItem | null {
  const clean = String(rawCol || '').trim().toLowerCase().replace(/[-\s]/g, '_');
  if (['container_no', 'containerno', 'container_number', 'containernumber', 'container'].includes(clean)) {
    return 'container_no';
  }
  if (['seal_no', 'sealno', 'seal_number', 'sealnumber', 'seal'].includes(clean)) {
    return 'seal_no';
  }
  if (['bags', 'total_bags', 'bag_count', 'no_of_bags', 'number_of_bags'].includes(clean)) {
    return 'bags';
  }
  if (['gross_weight', 'grossweight', 'gross_wt', 'grosswt', 'gross_weight_kg'].includes(clean)) {
    return 'gross_weight';
  }
  if (['net_weight', 'netweight', 'net_wt', 'netwt', 'net_weight_kg'].includes(clean)) {
    return 'net_weight';
  }
  return null;
}

function mapBillOfLadingFieldNameToKey(rawField: string): string | null {
  const f = String(rawField || '').trim();
  if (!f) return null;

  // Match nested container paths: containers.0.container_no, containers[0].seal_no, container_details.1.bags
  const containerIdxMatch = f.match(/^(?:containers|container_details|container_list|container)[\[.](\d+)\]?\.([a-zA-Z0-9_-]+)$/i);
  if (containerIdxMatch) {
    const idx = containerIdxMatch[1];
    const col = normalizeContainerColumnKey(containerIdxMatch[2]);
    if (col) return `containers.${idx}.${col}`;
    return 'containers';
  }

  const clean = f.toLowerCase().replace(/[-_.\s]/g, '');

  switch (clean) {
    case 'pdftitle':
    case 'documenttitle':
    case 'customdoctitle':
    case 'doctitle':
      return 'documentTitle';
    case 'iswatermarkenabled':
    case 'watermarkenabled':
    case 'watermark':
      return 'is_watermark_enabled';
    case 'vesselname':
    case 'vessel':
    case 'vesselno':
    case 'vesselnumber':
      return 'vessel_name';
    case 'shippingline':
    case 'shippingcompany':
    case 'shippingcompanyname':
    case 'shippinglinename':
    case 'carrier':
    case 'carriername':
    case 'liner':
    case 'linername':
    case 'shippingcarrier':
    case 'shippingagent':
    case 'linename':
    case 'line':
      return 'shipping_line';
    case 'voyageno':
    case 'voyagenumber':
    case 'voyage':
    case 'vesselvoyageno':
      return 'voyage_no';
    case 'blno':
    case 'blnumber':
    case 'billofladingno':
    case 'billofladingnumber':
    case 'ladingno':
    case 'ladingnumber':
      return 'bl_no';
    case 'sailingdate':
    case 'etd':
    case 'dateofsailing':
    case 'shippedonboarddate':
    case 'onboarddate':
    case 'departuredate':
    case 'bldate':
    case 'billofladingdate':
      return 'sailing_date';
    case 'arrivaldate':
    case 'eta':
    case 'dateofarrival':
    case 'expectedarrivaldate':
    case 'estimatedarrivaldate':
    case 'transitdays':
      return 'arrival_date';
    case 'bookingno':
    case 'bookingnumber':
    case 'bookingref':
    case 'bookingreference':
      return 'booking_no';
    case 'trackinglink':
    case 'trackingurl':
    case 'tracklink':
    case 'trackurl':
      return 'tracking_link';
    case 'portofloading':
    case 'portofloadingid':
    case 'loadingport':
    case 'loadingportid':
    case 'pol':
    case 'polid':
      return 'port_of_loading';
    case 'sbno':
    case 'sbnumber':
    case 'shippingbillno':
    case 'shippingbillnumber':
      return 'sb_no';
    case 'ectnnumber':
    case 'ectnno':
    case 'ectn':
      return 'ectn_number';
    case 'containers':
    case 'containerdetails':
    case 'containerlist':
    case 'totalbags':
    case 'totalgrossweight':
    case 'totalnetweight':
      return 'containers';
    case 'containerno':
    case 'containernumber':
      return 'containers.0.container_no';
    case 'sealno':
    case 'sealnumber':
      return 'containers.0.seal_no';
    case 'bags':
      return 'containers.0.bags';
    case 'grossweight':
    case 'grosswt':
      return 'containers.0.gross_weight';
    case 'netweight':
    case 'netwt':
      return 'containers.0.net_weight';
    case 'commentlabel':
    case 'commenttitle':
    case 'notestitle':
    case 'extratitle':
      return 'notes_title';
    case 'commentvalue':
    case 'commenttext':
    case 'notescomment':
    case 'extracomment':
    case 'comment':
      return 'notes_comment';
    default:
      return null;
  }
}

function detectBillOfLadingFieldInSentence(sentence: string): string | null {
  const s = String(sentence || '').trim();
  if (!s) return null;

  // Check explicit NestJS prefix: "<field> should not be empty" / "<field> must be ..."
  const prefixMatch = s.match(/^([a-zA-Z0-9_.\[\]-]+)\s+(?:should|must|is|cannot|has|contains)\b/i);
  if (prefixMatch && prefixMatch[1]) {
    const mapped = mapBillOfLadingFieldNameToKey(prefixMatch[1]);
    if (mapped) return mapped;
  }

  const lower = s.toLowerCase();
  if (/\bvessel\b/.test(lower)) return 'vessel_name';
  if (/\bshipping\s*line\b|\bshipping\s*company\b|\bcarrier\b|\bliner\b/.test(lower)) return 'shipping_line';
  if (/\bvoyage\b/.test(lower)) return 'voyage_no';
  if (/\bbl\s*(?:no|number)\b|\bbill\s*of\s*lading\s*(?:no|number)\b/.test(lower)) return 'bl_no';
  if (/\bsailing\s*date\b|\betd\b|\bon\s*board\s*date\b/.test(lower)) return 'sailing_date';
  if (/\barrival\s*date\b|\beta\b/.test(lower)) return 'arrival_date';
  if (/\bbooking\s*(?:no|number|ref)\b/.test(lower)) return 'booking_no';
  if (/\btracking\s*(?:link|url)\b/.test(lower)) return 'tracking_link';
  if (/\bport\s*of\s*loading\b|\bloading\s*port\b/.test(lower)) return 'port_of_loading';
  if (/\bshipping\s*bill\b|\bsb\s*\.?\s*(?:no|number)\b/.test(lower)) return 'sb_no';
  if (/\bectn\b/.test(lower)) return 'ectn_number';
  if (/\bcontainer\s*(?:no|number)\b/.test(lower)) return 'containers.0.container_no';
  if (/\bseal\s*(?:no|number)\b/.test(lower)) return 'containers.0.seal_no';
  if (/\bcontainer(?:s)?\b/.test(lower)) return 'containers';
  if (/\bcomment\s*(?:label|title)\b|\bnotes\s*title\b/.test(lower)) return 'notes_title';
  if (/\bcomment\s*(?:value|text)\b|\bnotes\s*comment\b/.test(lower)) return 'notes_comment';
  if (/\bpdf\s*title\b|\bdocument\s*title\b/.test(lower)) return 'documentTitle';
  if (/\bwatermark\b/.test(lower)) return 'is_watermark_enabled';

  return null;
}

export function parseBillOfLadingBackendErrors(
  errorResponse: any,
  payloadRowIndices?: number[]
): {
  fieldErrors: Record<string, string>;
  unmatchedErrors: Array<{ field: string; message: string }>;
  generalError?: string;
} {
  const fieldErrors: Record<string, string> = {};
  const unmatchedMap = new Map<string, string>();
  let generalError: string | undefined = undefined;

  if (!errorResponse) return { fieldErrors, unmatchedErrors: [] };

  const METADATA_KEYS = new Set([
    'status',
    'statuscode',
    'status_code',
    'success',
    'code',
    'error_code',
    'errorcode',
    'stack',
    'raw',
    'path',
    'timestamp',
    'method',
    'ok',
    'id',
    '_id',
    'bill_of_lading_id',
    'lading_id',
    'bl_id',
    'shipment_instruction_id',
    'custom_invoice_id',
    'proforma_id',
    'contract_id',
    'confirmation_id',
  ]);

  const isGenericValidationString = (str: string): boolean => {
    const s = String(str || '').trim();
    return (
      !s ||
      /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred|failed to save bill of lading draft|failed to submit bill of lading|failed to submit bill of lading\.\s*please check highlighted fields\.?)$/i.test(
        s
      ) ||
      /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
      /<(!DOCTYPE|html)/i.test(s) ||
      /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
      /^(not found|bad gateway|service unavailable)$/i.test(s)
    );
  };

  const remapContainerKey = (key: string): string => {
    if (!payloadRowIndices || payloadRowIndices.length === 0) return key;
    const m = key.match(/^containers\.(\d+)\.([a-zA-Z0-9_]+)$/);
    if (!m) return key;
    const payloadIdx = Number(m[1]);
    if (!isNaN(payloadIdx) && payloadIdx >= 0 && payloadIdx < payloadRowIndices.length) {
      return `containers.${payloadRowIndices[payloadIdx]}.${m[2]}`;
    }
    return key;
  };

  const recordError = (rawField: string | undefined, rawMsg: string) => {
    const msg = String(rawMsg || '').trim();
    if (!msg || isGenericValidationString(msg)) return;

    const cleanHint = rawField ? String(rawField).trim() : '';
    const rawMapped =
      (cleanHint ? mapBillOfLadingFieldNameToKey(cleanHint) : null) ||
      detectBillOfLadingFieldInSentence(msg);
    const mapped = rawMapped ? remapContainerKey(rawMapped) : null;

    if (mapped) {
      if (!fieldErrors[mapped]) {
        fieldErrors[mapped] = msg;
      } else if (!fieldErrors[mapped].includes(msg)) {
        fieldErrors[mapped] = `${fieldErrors[mapped]}, ${msg}`;
      }
      return;
    }

    if (cleanHint && !/^\d+$/.test(cleanHint) && !METADATA_KEYS.has(cleanHint.toLowerCase()) && cleanHint !== 'message' && cleanHint !== 'error') {
      if (!unmatchedMap.has(cleanHint)) {
        unmatchedMap.set(cleanHint, msg);
      }
      return;
    }

    if (!generalError) {
      generalError = msg;
    }
  };

  const ingestItem = (fieldHint: string | undefined, val: any) => {
    if (val === undefined || val === null) return;

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return;
      // Split comma-joined NestJS validation strings (e.g. "container_number must be a string, container_number should not be empty")
      const parts = !fieldHint && trimmed.includes(',')
        ? trimmed.split(/\s*,\s*/).filter(Boolean)
        : [trimmed];
      parts.forEach((part) => {
        const colonMatch = !fieldHint ? part.match(/^([a-zA-Z0-9_.\[\]-]+)\s*:\s*(.+)$/) : null;
        if (colonMatch) {
          recordError(colonMatch[1], colonMatch[2]);
        } else {
          recordError(fieldHint, part);
        }
      });
      return;
    }

    if (Array.isArray(val)) {
      val.forEach((sub, idx) => {
        const nextHint =
          fieldHint && /^(containers|container_details|container_list)$/i.test(fieldHint)
            ? `${fieldHint}.${idx}`
            : fieldHint;
        ingestItem(nextHint, sub);
      });
      return;
    }

    if (typeof val === 'object') {
      const prop = val.property || val.field || val.key || val.path || val.param;
      const effectiveHint = prop
        ? fieldHint && !fieldHint.endsWith(String(prop)) && /^(containers|container_details|container_list)(?:\.\d+)?$/i.test(fieldHint)
          ? `${fieldHint}.${prop}`
          : String(prop)
        : fieldHint;

      if (val.constraints && typeof val.constraints === 'object') {
        Object.values(val.constraints).forEach((cMsg: any) => {
          if (typeof cMsg === 'string') recordError(effectiveHint, cMsg);
        });
      }

      if (Array.isArray(val.children) && val.children.length > 0) {
        val.children.forEach((child: any) => ingestItem(effectiveHint, child));
      }

      const directMsg = val.message || val.msg || val.error || val.detail || val.description;
      if (typeof directMsg === 'string' && directMsg.trim()) {
        recordError(effectiveHint, directMsg);
      } else if (Array.isArray(directMsg)) {
        directMsg.forEach((m: any) => ingestItem(effectiveHint, m));
      }

      if (!val.constraints && !val.children && !directMsg) {
        Object.entries(val).forEach(([k, v]) => {
          const lowerK = k.toLowerCase();
          if (METADATA_KEYS.has(lowerK)) return;
          if (lowerK === 'message' || lowerK === 'error') {
            ingestItem(undefined, v);
            return;
          }
          const nestedHint =
            effectiveHint && /^(containers|container_details|container_list)(?:\.\d+)?$/i.test(effectiveHint)
              ? `${effectiveHint}.${k}`
              : k;
          ingestItem(nestedHint, v);
        });
      }
    }
  };

  const sources = [
    errorResponse.error_fields,
    errorResponse.data?.error_fields,
    errorResponse.raw?.error_fields,
    errorResponse.raw?.data?.error_fields,
    errorResponse.errors,
    errorResponse.data?.errors,
    errorResponse.raw?.errors,
    errorResponse.raw?.data?.errors,
    errorResponse.message,
    errorResponse.raw?.message,
    errorResponse.error,
    errorResponse.raw?.error,
    errorResponse.data?.message,
  ];

  sources.forEach((src) => {
    if (src) ingestItem(undefined, src);
  });

  // Also leverage shared extractApiValidationErrors for deeply nested NestJS validation payloads
  try {
    const extracted = extractApiValidationErrors(errorResponse);
    extracted.forEach((item) => {
      if (item && item.message) {
        recordError(item.field || undefined, item.message);
      }
    });
  } catch {
    // ignore
  }

  const unmatchedErrors = Array.from(unmatchedMap.entries()).map(([field, message]) => ({
    field,
    message,
  }));

  if (!generalError) {
    const rawGeneral =
      errorResponse.message ||
      errorResponse.error ||
      errorResponse.data?.message ||
      errorResponse.raw?.message;
    if (typeof rawGeneral === 'string' && rawGeneral.trim() && !isGenericValidationString(rawGeneral)) {
      generalError = rawGeneral.trim();
    }
  }

  return { fieldErrors, unmatchedErrors, generalError };
}

export default function BillOfLadingDocumentForm({
  initialData,
  dataVersion = 0,
  billOfLadingId,
  shipmentInstructionId,
  customInvoiceId,
  proformaId,
  contractId,
  confirmationId,
  steps,
  selectedStep,
  onUpdateSteps,
  onSelectStep,
  sellers = [],
  buyers = [],
  products = [],
  currencies = [],
  shippingTerms = [],
  onSaveDraft,
  onSaveSuccess,
  onSubmitLading,
  lang = 'en',
  dict,
  readOnly = false,
}: BillOfLadingDocumentFormProps) {
  // Stepper & Active IDs Resolution
  const selfStep = useMemo(() => getBillOfLadingStep(steps, selectedStep), [steps, selectedStep]);
  const cleanSelfId = useMemo(() => getBillOfLadingIdFromStepper(steps, selectedStep), [steps, selectedStep]);

  const effectiveBLId = useMemo(() => {
    return (
      billOfLadingId ||
      cleanSelfId ||
      sanitizeDocId(
        initialData?.bill_of_lading_id ||
        initialData?.lading_id ||
        initialData?.bl_id ||
        ((initialData?.bl_number || initialData?.bl_no) ? initialData?.id : '')
      ) ||
      extractStepRedirectId(selfStep) ||
      extractLinkedBillOfLadingId(initialData) ||
      shipmentInstructionId ||
      confirmationId ||
      ''
    );
  }, [billOfLadingId, cleanSelfId, initialData, selfStep, shipmentInstructionId, confirmationId]);

  const [draftId, setDraftId] = useState<string>(() => sanitizeDocId(effectiveBLId) || '');
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState(false);

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unmatchedErrors, setUnmatchedErrors] = useState<Array<{ field: string; message: string }>>([]);

  const isDraftSavedToBackendRef = useRef<boolean>(Boolean(effectiveBLId));

  // Form Fields State
  const [customDocTitle, setCustomDocTitle] = useState<string>(() => {
    return (
      safeString(initialData?.pdf_title) ||
      safeString(initialData?.document_title) ||
      'BILL OF LADING'
    );
  });

  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(() => {
    const val = initialData?.is_watermark_enabled ?? initialData?.watermark_enabled ?? initialData?.watermark;
    if (val === undefined || val === null) return true;
    return typeof val === 'string' ? val !== 'false' && val !== '0' : Boolean(val);
  });

  // Voyage & Header Details
  const [vesselName, setVesselName] = useState<string>(() => safeString(initialData?.vessel_name || initialData?.vessel));
  const [shippingLine, setShippingLine] = useState<string>(() => extractShippingLineValue(initialData));
  const [voyageNo, setVoyageNo] = useState<string>(() =>
    safeString(initialData?.voyage_number || initialData?.voyage_no || initialData?.voyageNo || initialData?.voyage)
  );
  const [blNo, setBlNo] = useState<string>(() =>
    safeString(
      initialData?.bl_number ||
      initialData?.bl_no ||
      initialData?.blNo ||
      initialData?.bill_of_lading_no ||
      initialData?.bill_of_lading_number
    )
  );

  const [sailingDate, setSailingDate] = useState<string>(() => {
    const d = initialData?.sailing_date || initialData?.sailingDate || initialData?.etd;
    if (!d) return '';
    try {
      const dt = new Date(d);
      return !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : String(d).split('T')[0];
    } catch {
      return String(d);
    }
  });

  const [arrivalDate, setArrivalDate] = useState<string>(() => {
    const d = initialData?.arrival_date || initialData?.arrivalDate || initialData?.eta;
    if (!d) return '';
    try {
      const dt = new Date(d);
      return !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : String(d).split('T')[0];
    } catch {
      return String(d);
    }
  });

  const [bookingNo, setBookingNo] = useState<string>(() =>
    safeString(initialData?.booking_number || initialData?.booking_no || initialData?.bookingNo)
  );
  const [trackingLink, setTrackingLink] = useState<string>(() => safeString(initialData?.tracking_link || initialData?.trackingLink || initialData?.tracking_url));

  // Dynamic Transit Days calculation (numeric count for API, formatted display for UI)
  const transitDaysNumber = useMemo<number | null>(() => {
    if (sailingDate && arrivalDate) {
      try {
        const d1 = new Date(sailingDate);
        const d2 = new Date(arrivalDate);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          const diffTime = d2.getTime() - d1.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) return diffDays;
        }
      } catch {
        // fallback below
      }
    }
    const rawTransit = initialData?.transit_days;
    if (rawTransit !== undefined && rawTransit !== null && String(rawTransit).trim() !== '') {
      const parsed = parseInt(String(rawTransit).replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return null;
  }, [sailingDate, arrivalDate, initialData?.transit_days]);

  const transitDays = useMemo(() => {
    if (transitDaysNumber !== null) return `${transitDaysNumber} DAYS`;
    return '-';
  }, [transitDaysNumber]);

  // Whether loading port can be picked via dropdown (only when any_loading_port === true)
  const isAnyLoadingPort = useMemo(() => parseBillOfLadingAnyLoadingPort(initialData), [initialData]);

  // Port of Loading (Strictly from BL API saved value; NO auto-selection)
  const [portOfLoading, setPortOfLoading] = useState<string>(() => {
    return extractBillOfLadingPortValue(initialData);
  });

  // Shipping Bill No (SB. NO)
  const [sbNo, setSbNo] = useState<string>(() =>
    safeString(initialData?.shipping_bill_no || initialData?.sb_no || initialData?.shipping_bill_number)
  );

  // ECTN NO (Rendered directly below SB.NO ONLY when ectn_field is true)
  const isEctnEnabled = useMemo(() => parseBillOfLadingEctnField(initialData), [initialData]);
  const [ectnNumber, setEctnNumber] = useState<string>(() =>
    safeString(
      initialData?.ectn_number ||
      initialData?.ectnNumber ||
      initialData?.bill_of_lading?.ectn_number ||
      initialData?.ectn_no
    )
  );

  // Containers List
  const [containers, setContainers] = useState<ContainerItem[]>(() => buildInitialContainers(initialData));

  // Notes Title & Comment
  const [notesTitle, setNotesTitle] = useState<string>(() => {
    return safeString(
      initialData?.comment_label ||
      initialData?.comment_title ||
      initialData?.notes_title ||
      initialData?.extra_title
    );
  });

  const [notesComment, setNotesComment] = useState<string>(() => {
    return safeString(
      initialData?.comment_value ||
      initialData?.comment_text ||
      initialData?.notes_comment ||
      initialData?.comment ||
      initialData?.extra_comment
    );
  });

  // Parties & Trade Details strictly from Bill of Lading API Response
  const exporterText = useMemo(() => {
    const blObj = initialData?.bill_of_lading || initialData?.lading || initialData?.billOfLading || {};
    const rawDetails =
      blObj?.seller_details ||
      blObj?.shipper_details ||
      initialData?.seller_details ||
      initialData?.shipper_details ||
      blObj?.seller ||
      blObj?.shipper ||
      initialData?.seller ||
      initialData?.shipper;

    if (typeof rawDetails === 'string' && rawDetails.trim()) {
      const trimmed = rawDetails.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          const ins =
            parsed.instruction ||
            parsed.instructionText ||
            parsed.instruction_text ||
            parsed.seller_instruction ||
            parsed.details;
          if (ins) return safeString(ins);
          const party = formatPartyBlock(parsed);
          const parts = [party.name, ...party.lines].filter(Boolean);
          if (parts.length > 0) return parts.join('\n');
        } catch {}
      }
      return trimmed;
    }

    if (typeof rawDetails === 'object' && rawDetails !== null) {
      const ins =
        rawDetails.instruction ||
        rawDetails.instructionText ||
        rawDetails.instruction_text ||
        rawDetails.seller_instruction ||
        rawDetails.details;
      if (ins) return safeString(ins);

      const party = formatPartyBlock(rawDetails);
      const parts = [party.name, ...party.lines].filter(Boolean);
      if (parts.length > 0) return parts.join('\n');
    }

    if (blObj?.seller_instruction) return safeString(blObj.seller_instruction);
    if (initialData?.seller_instruction) return safeString(initialData.seller_instruction);

    return '';
  }, [initialData]);

  const consigneeText = useMemo(() => {
    const blObj = initialData?.bill_of_lading || initialData?.lading || initialData?.billOfLading || {};
    const rawConsignee =
      blObj?.consignee_details ||
      blObj?.buyer_details ||
      initialData?.consignee_details ||
      initialData?.buyer_details ||
      blObj?.consignee ||
      blObj?.buyer ||
      initialData?.consignee ||
      initialData?.buyer;

    if (typeof rawConsignee === 'string' && rawConsignee.trim()) {
      const trimmed = rawConsignee.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.details) return safeString(parsed.details);
          if (parsed.instruction) return safeString(parsed.instruction);
          const party = formatPartyBlock(parsed);
          return [party.name, ...party.lines].filter(Boolean).join('\n');
        } catch {}
      }
      return trimmed;
    }

    if (typeof rawConsignee === 'object' && rawConsignee !== null) {
      if (rawConsignee.details && typeof rawConsignee.details === 'string') {
        return rawConsignee.details.trim();
      }
      if (rawConsignee.instruction && typeof rawConsignee.instruction === 'string') {
        return rawConsignee.instruction.trim();
      }
      if (rawConsignee.instructionText && typeof rawConsignee.instructionText === 'string') {
        return rawConsignee.instructionText.trim();
      }

      const party = formatPartyBlock(rawConsignee);
      const parts = [party.name, ...party.lines].filter(Boolean);
      if (parts.length > 0) return parts.join('\n');
    }

    if (initialData?.consignee_details_text) return String(initialData.consignee_details_text).trim();

    return '';
  }, [initialData]);

  // Extract Notify Parties strictly from Bill of Lading API response
  const extractNotifyPartyText = useCallback(
    (index1Based: number) => {
      const blObj = initialData?.bill_of_lading || initialData?.lading || initialData?.billOfLading || {};
      const rawList = blObj?.notify_parties || initialData?.notify_parties || initialData?.notify_party_list;
      const item = Array.isArray(rawList) ? rawList[index1Based - 1] : null;

      const candidate =
        blObj?.[`notify_party_${index1Based}_instruction`] ||
        blObj?.[`notify_party_${index1Based}_details`] ||
        blObj?.[`notify_party_${index1Based}_text`] ||
        blObj?.[`notify_party_${index1Based}`]?.details ||
        blObj?.[`notify_party_${index1Based}`] ||
        initialData?.[`notify_party_${index1Based}_instruction`] ||
        initialData?.[`notify_party_${index1Based}_details`] ||
        initialData?.[`notify_party_${index1Based}_text`] ||
        initialData?.[`notify_party_${index1Based}`]?.details ||
        initialData?.[`notify_party_${index1Based}`] ||
        initialData?.[`notifyParty${index1Based}Details`] ||
        initialData?.[`notifyParty${index1Based}`] ||
        item;

      if (!candidate) return '';
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.details) return safeString(parsed.details);
            const party = formatPartyBlock(parsed);
            return [party.name, ...party.lines].filter(Boolean).join('\n');
          } catch {}
        }
        return trimmed;
      }
      if (typeof candidate === 'object') {
        if (candidate.details && typeof candidate.details === 'string') {
          return candidate.details.trim();
        }
        if (candidate.instruction && typeof candidate.instruction === 'string') {
          return candidate.instruction.trim();
        }
        const party = formatPartyBlock(candidate);
        return [party.name, ...party.lines].filter(Boolean).join('\n');
      }
      return '';
    },
    [initialData]
  );

  const notifyParty1 = useMemo(() => extractNotifyPartyText(1), [extractNotifyPartyText]);
  const notifyParty2 = useMemo(() => extractNotifyPartyText(2), [extractNotifyPartyText]);
  const notifyParty3 = useMemo(() => extractNotifyPartyText(3), [extractNotifyPartyText]);
  const notifyParty4 = useMemo(() => extractNotifyPartyText(4), [extractNotifyPartyText]);
  const notifyParty5 = useMemo(() => extractNotifyPartyText(5), [extractNotifyPartyText]);
  const notifyParty6 = useMemo(() => extractNotifyPartyText(6), [extractNotifyPartyText]);

  const hasExtraNotifyParties = Boolean(notifyParty4 || notifyParty5 || notifyParty6);

  // Pre-Carriage & Location details
  // User requirement: "Bill of Lading me PRE-CARRIAGE BY me fixed value aayegi 'BY SEA'"
  const preCarriageBy = 'BY SEA';

  // User requirement: "PLACE OF RECEIPT BY PRE-CARRIE me place_of_delivery"
  const placeOfDelivery = useMemo(() => {
    return resolvePlaceOfDelivery(initialData);
  }, [initialData]);

  const placeOfReceipt = useMemo(() => {
    return placeOfDelivery || safeString(initialData?.place_of_receipt || initialData?.receipt_place);
  }, [placeOfDelivery, initialData]);

  const countryOfOrigin = useMemo(() => {
    const blObj = initialData?.bill_of_lading || initialData?.lading || initialData?.billOfLading || {};
    return safeString(
      blObj?.country_of_origin ||
      initialData?.country_of_origin ||
      blObj?.origin_country ||
      initialData?.origin_country ||
      initialData?.origin ||
      initialData?.product_country,
      ''
    );
  }, [initialData]);

  // Dynamic Origin Country ID from `country_of_origin.id` for loading ports dropdown API
  const countryOfOriginId = useMemo(() => {
    return extractOriginCountryId(initialData);
  }, [initialData]);

  // Dynamic Loading Ports fetched from GET /dms-fields/loading-ports/:countryId (no auto-selection)
  const [internalLoadingPorts, setInternalLoadingPorts] = useState<FormOptionItem[]>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState<boolean>(false);
  const loadingPortsCacheRef = useRef<Record<string, FormOptionItem[]>>({});

  useEffect(() => {
    if (!isAnyLoadingPort || !countryOfOriginId) {
      setInternalLoadingPorts([]);
      setIsLoadingPorts(false);
      return;
    }

    const cacheKey = `${countryOfOriginId}_${lang}`;
    if (loadingPortsCacheRef.current[cacheKey]) {
      setInternalLoadingPorts(loadingPortsCacheRef.current[cacheKey]);
      setIsLoadingPorts(false);
      return;
    }

    let cancelled = false;
    setInternalLoadingPorts([]);
    setIsLoadingPorts(true);

    getSmartDocsLoadingPortsByCountryAction(countryOfOriginId, { lang })
      .then((res) => {
        if (cancelled) return;
        const ports = Array.isArray(res?.loadingPorts) ? res.loadingPorts : [];
        if (res?.success) {
          loadingPortsCacheRef.current[cacheKey] = ports;
        }
        setInternalLoadingPorts(ports);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[BillOfLadingDocumentForm] Error fetching loading ports by origin country:', err);
          setInternalLoadingPorts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPorts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAnyLoadingPort, countryOfOriginId, lang]);

  // Plain-text display label for Port of Loading when `any_loading_port` is false
  const portOfLoadingDisplayText = useMemo(() => {
    const label = extractBillOfLadingPortLabel(initialData);
    if (label) return label;
    if (portOfLoading && !isRawDbId(portOfLoading)) return portOfLoading;
    return '';
  }, [initialData, portOfLoading]);

  // Loading Ports dropdown list (matches Contract pattern; preserves saved BL label while loading)
  const loadingPortsList: FormOptionItem[] = useMemo(() => {
    const baseList = internalLoadingPorts;
    const fallbackLabel = extractBillOfLadingPortLabel(initialData);

    if (portOfLoading && fallbackLabel && !isRawDbId(fallbackLabel)) {
      const exists = baseList.some(
        (p) =>
          String(p.value).toLowerCase() === String(portOfLoading).toLowerCase() ||
          String(p.id || '').toLowerCase() === String(portOfLoading).toLowerCase() ||
          String(p._id || '').toLowerCase() === String(portOfLoading).toLowerCase() ||
          String(p.label).toLowerCase() === String(fallbackLabel).toLowerCase()
      );
      if (!exists) {
        return [
          {
            value: portOfLoading,
            id: portOfLoading,
            label: fallbackLabel,
          },
          ...baseList,
        ];
      }
    }

    return baseList;
  }, [internalLoadingPorts, initialData, portOfLoading]);

  // User requirement: "COUNTRY OF DESTINATION me destination_port ke andar country ke andar name hai vo ser karna hai"
  const countryOfDestination = useMemo(() => {
    return resolveCountryOfDestination(initialData);
  }, [initialData]);

  // User requirement: "PORT OF DESTINATION me desination port ka name with country"
  const portOfDestination = useMemo(() => {
    return resolvePortOfDestination(initialData, countryOfDestination);
  }, [initialData, countryOfDestination]);

  // User requirement: "FINAL DESTINATION me place_of_delivery aayega"
  const finalDestination = useMemo(() => {
    return placeOfDelivery || safeString(initialData?.final_destination || initialData?.place_of_delivery);
  }, [placeOfDelivery, initialData]);

  // Goods Description & Marks
  const marksAndNumbers = safeString(
    initialData?.marking ||
    initialData?.brand ||
    initialData?.marking_brand ||
    initialData?.marks_and_numbers ||
    initialData?.marks
  );

  const productName = safeString(
    initialData?.product_name ||
    initialData?.product ||
    initialData?.commodity ||
    initialData?.goods_description
  );

  const extraDescription = safeString(
    initialData?.description_of_goods ||
    initialData?.goods_description_text ||
    initialData?.specification ||
    initialData?.specifications ||
    initialData?.commodity_description ||
    (initialData?.product_name && initialData?.goods_description ? initialData.goods_description : '') ||
    ''
  );

  const packingType = safeString(initialData?.packing_type || initialData?.packing);
  const hsnCode = safeString(initialData?.hsn_code || initialData?.hsn);
  const initialGrossWeightDisplay = useMemo(() => {
    const blObj = initialData?.bill_of_lading || initialData?.lading || initialData?.billOfLading || {};
    return normalizeDisplayWeightMts(
      blObj?.gross_weight ?? initialData?.gross_weight ?? initialData?.gross_weight_mts
    );
  }, [initialData]);
  const initialNetWeightDisplay = useMemo(() => {
    const blObj = initialData?.bill_of_lading || initialData?.lading || initialData?.billOfLading || {};
    return normalizeDisplayWeightMts(
      blObj?.net_weight ?? initialData?.net_weight ?? initialData?.net_weight_mts
    );
  }, [initialData]);
  const freightCharges = safeString(initialData?.freight_charges || initialData?.freight || 'PREPAID');
  const freeDays = safeString(initialData?.free_days || initialData?.pod_free_days);
  const emptyBags = safeString(initialData?.empty_bags || initialData?.empty_bags_percentage);

  // Live Totals calculation for Container Table (uses integer milli-kg to avoid floating-point drift)
  const tableTotals = useMemo(() => {
    let totalBags = 0;
    let totalGrossMilliKg = 0;
    let totalNetMilliKg = 0;
    let hasContainerGross = false;
    let hasContainerNet = false;

    containers.forEach((c) => {
      const b = Number(String(c.bags || '').replace(/,/g, ''));
      if (!isNaN(b) && isFinite(b) && b > 0) totalBags += b;

      if (hasNonEmptyContainerValue(c.gross_weight)) {
        const gw = Number(String(c.gross_weight).replace(/,/g, '').trim());
        if (!isNaN(gw) && isFinite(gw) && gw >= 0) {
          totalGrossMilliKg += Math.round(gw * 1000);
          hasContainerGross = true;
        }
      }

      if (hasNonEmptyContainerValue(c.net_weight)) {
        const nw = Number(String(c.net_weight).replace(/,/g, '').trim());
        if (!isNaN(nw) && isFinite(nw) && nw >= 0) {
          totalNetMilliKg += Math.round(nw * 1000);
          hasContainerNet = true;
        }
      }
    });

    return {
      totalBags,
      totalGross: totalGrossMilliKg / 1000,
      totalNet: totalNetMilliKg / 1000,
      totalGrossMts: Math.round(totalGrossMilliKg / 1000) / 1000,
      totalNetMts: Math.round(totalNetMilliKg / 1000) / 1000,
      hasContainerGross,
      hasContainerNet,
    };
  }, [containers]);

  const displayTotalBags = useMemo(() => {
    if (tableTotals.totalBags > 0) return String(tableTotals.totalBags);
    return safeString(initialData?.total_bags || initialData?.bags || '0');
  }, [tableTotals.totalBags, initialData]);

  const displayGrossWeight = useMemo(() => {
    if (tableTotals.hasContainerGross) return formatWeightMtsForPayload(tableTotals.totalGrossMts);
    if (initialGrossWeightDisplay) return initialGrossWeightDisplay;
    return '0.000';
  }, [tableTotals.hasContainerGross, tableTotals.totalGrossMts, initialGrossWeightDisplay]);

  const displayNetWeight = useMemo(() => {
    if (tableTotals.hasContainerNet) return formatWeightMtsForPayload(tableTotals.totalNetMts);
    if (initialNetWeightDisplay) return initialNetWeightDisplay;
    return '0.000';
  }, [tableTotals.hasContainerNet, tableTotals.totalNetMts, initialNetWeightDisplay]);

  // Mark form as dirty when user edits
  const markDirty = useCallback(() => {
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  const isFormInitializedRef = useRef(false);
  const lastDataVersionRef = useRef<number | undefined>(dataVersion);
  const lastLoadedDocIdRef = useRef<string>(effectiveBLId || '');

  // Sync state if initialData or dataVersion updates externally
  useEffect(() => {
    if (!initialData || typeof initialData !== 'object' || Object.keys(initialData).length === 0) {
      if (effectiveBLId) {
        setDraftId(effectiveBLId);
      }
      return;
    }

    const isDataVersionTriggered = Boolean(
      dataVersion !== undefined && dataVersion !== lastDataVersionRef.current
    );
    const hasDocIdChanged = Boolean(effectiveBLId && effectiveBLId !== lastLoadedDocIdRef.current);

    if (isFormInitializedRef.current && !isDataVersionTriggered && !hasDocIdChanged && (isDirty || hasDraftChanges)) {
      return;
    }

    isFormInitializedRef.current = true;
    if (dataVersion !== undefined) {
      lastDataVersionRef.current = dataVersion;
    }
    if (effectiveBLId) {
      lastLoadedDocIdRef.current = effectiveBLId;
      setDraftId(effectiveBLId);
    }

    setCustomDocTitle(safeString(initialData.pdf_title || initialData.document_title, 'BILL OF LADING'));

    const val = initialData.is_watermark_enabled ?? initialData.watermark_enabled ?? initialData.watermark;
    if (val !== undefined && val !== null) {
      setWatermarkEnabled(typeof val === 'string' ? val !== 'false' && val !== '0' : Boolean(val));
    }

    setVesselName(safeString(initialData.vessel_name || initialData.vessel));
    setShippingLine(extractShippingLineValue(initialData));
    setVoyageNo(safeString(initialData.voyage_number || initialData.voyage_no || initialData.voyageNo || initialData.voyage));
    setBlNo(
      safeString(
        initialData.bl_number ||
        initialData.bl_no ||
        initialData.blNo ||
        initialData.bill_of_lading_no ||
        initialData.bill_of_lading_number
      )
    );

    const sDate = initialData.sailing_date || initialData.sailingDate || initialData.etd;
    if (sDate) {
      try {
        const dt = new Date(sDate);
        setSailingDate(!isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : String(sDate).split('T')[0]);
      } catch {
        setSailingDate(String(sDate));
      }
    } else {
      setSailingDate('');
    }

    const aDate = initialData.arrival_date || initialData.arrivalDate || initialData.eta;
    if (aDate) {
      try {
        const dt = new Date(aDate);
        setArrivalDate(!isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : String(aDate).split('T')[0]);
      } catch {
        setArrivalDate(String(aDate));
      }
    } else {
      setArrivalDate('');
    }

    setBookingNo(safeString(initialData.booking_number || initialData.booking_no || initialData.bookingNo));
    setTrackingLink(safeString(initialData.tracking_link || initialData.trackingLink || initialData.tracking_url));
    // Strictly from BL API; never auto-select
    setPortOfLoading(extractBillOfLadingPortValue(initialData));
    setSbNo(safeString(initialData.shipping_bill_no || initialData.sb_no || initialData.shipping_bill_number));
    setEctnNumber(
      safeString(
        initialData.ectn_number ||
        initialData.ectnNumber ||
        initialData.bill_of_lading?.ectn_number ||
        initialData.ectn_no
      )
    );
    setContainers(buildInitialContainers(initialData));
    setNotesTitle(safeString(initialData.comment_label || initialData.comment_title || initialData.notes_title || initialData.extra_title));
    setNotesComment(safeString(initialData.comment_value || initialData.comment_text || initialData.notes_comment || initialData.comment || initialData.extra_comment));
  }, [initialData, dataVersion, effectiveBLId, isDirty, hasDraftChanges]);

  // Container Table Row handler
  const handleContainerChange = (index: number, field: keyof ContainerItem, val: string) => {
    markDirty();
    setContainers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
    setErrors((prev) => {
      const cellKey = `containers.${index}.${String(field)}`;
      if (!prev[cellKey] && !prev.containers) return prev;
      return {
        ...prev,
        [cellKey]: '',
        containers: '',
      };
    });
  };

  // Collect only container rows that actually have at least one detail filled in
  const getFilledContainerRows = useCallback(() => {
    return containers
      .map((c, idx) => ({ c, idx }))
      .filter(
        ({ c }) =>
          hasNonEmptyContainerValue(c.container_no) ||
          hasNonEmptyContainerValue(c.seal_no) ||
          hasNonEmptyContainerValue(c.bags) ||
          hasNonEmptyContainerValue(c.gross_weight) ||
          hasNonEmptyContainerValue(c.net_weight)
      );
  }, [containers]);

  // Build Payload
  const getBillOfLadingPayload = useCallback(() => {
    const filledRows = getFilledContainerRows();
    const payloadContainers = filledRows.map(({ c, idx }) => {
      const item: Record<string, any> = {
        index: parseContainerIndex(c.index, idx),
      };

      const trimmedContainerNo = String(c.container_no ?? '').trim();
      if (trimmedContainerNo) {
        item.container_number = trimmedContainerNo;
      }

      const trimmedSealNo = String(c.seal_no ?? '').trim();
      if (trimmedSealNo) {
        item.seal_number = trimmedSealNo;
      }

      const formattedGrossWeight = formatContainerWeightForPayload(c.gross_weight);
      if (formattedGrossWeight !== undefined) {
        item.gross_weight = formattedGrossWeight;
      }

      const formattedNetWeight = formatContainerWeightForPayload(c.net_weight);
      if (formattedNetWeight !== undefined) {
        item.net_weight = formattedNetWeight;
      }

      if (hasNonEmptyContainerValue(c.bags)) {
        const n = Number(String(c.bags).replace(/,/g, '').trim());
        if (!isNaN(n)) item.bags = n;
      }

      return item;
    });

    const selectedLoadingPortObj = loadingPortsList.find(
      (p) =>
        String(p.value) === String(portOfLoading) ||
        String(p.id || '') === String(portOfLoading) ||
        String(p.label).toLowerCase() === String(portOfLoading).toLowerCase() ||
        String(p.name || '').toLowerCase() === String(portOfLoading).toLowerCase()
    );
    const selectedLoadingPortId =
      selectedLoadingPortObj?.id ||
      selectedLoadingPortObj?.value ||
      (isValidCuidOrId(portOfLoading) ? portOfLoading.trim() : '') ||
      extractBillOfLadingPortValue(initialData);

    // Always derive top-level gross_weight & net_weight (in MTS) directly from the containers
    // being submitted (in KG / 1000) so top-level weights strictly match container totals.
    const topLevelGrossWeight = formatWeightMtsForPayload(tableTotals.totalGrossMts);
    const topLevelNetWeight = formatWeightMtsForPayload(tableTotals.totalNetMts);

    return {
      bill_of_lading_id: draftId || effectiveBLId || undefined,
      id: draftId || effectiveBLId || undefined,
      shipment_instruction_id: shipmentInstructionId || undefined,
      custom_invoice_id: customInvoiceId || undefined,
      proforma_id: proformaId || undefined,
      contract_id: contractId || undefined,
      confirmation_id: confirmationId || undefined,
      pdf_title: customDocTitle.trim() || 'BILL OF LADING',
      is_watermark_enabled: watermarkEnabled,
      vessel_name: vesselName.trim(),
      shipping_line: shippingLine.trim(),
      voyage_number: voyageNo.trim(),
      bl_number: blNo.trim(),
      sailing_date: sailingDate || undefined,
      arrival_date: arrivalDate || undefined,
      transit_days: transitDaysNumber !== null ? transitDaysNumber : undefined,
      booking_number: bookingNo.trim(),
      tracking_link: trackingLink.trim(),
      loading_port: selectedLoadingPortId || undefined,
      loading_port_id: selectedLoadingPortId || undefined,
      shipping_bill_no: sbNo.trim(),
      gross_weight: topLevelGrossWeight,
      net_weight: topLevelNetWeight,
      ...(isEctnEnabled ? { ectn_number: ectnNumber.trim() } : {}),
      ...(payloadContainers.length > 0 ? { containers: payloadContainers } : {}),
      comment_label: notesTitle.trim() || (notesComment.trim() ? 'Comments' : ''),
      comment_value: notesComment.trim(),
    };
  }, [
    getFilledContainerRows,
    tableTotals,
    draftId,
    effectiveBLId,
    shipmentInstructionId,
    customInvoiceId,
    proformaId,
    contractId,
    confirmationId,
    customDocTitle,
    watermarkEnabled,
    vesselName,
    shippingLine,
    voyageNo,
    blNo,
    sailingDate,
    arrivalDate,
    transitDaysNumber,
    bookingNo,
    trackingLink,
    portOfLoading,
    loadingPortsList,
    initialData,
    sbNo,
    isEctnEnabled,
    ectnNumber,
    notesTitle,
    notesComment,
  ]);

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({});
    setUnmatchedErrors([]);

    const payloadRowIndices = getFilledContainerRows().map(({ idx }) => idx);

    try {
      const payload = getBillOfLadingPayload();
      let res: any;
      if (onSaveDraft) {
        res = await onSaveDraft(payload);
      } else {
        res = await saveBillOfLadingDraftAction(payload, lang, draftId || effectiveBLId || undefined);
      }

      if (res?.success) {
        const newId = res.id || res.data?.id || res.data?.bill_of_lading_id || res.data?.bl_id;
        if (newId) {
          const cleanNewId = String(newId);
          setDraftId(cleanNewId);
          isDraftSavedToBackendRef.current = true;
          if (onSaveSuccess) onSaveSuccess(cleanNewId, res.data);
          if (onUpdateSteps && steps && steps.length > 0) {
            onUpdateSteps(
              steps.map((s) =>
                isBillOfLadingStep(s)
                  ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                  : s
              )
            );
          }
        }
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(true);
        toast.success(res?.message || 'Bill of Lading draft saved successfully!');
      } else {
        const { fieldErrors, unmatchedErrors: unmapped, generalError } = parseBillOfLadingBackendErrors(
          res,
          payloadRowIndices
        );
        const hasMappedFieldErrors = Object.keys(fieldErrors).length > 0;
        if (unmapped.length > 0) {
          console.warn('[BillOfLadingDocumentForm] Unmatched backend validation fields:', unmapped, res);
          setUnmatchedErrors(unmapped);
        }
        if (hasMappedFieldErrors) {
          setErrors(fieldErrors);
          scrollToAndFocusBillOfLadingField(fieldErrors);
          const firstFieldErr = Object.values(fieldErrors)[0];
          toast.error(firstFieldErr || 'Please check highlighted fields.');
          return;
        }
        if (unmapped.length > 0) {
          const firstUnmapped = unmapped[0];
          toast.error(`${firstUnmapped.field}: ${firstUnmapped.message}`);
          return;
        }
        toast.error(generalError || res?.message || 'Failed to save bill of lading draft.');
      }
    } catch (err: any) {
      const { fieldErrors, unmatchedErrors: unmapped, generalError } = parseBillOfLadingBackendErrors(
        err,
        payloadRowIndices
      );
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusBillOfLadingField(fieldErrors);
        toast.error(Object.values(fieldErrors)[0] || 'Please check highlighted fields.');
        return;
      }
      if (unmapped.length > 0) {
        setUnmatchedErrors(unmapped);
        toast.error(`${unmapped[0].field}: ${unmapped[0].message}`);
        return;
      }
      toast.error(generalError || err?.message || 'Error occurred while saving bill of lading draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft || readOnly) return;

    const submitTargetInfo = getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'bill_of_lading',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;

    setIsSubmitting(true);
    setErrors({});
    setUnmatchedErrors([]);

    const payloadRowIndices = getFilledContainerRows().map(({ idx }) => idx);

    try {
      const payload = getBillOfLadingPayload();
      let res: any;
      if (onSubmitLading) {
        res = await onSubmitLading(payload, draftId || effectiveBLId || undefined, targetNextStep);
      } else {
        res = await submitBillOfLadingAction(payload, lang, draftId || effectiveBLId || undefined);
      }

      if (res?.success) {
        const newId = res.id || res.data?.id || res.data?.bill_of_lading_id || res.data?.bl_id;
        if (newId) {
          const cleanNewId = String(newId);
          setDraftId(cleanNewId);
          isDraftSavedToBackendRef.current = true;
          if (onSaveSuccess) onSaveSuccess(cleanNewId, res.data);
          if (onUpdateSteps && steps && steps.length > 0) {
            onUpdateSteps(
              steps.map((s) =>
                isBillOfLadingStep(s)
                  ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: 'completed' }
                  : s
              )
            );
          }
        }
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(false);
        toast.success(res?.message || 'Bill of Lading submitted successfully!');

        // Transition to next workflow step if available
        if (targetNextStep && onSelectStep) {
          const targetIdx = (steps || []).findIndex((s) => isSameWorkflowStep(s, targetNextStep));
          if (targetIdx >= 0) {
            onSelectStep(targetNextStep, targetIdx);
          }
        }
      } else {
        const { fieldErrors, unmatchedErrors: unmapped, generalError } = parseBillOfLadingBackendErrors(
          res,
          payloadRowIndices
        );
        const hasMappedFieldErrors = Object.keys(fieldErrors).length > 0;
        if (unmapped.length > 0) {
          console.warn('[BillOfLadingDocumentForm] Unmatched backend validation fields:', unmapped, res);
          setUnmatchedErrors(unmapped);
        }
        if (hasMappedFieldErrors) {
          setErrors(fieldErrors);
          scrollToAndFocusBillOfLadingField(fieldErrors);
          const firstFieldErr = Object.values(fieldErrors)[0];
          toast.error(firstFieldErr || 'Please check highlighted fields.');
          return;
        }
        if (unmapped.length > 0) {
          const firstUnmapped = unmapped[0];
          toast.error(`${firstUnmapped.field}: ${firstUnmapped.message}`);
          return;
        }
        toast.error(generalError || res?.message || 'Failed to submit bill of lading.');
      }
    } catch (err: any) {
      const { fieldErrors, unmatchedErrors: unmapped, generalError } = parseBillOfLadingBackendErrors(
        err,
        payloadRowIndices
      );
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusBillOfLadingField(fieldErrors);
        toast.error(Object.values(fieldErrors)[0] || 'Please check highlighted fields.');
        return;
      }
      if (unmapped.length > 0) {
        setUnmatchedErrors(unmapped);
        toast.error(`${unmapped[0].field}: ${unmapped[0].message}`);
        return;
      }
      toast.error(generalError || err?.message || 'Error occurred while submitting bill of lading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Preview Handler
  const handleOpenPrintPreview = async () => {
    let activeId = draftId || effectiveBLId;
    if (!activeId || isDirty || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const payload = getBillOfLadingPayload();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(payload);
        } else {
          res = await saveBillOfLadingDraftAction(payload, lang, activeId || undefined);
        }
        if (res?.success) {
          const newId = res.id || res.data?.id || res.data?.bill_of_lading_id || res.data?.bl_id;
          if (newId) {
            const cleanNewId = String(newId);
            setDraftId(cleanNewId);
            activeId = cleanNewId;
            isDraftSavedToBackendRef.current = true;
            setIsDirty(false);
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            if (onSaveSuccess) onSaveSuccess(cleanNewId, res.data);
          }
        }
      } catch (saveErr) {
        console.warn('[BillOfLadingDocumentForm] Auto-save before preview failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!activeId) {
      toast.error('Please save document first to preview.');
      return;
    }
    setIsPrintPreviewOpen(true);
  };

  // Download PDF Handler
  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    let activeId = draftId || effectiveBLId;
    if (!activeId || isDirty || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const payload = getBillOfLadingPayload();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(payload);
        } else {
          res = await saveBillOfLadingDraftAction(payload, lang, activeId || undefined);
        }
        if (res?.success) {
          const newId = res.id || res.data?.id || res.data?.bill_of_lading_id || res.data?.bl_id;
          if (newId) {
            const cleanNewId = String(newId);
            setDraftId(cleanNewId);
            activeId = cleanNewId;
            isDraftSavedToBackendRef.current = true;
            setIsDirty(false);
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            if (onSaveSuccess) onSaveSuccess(cleanNewId, res.data);
          }
        }
      } catch (saveErr) {
        console.warn('[BillOfLadingDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!activeId) {
      toast.error('Please save document first to download PDF.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const res = await downloadDocPdfAction({
        prefix: 'bill_of_lading',
        id: activeId,
        candidateIds: [activeId, shipmentInstructionId, customInvoiceId, proformaId, contractId, confirmationId].filter(Boolean) as string[],
        lang,
      });

      if (res.success) {
        downloadPdfFromActionResponse(res, `bill-of-lading-${blNo || activeId}.pdf`);
        toast.success('Bill of Lading PDF downloaded successfully!');
      } else {
        toast.error(res.message || res.error || 'Failed to download PDF.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred while downloading PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'bill_of_lading',
      isSubmitting,
      submittingText: dict?.smart_docs?.submitting || 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  const docStatus = useMemo(() => {
    return String(selectedStep?.status || selectedStep?.document_status || initialData?.status || '').toUpperCase();
  }, [selectedStep, initialData]);

  return (
    <div
      id="bill-of-lading-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative border border-border shadow-xs"
    >
      {/* Scrollable Viewport */}
      <div className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar">
        {/* ========================================================
            TOP HEADER BAR:
            - Left: Balanced Spacer
            - Center: Title "BILL OF LADING" with pencil & dotted underline
            - Right: Watermark Toggle
           ======================================================== */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 bg-card">
          {/* Left: Balanced spacer */}
          <div className="hidden sm:block shrink-0 sm:w-[140px]" />

          {/* Center: Title "BILL OF LADING" with pencil & dotted underline */}
          <DocTitleInput
            value={customDocTitle}
            onChange={(val) => {
              markDirty();
              setCustomDocTitle(val);
              setErrors((prev) => ({ ...prev, documentTitle: '', pdf_title: '', document_title: '', title: '' }));
            }}
            disabled={readOnly}
            placeholder="BILL OF LADING"
            ariaLabel="Document Title"
            uppercase={false}
            error={errors.documentTitle || errors.pdf_title || errors.document_title || errors.title}
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Right: Watermark Toggle */}
          <div className="flex flex-col items-end justify-center shrink-0 sm:w-[140px]" id="field-is_watermark_enabled" data-field="is_watermark_enabled">
            <DocToggle
              label="Watermark"
              checked={watermarkEnabled}
              onChange={(val) => {
                markDirty();
                setWatermarkEnabled(val);
                setErrors((prev) => ({ ...prev, is_watermark_enabled: '' }));
              }}
              disabled={readOnly}
            />
            {errors.is_watermark_enabled && (
              <span className="text-[11px] text-brand-red font-semibold mt-1 text-right">
                {errors.is_watermark_enabled}
              </span>
            )}
          </div>
        </div>

        {unmatchedErrors.length > 0 && (
          <div
            role="alert"
            className="mx-3 sm:mx-4 mt-2.5 px-3 py-2 rounded-md border border-brand-red/40 bg-brand-red/10 text-brand-red text-xs font-medium flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-xs shrink-0" />
                Validation Error
              </span>
              <button
                type="button"
                onClick={() => setUnmatchedErrors([])}
                className="text-brand-red/80 hover:text-brand-red text-xs cursor-pointer"
                aria-label="Dismiss validation error"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            {unmatchedErrors.map((errItem, i) => (
              <div key={`${errItem.field}-${i}`} className="leading-snug">
                <span className="font-semibold">{errItem.field}:</span> {errItem.message}
              </div>
            ))}
          </div>
        )}

        {/* ========================================================
            SECTION 1: PARTIES & VOYAGE DETAILS (GRID LAYOUT)
            Left (Exporter / Seller & Consignee / Buyer) / Right (Vessel, Voyage, BL, Dates)
            Exact match with Custom Invoice Canva specifications:
            Clean, unbolded values with standard font weight and proper look
           ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border border-b border-border bg-card">
          {/* LEFT 5 COLUMNS: EXPORTER / SELLER & CONSIGNEE / BUYER STACKED */}
          <div className="md:col-span-5 flex flex-col divide-y divide-border">
            {/* EXPORTER / SELLER (DISPLAY ONLY) - Matches Custom Invoice clean style */}
            <div className="p-3 sm:p-4 flex flex-col gap-1.5 justify-start bg-card flex-1 min-h-[140px]">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                EXPORTER / SELLER:
              </div>
              <div className="text-[13px] sm:text-[14px] font-medium text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed">
                {exporterText || '-'}
              </div>
            </div>

            {/* CONSIGNEE / BUYER (DISPLAY ONLY) - Matches Custom Invoice clean style */}
            <div className="p-3 sm:p-4 flex flex-col gap-1.5 justify-start bg-card flex-1 min-h-[140px]">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                CONSIGNEE / BUYER:
              </div>
              <div className="text-[13px] sm:text-[14px] font-medium text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed">
                {consigneeText || '-'}
              </div>
            </div>
          </div>

          {/* RIGHT 7 COLUMNS: VOYAGE & BOOKING DETAILS */}
          <div className="md:col-span-7 flex flex-col divide-y divide-border bg-card">
            {/* Top Sub-row: VESSEL NAME & SHIPPING LINE / VOYAGE NO & BL NO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {/* Left Column: VESSEL NAME & VOYAGE NO */}
              <div className="flex flex-col divide-y divide-border">
                {/* VESSEL NAME */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-vessel_name" data-field="vessel_name">
                  <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                    VESSEL NAME
                  </div>
                  <DocUnderlineInput
                    value={vesselName}
                    onChange={(val) => {
                      markDirty();
                      setVesselName(val);
                      setErrors((prev) => ({ ...prev, vessel_name: '' }));
                    }}
                    disabled={readOnly}
                    placeholder="Enter Vessel Name"
                    icon="fa-solid fa-pen"
                    uppercase={false}
                    error={errors.vessel_name}
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
                  />
                </div>

                {/* VOYAGE NO */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-voyage_no" data-field="voyage_no">
                  <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                    VOYAGE NO
                  </div>
                  <DocUnderlineInput
                    value={voyageNo}
                    onChange={(val) => {
                      markDirty();
                      setVoyageNo(val);
                      setErrors((prev) => ({ ...prev, voyage_no: '' }));
                    }}
                    disabled={readOnly}
                    placeholder="Enter Voyage No"
                    icon="fa-solid fa-pen"
                    uppercase={false}
                    error={errors.voyage_no}
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
                  />
                </div>
              </div>

              {/* Right Column: SHIPPING LINE & BL NO */}
              <div className="flex flex-col divide-y divide-border">
                {/* SHIPPING LINE */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-shipping_line" data-field="shipping_line">
                  <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                    SHIPPING LINE
                  </div>
                  <DocUnderlineInput
                    value={shippingLine}
                    onChange={(val) => {
                      markDirty();
                      setShippingLine(val);
                      setErrors((prev) => ({
                        ...prev,
                        shipping_line: '',
                        shipping_company: '',
                        shipping_company_name: '',
                        shipping_line_name: '',
                        carrier: '',
                        carrier_name: '',
                        liner: '',
                        shippingLine: '',
                      }));
                    }}
                    disabled={readOnly}
                    placeholder="Enter Shipping Line"
                    icon="fa-solid fa-pen"
                    uppercase={false}
                    error={
                      errors.shipping_line ||
                      errors.shipping_company ||
                      errors.shipping_company_name ||
                      errors.shipping_line_name ||
                      errors.carrier ||
                      errors.carrier_name ||
                      errors.liner ||
                      errors.shippingLine
                    }
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
                  />
                </div>

                {/* BL NO */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-bl_no" data-field="bl_no">
                  <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                    BL NO
                  </div>
                  <DocUnderlineInput
                    value={blNo}
                    onChange={(val) => {
                      markDirty();
                      setBlNo(val);
                      setErrors((prev) => ({ ...prev, bl_no: '', bill_of_lading_no: '' }));
                    }}
                    disabled={readOnly}
                    placeholder="Enter BL No"
                    icon="fa-solid fa-pen"
                    uppercase={false}
                    error={errors.bl_no || errors.bill_of_lading_no}
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Middle Sub-row: SAILING DATE | ARRIVAL DATE | TRANSIT DAYS */}
            <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {/* SAILING DATE */}
              <div className="sm:col-span-4 p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-sailing_date" data-field="sailing_date">
                <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                  SAILING DATE
                </div>
                <DocUnderlineInput
                  type="date"
                  value={sailingDate}
                  onChange={(val) => {
                    markDirty();
                    setSailingDate(val);
                    setErrors((prev) => ({ ...prev, sailing_date: '' }));
                  }}
                  disabled={readOnly}
                  placeholder=""
                  icon="fa-regular fa-calendar"
                  uppercase={false}
                  error={errors.sailing_date}
                  inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
                />
              </div>

              {/* ARRIVAL DATE */}
              <div className="sm:col-span-4 p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-arrival_date" data-field="arrival_date">
                <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                  ARRIVAL DATE
                </div>
                <DocUnderlineInput
                  type="date"
                  value={arrivalDate}
                  onChange={(val) => {
                    markDirty();
                    setArrivalDate(val);
                    setErrors((prev) => ({ ...prev, arrival_date: '' }));
                  }}
                  disabled={readOnly}
                  placeholder=""
                  icon="fa-regular fa-calendar"
                  uppercase={false}
                  error={errors.arrival_date}
                  inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
                />
              </div>

              {/* TRANSIT DAYS (AUTO-CALCULATED DISPLAY ONLY) */}
              <div className="sm:col-span-4 p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px] bg-card">
                <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                  TRANSIT DAYS:
                </div>
                <div className="text-[13px] sm:text-[14px] font-medium text-foreground px-0.5 uppercase tracking-wide">
                  {transitDays}
                </div>
              </div>
            </div>

            {/* Sub-row: BOOKING NO */}
            <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-booking_no" data-field="booking_no">
              <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                BOOKING NO
              </div>
              <DocUnderlineInput
                value={bookingNo}
                onChange={(val) => {
                  markDirty();
                  setBookingNo(val);
                  setErrors((prev) => ({ ...prev, booking_no: '' }));
                }}
                disabled={readOnly}
                placeholder="Enter Booking No"
                icon="fa-solid fa-pen"
                uppercase={false}
                error={errors.booking_no}
                inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
              />
            </div>

            {/* Bottom Sub-row: TRACKING LINK */}
            <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]" id="field-tracking_link" data-field="tracking_link">
              <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                TRACKING LINK
              </div>
              <DocUnderlineInput
                value={trackingLink}
                onChange={(val) => {
                  markDirty();
                  setTrackingLink(val);
                  setErrors((prev) => ({ ...prev, tracking_link: '' }));
                }}
                disabled={readOnly}
                placeholder="Enter Tracking Link"
                icon="fa-solid fa-pen"
                uppercase={false}
                error={errors.tracking_link}
                inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 2: NOTIFY PARTIES (1 OR 2 ROWS OF 3 COLUMNS EACH)
            - 1st row: Notify Party 1, 2, 3
            - 2nd row: Notify Party 4, 5, 6 (Shown when 4th to 6th party exists)
            Exact match with Custom Invoice Canva specifications:
            Headers: bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: bg-card text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase text-center
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          {/* First Row: 1 to 3 Headers (bg-muted/20) */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              NOTIFY PARTY 1
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              NOTIFY PARTY 2
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              NOTIFY PARTY 3
            </div>
          </div>

          {/* First Row: 1 to 3 Values (bg-card) */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
            <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                {notifyParty1 || '-'}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                {notifyParty2 || '-'}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                {notifyParty3 || '-'}
              </span>
            </div>
          </div>

          {/* Second Row: 4 to 6 (Shown if 4th, 5th, or 6th notify party exists) */}
          {hasExtraNotifyParties && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  NOTIFY PARTY 4
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  NOTIFY PARTY 5
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  NOTIFY PARTY 6
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
                <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
                  <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                    {notifyParty4 || '-'}
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
                  <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                    {notifyParty5 || '-'}
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
                  <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                    {notifyParty6 || '-'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
        {/* ========================================================
            SECTION 3: PRE-CARRIAGE & ORIGIN / DESTINATION
            Row A: 4 Columns (PRE-CARRIAGE BY, RECEIPT, ORIGIN, DESTINATION)
            Headers: bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: bg-card text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          {/* Row A Headers (bg-muted/20) */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border bg-muted/20">
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              PRE-CARRIAGE BY
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              PLACE OF RECEIPT BY PRE-CARRIER
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              COUNTRY OF ORIGIN
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              COUNTRY OF DESTINATION
            </div>
          </div>

          {/* Row A Values (bg-card) */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border bg-card">
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {preCarriageBy || '-'}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {placeOfReceipt || '-'}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {countryOfOrigin || '-'}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {countryOfDestination || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 3B: PORTS (PORT OF LOADING, PORT OF DESTINATION, FINAL DESTINATION)
            Headers: bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Values: bg-card text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          {/* Row B Headers (bg-muted/20) */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              PORT OF LOADING
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              PORT OF DESTINATION
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
              FINAL DESTINATION
            </div>
          </div>

          {/* Row B Values (bg-card) */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
            {/* PORT OF LOADING: Dropdown ONLY when `any_loading_port` is true; otherwise normal text value */}
            {isAnyLoadingPort ? (
              <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[44px]" id="field-port_of_loading" data-field="port_of_loading">
                <DocUnderlineSelect
                  id="field-loadingPort"
                  options={loadingPortsList}
                  value={portOfLoading}
                  onChange={(val) => {
                    markDirty();
                    setPortOfLoading(val);
                    setErrors((prev) => ({
                      ...prev,
                      port_of_loading: '',
                      loading_port_id: '',
                      loading_port: '',
                      port_of_loading_id: '',
                      loadingPort: '',
                    }));
                  }}
                  disabled={readOnly || (!countryOfOriginId && loadingPortsList.length === 0)}
                  loading={isLoadingPorts && loadingPortsList.length === 0}
                  searchable={true}
                  align="center"
                  placeholder={
                    isLoadingPorts && loadingPortsList.length === 0
                      ? dict?.common?.loading || 'LOADING...'
                      : 'SELECT PORT OF LOADING'
                  }
                  error={
                    errors.port_of_loading ||
                    errors.loading_port_id ||
                    errors.loading_port ||
                    errors.port_of_loading_id ||
                    errors.loadingPort
                  }
                />
              </div>
            ) : (
              <div
                className="p-2.5 sm:p-3 text-center min-h-[44px] flex flex-col items-center justify-center"
                id="field-port_of_loading"
                data-field="port_of_loading"
              >
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                  {portOfLoadingDisplayText || '-'}
                </span>
                {(errors.port_of_loading ||
                  errors.loading_port_id ||
                  errors.loading_port ||
                  errors.port_of_loading_id ||
                  errors.loadingPort) && (
                  <span className="text-[11px] text-brand-red font-semibold mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0" />
                    <span>
                      {errors.port_of_loading ||
                        errors.loading_port_id ||
                        errors.loading_port ||
                        errors.port_of_loading_id ||
                        errors.loadingPort}
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* PORT OF DESTINATION */}
            <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {portOfDestination || '-'}
              </span>
            </div>

            {/* FINAL DESTINATION */}
            <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {finalDestination || '-'}
              </span>
            </div>
          </div>
        </div>
        {/* ========================================================
            SECTION 4: GOODS & DESCRIPTION
            Headers: bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
            Left (Marks & Numbers) | Middle (Description of Goods) | Right (Gross Weight)
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          {/* Dedicated Table Header Row matching ShipmentInstruction and CustomInvoice */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border bg-muted/20">
            {/* Column 1 Header */}
            <div className="lg:col-span-3 p-2 sm:p-2.5 flex items-center justify-start">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5 leading-snug">
                MARKS &amp; NUMBERS
              </div>
            </div>

            {/* Column 2 Header */}
            <div className="lg:col-span-6 p-2 sm:p-2.5 flex items-center justify-start">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                NUMBER AND KIND OF PACKAGES DESCRIPTION OF GOODS
              </div>
            </div>

            {/* Column 3 Header */}
            <div className="lg:col-span-3 p-2 sm:p-2.5 flex items-center justify-end text-right">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider text-right px-0.5">
                GROSS WEIGHT
              </div>
            </div>
          </div>

          {/* Table Body Row (bg-card) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border bg-card">
            {/* MARKS & NUMBERS (COL 1-3) */}
            <div className="lg:col-span-3 p-3 sm:p-4 flex flex-col gap-2">
              <div className="text-[13px] sm:text-[14px] font-medium text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed">
                {marksAndNumbers ? (
                  marksAndNumbers.toUpperCase().startsWith('MARKING:') ? (
                    <>
                      <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">MARKING: </span>
                      <span>{marksAndNumbers.replace(/^MARKING:\s*/i, '')}</span>
                    </>
                  ) : (
                    marksAndNumbers
                  )
                ) : (
                  '-'
                )}
              </div>
            </div>

            {/* NUMBER AND KIND OF PACKAGES DESCRIPTION OF GOODS (COL 4-9) */}
            <div className="lg:col-span-6 p-3 sm:p-4 flex flex-col gap-2">
              <div className="flex flex-col gap-1.5 text-[13px] sm:text-[14px] text-foreground tracking-wide px-0.5 leading-relaxed">
                {displayTotalBags && displayTotalBags !== '0' ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">TOTAL BAGS: </span>
                    <span className="font-medium text-foreground uppercase">{formatNumberWithCommas(displayTotalBags)} BAGS</span>
                  </div>
                ) : null}
                {productName ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">PRODUCT NAME: </span>
                    <span className="font-medium text-foreground uppercase">{productName}</span>
                  </div>
                ) : null}
                {packingType ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">PACKING TYPE: </span>
                    <span className="font-medium text-foreground uppercase">{packingType}</span>
                  </div>
                ) : null}
                {hsnCode ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">HSN CODE: </span>
                    <span className="font-medium text-foreground uppercase">{hsnCode}</span>
                  </div>
                ) : null}
                {displayGrossWeight ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">GROSS WEIGHT: </span>
                    <span className="font-medium text-foreground uppercase">{displayGrossWeight} MTS</span>
                  </div>
                ) : null}
                {displayNetWeight ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">NET WEIGHT: </span>
                    <span className="font-medium text-foreground uppercase">{displayNetWeight} MTS</span>
                  </div>
                ) : null}

                {/* SB.NO (EDITABLE WITH PENCIL) - FULL WIDTH */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-border/70 w-full" id="field-sb_no" data-field="sb_no">
                  <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider shrink-0">
                    SB.NO:
                  </span>
                  <div className="w-full flex-1 min-w-0">
                    <DocUnderlineInput
                      value={sbNo}
                      onChange={(val) => {
                        markDirty();
                        setSbNo(val);
                        setErrors((prev) => ({ ...prev, sb_no: '', shipping_bill_no: '' }));
                      }}
                      disabled={readOnly}
                      placeholder="Enter Shipping Bill No"
                      icon="fa-solid fa-pen"
                      uppercase={false}
                      error={errors.sb_no || errors.shipping_bill_no}
                      inputClassName="text-[13px] sm:text-[14px] font-medium text-foreground w-full"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* ECTN NO (Shown directly below SB.NO ONLY when ectn_field is true) */}
                {isEctnEnabled && (
                  <div className="flex items-center gap-2 mt-1 w-full" id="field-ectn_number" data-field="ectn_number">
                    <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider shrink-0">
                      ECTN NO:
                    </span>
                    <div className="w-full flex-1 min-w-0">
                      <DocUnderlineInput
                        value={ectnNumber}
                        onChange={(val) => {
                          markDirty();
                          setEctnNumber(val);
                          setErrors((prev) => ({ ...prev, ectn_number: '' }));
                        }}
                        disabled={readOnly}
                        placeholder="Enter ECTN No"
                        icon="fa-solid fa-pen"
                        uppercase={false}
                        error={errors.ectn_number}
                        inputClassName="text-[13px] sm:text-[14px] font-medium text-foreground w-full"
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {freightCharges ? (
                  <div className="mt-1">
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">FREIGHT CHARGES: </span>
                    <span className="font-medium text-foreground uppercase">{freightCharges}</span>
                  </div>
                ) : null}
                {freeDays ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">FREE DAYS: </span>
                    <span className="font-medium text-foreground uppercase">{freeDays}</span>
                  </div>
                ) : null}
                {emptyBags ? (
                  <div>
                    <span className="font-bold text-muted-foreground/85 uppercase tracking-wider">EMPTY BAGS: </span>
                    <span className="font-medium text-foreground uppercase">{emptyBags}</span>
                  </div>
                ) : null}

                {extraDescription && extraDescription !== productName ? (
                  <div className="whitespace-pre-line text-foreground uppercase font-medium leading-relaxed mt-1">
                    {extraDescription}
                  </div>
                ) : null}
              </div>
            </div>

            {/* GROSS WEIGHT (COL 10-12) */}
            <div className="lg:col-span-3 p-3 sm:p-4 flex flex-col gap-2 items-end justify-start text-right">
              <div className="text-[13px] sm:text-[14px] font-medium text-foreground uppercase tracking-wide px-0.5">
                {displayGrossWeight ? `${displayGrossWeight} MTS` : '-'}
              </div>
            </div>
          </div>
        </div>
        {/* ========================================================
            SECTION 5: CONTAINER DETAILS TABLE
            Dynamic rows matching FCL count ("jine fcls honge utne aayenge")
            All fields optional ("sabhi cheese optional hai")
           ======================================================== */}
        <div
          id="field-containers"
          data-field="containers"
          className={`w-full overflow-x-auto border-b border-border bg-card ${
            errors.containers ? 'ring-1 ring-inset ring-brand-red/60' : ''
          }`}
        >
          {errors.containers && (
            <div className="px-3 py-1.5 bg-brand-red/10 border-b border-brand-red/30 text-[11px] text-brand-red font-semibold flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
              <span>{errors.containers}</span>
            </div>
          )}
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-muted/20 text-muted-foreground/85 uppercase text-[14px] font-bold tracking-wider border-b border-border divide-x divide-border">
                <th className="py-2.5 px-3 w-12 sm:w-16 text-center">Sr</th>
                <th className="py-2.5 px-3">CONTAINER NO</th>
                <th className="py-2.5 px-3">SEAL NO</th>
                <th className="py-2.5 px-3">BAGS</th>
                <th className="py-2.5 px-3">GROSS Wt (KG)</th>
                <th className="py-2.5 px-3">NET Wt (KG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {containers.map((c, idx) => (
                <tr key={c.id || `row-${idx}`} className="hover:bg-muted/15 transition-colors divide-x divide-border">
                  {/* Sr */}
                  <td className="py-2 px-3 text-center text-xs font-bold text-muted-foreground/90">
                    {idx + 1}
                  </td>

                  {/* Container No */}
                  <td className="py-1.5 px-3" id={`field-containers-${idx}-container_no`} data-field={`containers.${idx}.container_no`}>
                    <DocUnderlineInput
                      value={c.container_no}
                      onChange={(v) => handleContainerChange(idx, 'container_no', v)}
                      placeholder="Container No"
                      disabled={readOnly}
                      uppercase={false}
                      error={errors[`containers.${idx}.container_no`]}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Seal No */}
                  <td className="py-1.5 px-3" id={`field-containers-${idx}-seal_no`} data-field={`containers.${idx}.seal_no`}>
                    <DocUnderlineInput
                      value={c.seal_no}
                      onChange={(v) => handleContainerChange(idx, 'seal_no', v)}
                      placeholder="Seal No"
                      disabled={readOnly}
                      uppercase={false}
                      error={errors[`containers.${idx}.seal_no`]}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Bags */}
                  <td className="py-1.5 px-3" id={`field-containers-${idx}-bags`} data-field={`containers.${idx}.bags`}>
                    <DocUnderlineInput
                      type="number"
                      value={c.bags}
                      onChange={(v) => handleContainerChange(idx, 'bags', v)}
                      placeholder="Bags"
                      disabled={readOnly}
                      uppercase={false}
                      error={errors[`containers.${idx}.bags`]}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Gross Weight */}
                  <td className="py-1.5 px-3" id={`field-containers-${idx}-gross_weight`} data-field={`containers.${idx}.gross_weight`}>
                    <DocUnderlineInput
                      type="number"
                      step="any"
                      value={c.gross_weight}
                      onChange={(v) => handleContainerChange(idx, 'gross_weight', v)}
                      placeholder="Gross Weight"
                      disabled={readOnly}
                      uppercase={false}
                      error={errors[`containers.${idx}.gross_weight`]}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Net Weight */}
                  <td className="py-1.5 px-3" id={`field-containers-${idx}-net_weight`} data-field={`containers.${idx}.net_weight`}>
                    <DocUnderlineInput
                      type="number"
                      step="any"
                      value={c.net_weight}
                      onChange={(v) => handleContainerChange(idx, 'net_weight', v)}
                      placeholder="Net Weight"
                      disabled={readOnly}
                      uppercase={false}
                      error={errors[`containers.${idx}.net_weight`]}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Total Row matching Mockup */}
              <tr className="bg-muted/20 font-bold text-foreground text-[12px] sm:text-[13px] tracking-wide border-t-2 border-border divide-x divide-border">
                <td colSpan={3} className="py-2.5 px-4 text-center sm:text-right font-bold uppercase tracking-wider">
                  Total
                </td>
                <td className="py-2.5 px-3 text-center sm:text-left font-bold text-foreground">
                  {formatNumberWithCommas(tableTotals.totalBags)}
                </td>
                <td className="py-2.5 px-3 text-center sm:text-left font-bold text-foreground">
                  {formatWeightWithDecimals(tableTotals.totalGross)}
                </td>
                <td className="py-2.5 px-3 text-center sm:text-left font-bold text-foreground">
                  {formatWeightWithDecimals(tableTotals.totalNet)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ========================================================
            SECTION 6: ENTER TITLE & ENTER COMMENT (1/3 & 2/3)
           ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
          <div className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0" id="field-notes_title" data-field="notes_title">
            <DocUnderlineInput
              id="field-notes_title-input"
              name="comment_label"
              value={notesTitle}
              onChange={(val) => {
                markDirty();
                setNotesTitle(val);
                setErrors((prev) => ({ ...prev, comment_label: '', comment_title: '', notes_title: '' }));
              }}
              disabled={readOnly}
              placeholder="Enter Title"
              icon="fa-solid fa-pen"
              uppercase={false}
              error={errors.notes_title || errors.comment_label || errors.comment_title}
              inputClassName="text-[14px] font-semibold text-foreground"
              className="w-full"
            />
          </div>

          <div className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0 md:col-span-2" id="field-notes_comment" data-field="notes_comment">
            <DocUnderlineInput
              id="field-notes_comment-input"
              name="comment_value"
              value={notesComment}
              onChange={(val) => {
                markDirty();
                setNotesComment(val);
                setErrors((prev) => ({ ...prev, comment_value: '', comment_text: '', comment: '', notes_comment: '' }));
              }}
              disabled={readOnly}
              placeholder="Enter Comment"
              icon="fa-solid fa-pen"
              uppercase={false}
              error={errors.notes_comment || errors.comment_value || errors.comment_text || errors.comment}
              inputClassName="text-[14px] font-semibold text-foreground"
              className="w-full"
            />
          </div>
        </div>
      </div>
      {/* End of Scrollable Viewport */}

      {/* ========================================================
          STICKY / STATIC FOOTER ACTION BAR
          Exact Match with 4 Sticky Action Buttons across Smart Docs
         ======================================================== */}
      <div
        id="bill-of-lading-actions-toolbar"
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Print Preview & Download PDF */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button */}
          <button
            type="button"
            onClick={handleOpenPrintPreview}
            disabled={isSavingDraft || isSubmitting}
            title="Print Preview"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>Print Preview</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            title="Download PDF"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20"
          >
            {isDownloadingPdf ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-solid fa-file-pdf text-xs" />
            )}
            <span>{isDownloadingPdf ? 'Downloading...' : 'Download PDF'}</span>
          </button>
        </div>

        {/* Right Action Buttons: Save As Draft & Submit */}
        <div
          className={`grid ${
            docStatus === 'COMPLETED' ? 'grid-cols-1' : 'grid-cols-2'
          } sm:flex sm:items-center gap-2 sm:gap-2.5 transition-all duration-200`}
        >
          {/* Save As Draft: Shown while status is PENDING/DRAFT */}
          {docStatus !== 'COMPLETED' ? (
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
                  : dict?.smart_docs?.confirmation_form?.save_as_draft || dict?.smart_docs?.save_as_draft || 'Save As Draft'}
              </span>
            </button>
          ) : null}

          {/* Submit */}
          <button
            type="button"
            disabled={isSubmitting || isSavingDraft || readOnly || (docStatus === 'COMPLETED' && !hasSubmitChanges)}
            onClick={handleSubmit}
            title={
              docStatus === 'COMPLETED' && !hasSubmitChanges
                ? 'Bill of Lading already submitted'
                : undefined
            }
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
        prefix="bill_of_lading"
        docId={draftId || effectiveBLId || ''}
        candidateIds={[
          draftId,
          effectiveBLId,
          shipmentInstructionId,
          customInvoiceId,
          proformaId,
          contractId,
          confirmationId,
        ].filter(Boolean) as string[]}
        billOfLadingId={draftId || effectiveBLId || ''}
        customInvoiceId={customInvoiceId}
        shipmentInstructionId={shipmentInstructionId}
        proformaId={proformaId}
        contractId={contractId}
        confirmationId={confirmationId}
        docNumber={blNo}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}
