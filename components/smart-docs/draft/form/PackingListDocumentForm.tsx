'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocToggle from './DocToggle';
import DocSignatureBox from './DocSignatureBox';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import { dataUrlToFile } from './ContractDocumentForm';
import {
  safeString,
  resolveGstString,
  dedupePartyDetails,
  formatPartyDetails,
  extractSellerCompanyName,
  extractSellerInstructionId,
  extractLoadingPortCountry,
  extractDestinationPortCountry,
  extractBuyerInfo,
  extractPortDisplayName,
  extractGoodsDescription,
  extractDeliveryTerms,
  extractShippingTerm,
  formatShippingTermHeader,
  extractVesselVoyageNo,
  resolveSignatureValue,
  resolveSellerLogoValue,
  scrollToAndFocusProformaField,
  parseProformaBackendErrors,
  type FormOptionItem,
} from './ProformaDocumentForm';
import {
  downloadDocPdfAction,
  savePackingListDraftAction,
  submitPackingListAction,
} from '@/app/actions/smart-docs';
import {
  formatSignatureUrl,
  normalizeSignaturePayload,
  type StepperDocumentItem,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  extractPackingListData,
  getPackingListStep,
  extractPackingListDocumentStatus,
  isPackingListStep,
  getWorkflowSubmitButtonInfo,
  getWorkflowSubmitToastMessage,
  getStepSelfId,
  extractStepRedirectId,
} from '@/lib/api/smart-docs.service';

export interface ContainerRowItem {
  id: string;
  index: number;
  container_no: string;
  seal_no: string;
  bags: string | number;
  gross_weight: string | number;
  net_weight: string | number;
}

export interface PackingListDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
  packingListId?: string;
  commercialInvoiceId?: string;
  customInvoiceId?: string;
  shipmentInstructionId?: string;
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
  onSubmitPackingList?: (
    payload: any,
    id?: string,
    nextStep?: StepperDocumentItem | null
  ) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

const RAW_ID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,})$/i;

const PLACEHOLDER_ID_REGEX =
  /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+|null|undefined|nan|\[object object\])$/i;

/**
 * Formats a party object (consignee or notify party) into clean multiline text.
 */
function formatStructuredParty(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
      return '';
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatStructuredParty(parsed);
      } catch {
        return trimmed;
      }
    }
    return dedupePartyDetails(trimmed);
  }
  if (typeof raw === 'object') {
    const directText =
      raw.details ||
      raw.instruction ||
      raw.instructionText ||
      raw.notify_party ||
      raw.text;
    if (typeof directText === 'string' && directText.trim()) {
      const name = raw.company_name || raw.companyName || raw.name || '';
      return formatPartyDetails(name, directText);
    }

    const lines: string[] = [];
    const name = safeString(raw.company_name || raw.companyName || raw.name || raw.party_name);
    if (name) lines.push(name);

    const addr = safeString(raw.address || raw.street || raw.address_line || raw.address_line_1);
    if (addr) lines.push(addr);

    const addr2 = safeString(raw.address_line_2);
    if (addr2) lines.push(addr2);

    const city = safeString(raw.city);
    const state = safeString(raw.state);
    const country =
      typeof raw.country === 'object' && raw.country !== null
        ? safeString(raw.country.name || raw.country.title || raw.country.label)
        : safeString(raw.country || raw.country_name);
    const zip = safeString(raw.zip_code || raw.zipcode || raw.postal_code || raw.pincode);
    const locationLine = [city, state, country, zip].filter(Boolean).join(', ');
    if (locationLine) lines.push(locationLine);

    const tel = safeString(raw.tel || raw.phone || raw.contact || raw.mobile);
    const email = safeString(raw.email);
    const contactParts: string[] = [];
    if (tel) contactParts.push(`TEL: ${tel}`);
    if (email) contactParts.push(`EMAIL: ${email}`);
    if (contactParts.length > 0) lines.push(contactParts.join(', '));

    const taxReg = safeString(raw.tax_id || raw.tax_reg_id || raw.registration_number || raw.gst);
    if (taxReg) lines.push(`TAX/REG ID: ${taxReg}`);

    return dedupePartyDetails(lines.join('\n'));
  }
  return '';
}

/**
 * Extracts Consignee / Buyer display text, prioritizing consignee_details from upstream payloads.
 */
function extractConsigneeDisplay(
  data: any,
  buyerName: string,
  buyerDetails: string
): string {
  const candidates = [
    data?.consignee_details,
    data?.consignee_details_text,
    data?.consignee,
    data?.packing_list?.consignee_details,
    data?.shipment_instruction?.consignee_details,
    data?.shipment?.consignee_details,
    data?.bill_of_lading?.consignee_details,
  ];

  for (const cand of candidates) {
    const formatted = formatStructuredParty(cand);
    if (formatted) return formatted;
  }

  return formatPartyDetails(buyerName, buyerDetails);
}

/**
 * Extracts Notify Party 1..6 from initialData.
 */
function extractNotifyPartyByIndex(data: any, index1Based: number): string {
  if (!data || typeof data !== 'object') return '';

  let list: any[] = [];
  const rawList =
    data?.notify_parties ||
    data?.notify_party_details ||
    data?.notify_party ||
    data?.packing_list?.notify_parties ||
    data?.shipment_instruction?.notify_parties ||
    data?.shipment?.notify_parties ||
    data?.bill_of_lading?.notify_parties;

  if (Array.isArray(rawList)) {
    list = rawList;
  } else if (typeof rawList === 'string' && rawList.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      // ignore invalid JSON
    }
  }

  const indexedCandidates = [
    data?.[`notify_party_${index1Based}`],
    data?.[`notify_party_${index1Based}_details`],
    data?.[`notify_party_${index1Based}_text`],
    data?.packing_list?.[`notify_party_${index1Based}`],
    data?.shipment_instruction?.[`notify_party_${index1Based}`],
    data?.shipment_instruction?.[`notify_party_${index1Based}_details`],
    data?.shipment?.[`notify_party_${index1Based}`],
    data?.shipment?.[`notify_party_${index1Based}_details`],
    data?.bill_of_lading?.[`notify_party_${index1Based}`],
    list[index1Based - 1],
  ];

  for (const cand of indexedCandidates) {
    const formatted = formatStructuredParty(cand);
    if (formatted) return formatted;
  }

  return '';
}

/**
 * Cleans redundant "GST Number:" header prefix when displaying under the GST NUMBER label.
 */
function formatGstDisplayValue(rawGst: string): string {
  const clean = safeString(rawGst, '');
  if (!clean) return '';
  const stripped = clean.replace(/^(gst\s*number|registration\s*number)\s*:\s*\n?/i, '').trim();
  return stripped || clean;
}

/**
 * Extracts VESSEL / VOYAGE NO. by combining vessel_name and voyage_number.
 */
function extractPackingVesselVoyageNo(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const vesselName = safeString(
    data?.packing_list?.vessel_name ??
      data?.vessel_name ??
      data?.bill_of_lading?.vessel_name ??
      data?.shipment_instruction?.vessel_name ??
      data?.contract?.vessel_name,
    ''
  );
  const voyageNumber = safeString(
    data?.packing_list?.voyage_number ??
      data?.voyage_number ??
      data?.voyage_no ??
      data?.bill_of_lading?.voyage_number ??
      data?.bill_of_lading?.voyage_no ??
      data?.shipment_instruction?.voyage_number ??
      data?.shipment_instruction?.voyage_no,
    ''
  );
  const combined = [vesselName, voyageNumber].filter(Boolean).join(', ');
  if (combined) return combined;
  return extractVesselVoyageNo(data);
}

/**
 * Extracts FINAL DESTINATION prioritizing place_of_delivery.
 */
function extractPackingFinalDestination(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const fromPlaceOfDelivery = extractPortDisplayName(
    data?.packing_list?.place_of_delivery ??
      data?.place_of_delivery ??
      data?.placeOfDelivery ??
      data?.bill_of_lading?.place_of_delivery ??
      data?.shipment_instruction?.place_of_delivery,
    ''
  );
  if (fromPlaceOfDelivery) return fromPlaceOfDelivery;
  return extractPortDisplayName(
    data?.packing_list?.final_destination ??
      data?.final_destination ??
      data?.finalDestination ??
      data?.destination_port,
    safeString(data?.destination_port_name || data?.port_of_destination, '')
  );
}

