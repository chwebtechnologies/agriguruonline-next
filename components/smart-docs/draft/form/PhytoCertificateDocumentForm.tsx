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
  savePhytoCertificateDraftAction,
  submitPhytoCertificateAction,
} from '@/app/actions/smart-docs';
import {
  type StepperDocumentItem,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  extractPhytoCertificateData,
  getPhytoCertificateStep,
  extractPhytoCertificateDocumentStatus,
  isPhytoCertificateStep,
  getWorkflowSubmitButtonInfo,
  getStepSelfId,
  extractStepRedirectId,
} from '@/lib/api/smart-docs.service';

export interface PhytoCertificateDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
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
  onSubmitPhytoCertificate?: (
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
 * Guarantees that React will never encounter Minified React error #31
 * ("Objects are not valid as a React child (found: object with keys {name})").
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

/**
 * Formats FCL type to display without underscores (e.g. FCL_20_FT -> FCL 20 FT).
 */
function formatFclType(val: any): string {
  const str = resolveString(val);
  if (!str || str === '-') return '-';
  return str.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Resolves transit clause value. If not present or 'No'/'false', returns '-' instead of 'NO'.
 */
function resolveTransitClause(val: any): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'YES' : '-';
  if (typeof val === 'number') return val === 0 ? '-' : String(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || /^(no|false|0|none|-|null|undefined)$/i.test(trimmed)) {
      return '-';
    }
    return trimmed;
  }
  if (typeof val === 'object') {
    const cand = val.text || val.clause || val.name || val.title || val.value;
    if (cand) return resolveTransitClause(cand);
  }
  return '-';
}

