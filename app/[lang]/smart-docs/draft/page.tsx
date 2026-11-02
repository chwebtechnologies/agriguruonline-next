import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSafeLanguage, getSiteUrl } from '@/lib/seo';
import { getDictionary } from '@/app/[lang]/dictionaries';
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
  const queryParts = [];
  if (searchParams?.id) queryParts.push(`id=${encodeURIComponent(searchParams.id)}`);
  if (searchParams?.step) queryParts.push(`step=${encodeURIComponent(searchParams.step)}`);
  const idQuery = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  return {
    title: `${isContractRequested ? 'Draft Contract' : 'Draft Confirmation'} | Smart Docs | AgriGuru Online`,
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

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

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
  const initialSteps = extractStepperList(stepperRes);
  const { sellers: initialSellers, buyers: initialBuyers } = extractInstructionsData(instructionsRes);
  const initialProducts = extractProductsData(productsRes);
  const initialPaymentTerms = extractPaymentTermsData(paymentTermsRes);
  const initialCurrencies = extractCurrenciesData(currenciesRes);
  const initialDocumentList = extractDocumentListData(documentListRes);
  const initialConfirmationData = extractConfirmationData(confirmationRes);
  let initialContractData = extractContractData(contractRes);

  const stepperContractStep = initialSteps.find((s, idx) => isContractStep(s, idx));
  const stepperContractId = extractStepId(stepperContractStep);

  // If initialContractData wasn't fetched yet (because draftId in URL was confirmation ID)
  // and stepper has a valid contract step ID, fetch the contract data immediately!
  if (!initialContractData && stepperContractId && stepperContractId !== draftId) {
    try {
      const contractDetailsRes = await smartDocsService.getContract(
        stepperContractId,
        { lang, source: 'web' },
        token
      );
      if (contractDetailsRes?.success && contractDetailsRes.data) {
        initialContractData = extractContractData(contractDetailsRes.data);
      }
    } catch {
      // non-blocking
    }
  }

  // If this ID is a Contract (or contract step requested), ensure initialStepParam defaults to contract
  const effectiveStepParam =
    initialStepParam ||
    (isContractRequested
      ? 'contract'
      : initialContractData && !initialConfirmationData
      ? 'contract'
      : undefined);

  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden">
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
            initialId={draftId}
            initialStepParam={effectiveStepParam}
          />
        </div>
      </div>
    </div>
  );
}