/**
 * Extracts packing type title from packing_type_title.
 */
function extractPackingTypeTitle(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data?.packing_list?.packing_type_title,
    data?.packing_type_title,
    data?.packing_type?.title,
    data?.packing_type?.name,
    data?.shipment_instruction?.packing_type_title,
    data?.proforma?.packing_type_title,
    data?.contract?.packing_type_title,
    data?.confirmation?.packing_type_title,
    data?.packing_type_name,
    data?.packing_title,
    typeof data?.packing_type === 'string' ? data.packing_type : '',
    data?.packing_description,
    data?.packing,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed && !RAW_ID_REGEX.test(trimmed)) return trimmed;
    } else if (typeof raw === 'object') {
      const t = raw.title || raw.name || raw.label || raw.packing_type;
      if (typeof t === 'string' && t.trim() && !RAW_ID_REGEX.test(t.trim())) {
        return t.trim();
      }
    }
  }
  return '';
}

/**
 * Format date to DD/MM/YYYY matching screenshot (e.g. 18/11/2026).
 */
export function formatDisplayDate(raw: any): string {
  if (!raw) return '-';
  const str = String(raw).trim();
  if (!str) return '-';
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return str;
}

/**
 * Format weight with 3 decimal places (e.g. 78.600).
 */
export function formatWeightWithDecimals(val: number | string | undefined | null, decimals = 3): string {
  if (val === undefined || val === null || val === '') return '0.000';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0.000';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats container weight in KG with 3 decimals (e.g. 26200.000).
 * If weight is in MT (< 500), converts to KG (* 1000).
 */
export function formatContainerWeightKg(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num) || num === 0) return '-';
  const kgVal = num < 500 ? num * 1000 : num;
  return kgVal.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Formats container bags (e.g. 520).
 */
export function formatContainerBags(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num) || num === 0) return '-';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Parses initial containers list from data or upstream steps.
 */
function buildInitialContainers(data: any): ContainerRowItem[] {
  const plObj = data?.packing_list || data?.packingList || data?.packing;
  const blObj = data?.bill_of_lading || data?.lading || data?.billOfLading;
  const siObj = data?.shipment_instruction || data?.shipmentInstruction || data?.shipment;

  const existing =
    plObj?.containers ||
    data?.containers ||
    plObj?.container_details ||
    data?.container_details ||
    plObj?.container_list ||
    data?.container_list ||
    blObj?.containers ||
    siObj?.containers;

  const rawFcl =
    data?.fcl ||
    plObj?.fcl ||
    data?.no_of_containers ||
    data?.fcl_quantity ||
    plObj?.fcl_quantity ||
    blObj?.fcl_quantity ||
    data?.total_fcl;
  const fclCount = Number(rawFcl);

  const existingArr = Array.isArray(existing) ? existing : [];

  const list: ContainerRowItem[] = [];
  if (existingArr.length > 0) {
    existingArr.forEach((c: any, idx: number) => {
      list.push({
        id: c.id || c._id || `c-${idx}`,
        index: idx,
        container_no: safeString(c.container_number || c.container_no || c.containerNo),
        seal_no: safeString(c.seal_number || c.seal_no || c.sealNo),
        bags: c.bags !== undefined && c.bags !== null ? String(c.bags) : '',
        gross_weight:
          c.gross_weight !== undefined && c.gross_weight !== null
            ? String(c.gross_weight)
            : c.gross_wt !== undefined
            ? String(c.gross_wt)
            : '',
        net_weight:
          c.net_weight !== undefined && c.net_weight !== null
            ? String(c.net_weight)
            : c.net_wt !== undefined
            ? String(c.net_wt)
            : '',
      });
    });
  } else if (!isNaN(fclCount) && fclCount > 0) {
    for (let i = 0; i < fclCount; i++) {
      list.push({
        id: `c-${i}`,
        index: i,
        container_no: '',
        seal_no: '',
        bags: '',
        gross_weight: '',
        net_weight: '',
      });
    }
  }

  return list;
}

