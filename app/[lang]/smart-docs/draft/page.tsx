import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSafeLanguage, getSiteUrl } from '@/lib/seo';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import DocumentDraftWorkspace from '@/components/smart-docs/draft/DocumentDraftWorkspace';
import {
  smartDocsService,
  extractStepperList,
  extractInstructionsData,
  extractProductsData,
  extractPaymentTermsData,
  extractCurrenciesData,
  extractConfirmationData,
} from '@/lib/api/smart-docs.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const activeLang = getSafeLanguage(params?.lang);
  const siteUrl = getSiteUrl();
  const idQuery = searchParams?.id ? `?id=${encodeURIComponent(searchParams.id)}` : '';

  return {
    title: 'Draft Confirmation | Smart Docs | AgriGuru Online',
    description: 'Create and configure smart agricultural trade confirmation drafts.',
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
  searchParams?: Promise<{ id?: string }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const lang = getSafeLanguage(params?.lang);
  const draftId = searchParams?.id ? String(searchParams.id).trim() : '';

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    const redirectSuffix = draftId ? `?id=${encodeURIComponent(draftId)}` : '';
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs/draft${redirectSuffix}`);
  }

  // Fetch dictionary, stepper list, instructions, products, payment terms, currencies & confirmation in parallel
  const [rawDict, stepperRes, instructionsRes, productsRes, paymentTermsRes, currenciesRes, confirmationRes] = await Promise.all([
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
    draftId
      ? smartDocsService
          .getConfirmation(draftId, { lang, source: 'web' }, token)
          .catch((err) => {
            console.error('[SmartDocsDraftPage] Confirmation details fetch error:', err);
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
  const initialConfirmationData = extractConfirmationData(confirmationRes);

  const pageTitle =
    dict?.smart_docs?.draft_title ||
    dict?.smart_docs?.add_new_confirmation ||
    dict?.smart_docs?.add_confirmation ||
    'Draft Confirmation';

  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0.5 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-fit lg:min-h-0 lg:h-full">
          {/* Header Bar */}
          <div className="shrink-0">
            <PageHeader
              title={pageTitle}
              backText={dict?.common?.back || 'Back'}
              backHref={`/${lang}/smart-docs`}
            />
          </div>

          {/* SaaS Single Page Workspace (Fluid on mobile, locked on desktop) */}
          <div className="flex-1 min-h-fit lg:min-h-0 flex flex-col lg:overflow-hidden">
            <DocumentDraftWorkspace
              lang={lang}
              dict={dict}
              initialSteps={initialSteps}
              initialSellers={initialSellers}
              initialBuyers={initialBuyers}
              initialProducts={initialProducts}
              initialPaymentTerms={initialPaymentTerms}
              initialCurrencies={initialCurrencies}
              initialData={initialConfirmationData}
              initialId={draftId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

