import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSafeLanguage, getSiteUrl } from '@/lib/seo';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { getValidAuthToken } from '@/lib/auth-token';
import DocumentDraftWorkspace from '@/components/smart-docs/draft/DocumentDraftWorkspace';
import DocumentDraftSkeleton from '@/components/smart-docs/draft/DocumentDraftSkeleton';
import {
  smartDocsService,
  extractStepperList,
  extractInstructionsData,
  extractProductsData,
  extractPaymentTermsData,
  extractCurrenciesData,
  extractConfirmationData,
  extractContractData,
  extractProformaData,
  extractShipmentInstructionData,
  extractDocumentListData,
  isConfirmationStep,
  isContractStep,
  isProformaStep,
  isShipmentInstructionStep,
  extractStepId,
  extractStepRedirectId,
  getStepSelfId,
  getShipmentInstructionIdFromStepper,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  isRealStepperList,
  extractLinkedConfirmationId,
  extractLinkedContractId,
  extractLinkedProformaId,
  extractLinkedShipmentInstructionId,
  DEFAULT_CURRENCIES,
} from '@/lib/api/smart-docs.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ id?: string; step?: string }>;
}): Promise<Metadata> {
  try {
    const params = await props.params;
    const searchParams = props.searchParams ? await props.searchParams : undefined;
    const activeLang = getSafeLanguage(params?.lang);
    const siteUrl = getSiteUrl();
    const isContractRequested = searchParams?.step === 'contract' || searchParams?.step === '2';
    const isProformaRequested = searchParams?.step === 'proforma' || searchParams?.step === '3';
    const isShipmentRequested =
      searchParams?.step === 'shipment' ||
      searchParams?.step === 'shipment_instruction' ||
      searchParams?.step === 'shipment-instruction' ||
      searchParams?.step === 'instruction' ||
      searchParams?.step === '4';
    const queryParts = [];
    if (searchParams?.id) queryParts.push(`id=${encodeURIComponent(String(searchParams.id))}`);
    if (searchParams?.step) queryParts.push(`step=${encodeURIComponent(String(searchParams.step))}`);
    const idQuery = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const pageTitle = isShipmentRequested
      ? 'Shipment Instruction'
      : isProformaRequested
      ? 'Proforma Invoice'
      : isContractRequested
      ? 'Draft Contract'
      : 'Draft Confirmation';

    return {
      title: `${pageTitle} | Smart Docs | AgriGuru Online`,
      description: 'Create and configure smart agricultural trade confirmation and contract drafts.',
      robots: {
        index: false,
        follow: false,
      },
      alternates: {
        canonical: `${siteUrl}/${activeLang}/smart-docs/draft${idQuery}`,
      },
    };
  } catch {
    return {
      title: 'Smart Docs | AgriGuru Online',
    };
  }
}