export function PackingListDocumentForm({
  initialData,
  dataVersion,
  packingListId,
  commercialInvoiceId,
  customInvoiceId,
  shipmentInstructionId,
  proformaId,
  contractId,
  confirmationId,
  steps = [],
  selectedStep,
  onSelectStep,
  sellers = [],
  buyers = [],
  products = [],
  paymentTerms = [],
  shippingTerms = [],
  onSaveDraft,
  onSaveSuccess,
  onSubmitPackingList,
  lang = 'en',
  dict,
  readOnly = false,
}: PackingListDocumentFormProps) {
  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isInitialDataRealPacking = Boolean(
    initialData?.packing_list_id ||
      initialData?.packing_list_number ||
      initialData?.packing_list_no ||
      (initialData?.packing_list && typeof initialData.packing_list === 'object') ||
      initialData?._is_packing_list_loaded ||
      initialData?.document_type === 'packing_list' ||
      initialData?.doc_type === 'packing_list'
  );

  const hasLoadedRealPackingRef = useRef<boolean>(isInitialDataRealPacking);
  const isFormInitializedRef = useRef<boolean>(isInitialDataRealPacking);
  const lastDataVersionRef = useRef<number>(dataVersion ?? 0);
  const isSavingOrSubmittingRef = useRef<boolean>(false);
  const isDraftSavedToBackendRef = useRef<boolean>(isInitialDataRealPacking);
  const lastLoadedDocIdRef = useRef<string>(
    sanitizeDocId(
      isInitialDataRealPacking
        ? initialData?.packing_list_id ||
            initialData?.packingListId ||
            initialData?.id ||
            initialData?._id ||
            packingListId ||
            ''
        : packingListId || ''
    )
  );

  // Document Status
  const packingStepItem = getPackingListStep(steps, selectedStep);
  const [docStatus, setDocStatus] = useState<string>(() => {
    return extractPackingListDocumentStatus(initialData, packingStepItem);
  });

  // User interaction & dirty state tracking
  const [hasDraftChanges, setHasDraftChanges] = useState<boolean>(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState<boolean>(() => {
    const statusFromData = extractPackingListDocumentStatus(initialData, packingStepItem);
    return statusFromData !== 'COMPLETED';
  });

  const isUserDirtyRef = useRef<boolean>(false);
  const [, setIsDirty] = useState(false);
  const markDirty = useCallback(() => {
    isUserDirtyRef.current = true;
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Operation States & Draft ID
  const [draftId, setDraftId] = useState<string>(() => sanitizeDocId(packingListId) || '');

  useEffect(() => {
    if (packingListId) {
      const clean = sanitizeDocId(packingListId);
      if (clean && !PLACEHOLDER_ID_REGEX.test(clean)) {
        setDraftId(clean);
      }
    }
  }, [packingListId]);

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Guard against status button flicker during initial load
  const [statusLoadTimedOut, setStatusLoadTimedOut] = useState<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => setStatusLoadTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const isStatusLoading =
    !statusLoadTimedOut &&
    Boolean(
      (packingListId || draftId) &&
        !initialData &&
        !steps?.some((s) => isPackingListStep(s) && (s.status || s.document_status || s.step_status))
    );

  // Sync docStatus when steps or initialData updates
  useEffect(() => {
    const currentStep = getPackingListStep(steps, selectedStep);
    const resolvedStatus = extractPackingListDocumentStatus(initialData, currentStep);
    if (resolvedStatus) {
      setDocStatus(resolvedStatus);
    }
  }, [initialData, steps, selectedStep]);

  // Auto-scroll viewport to top whenever step or document changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedStep?.id, initialData?.id, initialData?.packing_list_id]);

  // Form Header State
  const [documentTitle, setDocumentTitle] = useState<string>(() => {
    const rawTitle = safeString(
      initialData?.packing_list?.pdf_title ||
        initialData?.packing_list?.document_title ||
        (isInitialDataRealPacking
          ? initialData?.pdf_title ||
            initialData?.pdfTitle ||
            initialData?.document_title ||
            initialData?.documentTitle ||
            initialData?.title
          : ''),
      ''
    );
    if (rawTitle && !/^(proforma|custom|commercial|sales contract|trade confirmation)/i.test(rawTitle)) {
      return rawTitle;
    }
    return 'PACKING LIST';
  });

  const [letterhead, setLetterhead] = useState<boolean>(() => {
    if (initialData?.header_enabled !== undefined) return Boolean(initialData.header_enabled);
    if (initialData?.letterhead !== undefined) return Boolean(initialData.letterhead);
    if (initialData?.letterhead_space !== undefined) return Boolean(initialData.letterhead_space);
    return false;
  });

  const [watermark, setWatermark] = useState<boolean>(() => {
    if (initialData?.is_watermark_enabled !== undefined) return Boolean(initialData.is_watermark_enabled);
    if (initialData?.watermark !== undefined) return Boolean(initialData.watermark);
    return false;
  });

  // Parties: Seller / Exporter
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
          (typeof initialData?.seller === 'string'
            ? initialData.seller
            : initialData?.seller?.id || initialData?.seller?._id),
        ''
      )
    );
  });

  // Company Logo State
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
    return rawLogo ? formatSignatureUrl(rawLogo) || rawLogo : '';
  });

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

  const [companyName, setCompanyName] = useState<string>(() => {
    const sId = safeString(
      initialData?.seller_id ||
        initialData?.sellerId ||
        initialData?.seller_instruction_id ||
        initialData?.sellerInstructionId ||
        (typeof initialData?.seller === 'string'
          ? initialData.seller
          : initialData?.seller?.id || initialData?.seller?._id),
      ''
    );
    return extractSellerCompanyName(initialData, sellers, sId);
  });

  const [sellerDetails, setSellerDetails] = useState<string>(() => {
    if (initialData?.seller_details && typeof initialData.seller_details === 'object') {
      const addr =
        initialData.seller_details.address ||
        initialData.seller_details.instruction ||
        initialData.seller_details.details;
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

  // Parties: Consignee / Buyer
  const [buyerName, setBuyerName] = useState<string>(() => extractBuyerInfo(initialData, buyers).name);
  const [buyerDetails, setBuyerDetails] = useState<string>(() => extractBuyerInfo(initialData, buyers).details);

  const consigneeDisplayText = useMemo(
    () => extractConsigneeDisplay(initialData, buyerName, buyerDetails),
    [initialData, buyerName, buyerDetails]
  );

  // Notify Parties
  const notifyParty1 = useMemo(() => extractNotifyPartyByIndex(initialData, 1), [initialData]);
  const notifyParty2 = useMemo(() => extractNotifyPartyByIndex(initialData, 2), [initialData]);
  const notifyParty3 = useMemo(() => extractNotifyPartyByIndex(initialData, 3), [initialData]);
  const notifyParty4 = useMemo(() => extractNotifyPartyByIndex(initialData, 4), [initialData]);
  const notifyParty5 = useMemo(() => extractNotifyPartyByIndex(initialData, 5), [initialData]);
  const notifyParty6 = useMemo(() => extractNotifyPartyByIndex(initialData, 6), [initialData]);
  const hasSecondRowNotify = Boolean(notifyParty4 || notifyParty5 || notifyParty6);

  // Invoice / Packing List Details: Editable Inputs (INVOICE NO & INVOICE DATE - strictly from Packing List API)
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => {
    return safeString(
      initialData?.packing_list_number ||
        initialData?.packing_list_no ||
        initialData?.packing_number ||
        initialData?.packing_no ||
        initialData?.document_number ||
        initialData?.doc_number ||
        (isInitialDataRealPacking ? initialData?.invoice_number || initialData?.invoice_no : ''),
      ''
    );
  });

  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    const raw =
      initialData?.packing_list_date ||
      initialData?.packing_date ||
      (isInitialDataRealPacking ? initialData?.invoice_date : '');
    if (raw) return safeString(raw).slice(0, 10);
    return '';
  });

  // GST Number / Registration No (Display Only)
  const [gstNumber, setGstNumber] = useState<string>(() => {
    const fromData = resolveGstString(
      initialData?.registration_number ||
        initialData?.gst_number ||
        initialData?.seller_details?.registration_number ||
        initialData?.seller_details?.gst ||
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
      const matched = sellers.find(
        (s: any) => String(s.id || s._id || s.instruction_id || s.value) === String(sId)
      );
      if (matched?.gst || matched?.registration_number || matched?.gst_number) {
        return resolveGstString(matched.gst || matched.registration_number || matched.gst_number);
      }
    }
    return '';
  });

  const [buyerOrderNoDate, setBuyerOrderNoDate] = useState<string>(() =>
    safeString(
      initialData?.buyer_order_no_date ||
        initialData?.buyer_order_no ||
        initialData?.packing_list?.buyer_order_no_date ||
        initialData?.shipment_instruction?.buyer_order_no_date ||
        initialData?.proforma?.buyer_order_no_date ||
        initialData?.contract?.buyer_order_no_date,
      ''
    )
  );

  const [purchaseOrderNo, setPurchaseOrderNo] = useState<string>(() =>
    safeString(
      initialData?.purchase_order_no ||
        initialData?.purchaseOrderNo ||
        initialData?.po_number ||
        initialData?.poNumber ||
        initialData?.contract_number ||
        initialData?.contractNumber ||
        initialData?.contract_no ||
        initialData?.confirmation_number ||
        initialData?.confirmationNumber,
      ''
    )
  );

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
      initialData?.packing_list?.other_reference ??
      initialData?.shipment_instruction?.other_reference ??
      initialData?.proforma?.other_reference ??
      initialData?.contract?.other_reference;
    return safeString(raw, '');
  });

  // 4-Column Shipping Info Row (Display Only)
  const preCarriageBy = 'BY SEA';

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

  // 3-Column Vessel Info Row (Display Only)
  const [vesselVoyageNo, setVesselVoyageNo] = useState<string>(() =>
    extractPackingVesselVoyageNo(initialData)
  );
  const [portOfLoading, setPortOfLoading] = useState<string>(() =>
    extractPortDisplayName(
      initialData?.port_of_loading || initialData?.loading_port,
      safeString(initialData?.loading_port_name, '')
    )
  );
  const [termsDeliveryPayment, setTermsDeliveryPayment] = useState<string>(() =>
    extractDeliveryTerms(initialData, paymentTerms)
  );

  useEffect(() => {
    if (paymentTerms && paymentTerms.length > 0) {
      const resolved = extractDeliveryTerms(initialData, paymentTerms);
      if (resolved && resolved !== termsDeliveryPayment) {
        setTermsDeliveryPayment(resolved);
      }
    }
  }, [paymentTerms, initialData]);

  // 2-Column Destination Ports Row (Display Only)
  const [portOfDestination, setPortOfDestination] = useState<string>(() =>
    extractPortDisplayName(
      initialData?.port_of_destination || initialData?.destination_port,
      safeString(initialData?.destination_port_name, '')
    )
  );
  const [finalDestination, setFinalDestination] = useState<string>(() =>
    extractPackingFinalDestination(initialData)
  );

  // Containers List State (Display Only from API / Upstream Steps)
  const [containers, setContainers] = useState<ContainerRowItem[]>(() =>
    buildInitialContainers(initialData)
  );

  // Compute Container Totals (Bags, Gross Wt KG, Net Wt KG)
  const containerTotals = useMemo(() => {
    let totalBags = 0;
    let totalGrossKg = 0;
    let totalNetKg = 0;
    let hasContainersWithData = false;

    for (const c of containers) {
      const b = parseFloat(String(c.bags || 0).replace(/,/g, ''));
      if (!isNaN(b) && b > 0) totalBags += b;

      const g = parseFloat(String(c.gross_weight || 0).replace(/,/g, ''));
      if (!isNaN(g) && g > 0) {
        totalGrossKg += g;
        hasContainersWithData = true;
      }

      const n = parseFloat(String(c.net_weight || 0).replace(/,/g, ''));
      if (!isNaN(n) && n > 0) {
        totalNetKg += n;
        hasContainersWithData = true;
      }
    }

    return {
      totalBags,
      totalGrossKg,
      totalNetKg,
      // MT is KG / 1000 if values entered are in KG (> 500), otherwise if entered in MT (< 500) keep as is
      totalGrossMt: totalGrossKg >= 500 ? totalGrossKg / 1000 : totalGrossKg,
      totalNetMt: totalNetKg >= 500 ? totalNetKg / 1000 : totalNetKg,
      hasContainersWithData,
    };
  }, [containers]);

  // Count / Vessel display
  const countVessel = useMemo(() => {
    if (containers.length > 0) {
      return `${containers.length} FCLs`;
    }
    if (initialData?.fcl_quantity) {
      const typeStr = initialData?.fcl_type ? ` ${safeString(initialData.fcl_type)}` : '';
      return `${safeString(initialData.fcl_quantity)}${typeStr} FCLs`;
    }
    if (initialData?.count_vessel) return safeString(initialData.count_vessel);
    return '-';
  }, [containers.length, initialData]);

  // Product Name & Marking Brand
  const productName = useMemo(() => {
    return safeString(
      initialData?.product_name ||
        initialData?.product?.name ||
        initialData?.product?.label ||
        initialData?.product?.product_name ||
        initialData?.commodity ||
        initialData?.commodity_name ||
        initialData?.product_title ||
        initialData?.contract?.product_name ||
        initialData?.contract?.commodity ||
        initialData?.confirmation?.commodity,
      ''
    );
  }, [initialData]);

  const packingTypeTitle = useMemo(() => extractPackingTypeTitle(initialData), [initialData]);

  const markingBrand = useMemo(() => {
    return safeString(
      initialData?.marking_brand ||
        initialData?.marking ||
        initialData?.brand ||
        initialData?.contract?.marking_brand ||
        initialData?.confirmation?.marking_brand,
      ''
    );
  }, [initialData]);

  // Total Bags & Weights
  const effectiveTotalBags = useMemo(() => {
    if (containerTotals.totalBags > 0) return containerTotals.totalBags;
    const raw = initialData?.total_bags || initialData?.bags || initialData?.quantity_bags;
    return raw ? parseFloat(String(raw).replace(/,/g, '')) || 0 : 0;
  }, [containerTotals.totalBags, initialData]);

  const effectiveNetWeightMt = useMemo(() => {
    if (containerTotals.totalNetMt > 0) return containerTotals.totalNetMt;
    const raw =
      initialData?.net_weight ??
      initialData?.quantity_mt ??
      initialData?.mt_quantity ??
      initialData?.quantity;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(parsed)) return parsed >= 500 ? parsed / 1000 : parsed;
    }
    return 0;
  }, [containerTotals.totalNetMt, initialData]);

  const effectiveGrossWeightMt = useMemo(() => {
    if (containerTotals.totalGrossMt > 0) return containerTotals.totalGrossMt;
    const raw = initialData?.gross_weight ?? initialData?.gross_wt;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const parsed = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(parsed)) return parsed >= 500 ? parsed / 1000 : parsed;
    }
    return 0;
  }, [containerTotals.totalGrossMt, initialData]);

  // Formatted Goods Description matching Image 2
  const formattedGoodsDescription = useMemo(() => {
    const lines: string[] = [];
    if (productName) lines.push(`PRODUCT NAME: ${productName}`);
    if (packingTypeTitle) lines.push(`PACKING TYPE: ${packingTypeTitle}`);
    if (markingBrand) lines.push(`MARKING BRAND: ${markingBrand}`);
    if (effectiveTotalBags > 0) lines.push(`TOTAL BAGS: ${effectiveTotalBags}`);
    if (effectiveGrossWeightMt > 0) lines.push(`GROSS WEIGHT: ${formatWeightWithDecimals(effectiveGrossWeightMt)}`);
    if (effectiveNetWeightMt > 0) lines.push(`NET WEIGHT: ${formatWeightWithDecimals(effectiveNetWeightMt)}`);

    if (lines.length > 0) return lines.join('\n');
    return extractGoodsDescription(initialData);
  }, [
    productName,
    packingTypeTitle,
    markingBrand,
    effectiveTotalBags,
    effectiveGrossWeightMt,
    effectiveNetWeightMt,
    initialData,
  ]);

  // Authority Signature & Stamp
  const hasUserClearedSignatureRef = useRef<boolean>(false);
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
      'AUTHORITY SIGNATURE'
    )
  );

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

  // Additional Comment Row (Title & Comment - Editable Inputs)
  const [commentLabel, setCommentLabel] = useState<string>(() =>
    safeString(
      initialData?.comment_label ||
        initialData?.commentLabel ||
        initialData?.comment_title ||
        initialData?.commentTitle,
      ''
    )
  );
  const [commentValue, setCommentValue] = useState<string>(() =>
    safeString(
      initialData?.comment_value ||
        initialData?.commentValue ||
        initialData?.comment_text ||
        initialData?.commentText,
      ''
    )
  );

  // Hydrate form state when initialData arrives or dataVersion bumps
  useEffect(() => {
    if (!initialData) return;

    const isIncomingRealPacking = Boolean(
      initialData?.packing_list_id ||
        initialData?.packing_list_number ||
        initialData?.packing_list_no ||
        (initialData?.packing_list && typeof initialData.packing_list === 'object') ||
        initialData?._is_packing_list_loaded ||
        initialData?.document_type === 'packing_list' ||
        initialData?.doc_type === 'packing_list'
    );

    const currentIncomingDocId = isIncomingRealPacking
      ? sanitizeDocId(
          initialData?.packing_list_id ||
            initialData?.packingListId ||
            initialData?.id ||
            initialData?._id
        )
      : '';

    const hasDocChanged = Boolean(
      currentIncomingDocId &&
        lastLoadedDocIdRef.current &&
        currentIncomingDocId !== lastLoadedDocIdRef.current
    );

    const needsUpgrade = isIncomingRealPacking && !hasLoadedRealPackingRef.current;
    const isDataVersionTriggered = Boolean(
      dataVersion !== undefined && dataVersion !== lastDataVersionRef.current
    );

    if (needsUpgrade || hasDocChanged || isDataVersionTriggered) {
      isUserDirtyRef.current = false;
      isSavingOrSubmittingRef.current = false;
      if (isIncomingRealPacking) hasLoadedRealPackingRef.current = true;
      if (dataVersion !== undefined) lastDataVersionRef.current = dataVersion;
    }

    if (
      !isDataVersionTriggered &&
      !hasDocChanged &&
      (isUserDirtyRef.current ||
        isSavingOrSubmittingRef.current ||
        (isFormInitializedRef.current && hasDraftChanges))
    ) {
      return;
    }

    if (isIncomingRealPacking && currentIncomingDocId) {
      hasLoadedRealPackingRef.current = true;
      setDraftId(currentIncomingDocId);
    } else if (!isIncomingRealPacking) {
      setDraftId('');
    }
    isFormInitializedRef.current = true;
    lastLoadedDocIdRef.current =
      currentIncomingDocId || sanitizeDocId(draftId || packingListId) || '';

    // Toggles
    if (initialData.header_enabled !== undefined) {
      setLetterhead(Boolean(initialData.header_enabled));
    } else if (initialData.letterhead !== undefined) {
      setLetterhead(Boolean(initialData.letterhead));
    }

    if (initialData.is_watermark_enabled !== undefined) {
      setWatermark(Boolean(initialData.is_watermark_enabled));
    } else if (initialData.watermark !== undefined) {
      setWatermark(Boolean(initialData.watermark));
    }

    // Invoice / Packing List No & Date strictly from Packing List API
    if (initialData.packing_list_number || initialData.packing_list_no) {
      setInvoiceNumber(safeString(initialData.packing_list_number || initialData.packing_list_no));
    } else if (isIncomingRealPacking && (initialData.invoice_number || initialData.invoice_no)) {
      setInvoiceNumber(safeString(initialData.invoice_number || initialData.invoice_no));
    }
    if (initialData.packing_list_date) {
      setInvoiceDate(safeString(initialData.packing_list_date).slice(0, 10));
    } else if (isIncomingRealPacking && initialData.invoice_date) {
      setInvoiceDate(safeString(initialData.invoice_date).slice(0, 10));
    }

    // Containers
    setContainers(buildInitialContainers(initialData));

    // Signature & Logo sync from incoming data
    const resolvedSig = resolveSignatureValue(initialData, sellers, sellerId);
    if (resolvedSig && !hasUserClearedSignatureRef.current) {
      const formatted = formatSignatureUrl(resolvedSig);
      setStampImageUrl((prev) => (prev && prev.startsWith('data:') ? prev : formatted));
    }

    const initialLabel =
      initialData?.seller_signature_label ||
      initialData?.authority_signature_title ||
      initialData?.authorised_signature_title ||
      initialData?.authority_title;
    if (initialLabel) setAuthoritySignatureTitle(safeString(initialLabel));

    if (!hasUserClearedLogoRef.current) {
      const resolvedInitLogo = resolveSellerLogoValue(initialData, sellers, sellerId);
      if (resolvedInitLogo) {
        setCompanyLogoUrl(formatSignatureUrl(resolvedInitLogo) || resolvedInitLogo);
      }
    }

    // Comments
    if (initialData.comment_label || initialData.comment_title) {
      setCommentLabel(safeString(initialData.comment_label || initialData.comment_title));
    }
    if (initialData.comment_value || initialData.comment_text) {
      setCommentValue(safeString(initialData.comment_value || initialData.comment_text));
    }
  }, [initialData, dataVersion, sellers, sellerId]);

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
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleRemoveLogo = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    hasUserClearedLogoRef.current = true;
    setLogoFile(null);
    setCompanyLogoUrl('');
    if (logoInputRef.current) logoInputRef.current.value = '';
    markDirty();
    toast.info('Company logo removed');
  };

  const getOwnPackingListId = useCallback(() => {
    const parentIds = new Set(
      [commercialInvoiceId, customInvoiceId, shipmentInstructionId, proformaId, contractId, confirmationId]
        .map((x) => sanitizeDocId(x))
        .filter(Boolean)
    );

    const isValidOwnId = (val?: string | null) => {
      const clean = sanitizeDocId(val);
      return Boolean(clean && !parentIds.has(clean) && !PLACEHOLDER_ID_REGEX.test(clean));
    };

    if (isValidOwnId(draftId)) return sanitizeDocId(draftId);
    if (isValidOwnId(packingListId)) return sanitizeDocId(packingListId);

    const stepItem = getPackingListStep(steps, selectedStep);
    if (stepItem) {
      const stepId = sanitizeDocId(
        getStepSelfId(stepItem) ||
          extractStepRedirectId(stepItem) ||
          stepItem.redirect_id ||
          (stepItem as any).redirectId ||
          (stepItem as any).packing_list_id ||
          (stepItem as any).packingListId
      );
      if (isValidOwnId(stepId)) return stepId;
    }

    const explicitId = sanitizeDocId(
      initialData?.packing_list_id ||
        initialData?.packingListId ||
        initialData?.packing_list?.id ||
        initialData?.packing_list?._id
    );
    if (isValidOwnId(explicitId)) return explicitId;

    if (isInitialDataRealPacking) {
      const dataId = sanitizeDocId(initialData?.id || initialData?._id);
      if (isValidOwnId(dataId)) return dataId;
    }

    return '';
  }, [
    draftId,
    packingListId,
    steps,
    selectedStep,
    initialData,
    isInitialDataRealPacking,
    commercialInvoiceId,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
  ]);

  const getEffectivePackingListId = useCallback(() => {
    const ownId = getOwnPackingListId();
    if (ownId) return ownId;

    // Fallback workflow anchor IDs for preview/download/save if backend resolves by parent/deal ID
    for (const fallbackId of [
      commercialInvoiceId,
      customInvoiceId,
      shipmentInstructionId,
      proformaId,
      contractId,
      confirmationId,
    ]) {
      const clean = sanitizeDocId(fallbackId);
      if (clean && !PLACEHOLDER_ID_REGEX.test(clean)) return clean;
    }

    return '';
  }, [
    getOwnPackingListId,
    commercialInvoiceId,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
  ]);

  // Build FormData Payload
  const getPackingListFormData = useCallback(() => {
    const fd = new FormData();
    const ownId = getOwnPackingListId();

    if (ownId) {
      fd.append('packing_list_id', ownId);
      fd.append('id', ownId);
    }
    if (commercialInvoiceId) fd.append('commercial_invoice_id', commercialInvoiceId);
    if (customInvoiceId) fd.append('custom_invoice_id', customInvoiceId);
    if (shipmentInstructionId) fd.append('shipment_instruction_id', shipmentInstructionId);
    if (proformaId) fd.append('proforma_id', proformaId);
    if (contractId) fd.append('contract_id', contractId);
    if (confirmationId) fd.append('confirmation_id', confirmationId);

    fd.append('pdf_title', documentTitle.trim() || 'PACKING LIST');
    fd.append('document_title', documentTitle.trim() || 'PACKING LIST');
    fd.append('header_enabled', String(letterhead));
    fd.append('letterhead', String(letterhead));
    fd.append('is_watermark_enabled', String(watermark));
    fd.append('watermark_enabled', String(watermark));
    fd.append('watermark', String(watermark));

    if (invoiceNumber.trim()) {
      fd.append('packing_list_number', invoiceNumber.trim());
      fd.append('invoice_number', invoiceNumber.trim());
    }
    if (invoiceDate.trim()) {
      fd.append('packing_list_date', invoiceDate.trim());
      fd.append('invoice_date', invoiceDate.trim());
    }

    if (sellerInstructionId) fd.append('seller_instruction_id', sellerInstructionId);
    if (sellerId) fd.append('seller_id', sellerId);

    // Weights & Bags
    fd.append('total_bags', String(effectiveTotalBags));
    fd.append('gross_weight', formatWeightWithDecimals(effectiveGrossWeightMt));
    fd.append('net_weight', formatWeightWithDecimals(effectiveNetWeightMt));

    // Containers Array JSON
    const cleanContainers = containers.map((c, idx) => ({
      index: idx,
      container_number: String(c.container_no || '').trim(),
      container_no: String(c.container_no || '').trim(),
      seal_number: String(c.seal_no || '').trim(),
      seal_no: String(c.seal_no || '').trim(),
      bags: Number(String(c.bags || 0).replace(/,/g, '')) || 0,
      gross_weight: parseFloat(String(c.gross_weight || 0).replace(/,/g, '')) || 0,
      net_weight: parseFloat(String(c.net_weight || 0).replace(/,/g, '')) || 0,
    }));
    fd.append('containers', JSON.stringify(cleanContainers));

    // Seller Logo
    if (logoFile) {
      fd.append('seller_logo', logoFile);
      fd.append('remove_seller_logo', 'false');
    } else if (hasUserClearedLogoRef.current) {
      fd.append('remove_seller_logo', 'true');
    }

    // Signature & Authority Label
    const cleanAuthTitle = safeString(authoritySignatureTitle).trim() || 'AUTHORITY SIGNATURE';
    fd.append('seller_signature_label', cleanAuthTitle);
    fd.append('authority_signature_title', cleanAuthTitle);
    fd.append('authorised_signature_title', cleanAuthTitle);
    fd.append('seller_signature_field', safeString(companyName, 'SELLER / EXPORTER'));

    if (stampImageUrl && !hasUserClearedSignatureRef.current) {
      if (stampImageUrl.startsWith('data:') || stampImageUrl.startsWith('blob:')) {
        const sigFile = dataUrlToFile(stampImageUrl, 'seller_signature.png');
        if (sigFile) {
          fd.append('seller_signature', sigFile);
          fd.append('signature', sigFile);
        }
      } else {
        const relUrl = normalizeSignaturePayload(stampImageUrl) || stampImageUrl;
        if (relUrl) {
          fd.append('seller_signature_url', relUrl);
          fd.append('seller_signature', relUrl);
          fd.append('signature', relUrl);
        }
      }
      fd.append('remove_seller_signature', 'false');
    } else {
      fd.append('remove_seller_signature', 'true');
      fd.append('remove_exporter_signature', 'true');
      fd.append('seller_signature', '');
      fd.append('seller_signature_url', '');
    }

    if (commentLabel.trim() || commentValue.trim()) {
      fd.append('comment_label', commentLabel.trim());
      fd.append('comment_value', commentValue.trim());
    }

    return fd;
  }, [
    getOwnPackingListId,
    commercialInvoiceId,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
    documentTitle,
    letterhead,
    watermark,
    invoiceNumber,
    invoiceDate,
    sellerInstructionId,
    sellerId,
    effectiveTotalBags,
    effectiveGrossWeightMt,
    effectiveNetWeightMt,
    containers,
    logoFile,
    companyName,
    stampImageUrl,
    authoritySignatureTitle,
    commentLabel,
    commentValue,
  ]);

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({});

    try {
      const payload = getPackingListFormData();
      const currentId = getOwnPackingListId() || getEffectivePackingListId();

      let res: any;
      if (onSaveDraft) {
        res = await onSaveDraft(payload);
      } else {
        res = await savePackingListDraftAction(payload, lang, currentId || undefined);
      }

      if (res?.success) {
        const savedId = String(
          res.id || res.data?.id || res.data?._id || res.data?.packing_list_id || currentId || ''
        );
        if (savedId) {
          lastLoadedDocIdRef.current = savedId;
          setDraftId(savedId);
        }
        isFormInitializedRef.current = true;
        isUserDirtyRef.current = false;
        isDraftSavedToBackendRef.current = true;
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(true);
        setErrors({});

        // Synchronize fresh signature URL from backend response
        const sSellerSig =
          res?.data?.seller_signature ||
          res?.data?.seller_signature_url ||
          res?.data?.signature ||
          res?.data?.stamp_image_url ||
          res?.seller_signature;
        if (hasUserClearedSignatureRef.current || !stampImageUrl) {
          setStampImageUrl('');
        } else if (sSellerSig) {
          setStampImageUrl(formatSignatureUrl(sSellerSig));
        }

        toast.success(res?.message || 'Packing List draft saved successfully!');

        if (savedId && onSaveSuccess) {
          const extracted =
            extractPackingListData(res?.data) ||
            (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
          onSaveSuccess(savedId, {
            ...extracted,
            id: savedId,
            packing_list_id: savedId,
          });
        }
        return res;
      } else {
        const { fieldErrors, generalError } = parseProformaBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusProformaField(fieldErrors);
        }
        toast.error(generalError || res?.message || 'Failed to save packing list draft.');
      }
    } catch (err: any) {
      console.error('[PackingListDocumentForm] Save draft error:', err);
      const { fieldErrors, generalError } = parseProformaBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusProformaField(fieldErrors);
      }
      toast.error(generalError || err?.message || 'Error occurred while saving draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Handle Submit
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft || readOnly) return;

    const submitTargetInfo = getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'packing_list',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;
    const targetNextStepName = submitTargetInfo.nextStepName;

    setIsSubmitting(true);
    isSavingOrSubmittingRef.current = true;
    setErrors({});

    try {
      const payload = getPackingListFormData();
      const currentId = getOwnPackingListId() || getEffectivePackingListId();

      let res: any;
      if (onSubmitPackingList) {
        res = await onSubmitPackingList(payload, currentId || undefined, targetNextStep);
      } else {
        res = await submitPackingListAction(payload, lang, currentId || undefined);
      }

      if (res?.success) {
        const savedId = String(
          res.id || res.data?.id || res.data?._id || res.data?.packing_list_id || currentId || ''
        );
        if (savedId) {
          lastLoadedDocIdRef.current = savedId;
          setDraftId(savedId);
        }
        isFormInitializedRef.current = true;
        isUserDirtyRef.current = false;
        isDraftSavedToBackendRef.current = true;
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(false);
        setDocStatus('COMPLETED');
        setErrors({});

        // Synchronize fresh signature URL from backend response
        const sSellerSig =
          res?.data?.seller_signature ||
          res?.data?.seller_signature_url ||
          res?.data?.signature ||
          res?.data?.stamp_image_url ||
          res?.seller_signature;
        if (hasUserClearedSignatureRef.current || !stampImageUrl) {
          setStampImageUrl('');
        } else if (sSellerSig) {
          setStampImageUrl(formatSignatureUrl(sSellerSig));
        }

        const successToast = getWorkflowSubmitToastMessage({
          currentDocName: 'Packing List',
          nextStepName: targetNextStepName,
        });
        toast.success(successToast);

        if (targetNextStep && onSelectStep && !onSubmitPackingList) {
          onSelectStep(targetNextStep);
        }
        if (savedId && onSaveSuccess) {
          const extracted =
            extractPackingListData(res?.data) ||
            (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
          onSaveSuccess(savedId, {
            ...extracted,
            id: savedId,
            packing_list_id: savedId,
          });
        }
        return res;
      } else {
        const { fieldErrors, generalError } = parseProformaBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusProformaField(fieldErrors);
        }
        toast.error(generalError || res?.message || 'Failed to submit packing list.');
      }
    } catch (err: any) {
      console.error('[PackingListDocumentForm] Submit error:', err);
      const { fieldErrors, generalError } = parseProformaBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusProformaField(fieldErrors);
      }
      toast.error(generalError || err?.message || 'Error occurred while submitting packing list.');
    } finally {
      isSavingOrSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Handle Print Preview
  const handleOpenPrintPreview = async () => {
    let effectiveId = getEffectivePackingListId();

    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getPackingListFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await savePackingListDraftAction(
            formDataPayload,
            lang,
            getOwnPackingListId() || effectiveId || undefined
          );
        }
        if (res?.success) {
          const newId = String(
            res.id || res.data?.id || res.data?._id || res.data?.packing_list_id || ''
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
        console.error('[PackingListDocumentForm] Auto-save before preview failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectivePackingListId();

    if (!effectiveId) {
      toast.error('Please save the draft first to preview the document.');
      return;
    }

    setPreviewDocId(effectiveId);
    setIsPrintPreviewOpen(true);
  };

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    let effectiveId = getEffectivePackingListId();

    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getPackingListFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await savePackingListDraftAction(
            formDataPayload,
            lang,
            getOwnPackingListId() || effectiveId || undefined
          );
        }
        if (res?.success) {
          const newId = String(
            res.id || res.data?.id || res.data?._id || res.data?.packing_list_id || ''
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
        console.error('[PackingListDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectivePackingListId();

    if (!effectiveId) {
      toast.error('Please save as draft first before downloading PDF.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const ownId = getOwnPackingListId();
      const res = await downloadDocPdfAction({
        prefix: 'packing_list',
        id: ownId || effectiveId,
        packingListId: ownId || effectiveId,
        candidateIds: [
          ownId,
          effectiveId,
          draftId,
          packingListId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x)),
        commercialInvoiceId,
        customInvoiceId,
        shipmentInstructionId,
        proformaId,
        contractId,
        confirmationId,
        lang,
      });

      if (res?.success) {
        const numCandidate =
          invoiceNumber ||
          purchaseOrderNo ||
          initialData?.packing_list_number ||
          effectiveId;

        const cleanNumber = String(numCandidate)
          .replace(/^#+/, '')
          .replace(/[/\\?%*:|"<>]/g, '-')
          .replace(/-+/g, '-')
          .trim();

        const downloadName = `PACKING-LIST-${cleanNumber || 'DOCUMENT'}.pdf`;

        const downloaded = downloadPdfFromActionResponse(res, downloadName);
        if (downloaded) {
          toast.success('Packing List PDF downloaded!');
        } else {
          toast.error(res?.message || 'No PDF data received from server');
        }
      } else {
        toast.error(res?.message || res?.error || 'Failed to download PDF');
      }
    } catch (err: any) {
      console.error('[PackingListDocumentForm] Download PDF error:', err);
      toast.error(err?.message || 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const deliveryTermsDisplay = safeString(termsDeliveryPayment, '');
  const displayGstValue = formatGstDisplayValue(gstNumber);

  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'packing_list',
      isSubmitting,
      submittingText: dict?.smart_docs?.submitting || 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  return (
    <div
      id="packing-list-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollContainerRef}
        id="packing-list-scroll-viewport"
        className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar"
      >
        {/*
          TOP HEADER BAR (Image 1):
          - Left: Round Company Logo with Edit & Remove
          - Center: Seller Name + Editable PACKING LIST Title
          - Right: Header toggle on top, WaterMark toggle underneath
        */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 bg-card">
          {/* Left: Round Company Logo */}
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
                      if (
                        companyLogoUrl &&
                        target.src !== companyLogoUrl &&
                        !companyLogoUrl.startsWith('blob:')
                      ) {
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

          {/* Center: Seller Name & Editable PACKING LIST Title */}
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
                }));
              }
            }}
            companyName={companyName}
            disabled={readOnly}
            placeholder="PACKING LIST"
            ariaLabel="Document Title"
            error={errors.documentTitle || errors.document_title || errors.pdf_title}
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Desktop Right: Header & WaterMark */}
          <div className="hidden sm:flex flex-col items-end justify-center gap-1.5 shrink-0 min-w-[120px] sm:w-[140px]">
            <DocToggle
              label="Header"
              checked={letterhead}
              onChange={(val) => {
                markDirty();
                setLetterhead(val);
              }}
              disabled={readOnly}
            />
            <DocToggle
              label="WaterMark"
              checked={watermark}
              onChange={(val) => {
                markDirty();
                setWatermark(val);
              }}
              disabled={readOnly}
            />
          </div>

          {/* Mobile Right: Header & WaterMark */}
          <div className="flex sm:hidden flex-col items-end gap-1.5 shrink-0">
            <DocToggle
              label="Header"
              checked={letterhead}
              onChange={(val) => {
                markDirty();
                setLetterhead(val);
              }}
              disabled={readOnly}
            />
            <DocToggle
              label="WaterMark"
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
          Matches Image 1 & 2
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          {/*
            ROW 1 & 2:
            Left Side (37%): EXPORTER / SELLER (Top) & CONSIGNEE / BUYER (Bottom)
            Right Side (63%): Invoice No & Date (Editable) + GST NUMBER, Order No, PO No, Contract Date, Other Ref
          */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
            {/* LEFT COLUMN (37%) */}
            <div className="w-full md:w-[37%] shrink-0 flex flex-col divide-y divide-border">
              {/* EXPORTER / SELLER (Display Only) */}
              <div
                className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-[140px] justify-start bg-card"
                id="field-sellerId"
                data-field="sellerId"
              >
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                  EXPORTER / SELLER:
                </label>
                <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed select-all">
                  {formatPartyDetails(companyName, sellerDetails) || '-'}
                </div>
              </div>

              {/* CONSIGNEE / BUYER (Display Only) */}
              <div
                className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-[140px] justify-start bg-card"
                id="field-buyerId"
                data-field="buyerId"
              >
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                  CONSIGNEE / BUYER:
                </label>
                <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed select-all">
                  {consigneeDisplayText || '-'}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (63%) */}
            <div className="w-full md:w-[63%] min-w-0 flex-1 flex flex-col divide-y divide-border bg-card">
              {/* Row 1 & 2: INVOICE NO & INVOICE DATE + GST NUMBER */}
              <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {/* Left Sub-Column: INVOICE NO & INVOICE DATE (Display Only - Image 1) */}
                <div className="sm:col-span-7 flex flex-col divide-y divide-border">
                  {/* INVOICE NO (Display Only) */}
                  <div
                    className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[42px]"
                    id="field-invoiceNumber"
                    data-field="invoiceNumber"
                  >
                    <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                      INVOICE NO:
                    </span>
                    <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                      <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                        {safeString(invoiceNumber, '') || '-'}
                      </span>
                    </div>
                  </div>

                  {/* INVOICE DATE (Display Only) */}
                  <div
                    className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[42px]"
                    id="field-invoiceDate"
                    data-field="invoiceDate"
                  >
                    <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                      INVOICE DATE:
                    </span>
                    <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                      <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                        {formatDisplayDate(invoiceDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Sub-Column: GST NUMBER (Display Only - Image 1) */}
                <div
                  className="sm:col-span-5 p-2 sm:p-2.5 flex flex-col items-start justify-start gap-1 min-h-[84px] min-w-0 overflow-hidden"
                  id="field-gstNumber"
                  data-field="gstNumber"
                >
                  <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5 leading-tight">
                    GST NUMBER:
                  </span>
                  <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line break-words leading-relaxed px-0.5 select-all">
                    {displayGstValue || '-'}
                  </div>
                </div>
              </div>

              {/* Row 3: BUYER'S ORDER NO & DATE (Display Only) */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-buyerOrderNoDate"
                data-field="buyerOrderNoDate"
              >
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  BUYER&apos;S ORDER NO &amp; DATE:
                </span>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(buyerOrderNoDate, '') || '-'}
                  </span>
                </div>
              </div>

              {/* Row 4: PURCHASE ORDER NO (Display Only) */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-purchaseOrderNo"
                data-field="purchaseOrderNo"
              >
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  PURCHASE ORDER NO:
                </span>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(purchaseOrderNo, '') || '-'}
                  </span>
                </div>
              </div>

              {/* Row 5: CONTRACT DATE (Display Only) */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-contractDate"
                data-field="contractDate"
              >
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  CONTRACT DATE:
                </span>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {formatDisplayDate(contractDate)}
                  </span>
                </div>
              </div>

              {/* Row 6: OTHER REFERENCE (S) (Display Only) */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-other_reference"
                data-field="other_reference"
              >
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  OTHER REFERENCE (S):
                </span>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(otherReferences, '') || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 3: NOTIFY PARTIES (1-3, and 4-6 when present - Image 1)
          */}
          <div className="flex flex-col divide-y divide-border">
            {/* Notify Parties 1 - 3 Headers */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              <div className="p-2 sm:p-2.5 text-left font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
                NOTIFY PARTY 1
              </div>
              <div className="p-2 sm:p-2.5 text-left font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
                NOTIFY PARTY 2
              </div>
              <div className="p-2 sm:p-2.5 text-left font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
                NOTIFY PARTY 3
              </div>
            </div>

            {/* Notify Parties 1 - 3 Values */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
              <div className="p-2.5 sm:p-3 min-h-[72px] flex flex-col justify-start text-left">
                <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty1 || '-'}
                </div>
              </div>
              <div className="p-2.5 sm:p-3 min-h-[72px] flex flex-col justify-start text-left">
                <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty2 || '-'}
                </div>
              </div>
              <div className="p-2.5 sm:p-3 min-h-[72px] flex flex-col justify-start text-left">
                <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty3 || '-'}
                </div>
              </div>
            </div>

            {/* Notify Parties 4 - 6 (Rendered dynamically when present) */}
            {hasSecondRowNotify && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
                  <div className="p-2 sm:p-2.5 text-left font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
                    NOTIFY PARTY 4
                  </div>
                  <div className="p-2 sm:p-2.5 text-left font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
                    NOTIFY PARTY 5
                  </div>
                  <div className="p-2 sm:p-2.5 text-left font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
                    NOTIFY PARTY 6
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
                  <div className="p-2.5 sm:p-3 min-h-[56px] flex flex-col justify-start text-left">
                    <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {notifyParty4 || '-'}
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 min-h-[56px] flex flex-col justify-start text-left">
                    <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {notifyParty5 || '-'}
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 min-h-[56px] flex flex-col justify-start text-left">
                    <div className="text-[14px] font-semibold text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {notifyParty6 || '-'}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/*
            ROW 4: 4-COLUMN SHIPPING & ORIGIN ROW (Image 2)
          */}
          <div className="flex flex-col divide-y divide-border">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              <div className="w-full md:w-[37%] shrink-0 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  PRE-CARRIAGE BY
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  PLACE OF RECEIPT
                  <br className="hidden sm:inline" /> BY PRE-CARRIER
                </div>
              </div>

              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  COUNTRY OF ORIGIN
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  COUNTRY OF DESTINATION
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="w-full md:w-[37%] shrink-0 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {preCarriageBy}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(placeOfReceipt || countryOfOrigin, '') || '-'}
                  </span>
                </div>
              </div>

              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(countryOfOrigin || placeOfReceipt, '') || '-'}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(countryOfDestination, '') || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 5: 3-COLUMN VESSEL & LOADING ROW (Image 2)
          */}
          <div className="flex flex-col divide-y divide-border">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              <div className="w-full md:w-[37%] shrink-0 p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                VESSEL / VOYAGE NO.
              </div>

              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  PORT OF LOADING
                </div>
                <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight flex items-center justify-center min-h-[38px]">
                  TERMS OF DELIVERY &amp; PAYMENT
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="w-full md:w-[37%] shrink-0 p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                  {safeString(vesselVoyageNo, '') || 'AS PER BL'}
                </span>
              </div>

              <div className="w-full md:w-[63%] min-w-0 flex-1 grid grid-cols-2 divide-x divide-border">
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {safeString(portOfLoading, '') || '-'}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                    {deliveryTermsDisplay || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 6: 2-COLUMN DESTINATION PORTS ROW (Image 2)
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
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase whitespace-pre-line leading-relaxed">
                  {safeString(portOfDestination, '') || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 text-center min-h-[44px] flex items-center justify-center">
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase whitespace-pre-line leading-relaxed">
                  {safeString(finalDestination, '') || '-'}
                </span>
              </div>
            </div>
          </div>

          {/*
            ROW 7: GOODS & SERVICES TABLE (Image 2)
            Columns:
            1. COUNT/VESSEL (15%)
            2. DESCRIPTIONS OF GOODS AND/SERVICES (45%)
            3. QUANTITY NET WT (20%)
            4. REMARKS GROSS WT (20%)
          */}
          <div className="w-full border-b border-border overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed text-left min-w-[700px]">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '45%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  <th className="py-2.5 px-3 border-r border-border text-center">
                    COUNT/VESSEL
                  </th>
                  <th className="py-2.5 px-3 border-r border-border text-left">
                    DESCRIPTIONS OF GOODS AND/SERVICES
                  </th>
                  <th className="py-2.5 px-3 border-r border-border text-center">
                    QUANTITY NET WT
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    REMARKS GROSS WT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Main Goods Row */}
                <tr className="divide-x divide-border">
                  {/* COUNT / VESSEL */}
                  <td className="py-3 px-3 align-top text-center">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all uppercase">
                      {countVessel}
                    </span>
                  </td>

                  {/* DESCRIPTIONS OF GOODS AND/SERVICES */}
                  <td className="py-3 px-3 align-top text-left pb-4">
                    <div className="font-semibold text-[14px] text-foreground uppercase leading-relaxed whitespace-pre-line select-all pb-3">
                      {formattedGoodsDescription}
                    </div>
                    {/* Contract clause border badge (Image 2) */}
                    <div className="pt-2">
                      <div className="inline-block border border-border px-2.5 py-0.5 rounded-xs font-semibold text-[13px] sm:text-[14px] text-foreground/90 tracking-wide select-all uppercase">
                        [5% MORE OR LESS AT CONTRACT QUANTITY]
                      </div>
                    </div>
                  </td>

                  {/* QUANTITY NET WT */}
                  <td className="py-3 px-3 align-top text-center">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {formatWeightWithDecimals(effectiveNetWeightMt)}
                    </span>
                  </td>

                  {/* REMARKS GROSS WT */}
                  <td className="py-3 px-3 align-top text-center">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {formatWeightWithDecimals(effectiveGrossWeightMt)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/*
            ROW 8: CONTAINER DETAILS TABLE (Left 60%) & SELLER SIGNATURE (Right 40%) - Image 2 & 3
          */}
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border bg-card">
            {/* Left Column (60%): Container Table (Display Only matching Screenshot 2 & 3) */}
            <div className="w-full lg:w-[60%] flex flex-col justify-start bg-card overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse text-left min-w-[550px] border-b border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[12px] sm:text-[13px] tracking-wider divide-x divide-border">
                    <th className="py-2.5 px-2 text-center w-12 shrink-0">SR NO</th>
                    <th className="py-2.5 px-2.5 text-center">CONTAINER NO</th>
                    <th className="py-2.5 px-2.5 text-center">SEAL NO</th>
                    <th className="py-2.5 px-2.5 text-center w-20">BAGS</th>
                    <th className="py-2.5 px-2.5 text-center w-28">GROSS WT (KG)</th>
                    <th className="py-2.5 px-2.5 text-center w-28">NET WT (KG)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border border-b border-border">
                  {containers.length > 0 ? (
                    containers.map((c, idx) => (
                      <tr
                        key={c.id || `cont-${idx}`}
                        className="divide-x divide-border border-b border-border hover:bg-muted/10 transition-colors"
                      >
                        {/* SR NO */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[14px] text-foreground border-b border-border">
                          {idx + 1}
                        </td>

                        {/* CONTAINER NO */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[14px] text-foreground uppercase tracking-wide select-all border-b border-border">
                          {safeString(c.container_no) || '-'}
                        </td>

                        {/* SEAL NO */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[14px] text-foreground uppercase tracking-wide select-all border-b border-border">
                          {safeString(c.seal_no) || '-'}
                        </td>

                        {/* BAGS */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[14px] text-foreground tabular-nums select-all border-b border-border">
                          {formatContainerBags(c.bags)}
                        </td>

                        {/* GROSS WT (KG) */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[14px] text-foreground tabular-nums select-all border-b border-border">
                          {formatContainerWeightKg(c.gross_weight)}
                        </td>

                        {/* NET WT (KG) */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[14px] text-foreground tabular-nums select-all border-b border-border">
                          {formatContainerWeightKg(c.net_weight)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="divide-x divide-border border-b border-border">
                      <td className="py-2.5 px-2 text-center font-medium text-[13px] text-muted-foreground border-b border-border">-</td>
                      <td className="py-2.5 px-2 text-center font-medium text-[13px] text-muted-foreground border-b border-border">-</td>
                      <td className="py-2.5 px-2 text-center font-medium text-[13px] text-muted-foreground border-b border-border">-</td>
                      <td className="py-2.5 px-2 text-center font-medium text-[13px] text-muted-foreground border-b border-border">-</td>
                      <td className="py-2.5 px-2 text-center font-medium text-[13px] text-muted-foreground border-b border-border">-</td>
                      <td className="py-2.5 px-2 text-center font-medium text-[13px] text-muted-foreground border-b border-border">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Right Column (40%): Company Name + Seller Stamp & Signature Box (Image 3) */}
            <div
              className="w-full lg:w-[40%] p-2.5 sm:p-3 flex flex-col justify-start bg-card"
              id="field-seller_signature"
              data-field="seller_signature"
            >
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
                    hasUserClearedSignatureRef.current = !url;
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
                      authorised_signature_title: '',
                    }));
                  }}
                  titlePlaceholder="SELLER / EXPORTER"
                  authorityPlaceholder="AUTHORITY SIGNATURE"
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
                    errors.authority_signature_title ||
                    errors.authorised_signature_title
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
            ROW 9: COMMENTS (Enter Title 1/3 & Enter Comment 2/3 - Standard across all forms)
          */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border"
            data-field="commentSection"
          >
            <div
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              data-field="commentLabel"
              id="field-commentLabel"
            >
              <DocUnderlineInput
                id="packing-commentLabel-input"
                value={commentLabel}
                onChange={(val) => {
                  markDirty();
                  setCommentLabel(val);
                  setErrors((prev) => ({
                    ...prev,
                    commentLabel: '',
                    comment_label: '',
                    comment_title: '',
                  }));
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
              className="sm:col-span-2 py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              data-field="commentValue"
              id="field-commentValue"
            >
              <DocUnderlineInput
                id="packing-commentValue-input"
                value={commentValue}
                onChange={(val) => {
                  markDirty();
                  setCommentValue(val);
                  setErrors((prev) => ({
                    ...prev,
                    commentValue: '',
                    comment_value: '',
                    comment_text: '',
                  }));
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
        BOTTOM ACTION BAR (Print Preview, Download PDF, Save As Draft, Submit)
      */}
      <div
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Print Preview & Download PDF */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={handleOpenPrintPreview}
            title="Print Preview"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>Print Preview</span>
          </button>

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
                {isSavingDraft ? 'Saving...' : 'Save As Draft'}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={
              isSubmitting ||
              isSavingDraft ||
              readOnly ||
              (docStatus === 'COMPLETED' && !hasSubmitChanges)
            }
            onClick={handleSubmit}
            title={
              docStatus === 'COMPLETED' && !hasSubmitChanges
                ? 'Packing List already submitted'
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
        prefix="packing_list"
        docId={previewDocId || getOwnPackingListId() || getEffectivePackingListId()}
        candidateIds={[
          previewDocId,
          getOwnPackingListId(),
          getEffectivePackingListId(),
          draftId,
          packingListId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        packingListId={getOwnPackingListId() || getEffectivePackingListId()}
        commercialInvoiceId={commercialInvoiceId}
        customInvoiceId={customInvoiceId}
        shipmentInstructionId={shipmentInstructionId}
        proformaId={proformaId}
        contractId={contractId}
        confirmationId={confirmationId}
        docNumber={safeString(invoiceNumber || purchaseOrderNo, '')}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default PackingListDocumentForm;
