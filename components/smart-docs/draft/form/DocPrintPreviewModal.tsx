'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getDocPreviewAction } from '@/app/actions/smart-docs';

export interface DocPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefix?: string;
  docId: string;
  docNumber?: string;
  lang?: string;
  dict?: any;
  candidateIds?: string[];
  contractId?: string;
  confirmationId?: string;
  proformaId?: string;
  shipmentInstructionId?: string;
  customInvoiceId?: string;
  commercialInvoiceId?: string;
  packingListId?: string;
  phytoCertificateId?: string;
  fumigationCertificateId?: string;
  certificateOfOriginId?: string;
  wqCertificateId?: string;
  billOfLadingId?: string;
}

/**
 * Prepares preview HTML from backend:
 * - Injects Calibri webfont and local fallbacks for platforms without Microsoft fonts
 * - Keeps backend HTML, layout, page breaks, and exact font sizes completely intact
 * - Enforces clean A4 print styles for printing
 */
function preparePreviewHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  const calibriAndPrintStyles = `
    <style id="agriguru-preview-calibri">
      @import url('https://fonts.cdnfonts.com/css/calibri-and-calibri-light');

      @font-face {
        font-family: 'Calibri';
        src: local('Calibri'), local('Calibri Regular'), local('Candara'), local('Segoe UI');
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: 'Calibri';
        src: local('Calibri Bold'), local('Segoe UI Bold');
        font-weight: 700;
        font-style: normal;
      }
      @font-face {
        font-family: 'Calibri';
        src: local('Calibri Italic'), local('Segoe UI Italic');
        font-weight: 400;
        font-style: italic;
      }

      /* Base Calibri typography fallback */
      body, table, td, th, p, span, div, h1, h2, h3, h4, h5, h6, input, textarea, select, button {
        font-family: 'Calibri', Candara, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      }

      /* 1. Force entire viewport and root containers to pure white */
      html, body {
        background: #ffffff !important;
        background-color: #ffffff !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        min-height: 100% !important;
      }

      @media screen {
        html {
          background: #ffffff !important;
          background-color: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        body {
          background: #ffffff !important;
          background-color: #ffffff !important;
          margin: 0 auto !important;
          padding: 16px 20px !important;
          max-width: 820px !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          box-sizing: border-box !important;
        }
      }

      @page {
        size: A4 portrait;
        margin: 0mm;
      }

      @media print {
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        html, body {
          background: #ffffff !important;
          background-color: #ffffff !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    </style>
  `;

  // Inject at the very end of <head> so it takes strict precedence over any backend styles
  if (/<\/head>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/head>/i, `${calibriAndPrintStyles}</head>`);
  }

  if (/<head[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<head[^>]*>/i, `$&${calibriAndPrintStyles}`);
  }

  if (/<body[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<body[^>]*>/i, `<head>${calibriAndPrintStyles}</head>$&`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Print Preview</title>
  ${calibriAndPrintStyles}
</head>
<body style="margin: 0 auto; padding: 16px 20px; background: #ffffff;">
  ${rawHtml}
</body>
</html>`;
}

export default function DocPrintPreviewModal({
  isOpen,
  onClose,
  prefix = 'confirmation',
  docId,
  docNumber,
  lang = 'en',
  dict,
  candidateIds,
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
  wqCertificateId,
  billOfLadingId,
}: DocPrintPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const fetchPreview = useCallback(async () => {
    const cleanId = String(docId || '').trim();
    const allCandidateIds = Array.from(
      new Set(
        [
          cleanId,
          ...(candidateIds || []).map((id) => String(id || '').trim()),
          String(certificateOfOriginId || '').trim(),
          String(wqCertificateId || '').trim(),
          String(fumigationCertificateId || '').trim(),
          String(phytoCertificateId || '').trim(),
          String(packingListId || '').trim(),
          String(commercialInvoiceId || '').trim(),
          String(billOfLadingId || '').trim(),
          String(customInvoiceId || '').trim(),
          String(shipmentInstructionId || '').trim(),
          String(proformaId || '').trim(),
          String(contractId || '').trim(),
          String(confirmationId || '').trim(),
        ].filter((id): id is string => Boolean(id && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|fumigation|fumigation-certificate|certificate-of-origin|certificate_of_origin|origin|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(id)))
      )
    );

    if (allCandidateIds.length === 0) {
      setError('Document ID is missing. Please save the document first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await getDocPreviewAction({
        prefix,
        id: cleanId || allCandidateIds[0],
        candidateIds: allCandidateIds,
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
        wqCertificateId,
        lang,
      });

      if (res.success && res.html) {
        setHtmlContent(res.html);
      } else {
        const errorMsg =
          res.message || res.error || 'Failed to fetch document preview template.';
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('[DocPrintPreviewModal] fetch error:', err);
      setError(err?.message || 'Unexpected network error loading preview.');
    } finally {
      setLoading(false);
    }
  }, [prefix, docId, candidateIds, contractId, confirmationId, proformaId, shipmentInstructionId, customInvoiceId, commercialInvoiceId, packingListId, phytoCertificateId, fumigationCertificateId, certificateOfOriginId, wqCertificateId, billOfLadingId, lang]);

  useEffect(() => {
    if (!isOpen) {
      setHtmlContent('');
      setError(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen, docId, fetchPreview]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Direct print through iframe
  const handlePrint = () => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      const win = iframeRef.current.contentWindow;
      win.focus();
      win.print();
    } catch (e) {
      console.warn('[DocPrintPreviewModal] Direct iframe print failed, falling back to popup window', e);
      if (htmlContent) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(preparePreviewHtml(htmlContent));
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 300);
        }
      }
    }
  };

  // Open preview in dedicated new browser tab
  const handleOpenNewTab = () => {
    if (!htmlContent) return;
    try {
      const prepared = preparePreviewHtml(htmlContent);
      const blob = new Blob([prepared], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.error('[DocPrintPreviewModal] Open in new tab error:', e);
    }
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const modalTitle =
    dict?.smart_docs?.[`${prefix}_form`]?.print_preview ||
    dict?.smart_docs?.confirmation_form?.print_preview ||
    'Print Preview';
  const cleanDocNumber = docNumber
    ? (docNumber.startsWith('#') ? docNumber : `#${docNumber}`)
    : '';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Modal Panel: Fitted precisely to document width with no excess empty margins */}
      <div
        className="relative w-full max-w-[850px] h-[90vh] bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border bg-card z-10 gap-2">
          {/* Left: Document Type Icon, Title & Doc Number */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs sm:text-sm shrink-0">
              <i className={prefix === 'contract' ? 'fa-solid fa-file-contract' : 'fa-solid fa-file-invoice'} />
            </span>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
              <h2
                id="doc-preview-modal-title"
                className="text-xs sm:text-sm font-semibold text-muted-foreground truncate"
              >
                {modalTitle}
              </h2>

              {cleanDocNumber && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs sm:text-sm font-bold font-mono bg-primary/10 text-primary border border-primary/25 shadow-2xs tracking-wide">
                  <i className="fa-solid fa-hashtag text-[10px] sm:text-xs opacity-70" />
                  <span>{cleanDocNumber.replace(/^#/, '')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions (Print, Open in New Tab, Close) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !htmlContent}
              title="Print"
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 !text-white shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <i className="fa-solid fa-print text-xs !text-white" />
              <span className="!text-white font-semibold">Print</span>
            </button>

            {/* Open in New Tab Button */}
            <button
              type="button"
              onClick={handleOpenNewTab}
              disabled={loading || !htmlContent}
              title="Open in new window"
              className="w-7 h-7 hidden sm:flex items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer transition-colors"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors ml-0.5"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        </div>

        {/* Modal Body: Direct Full-Height Document Frame */}
        <div className="flex-1 w-full h-full min-h-0 bg-white overflow-hidden relative flex flex-col">
          {/* Loading State */}
          {loading && (
            <div className="m-auto py-12 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2.5">
                <i className="fa-solid fa-circle-notch fa-spin text-lg" />
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-0.5">
                Generating Document Preview...
              </h3>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Fetching rendered print template...
              </p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="m-auto py-8 px-5 max-w-md w-full flex flex-col items-center justify-center text-center bg-card border border-destructive/30 rounded-xl shadow-md">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2.5">
                <i className="fa-solid fa-triangle-exclamation text-lg" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground mb-1">
                Unable to Load Preview
              </h3>
              <p className="text-xs text-muted-foreground mb-3 break-words">
                {error}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary !text-white hover:bg-primary/90 shadow-xs cursor-pointer transition-colors"
                >
                  <i className="fa-solid fa-rotate-right text-xs !text-white" />
                  <span className="!text-white">Retry</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-muted text-foreground cursor-pointer transition-colors"
                >
                  <span>Close</span>
                </button>
              </div>
            </div>
          )}

          {/* Rendered HTML Document Frame */}
          {!loading && !error && htmlContent && (
            <iframe
              ref={iframeRef}
              srcDoc={preparePreviewHtml(htmlContent)}
              title="Document Print Preview"
              className="w-full h-full border-0 block bg-white"
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
