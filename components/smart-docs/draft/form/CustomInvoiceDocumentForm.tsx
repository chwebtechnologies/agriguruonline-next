'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DocUnderlineInput from './DocUnderlineInput';
import DocTitleInput from './DocTitleInput';
import DocUnderlineSelect, { DocSelectOption } from './DocUnderlineSelect';
import DocToggle from './DocToggle';
import DocSignatureBox from './DocSignatureBox';
import DocPrintPreviewModal from './DocPrintPreviewModal';
import { convertAmountToWords } from './number-to-words';
import { extractSellerInstructionId, extractDestinationPortCountry } from './ProformaDocumentForm';
import { dataUrlToFile } from './ContractDocumentForm';
import { toast } from 'sonner';
import {
  getSellerBankDetailsAction,
  downloadDocPdfAction,
  saveCustomInvoiceDraftAction,
  submitCustomInvoiceAction,
} from '@/app/actions/smart-docs';
import {
  type StepperDocumentItem,
  formatSignatureUrl,
  normalizeSignaturePayload,
  downloadPdfFromActionResponse,
  sanitizeDocId,
  getCurrencySymbol,
  extractApiValidationErrors,
  getCustomInvoiceStep,
  getCustomInvoiceIdFromStepper,
  isCustomInvoiceStep,
  getStepSelfId,
  extractStepRedirectId,
  extractLinkedCustomInvoiceId,
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

export interface CustomInvoiceDocumentFormProps {
  initialData?: any;
  dataVersion?: number;
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
  currencies?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  onSaveDraft?: (payload: any) => Promise<any>;
  onSaveSuccess?: (savedId: string, savedData?: any) => void;
  onSubmitInvoice?: (payload: any, id?: string, nextStep?: StepperDocumentItem | null) => Promise<any>;
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

export function formatCurrencyAmount(val: number | string, decimals = 2, currencyCode = 'USD'): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0.00';
  const locale = String(currencyCode).toUpperCase() === 'INR' ? 'en-IN' : 'en-US';
  return num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const sellerBankAccountsCache = new Map<string, any[]>();

export function detectCustomInvoiceFieldInSentence(text: string): { key: string; rawField: string } | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  const normalized = lower.replace(/[-_.]/g, ' ');

  if (
    normalized.includes('pdf title') ||
    normalized.includes('document title') ||
    normalized.includes('custom doc title') ||
    lower.includes('pdftitle') ||
    lower.includes('documenttitle') ||
    lower.includes('customdoctitle') ||
    lower.includes('pdf_title') ||
    lower.includes('document_title') ||
    lower.includes('custom_doc_title')
  ) {
    return { key: 'documentTitle', rawField: 'pdf_title' };
  }
  if (normalized.includes('watermark') || lower.includes('watermark')) {
    return { key: 'is_watermark_enabled', rawField: 'is_watermark_enabled' };
  }
  if (
    normalized.includes('invoice number') ||
    normalized.includes('invoice no') ||
    lower.includes('invoicenumber') ||
    lower.includes('invoiceno')
  ) {
    return { key: 'invoice_number', rawField: 'invoice_number' };
  }
  if (normalized.includes('invoice date') || lower.includes('invoicedate')) {
    return { key: 'invoice_date', rawField: 'invoice_date' };
  }
  if (
    normalized.includes('registration number') ||
    normalized.includes('registration no') ||
    lower.includes('registrationnumber')
  ) {
    return { key: 'registration_number', rawField: 'registration_number' };
  }
  if (normalized.includes('gross weight') || lower.includes('grossweight')) {
    return { key: 'gross_weight', rawField: 'gross_weight' };
  }
  if (
    normalized.includes('bank details') ||
    normalized.includes('bank account') ||
    lower.includes('bankdetails') ||
    lower.includes('bankaccount') ||
    lower.includes('bank_details_id') ||
    lower.includes('bank_account_id')
  ) {
    return { key: 'selectedBankId', rawField: 'bank_details_id' };
  }
  if (
    normalized.includes('fob rate') ||
    normalized.includes('fob price') ||
    lower.includes('fobrate') ||
    lower.includes('fob_rate')
  ) {
    return { key: 'fob_rate', rawField: 'fob_rate' };
  }
  if (
    normalized.includes('freight rate') ||
    normalized.includes('freight price') ||
    lower.includes('freightrate') ||
    lower.includes('freight_rate')
  ) {
    return { key: 'freight_rate', rawField: 'freight_rate' };
  }
  if (
    normalized.includes('commission rate') ||
    lower.includes('commissionrate') ||
    lower.includes('commission_rate')
  ) {
    return { key: 'commission_rate', rawField: 'commission_rate' };
  }
  if (
    normalized.includes('price per bag') ||
    normalized.includes('price bag') ||
    normalized.includes('rate per bag') ||
    normalized.includes('rate bag') ||
    lower.includes('priceperbag') ||
    lower.includes('price_per_bag') ||
    lower.includes('rateperbag') ||
    lower.includes('rate_per_bag')
  ) {
    return { key: 'price_per_bag', rawField: 'price_per_bag' };
  }
  if (
    normalized.includes('signature') ||
    normalized.includes('stamp') ||
    lower.includes('sellersignature') ||
    lower.includes('seller_signature')
  ) {
    return { key: 'seller_signature', rawField: 'seller_signature' };
  }
  if (
    normalized.includes('authority title') ||
    normalized.includes('signature title') ||
    lower.includes('authoritysignaturetitle') ||
    lower.includes('authority_signature_title')
  ) {
    return { key: 'authority_signature_title', rawField: 'authority_signature_title' };
  }
  if (normalized.includes('disclaimer') || lower.includes('disclaimer')) {
    return { key: 'disclaimer', rawField: 'disclaimer' };
  }
  if (
    normalized.includes('comment label') ||
    normalized.includes('comment title') ||
    normalized.includes('notes title') ||
    normalized.includes('extra title') ||
    lower.includes('commentlabel') ||
    lower.includes('comment_label') ||
    lower.includes('commenttitle') ||
    lower.includes('comment_title') ||
    lower.includes('notestitle') ||
    lower.includes('notes_title')
  ) {
    return { key: 'notes_title', rawField: 'comment_label' };
  }
  if (
    normalized.includes('comment value') ||
    normalized.includes('comment text') ||
    normalized.includes('notes comment') ||
    normalized.includes('extra comment') ||
    lower.includes('commentvalue') ||
    lower.includes('comment_value') ||
    lower.includes('commenttext') ||
    lower.includes('comment_text') ||
    lower.includes('notescomment') ||
    lower.includes('notes_comment')
  ) {
    return { key: 'notes_comment', rawField: 'comment_value' };
  }

  // Generic class-validator pattern match
  const cvMatch = text.match(/^([a-zA-Z0-9_]+)\s+(should|must|is|cannot|has|contains)\b/i);
  if (cvMatch && cvMatch[1]) {
    const rawF = cvMatch[1].toLowerCase();
    if (rawF.includes('watermark')) return { key: 'is_watermark_enabled', rawField: cvMatch[1] };
    if (rawF.includes('title') || rawF.includes('pdf')) return { key: 'documentTitle', rawField: cvMatch[1] };
    if (rawF.includes('invoice') && rawF.includes('num')) return { key: 'invoice_number', rawField: cvMatch[1] };
    if (rawF.includes('date')) return { key: 'invoice_date', rawField: cvMatch[1] };
    if (rawF.includes('bank')) return { key: 'selectedBankId', rawField: cvMatch[1] };
    if (rawF.includes('fob')) return { key: 'fob_rate', rawField: cvMatch[1] };
    if (rawF.includes('freight')) return { key: 'freight_rate', rawField: cvMatch[1] };
    if (rawF.includes('commission')) return { key: 'commission_rate', rawField: cvMatch[1] };
    if (rawF.includes('bag')) return { key: 'price_per_bag', rawField: cvMatch[1] };
    if (rawF.includes('weight')) return { key: 'gross_weight', rawField: cvMatch[1] };
    if (rawF.includes('sign') || rawF.includes('stamp')) return { key: 'seller_signature', rawField: cvMatch[1] };
    if (rawF.includes('disclaimer')) return { key: 'disclaimer', rawField: cvMatch[1] };
    if (rawF.includes('comment') || rawF.includes('note')) {
      if (rawF.includes('value') || rawF.includes('text') || rawF === 'comment') {
        return { key: 'notes_comment', rawField: cvMatch[1] };
      }
      return { key: 'notes_title', rawField: cvMatch[1] };
    }
    return { key: cvMatch[1], rawField: cvMatch[1] };
  }

  return null;
}

export const CUSTOM_INVOICE_FORM_FIELD_VISUAL_ORDER: string[] = [
  'documentTitle',
  'pdf_title',
  'is_watermark_enabled',
  'watermark_enabled',
  'watermark',
  'invoice_number',
  'invoice_no',
  'invoice_date',
  'registration_number',
  'gross_weight',
  'selectedBankId',
  'bank_details_id',
  'bank_account_id',
  'fob_rate',
  'freight_rate',
  'commission_rate',
  'price_per_bag',
  'pricePerBag',
  'rate_per_bag',
  'ratePerBag',
  'rate_bag',
  'seller_signature',
  'stampImageUrl',
  'authority_signature_title',
  'disclaimer',
  'title',
  'notes_title',
  'comment_label',
  'commentLabel',
  'comment_title',
  'extra_title',
  'comment',
  'notes_comment',
  'comment_value',
  'commentValue',
  'comment_text',
  'extra_comment',
];

export function scrollToAndFocusCustomInvoiceField(
  fieldErrorsOrKey: string | Record<string, string>
): void {
  if (typeof window === 'undefined') return;

  let targetKey = '';
  if (typeof fieldErrorsOrKey === 'string') {
    targetKey = fieldErrorsOrKey;
  } else if (fieldErrorsOrKey && typeof fieldErrorsOrKey === 'object') {
    for (const key of CUSTOM_INVOICE_FORM_FIELD_VISUAL_ORDER) {
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

  if (targetKey === 'invoice_number' || targetKey === 'invoice_no') {
    selectors.unshift('#field-invoice_number', '#field-invoice-number-input');
  } else if (targetKey === 'invoice_date' || targetKey === 'date') {
    selectors.unshift('#field-invoice_date', '#field-invoice-date-input');
  } else if (targetKey === 'is_watermark_enabled' || targetKey === 'watermark' || targetKey === 'watermark_enabled') {
    selectors.unshift('#field-is_watermark_enabled', '[data-field="is_watermark_enabled"]');
  } else if (targetKey === 'selectedBankId' || targetKey === 'bank_details_id' || targetKey === 'bank_account_id') {
    selectors.unshift('#field-selectedBankId', '[data-field="selectedBankId"]');
  } else if (targetKey === 'gross_weight') {
    selectors.unshift('#field-gross_weight', '#field-gross-weight-input');
  } else if (targetKey === 'fob_rate' || targetKey === 'fob') {
    selectors.unshift('#field-fob_rate', '[data-field="fob_rate"]');
  } else if (targetKey === 'freight_rate' || targetKey === 'freight') {
    selectors.unshift('#field-freight_rate', '[data-field="freight_rate"]');
  } else if (targetKey === 'commission_rate' || targetKey === 'commission') {
    selectors.unshift('#field-commission_rate', '[data-field="commission_rate"]');
  } else if (
    targetKey === 'price_per_bag' ||
    targetKey === 'pricePerBag' ||
    targetKey === 'rate_per_bag' ||
    targetKey === 'ratePerBag' ||
    targetKey === 'rate_bag'
  ) {
    selectors.unshift(
      '#field-price-per-bag-input',
      '#field-price_per_bag',
      '[data-field="price_per_bag"]',
      '#field-rate_per_bag',
      '[data-field="rate_per_bag"]'
    );
  } else if (targetKey === 'seller_signature' || targetKey === 'stampImageUrl') {
    selectors.unshift('#field-seller_signature', '[data-field="seller_signature"]');
  } else if (targetKey === 'disclaimer') {
    selectors.unshift('#field-disclaimer', '#field-disclaimer-input');
  } else if (
    targetKey === 'notes_title' ||
    targetKey === 'title' ||
    targetKey === 'comment_label' ||
    targetKey === 'commentLabel' ||
    targetKey === 'comment_title' ||
    targetKey === 'extra_title'
  ) {
    selectors.unshift(
      '#field-notes_title-input',
      '#field-notes_title',
      '[data-field="notes_title"]',
      '#field-comment_label',
      '[data-field="comment_label"]'
    );
  } else if (
    targetKey === 'notes_comment' ||
    targetKey === 'comment' ||
    targetKey === 'comment_value' ||
    targetKey === 'commentValue' ||
    targetKey === 'comment_text' ||
    targetKey === 'extra_comment'
  ) {
    selectors.unshift(
      '#field-notes_comment-input',
      '#field-notes_comment',
      '[data-field="notes_comment"]',
      '#field-comment_value',
      '[data-field="comment_value"]'
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

export function parseCustomInvoiceBackendErrors(
  result: any
): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!result) return { fieldErrors, generalError: 'Failed to save or submit custom invoice' };

  const isGenericValidationString = (str: string): boolean => {
    const s = String(str || '').trim();
    return (
      !s ||
      /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
      /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
      /<(!DOCTYPE|html)/i.test(s) ||
      /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
      /^(not found|bad gateway|service unavailable)$/i.test(s) ||
      /^[a-z0-9_.-]+$/i.test(s) ||
      s.toLowerCase().includes('should not be empty') ||
      s.toLowerCase().includes('must be')
    );
  };

  const mapFieldNameToKey = (rawField: string): string => {
    const f = String(rawField || '').trim();
    const clean = f.toLowerCase().replace(/[-_.]/g, '');

    switch (clean) {
      case 'iswatermarkenabled':
      case 'watermarkenabled':
      case 'watermark':
        return 'is_watermark_enabled';
      case 'invoicenumber':
      case 'invoiceno':
      case 'number':
      case 'invoice':
        return 'invoice_number';
      case 'invoicedate':
      case 'date':
        return 'invoice_date';
      case 'registrationnumber':
      case 'registrationno':
      case 'regnumber':
      case 'regno':
      case 'gstnumber':
      case 'gst':
        return 'registration_number';
      case 'grossweight':
      case 'weight':
        return 'gross_weight';
      case 'selectedbankid':
      case 'bankdetailsid':
      case 'bankaccountid':
      case 'bankdetails':
      case 'bankaccount':
      case 'bankid':
      case 'bank':
        return 'selectedBankId';
      case 'fobrate':
      case 'fob':
      case 'fobprice':
        return 'fob_rate';
      case 'freightrate':
      case 'freight':
      case 'freightprice':
        return 'freight_rate';
      case 'commissionrate':
      case 'commission':
        return 'commission_rate';
      case 'priceperbag':
      case 'price_per_bag':
      case 'rateperbag':
      case 'ratebag':
      case 'bagrate':
      case 'bagprice':
        return 'price_per_bag';
      case 'sellersignature':
      case 'sellersignatureurl':
      case 'signature':
      case 'stamp':
      case 'stampimageurl':
      case 'authoritysignature':
        return 'seller_signature';
      case 'authoritysignaturetitle':
      case 'sellersignaturelabel':
      case 'signaturetitle':
        return 'authority_signature_title';
      case 'disclaimer':
        return 'disclaimer';
      case 'pdftitle':
      case 'pdf_title':
      case 'documenttitle':
      case 'document_title':
      case 'customdoctitle':
      case 'custom_doc_title':
      case 'doctitle':
        return 'documentTitle';
      case 'commentlabel':
      case 'comment_label':
      case 'commenttitle':
      case 'comment_title':
      case 'notes_title':
      case 'notestitle':
      case 'extratitle':
        return 'notes_title';
      case 'commentvalue':
      case 'comment_value':
      case 'commenttext':
      case 'comment_text':
      case 'notes_comment':
      case 'notescomment':
      case 'extracomment':
      case 'comment':
        return 'notes_comment';
      default: {
        const detected = detectCustomInvoiceFieldInSentence(f);
        return detected ? detected.key : f;
      }
    }
  };

  const applyErrorToField = (fieldKey: string, message: string) => {
    const cleanMsg = message.trim();
    if (!cleanMsg) return;

    if (
      fieldKey === 'documentTitle' ||
      fieldKey === 'pdf_title' ||
      fieldKey === 'document_title' ||
      fieldKey === 'custom_doc_title'
    ) {
      fieldErrors.documentTitle = cleanMsg;
      fieldErrors.document_title = cleanMsg;
      fieldErrors.pdf_title = cleanMsg;
      fieldErrors.custom_doc_title = cleanMsg;
      fieldErrors.title = cleanMsg;
    } else if (fieldKey === 'is_watermark_enabled') {
      fieldErrors.is_watermark_enabled = cleanMsg;
      fieldErrors.watermark_enabled = cleanMsg;
      fieldErrors.watermark = cleanMsg;
    } else if (fieldKey === 'invoice_number') {
      fieldErrors.invoice_number = cleanMsg;
      fieldErrors.invoice_no = cleanMsg;
    } else if (fieldKey === 'invoice_date') {
      fieldErrors.invoice_date = cleanMsg;
      fieldErrors.date = cleanMsg;
    } else if (fieldKey === 'selectedBankId') {
      fieldErrors.selectedBankId = cleanMsg;
      fieldErrors.bank_details_id = cleanMsg;
      fieldErrors.bank_account_id = cleanMsg;
    } else if (fieldKey === 'fob_rate') {
      fieldErrors.fob_rate = cleanMsg;
      fieldErrors.fob = cleanMsg;
    } else if (fieldKey === 'freight_rate') {
      fieldErrors.freight_rate = cleanMsg;
      fieldErrors.freight = cleanMsg;
    } else if (fieldKey === 'commission_rate') {
      fieldErrors.commission_rate = cleanMsg;
      fieldErrors.commission = cleanMsg;
    } else if (
      fieldKey === 'price_per_bag' ||
      fieldKey === 'pricePerBag' ||
      fieldKey === 'rate_per_bag' ||
      fieldKey === 'ratePerBag' ||
      fieldKey === 'rate_bag'
    ) {
      fieldErrors.price_per_bag = cleanMsg;
      fieldErrors.pricePerBag = cleanMsg;
      fieldErrors.rate_per_bag = cleanMsg;
      fieldErrors.ratePerBag = cleanMsg;
      fieldErrors.rate_bag = cleanMsg;
    } else if (fieldKey === 'seller_signature') {
      fieldErrors.seller_signature = cleanMsg;
      fieldErrors.sellerSignature = cleanMsg;
      fieldErrors.stampImageUrl = cleanMsg;
    } else if (
      fieldKey === 'notes_title' ||
      fieldKey === 'comment_label' ||
      fieldKey === 'comment_title' ||
      fieldKey === 'commentLabel' ||
      fieldKey === 'title' ||
      fieldKey === 'extra_title'
    ) {
      fieldErrors.title = cleanMsg;
      fieldErrors.notes_title = cleanMsg;
      fieldErrors.extra_title = cleanMsg;
      fieldErrors.comment_label = cleanMsg;
      fieldErrors.comment_title = cleanMsg;
      fieldErrors.commentLabel = cleanMsg;
    } else if (
      fieldKey === 'notes_comment' ||
      fieldKey === 'comment_value' ||
      fieldKey === 'comment_text' ||
      fieldKey === 'commentValue' ||
      fieldKey === 'comment' ||
      fieldKey === 'extra_comment'
    ) {
      fieldErrors.comment = cleanMsg;
      fieldErrors.notes_comment = cleanMsg;
      fieldErrors.extra_comment = cleanMsg;
      fieldErrors.comment_value = cleanMsg;
      fieldErrors.comment_text = cleanMsg;
      fieldErrors.commentValue = cleanMsg;
    } else {
      fieldErrors[fieldKey] = cleanMsg;
    }
  };

  const ingestItem = (fieldHint: string | undefined, msgVal: any) => {
    if (!msgVal) return;

    if (Array.isArray(msgVal)) {
      msgVal.forEach((item) => ingestItem(fieldHint, item));
      return;
    }

    if (typeof msgVal === 'object') {
      if (msgVal.constraints && typeof msgVal.constraints === 'object') {
        const prop = msgVal.property || fieldHint;
        Object.values(msgVal.constraints).forEach((cMsg: any) => {
          if (typeof cMsg === 'string' && cMsg.trim()) {
            const mapped = prop ? mapFieldNameToKey(prop) : (detectCustomInvoiceFieldInSentence(cMsg)?.key || '');
            if (mapped) applyErrorToField(mapped, cMsg);
            else if (!generalError && !isGenericValidationString(cMsg)) generalError = cMsg;
          }
        });
        return;
      }

      Object.entries(msgVal).forEach(([k, v]) => {
        if (['statusCode', 'success', 'status', 'error_code'].includes(k)) return;
        ingestItem(k, v);
      });
      return;
    }

    if (typeof msgVal === 'string') {
      const trimmed = msgVal.trim();
      if (!trimmed) return;

      if (fieldHint && !/^\d+$/.test(fieldHint) && fieldHint !== 'message' && fieldHint !== 'error') {
        const mappedKey = mapFieldNameToKey(fieldHint);
        applyErrorToField(mappedKey, trimmed);
      } else {
        const detected = detectCustomInvoiceFieldInSentence(trimmed);
        if (detected) {
          applyErrorToField(detected.key, trimmed);
        } else if (!generalError && !isGenericValidationString(trimmed)) {
          generalError = trimmed;
        }
      }
    }
  };

  const rawSources = [
    result.error_fields,
    result.errors,
    result.data?.error_fields,
    result.data?.errors,
    result.raw?.error_fields,
    result.raw?.errors,
    result.message,
    result.raw?.message,
    result.error,
    result.raw?.error,
  ];

  rawSources.forEach((src) => {
    if (src) ingestItem(undefined, src);
  });

  return { fieldErrors, generalError };
}

export function CustomInvoiceDocumentForm({
  initialData,
  dataVersion,
  customInvoiceId: propCustomInvoiceId,
  shipmentInstructionId,
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
  onSubmitInvoice,
  lang = 'en',
  dict,
  readOnly = false,
}: CustomInvoiceDocumentFormProps) {
  // Validation check for legitimate document IDs (filters out placeholder strings)
  const isCandidateValid = useCallback(
    (val?: string | null): boolean => {
      if (!val) return false;
      const s = String(val).trim();
      if (!s) return false;
      if (
        /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
          s
        )
      ) {
        return false;
      }
      return true;
    },
    []
  );

  const hasCustomMarkers = Boolean(
    initialData?.custom_invoice_number ||
    initialData?.custom_invoice_no ||
    initialData?.custom_invoice_id ||
    initialData?._is_custom_invoice_loaded
  );

  // Effective Document ID resolved from prop, stepper redirect_id, initialData, or linked workflow steps
  const effectiveCustomInvoiceId = useMemo(() => {
    // 1. Direct from prop
    const cleanProp = sanitizeDocId(propCustomInvoiceId);
    if (isCandidateValid(cleanProp)) return cleanProp;

    // 2. From Stepper step redirect_id / redirectId / stepSelfId
    const stepperStep = getCustomInvoiceStep(steps, selectedStep);
    const stepperCandidates = [
      stepperStep?.redirect_id,
      (stepperStep as any)?.redirectId,
      getStepSelfId(stepperStep),
      extractStepRedirectId(stepperStep),
      getCustomInvoiceIdFromStepper(steps, selectedStep),
      selectedStep && isCustomInvoiceStep(selectedStep) ? selectedStep.redirect_id : '',
      selectedStep && isCustomInvoiceStep(selectedStep) ? (selectedStep as any).redirectId : '',
      selectedStep && isCustomInvoiceStep(selectedStep) ? getStepSelfId(selectedStep) : '',
    ];
    for (const sc of stepperCandidates) {
      const clean = sanitizeDocId(sc);
      if (isCandidateValid(clean)) return clean;
    }

    // 3. Direct custom invoice fields in initialData
    const directCandidates = [
      initialData?.custom_invoice_id,
      initialData?.customInvoiceId,
      initialData?.invoice_id,
      initialData?.invoiceId,
      initialData?.custom_id,
      initialData?.customId,
      initialData?.custom_invoice?.id,
      initialData?.custom_invoice?._id,
      initialData?.custom_invoice?.custom_invoice_id,
      extractLinkedCustomInvoiceId(initialData),
      (hasCustomMarkers && initialData?.id ? initialData.id : ''),
      (hasCustomMarkers && initialData?._id ? initialData._id : ''),
    ];
    for (const dc of directCandidates) {
      const clean = sanitizeDocId(dc);
      if (isCandidateValid(clean)) return clean;
    }

    // 4. Fallback candidates from parent workflow documents (Shipment Instruction, Proforma, Contract, Confirmation)
    const fallbackCandidates = [
      shipmentInstructionId,
      proformaId,
      contractId,
      confirmationId,
      steps && steps.length > 3 ? getStepSelfId(steps[3]) : '',
      steps && steps.length > 3 ? steps[3]?.redirect_id : '',
      steps && steps.length > 2 ? getStepSelfId(steps[2]) : '',
      steps && steps.length > 2 ? steps[2]?.redirect_id : '',
      steps && steps.length > 1 ? getStepSelfId(steps[1]) : '',
      steps && steps.length > 1 ? steps[1]?.redirect_id : '',
      steps && steps.length > 0 ? getStepSelfId(steps[0]) : '',
      steps && steps.length > 0 ? steps[0]?.redirect_id : '',
    ];
    for (const fc of fallbackCandidates) {
      const clean = sanitizeDocId(fc);
      if (isCandidateValid(clean)) return clean;
    }

    return '';
  }, [
    propCustomInvoiceId,
    steps,
    selectedStep,
    initialData,
    hasCustomMarkers,
    isCandidateValid,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
  ]);

  const [draftId, setDraftId] = useState<string>(() => effectiveCustomInvoiceId || '');
  const isDraftSavedToBackendRef = useRef<boolean>(false);

  // Keep draftId in sync when effectiveCustomInvoiceId updates (e.g. stepper loads)
  useEffect(() => {
    if (
      effectiveCustomInvoiceId &&
      isCandidateValid(effectiveCustomInvoiceId) &&
      effectiveCustomInvoiceId !== draftId
    ) {
      setDraftId(effectiveCustomInvoiceId);
      isDraftSavedToBackendRef.current = true;
    }
  }, [effectiveCustomInvoiceId, isCandidateValid, draftId]);

  const cleanSelfId = useMemo(() => {
    if (draftId && isCandidateValid(draftId)) return draftId;
    if (effectiveCustomInvoiceId && isCandidateValid(effectiveCustomInvoiceId)) return effectiveCustomInvoiceId;
    return undefined;
  }, [draftId, effectiveCustomInvoiceId, isCandidateValid]);

  // Document Status: 'PENDING' shows Save As Draft; 'COMPLETED' strictly hides Save As Draft
  const [docStatus, setDocStatus] = useState<string>(() => {
    const customStep = getCustomInvoiceStep(steps, selectedStep);
    const raw = String(
      initialData?.status ||
      initialData?.document_status ||
      customStep?.status ||
      customStep?.document_status ||
      'PENDING'
    ).toUpperCase();
    if (raw === 'COMPLETED' || raw === 'COMPLETE' || raw === 'DONE' || raw === 'APPROVED' || raw === 'SUCCESS') {
      return 'COMPLETED';
    }
    return 'PENDING';
  });

  // User interaction & dirty state tracking:
  // - hasDraftChanges: enabled only if user made edits since opening or since last successful draft save
  // - hasSubmitChanges: enabled if user made edits, or if an uncompleted custom invoice is available to submit
  const [hasDraftChanges, setHasDraftChanges] = useState<boolean>(false);
  const [hasSubmitChanges, setHasSubmitChanges] = useState<boolean>(() => {
    const customStep = getCustomInvoiceStep(steps, selectedStep);
    const raw = String(
      initialData?.status ||
      initialData?.document_status ||
      customStep?.status ||
      customStep?.document_status ||
      'PENDING'
    ).toUpperCase();
    const isCompleted =
      raw === 'COMPLETED' ||
      raw === 'COMPLETE' ||
      raw === 'DONE' ||
      raw === 'APPROVED' ||
      raw === 'SUCCESS';
    return !isCompleted;
  });

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const isFormInitializedRef = useRef<boolean>(false);
  const lastDataVersionRef = useRef<number>(dataVersion ?? 0);
  const lastLoadedDocIdRef = useRef<string>('');

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setHasDraftChanges(true);
    setHasSubmitChanges(true);
  }, []);

  // Guard against blinking: if doc ID exists but data/status is still loading, wait with a smooth skeleton
  const [statusLoadTimedOut, setStatusLoadTimedOut] = useState<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => setStatusLoadTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const isStatusLoading = !statusLoadTimedOut && Boolean(
    (propCustomInvoiceId || draftId || effectiveCustomInvoiceId) &&
    !initialData &&
    !steps?.some((s) => isCustomInvoiceStep(s) && (s.status || s.document_status || s.step_status))
  );

  // Sync docStatus when steps or initialData updates
  useEffect(() => {
    const customStep = getCustomInvoiceStep(steps, selectedStep);
    const raw = String(
      initialData?.status ||
      initialData?.document_status ||
      customStep?.status ||
      customStep?.document_status ||
      ''
    ).toUpperCase();
    if (raw === 'COMPLETED' || raw === 'COMPLETE' || raw === 'DONE' || raw === 'APPROVED' || raw === 'SUCCESS') {
      setDocStatus('COMPLETED');
    } else if (raw === 'PENDING' || raw === 'DRAFT' || raw === 'IN_PROGRESS') {
      setDocStatus('PENDING');
    }
  }, [initialData, steps, selectedStep]);

  // Document Title & Watermark
  const [customDocTitle, setCustomDocTitle] = useState<string>(() =>
    safeString(initialData?.custom_doc_title || initialData?.document_title, 'CUSTOM INVOICE')
  );
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(() => {
    if (initialData?.is_watermark_enabled !== undefined) return Boolean(initialData.is_watermark_enabled);
    if (initialData?.watermark !== undefined) return Boolean(initialData.watermark);
    if (initialData?.watermark_enabled !== undefined) return Boolean(initialData.watermark_enabled);
    return true;
  });

  // EDITABLE INPUTS:
  // 1. Invoice Number (INVOICE NO:)
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() =>
    safeString(initialData?.invoice_number || initialData?.invoice_no, '')
  );

  // 2. Invoice Date (INVOICE DATE:)
  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    const raw = initialData?.invoice_date || initialData?.date || '';
    if (!raw) return '';
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // keep raw
    }
    return String(raw).split('T')[0];
  });

  // 3. Gross Weight (GROSS WEIGHT : 0.000)
  const [grossWeight, setGrossWeight] = useState<string>(() =>
    safeString(initialData?.gross_weight, '0.000')
  );

  // 4. Rate Breakdown Inputs (FOB Rate, Freight Rate, Commission Rate, Rate Per Bag)
  const [fobRate, setFobRate] = useState<string>(() => {
    const raw = initialData?.fob_rate ?? initialData?.fob ?? initialData?.fob_price;
    return raw !== undefined && raw !== null ? String(raw).replace(/,/g, '').trim() : '';
  });
  const [freightRate, setFreightRate] = useState<string>(() => {
    const raw = initialData?.freight_rate ?? initialData?.freight ?? initialData?.freight_price;
    return raw !== undefined && raw !== null ? String(raw).replace(/,/g, '').trim() : '';
  });
  const [commissionRate, setCommissionRate] = useState<string>(() => {
    const raw = initialData?.commission_rate ?? initialData?.commission;
    return raw !== undefined && raw !== null ? String(raw).replace(/,/g, '').trim() : '';
  });
  const [ratePerBag, setRatePerBag] = useState<string>(() => {
    const raw =
      initialData?.price_per_bag ??
      initialData?.pricePerBag ??
      initialData?.rate_per_bag ??
      initialData?.rate_bag ??
      initialData?.bag_rate;
    return raw !== undefined && raw !== null ? String(raw).replace(/,/g, '').trim() : '';
  });

  // 5. Authority Signature Title & Disclaimer
  const [authoritySignatureTitle, setAuthoritySignatureTitle] = useState<string>(() =>
    safeString(
      initialData?.authority_signature_title ||
      initialData?.seller_signature_label ||
      initialData?.authority_title,
      'AUTHORITY SIGNATURE'
    )
  );
  const [disclaimer, setDisclaimer] = useState<string>(() => {
    const customDisc =
      initialData?.custom_invoice?.disclaimer ||
      initialData?.custom_invoice_disclaimer ||
      initialData?.invoice_disclaimer;
    if (customDisc && typeof customDisc === 'string' && customDisc.trim()) {
      return customDisc.trim();
    }
    const rawDisc = safeString(initialData?.disclaimer, '');
    // Prevent Proforma's bank charges note from leaking into Custom Invoice disclaimer
    if (rawDisc && !/bank charges|deduct bank charges/i.test(rawDisc)) {
      return rawDisc;
    }
    return '';
  });

  // 6. Notes: Title and Comment
  const [notesTitle, setNotesTitle] = useState<string>(() =>
    safeString(initialData?.notes_title || initialData?.extra_title || initialData?.comment_title || initialData?.comment_label, '')
  );
  const [notesComment, setNotesComment] = useState<string>(() => {
    const raw = safeString(initialData?.notes_comment || initialData?.extra_comment || initialData?.comment || initialData?.comment_value, '');
    if (/PLEASE DO NOT MENTION INVOICE NUMBER/i.test(raw)) return '';
    return raw;
  });

  // 7. Signature & Stamp State
  const hasUserClearedSignatureRef = useRef<boolean>(false);
  const [stampImageUrl, setStampImageUrl] = useState<string>(() => {
    const raw =
      initialData?.seller_signature ||
      initialData?.seller_signature_url ||
      initialData?.signature ||
      initialData?.stamp_image_url ||
      initialData?.stamp ||
      '';
    return raw ? formatSignatureUrl(raw) : '';
  });

  // 8. Bank Account Selection State
  const [selectedBankId, setSelectedBankId] = useState<string>(() =>
    safeString(initialData?.bank_details_id || initialData?.bank_account_id, '')
  );
  const [bankAccountDetails, setBankAccountDetails] = useState<string>(() =>
    safeString(initialData?.bank_details || initialData?.bank_account_details, '')
  );
  const [sellerBankAccounts, setSellerBankAccounts] = useState<any[]>([]);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false);

  // Hydrate form states when fresh initialData arrives from API or when stepper navigation triggers
  useEffect(() => {
    if (!initialData || typeof initialData !== 'object') return;

    const invoiceIdCandidate = safeString(
      initialData?.custom_invoice_id ||
      initialData?.invoice_id ||
      (initialData?.id !== contractId && initialData?.id !== confirmationId && initialData?.id !== proformaId && initialData?.id !== shipmentInstructionId ? initialData?.id : '') ||
      (initialData?._id !== contractId && initialData?._id !== confirmationId && initialData?._id !== proformaId && initialData?._id !== shipmentInstructionId ? initialData?._id : ''),
      ''
    );
    const hasDocIdChanged = Boolean(invoiceIdCandidate && invoiceIdCandidate !== lastLoadedDocIdRef.current);

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
    if (invoiceIdCandidate) {
      lastLoadedDocIdRef.current = invoiceIdCandidate;
      setDraftId(invoiceIdCandidate);
    }
    setIsDirty(false);
    setHasDraftChanges(false);

    const customStep = getCustomInvoiceStep(steps, selectedStep);
    const raw = String(
      initialData?.status ||
      initialData?.document_status ||
      customStep?.status ||
      customStep?.document_status ||
      'PENDING'
    ).toUpperCase();
    const isCompleted =
      raw === 'COMPLETED' ||
      raw === 'COMPLETE' ||
      raw === 'DONE' ||
      raw === 'APPROVED' ||
      raw === 'SUCCESS';
    setHasSubmitChanges(!isCompleted);

    if (initialData.custom_doc_title !== undefined || initialData.document_title !== undefined) {
      setCustomDocTitle(safeString(initialData.custom_doc_title || initialData.document_title, 'CUSTOM INVOICE'));
    }
    if (initialData.is_watermark_enabled !== undefined) setWatermarkEnabled(Boolean(initialData.is_watermark_enabled));
    else if (initialData.watermark !== undefined) setWatermarkEnabled(Boolean(initialData.watermark));
    else if (initialData.watermark_enabled !== undefined) setWatermarkEnabled(Boolean(initialData.watermark_enabled));

    const inv = safeString(initialData.invoice_number || initialData.invoice_no, '');
    if (inv) {
      setInvoiceNumber(inv);
    }

    if (initialData.invoice_date !== undefined || initialData.date !== undefined) {
      const raw = initialData.invoice_date || initialData.date;
      if (!raw) {
        setInvoiceDate('');
      } else {
        try {
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            setInvoiceDate(d.toISOString().split('T')[0]);
          } else {
            setInvoiceDate(String(raw).split('T')[0]);
          }
        } catch {
          setInvoiceDate(String(raw).split('T')[0]);
        }
      }
    }

    if (initialData.gross_weight !== undefined) {
      setGrossWeight(safeString(initialData.gross_weight, '0.000'));
    }

    const rawFob = initialData.fob_rate ?? initialData.fob ?? initialData.fob_price;
    if (rawFob !== undefined && rawFob !== null) setFobRate(String(rawFob).replace(/,/g, '').trim());

    const rawFreight = initialData.freight_rate ?? initialData.freight ?? initialData.freight_price;
    if (rawFreight !== undefined && rawFreight !== null) setFreightRate(String(rawFreight).replace(/,/g, '').trim());

    const rawCommission = initialData.commission_rate ?? initialData.commission;
    if (rawCommission !== undefined && rawCommission !== null) setCommissionRate(String(rawCommission).replace(/,/g, '').trim());

    const rawRatePerBag =
      initialData.price_per_bag ??
      initialData.pricePerBag ??
      initialData.rate_per_bag ??
      initialData.rate_bag ??
      initialData.bag_rate;
    if (rawRatePerBag !== undefined && rawRatePerBag !== null) setRatePerBag(String(rawRatePerBag).replace(/,/g, '').trim());

    if (initialData.authority_signature_title !== undefined || initialData.seller_signature_label !== undefined || initialData.authority_title !== undefined) {
      setAuthoritySignatureTitle(
        safeString(
          initialData.authority_signature_title ||
          initialData.seller_signature_label ||
          initialData.authority_title,
          'AUTHORITY SIGNATURE'
        )
      );
    }

    const customDisc =
      initialData.custom_invoice?.disclaimer ||
      initialData.custom_invoice_disclaimer ||
      initialData.invoice_disclaimer;
    if (customDisc && typeof customDisc === 'string' && customDisc.trim()) {
      setDisclaimer(customDisc.trim());
    } else {
      const disc = safeString(initialData.disclaimer, '');
      if (disc && !/bank charges|deduct bank charges/i.test(disc)) {
        setDisclaimer(disc);
      }
    }

    const nTitle = safeString(initialData.notes_title || initialData.extra_title || initialData.comment_title || initialData.comment_label, '');
    if (isDataVersionTriggered || (!notesTitle && !isDirty)) {
      setNotesTitle(nTitle);
    }

    const rawComment = safeString(initialData.notes_comment || initialData.extra_comment || initialData.comment || initialData.comment_value, '');
    const nComment = /PLEASE DO NOT MENTION INVOICE NUMBER/i.test(rawComment) ? '' : rawComment;
    if (isDataVersionTriggered || (!notesComment && !isDirty)) {
      setNotesComment(nComment);
    }

    const rawStamp =
      initialData.seller_signature ||
      initialData.seller_signature_url ||
      initialData.signature ||
      initialData.stamp_image_url ||
      initialData.stamp;
    if (rawStamp !== undefined && !hasUserClearedSignatureRef.current) {
      setStampImageUrl(rawStamp ? formatSignatureUrl(rawStamp) : '');
    }

    const rawBankId = safeString(initialData.bank_details_id || initialData.bank_account_id, '');
    if (rawBankId) {
      setSelectedBankId(rawBankId);
    }
    const rawBankDetails = safeString(initialData.bank_details || initialData.bank_account_details, '');
    if (rawBankDetails) {
      setBankAccountDetails(rawBankDetails);
    }
  }, [initialData, dataVersion, steps, selectedStep, contractId, confirmationId, proformaId, shipmentInstructionId]);

  // Validation / Server-side Errors State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Loading States
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // READ-ONLY DISPLAYED DATA PREFILLS (from initialData or parent contract/confirmation):
  // Exporter / Seller details
  const sellerObj =
    initialData?.seller_details ||
    initialData?.seller ||
    initialData?.exporter_details ||
    initialData?.exporter ||
    initialData?.contract?.seller_details ||
    initialData?.contract?.seller ||
    initialData?.confirmation?.seller_details ||
    initialData?.confirmation?.seller ||
    {};

  const sellerName = safeString(
    sellerObj?.company_name ||
    sellerObj?.name ||
    sellerObj?.business_name ||
    initialData?.exporter_name ||
    initialData?.company_name ||
    initialData?.seller_name,
    ''
  );

  // User requirement: "Custom Invoice me Exporter / Seller field me only seller_details ke andar instruction hai usko hi dikha na hai abhi seller name hai vo galat hai"
  const sellerInstructionText = useMemo(() => {
    const rawDetails =
      initialData?.seller_details ||
      initialData?.contract?.seller_details ||
      initialData?.confirmation?.seller_details ||
      initialData?.proforma?.seller_details ||
      initialData?.shipment_instruction?.seller_details ||
      initialData?.seller;

    if (typeof rawDetails === 'object' && rawDetails !== null) {
      const ins =
        rawDetails.instruction ||
        rawDetails.instructionText ||
        rawDetails.instruction_text ||
        rawDetails.seller_instruction ||
        rawDetails.details ||
        rawDetails.address;
      if (ins) return safeString(ins);
    } else if (typeof rawDetails === 'string' && rawDetails.trim()) {
      const trimmed = rawDetails.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          const ins = parsed.instruction || parsed.instructionText || parsed.instruction_text || parsed.details;
          if (ins) return safeString(ins);
        } catch {}
      }
      return trimmed;
    }

    if (initialData?.seller_instruction) return safeString(initialData.seller_instruction);
    if (initialData?.contract?.seller_instruction) return safeString(initialData.contract.seller_instruction);
    if (initialData?.confirmation?.seller_instruction) return safeString(initialData.confirmation.seller_instruction);

    return '';
  }, [initialData]);

  const sellerDetailsText = useMemo(() => {
    if (sellerInstructionText) return sellerInstructionText;
    if (typeof sellerObj === 'string' && sellerObj.trim()) return sellerObj.trim();
    if (initialData?.seller_details_text) return String(initialData.seller_details_text);

    const parts: string[] = [];
    const addr = safeString(sellerObj?.address || sellerObj?.street || sellerObj?.address_line);
    const city = safeString(sellerObj?.city);
    const state = safeString(sellerObj?.state);
    const country = typeof sellerObj?.country === 'object'
      ? safeString(sellerObj?.country?.name || sellerObj?.country?.title)
      : safeString(sellerObj?.country);
    const zip = safeString(sellerObj?.zip_code || sellerObj?.zipcode || sellerObj?.pincode);

    const locParts = [addr, city, state, country, zip].filter(Boolean);
    if (locParts.length > 0) parts.push(locParts.join(', '));

    const email = safeString(sellerObj?.email || initialData?.seller_email);
    if (email) parts.push(`EMAIL: ${email}`);

    const phone = safeString(sellerObj?.contact_number || sellerObj?.phone || sellerObj?.mobile);
    if (phone) parts.push(`CONTACT: ${phone}`);

    return parts.join(', ') || '';
  }, [sellerInstructionText, sellerObj, initialData]);

  // User requirement: "GST Number label hatado uski jagah label Registration number aayega and usme value registration_number se dikhani hai"
  const registrationNumber = safeString(
    initialData?.registration_number ||
    initialData?.registration_no ||
    initialData?.reg_number ||
    initialData?.reg_no ||
    sellerObj?.registration_number ||
    sellerObj?.registration_no ||
    sellerObj?.reg_number ||
    initialData?.seller_registration_number ||
    initialData?.contract?.registration_number ||
    initialData?.confirmation?.registration_number ||
    sellerObj?.gst_number ||
    sellerObj?.gst ||
    initialData?.gst_number ||
    initialData?.gst ||
    initialData?.seller_gst ||
    initialData?.seller_gst_number ||
    initialData?.contract?.seller_gst ||
    initialData?.confirmation?.seller_gst,
    ''
  );

  const gstNumber = registrationNumber;

  // Buyer / Consignee details
  const buyerObj =
    initialData?.buyer_details ||
    initialData?.buyer ||
    initialData?.consignee_details ||
    initialData?.consignee ||
    initialData?.shipment_instruction?.consignee_details ||
    initialData?.contract?.buyer_details ||
    initialData?.contract?.buyer ||
    initialData?.confirmation?.buyer_details ||
    initialData?.confirmation?.buyer ||
    {};

  const buyerName = safeString(
    buyerObj?.company_name ||
    buyerObj?.name ||
    buyerObj?.business_name ||
    initialData?.consignee_name ||
    initialData?.buyer_name,
    ''
  );

  const buyerDetailsText = useMemo(() => {
    if (typeof buyerObj === 'string' && buyerObj.trim()) return buyerObj.trim();
    if (initialData?.buyer_details_text) return String(initialData.buyer_details_text);

    const parts: string[] = [];
    const addr = safeString(buyerObj?.address || buyerObj?.street || buyerObj?.address_line);
    const city = safeString(buyerObj?.city);
    const state = safeString(buyerObj?.state);
    const country = typeof buyerObj?.country === 'object'
      ? safeString(buyerObj?.country?.name || buyerObj?.country?.title)
      : safeString(buyerObj?.country);
    const zip = safeString(buyerObj?.zip_code || buyerObj?.zipcode || buyerObj?.pincode);

    const locParts = [addr, city, state, country, zip].filter(Boolean);
    if (locParts.length > 0) parts.push(locParts.join(', '));

    const email = safeString(buyerObj?.email || initialData?.buyer_email);
    if (email) parts.push(`EMAIL: ${email}`);

    const phone = safeString(buyerObj?.contact_number || buyerObj?.phone || buyerObj?.mobile);
    if (phone) parts.push(`CONTACT: ${phone}`);

    return parts.join(', ') || '';
  }, [buyerObj, initialData]);

  // User requirement: "consignee details me consignee_details se value dikhani hai"
  const consigneeDetailsValue = useMemo(() => {
    const rawConsignee =
      initialData?.consignee_details ||
      initialData?.shipment_instruction?.consignee_details ||
      initialData?.shipment?.consignee_details;

    if (typeof rawConsignee === 'string' && rawConsignee.trim()) {
      const trimmed = rawConsignee.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.details) return safeString(parsed.details);
          if (parsed.instruction) return safeString(parsed.instruction);
          if (parsed.address) {
            const cName = parsed.company_name || parsed.name || '';
            return [cName, parsed.address].filter(Boolean).join('\n');
          }
        } catch {}
      }
      return trimmed;
    }

    if (typeof rawConsignee === 'object' && rawConsignee !== null) {
      if (rawConsignee.details) return safeString(rawConsignee.details);
      if (rawConsignee.instruction) return safeString(rawConsignee.instruction);
      if (rawConsignee.instructionText) return safeString(rawConsignee.instructionText);
      const parts: string[] = [];
      const cName = rawConsignee.company_name || rawConsignee.name || '';
      if (cName) parts.push(cName);
      const addr = rawConsignee.address || rawConsignee.street || rawConsignee.address_line;
      if (addr) parts.push(addr);
      const city = rawConsignee.city;
      const state = rawConsignee.state;
      const country = typeof rawConsignee.country === 'object' ? rawConsignee.country?.name : rawConsignee.country;
      const zip = rawConsignee.zip_code || rawConsignee.zipcode || rawConsignee.pincode;
      const loc = [city, state, country, zip].filter(Boolean).join(', ');
      if (loc) parts.push(loc);
      if (parts.length > 0) return parts.join('\n');
    }

    if (initialData?.consignee_details_text) return String(initialData.consignee_details_text).trim();
    if (buyerDetailsText) {
      if (buyerName && !buyerDetailsText.includes(buyerName)) {
        return `${buyerName}\n${buyerDetailsText}`;
      }
      return buyerDetailsText;
    }
    return buyerName || '';
  }, [initialData, buyerDetailsText, buyerName]);

  // Order & Reference fields
  // User requirement: "and BUYER'S ORDER NO & DATE: me buyer_order_no_date"
  const buyerOrderNoAndDate = safeString(
    initialData?.buyer_order_no_date ||
    initialData?.proforma?.buyer_order_no_date ||
    initialData?.contract?.buyer_order_no_date ||
    initialData?.confirmation?.buyer_order_no_date ||
    initialData?.buyer_order_no_and_date ||
    initialData?.buyer_order_number_and_date ||
    initialData?.buyer_order_and_date ||
    (initialData?.buyer_order_no || initialData?.buyer_order_number
      ? `${initialData.buyer_order_no || initialData.buyer_order_number}${
          initialData.order_date || initialData.buyer_order_date
            ? ` && ${initialData.order_date || initialData.buyer_order_date}`
            : ''
        }`
      : initialData?.order_no || initialData?.order_number
      ? `${initialData.order_no || initialData.order_number}${
          initialData.order_date ? ` && ${initialData.order_date}` : ''
        }`
      : ''),
    ''
  );

  // User requirement: "purchase ordar number me contract_number dikhana ha"
  const purchaseOrderNo = safeString(
    initialData?.contract_number ||
    initialData?.contract_no ||
    initialData?.contract?.contract_number ||
    initialData?.contract?.contract_no ||
    initialData?.confirmation_number ||
    initialData?.confirmation_no ||
    initialData?.purchase_order_no ||
    initialData?.purchase_order_number ||
    initialData?.po_number ||
    initialData?.po_no ||
    initialData?.poNumber ||
    initialData?.poNo ||
    initialData?.shipment_instruction?.purchase_order_no ||
    initialData?.contract?.purchase_order_no,
    ''
  );

  const contractDate = safeString(
    initialData?.contract_date ||
    initialData?.contractDate ||
    initialData?.confirmation_date ||
    initialData?.confirmationDate ||
    initialData?.contract?.contract_date ||
    initialData?.confirmation?.confirmation_date,
    ''
  );

  const otherReferences = safeString(
    initialData?.other_reference ||
    initialData?.other_references ||
    initialData?.otherReference ||
    initialData?.otherReferences ||
    initialData?.reference_no ||
    initialData?.reference_number ||
    initialData?.contract_number ||
    initialData?.contract_no ||
    initialData?.confirmation_number ||
    initialData?.confirmation_no,
    ''
  );

  // Notify Parties (1 to 6 - Display-only)
  const extractNotifyParty = useCallback(
    (index1Based: number) => {
      let list: any[] = [];
      const rawList =
        initialData?.notify_parties ||
        initialData?.notify_party_details ||
        initialData?.notify_party ||
        initialData?.shipment_instruction?.notify_parties ||
        initialData?.shipment?.notify_parties;

      if (Array.isArray(rawList)) {
        list = rawList;
      } else if (typeof rawList === 'string' && rawList.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(rawList);
          if (Array.isArray(parsed)) list = parsed;
        } catch {}
      } else if (
        typeof initialData?.notify_parties_json === 'string' &&
        initialData.notify_parties_json.trim().startsWith('[')
      ) {
        try {
          const parsed = JSON.parse(initialData.notify_parties_json);
          if (Array.isArray(parsed)) list = parsed;
        } catch {}
      }

      const item = list[index1Based - 1];

      const val =
        initialData?.[`notify_party_${index1Based}`] ||
        initialData?.[`notify_party_${index1Based}_details`] ||
        initialData?.[`notify_party_${index1Based}_text`] ||
        initialData?.[`notify_party_${index1Based}`]?.details ||
        initialData?.[`notify_party_${index1Based}`]?.name ||
        initialData?.[`notify_party_${index1Based}`]?.company_name ||
        initialData?.shipment_instruction?.[`notify_party_${index1Based}`] ||
        initialData?.shipment_instruction?.[`notify_party_${index1Based}_details`] ||
        initialData?.shipment?.[`notify_party_${index1Based}`] ||
        initialData?.shipment?.[`notify_party_${index1Based}_details`] ||
        item?.details ||
        item?.notify_party ||
        item?.text ||
        item?.name ||
        item?.company_name ||
        (typeof item === 'string' ? item : '');

      return safeString(val, '');
    },
    [initialData]
  );

  const notifyParty1 = useMemo(() => extractNotifyParty(1), [extractNotifyParty]);
  const notifyParty2 = useMemo(() => extractNotifyParty(2), [extractNotifyParty]);
  const notifyParty3 = useMemo(() => extractNotifyParty(3), [extractNotifyParty]);
  const notifyParty4 = useMemo(() => extractNotifyParty(4), [extractNotifyParty]);
  const notifyParty5 = useMemo(() => extractNotifyParty(5), [extractNotifyParty]);
  const notifyParty6 = useMemo(() => extractNotifyParty(6), [extractNotifyParty]);

  const hasSecondRowNotify = Boolean(notifyParty4 || notifyParty5 || notifyParty6);

  // Shipping & Transport Info (Display-only)
  // User requirement: "PRE CARRIGE BY ME STATIC VALUE 'BY SEA'"
  const preCarriageBy = 'BY SEA';

  const placeOfReceipt = safeString(
    initialData?.place_of_receipt ||
    initialData?.place_of_receipt_by_pre_carrier ||
    initialData?.country_of_origin ||
    initialData?.origin_country ||
    initialData?.shipment_instruction?.place_of_receipt ||
    initialData?.contract?.country,
    ''
  );

  const countryOfOrigin = safeString(
    initialData?.country_of_origin ||
    initialData?.origin_country ||
    initialData?.product_country ||
    initialData?.country ||
    initialData?.contract?.country ||
    initialData?.confirmation?.country,
    ''
  );

  // User requirement: "COUNRY OF DESTINATION ME destination_port KE ANDAR country KE ANDAR name hai usko dikhana hai"
  const countryOfDestination = useMemo(() => {
    const dp =
      initialData?.destination_port ||
      initialData?.contract?.destination_port ||
      initialData?.confirmation?.destination_port ||
      initialData?.shipment_instruction?.destination_port ||
      initialData?.destinationPort;

    if (typeof dp === 'object' && dp !== null) {
      if (typeof dp.country === 'object' && dp.country !== null) {
        const cName = dp.country.name || dp.country.title || dp.country.label;
        if (cName) return safeString(cName);
      } else if (typeof dp.country === 'string' && dp.country.trim()) {
        return safeString(dp.country);
      }
      if (dp.country_name || dp.countryName) {
        return safeString(dp.country_name || dp.countryName);
      }
    }

    const fromExt = extractDestinationPortCountry(initialData);
    if (fromExt) return fromExt;

    return safeString(
      initialData?.country_of_destination ||
      initialData?.destination_country ||
      initialData?.country_destination ||
      initialData?.final_destination_country ||
      initialData?.contract?.destination_country,
      ''
    );
  }, [initialData]);

  // Voyage & Ports (Display-only)
  // User requirement: "VESSEL / VOYAGE NO me voyage_number hai to dikhana hai varna 'AS PER BL'."
  const vesselVoyageNo = useMemo(() => {
    const raw = safeString(
      initialData?.voyage_number ||
      initialData?.voyage_no ||
      initialData?.shipment_instruction?.voyage_number ||
      initialData?.shipment_instruction?.voyage_no ||
      initialData?.vessel_voyage_no ||
      initialData?.vessel_voyage ||
      initialData?.vessel_name ||
      initialData?.vessel_flight_no ||
      initialData?.vessel ||
      initialData?.shipment_instruction?.vessel_name ||
      initialData?.contract?.vessel_name,
      ''
    );
    return raw || 'AS PER BL';
  }, [initialData]);

  const portOfLoading = safeString(
    initialData?.port_of_loading ||
    initialData?.loading_port ||
    initialData?.loading_port_name ||
    initialData?.loadingPort ||
    initialData?.shipment_instruction?.port_of_loading ||
    initialData?.contract?.loading_port ||
    initialData?.confirmation?.loading_port,
    ''
  );

  const termsOfDeliveryPayment = useMemo(() => {
    if (initialData?.terms_of_delivery_payment) {
      return safeString(initialData.terms_of_delivery_payment);
    }
    const deliv = safeString(
      initialData?.delivery_terms ||
      initialData?.incoterm ||
      initialData?.shipping_term ||
      initialData?.shipping_terms ||
      initialData?.terms_of_delivery ||
      initialData?.contract?.shipping_term ||
      initialData?.confirmation?.shipping_term,
      ''
    );
    const paym = safeString(
      initialData?.payment_terms ||
      initialData?.terms_of_payment ||
      initialData?.payment_term ||
      initialData?.contract?.payment_terms ||
      initialData?.confirmation?.payment_term,
      ''
    );
    if (deliv && paym) return `${deliv} / ${paym}`;
    return deliv || paym || '';
  }, [initialData]);

  // Destination Ports (Display-only)
  const portOfDestination = safeString(
    initialData?.port_of_destination ||
    initialData?.destination_port ||
    initialData?.destination_port_name ||
    initialData?.destinationPort ||
    initialData?.shipment_instruction?.destination_port ||
    initialData?.contract?.destination_port ||
    initialData?.confirmation?.destination_port,
    ''
  );

  const finalDestination = safeString(
    initialData?.final_destination ||
    initialData?.finalDestination ||
    initialData?.place_of_delivery ||
    initialData?.placeOfDelivery ||
    initialData?.destination_port_name ||
    initialData?.destination_port ||
    initialData?.port_of_destination,
    ''
  );

  // Goods Details (Display-only with Gross Weight input)
  // User requirement: "Coult vesaal me proper dikha rahe ho sath me ek value me FCLs add karna hai"
  const countVessel = useMemo(() => {
    let raw = safeString(
      initialData?.count_vessel ||
      (initialData?.fcl_quantity && initialData?.fcl_type
        ? `${initialData.fcl_quantity} X ${initialData.fcl_type}`
        : '') ||
      initialData?.container_count ||
      initialData?.fcl_count ||
      initialData?.fcl_quantity ||
      initialData?.fcl_qty ||
      initialData?.shipment_instruction?.container_count ||
      initialData?.contract?.fcl_quantity,
      ''
    );
    if (!raw) return '';
    if (!/\bfcls?\b/i.test(raw)) {
      raw = `${raw} FCLs`;
    }
    return raw;
  }, [initialData]);

  const productName = safeString(
    initialData?.product_name ||
    initialData?.commodity ||
    initialData?.product?.name ||
    initialData?.product?.title ||
    initialData?.contract?.product_name ||
    initialData?.confirmation?.product_name,
    ''
  );

  const hsnCode = safeString(
    initialData?.hsn_code ||
    initialData?.hsn ||
    initialData?.hs_code ||
    initialData?.product?.hsn ||
    initialData?.contract?.hsn_code ||
    initialData?.confirmation?.hsn_code,
    ''
  );

  const packingTypeTitle = useMemo(() => {
    const raw =
      initialData?.packing_type_title ||
      initialData?.packing_type?.title ||
      initialData?.packing_type?.name ||
      initialData?.packing_type ||
      initialData?.packing_title ||
      initialData?.packing_description ||
      initialData?.packing_type_name ||
      initialData?.packing ||
      initialData?.contract?.packing_type_title ||
      initialData?.contract?.packing_type ||
      initialData?.confirmation?.packing_type_title ||
      initialData?.confirmation?.packing_type ||
      initialData?.shipment_instruction?.packing_type_title ||
      initialData?.shipment_instruction?.packing_type ||
      initialData?.proforma?.packing_type_title ||
      initialData?.proforma?.packing_type;

    if (raw && typeof raw === 'string') return raw.trim();
    if (raw && typeof raw === 'object') {
      const t = raw.title || raw.name || raw.label || raw.packing_type;
      if (t && typeof t === 'string') return t.trim();
    }
    return '';
  }, [initialData]);

  const packingType = safeString(
    packingTypeTitle ||
    initialData?.packing_type ||
    initialData?.packing ||
    initialData?.packing_description ||
    initialData?.contract?.packing_type ||
    initialData?.confirmation?.packing_type,
    ''
  );

  const totalBags = safeString(
    initialData?.total_bags ||
    initialData?.bag_quantity ||
    initialData?.bag_qty ||
    initialData?.shipment_instruction?.total_bags ||
    initialData?.shipment_instruction?.bag_quantity ||
    initialData?.contract?.bag_quantity ||
    initialData?.contract?.total_bags ||
    initialData?.confirmation?.bag_quantity ||
    initialData?.confirmation?.total_bags,
    ''
  );

  const ratePerLabel = useMemo(() => {
    const cleanTitle = (packingTypeTitle || packingType || '').trim();
    return cleanTitle ? `RATE PER ${cleanTitle.toUpperCase()}` : 'RATE PER BAG';
  }, [packingTypeTitle, packingType]);

  const markingBrand = safeString(
    initialData?.marking_brand ||
    initialData?.brand ||
    initialData?.marks_and_numbers ||
    initialData?.container_marks ||
    initialData?.shipment_instruction?.marking_brand ||
    initialData?.contract?.marking_brand ||
    initialData?.confirmation?.marking_brand,
    ''
  );

  const emptyBags = safeString(
    initialData?.empty_bags ||
    initialData?.emptyBags ||
    initialData?.shipment_instruction?.empty_bags ||
    initialData?.contract?.empty_bags,
    ''
  );

  const toleranceClause = safeString(
    initialData?.tolerance_clause ||
    initialData?.tolerance ||
    initialData?.contract?.tolerance_clause ||
    initialData?.confirmation?.tolerance_clause,
    ''
  );

  // Quantity, Currency, Incoterm, Rates & Totals
  const quantityMt = useMemo(() => {
    const raw =
      initialData?.quantity_mt ??
      initialData?.mt_quantity ??
      initialData?.quantity ??
      initialData?.net_weight ??
      initialData?.contract?.quantity_mt ??
      initialData?.contract?.mt_quantity ??
      initialData?.confirmation?.quantity_mt ??
      initialData?.confirmation?.mt_quantity ??
      initialData?.proforma?.quantity_mt ??
      initialData?.shipment_instruction?.mt_quantity ??
      initialData?.shipment_instruction?.quantity_mt;

    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const num = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }

    const fq = parseFloat(String(initialData?.fcl_quantity ?? initialData?.fcl_qty ?? initialData?.contract?.fcl_quantity ?? 0));
    const fc = parseFloat(String(initialData?.fcl_capacity ?? initialData?.contract?.fcl_capacity ?? 0));
    if (fq > 0 && fc > 0) return fq * fc;

    return 0;
  }, [initialData]);

  const netWeight = useMemo(() => {
    return safeString(
      initialData?.net_weight ||
      (quantityMt > 0 ? `${formatNumberWithCommas(quantityMt)} MT` : '') ||
      initialData?.quantity_mt ||
      initialData?.mt_quantity,
      ''
    );
  }, [initialData, quantityMt]);

  const currency = useMemo(() => {
    const raw =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.contract?.currency ||
      initialData?.confirmation?.currency ||
      initialData?.proforma?.currency ||
      'USD';
    if (typeof raw === 'object' && raw !== null) {
      return safeString(raw.code || raw.currency_code || raw.name || raw.symbol, 'USD');
    }
    return safeString(raw, 'USD');
  }, [initialData]);

  const currencySymbol = useMemo(() => {
    const cCode =
      initialData?.currency ||
      initialData?.currency_code ||
      initialData?.contract?.currency ||
      initialData?.confirmation?.currency ||
      initialData?.proforma?.currency;
    const fromCode = cCode ? getCurrencySymbol(cCode) : '';
    return safeString(
      initialData?.currency_symbol ||
      initialData?.currency?.symbol ||
      fromCode ||
      getCurrencySymbol(currency),
      '$'
    );
  }, [initialData, currency]);

  const incoterm = useMemo(() => {
    return safeString(
      initialData?.incoterm ||
      initialData?.shipping_term ||
      initialData?.shipping_terms ||
      initialData?.delivery_terms ||
      initialData?.delivery_term ||
      initialData?.terms_of_delivery ||
      initialData?.contract?.incoterm ||
      initialData?.contract?.shipping_term ||
      initialData?.confirmation?.shipping_term ||
      initialData?.proforma?.shipping_term,
      'CNF'
    );
  }, [initialData]);

  const ratePrice = useMemo(() => {
    const raw =
      initialData?.cnf ??
      initialData?.cnf_rate ??
      initialData?.cnf_value ??
      initialData?.cnf_price ??
      initialData?.rate_price ??
      initialData?.price ??
      initialData?.rate ??
      initialData?.unit_price ??
      initialData?.rate_per_mt ??
      initialData?.contract?.price ??
      initialData?.contract?.rate ??
      initialData?.confirmation?.price ??
      initialData?.proforma?.rate_price ??
      initialData?.shipment_instruction?.rate_price;

    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const num = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }

    const rawTotal =
      initialData?.total_value ??
      initialData?.totalValue ??
      initialData?.total_amount ??
      initialData?.totalAmount;
    if (rawTotal && quantityMt > 0) {
      const numTotal = parseFloat(String(rawTotal).replace(/,/g, ''));
      if (!isNaN(numTotal) && numTotal > 0) {
        return numTotal / quantityMt;
      }
    }

    return 0;
  }, [initialData, quantityMt]);

  // Overall Total Amount / Total Value
  const totalAmount = useMemo(() => {
    const rawTotal =
      initialData?.total_value ??
      initialData?.totalValue ??
      initialData?.total_amount ??
      initialData?.totalAmount ??
      initialData?.grand_total ??
      initialData?.contract?.total_value ??
      initialData?.contract?.totalValue ??
      initialData?.confirmation?.total_value ??
      initialData?.confirmation?.totalValue ??
      initialData?.proforma?.total_amount ??
      initialData?.proforma?.total_value ??
      initialData?.shipment_instruction?.total_value;

    if (rawTotal !== undefined && rawTotal !== null && String(rawTotal).trim() !== '') {
      const num = parseFloat(String(rawTotal).replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }

    if (quantityMt > 0 && ratePrice > 0) {
      return quantityMt * ratePrice;
    }

    return 0;
  }, [initialData, quantityMt, ratePrice]);

  const amountInWords = useMemo(() => {
    if (initialData?.amount_in_words) return String(initialData.amount_in_words);
    if (totalAmount > 0) {
      try {
        const words = convertAmountToWords(totalAmount, currency);
        return words ? words.toUpperCase() : '';
      } catch {
        return '';
      }
    }
    return '';
  }, [initialData, totalAmount, currency]);

  // Rate Breakdown Live Calculations
  const calculatedFobAmount = useMemo(() => {
    const rate = parseFloat(String(fobRate).replace(/,/g, ''));
    if (isNaN(rate) || rate <= 0) return 0;
    return rate * quantityMt;
  }, [fobRate, quantityMt]);

  const calculatedFreightAmount = useMemo(() => {
    const rate = parseFloat(String(freightRate).replace(/,/g, ''));
    if (isNaN(rate) || rate <= 0) return 0;
    return rate * quantityMt;
  }, [freightRate, quantityMt]);

  const calculatedCommissionAmount = useMemo(() => {
    const rate = parseFloat(String(commissionRate).replace(/,/g, ''));
    if (isNaN(rate) || rate <= 0) return 0;
    return rate * quantityMt;
  }, [commissionRate, quantityMt]);

  const calculatedRateTotal = useMemo(() => {
    return calculatedFobAmount + calculatedFreightAmount + calculatedCommissionAmount;
  }, [calculatedFobAmount, calculatedFreightAmount, calculatedCommissionAmount]);

  // Bag Quantity, Rate Per Bag, and Accounting Match Calculations
  const bagQuantityNum = useMemo(() => {
    const candidates = [
      initialData?.bag_quantity,
      initialData?.bag_qty,
      initialData?.total_bags,
      initialData?.bags,
      initialData?.quantity_bags,
      initialData?.contract?.bag_quantity,
      initialData?.contract?.bag_qty,
      initialData?.contract?.total_bags,
      initialData?.confirmation?.bag_quantity,
      initialData?.confirmation?.bag_qty,
      initialData?.confirmation?.total_bags,
      initialData?.shipment_instruction?.total_bags,
      initialData?.shipment_instruction?.bag_quantity,
      initialData?.shipment_instruction?.bag_qty,
      initialData?.proforma?.bag_quantity,
      initialData?.proforma?.total_bags,
      totalBags,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null && String(c).trim() !== '') {
        const match = String(c).replace(/,/g, '').match(/(\d+(\.\d+)?)/);
        if (match) {
          const parsed = parseFloat(match[1]);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
    }

    // Fallback: calculate from quantityMt and packing size if available
    // e.g. 1620 MT in 50 KG bags = (1620 * 1000) / 50 = 32400 bags
    const pStr = packingTypeTitle || packingType;
    if (quantityMt > 0 && pStr) {
      const kgMatch = pStr.match(/(\d+(\.\d+)?)\s*kg/i);
      if (kgMatch) {
        const kgPerBag = parseFloat(kgMatch[1]);
        if (kgPerBag > 0) {
          return Math.round((quantityMt * 1000) / kgPerBag);
        }
      }
    }

    return 0;
  }, [initialData, totalBags, packingTypeTitle, packingType, quantityMt]);

  const parsedRatePerBag = useMemo(() => {
    if (!ratePerBag || String(ratePerBag).trim() === '') return 0;
    const num = parseFloat(String(ratePerBag).replace(/,/g, ''));
    return isNaN(num) || num <= 0 ? 0 : num;
  }, [ratePerBag]);

  const calculatedBagTotal = useMemo(() => {
    if (bagQuantityNum > 0 && parsedRatePerBag > 0) {
      return bagQuantityNum * parsedRatePerBag;
    }
    return 0;
  }, [bagQuantityNum, parsedRatePerBag]);

  const targetTotal = useMemo(() => {
    return totalAmount > 0 ? totalAmount : calculatedRateTotal;
  }, [totalAmount, calculatedRateTotal]);

  const isBagTotalMismatch = useMemo(() => {
    if (parsedRatePerBag <= 0 || bagQuantityNum <= 0 || targetTotal <= 0) return false;
    return Math.abs(calculatedBagTotal - targetTotal) > 0.01;
  }, [parsedRatePerBag, bagQuantityNum, targetTotal, calculatedBagTotal]);

  const isBagTotalMatched = useMemo(() => {
    if (parsedRatePerBag <= 0 || bagQuantityNum <= 0 || targetTotal <= 0) return false;
    return Math.abs(calculatedBagTotal - targetTotal) <= 0.01;
  }, [parsedRatePerBag, bagQuantityNum, targetTotal, calculatedBagTotal]);

  // Helper to format bank details
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
    return lines.join('\n');
  }, []);

  // Fetch Seller Bank Accounts
  useEffect(() => {
    const effectiveInstructionId =
      sellerObj?.instruction_id ||
      sellerObj?.seller_instruction_id ||
      extractSellerInstructionId(initialData, sellers) ||
      initialData?.seller_instruction_id ||
      initialData?.seller_id ||
      sellerObj?.id ||
      '';

    if (!effectiveInstructionId) return;

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
      // Explicit requirement: NO auto-selection of bank accounts. Keep unselected unless user picks.
      return;
    }

    let isSubscribed = true;
    setIsLoadingBankAccounts(true);

    getSellerBankDetailsAction(effectiveInstructionId, { lang, source: 'web' })
      .then((res) => {
        if (!isSubscribed) return;
        const items = res?.data?.items || [];
        if (res?.success && Array.isArray(items) && items.length > 0) {
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
          // Explicit requirement: NO auto-selection of bank accounts. Keep unselected unless user picks.
        }
      })
      .catch((err) => {
        console.warn('[CustomInvoiceDocumentForm] Failed to load seller bank details:', err);
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoadingBankAccounts(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [sellerObj, initialData, sellers, selectedBankId, bankAccountDetails, formatBankDetails, lang]);

  // Bank Options for DocUnderlineSelect
  const bankSelectOptions: DocSelectOption[] = useMemo(() => {
    if (!sellerBankAccounts || sellerBankAccounts.length === 0) {
      if (selectedBankId && bankAccountDetails) {
        return [
          { value: '', label: 'Select Bank Account' },
          { value: selectedBankId, label: 'Selected Bank Account' },
        ];
      }
      return [
        {
          value: '',
          label: isLoadingBankAccounts ? 'Loading bank accounts...' : 'Select Bank Account',
        },
      ];
    }
    const opts: DocSelectOption[] = [
      { value: '', label: 'Select Bank Account' },
      ...sellerBankAccounts.map((b: any) => {
        const id = String(b.bank_details_id || b.id || b._id);
        const name = b.bank_name || b.bankName || b.name || b.account_name || 'Bank Account';
        const num = b.account_number || b.account_no ? ` - ${b.account_number || b.account_no}` : '';
        return {
          value: id,
          label: `${name}${num}`,
          subLabel: b.branch || b.branch_name ? `Branch: ${b.branch || b.branch_name}` : undefined,
        };
      }),
    ];
    if (selectedBankId && !opts.some((o) => String(o.value) === String(selectedBankId))) {
      opts.push({
        value: selectedBankId,
        label: 'Selected Bank Account',
      });
    }
    return opts;
  }, [sellerBankAccounts, isLoadingBankAccounts, selectedBankId, bankAccountDetails]);

  // Constructs complete multipart/form-data payload, matching Contract & Proforma forms.
  // Signatures are converted to binary files (seller_signature) to prevent HTTP 413 "Request Entity Too Large".
  const getCustomInvoiceFormData = useCallback((): FormData => {
    const formData = new FormData();
    const activeDocId =
      cleanSelfId ||
      (isCandidateValid(draftId) ? draftId : '') ||
      (isCandidateValid(effectiveCustomInvoiceId) ? effectiveCustomInvoiceId : '');

    if (activeDocId) {
      formData.append('id', activeDocId);
      formData.append('custom_invoice_id', activeDocId);
      formData.append('invoice_id', activeDocId);
    }
    if (shipmentInstructionId) formData.append('shipment_instruction_id', shipmentInstructionId);
    if (proformaId) formData.append('proforma_id', proformaId);
    if (contractId) formData.append('contract_id', contractId);
    if (confirmationId) formData.append('confirmation_id', confirmationId);

    const effectiveTitle = (customDocTitle || '').trim() || 'CUSTOM INVOICE';
    formData.append('custom_doc_title', effectiveTitle);
    formData.append('document_title', effectiveTitle);
    formData.append('pdf_title', effectiveTitle);
    formData.append('title', effectiveTitle);

    const isWmBool = Boolean(watermarkEnabled);
    formData.append('is_watermark_enabled', String(isWmBool));
    formData.append('watermark', String(isWmBool));
    formData.append('watermark_enabled', String(isWmBool));

    if (invoiceNumber) {
      formData.append('invoice_number', invoiceNumber);
      formData.append('invoice_no', invoiceNumber);
    }
    if (invoiceDate) {
      formData.append('invoice_date', invoiceDate);
    }
    if (registrationNumber) {
      formData.append('registration_number', registrationNumber);
    }
    if (grossWeight) {
      formData.append('gross_weight', String(grossWeight));
    }
    if (selectedBankId) {
      formData.append('bank_details_id', selectedBankId);
      formData.append('bank_account_id', selectedBankId);
    }
    if (bankAccountDetails) {
      formData.append('bank_details', bankAccountDetails);
    }
    if (fobRate !== '' && !isNaN(Number(fobRate))) {
      formData.append('fob_rate', String(Number(fobRate)));
    }
    if (freightRate !== '' && !isNaN(Number(freightRate))) {
      formData.append('freight_rate', String(Number(freightRate)));
    }
    if (commissionRate !== '' && !isNaN(Number(commissionRate))) {
      formData.append('commission_rate', String(Number(commissionRate)));
    }
    if (ratePerBag !== '' && ratePerBag !== undefined && ratePerBag !== null) {
      formData.append('price_per_bag', String(ratePerBag));
      formData.append('rate_per_bag', String(ratePerBag));
    }
    if (totalAmount > 0) {
      formData.append('total_value', String(totalAmount));
      formData.append('total_amount', String(totalAmount));
    }
    if (ratePrice > 0) {
      formData.append('rate_price', String(ratePrice));
      formData.append('price', String(ratePrice));
      formData.append('cnf', String(ratePrice));
    }
    if (quantityMt > 0) {
      formData.append('quantity_mt', String(quantityMt));
    }
    if (amountInWords) {
      formData.append('amount_in_words', amountInWords);
    }
    if (disclaimer) {
      formData.append('disclaimer', disclaimer);
    }

    const effectiveNotesTitle = (notesTitle || '').trim() || ((notesComment || '').trim() ? 'Comments' : '');
    const effectiveNotesComment = (notesComment || '').trim();
    formData.append('comment_label', effectiveNotesTitle);
    formData.append('comment_title', effectiveNotesTitle);
    formData.append('notes_title', effectiveNotesTitle);
    formData.append('comment_value', effectiveNotesComment);
    formData.append('comment_text', effectiveNotesComment);
    formData.append('notes_comment', effectiveNotesComment);
    formData.append('comment', effectiveNotesComment);

    // SIGNATURE IMPLEMENTATION - MATCHING CONTRACT & PROFORMA
    const cleanAuthTitle = (authoritySignatureTitle || 'AUTHORITY SIGNATURE').trim();
    formData.append('authority_signature_title', cleanAuthTitle);
    formData.append('authorised_signature_title', cleanAuthTitle);
    formData.append('seller_signature_label', cleanAuthTitle);
    formData.append('seller_signature_field', safeString(sellerName, 'SELLER / EXPORTER'));

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
          formData.append('seller_signature', relUrl);
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
    cleanSelfId,
    draftId,
    effectiveCustomInvoiceId,
    isCandidateValid,
    customDocTitle,
    watermarkEnabled,
    invoiceNumber,
    invoiceDate,
    registrationNumber,
    grossWeight,
    selectedBankId,
    bankAccountDetails,
    fobRate,
    freightRate,
    commissionRate,
    ratePerBag,
    stampImageUrl,
    authoritySignatureTitle,
    sellerName,
    disclaimer,
    notesTitle,
    notesComment,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
    totalAmount,
    ratePrice,
    quantityMt,
    amountInWords,
  ]);

  // Payload Construction (All fields optional - no client blocking)
  const constructPayload = useCallback(() => {
    const activeDocId = cleanSelfId || (isCandidateValid(draftId) ? draftId : undefined) || (isCandidateValid(effectiveCustomInvoiceId) ? effectiveCustomInvoiceId : undefined);
    const effectiveTitle = (customDocTitle || '').trim() || 'CUSTOM INVOICE';
    return {
      custom_invoice_id: activeDocId,
      id: activeDocId,
      pdf_title: effectiveTitle,
      document_title: effectiveTitle,
      custom_doc_title: effectiveTitle,
      is_watermark_enabled: Boolean(watermarkEnabled),
      watermark: Boolean(watermarkEnabled),
      watermark_enabled: Boolean(watermarkEnabled),
      invoice_number: invoiceNumber,
      invoice_no: invoiceNumber,
      invoice_date: invoiceDate,
      registration_number: registrationNumber || undefined,
      gross_weight: grossWeight,
      bank_details_id: selectedBankId || undefined,
      bank_account_id: selectedBankId || undefined,
      bank_details: bankAccountDetails || undefined,
      fob_rate: fobRate !== '' && !isNaN(Number(fobRate)) ? Number(fobRate) : undefined,
      freight_rate: freightRate !== '' && !isNaN(Number(freightRate)) ? Number(freightRate) : undefined,
      commission_rate: commissionRate !== '' && !isNaN(Number(commissionRate)) ? Number(commissionRate) : undefined,
      price_per_bag: ratePerBag !== '' && !isNaN(Number(ratePerBag)) ? Number(ratePerBag) : (ratePerBag || undefined),
      rate_per_bag: ratePerBag !== '' && !isNaN(Number(ratePerBag)) ? Number(ratePerBag) : (ratePerBag || undefined),
      seller_signature: stampImageUrl ? (normalizeSignaturePayload(stampImageUrl) || stampImageUrl) : undefined,
      seller_signature_url: stampImageUrl ? (normalizeSignaturePayload(stampImageUrl) || stampImageUrl) : undefined,
      authority_signature_title: authoritySignatureTitle,
      disclaimer: disclaimer || undefined,
      title: (notesTitle || '').trim() || ((notesComment || '').trim() ? 'Comments' : ''),
      extra_title: (notesTitle || '').trim() || ((notesComment || '').trim() ? 'Comments' : ''),
      notes_title: (notesTitle || '').trim() || ((notesComment || '').trim() ? 'Comments' : ''),
      comment_title: (notesTitle || '').trim() || ((notesComment || '').trim() ? 'Comments' : ''),
      comment_label: (notesTitle || '').trim() || ((notesComment || '').trim() ? 'Comments' : ''),
      comment: (notesComment || '').trim(),
      extra_comment: (notesComment || '').trim(),
      notes_comment: (notesComment || '').trim(),
      comment_value: (notesComment || '').trim(),
      comment_text: (notesComment || '').trim(),
      shipment_instruction_id: shipmentInstructionId || undefined,
      proforma_id: proformaId || undefined,
      contract_id: contractId || undefined,
      confirmation_id: confirmationId || undefined,
      total_value: totalAmount > 0 ? totalAmount : undefined,
      total_amount: totalAmount > 0 ? totalAmount : undefined,
      rate_price: ratePrice > 0 ? ratePrice : undefined,
      price: ratePrice > 0 ? ratePrice : undefined,
      cnf: ratePrice > 0 ? ratePrice : undefined,
      quantity_mt: quantityMt > 0 ? quantityMt : undefined,
      amount_in_words: amountInWords || undefined,
    };
  }, [
    cleanSelfId,
    draftId,
    effectiveCustomInvoiceId,
    isCandidateValid,
    customDocTitle,
    watermarkEnabled,
    invoiceNumber,
    invoiceDate,
    registrationNumber,
    grossWeight,
    selectedBankId,
    bankAccountDetails,
    fobRate,
    freightRate,
    commissionRate,
    ratePerBag,
    stampImageUrl,
    authoritySignatureTitle,
    disclaimer,
    notesTitle,
    notesComment,
    shipmentInstructionId,
    proformaId,
    contractId,
    confirmationId,
    totalAmount,
    ratePrice,
    quantityMt,
    amountInWords,
  ]);

  // Save As Draft Handler (NO client-side validation)
  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting || readOnly) return;
    setIsSavingDraft(true);
    setErrors({});

    try {
      const formDataPayload = getCustomInvoiceFormData();
      const activeId = cleanSelfId || (isCandidateValid(draftId) ? draftId : '') || effectiveCustomInvoiceId;
      let res: any;

      if (onSaveDraft) {
        res = await onSaveDraft(formDataPayload);
      } else {
        res = await saveCustomInvoiceDraftAction(formDataPayload, lang, activeId || undefined);
      }

      if (res?.success) {
        const savedId = res?.id || res?.data?.id || res?.data?.custom_invoice_id || res?.data?.invoice_id || activeId;
        if (savedId && isCandidateValid(String(savedId))) {
          const cleanSavedId = String(savedId);
          setDraftId(cleanSavedId);
          isDraftSavedToBackendRef.current = true;
          setHasDraftChanges(false);
          setHasSubmitChanges(true);
          setIsDirty(false);
          if (onSaveSuccess) onSaveSuccess(cleanSavedId, res?.data);
          if (onUpdateSteps && steps && steps.length > 0) {
            onUpdateSteps(
              steps.map((s) =>
                isCustomInvoiceStep(s)
                  ? { ...s, redirect_id: cleanSavedId, redirectId: cleanSavedId, status: s.status || 'draft' }
                  : s
              )
            );
          }
        }
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

        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(true);
        toast.success(res?.message || 'Custom invoice saved as draft!');
      } else {
        const { fieldErrors, generalError } = parseCustomInvoiceBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusCustomInvoiceField(fieldErrors);
          toast.error('Please check highlighted fields.');
          return;
        }
        const isGenericOrFieldToken = (str?: string | null): boolean => {
          const s = String(str || '').trim();
          return (
            !s ||
            /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
            /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
            /<(!DOCTYPE|html)/i.test(s) ||
            /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
            /^(not found|bad gateway|service unavailable)$/i.test(s) ||
            /^[a-z0-9_.-]+$/i.test(s) ||
            s.toLowerCase().includes('should not be empty') ||
            s.toLowerCase().includes('must be')
          );
        };
        const errorToast =
          (generalError && !isGenericOrFieldToken(generalError) ? generalError : null) ||
          (res?.message && !isGenericOrFieldToken(res.message) ? res.message : null) ||
          (res?.error && !isGenericOrFieldToken(res.error) ? res.error : null) ||
          'Failed to save custom invoice draft. Please check highlighted fields.';
        toast.error(errorToast);
      }
    } catch (err: any) {
      const { fieldErrors, generalError } = parseCustomInvoiceBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusCustomInvoiceField(fieldErrors);
        toast.error('Please check highlighted fields.');
        return;
      }
      const isGenericOrFieldToken = (str?: string | null): boolean => {
        const s = String(str || '').trim();
        return (
          !s ||
          /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
          /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
          /<(!DOCTYPE|html)/i.test(s) ||
          /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
          /^(not found|bad gateway|service unavailable)$/i.test(s) ||
          /^[a-z0-9_.-]+$/i.test(s) ||
          s.toLowerCase().includes('should not be empty') ||
          s.toLowerCase().includes('must be')
        );
      };
      const errorToast =
        (generalError && !isGenericOrFieldToken(generalError) ? generalError : null) ||
        (err?.message && !isGenericOrFieldToken(err.message) ? err.message : null) ||
        'Error occurred while saving draft. Please check highlighted fields.';
      toast.error(errorToast);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit Handler (NO client-side validation)
  const handleSubmit = async () => {
    if (isSubmitting || isSavingDraft || readOnly) return;

    const submitTargetInfo = getWorkflowSubmitButtonInfo({
      steps,
      currentStep: selectedStep,
      currentStepType: 'custom_invoice',
      isSubmitting: false,
      defaultSubmitText: dict?.smart_docs?.submit || 'Submit',
    });
    const targetNextStep = submitTargetInfo.nextStep;
    const targetNextStepName = submitTargetInfo.nextStepName;

    setIsSubmitting(true);
    setErrors({});

    try {
      const formDataPayload = getCustomInvoiceFormData();
      const activeId = cleanSelfId || (isCandidateValid(draftId) ? draftId : '') || effectiveCustomInvoiceId;
      let res: any;

      if (onSubmitInvoice) {
        res = await onSubmitInvoice(formDataPayload, activeId || undefined, targetNextStep);
      } else {
        res = await submitCustomInvoiceAction(formDataPayload, lang, activeId || undefined);
      }

      if (res?.success) {
        const savedId = res?.id || res?.data?.id || res?.data?.custom_invoice_id || res?.data?.invoice_id || activeId;
        if (savedId && isCandidateValid(String(savedId))) {
          const cleanSavedId = String(savedId);
          setDraftId(cleanSavedId);
          isDraftSavedToBackendRef.current = true;
          setDocStatus('COMPLETED');
          setHasDraftChanges(false);
          setHasSubmitChanges(false);
          setIsDirty(false);
          if (onSaveSuccess) onSaveSuccess(cleanSavedId, res?.data);
        }
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

        setDocStatus('COMPLETED');
        setIsDirty(false);
        setHasDraftChanges(false);
        setHasSubmitChanges(false);
        const successToast = getWorkflowSubmitToastMessage({
          currentDocName: 'Custom invoice',
          nextStepName: targetNextStepName,
        });
        toast.success(successToast);

        if (targetNextStep && onSelectStep && !onSubmitInvoice) {
          onSelectStep(targetNextStep);
        }
      } else {
        const { fieldErrors, generalError } = parseCustomInvoiceBackendErrors(res);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          scrollToAndFocusCustomInvoiceField(fieldErrors);
          toast.error('Please check highlighted fields.');
          return;
        }
        const isGenericOrFieldToken = (str?: string | null): boolean => {
          const s = String(str || '').trim();
          return (
            !s ||
            /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
            /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
            /<(!DOCTYPE|html)/i.test(s) ||
            /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
            /^(not found|bad gateway|service unavailable)$/i.test(s) ||
            /^[a-z0-9_.-]+$/i.test(s) ||
            s.toLowerCase().includes('should not be empty') ||
            s.toLowerCase().includes('must be')
          );
        };
        const errorToast =
          (generalError && !isGenericOrFieldToken(generalError) ? generalError : null) ||
          (res?.message && !isGenericOrFieldToken(res.message) ? res.message : null) ||
          (res?.error && !isGenericOrFieldToken(res.error) ? res.error : null) ||
          'Failed to submit custom invoice. Please check highlighted fields.';
        toast.error(errorToast);
      }
    } catch (err: any) {
      const { fieldErrors, generalError } = parseCustomInvoiceBackendErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        scrollToAndFocusCustomInvoiceField(fieldErrors);
        toast.error('Please check highlighted fields.');
        return;
      }
      const isGenericOrFieldToken = (str?: string | null): boolean => {
        const s = String(str || '').trim();
        return (
          !s ||
          /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
          /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
          /<(!DOCTYPE|html)/i.test(s) ||
          /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
          /^(not found|bad gateway|service unavailable)$/i.test(s) ||
          /^[a-z0-9_.-]+$/i.test(s) ||
          s.toLowerCase().includes('should not be empty') ||
          s.toLowerCase().includes('must be')
        );
      };
      const errorToast =
        (generalError && !isGenericOrFieldToken(generalError) ? generalError : null) ||
        (err?.message && !isGenericOrFieldToken(err.message) ? err.message : null) ||
        'Error occurred while submitting custom invoice. Please check highlighted fields.';
      toast.error(errorToast);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Print Preview Handler (Auto-saves draft first if unsaved or dirty)
  const handleOpenPrintPreview = async () => {
    let effectiveId =
      draftId ||
      cleanSelfId ||
      effectiveCustomInvoiceId ||
      shipmentInstructionId ||
      proformaId ||
      contractId ||
      confirmationId;
    if (!effectiveId || isDirty || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getCustomInvoiceFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await saveCustomInvoiceDraftAction(formDataPayload, lang, effectiveId || undefined);
        }
        if (res?.success) {
          const newId = res?.id || res?.data?.id || res?.data?.custom_invoice_id || res?.data?.invoice_id;
          if (newId && isCandidateValid(String(newId))) {
            const cleanNewId = String(newId);
            setDraftId(cleanNewId);
            effectiveId = cleanNewId;
            isDraftSavedToBackendRef.current = true;
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            setIsDirty(false);
            if (onSaveSuccess) onSaveSuccess(cleanNewId, res.data);
            if (onUpdateSteps && steps && steps.length > 0) {
              onUpdateSteps(
                steps.map((s) =>
                  isCustomInvoiceStep(s)
                    ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                    : s
                )
              );
            }
          }
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
        }
      } catch (saveErr) {
        console.warn('[CustomInvoiceDocumentForm] Auto-save before preview failed:', saveErr);
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

  // Download PDF Handler (Auto-saves draft first if unsaved or dirty)
  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    let activeId =
      draftId ||
      cleanSelfId ||
      effectiveCustomInvoiceId ||
      shipmentInstructionId ||
      proformaId ||
      contractId ||
      confirmationId;
    if (!activeId || isDirty || hasDraftChanges || !isDraftSavedToBackendRef.current) {
      setIsSavingDraft(true);
      try {
        const formDataPayload = getCustomInvoiceFormData();
        let res: any;
        if (onSaveDraft) {
          res = await onSaveDraft(formDataPayload);
        } else {
          res = await saveCustomInvoiceDraftAction(formDataPayload, lang, activeId || undefined);
        }
        if (res?.success) {
          const newId = res?.id || res?.data?.id || res?.data?.custom_invoice_id || res?.data?.invoice_id;
          if (newId && isCandidateValid(String(newId))) {
            const cleanNewId = String(newId);
            setDraftId(cleanNewId);
            activeId = cleanNewId;
            isDraftSavedToBackendRef.current = true;
            setHasDraftChanges(false);
            setHasSubmitChanges(true);
            setIsDirty(false);
            if (onSaveSuccess) onSaveSuccess(cleanNewId, res.data);
            if (onUpdateSteps && steps && steps.length > 0) {
              onUpdateSteps(
                steps.map((s) =>
                  isCustomInvoiceStep(s)
                    ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                    : s
                )
              );
            }
          }
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
        }
      } catch (saveErr) {
        console.warn('[CustomInvoiceDocumentForm] Auto-save before download failed:', saveErr);
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
        prefix: 'custom_invoice',
        id: activeId,
        candidateIds: [
          activeId,
          draftId,
          cleanSelfId,
          effectiveCustomInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x && isCandidateValid(x))),
        lang,
        customInvoiceId: activeId,
        shipmentInstructionId,
        proformaId,
        contractId,
        confirmationId,
      });

      if (res.success) {
        downloadPdfFromActionResponse(res, `custom-invoice-${invoiceNumber || activeId}.pdf`);
        toast.success('Custom invoice PDF downloaded successfully!');
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
      currentStepType: 'custom_invoice',
      isSubmitting,
      submittingText: dict?.smart_docs?.submitting || 'Submitting...',
      defaultSubmitText: dict?.smart_docs?.custom_invoice_form?.submit || dict?.smart_docs?.submit || 'Submit',
    });
  }, [steps, selectedStep, isSubmitting, dict]);

  return (
    <div
      id="custom-invoice-form-card"
      onInput={markDirty}
      onChange={markDirty}
      className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl relative border border-border shadow-xs"
    >
      {/* Scrollable Viewport */}
      <div className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-scroll lg:overscroll-contain custom-scrollbar">
        {/* ========================================================
            TOP HEADER BAR:
            - Left: Balanced Spacer
            - Center: Title "CUSTOM INVOICE" with pencil & dotted underline
            - Right: Watermark Toggle
           ======================================================== */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 bg-card">
          {/* Left: Balanced spacer */}
          <div className="hidden sm:block shrink-0 sm:w-[140px]" />

          {/* Center: Title "CUSTOM INVOICE" with pencil & dotted underline */}
          <DocTitleInput
            value={customDocTitle}
            onChange={(val) => {
              markDirty();
              setCustomDocTitle(val);
              setErrors((prev) => ({
                ...prev,
                documentTitle: '',
                document_title: '',
                pdf_title: '',
                custom_doc_title: '',
                title: '',
              }));
            }}
            disabled={readOnly}
            placeholder="CUSTOM INVOICE"
            ariaLabel="Document Title"
            error={
              errors.documentTitle ||
              errors.document_title ||
              errors.pdf_title ||
              errors.custom_doc_title ||
              errors.title
            }
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
              <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                <span className="text-brand-red">
                  {errors.is_watermark_enabled || errors.watermark_enabled || errors.watermark}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* ========================================================
            ROW 1: EXPORTER & CONSIGNEE (Left) / INVOICE DETAILS (Right)
            Exact match with Canva Mockup (Screenshot 1)
           ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border border-b border-border bg-card">
          {/* LEFT 5 COLUMNS: EXPORTER / SELLER & CONSIGNEE / BUYER STACKED */}
          <div className="md:col-span-5 flex flex-col divide-y divide-border">
            {/* EXPORTER / SELLER (DISPLAY ONLY) - User requirement: only seller_details.instruction */}
            <div className="p-3 sm:p-4 flex flex-col gap-1.5 justify-start bg-card flex-1 min-h-[140px]">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                EXPORTER / SELLER:
              </div>
              <div className="text-[13px] sm:text-[14px] font-medium text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed">
                {sellerInstructionText || '-'}
              </div>
            </div>

            {/* CONSIGNEE / BUYER (DISPLAY ONLY) - User requirement: consignee_details */}
            <div className="p-3 sm:p-4 flex flex-col gap-1.5 justify-start bg-card flex-1 min-h-[140px]">
              <div className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider px-0.5">
                CONSIGNEE / BUYER:
              </div>
              <div className="text-[13px] sm:text-[14px] font-medium text-foreground uppercase tracking-wide px-0.5 whitespace-pre-line leading-relaxed">
                {consigneeDetailsValue || '-'}
              </div>
            </div>
          </div>

          {/* RIGHT 7 COLUMNS: INVOICE DETAILS (6 SUB-ROWS) */}
          <div className="md:col-span-7 flex flex-col divide-y divide-border bg-card">
            {/* Merged Block: INVOICE NO (Top Left) & INVOICE DATE (Bottom Left) + GST NUMBER (Right - vertically centered spanning both rows) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {/* Left Column (sm:col-span-8): INVOICE NO on top, INVOICE DATE underneath */}
              <div className="sm:col-span-8 flex flex-col divide-y divide-border">
                {/* Row 1: INVOICE NO */}
                <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[42px]" id="field-invoice_number" data-field="invoice_number">
                  <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                    INVOICE NO:
                  </span>
                  <div className="flex-1 min-w-0">
                    <DocUnderlineInput
                      id="field-invoice-number-input"
                      name="invoice_number"
                      value={invoiceNumber}
                      onChange={(val) => {
                        markDirty();
                        setInvoiceNumber(val);
                        setErrors((prev) => ({ ...prev, invoice_number: '', invoice_no: '' }));
                      }}
                      placeholder="Enter Invoice No"
                      icon="fa-solid fa-pencil"
                      disabled={readOnly}
                      error={errors.invoice_number || errors.invoice_no}
                      inputClassName="text-[14px] font-semibold text-foreground uppercase tracking-wide"
                    />
                  </div>
                </div>

                {/* Row 2: INVOICE DATE with Calendar Icon */}
                <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[42px]" id="field-invoice_date" data-field="invoice_date">
                  <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                    INVOICE DATE:
                  </span>
                  <div className="flex-1 min-w-0">
                    <DocUnderlineInput
                      id="field-invoice-date-input"
                      name="invoice_date"
                      type="date"
                      value={invoiceDate}
                      onChange={(val) => {
                        markDirty();
                        setInvoiceDate(val);
                        setErrors((prev) => ({ ...prev, invoice_date: '', date: '' }));
                      }}
                      disabled={readOnly}
                      icon="fa-regular fa-calendar-days"
                      error={errors.invoice_date || errors.date}
                      inputClassName="text-[14px] font-semibold text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column (sm:col-span-4): REGISTRATION NUMBER top-aligned with stacked label and wrapped value */}
              <div className="sm:col-span-4 p-2 sm:p-2.5 flex flex-col items-start justify-start gap-1 min-w-0 overflow-hidden" id="field-registration_number" data-field="registration_number">
                <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider leading-tight px-0.5">
                  REGISTRATION NUMBER:
                </span>
                <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase break-words break-all leading-relaxed px-0.5">
                  {registrationNumber || '-'}
                </span>
              </div>
            </div>

            {/* Sub-row 3: BUYER'S ORDER NO & DATE (DISPLAY ONLY) */}
            <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]">
              <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                BUYER&apos;S ORDER NO &amp; DATE:
              </span>
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase truncate px-0.5">
                {buyerOrderNoAndDate}
              </span>
            </div>

            {/* Sub-row 4: PURCHASE ORDER NO (DISPLAY ONLY) */}
            <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]">
              <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                PURCHASE ORDER NO:
              </span>
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase px-0.5">
                {purchaseOrderNo}
              </span>
            </div>

            {/* Sub-row 5: CONTRACT DATE (DISPLAY ONLY) */}
            <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]">
              <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                CONTRACT DATE:
              </span>
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase px-0.5">
                {contractDate}
              </span>
            </div>

            {/* Sub-row 6: OTHER REFERENCE (S) (DISPLAY ONLY) */}
            <div className="p-2 sm:p-2.5 flex items-center gap-2 min-h-[40px]">
              <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0 px-0.5">
                OTHER REFERENCE (S):
              </span>
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase px-0.5">
                {otherReferences}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 2: NOTIFY PARTIES (1 OR 2 ROWS OF 3 COLUMNS EACH)
            - 1st row: Notify Party 1, 2, 3
            - 2nd row: Notify Party 4, 5, 6 (Shown when 4th to 6th party exists)
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          {/* First Row: 1 to 3 */}
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
          {hasSecondRowNotify && (
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
            ROW 3: SHIPPING & ORIGIN (4 COLUMNS - DISPLAY ONLY)
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
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

          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border bg-card">
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {preCarriageBy}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {placeOfReceipt}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {countryOfOrigin}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {countryOfDestination}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 4: VOYAGE, LOADING, DELIVERY & PAYMENT (3 COLUMNS)
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              VESSEL / VOYAGE NO.
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              PORT OF LOADING
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              TERMS OF DELIVERY &amp; PAYMENT
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {vesselVoyageNo}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {portOfLoading}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                {termsOfDeliveryPayment}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 5: DESTINATION PORTS (2 COLUMNS - DISPLAY ONLY)
           ======================================================== */}
        <div className="border-b border-border flex flex-col divide-y divide-border">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border bg-muted/20">
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              PORT OF DESTINATION
            </div>
            <div className="p-2 sm:p-2.5 text-center font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
              FINAL DESTINATION
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                {portOfDestination}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 text-center min-h-[40px] flex items-center justify-center">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase whitespace-pre-line leading-relaxed">
                {finalDestination}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 6 & 7: GOODS TABLE + AMOUNT IN WORDS + BANK & SIGNATURE
            Placed inside a single <table> with table-fixed & colgroup so:
            Col 1: 14% (COUNT / VESSEL)
            Col 2: 46% (DESCRIPTIONS OF GOODS AND SERVICES)
            => Subtotal Left: 60%
            Col 3: 13% (QUANTITY IN MT)
            Col 4: 13% (INR CNF)
            Col 5: 14% (AMOUNT IN INR)
            => Subtotal Right: 40%

            Because:
            - Product items use individual cols (1..5)
            - Amount in Words (colSpan 2 = 60%) & Total (colSpan 3 = 40%)
            - Bank & Rate Breakdown (colSpan 2 = 60%) & Signature (colSpan 3 = 40%)
            THE VERTICAL LINE BETWEEN BANK/RATE AND SIGNATURE
            IS PHYSICALLY GUARANTEED TO BE 100% IDENTICAL AND ALIGNED WITH
            THE VERTICAL LINE AFTER DESCRIPTIONS OF GOODS AND SERVICES!
           ======================================================== */}
        <div className="w-full border-b border-border overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse table-fixed text-left min-w-[760px]">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                <th className="py-2.5 px-3 border-r border-border text-left">
                  COUNT / VESSEL
                </th>
                <th className="py-2.5 px-3 border-r border-border text-left">
                  DESCRIPTIONS OF GOODS AND SERVICES
                </th>
                <th className="py-2.5 px-3 border-r border-border text-right">
                  QUANTITY IN MT
                </th>
                <th className="py-2.5 px-3 border-r border-border text-right">
                  {currency} {incoterm}
                </th>
                <th className="py-2.5 px-3 text-right">
                  AMOUNT IN {currency} ({currencySymbol})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Product Row */}
              <tr className="divide-x divide-border bg-card">
                {/* COUNT / VESSEL */}
                <td className="py-3 px-3 align-top text-left">
                  <span className="text-[13px] sm:text-[14px] font-medium text-foreground tracking-wide uppercase">
                    {countVessel}
                  </span>
                </td>

                {/* DESCRIPTIONS OF GOODS AND SERVICES */}
                <td className="py-3 px-3 align-top text-left">
                  <div className="flex flex-col gap-1 text-[13px] sm:text-[14px] text-foreground">
                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">PRODUCT NAME: </span>
                      <span className="font-medium text-foreground uppercase">{productName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">HSN CODE: </span>
                      <span className="font-medium text-foreground uppercase">{hsnCode}</span>
                    </div>
                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">PACKING TYPE: </span>
                      <span className="font-medium text-foreground uppercase">{packingType}</span>
                    </div>
                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">TOTAL BAGS: </span>
                      <span className="font-medium text-foreground uppercase">{totalBags}</span>
                    </div>
                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">MARKING BRAND: </span>
                      <span className="font-medium text-foreground uppercase">{markingBrand}</span>
                    </div>

                    {/* GROSS WEIGHT (EDITABLE INPUT WITH PENCIL) */}
                    <div className="flex items-center gap-2 pt-1 pb-0.5" id="field-gross_weight" data-field="gross_weight">
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider shrink-0">GROSS WEIGHT :</span>
                      <div className="w-36 inline-block">
                        <DocUnderlineInput
                          id="field-gross-weight-input"
                          name="gross_weight"
                          align="right"
                          value={grossWeight}
                          onChange={(val) => {
                            markDirty();
                            setGrossWeight(val);
                            setErrors((prev) => ({ ...prev, gross_weight: '' }));
                          }}
                          disabled={readOnly}
                          placeholder="0.000"
                          icon="fa-solid fa-pencil"
                          error={errors.gross_weight}
                          inputClassName="text-[14px] font-semibold text-foreground text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">NET WEIGHT: </span>
                      <span className="font-medium text-foreground uppercase">{netWeight}</span>
                    </div>
                    <div>
                      <span className="font-bold text-muted-foreground/85 uppercase text-[13px] sm:text-[14px] tracking-wider">EMPTY BAGS: </span>
                      <span className="font-medium text-foreground uppercase">{emptyBags}</span>
                    </div>
                    <div className="pt-2 font-bold text-muted-foreground/90 uppercase text-[13px] sm:text-[14px] tracking-wide">
                      {toleranceClause}
                    </div>
                  </div>
                </td>

                {/* QUANTITY IN MT */}
                <td className="py-3 px-3 align-top text-right">
                  <span className="font-semibold text-[13px] sm:text-[14px] text-foreground tracking-wide tabular-nums">
                    {formatNumberWithCommas(quantityMt)}
                  </span>
                </td>

                {/* RATE */}
                <td className="py-3 px-3 align-top text-right">
                  <span className="font-semibold text-[13px] sm:text-[14px] text-foreground tracking-wide tabular-nums">
                    {currencySymbol} {formatCurrencyAmount(ratePrice, 2, currency)}
                  </span>
                </td>

                {/* AMOUNT */}
                <td className="py-3 px-3 align-top text-right">
                  <span className="font-bold text-[13px] sm:text-[14px] text-foreground tracking-wide tabular-nums">
                    {currencySymbol} {formatCurrencyAmount(totalAmount, 2, currency)}
                  </span>
                </td>
              </tr>

              {/* Amount In Words & Total Row */}
              <tr className="divide-x divide-border bg-card">
                <td colSpan={2} className="p-3 align-top">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                    <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0">
                      AMOUNT IN WORDS:
                    </span>
                    <span className="font-medium text-[13px] sm:text-[14px] text-foreground uppercase tracking-wide">
                      {amountInWords}
                    </span>
                  </div>
                </td>

                <td colSpan={2} className="p-3 align-middle text-right font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider pr-4 bg-muted/10">
                  TOTAL
                </td>

                <td className="p-3 align-middle text-right bg-muted/10">
                  <span className="font-bold text-[14px] sm:text-[15px] text-foreground tracking-wide tabular-nums">
                    {currencySymbol} {formatCurrencyAmount(totalAmount, 2, currency)}
                  </span>
                </td>
              </tr>

              {/* BANK DETAILS & RATE BREAKDOWN (colSpan={2} = 60%) vs SIGNATURE BOX & DISCLAIMER (colSpan={3} = 40%) */}
              <tr className="divide-x divide-border bg-card">
                {/* Left Side (colSpan={2}): Select Bank Account, Rate Breakdown Table, Rate per Bopp Bag */}
                <td colSpan={2} className="align-top p-0">
                  <div className="flex flex-col divide-y divide-border">
                    {/* Bank Account Dropdown & Details */}
                    <div className="p-3 sm:p-3.5 flex flex-col gap-2" id="field-selectedBankId" data-field="selectedBankId">
                      <div className="w-full">
                        <DocUnderlineSelect
                          options={bankSelectOptions}
                          value={selectedBankId}
                          onChange={(val) => {
                            markDirty();
                            setSelectedBankId(val);
                            setErrors((prev) => ({
                              ...prev,
                              selectedBankId: '',
                              bank_details_id: '',
                              bank_account_id: '',
                            }));

                            const matched = sellerBankAccounts.find(
                              (b: any) =>
                                String(b.bank_details_id || b.id || b._id) === String(val) ||
                                String(b.id) === String(val) ||
                                String(b.bank_details_id) === String(val) ||
                                String(b.bank_account_id) === String(val)
                            );
                            if (matched) {
                              setBankAccountDetails(formatBankDetails(matched));
                            } else {
                              setBankAccountDetails('');
                            }
                          }}
                          disabled={readOnly}
                          error={errors.selectedBankId || errors.bank_details_id || errors.bank_account_id}
                          placeholder="Select Bank Account"
                          className="w-full font-bold text-foreground text-[14px]"
                        />
                      </div>

                      {/* Formatted Bank Account Details Display (NON-INPUT) */}
                      {bankAccountDetails && (
                        <div className="text-[12px] sm:text-[13px] font-medium text-foreground uppercase tracking-wide whitespace-pre-line leading-relaxed pt-1 select-all">
                          {bankAccountDetails}
                        </div>
                      )}
                    </div>

                    {/* Rate Breakdown Table - User requirement: font sizes and accounting column alignment matching perfectly */}
                    <div className="w-full overflow-x-auto">
                      <table className="w-full border-collapse table-fixed text-left min-w-[500px]">
                        <colgroup>
                          <col style={{ width: '34%' }} />
                          <col style={{ width: '38%' }} />
                          <col style={{ width: '28%' }} />
                        </colgroup>
                        <tbody className="divide-y divide-border">
                          {/* Row 1: CNF / Incoterm Rate Value (DISPLAY ONLY) */}
                          <tr className="divide-x divide-border">
                            <td className="py-2.5 px-3 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                              {incoterm || 'CNF'} Rate Value
                            </td>
                            <td className="py-2.5 px-3"></td>
                            <td className="py-2.5 px-3 font-semibold text-[13px] sm:text-[14px] text-foreground text-right tabular-nums">
                              {currencySymbol} {formatCurrencyAmount(totalAmount, 2, currency)}
                            </td>
                          </tr>

                          {/* Row 2: FOB Rate (NUMBER INPUT) */}
                          <tr className="divide-x divide-border" id="field-fob_rate" data-field="fob_rate">
                            <td className="py-2 px-3 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                              FOB Rate
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                                <span className="font-medium text-[13px] sm:text-[14px] text-foreground">{currencySymbol}</span>
                                <div className="w-24 shrink-0">
                                  <DocUnderlineInput
                                    type="number"
                                    step="any"
                                    min="0"
                                    align="right"
                                    value={fobRate}
                                    onChange={(val) => {
                                      markDirty();
                                      setFobRate(val);
                                      setErrors((prev) => ({ ...prev, fob_rate: '', fob: '' }));
                                    }}
                                    disabled={readOnly}
                                    placeholder="0.00"
                                    icon="fa-solid fa-pencil"
                                    error={errors.fob_rate || errors.fob}
                                    inputClassName="text-[14px] font-semibold text-foreground text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <span className="text-[12px] sm:text-[13px] font-medium text-muted-foreground shrink-0">
                                  X {formatNumberWithCommas(quantityMt)} (MT)
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-[13px] sm:text-[14px] text-foreground tabular-nums">
                              {currencySymbol} {formatCurrencyAmount(calculatedFobAmount, 2, currency)}
                            </td>
                          </tr>

                          {/* Row 3: Freight Rate (NUMBER INPUT) */}
                          <tr className="divide-x divide-border" id="field-freight_rate" data-field="freight_rate">
                            <td className="py-2 px-3 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                              Freight Rate
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                                <span className="font-medium text-[13px] sm:text-[14px] text-foreground">{currencySymbol}</span>
                                <div className="w-24 shrink-0">
                                  <DocUnderlineInput
                                    type="number"
                                    step="any"
                                    min="0"
                                    align="right"
                                    value={freightRate}
                                    onChange={(val) => {
                                      markDirty();
                                      setFreightRate(val);
                                      setErrors((prev) => ({ ...prev, freight_rate: '', freight: '' }));
                                    }}
                                    disabled={readOnly}
                                    placeholder="0.00"
                                    icon="fa-solid fa-pencil"
                                    error={errors.freight_rate || errors.freight}
                                    inputClassName="text-[14px] font-semibold text-foreground text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <span className="text-[12px] sm:text-[13px] font-medium text-muted-foreground shrink-0">
                                  X {formatNumberWithCommas(quantityMt)} (MT)
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-[13px] sm:text-[14px] text-foreground tabular-nums">
                              {currencySymbol} {formatCurrencyAmount(calculatedFreightAmount, 2, currency)}
                            </td>
                          </tr>

                          {/* Row 4: Commission Rate (NUMBER INPUT) */}
                          <tr className="divide-x divide-border" id="field-commission_rate" data-field="commission_rate">
                            <td className="py-2 px-3 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                              Commission Rate
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                                <span className="font-medium text-[13px] sm:text-[14px] text-foreground">{currencySymbol}</span>
                                <div className="w-24 shrink-0">
                                  <DocUnderlineInput
                                    type="number"
                                    step="any"
                                    min="0"
                                    align="right"
                                    value={commissionRate}
                                    onChange={(val) => {
                                      markDirty();
                                      setCommissionRate(val);
                                      setErrors((prev) => ({ ...prev, commission_rate: '', commission: '' }));
                                    }}
                                    disabled={readOnly}
                                    placeholder="0.00"
                                    icon="fa-solid fa-pencil"
                                    error={errors.commission_rate || errors.commission}
                                    inputClassName="text-[14px] font-semibold text-foreground text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <span className="text-[12px] sm:text-[13px] font-medium text-muted-foreground shrink-0">
                                  X {formatNumberWithCommas(quantityMt)} (MT)
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-[13px] sm:text-[14px] text-foreground tabular-nums">
                              {currencySymbol} {formatCurrencyAmount(calculatedCommissionAmount, 2, currency)}
                            </td>
                          </tr>

                          {/* Row 5: Total Breakdown (DISPLAY ONLY) */}
                          <tr className="divide-x divide-border">
                            <td className="py-2.5 px-3 font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider">
                              Total
                            </td>
                            <td className="py-2.5 px-3"></td>
                            <td className="py-2.5 px-3 font-semibold text-[13px] sm:text-[14px] text-foreground text-right tabular-nums">
                              {currencySymbol} {formatCurrencyAmount(calculatedRateTotal, 2, currency)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* RATE PER BAG (NUMBER INPUT) & LIVE CALCULATION / WARNING */}
                    <div
                      className="p-3 sm:p-3.5 flex flex-col gap-2"
                      id="field-price_per_bag"
                      data-field="price_per_bag"
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="font-bold text-muted-foreground/85 uppercase text-[14px] tracking-wider shrink-0">
                          {ratePerLabel}
                        </span>
                        <div className="flex-1 min-w-[120px]">
                          <DocUnderlineInput
                            id="field-price-per-bag-input"
                            name="price_per_bag"
                            type="number"
                            step="any"
                            min="0"
                            align="right"
                            value={ratePerBag}
                            onChange={(val) => {
                              markDirty();
                              setRatePerBag(val);
                              setErrors((prev) => ({
                                ...prev,
                                price_per_bag: '',
                                pricePerBag: '',
                                rate_per_bag: '',
                                rate_bag: '',
                                ratePerBag: '',
                              }));
                            }}
                            disabled={readOnly}
                            placeholder="0.00"
                            icon="fa-solid fa-pencil"
                            error={
                              errors.price_per_bag ||
                              errors.pricePerBag ||
                              errors.rate_per_bag ||
                              errors.rate_bag ||
                              errors.ratePerBag
                            }
                            inputClassName="text-[14px] font-semibold text-foreground text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* Warning if mismatch (Shown in yellow as requested, never blocking validation) */}
                      {isBagTotalMismatch && (
                        <div className="text-amber-600 dark:text-amber-400 font-medium text-[12px] sm:text-[13px] flex items-center gap-1.5 pt-0.5 animate-in fade-in duration-200">
                          <i className="fa-solid fa-triangle-exclamation text-amber-500 shrink-0 text-[12px]" />
                          <span>
                            Bags × Price per bag must equal the total value of {targetTotal.toFixed(2)}.
                          </span>
                        </div>
                      )}

                      {/* Live Calculation: e.g. 32400 BAGS × 240.00 = ₹ 77,76,000.00 */}
                      {parsedRatePerBag > 0 && bagQuantityNum > 0 && (
                        <div className="text-[13px] sm:text-[14px] font-bold text-foreground tabular-nums tracking-wide pt-0.5 flex items-center gap-2">
                          <span>
                            {bagQuantityNum} BAGS × {parsedRatePerBag.toFixed(2)} = {currencySymbol} {formatCurrencyAmount(calculatedBagTotal, 2, currency)}
                          </span>
                          {isBagTotalMatched && (
                            <i className="fa-solid fa-circle-check text-emerald-500 text-[13px]" title="Matches total value" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Right Side (colSpan={3}): Seller Stamp / Signature Box & Authority & Disclaimer */}
                <td colSpan={3} className="align-top p-3 sm:p-4 bg-card">
                  <div className="flex flex-col gap-3 justify-between h-full">
                    {/* DocSignatureBox */}
                    <div className="w-full flex justify-center" id="field-seller_signature" data-field="seller_signature">
                      <DocSignatureBox
                        partyType="exporter"
                        title={sellerName}
                        titleAsText={true}
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
                          }));
                        }}
                        readOnly={readOnly}
                        authorityTitle={authoritySignatureTitle}
                        onAuthorityTitleChange={(val) => {
                          markDirty();
                          setAuthoritySignatureTitle(val);
                        }}
                        authorityPlaceholder="AUTHORITY SIGNATURE"
                        error={errors.seller_signature || errors.sellerSignature}
                      />
                    </div>

                    {/* DISCLAIMER (INPUT) */}
                    <div className="w-full pt-1 flex flex-col gap-1" id="field-disclaimer" data-field="disclaimer">
                      <DocUnderlineInput
                        id="field-disclaimer-input"
                        name="disclaimer"
                        multiline
                        rows={2}
                        value={disclaimer}
                        onChange={(val) => {
                          markDirty();
                          setDisclaimer(val);
                          setErrors((prev) => ({ ...prev, disclaimer: '' }));
                        }}
                        disabled={readOnly}
                        placeholder="Enter Disclaimer"
                        ariaLabel="Disclaimer"
                        icon="fa-solid fa-pencil"
                        error={errors.disclaimer}
                        inputClassName="text-[14px] font-semibold text-foreground resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ========================================================
            ROW 8: BOTTOM FULL-WIDTH ROW: ENTER TITLE & ENTER COMMENT
            Matching 3-column layout (1/3 Title & 2/3 Comment) across Smart Docs forms
           ======================================================== */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border bg-card"
          data-field="commentSection"
        >
          <div
            className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0"
            id="field-notes_title"
            data-field="notes_title"
          >
            <DocUnderlineInput
              id="field-notes_title-input"
              name="comment_label"
              value={notesTitle}
              onChange={(val) => {
                markDirty();
                setNotesTitle(val);
                setErrors((prev) => ({
                  ...prev,
                  title: '',
                  extra_title: '',
                  notes_title: '',
                  comment_label: '',
                  comment_title: '',
                  commentLabel: '',
                }));
              }}
              disabled={readOnly}
              placeholder={
                dict?.smart_docs?.confirmation_form?.enter_title ||
                dict?.smart_docs?.contract_form?.enter_title ||
                'Enter Title'
              }
              icon="fa-solid fa-pen"
              uppercase={false}
              error={
                errors.title ||
                errors.extra_title ||
                errors.notes_title ||
                errors.comment_label ||
                errors.comment_title ||
                errors.commentLabel
              }
              inputClassName="text-[14px] font-semibold text-foreground"
              className="w-full"
            />
          </div>

          <div
            className="py-2.5 px-2.5 sm:px-3 flex items-center min-w-0 md:col-span-2"
            id="field-notes_comment"
            data-field="notes_comment"
          >
            <DocUnderlineInput
              id="field-notes_comment-input"
              name="comment_value"
              value={notesComment}
              onChange={(val) => {
                markDirty();
                setNotesComment(val);
                setErrors((prev) => ({
                  ...prev,
                  comment: '',
                  extra_comment: '',
                  notes_comment: '',
                  comment_value: '',
                  comment_text: '',
                  commentValue: '',
                }));
              }}
              disabled={readOnly}
              placeholder={
                dict?.smart_docs?.confirmation_form?.enter_comment ||
                dict?.smart_docs?.contract_form?.enter_comment ||
                'Enter Comment'
              }
              icon="fa-solid fa-pen"
              uppercase={false}
              error={
                errors.comment ||
                errors.extra_comment ||
                errors.notes_comment ||
                errors.comment_value ||
                errors.comment_text ||
                errors.commentValue
              }
              inputClassName="text-[14px] font-semibold text-foreground"
              className="w-full"
            />
          </div>
        </div>
      </div>
      {/* End of Scrollable Viewport */}

      {/* ========================================================
          STICKY / STATIC FOOTER ACTION BAR
          Exact Match with Proforma, Contract & Confirmation styling
         ======================================================== */}
      <div
        id="custom-invoice-actions-toolbar"
        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl transform-gpu"
      >
        {/* Left Action Buttons: Download PDF & Print Preview */}
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
                ? 'Custom Invoice already submitted'
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
        prefix="custom_invoice"
        docId={draftId || cleanSelfId || effectiveCustomInvoiceId || shipmentInstructionId || proformaId || contractId || confirmationId || ''}
        candidateIds={[
          draftId,
          cleanSelfId,
          effectiveCustomInvoiceId,
          shipmentInstructionId,
          proformaId,
          contractId,
          confirmationId,
        ].filter((x): x is string => Boolean(x && isCandidateValid(x)))}
        customInvoiceId={draftId || cleanSelfId || effectiveCustomInvoiceId}
        shipmentInstructionId={shipmentInstructionId}
        contractId={contractId}
        confirmationId={confirmationId}
        proformaId={proformaId}
        docNumber={invoiceNumber || draftId || cleanSelfId || ''}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}

export default CustomInvoiceDocumentForm;
