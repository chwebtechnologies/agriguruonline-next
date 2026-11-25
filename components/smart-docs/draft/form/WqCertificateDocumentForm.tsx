'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocToggle from './DocToggle';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import {
  safeString,
  dedupePartyDetails,
  formatPartyDetails,
  extractSellerCompanyName,
  extractBuyerInfo,
  type FormOptionItem,
} from './ProformaDocumentForm';
import {
  downloadDocPdfAction,
  saveWqCertificateDraftAction,
  submitWqCertificateAction,
} from '@/app/actions/smart-docs';
import {
  type StepperDocumentItem,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  extractWqCertificateData,
  getWqCertificateStep,
  extractWqCertificateDocumentStatus,
  isWqCertificateStep,
  isSameWorkflowStep,
  getWorkflowSubmitButtonInfo,
  getStepSelfId,
  extractStepRedirectId,
} from '@/lib/api/smart-docs.service';

export interface WqCertificateDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
  wqCertificateId?: string;
  certificateOfOriginId?: string;
  fumigationCertificateId?: string;
  phytoCertificateId?: string;
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
  onSubmitWqCertificate?: (
    payload: any,
    id?: string,
    nextStep?: StepperDocumentItem | null
  ) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

export interface ContainerRowItem {
  containerNumber: string;
  sealNumber: string;
  bags: string;
  grossWeight: string;
  netWeight: string;
}

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
        : safeString(raw.country);
    const pincode = safeString(raw.pincode || raw.postal_code || raw.zip || raw.zip_code);

    const csz = [city, state, country, pincode].filter(Boolean).join(', ');
    if (csz) lines.push(csz);

    const contactParts: string[] = [];
    const phone = safeString(raw.phone || raw.contact || raw.contact_number || raw.tel);
    if (phone) contactParts.push(`TEL: ${phone}`);
    const email = safeString(raw.email);
    if (email) contactParts.push(`EMAIL: ${email}`);
    const tax = safeString(raw.tax_id || raw.vat_number || raw.tax_number || raw.reg_id || raw.gst_number || raw.gstin);
    if (tax) contactParts.push(`TAX/REG ID: ${tax}`);

    if (contactParts.length > 0) {
      lines.push(contactParts.join(', '));
    }

    return lines.join('\n');
  }
  return '';
}

/**
 * Universal crash-proof string extractor.
 */
function resolveString(val: any, fallback = ''): string {
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
    const joined = val.map((x) => resolveString(x)).filter(Boolean).join(', ');
    return joined || fallback;
  }
  if (typeof val === 'object') {
    const candidate =
      val.name ||
      val.company_name ||
      val.companyName ||
      val.label ||
      val.title ||
      val.product_name ||
      val.port_name ||
      val.portName ||
      val.country_name ||
      val.country ||
      val.value ||
      val.text ||
      val.code ||
      val.details ||
      '';
    if (candidate && typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed || fallback;
    }
    if (candidate && typeof candidate === 'object') {
      return resolveString(candidate, fallback);
    }
    return fallback;
  }
  return String(val);
}

export const SHIP_BY_MAP: Record<string, string> = {
  FCL_20_FT: '20 FT FCL',
  FCL_40_FT: '40 FT FCL',
  VESSEL: 'VESSEL',
  '20_FT_FCL': '20 FT FCL',
  '40_FT_FCL': '40 FT FCL',
  '20 FT FCL': '20 FT FCL',
  '40 FT FCL': '40 FT FCL',
};

/**
 * Cleans notify party string, removing dangling null/undefined.
 */
export function cleanNotifyParty(value?: any): string {
  if (!value) return '-';
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/\r\nnull$/i, '')
      .replace(/\nnull$/i, '')
      .replace(/\r\nundefined$/i, '')
      .replace(/\nundefined$/i, '')
      .trim();
    return cleaned || '-';
  }
  if (typeof value === 'object') {
    return formatStructuredParty(value) || '-';
  }
  return '-';
}

/**
 * Formats date into DD/MM/YYYY.
 */