export default async function SmartDocsDraftPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{
    id?: string;
    step?: string;
  }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const lang = getSafeLanguage(params?.lang);
  const draftId = searchParams?.id ? String(searchParams.id).trim() : '';
  const initialStepParam = searchParams?.step ? String(searchParams.step).trim() : '';
  const isProformaRequested = initialStepParam === 'proforma' || initialStepParam === '3';
  const isShipmentRequested =
    initialStepParam === 'shipment' ||
    initialStepParam === 'shipment_instruction' ||
    initialStepParam === 'shipment-instruction' ||
    initialStepParam === 'instruction' ||
    initialStepParam === 'document' ||
    initialStepParam === '4';
  const isContractRequested = initialStepParam === 'contract' || initialStepParam === '2';

  // Secure token verification at top page level BEFORE Suspense boundary
  const token = await getValidAuthToken();

  if (!token) {
    const redirectParts = [];
    if (draftId) redirectParts.push(`id=${encodeURIComponent(draftId)}`);
    if (initialStepParam) redirectParts.push(`step=${encodeURIComponent(initialStepParam)}`);
    const redirectSuffix = redirectParts.length > 0 ? `?${redirectParts.join('&')}` : '';
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs/draft${redirectSuffix}`);
  }

  return (
    <Suspense
      fallback={
        <DocumentDraftSkeleton
          mode={isShipmentRequested || isProformaRequested || isContractRequested ? 'contract' : 'confirmation'}
        />
      }
    >
      <DraftPageDataLoader
        lang={lang}
        token={token}
        draftId={draftId}
        initialStepParam={initialStepParam}
      />
    </Suspense>
  );
}

interface DraftPageDataLoaderProps {
  lang: string;
  token: string;
  draftId: string;
  initialStepParam: string;
}

async function DraftPageDataLoader({
  lang,
  token,
  draftId,
  initialStepParam,
}: DraftPageDataLoaderProps) {
  const isContractRequested = initialStepParam === 'contract' || initialStepParam === '2';
  const isProformaRequested = initialStepParam === 'proforma' || initialStepParam === '3';
  const isShipmentRequested =
    initialStepParam === 'shipment' ||
    initialStepParam === 'shipment_instruction' ||
    initialStepParam === 'shipment-instruction' ||
    initialStepParam === 'instruction' ||
    initialStepParam === 'document' ||
    initialStepParam === '4';

  try {
    const targetAction = isContractRequested
      ? 'contract'
      : isShipmentRequested
      ? 'document'
      : 'confirmation';

    // The document ID passed from the button is the exact ID passed to the stepper API
    const stepperTarget = draftId || 'new-confirmation';

    // Phase 1: Fetch common dictionary, stepper, master datasets, and probe all document types concurrently in parallel
    const [
      rawDict,
      stepperRes,
      instructionsRes,
      productsRes,
      paymentTermsRes,
      currenciesRes,
      documentListRes,
      confirmationRes,
      contractRes,
      proformaRes,
      shipmentRes,
    ] = await Promise.all([
      getDictionary(lang).catch(() => ({})),
      smartDocsService
        .getStepperList(
          {
            action: targetAction,
            step: stepperTarget,
            lang,
            source: 'web',
          },
          token
        )
        .catch((err) => {
          console.error('[SmartDocsDraftPage] Stepper fetch error:', err);
          return null;
        }),
      smartDocsService.getInstructions({ lang, source: 'web' }, token).catch((err) => {
        console.error('[SmartDocsDraftPage] Instructions fetch error:', err);
        return null;
      }),
      smartDocsService.getProducts({ lang, source: 'web' }, token).catch((err) => {
        console.error('[SmartDocsDraftPage] Products fetch error:', err);
        return null;
      }),
      smartDocsService.getPaymentTerms({ lang, source: 'web' }, token).catch((err) => {
        console.error('[SmartDocsDraftPage] Payment terms fetch error:', err);
        return null;
      }),
      smartDocsService.getCurrencies({ lang, source: 'web' }, token).catch((err) => {
        console.error('[SmartDocsDraftPage] Currencies fetch error:', err);
        return null;
      }),
      smartDocsService.getDocumentListForSelection({ lang, source: 'web' }, token).catch((err) => {
        console.error('[SmartDocsDraftPage] Document list fetch error:', err);
        return null;
      }),
      !isShipmentRequested && !isContractRequested && !isProformaRequested && draftId
        ? smartDocsService.getConfirmation(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      isContractRequested && draftId
        ? smartDocsService.getContract(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      isProformaRequested && draftId
        ? smartDocsService.getProforma(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      isShipmentRequested && draftId
        ? smartDocsService
            .getShipmentInstruction(draftId, { lang, source: 'web' }, token)
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const dict = rawDict as any;
    let initialSteps = extractStepperList(stepperRes);
    const { sellers: initialSellers, buyers: initialBuyers } = extractInstructionsData(instructionsRes);
    const initialProducts = extractProductsData(productsRes);
    const initialPaymentTerms = extractPaymentTermsData(paymentTermsRes);
    const initialCurrencies = extractCurrenciesData(currenciesRes);
    const initialDocumentList = extractDocumentListData(documentListRes);
    let initialConfirmationData = extractConfirmationData(confirmationRes);
    let initialContractData: any = extractContractData(contractRes);
    let initialProformaData: any = extractProformaData(proformaRes);
    let initialShipmentInstructionData: any = extractShipmentInstructionData(shipmentRes);

    // Linked ID Discovery
    let discoveredConfId =
      extractLinkedConfirmationId(initialConfirmationData) ||
      extractLinkedConfirmationId(initialContractData) ||
      extractLinkedConfirmationId(initialProformaData) ||
      extractLinkedConfirmationId(initialShipmentInstructionData);

    let discoveredContractId =
      extractLinkedContractId(initialConfirmationData) ||
      extractLinkedContractId(initialContractData) ||
      extractLinkedContractId(initialProformaData) ||
      extractLinkedContractId(initialShipmentInstructionData);

    // If confirmation stepper returned empty/dummy, check if this workflow is contract-rooted (action = 'contract')
    if (!isRealStepperList(initialSteps) && stepperTarget && stepperTarget !== 'new-confirmation') {
      try {
        const contractStepperRes = await smartDocsService
          .getStepperList(
            {
              action: 'contract',
              step: stepperTarget,
              lang,
              source: 'web',
            },
            token
          )
          .catch(() => null);
        const cSteps = extractStepperList(contractStepperRes);
        if (cSteps.length > 0 && isRealStepperList(cSteps)) {
          initialSteps = cSteps;
          if (!initialContractData) {
            const cRes = await smartDocsService.getContract(stepperTarget, { lang, source: 'web' }, token).catch(() => null);
            const extC = extractContractData(cRes);
            if (extC) initialContractData = extC;
          }
        }
      } catch {
        // non-blocking
      }
    }

    // If confirmation ID not yet discovered, but contract ID was discovered (e.g. from SI or PI), fetch contract to discover confirmation ID
    if (!discoveredConfId && discoveredContractId) {
      try {
        const discoveredContractRes = await smartDocsService
          .getContract(discoveredContractId, { lang, source: 'web' }, token)
          .catch(() => null);
        const extContract = extractContractData(discoveredContractRes);
        if (extContract) {
          if (!initialContractData) initialContractData = extContract;
          discoveredConfId = extractLinkedConfirmationId(extContract);
        }
      } catch {
        // non-blocking
      }
    }

    // If initial stepper returned dummy/pending steps or was empty, re-fetch with discovered confirmation or contract ID
    const hasRealSteps = isRealStepperList(initialSteps);
    const discoveredAction = discoveredConfId ? 'confirmation' : discoveredContractId ? 'contract' : 'confirmation';
    const targetStep = discoveredConfId || discoveredContractId || '';

    if (targetStep && (!hasRealSteps || targetStep !== stepperTarget)) {
      try {
        const discoveredStepperRes = await smartDocsService
          .getStepperList(
            {
              action: discoveredAction,
              step: targetStep,
              lang,
              source: 'web',
            },
            token
          )
          .catch(() => null);
        const steps = extractStepperList(discoveredStepperRes);
        if (steps.length > 0 && isRealStepperList(steps)) {
          initialSteps = steps;
        } else if (steps.length > 0 && !hasRealSteps) {
          initialSteps = steps;
        }
      } catch {
        // non-blocking
      }
    }

    // Step discovery from Stepper and Document data
    const stepperConfirmationStep = initialSteps.find((s, idx) => isConfirmationStep(s, idx)) || initialSteps[0];
    const confId =
      discoveredConfId ||
      getStepSelfId(stepperConfirmationStep) ||
      extractStepId(stepperConfirmationStep) ||
      extractStepRedirectId(stepperConfirmationStep) ||
      initialConfirmationData?.id ||
      (!isContractRequested && !isProformaRequested && !isShipmentRequested ? stepperTarget : '');

    const stepperContractStep = initialSteps.find((s, idx) => isContractStep(s, idx)) || initialSteps[1];
    const contractId =
      discoveredContractId ||
      getStepSelfId(stepperContractStep) ||
      extractStepId(stepperContractStep) ||
      extractStepRedirectId(stepperContractStep) ||
      extractLinkedContractId(initialConfirmationData) ||
      extractLinkedContractId(initialProformaData) ||
      extractLinkedContractId(initialShipmentInstructionData) ||
      initialContractData?.id;

    const stepperProformaStep = initialSteps.find((s, idx) => isProformaStep(s, idx)) || initialSteps[2];
    const proformaId =
      getStepSelfId(stepperProformaStep) ||
      extractStepId(stepperProformaStep) ||
      extractStepRedirectId(stepperProformaStep) ||
      extractLinkedProformaId(initialContractData) ||
      extractLinkedProformaId(initialConfirmationData) ||
      extractLinkedProformaId(initialShipmentInstructionData) ||
      initialProformaData?.id;

    const stepperShipmentStep = initialSteps.find((s, idx) => isShipmentInstructionStep(s, idx)) || initialSteps[3];
    const shipmentId =
      getShipmentInstructionIdFromStepper(initialSteps) ||
      getStepSelfId(stepperShipmentStep) ||
      extractStepId(stepperShipmentStep) ||
      extractStepRedirectId(stepperShipmentStep) ||
      extractLinkedShipmentInstructionId(initialProformaData) ||
      extractLinkedShipmentInstructionId(initialContractData) ||
      extractLinkedShipmentInstructionId(initialConfirmationData) ||
      initialShipmentInstructionData?.id;

    // Phase 2: Fetch any missing documents in ONE clean parallel round trip!
    const [missingConfRes, missingContractRes, missingProformaRes, missingShipmentRes] = await Promise.all([
      !initialConfirmationData && confId && confId !== draftId
        ? smartDocsService.getConfirmation(confId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialContractData && contractId && contractId !== draftId
        ? smartDocsService.getContract(contractId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialProformaData && proformaId && proformaId !== draftId
        ? smartDocsService.getProforma(proformaId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialShipmentInstructionData && shipmentId && shipmentId !== draftId
        ? smartDocsService.getShipmentInstruction(shipmentId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (missingConfRes) {
      const ext = extractConfirmationData(missingConfRes);
      if (ext) initialConfirmationData = ext;
    }
    if (missingContractRes) {
      const ext = extractContractData(missingContractRes);
      if (ext) initialContractData = ext;
    }
    if (missingProformaRes) {
      const ext = extractProformaData(missingProformaRes);
      if (ext) initialProformaData = ext;
    }
    if (missingShipmentRes) {
      const ext = extractShipmentInstructionData(missingShipmentRes);
      if (ext) initialShipmentInstructionData = ext;
    }

    // Ultimate fallback if stepper list is empty
    if (initialSteps.length === 0) {
      try {
        const templateStepperRes = await smartDocsService.getStepperList(
          {
            action: 'confirmation',
            step: 'new-confirmation',
            lang,
            source: 'web',
          },
          token
        );
        const templateSteps = extractStepperList(templateStepperRes);
        if (templateSteps.length > 0) {
          initialSteps = templateSteps;
        }
      } catch {
        // non-blocking
      }
    }

    if (initialSteps.length === 0) {
      initialSteps = DEFAULT_WORKFLOW_STEPPER_ITEMS;
    }

    // Ensure initialSteps reflects all loaded document IDs and completed statuses
    initialSteps = initialSteps.map((s, idx) => {
      let updated = { ...s };
      if (isConfirmationStep(s, idx)) {
        if (confId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = confId;
          updated.redirectId = confId;
        }
        if (initialConfirmationData) {
          updated.status = 'completed';
        }
      } else if (isContractStep(s, idx)) {
        if (contractId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = contractId;
          updated.redirectId = contractId;
        }
        if (initialContractData) {
          updated.status = 'completed';
        }
      } else if (isProformaStep(s, idx)) {
        if (proformaId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = proformaId;
          updated.redirectId = proformaId;
        }
        if (initialProformaData) {
          updated.status = 'completed';
        }
      } else if (isShipmentInstructionStep(s, idx)) {
        if (shipmentId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = shipmentId;
          updated.redirectId = shipmentId;
        }
        if (initialShipmentInstructionData) {
          updated.status = 'completed';
        }
      }
      return updated;
    });

    // If this ID is a Contract or Proforma or Shipment (or step requested), ensure initialStepParam defaults accordingly
    const effectiveStepParam =
      initialStepParam ||
      (isShipmentRequested
        ? 'shipment'
        : isProformaRequested
        ? 'proforma'
        : isContractRequested
        ? 'contract'
        : initialContractData && !initialConfirmationData
        ? 'contract'
        : undefined);

    const linkedConfId =
      confId ||
      discoveredConfId ||
      extractLinkedConfirmationId(initialContractData) ||
      extractLinkedConfirmationId(initialProformaData) ||
      extractLinkedConfirmationId(initialShipmentInstructionData);

    // The workspace root ID must ALWAYS be the Confirmation ID anchoring this entire workflow (or contract ID if contract-rooted).
    const effectiveDraftId =
      confId ||
      initialConfirmationData?.id ||
      initialConfirmationData?._id ||
      linkedConfId ||
      contractId ||
      draftId ||
      '';

    return (
      <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden custom-scrollbar">
        <div className="w-full pad-for-badges flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
          <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
            {/* SaaS Single Page Workspace (Fluid on mobile, locked on desktop) */}
            <DocumentDraftWorkspace
              lang={lang}
              dict={dict}
              initialSteps={initialSteps}
              initialSellers={initialSellers}
              initialBuyers={initialBuyers}
              initialProducts={initialProducts}
              initialPaymentTerms={initialPaymentTerms}
              initialCurrencies={initialCurrencies}
              initialDocumentList={initialDocumentList}
              initialData={initialConfirmationData}
              initialContractData={initialContractData}
              initialProformaData={initialProformaData}
              initialShipmentInstructionData={initialShipmentInstructionData}
              initialId={draftId || effectiveDraftId}
              initialStepParam={effectiveStepParam}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[DraftPageDataLoader] Fatal rendering error caught:', error);

    // Graceful fallback: render workspace with default stepper so "Something went wrong" never crashes the UI
    return (
      <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden custom-scrollbar">
        <div className="w-full pad-for-badges flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
          <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
            <DocumentDraftWorkspace
              lang={lang}
              dict={{}}
              initialSteps={DEFAULT_WORKFLOW_STEPPER_ITEMS}
              initialSellers={[]}
              initialBuyers={[]}
              initialProducts={[]}
              initialPaymentTerms={[]}
              initialCurrencies={DEFAULT_CURRENCIES}
              initialDocumentList={[]}
              initialData={null}
              initialContractData={null}
              initialProformaData={null}
              initialShipmentInstructionData={null}
              initialId={draftId}
              initialStepParam={initialStepParam}
            />
          </div>
        </div>
      </div>
    );
  }
}