export function PhytoCertificateDocumentForm({
  initialData,
  dataVersion = 0,
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
  onSubmitPhytoCertificate,
  lang = 'en',
  dict,
  readOnly = false,
}: PhytoCertificateDocumentFormProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Document identity
  const [draftId, setDraftId] = useState<string>(() => {
    return sanitizeDocId(
      phytoCertificateId ||
      initialData?.id ||
      initialData?._id ||
      initialData?.phyto_certificate_id ||
      initialData?.phytoCertificateId
    );
  });

  const getOwnPhytoId = useCallback(() => {
    const sid = sanitizeDocId(
      draftId ||
      phytoCertificateId ||
      initialData?.id ||
      initialData?._id ||
      initialData?.phyto_certificate_id ||
      initialData?.phytoCertificateId
    );
    if (sid && !/^(phyto|phyto-certificate|phyto_certificate|phytosanitary|null|undefined|nan)$/i.test(sid)) {
      return sid;
    }
    return '';
  }, [draftId, phytoCertificateId, initialData]);

  const getEffectivePhytoId = useCallback(() => {
    const own = getOwnPhytoId();
    if (own) return own;
    const step = getPhytoCertificateStep(steps, selectedStep);
    const stepId = sanitizeDocId(
      getStepSelfId(step) ||
      extractStepRedirectId(step) ||
      step?.redirect_id ||
      (step as any)?.redirectId ||
      (step as any)?.phyto_certificate_id
    );
    if (stepId && !/^(phyto|phyto-certificate|phyto_certificate|phytosanitary|null|undefined|nan)$/i.test(stepId)) {
      return stepId;
    }

    for (const fallbackId of [
      packingListId,
      commercialInvoiceId,
      customInvoiceId,
      shipmentInstructionId,
      proformaId,
      contractId,
      confirmationId,
    ]) {
      const clean = sanitizeDocId(fallbackId);
      if (clean && !/^(phyto|phyto-certificate|phyto_certificate|phytosanitary|null|undefined|nan)$/i.test(clean)) {
        return clean;
      }
    }

    return '';
  }, [
    getOwnPhytoId,
    steps,
    selectedStep,
    packingListId,
    commercialInvoiceId,
    customInvoiceId,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
  ]);

  // Document status
  const docStatus = useMemo(() => {
    const step = getPhytoCertificateStep(steps, selectedStep);
    return extractPhytoCertificateDocumentStatus(initialData, step);
  }, [initialData, steps, selectedStep]);

  // Form States matching Canva UI
  const [documentTitle, setDocumentTitle] = useState('PHYTO CERTIFICATE');
  const [watermark, setWatermark] = useState(false);

  // Exporter (Seller)
  const [sellerName, setSellerName] = useState(() =>
    resolveString(
      initialData?.seller_name ||
        initialData?.seller_company_name ||
        initialData?.exporter_name ||
        initialData?.seller?.company_name ||
        initialData?.seller?.name ||
        extractSellerCompanyName(initialData) ||
        initialData?.exporter ||
        initialData?.seller
    )
  );
  const [sellerDetails, setSellerDetails] = useState(() =>
    resolveString(
      initialData?.seller_instruction ||
        initialData?.sellerInstruction ||
        initialData?.seller_details ||
        initialData?.seller_address ||
        initialData?.exporter_address ||
        formatStructuredParty(initialData?.seller) ||
        formatStructuredParty(initialData?.exporter)
    )
  );

  // Consignee
  const [consigneeName, setConsigneeName] = useState(() =>
    resolveString(
      initialData?.consignee_name ||
        initialData?.consignee?.company_name ||
        initialData?.consignee?.name ||
        initialData?.buyer_name ||
        initialData?.buyer?.company_name ||
        initialData?.buyer?.name ||
        extractBuyerInfo(initialData).name ||
        initialData?.consignee ||
        initialData?.buyer
    )
  );
  const [consigneeDetails, setConsigneeDetails] = useState(() =>
    resolveString(
      initialData?.consignee_details ||
        initialData?.consigneeDetails ||
        initialData?.consignee_address ||
        formatStructuredParty(initialData?.consignee) ||
        formatStructuredParty(initialData?.buyer) ||
        initialData?.buyer_instruction
    )
  );

  // Notify Parties
  const [notifyParty1Name, setNotifyParty1Name] = useState('');
  const [notifyParty1Details, setNotifyParty1Details] = useState('');
  const [notifyParty2, setNotifyParty2] = useState('-');
  const [notifyParty3, setNotifyParty3] = useState('-');

  // Product, HSN, Origin
  const [productName, setProductName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [originCountry, setOriginCountry] = useState('');

  // Shipment / Packing
  const [fclType, setFclType] = useState(() =>
    resolveString(
      initialData?.ship_by ||
        initialData?.shipBy ||
        initialData?.fcl_type ||
        initialData?.container_size ||
        initialData?.container_type
    )
  );
  const [packingType, setPackingType] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');

  // 4-column summary grid
  const [fclQuantity, setFclQuantity] = useState('');
  const [fclCapacity, setFclCapacity] = useState('');
  const [mtQty, setMtQty] = useState('');
  const [bagQty, setBagQty] = useState(() =>
    resolveString(
      initialData?.bag_quantity !== undefined && initialData?.bag_quantity !== null
        ? initialData.bag_quantity
        : initialData?.bag_qty !== undefined && initialData?.bag_qty !== null
        ? initialData.bag_qty
        : initialData?.total_bags !== undefined && initialData?.total_bags !== null
        ? initialData.total_bags
        : initialData?.bags !== undefined && initialData?.bags !== null
        ? initialData.bags
        : ''
    )
  );

  // Shipping & Invoice details
  const [markingBrand, setMarkingBrand] = useState('');
  const [preCarriageBy, setPreCarriageBy] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [shippingBillNo, setShippingBillNo] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [transitClause, setTransitClause] = useState(() =>
    resolveTransitClause(
      initialData?.transit_clause ??
        initialData?.transit_clause_allowed ??
        initialData?.transitClause
    )
  );

  // Additional Comment Row (Title & Comment - Matches Contract & Packing List)
  const [commentLabel, setCommentLabel] = useState<string>(() =>
    safeString(
      initialData?.comment_label ||
        initialData?.commentLabel ||
        initialData?.comment_title ||
        initialData?.commentTitle ||
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
        initialData?.notes?.[0]?.comment,
      ''
    )
  );

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
    if (!initialData || typeof initialData !== 'object') return;

    const currentDocId = String(
      initialData.id ||
      initialData._id ||
      initialData.phyto_certificate_id ||
      initialData.phytoCertificateId ||
      phytoCertificateId ||
      ''
    ).trim();

    // Prevent clobbering user dirty edits unless dataVersion or currentDocId changed meaningfully
    if (isUserDirtyRef.current && lastLoadedDocIdRef.current === currentDocId && dataVersion === 0) {
      return;
    }

    lastLoadedDocIdRef.current = currentDocId;
    if (currentDocId) {
      setDraftId(currentDocId);
    }

    // Title & Watermark
    if (initialData.document_title || initialData.pdf_title || initialData.title) {
      setDocumentTitle(String(initialData.document_title || initialData.pdf_title || initialData.title));
    }
    if (initialData.watermark !== undefined || initialData.is_watermark_enabled !== undefined || initialData.watermark_enabled !== undefined) {
      setWatermark(Boolean(initialData.watermark ?? initialData.is_watermark_enabled ?? initialData.watermark_enabled));
    }

    // Exporter (Seller)
    const sDetails = resolveString(
      initialData.seller_instruction ||
      initialData.sellerInstruction ||
      initialData.seller_details ||
      initialData.seller_address ||
      initialData.exporter_address ||
      formatStructuredParty(initialData.seller) ||
      formatStructuredParty(initialData.exporter)
    );
    setSellerDetails(sDetails);

    const sName = resolveString(
      initialData.seller_name ||
      initialData.seller_company_name ||
      initialData.exporter_name ||
      initialData.seller?.company_name ||
      initialData.seller?.name ||
      extractSellerCompanyName(initialData) ||
      initialData.exporter ||
      initialData.seller
    );
    setSellerName(sName);

    // Consignee
    const cDetails = resolveString(
      initialData.consignee_details ||
      initialData.consigneeDetails ||
      initialData.consignee_address ||
      formatStructuredParty(initialData.consignee) ||
      formatStructuredParty(initialData.buyer) ||
      initialData.buyer_instruction
    );
    setConsigneeDetails(cDetails);

    const cName = resolveString(
      initialData.consignee_name ||
      initialData.consignee?.company_name ||
      initialData.consignee?.name ||
      initialData.buyer_name ||
      initialData.buyer?.company_name ||
      initialData.buyer?.name ||
      extractBuyerInfo(initialData).name ||
      initialData.consignee ||
      initialData.buyer
    );
    setConsigneeName(cName);

    // Notify Parties
    const np1Raw = initialData.notify_party_1 || initialData.notify_party || initialData.notify_parties?.[0];
    if (typeof np1Raw === 'string') {
      const parts = np1Raw.split('\n');
      setNotifyParty1Name(resolveString(parts[0]));
      setNotifyParty1Details(resolveString(parts.slice(1).join('\n')));
    } else if (np1Raw && typeof np1Raw === 'object') {
      setNotifyParty1Name(resolveString(np1Raw.company_name || np1Raw.name));
      setNotifyParty1Details(resolveString(formatStructuredParty(np1Raw)));
    } else {
      setNotifyParty1Name('');
      setNotifyParty1Details('');
    }

    const np2Raw = initialData.notify_party_2 || initialData.notify_parties?.[1];
    setNotifyParty2(np2Raw ? resolveString(typeof np2Raw === 'string' ? np2Raw : formatStructuredParty(np2Raw), '-') : '-');

    const np3Raw = initialData.notify_party_3 || initialData.notify_parties?.[2];
    setNotifyParty3(np3Raw ? resolveString(typeof np3Raw === 'string' ? np3Raw : formatStructuredParty(np3Raw), '-') : '-');

    // Product, HSN, Origin
    const prod = resolveString(
      initialData.product_name ||
      initialData.product?.name ||
      initialData.product?.title ||
      initialData.goods_description ||
      initialData.product_title ||
      initialData.product
    );
    setProductName(prod);

    const hsn = resolveString(
      initialData.hsn_code ||
      initialData.hsn ||
      initialData.hsn_sac
    );
    setHsnCode(hsn);

    const orig = resolveString(
      initialData.origin_country ||
      initialData.country_of_origin ||
      initialData.origin?.name ||
      initialData.origin?.country ||
      initialData.origin
    );
    setOriginCountry(orig);

    // Shipment details
    const fcl = resolveString(
      initialData.ship_by ||
      initialData.shipBy ||
      initialData.fcl_type ||
      initialData.container_size ||
      initialData.container_type
    );
    setFclType(fcl);

    const pType = resolveString(
      initialData.packing_type_title ||
      initialData.packing_type?.name ||
      initialData.packing_type?.title ||
      initialData.package_type ||
      initialData.packing_type
    );
    setPackingType(pType);

    const pol = resolveString(
      initialData.port_of_loading ||
      initialData.loading_port?.name ||
      initialData.loading_port
    );
    setPortOfLoading(pol);

    const pod = resolveString(
      initialData.port_of_discharge ||
      initialData.destination_port?.name ||
      initialData.destination_port
    );
    setPortOfDischarge(pod);

    // Summary grid
    const fclQ = resolveString(
      initialData.fcl_quantity !== undefined && initialData.fcl_quantity !== null
        ? initialData.fcl_quantity
        : initialData.total_containers !== undefined && initialData.total_containers !== null
        ? initialData.total_containers
        : initialData.no_of_containers !== undefined && initialData.no_of_containers !== null
        ? initialData.no_of_containers
        : ''
    );
    setFclQuantity(fclQ);

    const fclCap = resolveString(
      initialData.fcl_capacity !== undefined && initialData.fcl_capacity !== null
        ? initialData.fcl_capacity
        : initialData.capacity_per_container !== undefined && initialData.capacity_per_container !== null
        ? initialData.capacity_per_container
        : ''
    );
    setFclCapacity(fclCap);

    const mt = resolveString(
      initialData.mt_qty !== undefined && initialData.mt_qty !== null
        ? initialData.mt_qty
        : initialData.quantity !== undefined && initialData.quantity !== null
        ? initialData.quantity
        : initialData.net_weight !== undefined && initialData.net_weight !== null
        ? initialData.net_weight
        : ''
    );
    setMtQty(mt);

    const bags = resolveString(
      initialData.bag_quantity !== undefined && initialData.bag_quantity !== null
        ? initialData.bag_quantity
        : initialData.bag_qty !== undefined && initialData.bag_qty !== null
        ? initialData.bag_qty
        : initialData.total_bags !== undefined && initialData.total_bags !== null
        ? initialData.total_bags
        : initialData.bags !== undefined && initialData.bags !== null
        ? initialData.bags
        : ''
    );
    setBagQty(bags);

    // Markings & Invoices
    setMarkingBrand(resolveString(initialData.marking_brand || initialData.brand || initialData.marks_and_numbers));
    setPreCarriageBy(resolveString(initialData.pre_carriage_by || initialData.pre_carriage));
    setInvoiceNumber(resolveString(initialData.invoice_number || initialData.commercial_invoice_number || initialData.packing_list_number));
    setInvoiceDate(resolveString(initialData.invoice_date || initialData.commercial_invoice_date || initialData.packing_list_date));
    setBlNumber(resolveString(initialData.bl_number || initialData.bill_of_lading_number));
    setShippingBillNo(resolveString(initialData.shipping_bill_no || initialData.shipping_bill_number));
    setNetWeight(resolveString(initialData.net_weight));
    setGrossWeight(resolveString(initialData.gross_weight));
    setTransitClause(
      resolveTransitClause(
        initialData.transit_clause ??
        initialData.transit_clause_allowed ??
        initialData.transitClause
      )
    );

    // Comments
    if (initialData.comment_label || initialData.comment_title || initialData.notes?.[0]?.title) {
      setCommentLabel(resolveString(initialData.comment_label || initialData.comment_title || initialData.notes?.[0]?.title));
    }
    if (initialData.comment_value || initialData.comment_text || initialData.notes?.[0]?.comment) {
      setCommentValue(resolveString(initialData.comment_value || initialData.comment_text || initialData.notes?.[0]?.comment));
    }

    isFormInitializedRef.current = true;
    isUserDirtyRef.current = false;
    isDraftSavedToBackendRef.current = true;
    setIsDirty(false);
    setHasDraftChanges(false);
  }, [initialData, dataVersion, phytoCertificateId]);

  // Construct Payload
  const getPhytoPayload = useCallback(() => {
    const payload: Record<string, any> = {
      id: getOwnPhytoId() || getEffectivePhytoId() || undefined,
      phyto_certificate_id: getOwnPhytoId() || getEffectivePhytoId() || undefined,
      packing_list_id: packingListId || undefined,
      commercial_invoice_id: commercialInvoiceId || undefined,
      custom_invoice_id: customInvoiceId || undefined,
      shipment_instruction_id: shipmentInstructionId || undefined,
      proforma_id: proformaId || undefined,
      contract_id: contractId || undefined,
      confirmation_id: confirmationId || undefined,

      document_title: documentTitle.trim() || 'PHYTO CERTIFICATE',
      pdf_title: documentTitle.trim() || 'PHYTO CERTIFICATE',
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
      notify_party_1: notifyParty1Name.trim() + (notifyParty1Details.trim() ? '\n' + notifyParty1Details.trim() : ''),
      notify_party_2: notifyParty2.trim(),
      notify_party_3: notifyParty3.trim(),

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

      // Summary grid
      fcl_quantity: fclQuantity.trim(),
      fcl_capacity: fclCapacity.trim(),
      mt_qty: mtQty.trim(),
      bag_qty: bagQty.trim(),
      bag_quantity: bagQty.trim(),
      total_bags: bagQty.trim(),

      // Marks & Details
      marking_brand: markingBrand.trim(),
      pre_carriage_by: preCarriageBy.trim(),
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate.trim(),
      bl_number: blNumber.trim(),
      shipping_bill_no: shippingBillNo.trim(),
      shipping_bill_number: shippingBillNo.trim(),
      net_weight: netWeight.trim(),
      gross_weight: grossWeight.trim(),
      transit_clause: transitClause.trim(),

      // Comments
      comment_label: commentLabel.trim(),
      comment_value: commentValue.trim(),
      notes:
        commentLabel.trim() || commentValue.trim()
          ? [{ id: '1', title: commentLabel.trim(), comment: commentValue.trim() }]
          : [],
    };

    return payload;
  }, [
    getOwnPhytoId,
    getEffectivePhytoId,
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
    notifyParty1Name,
    notifyParty1Details,
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
      const payload = getPhytoPayload();
      const currentId = getOwnPhytoId() || getEffectivePhytoId();

      let res: any;
      if (onSaveDraft) {
        res = await onSaveDraft(payload);
      } else {
        res = await savePhytoCertificateDraftAction(payload, lang, currentId || undefined);
      }

      if (res?.success) {
        const savedId = String(
          res.id || res.data?.id || res.data?._id || res.data?.phyto_certificate_id || currentId || ''
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

        toast.success(res?.message || 'Phyto Certificate draft saved successfully!');

        if (savedId && onSaveSuccess) {
          const extracted =
            extractPhytoCertificateData(res?.data) ||
            (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
          onSaveSuccess(savedId, {
            ...extracted,
            id: savedId,
            phyto_certificate_id: savedId,
          });
        }
        return res;
      } else {
        toast.error(res?.message || 'Failed to save Phyto Certificate draft');
      }
    } catch (err: any) {
      console.error('[PhytoCertificateDocumentForm] Save draft error:', err);
      toast.error(err?.message || 'An error occurred while saving draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit button label and next step info
  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'phyto',
      isSubmitting,
      submittingText: dict?.smart_docs?.submitting || 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.submit_btn || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  // Handle Submit
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft || readOnly) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = getPhytoPayload();
      const currentId = getOwnPhytoId() || getEffectivePhytoId();

      let res: any;
      if (onSubmitPhytoCertificate) {
        res = await onSubmitPhytoCertificate(payload, currentId || undefined, submitInfo.nextStep);
      } else {
        res = await submitPhytoCertificateAction(payload, lang, currentId || undefined);
      }

      if (res?.success) {
        const submittedId = String(
          res.id || res.data?.id || res.data?._id || res.data?.phyto_certificate_id || currentId || ''
        );
        if (submittedId) {
          lastLoadedDocIdRef.current = submittedId;
          setDraftId(submittedId);
        }
        isFormInitializedRef.current = true;
        isUserDirtyRef.current = false;
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(false);

        toast.success(res?.message || 'Phyto Certificate submitted successfully!');

        if (submittedId && onSaveSuccess) {
          const extracted =
            extractPhytoCertificateData(res?.data) ||
            (typeof res?.data === 'object' && res?.data !== null ? res.data : {});
          onSaveSuccess(submittedId, {
            ...extracted,
            id: submittedId,
            phyto_certificate_id: submittedId,
            status: 'COMPLETED',
          });
        }
        return res;
      } else {
        toast.error(res?.message || 'Failed to submit Phyto Certificate');
      }
    } catch (err: any) {
      console.error('[PhytoCertificateDocumentForm] Submit error:', err);
      toast.error(err?.message || 'An error occurred while submitting');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Print Preview (Auto-saves draft first if unsaved changes exist)
  const handleOpenPrintPreview = async () => {
    let effectiveId = getEffectivePhytoId();

    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getPhytoPayload();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await savePhytoCertificateDraftAction(
            formDataPayload,
            lang,
            getOwnPhytoId() || effectiveId || undefined
          );
        }
        if (res?.success) {
          const newId = String(
            res.id || res.data?.id || res.data?._id || res.data?.phyto_certificate_id || ''
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
        console.error('[PhytoCertificateDocumentForm] Auto-save before preview failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectivePhytoId();

    if (!effectiveId) {
      toast.error('Please save the draft first to preview the document.');
      return;
    }

    setPreviewDocId(effectiveId);
    setIsPrintPreviewOpen(true);
  };

  // Handle Download PDF (Auto-saves draft first if unsaved changes exist)
  const handleDownloadPdf = async () => {
    let effectiveId = getEffectivePhytoId();

    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getPhytoPayload();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await savePhytoCertificateDraftAction(
            formDataPayload,
            lang,
            getOwnPhytoId() || effectiveId || undefined
          );
        }
        if (res?.success) {
          const newId = String(
            res.id || res.data?.id || res.data?._id || res.data?.phyto_certificate_id || ''
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
        console.error('[PhytoCertificateDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    effectiveId = effectiveId || getEffectivePhytoId();

    if (!effectiveId) {
      toast.error('Please save as draft first before downloading PDF.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const ownId = getOwnPhytoId();
      const res = await downloadDocPdfAction({
        prefix: 'phyto_certificate',
        id: ownId || effectiveId,
        phytoCertificateId: ownId || effectiveId,
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
        downloadPdfFromActionResponse(res, `Phyto-Certificate-${invoiceNumber || effectiveId}.pdf`);
        toast.success('Phyto Certificate PDF downloaded successfully!');
      } else {
        toast.error(res?.message || res?.error || 'Failed to download Phyto Certificate PDF');
      }
    } catch (err: any) {
      console.error('[PhytoCertificateDocumentForm] Download PDF error:', err);
      toast.error(err?.message || 'Network error occurred while downloading PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };



  return (
    <div
      id="phyto-certificate-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative"
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollContainerRef}
        id="phyto-certificate-scroll-viewport"
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
            placeholder="PHYTO CERTIFICATE"
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
            ROW 1: EXPORTER (SELLER) & CONSIGNEE DETAILS
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
                <div className="text-[14px] font-normal text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
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
                <div className="text-[14px] font-normal text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(consigneeDetails || consigneeName, '-')}
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 2: NOTIFY PARTIES (3 Columns: Notify 1, Notify 2, Notify 3)
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
              <div className="p-2.5 sm:p-3 flex flex-col gap-1 justify-start">
                {notifyParty1Name && resolveString(notifyParty1Name) && (
                  <div className="text-[14px] font-normal text-foreground uppercase tracking-wide select-all">
                    {resolveString(notifyParty1Name)}
                  </div>
                )}
                <div className="text-[14px] font-normal text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(notifyParty1Details) || (!resolveString(notifyParty1Name) ? '-' : '')}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 flex flex-col justify-start">
                <div className="text-[14px] font-normal text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(notifyParty2, '-')}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 flex flex-col justify-start">
                <div className="text-[14px] font-normal text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed select-all">
                  {resolveString(notifyParty3, '-')}
                </div>
              </div>
            </div>
          </div>

          {/*
            ROW 3: PRODUCT
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PRODUCT
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(productName, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 4: HSN CODE
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              HSN CODE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(hsnCode, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 5: ORIGIN
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              ORIGIN
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(originCountry, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 6: FCL TYPE
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              FCL TYPE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {formatFclType(fclType)}
              </span>
            </div>
          </div>

          {/*
            ROW 7: PACKING TYPE
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PACKING TYPE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(packingType, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 8: PORT OF LOADING
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PORT OF LOADING
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(portOfLoading, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 9: PORT OF DISCHARGE
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PORT OF DISCHARGE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
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
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide uppercase select-all">
                  {resolveString(fclQuantity, '-')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide uppercase select-all">
                  {resolveString(fclCapacity, '-')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide uppercase select-all">
                  {resolveString(mtQty, '-')}
                </span>
              </div>

              <div className="p-2.5 sm:p-3 flex items-center justify-center min-w-0">
                <span className="font-normal text-[14px] text-foreground text-center tracking-wide uppercase select-all">
                  {resolveString(bagQty, '-')}
                </span>
              </div>
            </div>
          </div>

          {/*
            ROW 11: MARKING BRAND
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              MARKING BRAND
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(markingBrand, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 12: PRE CARRIAGE BY
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              PRE CARRIAGE BY
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(preCarriageBy, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 13: INVOICE NUMBER
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              INVOICE NUMBER
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(invoiceNumber, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 14: INVOICE DATE
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              INVOICE DATE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(invoiceDate, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 15: BL NUMBER
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              BL NUMBER
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(blNumber, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 16: SHIPPING BILL NO
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              SHIPPING BILL NO
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(shippingBillNo, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 17: NET WEIGHT
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              NET WEIGHT
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(netWeight, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 18: GROSS WEIGHT (Canva Image 3)
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              GROSS WEIGHT
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveString(grossWeight, '-')}
              </span>
            </div>
          </div>

          {/*
            ROW 19: TRANSIT CLAUSE
          */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border min-h-[42px]">
            <div className="w-full sm:w-64 md:w-72 shrink-0 p-2.5 sm:p-3 flex items-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-2.5 sm:px-3">
              TRANSIT CLAUSE
            </div>
            <div className="flex-1 p-2.5 sm:p-3 flex items-center min-w-0">
              <span className="font-normal text-[14px] text-foreground tracking-wide uppercase select-all">
                {resolveTransitClause(transitClause)}
              </span>
            </div>
          </div>

          {/*
            ROW 20: COMMENTS (Enter Title 1/3 & Enter Comment 2/3 - Matches Contract & Packing List)
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
                id="phyto-commentLabel-input"
                value={commentLabel}
                disabled={readOnly}
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
                id="phyto-commentValue-input"
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
        Matches PackingListDocumentForm / CommercialInvoiceDocumentForm exactly
        - Left: Print Preview, Download PDF (Red destructive outline buttons)
        - Right: Save As Draft, Submit
      */}
      <div
        id="phyto-certificate-bottom-bar"
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
                ? 'Phyto Certificate already submitted'
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
        prefix="phyto_certificate"
        docId={previewDocId || getOwnPhytoId() || getEffectivePhytoId()}
        candidateIds={[
          previewDocId,
          getOwnPhytoId(),
          getEffectivePhytoId(),
          draftId,
          phytoCertificateId,
          packingListId,
          commercialInvoiceId,
          customInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        phytoCertificateId={previewDocId || getOwnPhytoId() || getEffectivePhytoId()}
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

export default PhytoCertificateDocumentForm;