export function formatDateDisplay(dateString?: string | null): string {
  if (!dateString) return '-';
  const str = String(dateString).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const date = new Date(str);
  if (isNaN(date.getTime())) return str || '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats FCL type text.
 */
export function formatFclType(raw?: string): string {
  if (!raw) return '-';
  const clean = String(raw).trim();
  return SHIP_BY_MAP[clean] || clean.replace(/_/g, ' ') || '-';
}

/**
 * Resolves transit clause display with country name in parentheses if available.
 */
function resolveTransitClause(data: any): string {
  if (!data) return '-';
  if (typeof data === 'string') return data.trim() || '-';
  const val = resolveString(data.transit_clause || data.transitClause || data.transit_clause_value);
  let country = '';
  if (data.transit_clause_country && typeof data.transit_clause_country === 'object') {
    country = resolveString(data.transit_clause_country.name || data.transit_clause_country.title);
  } else {
    country = resolveString(data.transit_clause_country || data.transitClauseCountry);
  }

  if (val && country) {
    return `${val} (${country})`;
  }
  return val || country || '-';
}

/**
 * Formats numeric weights to 3 decimals.
 */
function formatWeightNumber(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  const cleanStr = String(val).replace(/,/g, '').trim();
  const num = Number(cleanStr);
  if (!isNaN(num)) {
    return num.toFixed(3);
  }
  return String(val);
}

/**
 * WqCertificateDocumentForm
 *
 * Implements the W & Q Certificate (Weight & Quality Certificate) screen.
 * Strictly adheres to Canva reference layouts, theme compliance rules,
 * robust fallback handling, and zero-cache freshness.
 */
export function WqCertificateDocumentForm({
  initialData,
  dataVersion,
  wqCertificateId,
  certificateOfOriginId,
  fumigationCertificateId,
  phytoCertificateId,
  packingListId,
  commercialInvoiceId,
  customInvoiceId,
  shipmentInstructionId,
  proformaId,
  contractId,
  confirmationId,
  steps,
  selectedStep,
  onUpdateSteps,
  onSelectStep,
  onSaveDraft,
  onSaveSuccess,
  onSubmitWqCertificate,
  lang = 'en',
  dict,
  readOnly = false,
}: WqCertificateDocumentFormProps) {
  // Document status
  const docStatus = useMemo(() => {
    const step = getWqCertificateStep(steps, selectedStep);
    return extractWqCertificateDocumentStatus(initialData, step);
  }, [initialData, steps, selectedStep]);

  // Document IDs
  const [draftId, setDraftId] = useState<string>(() => {
    const step = getWqCertificateStep(steps, selectedStep);
    const fromStepper = getStepSelfId(step);
    return sanitizeDocId(
      wqCertificateId ||
      initialData?.wq_certificate_id ||
      initialData?.id ||
      initialData?._id ||
      fromStepper ||
      extractStepRedirectId(step)
    );
  });

  const getOwnWqCertificateId = useCallback((): string => {
    const step = getWqCertificateStep(steps, selectedStep);
    const fromStepper = getStepSelfId(step);
    const candidate = sanitizeDocId(
      draftId ||
      wqCertificateId ||
      initialData?.wq_certificate_id ||
      initialData?.id ||
      initialData?._id ||
      fromStepper ||
      extractStepRedirectId(step)
    );
    if (!candidate || isWqCertificateStep({ id: candidate } as any)) return '';
    return candidate;
  }, [draftId, wqCertificateId, initialData, steps, selectedStep]);

  const getEffectiveWqCertificateId = useCallback((): string => {
    const own = getOwnWqCertificateId();
    if (own) return own;
    return sanitizeDocId(
      certificateOfOriginId ||
      fumigationCertificateId ||
      phytoCertificateId ||
      packingListId ||
      commercialInvoiceId ||
      customInvoiceId ||
      shipmentInstructionId ||
      proformaId ||
      contractId ||
      confirmationId
    );
  }, [
    getOwnWqCertificateId,
    certificateOfOriginId,
    fumigationCertificateId,
    phytoCertificateId,
    packingListId,
    commercialInvoiceId,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
  ]);

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);
  const isUserDirtyRef = useRef(false);
  const markDirty = useCallback(() => {
    isUserDirtyRef.current = true;
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState(false);

  // Loading states
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastLoadedDocIdRef = useRef<string | null>(null);

  // Helper to extract fields from source payload
  const parseFields = (data: any) => {
    if (!data || typeof data !== 'object') {
      return {
        sellerDetails: '',
        sellerName: '',
        consigneeDetails: '',
        consigneeName: '',
        notifyParty1: '-',
        notifyParty2: '-',
        notifyParty3: '-',
        productName: '',
        hsnCode: '',
        originCountry: '',
        fclType: '',
        packingType: '',
        portOfLoading: '',
        portOfDischarge: '',
        fclQuantity: '',
        fclCapacity: '',
        mtQty: '',
        bagQty: '',
        markingBrand: '',
        preCarriageBy: 'BY SEA',
        vesselName: '',
        voyageNumber: '',
        invoiceNumber: '',
        invoiceDate: '',
        blNumber: '',
        shippingBillNo: '',
        netWeight: '',
        grossWeight: '',
        transitClause: '-',
        containers: [] as ContainerRowItem[],
        commentLabel: '',
        commentValue: '',
        watermark: false,
        documentTitle: 'W & Q CERTIFICATE',
      };
    }

    // Seller Details
    const sDetails = resolveString(
      data.seller_instruction ||
      data.sellerInstruction ||
      data.seller_details ||
      data.seller_address ||
      data.exporter_address ||
      formatStructuredParty(data.seller) ||
      formatStructuredParty(data.exporter)
    );
    const sName = resolveString(
      data.seller_name ||
      data.seller_company_name ||
      data.exporter_name ||
      data.seller?.company_name ||
      data.seller?.name ||
      extractSellerCompanyName(data) ||
      data.exporter ||
      data.seller
    );

    // Consignee Details
    const cDetails = resolveString(
      data.consignee_details ||
      data.consigneeDetails ||
      data.consignee_address ||
      formatStructuredParty(data.consignee) ||
      formatStructuredParty(data.buyer) ||
      data.buyer_instruction
    );
    const cName = resolveString(
      data.consignee_name ||
      data.consignee?.company_name ||
      data.consignee?.name ||
      data.buyer_name ||
      data.buyer?.company_name ||
      data.buyer?.name ||
      extractBuyerInfo(data).name ||
      data.consignee ||
      data.buyer
    );

    // Notify Parties
    const np1 = cleanNotifyParty(data.notify_party_1 || data.notify_party || data.notify_parties?.[0]);
    const np2 = cleanNotifyParty(data.notify_party_2 || data.notify_parties?.[1]);
    const np3 = cleanNotifyParty(data.notify_party_3 || data.notify_parties?.[2]);

    // Product, HSN, Origin
    const prod = resolveString(
      data.product_name ||
      data.productName ||
      data.product?.name ||
      data.product?.title ||
      data.goods_description ||
      data.product_title ||
      data.product
    );
    const hsn = resolveString(
      data.hsn_code ||
      data.hsnCode ||
      data.hsn ||
      data.hsn_sac_code ||
      data.hsn_sac
    );
    let orig = '';
    if (data.country_of_origin && typeof data.country_of_origin === 'object') {
      orig = resolveString(data.country_of_origin.name || data.country_of_origin.country_name || data.country_of_origin.title);
    } else {
      orig = resolveString(data.country_of_origin || data.countryOfOrigin || data.origin_country || data.origin || data.product?.country?.name);
    }

    // FCL Type
    const rawShipBy = data.ship_by || data.shipBy || data.fcl_type || data.container_size || data.container_type || data.shipping_container?.title || '';
    const fcl = SHIP_BY_MAP[rawShipBy] || formatFclType(rawShipBy);

    // Packing Type
    let pType = '';
    if (data.packing_type && typeof data.packing_type === 'object') {
      pType = resolveString(data.packing_type.name || data.packing_type.title);
    } else {
      pType = resolveString(data.packing_type_title || data.packingTypeTitle || data.packing_type || data.package_type);
    }

    // Port of Loading
    let pol = '';
    if (data.loading_port && typeof data.loading_port === 'object') {
      const pName = data.loading_port.name || data.loading_port.port_name || '';
      const cName = data.loading_port.country?.name || data.loading_port_country || data.loadingPortCountry || '';
      pol = pName && cName ? `${pName}, ${cName}` : pName || cName;
    } else {
      const pName = resolveString(data.loading_port || data.loadingPort || data.port_of_loading);
      const cName = resolveString(data.loading_port_country || data.loadingPortCountry || data.loading_country);
      pol = pName && cName && !pName.toLowerCase().includes(cName.toLowerCase()) ? `${pName}, ${cName}` : pName || cName;
    }

    // Port of Discharge
    let pod = '';
    if (data.destination_port && typeof data.destination_port === 'object') {
      const pName = data.destination_port.name || data.destination_port.port_name || '';
      const cName = data.destination_port.country?.name || data.destination_port_country || data.destinationPortCountry || '';
      pod = pName && cName ? `${pName}, ${cName}` : pName || cName;
    } else {
      const pName = resolveString(data.destination_port || data.destinationPort || data.port_of_discharge);
      const cName = resolveString(data.destination_port_country || data.destinationPortCountry || data.destination_country);
      pod = pName && cName && !pName.toLowerCase().includes(cName.toLowerCase()) ? `${pName}, ${cName}` : pName || cName;
    }

    // Summary Quantities
    const fclQ = resolveString(
      data.fcl_quantity !== undefined && data.fcl_quantity !== null
        ? data.fcl_quantity
        : data.fclQuantity !== undefined && data.fclQuantity !== null
        ? data.fclQuantity
        : data.total_containers !== undefined && data.total_containers !== null
        ? data.total_containers
        : data.no_of_containers !== undefined && data.no_of_containers !== null
        ? data.no_of_containers
        : ''
    );

    const rawCap = data.fcl_capacity ?? data.fclCapacity ?? data.capacity_per_container;
    const fclCap = rawCap !== undefined && rawCap !== null && rawCap !== ''
      ? (!isNaN(Number(rawCap)) && Number(rawCap) > 0 ? Number(rawCap).toFixed(2) : String(rawCap))
      : '';

    const rawMt = data.net_weight ?? data.netWeight ?? data.mt_qty ?? data.quantity;
    const mt = rawMt !== undefined && rawMt !== null && rawMt !== ''
      ? (!isNaN(Number(rawMt)) && Number(rawMt) > 0 ? Number(rawMt).toFixed(3) : String(rawMt))
      : '';

    const bags = resolveString(
      data.bag_quantity !== undefined && data.bag_quantity !== null
        ? data.bag_quantity
        : data.bagQuantity !== undefined && data.bagQuantity !== null
        ? data.bagQuantity
        : data.bag_qty !== undefined && data.bag_qty !== null
        ? data.bag_qty
        : data.total_bags !== undefined && data.total_bags !== null
        ? data.total_bags
        : data.bags !== undefined && data.bags !== null
        ? data.bags
        : ''
    );

    // Marks & Details
    const mb = resolveString(data.marking_brand || data.markingBrand);
    const prec = resolveString(data.pre_carriage_by || data.preCarriageBy || data.pre_carriage, 'BY SEA');
    const vName = resolveString(data.vessel_name || data.vesselName || data.vessleName);
    const vNum = resolveString(data.voyage_number || data.voyageNumber);
    const invNo = resolveString(data.invoice_number || data.invoiceNumber);
    const invDate = formatDateDisplay(data.invoice_date || data.invoiceDate);
    const blNo = resolveString(data.bl_number || data.blNumber);
    const sbNo = resolveString(data.shipping_bill_no || data.shippingBillNo || data.shipping_bill_number);

    const rawNet = data.net_weight ?? data.netWeight ?? rawMt;
    const netW = rawNet !== undefined && rawNet !== null && rawNet !== ''
      ? (!isNaN(Number(rawNet)) && Number(rawNet) > 0 ? Number(rawNet).toFixed(3) : String(rawNet))
      : '';

    const rawGross = data.gross_weight ?? data.grossWeight;
    const grossW = rawGross !== undefined && rawGross !== null && rawGross !== ''
      ? (!isNaN(Number(rawGross)) && Number(rawGross) > 0 ? Number(rawGross).toFixed(3) : String(rawGross))
      : '';

    const tc = resolveTransitClause(data);

    // Containers Table (Canva Image 3)
    const rawContainers = Array.isArray(data.containers)
      ? data.containers
      : Array.isArray(data.container_details)
      ? data.container_details
      : Array.isArray(data.container_list)
      ? data.container_list
      : [];

    const parsedContainers: ContainerRowItem[] = rawContainers.map((c: any) => ({
      containerNumber: resolveString(c.container_number || c.containerNumber || c.container_no || c.containerNo),
      sealNumber: resolveString(c.seal_number || c.sealNumber || c.seal_no || c.sealNo),
      bags: resolveString(c.bags || c.bag_quantity || c.bagQuantity || c.bags_qty),
      grossWeight: formatWeightNumber(c.gross_weight ?? c.grossWeight),
      netWeight: formatWeightNumber(c.net_weight ?? c.netWeight),
    }));

    // Comments (Canva Image 3)
    const cLabel = resolveString(
      data.comment_label ||
      data.commentLabel ||
      data.comment_title ||
      data.commentTitle ||
      data.notes_title ||
      data.extra_title ||
      data.notes?.[0]?.title,
      ''
    );
    const cVal = resolveString(
      data.comment_value ||
      data.commentValue ||
      data.comment_text ||
      data.commentText ||
      data.notes_comment ||
      data.extra_comment ||
      data.comment ||
      data.notes?.[0]?.comment,
      ''
    );

    // Watermark & Title
    const wm = Boolean(
      data.watermark === true ||
      data.watermark === 1 ||
      data.watermark === 'true' ||
      data.is_watermark_enabled === true ||
      data.is_watermark_enabled === 1 ||
      data.is_watermark_enabled === 'true'
    );

    const titleCandidate = resolveString(
      data.document_title ||
      data.documentTitle ||
      data.pdf_title ||
      data.pdfTitle ||
      data.title ||
      'W & Q CERTIFICATE'
    );

    return {
      sellerDetails: sDetails,
      sellerName: sName,
      consigneeDetails: cDetails,
      consigneeName: cName,
      notifyParty1: np1,
      notifyParty2: np2,
      notifyParty3: np3,
      productName: prod,
      hsnCode: hsn,
      originCountry: orig,
      fclType: fcl,
      packingType: pType,
      portOfLoading: pol,
      portOfDischarge: pod,
      fclQuantity: fclQ,
      fclCapacity: fclCap,
      mtQty: mt,
      bagQty: bags,
      markingBrand: mb,
      preCarriageBy: prec,
      vesselName: vName,
      voyageNumber: vNum,
      invoiceNumber: invNo,
      invoiceDate: invDate,
      blNumber: blNo,
      shippingBillNo: sbNo,
      netWeight: netW,
      grossWeight: grossW,
      transitClause: tc,
      containers: parsedContainers,
      commentLabel: cLabel,
      commentValue: cVal,
      watermark: wm,
      documentTitle: titleCandidate || 'W & Q CERTIFICATE',
    };
  };

  // Form State
  const initialParsed = useMemo(() => parseFields(initialData), [initialData]);

  const [documentTitle, setDocumentTitle] = useState(initialParsed.documentTitle);
  const [watermark, setWatermark] = useState(initialParsed.watermark);

  const [sellerDetails, setSellerDetails] = useState(initialParsed.sellerDetails);
  const [sellerName, setSellerName] = useState(initialParsed.sellerName);

  const [consigneeDetails, setConsigneeDetails] = useState(initialParsed.consigneeDetails);
  const [consigneeName, setConsigneeName] = useState(initialParsed.consigneeName);

  const [notifyParty1, setNotifyParty1] = useState(initialParsed.notifyParty1);
  const [notifyParty2, setNotifyParty2] = useState(initialParsed.notifyParty2);
  const [notifyParty3, setNotifyParty3] = useState(initialParsed.notifyParty3);

  const [productName, setProductName] = useState(initialParsed.productName);
  const [hsnCode, setHsnCode] = useState(initialParsed.hsnCode);
  const [originCountry, setOriginCountry] = useState(initialParsed.originCountry);

  const [fclType, setFclType] = useState(initialParsed.fclType);
  const [packingType, setPackingType] = useState(initialParsed.packingType);
  const [portOfLoading, setPortOfLoading] = useState(initialParsed.portOfLoading);
  const [portOfDischarge, setPortOfDischarge] = useState(initialParsed.portOfDischarge);

  const [fclQuantity, setFclQuantity] = useState(initialParsed.fclQuantity);
  const [fclCapacity, setFclCapacity] = useState(initialParsed.fclCapacity);
  const [mtQty, setMtQty] = useState(initialParsed.mtQty);
  const [bagQty, setBagQty] = useState(initialParsed.bagQty);

  const [markingBrand, setMarkingBrand] = useState(initialParsed.markingBrand);
  const [preCarriageBy, setPreCarriageBy] = useState(initialParsed.preCarriageBy);
  const [vesselName, setVesselName] = useState(initialParsed.vesselName);
  const [voyageNumber, setVoyageNumber] = useState(initialParsed.voyageNumber);
  const [invoiceNumber, setInvoiceNumber] = useState(initialParsed.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initialParsed.invoiceDate);
  const [blNumber, setBlNumber] = useState(initialParsed.blNumber);
  const [shippingBillNo, setShippingBillNo] = useState(initialParsed.shippingBillNo);

  const [netWeight, setNetWeight] = useState(initialParsed.netWeight);
  const [grossWeight, setGrossWeight] = useState(initialParsed.grossWeight);
  const [transitClause, setTransitClause] = useState(initialParsed.transitClause);

  const [containers, setContainers] = useState<ContainerRowItem[]>(initialParsed.containers);

  const [commentLabel, setCommentLabel] = useState(initialParsed.commentLabel);
  const [commentValue, setCommentValue] = useState(initialParsed.commentValue);

  // Sync state when initialData or dataVersion updates externally
  useEffect(() => {
    if (!initialData || typeof initialData !== 'object') return;
    const curDocId = sanitizeDocId(
      initialData.id ||
      initialData._id ||
      initialData.wq_certificate_id ||
      initialData.wq_id
    );

    if (isUserDirtyRef.current && curDocId && curDocId === lastLoadedDocIdRef.current) {
      return;
    }

    lastLoadedDocIdRef.current = curDocId || lastLoadedDocIdRef.current;
    isUserDirtyRef.current = false;
    setIsDirty(false);
    setHasDraftChanges(false);
    setHasSubmitChanges(false);

    const parsed = parseFields(initialData);

    setDocumentTitle(parsed.documentTitle);
    setWatermark(parsed.watermark);
    setSellerDetails(parsed.sellerDetails);
    setSellerName(parsed.sellerName);
    setConsigneeDetails(parsed.consigneeDetails);
    setConsigneeName(parsed.consigneeName);
    setNotifyParty1(parsed.notifyParty1);
    setNotifyParty2(parsed.notifyParty2);
    setNotifyParty3(parsed.notifyParty3);
    setProductName(parsed.productName);
    setHsnCode(parsed.hsnCode);
    setOriginCountry(parsed.originCountry);
    setFclType(parsed.fclType);
    setPackingType(parsed.packingType);
    setPortOfLoading(parsed.portOfLoading);
    setPortOfDischarge(parsed.portOfDischarge);
    setFclQuantity(parsed.fclQuantity);
    setFclCapacity(parsed.fclCapacity);
    setMtQty(parsed.mtQty);
    setBagQty(parsed.bagQty);
    setMarkingBrand(parsed.markingBrand);
    setPreCarriageBy(parsed.preCarriageBy);
    setVesselName(parsed.vesselName);
    setVoyageNumber(parsed.voyageNumber);
    setInvoiceNumber(parsed.invoiceNumber);
    setInvoiceDate(parsed.invoiceDate);
    setBlNumber(parsed.blNumber);
    setShippingBillNo(parsed.shippingBillNo);
    setNetWeight(parsed.netWeight);
    setGrossWeight(parsed.grossWeight);
    setTransitClause(parsed.transitClause);
    setContainers(parsed.containers);
    setCommentLabel(parsed.commentLabel);
    setCommentValue(parsed.commentValue);
  }, [initialData, dataVersion]);

  // Construct standard payload for Save Draft / Submit
  const getWqCertificatePayload = useCallback(() => {
    const payload: any = {
      // Document Identifiers
      id: getOwnWqCertificateId() || undefined,
      wq_certificate_id: getOwnWqCertificateId() || undefined,
      parent_id: getEffectiveWqCertificateId() || undefined,
      contract_id: contractId || initialData?.contract_id,
      confirmation_id: confirmationId || initialData?.confirmation_id,
      proforma_id: proformaId || initialData?.proforma_id,
      shipment_instruction_id: shipmentInstructionId || initialData?.shipment_instruction_id,
      custom_invoice_id: customInvoiceId || initialData?.custom_invoice_id,
      commercial_invoice_id: commercialInvoiceId || initialData?.commercial_invoice_id,
      packing_list_id: packingListId || initialData?.packing_list_id,
      phyto_certificate_id: phytoCertificateId || initialData?.phyto_certificate_id,
      fumigation_certificate_id: fumigationCertificateId || initialData?.fumigation_certificate_id,
      certificate_of_origin_id: certificateOfOriginId || initialData?.certificate_of_origin_id,

      // Header (Canva Image 1)
      document_title: documentTitle.trim() || 'W & Q CERTIFICATE',
      pdf_title: documentTitle.trim() || 'W & Q CERTIFICATE',
      title: documentTitle.trim() || 'W & Q CERTIFICATE',
      watermark: Boolean(watermark),
      is_watermark_enabled: Boolean(watermark),

      // Parties (Canva Image 1)
      seller_name: sellerName,
      seller_details: sellerDetails,
      seller_address: sellerDetails,
      consignee_name: consigneeName,
      consignee_details: consigneeDetails,
      consignee_address: consigneeDetails,
      notify_party_1: notifyParty1,
      notify_party_2: notifyParty2,
      notify_party_3: notifyParty3,

      // Product & Origin (Canva Image 1)
      product_name: productName,
      product: productName,
      hsn_code: hsnCode,
      country_of_origin: originCountry,
      origin_country: originCountry,

      // Shipment & Ports (Canva Image 2)
      fcl_type: fclType,
      ship_by: initialData?.ship_by || fclType,
      packing_type: packingType,
      port_of_loading: portOfLoading,
      port_of_discharge: portOfDischarge,

      // Summary quantities (Canva Image 2)
      fcl_quantity: fclQuantity,
      fcl_capacity: fclCapacity,
      mt_qty: mtQty,
      bag_qty: bagQty,
      bag_quantity: bagQty,
      total_bags: bagQty,

      // Marks & Details (Canva Images 2 & 3)
      marking_brand: markingBrand,
      pre_carriage_by: preCarriageBy,
      vessel_name: vesselName,
      voyage_number: voyageNumber,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      bl_number: blNumber,
      shipping_bill_no: shippingBillNo,
      shipping_bill_number: shippingBillNo,
      net_weight: netWeight,
      gross_weight: grossWeight,
      transit_clause: transitClause,

      // Containers (Canva Image 3)
      containers: containers.map((c) => ({
        container_number: c.containerNumber,
        containerNumber: c.containerNumber,
        seal_number: c.sealNumber,
        sealNumber: c.sealNumber,
        gross_weight: c.grossWeight,
        grossWeight: c.grossWeight,
        net_weight: c.netWeight,
        netWeight: c.netWeight,
        bags: c.bags,
      })),

      // Comments (Canva Image 3)
      comment_label: commentLabel.trim().slice(0, 20),
      comment_title: commentLabel.trim().slice(0, 20),
      notes_title: commentLabel.trim().slice(0, 20),
      comment_value: commentValue.trim(),
      comment_text: commentValue.trim(),
      notes_comment: commentValue.trim(),
      comment: commentValue.trim(),
      notes:
        commentLabel.trim() || commentValue.trim()
          ? [{ id: '1', title: commentLabel.trim().slice(0, 20), comment: commentValue.trim() }]
          : [],
    };

    return payload;
  }, [
    getOwnWqCertificateId,
    getEffectiveWqCertificateId,
    contractId,
    confirmationId,
    proformaId,
    shipmentInstructionId,
    customInvoiceId,
    commercialInvoiceId,
    packingListId,
    phytoCertificateId,
    fumigationCertificateId,
    certificateOfOriginId,
    initialData,
    documentTitle,
    watermark,
    sellerName,
    sellerDetails,
    consigneeName,
    consigneeDetails,
    notifyParty1,
    notifyParty2,
    notifyParty3,
    productName,
    hsnCode,
    originCountry,
    fclType,
    packingType,
    portOfLoading,
    portOfDischarge,
    fclQuantity,
    fclCapacity,
    mtQty,
    bagQty,
    markingBrand,
    preCarriageBy,
    vesselName,
    voyageNumber,
    invoiceNumber,
    invoiceDate,
    blNumber,
    shippingBillNo,
    netWeight,
    grossWeight,
    transitClause,
    containers,
    commentLabel,
    commentValue,
  ]);

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({});

    try {
      const payload = getWqCertificatePayload();
      const currentOwnId = getOwnWqCertificateId();
      let res: any;

      if (onSaveDraft) {
        res = await onSaveDraft(payload);
      } else {
        res = await saveWqCertificateDraftAction(payload, lang, currentOwnId || undefined);
      }

      if (res?.success) {
        toast.success(
          res.message ||
            dict?.smart_docs?.draft_saved_success ||
            'W & Q Certificate saved as draft successfully!'
        );
        isUserDirtyRef.current = false;
        setIsDirty(false);
        setHasDraftChanges(false);

        const newId = sanitizeDocId(
          res.id ||
          res.wq_certificate_id ||
          res.data?.id ||
          res.data?.wq_certificate_id ||
          currentOwnId
        );

        if (newId) {
          lastLoadedDocIdRef.current = newId;
          setDraftId(newId);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('id', newId);
            url.searchParams.set('step', 'wq-certificate');
            window.history.replaceState(null, '', url.toString());
          }
          if (onSaveSuccess) {
            onSaveSuccess(newId, {
              ...payload,
              ...(typeof res.data === 'object' && res.data !== null ? res.data : {}),
              id: newId,
              wq_certificate_id: newId,
            });
          }
        }
      } else {
        toast.error(res?.message || res?.error || 'Failed to save W & Q Certificate draft');
        if (res?.errors && typeof res.errors === 'object') {
          setErrors(res.errors);
        }
      }
    } catch (err: any) {
      console.error('[WqCertificateDocumentForm] Save draft error:', err);
      toast.error(err?.message || 'Network error occurred while saving draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Workflow button label info (e.g. "Submit")
  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'wq_certificate',
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, dict]);

  // Submit Handler
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft || readOnly) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = getWqCertificatePayload();
      const currentOwnId = getOwnWqCertificateId();

      let res: any;
      if (onSubmitWqCertificate) {
        res = await onSubmitWqCertificate(payload, currentOwnId || undefined, submitInfo.nextStep);
      } else {
        res = await submitWqCertificateAction(payload, lang, currentOwnId || undefined);
      }

      if (res?.success) {
        toast.success(
          res.message ||
            dict?.smart_docs?.submitted_success ||
            'W & Q Certificate submitted successfully!'
        );
        isUserDirtyRef.current = false;
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(false);

        const newId = sanitizeDocId(
          res.id ||
          res.wq_certificate_id ||
          res.data?.id ||
          res.data?.wq_certificate_id ||
          currentOwnId
        );
        if (newId) {
          lastLoadedDocIdRef.current = newId;
          setDraftId(newId);
        }

        // When onSubmitWqCertificate is provided, parent workspace handles stepper advance & navigation.
        if (!onSubmitWqCertificate) {
          if (newId && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('id', newId);
            window.history.replaceState(null, '', url.toString());
          }
          if (onUpdateSteps && steps) {
            const nextStepToSelect = submitInfo.nextStep;
            const updatedSteps = steps.map((s) => {
              if (isWqCertificateStep(s)) {
                return {
                  ...s,
                  status: 'completed',
                  redirect_id: newId || s.redirect_id,
                  redirectId: newId || s.redirectId,
                  is_enabled: true,
                  isEnabled: true,
                  is_locked: false,
                  locked: false,
                };
              }
              if (nextStepToSelect && isSameWorkflowStep(s, nextStepToSelect)) {
                return {
                  ...s,
                  is_enabled: true,
                  isEnabled: true,
                  is_locked: false,
                  locked: false,
                };
              }
              return s;
            });
            onUpdateSteps(updatedSteps);

            if (nextStepToSelect && onSelectStep) {
              const enabledNextStep: StepperDocumentItem = {
                ...nextStepToSelect,
                is_enabled: true,
                isEnabled: true,
                is_locked: false,
                locked: false,
              };
              onSelectStep(enabledNextStep);
            }
          }
        }
        return res;
      } else {
        toast.error(res?.message || res?.error || 'Failed to submit W & Q Certificate');
        if (res?.errors && typeof res.errors === 'object') {
          setErrors(res.errors);
        }
      }
    } catch (err: any) {
      console.error('[WqCertificateDocumentForm] Submit error:', err);
      toast.error(err?.message || 'Network error occurred while submitting W & Q Certificate');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Print Preview
  const handlePrintPreview = async () => {
    let effectiveId = getOwnWqCertificateId();

    if (!effectiveId || isDirty || hasDraftChanges) {
      setIsSavingDraft(true);
      try {
        const payload = getWqCertificatePayload();
        let saveRes: any;
        if (onSaveDraft) {
          saveRes = await onSaveDraft(payload);
        } else {
          saveRes = await saveWqCertificateDraftAction(payload, lang, effectiveId || undefined);
        }
        if (saveRes?.success) {
          const newId = sanitizeDocId(
            saveRes.id ||
            saveRes.wq_certificate_id ||
            saveRes.data?.id ||
            saveRes.data?.wq_certificate_id ||
            effectiveId
          );
          if (newId) {
            lastLoadedDocIdRef.current = newId;
            setDraftId(newId);
            effectiveId = newId;
            if (onSaveSuccess) {
              onSaveSuccess(newId, {
                ...payload,
                ...(typeof saveRes.data === 'object' && saveRes.data !== null ? saveRes.data : {}),
                id: newId,
                wq_certificate_id: newId,
              });
            }
          }
          isUserDirtyRef.current = false;
          setIsDirty(false);
          setHasDraftChanges(false);
        }
      } catch (saveErr) {
        console.error('[WqCertificateDocumentForm] Auto-save before preview failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectiveWqCertificateId();
    if (!effectiveId) {
      toast.error('Please save the document draft first to preview.');
      return;
    }

    setPreviewDocId(effectiveId);
    setIsPreviewOpen(true);
  };

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    let effectiveId = getOwnWqCertificateId();

    if (!effectiveId || isDirty || hasDraftChanges) {
      setIsSavingDraft(true);
      try {
        const payload = getWqCertificatePayload();
        let saveRes: any;
        if (onSaveDraft) {
          saveRes = await onSaveDraft(payload);
        } else {
          saveRes = await saveWqCertificateDraftAction(payload, lang, effectiveId || undefined);
        }
        if (saveRes?.success) {
          const newId = sanitizeDocId(
            saveRes.id ||
            saveRes.wq_certificate_id ||
            saveRes.data?.id ||
            saveRes.data?.wq_certificate_id ||
            effectiveId
          );
          if (newId) {
            lastLoadedDocIdRef.current = newId;
            setDraftId(newId);
            effectiveId = newId;
            if (onSaveSuccess) {
              onSaveSuccess(newId, {
                ...payload,
                ...(typeof saveRes.data === 'object' && saveRes.data !== null ? saveRes.data : {}),
                id: newId,
                wq_certificate_id: newId,
              });
            }
          }
          isUserDirtyRef.current = false;
          setIsDirty(false);
          setHasDraftChanges(false);
        }
      } catch (saveErr) {
        console.error('[WqCertificateDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectiveWqCertificateId();
    if (!effectiveId) {
      toast.error('Please save the document draft first to download PDF.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const step = getWqCertificateStep(steps, selectedStep);
      const prefix = step?.document_prefix || (step as any)?.documentPrefix || 'wq_certificate';

      const res = await downloadDocPdfAction({
        prefix,
        id: effectiveId,
        lang,
        candidateIds: [effectiveId, getEffectiveWqCertificateId()].filter(Boolean),
        contractId: contractId || initialData?.contract_id,
        confirmationId: confirmationId || initialData?.confirmation_id,
        proformaId: proformaId || initialData?.proforma_id,
        shipmentInstructionId: shipmentInstructionId || initialData?.shipment_instruction_id,
        customInvoiceId: customInvoiceId || initialData?.custom_invoice_id,
        commercialInvoiceId: commercialInvoiceId || initialData?.commercial_invoice_id,
        packingListId: packingListId || initialData?.packing_list_id,
        phytoCertificateId: phytoCertificateId || initialData?.phyto_certificate_id,
        fumigationCertificateId: fumigationCertificateId || initialData?.fumigation_certificate_id,
        certificateOfOriginId: certificateOfOriginId || initialData?.certificate_of_origin_id,
        wqCertificateId: effectiveId,
      });

      if (res?.success) {
        downloadPdfFromActionResponse(res, `WQ-Certificate-${invoiceNumber || effectiveId}.pdf`);
        toast.success('W & Q Certificate PDF downloaded successfully!');
      } else {
        toast.error(res?.message || res?.error || 'Failed to download W & Q Certificate PDF');
      }
    } catch (err: any) {
      console.error('[WqCertificateDocumentForm] Download PDF error:', err);
      toast.error(err?.message || 'Network error occurred while downloading PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div
      id="wq-certificate-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollContainerRef}
        id="wq-certificate-scroll-viewport"
        className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar"
      >
        {/*
          HEADER ROW (Canva Image 1):
          - Center: Editable Document Title with Blue Pencil & Dotted Underline
          - Right: Watermark Toggle Switch
        */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 bg-card">
          {/* Left Spacer so title is centered on desktop */}
          <div className="w-12 sm:w-28 shrink-0 hidden sm:block" />

          {/* Center: Title using DocTitleInput */}
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
            disabled={readOnly}
            placeholder="W & Q CERTIFICATE"
            ariaLabel="Document Title"
            error={errors.documentTitle || errors.document_title || errors.pdf_title}
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Right: WaterMark toggle */}
          <div className="shrink-0 flex items-center justify-end min-w-[120px] sm:w-[140px]">
            <DocToggle
              label="Watermark"
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
          Matches Canva Reference Exactly
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          {/*
            ROW 1: EXPORTER (SELLER) & CONSIGNEE DETAILS (Canva Image 1)
            Split 2 columns
          */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
            {/* EXPORTER (SELLER) */}
            <div
              className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-[140px] justify-start bg-card"
              id="field-sellerDetails"
              data-field="sellerDetails"
            >
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                EXPORTER (SELLER):
              </label>
              <div className="flex-1 min-w-0 flex flex-col gap-1 px-0.5">
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(sellerDetails || sellerName, '-')}
                </div>
              </div>
            </div>

            {/* CONSIGNEE DETAILS */}
            <div
              className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1 min-h-[140px] justify-start bg-card"
              id="field-consigneeDetails"
              data-field="consigneeDetails"
            >
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                CONSIGNEE DETAILS:
              </label>
              <div className="flex-1 min-w-0 flex flex-col gap-1 px-0.5">
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(consigneeDetails || consigneeName, '-')}
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 2: NOTIFY PARTIES (3 Columns: Notify 1, Notify 2, Notify 3) (Canva Image 1)
          */}
          <div className="flex flex-col divide-y divide-border">
            {/* Header Row */}
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

            {/* Values Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div
                className="p-2.5 sm:p-3 flex flex-col gap-1 min-h-[110px] justify-start bg-card"
                id="field-notifyParty1"
                data-field="notifyParty1"
              >
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty1 || '-'}
                </div>
              </div>

              <div
                className="p-2.5 sm:p-3 flex flex-col gap-1 min-h-[110px] justify-start bg-card"
                id="field-notifyParty2"
                data-field="notifyParty2"
              >
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty2 || '-'}
                </div>
              </div>

              <div
                className="p-2.5 sm:p-3 flex flex-col gap-1 min-h-[110px] justify-start bg-card"
                id="field-notifyParty3"
                data-field="notifyParty3"
              >
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {notifyParty3 || '-'}
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 3: PRODUCT (Canva Image 1)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PRODUCT
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(productName, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 4: HSN CODE (Canva Image 1)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              HSN CODE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {resolveString(hsnCode, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 5: ORIGIN (Canva Image 1)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              ORIGIN
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(originCountry, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 6: FCL TYPE (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              FCL TYPE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {formatFclType(fclType)}
              </span>
            </div>
          </div>

          {/*
            ROW 7: PACKING TYPE (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PACKING TYPE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {resolveString(packingType, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 8: PORT OF LOADING (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PORT OF LOADING
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(portOfLoading, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 9: PORT OF DISCHARGE (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PORT OF DISCHARGE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(portOfDischarge, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 10: 4-COLUMN SUMMARY GRID (Canva Image 2)
            FCL QUANTITY | FCL CAPACITY | MT QTY | BAG QTY
          */}
          <div className="flex flex-col divide-y divide-border">
            {/* Header Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border bg-muted/20">
              <div className="py-2.5 px-2 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                FCL QUANTITY
              </div>
              <div className="py-2.5 px-2 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                FCL CAPACITY
              </div>
              <div className="py-2.5 px-2 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                MT QTY
              </div>
              <div className="py-2.5 px-2 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                BAG QTY
              </div>
            </div>

            {/* Values Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide select-all">
                  {resolveString(fclQuantity, '-')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide select-all">
                  {resolveString(fclCapacity, '-')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide select-all">
                  {resolveString(mtQty, '-')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide select-all">
                  {resolveString(bagQty, '-')}
                </span>
              </div>
            </div>
          </div>

          {/*
            ROW 11: MARKING BRAND (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              MARKING BRAND
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(markingBrand, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 12: PRE CARRIAGE BY (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PRE CARRIAGE BY
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(preCarriageBy, 'BY SEA')}
              </span>
            </div>
          </div>

          {/*
            ROW 13: VESSEL NAME (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              VESSEL NAME
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(vesselName, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 14: VOYAGE NUMBER (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              VOYAGE NUMBER
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(voyageNumber, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 15: INVOICE NUMBER (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              INVOICE NUMBER
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(invoiceNumber, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 16: INVOICE DATE (Canva Image 2)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              INVOICE DATE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {resolveString(invoiceDate, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 17: BL NUMBER (Canva Image 2 & 3)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              BL NUMBER
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(blNumber, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 18: SHIPPING BILL NO (Canva Image 3)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              SHIPPING BILL NO
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(shippingBillNo, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 19: NET WEIGHT (Canva Image 3)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              NET WEIGHT
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {resolveString(netWeight, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 20: GROSS WEIGHT (Canva Image 3)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              GROSS WEIGHT
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {resolveString(grossWeight, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 21: TRANSIT CLAUSE (Canva Image 3)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              TRANSIT CLAUSE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all uppercase">
                {resolveString(transitClause, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 22: CONTAINERS TABLE (Canva Image 3)
            SR NO | CONTAINER NO | SEAL NO | BAGS | GROSS Wt (KG) | NET Wt (KG)
          */}
          <div className="flex flex-col divide-y divide-border" data-field="containersTable">
            {/* Table Header */}
            <div className="grid grid-cols-[0.6fr_1.5fr_1.3fr_0.8fr_1.2fr_1.2fr] divide-x divide-border bg-muted/20 text-center font-bold text-muted-foreground/85 uppercase text-[13px] tracking-wider py-2 sm:py-2.5">
              <div className="px-1 sm:px-2 flex items-center justify-center">SR NO</div>
              <div className="px-1 sm:px-2 flex items-center justify-center">CONTAINER NO</div>
              <div className="px-1 sm:px-2 flex items-center justify-center">SEAL NO</div>
              <div className="px-1 sm:px-2 flex items-center justify-center">BAGS</div>
              <div className="px-1 sm:px-2 flex items-center justify-center">GROSS Wt (KG)</div>
              <div className="px-1 sm:px-2 flex items-center justify-center">NET Wt (KG)</div>
            </div>

            {/* Table Rows */}
            {containers && containers.length > 0 ? (
              containers.map((container, index) => (
                <div
                  key={`container-${index}`}
                  className="grid grid-cols-[0.6fr_1.5fr_1.3fr_0.8fr_1.2fr_1.2fr] divide-x divide-border text-center text-[13px] font-normal text-foreground py-2 sm:py-2.5 hover:bg-muted/10 transition-colors"
                >
                  <div className="px-1 sm:px-2 flex items-center justify-center text-muted-foreground font-medium select-all">
                    {index + 1}
                  </div>
                  <div className="px-1 sm:px-2 flex items-center justify-center uppercase select-all truncate">
                    {container.containerNumber || '-'}
                  </div>
                  <div className="px-1 sm:px-2 flex items-center justify-center uppercase select-all truncate">
                    {container.sealNumber || '-'}
                  </div>
                  <div className="px-1 sm:px-2 flex items-center justify-center select-all">
                    {container.bags || '-'}
                  </div>
                  <div className="px-1 sm:px-2 flex items-center justify-center select-all">
                    {container.grossWeight || '-'}
                  </div>
                  <div className="px-1 sm:px-2 flex items-center justify-center select-all">
                    {container.netWeight || '-'}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-6 divide-x divide-border text-center text-[13px] font-normal text-foreground py-2 sm:py-2.5">
                <div className="col-span-6 py-2 text-center text-muted-foreground select-none">
                  -
                </div>
              </div>
            )}
          </div>

          {/*
            ROW 23: COMMENTS (Enter Title & Enter Comment - Canva Image 3)
            50% Enter Title / 50% Enter Comment
          */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border"
            data-field="commentSection"
          >
            {/* Col 1: Enter Title */}
            <div
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              data-field="commentLabel"
              id="field-commentLabel"
            >
              <DocUnderlineInput
                id="wq-commentLabel-input"
                value={commentLabel}
                maxLength={20}
                disabled={readOnly}
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
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_title ||
                  dict?.smart_docs?.contract_form?.enter_title ||
                  'Enter Title'
                }
                icon="fa-solid fa-pen"
                uppercase={false}
                error={errors.commentLabel || errors.comment_label || errors.comment_title}
                inputClassName="text-[14px] font-normal"
              />
            </div>

            {/* Col 2: Enter Comment */}
            <div
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              data-field="commentValue"
              id="field-commentValue"
            >
              <DocUnderlineInput
                id="wq-commentValue-input"
                value={commentValue}
                disabled={readOnly}
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
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_comment ||
                  dict?.smart_docs?.contract_form?.enter_comment ||
                  'Enter Comment'
                }
                icon="fa-solid fa-pen"
                uppercase={false}
                error={errors.commentValue || errors.comment_value || errors.comment_text}
                inputClassName="text-[14px] font-normal"
              />
            </div>
          </div>
        </div>
      </div>

      {/*
        BOTTOM ACTION BAR:
        Matches other Smart Docs forms exactly
        - Left: Print Preview, Download PDF (destructive outline buttons)
        - Right: Save As Draft (primary outline), Submit (emerald button)
      */}
      <div
        id="wq-certificate-bottom-bar"
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Print Preview & Download PDF */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button */}
          <button
            type="button"
            onClick={handlePrintPreview}
            disabled={isSavingDraft || isSubmitting}
            title="Print Preview"
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-destructive/20"
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
                ? 'W & Q Certificate already submitted'
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
            ) : submitInfo.nextStep ? (
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
            ) : (
              <i className="fa-solid fa-check text-xs transition-transform group-hover:scale-110" />
            )}
          </button>
        </div>
      </div>

      {/* Print Preview Modal */}
      <DocPrintPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDocId('');
          setPreviewHtml(null);
        }}
        prefix="wq_certificate"
        docId={previewDocId || getOwnWqCertificateId() || getEffectiveWqCertificateId()}
        candidateIds={[
          previewDocId,
          getOwnWqCertificateId(),
          getEffectiveWqCertificateId(),
          draftId,
          wqCertificateId,
          certificateOfOriginId,
          fumigationCertificateId,
          phytoCertificateId,
          packingListId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        wqCertificateId={previewDocId || getOwnWqCertificateId() || getEffectiveWqCertificateId()}
        certificateOfOriginId={certificateOfOriginId}
        fumigationCertificateId={fumigationCertificateId}
        phytoCertificateId={phytoCertificateId}
        packingListId={packingListId}
        commercialInvoiceId={commercialInvoiceId}
        customInvoiceId={customInvoiceId}
        shipmentInstructionId={shipmentInstructionId}
        proformaId={proformaId}
        contractId={contractId}
        confirmationId={confirmationId}
        docNumber={safeString(invoiceNumber, '')}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default WqCertificateDocumentForm;
