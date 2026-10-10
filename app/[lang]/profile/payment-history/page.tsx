import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import PaymentHistoryClient from '@/components/profile/PaymentHistoryClient';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import { userService } from '@/lib/api/user.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'paymentHistory',
    pathname: 'profile/payment-history',
    lang,
    noIndex: true,
  });
}

export default async function PaymentHistoryPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/profile/payment-history`);
  }

  // Fetch payment history transactions securely via centralized userService
  const transactions = await userService.getPaymentHistory(token, lang, 1, 50);

  return (
    <div className="bg-background text-foreground">
      <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
        <PageHeader title="Payment History" backText="Back" />
        <div className="mt-3">
          <PaymentHistoryClient transactions={transactions} lang={lang} />
        </div>
      </div>
    </div>
  );
}
