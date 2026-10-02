import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ForceLogout } from '@/components/auth/ForceLogout';
import { AIPredictClient } from '@/app/[lang]/ai-predict/AIPredictClient';
import { getDictionary } from '@/app/[lang]/dictionaries';

import { getUserAiPredicts } from '@/lib/user-data';
import { withTimeout } from '@/lib/api-utils';

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'ai_predicts',
    pathname: 'ai-predict',
    lang,
    noIndex: true,
  });
}

export default async function AIPredictPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/ai-predict`);
  }

  const [predictsList, dict] = await Promise.all([
    withTimeout(getUserAiPredicts(token, lang), 2500, []),
    getDictionary(lang),
  ]);

  return (
    <div className="bg-background text-foreground transition-theme pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={dict.common?.ai_predict || "AI Predict"} backText={dict.common?.back || "Back"} />

          <AIPredictClient 
            dict={dict.common}
            initialPredicts={predictsList.map((predict: any) => ({
              id: predict.id,
              favourite_product_id: predict.favourite_product_id,
              favourite_record_id: predict.favourite_record_id,
              favourite_port_id: predict.favourite_port_id,
              favorite_product_id: predict.favorite_product_id,
              favorite_port_id: predict.favorite_port_id,
              product_id: predict.product_id,
              freight_id: predict.freight_id,
              analysis: predict.analysis || predict.ai_analysis || predict.description || predict.content,
              created_at: predict.created_at,
              alert_type: predict.alert_type,
              alert_price: predict.alert_price,
              target_price: predict.target_price,
              current_price: predict.current_price,
              price: predict.price,
              threshold: predict.threshold,
              shipping_container: predict.shipping_container,
              container_type: predict.container_type,
              product: predict.product ? { name: predict.product.name } : undefined,
              product_name: predict.product_name,
              commodity: predict.commodity ? { name: predict.commodity.name } : undefined,
              category: predict.category ? { name: predict.category.name } : undefined,
              commodity_name: predict.commodity_name,
              name: predict.name,
              title: predict.title,
              shipping_term: predict.shipping_term,
              incoterm: typeof predict.incoterm === 'string' ? predict.incoterm : (predict.incoterm ? { name: predict.incoterm.name } : undefined),
              loading_port: predict.loading_port ? {
                name: predict.loading_port.name,
                country: predict.loading_port.country ? {
                  flag: predict.loading_port.country.flag
                } : undefined
              } : undefined,
              origin: predict.origin ? {
                name: predict.origin.name,
                country: predict.origin.country ? {
                  flag: predict.origin.country.flag
                } : undefined
              } : undefined,
              origin_name: predict.origin_name,
              destination_port: predict.destination_port ? {
                name: predict.destination_port.name,
                country: predict.destination_port.country ? {
                  flag: predict.destination_port.country.flag
                } : undefined
              } : undefined,
              destination: predict.destination ? {
                name: predict.destination.name,
                country: predict.destination.country ? {
                  flag: predict.destination.country.flag
                } : undefined
              } : undefined,
              destination_name: predict.destination_name
            }))} 
            lang={lang} 
          />

        </div>
      </div>
    </div>
  );
}
