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
  extractBankChargesNote,
  resolveSignatureValue,
  resolveSellerLogoValue,
  scrollToAndFocusProformaField,
  parseProformaBackendErrors,
  type FormOptionItem,
} from './ProformaDocumentForm';
import {
  downloadDocPdfAction,
  getSellerBankDetailsAction,
  saveCommercialInvoiceDraftAction,
  submitCommercialInvoiceAction,
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
  extractCommercialInvoiceData,
  getCommercialInvoiceStep,
  extractDocumentStatus,
  extractCommercialInvoiceDocumentStatus,
  extractStepId,
  getStepSelfId,
  extractStepRedirectId,
  isCommercialInvoiceStep,
  getWorkflowSubmitButtonInfo,
  getWorkflowSubmitToastMessage,
} from '@/lib/api/smart-docs.service';

export interface CommercialInvoiceDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
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
  onSubmitCommercialInvoice?: (
    payload: any,
    id?: string,
    nextStep?: StepperDocumentItem | null
  ) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

const DEFAULT_BANK_CHARGES_NOTE =
  'PLEASE DO NOT DEDUCT BANK CHARGES FROM THE TOTAL AMOUNT OF THE PAYMENT INSTRUCTIONS. DETAILS OF CHARGES SHOULD BE MENTIONED AS "OUR"';

// In-memory module cache for seller bank accounts to ensure instantaneous switches
const sellerBankAccountsCache = new Map<string, any[]>();

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
 * Extracts Consignee / Buyer display text, prioritizing consignee_details from Shipment / Invoice payloads
 * and falling back to buyer details cleanly.
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
    data?.commercial_invoice?.consignee_details,
    data?.custom_invoice?.consignee_details,
    data?.shipment_instruction?.consignee_details,
    data?.shipment?.consignee_details,
  ];

  for (const cand of candidates) {
    const formatted = formatStructuredParty(cand);
    if (formatted) return formatted;
  }

  return formatPartyDetails(buyerName, buyerDetails);
}

/**
 * Extracts Notify Party 1..6 from initialData (array, JSON string, or indexed keys).
 */
function extractNotifyPartyByIndex(data: any, index1Based: number): string {
  if (!data || typeof data !== 'object') return '';

  let list: any[] = [];
  const rawList =
    data?.notify_parties ||
    data?.notify_party_details ||
    data?.notify_party ||
    data?.commercial_invoice?.notify_parties ||
    data?.custom_invoice?.notify_parties ||
    data?.shipment_instruction?.notify_parties ||
    data?.shipment?.notify_parties;

  if (Array.isArray(rawList)) {
    list = rawList;
  } else if (typeof rawList === 'string' && rawList.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      // ignore invalid JSON
    }
  } else if (
    typeof data?.notify_parties_json === 'string' &&
    data.notify_parties_json.trim().startsWith('[')
  ) {
    try {
      const parsed = JSON.parse(data.notify_parties_json);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      // ignore invalid JSON
    }
  }

  const indexedCandidates = [
    data?.[`notify_party_${index1Based}`],
    data?.[`notify_party_${index1Based}_details`],
    data?.[`notify_party_${index1Based}_text`],
    data?.commercial_invoice?.[`notify_party_${index1Based}`],
    data?.custom_invoice?.[`notify_party_${index1Based}`],
    data?.shipment_instruction?.[`notify_party_${index1Based}`],
    data?.shipment_instruction?.[`notify_party_${index1Based}_details`],
    data?.shipment?.[`notify_party_${index1Based}`],
    data?.shipment?.[`notify_party_${index1Based}_details`],
    list[index1Based - 1],
  ];

  for (const cand of indexedCandidates) {
    const formatted = formatStructuredParty(cand);
    if (formatted) return formatted;
  }

  return '';
}

/**
 * Cleans redundant "GST Number:" header prefix when displaying under the REGISTRATION NO label.
 */
function formatGstDisplayValue(rawGst: string): string {
  const clean = safeString(rawGst, '');
  if (!clean) return '';
  const stripped = clean.replace(/^(gst\s*number|registration\s*number)\s*:\s*\n?/i, '').trim();
  return stripped || clean;
}

const RAW_ID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,})$/i;

/**
 * Extracts VESSEL / VOYAGE NO. by combining vessel_name and voyage_number (comma-separated).
 */
function extractCommercialVesselVoyageNo(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const vesselName = safeString(
    data?.commercial_invoice?.vessel_name ??
      data?.vessel_name ??
      data?.bill_of_lading?.vessel_name ??
      data?.shipment_instruction?.vessel_name ??
      data?.custom_invoice?.vessel_name ??
      data?.contract?.vessel_name,
    ''
  );
  const voyageNumber = safeString(
    data?.commercial_invoice?.voyage_number ??
      data?.voyage_number ??
      data?.commercial_invoice?.voyage_no ??
      data?.voyage_no ??
      data?.bill_of_lading?.voyage_number ??
      data?.bill_of_lading?.voyage_no ??
      data?.shipment_instruction?.voyage_number ??
      data?.shipment_instruction?.voyage_no ??
      data?.custom_invoice?.voyage_number ??
      data?.custom_invoice?.voyage_no,
    ''
  );
  const combined = [vesselName, voyageNumber].filter(Boolean).join(', ');
  if (combined) return combined;
  return extractVesselVoyageNo(data);
}

/**
 * Extracts FINAL DESTINATION prioritizing place_of_delivery.
 */
function extractCommercialFinalDestination(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const fromPlaceOfDelivery = extractPortDisplayName(
    data?.commercial_invoice?.place_of_delivery ??
      data?.place_of_delivery ??
      data?.placeOfDelivery ??
      data?.bill_of_lading?.place_of_delivery ??
      data?.shipment_instruction?.place_of_delivery ??
      data?.custom_invoice?.place_of_delivery,
    ''
  );
  if (fromPlaceOfDelivery) return fromPlaceOfDelivery;
  return extractPortDisplayName(
    data?.commercial_invoice?.final_destination ??
      data?.final_destination ??
      data?.finalDestination ??
      data?.destination_port,
    safeString(data?.destination_port_name || data?.port_of_destination, '')
  );
}

/**
 * Extracts packing type title from packing_type_title (with safe fallbacks).
 */
function extractCommercialPackingTypeTitle(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data?.commercial_invoice?.packing_type_title,
    data?.packing_type_title,
    data?.packing_type?.title,
    data?.packing_type?.name,
    data?.custom_invoice?.packing_type_title,
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
 * Builds or augments goods description so PACKING TYPE (packing_type_title)
 * always appears cleanly between Product Name and Marking Brand.
 */
function extractCommercialGoodsDescription(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const packingTypeTitle = extractCommercialPackingTypeTitle(data);

  const rawDesc = safeString(
    data?.commercial_invoice?.goods_description ??
      data?.goods_description ??
      data?.description_of_goods,
    ''
  ).trim();

  if (rawDesc) {
    if (!packingTypeTitle) return rawDesc;

    const lines = rawDesc.split(/\r?\n/);
    const existingPackIdx = lines.findIndex((line) => /^\s*packing\s*type\s*:/i.test(line));
    if (existingPackIdx >= 0) {
      const afterColon = lines[existingPackIdx].replace(/^\s*packing\s*type\s*:\s*/i, '').trim();
      if (!afterColon || RAW_ID_REGEX.test(afterColon)) {
        lines[existingPackIdx] = `PACKING TYPE: ${packingTypeTitle}`;
      }
      return lines.join('\n');
    }

    const packingLine = `PACKING TYPE: ${packingTypeTitle}`;
    const markingIdx = lines.findIndex((line) => /^\s*marking(\s*brand)?\s*:/i.test(line));
    if (markingIdx >= 0) {
      lines.splice(markingIdx, 0, packingLine);
      return lines.join('\n');
    }

    const specIdx = lines.findIndex((line) => /^\s*(quality\s*)?specification\s*:/i.test(line));
    if (specIdx >= 0) {
      lines.splice(specIdx + 1, 0, packingLine);
      return lines.join('\n');
    }

    const prodIdx = lines.findIndex((line) => /^\s*product(\s*name)?\s*:/i.test(line));
    if (prodIdx >= 0) {
      lines.splice(prodIdx + 1, 0, packingLine);
      return lines.join('\n');
    }

    lines.push(packingLine);
    return lines.join('\n');
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
  const mark = safeString(
    data?.marking_brand ||
      data?.marking ||
      data?.brand ||
      data?.contract?.marking_brand ||
      data?.confirmation?.marking_brand,
    ''
  );

  const lines: string[] = [];
  if (prodName) lines.push(`PRODUCT: ${prodName}`);
  if (spec) lines.push(`SPECIFICATION: ${spec}`);
  if (packingTypeTitle) lines.push(`PACKING TYPE: ${packingTypeTitle}`);
  if (mark) lines.push(`MARKING: ${mark}`);
  if (lines.length > 0) return lines.join('\n');

  return extractGoodsDescription(data);
}

/**
 * Extracts QUANTITY IN MT prioritizing net_weight.
 */
function extractCommercialQuantityMt(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data?.commercial_invoice?.net_weight,
    data?.net_weight,
    data?.custom_invoice?.net_weight,
    data?.bill_of_lading?.net_weight,
    data?.shipment_instruction?.net_weight,
    data?.quantity_mt,
    data?.mt_quantity,
    data?.quantity,
  ];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue;
    const str = safeString(raw, '').trim();
    if (str !== '') return str;
  }
  return '';
}

