import React from 'react';

export interface DocumentDraftSkeletonProps {
  mode?: 'confirmation' | 'contract';
  isFormCardOnly?: boolean;
}

/**
 * High-fidelity, pixel-perfect skeleton loader for Smart Docs Confirmation and Contract Drafts.
 * Structurally matches the final form and stepper layout 100% to guarantee zero layout shifts
 * and an ultra-smooth, premium user experience.
 */
export default function DocumentDraftSkeleton({
  mode = 'confirmation',
  isFormCardOnly = false,
}: DocumentDraftSkeletonProps) {
  const isContract = mode === 'contract';

  // Left Form Card content
  const formCardContent = (
    <div className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl border border-border shadow-xs overflow-hidden">
      {/* Scrollable Form Viewport */}
      <div className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-hidden flex flex-col">
        {/* TOP BAR: Letterhead Toggle | Document Title | Watermark Toggle */}
        <div className="px-3 sm:px-4 py-2 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 bg-card shrink-0">
          {/* Desktop Left: Letterhead */}
          <div className="hidden sm:flex items-center gap-2 animate-pulse">
            <div className="w-8 h-4.5 rounded-full bg-muted/50" />
            <div className="w-16 h-3.5 bg-muted/40 rounded" />
          </div>

          {/* Center: Title + Dotted Underline */}
          <div className="flex flex-col items-center justify-center animate-pulse w-full sm:w-auto">
            <div className="h-4.5 w-36 sm:w-44 bg-muted/60 rounded" />
            <div className="w-36 sm:w-56 border-b-2 border-dotted border-primary/40 mt-1.5" />
          </div>

          {/* Desktop Right: Watermark */}
          <div className="hidden sm:flex items-center gap-2 animate-pulse">
            <div className="w-8 h-4.5 rounded-full bg-muted/50" />
            <div className="w-16 h-3.5 bg-muted/40 rounded" />
          </div>

          {/* Mobile Bottom Row for Toggles */}
          <div className="flex sm:hidden items-center justify-between w-full pt-1.5 border-t border-border animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 rounded-full bg-muted/50" />
              <div className="w-14 h-3 bg-muted/40 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 rounded-full bg-muted/50" />
              <div className="w-14 h-3 bg-muted/40 rounded" />
            </div>
          </div>
        </div>

        {/* DOCUMENT GRID / TABLE: 1px Borders matching Canva paper mockup */}
        <div className="w-full flex-1 flex flex-col text-xs divide-y divide-border border-b border-border bg-card animate-pulse">
          {/* ROW 1: Confirmation Number & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="h-3.5 w-36 bg-muted/50 rounded" />
              <div className="flex-1 sm:max-w-[240px] h-6 border-b-2 border-dotted border-primary/30" />
            </div>
            <div className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="h-3.5 w-32 bg-muted/50 rounded" />
              <div className="flex-1 sm:max-w-[200px] h-6 border-b-2 border-dotted border-primary/30" />
            </div>
          </div>

          {/* ROW 2: If Contract, Contract Number & Date. If Confirmation, Parties */}
          {isContract && (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="h-3.5 w-36 bg-muted/50 rounded" />
                <div className="flex-1 sm:max-w-[240px] h-6 border-b-2 border-dotted border-primary/30" />
              </div>
              <div className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="h-3.5 w-32 bg-muted/50 rounded" />
                <div className="flex-1 sm:max-w-[200px] h-6 border-b-2 border-dotted border-primary/30" />
              </div>
            </div>
          )}

          {isContract && (
            /* Contract Parties Header Row */
            <div className="py-2 px-3 flex items-center justify-center bg-muted/10">
              <div className="h-3.5 w-80 bg-muted/40 rounded" />
            </div>
          )}

          {/* PARTIES: Exporter (Seller) & Importer (Buyer) */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Exporter (Seller) */}
            <div className="py-2.5 px-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-32 bg-muted/50 rounded" />
                <div className="h-5 w-16 bg-muted/30 rounded" />
              </div>
              <div className="h-7 w-full border-b-2 border-dotted border-primary/30 flex items-center justify-between px-1">
                <div className="h-3 w-40 bg-muted/40 rounded" />
                <div className="w-3 h-3 rounded bg-muted/30" />
              </div>
              <div className="h-14 w-full bg-muted/15 rounded-md border border-border/50 p-2 flex flex-col gap-1.5">
                <div className="h-2.5 w-3/4 bg-muted/30 rounded" />
                <div className="h-2.5 w-1/2 bg-muted/20 rounded" />
              </div>
            </div>

            {/* Importer (Buyer) */}
            <div className="py-2.5 px-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-32 bg-muted/50 rounded" />
                <div className="h-5 w-16 bg-muted/30 rounded" />
              </div>
              <div className="h-7 w-full border-b-2 border-dotted border-primary/30 flex items-center justify-between px-1">
                <div className="h-3 w-40 bg-muted/40 rounded" />
                <div className="w-3 h-3 rounded bg-muted/30" />
              </div>
              <div className="h-14 w-full bg-muted/15 rounded-md border border-border/50 p-2 flex flex-col gap-1.5">
                <div className="h-2.5 w-3/4 bg-muted/30 rounded" />
                <div className="h-2.5 w-1/2 bg-muted/20 rounded" />
              </div>
            </div>
          </div>

          {isContract && (
            /* Shipping Instruction Row for Contract */
            <div className="py-2.5 px-3 flex flex-col gap-1.5">
              <div className="h-3.5 w-44 bg-muted/50 rounded" />
              <div className="h-10 w-full bg-muted/15 rounded-md border border-border/50" />
            </div>
          )}

          {/* PRODUCT, HSN CODE, COUNTRY */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="py-2.5 px-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 bg-muted/50 rounded" />
                <div className="h-4.5 w-12 bg-muted/30 rounded" />
              </div>
              <div className="h-7 border-b-2 border-dotted border-primary/30 flex items-center justify-between px-1">
                <div className="h-3 w-28 bg-muted/40 rounded" />
                <div className="w-3 h-3 rounded bg-muted/30" />
              </div>
            </div>
            <div className="py-2.5 px-3 flex flex-col gap-1.5">
              <div className="h-3.5 w-20 bg-muted/50 rounded" />
              <div className="h-7 border-b-2 border-dotted border-primary/30 flex items-center px-1">
                <div className="h-3 w-24 bg-muted/40 rounded" />
              </div>
            </div>
            <div className="py-2.5 px-3 flex flex-col gap-1.5">
              <div className="h-3.5 w-20 bg-muted/50 rounded" />
              <div className="h-7 border-b-2 border-dotted border-primary/30 flex items-center px-1">
                <div className="h-3 w-24 bg-muted/40 rounded" />
              </div>
            </div>
          </div>

          {/* SPECIFICATION */}
          <div className="py-2.5 px-3 flex flex-col gap-1.5">
            <div className="h-3.5 w-28 bg-muted/50 rounded" />
            <div className="h-12 w-full bg-muted/15 rounded-md border border-border/50 p-2 flex flex-col gap-1">
              <div className="h-2.5 w-full bg-muted/25 rounded" />
              <div className="h-2.5 w-4/5 bg-muted/20 rounded" />
            </div>
          </div>

          {/* SHIPMENT & PORTS / PACKING */}
          {isContract ? (
            <>
              {/* Contract Shipment Period & Payment Term */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-28 bg-muted/50 rounded" />
                    <div className="h-4.5 w-12 bg-muted/30 rounded" />
                  </div>
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>

              {/* FCL Type, Packing, Brand */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>

              {/* Ports */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation Ship By & Ports */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>

              {/* Packing & Shipping Term */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-28 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>
            </>
          )}

          {/* QUANTITY & PRICE (7-Column Table Grid) */}
          <div className="p-2 sm:p-2.5 bg-muted/5">
            <div className="w-full border border-border rounded-lg overflow-x-auto">
              <div className="min-w-[640px] grid grid-cols-7 divide-x divide-border border-b border-border bg-muted/20 py-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div>FCL QTY</div>
                <div>CAPACITY</div>
                <div>MT QTY</div>
                <div>BAG QTY</div>
                <div>CURRENCY</div>
                <div>PRICE</div>
                <div>TOTAL</div>
              </div>
              <div className="min-w-[640px] grid grid-cols-7 divide-x divide-border py-2 px-2 items-center">
                <div className="h-6 border-b border-dotted border-primary/30 mx-1" />
                <div className="h-6 border-b border-dotted border-primary/30 mx-1" />
                <div className="h-6 bg-muted/15 rounded mx-1" />
                <div className="h-6 bg-muted/15 rounded mx-1" />
                <div className="h-6 border-b border-dotted border-primary/30 mx-1" />
                <div className="h-6 border-b border-dotted border-primary/30 mx-1" />
                <div className="h-6 bg-muted/15 rounded mx-1" />
              </div>
            </div>
          </div>

          {/* Shipment Period & Notes/Terms */}
          {!isContract && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-28 bg-muted/50 rounded" />
                    <div className="h-4.5 w-12 bg-muted/30 rounded" />
                  </div>
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>
              <div className="py-2.5 px-3 flex flex-col gap-1.5">
                <div className="h-3.5 w-32 bg-muted/50 rounded" />
                <div className="h-10 w-full bg-muted/15 rounded-md border border-border/50" />
              </div>
            </>
          )}

          {isContract && (
            <>
              {/* Inspection, Incoterms, Insurance */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-20 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>

              {/* Advance & Broker */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
                <div className="py-2.5 px-3 flex flex-col gap-1.5">
                  <div className="h-3.5 w-36 bg-muted/50 rounded" />
                  <div className="h-7 border-b-2 border-dotted border-primary/30" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BOTTOM STICKY ACTION BAR */}
      <div className="border-t border-border bg-card/90 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 animate-pulse">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="h-7 w-28 bg-muted/40 rounded-md border border-border" />
          <div className="h-7 w-28 bg-muted/40 rounded-md border border-border" />
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="h-7 w-28 bg-primary/20 rounded-md border border-primary/30" />
          <div className="h-7 w-36 bg-emerald-600/30 rounded-md" />
        </div>
      </div>
    </div>
  );

  // If used inside DocumentDraftWorkspace for just the form card:
  if (isFormCardOnly) {
    return formCardContent;
  }

  // Full page skeleton for app/[lang]/smart-docs/draft/loading.tsx
  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-fit lg:min-h-0 h-full overflow-hidden">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-fit lg:min-h-0 h-full overflow-hidden">
          {/* Header Bar Skeleton (matches PageHeader with back button) */}
          <div className="py-0.5 sm:py-0.5 flex items-center justify-between w-full mb-0.5 sm:mb-1 animate-pulse shrink-0">
            <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
              <i className="fa-solid fa-arrow-left text-[11px] text-muted-foreground/40" />
            </div>
            <div className="h-6 sm:h-7 w-48 sm:w-64 bg-muted/50 rounded-lg mx-auto" />
            <div className="w-8" />
          </div>

          {/* Mobile Stepper Header Banner (< lg only) */}
          <div className="lg:hidden shrink-0 bg-card border border-border rounded-xl p-2 sm:p-2.5 shadow-xs mb-2.5 animate-pulse">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center shrink-0" />
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="h-3 w-28 bg-muted/50 rounded" />
                  <div className="h-2 w-16 bg-muted/30 rounded" />
                </div>
              </div>
              <div className="w-20 h-6 rounded-md bg-muted/30 border border-border shrink-0" />
            </div>
          </div>

          {/* SaaS Workspace Layout: Left Form Card + Right Stepper Card */}
          <div className="flex-1 min-h-fit lg:min-h-0 lg:h-full flex flex-col lg:flex-row items-stretch justify-start gap-2.5 sm:gap-3 lg:gap-3.5 pb-1 sm:pb-1.5 lg:pb-0 overflow-hidden">
            {/* Left Side: Form Card */}
            <div className="w-full flex-1 min-w-0 min-h-fit lg:min-h-0 lg:h-full flex flex-col">
              {formCardContent}
            </div>

            {/* Right Side: Stepper Card Skeleton (Desktop only - matches DocumentStatusStepper 100%) */}
            <div className="hidden lg:flex w-[260px] xl:w-[280px] 2xl:w-[300px] shrink-0 h-full min-h-0 bg-card border border-border rounded-xl shadow-xs overflow-hidden flex-col p-2.5 sm:p-3 animate-pulse">
              {/* Stepper Header Skeleton */}
              <div className="shrink-0 pb-2 mb-1 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-muted/60 shrink-0" />
                  <div className="h-3.5 w-24 bg-muted/50 rounded" />
                </div>
                <div className="h-4 w-10 rounded-full bg-muted/40 shrink-0" />
              </div>

              {/* Workflow Steps Skeleton List matching Stepper rows */}
              <div className="flex-1 overflow-y-auto pr-0.5 space-y-0.5 custom-scrollbar">
                {Array.from({ length: 11 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="relative flex items-center gap-2 px-2 py-1 rounded-md border border-transparent"
                  >
                    {/* Circle Node */}
                    <div className="w-5 h-5 rounded-full bg-muted/60 shrink-0" />

                    {/* Title + Status Badge */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                      <div
                        className={`h-3 rounded ${
                          idx === 0 ? 'w-28 bg-muted/60' : 'w-24 bg-muted/40'
                        }`}
                      />
                      <div className="h-2.5 w-12 rounded bg-muted/30" />
                    </div>

                    {/* PDF Icon Box */}
                    <div className="w-7 h-7 rounded-md bg-muted/20 border border-border/30 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

