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
}

// Standard A4 width in pixels at 96 DPI (210mm = 794px)
const A4_WIDTH = 794;

/**
 * Prepares preview HTML for clean presentation and printing:
 * - Preserves standard 794px (210mm) A4 printable geometry with 0 margin
 * - Injects UTF-8 meta, zero print margin for exact backend template fit
 * - Eliminates dark viewer backgrounds (#525659, #474c50) from templates
 */
function preparePreviewHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  const printStyles = `
    <style id="agriguru-print-rules">
      @page {
        size: auto;
        margin: 0mm;
      }
      @media print {
        @page {
          size: auto;
          margin: 0mm;
        }
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          zoom: 100% !important;
        }
        * {
          overflow: visible !important;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
      }
      @media screen {
        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
      }
      html, body {
        width: 794px !important;
        max-width: 794px !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #111827 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box !important;
      }
      table {
        box-sizing: border-box !important;
      }
      /* Remove dark grey canvas/pdf backgrounds from backend templates */
      html, body, div, table, tr, td, main, section {
        border-color: #e5e7eb;
      }
      [style*="background-color: #5"], [style*="background-color:#5"],
      [style*="background: #5"], [style*="background:#5"],
      [style*="background-color: #4"], [style*="background-color:#4"],
      [style*="background: #4"], [style*="background:#4"],
      [style*="background-color: rgb(82"], [style*="background-color:rgb(82"],
      [style*="background-color: rgb(71"], [style*="background-color:rgb(71"] {
        background: #ffffff !important;
        background-color: #ffffff !important;
      }
    </style>
  `;

  let processed = rawHtml;
  // If template has dark background hardcoded in body style
  processed = processed.replace(/(<body[^>]*)\bstyle="([^"]*background[^"]*)"/gi, (match, prefix, style) => {
    const cleanedStyle = style.replace(/background(-color)?\s*:\s*[^;]+;?/gi, 'background: #ffffff !important;');
    return `${prefix} style="${cleanedStyle}"`;
  });

  if (/<head[^>]*>/i.test(processed)) {
    if (/<\/head>/i.test(processed)) {
      return processed.replace(/<\/head>/i, `${printStyles}</head>`);
    }
    return processed.replace(/<head[^>]*>/i, `$&${printStyles}`);
  }

  if (/<body[^>]*>/i.test(processed)) {
    return processed.replace(/<body[^>]*>/i, `$&${printStyles}`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Print Preview</title>
  ${printStyles}
</head>
<body style="background: #ffffff !important; width: 794px !important; margin: 0 !important; padding: 0 !important;">
  ${processed}
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
}: DocPrintPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Responsive scaling states:
  // autoScale fits A4_WIDTH (794px) into available canvas width on mobile/tablet/narrow screens
  const [autoScale, setAutoScale] = useState<number>(1);
  const [userZoom, setUserZoom] = useState<number>(100);
  const [isManualZoom, setIsManualZoom] = useState<boolean>(false);
  const [contentHeight, setContentHeight] = useState<number>(1123); // Default A4 297mm height

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is active to prevent backdrop scroll thrashing
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
    if (!cleanId) {
      setError('Document ID is missing. Please save the document first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await getDocPreviewAction({
        prefix,
        id: cleanId,
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
  }, [prefix, docId, lang]);

  // Dynamic responsive auto-fit scale calculation
  const updateScale = useCallback(() => {
    if (!canvasRef.current) return;
    const canvasWidth = canvasRef.current.clientWidth;
    if (!canvasWidth) return;

    // Equal padding on left & right:
    // Mobile (< 640px): 12px each side = 24px total padding
    // Desktop: 20px each side = 40px total padding
    const padding = canvasWidth < 640 ? 24 : 40;
    const availableWidth = Math.max(100, canvasWidth - padding);

    if (availableWidth < A4_WIDTH) {
      const fit = availableWidth / A4_WIDTH;
      setAutoScale(fit);
    } else {
      setAutoScale(1);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHtmlContent('');
      setError(null);
      setIsManualZoom(false);
      setUserZoom(100);
      setAutoScale(1);
      return;
    }

    updateScale();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvasRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateScale();
      });
      resizeObserver.observe(canvasRef.current);
    }

    const onWinResize = () => updateScale();
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
    };
  }, [isOpen, updateScale]);

  useEffect(() => {
    if (isOpen && docId) {
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

  // Measure exact content height from iframe
  const measureHeight = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        // Enforce pure white background & remove any dark blocks
        const allElements = doc.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const bg = window.getComputedStyle(htmlEl).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
              const [, r, g, b] = match.map(Number);
              if (r < 110 && g < 110 && b < 110) {
                htmlEl.style.backgroundColor = '#ffffff';
                htmlEl.style.background = '#ffffff';
              }
            }
          }
        });

        if (doc.documentElement) {
          doc.documentElement.style.background = '#ffffff';
          doc.documentElement.style.backgroundColor = '#ffffff';
          doc.documentElement.style.width = `${A4_WIDTH}px`;
        }
        if (doc.body) {
          doc.body.style.background = '#ffffff';
          doc.body.style.backgroundColor = '#ffffff';
          doc.body.style.width = `${A4_WIDTH}px`;
          doc.body.style.margin = '0';
          doc.body.style.padding = '0';
        }

        const measured = Math.max(
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          doc.body?.offsetHeight || 0,
          doc.documentElement?.offsetHeight || 0
        );

        if (measured > 150) {
          setContentHeight(measured);
        }
      }
    } catch (e) {
      console.warn('[DocPrintPreviewModal] height measurement error:', e);
    }
  }, []);

  const handleIframeLoad = () => {
    measureHeight();
    setTimeout(measureHeight, 200);
    setTimeout(measureHeight, 600);
  };

  // Print document through iframe
  const handlePrint = () => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      const win = iframeRef.current.contentWindow;
      const doc = iframeRef.current.contentDocument || win.document;
      if (doc) {
        if (doc.documentElement) {
          doc.documentElement.style.overflow = 'visible';
          doc.documentElement.style.height = 'auto';
          doc.documentElement.style.width = '100%';
        }
        if (doc.body) {
          doc.body.style.overflow = 'visible';
          doc.body.style.height = 'auto';
          doc.body.style.width = '100%';
        }
      }
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
          setTimeout(() => win.print(), 250);
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
    dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview';
  const cleanDocNumber = docNumber
    ? (docNumber.startsWith('#') ? docNumber : `#${docNumber}`)
    : '';

  // Effective scale calculation:
  // If user zoomed manually, use userZoom / 100
  // Otherwise, use autoScale (fits 100% on desktop, scales down proportionally on mobile/narrow windows)
  const effectiveScale = isManualZoom ? userZoom / 100 : autoScale;
  const currentZoomPercent = Math.round(effectiveScale * 100);

  const scaledWidth = Math.round(A4_WIDTH * effectiveScale);
  const scaledHeight = Math.round(contentHeight * effectiveScale);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-modal-title"
      className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-6 bg-black/75 animate-in fade-in duration-150 isolate"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[88vh] bg-card text-foreground border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact, Clean Header Bar */}
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-card z-10">
          {/* Left: Highlighted Confirmation Number & Title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs sm:text-sm shrink-0">
              <i className="fa-solid fa-file-invoice" />
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

          {/* Right: Actions (Zoom, Open New Tab, Print/PDF, Close) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Zoom Controls (Desktop / Tablet) */}
            <div className="hidden sm:inline-flex items-center border border-border rounded-lg p-0.5 bg-muted/40 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsManualZoom(true);
                  setUserZoom((z) => Math.max(30, z - 10));
                }}
                disabled={currentZoomPercent <= 30 || loading}
                title="Zoom Out"
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                <i className="fa-solid fa-magnifying-glass-minus text-[10px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManualZoom(false);
                  setUserZoom(100);
                  updateScale();
                }}
                title={isManualZoom ? "Reset to Auto-Fit" : "Auto-Fit Active"}
                className="w-12 text-center font-mono text-[11px] font-medium text-foreground hover:text-primary transition-colors cursor-pointer select-none"
              >
                {currentZoomPercent}%
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManualZoom(true);
                  setUserZoom((z) => Math.min(150, z + 10));
                }}
                disabled={currentZoomPercent >= 150 || loading}
                title="Zoom In"
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
              >
                <i className="fa-solid fa-magnifying-glass-plus text-[10px]" />
              </button>
            </div>

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

            {/* Print Button - Guaranteed White Text In Light & Dark Themes */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !htmlContent}
              title="Print / Save PDF"
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 !text-white shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <i className="fa-solid fa-print text-xs !text-white" />
              <span className="!text-white font-semibold">Print / PDF</span>
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

        {/* Modal Canvas Area - Equal top and bottom spacing with native smooth scroll */}
        <div
          ref={canvasRef}
          className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-zinc-200/80 dark:bg-zinc-900/90 py-4 px-2 sm:py-5 sm:px-4 flex flex-col items-center"
        >
          {/* Loading State */}
          {loading && (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center animate-in fade-in duration-150">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2.5">
                <i className="fa-solid fa-circle-notch fa-spin text-lg" />
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-0.5">
                Generating Document Preview...
              </h3>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Fetching rendered confirmation template...
              </p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="my-auto py-8 px-5 max-w-md w-full flex flex-col items-center justify-center text-center bg-card border border-destructive/30 rounded-xl shadow-md animate-in fade-in duration-150">
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

          {/* Rendered HTML Document Sheet - Standard A4 794px Geometry with Transform Scaling */}
          {!loading && !error && htmlContent && (
            <div
              style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                minHeight: `${scaledHeight}px`,
              }}
              className="relative my-0 shrink-0 select-none transition-all duration-75"
            >
              <div
                style={{
                  width: `${A4_WIDTH}px`,
                  height: `${contentHeight}px`,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                }}
                className="absolute top-0 left-0 bg-white text-zinc-900 rounded-sm shadow-xl border border-neutral-300 dark:border-neutral-700/80 overflow-hidden"
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={preparePreviewHtml(htmlContent)}
                  onLoad={handleIframeLoad}
                  title="Document Print Preview"
                  scrolling="no"
                  sandbox="allow-same-origin allow-modals allow-popups"
                  className="w-full h-full border-0 block bg-white pointer-events-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
