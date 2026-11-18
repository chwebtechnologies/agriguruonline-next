'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocUnderlineSelect, { DocSelectOption } from './DocUnderlineSelect';
import DocToggle from './DocToggle';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import { toast } from 'sonner';
import {
  downloadDocPdfAction,
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
import { extractDestinationPortCountry, extractPortDisplayName } from './ProformaDocumentForm';

export interface FormOptionItem {
  value: string;
  label: string;
  subLabel?: string;
  [key: string]: any;
}

export interface ContainerItem {
  id?: string;
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
 * Resolves initial shipping line value safely across all potential backend keys
 * and ensures contract clauses like "SHIPMENT IN CONTAINERS ( DO NOT USE NVOCC & IRANIAN SHIPPING LINE )"
 * are never mistaken for the actual shipping line carrier.
 */
export function extractShippingLineValue(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading || {};
  const siObj = data?.shipment_instruction || data?.shipment || {};

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
    siObj?.shipping_line,
    siObj?.shipping_company,
    siObj?.carrier,
    siObj?.liner,
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
 * Resolves place_of_delivery across all possible trade context layers.
 */
export function resolvePlaceOfDelivery(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const candidates = [
    data?.place_of_delivery,
    data?.placeOfDelivery,
    data?.shipment_instruction?.place_of_delivery,
    data?.shipment_instruction?.placeOfDelivery,
    data?.proforma?.place_of_delivery,
    data?.proforma?.placeOfDelivery,
    data?.contract?.place_of_delivery,
    data?.contract?.placeOfDelivery,
    data?.confirmation?.place_of_delivery,
    data?.confirmation?.placeOfDelivery,
    data?.final_destination,
    data?.finalDestination,
    data?.shipment_instruction?.final_destination,
    data?.proforma?.final_destination,
    data?.contract?.final_destination,
    data?.confirmation?.final_destination,
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
 * Resolves destination country from destination_port.country.name
 */
export function resolveCountryOfDestination(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const portCandidates = [
    data?.destination_port,
    data?.port_of_destination,
    data?.destinationPort,
    data?.discharge_port,
    data?.pod,
    data?.shipment_instruction?.destination_port,
    data?.shipment_instruction?.port_of_destination,
    data?.contract?.destination_port,
    data?.confirmation?.destination_port,
    data?.proforma?.destination_port,
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

  const fromExt = extractDestinationPortCountry(data);
  if (fromExt) return fromExt;

  const direct =
    data?.country_of_destination ||
    data?.destination_country ||
    data?.country_destination ||
    data?.destination_port_country ||
    data?.destination_port_country_name ||
    data?.final_destination_country ||
    data?.contract?.destination_country ||
    data?.confirmation?.destination_country;

  if (direct && typeof direct === 'string' && direct.trim()) {
    const t = direct.trim();
    if (t !== 'undefined' && t !== 'null' && t !== '[object Object]') return t;
  }

  return '';
}

/**
 * Resolves destination port name formatted with country: `${destination_port.name}, ${country}`
 */
export function resolvePortOfDestination(data: any, resolvedCountry = ''): string {
  if (!data || typeof data !== 'object') return '';

  const portCandidates = [
    data?.destination_port,
    data?.port_of_destination,
    data?.destinationPort,
    data?.discharge_port,
    data?.pod,
    data?.destination_port_name,
    data?.shipment_instruction?.destination_port,
    data?.shipment_instruction?.port_of_destination,
    data?.contract?.destination_port,
    data?.confirmation?.destination_port,
    data?.proforma?.destination_port,
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

export function parseBillOfLadingBackendErrors(errorResponse: any): {
  fieldErrors: Record<string, string>;
  generalError?: string;
} {
  const fieldErrors: Record<string, string> = {};
  if (!errorResponse) return { fieldErrors };

  const rawFields =
    errorResponse.error_fields ||
    errorResponse.data?.error_fields ||
    errorResponse.errors ||
    errorResponse.data?.errors ||
    errorResponse.raw?.error_fields ||
    errorResponse.raw?.errors ||
    null;

  if (rawFields && typeof rawFields === 'object') {
    if (Array.isArray(rawFields)) {
      rawFields.forEach((item: any) => {
        if (typeof item === 'string') {
          const match = item.match(/^([a-zA-Z0-9_.-]+)\s*:\s*(.+)$/);
          if (match) fieldErrors[match[1]] = match[2];
        } else if (item && typeof item === 'object') {
          const f = item.field || item.key || item.path || item.property;
          const msg = item.message || item.error || item.detail;
          if (f && msg) {
            const fStr = String(f);
            fieldErrors[fStr] = String(msg);
            if (
              fStr === 'shipping_line' ||
              fStr === 'shipping_company' ||
              fStr === 'shipping_company_name' ||
              fStr === 'carrier' ||
              fStr === 'carrier_name' ||
              fStr === 'shipping_line_name' ||
              fStr === 'liner' ||
              fStr === 'shippingLine'
            ) {
              fieldErrors.shipping_line = String(msg);
            }
          }
        }
      });
    } else {
      Object.entries(rawFields).forEach(([k, v]) => {
        if (v && typeof v === 'string') {
          fieldErrors[k] = v;
          if (
            k === 'shipping_line' ||
            k === 'shipping_company' ||
            k === 'shipping_company_name' ||
            k === 'carrier' ||
            k === 'carrier_name' ||
            k === 'shipping_line_name' ||
            k === 'liner' ||
            k === 'shippingLine'
          ) {
            fieldErrors.shipping_line = v;
          }
        } else if (Array.isArray(v) && v[0]) {
          const vStr = String(v[0]);
          fieldErrors[k] = vStr;
          if (
            k === 'shipping_line' ||
            k === 'shipping_company' ||
            k === 'shipping_company_name' ||
            k === 'carrier' ||
            k === 'carrier_name' ||
            k === 'shipping_line_name' ||
            k === 'liner' ||
            k === 'shippingLine'
          ) {
            fieldErrors.shipping_line = vStr;
          }
        }
      });
    }
  }

  const generalError =
    errorResponse.message ||
    errorResponse.error ||
    errorResponse.data?.message ||
    undefined;

  return { fieldErrors, generalError };
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
        (initialData?.bl_no ? initialData?.id : '')
      ) ||
      extractStepRedirectId(selfStep) ||
      extractLinkedBillOfLadingId(initialData) ||
      ''
    );
  }, [billOfLadingId, cleanSelfId, initialData, selfStep]);

  const [draftId, setDraftId] = useState<string>(() => sanitizeDocId(effectiveBLId) || '');
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState(false);

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
  const [voyageNo, setVoyageNo] = useState<string>(() => safeString(initialData?.voyage_no || initialData?.voyageNo || initialData?.voyage));
  const [blNo, setBlNo] = useState<string>(() => safeString(initialData?.bl_no || initialData?.blNo || initialData?.bill_of_lading_no));

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

  const [bookingNo, setBookingNo] = useState<string>(() => safeString(initialData?.booking_no || initialData?.bookingNo));
  const [trackingLink, setTrackingLink] = useState<string>(() => safeString(initialData?.tracking_link || initialData?.trackingLink || initialData?.tracking_url));

  // Dynamic Transit Days calculation
  const transitDays = useMemo(() => {
    if (!sailingDate || !arrivalDate) return '-';
    try {
      const d1 = new Date(sailingDate);
      const d2 = new Date(arrivalDate);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '-';
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return '-';
      return `${diffDays} DAYS`;
    } catch {
      return '-';
    }
  }, [sailingDate, arrivalDate]);

  // Port of Loading
  const [portOfLoading, setPortOfLoading] = useState<string>(() => {
    return safeString(
      initialData?.port_of_loading ||
      initialData?.loading_port ||
      initialData?.pol ||
      initialData?.port_of_loading_name
    );
  });

  // Shipping Bill No (SB. NO)
  const [sbNo, setSbNo] = useState<string>(() => safeString(initialData?.sb_no || initialData?.shipping_bill_no || initialData?.shipping_bill_number));

  // Containers List
  const [containers, setContainers] = useState<ContainerItem[]>(() => {
    const existing = initialData?.containers || initialData?.container_details || initialData?.container_list;
    const rawFcl = initialData?.fcl || initialData?.no_of_containers || initialData?.fcl_quantity || initialData?.total_fcl;
    const fclCount = Number(rawFcl);
    const targetCount = !isNaN(fclCount) && fclCount > 0 ? fclCount : (Array.isArray(existing) && existing.length > 0 ? existing.length : 1);

    if (Array.isArray(existing) && existing.length > 0) {
      const mapped: ContainerItem[] = existing.map((c: any, i: number) => ({
        id: c.id || `c-${i + 1}`,
        container_no: safeString(c.container_no || c.containerNo || c.container_number),
        seal_no: safeString(c.seal_no || c.sealNo || c.seal_number),
        bags: c.bags !== undefined && c.bags !== null ? c.bags : (c.total_bags || ''),
        gross_weight: c.gross_weight !== undefined && c.gross_weight !== null ? c.gross_weight : (c.grossWeight || c.gross_wt || ''),
        net_weight: c.net_weight !== undefined && c.net_weight !== null ? c.net_weight : (c.netWeight || c.net_wt || ''),
      }));
      if (mapped.length < targetCount) {
        for (let i = mapped.length; i < targetCount; i++) {
          mapped.push({
            id: `c-${i + 1}`,
            container_no: '',
            seal_no: '',
            bags: '',
            gross_weight: '',
            net_weight: '',
          });
        }
      }
      return mapped;
    }

    const defaultList: ContainerItem[] = [];
    for (let i = 0; i < targetCount; i++) {
      defaultList.push({
        id: `c-${i + 1}`,
        container_no: '',
        seal_no: '',
        bags: '',
        gross_weight: '',
        net_weight: '',
      });
    }
    return defaultList;
  });

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

  // Parties & Trade Details from Response
  // User requirement: "Custom Invoice me kitna clean and proper dikh raha hai Exporr and Consignee buyer and sab cheese and tumne BL me kitna kharab banaaya hai exporter compny name bold rakha hai vo kucch karna hi nahi hai jese custom invoice me kiya hai uski deails normal hi dikhani hai value ko clean proper look me"
  const exporterText = useMemo(() => {
    const rawDetails =
      initialData?.seller_details ||
      initialData?.shipper_details ||
      initialData?.contract?.seller_details ||
      initialData?.confirmation?.seller_details ||
      initialData?.proforma?.seller_details ||
      initialData?.shipment_instruction?.seller_details ||
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

    if (initialData?.seller_instruction) return safeString(initialData.seller_instruction);
    if (initialData?.contract?.seller_instruction) return safeString(initialData.contract.seller_instruction);
    if (initialData?.confirmation?.seller_instruction) return safeString(initialData.confirmation.seller_instruction);

    return '';
  }, [initialData]);

  const consigneeText = useMemo(() => {
    const rawConsignee =
      initialData?.consignee_details ||
      initialData?.buyer_details ||
      initialData?.buyer ||
      initialData?.consignee ||
      initialData?.shipment_instruction?.consignee_details ||
      initialData?.shipment?.consignee_details ||
      initialData?.contract?.buyer_details ||
      initialData?.confirmation?.buyer_details;

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

  // Extract Notify Parties matching Custom Invoice format
  const extractNotifyPartyText = useCallback(
    (index1Based: number) => {
      const rawList = initialData?.notify_parties || initialData?.notify_party_list;
      const item = Array.isArray(rawList) ? rawList[index1Based - 1] : null;

      const candidate =
        initialData?.[`notify_party_${index1Based}_instruction`] ||
        initialData?.[`notify_party_${index1Based}_details`] ||
        initialData?.[`notify_party_${index1Based}_text`] ||
        initialData?.[`notify_party_${index1Based}`]?.details ||
        initialData?.[`notify_party_${index1Based}`] ||
        initialData?.[`notifyParty${index1Based}Details`] ||
        initialData?.[`notifyParty${index1Based}`] ||
        initialData?.shipment_instruction?.[`notify_party_${index1Based}`] ||
        initialData?.shipment_instruction?.[`notify_party_${index1Based}_details`] ||
        initialData?.shipment?.[`notify_party_${index1Based}`] ||
        initialData?.shipment?.[`notify_party_${index1Based}_details`] ||
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
    return safeString(
      initialData?.country_of_origin ||
      initialData?.origin_country ||
      initialData?.origin ||
      initialData?.product_country ||
      initialData?.contract?.country_of_origin,
      ''
    );
  }, [initialData]);

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
  const grossWeightStr = safeString(initialData?.gross_weight || initialData?.gross_weight_mts);
  const netWeightStr = safeString(initialData?.net_weight || initialData?.net_weight_mts);
  const freightCharges = safeString(initialData?.freight_charges || initialData?.freight || 'PREPAID');
  const freeDays = safeString(initialData?.free_days || initialData?.pod_free_days);
  const emptyBags = safeString(initialData?.empty_bags || initialData?.empty_bags_percentage);

  // Live Totals calculation for Container Table
  const tableTotals = useMemo(() => {
    let totalBags = 0;
    let totalGross = 0;
    let totalNet = 0;

    containers.forEach((c) => {
      const b = Number(String(c.bags || '').replace(/,/g, ''));
      if (!isNaN(b) && b > 0) totalBags += b;

      const gw = Number(String(c.gross_weight || '').replace(/,/g, ''));
      if (!isNaN(gw) && gw > 0) totalGross += gw;

      const nw = Number(String(c.net_weight || '').replace(/,/g, ''));
      if (!isNaN(nw) && nw > 0) totalNet += nw;
    });

    return {
      totalBags,
      totalGross,
      totalNet,
    };
  }, [containers]);

  const displayTotalBags = useMemo(() => {
    if (tableTotals.totalBags > 0) return String(tableTotals.totalBags);
    return safeString(initialData?.total_bags || initialData?.bags || '0');
  }, [tableTotals.totalBags, initialData]);

  const displayGrossWeight = useMemo(() => {
    if (grossWeightStr) return grossWeightStr;
    if (tableTotals.totalGross > 0) return (tableTotals.totalGross / 1000).toFixed(3);
    return '0.000';
  }, [grossWeightStr, tableTotals.totalGross]);

  const displayNetWeight = useMemo(() => {
    if (netWeightStr) return netWeightStr;
    if (tableTotals.totalNet > 0) return (tableTotals.totalNet / 1000).toFixed(3);
    return '0.000';
  }, [netWeightStr, tableTotals.totalNet]);

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

    if (initialData.pdf_title || initialData.document_title) {
      setCustomDocTitle(safeString(initialData.pdf_title || initialData.document_title, 'BILL OF LADING'));
    }
    const val = initialData.is_watermark_enabled ?? initialData.watermark_enabled ?? initialData.watermark;
    if (val !== undefined && val !== null) {
      setWatermarkEnabled(typeof val === 'string' ? val !== 'false' && val !== '0' : Boolean(val));
    }
    if (initialData.vessel_name || initialData.vessel) {
      setVesselName(safeString(initialData.vessel_name || initialData.vessel));
    }
    const line = extractShippingLineValue(initialData);
    if (line) {
      setShippingLine(line);
    }
    if (initialData.voyage_no || initialData.voyageNo || initialData.voyage) {
      setVoyageNo(safeString(initialData.voyage_no || initialData.voyageNo || initialData.voyage));
    }
    if (initialData.bl_no || initialData.blNo || initialData.bill_of_lading_no) {
      setBlNo(safeString(initialData.bl_no || initialData.blNo || initialData.bill_of_lading_no));
    }
    const sDate = initialData.sailing_date || initialData.sailingDate || initialData.etd;
    if (sDate) {
      try {
        const dt = new Date(sDate);
        setSailingDate(!isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : String(sDate).split('T')[0]);
      } catch {
        setSailingDate(String(sDate));
      }
    }
    const aDate = initialData.arrival_date || initialData.arrivalDate || initialData.eta;
    if (aDate) {
      try {
        const dt = new Date(aDate);
        setArrivalDate(!isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : String(aDate).split('T')[0]);
      } catch {
        setArrivalDate(String(aDate));
      }
    }
    if (initialData.booking_no || initialData.bookingNo) {
      setBookingNo(safeString(initialData.booking_no || initialData.bookingNo));
    }
    if (initialData.tracking_link || initialData.trackingLink || initialData.tracking_url) {
      setTrackingLink(safeString(initialData.tracking_link || initialData.trackingLink || initialData.tracking_url));
    }
    const pol = initialData.port_of_loading || initialData.loading_port || initialData.pol || initialData.port_of_loading_name;
    if (pol) {
      setPortOfLoading(safeString(pol));
    }
    const sb = initialData.sb_no || initialData.shipping_bill_no || initialData.shipping_bill_number;
    if (sb) {
      setSbNo(safeString(sb));
    }
    const existingContainers = initialData.containers || initialData.container_details || initialData.container_list;
    if (Array.isArray(existingContainers) && existingContainers.length > 0) {
      setContainers(
        existingContainers.map((c: any, i: number) => ({
          id: c.id || `c-${i + 1}`,
          container_no: safeString(c.container_no || c.containerNo || c.container_number),
          seal_no: safeString(c.seal_no || c.sealNo || c.seal_number),
          bags: c.bags !== undefined && c.bags !== null ? c.bags : (c.total_bags || ''),
          gross_weight: c.gross_weight !== undefined && c.gross_weight !== null ? c.gross_weight : (c.grossWeight || c.gross_wt || ''),
          net_weight: c.net_weight !== undefined && c.net_weight !== null ? c.net_weight : (c.netWeight || c.net_wt || ''),
        }))
      );
    }
    const nTitle = initialData.comment_label || initialData.comment_title || initialData.notes_title || initialData.extra_title;
    if (nTitle) {
      setNotesTitle(safeString(nTitle));
    }
    const nComment = initialData.comment_value || initialData.comment_text || initialData.notes_comment || initialData.comment || initialData.extra_comment;
    if (nComment) {
      setNotesComment(safeString(nComment));
    }
  }, [initialData, dataVersion, effectiveBLId, isDirty, hasDraftChanges]);

  // Container Table Row handler
  const handleContainerChange = (index: number, field: keyof ContainerItem, val: string) => {
    markDirty();
    setContainers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  // Build Payload
  const getBillOfLadingPayload = useCallback(() => {
    const payloadContainers = containers
      .filter((c) => c.container_no || c.seal_no || c.bags || c.gross_weight || c.net_weight)
      .map((c) => ({
        container_no: c.container_no.trim(),
        seal_no: c.seal_no.trim(),
        bags: c.bags !== '' ? Number(String(c.bags).replace(/,/g, '')) : undefined,
        gross_weight: c.gross_weight !== '' ? Number(String(c.gross_weight).replace(/,/g, '')) : undefined,
        net_weight: c.net_weight !== '' ? Number(String(c.net_weight).replace(/,/g, '')) : undefined,
      }));

    return {
      bill_of_lading_id: draftId || effectiveBLId || undefined,
      id: draftId || effectiveBLId || undefined,
      shipment_instruction_id: shipmentInstructionId || undefined,
      custom_invoice_id: customInvoiceId || undefined,
      proforma_id: proformaId || undefined,
      contract_id: contractId || undefined,
      confirmation_id: confirmationId || undefined,
      pdf_title: customDocTitle.trim() || 'BILL OF LADING',
      document_title: customDocTitle.trim() || 'BILL OF LADING',
      is_watermark_enabled: watermarkEnabled,
      watermark_enabled: watermarkEnabled,
      vessel_name: vesselName.trim(),
      shipping_line: shippingLine.trim(),
      shipping_company: shippingLine.trim(),
      shipping_company_name: shippingLine.trim(),
      shipping_line_name: shippingLine.trim(),
      carrier: shippingLine.trim(),
      carrier_name: shippingLine.trim(),
      liner: shippingLine.trim(),
      shippingLine: shippingLine.trim(),
      voyage_no: voyageNo.trim(),
      bl_no: blNo.trim(),
      bill_of_lading_no: blNo.trim(),
      sailing_date: sailingDate || undefined,
      arrival_date: arrivalDate || undefined,
      transit_days: transitDays !== '-' ? transitDays : undefined,
      booking_no: bookingNo.trim(),
      tracking_link: trackingLink.trim(),
      port_of_loading: portOfLoading.trim(),
      pre_carriage_by: preCarriageBy,
      place_of_receipt: placeOfReceipt || undefined,
      country_of_origin: countryOfOrigin || undefined,
      country_of_destination: countryOfDestination || undefined,
      port_of_destination: portOfDestination || undefined,
      final_destination: finalDestination || undefined,
      place_of_delivery: finalDestination || undefined,
      sb_no: sbNo.trim(),
      shipping_bill_no: sbNo.trim(),
      containers: payloadContainers,
      total_bags: tableTotals.totalBags > 0 ? tableTotals.totalBags : undefined,
      total_gross_weight: tableTotals.totalGross > 0 ? tableTotals.totalGross : undefined,
      total_net_weight: tableTotals.totalNet > 0 ? tableTotals.totalNet : undefined,
      comment_label: notesTitle.trim() || (notesComment.trim() ? 'Comments' : ''),
      comment_title: notesTitle.trim() || (notesComment.trim() ? 'Comments' : ''),
      notes_title: notesTitle.trim() || (notesComment.trim() ? 'Comments' : ''),
      comment_value: notesComment.trim(),
      comment_text: notesComment.trim(),
      notes_comment: notesComment.trim(),
      comment: notesComment.trim(),
    };
  }, [
    containers,
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
    transitDays,
    bookingNo,
    trackingLink,
    portOfLoading,
    preCarriageBy,
    placeOfReceipt,
    countryOfOrigin,
    countryOfDestination,
    portOfDestination,
    finalDestination,
    sbNo,
    tableTotals,
    notesTitle,
    notesComment,
  ]);

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({});

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
        const { fieldErrors, generalError } = parseBillOfLadingBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          toast.error('Please check highlighted fields.');
          return;
        }
        toast.error(generalError || res?.message || 'Failed to save bill of lading draft.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred while saving bill of lading draft.');
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
        const { fieldErrors, generalError } = parseBillOfLadingBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          toast.error('Please check highlighted fields.');
          return;
        }
        toast.error(generalError || res?.message || 'Failed to submit bill of lading.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error occurred while submitting bill of lading.');
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
              setErrors((prev) => ({ ...prev, documentTitle: '', pdf_title: '', title: '' }));
            }}
            disabled={readOnly}
            placeholder="BILL OF LADING"
            ariaLabel="Document Title"
            error={errors.documentTitle || errors.pdf_title || errors.title}
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Right: Watermark Toggle */}
          <div className="flex flex-col items-end justify-center shrink-0 sm:w-[140px]" id="field-is_watermark_enabled">
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
          </div>
        </div>

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
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                    placeholder="ENTER VESSEL NAME"
                    icon="fa-solid fa-pen"
                    uppercase={true}
                    error={errors.vessel_name}
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
                  />
                </div>

                {/* VOYAGE NO */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                    placeholder="ENTER VOYAGE NO"
                    icon="fa-solid fa-pen"
                    uppercase={true}
                    error={errors.voyage_no}
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
                  />
                </div>
              </div>

              {/* Right Column: SHIPPING LINE & BL NO */}
              <div className="flex flex-col divide-y divide-border">
                {/* SHIPPING LINE */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                    placeholder="ENTER SHIPPING LINE"
                    icon="fa-solid fa-pen"
                    uppercase={true}
                    error={
                      errors.shipping_line ||
                      errors.shipping_company ||
                      errors.carrier ||
                      errors.liner ||
                      errors.shippingLine
                    }
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
                  />
                </div>

                {/* BL NO */}
                <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
                  <div className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider px-0.5 mb-1">
                    BL NO
                  </div>
                  <DocUnderlineInput
                    value={blNo}
                    onChange={(val) => {
                      markDirty();
                      setBlNo(val);
                      setErrors((prev) => ({ ...prev, bl_no: '' }));
                    }}
                    disabled={readOnly}
                    placeholder="ENTER BL NO"
                    icon="fa-solid fa-pen"
                    uppercase={true}
                    error={errors.bl_no}
                    inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Middle Sub-row: SAILING DATE | ARRIVAL DATE | TRANSIT DAYS */}
            <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {/* SAILING DATE */}
              <div className="sm:col-span-4 p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                  error={errors.sailing_date}
                  inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
                />
              </div>

              {/* ARRIVAL DATE */}
              <div className="sm:col-span-4 p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                  error={errors.arrival_date}
                  inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
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
            <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                placeholder="ENTER BOOKING NO"
                icon="fa-solid fa-pen"
                uppercase={true}
                error={errors.booking_no}
                inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase"
              />
            </div>

            {/* Bottom Sub-row: TRACKING LINK */}
            <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[64px]">
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
                placeholder=""
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
            {/* PORT OF LOADING (INPUT) */}
            <div className="p-2.5 sm:p-3 flex flex-col justify-center min-h-[44px]">
              <DocUnderlineInput
                value={portOfLoading}
                onChange={(val) => {
                  markDirty();
                  setPortOfLoading(val);
                  setErrors((prev) => ({ ...prev, port_of_loading: '' }));
                }}
                disabled={readOnly}
                placeholder="ENTER PORT OF LOADING"
                icon="fa-solid fa-chevron-down"
                uppercase={true}
                error={errors.port_of_loading}
                inputClassName="text-[13px] sm:text-[14px] font-semibold text-foreground uppercase text-center"
              />
            </div>

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
                        setErrors((prev) => ({ ...prev, sb_no: '' }));
                      }}
                      disabled={readOnly}
                      placeholder="ENTER SHIPPING BILL NO"
                      icon="fa-solid fa-pen"
                      uppercase={true}
                      error={errors.sb_no}
                      inputClassName="text-[13px] sm:text-[14px] font-medium text-foreground uppercase w-full"
                      className="w-full"
                    />
                  </div>
                </div>

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
        <div className="w-full overflow-x-auto border-b border-border bg-card">
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
                  <td className="py-1.5 px-3">
                    <DocUnderlineInput
                      value={c.container_no}
                      onChange={(v) => handleContainerChange(idx, 'container_no', v)}
                      placeholder="Container No"
                      disabled={readOnly}
                      uppercase={true}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Seal No */}
                  <td className="py-1.5 px-3">
                    <DocUnderlineInput
                      value={c.seal_no}
                      onChange={(v) => handleContainerChange(idx, 'seal_no', v)}
                      placeholder="Seal No"
                      disabled={readOnly}
                      uppercase={true}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Bags */}
                  <td className="py-1.5 px-3">
                    <DocUnderlineInput
                      type="number"
                      value={c.bags}
                      onChange={(v) => handleContainerChange(idx, 'bags', v)}
                      placeholder="Bags"
                      disabled={readOnly}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Gross Weight */}
                  <td className="py-1.5 px-3">
                    <DocUnderlineInput
                      type="number"
                      step="any"
                      value={c.gross_weight}
                      onChange={(v) => handleContainerChange(idx, 'gross_weight', v)}
                      placeholder="Gross Weight"
                      disabled={readOnly}
                      inputClassName="text-[13px] font-medium text-foreground"
                    />
                  </td>

                  {/* Net Weight */}
                  <td className="py-1.5 px-3">
                    <DocUnderlineInput
                      type="number"
                      step="any"
                      value={c.net_weight}
                      onChange={(v) => handleContainerChange(idx, 'net_weight', v)}
                      placeholder="Net Weight"
                      disabled={readOnly}
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
          <div className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0" id="field-notes_title">
            <DocUnderlineInput
              id="field-notes_title-input"
              name="comment_label"
              value={notesTitle}
              onChange={(val) => {
                markDirty();
                setNotesTitle(val);
                setErrors((prev) => ({ ...prev, comment_label: '', notes_title: '' }));
              }}
              disabled={readOnly}
              placeholder="Enter Title"
              icon="fa-solid fa-pen"
              uppercase={false}
              error={errors.comment_label || errors.notes_title}
              inputClassName="text-[14px] font-semibold text-foreground"
              className="w-full"
            />
          </div>

          <div className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0 md:col-span-2" id="field-notes_comment">
            <DocUnderlineInput
              id="field-notes_comment-input"
              name="comment_value"
              value={notesComment}
              onChange={(val) => {
                markDirty();
                setNotesComment(val);
                setErrors((prev) => ({ ...prev, comment_value: '', notes_comment: '' }));
              }}
              disabled={readOnly}
              placeholder="Enter Comment"
              icon="fa-solid fa-pen"
              uppercase={false}
              error={errors.comment_value || errors.notes_comment}
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
