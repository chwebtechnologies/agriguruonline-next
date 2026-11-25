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
  extractCommercialInvoiceData,
  extractPackingListData,
  extractPhytoCertificateData,
  extractDocumentListData,
  isConfirmationStep,
  isContractStep,
  isProformaStep,
  isShipmentInstructionStep,
  isBillOfLadingStep,
  isCustomInvoiceStep,
  isCommercialInvoiceStep,
  isPackingListStep,
  isPhytoCertificateStep,
  extractStepId,
  extractStepRedirectId,
  getStepSelfId,
  getShipmentInstructionIdFromStepper,
  getBillOfLadingIdFromStepper,
  getCustomInvoiceIdFromStepper,
  getCommercialInvoiceIdFromStepper,
  getPackingListIdFromStepper,
  getPhytoCertificateIdFromStepper,
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
  extractLinkedCommercialInvoiceId,
  extractLinkedPackingListId,
  extractLinkedPhytoCertificateId,
  mergeStepperWithHidden,
  DEFAULT_CURRENCIES,
  sanitizeDocId,
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
    const isCommercialInvoiceRequested =
      searchParams?.step === 'commercial-invoice' ||
      searchParams?.step === 'commercial_invoice' ||
      searchParams?.step === 'commercial' ||
      searchParams?.step === '7';
    const isPackingListRequested =
      searchParams?.step === 'packing-list' ||
      searchParams?.step === 'packing_list' ||
      searchParams?.step === 'packing' ||
      searchParams?.step === '8';
    const isPhytoCertificateRequested =
      searchParams?.step === 'phyto-certificate' ||
      searchParams?.step === 'phyto_certificate' ||
      searchParams?.step === 'phyto' ||
      searchParams?.step === '9';
    const queryParts = [];
    if (searchParams?.id) queryParts.push(`id=${encodeURIComponent(String(searchParams.id))}`);
    if (searchParams?.step) queryParts.push(`step=${encodeURIComponent(String(searchParams.step))}`);
    const idQuery = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const dict = await getDictionary(activeLang).catch(() => ({} as any));

    let pageTitle = '';
    if (isBillOfLadingRequested) {
      pageTitle = dict?.smart_docs?.draft_bill_of_lading_title || 'Draft Bill of Lading';
    } else if (isPackingListRequested) {
      pageTitle = dict?.smart_docs?.draft_packing_list_title || 'Draft Packing List';
    } else if (isPhytoCertificateRequested) {
      pageTitle = dict?.smart_docs?.draft_phyto_certificate_title || 'Draft Phyto Certificate';
    } else if (isCommercialInvoiceRequested) {
      pageTitle = dict?.smart_docs?.draft_commercial_invoice_title || 'Draft Commercial Invoice';
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
  const rawDraftId = searchParams?.id ? String(searchParams.id).trim() : '';
  const draftId =
    rawDraftId && !/^(new-confirmation|null|undefined|nan|\[object object\]|step-\d+)$/i.test(rawDraftId)
      ? rawDraftId
      : '';
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
  const isCommercialInvoiceRequested =
    initialStepParam === 'commercial-invoice' ||
    initialStepParam === 'commercial_invoice' ||
    initialStepParam === 'commercial' ||
    initialStepParam === '7';
  const isPackingListRequested =
    initialStepParam === 'packing-list' ||
    initialStepParam === 'packing_list' ||
    initialStepParam === 'packing' ||
    initialStepParam === '8';
  const isPhytoCertificateRequested =
    initialStepParam === 'phyto-certificate' ||
    initialStepParam === 'phyto_certificate' ||
    initialStepParam === 'phyto' ||
    initialStepParam === '9';

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
            isPhytoCertificateRequested || isPackingListRequested || isCommercialInvoiceRequested || isCustomInvoiceRequested || isBillOfLadingRequested || isShipmentRequested || isProformaRequested || isContractRequested
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
  const isCommercialInvoiceRequested =
    initialStepParam === 'commercial-invoice' ||
    initialStepParam === 'commercial_invoice' ||
    initialStepParam === 'commercial' ||
    initialStepParam === '7';
  const isPackingListRequested =
    initialStepParam === 'packing-list' ||
    initialStepParam === 'packing_list' ||
    initialStepParam === 'packing' ||
    initialStepParam === '8';
  const isPhytoCertificateRequested =
    initialStepParam === 'phyto-certificate' ||
    initialStepParam === 'phyto_certificate' ||
    initialStepParam === 'phyto' ||
    initialStepParam === '9';

  try {
    const targetAction = isShipmentRequested || isBillOfLadingRequested || isCustomInvoiceRequested || isCommercialInvoiceRequested || isPackingListRequested || isPhytoCertificateRequested
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
      countriesRes,
      confirmationRes,
      contractRes,
      proformaRes,
      shipmentRes,
      billOfLadingRes,
      customInvoiceRes,
      commercialInvoiceRes,
      packingListRes,
      phytoCertificateRes,
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
      smartDocsService.getCountries({ lang, source: 'web' }, token).catch((err) => {
        console.error('[SmartDocsDraftPage] Countries fetch error:', err);
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
      (isCommercialInvoiceRequested || draftId)
        ? smartDocsService.getCommercialInvoice(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isPackingListRequested || draftId)
        ? smartDocsService.getPackingList(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      (isPhytoCertificateRequested || draftId)
        ? smartDocsService.getPhytoCertificate(draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
    ]);

    const dict = rawDict as any;
    let initialSteps = extractStepperList(stepperRes);
    const { sellers: initialSellers, buyers: initialBuyers } = extractInstructionsData(instructionsRes);
    const initialProducts = extractProductsData(productsRes);
    const initialPaymentTerms = extractPaymentTermsData(paymentTermsRes);
    const initialCurrencies = extractCurrenciesData(currenciesRes);
    const initialDocumentList = extractDocumentListData(documentListRes);
    const initialCountries = Array.isArray(countriesRes)
      ? countriesRes
      : Array.isArray((countriesRes as any)?.data)
      ? (countriesRes as any).data
      : Array.isArray((countriesRes as any)?.countries)
      ? (countriesRes as any).countries
      : [];
    let initialConfirmationData = extractConfirmationData(confirmationRes);
    let initialContractData: any = extractContractData(contractRes);
    let initialProformaData: any = extractProformaData(proformaRes);
    let initialShipmentInstructionData: any =
      extractShipmentInstructionData(shipmentRes) ||
      (shipmentRes?.data && typeof shipmentRes.data === 'object' && !Array.isArray(shipmentRes.data) && shipmentRes.success !== false
        ? { ...shipmentRes.data, _is_shipment_loaded: true }
        : null);
    let initialBillOfLadingData: any =
      extractBillOfLadingData(billOfLadingRes) ||
      (billOfLadingRes?.data &&
      typeof billOfLadingRes.data === 'object' &&
      !Array.isArray(billOfLadingRes.data) &&
      billOfLadingRes.success !== false &&
      billOfLadingRes.success !== 0 &&
      billOfLadingRes.status !== false &&
      billOfLadingRes.status !== 0 &&
      !billOfLadingRes.error
        ? { ...billOfLadingRes.data, _is_lading_loaded: true }
        : null);
    let initialCustomInvoiceData: any =
      extractCustomInvoiceData(customInvoiceRes) ||
      (customInvoiceRes?.data && typeof customInvoiceRes.data === 'object' && !Array.isArray(customInvoiceRes.data) && customInvoiceRes.success !== false
        ? { ...customInvoiceRes.data, _is_custom_invoice_loaded: true }
        : null);
    let initialCommercialInvoiceData: any =
      extractCommercialInvoiceData(commercialInvoiceRes) ||
      (commercialInvoiceRes?.data && typeof commercialInvoiceRes.data === 'object' && !Array.isArray(commercialInvoiceRes.data) && commercialInvoiceRes.success !== false
        ? { ...commercialInvoiceRes.data, _is_commercial_invoice_loaded: true }
        : null);
    let initialPackingListData: any =
      extractPackingListData(packingListRes) ||
      (packingListRes?.data && typeof packingListRes.data === 'object' && !Array.isArray(packingListRes.data) && packingListRes.success !== false
        ? { ...packingListRes.data, _is_packing_list_loaded: true }
        : null);
    let initialPhytoCertificateData: any =
      extractPhytoCertificateData(phytoCertificateRes) ||
      (phytoCertificateRes?.data && typeof phytoCertificateRes.data === 'object' && !Array.isArray(phytoCertificateRes.data) && phytoCertificateRes.success !== false
        ? { ...phytoCertificateRes.data, _is_phyto_certificate_loaded: true }
        : null);

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

    const discoveredContractId =
      extractLinkedContractId(initialConfirmationData) ||
      extractLinkedContractId(initialContractData) ||
      extractLinkedContractId(initialProformaData) ||
      extractLinkedContractId(initialShipmentInstructionData) ||
      extractLinkedContractId(initialBillOfLadingData) ||
      extractLinkedContractId(initialCustomInvoiceData);

    const discoveredProformaId =
      extractLinkedProformaId(initialConfirmationData) ||
      extractLinkedProformaId(initialContractData) ||
      extractLinkedProformaId(initialProformaData) ||
      extractLinkedProformaId(initialShipmentInstructionData) ||
      extractLinkedProformaId(initialBillOfLadingData) ||
      extractLinkedProformaId(initialCustomInvoiceData);

    const discoveredCommercialInvoiceId =
      extractLinkedCommercialInvoiceId(initialCustomInvoiceData) ||
      extractLinkedCommercialInvoiceId(initialBillOfLadingData) ||
      extractLinkedCommercialInvoiceId(initialShipmentInstructionData) ||
      extractLinkedCommercialInvoiceId(initialProformaData) ||
      extractLinkedCommercialInvoiceId(initialContractData) ||
      extractLinkedCommercialInvoiceId(initialConfirmationData);

    const discoveredPackingListId =
      extractLinkedPackingListId(initialPackingListData) ||
      extractLinkedPackingListId(initialCommercialInvoiceData) ||
      extractLinkedPackingListId(initialCustomInvoiceData) ||
      extractLinkedPackingListId(initialBillOfLadingData) ||
      extractLinkedPackingListId(initialShipmentInstructionData) ||
      extractLinkedPackingListId(initialProformaData) ||
      extractLinkedPackingListId(initialContractData) ||
      extractLinkedPackingListId(initialConfirmationData);

    const discoveredPhytoCertificateId =
      extractLinkedPhytoCertificateId(initialPhytoCertificateData) ||
      extractLinkedPhytoCertificateId(initialPackingListData) ||
      extractLinkedPhytoCertificateId(initialCommercialInvoiceData) ||
      extractLinkedPhytoCertificateId(initialCustomInvoiceData) ||
      extractLinkedPhytoCertificateId(initialBillOfLadingData) ||
      extractLinkedPhytoCertificateId(initialShipmentInstructionData) ||
      extractLinkedPhytoCertificateId(initialProformaData) ||
      extractLinkedPhytoCertificateId(initialContractData) ||
      extractLinkedPhytoCertificateId(initialConfirmationData);

    // If shipment instruction data was loaded for this draftId, ensure stepper is anchored to document!
    if (initialShipmentInstructionData && stepperTarget && stepperTarget !== 'new-confirmation') {
      try {
        const docStepperRes = await smartDocsService
          .getStepperList(
            {
              action: 'document',
              step: stepperTarget,
              lang,
              source: 'web',
            },
            token
          )
          .catch(() => null);
        const docSteps = extractStepperList(docStepperRes);
        if (docSteps.length > 0 && isRealStepperList(docSteps)) {
          initialSteps = docSteps;
        }
      } catch {
        // non-blocking
      }
    }

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

    // If initial stepper returned dummy/pending steps or was empty, re-fetch with discovered confirmation or contract ID.
    // STRICT RULE: Only re-fetch if initial stepper did NOT return real steps!
    // Never overwrite an existing real stepper (which holds this specific document's or partial shipment's steps) with a parent contract/confirmation stepper!
    const hasRealSteps = isRealStepperList(initialSteps);
    const discoveredAction = discoveredConfId ? 'confirmation' : discoveredContractId ? 'contract' : 'confirmation';
    const targetStep = discoveredConfId || discoveredContractId || '';

    if (targetStep && !hasRealSteps) {
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
    const isDocRequested =
      isShipmentRequested ||
      isBillOfLadingRequested ||
      isCustomInvoiceRequested ||
      isCommercialInvoiceRequested ||
      isPackingListRequested;

    const stepperConfirmationStep = initialSteps.find((s) => isConfirmationStep(s)) || null;
    const confId =
      discoveredConfId ||
      initialConfirmationData?.id ||
      extractStepRedirectId(stepperConfirmationStep) ||
      getStepSelfId(stepperConfirmationStep) ||
      extractStepId(stepperConfirmationStep) ||
      (!isContractRequested && !isDocRequested ? draftId : '') ||
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
      extractLinkedContractId(initialShipmentInstructionData) ||
      (isContractRequested && !initialConfirmationData ? draftId : '');

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
      extractLinkedProformaId(initialShipmentInstructionData) ||
      (isProformaRequested && !initialConfirmationData && !initialContractData ? draftId : '');

    const stepperShipmentStep = initialSteps.find((s) => isShipmentInstructionStep(s)) || null;
    const shipmentId =
      stepperShipmentStep?.shipment_instruction_id ||
      (stepperShipmentStep as any)?.shipmentInstructionId ||
      stepperShipmentStep?.shipment_id ||
      (stepperShipmentStep as any)?.shipmentId ||
      extractStepRedirectId(stepperShipmentStep) ||
      getStepSelfId(stepperShipmentStep) ||
      extractLinkedShipmentInstructionId(initialProformaData) ||
      extractLinkedShipmentInstructionId(initialContractData) ||
      extractLinkedShipmentInstructionId(initialConfirmationData) ||
      (isShipmentRequested && !initialConfirmationData && !initialContractData ? draftId : '');

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
      extractLinkedBillOfLadingId(initialConfirmationData) ||
      (isBillOfLadingRequested && !initialConfirmationData && !initialContractData ? draftId : '');

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
      extractLinkedCustomInvoiceId(initialConfirmationData) ||
      (isCustomInvoiceRequested && !initialConfirmationData && !initialContractData ? draftId : '');

    const stepperCommercialInvoiceStep = initialSteps.find((s) => isCommercialInvoiceStep(s)) || null;
    const commercialInvoiceId =
      stepperCommercialInvoiceStep?.commercial_invoice_id ||
      (stepperCommercialInvoiceStep as any)?.commercialInvoiceId ||
      getStepSelfId(stepperCommercialInvoiceStep) ||
      getCommercialInvoiceIdFromStepper(initialSteps) ||
      extractStepRedirectId(stepperCommercialInvoiceStep) ||
      extractLinkedCommercialInvoiceId(initialCustomInvoiceData) ||
      extractLinkedCommercialInvoiceId(initialBillOfLadingData) ||
      extractLinkedCommercialInvoiceId(initialShipmentInstructionData) ||
      extractLinkedCommercialInvoiceId(initialProformaData) ||
      extractLinkedCommercialInvoiceId(initialContractData) ||
      extractLinkedCommercialInvoiceId(initialConfirmationData) ||
      (isCommercialInvoiceRequested && !initialConfirmationData && !initialContractData ? draftId : '');

    const stepperPackingListStep = initialSteps.find((s) => isPackingListStep(s)) || null;
    const packingListId =
      stepperPackingListStep?.packing_list_id ||
      (stepperPackingListStep as any)?.packingListId ||
      getStepSelfId(stepperPackingListStep) ||
      getPackingListIdFromStepper(initialSteps) ||
      extractStepRedirectId(stepperPackingListStep) ||
      extractLinkedPackingListId(initialCommercialInvoiceData) ||
      extractLinkedPackingListId(initialCustomInvoiceData) ||
      extractLinkedPackingListId(initialBillOfLadingData) ||
      extractLinkedPackingListId(initialShipmentInstructionData) ||
      extractLinkedPackingListId(initialProformaData) ||
      extractLinkedPackingListId(initialContractData) ||
      extractLinkedPackingListId(initialConfirmationData) ||
      (isPackingListRequested && !initialConfirmationData && !initialContractData ? draftId : '');

    const stepperPhytoCertificateStep = initialSteps.find((s) => isPhytoCertificateStep(s)) || null;
    const phytoCertificateId =
      stepperPhytoCertificateStep?.phyto_certificate_id ||
      (stepperPhytoCertificateStep as any)?.phytoCertificateId ||
      getStepSelfId(stepperPhytoCertificateStep) ||
      getPhytoCertificateIdFromStepper(initialSteps) ||
      extractStepRedirectId(stepperPhytoCertificateStep) ||
      discoveredPhytoCertificateId ||
      (isPhytoCertificateRequested && !initialConfirmationData && !initialContractData ? draftId : '');

    // Phase 2: Fetch any missing documents in ONE clean parallel round trip!
    const [missingConfRes, missingContractRes, missingProformaRes, missingShipmentRes, missingBillOfLadingRes, missingCustomInvoiceRes, missingCommercialInvoiceRes, missingPackingListRes, missingPhytoCertificateRes] = await Promise.all([
      !initialConfirmationData && (confId || draftId)
        ? smartDocsService.getConfirmation(confId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialContractData && (contractId || confId || (isContractRequested ? draftId : ''))
        ? smartDocsService.getContract(contractId || confId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialProformaData && (proformaId || confId || (isProformaRequested ? draftId : ''))
        ? smartDocsService.getProforma(proformaId || confId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialShipmentInstructionData && (shipmentId || confId || (isShipmentRequested ? draftId : ''))
        ? smartDocsService.getShipmentInstruction(shipmentId || confId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialBillOfLadingData && (billOfLadingId || (isBillOfLadingRequested ? draftId : ''))
        ? smartDocsService.getBillOfLading(billOfLadingId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialCustomInvoiceData && (customInvoiceId || (isCustomInvoiceRequested ? draftId : ''))
        ? smartDocsService.getCustomInvoice(customInvoiceId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialCommercialInvoiceData && (commercialInvoiceId || (isCommercialInvoiceRequested ? draftId : ''))
        ? smartDocsService.getCommercialInvoice(commercialInvoiceId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialPackingListData && (packingListId || (isPackingListRequested ? draftId : ''))
        ? smartDocsService.getPackingList(packingListId || draftId, { lang, source: 'web' }, token).catch(() => null)
        : Promise.resolve(null),
      !initialPhytoCertificateData && (phytoCertificateId || (isPhytoCertificateRequested ? draftId : ''))
        ? smartDocsService.getPhytoCertificate(phytoCertificateId || draftId, { lang, source: 'web' }, token).catch(() => null)
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
      const ext =
        extractShipmentInstructionData(missingShipmentRes) ||
        (missingShipmentRes?.data && typeof missingShipmentRes.data === 'object' && !Array.isArray(missingShipmentRes.data) && missingShipmentRes.success !== false
          ? { ...missingShipmentRes.data, _is_shipment_loaded: true }
          : null);
      if (ext) initialShipmentInstructionData = ext;
    }
    if (missingBillOfLadingRes) {
      const ext =
        extractBillOfLadingData(missingBillOfLadingRes) ||
        (missingBillOfLadingRes?.data &&
        typeof missingBillOfLadingRes.data === 'object' &&
        !Array.isArray(missingBillOfLadingRes.data) &&
        missingBillOfLadingRes.success !== false &&
        missingBillOfLadingRes.success !== 0 &&
        missingBillOfLadingRes.status !== false &&
        missingBillOfLadingRes.status !== 0 &&
        !missingBillOfLadingRes.error
          ? { ...missingBillOfLadingRes.data, _is_lading_loaded: true }
          : null);
      if (ext) initialBillOfLadingData = ext;
    }
    if (missingCustomInvoiceRes) {
      const ext =
        extractCustomInvoiceData(missingCustomInvoiceRes) ||
        (missingCustomInvoiceRes?.data && typeof missingCustomInvoiceRes.data === 'object'
          ? { ...missingCustomInvoiceRes.data, _is_custom_invoice_loaded: true }
          : null);
      if (ext) initialCustomInvoiceData = ext;
    }
    if (missingCommercialInvoiceRes) {
      const ext =
        extractCommercialInvoiceData(missingCommercialInvoiceRes) ||
        (missingCommercialInvoiceRes?.data && typeof missingCommercialInvoiceRes.data === 'object'
          ? { ...missingCommercialInvoiceRes.data, _is_commercial_invoice_loaded: true }
          : null);
      if (ext) initialCommercialInvoiceData = ext;
    }
    if (missingPackingListRes) {
      const ext =
        extractPackingListData(missingPackingListRes) ||
        (missingPackingListRes?.data && typeof missingPackingListRes.data === 'object'
          ? { ...missingPackingListRes.data, _is_packing_list_loaded: true }
          : null);
      if (ext) initialPackingListData = ext;
    }
    if (missingPhytoCertificateRes) {
      const ext =
        extractPhytoCertificateData(missingPhytoCertificateRes) ||
        (missingPhytoCertificateRes?.data && typeof missingPhytoCertificateRes.data === 'object'
          ? { ...missingPhytoCertificateRes.data, _is_phyto_certificate_loaded: true }
          : null);
      if (ext) initialPhytoCertificateData = ext;
    }

    // Pre-fetch buyer consignees and notify parties strictly for this trade's Importer (buyer_instruction_id).
    // Strictly prioritize buyer_instruction_id from Shipment Instruction response; NEVER default to initialBuyers[0].
    const effectiveBuyerId = sanitizeDocId(
      initialShipmentInstructionData?.buyer_instruction_id ||
      initialShipmentInstructionData?.buyerInstructionId ||
      initialShipmentInstructionData?.shipment_instruction?.buyer_instruction_id ||
      initialShipmentInstructionData?.buyer?.buyer_instruction_id ||
      initialProformaData?.buyer_instruction_id ||
      initialProformaData?.buyerInstructionId ||
      initialContractData?.buyer_instruction_id ||
      initialContractData?.buyerInstructionId ||
      initialConfirmationData?.buyer_instruction_id ||
      initialConfirmationData?.buyerInstructionId ||
      initialShipmentInstructionData?.buyer_id ||
      initialShipmentInstructionData?.buyerId ||
      initialProformaData?.buyer_id ||
      initialContractData?.buyer_id ||
      initialConfirmationData?.buyer_id ||
      ''
    );

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
      } else if (isCommercialInvoiceStep(s)) {
        if (commercialInvoiceId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = commercialInvoiceId;
          updated.redirectId = commercialInvoiceId;
        }
        const isCommercialInvoiceDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialCommercialInvoiceData?.status || initialCommercialInvoiceData?.document_status || initialCommercialInvoiceData?.commercial_invoice_status);
        if (isCommercialInvoiceDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isPackingListStep(s)) {
        if (packingListId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = packingListId;
          updated.redirectId = packingListId;
        }
        const isPackingListDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialPackingListData?.status || initialPackingListData?.document_status || initialPackingListData?.packing_list_status);
        if (isPackingListDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      } else if (isPhytoCertificateStep(s)) {
        if (phytoCertificateId && (!updated.redirect_id || updated.redirect_id === 'new-confirmation')) {
          updated.redirect_id = phytoCertificateId;
          updated.redirectId = phytoCertificateId;
        }
        const isPhytoDone =
          normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed' ||
          isStatusCompleted(initialPhytoCertificateData?.status || initialPhytoCertificateData?.document_status || initialPhytoCertificateData?.phyto_certificate_status);
        if (isPhytoDone) {
          updated.status = 'completed';
        } else if (s.status) {
          updated.status = s.status;
        }
      }
      if (updated.status === 'completed' || (updated.redirect_id && updated.redirect_id !== 'new-confirmation' && !/^(null|undefined|step-\d+)$/i.test(String(updated.redirect_id)))) {
        updated.is_enabled = true;
        updated.isEnabled = true;
      }
      return updated;
    });

    // If this ID is a Contract or Proforma or Shipment or Bill of Lading or Custom Invoice or Commercial Invoice or Packing List or Phyto Certificate (or step requested), ensure initialStepParam defaults accordingly
    const effectiveStepParam =
      initialStepParam ||
      (isPhytoCertificateRequested
        ? 'phyto-certificate'
        : isPackingListRequested
        ? 'packing-list'
        : isCommercialInvoiceRequested
        ? 'commercial-invoice'
        : isCustomInvoiceRequested
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
              key={`${draftId || effectiveDraftId || 'draft'}-${effectiveStepParam || 'default'}`}
              lang={lang}
              dict={dict}
              initialSteps={initialSteps && initialSteps.length > 0 ? initialSteps : DEFAULT_WORKFLOW_STEPPER_ITEMS}
              initialSellers={initialSellers}
              initialBuyers={initialBuyers}
              initialProducts={initialProducts}
              initialPaymentTerms={initialPaymentTerms}
              initialCurrencies={initialCurrencies}
              initialDocumentList={initialDocumentList}
              initialCountries={initialCountries}
              initialData={initialConfirmationData}
              initialContractData={initialContractData}
              initialProformaData={initialProformaData}
              initialShipmentInstructionData={initialShipmentInstructionData}
              initialBillOfLadingData={initialBillOfLadingData}
              initialCustomInvoiceData={initialCustomInvoiceData}
              initialCommercialInvoiceData={initialCommercialInvoiceData}
              initialPackingListData={initialPackingListData}
              initialPhytoCertificateData={initialPhytoCertificateData}
              initialConsignees={initialConsignees}
              initialNotifyParties={initialNotifyParties}
              initialConsigneesBuyerId={effectiveBuyerId}
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
              key={`${draftId || 'draft'}-${initialStepParam || 'default'}`}
              lang={lang}
              dict={safeDict}
              initialSteps={DEFAULT_WORKFLOW_STEPPER_ITEMS}
              initialSellers={[]}
              initialBuyers={[]}
              initialProducts={[]}
              initialPaymentTerms={[]}
              initialCurrencies={DEFAULT_CURRENCIES}
              initialDocumentList={[]}
              initialCountries={[]}
              initialData={null}
              initialContractData={null}
              initialProformaData={null}
              initialShipmentInstructionData={null}
              initialBillOfLadingData={null}
              initialCustomInvoiceData={null}
              initialCommercialInvoiceData={null}
              initialPackingListData={null}
              initialPhytoCertificateData={null}
              initialId={draftId}
              initialStepParam={initialStepParam}
            />
          </div>
        </div>
      </div>
    );
  }
}
