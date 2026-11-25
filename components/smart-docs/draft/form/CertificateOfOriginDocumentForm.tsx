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
  saveCertificateOfOriginDraftAction,
  submitCertificateOfOriginAction,
} from '@/app/actions/smart-docs';
import {
  type StepperDocumentItem,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  extractCertificateOfOriginData,
  getCertificateOfOriginStep,
  extractCertificateOfOriginDocumentStatus,
  isCertificateOfOriginStep,
  isSameWorkflowStep,
  getWorkflowSubmitButtonInfo,
  getStepSelfId,
  extractStepRedirectId,
} from '@/lib/api/smart-docs.service';

export interface CertificateOfOriginDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
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
  onSubmitCertificateOfOrigin?: (
    payload: any,
    id?: string,
    nextStep?: StepperDocumentItem | null
  ) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

export interface NoteRowItem {
  id: string;
  title: string;
  comment: string;
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
 * Guarantees that React will never encounter Minified React error #31.
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
 * Formats FCL type to display without underscores (e.g. FCL_20_FT -> 20 FT FCL or FCL 20 FT).
 */
function formatFclType(val: any): string {
  const str = resolveString(val);
  if (!str || str === '-') return '-';
  const clean = str.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  if (clean === 'FCL 20 FT' || clean === '20 FT FCL' || clean === 'FCL 20FT' || clean === '20FT FCL') {
    return '20 FT FCL';
  }
  if (clean === 'FCL 40 FT' || clean === '40 FT FCL' || clean === 'FCL 40FT' || clean === '40FT FCL') {
    return '40 FT FCL';
  }
  return clean;
}

/**
 * Resolves transit clause value. Formats as:
 * "{transit_clause_value} ({transit_clause_country.name})" (e.g. "TEST CLAUSE (India)")
 * or fallback to any direct transit clause string.
 */
function resolveTransitClause(data: any): string {
  if (!data) return '-';

  // If a full object was passed (e.g. initialData)
  if (typeof data === 'object') {
    const clauseVal =
      data.transit_clause_value ??
      data.transitClauseValue ??
      data.transit_clause_val ??
      data.contract?.transit_clause_value ??
      data.shipment_instruction?.transit_clause_value;

    let countryName = '';
    const countryObj =
      data.transit_clause_country ??
      data.transitClauseCountry ??
      data.contract?.transit_clause_country ??
      data.shipment_instruction?.transit_clause_country;

    if (countryObj) {
      if (typeof countryObj === 'object') {
        countryName = resolveString(countryObj.name || countryObj.country_name || countryObj.label || countryObj.title, '');
      } else if (typeof countryObj === 'string' && countryObj.trim() && !/^\d+$/.test(countryObj.trim())) {
        countryName = countryObj.trim();
      }
    }

    if (clauseVal) {
      const trimmedClause = String(clauseVal).trim();
      if (countryName) {
        return `${trimmedClause} (${countryName})`;
      }
      return trimmedClause;
    }

    // Direct clause string or nested object check
    const rawClause = data.transit_clause ?? data.transit_clause_allowed ?? data.transitClause;
    if (typeof rawClause === 'string') {
      const trimmed = rawClause.trim();
      if (trimmed && !/^(no|false|0|none|-|null|undefined)$/i.test(trimmed)) {
        if (countryName && !trimmed.toLowerCase().includes(countryName.toLowerCase())) {
          return `${trimmed} (${countryName})`;
        }
        return trimmed;
      }
    } else if (typeof rawClause === 'object' && rawClause !== null) {
      const cand = rawClause.text || rawClause.clause || rawClause.name || rawClause.title || rawClause.value;
      if (cand) return resolveTransitClause({ ...data, transit_clause: cand });
    }

    if (countryName) {
      return countryName;
    }
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed || /^(no|false|0|none|-|null|undefined)$/i.test(trimmed)) {
      return '-';
    }
    return trimmed;
  }

  if (typeof data === 'boolean') return data ? 'YES' : '-';
  if (typeof data === 'number') return data === 0 ? '-' : String(data);

  return '-';
}

/**
 * Extracts and normalizes all fields for Certificate of Origin form.
 */
