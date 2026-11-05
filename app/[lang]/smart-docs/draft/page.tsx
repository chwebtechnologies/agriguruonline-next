import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
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
  extractDocumentListData,
  isContractStep,
  extractStepId,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  extractLinkedConfirmationId,
  extractLinkedContractId,
} from '@/lib/api/smart-docs.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ id?: string; step?: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const activeLang = getSafeLanguage(params?.lang);
  const siteUrl = getSiteUrl();
  const isContractRequested = searchParams?.step === 'contract' || searchParams?.step === '2';
  const isProformaRequested = searchParams?.step === 'proforma' || searchParams?.step === '3';
  const queryParts = [];
  if (searchParams?.id) queryParts.push(`id=${encodeURIComponent(searchParams.id)}`);
  if (searchParams?.step) queryParts.push(`step=${encodeURIComponent(searchParams.step)}`);
  const idQuery = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  const pageTitle = isProformaRequested
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
}

export default async function SmartDocsDraftPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ id?: string; step?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialStepParam = searchParams?.step ? String(searchParams.step).trim() : '';
  const isContractRequested = initialStepParam === 'contract' || initialStepParam === '2';
  const isProformaRequested = initialStepParam === 'proforma' || initialStepParam === '3';

  return (
    <Suspense fallback={<DocumentDraftSkeleton mode={isContractRequested ? 'contract' : 'confirmation'} />}>
      <DraftPageDataLoader {...props} />
    </Suspense>
  );
}

async function DraftPageDataLoader(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ id?: string; step?: string }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const lang = getSafeLanguage(params?.lang);
  const draftId = searchParams?.id ? String(searchParams.id).trim() : '';
  const initialStepParam = searchParams?.step ? String(searchParams.step).trim() : '';
  const isContractRequested = initialStepParam === 'contract' || initialStepParam === '2';
  const isProformaRequested = initialStepParam === 'proforma' || initialStepParam === '3';

  const token = await getValidAuthToken();

  if (!token) {
    const redirectParts = [];
    if (draftId) redirectParts.push(`id=${encodeURIComponent(draftId)}`);
    if (initialStepParam) redirectParts.push(`step=${encodeURIComponent(initialStepParam)}`);
    const redirectSuffix = redirectParts.length > 0 ? `?${redirectParts.join('&')}` : '';
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs/draft${redirectSuffix}`);
  }

  // Fetch dictionary, stepper list, instructions, products, payment terms, currencies, documents & confirmation in parallel
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
  ] = await Promise.all([
    getDictionary(lang).catch(() => ({})),
    smartDocsService
      .getStepperList(
        {
          action: 'confirmation',
          step: draftId || 'new-confirmation',
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Stepper fetch error:', err);
        return null;
      }),
    smartDocsService
      .getInstructions(
        {
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Instructions fetch error:', err);
        return null;
      }),
    smartDocsService
      .getProducts(
        {
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Products fetch error:', err);
        return null;
      }),
    smartDocsService
      .getPaymentTerms(
        {
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Payment terms fetch error:', err);
        return null;
      }),
    smartDocsService
      .getCurrencies(
        {
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Currencies fetch error:', err);
        return null;
      }),
    smartDocsService
      .getDocumentListForSelection(
        {
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Document list fetch error:', err);
        return null;
      }),
    draftId
      ? smartDocsService
          .getConfirmation(draftId, { lang, source: 'web' }, token)
          .catch((err) => {
            console.error('[SmartDocsDraftPage] Confirmation details fetch error:', err);
            return null;
          })
      : Promise.resolve(null),
    draftId
      ? smartDocsService
          .getContract(draftId, { lang, source: 'web' }, token)
          .catch((err) => {
            console.error('[SmartDocsDraftPage] Contract details fetch error:', err);
            return null;
          })
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
  let initialContractData = extractContractData(contractRes);

  // SCENARIO 1: draftId in URL was a Contract ID
  // In this case, initialContractData is populated, but stepper list was called with a contract ID
  // (which returns empty from the confirmation-based stepper API).
  // Find linked confirmation ID from initialContractData and re-fetch stepper & confirmation!
  const linkedConfId = extractLinkedConfirmationId(initialContractData);

  if (linkedConfId && String(linkedConfId) !== draftId) {
    if (!initialConfirmationData) {
      try {
        const confRes = await smartDocsService.getConfirmation(
          String(linkedConfId),
          { lang, source: 'web' },
          token
        );
        if (confRes) {
          const extracted = extractConfirmationData(confRes);
          if (extracted) {
            initialConfirmationData = extracted;
          }
        }
      } catch (err) {
        console.error('[SmartDocsDraftPage] Linked confirmation fetch error:', err);
      }
    }

    if (initialSteps.length === 0) {
      try {
        const confStepperRes = await smartDocsService.getStepperList(
          {
            action: 'confirmation',
            step: String(linkedConfId),
            lang,
            source: 'web',
          },
          token
        );
        const fetchedSteps = extractStepperList(confStepperRes);
        if (fetchedSteps.length > 0) {
          initialSteps = fetchedSteps;
        }
      } catch (err) {
        console.error('[SmartDocsDraftPage] Linked stepper fetch error:', err);
      }
    }
  }

  // SCENARIO 2: draftId was a Confirmation ID and Contract Step is requested
  // In this case, initialConfirmationData is present and initialSteps has the contract step.
  // Extract contract ID from stepper contract step and fetch contract data!
  const stepperContractStep = initialSteps.find((s, idx) => isContractStep(s, idx));
  const stepperContractId = extractStepId(stepperContractStep) || extractLinkedContractId(initialConfirmationData);

  if (!initialContractData && stepperContractId && stepperContractId !== draftId) {
    try {
      const contractDetailsRes = await smartDocsService.getContract(
        stepperContractId,
        { lang, source: 'web' },
        token
      );
      if (contractDetailsRes) {
        const extracted = extractContractData(contractDetailsRes);
        if (extracted) {
          initialContractData = extracted;
        }
      }
    } catch {
      // non-blocking
    }
  }

  // SCENARIO 3: Stepper list is still empty (new contract/confirmation draft, or API glitch)
  // Fall back to template stepper list so "No Documents in Workflow" NEVER appears!
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

  // Ultimate fallback to guarantee stepper is never empty on hard refresh
  if (initialSteps.length === 0) {
    initialSteps = DEFAULT_WORKFLOW_STEPPER_ITEMS;
  }

  // If this ID is a Contract or Proforma (or step requested), ensure initialStepParam defaults accordingly
  const effectiveStepParam =
    initialStepParam ||
    (isProformaRequested
      ? 'proforma'
      : isContractRequested
      ? 'contract'
      : initialContractData && !initialConfirmationData
      ? 'contract'
      : undefined);

  const effectiveDraftId =
    isProformaRequested
      ? (draftId || stepperContractId || '')
      : isContractRequested
      ? (stepperContractId || (initialContractData && draftId) || draftId || '')
      : (initialConfirmationData?.id || initialConfirmationData?._id || linkedConfId || draftId || '');

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
            initialId={effectiveDraftId}
            initialStepParam={effectiveStepParam}
          />
        </div>
      </div>
    </div>
  );
}

