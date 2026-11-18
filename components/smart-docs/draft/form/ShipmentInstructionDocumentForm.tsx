'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import DocToggle from './DocToggle';
import DocTitleInput from './DocTitleInput';
import DocUnderlineInput from './DocUnderlineInput';
import DocUnderlineSelect, { DocSelectOption, isRawDbId } from './DocUnderlineSelect';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import { dataUrlToFile } from './ContractDocumentForm';
import {
  dedupePartyDetails,
  formatPartyDetails as formatPartyDetailsWithCompany,
  extractPortDisplayName,
  extractLoadingPortCountry,
} from './ProformaDocumentForm';
import { toast } from 'sonner';
import {
  downloadDocPdfAction,
  saveShipmentInstructionDraftAction,
  submitShipmentInstructionAction,
  getShipmentInstructionAction,
  getStepperListAction,
  getBuyerConsigneesAction,
  getBuyerNotifyPartiesAction,
} from '@/app/actions/smart-docs';
import {
  type StepperDocumentItem,
  formatSignatureUrl,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  getShipmentInstructionStep,
  parsePackingBagWeightKg,
  extractApiValidationErrors,
  getCurrencySymbol,
  getWorkflowSubmitButtonInfo,
  getWorkflowSubmitToastMessage,
  isSameWorkflowStep,
} from '@/lib/api/smart-docs.service';

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

export interface ShipmentInstructionDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
  instructionId?: string;
  shipmentInstructionId?: string;
  proformaId?: string;
  contractId?: string;
  confirmationId?: string;
  buyerInstructionId?: string;
  initialConsignees?: any[];
  initialNotifyParties?: any[];
  initialConsigneesBuyerId?: string;
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
  onSubmitInstruction?: (payload: any, id?: string, nextStep?: StepperDocumentItem | null) => Promise<any>;
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

export function formatFclType(val: any, fallback = '20 FT FCL'): string {
  const str = safeString(val);
  if (!str) return fallback;
  const cleaned = str.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

export function formatPartyDetails(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();

  // If item already contains preformatted details or instructionText
  if (typeof item.details === 'string' && item.details.trim()) {
    return item.details.trim();
  }
  if (typeof item.instruction === 'string' && item.instruction.trim()) {
    return item.instruction.trim();
  }
  if (typeof item.instructionText === 'string' && item.instructionText.trim()) {
    return item.instructionText.trim();
  }

  const lines: string[] = [];

  const compName = String(
    item.company_name ||
    item.name ||
    item.business_name ||
    item.label ||
    ''
  ).trim();

  const street = String(item.address || item.street || '').trim();

  // City, State, Country, Zip
  const city = String(item.city || '').trim();
  const state = String(item.state || '').trim();
  const zip = String(item.zip_code || item.zipcode || '').trim();
  const country =
    typeof item.country === 'object' && item.country !== null
      ? String(item.country.name || item.country.title || item.country.label || '').trim()
      : String(item.country || '').trim();

  const localityArr: string[] = [];
  if (city) localityArr.push(city);
  if (state && state.toLowerCase() !== city.toLowerCase()) localityArr.push(state);
  if (country && country !== '[object Object]') localityArr.push(country);
  if (zip) localityArr.push(zip);

  const contactArr: string[] = [];
  const phone = String(item.contact_number || item.phone || item.mobile || '').trim();
  const phoneCode = String(item.phone_country_code || item.phoneCountryCode || item.country_code || '').trim();
  if (phone) {
    const formattedPhone = phoneCode && !phone.startsWith('+') ? `${phoneCode} ${phone}` : phone;
    contactArr.push(`TEL: ${formattedPhone}`);
  }
  const email = String(item.email || '').trim();
  if (email) {
    contactArr.push(`EMAIL: ${email}`);
  }
  const cert = String(item.certificate_name_number || item.certificate_name_and_number || item.tax_id || '').trim();
  if (cert) {
    contactArr.push(`TAX/REG ID: ${cert}`);
  }

  // Assemble lines
  if (compName) {
    lines.push(compName);
  }
  if (street) {
    if (compName && street.toLowerCase().startsWith(compName.toLowerCase())) {
      lines[0] = street;
    } else {
      lines.push(street);
    }
  }
  if (localityArr.length > 0) {
    lines.push(localityArr.join(', '));
  }
  if (contactArr.length > 0) {
    lines.push(contactArr.join(', '));
  }

  return lines.join('\n');
}

/**
 * Safely parses nullable boolean values without coercing null/undefined to false.
 */
function parseNullableBoolean(val: any): boolean | null {
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
 * Safely normalizes escaped newlines in multiline strings.
 */
function formatMultilineValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.includes('\\r\\n')) {
    str = str.replace(/\\r\\n/g, '\n');
  } else if (str.includes('\\n')) {
    str = str.replace(/\\n/g, '\n');
  }
  return str;
}

const DEFAULT_COC_FIELDS_VALUE = 'IDF:\r\nUCR:\r\nPIP:';

/**
 * Safely extracts raw vessel / voyage string from various payload casings and source documents.
 */
export function extractVesselVoyageRawValue(data: any): string {
  if (!data || typeof data !== 'object') return '';
  return safeString(
    data?.voyage_number ||
      data?.voyage_no ||
      data?.shipment_instruction?.voyage_number ||
      data?.shipment_instruction?.voyage_no ||
      data?.vessel_voyage_no ||
      data?.vessel_voyage ||
      data?.vessel_name ||
      data?.vessel_flight_no ||
      data?.vessel ||
      data?.shipping_line ||
      data?.contract?.vessel_name ||
      data?.confirmation?.vessel_name ||
      data?.proforma?.vessel_name ||
      data?.shipment_instruction?.vessel_name,
    ''
  );
}

/**
 * Resolves initial special instruction value.
 * User requirement: The value previously shown in vessel voyage is now populated into special instruction,
 * while honoring any existing explicit special instruction.
 */
export function resolveInitialSpecialInstruction(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const d = data.data !== undefined && typeof data.data === 'object' && data.data !== null ? data.data : data;
  const direct = safeString(
    data?.disclaimer ??
      d?.disclaimer ??
      data?.shipment_instruction?.disclaimer ??
      d?.shipment_instruction?.disclaimer ??
      data?.details?.disclaimer ??
      d?.details?.disclaimer ??
      data?.special_instruction ??
      d?.special_instruction ??
      data?.special_instructions ??
      d?.special_instructions ??
      data?.special_note ??
      d?.special_note ??
      data?.shipment_instruction?.special_instruction ??
      data?.shipment_instruction?.special_note ??
      data?.details?.special_instruction ??
      data?.contract?.disclaimer ??
      data?.contract?.special_instruction ??
      data?.confirmation?.disclaimer ??
      data?.confirmation?.special_instruction ??
      data?.proforma?.disclaimer ??
      data?.proforma?.special_instruction,
    ''
  );
  if (direct && direct.trim() !== '') {
    return direct;
  }

  // If this is an existing saved shipment instruction and disclaimer is explicitly provided as empty
  if (
    (data?.id || data?._id || data?.shipment_instruction_id || data?.shipment_instruction_number) &&
    (data?.disclaimer !== undefined || d?.disclaimer !== undefined || data?.special_instruction !== undefined)
  ) {
    return direct;
  }

  const rawVesselVoyage = extractVesselVoyageRawValue(data);
  if (rawVesselVoyage && rawVesselVoyage.trim().toUpperCase() !== 'AS PER BL') {
    return rawVesselVoyage;
  }

  return '';
}

/**
 * Safely extracts bag photo URL from various response field casings.
 */
function extractBagPhotoUrl(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const val =
    data.bag_photo_url ||
    data.BAG_PHOTO_URL ||
    data.bagPhotoUrl ||
    data.data?.bag_photo_url ||
    data.data?.BAG_PHOTO_URL ||
    data.contract?.bag_photo_url ||
    data.contract?.BAG_PHOTO_URL ||
    data.bag_photo ||
    data.container_marks_image ||
    data.marks_image ||
    data.container_image ||
    '';
  return val ? (formatSignatureUrl(val) || String(val).trim()) : '';
}

export const SHIPMENT_FORM_FIELD_VISUAL_ORDER = [
  'documentTitle',
  'consigneeId',
  'consigneeDetails',
  'notifyParty1Id',
  'notifyParty1Details',
  'notifyParty2Id',
  'notifyParty2Details',
  'placeOfDelivery',
  'marksAndNumbers',
  'bagPhotoUrl',
  'marksImage',
  'freight',
  'cocFieldsValue',
  'specialInstruction',
  'disclaimer',
  'remarksTitle',
  'remarksComment',
];

export function scrollToAndFocusShipmentField(fieldErrorsOrKey: string | Record<string, string>): void {
  if (typeof window === 'undefined') return;

  let targetKey = '';
  if (typeof fieldErrorsOrKey === 'string') {
    targetKey = fieldErrorsOrKey;
  } else if (fieldErrorsOrKey && typeof fieldErrorsOrKey === 'object') {
    for (const key of SHIPMENT_FORM_FIELD_VISUAL_ORDER) {
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

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = el.matches('input, select, textarea, button')
        ? el
        : el.querySelector('input:not([type="hidden"]), select, textarea, button');
      if (focusable && typeof (focusable as HTMLElement).focus === 'function') {
        setTimeout(() => (focusable as HTMLElement).focus(), 150);
      }
      break;
    }
  }
}

/**
 * Humanizes technical validation messages into friendly, user-facing error text.
 */
export function humanizeShipmentValidationMessage(rawMessage: string, targetKey?: string): string {
  if (!rawMessage) return 'Invalid value';
  const str = String(rawMessage).trim();

  // Filter out generic headers
  if (/^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(str)) {
    return '';
  }

  // Already clean sentence
  if (/^please\s+/i.test(str)) return str;

  const lower = str.toLowerCase();
  if (
    lower.includes('should not be empty') ||
    lower.includes('must not be empty') ||
    lower.includes('is required') ||
    lower.includes('must be string') ||
    lower.includes('must be a string')
  ) {
    switch (targetKey) {
      case 'consigneeId':
        return 'Please select a consignee';
      case 'consigneeDetails':
        return 'Consignee details are required';
      case 'notifyParty1Id':
        return 'Please select Notify Party 01';
      case 'notifyParty1Details':
        return 'Notify Party 01 details are required';
      case 'notifyParty2Id':
        return 'Please select Notify Party 02';
      case 'notifyParty2Details':
        return 'Notify Party 02 details are required';
      case 'placeOfDelivery':
        return 'Please enter place of delivery';
      case 'marksAndNumbers':
      case 'markingBrand':
      case 'marking_brand':
      case 'containerMarks':
      case 'container_marks':
        return 'Please enter container marks & numbers';
      case 'bagPhotoUrl':
      case 'bag_photo_url':
      case 'bag_photo':
      case 'marksImage':
      case 'marks_image':
      case 'container_marks_image':
        return 'Please upload bag photo';
      case 'freight':
        return 'Please enter freight details';
      case 'cocFieldsValue':
        return 'Please enter COC details (IDF / UCR / PIP)';
      case 'specialInstruction':
      case 'special_instruction':
      case 'disclaimer':
        return 'Please enter special instruction';
      case 'documentTitle':
        return 'Document title is required';
      default:
        return 'This field is required';
    }
  }

  // Handle technical marking brand / container marks validation phrases
  if (
    (lower.includes('marking brand') || lower.includes('marking_brand') || lower.includes('container mark') || lower.includes('containermarks') || lower.includes('marks and number') || lower.includes('marks & number')) &&
    (lower.includes('string') || lower.includes('empty') || lower.includes('required') || lower.includes('enter') || lower.includes('provide'))
  ) {
    return 'Please enter container marks & numbers';
  }

  return str;
}

/**
 * Helper to parse backend validation errors for Shipment Instruction.
 * Supports NestJS ValidationPipe constraints, arrays of strings, error objects, error_fields, etc.
 * Never leaks generic strings like "Form Validation Error".
 */
export function parseShipmentInstructionBackendErrors(
  result: any
): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!result) return { fieldErrors, generalError: 'Failed to save draft' };

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

  const mapFieldNameToErrorKey = (field: string): string => {
    const f = String(field || '').trim();
    const clean = f.toLowerCase().replace(/[-_.]/g, '');

    switch (clean) {
      case 'documenttitle':
      case 'pdftitle':
      case 'title':
        return 'documentTitle';
      case 'consigneeid':
      case 'consignee':
      case 'buyerid':
      case 'buyer':
        return 'consigneeId';
      case 'consigneedetails':
      case 'consigneeaddress':
      case 'buyerdetails':
      case 'buyeraddress':
      case 'buyerinstruction':
        return 'consigneeDetails';
      case 'notifyparty1id':
      case 'notifyparty1':
      case 'notifypartyfirst':
      case 'firstnotifyparty':
        return 'notifyParty1Id';
      case 'notifyparty1details':
      case 'notifyparty1text':
        return 'notifyParty1Details';
      case 'notifyparty2id':
      case 'notifyparty2':
      case 'notifypartysecond':
      case 'secondnotifyparty':
        return 'notifyParty2Id';
      case 'notifyparty2details':
      case 'notifyparty2text':
        return 'notifyParty2Details';
      case 'placeofdelivery':
      case 'deliveryplace':
      case 'finaldestination':
      case 'destination':
        return 'placeOfDelivery';
      case 'marksandnumbers':
      case 'marksnumbers':
      case 'marks':
      case 'containermarks':
      case 'containermarksnumbers':
      case 'containermarksandnumbers':
      case 'containernosmarksandnumbers':
      case 'containernosmarksnumbers':
      case 'markingbrand':
      case 'marking_brand':
      case 'brand':
      case 'marking':
        return 'marksAndNumbers';
      case 'bagphotourl':
      case 'bagphoto':
      case 'bagimage':
      case 'marksimage':
      case 'containermarksimage':
        return 'bagPhotoUrl';
      case 'freight':
      case 'freightterms':
      case 'freightamount':
        return 'freight';
      case 'cocfieldsvalue':
      case 'coc_fields_value':
      case 'cocfields':
      case 'coc_fields':
      case 'cocfield':
      case 'coc_field':
      case 'cocvalue':
        return 'cocFieldsValue';
      case 'specialinstruction':
      case 'specialnote':
      case 'instruction':
      case 'specialinstructions':
      case 'disclaimer':
      case 'disclaimernote':
      case 'disclaimertext':
        return 'specialInstruction';
      case 'remarkstitle':
      case 'commenttitle':
      case 'commentlabel':
        return 'remarksTitle';
      case 'remarkscomment':
      case 'commentvalue':
      case 'commenttext':
      case 'remarks':
      case 'comment':
        return 'remarksComment';
      default: {
        const extraIdMatch = clean.match(/^notifyparty(\d+)id$/);
        if (extraIdMatch) return `notify_party_${extraIdMatch[1]}_id`;
        const extraDetailsMatch = clean.match(/^notifyparty(\d+)(?:details|text)$/);
        if (extraDetailsMatch) return `notify_party_${extraDetailsMatch[1]}_details`;
        return f;
      }
    }
  };

  const detectShipmentFieldInSentence = (sentence: string): { key: string; label: string } | null => {
    const s = sentence.toLowerCase();
    if (s.includes('consignee detail') || s.includes('consignee address')) {
      return { key: 'consigneeDetails', label: 'Consignee Details' };
    }
    if (s.includes('consignee')) {
      return { key: 'consigneeId', label: 'Consignee' };
    }
    if (s.includes('notify party 1') || s.includes('notify party 01') || s.includes('first notify')) {
      if (s.includes('detail') || s.includes('address')) {
        return { key: 'notifyParty1Details', label: 'Notify Party 01 Details' };
      }
      return { key: 'notifyParty1Id', label: 'Notify Party 01' };
    }
    if (s.includes('notify party 2') || s.includes('notify party 02') || s.includes('second notify')) {
      if (s.includes('detail') || s.includes('address')) {
        return { key: 'notifyParty2Details', label: 'Notify Party 02 Details' };
      }
      return { key: 'notifyParty2Id', label: 'Notify Party 02' };
    }
    if (s.includes('delivery') || s.includes('place of delivery') || s.includes('final destination')) {
      return { key: 'placeOfDelivery', label: 'Place of Delivery' };
    }
    if (
      s.includes('marking brand') ||
      s.includes('marking_brand') ||
      s.includes('markingbrand') ||
      s.includes('container mark') ||
      s.includes('containermarks') ||
      s.includes('marks and number') ||
      s.includes('marks & number') ||
      s.includes('marks_and_numbers') ||
      s.includes('marks and numbers') ||
      s.includes('mark')
    ) {
      return { key: 'marksAndNumbers', label: 'Marks and Numbers' };
    }
    if (s.includes('bag photo') || s.includes('bag_photo') || s.includes('bag image') || s.includes('marks image')) {
      return { key: 'bagPhotoUrl', label: 'Bag Photo' };
    }
    if (s.includes('freight')) {
      return { key: 'freight', label: 'Freight' };
    }
    if (s.includes('coc')) {
      return { key: 'cocFieldsValue', label: 'COC Details' };
    }
    if (s.includes('special instruction') || s.includes('special note') || s.includes('disclaimer')) {
      return { key: 'specialInstruction', label: 'Special Instruction' };
    }
    if (s.includes('remark') || s.includes('comment')) {
      if (s.includes('title') || s.includes('label')) {
        return { key: 'remarksTitle', label: 'Remarks Title' };
      }
      return { key: 'remarksComment', label: 'Remarks Comment' };
    }
    if (s.includes('document title') || s.includes('pdf title')) {
      return { key: 'documentTitle', label: 'Document Title' };
    }
    return null;
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

      const detected = detectShipmentFieldInSentence(clause);
      if (detected) {
        targetKey = detected.key;
      } else if (!targetKey) {
        const keyFromClause = mapFieldNameToErrorKey(clause);
        if (keyFromClause && keyFromClause !== clause) {
          targetKey = keyFromClause;
        }
      }

      const cleanMsg = humanizeShipmentValidationMessage(clause, targetKey || undefined);
      if (!cleanMsg || isGenericValidationString(cleanMsg)) continue;

      if (targetKey) {
        if (!fieldErrors[targetKey]) {
          fieldErrors[targetKey] = cleanMsg;
        } else if (!fieldErrors[targetKey].includes(cleanMsg)) {
          // If existing is already user friendly and new is also for the same field, prefer the friendly one
          if (
            fieldErrors[targetKey] === 'Please enter container marks & numbers' &&
            /string|marking|brand/i.test(cleanMsg)
          ) {
            // Keep the friendly error
          } else if (
            cleanMsg === 'Please enter container marks & numbers' &&
            /string|marking|brand/i.test(fieldErrors[targetKey])
          ) {
            fieldErrors[targetKey] = cleanMsg;
          } else {
            fieldErrors[targetKey] = `${fieldErrors[targetKey]}, ${cleanMsg}`;
          }
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
        if (['message', 'error', 'id', '_id', 'shipment_instruction_id', 'proforma_id', 'contract_id', 'confirmation_id'].includes(lowerKey)) {
          ingestErrorItem(undefined, v);
          continue;
        }
        ingestErrorItem(k, v);
      }
      continue;
    }

    ingestErrorItem(undefined, src);
  }

  // Also leverage extractApiValidationErrors
  try {
    const apiErrors = extractApiValidationErrors(result);
    for (const item of apiErrors) {
      if (item && item.message && !isGenericValidationString(item.message)) {
        const key = mapFieldNameToErrorKey(item.field || '');
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = humanizeShipmentValidationMessage(item.message, key);
        }
      }
    }
  } catch (err) {
    // ignore
  }

  return { fieldErrors, generalError };
}