function extractOriginValues(data: any) {
  if (!data || typeof data !== 'object') {
    return {
      sellerName: '',
      sellerDetails: '',
      consigneeName: '',
      consigneeDetails: '',
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
      commentLabel: '',
      commentValue: '',
      watermark: false,
      documentTitle: 'CERTIFICATE OF ORIGIN',
    };
  }

  // Seller
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

  // Consignee
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
    data.hsn_sac
  );
  let orig = '';
  if (data.country_of_origin && typeof data.country_of_origin === 'object') {
    orig = resolveString(data.country_of_origin.name || data.country_of_origin.country_name || data.country_of_origin.title);
  } else {
    orig = resolveString(data.country_of_origin || data.countryOfOrigin || data.origin_country || data.origin);
  }

  // FCL Type
  const rawShipBy = data.ship_by || data.shipBy || data.fcl_type || data.container_size || data.container_type || '';
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

  // Quantities
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
  const vName = resolveString(data.vessel_name || data.vesselName);
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

  // Comments
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

  const wm = Boolean(data.watermark ?? data.is_watermark_enabled ?? data.watermark_enabled ?? false);
  const title = resolveString(data.document_title || data.pdf_title || data.title, 'CERTIFICATE OF ORIGIN');

  return {
    sellerName: sName,
    sellerDetails: sDetails,
    consigneeName: cName,
    consigneeDetails: cDetails,
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
    commentLabel: cLabel,
    commentValue: cVal,
    watermark: wm,
    documentTitle: title,
  };
}

