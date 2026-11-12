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
  extractDocumentListData,
  isContractStep,
  isProformaStep,
  extractStepId,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  extractLinkedConfirmationId,
  extractLinkedContractId,
  extractLinkedProformaId,
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
    const queryParts = [];
    if (searchParams?.id) queryParts.push(`id=${encodeURIComponent(String(searchParams.id))}`);
    if (searchParams?.step) queryParts.push(`step=${encodeURIComponent(String(searchParams.step))}`);
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
  } catch {
    return {
      title: 'Smart Docs | AgriGuru Online',
    };
  }
}

export default async function SmartDocsDraftPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ id?: string; step?: string }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const lang = getSafeLanguage(params?.lang);
  const draftId = searchParams?.id ? String(searchParams.id).trim() : '';
  const initialStepParam = searchParams?.step ? String(searchParams.step).trim() : '';
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
    <Suspense fallback={<DocumentDraftSkeleton mode={isContractRequested ? 'contract' : 'confirmation'} />}>
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

  try {
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
      proformaRes,
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
      draftId && isProformaRequested
        ? smartDocsService
            .getProforma(draftId, { lang, source: 'web' }, token)
            .catch((err) => {
              console.warn('[SmartDocsDraftPage] Proforma details fetch error:', err);
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
    let initialProformaData = extractProformaData(proformaRes);

    // SCENARIO 0: If draftId was in URL but neither confirmation nor contract succeeded,
    // draftId might be a direct proforma ID. Attempt to fetch proforma data to discover linkedConfId.
    if (draftId && !initialConfirmationData && !initialContractData && !initialProformaData) {
      try {
        const directProformaRes = await smartDocsService.getProforma(draftId, { lang, source: 'web' }, token);
        if (directProformaRes) {
          const extracted = extractProformaData(directProformaRes);
          if (extracted) {
            initialProformaData = extracted;
          }
        }
      } catch {
        // non-blocking
      }
    }

    // SCENARIO 1: draftId in URL was a Contract ID or Proforma ID
    const linkedConfId =
      extractLinkedConfirmationId(initialContractData) ||
      extractLinkedConfirmationId(initialProformaData);

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

      if (initialSteps.length <= 1) {
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

    // SCENARIO 2: Contract data not loaded, but linked contract ID is discoverable
    const stepperContractStep = initialSteps.find((s, idx) => isContractStep(s, idx));
    const stepperContractId =
      extractStepId(stepperContractStep) ||
      extractLinkedContractId(initialConfirmationData) ||
      extractLinkedContractId(initialProformaData);

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

    // SCENARIO 3: Proforma Step requested and proforma data not yet loaded
    const stepperProformaStep = initialSteps.find((s, idx) => isProformaStep(s, idx));
    const stepperProformaId =
      extractStepId(stepperProformaStep) ||
      extractLinkedProformaId(initialContractData) ||
      extractLinkedProformaId(initialConfirmationData);

    if (
      isProformaRequested &&
      !initialProformaData &&
      stepperProformaId &&
      stepperProformaId !== draftId &&
      stepperProformaId !== stepperContractId &&
      stepperProformaId !== linkedConfId
    ) {
      try {
        const proformaDetailsRes = await smartDocsService.getProforma(
          stepperProformaId,
          { lang, source: 'web' },
          token
        );
        if (proformaDetailsRes) {
          const extracted = extractProformaData(proformaDetailsRes);
          if (extracted) {
            initialProformaData = extracted;
          }
        }
      } catch {
        // non-blocking
      }
    }

    // SCENARIO 4: Stepper list is still empty (new contract/confirmation draft, or API glitch)
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

    // The workspace root ID must ALWAYS be the Confirmation ID anchoring this entire workflow.
    // Never pass stepperContractId or stepperProformaId as initialId.
    const effectiveDraftId =
      initialConfirmationData?.id ||
      initialConfirmationData?._id ||
      linkedConfId ||
      (!isContractRequested && !isProformaRequested ? draftId : '') ||
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
              initialId={effectiveDraftId}
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
              initialId={draftId}
              initialStepParam={initialStepParam}
            />
          </div>
        </div>
      </div>
    );
  }
}