/**
 * Extracts AMOUNT IN (top cell) from balance_payment.
 */
function extractCommercialBalancePayment(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data?.commercial_invoice?.balance_payment,
    data?.balance_payment,
    data?.balancePayment,
    data?.data?.balance_payment,
  ];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue;
    const str = String(raw).replace(/,/g, '').trim();
    if (str !== '') return str;
  }
  return '';
}

/**
 * Extracts TOTAL from total_value.
 */
function extractCommercialTotalValue(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data?.commercial_invoice?.total_value,
    data?.total_value,
    data?.totalValue,
    data?.data?.total_value,
    data?.custom_invoice?.total_value,
    data?.proforma?.total_value,
    data?.contract?.total_value,
    data?.confirmation?.total_value,
  ];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue;
    const str = String(raw).replace(/,/g, '').trim();
    if (str !== '') return str;
  }
  return '';
}

/**
 * Normalizes currency amounts to backend decimal format (up to 17 digits before decimal and 2 digits after, e.g. "0.00").
 */
function formatDecimal2ForPayload(
  val: string | number | undefined | null,
  forceRound = false
): string {
  if (val === undefined || val === null) return '0.00';
  const cleaned = String(val).replace(/,/g, '').trim();
  if (!cleaned) return '0.00';
  if (/^\d{1,17}(?:\.\d{1,2})?$/.test(cleaned)) {
    const [intPart, decPart = ''] = cleaned.split('.');
    return `${intPart}.${decPart.padEnd(2, '0')}`;
  }
  if (forceRound) {
    const num = parseFloat(cleaned);
    if (!isNaN(num) && isFinite(num) && num >= 0) {
      return num.toFixed(2);
    }
  }
  return cleaned;
}

/**
 * Resolves whether ADVANCE PAYMENT should render an editable input based on any_advance.
 */
function resolveAnyAdvance(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const raw =
    data?.commercial_invoice?.any_advance ??
    data?.any_advance ??
    data?.data?.any_advance ??
    data?.proforma?.any_advance ??
    data?.contract?.any_advance ??
    data?.confirmation?.any_advance;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return false;
}

const PLACEHOLDER_ID_REGEX =
  /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i;

