import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ForceLogout } from '@/components/auth/ForceLogout';
import { AlertsClient } from './AlertsClient';

import { getUserAlerts } from '@/lib/user-data';

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'alerts_setups',
    pathname: 'alerts-setups',
    lang,
    noIndex: true,
  });
}

export default async function AlertsSetupsPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/alerts-setups`);
  }

  const alertsList = await getUserAlerts(token, lang);

  return (
    <div className="bg-background text-foreground transition-theme pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Alerts Setups" backText="Back" />

          <AlertsClient 
            initialAlerts={alertsList.map((alert: any) => ({
              id: alert.id,
              favourite_product_id: alert.favourite_product_id,
              freight_id: alert.freight_id,
              product_id: alert.product_id,
              favourite_record_id: alert.favourite_record_id,
              favorite_product_id: alert.favorite_product_id,
              status: alert.status,
              is_triggered: alert.is_triggered,
              created_at: alert.created_at,
              alert_type: alert.alert_type || alert.type,
              type: alert.type,
              freight_pmt: alert.freight_pmt,
              pmt_price: alert.pmt_price,
              current_price: alert.current_price,
              price: alert.price,
              target_price: alert.target_price,
              shipping_container: alert.shipping_container,
              container_type: alert.container_type,
              equipment_type: alert.equipment_type,
              alert_price: alert.alert_price,
              target_freight: alert.target_freight,
              freight_rate: alert.freight_rate,
              load_type: alert.load_type,
              shipment_type: alert.shipment_type,
              loading_port: alert.loading_port ? {
                name: alert.loading_port.name,
                country: alert.loading_port.country ? {
                  flag: alert.loading_port.country.flag
                } : undefined
              } : undefined,
              pol: alert.pol ? {
                name: alert.pol.name,
                country: alert.pol.country ? {
                  flag: alert.pol.country.flag
                } : undefined
              } : undefined,
              pol_name: alert.pol_name,
              destination_port: alert.destination_port ? {
                name: alert.destination_port.name,
                country: alert.destination_port.country ? {
                  flag: alert.destination_port.country.flag
                } : undefined
              } : undefined,
              pod: alert.pod ? {
                name: alert.pod.name,
                country: alert.pod.country ? {
                  flag: alert.pod.country.flag
                } : undefined
              } : undefined,
              pod_name: alert.pod_name,
              product: alert.product ? { name: alert.product.name } : undefined,
              product_name: alert.product_name,
              commodity: alert.commodity ? { name: alert.commodity.name } : undefined,
              category: alert.category ? { name: alert.category.name } : undefined,
              commodity_name: alert.commodity_name,
              name: alert.name,
              title: alert.title,
              threshold: alert.threshold,
              shipping_term: alert.shipping_term,
              incoterm: typeof alert.incoterm === 'string' ? alert.incoterm : (alert.incoterm ? { name: alert.incoterm.name } : undefined),
              origin: alert.origin ? {
                name: alert.origin.name,
                country: alert.origin.country ? {
                  flag: alert.origin.country.flag
                } : undefined
              } : undefined,
              origin_name: alert.origin_name,
              destination: alert.destination ? {
                name: alert.destination.name,
                country: alert.destination.country ? {
                  flag: alert.destination.country.flag
                } : undefined
              } : undefined,
              destination_name: alert.destination_name
            }))} 
            lang={lang} 
          />

        </div>
      </div>
    </div>
  );
}