export function CertificateOfOriginDocumentForm({
  initialData,
  dataVersion = 0,
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
  sellers,
  buyers,
  products,
  loadingPorts,
  destinationPorts,
  paymentTerms,
  currencies,
  shippingTerms,
  onSaveDraft,
  onSaveSuccess,
  onSubmitCertificateOfOrigin,
  lang = 'en',
  dict,
  readOnly = false,
}: CertificateOfOriginDocumentFormProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Document identity
  const [draftId, setDraftId] = useState<string>(() => {
    return sanitizeDocId(
      certificateOfOriginId ||
      initialData?.id ||
      initialData?._id ||
      initialData?.certificate_of_origin_id ||
      initialData?.certificateOfOriginId
    );
  });

  const getOwnCertificateOfOriginId = useCallback(() => {
    const sid = sanitizeDocId(
      draftId ||
      certificateOfOriginId ||
      initialData?.id ||
      initialData?._id ||
      initialData?.certificate_of_origin_id ||
      initialData?.certificateOfOriginId
    );
    if (sid && !/^(certificate-of-origin|certificate_of_origin|origin|origin-certificate|null|undefined|nan)$/i.test(sid)) {
      return sid;
    }
    return '';
  }, [draftId, certificateOfOriginId, initialData]);

  const getEffectiveCertificateOfOriginId = useCallback(() => {
    const own = getOwnCertificateOfOriginId();
    if (own) return own;
    const step = getCertificateOfOriginStep(steps, selectedStep);
    const stepId = sanitizeDocId(
      getStepSelfId(step) ||
      extractStepRedirectId(step) ||
      step?.redirect_id ||
      (step as any)?.redirectId ||
      (step as any)?.certificate_of_origin_id
    );
    if (stepId && !/^(certificate-of-origin|certificate_of_origin|origin|origin-certificate|null|undefined|nan)$/i.test(stepId)) {
      return stepId;
    }

    return '';
  }, [
    getOwnCertificateOfOriginId,
    steps,
    selectedStep,
  ]);

  // Document status
  const docStatus = useMemo(() => {
    const step = getCertificateOfOriginStep(steps, selectedStep);
    return extractCertificateOfOriginDocumentStatus(initialData, step);
  }, [initialData, steps, selectedStep]);

  // Initial values parsed from initialData
  const initialValues = useMemo(() => extractOriginValues(initialData), [initialData]);

  // Form States matching Canva UI (Images 1, 2, 3)
  const [documentTitle, setDocumentTitle] = useState(initialValues.documentTitle);
  const [watermark, setWatermark] = useState(initialValues.watermark);

  // Exporter (Seller)
  const [sellerName, setSellerName] = useState(initialValues.sellerName);
  const [sellerDetails, setSellerDetails] = useState(initialValues.sellerDetails);

  // Consignee
  const [consigneeName, setConsigneeName] = useState(initialValues.consigneeName);
  const [consigneeDetails, setConsigneeDetails] = useState(initialValues.consigneeDetails);

  // Notify Parties
  const [notifyParty1, setNotifyParty1] = useState(initialValues.notifyParty1);
  const [notifyParty2, setNotifyParty2] = useState(initialValues.notifyParty2);
  const [notifyParty3, setNotifyParty3] = useState(initialValues.notifyParty3);

  // Product, HSN, Origin
  const [productName, setProductName] = useState(initialValues.productName);
  const [hsnCode, setHsnCode] = useState(initialValues.hsnCode);
  const [originCountry, setOriginCountry] = useState(initialValues.originCountry);

  // Shipment / Packing
  const [fclType, setFclType] = useState(initialValues.fclType);
  const [packingType, setPackingType] = useState(initialValues.packingType);
  const [portOfLoading, setPortOfLoading] = useState(initialValues.portOfLoading);
  const [portOfDischarge, setPortOfDischarge] = useState(initialValues.portOfDischarge);

  // 4-column summary grid (Canva Image 2)
  const [fclQuantity, setFclQuantity] = useState(initialValues.fclQuantity);
  const [fclCapacity, setFclCapacity] = useState(initialValues.fclCapacity);
  const [mtQty, setMtQty] = useState(initialValues.mtQty);
  const [bagQty, setBagQty] = useState(initialValues.bagQty);

  // Shipping & Invoice details (Canva Images 2 & 3)
  const [markingBrand, setMarkingBrand] = useState(initialValues.markingBrand);
  const [preCarriageBy, setPreCarriageBy] = useState(initialValues.preCarriageBy);
  const [vesselName, setVesselName] = useState(initialValues.vesselName);
  const [voyageNumber, setVoyageNumber] = useState(initialValues.voyageNumber);
  const [invoiceNumber, setInvoiceNumber] = useState(initialValues.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(initialValues.invoiceDate);
  const [blNumber, setBlNumber] = useState(initialValues.blNumber);
  const [shippingBillNo, setShippingBillNo] = useState(initialValues.shippingBillNo);
  const [netWeight, setNetWeight] = useState(initialValues.netWeight);
  const [grossWeight, setGrossWeight] = useState(initialValues.grossWeight);
  const [transitClause, setTransitClause] = useState(initialValues.transitClause);

  // Additional Comment Row (Enter Title 1/3 & Enter Comment 2/3 - Canva Image 3 editable fields)
  const [commentLabel, setCommentLabel] = useState<string>(initialValues.commentLabel);
  const [commentValue, setCommentValue] = useState<string>(initialValues.commentValue);

  // Dirty and submission state
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isFormInitializedRef = useRef(false);
  const isUserDirtyRef = useRef(false);
  const isDraftSavedToBackendRef = useRef<boolean>(false);
  const lastLoadedDocIdRef = useRef<string>('');

  const markDirty = useCallback(() => {
    if (!isFormInitializedRef.current) return;
    isUserDirtyRef.current = true;
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Initialize or re-synchronize form from initialData
  useEffect(() => {
    if (!initialData || typeof initialData !== 'object') {
      if (dataVersion !== undefined && dataVersion !== 0) {
        setCommentLabel('');
        setCommentValue('');
      }
      return;
    }

    const currentDocId = String(
      initialData.id ||
      initialData._id ||
      initialData.certificate_of_origin_id ||
      initialData.certificateOfOriginId ||
      certificateOfOriginId ||
      ''
    ).trim();

    // Prevent clobbering user dirty edits unless dataVersion or currentDocId changed meaningfully
    if (isUserDirtyRef.current && lastLoadedDocIdRef.current === currentDocId && dataVersion === 0) {
      return;
    }

    // Prevent clobbering already initialized form if this doc was just saved and dataVersion hasn't changed
    if (
      isFormInitializedRef.current &&
      lastLoadedDocIdRef.current === currentDocId &&
      currentDocId !== '' &&
      dataVersion === 0
    ) {
      return;
    }

    lastLoadedDocIdRef.current = currentDocId;
    if (currentDocId) {
      setDraftId(currentDocId);
    }

    const extracted = extractOriginValues(initialData);
    setDocumentTitle((prev) => extracted.documentTitle || prev || 'CERTIFICATE OF ORIGIN');
    if (initialData.watermark !== undefined || initialData.is_watermark_enabled !== undefined) {
      setWatermark(extracted.watermark);
    }
    setSellerName((prev) => extracted.sellerName || prev);
    setSellerDetails((prev) => extracted.sellerDetails || prev);
    setConsigneeName((prev) => extracted.consigneeName || prev);
    setConsigneeDetails((prev) => extracted.consigneeDetails || prev);
    setNotifyParty1((prev) => (extracted.notifyParty1 && extracted.notifyParty1 !== '-' ? extracted.notifyParty1 : prev || '-'));
    setNotifyParty2((prev) => (extracted.notifyParty2 && extracted.notifyParty2 !== '-' ? extracted.notifyParty2 : prev || '-'));
    setNotifyParty3((prev) => (extracted.notifyParty3 && extracted.notifyParty3 !== '-' ? extracted.notifyParty3 : prev || '-'));
    setProductName((prev) => extracted.productName || prev);
    setHsnCode((prev) => extracted.hsnCode || prev);
    setOriginCountry((prev) => extracted.originCountry || prev);
    setFclType((prev) => (extracted.fclType && extracted.fclType !== '-' ? extracted.fclType : prev));
    setPackingType((prev) => extracted.packingType || prev);
    setPortOfLoading((prev) => extracted.portOfLoading || prev);
    setPortOfDischarge((prev) => extracted.portOfDischarge || prev);
    setFclQuantity((prev) => extracted.fclQuantity || prev);
    setFclCapacity((prev) => extracted.fclCapacity || prev);
    setMtQty((prev) => extracted.mtQty || prev);
    setBagQty((prev) => extracted.bagQty || prev);
    setMarkingBrand((prev) => extracted.markingBrand || prev);
    setPreCarriageBy((prev) => extracted.preCarriageBy || prev || 'BY SEA');
    setVesselName((prev) => extracted.vesselName || prev);
    setVoyageNumber((prev) => extracted.voyageNumber || prev);
    setInvoiceNumber((prev) => extracted.invoiceNumber || prev);
    setInvoiceDate((prev) => (extracted.invoiceDate && extracted.invoiceDate !== '-' ? extracted.invoiceDate : prev));
    setBlNumber((prev) => extracted.blNumber || prev);
    setShippingBillNo((prev) => extracted.shippingBillNo || prev);
    setNetWeight((prev) => extracted.netWeight || prev);
    setGrossWeight((prev) => extracted.grossWeight || prev);
    setTransitClause((prev) => (extracted.transitClause && extracted.transitClause !== '-' ? extracted.transitClause : prev || '-'));
    if (extracted.commentLabel !== undefined) setCommentLabel(extracted.commentLabel);
    if (extracted.commentValue !== undefined) setCommentValue(extracted.commentValue);

    isFormInitializedRef.current = true;
    isUserDirtyRef.current = false;
    isDraftSavedToBackendRef.current = true;
    setIsDirty(false);
    setHasDraftChanges(false);
  }, [initialData, dataVersion, certificateOfOriginId]);

  // Construct Payload
  const getCertificateOfOriginPayload = useCallback(() => {
    const payload: Record<string, any> = {
      id: getOwnCertificateOfOriginId() || getEffectiveCertificateOfOriginId() || undefined,
      certificate_of_origin_id: getOwnCertificateOfOriginId() || getEffectiveCertificateOfOriginId() || undefined,
      fumigation_certificate_id: fumigationCertificateId || undefined,
      phyto_certificate_id: phytoCertificateId || undefined,
      packing_list_id: packingListId || undefined,
      commercial_invoice_id: commercialInvoiceId || undefined,
      custom_invoice_id: customInvoiceId || undefined,
      shipment_instruction_id: shipmentInstructionId || undefined,
      proforma_id: proformaId || undefined,
      contract_id: contractId || undefined,
      confirmation_id: confirmationId || undefined,

      document_title: documentTitle.trim() || 'CERTIFICATE OF ORIGIN',
      pdf_title: documentTitle.trim() || 'CERTIFICATE OF ORIGIN',
      watermark: watermark,
      is_watermark_enabled: watermark,
      watermark_enabled: watermark,

      // Exporter
      seller_name: sellerName.trim() || (sellerDetails ? sellerDetails.split('\n')[0]?.trim() : ''),
      seller_company_name: sellerName.trim() || (sellerDetails ? sellerDetails.split('\n')[0]?.trim() : ''),
      exporter: sellerName.trim() || (sellerDetails ? sellerDetails.split('\n')[0]?.trim() : ''),
      seller_details: sellerDetails.trim(),
      seller_instruction: sellerDetails.trim(),
      seller_address: sellerDetails.trim(),
      exporter_address: sellerDetails.trim(),

      // Consignee
      consignee_name: consigneeName.trim() || (consigneeDetails ? consigneeDetails.split('\n')[0]?.trim() : ''),
      consignee: consigneeName.trim() || (consigneeDetails ? consigneeDetails.split('\n')[0]?.trim() : ''),
      consignee_details: consigneeDetails.trim(),
      consignee_address: consigneeDetails.trim(),

      // Notify Parties
      notify_party_1: notifyParty1 !== '-' ? notifyParty1.trim() : '',
      notify_party_2: notifyParty2 !== '-' ? notifyParty2.trim() : '',
      notify_party_3: notifyParty3 !== '-' ? notifyParty3.trim() : '',

      // Product & Shipment
      product: productName.trim(),
      product_name: productName.trim(),
      goods_description: productName.trim(),
      hsn_code: hsnCode.trim(),
      origin: originCountry.trim(),
      country_of_origin: originCountry.trim(),
      fcl_type: fclType.trim(),
      ship_by: initialData?.ship_by || fclType.trim(),
      packing_type: packingType.trim(),
      port_of_loading: portOfLoading.trim(),
      port_of_discharge: portOfDischarge.trim(),

      // Summary grid (Image 2)
      fcl_quantity: fclQuantity.trim(),
      fcl_capacity: fclCapacity.trim(),
      mt_qty: mtQty.trim(),
      bag_qty: bagQty.trim(),
      bag_quantity: bagQty.trim(),
      total_bags: bagQty.trim(),

      // Marks & Details (Images 2 & 3)
      marking_brand: markingBrand.trim(),
      pre_carriage_by: preCarriageBy.trim(),
      vessel_name: vesselName.trim(),
      voyage_number: voyageNumber.trim(),
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate.trim(),
      bl_number: blNumber.trim(),
      shipping_bill_no: shippingBillNo.trim(),
      shipping_bill_number: shippingBillNo.trim(),
      net_weight: netWeight.trim(),
      gross_weight: grossWeight.trim(),
      transit_clause: transitClause.trim(),

      // Comments (Image 3)
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
    getOwnCertificateOfOriginId,
    getEffectiveCertificateOfOriginId,
    fumigationCertificateId,
    phytoCertificateId,
    packingListId,
    commercialInvoiceId,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
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
    commentLabel,
    commentValue,
  ]);

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({});

    try {
      const payload = getCertificateOfOriginPayload();
      const currentOwnId = getOwnCertificateOfOriginId();
      let res: any;

      if (onSaveDraft) {
        res = await onSaveDraft(payload);
      } else {
        res = await saveCertificateOfOriginDraftAction(payload, lang, currentOwnId || undefined);
      }

      if (res?.success) {
        toast.success(
          res.message ||
            dict?.smart_docs?.draft_saved_success ||
            'Certificate of Origin saved as draft successfully!'
        );
        isUserDirtyRef.current = false;
        setIsDirty(false);
        setHasDraftChanges(false);

        const newId = sanitizeDocId(
          res.id ||
          res.certificate_of_origin_id ||
          res.data?.id ||
          res.data?.certificate_of_origin_id ||
          currentOwnId
        );

        if (newId) {
          lastLoadedDocIdRef.current = newId;
          setDraftId(newId);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('id', newId);
            url.searchParams.set('step', 'certificate-of-origin');
            window.history.replaceState(null, '', url.toString());
          }
          if (onSaveSuccess) {
            onSaveSuccess(newId, {
              ...payload,
              ...(typeof res.data === 'object' && res.data !== null ? res.data : {}),
              id: newId,
              certificate_of_origin_id: newId,
            });
          }
        }
      } else {
        toast.error(res?.message || res?.error || 'Failed to save Certificate of Origin draft');
        if (res?.errors && typeof res.errors === 'object') {
          setErrors(res.errors);
        }
      }
    } catch (err: any) {
      console.error('[CertificateOfOriginDocumentForm] Save draft error:', err);
      toast.error(err?.message || 'Network error occurred while saving draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft || readOnly) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = getCertificateOfOriginPayload();
      const currentOwnId = getOwnCertificateOfOriginId();

      let res: any;
      if (onSubmitCertificateOfOrigin) {
        res = await onSubmitCertificateOfOrigin(payload, currentOwnId || undefined, submitInfo.nextStep);
      } else {
        res = await submitCertificateOfOriginAction(payload, lang, currentOwnId || undefined);
      }

      if (res?.success) {
        toast.success(
          res.message ||
            dict?.smart_docs?.submitted_success ||
            'Certificate of Origin submitted successfully!'
        );
        isUserDirtyRef.current = false;
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(false);

        const newId = sanitizeDocId(
          res.id ||
          res.certificate_of_origin_id ||
          res.data?.id ||
          res.data?.certificate_of_origin_id ||
          currentOwnId
        );
        if (newId) {
          lastLoadedDocIdRef.current = newId;
          setDraftId(newId);
        }

        // When onSubmitCertificateOfOrigin is provided, DocumentDraftWorkspace orchestrates
        // step advance, stepper refresh, and transition to the next document.
        // Fall back to local stepper advancement only in standalone mode without parent workspace:
        if (!onSubmitCertificateOfOrigin) {
          if (newId && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('id', newId);
            window.history.replaceState(null, '', url.toString());
          }
          if (onUpdateSteps && steps) {
            const nextStepToSelect = submitInfo.nextStep;
            const updatedSteps = steps.map((s) => {
              if (isCertificateOfOriginStep(s)) {
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
        toast.error(res?.message || res?.error || 'Failed to submit Certificate of Origin');
        if (res?.errors && typeof res.errors === 'object') {
          setErrors(res.errors);
        }
      }
    } catch (err: any) {
      console.error('[CertificateOfOriginDocumentForm] Submit error:', err);
      toast.error(err?.message || 'Network error occurred while submitting Certificate of Origin');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Workflow button label info (e.g. "Submit To W & Q Certificate")
  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'certificate_of_origin',
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, dict]);

  // Handle Print Preview
  const handlePrintPreview = async () => {
    let effectiveId = getOwnCertificateOfOriginId();

    if (!effectiveId || isDirty || hasDraftChanges) {
      setIsSavingDraft(true);
      try {
        const payload = getCertificateOfOriginPayload();
        let saveRes: any;
        if (onSaveDraft) {
          saveRes = await onSaveDraft(payload);
        } else {
          saveRes = await saveCertificateOfOriginDraftAction(payload, lang, effectiveId || undefined);
        }
        if (saveRes?.success) {
          const newId = sanitizeDocId(
            saveRes.id ||
            saveRes.certificate_of_origin_id ||
            saveRes.data?.id ||
            saveRes.data?.certificate_of_origin_id ||
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
                certificate_of_origin_id: newId,
              });
            }
          }
          isUserDirtyRef.current = false;
          setIsDirty(false);
          setHasDraftChanges(false);
        }
      } catch (saveErr) {
        console.error('[CertificateOfOriginDocumentForm] Auto-save before preview failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectiveCertificateOfOriginId();

    if (!effectiveId) {
      toast.error('Please save as draft first before previewing.');
      return;
    }

    setPreviewDocId(effectiveId);
    setIsPrintPreviewOpen(true);
  };

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;

    let effectiveId = getOwnCertificateOfOriginId();

    if (!effectiveId || isDirty || hasDraftChanges) {
      setIsSavingDraft(true);
      try {
        const payload = getCertificateOfOriginPayload();
        let saveRes: any;
        if (onSaveDraft) {
          saveRes = await onSaveDraft(payload);
        } else {
          saveRes = await saveCertificateOfOriginDraftAction(payload, lang, effectiveId || undefined);
        }
        if (saveRes?.success) {
          const newId = sanitizeDocId(
            saveRes.id ||
            saveRes.certificate_of_origin_id ||
            saveRes.data?.id ||
            saveRes.data?.certificate_of_origin_id ||
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
                certificate_of_origin_id: newId,
              });
            }
          }
          isUserDirtyRef.current = false;
          setIsDirty(false);
          setHasDraftChanges(false);
        }
      } catch (saveErr) {
        console.error('[CertificateOfOriginDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectiveCertificateOfOriginId();

    if (!effectiveId) {
      toast.error('Please save as draft first before downloading PDF.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const ownId = getOwnCertificateOfOriginId();
      const res = await downloadDocPdfAction({
        prefix: 'certificate_of_origin',
        id: ownId || effectiveId,
        certificateOfOriginId: ownId || effectiveId,
        candidateIds: [
          ownId,
          effectiveId,
          draftId,
          fumigationCertificateId,
          phytoCertificateId,
          packingListId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x)),
        fumigationCertificateId,
        phytoCertificateId,
        packingListId,
        commercialInvoiceId,
        customInvoiceId,
        shipmentInstructionId,
        proformaId,
        contractId,
        confirmationId,
        lang,
      });

      if (res?.success) {
        downloadPdfFromActionResponse(res, `Certificate-Of-Origin-${invoiceNumber || effectiveId}.pdf`);
        toast.success('Certificate of Origin PDF downloaded successfully!');
      } else {
        toast.error(res?.message || res?.error || 'Failed to download Certificate of Origin PDF');
      }
    } catch (err: any) {
      console.error('[CertificateOfOriginDocumentForm] Download PDF error:', err);
      toast.error(err?.message || 'Network error occurred while downloading PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div
      id="certificate-of-origin-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollContainerRef}
        id="certificate-of-origin-scroll-viewport"
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
            placeholder="CERTIFICATE OF ORIGIN"
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
              <div className="p-2.5 sm:p-3 flex flex-col justify-start">
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(notifyParty1, '-')}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 flex flex-col justify-start">
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(notifyParty2, '-')}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 flex flex-col justify-start">
                <div className="text-[14px] font-normal text-foreground tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(notifyParty3, '-')}
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
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
              <span className="font-normal text-[14px] text-foreground tracking-wide select-all">
                {resolveTransitClause(transitClause)}
              </span>
            </div>
          </div>

          {/*
            ROW 22: COMMENTS (Enter Title 1/3 & Enter Comment 2/3 - Canva Image 3)
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
                id="origin-commentLabel-input"
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

            <div
              className="sm:col-span-2 py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              data-field="commentValue"
              id="field-commentValue"
            >
              <DocUnderlineInput
                id="origin-commentValue-input"
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
        Matches other Smart Docs forms (Fumigation / Phyto / Packing List) exactly
        - Left: Print Preview, Download PDF (Red destructive outline buttons)
        - Right: Save As Draft, Submit
      */}
      <div
        id="certificate-of-origin-bottom-bar"
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
                ? 'Certificate of Origin already submitted'
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
        prefix="certificate_of_origin"
        docId={previewDocId || getOwnCertificateOfOriginId() || getEffectiveCertificateOfOriginId()}
        candidateIds={[
          previewDocId,
          getOwnCertificateOfOriginId(),
          getEffectiveCertificateOfOriginId(),
          draftId,
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
        certificateOfOriginId={previewDocId || getOwnCertificateOfOriginId() || getEffectiveCertificateOfOriginId()}
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

export default CertificateOfOriginDocumentForm;
