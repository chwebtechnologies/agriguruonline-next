'use client';

import React, { useState } from 'react';
import DocSignatureBox from './DocSignatureBox';

export interface ContractSignatureSectionProps {
  isSalesBrokerAllowed?: boolean | null;

  exporterTitle: string;
  onExporterTitleChange: (val: string) => void;
  exporterSignature: string;
  onExporterSignatureChange: (url: string) => void;
  exporterAuthorityTitle: string;
  onExporterAuthorityTitleChange: (val: string) => void;

  brokerTitle: string;
  onBrokerTitleChange: (val: string) => void;
  brokerSignature: string;
  onBrokerSignatureChange: (url: string) => void;
  brokerAuthorityTitle: string;
  onBrokerAuthorityTitleChange: (val: string) => void;

  importerTitle: string;
  onImporterTitleChange: (val: string) => void;
  importerSignature: string;
  onImporterSignatureChange: (url: string) => void;
  importerAuthorityTitle: string;
  onImporterAuthorityTitleChange: (val: string) => void;

  readOnly?: boolean;
  exporterError?: string | null;
  brokerError?: string | null;
  importerError?: string | null;
}

export function ContractSignatureSection({
  isSalesBrokerAllowed = false,

  exporterTitle,
  onExporterTitleChange,
  exporterSignature,
  onExporterSignatureChange,
  exporterAuthorityTitle,
  onExporterAuthorityTitleChange,

  brokerTitle,
  onBrokerTitleChange,
  brokerSignature,
  onBrokerSignatureChange,
  brokerAuthorityTitle,
  onBrokerAuthorityTitleChange,

  importerTitle,
  onImporterTitleChange,
  importerSignature,
  onImporterSignatureChange,
  importerAuthorityTitle,
  onImporterAuthorityTitleChange,

  readOnly = false,
  exporterError = null,
  brokerError = null,
  importerError = null,
}: ContractSignatureSectionProps) {
  // Mobile / Tablet accordion active tab: 'exporter' | 'broker' | 'importer' | null
  // Defaults to null (collapsed) so user isn't overwhelmed by lengthy stacked boxes
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const toggleAccordion = (party: string) => {
    setOpenAccordion((prev) => (prev === party ? null : party));
  };

  return (
    <div className="w-full">
      {/* 
        DESKTOP LAYOUT (md: and up):
        Unchanged standard side-by-side grid (Importer | Broker (if allowed) | Exporter)
      */}
      <div
        className={`hidden md:grid ${
          isSalesBrokerAllowed ? 'md:grid-cols-3' : 'md:grid-cols-2'
        } divide-y md:divide-y-0 md:divide-x divide-border`}
      >
        <DocSignatureBox
          partyType="importer"
          title={importerTitle}
          onTitleChange={onImporterTitleChange}
          signatureUrl={importerSignature}
          onSignatureChange={onImporterSignatureChange}
          authorityTitle={importerAuthorityTitle}
          onAuthorityTitleChange={onImporterAuthorityTitleChange}
          titlePlaceholder="BUYER SIGNATURE"
          authorityPlaceholder="BUYER SIGNATURE LABEL"
          readOnly={readOnly}
          error={importerError}
        />
        {isSalesBrokerAllowed && (
          <DocSignatureBox
            partyType="broker"
            title={brokerTitle}
            onTitleChange={onBrokerTitleChange}
            signatureUrl={brokerSignature}
            onSignatureChange={onBrokerSignatureChange}
            authorityTitle={brokerAuthorityTitle}
            onAuthorityTitleChange={onBrokerAuthorityTitleChange}
            titlePlaceholder="BROKER SIGNATURE"
            authorityPlaceholder="BROKER SIGNATURE LABEL"
            readOnly={readOnly}
            error={brokerError}
          />
        )}
        <DocSignatureBox
          partyType="exporter"
          title={exporterTitle}
          onTitleChange={onExporterTitleChange}
          signatureUrl={exporterSignature}
          onSignatureChange={onExporterSignatureChange}
          authorityTitle={exporterAuthorityTitle}
          onAuthorityTitleChange={onExporterAuthorityTitleChange}
          titlePlaceholder="SELLER SIGNATURE"
          authorityPlaceholder="SELLER SIGNATURE LABEL"
          readOnly={readOnly}
          error={exporterError}
        />
      </div>

      {/* 
        MOBILE & TABLET RESPONSIVE LAYOUT (< md):
        Collapsible / Expandable Accordion with responsive sequence:
        1. Exporter Signature (Top)
        2. Broker Signature (Middle, if applicable)
        3. Importer Signature (Bottom)
      */}
      <div className="flex md:hidden flex-col divide-y divide-border">
        {/* 1. EXPORTER SIGNATURE ACCORDION */}
        <div className="w-full">
          <button
            type="button"
            onClick={() => toggleAccordion('exporter')}
            aria-expanded={openAccordion === 'exporter'}
            className="w-full py-2.5 px-3 flex items-center justify-between text-left bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">
                <i className="fa-solid fa-file-signature text-[11px]" />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
                  {exporterTitle || 'SELLER SIGNATURE'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {exporterAuthorityTitle || 'AUTHORISED SIGNATURE'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {exporterSignature ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <i className="fa-solid fa-check text-[9px]" />
                  <span>Signed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                  <span>Click to Sign</span>
                </span>
              )}
              <i
                className={`fa-solid fa-chevron-down text-xs text-muted-foreground transition-transform duration-200 ${
                  openAccordion === 'exporter' ? 'rotate-180 text-primary' : ''
                }`}
              />
            </div>
          </button>

          {openAccordion === 'exporter' && (
            <div className="p-1 sm:p-2 bg-card border-t border-border animate-in fade-in duration-150">
              <DocSignatureBox
                partyType="exporter"
                title={exporterTitle}
                onTitleChange={onExporterTitleChange}
                signatureUrl={exporterSignature}
                onSignatureChange={onExporterSignatureChange}
                authorityTitle={exporterAuthorityTitle}
                onAuthorityTitleChange={onExporterAuthorityTitleChange}
                titlePlaceholder="SELLER SIGNATURE"
                authorityPlaceholder="SELLER SIGNATURE LABEL"
                readOnly={readOnly}
                error={exporterError}
              />
            </div>
          )}
        </div>

        {/* 2. BROKER SIGNATURE ACCORDION (If applicable only) */}
        {isSalesBrokerAllowed && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => toggleAccordion('broker')}
              aria-expanded={openAccordion === 'broker'}
              className="w-full py-2.5 px-3 flex items-center justify-between text-left bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">
                  <i className="fa-solid fa-file-signature text-[11px]" />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
                    {brokerTitle || 'BROKER SIGNATURE'}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {brokerAuthorityTitle || 'AUTHORISED SIGNATURE'}
                  </span>
                </div>
              </div>

            <div className="flex items-center gap-2 shrink-0">
              {brokerSignature ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <i className="fa-solid fa-check text-[9px]" />
                  <span>Signed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                  <span>Click to Sign</span>
                </span>
              )}
              <i
                className={`fa-solid fa-chevron-down text-xs text-muted-foreground transition-transform duration-200 ${
                  openAccordion === 'broker' ? 'rotate-180 text-primary' : ''
                }`}
              />
            </div>
          </button>

          {openAccordion === 'broker' && (
            <div className="p-1 sm:p-2 bg-card border-t border-border animate-in fade-in duration-150">
              <DocSignatureBox
                partyType="broker"
                title={brokerTitle}
                onTitleChange={onBrokerTitleChange}
                signatureUrl={brokerSignature}
                onSignatureChange={onBrokerSignatureChange}
                authorityTitle={brokerAuthorityTitle}
                onAuthorityTitleChange={onBrokerAuthorityTitleChange}
                titlePlaceholder="BROKER SIGNATURE"
                authorityPlaceholder="BROKER SIGNATURE LABEL"
                readOnly={readOnly}
                error={brokerError}
              />
            </div>
          )}
        </div>
      )}

      {/* 3. IMPORTER SIGNATURE ACCORDION */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => toggleAccordion('importer')}
          aria-expanded={openAccordion === 'importer'}
          className="w-full py-2.5 px-3 flex items-center justify-between text-left bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">
              <i className="fa-solid fa-file-signature text-[11px]" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
                {importerTitle || 'BUYER SIGNATURE'}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {importerAuthorityTitle || 'AUTHORISED SIGNATURE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {importerSignature ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <i className="fa-solid fa-check text-[9px]" />
                <span>Signed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                <span>Click to Sign</span>
              </span>
            )}
            <i
              className={`fa-solid fa-chevron-down text-xs text-muted-foreground transition-transform duration-200 ${
                openAccordion === 'importer' ? 'rotate-180 text-primary' : ''
              }`}
            />
          </div>
        </button>

        {openAccordion === 'importer' && (
          <div className="p-1 sm:p-2 bg-card border-t border-border animate-in fade-in duration-150">
            <DocSignatureBox
              partyType="importer"
              title={importerTitle}
              onTitleChange={onImporterTitleChange}
              signatureUrl={importerSignature}
              onSignatureChange={onImporterSignatureChange}
              authorityTitle={importerAuthorityTitle}
              onAuthorityTitleChange={onImporterAuthorityTitleChange}
              titlePlaceholder="BUYER SIGNATURE"
              authorityPlaceholder="BUYER SIGNATURE LABEL"
              readOnly={readOnly}
              error={importerError}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default ContractSignatureSection;