export function CommercialInvoiceDocumentForm({
  initialData,
  dataVersion,
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
  currencies = DEFAULT_CURRENCIES,
  shippingTerms = [],
  onSaveDraft,
  onSaveSuccess,
  onSubmitCommercialInvoice,
  lang = 'en',
  dict,
  readOnly = false,
}: CommercialInvoiceDocumentFormProps) {
  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isInitialDataRealCommercial = Boolean(
    initialData?.commercial_invoice_id ||
      initialData?.commercial_invoice_number ||
      initialData?.commercial_invoice_no ||
      (initialData?.commercial_invoice && typeof initialData.commercial_invoice === 'object') ||
      initialData?._is_commercial_invoice_loaded ||
      initialData?.document_type === 'commercial_invoice' ||
      initialData?.doc_type === 'commercial_invoice'
  );

  const hasLoadedRealCommercialRef = useRef<boolean>(isInitialDataRealCommercial);
  const isFormInitializedRef = useRef<boolean>(isInitialDataRealCommercial);
  const lastDataVersionRef = useRef<number>(dataVersion ?? 0);
  const isSavingOrSubmittingRef = useRef<boolean>(false);
  const lastLoadedDocIdRef = useRef<string>(
    sanitizeDocId(
      isInitialDataRealCommercial
        ? initialData?.commercial_invoice_id ||
            initialData?.commercialInvoiceId ||
            initialData?.id ||
            initialData?._id ||
            commercialInvoiceId ||
            ''
        : commercialInvoiceId || ''
    )
  );

  // Document Status: 'PENDING' shows Save As Draft; 'COMPLETED' strictly hides Save As Draft
  const commercialStepItem = getCommercialInvoiceStep(steps, selectedStep);
  const [docStatus, setDocStatus] = useState<string>(() => {
    return extractCommercialInvoiceDocumentStatus(initialData, commercialStepItem);
  });

  // User interaction & dirty state tracking
  const [hasDraftChanges, setHasDraftChanges] = useState<boolean>(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState<boolean>(() => {
    const statusFromData = extractCommercialInvoiceDocumentStatus(initialData, commercialStepItem);
    return statusFromData !== 'COMPLETED';
  });

  const isUserDirtyRef = useRef<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = useCallback(() => {
    isUserDirtyRef.current = true;
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Operation States & Draft ID
  const [draftId, setDraftId] = useState<string>(() => sanitizeDocId(commercialInvoiceId) || '');

  useEffect(() => {
    if (commercialInvoiceId) {
      const clean = sanitizeDocId(commercialInvoiceId);
      if (clean && !PLACEHOLDER_ID_REGEX.test(clean)) {
        setDraftId(clean);
      }
    }
  }, [commercialInvoiceId]);

  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
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
      (commercialInvoiceId || draftId) &&
        !initialData &&
        !steps?.some((s) => isCommercialInvoiceStep(s) && (s.status || s.document_status || s.step_status))
    );

  // Sync docStatus when steps or initialData updates
  useEffect(() => {
    const currentStep = getCommercialInvoiceStep(steps, selectedStep);
    const resolvedStatus = extractCommercialInvoiceDocumentStatus(initialData, currentStep);
    if (resolvedStatus) {
      setDocStatus(resolvedStatus);
    }
  }, [initialData, steps, selectedStep]);

  // Auto-scroll viewport to top whenever step or document changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedStep?.id, initialData?.id, initialData?.commercial_invoice_id]);

  // Form Header State
  const [documentTitle, setDocumentTitle] = useState<string>(() => {
    const rawTitle = safeString(
      initialData?.commercial_invoice?.pdf_title ||
        initialData?.commercial_invoice?.document_title ||
        (isInitialDataRealCommercial
          ? initialData?.pdf_title ||
            initialData?.pdfTitle ||
            initialData?.document_title ||
            initialData?.documentTitle ||
            initialData?.title
          : ''),
      ''
    );
    // Avoid inheriting "PROFORMA INVOICE" or "CUSTOM INVOICE" as title
    if (rawTitle && !/^(proforma|custom|sales contract|trade confirmation)/i.test(rawTitle)) {
      return rawTitle;
    }
    return 'COMMERCIAL INVOICE';
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

  // Parties: Seller / Exporter Instruction ID
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
  const [buyerId, setBuyerId] = useState<string>(() => extractBuyerInfo(initialData, buyers).id);
  const [buyerName, setBuyerName] = useState<string>(() => extractBuyerInfo(initialData, buyers).name);
  const [buyerDetails, setBuyerDetails] = useState<string>(() => extractBuyerInfo(initialData, buyers).details);

  const consigneeDisplayText = useMemo(
    () => extractConsigneeDisplay(initialData, buyerName, buyerDetails),
    [initialData, buyerName, buyerDetails]
  );

  // Notify Parties (1 to 6 - Display Only)
  const notifyParty1 = useMemo(() => extractNotifyPartyByIndex(initialData, 1), [initialData]);
  const notifyParty2 = useMemo(() => extractNotifyPartyByIndex(initialData, 2), [initialData]);
  const notifyParty3 = useMemo(() => extractNotifyPartyByIndex(initialData, 3), [initialData]);
  const notifyParty4 = useMemo(() => extractNotifyPartyByIndex(initialData, 4), [initialData]);
  const notifyParty5 = useMemo(() => extractNotifyPartyByIndex(initialData, 5), [initialData]);
  const notifyParty6 = useMemo(() => extractNotifyPartyByIndex(initialData, 6), [initialData]);
  const hasSecondRowNotify = Boolean(notifyParty4 || notifyParty5 || notifyParty6);

  // Invoicing Details: Editable Inputs (INVOICE NO & INVOICE DATE only)
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => {
    return safeString(
      initialData?.commercial_invoice_number ||
        initialData?.commercial_invoice_no ||
        initialData?.commercial_invoice?.invoice_number ||
        initialData?.commercial_invoice?.invoice_no ||
        initialData?.invoice_number ||
        initialData?.invoice_no ||
        '',
      ''
    );
  });

  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    const raw =
      initialData?.commercial_invoice_date ||
      initialData?.commercial_invoice?.invoice_date ||
      initialData?.invoice_date ||
      '';
    if (raw) {
      const str = safeString(raw);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      const parsed = new Date(str);
      return !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : str.slice(0, 10);
    }
    return '';
  });

  // Display-only Reference / Registration Fields (No inputs in Commercial Invoice)
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
      initialData?.proforma?.other_reference ??
      initialData?.proforma?.other_references ??
      initialData?.contract?.other_reference ??
      initialData?.contract?.other_references ??
      initialData?.data?.other_reference ??
      initialData?.data?.other_references;
    return safeString(raw, '');
  });

  // 4-Column Shipping Info Row (Display Only - PRE-CARRIAGE BY is always static "BY SEA")
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
    extractCommercialVesselVoyageNo(initialData)
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

  const [shippingTerm, setShippingTerm] = useState<string>(() =>
    extractShippingTerm(initialData, shippingTerms)
  );

  useEffect(() => {
    const resolved = extractShippingTerm(initialData, shippingTerms);
    if (resolved && resolved !== shippingTerm) {
      setShippingTerm(resolved);
    }
  }, [shippingTerms, initialData]);

  // 2-Column Destination Ports Row (Display Only)
  const [portOfDestination, setPortOfDestination] = useState<string>(() =>
    extractPortDisplayName(
      initialData?.port_of_destination || initialData?.destination_port,
      safeString(initialData?.destination_port_name, '')
    )
  );
  const [finalDestination, setFinalDestination] = useState<string>(() =>
    extractCommercialFinalDestination(initialData)
  );

  // Goods Table
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
  const [goodsDescription, setGoodsDescription] = useState<string>(() =>
    extractCommercialGoodsDescription(initialData)
  );
  const [quantityMt, setQuantityMt] = useState<number | string>(() =>
    extractCommercialQuantityMt(initialData)
  );
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

  // Whether ADVANCE PAYMENT shows an editable input (controlled by any_advance)
  const [hasAnyAdvance, setHasAnyAdvance] = useState<boolean>(() => resolveAnyAdvance(initialData));

  // Balance Payment (AMOUNT IN top cell) & Total Value (TOTAL cell)
  const [balancePayment, setBalancePayment] = useState<string>(() =>
    extractCommercialBalancePayment(initialData)
  );
  const [totalValue, setTotalValue] = useState<string>(() =>
    extractCommercialTotalValue(initialData)
  );

  // Editable Advance Payment Input (Specific to Commercial Invoice ONLY when any_advance is true)
  const [advancePayment, setAdvancePayment] = useState<string>(() => {
    if (!resolveAnyAdvance(initialData)) return '';
    const rawAdv =
      initialData?.commercial_invoice?.advance_payment ??
      initialData?.commercial_invoice?.advance_payment_amt ??
      initialData?.advance_payment ??
      initialData?.advance_payment_amt ??
      initialData?.advance_amount ??
      initialData?.advancePayment ??
      initialData?.advancePaymentAmt ??
      initialData?.advanceAmount ??
      initialData?.data?.advance_payment ??
      initialData?.data?.advance_payment_amt;
    if (rawAdv !== undefined && rawAdv !== null && String(rawAdv).trim() !== '') {
      return String(rawAdv).trim().replace(/,/g, '');
    }
    return '';
  });

  const formatAmountWithoutExtraZeros = useCallback((val: number | string): string => {
    if (val === undefined || val === null || val === '') return '';
    const cleanStr = String(val).replace(/,/g, '').trim();
    if (!cleanStr) return '';
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return cleanStr;
    return num.toLocaleString('en-US', {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const computedItemAmount = useMemo(() => {
    const q = parseFloat(String(quantityMt || 0).replace(/,/g, '')) || 0;
    const r = parseFloat(String(ratePrice || 0).replace(/,/g, '')) || 0;
    return q * r;
  }, [quantityMt, ratePrice]);

  const effectiveBalancePayment = useMemo(() => {
    if (balancePayment !== '') {
      const parsed = parseFloat(String(balancePayment).replace(/,/g, ''));
      if (!isNaN(parsed)) return parsed;
    }
    return computedItemAmount;
  }, [balancePayment, computedItemAmount]);

  const computedTotal = useMemo(() => {
    if (totalValue !== '') {
      const parsed = parseFloat(String(totalValue).replace(/,/g, ''));
      if (!isNaN(parsed)) return parsed;
    }
    return computedItemAmount;
  }, [totalValue, computedItemAmount]);

  const effectiveAmountInWords = useMemo(
    () => convertAmountToWords(computedTotal, currency),
    [computedTotal, currency]
  );

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
    return safeString(
      initialData?.commercial_invoice?.bank_details_id ??
        initialData?.commercial_invoice?.bank_account_id ??
        initialData?.bank_details_id ??
        initialData?.bankDetailsId ??
        initialData?.bank_account_id ??
        initialData?.bankAccountId ??
        initialData?.bank_id ??
        initialData?.bankId ??
        initialData?.custom_invoice?.bank_details_id ??
        initialData?.custom_invoice?.bank_account_id ??
        initialData?.proforma?.bank_details_id ??
        initialData?.proforma?.bank_account_id ??
        initialData?.data?.bank_details_id ??
        initialData?.data?.bank_account_id ??
        '',
      ''
    );
  });
  const [bankAccountDetails, setBankAccountDetails] = useState<string>(() => {
    return safeString(
      initialData?.commercial_invoice?.bank_details ??
        initialData?.bank_details ??
        initialData?.bankAccountDetails ??
        initialData?.bank_account_details ??
        initialData?.account_details ??
        initialData?.custom_invoice?.bank_details ??
        initialData?.custom_invoice?.bank_account_details ??
        initialData?.proforma?.bank_details ??
        initialData?.proforma?.bank_account_details ??
        initialData?.data?.bank_details ??
        '',
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
  useEffect(() => {
    const effectiveInstructionId =
      sellerInstructionId ||
      extractSellerInstructionId(initialData, sellers) ||
      sellerId;

    if (!effectiveInstructionId) {
      setSellerBankAccounts([]);
      return;
    }

    if (
      sellerBankAccountsCache.has(effectiveInstructionId) &&
      (sellerBankAccountsCache.get(effectiveInstructionId)?.length || 0) > 0
    ) {
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

          if (selectedBankId) {
            const matched = items.find(
              (b: any) =>
                String(b.bank_details_id || b.id || b._id) === String(selectedBankId) ||
                String(b.id) === String(selectedBankId) ||
                String(b.bank_details_id) === String(selectedBankId) ||
                String(b.bank_account_id) === String(selectedBankId)
            );
            if (matched) {
              const effectiveBankId = String(
                (matched as any).bank_details_id || matched.id || selectedBankId
              );
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
        }
      })
      .catch((err) => {
        console.warn('[CommercialInvoiceDocumentForm] Failed to load seller bank details:', err);
      })
      .finally(() => {
        if (isSubscribed) setIsLoadingBankAccounts(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [
    sellerInstructionId,
    sellerId,
    initialData,
    sellers,
    lang,
    formatBankDetails,
    selectedBankId,
    bankAccountDetails,
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

  // Bank Charges Disclaimer Note (Display-only in Commercial Invoice)
  const [bankChargesNote, setBankChargesNote] = useState<string>(() => {
    const extracted = extractBankChargesNote(initialData);
    return extracted || DEFAULT_BANK_CHARGES_NOTE;
  });

  // Additional Comment Row (Title & Comment - Editable Inputs)
  const [commentLabel, setCommentLabel] = useState<string>(() =>
    safeString(
      initialData?.comment_label ||
        initialData?.commentLabel ||
        initialData?.comment_title ||
        initialData?.commentTitle ||
        initialData?.notes_title ||
        initialData?.extra_title ||
        initialData?.notes?.[0]?.title,
      ''
    )
  );
  const [commentValue, setCommentValue] = useState<string>(() =>
    safeString(
      initialData?.comment_value ||
        initialData?.commentValue ||
        initialData?.comment_text ||
        initialData?.commentText ||
        initialData?.notes_comment ||
        initialData?.extra_comment ||
        initialData?.comment ||
        initialData?.notes?.[0]?.comment,
      ''
    )
  );

  // Hydrate form state when initialData arrives or dataVersion bumps
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

    const isIncomingRealCommercial = Boolean(
      initialData?.commercial_invoice_id ||
        initialData?.commercial_invoice_number ||
        initialData?.commercial_invoice_no ||
        (initialData?.commercial_invoice && typeof initialData.commercial_invoice === 'object') ||
        initialData?._is_commercial_invoice_loaded ||
        initialData?.document_type === 'commercial_invoice' ||
        initialData?.doc_type === 'commercial_invoice'
    );

    const currentIncomingDocId = isIncomingRealCommercial
      ? sanitizeDocId(
          initialData?.commercial_invoice_id ||
            initialData?.commercialInvoiceId ||
            initialData?.id ||
            initialData?._id
        )
      : '';

    const hasDocChanged = Boolean(
      currentIncomingDocId &&
        lastLoadedDocIdRef.current &&
        currentIncomingDocId !== lastLoadedDocIdRef.current
    );

    const needsUpgrade = isIncomingRealCommercial && !hasLoadedRealCommercialRef.current;

    if (needsUpgrade || hasDocChanged || isDataVersionTriggered) {
      isUserDirtyRef.current = false;
      isSavingOrSubmittingRef.current = false;
      if (isIncomingRealCommercial) hasLoadedRealCommercialRef.current = true;
      if (dataVersion !== undefined) lastDataVersionRef.current = dataVersion;
    }

    if (
      !isDataVersionTriggered &&
      !hasDocChanged &&
      (isUserDirtyRef.current ||
        isSavingOrSubmittingRef.current ||
        (isFormInitializedRef.current && hasDraftChanges))
    ) {
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

    if (isIncomingRealCommercial && currentIncomingDocId) {
      hasLoadedRealCommercialRef.current = true;
      setDraftId(currentIncomingDocId);
    } else if (!isIncomingRealCommercial) {
      setDraftId('');
    }
    isFormInitializedRef.current = true;
    lastLoadedDocIdRef.current =
      currentIncomingDocId || sanitizeDocId(draftId || commercialInvoiceId) || '';

    // Toggles
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

    // Invoice No & Date (only hydrate from commercial invoice data so we don't leak another form's invoice numbers)
    if (isIncomingRealCommercial) {
      const resolvedInvoiceNo = safeString(
        initialData.commercial_invoice_number ||
          initialData.commercial_invoice_no ||
          initialData.commercial_invoice?.invoice_number ||
          initialData.commercial_invoice?.invoice_no ||
          initialData.invoice_number ||
          initialData.invoice_no ||
          '',
        ''
      );
      if (resolvedInvoiceNo) {
        setInvoiceNumber(resolvedInvoiceNo);
      } else if (hasDocChanged) {
        setInvoiceNumber('');
      }

      const rawInvoiceDate = safeString(
        initialData.commercial_invoice_date ||
          initialData.commercial_invoice?.invoice_date ||
          initialData.invoice_date ||
          '',
        ''
      );
      if (rawInvoiceDate) {
        if (/^\d{4}-\d{2}-\d{2}/.test(rawInvoiceDate)) {
          setInvoiceDate(rawInvoiceDate.slice(0, 10));
        } else {
          const parsedDate = new Date(rawInvoiceDate);
          setInvoiceDate(!isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split('T')[0] : rawInvoiceDate.slice(0, 10));
        }
      } else if (hasDocChanged) {
        setInvoiceDate('');
      }
    }

    // Registration / GST
    const resolvedInstId = extractSellerInstructionId(initialData, sellers);
    if (
      initialData.registration_number ||
      initialData.gst_number ||
      initialData?.seller_details?.registration_number ||
      initialData?.seller_details?.gst ||
      initialData?.seller?.gst ||
      initialData?.seller?.registration_number
    ) {
      setGstNumber(
        resolveGstString(
          initialData.registration_number ||
            initialData.gst_number ||
            initialData?.seller_details?.registration_number ||
            initialData?.seller_details?.gst ||
            initialData?.seller?.gst ||
            initialData?.seller?.registration_number
        )
      );
    } else if (!gstNumber) {
      const sId = resolvedInstId || sellerId;
      const matchedSeller = sellers?.find(
        (s: any) => String(s.id || s._id || s.instruction_id || s.value) === String(sId)
      );
      if (matchedSeller?.gst || matchedSeller?.registration_number || matchedSeller?.gst_number) {
        setGstNumber(
          resolveGstString(
            matchedSeller.gst || matchedSeller.registration_number || matchedSeller.gst_number
          )
        );
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
      setContractDate(safeString(initialData.contract_date || initialData.confirmation_date).slice(0, 10));
    }

    // Seller / Exporter
    if (resolvedInstId) {
      setSellerInstructionId(resolvedInstId);
      setSellerId(resolvedInstId);
    }
    const resolvedCompanyName = extractSellerCompanyName(
      initialData,
      sellers,
      resolvedInstId || sellerId
    );
    if (resolvedCompanyName) setCompanyName(resolvedCompanyName);

    if (initialData.seller_details || initialData.seller_instruction) {
      if (typeof initialData.seller_details === 'object') {
        const addr =
          initialData.seller_details.address ||
          initialData.seller_details.instruction ||
          initialData.seller_details.details;
        const cName =
          initialData.seller_details.company_name ||
          initialData.seller_details.name ||
          resolvedCompanyName;
        const combined = formatPartyDetails(cName, addr);
        if (combined && combined.trim()) setSellerDetails(combined);
      } else {
        const raw = initialData.seller_details || initialData.seller_instruction;
        const clean = dedupePartyDetails(raw);
        if (clean && clean.trim()) setSellerDetails(clean);
      }
    }

    // Buyer / Consignee
    const buyerInfo = extractBuyerInfo(initialData, buyers);
    if (buyerInfo.id) setBuyerId(buyerInfo.id);
    if (buyerInfo.name) setBuyerName(buyerInfo.name);
    if (buyerInfo.details) setBuyerDetails(buyerInfo.details);

    // Terms & Ports
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
    }

    const finDest = extractCommercialFinalDestination(initialData);
    if (finDest) {
      setFinalDestination(finDest);
    } else if (hasDocChanged || isDataVersionTriggered) {
      setFinalDestination('');
    }

    const resolvedLoadingCountry = extractLoadingPortCountry(initialData, products);
    if (resolvedLoadingCountry) {
      setPlaceOfReceipt(resolvedLoadingCountry);
      setCountryOfOrigin(resolvedLoadingCountry);
    } else {
      const rec = safeString(initialData.place_of_receipt);
      const orig = safeString(
        initialData.country_of_origin || initialData.origin_country || initialData.product_country
      );
      if (rec) setPlaceOfReceipt(rec);
      if (orig) setCountryOfOrigin(orig);
    }

    const resolvedDestCountry = extractDestinationPortCountry(initialData);
    if (resolvedDestCountry) {
      setCountryOfDestination(resolvedDestCountry);
    } else if (
      initialData.country_of_destination ||
      initialData.destination_country ||
      initialData.destination_port_country
    ) {
      setCountryOfDestination(
        safeString(
          initialData.country_of_destination ||
            initialData.destination_country ||
            initialData.destination_port_country
        )
      );
    }

    const vNo = extractCommercialVesselVoyageNo(initialData);
    if (vNo) {
      setVesselVoyageNo(vNo);
    } else if (hasDocChanged || isDataVersionTriggered) {
      setVesselVoyageNo('');
    }

    // Quantity (net_weight), Currency, Price, Count/Vessel, Balance Payment, Advance Payment, Total Value
    const resolvedQty = extractCommercialQuantityMt(initialData);
    if (resolvedQty !== '') {
      setQuantityMt(resolvedQty);
    }
    const rawCur =
      initialData.currency ||
      initialData.currency_code ||
      initialData.currencyCode ||
      initialData.currency_id ||
      initialData.currencyId;
    if (rawCur) {
      setCurrency(
        normalizeCurrencyOption(rawCur, currencies).value || normalizeCurrencyCode(rawCur)
      );
    }
    if (
      initialData.rate_price !== undefined ||
      initialData.price !== undefined ||
      initialData.rate !== undefined
    ) {
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

    const nextAnyAdvance = resolveAnyAdvance(initialData);
    setHasAnyAdvance(nextAnyAdvance);

    const resolvedBalancePay = extractCommercialBalancePayment(initialData);
    if (resolvedBalancePay !== '') {
      setBalancePayment(resolvedBalancePay);
    } else if (hasDocChanged || isDataVersionTriggered) {
      setBalancePayment('');
    }

    const resolvedTotalVal = extractCommercialTotalValue(initialData);
    if (resolvedTotalVal !== '') {
      setTotalValue(resolvedTotalVal);
    } else if (hasDocChanged || isDataVersionTriggered) {
      setTotalValue('');
    }

    if (!nextAnyAdvance) {
      setAdvancePayment('');
    } else {
      const rawAdv =
        initialData?.commercial_invoice?.advance_payment ??
        initialData?.commercial_invoice?.advance_payment_amt ??
        initialData?.advance_payment ??
        initialData?.advance_payment_amt ??
        initialData?.advance_amount ??
        initialData?.advancePayment ??
        initialData?.advancePaymentAmt ??
        initialData?.advanceAmount ??
        initialData?.data?.advance_payment ??
        initialData?.data?.advance_payment_amt;
      if (rawAdv !== undefined && rawAdv !== null && String(rawAdv).trim() !== '') {
        setAdvancePayment(String(rawAdv).trim().replace(/,/g, ''));
      } else if (hasDocChanged || isDataVersionTriggered) {
        setAdvancePayment('');
      }
    }

    const bNote = extractBankChargesNote(initialData);
    if (bNote) setBankChargesNote(bNote);

    const sTerm = extractShippingTerm(initialData, shippingTerms);
    if (sTerm) setShippingTerm(sTerm);

    const gDesc = extractCommercialGoodsDescription(initialData);
    if (gDesc) setGoodsDescription(gDesc);

    const incomingBankId = safeString(
      initialData?.commercial_invoice?.bank_details_id ??
        initialData?.commercial_invoice?.bank_account_id ??
        initialData?.bank_details_id ??
        initialData?.bankDetailsId ??
        initialData?.bank_account_id ??
        initialData?.bankAccountId ??
        initialData?.bank_id ??
        initialData?.bankId ??
        initialData?.custom_invoice?.bank_details_id ??
        initialData?.custom_invoice?.bank_account_id ??
        initialData?.proforma?.bank_details_id ??
        initialData?.proforma?.bank_account_id ??
        initialData?.data?.bank_details_id ??
        initialData?.data?.bank_account_id
    );
    if (incomingBankId) {
      setSelectedBankId(incomingBankId);
    } else if (hasDocChanged || isDataVersionTriggered) {
      setSelectedBankId('');
    }
    const incomingBankDetails = safeString(
      initialData?.commercial_invoice?.bank_details ??
        initialData?.bank_details ??
        initialData?.bankAccountDetails ??
        initialData?.bank_account_details ??
        initialData?.account_details ??
        initialData?.custom_invoice?.bank_details ??
        initialData?.custom_invoice?.bank_account_details ??
        initialData?.proforma?.bank_details ??
        initialData?.proforma?.bank_account_details ??
        initialData?.data?.bank_details
    );
    if (incomingBankDetails) {
      setBankAccountDetails(incomingBankDetails);
    } else if (!incomingBankId && (hasDocChanged || isDataVersionTriggered)) {
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
    if (initialLabel) setAuthoritySignatureTitle(safeString(initialLabel));

    if (!hasUserClearedLogoRef.current) {
      const resolvedInitLogo = resolveSellerLogoValue(initialData, sellers, sellerId);
      if (resolvedInitLogo) {
        setCompanyLogoUrl(formatSignatureUrl(resolvedInitLogo) || resolvedInitLogo);
      }
    }

    const cLabel = safeString(
      initialData.comment_label ||
      initialData.comment_title ||
      initialData.notes_title ||
      initialData.extra_title ||
      initialData.commentLabel ||
      initialData.commentTitle ||
      initialData.notes?.[0]?.title,
      ''
    );
    setCommentLabel(cLabel);

    const cVal = safeString(
      initialData.comment_value ||
      initialData.comment_text ||
      initialData.notes_comment ||
      initialData.extra_comment ||
      initialData.comment ||
      initialData.commentValue ||
      initialData.commentText ||
      initialData.notes?.[0]?.comment,
      ''
    );
    setCommentValue(cVal);

    if (isIncomingRealCommercial) {
      const titleFromInit = safeString(
        initialData.pdf_title ||
          initialData.pdfTitle ||
          initialData.document_title ||
          initialData.documentTitle ||
          initialData.title,
        ''
      );
      if (titleFromInit && !/^(proforma|custom|sales contract|trade confirmation)/i.test(titleFromInit)) {
        setDocumentTitle(titleFromInit);
      }
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

  const getEffectiveCommercialInvoiceId = useCallback(() => {
    const parentIds = new Set(
      [customInvoiceId, shipmentInstructionId, proformaId, contractId, confirmationId]
        .map((id) => sanitizeDocId(id))
        .filter(Boolean)
    );

    const isValidOwnId = (val?: string | null) => {
      const clean = sanitizeDocId(val);
      return Boolean(clean && !parentIds.has(clean) && !PLACEHOLDER_ID_REGEX.test(clean));
    };

    if (isValidOwnId(draftId)) return sanitizeDocId(draftId);
    if (isValidOwnId(commercialInvoiceId)) return sanitizeDocId(commercialInvoiceId);

    const stepItem = getCommercialInvoiceStep(steps, selectedStep);
    if (stepItem) {
      const stepId = sanitizeDocId(
        getStepSelfId(stepItem) ||
          extractStepRedirectId(stepItem) ||
          extractStepId(stepItem) ||
          stepItem.redirect_id ||
          (stepItem as any).redirectId ||
          stepItem.commercial_invoice_id ||
          (stepItem as any).commercialInvoiceId
      );
      if (isValidOwnId(stepId)) return stepId;
    }

    const explicitId = sanitizeDocId(
      initialData?.commercial_invoice_id ||
        initialData?.commercialInvoiceId ||
        initialData?.commercial_invoice?.id ||
        initialData?.commercial_invoice?._id
    );
    if (isValidOwnId(explicitId)) return explicitId;

    if (initialData?._is_commercial_invoice_loaded) {
      const dataId = sanitizeDocId(initialData?.id || initialData?._id);
      if (isValidOwnId(dataId)) return dataId;
    }

    return '';
  }, [
    draftId,
    commercialInvoiceId,
    steps,
    selectedStep,
    initialData,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
  ]);

  const getCommercialInvoiceFormData = useCallback((): FormData => {
    const formData = new FormData();

    // Header title & toggles (matches agriguru-website CommercialForm payload)
    const titleVal = safeString(documentTitle).trim() || 'COMMERCIAL INVOICE';
    formData.append('pdf_title', titleVal);

    formData.append('header_enabled', String(Boolean(letterhead)));
    formData.append('is_watermark_enabled', String(Boolean(watermark)));

    // Invoice No & Date (editable)
    const cleanInvoiceNo = safeString(invoiceNumber).trim();
    if (cleanInvoiceNo) {
      formData.append('invoice_number', cleanInvoiceNo);
    }
    const cleanInvoiceDate = safeString(invoiceDate).trim();
    if (cleanInvoiceDate) {
      formData.append('invoice_date', cleanInvoiceDate);
    }

    // Advance Payment & Balance Payment
    formData.append(
      'advance_payment',
      hasAnyAdvance ? formatDecimal2ForPayload(advancePayment, false) : '0.00'
    );
    formData.append('balance_payment', formatDecimal2ForPayload(effectiveBalancePayment, true));

    // Bank Account (editable)
    if (
      selectedBankId &&
      !/^select bank account$/i.test(selectedBankId.trim()) &&
      !/^loading bank accounts/i.test(selectedBankId.trim())
    ) {
      formData.append('bank_details_id', safeString(selectedBankId).trim());
    }

    // Additional Comments (editable)
    const cleanCommentLabel = safeString(commentLabel).trim().slice(0, 20);
    const cleanCommentValue = safeString(commentValue).trim();
    formData.append('comment_label', cleanCommentLabel);
    formData.append('comment_title', cleanCommentLabel);
    formData.append('notes_title', cleanCommentLabel);
    formData.append('comment_value', cleanCommentValue);
    formData.append('comment_text', cleanCommentValue);
    formData.append('notes_comment', cleanCommentValue);
    formData.append('comment', cleanCommentValue);

    // Seller Logo (only when explicitly uploaded)
    if (logoFile) {
      formData.append('seller_logo', logoFile);
    }

    // Seller Signature & Label (editable)
    const cleanAuthTitle = safeString(authoritySignatureTitle).trim();
    if (cleanAuthTitle) {
      formData.append('seller_signature_label', cleanAuthTitle);
    }

    if (stampImageUrl && !hasUserClearedSignatureRef.current) {
      if (stampImageUrl.startsWith('data:') || stampImageUrl.startsWith('blob:')) {
        const file = dataUrlToFile(stampImageUrl, 'seller_signature.png');
        if (file) formData.append('seller_signature', file);
      } else {
        const relUrl = normalizeSignaturePayload(stampImageUrl) || stampImageUrl;
        if (relUrl) {
          formData.append('seller_signature', relUrl);
        }
      }
    }

    return formData;
  }, [
    documentTitle,
    letterhead,
    watermark,
    invoiceNumber,
    invoiceDate,
    hasAnyAdvance,
    advancePayment,
    effectiveBalancePayment,
    selectedBankId,
    commentLabel,
    commentValue,
    logoFile,
    authoritySignatureTitle,
    stampImageUrl,
  ]);

  const isDraftSavedToBackendRef = useRef<boolean>(
    Boolean(
      initialData?.commercial_invoice_id ||
        initialData?.commercial_invoice_number ||
        initialData?._is_commercial_invoice_loaded
    )
  );

  // Handle Save As Draft
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting) return;
    isSavingOrSubmittingRef.current = true;
    setIsSavingDraft(true);
    setErrors({});
    try {
      const formDataPayload = getCommercialInvoiceFormData();
      let res: any;
      if (onSaveDraft) {
        res = await onSaveDraft(formDataPayload);
      } else {
        res = await saveCommercialInvoiceDraftAction(
          formDataPayload,
          lang,
          getEffectiveCommercialInvoiceId() || undefined
        );
      }

      if (!res) {
        toast.error('No response received while saving draft. Please retry.');
        return;
      }

      const hasFieldErrors = Boolean(
        (Array.isArray(res?.error_fields) && res.error_fields.length > 0) ||
          (Array.isArray(res?.errors) && res.errors.length > 0) ||
          (res?.errors && typeof res.errors === 'object' && Object.keys(res.errors).length > 0) ||
          (res?.error_fields &&
            typeof res.error_fields === 'object' &&
            Object.keys(res.error_fields).length > 0)
      );

      const isFailed = res?.success === false || res?.success === 0 || hasFieldErrors;

      if (isFailed) {
        const { fieldErrors, generalError } = parseProformaBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusProformaField(fieldErrors);
        }
        const firstFieldErr = Object.values(fieldErrors)[0];
        const hasAnyFieldErr = Object.keys(fieldErrors).length > 0;
        const isCleanToastMsg = (m?: any) =>
          Boolean(
            m &&
              typeof m === 'string' &&
              !/^(form validation error|validation error|bad request)$/i.test(m.trim()) &&
              !/^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(m.trim()) &&
              !/<(!DOCTYPE|html)/i.test(m)
          );
        const toastMsg =
          (isCleanToastMsg(generalError) ? generalError : null) ||
          firstFieldErr ||
          (isCleanToastMsg(res?.message) ? res.message : null) ||
          (isCleanToastMsg(res?.error) ? res.error : null) ||
          (hasAnyFieldErr
            ? 'Failed to save draft. Please check highlighted fields.'
            : res?.message || res?.error || 'Failed to save commercial invoice draft. Please try again.');
        toast.error(toastMsg);
        return;
      }

      const savedId = String(
        res?.id ||
          res?.data?.id ||
          res?.data?.commercial_invoice_id ||
          draftId ||
          commercialInvoiceId ||
          ''
      );
      if (savedId) {
        lastLoadedDocIdRef.current = savedId;
        setDraftId(savedId);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('id', savedId);
          url.searchParams.set('step', 'commercial-invoice');
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
      if (statusFromRes) setDocStatus(statusFromRes);
      setErrors({});
      toast.success(res?.message || 'Commercial Invoice saved as draft!');

      if (savedId && onSaveSuccess) {
        const extracted =
          extractCommercialInvoiceData(res?.data) ||
          (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
        const cleanCLabel = safeString(commentLabel).trim().slice(0, 20);
        const cleanCVal = safeString(commentValue).trim();
        onSaveSuccess(savedId, {
          comment_label: cleanCLabel,
          comment_title: cleanCLabel,
          notes_title: cleanCLabel,
          comment_value: cleanCVal,
          comment_text: cleanCVal,
          notes_comment: cleanCVal,
          comment: cleanCVal,
          ...extracted,
          id: savedId,
          commercial_invoice_id: savedId,
        });
      }
      return res;
    } catch (err: any) {
      console.error('[CommercialInvoiceDocumentForm] Save draft error:', err);
      const { fieldErrors, generalError } = parseProformaBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusProformaField(fieldErrors);
      }
      toast.error(generalError || err?.message || 'Error occurred while saving draft.');
    } finally {
      isSavingOrSubmittingRef.current = false;
      setIsSavingDraft(false);
    }
  };

  // Handle Submit Commercial Invoice (backend-driven validation only, no client-side blocking)
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft) return;

    const submitTargetInfo = getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'commercial_invoice',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;
    const targetNextStepName = submitTargetInfo.nextStepName;

    isSavingOrSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    try {
      let activeId = getEffectiveCommercialInvoiceId();
      if (!activeId || isDirty || hasDraftChanges || !isDraftSavedToBackendRef.current) {
        try {
          const payloadToSave = getCommercialInvoiceFormData();
          let saveRes: any;
          if (onSaveDraft) {
            saveRes = await onSaveDraft(payloadToSave);
          } else {
            saveRes = await saveCommercialInvoiceDraftAction(payloadToSave, lang, activeId || undefined);
          }
          if (saveRes?.success) {
            const newId = saveRes.id || saveRes.data?.id || saveRes.data?.commercial_invoice_id || saveRes.data?.invoice_id;
            if (newId) {
              const cleanNewId = String(newId);
              setDraftId(cleanNewId);
              activeId = cleanNewId;
              isDraftSavedToBackendRef.current = true;
              setIsDirty(false);
              setHasDraftChanges(false);
              setHasSubmitChanges(true);
              if (onSaveSuccess) onSaveSuccess(cleanNewId, saveRes.data);
            }
          }
        } catch (saveErr) {
          console.warn('[CommercialInvoiceDocumentForm] Auto-save before submit warning:', saveErr);
        }
      }

      const formDataPayload = getCommercialInvoiceFormData();
      let res: any;
      if (onSubmitCommercialInvoice) {
        res = await onSubmitCommercialInvoice(
          formDataPayload,
          activeId || getEffectiveCommercialInvoiceId() || undefined,
          targetNextStep
        );
      } else {
        res = await submitCommercialInvoiceAction(
          formDataPayload,
          lang,
          activeId || getEffectiveCommercialInvoiceId() || undefined
        );
      }

      if (!res) {
        toast.error('No response received while submitting commercial invoice. Please retry.');
        return;
      }

      const hasFieldErrors = Boolean(
        (Array.isArray(res?.error_fields) && res.error_fields.length > 0) ||
          (Array.isArray(res?.errors) && res.errors.length > 0) ||
          (res?.errors && typeof res.errors === 'object' && Object.keys(res.errors).length > 0) ||
          (res?.error_fields &&
            typeof res.error_fields === 'object' &&
            Object.keys(res.error_fields).length > 0)
      );

      const isFailed = res?.success === false || res?.success === 0 || hasFieldErrors;
      if (isFailed) {
        const { fieldErrors, generalError } = parseProformaBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusProformaField(fieldErrors);
        }
        const firstFieldErr = Object.values(fieldErrors)[0];
        toast.error(
          generalError ||
            firstFieldErr ||
            res?.message ||
            res?.error ||
            'Failed to submit Commercial Invoice. Please check highlighted fields.'
        );
        return;
      }

      const savedId = String(
        res?.id ||
          res?.data?.id ||
          res?.data?.commercial_invoice_id ||
          draftId ||
          commercialInvoiceId ||
          ''
      );
      if (savedId) {
        lastLoadedDocIdRef.current = savedId;
        setDraftId(savedId);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('id', savedId);
          url.searchParams.set('step', 'commercial-invoice');
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
        currentDocName: 'Commercial Invoice',
        nextStepName: targetNextStepName,
      });
      toast.success(successToast);

      if (targetNextStep && onSelectStep && !onSubmitCommercialInvoice) {
        onSelectStep(targetNextStep);
      }
      if (savedId && onSaveSuccess) {
        const extracted =
          extractCommercialInvoiceData(res?.data) ||
          (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
        const cleanCLabel = safeString(commentLabel).trim().slice(0, 20);
        const cleanCVal = safeString(commentValue).trim();
        onSaveSuccess(savedId, {
          comment_label: cleanCLabel,
          comment_title: cleanCLabel,
          notes_title: cleanCLabel,
          comment_value: cleanCVal,
          comment_text: cleanCVal,
          notes_comment: cleanCVal,
          comment: cleanCVal,
          ...extracted,
          id: savedId,
          commercial_invoice_id: savedId,
        });
      }
      return res;
    } catch (err: any) {
      console.error('[CommercialInvoiceDocumentForm] Submit error:', err);
      const { fieldErrors, generalError } = parseProformaBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusProformaField(fieldErrors);
      }
      toast.error(generalError || err?.message || 'Error occurred while submitting invoice.');
    } finally {
      isSavingOrSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Handle Print Preview
  const handleOpenPrintPreview = async () => {
    let effectiveId = getEffectiveCommercialInvoiceId();

    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getCommercialInvoiceFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await saveCommercialInvoiceDraftAction(
            formDataPayload,
            lang,
            effectiveId || undefined
          );
        }
        if (res?.success) {
          const newId = String(
            res.id || res.data?.id || res.data?._id || res.data?.commercial_invoice_id || ''
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
        } else if (res) {
          const { fieldErrors, generalError } = parseProformaBackendErrors(res);
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            scrollToAndFocusProformaField(fieldErrors);
          }
          const firstFieldErr = Object.values(fieldErrors)[0];
          const hasAnyFieldErr = Object.keys(fieldErrors).length > 0;
          const errToast =
            generalError ||
            firstFieldErr ||
            (typeof res?.message === 'string' && !/^(form validation error|validation error|bad request)$/i.test(res.message.trim()) ? res.message : null) ||
            (hasAnyFieldErr
              ? 'Failed to save draft. Please check highlighted fields.'
              : res?.message || res?.error || 'Failed to save commercial invoice draft.');
          toast.error(errToast);
          return;
        }
      } catch (saveErr) {
        console.error('[CommercialInvoiceDocumentForm] Auto-save before preview failed:', saveErr);
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
    let effectiveId = getEffectiveCommercialInvoiceId();

    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getCommercialInvoiceFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await saveCommercialInvoiceDraftAction(
            formDataPayload,
            lang,
            effectiveId || undefined
          );
        }
        if (res?.success) {
          const newId = String(
            res.id || res.data?.id || res.data?._id || res.data?.commercial_invoice_id || ''
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
        } else if (res) {
          const { fieldErrors, generalError } = parseProformaBackendErrors(res);
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            scrollToAndFocusProformaField(fieldErrors);
          }
          const firstFieldErr = Object.values(fieldErrors)[0];
          const hasAnyFieldErr = Object.keys(fieldErrors).length > 0;
          const errToast =
            generalError ||
            firstFieldErr ||
            (typeof res?.message === 'string' && !/^(form validation error|validation error|bad request)$/i.test(res.message.trim()) ? res.message : null) ||
            (hasAnyFieldErr
              ? 'Failed to save draft. Please check highlighted fields.'
              : res?.message || res?.error || 'Failed to save commercial invoice draft.');
          toast.error(errToast);
          return;
        }
      } catch (saveErr) {
        console.error('[CommercialInvoiceDocumentForm] Auto-save before download failed:', saveErr);
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
        prefix: 'commercial_invoice',
        id: effectiveId,
        commercialInvoiceId: effectiveId,
        candidateIds: [
          effectiveId,
          draftId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x)),
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
          initialData?.commercial_invoice_number ||
          initialData?.invoice_number ||
          effectiveId;

        const cleanNumber = String(numCandidate)
          .replace(/^#+/, '')
          .replace(/[/\\?%*:|"<>]/g, '-')
          .replace(/-+/g, '-')
          .trim();

        const downloadName = `COMMERCIAL-INVOICE-${cleanNumber}.pdf`;

        const downloaded = downloadPdfFromActionResponse(res, downloadName);
        if (downloaded) {
          toast.success(
            dict?.smart_docs?.pdf_download_success || 'Commercial Invoice PDF downloaded!'
          );
        } else {
          toast.error(res?.message || 'No PDF data received from server');
        }
      } else {
        toast.error(res?.message || res?.error || 'Failed to download PDF');
      }
    } catch (err: any) {
      console.error('[CommercialInvoiceDocumentForm] Download PDF error:', err);
      toast.error(err?.message || 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const deliveryTermsDisplay = safeString(termsDeliveryPayment, '');
  const shippingTermHeader = formatShippingTermHeader(shippingTerm);
  const displayGstValue = formatGstDisplayValue(gstNumber);

  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'commercial_invoice',
      isSubmitting,
      submittingText: dict?.smart_docs?.submitting || 'Submitting...',
      defaultSubmitText:
        dict?.smart_docs?.commercial_invoice_form?.submit || dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  return (
    <div
      id="commercial-invoice-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollContainerRef}
        id="commercial-invoice-scroll-viewport"
        className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar"
      >
        {/*
          TOP HEADER BAR (Matches Proforma Invoice exactly):
          - Left: Round Company Logo (seller_logo) with Edit & Remove
          - Center: Seller Name + Editable COMMERCIAL INVOICE Title
          - Right: Letterhead (Header) on top, Watermark underneath
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
            {(errors.seller_logo || errors.company_logo) && (
              <span className="text-[11px] text-brand-red font-semibold ml-2 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                <span className="text-brand-red">{errors.seller_logo || errors.company_logo}</span>
              </span>
            )}
          </div>

          {/* Center: Seller Name & Editable COMMERCIAL INVOICE Title */}
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
            placeholder="COMMERCIAL INVOICE"
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

          {/* Desktop Right: Letterhead & Watermark */}
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
                setErrors((prev) => ({
                  ...prev,
                  is_watermark_enabled: '',
                  watermark_enabled: '',
                  watermark: '',
                }));
              }}
              disabled={readOnly}
            />
            {(errors.is_watermark_enabled || errors.watermark_enabled || errors.watermark) && (
              <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                <span className="text-brand-red">
                  {errors.is_watermark_enabled || errors.watermark_enabled || errors.watermark}
                </span>
              </span>
            )}
            {(errors.header_enabled || errors.letterhead_space || errors.letterhead) && (
              <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                <span className="text-brand-red">
                  {errors.header_enabled || errors.letterhead_space || errors.letterhead}
                </span>
              </span>
            )}
          </div>

          {/* Mobile Right: Letterhead & Watermark */}
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
                setErrors((prev) => ({
                  ...prev,
                  is_watermark_enabled: '',
                  watermark_enabled: '',
                  watermark: '',
                }));
              }}
              disabled={readOnly}
            />
            {(errors.is_watermark_enabled || errors.watermark_enabled || errors.watermark) && (
              <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                <span className="text-brand-red">
                  {errors.is_watermark_enabled || errors.watermark_enabled || errors.watermark}
                </span>
              </span>
            )}
            {(errors.header_enabled || errors.letterhead_space || errors.letterhead) && (
              <span className="text-[11px] text-brand-red font-semibold mt-0.5 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                <span className="text-brand-red">
                  {errors.header_enabled || errors.letterhead_space || errors.letterhead}
                </span>
              </span>
            )}
          </div>
        </div>

        {/*
          DOCUMENT GRID / TABLE:
          Exact Proforma Invoice design tokens & theme compliance (light + dark mode)
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          {/*
            ROW 1 & 2:
            Left Side (37%): EXPORTER / SELLER (Top) & CONSIGNEE / BUYER (Bottom)
            Right Side (63%): Invoice No & Date (Editable) + GST, Order No, PO No, Contract Date, Other Ref (Display Only)
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
                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide px-0.5 whitespace-pre-line leading-relaxed select-all">
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
                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide px-0.5 whitespace-pre-line leading-relaxed select-all">
                  {consigneeDisplayText || '-'}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (63%) */}
            <div className="w-full md:w-[63%] min-w-0 flex-1 flex flex-col divide-y divide-border bg-card">
              {/* Row 1 & 2: INVOICE NO & INVOICE DATE (Editable) + GST / REGISTRATION NO (Display Only) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {/* Left Sub-Column: INVOICE NO & INVOICE DATE */}
                <div className="sm:col-span-7 flex flex-col divide-y divide-border">
                  {/* INVOICE NO (Editable) */}
                  <div
                    className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[42px]"
                    id="field-invoiceNumber"
                    data-field="invoiceNumber"
                  >
                    <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                      INVOICE NO:
                    </label>
                    <div className="flex-1 min-w-0">
                      <DocUnderlineInput
                        id="commercial-invoice-number-input"
                        value={invoiceNumber}
                        onChange={(v) => {
                          markDirty();
                          setInvoiceNumber(v);
                          if (v.trim()) {
                            setErrors((prev) => ({
                              ...prev,
                              invoiceNumber: '',
                              invoice_number: '',
                            }));
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

                  {/* INVOICE DATE (Editable) */}
                  <div
                    className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[42px]"
                    id="field-invoiceDate"
                    data-field="invoiceDate"
                  >
                    <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                      INVOICE DATE:
                    </label>
                    <div className="flex-1 min-w-0">
                      <DocUnderlineInput
                        id="commercial-invoice-date-input"
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

                {/* Right Sub-Column: REGISTRATION NO (Display Only - Top Aligned) */}
                <div
                  className="sm:col-span-5 p-2 sm:p-2.5 flex flex-col items-start justify-start gap-1 min-h-[84px] min-w-0 overflow-hidden"
                  id="field-gstNumber"
                  data-field="gstNumber"
                >
                  <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5 leading-tight">
                    REGISTRATION NO:
                  </span>
                  <div className="text-[13px] sm:text-[14px] font-semibold text-foreground tracking-wide whitespace-pre-line break-words leading-relaxed px-0.5 select-all">
                    {displayGstValue || '-'}
                  </div>
                </div>
              </div>

              {/* Row 3: BUYER'S ORDER NO & DATE (Display Only - NO Input) */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-buyerOrderNoDate"
                data-field="buyerOrderNoDate"
              >
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  BUYER&apos;S ORDER NO &amp; DATE:
                </span>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
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
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
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
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(contractDate, '') || '-'}
                  </span>
                </div>
              </div>

              {/* Row 6: OTHER REFERENCE (S) (Display Only - NO Input) */}
              <div
                className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]"
                id="field-other_reference"
                data-field="other_reference"
              >
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  OTHER REFERENCE (S):
                </span>
                <div className="flex-1 min-w-0 flex items-center min-h-[30px] px-1">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(otherReferences, '') || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 3 (NEW IN COMMERCIAL INVOICE): NOTIFY PARTIES (1-3, and 4-6 when present)
            Styled cleanly to match Proforma table headers (bg-muted/20) and Seller/Consignee typography
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
                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty1 || '-'}
                </div>
              </div>
              <div className="p-2.5 sm:p-3 min-h-[72px] flex flex-col justify-start text-left">
                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty2 || '-'}
                </div>
              </div>
              <div className="p-2.5 sm:p-3 min-h-[72px] flex flex-col justify-start text-left">
                <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty3 || '-'}
                </div>
              </div>
            </div>

            {/* Notify Parties 4 - 6 (Rendered dynamically when 4th, 5th, or 6th party exists) */}
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
                    <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {notifyParty4 || '-'}
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 min-h-[56px] flex flex-col justify-start text-left">
                    <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {notifyParty5 || '-'}
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 min-h-[56px] flex flex-col justify-start text-left">
                    <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {notifyParty6 || '-'}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/*
            ROW 4: 4-COLUMN SHIPPING & ORIGIN ROW (Exact match with Proforma Invoice)
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
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    BY SEA
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 text-center min-h-[36px] flex items-center justify-center">
                  <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                    {safeString(placeOfReceipt || countryOfOrigin, '') || '-'}
                  </span>
                </div>
              </div>

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
            ROW 5: 3-COLUMN VESSEL & LOADING ROW (Exact match with Proforma Invoice)
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
                <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                  {safeString(vesselVoyageNo, '') || 'AS PER BL'}
                </span>
              </div>

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
            ROW 6: 2-COLUMN DESTINATION PORTS ROW (Exact match with Proforma Invoice)
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
            ROW 7: GOODS & SERVICES TABLE
            Exact Proforma 15% / 43% / 14% / 14% / 14% layout with EDITABLE ADVANCE PAYMENT input
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
                {/* Main Product Row */}
                <tr className="divide-x divide-border">
                  {/* COUNT / VESSEL */}
                  <td rowSpan={2} className="py-3 px-3 align-top text-left">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all">
                      {safeString(countVessel, '') || '-'}
                    </span>
                  </td>

                  {/* DESCRIPTIONS OF GOODS AND SERVICES */}
                  <td
                    className="py-3 px-3 align-top text-left pb-6"
                    id="field-goodsDescription"
                    data-field="goodsDescription"
                  >
                    <div className="font-semibold text-[14px] text-foreground leading-relaxed whitespace-pre-line select-all pb-2">
                      {safeString(goodsDescription, '') || '-'}
                    </div>
                  </td>

                  {/* QUANTITY IN MT */}
                  <td className="py-3 px-3 align-top text-right" id="field-quantityMt" data-field="quantityMt">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {quantityMt !== '' && quantityMt !== undefined && quantityMt !== null
                        ? /\bmt[s]?\b/i.test(String(quantityMt))
                          ? safeString(quantityMt).replace(/,/g, '')
                          : `${safeString(quantityMt).replace(/,/g, '')} MT`
                        : '0.000'}
                    </span>
                  </td>

                  {/* RATE */}
                  <td className="py-3 px-3 align-top text-right" id="field-ratePrice" data-field="ratePrice">
                    <span className="font-semibold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {ratePrice
                        ? `${currencySymbol} ${formatAmountWithoutExtraZeros(ratePrice)}`
                        : `${currencySymbol} 0.00`}
                    </span>
                  </td>

                  {/* AMOUNT (balance_payment) */}
                  <td className="py-3 px-3 align-top text-right" id="field-balancePayment" data-field="balancePayment">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {currencySymbol} {formatAmountWithoutExtraZeros(effectiveBalancePayment) || '0.00'}
                    </span>
                    {(errors.balancePayment || errors.balance_payment) && (
                      <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center justify-end gap-1.5">
                        <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                        <span className="text-brand-red">{errors.balancePayment || errors.balance_payment}</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* Advance Payment Row (Editable input only when any_advance is true) */}
                <tr className="divide-x divide-border bg-card">
                  <td className="py-2.5 px-3 align-middle text-left">
                    <span className="font-semibold text-[13px] sm:text-[14px] text-foreground tracking-wide select-all">
                      [5% MORE OR LESS AT CONTRACT QUANTITY]
                    </span>
                  </td>
                  <td
                    colSpan={2}
                    className="py-2.5 px-3 align-middle text-right font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider pr-4"
                  >
                    ADVANCE PAYMENT
                  </td>
                  <td
                    className={`${hasAnyAdvance ? 'py-2' : 'py-2.5'} px-3 align-middle text-right`}
                    id="field-advancePayment"
                    data-field="advancePayment"
                  >
                    {hasAnyAdvance ? (
                      <DocUnderlineInput
                        id="field-advancePayment-input"
                        name="advance_payment"
                        type="number"
                        step="any"
                        align="right"
                        value={advancePayment}
                        onChange={(v) => {
                          markDirty();
                          setAdvancePayment(v);
                          setErrors((prev) => ({
                            ...prev,
                            advancePayment: '',
                            advance_payment: '',
                            advance_payment_amt: '',
                            advance_amount: '',
                          }));
                        }}
                        error={
                          errors.advancePayment ||
                          errors.advance_payment ||
                          errors.advance_payment_amt ||
                          errors.advance_amount
                        }
                        disabled={readOnly}
                        placeholder="0.00"
                        icon="fa-solid fa-pen"
                        inputClassName="text-[14px] font-bold text-foreground text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        className="w-full"
                      />
                    ) : (
                      <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                        {currencySymbol} 0.00
                      </span>
                    )}
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
                  <td className="py-2.5 px-3 align-top text-right" id="field-totalValue" data-field="totalValue">
                    <span className="font-bold text-[14px] text-foreground tracking-wide select-all tabular-nums">
                      {currencySymbol} {formatAmountWithoutExtraZeros(computedTotal) || '0.00'}
                    </span>
                    {(errors.totalValue || errors.total_value) && (
                      <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center justify-end gap-1.5">
                        <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                        <span className="text-brand-red">{errors.totalValue || errors.total_value}</span>
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/*
            ROW 8: BANK ACCOUNT (58%) & AUTHORITY SIGNATURE / STAMP (42%)
            Exact 58% / 42% alignment with Goods Table above (matches Proforma Invoice)
          */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border border-b border-border bg-card">
            {/* Left Column (58%): Bank Account Details */}
            <div
              className="w-full md:w-[58%] p-2.5 sm:p-3 flex flex-col justify-start gap-2 bg-card"
              id="field-selectedBankId"
              data-field="selectedBankId"
            >
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
                              if (firstLine && firstLine !== bankTitle) bankSub = firstLine;
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
                          let fallbackLabel = isLoadingBankAccounts
                            ? 'Loading bank accounts...'
                            : 'Selected Bank Account';
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
                      error={
                        errors.selectedBankId ||
                        errors.bank_details_id ||
                        errors.bank_account_id ||
                        errors.bankDetails ||
                        errors.bank_details
                      }
                      placeholder="Select Bank Account"
                      className="w-full font-bold text-foreground text-[14px]"
                    />
                  </div>
                </div>

                {/* Formatted Bank Account Details (Display Only) */}
                <div className="flex-1 flex flex-col mt-1.5 min-h-[90px] justify-start px-0.5">
                  {bankAccountDetails ? (
                    <div className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                      {bankAccountDetails}
                    </div>
                  ) : (
                    <div className="text-[13px] text-muted-foreground/60 italic pt-1">
                      {selectedBankId
                        ? 'No details available for selected bank account'
                        : 'Select a bank account from above to view details'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (42%): Seller Stamp & Signature Box */}
            <div
              className="w-full md:w-[42%] p-2.5 sm:p-3 flex flex-col justify-start bg-card"
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
            ROW 9: BANK CHARGES DISCLAIMER NOTE (Display Only - NO Input in Commercial Invoice)
          */}
          <div
            className="w-full py-2.5 px-2.5 sm:px-3 flex flex-col gap-1 justify-start bg-card"
            id="field-bankChargesNote"
            data-field="bankChargesNote"
          >
            <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
              NOTE / BANK CHARGES:
            </span>
            <p className="text-[13px] sm:text-[14px] font-semibold text-amber-600 dark:text-amber-400 leading-relaxed px-0.5 select-all">
              {bankChargesNote || DEFAULT_BANK_CHARGES_NOTE}
            </p>
          </div>

          {/*
            ROW 10: COMMENTS (comment_label & comment_value - Exact match with Proforma)
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
                id="commercial-commentLabel-input"
                value={commentLabel}
                maxLength={20}
                onChange={(val) => {
                  markDirty();
                  setCommentLabel(val.slice(0, 20));
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
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0 sm:col-span-2"
              data-field="commentValue"
              id="field-commentValue"
            >
              <DocUnderlineInput
                id="commercial-commentValue-input"
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
        BOTTOM ACTION BAR (Matches Proforma Invoice exactly)
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
            title={
              dict?.smart_docs?.contract_form?.print_preview ||
              dict?.smart_docs?.confirmation_form?.print_preview ||
              'Print Preview'
            }
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>
              {dict?.smart_docs?.contract_form?.print_preview ||
                dict?.smart_docs?.confirmation_form?.print_preview ||
                'Print Preview'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            title={
              dict?.smart_docs?.contract_form?.download_pdf ||
              dict?.smart_docs?.confirmation_form?.download_pdf ||
              'Download PDF'
            }
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
                : dict?.smart_docs?.contract_form?.download_pdf ||
                  dict?.smart_docs?.confirmation_form?.download_pdf ||
                  'Download PDF'}
            </span>
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
                {isSavingDraft
                  ? 'Saving...'
                  : dict?.smart_docs?.confirmation_form?.save_as_draft || 'Save As Draft'}
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
                ? 'Commercial Invoice already submitted'
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
        prefix="commercial_invoice"
        docId={getEffectiveCommercialInvoiceId()}
        candidateIds={[
          getEffectiveCommercialInvoiceId(),
          draftId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        commercialInvoiceId={getEffectiveCommercialInvoiceId()}
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

export default CommercialInvoiceDocumentForm;