export function ShipmentInstructionDocumentForm({
  initialData,
  dataVersion,
  instructionId,
  shipmentInstructionId,
  proformaId,
  contractId,
  confirmationId,
  buyerInstructionId,
  initialConsignees = [],
  initialNotifyParties = [],
  initialConsigneesBuyerId = '',
  steps,
  selectedStep,
  onUpdateSteps,
  onSelectStep,
  buyers = [],
  products = [],
  currencies = [],
  onSaveDraft,
  onSaveSuccess,
  onSubmitInstruction,
  lang = 'en',
  dict,
  readOnly = false,
}: ShipmentInstructionDocumentFormProps) {
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isDraftSavedToBackendRef = useRef<boolean>(false);
  const isFormInitializedRef = useRef<boolean>(false);
  const lastDataVersionRef = useRef<number>(dataVersion ?? 0);
  const lastLoadedDocIdRef = useRef<string>('');

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Canonical Draft ID: strictly the Shipment Instruction's self ID, NEVER contractId, proformaId, or confirmationId
  const hasShipmentMarkers = Boolean(
    initialData?.shipment_instruction_number ||
    initialData?.booking_number ||
    initialData?.booking_no ||
    initialData?.vessel_name ||
    initialData?.shipping_bill_number ||
    initialData?.shipping_bill_no ||
    initialData?._is_shipment_loaded
  );

  // Document Status: Only inherit status from initialData if genuine shipment markers exist
  const [docStatus, setDocStatus] = useState<string>(() => {
    const step = getShipmentInstructionStep(steps, selectedStep);
    const stepStatus = step?.status || (step as any)?.document_status || (step as any)?.step_status;
    if (stepStatus) return String(stepStatus).toUpperCase();
    if (hasShipmentMarkers && initialData?.status) return String(initialData.status).toUpperCase();
    return 'PENDING';
  });

  const candidateSelfId = sanitizeDocId(
    shipmentInstructionId ||
    initialData?.shipment_instruction_id ||
    initialData?.shipment_id ||
    (hasShipmentMarkers &&
     initialData?.id &&
     initialData.id !== contractId &&
     initialData.id !== confirmationId &&
     initialData.id !== proformaId
      ? initialData.id
      : '') ||
    (hasShipmentMarkers &&
     initialData?._id &&
     initialData._id !== contractId &&
     initialData._id !== confirmationId &&
     initialData._id !== proformaId
      ? initialData._id
      : '')
  );
  const isInvalidSelfId =
    !candidateSelfId ||
    /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(
      candidateSelfId
    );
  const effectiveInstructionId = isInvalidSelfId ? '' : candidateSelfId;
  const [draftId, setDraftId] = useState<string>(() => effectiveInstructionId || '');

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Operation States
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Refs
  const marksImageInputRef = useRef<HTMLInputElement>(null);
  const marksImageFileRef = useRef<File | null>(null);
  const hasUserSelectedNewImageRef = useRef<boolean>(false);
  const lastInitialBagPhotoRef = useRef<string>('');

  // ==========================================
  // 1. HEADER: Title (Editable) & Watermark (Toggle)
  // ==========================================
  const [documentTitle, setDocumentTitle] = useState<string>(() =>
    safeString(initialData?.pdf_title || initialData?.document_title || initialData?.title, 'SHIPMENT INSTRUCTION')
  );
  const [watermark, setWatermark] = useState<boolean>(() => {
    if (initialData?.is_watermark_enabled !== undefined) return Boolean(initialData.is_watermark_enabled);
    if (initialData?.watermark !== undefined) return Boolean(initialData.watermark);
    return true;
  });

  // ==========================================
  // 2. ROW 1: SHIPPER & TYPE OF B/L & SCAN CODE (ALL STATIC TEXT)
  // ==========================================
  const shipperName = useMemo(() => {
    return safeString(
      initialData?.shipper_name ||
        initialData?.seller_name ||
        initialData?.seller_company_name ||
        (typeof initialData?.seller_details === 'object' && initialData?.seller_details
          ? initialData.seller_details.company_name || initialData.seller_details.name
          : '') ||
        initialData?.seller?.name ||
        initialData?.seller?.company_name ||
        initialData?.contract?.seller_name ||
        initialData?.confirmation?.seller_name,
      ''
    );
  }, [initialData]);

  const shipperDetails = useMemo(() => {
    let detailsFromObj = '';
    if (typeof initialData?.seller_details === 'object' && initialData?.seller_details) {
      const cName = initialData.seller_details.company_name;
      const addr = initialData.seller_details.address || initialData.seller_details.instruction || initialData.seller_details.details;
      detailsFromObj = formatPartyDetailsWithCompany(cName, addr);
    }
    const rawVal =
      initialData?.shipper_details ||
      detailsFromObj ||
      (typeof initialData?.seller_details === 'string' ? initialData.seller_details : '') ||
      initialData?.seller_instruction ||
      initialData?.seller?.address ||
      initialData?.contract?.seller_instruction ||
      initialData?.confirmation?.seller_instruction;
    return formatPartyDetailsWithCompany(
      shipperName,
      rawVal || ''
    );
  }, [initialData, shipperName]);

  const blType = useMemo(() => {
    return safeString(initialData?.bl_type || initialData?.type_of_bl || initialData?.type_ob_bl, 'ORIGINAL B/L');
  }, [initialData]);

  const scanCode = useMemo(() => {
    return safeString(initialData?.scan_code || initialData?.barcode || initialData?.scanCode, '');
  }, [initialData]);

  // ==========================================
  // 3. ROW 2: PARTIES (INPUTS: Dropdown + Multiline details with pencil)
  // ==========================================
  // Strictly resolve buyer_instruction_id from the SI response (or the trade's Importer), NEVER a static/arbitrary buyer.
  const effectiveBuyerInstructionId = useMemo(() => {
    const cand = [
      // 1. Primary: SI response buyer_instruction_id
      initialData?.buyer_instruction_id,
      initialData?.buyerInstructionId,
      initialData?.shipment_instruction?.buyer_instruction_id,
      initialData?.shipment_instruction?.buyerInstructionId,
      initialData?.data?.buyer_instruction_id,
      initialData?.data?.buyerInstructionId,
      typeof initialData?.buyer_instruction === 'object' && initialData?.buyer_instruction !== null
        ? initialData.buyer_instruction.id ||
          initialData.buyer_instruction._id ||
          initialData.buyer_instruction.buyer_instruction_id
        : '',
      initialData?.buyer?.buyer_instruction_id,
      // 2. Workspace-resolved buyerInstructionId (from SI response -> upstream trade Importer)
      buyerInstructionId,
      // 3. Upstream trade document buyer_instruction_id
      initialData?.proforma?.buyer_instruction_id,
      initialData?.contract?.buyer_instruction_id,
      initialData?.confirmation?.buyer_instruction_id,
      // 4. Last resort: buyer_id on SI / upstream trade docs (never buyers[0])
      initialData?.buyer_id,
      initialData?.buyerId,
      initialData?.shipment_instruction?.buyer_id,
      initialData?.data?.buyer_id,
      initialData?.buyer?.id,
      initialData?.buyer?._id,
      initialData?.proforma?.buyer_id,
      initialData?.contract?.buyer_id,
      initialData?.confirmation?.buyer_id,
    ];
    for (const c of cand) {
      const clean = sanitizeDocId(c);
      if (clean) return clean;
    }
    return '';
  }, [buyerInstructionId, initialData]);

  // Helper to extract Consignee strictly from Consignee fields on SI data (never substituting Importer/Buyer fields)
  const extractInitialConsignee = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return { id: '', name: '', details: '' };
    const si =
      data.shipment_instruction && typeof data.shipment_instruction === 'object'
        ? data.shipment_instruction
        : null;
    const rawConsigneeObj =
      (typeof data.consignee === 'object' && data.consignee !== null ? data.consignee : null) ||
      (typeof si?.consignee === 'object' && si?.consignee !== null ? si.consignee : null);

    const id = safeString(
      data.consignee_details_id ||
        si?.consignee_details_id ||
        data.consignee_id ||
        si?.consignee_id ||
        rawConsigneeObj?.consignee_details_id ||
        rawConsigneeObj?.consignee_id ||
        rawConsigneeObj?.id ||
        rawConsigneeObj?._id,
      ''
    );

    const rawConsigneeStr =
      typeof data.consignee === 'string' && data.consignee.trim() && !isRawDbId(data.consignee.trim())
        ? formatMultilineValue(data.consignee.trim())
        : typeof si?.consignee === 'string' && si.consignee.trim() && !isRawDbId(si.consignee.trim())
        ? formatMultilineValue(si.consignee.trim())
        : '';

    const details = safeString(
      data.consignee_details ||
        si?.consignee_details ||
        rawConsigneeStr ||
        rawConsigneeObj?.details ||
        (rawConsigneeObj ? formatPartyDetails(rawConsigneeObj) : ''),
      ''
    );

    const directName = safeString(
      data.consignee_name ||
        si?.consignee_name ||
        rawConsigneeObj?.company_name ||
        rawConsigneeObj?.name ||
        rawConsigneeObj?.label,
      ''
    );

    let name = '';
    if (directName && !isRawDbId(directName)) {
      name = directName;
    } else if (details) {
      const firstLine = details.split('\n')[0].trim();
      if (firstLine && !isRawDbId(firstLine)) name = firstLine;
    }

    return { id, name, details };
  }, []);

  const [consigneeId, setConsigneeId] = useState<string>(() => extractInitialConsignee(initialData).id);

  const [consigneeName, setConsigneeName] = useState<string>(() => extractInitialConsignee(initialData).name);

  const [consigneeDetails, setConsigneeDetails] = useState<string>(() => extractInitialConsignee(initialData).details);

  // Helper to extract party data from various initialData structures
  const extractInitialParty = useCallback((index1Based: number) => {
    const si =
      initialData?.shipment_instruction && typeof initialData.shipment_instruction === 'object'
        ? initialData.shipment_instruction
        : null;

    const parseRawList = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // ignore malformed JSON
        }
      }
      return [];
    };

    const rawList =
      parseRawList(initialData?.notify_parties) ||
      parseRawList(si?.notify_parties);
    const effectiveList =
      rawList.length > 0
        ? rawList
        : parseRawList(initialData?.notify_party_details).length > 0
        ? parseRawList(initialData?.notify_party_details)
        : parseRawList(initialData?.notify_party).length > 0
        ? parseRawList(initialData?.notify_party)
        : parseRawList(si?.notify_parties).length > 0
        ? parseRawList(si?.notify_parties)
        : parseRawList(si?.notify_party_details).length > 0
        ? parseRawList(si?.notify_party_details)
        : parseRawList(si?.notify_party);

    const itemFromList =
      effectiveList.find((item: any) => Number(item?.party_number) === index1Based) ||
      effectiveList[index1Based - 1];

    const rawPartyField =
      initialData?.[`notify_party_${index1Based}`] ??
      si?.[`notify_party_${index1Based}`];

    const id = safeString(
      initialData?.[`notify_party_${index1Based}_id`] ||
        si?.[`notify_party_${index1Based}_id`] ||
        initialData?.[`notify_party_${index1Based}_details_id`] ||
        si?.[`notify_party_${index1Based}_details_id`] ||
        (typeof rawPartyField === 'object' && rawPartyField !== null
          ? rawPartyField.notify_party_details_id ||
            rawPartyField.notify_party_id ||
            rawPartyField.id ||
            rawPartyField._id
          : '') ||
        itemFromList?.notify_party_details_id ||
        itemFromList?.notify_party_id ||
        itemFromList?.id ||
        itemFromList?._id ||
        itemFromList?.value,
      ''
    );

    const rawPartyString =
      typeof rawPartyField === 'string' && rawPartyField.trim() && !isRawDbId(rawPartyField.trim())
        ? formatMultilineValue(rawPartyField.trim())
        : '';

    const rawPartyObjectDetails =
      typeof rawPartyField === 'object' && rawPartyField !== null
        ? rawPartyField.details ||
          rawPartyField.notify_party ||
          rawPartyField.text ||
          formatPartyDetails(rawPartyField)
        : '';

    const itemDetails = itemFromList
      ? typeof itemFromList === 'string'
        ? !isRawDbId(itemFromList.trim())
          ? formatMultilineValue(itemFromList.trim())
          : ''
        : itemFromList.details ||
          itemFromList.notify_party ||
          itemFromList.text ||
          formatPartyDetails(itemFromList)
      : '';

    const details = safeString(
      initialData?.[`notify_party_${index1Based}_details`] ||
        si?.[`notify_party_${index1Based}_details`] ||
        initialData?.[`notify_party_${index1Based}_text`] ||
        si?.[`notify_party_${index1Based}_text`] ||
        rawPartyString ||
        rawPartyObjectDetails ||
        itemDetails,
      ''
    );

    return { id, details };
  }, [initialData]);

  const [notifyParty1Id, setNotifyParty1Id] = useState<string>(() => {
    return extractInitialParty(1).id;
  });

  const [notifyParty1Details, setNotifyParty1Details] = useState<string>(() => {
    return extractInitialParty(1).details;
  });

  const [notifyParty2Id, setNotifyParty2Id] = useState<string>(() => {
    return extractInitialParty(2).id;
  });

  const [notifyParty2Details, setNotifyParty2Details] = useState<string>(() => {
    return extractInitialParty(2).details;
  });

  // Additional Notify Parties (03 to 06: Max 4 extra in the row below)
  const [extraNotifyParties, setExtraNotifyParties] = useState<Array<{ id: string; details: string }>>(() => {
    const extras: Array<{ id: string; details: string }> = [];
    for (let i = 3; i <= 6; i++) {
      const party = extractInitialParty(i);
      if (party.id || party.details) {
        extras.push(party);
      }
    }
    return extras;
  });

  // Whether SSR-provided initialConsignees / initialNotifyParties match the current effectiveBuyerInstructionId
  const cleanInitialConsigneesBuyerId = sanitizeDocId(initialConsigneesBuyerId);
  const ssrMatchesBuyer = Boolean(
    cleanInitialConsigneesBuyerId &&
      effectiveBuyerInstructionId &&
      cleanInitialConsigneesBuyerId === effectiveBuyerInstructionId
  );

  // State for fetched consignees and notify parties from APIs (strictly scoped to effectiveBuyerInstructionId)
  const [consigneesList, setConsigneesList] = useState<any[]>(() => {
    return ssrMatchesBuyer && Array.isArray(initialConsignees) && initialConsignees.length > 0
      ? initialConsignees
      : [];
  });
  const [notifyPartiesList, setNotifyPartiesList] = useState<any[]>(() => {
    return ssrMatchesBuyer && Array.isArray(initialNotifyParties) && initialNotifyParties.length > 0
      ? initialNotifyParties
      : [];
  });
  const [isLoadingConsignees, setIsLoadingConsignees] = useState<boolean>(false);
  const [isLoadingNotifyParties, setIsLoadingNotifyParties] = useState<boolean>(false);

  // Track which buyer_instruction_id the current lists belong to so changing Importer/SI always re-fetches
  const loadedConsigneesBuyerIdRef = useRef<string>(
    ssrMatchesBuyer && Array.isArray(initialConsignees) && initialConsignees.length > 0
      ? effectiveBuyerInstructionId
      : ''
  );
  const loadedNotifyBuyerIdRef = useRef<string>(
    ssrMatchesBuyer && Array.isArray(initialNotifyParties) && initialNotifyParties.length > 0
      ? effectiveBuyerInstructionId
      : ''
  );

  // Fetch consignees and notify parties from API whenever effectiveBuyerInstructionId changes
  useEffect(() => {
    if (!effectiveBuyerInstructionId) {
      loadedConsigneesBuyerIdRef.current = '';
      loadedNotifyBuyerIdRef.current = '';
      setConsigneesList([]);
      setNotifyPartiesList([]);
      setIsLoadingConsignees(false);
      setIsLoadingNotifyParties(false);
      return;
    }

    let isMounted = true;
    const targetBuyerId = effectiveBuyerInstructionId;

    if (loadedConsigneesBuyerIdRef.current !== targetBuyerId) {
      setConsigneesList([]);
      setIsLoadingConsignees(true);
      getBuyerConsigneesAction(targetBuyerId, { lang, source: 'web' })
        .then((res) => {
          if (!isMounted) return;
          if (res?.success && Array.isArray(res.data)) {
            setConsigneesList(res.data);
            loadedConsigneesBuyerIdRef.current = targetBuyerId;
          } else {
            setConsigneesList([]);
          }
        })
        .catch((err) => {
          console.error('[ShipmentInstruction] Error fetching consignees:', err);
          if (isMounted) setConsigneesList([]);
        })
        .finally(() => {
          if (isMounted) setIsLoadingConsignees(false);
        });
    }

    if (loadedNotifyBuyerIdRef.current !== targetBuyerId) {
      setNotifyPartiesList([]);
      setIsLoadingNotifyParties(true);
      getBuyerNotifyPartiesAction(targetBuyerId, { lang, source: 'web' })
        .then((res) => {
          if (!isMounted) return;
          if (res?.success && Array.isArray(res.data)) {
            setNotifyPartiesList(res.data);
            loadedNotifyBuyerIdRef.current = targetBuyerId;
          } else {
            setNotifyPartiesList([]);
          }
        })
        .catch((err) => {
          console.error('[ShipmentInstruction] Error fetching notify parties:', err);
          if (isMounted) setNotifyPartiesList([]);
        })
        .finally(() => {
          if (isMounted) setIsLoadingNotifyParties(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [effectiveBuyerInstructionId, lang]);

  // Auto-populate consignee details on initial load if matching consignee exists in fetched list and details are empty
  useEffect(() => {
    if (consigneesList.length > 0 && (consigneeId || consigneeName)) {
      const targetId = String(consigneeId || '').trim().toLowerCase();
      const targetName = String(consigneeName || '').trim().toLowerCase();
      const matched = consigneesList.find((c) => {
        if (!c) return false;
        const candidateIds = [c.consignee_details_id, c.id, c._id, c.consignee_id, c.value]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim().toLowerCase());
        const name = String(c.company_name || c.name || c.label || '').trim().toLowerCase();
        return Boolean((targetId && candidateIds.includes(targetId)) || (targetName && name && name === targetName));
      });
      if (matched) {
        if (!consigneeDetails) {
          const formatted = formatPartyDetails(matched);
          if (formatted) setConsigneeDetails(formatted);
        }
        if (!consigneeName) setConsigneeName(matched.company_name || matched.name || matched.label || '');
        if (!consigneeId) setConsigneeId(String(matched.consignee_details_id || matched.id || matched._id || matched.consignee_id || ''));
      }
    }
  }, [consigneesList, consigneeId, consigneeName, consigneeDetails]);

  const extraNotifySyncKey = extraNotifyParties
    .map((p) => `${p.id || ''}:${p.details ? '1' : '0'}`)
    .join('|');

  useEffect(() => {
    if (notifyPartiesList.length > 0) {
      const matchPartySimple = (n: any, targetVal: string) => {
        if (!n || !targetVal) return false;
        const s = String(targetVal).trim().toLowerCase();
        const candidateIds = [
          n.notify_party_details_id,
          n.id,
          n._id,
          n.notify_party_id,
          n.value,
        ]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim().toLowerCase());
        const name = String(n.company_name || n.name || n.label || n.business_name || n.title || '').trim().toLowerCase();
        return Boolean(candidateIds.includes(s) || (name && name === s));
      };

      const resolveMatchedDetails = (targetId: string): string => {
        const matchedFromList = notifyPartiesList.find((n) => matchPartySimple(n, targetId));
        if (matchedFromList) {
          return (
            formatPartyDetails(matchedFromList) ||
            safeString(matchedFromList.company_name || matchedFromList.name || matchedFromList.label, '')
          );
        }
        return '';
      };

      if (notifyParty1Id && !notifyParty1Details) {
        const formatted = resolveMatchedDetails(notifyParty1Id);
        if (formatted) setNotifyParty1Details(formatted);
      }

      if (notifyParty2Id && !notifyParty2Details) {
        const formatted = resolveMatchedDetails(notifyParty2Id);
        if (formatted) setNotifyParty2Details(formatted);
      }

      if (extraNotifyParties.length > 0) {
        setExtraNotifyParties((prev) => {
          let hasChanges = false;
          const updated = prev.map((p) => {
            if (p.id && !p.details) {
              const formatted = resolveMatchedDetails(p.id);
              if (formatted) {
                hasChanges = true;
                return { ...p, details: formatted };
              }
            }
            return p;
          });
          return hasChanges ? updated : prev;
        });
      }
    }
  }, [notifyPartiesList, notifyParty1Id, notifyParty1Details, notifyParty2Id, notifyParty2Details, extraNotifySyncKey]);

  // Consignee select options (strictly from fetched consigneesList for effectiveBuyerInstructionId; never mixes in unrelated buyers)
  const consigneeSelectOptions = useMemo<DocSelectOption[]>(() => {
    const list: DocSelectOption[] = [];
    const seenValues = new Set<string>();

    if (Array.isArray(consigneesList) && consigneesList.length > 0) {
      consigneesList.forEach((item, idx) => {
        const val = String(item.consignee_details_id || item.id || item._id || item.consignee_id || item.value || `consignee-${idx}`).trim();
        const lbl = String(item.company_name || item.name || item.label || 'Unnamed Consignee').trim();
        const sub = String(item.address || [item.city, item.country].filter(Boolean).join(', ') || item.subLabel || '').trim();
        if (val && !seenValues.has(val)) {
          seenValues.add(val);
          list.push({
            value: val,
            label: lbl && !isRawDbId(lbl) ? lbl : 'Consignee',
            subLabel: sub,
          });
        }
      });
    }

    // Preserve currently selected consigneeId (e.g. saved or custom entry) with a clean user-friendly label (never raw DB ID)
    if (consigneeId && consigneeId.trim()) {
      const cleanId = consigneeId.trim();
      const existingIdx = list.findIndex((o) => String(o.value) === cleanId);
      if (existingIdx === -1) {
        let cleanLabel = consigneeName?.trim() || '';
        if (!cleanLabel || isRawDbId(cleanLabel)) {
          if (consigneeDetails && consigneeDetails.trim()) {
            const firstLine = consigneeDetails.split('\n')[0].trim();
            if (firstLine && !isRawDbId(firstLine)) {
              cleanLabel = firstLine;
            }
          }
        }
        if (!cleanLabel || isRawDbId(cleanLabel)) {
          const matched = (consigneesList || []).find((c) => {
            if (!c) return false;
            const ids = [c.consignee_details_id, c.id, c._id, c.consignee_id, c.value].map((v) => String(v || '').trim());
            return ids.includes(cleanId);
          });
          if (matched) {
            cleanLabel = matched.company_name || matched.name || matched.label || 'Selected Consignee';
          }
        }

        const sub = consigneeDetails ? consigneeDetails.split('\n').slice(1).join(', ').trim() || consigneeDetails.split('\n')[0] : '';

        list.unshift({
          value: cleanId,
          label: cleanLabel && !isRawDbId(cleanLabel) ? cleanLabel : 'Selected Consignee',
          subLabel: sub,
        });
      }
    }

    return list;
  }, [consigneesList, consigneeId, consigneeName, consigneeDetails]);

  // All Notify Party options (strictly from fetched notifyPartiesList for effectiveBuyerInstructionId; never falls back to buyers)
  const allNotifyOptions = useMemo<DocSelectOption[]>(() => {
    if (!Array.isArray(notifyPartiesList) || notifyPartiesList.length === 0) {
      return [];
    }
    const list: DocSelectOption[] = [];
    const seenValues = new Set<string>();
    notifyPartiesList.forEach((item, idx) => {
      const val = String(item.notify_party_details_id || item.id || item._id || item.notify_party_id || item.company_name || `notify-${idx}`).trim();
      const lbl = String(item.company_name || item.name || item.label || 'Unnamed Notify Party').trim();
      const sub = String(item.address || [item.city, item.country].filter(Boolean).join(', ') || item.subLabel || '').trim();
      if (val && !seenValues.has(val)) {
        seenValues.add(val);
        list.push({
          value: val,
          label: lbl && !isRawDbId(lbl) ? lbl : 'Notify Party',
          subLabel: sub,
        });
      }
    });
    return list;
  }, [notifyPartiesList]);

  // Helper to generate options for any notify party slot, excluding options selected in other slots
  const getFilteredNotifyOptions = useCallback(
    (slotIndex: number, currentId: string, currentDetails: string) => {
      const otherSelectedIds = new Set<string>();
      const otherSelectedLabels = new Set<string>();

      const registerSelected = (partyNum: number, id: string) => {
        if (partyNum !== slotIndex && id && id.trim()) {
          const cleanId = id.trim();
          otherSelectedIds.add(cleanId);
          const match = allNotifyOptions.find((o) => String(o.value) === cleanId);
          if (match && match.label) {
            otherSelectedLabels.add(match.label.trim().toLowerCase());
          }
        }
      };

      registerSelected(1, notifyParty1Id);
      registerSelected(2, notifyParty2Id);
      extraNotifyParties.forEach((p, idx) => {
        registerSelected(idx + 3, p.id);
      });

      let list = allNotifyOptions.filter((opt) => {
        const optVal = String(opt.value).trim();
        const optLabel = opt.label.trim().toLowerCase();
        if (otherSelectedIds.has(optVal)) return false;
        if (otherSelectedLabels.has(optLabel)) return false;
        return true;
      });

      // Ensure the currently selected option is preserved in the list with a clean label
      if (currentId && !list.some((o) => String(o.value) === String(currentId))) {
        const currentMatched = allNotifyOptions.find((o) => String(o.value) === String(currentId));
        const firstLine = currentDetails ? currentDetails.split('\n')[0].trim() : '';
        const fallbackLabel =
          firstLine && !isRawDbId(firstLine)
            ? firstLine
            : !isRawDbId(currentId)
            ? currentId
            : `Notify Party 0${slotIndex}`;
        list = [
          currentMatched || {
            value: currentId,
            label: fallbackLabel,
            subLabel: currentDetails || '',
          },
          ...list,
        ];
      }

      return list;
    },
    [allNotifyOptions, notifyParty1Id, notifyParty2Id, extraNotifyParties]
  );

  // Options for NOTIFY PARTY 01: Excludes options selected in other slots
  const notifyParty1Options = useMemo(
    () => getFilteredNotifyOptions(1, notifyParty1Id, notifyParty1Details),
    [getFilteredNotifyOptions, notifyParty1Id, notifyParty1Details]
  );

  // Options for NOTIFY PARTY 02: Excludes options selected in other slots
  const notifyParty2Options = useMemo(
    () => getFilteredNotifyOptions(2, notifyParty2Id, notifyParty2Details),
    [getFilteredNotifyOptions, notifyParty2Id, notifyParty2Details]
  );

  // Robust matcher for Notify Parties (strictly matches fetched notifyPartiesList for effectiveBuyerInstructionId)
  const findNotifyPartyMatch = useCallback(
    (searchVal: string) => {
      if (!searchVal) return null;
      const s = String(searchVal).trim();
      const sLower = s.toLowerCase();

      // 1. Check in notifyPartiesList
      for (const n of notifyPartiesList) {
        if (!n) continue;
        const candidateIds = [n.notify_party_details_id, n.id, n._id, n.notify_party_id, n.value]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim());
        const name = String(n.company_name || n.name || n.label || n.business_name || n.title || '').trim();
        if (candidateIds.some((id) => id === s || id.toLowerCase() === sLower)) return n;
        if ((name && name === s) || (name && name.toLowerCase() === sLower)) return n;
      }

      // 2. Check in allNotifyOptions (carries pre-formatted label and subLabel)
      const optMatch = allNotifyOptions.find(
        (o) =>
          String(o.value).trim().toLowerCase() === sLower ||
          String(o.label).trim().toLowerCase() === sLower
      );
      if (optMatch) {
        return {
          id: optMatch.value,
          company_name: optMatch.label,
          address: optMatch.subLabel,
          details: [optMatch.label, optMatch.subLabel].filter(Boolean).join('\n'),
        };
      }

      return null;
    },
    [notifyPartiesList, allNotifyOptions]
  );

  // Robust matcher for Consignees (strictly matches fetched consigneesList for effectiveBuyerInstructionId)
  const findConsigneeMatch = useCallback(
    (searchVal: string) => {
      if (!searchVal) return null;
      const s = String(searchVal).trim();
      const sLower = s.toLowerCase();

      for (const c of consigneesList) {
        if (!c) continue;
        const candidateIds = [c.consignee_details_id, c.id, c._id, c.consignee_id, c.value]
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
          .map((v) => String(v).trim());
        const name = String(c.company_name || c.name || c.label || '').trim();
        if (candidateIds.some((id) => id === s || id.toLowerCase() === sLower)) return c;
        if ((name && name === s) || (name && name.toLowerCase() === sLower)) return c;
      }

      return null;
    },
    [consigneesList]
  );

  const handleConsigneeSelect = (val: string) => {
    markDirty();
    setConsigneeId(val);
    const matched = findConsigneeMatch(val);
    if (matched) {
      setConsigneeName(matched.company_name || matched.name || matched.label || val);
      const formatted = formatPartyDetails(matched);
      if (formatted) setConsigneeDetails(formatted);
      else setConsigneeDetails(val);
    } else {
      setConsigneeName(val);
      setConsigneeDetails(val);
    }
  };

  const handleNotify1Select = (val: string) => {
    markDirty();
    setNotifyParty1Id(val);
    const matched = findNotifyPartyMatch(val);
    if (matched) {
      const formatted = formatPartyDetails(matched);
      setNotifyParty1Details(formatted || String(matched.company_name || matched.name || matched.label || val));
    } else {
      setNotifyParty1Details(val);
    }
  };

  const handleNotify2Select = (val: string) => {
    markDirty();
    setNotifyParty2Id(val);
    const matched = findNotifyPartyMatch(val);
    if (matched) {
      const formatted = formatPartyDetails(matched);
      setNotifyParty2Details(formatted || String(matched.company_name || matched.name || matched.label || val));
    } else {
      setNotifyParty2Details(val);
    }
  };

  // Extra Notify Parties Handlers (03 to 06)
  const handleExtraNotifySelect = (index: number, val: string) => {
    markDirty();
    setExtraNotifyParties((prev) => {
      const updated = [...prev];
      let details = '';
      const matched = findNotifyPartyMatch(val);
      if (matched) {
        details = formatPartyDetails(matched);
      }
      updated[index] = {
        ...updated[index],
        id: val,
        details: details || String(matched?.company_name || matched?.name || matched?.label || val),
      };
      return updated;
    });
  };

  const handleExtraNotifyDetailsChange = (index: number, val: string) => {
    markDirty();
    setExtraNotifyParties((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          details: val,
        };
      }
      return updated;
    });
  };

  // Whether user can add another notify party:
  // Requires preceding party to have an ID, and total count < 4
  const canAddMoreNotifyParty = useMemo(() => {
    if (extraNotifyParties.length >= 4) return false;
    if (extraNotifyParties.length === 0) {
      return Boolean(notifyParty1Id && notifyParty2Id);
    }
    const lastParty = extraNotifyParties[extraNotifyParties.length - 1];
    return Boolean(lastParty && lastParty.id);
  }, [extraNotifyParties, notifyParty1Id, notifyParty2Id]);

  const handleAddExtraNotifyParty = () => {
    if (extraNotifyParties.length >= 4) {
      toast.warning('Maximum 6 Notify Parties allowed (4 additional).');
      return;
    }
    if (extraNotifyParties.length === 0) {
      if (!notifyParty2Id) {
        toast.info('Please select Notify Party 02 first');
        return;
      }
    } else {
      const prevParty = extraNotifyParties[extraNotifyParties.length - 1];
      if (!prevParty?.id) {
        toast.info(`Please select Notify Party 0${extraNotifyParties.length + 2} first`);
        return;
      }
    }
    markDirty();
    setExtraNotifyParties((prev) => [...prev, { id: '', details: '' }]);
  };

  const handleRemoveNotifyParty2 = () => {
    markDirty();
    if (extraNotifyParties.length > 0) {
      // Shift 1st extra party (Notify Party 03) into Notify Party 02
      const firstExtra = extraNotifyParties[0];
      setNotifyParty2Id(firstExtra.id);
      setNotifyParty2Details(firstExtra.details);
      // Remove that 1st extra party from extraNotifyParties so remaining parties shift (04 -> 03, 05 -> 04, etc.)
      setExtraNotifyParties((prev) => prev.slice(1));
    } else {
      // No extra parties exist, clear Notify Party 02
      setNotifyParty2Id('');
      setNotifyParty2Details('');
    }
  };

  const handleRemoveExtraNotifyParty = (index: number) => {
    markDirty();
    setExtraNotifyParties((prev) => prev.filter((_, i) => i !== index));
  };

  // ==========================================
  // 4. ROW 3: ROUTE (5 STATIC TEXT + 1 EDITABLE INPUT)
  // ==========================================
  // 5 STATIC DISPLAY FIELDS:
  // PRE-CARRIAGE BY: User requirement: Fixed static value is always "BY SEA"
  const preCarriageBy = 'BY SEA';

  const placeOfReceipt = useMemo(() => {
    const extractedCountry = extractLoadingPortCountry(initialData, products);
    return safeString(
      initialData?.place_of_receipt ||
        initialData?.place_of_receipt_by_pre_carrier ||
        extractedCountry ||
        initialData?.country_of_origin ||
        initialData?.origin_country ||
        initialData?.loading_port_country ||
        initialData?.product_country ||
        initialData?.country ||
        initialData?.contract?.country ||
        initialData?.confirmation?.country ||
        initialData?.contract?.place_of_receipt ||
        initialData?.proforma?.place_of_receipt ||
        initialData?.shipment_instruction?.place_of_receipt,
      ''
    );
  }, [initialData, products]);

  // VESSEL / VOYAGE NO.: User requirement: Static value is always "AS PER BL"
  const vesselVoyageNo = 'AS PER BL';

  const portOfLoading = useMemo(() => {
    return extractPortDisplayName(
      initialData?.port_of_loading ||
        initialData?.loading_port ||
        initialData?.loadingPort ||
        initialData?.contract?.loading_port ||
        initialData?.confirmation?.loading_port,
      safeString(initialData?.loading_port_name, '')
    );
  }, [initialData]);

  const portOfDischarge = useMemo(() => {
    return extractPortDisplayName(
      initialData?.port_of_discharge ||
        initialData?.destination_port ||
        initialData?.port_of_destination ||
        initialData?.destinationPort ||
        initialData?.contract?.destination_port ||
        initialData?.confirmation?.destination_port,
      safeString(initialData?.destination_port_name, '')
    );
  }, [initialData]);

  // 1 EDITABLE INPUT: PLACE OF DELIVERY (strictly bound to place_of_delivery key)
  const [placeOfDelivery, setPlaceOfDelivery] = useState<string>(() => {
    return safeString(
      initialData?.place_of_delivery ??
        initialData?.shipment_instruction?.place_of_delivery ??
        initialData?.placeOfDelivery,
      ''
    );
  });

  // ==========================================
  // 5. ROW 4: GOODS & CONTAINERS
  // ==========================================
  // COLUMN 1: Container Nos. Marks & Numbers
  // Marks Name (EDITABLE INPUT with pencil):
  const [marksAndNumbers, setMarksAndNumbers] = useState<string>(() => {
    const rawMarks =
      initialData?.marks_and_numbers ||
      initialData?.marking_brand ||
      initialData?.container_marks ||
      initialData?.marks_numbers ||
      initialData?.markingBrand ||
      initialData?.containerMarks ||
      initialData?.brand ||
      initialData?.marking ||
      initialData?.contract?.marking_brand ||
      initialData?.contract?.brand ||
      initialData?.confirmation?.marking_brand ||
      initialData?.proforma?.marking_brand ||
      initialData?.buyer_instruction?.marking_brand ||
      initialData?.buyer_instruction?.marking;
    return safeString(rawMarks, '');
  });

  // Marks / Bag Photo Image (Response key: bag_photo_url / BAG_PHOTO_URL):
  const [marksImageUrl, setMarksImageUrl] = useState<string>(() => {
    const initialUrl = extractBagPhotoUrl(initialData);
    if (initialUrl) {
      lastInitialBagPhotoRef.current = initialUrl;
    }
    return initialUrl;
  });

  // COLUMN 2: Description of Goods
  // STATIC TEXT FIELDS:
  const productName = useMemo(() => {
    return safeString(
      initialData?.product_name ||
        initialData?.product?.name ||
        initialData?.product_title ||
        initialData?.commodity ||
        initialData?.commodity_name ||
        initialData?.goods_description ||
        initialData?.contract?.commodity ||
        initialData?.contract?.product_name ||
        initialData?.confirmation?.commodity,
      ''
    );
  }, [initialData]);

  const packingDescription = useMemo(() => {
    return safeString(
      initialData?.packing_type_title ||
        initialData?.packing_type?.title ||
        initialData?.packing_type?.name ||
        initialData?.shipment_instruction?.packing_type_title ||
        initialData?.proforma?.packing_type_title ||
        initialData?.contract?.packing_type_title ||
        initialData?.confirmation?.packing_type_title ||
        initialData?.packing_description ||
        initialData?.packing_type ||
        initialData?.packing ||
        initialData?.contract?.packing_type ||
        initialData?.contract?.packing ||
        initialData?.confirmation?.packing_type,
      ''
    );
  }, [initialData]);

  const fclType = useMemo(() => {
    return formatFclType(
      initialData?.fcl_type ||
        initialData?.fclType ||
        initialData?.ship_by ||
        initialData?.shipBy ||
        initialData?.contract?.fcl_type ||
        initialData?.confirmation?.fcl_type,
      ''
    );
  }, [initialData]);

  // Table Data (STATIC TEXT DISPLAY ONLY):
  const fclQuantity = useMemo(() => {
    const q =
      initialData?.fcl_quantity ??
      initialData?.fcl_qty ??
      initialData?.fclQty ??
      initialData?.contract?.fcl_quantity ??
      initialData?.contract?.fcl_qty ??
      initialData?.confirmation?.fcl_quantity;
    return q !== undefined && q !== null && q !== '' ? q : '';
  }, [initialData]);

  const fclCapacity = useMemo(() => {
    const c =
      initialData?.fcl_capacity ??
      initialData?.fclCapacity ??
      initialData?.contract?.fcl_capacity ??
      initialData?.confirmation?.fcl_capacity;
    return c !== undefined && c !== null && c !== '' ? c : '';
  }, [initialData]);

  const mtQuantity = useMemo(() => {
    const q =
      initialData?.mt_quantity ||
      initialData?.quantity_mt ||
      initialData?.quantity ||
      initialData?.contract?.mt_quantity ||
      initialData?.contract?.quantity_mt ||
      initialData?.confirmation?.quantity_mt;
    if (q) return q;
    const fq = Number(fclQuantity) || 0;
    const fc = Number(fclCapacity) || 0;
    return fq * fc > 0 ? fq * fc : '';
  }, [initialData, fclQuantity, fclCapacity]);

  const bagWeightKg = useMemo(() => {
    const parsed =
      parsePackingBagWeightKg(packingDescription) ||
      parsePackingBagWeightKg(
        safeString(
          initialData?.packing_description ||
            initialData?.packing_type ||
            initialData?.packing,
          ''
        )
      );
    return parsed && parsed > 0 ? parsed : 0;
  }, [packingDescription, initialData]);

  const bagQuantity = useMemo(() => {
    if (initialData?.bag_quantity || initialData?.total_bags) {
      return initialData.bag_quantity || initialData.total_bags;
    }
    const mt = Number(mtQuantity) || 0;
    if (mt > 0 && bagWeightKg > 0) {
      return Math.round((mt * 1000) / bagWeightKg);
    }
    return '';
  }, [initialData, mtQuantity, bagWeightKg]);

  const ratePrice = useMemo(() => {
    const p =
      initialData?.rate_price ??
      initialData?.price ??
      initialData?.rate ??
      initialData?.contract?.price ??
      initialData?.contract?.rate ??
      initialData?.confirmation?.price;
    return p !== undefined && p !== null && p !== '' ? p : '';
  }, [initialData]);

  const totalValue = useMemo(() => {
    if (initialData?.total_value || initialData?.total_amount) {
      return initialData.total_value || initialData.total_amount;
    }
    const mt = Number(mtQuantity) || 0;
    const rate = Number(ratePrice) || 0;
    return mt * rate > 0 ? mt * rate : '';
  }, [initialData, mtQuantity, ratePrice]);

  const currencySymbol = useMemo(() => {
    const cCode =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.currency_id ||
      initialData?.contract?.currency ||
      initialData?.confirmation?.currency;
    if (cCode) {
      return getCurrencySymbol(cCode, currencies);
    }
    return safeString(
      initialData?.currency_symbol ||
        initialData?.currency?.symbol,
      '$'
    );
  }, [initialData, currencies]);

  // Additional Specifications (STATIC TEXT DISPLAY):
  const sbillNo = useMemo(() => {
    return safeString(initialData?.sbill_no || initialData?.shipping_bill_no, '-');
  }, [initialData]);

  const hsCode = useMemo(() => {
    return safeString(
      initialData?.hs_code ||
        initialData?.hsn_code ||
        initialData?.hsnCode ||
        initialData?.hsn ||
        initialData?.product?.hsn ||
        initialData?.contract?.hsn_code ||
        initialData?.confirmation?.hsn_code,
      '-'
    );
  }, [initialData]);

  const netWeight = useMemo(() => {
    return safeString(initialData?.net_weight, '-');
  }, [initialData]);

  const grossWeightCol2 = useMemo(() => {
    return safeString(initialData?.gross_weight_text, '-');
  }, [initialData]);

  const freeDays = useMemo(() => {
    return safeString(
      initialData?.free_days ||
        initialData?.freeDays ||
        initialData?.contract?.free_days,
      ''
    );
  }, [initialData]);

  const emptyBags = useMemo(() => {
    return safeString(
      initialData?.empty_bags ||
        initialData?.emptyBags ||
        initialData?.contract?.empty_bags,
      ''
    );
  }, [initialData]);

  // EDITABLE INPUTS in Column 2:
  // 1. Enter freight (EDITABLE INPUT with pencil):
  const [freight, setFreight] = useState<string>(() => {
    if (initialData?.freight) return safeString(initialData.freight, '');
    const term = safeString(
      initialData?.shipping_term ||
        initialData?.incoterm ||
        initialData?.contract?.shipping_term ||
        initialData?.confirmation?.shipping_term ||
        initialData?.delivery_terms ||
        ''
    ).toUpperCase();
    if (term.includes('CIF') || term.includes('CNF') || term.includes('CFR')) {
      return 'FREIGHT PREPAID';
    }
    if (term.includes('FOB')) {
      return 'FREIGHT TO COLLECT';
    }
    return '';
  });

  // Country Required Documents: ECTN & COC
  const isEctnField = useMemo(() => {
    const raw =
      initialData?.ectn_field ??
      initialData?.ectnField ??
      initialData?.ectn ??
      initialData?.contract?.ectn_field ??
      initialData?.contract?.ectn;
    return parseNullableBoolean(raw) === true;
  }, [initialData]);

  const ectnNumber = useMemo(() => {
    const val =
      initialData?.ectn_number ??
      initialData?.ectnNumber ??
      initialData?.contract?.ectn_number ??
      initialData?.contract?.ectnNumber;
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str === '-') {
      return '';
    }
    return str;
  }, [initialData]);

  const isCocField = useMemo(() => {
    const raw =
      initialData?.coc_field ??
      initialData?.coc_fields ??
      initialData?.cocField ??
      initialData?.cocFields ??
      initialData?.coc ??
      initialData?.contract?.coc_field ??
      initialData?.contract?.coc_fields ??
      initialData?.contract?.coc;
    return parseNullableBoolean(raw) === true;
  }, [initialData]);

  const [cocFieldsValue, setCocFieldsValue] = useState<string>(() => {
    const raw =
      initialData?.coc_fields_value ??
      initialData?.cocFieldsValue ??
      initialData?.coc_value ??
      initialData?.contract?.coc_fields_value;
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      return formatMultilineValue(raw);
    }
    return DEFAULT_COC_FIELDS_VALUE;
  });

  // 2. Special warning note (EDITABLE INPUT with pencil):
  // User requirement: Any value previously shown in vessel voyage is now populated into special instruction
  const [specialInstruction, setSpecialInstruction] = useState<string>(() => {
    return resolveInitialSpecialInstruction(initialData);
  });

  // COLUMN 3: Gross Weight (STATIC TEXT DISPLAY):
  const grossWeight = useMemo(() => {
    return safeString(initialData?.gross_weight, '-');
  }, [initialData]);

  // ==========================================
  // 6. ROW 5: SUMMARY TOTALS (ALL STATIC TEXT DISPLAY)
  // ==========================================
  const totalPackages = useMemo(() => {
    return safeString(initialData?.total_packages || initialData?.total_no_of_packages, bagQuantity ? String(bagQuantity) : '-');
  }, [initialData, bagQuantity]);

  const cleanTotalPackages = useMemo(() => {
    return String(totalPackages || '').replace(/,/g, '');
  }, [totalPackages]);

  const cleanBagQuantity = useMemo(() => {
    return String(bagQuantity || '').replace(/,/g, '');
  }, [bagQuantity]);

  const totalWeight = useMemo(() => {
    const raw =
      initialData?.net_weight ??
      initialData?.shipment_instruction?.net_weight;
    const str = safeString(raw, '');
    if (!str || str === '-') {
      return '000.000 KGS';
    }
    const match = str.match(/^([\d,]+(?:\.\d+)?)(?:\s*([a-zA-Z.]+))?$/);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(num)) {
        const unit = match[2] ? match[2].toUpperCase() : 'KGS';
        return `${num.toFixed(3)} ${unit}`;
      }
    }
    return /\b(?:kgs?|mts?|lbs?|g)\b/i.test(str) ? str : `${str} KGS`;
  }, [initialData]);

  // ==========================================
  // 7. ROW 6: CUSTOM REMARKS (2 EDITABLE INPUTS with pencil)
  // ==========================================
  const [remarksTitle, setRemarksTitle] = useState<string>(() => {
    return safeString(
      initialData?.remarks_title ||
        initialData?.comment_title ||
        initialData?.comment_label ||
        initialData?.commentTitle ||
        initialData?.commentLabel,
      ''
    );
  });

  const [remarksComment, setRemarksComment] = useState<string>(() => {
    return safeString(
      initialData?.remarks_comment ||
        initialData?.comment_value ||
        initialData?.comment_text ||
        initialData?.commentValue ||
        initialData?.commentText,
      ''
    );
  });

  // Comprehensive hydration effect: synchronizes state when initialData arrives or updates asynchronously
  useEffect(() => {
    if (!initialData) return;

    const rawCandidate =
      instructionId ||
      shipmentInstructionId ||
      initialData.shipment_instruction_id ||
      initialData.instruction_id ||
      initialData.shipment_id ||
      (initialData.id &&
       initialData.id !== contractId &&
       initialData.id !== confirmationId &&
       initialData.id !== proformaId
        ? initialData.id
        : '') ||
      (initialData._id &&
       initialData._id !== contractId &&
       initialData._id !== confirmationId &&
       initialData._id !== proformaId
        ? initialData._id
        : '');
    const cleanId = sanitizeDocId(rawCandidate);
    const hasDocIdChanged = Boolean(cleanId && cleanId !== lastLoadedDocIdRef.current);

    const isDataVersionTriggered = Boolean(
      dataVersion !== undefined && dataVersion !== lastDataVersionRef.current
    );

    // If form has already initialized, NEVER overwrite user edits unless stepper version changed or doc ID changed!
    if (isFormInitializedRef.current && !isDataVersionTriggered && !hasDocIdChanged && (isDirty || hasDraftChanges)) {
      return;
    }

    isFormInitializedRef.current = true;
    if (dataVersion !== undefined) {
      lastDataVersionRef.current = dataVersion;
    }
    if (cleanId) {
      lastLoadedDocIdRef.current = cleanId;
      setDraftId(cleanId);
    }
    setIsDirty(false);
    setHasDraftChanges(false);

    // Only update fields if user has not actively made manual edits (unless stepper navigation triggered a refresh)
    const initialConsignee = extractInitialConsignee(initialData);
    if (isDataVersionTriggered || hasDocIdChanged) {
      setConsigneeId(initialConsignee.id);
      setConsigneeName(initialConsignee.name);
      setConsigneeDetails(initialConsignee.details);
    } else {
      if (initialConsignee.id && (!consigneeId || !isDirty)) setConsigneeId(initialConsignee.id);
      if (initialConsignee.name && (!consigneeName || !isDirty)) setConsigneeName(initialConsignee.name);
      if (initialConsignee.details && (!consigneeDetails || !isDirty)) setConsigneeDetails(initialConsignee.details);
    }

    // Notify Parties
    const p1 = extractInitialParty(1);
    if (isDataVersionTriggered || hasDocIdChanged) {
      setNotifyParty1Id(p1.id);
      setNotifyParty1Details(p1.details);
    } else {
      if (p1.id && (!notifyParty1Id || !isDirty)) setNotifyParty1Id(p1.id);
      if (p1.details && (!notifyParty1Details || !isDirty)) setNotifyParty1Details(p1.details);
    }

    const p2 = extractInitialParty(2);
    if (isDataVersionTriggered || hasDocIdChanged) {
      setNotifyParty2Id(p2.id);
      setNotifyParty2Details(p2.details);
    } else {
      if (p2.id && (!notifyParty2Id || !isDirty)) setNotifyParty2Id(p2.id);
      if (p2.details && (!notifyParty2Details || !isDirty)) setNotifyParty2Details(p2.details);
    }

    if (!isDirty || isDataVersionTriggered || hasDocIdChanged) {
      const extras: Array<{ id: string; details: string }> = [];
      for (let i = 3; i <= 6; i++) {
        const party = extractInitialParty(i);
        if (party.id || party.details) {
          extras.push(party);
        }
      }
      if (isDataVersionTriggered || hasDocIdChanged || extras.length > 0) {
        setExtraNotifyParties(extras);
      }
    }

    // Place of delivery (strictly bound to place_of_delivery key)
    const pod = safeString(
      initialData.place_of_delivery ??
        initialData.shipment_instruction?.place_of_delivery ??
        initialData.placeOfDelivery,
      ''
    );
    if (isDataVersionTriggered || hasDocIdChanged) {
      setPlaceOfDelivery(pod);
    } else if (pod && (!placeOfDelivery || !isDirty)) {
      setPlaceOfDelivery(pod);
    }

    // Marks and numbers / Marking Brand / Container Marks
    const marks = safeString(
      initialData.marks_and_numbers ||
      initialData.marking_brand ||
      initialData.container_marks ||
      initialData.marks_numbers ||
      initialData.markingBrand ||
      initialData.containerMarks ||
      initialData.brand ||
      initialData.marking ||
      initialData.contract?.marking_brand ||
      initialData.contract?.brand ||
      initialData.confirmation?.marking_brand ||
      initialData.proforma?.marking_brand ||
      initialData.buyer_instruction?.marking_brand ||
      initialData.buyer_instruction?.marking,
      ''
    );
    if (marks && (isDataVersionTriggered || !marksAndNumbers || !isDirty)) {
      setMarksAndNumbers(marks);
    }

    // Marks / Bag photo image (Response key: bag_photo_url / BAG_PHOTO_URL)
    const marksImg = extractBagPhotoUrl(initialData);
    if (marksImg) {
      if (!hasUserSelectedNewImageRef.current) {
        if (!marksImageUrl || marksImg !== lastInitialBagPhotoRef.current) {
          setMarksImageUrl(marksImg);
          lastInitialBagPhotoRef.current = marksImg;
        }
      } else if (marksImg !== lastInitialBagPhotoRef.current && !marksImg.startsWith('blob:') && !marksImg.startsWith('data:')) {
        setMarksImageUrl(marksImg);
        lastInitialBagPhotoRef.current = marksImg;
        hasUserSelectedNewImageRef.current = false;
        marksImageFileRef.current = null;
      }
    }

    // Freight
    const fr = safeString(initialData.freight, '');
    if (isDataVersionTriggered && fr) {
      setFreight(fr);
    } else if (fr && (!freight || !isDirty)) {
      setFreight(fr);
    } else if (!freight) {
      const term = safeString(
        initialData?.shipping_term ||
          initialData?.incoterm ||
          initialData?.contract?.shipping_term ||
          initialData?.confirmation?.shipping_term ||
          initialData?.delivery_terms ||
          ''
      ).toUpperCase();
      if (term.includes('CIF') || term.includes('CNF') || term.includes('CFR')) {
        setFreight('FREIGHT PREPAID');
      } else if (term.includes('FOB')) {
        setFreight('FREIGHT TO COLLECT');
      }
    }

    // COC fields value
    const rawCoc =
      initialData.coc_fields_value ??
      initialData.cocFieldsValue ??
      initialData.coc_value ??
      initialData.contract?.coc_fields_value;
    if (rawCoc !== null && rawCoc !== undefined && String(rawCoc).trim() !== '') {
      const formattedCoc = formatMultilineValue(rawCoc);
      if ((!isDirty || isDataVersionTriggered) && (!cocFieldsValue || cocFieldsValue === DEFAULT_COC_FIELDS_VALUE || cocFieldsValue === 'IDF:\nUCR:\nPIP:')) {
        setCocFieldsValue(formattedCoc);
      }
    }

    // Special instruction
    const nextSi = resolveInitialSpecialInstruction(initialData);
    if (isDataVersionTriggered || (!isDirty && specialInstruction !== nextSi)) {
      setSpecialInstruction(nextSi);
    }

    // Remarks
    const rt = safeString(
      initialData.remarks_title ||
        initialData.comment_title ||
        initialData.comment_label ||
        initialData.commentTitle,
      ''
    );
    if (rt && (isDataVersionTriggered || !remarksTitle || !isDirty)) setRemarksTitle(rt);

    const rc = safeString(
      initialData.remarks_comment ||
        initialData.comment_value ||
        initialData.comment_text ||
        initialData.commentValue,
      ''
    );
    if (rc && (isDataVersionTriggered || !remarksComment || !isDirty)) setRemarksComment(rc);

    // Document Title & Watermark
    const titleVal = safeString(initialData.pdf_title || initialData.document_title || initialData.title, '');
    if (isDataVersionTriggered ? Boolean(titleVal) : (titleVal && (!documentTitle || !isDirty))) setDocumentTitle(titleVal);

    if (!isDirty || isDataVersionTriggered) {
      if (initialData.is_watermark_enabled !== undefined) setWatermark(Boolean(initialData.is_watermark_enabled));
      else if (initialData.watermark !== undefined) setWatermark(Boolean(initialData.watermark));
    }

  }, [
    initialData,
    dataVersion,
    instructionId,
    shipmentInstructionId,
    contractId,
    confirmationId,
    proformaId,
    extractInitialConsignee,
    extractInitialParty,
  ]);

  // Image Upload Handler
  const handleMarksImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      marksImageFileRef.current = file;
      hasUserSelectedNewImageRef.current = true;
      const url = URL.createObjectURL(file);
      setMarksImageUrl(url);
      markDirty();
      if (
        errors.bag_photo_url ||
        errors.bagPhotoUrl ||
        errors.bag_photo ||
        errors.container_marks_image ||
        errors.marks_image ||
        errors.marksImage
      ) {
        setErrors((prev) => ({
          ...prev,
          bag_photo_url: '',
          bagPhotoUrl: '',
          bag_photo: '',
          container_marks_image: '',
          marks_image: '',
          marksImage: '',
        }));
      }
    }
  };

  // Build Payload
  const getFormDataPayload = useCallback((): FormData => {
    const fd = new FormData();
    const isSelfIdValid =
      draftId &&
      draftId !== contractId &&
      draftId !== confirmationId &&
      draftId !== proformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(draftId);
    if (isSelfIdValid) {
      fd.append('id', draftId);
      fd.append('shipment_instruction_id', draftId);
    }
    if (proformaId) fd.append('proforma_id', proformaId);
    if (contractId) fd.append('contract_id', contractId);
    if (confirmationId) fd.append('confirmation_id', confirmationId);
    if (effectiveBuyerInstructionId) fd.append('buyer_instruction_id', effectiveBuyerInstructionId);

    fd.append('document_title', documentTitle);
    fd.append('pdf_title', documentTitle);
    fd.append('is_watermark_enabled', String(watermark));

    // Shipper & B/L
    fd.append('shipper_name', shipperName);
    fd.append('shipper_details', shipperDetails);
    fd.append('bl_type', blType);
    fd.append('scan_code', scanCode);

    // Consignee: Dropdown ID is consignee_details_id (with consignee_id alias), Textarea is consignee_details
    const effConsigneeId = consigneeId?.trim() || '';
    const effConsigneeDetails = consigneeDetails?.trim() || '';
    const effConsigneeName = consigneeName?.trim() || (effConsigneeDetails ? effConsigneeDetails.split('\n')[0].trim() : '');

    if (effConsigneeId || effConsigneeDetails) {
      const finalConsigneeId = effConsigneeId || 'custom';
      const finalConsigneeDetails = effConsigneeDetails || effConsigneeName || finalConsigneeId;
      fd.append('consignee_details_id', finalConsigneeId);
      fd.append('consignee_id', finalConsigneeId);
      fd.append('consignee_details', finalConsigneeDetails);
      if (effConsigneeName) {
        fd.append('consignee_name', effConsigneeName);
      }
    }

    // Notify Party 1: Dropdown ID is notify_party_1_id, Textarea is notify_party_1 (must both be provided or both omitted)
    const effNotify1Details = notifyParty1Details?.trim() || '';
    let effNotify1Id = notifyParty1Id?.trim() || '';

    if (effNotify1Details || effNotify1Id) {
      if (!effNotify1Id && effNotify1Details && notifyPartiesList.length > 0) {
        const matched = notifyPartiesList.find((n) => {
          const name = (n.company_name || n.name || n.label || '').toLowerCase();
          return name && effNotify1Details.toLowerCase().includes(name);
        });
        if (matched) {
          effNotify1Id = String(matched.notify_party_details_id || matched.id || matched._id || matched.notify_party_id || '');
        }
      }
      const finalNotify1Id = effNotify1Id || 'custom';
      const finalNotify1Details = effNotify1Details || finalNotify1Id;

      fd.append('notify_party_1_id', finalNotify1Id);
      fd.append('notify_party_1', finalNotify1Details);
      fd.append('notify_party_1_details', finalNotify1Details);
    }

    // Notify Party 2: Dropdown ID is notify_party_2_id, Textarea is notify_party_2 (must both be provided or both omitted)
    const effNotify2Details = notifyParty2Details?.trim() || '';
    let effNotify2Id = notifyParty2Id?.trim() || '';
    const hasNotify2 = Boolean(effNotify2Id || effNotify2Details);
    fd.append('has_notify_party_2', String(hasNotify2));

    if (hasNotify2) {
      if (!effNotify2Id && effNotify2Details && notifyPartiesList.length > 0) {
        const matched = notifyPartiesList.find((n) => {
          const name = (n.company_name || n.name || n.label || '').toLowerCase();
          return name && effNotify2Details.toLowerCase().includes(name);
        });
        if (matched) {
          effNotify2Id = String(matched.notify_party_details_id || matched.id || matched._id || matched.notify_party_id || '');
        }
      }
      const finalNotify2Id = effNotify2Id || 'custom';
      const finalNotify2Details = effNotify2Details || finalNotify2Id;

      fd.append('notify_party_2_id', finalNotify2Id);
      fd.append('notify_party_2', finalNotify2Details);
      fd.append('notify_party_2_details', finalNotify2Details);
    }

    // Additional Notify Parties (03 to 06: up to 4 extra)
    extraNotifyParties.forEach((party, idx) => {
      const partyNum = idx + 3;
      const rawDetails = party.details?.trim() || '';
      let rawId = party.id?.trim() || '';
      const hasParty = Boolean(rawId || rawDetails);
      fd.append(`has_notify_party_${partyNum}`, String(hasParty));

      if (hasParty) {
        if (!rawId && rawDetails && notifyPartiesList.length > 0) {
          const matched = notifyPartiesList.find((n) => {
            const name = (n.company_name || n.name || n.label || '').toLowerCase();
            return name && rawDetails.toLowerCase().includes(name);
          });
          if (matched) rawId = String(matched.notify_party_details_id || matched.id || matched._id || matched.notify_party_id || '');
        }
        const finalExtraId = rawId || 'custom';
        const finalExtraDetails = rawDetails || finalExtraId;

        fd.append(`notify_party_${partyNum}_id`, finalExtraId);
        fd.append(`notify_party_${partyNum}`, finalExtraDetails);
        fd.append(`notify_party_${partyNum}_details`, finalExtraDetails);
      }
    });

    // Also send structured JSON list of all active notify parties
    const allNotifyPartiesList = [
      ...(effNotify1Id || effNotify1Details
        ? [{ party_number: 1, id: effNotify1Id || 'custom', notify_party_id: effNotify1Id || 'custom', notify_party: effNotify1Details, details: effNotify1Details }]
        : []),
      ...(hasNotify2
        ? [{ party_number: 2, id: effNotify2Id || 'custom', notify_party_id: effNotify2Id || 'custom', notify_party: effNotify2Details, details: effNotify2Details }]
        : []),
      ...extraNotifyParties
        .map((p, idx) => {
          const pDetails = p.details?.trim() || '';
          const pId = p.id?.trim() || (pDetails ? 'custom' : '');
          return {
            party_number: idx + 3,
            id: pId,
            notify_party_id: pId,
            notify_party: pDetails,
            details: pDetails,
          };
        })
        .filter((p) => Boolean(p.id || p.details)),
    ];
    if (allNotifyPartiesList.length > 0) {
      fd.append('notify_parties', JSON.stringify(allNotifyPartiesList));
      fd.append('notify_parties_json', JSON.stringify(allNotifyPartiesList));
    }

    // Logistics Route
    if (preCarriageBy && preCarriageBy.trim()) fd.append('pre_carriage_by', preCarriageBy.trim());
    if (placeOfReceipt && placeOfReceipt.trim()) fd.append('place_of_receipt', placeOfReceipt.trim());
    if (vesselVoyageNo && vesselVoyageNo.trim()) fd.append('vessel_voyage_no', vesselVoyageNo.trim());
    if (portOfLoading && portOfLoading.trim()) fd.append('port_of_loading', portOfLoading.trim());
    if (portOfDischarge && portOfDischarge.trim()) fd.append('port_of_discharge', portOfDischarge.trim());
    if (placeOfDelivery && placeOfDelivery.trim()) fd.append('place_of_delivery', placeOfDelivery.trim());

    // Goods & Containers: Marks & Numbers / Marking Brand / Container Marks
    const cleanMarks = safeString(marksAndNumbers).trim();
    if (cleanMarks) {
      fd.append('marks_and_numbers', cleanMarks);
      fd.append('marking_brand', cleanMarks);
      fd.append('container_marks', cleanMarks);
      fd.append('markingBrand', cleanMarks);
      fd.append('brand', cleanMarks);
      fd.append('marking', cleanMarks);
      fd.append('marks_numbers', cleanMarks);
      fd.append('marks', cleanMarks);
      fd.append('container_marks_numbers', cleanMarks);
      fd.append('container_marks_and_numbers', cleanMarks);
    } else {
      fd.append('marks_and_numbers', '');
      fd.append('marking_brand', '');
      fd.append('container_marks', '');
    }

    if (marksImageFileRef.current) {
      // Binary file upload with key 'bag_photo'
      fd.append('bag_photo', marksImageFileRef.current, marksImageFileRef.current.name || 'bag_photo.png');
    } else if (marksImageUrl && marksImageUrl.startsWith('data:')) {
      const file = dataUrlToFile(marksImageUrl, 'bag_photo.png');
      if (file) {
        fd.append('bag_photo', file, 'bag_photo.png');
      }
    } else if (marksImageUrl && !marksImageUrl.startsWith('blob:')) {
      // Existing server URL from response
      fd.append('bag_photo_url', marksImageUrl);
      fd.append('container_marks_image', marksImageUrl);
      fd.append('marks_image', marksImageUrl);
    } else if (!marksImageUrl) {
      fd.append('bag_photo', '');
      fd.append('bag_photo_url', '');
      fd.append('container_marks_image', '');
      fd.append('marks_image', '');
    }

    if (productName && productName.trim()) fd.append('product_name', productName.trim());
    if (packingDescription && packingDescription.trim()) {
      fd.append('packing_description', packingDescription.trim());
      fd.append('packing_type_title', packingDescription.trim());
    }
    if (fclType && fclType.trim()) fd.append('fcl_type', fclType.trim());
    if (fclQuantity) fd.append('fcl_quantity', String(fclQuantity));
    if (fclCapacity) fd.append('fcl_capacity', String(fclCapacity));
    if (mtQuantity) fd.append('mt_quantity', String(mtQuantity));
    if (bagQuantity) fd.append('bag_quantity', String(bagQuantity));
    if (totalValue) fd.append('total_value', String(totalValue));
    if (ratePrice) fd.append('rate', String(ratePrice));
    if (currencySymbol) fd.append('currency_symbol', currencySymbol);

    // Additional Details
    if (sbillNo && sbillNo.trim() && sbillNo !== '-') fd.append('sbill_no', sbillNo.trim());
    if (hsCode && hsCode.trim() && hsCode !== '-') fd.append('hs_code', hsCode.trim());
    if (netWeight && netWeight.trim() && netWeight !== '-') fd.append('net_weight', netWeight.trim());
    if (grossWeightCol2 && grossWeightCol2.trim() && grossWeightCol2 !== '-') fd.append('gross_weight_text', grossWeightCol2.trim());
    if (freight && freight.trim()) fd.append('freight', freight.trim().toUpperCase());

    // ECTN field & number
    if (isEctnField) {
      fd.append('ectn_field', 'true');
      if (ectnNumber) fd.append('ectn_number', ectnNumber);
    } else if (initialData?.ectn_field !== undefined) {
      fd.append('ectn_field', String(Boolean(initialData.ectn_field)));
      if (ectnNumber) fd.append('ectn_number', ectnNumber);
    }

    // COC field & value
    if (isCocField) {
      fd.append('coc_field', 'true');
      fd.append('coc_fields', 'true');
      if (cocFieldsValue) {
        fd.append('coc_fields_value', cocFieldsValue);
      }
    } else if (initialData?.coc_field !== undefined || initialData?.coc_fields !== undefined) {
      fd.append('coc_field', String(Boolean(initialData.coc_field ?? initialData.coc_fields)));
      fd.append('coc_fields', String(Boolean(initialData.coc_field ?? initialData.coc_fields)));
    }

    if (freeDays && freeDays.trim()) fd.append('free_days', freeDays.trim());
    if (emptyBags && emptyBags.trim()) fd.append('empty_bags', emptyBags.trim());
    if (specialInstruction && specialInstruction.trim()) {
      fd.append('disclaimer', specialInstruction.trim());
      fd.append('special_instruction', specialInstruction.trim());
    }
    if (grossWeight && grossWeight.trim()) fd.append('gross_weight', grossWeight.trim());

    // Totals & Remarks
    if (totalPackages && totalPackages.trim()) fd.append('total_packages', totalPackages.trim());
    if (totalWeight && totalWeight.trim()) fd.append('total_weight', totalWeight.trim());
    if (remarksTitle && remarksTitle.trim()) {
      fd.append('remarks_title', remarksTitle.trim());
      fd.append('comment_title', remarksTitle.trim());
      fd.append('comment_label', remarksTitle.trim());
    }
    if (remarksComment && remarksComment.trim()) {
      fd.append('remarks_comment', remarksComment.trim());
      fd.append('comment_value', remarksComment.trim());
      fd.append('comment_text', remarksComment.trim());
    }

    return fd;
  }, [
    draftId,
    proformaId,
    contractId,
    confirmationId,
    effectiveBuyerInstructionId,
    documentTitle,
    watermark,
    shipperName,
    shipperDetails,
    blType,
    scanCode,
    consigneeId,
    consigneeName,
    consigneeDetails,
    notifyParty1Id,
    notifyParty1Details,
    notifyParty2Id,
    notifyParty2Details,
    extraNotifyParties,
    preCarriageBy,
    placeOfReceipt,
    vesselVoyageNo,
    portOfLoading,
    portOfDischarge,
    placeOfDelivery,
    marksAndNumbers,
    marksImageUrl,
    productName,
    packingDescription,
    fclType,
    fclQuantity,
    fclCapacity,
    mtQuantity,
    bagQuantity,
    totalValue,
    ratePrice,
    currencySymbol,
    sbillNo,
    hsCode,
    netWeight,
    grossWeightCol2,
    freight,
    isEctnField,
    ectnNumber,
    isCocField,
    cocFieldsValue,
    freeDays,
    emptyBags,
    specialInstruction,
    grossWeight,
    totalPackages,
    totalWeight,
    remarksTitle,
    remarksComment,
  ]);

  // Handle Save Draft (Drafts are saved without client-side field validation)
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({}); // Always clear any existing error indicators on Save As Draft
    try {
      const payload = getFormDataPayload();
      const isSelfIdValid = Boolean(
        draftId &&
        draftId !== contractId &&
        draftId !== confirmationId &&
        draftId !== proformaId &&
        !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(draftId)
      );
      const validActionId = isSelfIdValid ? draftId : undefined;
      let res: any;
      if (onSaveDraft) {
        res = await onSaveDraft(payload);
      } else {
        res = await saveShipmentInstructionDraftAction(payload, lang, validActionId);
      }

      if (!res) {
        toast.error('No response received while saving draft. Please retry.');
        return;
      }

      if (res?.success === false || res?.success === 0) {
        const errorMsg =
          res?.message && !/^(form validation error|validation error|bad request)$/i.test(res.message)
            ? res.message
            : res?.error && !/^(form validation error|validation error|bad request)$/i.test(res.error)
            ? res.error
            : 'Failed to save draft. Please retry.';
        toast.error(errorMsg);
        return;
      }

      toast.success(res?.message || 'Shipment Instruction draft saved successfully!');
      const newId = String(res?.id || res?.data?.id || res?.data?.shipment_instruction_id || draftId);

      // Re-fetch fresh shipment instruction to get the newly generated bag_photo_url from server
      let freshSavedData = res.data;
      if (newId) {
        try {
          const freshRes = await getShipmentInstructionAction(newId, lang);
          if (freshRes?.success && freshRes.data) {
            freshSavedData = freshRes.data;
          }
        } catch (fetchErr) {
          console.warn('[ShipmentInstruction] Post-save re-fetch warning:', fetchErr);
        }
      }

      // Display updated bag_photo_url from server response
      const serverBagPhoto = extractBagPhotoUrl(freshSavedData || res?.data || res);
      if (serverBagPhoto && !serverBagPhoto.startsWith('blob:')) {
        setMarksImageUrl(serverBagPhoto);
        lastInitialBagPhotoRef.current = serverBagPhoto;
        marksImageFileRef.current = null;
        hasUserSelectedNewImageRef.current = false;
      }

      if (newId) {
        setDraftId(newId);
        isDraftSavedToBackendRef.current = true;
        setHasDraftChanges(false);
        setIsDirty(false);
        if (onSaveSuccess) onSaveSuccess(newId, freshSavedData);
      }
    } catch (err: any) {
      console.error('[ShipmentInstructionDocumentForm] Save draft error:', err);
      const errorMsg =
        err?.message && !/^(form validation error|validation error|bad request)$/i.test(err.message)
          ? err.message
          : 'An error occurred while saving draft.';
      toast.error(errorMsg);
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
      currentStepType: 'shipment',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;
    const targetNextStepName = submitTargetInfo.nextStepName;

    setIsSubmitting(true);
    setErrors({});
    try {
      const payload = getFormDataPayload();
      const isSelfIdValid = Boolean(
        draftId &&
        draftId !== contractId &&
        draftId !== confirmationId &&
        draftId !== proformaId &&
        !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(draftId)
      );
      const validActionId = isSelfIdValid ? draftId : undefined;
      let res: any;
      if (onSubmitInstruction) {
        res = await onSubmitInstruction(payload, validActionId, targetNextStep);
      } else {
        res = await submitShipmentInstructionAction(payload, lang, validActionId);
      }

      if (!res) {
        toast.error('No response received while submitting shipment instruction. Please retry.');
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
        const { fieldErrors, generalError } = parseShipmentInstructionBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusShipmentField(fieldErrors);
          const firstFieldErr = Object.values(fieldErrors)[0];
          toast.error(firstFieldErr || 'Please check highlighted fields.');
        } else if (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError)) {
          toast.error(generalError);
        } else {
          const isCleanToastMsg = (m?: any) =>
            Boolean(
              m &&
              typeof m === 'string' &&
              !/^(form validation error|validation error|bad request)$/i.test(m.trim()) &&
              !/^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(m.trim()) &&
              !/<(!DOCTYPE|html)/i.test(m)
            );
          const fallbackMsg =
            (isCleanToastMsg(res?.message) ? res.message : null) ||
            (isCleanToastMsg(res?.error) ? res.error : null) ||
            'Failed to submit shipment instruction. Please check highlighted fields.';
          toast.error(fallbackMsg);
        }
        return;
      }

      const successToast = getWorkflowSubmitToastMessage({
        currentDocName: 'Shipment Instruction',
        nextStepName: targetNextStepName,
      });
      toast.success(successToast);
      const newId = String(res?.id || res?.data?.id || res?.data?.shipment_instruction_id || draftId);

      // Re-fetch fresh shipment instruction to get the newly generated bag_photo_url from server
      let freshSubmitData = res.data;
      if (newId) {
        try {
          const freshRes = await getShipmentInstructionAction(newId, lang);
          if (freshRes?.success && freshRes.data) {
            freshSubmitData = freshRes.data;
          }
        } catch (fetchErr) {
          console.warn('[ShipmentInstruction] Post-submit re-fetch warning:', fetchErr);
        }
      }

      // Display updated bag_photo_url from server response
      const serverBagPhoto = extractBagPhotoUrl(freshSubmitData || res?.data || res);
      if (serverBagPhoto && !serverBagPhoto.startsWith('blob:')) {
        setMarksImageUrl(serverBagPhoto);
        lastInitialBagPhotoRef.current = serverBagPhoto;
        marksImageFileRef.current = null;
        hasUserSelectedNewImageRef.current = false;
      }
      setDocStatus('COMPLETED');
      setHasDraftChanges(false);
      setHasSubmitChanges(false);
      setIsDirty(false);

      if (targetNextStep && onSelectStep && !onSubmitInstruction) {
        onSelectStep(targetNextStep);
      }
    } catch (err: any) {
      console.error('[ShipmentInstructionDocumentForm] Submit error:', err);
      const { fieldErrors, generalError } = parseShipmentInstructionBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusShipmentField(fieldErrors);
        const firstFieldErr = Object.values(fieldErrors)[0];
        toast.error(firstFieldErr || 'Please check highlighted fields.');
      } else if (generalError && !/^(form validation error|validation error|bad request)$/i.test(generalError)) {
        toast.error(generalError);
      } else {
        const fallbackMsg =
          err?.message && !/^(form validation error|validation error|bad request)$/i.test(err.message)
            ? err.message
            : 'An error occurred while submitting shipment instruction. Please check highlighted fields.';
        toast.error(fallbackMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Print Preview
  const handleOpenPrintPreview = async () => {
    let effectiveId = draftId || effectiveInstructionId || proformaId || contractId || confirmationId;
    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const payload = getFormDataPayload();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(payload);
        } else {
          res = await saveShipmentInstructionDraftAction(payload, lang, draftId || undefined);
        }
        if (res?.success) {
          const newId = String(res?.id || res?.data?.id || res?.data?.shipment_instruction_id || '');
          if (newId) {
            setDraftId(newId);
            effectiveId = newId;
            isDraftSavedToBackendRef.current = true;
            setHasDraftChanges(false);
            if (onSaveSuccess) onSaveSuccess(newId, res.data);
          }
        }
      } catch (saveErr) {
        console.warn('[ShipmentInstructionDocumentForm] Auto-save before preview failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!effectiveId) {
      toast.error('Please save the draft first to preview the document.');
      return;
    }
    setIsPrintPreviewOpen(true);
  };

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    let effectiveId = draftId || effectiveInstructionId || proformaId || contractId || confirmationId;
    if (!effectiveId || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const payload = getFormDataPayload();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(payload);
        } else {
          res = await saveShipmentInstructionDraftAction(payload, lang, draftId || undefined);
        }
        if (res?.success) {
          const newId = String(res?.id || res?.data?.id || res?.data?.shipment_instruction_id || '');
          if (newId) {
            setDraftId(newId);
            effectiveId = newId;
            isDraftSavedToBackendRef.current = true;
            setHasDraftChanges(false);
            if (onSaveSuccess) onSaveSuccess(newId, res.data);
          }
        }
      } catch (saveErr) {
        console.warn('[ShipmentInstructionDocumentForm] Auto-save before download failed:', saveErr);
      } finally {
        setIsSavingDraft(false);
      }
    }

    if (!effectiveId) {
      toast.error('Please save the draft first to download the PDF.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const res = await downloadDocPdfAction({
        prefix: 'shipment_instruction',
        id: effectiveId,
        candidateIds: [effectiveId, draftId, proformaId, contractId, confirmationId].filter(
          (x): x is string => Boolean(x)
        ),
        proformaId,
        contractId,
        confirmationId,
        lang,
      });

      if (res?.success && res.data) {
        downloadPdfFromActionResponse(res, `Shipment_Instruction_${effectiveId}.pdf`);
        toast.success('PDF download started!');
      } else {
        toast.error(res?.message || res?.error || 'Failed to download PDF');
      }
    } catch (err: any) {
      console.error('[ShipmentInstructionDocumentForm] PDF download error:', err);
      toast.error(err?.message || 'Error occurred while downloading PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const submitInfo = useMemo(() => {
    return getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'shipment',
      isSubmitting,
      submittingText: 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  return (
    <div
      id="shipment-instruction-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative border border-border shadow-xs"
    >
      {/* Scrollable Viewport */}
      <div className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar">
        {/* 
          ========================================================
          TOP HEADER BAR:
          - Left: Spacer (No logo in Shipment Instruction header)
          - Center: Document Title "SHIPMENT INSTRUCTION" with edit pen & dotted underline
          - Right: Watermark Toggle
          ========================================================
        */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 bg-card">
          {/* Left: Balanced spacer (No logo in Shipment Instruction header) */}
          <div className="hidden sm:block shrink-0 sm:w-[140px]" />

          {/* Center: Title "SHIPMENT INSTRUCTION" with pencil & dotted underline (EDITABLE) */}
          <DocTitleInput
            value={documentTitle}
            onChange={(val) => {
              markDirty();
              setDocumentTitle(val);
              if (errors.documentTitle) {
                setErrors((prev) => ({ ...prev, documentTitle: '' }));
              }
            }}
            disabled={readOnly}
            placeholder="SHIPMENT INSTRUCTION"
            ariaLabel="Document Title"
            error={errors.documentTitle}
            id="field-documentTitle"
            dataField="documentTitle"
          />

          {/* Right: Watermark Toggle Only */}
          <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-[100px] sm:w-[140px]">
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
          DOCUMENT BODY GRID:
          Labels: font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          {/* ========================================================
              ROW 1: SHIPPER (Left 50%) & TYPE OF B/L + SCAN CODE (Right 50%)
              STRICTLY STATIC TEXT DISPLAY ONLY (NO INPUTS!)
             ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left Box: SHIPPER (STATIC TEXT DISPLAY ONLY) */}
            <div className="p-2.5 sm:p-3 flex flex-col gap-1.5 min-h-[120px] justify-start bg-card">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                SHIPPER :
              </label>

              <div className="flex flex-col gap-1 px-0.5">                
                <div className="text-[13px] font-medium text-foreground uppercase whitespace-pre-line leading-relaxed">
                  {formatPartyDetailsWithCompany(shipperName, shipperDetails)}
                </div>
              </div>
            </div>

            {/* Right Box: TYPE OF B/L & SCAN CODE (STATIC TEXT DISPLAY ONLY) */}
            <div className="flex flex-col divide-y divide-border min-h-[120px] justify-between">
              {/* Top: TYPE OF B/L : ORIGINAL B/L (STATIC DISPLAY) */}
              <div className="p-2.5 sm:p-3 flex items-center justify-start gap-2 flex-1">
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  TYPE OF B/L :
                </span>
                <span className="font-semibold text-foreground uppercase text-[14px]">
                  {blType}
                </span>
              </div>

              {/* Bottom: SCAN CODE: (STATIC DISPLAY) */}
              <div className="p-2.5 sm:p-3 flex items-center justify-start gap-2 flex-1">
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                  SCAN CODE:
                </span>
                <span className="font-semibold text-foreground uppercase text-[14px]">
                  {scanCode || ''}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 2: PARTIES (CONSIGNEE, NOTIFY PARTY 1, NOTIFY PARTY 2)
              (INPUTS: Underline Select + Multiline Details with Pencil)
             ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Column 1: CONSIGNEE */}
            <div className="p-2.5 sm:p-3 flex flex-col gap-2 min-h-[150px] justify-start bg-card" id="field-consigneeId" data-field="consigneeId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                CONSIGNEE
              </label>
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <DocUnderlineSelect
                  options={consigneeSelectOptions}
                  value={consigneeId}
                  onChange={(val) => {
                    handleConsigneeSelect(val);
                    if (errors.consigneeId || errors.consignee) {
                      setErrors((prev) => ({ ...prev, consigneeId: '', consignee: '' }));
                    }
                  }}
                  error={errors.consigneeId || errors.consignee}
                  disabled={readOnly}
                  loading={isLoadingConsignees && consigneeSelectOptions.length === 0}
                  placeholder="Select Consignee Detail"
                  allowCustom
                  className="w-full"
                />
                <div id="field-consigneeDetails" data-field="consigneeDetails" className="w-full mt-1">
                  <DocUnderlineInput
                    multiline
                    rows={3}
                    value={consigneeDetails}
                    onChange={(v) => {
                      markDirty();
                      setConsigneeDetails(v);
                      if (errors.consigneeDetails || errors.consignee_details) {
                        setErrors((prev) => ({ ...prev, consigneeDetails: '', consignee_details: '' }));
                      }
                    }}
                    error={errors.consigneeDetails || errors.consignee_details}
                    disabled={readOnly}
                    placeholder=""
                    icon="fa-solid fa-pen"
                    inputClassName="text-[14px] font-semibold leading-relaxed resize-none text-foreground"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Column 2: NOTIFY PARTY : 01 */}
            <div className="p-2.5 sm:p-3 flex flex-col gap-2 min-h-[150px] justify-start bg-card" id="field-notifyParty1Id" data-field="notifyParty1Id">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                NOTIFY PARTY : 01
              </label>
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <DocUnderlineSelect
                  options={notifyParty1Options}
                  value={notifyParty1Id}
                  onChange={(val) => {
                    handleNotify1Select(val);
                    if (errors.notifyParty1Id || errors.notify_party_1_id || errors.notifyParty1) {
                      setErrors((prev) => ({ ...prev, notifyParty1Id: '', notify_party_1_id: '', notifyParty1: '' }));
                    }
                  }}
                  error={errors.notifyParty1Id || errors.notify_party_1_id || errors.notifyParty1}
                  disabled={readOnly}
                  loading={isLoadingNotifyParties && notifyParty1Options.length === 0}
                  placeholder="Select Notify Party 1"
                  allowCustom
                  className="w-full"
                />
                <div id="field-notifyParty1Details" data-field="notifyParty1Details" className="w-full mt-1">
                  <DocUnderlineInput
                    multiline
                    rows={3}
                    value={notifyParty1Details}
                    onChange={(v) => {
                      markDirty();
                      setNotifyParty1Details(v);
                      if (errors.notifyParty1Details || errors.notify_party_1_details) {
                        setErrors((prev) => ({ ...prev, notifyParty1Details: '', notify_party_1_details: '' }));
                      }
                    }}
                    error={errors.notifyParty1Details || errors.notify_party_1_details}
                    disabled={readOnly}
                    placeholder=""
                    icon="fa-solid fa-pen"
                    inputClassName="text-[14px] font-semibold leading-relaxed resize-none text-foreground"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Column 3: NOTIFY PARTY : 02 */}
            <div className="p-2.5 sm:p-3 flex flex-col gap-2 min-h-[150px] justify-start bg-card" id="field-notifyParty2Id" data-field="notifyParty2Id">
              <div className="flex items-center justify-between px-0.5">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  NOTIFY PARTY : 02
                </label>
                {!readOnly && (notifyParty2Id || notifyParty2Details || extraNotifyParties.length > 0) && (
                  <button
                    type="button"
                    onClick={handleRemoveNotifyParty2}
                    title="Remove Notify Party 02"
                    className="w-5 h-5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <DocUnderlineSelect
                  options={notifyParty2Options}
                  value={notifyParty2Id}
                  onChange={(val) => {
                    handleNotify2Select(val);
                    if (errors.notifyParty2Id || errors.notify_party_2_id || errors.notifyParty2) {
                      setErrors((prev) => ({ ...prev, notifyParty2Id: '', notify_party_2_id: '', notifyParty2: '' }));
                    }
                  }}
                  error={errors.notifyParty2Id || errors.notify_party_2_id || errors.notifyParty2}
                  disabled={readOnly || !notifyParty1Id}
                  loading={isLoadingNotifyParties && notifyParty2Options.length === 0}
                  placeholder={!notifyParty1Id ? 'Select Notify Party 01 first' : 'Select Notify Party 02'}
                  allowCustom
                  className="w-full"
                />
                <div id="field-notifyParty2Details" data-field="notifyParty2Details" className="w-full mt-1">
                  <DocUnderlineInput
                    multiline
                    rows={3}
                    value={notifyParty2Details}
                    onChange={(v) => {
                      markDirty();
                      setNotifyParty2Details(v);
                      if (errors.notifyParty2Details || errors.notify_party_2_details) {
                        setErrors((prev) => ({ ...prev, notifyParty2Details: '', notify_party_2_details: '' }));
                      }
                    }}
                    error={errors.notifyParty2Details || errors.notify_party_2_details}
                    disabled={readOnly || !notifyParty1Id}
                    placeholder=""
                    icon="fa-solid fa-pen"
                    inputClassName="text-[14px] font-semibold leading-relaxed resize-none text-foreground"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 2.5: ADDITIONAL NOTIFY PARTIES (MAX 4: 03 TO 06)
              Appears directly below Row 2.
              When 0 extra parties: Shows compact Add button row.
              When extra parties added: 4-column grid (up to 4 parties in this row)
              with Add button positioned right beside the last added party.
             ======================================================== */}
          {(!readOnly || extraNotifyParties.length > 0) && (
            <div className="w-full bg-card">
              {extraNotifyParties.length === 0 ? (
                /* 0 Extra Parties: Show compact Add Button Row */
                <div className="p-2 sm:p-2.5 bg-card flex items-center justify-between sm:justify-start gap-3">
                  <button
                    type="button"
                    onClick={handleAddExtraNotifyParty}
                    disabled={readOnly || !notifyParty2Id}
                    title={!notifyParty2Id ? 'Please select Notify Party 02 first' : 'Add Notify Party 03'}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border border-dashed border-primary/60 text-primary hover:bg-primary/10 hover:border-primary text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  >
                    <i className="fa-solid fa-plus text-xs" />
                    <span className="tracking-wide">Add More Notify Party</span>
                  </button>
                  {!notifyParty2Id && !readOnly && (
                    <span className="text-[11px] text-muted-foreground italic">
                      (Select Notify Party 02 first to enable)
                    </span>
                  )}
                </div>
              ) : (
                /* 1 to 4 Extra Parties: 
                   Default to 3-column layout (matching Row 2 size) while total parties <= 5.
                   Automatically adjust to 4-column layout if 6th party is added. */
                <div>
                  <div
                    className={`grid ${
                      extraNotifyParties.length >= 4
                        ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x'
                        : 'grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x'
                    } divide-border bg-card`}
                  >
                    {extraNotifyParties.map((party, idx) => {
                      const partyNum = idx + 3;
                      const isEnabled =
                        !readOnly &&
                        (idx === 0
                          ? Boolean(notifyParty2Id)
                          : Boolean(extraNotifyParties[idx - 1]?.id));
                      const prevPartyNum = idx === 0 ? 2 : idx + 2;

                      return (
                        <div
                          key={idx}
                          className="p-2.5 sm:p-3 flex flex-col gap-2 min-h-[150px] justify-start bg-card"
                          id={`field-notifyParty${partyNum}`}
                          data-field={`notifyParty${partyNum}`}
                        >
                          <div className="flex items-center justify-between px-0.5">
                            <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                              NOTIFY PARTY : 0{partyNum}
                            </label>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraNotifyParty(idx)}
                                title={`Remove Notify Party 0${partyNum}`}
                                className="w-5 h-5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <i className="fa-solid fa-xmark text-xs" />
                              </button>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                            <DocUnderlineSelect
                              options={getFilteredNotifyOptions(partyNum, party.id, party.details)}
                              value={party.id}
                              onChange={(v) => {
                                handleExtraNotifySelect(idx, v);
                                setErrors((prev) => ({
                                  ...prev,
                                  [`notify_party_${partyNum}_id`]: '',
                                  [`notifyParty${partyNum}Id`]: '',
                                }));
                              }}
                              error={errors[`notify_party_${partyNum}_id`] || errors[`notifyParty${partyNum}Id`]}
                              disabled={!isEnabled}
                              loading={isLoadingNotifyParties && allNotifyOptions.length === 0}
                              placeholder={
                                !isEnabled
                                  ? `Select Notify Party 0${prevPartyNum} first`
                                  : `Select Notify Party 0${partyNum}`
                              }
                              allowCustom
                              className="w-full"
                            />
                            <DocUnderlineInput
                              multiline
                              rows={3}
                              value={party.details}
                              onChange={(v) => {
                                handleExtraNotifyDetailsChange(idx, v);
                                setErrors((prev) => ({
                                  ...prev,
                                  [`notify_party_${partyNum}_details`]: '',
                                  [`notifyParty${partyNum}Details`]: '',
                                }));
                              }}
                              error={errors[`notify_party_${partyNum}_details`] || errors[`notifyParty${partyNum}Details`]}
                              disabled={!isEnabled}
                              placeholder=""
                              icon="fa-solid fa-pen"
                              inputClassName="text-[14px] font-semibold leading-relaxed resize-none text-foreground"
                              className="w-full mt-1"
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Add button slot beside party 03 and party 04 in the 3-column row */}
                    {extraNotifyParties.length < 3 && !readOnly && (
                      <div className="p-2.5 sm:p-3 flex flex-col items-center justify-center min-h-[150px] bg-card/50">
                        <button
                          type="button"
                          onClick={handleAddExtraNotifyParty}
                          disabled={!canAddMoreNotifyParty}
                          title={
                            !canAddMoreNotifyParty
                              ? `Please select Notify Party 0${extraNotifyParties.length + 2} first`
                              : `Add Notify Party 0${extraNotifyParties.length + 3}`
                          }
                          className="inline-flex flex-col items-center justify-center gap-2 p-3 w-full h-full max-h-[120px] rounded-lg border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                            <i className="fa-solid fa-plus text-xs" />
                          </div>
                          <div className="flex flex-col items-center gap-0.5 text-center">
                            <span className="text-xs font-bold tracking-wide text-foreground group-hover:text-primary">
                              Add More Notify Party
                            </span>
                            <span className="text-[10.5px] text-muted-foreground font-medium">
                              (0{extraNotifyParties.length + 3} of 06)
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* When 3 extra parties (03, 04, 05) fill the 3 columns, show strip to add 6th party which adjusts layout to 4 columns */}
                  {extraNotifyParties.length === 3 && !readOnly && (
                    <div className="p-2 sm:p-2.5 bg-card flex items-center justify-between sm:justify-start gap-3 border-t border-border">
                      <button
                        type="button"
                        onClick={handleAddExtraNotifyParty}
                        disabled={!canAddMoreNotifyParty}
                        title={
                          !canAddMoreNotifyParty
                            ? 'Please select Notify Party 05 first'
                            : 'Add Notify Party 06 (Adjusts to 4 columns)'
                        }
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border border-dashed border-primary/60 text-primary hover:bg-primary/10 hover:border-primary text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      >
                        <i className="fa-solid fa-plus text-xs" />
                        <span className="tracking-wide">Add More Notify Party (06 of 06)</span>
                      </button>
                      {!canAddMoreNotifyParty && (
                        <span className="text-[11px] text-muted-foreground italic">
                          (Select Notify Party 05 first to enable)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              ROW 3: SHIPPING ROUTE & LOGISTICS (2 Rows x 3 Columns)
              5 STATIC DISPLAY FIELDS + 1 EDITABLE INPUT (PLACE OF DELIVERY)
              Headers: bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider
              Values: bg-card text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase
             ======================================================== */}
          <div className="flex flex-col divide-y divide-border">
            {/* Sub-row A Headers (bg-muted/20) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
                PRE-CARRIAGE BY
              </div>
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
                PLACE OF RECEIPT
              </div>
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
                VESSEL / VOYAGE NO.
              </div>
            </div>

            {/* Sub-row A Values (bg-card) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
              <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase select-all">
                  {preCarriageBy || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase select-all">
                  {placeOfReceipt || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase select-all">
                  {vesselVoyageNo || '-'}
                </span>
              </div>
            </div>

            {/* Sub-row B Headers (bg-muted/20) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
                PORT OF LOADING
              </div>
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
                PORT OF DISCHARGE
              </div>
              <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider flex items-center justify-center min-h-[38px]">
                PLACE OF DELIVERY
              </div>
            </div>

            {/* Sub-row B Values (bg-card) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
              <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase select-all">
                  {portOfLoading || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase select-all">
                  {portOfDischarge || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center" id="field-placeOfDelivery" data-field="placeOfDelivery">
                <div className="w-full max-w-[240px]">
                  <DocUnderlineInput
                    value={placeOfDelivery}
                    onChange={(v) => {
                      markDirty();
                      setPlaceOfDelivery(v);
                      if (errors.placeOfDelivery || errors.place_of_delivery || errors.final_destination) {
                        setErrors((prev) => ({ ...prev, placeOfDelivery: '', place_of_delivery: '', final_destination: '' }));
                      }
                    }}
                    error={errors.placeOfDelivery || errors.place_of_delivery || errors.final_destination}
                    disabled={readOnly}
                    placeholder="Enter place of delivery"
                    icon="fa-solid fa-pen"
                    align="center"
                    inputClassName="text-[14px] font-semibold text-foreground text-center uppercase tracking-wide"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 4: GOODS & PACKAGES (3 Columns: Marks | Goods | Gross Wt)
              Exact match with Canva Screenshot 1 & 2 layout
             ======================================================== */}
          {/* Dedicated Table Header Row matching Canva */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border bg-muted/20">
            {/* Column 1 Header */}
            <div className="lg:col-span-3 p-2 sm:p-2.5 flex items-center justify-start">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5 leading-snug">
                CONTAINER NOS.
                <br />
                MARKS &amp; NUMBERS
              </label>
            </div>

            {/* Column 2 Header */}
            <div className="lg:col-span-7 p-2 sm:p-2.5 flex items-center justify-start">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                NUMBER AND KIND OF PACKAGES DESCRIPTION OF GOODS
              </label>
            </div>

            {/* Column 3 Header */}
            <div className="lg:col-span-2 p-2 sm:p-2.5 flex items-center justify-end text-right">
              <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider text-right px-0.5">
                GROSS WEIGHT
              </label>
            </div>
          </div>

          {/* Table Body Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Column 1: CONTAINER NOS. MARKS & NUMBERS (lg:col-span-3) */}
            <div className="lg:col-span-3 p-2.5 sm:p-3 flex flex-col gap-3 justify-start bg-card" id="field-marksAndNumbers" data-field="marksAndNumbers">
              <div className="flex flex-col gap-2.5">
                {/* Marks text: EDITABLE INPUT with pencil & dotted line */}
                <DocUnderlineInput
                  value={marksAndNumbers}
                  onChange={(v) => {
                    markDirty();
                    setMarksAndNumbers(v);
                    if (
                      errors.marksAndNumbers ||
                      errors.marks_and_numbers ||
                      errors.marks ||
                      errors.marking_brand ||
                      errors.markingBrand ||
                      errors.container_marks ||
                      errors.containerMarks ||
                      errors.brand
                    ) {
                      setErrors((prev) => ({
                        ...prev,
                        marksAndNumbers: '',
                        marks_and_numbers: '',
                        marks: '',
                        marking_brand: '',
                        markingBrand: '',
                        container_marks: '',
                        containerMarks: '',
                        brand: '',
                      }));
                    }
                  }}
                  error={
                    errors.marksAndNumbers ||
                    errors.marks_and_numbers ||
                    errors.marks ||
                    errors.marking_brand ||
                    errors.markingBrand ||
                    errors.container_marks ||
                    errors.containerMarks ||
                    errors.brand
                  }
                  disabled={readOnly}
                  placeholder="Enter marks"
                  icon="fa-solid fa-pen"
                  inputClassName="text-[14px] font-semibold text-foreground"
                  className="w-full"
                />

                {/* Marks / Bag Photo Image Box matching Canva mockup (bag_photo_url) */}
                <input
                  ref={marksImageInputRef}
                  id="field-bagPhoto-input"
                  name="bag_photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleMarksImageUpload}
                />
                <div
                  className="w-full flex flex-col items-center justify-center pt-1"
                  id="field-bagPhotoUrl"
                  data-field="bagPhotoUrl"
                >
                  {marksImageUrl ? (
                    <div className="relative group/mark w-40 h-44 sm:w-48 sm:h-52 rounded-xl border-2 border-border/80 hover:border-primary/80 bg-background/90 shadow-xs overflow-hidden cursor-pointer mx-auto flex items-center justify-center transition-all">
                      <img
                        src={marksImageUrl}
                        alt="Bag Photo / Mark"
                        className="w-full h-full max-w-full max-h-full object-contain p-2 select-none"
                        onClick={() => !readOnly && marksImageInputRef.current?.click()}
                      />
                      {!readOnly && (
                        <>
                          <div
                            onClick={() => marksImageInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover/mark:opacity-100 transition-opacity"
                          >
                            <i className="fa-solid fa-camera text-base" />
                            <span className="text-[10px] font-medium mt-1">Change Image</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMarksImageUrl('');
                              marksImageFileRef.current = null;
                              hasUserSelectedNewImageRef.current = true;
                              lastInitialBagPhotoRef.current = '';
                              markDirty();
                            }}
                            title="Remove image"
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center text-[10px] hover:bg-destructive/90 transition-all z-10 shadow-xs"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => !readOnly && marksImageInputRef.current?.click()}
                      className="w-40 h-44 sm:w-48 sm:h-52 rounded-xl border-2 border-dashed border-border/80 hover:border-primary/80 bg-muted/20 hover:bg-muted/30 transition-all flex flex-col justify-between overflow-hidden cursor-pointer group mx-auto"
                      title={readOnly ? 'Bag photo' : 'Click to upload bag photo'}
                    >
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/60 group-hover:text-primary transition-colors gap-1.5">
                        <i className="fa-regular fa-image text-3xl sm:text-4xl" />
                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-primary">
                          Upload Bag Photo / Mark
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 py-2 flex items-center justify-center border-t border-border/60 text-muted-foreground group-hover:text-primary transition-colors gap-1.5">
                        <i className="fa-solid fa-camera text-xs" />
                        <span className="text-[10px] font-medium">Choose File</span>
                      </div>
                    </div>
                  )}
                  {(errors.bag_photo_url ||
                    errors.bagPhotoUrl ||
                    errors.bag_photo ||
                    errors.container_marks_image ||
                    errors.marks_image ||
                    errors.marksImage) && (
                    <span className="text-[11px] text-brand-red font-semibold mt-1.5 px-0.5 tracking-tight flex items-center justify-center gap-1.5">
                      <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                      <span>
                        {errors.bag_photo_url ||
                          errors.bagPhotoUrl ||
                          errors.bag_photo ||
                          errors.container_marks_image ||
                          errors.marks_image ||
                          errors.marksImage}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: NUMBER AND KIND OF PACKAGES DESCRIPTION OF GOODS (lg:col-span-7) */}
            <div className="lg:col-span-7 flex flex-col justify-start bg-card">
              {/* Product & Packing Top Information (ALL STATIC TEXT DISPLAY) */}
              <div className="p-2.5 sm:p-3 flex flex-col gap-1">
                {/* Line 1: TOTAL BAGS: 32400 BAGS (STATIC) */}
                <div className="text-[14px] font-semibold uppercase text-foreground tracking-wide">
                  TOTAL BAGS: {cleanBagQuantity} BAGS
                </div>

                {/* Line 2: Product Title (STATIC) */}
                <div className="text-[14px] font-semibold uppercase text-foreground tracking-wide">
                  PRODUCT NAME: {productName}
                </div>

                {/* Line 3: Packing Description (STATIC) */}
                <div className="text-[14px] font-semibold uppercase text-foreground tracking-wide">
                  PACKING TYPE: {packingDescription}
                </div>

                {/* Line 4: FCL TYPE: 20 FT FCL (STATIC) */}
                <div className="text-[14px] font-semibold uppercase text-foreground tracking-wide mt-2">
                  FCL TYPE: {fclType}
                </div>
              </div>

              {/* Breakdown Table (BORDER TO BORDER TOUCHING COLUMN BOUNDARIES) */}
              <div className="w-full border-y border-border overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                      <th className="py-2.5 px-2.5 border-r border-border text-center font-bold">FCL QUANTITY</th>
                      <th className="py-2.5 px-2.5 border-r border-border text-center font-bold">FCL CAPACITY</th>
                      <th className="py-2.5 px-2.5 border-r border-border text-center font-bold">MT QTY</th>
                      <th className="py-2.5 px-2.5 border-r border-border text-center font-bold">BAG QTY</th>
                      <th className="py-2.5 px-2.5 text-center font-bold">
                        TOTAL VALUE ({currencySymbol})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="divide-x divide-border text-foreground font-semibold text-[13px] sm:text-[14px] bg-card">
                      <td className="py-2.5 px-2.5 text-center">{fclQuantity}</td>
                      <td className="py-2.5 px-2.5 text-center">{fclCapacity}</td>
                      <td className="py-2.5 px-2.5 text-center">{mtQuantity}</td>
                      <td className="py-2.5 px-2.5 text-center">{cleanBagQuantity}</td>
                      <td className="py-2.5 px-2.5 text-center">{totalValue}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Specifications & Notes */}
              <div className="p-2.5 sm:p-3 flex flex-col gap-1.5">
                {/* S/BILL NO. - (STATIC DISPLAY) */}
                <div className="text-[14px] font-semibold uppercase text-foreground">
                  S/BILL NO. {sbillNo}
                </div>

                {/* HS CODE: 456789 (STATIC DISPLAY) */}
                <div className="text-[14px] font-semibold uppercase text-foreground">
                  HS CODE: {hsCode}
                </div>

                {/* NET WEIGHT: - (STATIC DISPLAY) */}
                <div className="text-[14px] font-semibold uppercase text-foreground">
                  NET WEIGHT: {netWeight}
                </div>

                {/* GROSS WEIGHT: - (STATIC DISPLAY) */}
                <div className="text-[14px] font-semibold uppercase text-foreground">
                  GROSS WEIGHT: {grossWeightCol2}
                </div>

                {/* FREIGHT: (EDITABLE INPUT with pencil & full-width dotted line!) */}
                <div className="mt-1 w-full" id="field-freight" data-field="freight">
                  <DocUnderlineInput
                    flush
                    value={freight}
                    onChange={(v) => {
                      markDirty();
                      setFreight(v);
                      if (errors.freight) {
                        setErrors((prev) => ({ ...prev, freight: '' }));
                      }
                    }}
                    error={errors.freight}
                    disabled={readOnly}
                    placeholder="Enter freight"
                    icon="fa-solid fa-pen"
                    inputClassName="text-[14px] font-semibold text-foreground uppercase"
                    className="w-full"
                  />
                </div>

                {/* ECTN NUMBER (STATIC DISPLAY - when ectn_field is true) */}
                {isEctnField ? (
                  <div
                    className="text-[14px] font-semibold uppercase text-foreground mt-1"
                    id="field-ectnNumber"
                    data-field="ectnNumber"
                  >
                    ECTN NUMBER : {ectnNumber || ''}
                  </div>
                ) : null}

                {/* COC FIELDS (EDITABLE TEXTAREA - 3 rows with coc_fields_value when coc_field is true) */}
                {isCocField ? (
                  <div className="mt-1 w-full" id="field-cocFieldsValue" data-field="cocFieldsValue">
                    <DocUnderlineInput
                      flush
                      multiline
                      rows={3}
                      value={cocFieldsValue}
                      onChange={(v) => {
                        markDirty();
                        setCocFieldsValue(v);
                        if (errors.cocFieldsValue || errors.coc_fields_value) {
                          setErrors((prev) => ({ ...prev, cocFieldsValue: '', coc_fields_value: '' }));
                        }
                      }}
                      error={errors.cocFieldsValue || errors.coc_fields_value}
                      disabled={readOnly}
                      placeholder={"IDF:\nUCR:\nPIP:"}
                      icon="fa-solid fa-pen"
                      inputClassName="text-[14px] font-semibold uppercase text-foreground resize-none leading-relaxed"
                      className="w-full"
                    />
                  </div>
                ) : null}

                {/* FREE DAYS: 14 DAYS FREE AT POD (STATIC DISPLAY) */}
                <div className="text-[14px] font-semibold uppercase text-foreground mt-1">
                  FREE DAYS: {freeDays}
                </div>

                {/* EMPTY BAGS: 2% EMPTY BAGS (STATIC DISPLAY) */}
                <div className="text-[14px] font-semibold uppercase text-foreground">
                  EMPTY BAGS: {emptyBags}
                </div>

                {/* SPECIAL WARNING NOTE (EDITABLE INPUT IN AMBER with pencil & dotted line!) */}
                <div className="mt-2 w-full" id="field-specialInstruction" data-field="specialInstruction" data-field-alias="disclaimer">
                  <DocUnderlineInput
                    id="field-specialInstruction-input"
                    name="disclaimer"
                    flush
                    multiline
                    rows={2}
                    value={specialInstruction}
                    onChange={(v) => {
                      markDirty();
                      setSpecialInstruction(v);
                      if (errors.specialInstruction || errors.special_instruction || errors.special_note || errors.disclaimer) {
                        setErrors((prev) => ({
                          ...prev,
                          specialInstruction: '',
                          special_instruction: '',
                          special_note: '',
                          disclaimer: '',
                        }));
                      }
                    }}
                    error={errors.specialInstruction || errors.special_instruction || errors.special_note || errors.disclaimer}
                    disabled={readOnly}
                    placeholder="Enter special instruction"
                    icon="fa-solid fa-pen"
                    inputClassName={
                      errors.specialInstruction || errors.special_instruction || errors.special_note || errors.disclaimer
                        ? "text-[13px] font-semibold uppercase text-brand-red resize-none leading-relaxed"
                        : "text-[13px] font-semibold uppercase !text-amber-600 dark:!text-amber-400 resize-none leading-relaxed"
                    }
                    underlineClassName={
                      errors.specialInstruction || errors.special_instruction || errors.special_note || errors.disclaimer
                        ? undefined
                        : "border-b-2 border-dotted !border-amber-500/60 hover:!border-amber-500 dark:!border-amber-400/60 dark:hover:!border-amber-400 bg-transparent"
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Column 3: GROSS WEIGHT (lg:col-span-2) (STATIC TEXT DISPLAY ONLY) */}
            <div className="lg:col-span-2 p-2.5 sm:p-3 flex flex-col items-end justify-start text-right bg-card">
              <div className="text-[14px] sm:text-[15px] font-semibold text-foreground text-right w-full">
                {grossWeight}
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 5: SUMMARY TOTALS (ALL STATIC TEXT DISPLAY)
              Exact match with Canva Screenshot 3 layout:
              Header row separated from values row by a horizontal line
             ======================================================== */}
          <div className="flex flex-col divide-y divide-border bg-card">
            {/* Headers row (bg-muted/20) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border text-center bg-muted/20">
              <div className="p-2 sm:p-2.5 flex items-center justify-center min-h-[38px]">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  TOTAL NO. OF / PACKAGES
                </label>
              </div>
              <div className="p-2 sm:p-2.5 flex items-center justify-center min-h-[38px]">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  TOTAL WEIGHT:
                </label>
              </div>
              <div className="p-2 sm:p-2.5 flex items-center justify-center min-h-[38px]">
                <label className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                  FREIGHT:
                </label>
              </div>
            </div>

            {/* Values row (ALL STATIC DISPLAY - bg-card) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border text-center bg-card">
              <div className="p-2.5 sm:p-3 flex items-center justify-center min-h-[40px]">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                  {cleanTotalPackages || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 flex items-center justify-center min-h-[40px]">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                  {totalWeight || '-'}
                </span>
              </div>
              <div className="p-2.5 sm:p-3 flex items-center justify-center min-h-[40px]">
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                  {freight ? freight.toUpperCase() : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 6: COMMENTS / REMARKS (Title & Comment - 100% identical to Proforma & Confirmation)
             ======================================================== */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card"
            data-field="commentSection"
          >
            {/* Enter Title (EDITABLE INPUT with pencil & dotted line: 1 of 3 columns) */}
            <div
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
              id="field-remarksTitle"
              data-field="remarksTitle"
            >
              <DocUnderlineInput
                id="field-remarksTitle-input"
                value={remarksTitle}
                onChange={(v) => {
                  markDirty();
                  setRemarksTitle(v);
                  if (errors.remarksTitle || errors.remarks_title || errors.comment_title || errors.comment_label) {
                    setErrors((prev) => ({
                      ...prev,
                      remarksTitle: '',
                      remarks_title: '',
                      comment_title: '',
                      comment_label: '',
                    }));
                  }
                }}
                error={errors.remarksTitle || errors.remarks_title || errors.comment_title || errors.comment_label}
                disabled={readOnly}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_title ||
                  dict?.smart_docs?.contract_form?.enter_title ||
                  'Enter Title'
                }
                icon="fa-solid fa-pen"
                uppercase={false}
                inputClassName="text-[14px] font-semibold text-foreground"
                className="w-full"
              />
            </div>

            {/* Enter Comment (EDITABLE INPUT with pencil & dotted line: 2 of 3 columns) */}
            <div
              className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0 md:col-span-2"
              id="field-remarksComment"
              data-field="remarksComment"
            >
              <DocUnderlineInput
                id="field-remarksComment-input"
                value={remarksComment}
                onChange={(v) => {
                  markDirty();
                  setRemarksComment(v);
                  if (errors.remarksComment || errors.remarks_comment || errors.comment_value || errors.comment_text) {
                    setErrors((prev) => ({
                      ...prev,
                      remarksComment: '',
                      remarks_comment: '',
                      comment_value: '',
                      comment_text: '',
                    }));
                  }
                }}
                error={errors.remarksComment || errors.remarks_comment || errors.comment_value || errors.comment_text}
                disabled={readOnly}
                placeholder={
                  dict?.smart_docs?.confirmation_form?.enter_comment ||
                  dict?.smart_docs?.contract_form?.enter_comment ||
                  'Enter Comment'
                }
                icon="fa-solid fa-pen"
                uppercase={false}
                inputClassName="text-[14px] font-semibold text-foreground"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          STICKY / STATIC FOOTER ACTION BAR
          Exact Match with Proforma and Confirmation styling
         ======================================================== */}
      <div
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Print Preview & Download PDF */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button */}
          <button
            type="button"
            onClick={handleOpenPrintPreview}
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
          {/* Save As Draft: Shown only while status is not COMPLETED */}
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
              <span className="truncate">{isSavingDraft ? 'Saving...' : 'Save As Draft'}</span>
            </button>
          ) : null}

          {/* Submit */}
          <button
            type="button"
            disabled={isSubmitting || isSavingDraft || readOnly || (docStatus === 'COMPLETED' && !hasSubmitChanges)}
            onClick={handleSubmit}
            title={
              docStatus === 'COMPLETED' && !hasSubmitChanges
                ? 'Shipment Instruction already submitted'
                : undefined
            }
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group ${
              docStatus === 'COMPLETED' ? 'w-full sm:w-auto' : ''
            }`}
          >
            <span className="truncate">{isSubmitting ? 'Submitting...' : submitInfo.buttonLabel}</span>
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
        prefix="shipment_instruction"
        docId={draftId || effectiveInstructionId || proformaId || contractId || confirmationId || ''}
        candidateIds={[
          draftId,
          effectiveInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x))}
        contractId={contractId}
        confirmationId={confirmationId}
        docNumber={effectiveInstructionId || draftId || ''}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default ShipmentInstructionDocumentForm;
