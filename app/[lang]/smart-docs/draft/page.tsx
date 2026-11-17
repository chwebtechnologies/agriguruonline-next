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
  extractBillOfLadingData,
  extractCustomInvoiceData,
  extractDocumentListData,
  isConfirmationStep,
  isContractStep,
  isProformaStep,
  isShipmentInstructionStep,
  isBillOfLadingStep,
  isCustomInvoiceStep,
  extractStepId,
  extractStepRedirectId,
  getStepSelfId,
  getShipmentInstructionIdFromStepper,
  getBillOfLadingIdFromStepper,
  getCustomInvoiceIdFromStepper,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  isRealStepperList,
  normalizeStepStatus,
  isStatusCompleted,
  extractLinkedConfirmationId,
  extractLinkedContractId,
  extractLinkedProformaId,
  extractLinkedShipmentInstructionId,
  extractLinkedBillOfLadingId,
  extractLinkedCustomInvoiceId,
  mergeStepperWithHidden,
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
    const isBillOfLadingRequested =
      searchParams?.step === 'bill-of-lading' ||
      searchParams?.step === 'bill_of_lading' ||
      searchParams?.step === 'lading' ||
      searchParams?.step === 'bl' ||
      searchParams?.step === '5';
    const isCustomInvoiceRequested =
      searchParams?.step === 'custom-invoice' ||
      searchParams?.step === 'custom_invoice' ||
      searchParams?.step === 'custom' ||
      searchParams?.step === 'invoice' ||
      searchParams?.step === '6';
    const queryParts = [];
    if (searchParams?.id) queryParts.push(`id=${encodeURIComponent(String(searchParams.id))}`);
    if (searchParams?.step) queryParts.push(`step=${encodeURIComponent(String(searchParams.step))}`);
    const idQuery = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const dict = await getDictionary(activeLang).catch(() => ({} as any));

    let pageTitle = '';
    if (isBillOfLadingRequested) {
      pageTitle = dict?.smart_docs?.draft_bill_of_lading_title || 'Draft Bill of Lading';
    } else if (isCustomInvoiceRequested) {
      pageTitle = dict?.smart_docs?.draft_custom_invoice_title || 'Draft Custom Invoice';
    } else if (isShipmentRequested) {
      pageTitle = dict?.smart_docs?.draft_shipment_instruction_title || 'Draft Shipment Instruction';
    } else if (isProformaRequested) {
      pageTitle = dict?.smart_docs?.draft_proforma_title || 'Draft Proforma Invoice';
    } else if (isContractRequested) {
      pageTitle = dict?.smart_docs?.draft_contract_title || 'Draft Contract';
    } else if (
      searchParams?.step &&
      !['confirmation', '1', 'trade-confirmation', 'new-confirmation'].includes(
        String(searchParams.step).toLowerCase().trim()
      )
    ) {
      const stepRaw = String(searchParams.step)
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();
      pageTitle = /^draft\b/i.test(stepRaw) ? stepRaw : `Draft ${stepRaw}`;
    } else {
      pageTitle =
        dict?.smart_docs?.draft_confirmation_title ||
        dict?.smart_docs?.draft_title ||
        'Draft Confirmation';
    }

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
  const isBillOfLadingRequested =
    initialStepParam === 'bill-of-lading' ||
    initialStepParam === 'bill_of_lading' ||
    initialStepParam === 'lading' ||
    initialStepParam === 'bl' ||
    initialStepParam === '5';
  const isCustomInvoiceRequested =
    initialStepParam === 'custom-invoice' ||
    initialStepParam === 'custom_invoice' ||
    initialStepParam === 'custom' ||
    initialStepParam === 'invoice' ||
    initialStepParam === '6';

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
          mode={
            isCustomInvoiceRequested || isBillOfLadingRequested || isShipmentRequested || isProformaRequested || isContractRequested
              ? 'contract'
              : 'confirmation'
          }
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
  const isBillOfLadingRequested =
    initialStepParam === 'bill-of-lading' ||
    initialStepParam === 'bill_of_lading' ||
    initialStepParam === 'lading' ||
    initialStepParam === 'bl' ||
    initialStepParam === '5';
  const isCustomInvoiceRequested =
    initialStepParam === 'custom-invoice' ||
    initialStepParam === 'custom_invoice' ||
    initialStepParam === 'custom' ||
    initialStepParam === 'invoice' ||
    initialStepParam === '6';

  try {
    const targetAction = isContractRequested
      ? 'contract'
      : isShipmentRequested || isBillOfLadingRequested || isCustomInvoiceRequested
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
      billOfLadingRes,
      customInvoiceRes,
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
      draftId
        ? smartDocsService.getConfirmation(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isContractRequested || (!initialStepParam && draftId) || draftId)
        ? smartDocsService.getContract(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isProformaRequested || draftId)
        ? smartDocsService.getProforma(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isShipmentRequested || (!initialStepParam && draftId) || draftId)
        ? smartDocsService.getShipmentInstruction(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isBillOfLadingRequested || draftId)
        ? smartDocsService.getBillOfLading(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isCustomInvoiceRequested || draftId)
        ? smartDocsService.getCustomInvoice(draftId, { lang, source: 'web' }, token).catch(() => null)
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
    let initialBillOfLadingData: any = extractBillOfLadingData(billOfLadingRes);
    let initialCustomInvoiceData: any = extractCustomInvoiceData(customInvoiceRes);

    // If initialShipmentInstructionData contains nested contract/confirmation/proforma objects, seed missing data
    if (!initialContractData && initialShipmentInstructionData?.contract && typeof initialShipmentInstructionData.contract === 'object') {
      const ext = extractContractData(initialShipmentInstructionData.contract);
      if (ext) initialContractData = ext;
    }
    if (!initialConfirmationData && initialShipmentInstructionData?.confirmation && typeof initialShipmentInstructionData.confirmation === 'object') {
      const ext = extractConfirmationData(initialShipmentInstructionData.confirmation);
      if (ext) initialConfirmationData = ext;
    }
    if (!initialProformaData && initialShipmentInstructionData?.proforma && typeof initialShipmentInstructionData.proforma === 'object') {
      const ext = extractProformaData(initialShipmentInstructionData.proforma);
      if (ext) initialProformaData = ext;
    }

    // Linked ID Discovery
    let discoveredConfId =
      extractLinkedConfirmationId(initialConfirmationData) ||
      extractLinkedConfirmationId(initialContractData) ||
      extractLinkedConfirmationId(initialProformaData) ||
      extractLinkedConfirmationId(initialShipmentInstructionData) ||
      extractLinkedConfirmationId(initialBillOfLadingData) ||
      extractLinkedConfirmationId(initialCustomInvoiceData);

    let discoveredContractId =
      extractLinkedContractId(initialConfirmationData) ||
      extractLinkedContractId(initialContractData) ||
      extractLinkedContractId(initialProformaData) ||
      extractLinkedContractId(initialShipmentInstructionData) ||
      extractLinkedContractId(initialBillOfLadingData) ||
      extractLinkedContractId(initialCustomInvoiceData);

    let discoveredProformaId =
      extractLinkedProformaId(initialConfirmationData) ||
      extractLinkedProformaId(initialContractData) ||
      extractLinkedProformaId(initialProformaData) ||
      extractLinkedProformaId(initialShipmentInstructionData) ||
      extractLinkedProformaId(initialBillOfLadingData) ||
      extractLinkedProformaId(initialCustomInvoiceData);

    // If stepper returned empty/dummy, check if this workflow is document-rooted or contract-rooted
    if (!isRealStepperList(initialSteps) && stepperTarget && stepperTarget !== 'new-confirmation') {
      try {
        const candidateFallbackActions = ['document', 'contract', 'confirmation'].filter((a) => a !== targetAction);
        for (const fbAction of candidateFallbackActions) {
          const fallbackStepperRes = await smartDocsService
            .getStepperList(
              {
                action: fbAction,
                step: stepperTarget,
                lang,
                source: 'web',
              },
              token
            )
            .catch(() => null);
          const fbSteps = extractStepperList(fallbackStepperRes);
          if (fbSteps.length > 0 && isRealStepperList(fbSteps)) {
            initialSteps = fbSteps;
            break;
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
          initialSteps = mergeStepperWithHidden(steps, initialSteps);
        } else if (steps.length > 0 && !hasRealSteps) {
          initialSteps = steps;
        }
      } catch {
        // non-blocking
      }
    }

    // Step discovery from Stepper and Document data
    const stepperConfirmationStep = initialSteps.find((s) => isConfirmationStep(s)) || null;
    const confId =
      discoveredConfId ||
      extractStepRedirectId(stepperConfirmationStep) ||
      getStepSelfId(stepperConfirmationStep) ||
      extractStepId(stepperConfirmationStep) ||
      initialConfirmationData?.id ||
      stepperTarget ||
      '';

    const stepperContractStep = initialSteps.find((s) => isContractStep(s)) || null;
    const contractId =
      discoveredContractId ||
      stepperContractStep?.contract_id ||
      (stepperContractStep as any)?.contractId ||
      stepperContractStep?.sales_contract_id ||
      extractStepRedirectId(stepperContractStep) ||
      getStepSelfId(stepperContractStep) ||
      extractLinkedContractId(initialConfirmationData) ||
      extractLinkedContractId(initialShipmentInstructionData);

    const stepperProformaStep = initialSteps.find((s) => isProformaStep(s)) || null;
    const proformaId =
      discoveredProformaId ||
      stepperProformaStep?.proforma_id ||
      (stepperProformaStep as any)?.proformaId ||
      stepperProformaStep?.proforma_invoice_id ||
      extractStepRedirectId(stepperProformaStep) ||
      getStepSelfId(stepperProformaStep) ||
      extractLinkedProformaId(initialContractData) ||
      extractLinkedProformaId(initialConfirmationData) ||
      extractLinkedProformaId(initialShipmentInstructionData);

    const stepperShipmentStep = initialSteps.find((s) => isShipmentInstructionStep(s)) || null;
    const shipmentId =
      stepperShipmentStep?.shipment_instruction_id ||
      (stepperShipmentStep as any)?.shipmentInstructionId ||
      stepperShipmentStep?.shipment_id ||
      (stepperShipmentStep as any)?.shipmentId ||
      extractStepRedirectId(stepperShipmentStep) ||
      extractLinkedShipmentInstructionId(initialProformaData) ||
      extractLinkedShipmentInstructionId(initialContractData) ||
      extractLinkedShipmentInstructionId(initialConfirmationData);

    const stepperBillOfLadingStep = initialSteps.find((s) => isBillOfLadingStep(s)) || null;
    const billOfLadingId =
      stepperBillOfLadingStep?.bill_of_lading_id ||
      (stepperBillOfLadingStep as any)?.billOfLadingId ||
      stepperBillOfLadingStep?.lading_id ||
      getStepSelfId(stepperBillOfLadingStep) ||
      extractStepRedirectId(stepperBillOfLadingStep) ||
      extractLinkedBillOfLadingId(initialShipmentInstructionData) ||
      extractLinkedBillOfLadingId(initialProformaData) ||
      extractLinkedBillOfLadingId(initialContractData) ||
      extractLinkedBillOfLadingId(initialConfirmationData);

    const stepperCustomInvoiceStep = initialSteps.find((s) => isCustomInvoiceStep(s)) || null;
    const customInvoiceId =
      stepperCustomInvoiceStep?.custom_invoice_id ||
      (stepperCustomInvoiceStep as any)?.customInvoiceId ||
      stepperCustomInvoiceStep?.invoice_id ||
      getStepSelfId(stepperCustomInvoiceStep) ||
      extractStepRedirectId(stepperCustomInvoiceStep) ||
      extractLinkedCustomInvoiceId(initialBillOfLadingData) ||
      extractLinkedCustomInvoiceId(initialShipmentInstructionData) ||
      extractLinkedCustomInvoiceId(initialProformaData) ||
      extractLinkedCustomInvoiceId(initialContractData) ||
      extractLinkedCustomInvoiceId(initialConfirmationData);

    // Phase 2: Fetch any missing documents in ONE clean parallel round trip!
    const [missingConfRes, missingContractRes, missingProformaRes, missingShipmentRes, missingBillOfLadingRes, missingCustomInvoiceRes] = await Promise.all([
      !initialConfirmationData && confId
        ? smartDocsService.getConfirmation(confId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialContractData && contractId && contractId !== confId
        ? smartDocsService.getContract(contractId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialProformaData && proformaId && proformaId !== confId && proformaId !== contractId
        ? smartDocsService.getProforma(proformaId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialShipmentInstructionData && shipmentId && shipmentId !== confId && shipmentId !== contractId && shipmentId !== proformaId
        ? smartDocsService.getShipmentInstruction(shipmentId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialBillOfLadingData && billOfLadingId && billOfLadingId !== confId && billOfLadingId !== contractId && billOfLadingId !== proformaId && billOfLadingId !== shipmentId
        ? smartDocsService.getBillOfLading(billOfLadingId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialCustomInvoiceData && customInvoiceId && customInvoiceId !== confId && customInvoiceId !== contractId && customInvoiceId !== proformaId && customInvoiceId !== shipmentId && customInvoiceId !== billOfLadingId
        ? smartDocsService.getCustomInvoice(customInvoiceId, { lang, source: 'web' }, token).catch(() => null)
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
    if (missingBillOfLadingRes) {
      const ext = extractBillOfLadingData(missingBillOfLadingRes);
      if (ext) initialBillOfLadingData = ext;
    }
    if (missingCustomInvoiceRes) {
      const ext = extractCustomInvoiceData(missingCustomInvoiceRes);
      if (ext) initialCustomInvoiceData = ext;
    }

    // Pre-fetch buyer consignees and notify parties on server to eliminate client dropdown loading lag
    const effectiveBuyerId =
      initialShipmentInstructionData?.buyer_instruction_id ||
      initialShipmentInstructionData?.buyer_id ||
      (initialBuyers && initialBuyers.length === 1 ? initialBuyers[0].value || initialBuyers[0].id : '');

    let initialConsignees: any[] = [];
    let initialNotifyParties: any[] = [];

    if (effectiveBuyerId) {
      try {
        const [consigneesRes, notifyRes] = await Promise.all([
          smartDocsService.getBuyerConsignees(String(effectiveBuyerId), { lang, source: 'web' }, token).catch(() => null),
          smartDocsService.getBuyerNotifyParties(String(effectiveBuyerId), { lang, source: 'web' }, token).catch(() => null),
        ]);
        if (consigneesRes?.success && Array.isArray(consigneesRes.data)) {
          initialConsignees = consigneesRes.data;
        }
        if (notifyRes?.success && Array.isArray(notifyRes.data)) {
          initialNotifyParties = notifyRes.data;
        }
      } catch {
        // non-blocking
      }
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

    // Ensure initialSteps reflects all loaded document IDs and genuine completed statuses
    initialSteps = initialSteps.map((s) => {
      let updated = { ...s };
      if (isConfirmationStep(s)) {
        if (confId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = confId;
          updated.redirectId = confId;
        }
        const isConfDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialConfirmationData?.status || initialConfirmationData?.document_status || initialConfirmationData?.confirmation_status) ||
          isStatusCompleted(initialShipmentInstructionData?.confirmation?.status) ||
          isStatusCompleted(initialShipmentInstructionData?.confirmation_status);
        if (isConfDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isContractStep(s)) {
        if (contractId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = contractId;
          updated.redirectId = contractId;
        }
        const isContractDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialContractData?.status || initialContractData?.document_status || initialContractData?.contract_status) ||
          isStatusCompleted(initialShipmentInstructionData?.contract?.status) ||
          isStatusCompleted(initialShipmentInstructionData?.contract_status);
        if (isContractDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isProformaStep(s)) {
        if (proformaId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = proformaId;
          updated.redirectId = proformaId;
        }
        const isProformaDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialProformaData?.status || initialProformaData?.document_status || initialProformaData?.proforma_status) ||
          isStatusCompleted(initialShipmentInstructionData?.proforma?.status) ||
          isStatusCompleted(initialShipmentInstructionData?.proforma_status);
        if (isProformaDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isShipmentInstructionStep(s)) {
        if (shipmentId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = shipmentId;
          updated.redirectId = shipmentId;
        }
        const isShipmentDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          (Boolean(initialShipmentInstructionData) && isStatusCompleted(initialShipmentInstructionData?.status || initialShipmentInstructionData?.document_status || initialShipmentInstructionData?.shipment_instruction_status));
        if (isShipmentDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isBillOfLadingStep(s)) {
        if (billOfLadingId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = billOfLadingId;
          updated.redirectId = billOfLadingId;
        }
        const isLadingDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialBillOfLadingData?.status || initialBillOfLadingData?.document_status || initialBillOfLadingData?.bill_of_lading_status || initialBillOfLadingData?.lading_status);
        if (isLadingDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isCustomInvoiceStep(s)) {
        if (customInvoiceId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = customInvoiceId;
          updated.redirectId = customInvoiceId;
        }
        const isCustomInvoiceDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialCustomInvoiceData?.status || initialCustomInvoiceData?.document_status || initialCustomInvoiceData?.custom_invoice_status);
        if (isCustomInvoiceDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      }
      return updated;
    });

    // If this ID is a Contract or Proforma or Shipment or Bill of Lading or Custom Invoice (or step requested), ensure initialStepParam defaults accordingly
    const effectiveStepParam =
      initialStepParam ||
      (isCustomInvoiceRequested
        ? 'custom-invoice'
        : isBillOfLadingRequested
        ? 'bill-of-lading'
        : isShipmentRequested
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
      extractLinkedConfirmationId(initialShipmentInstructionData) ||
      extractLinkedConfirmationId(initialBillOfLadingData) ||
      extractLinkedCustomInvoiceId(initialCustomInvoiceData);

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
              initialSteps={initialSteps && initialSteps.length > 0 ? initialSteps : DEFAULT_WORKFLOW_STEPPER_ITEMS}
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
              initialBillOfLadingData={initialBillOfLadingData}
              initialCustomInvoiceData={initialCustomInvoiceData}
              initialConsignees={initialConsignees}
              initialNotifyParties={initialNotifyParties}
              initialId={draftId || effectiveDraftId}
              initialStepParam={effectiveStepParam}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[DraftPageDataLoader] Fatal rendering error caught:', error);
    const safeDict = await getDictionary(lang).catch(() => ({} as any));

    // Graceful fallback: render workspace with default stepper so "Something went wrong" never crashes the UI
    return (
      <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden custom-scrollbar">
        <div className="w-full pad-for-badges flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
          <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
            <DocumentDraftWorkspace
              lang={lang}
              dict={safeDict}
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
              initialBillOfLadingData={null}
              initialCustomInvoiceData={null}
              initialId={draftId}
              initialStepParam={initialStepParam}
            />
          </div>
        </div>
      </div>
    );
  }
}
