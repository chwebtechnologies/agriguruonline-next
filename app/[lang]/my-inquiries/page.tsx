import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { PageHeader } from '@/components/ui/PageHeader';
import { tradingService } from '@/lib/api/trading.service';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import MyInquiriesClient from '@/components/my-inquiries/MyInquiriesClient';
import { getUserProfile } from '@/lib/user-data';
import { ForceLogout } from '@/components/auth/ForceLogout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'myInquiries',
    pathname: 'my-inquiries',
    lang,
    noIndex: true,
  });
}


export default async function MyInquiriesPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/my-inquiries`);
  }

  const { userProfile: profileData, shouldLogout } = await getUserProfile(token, lang);
  
  if (shouldLogout || !profileData) {
    return <ForceLogout lang={lang} />;
  }

  const getNormalizedType = (typeData: any) => {
    if (!typeData) return '';
    if (typeof typeData === 'string') return typeData.toLowerCase();
    if (typeof typeData === 'object') return String(typeData.name || typeData.title || '').toLowerCase();
    return String(typeData).toLowerCase();
  };

  const isSeller = getNormalizedType(profileData.user_type) === 'seller' || getNormalizedType(profileData.role) === 'seller';
  if (isSeller) {
    redirect(`/${lang}/my-offers`);
  }

  const dict = await getDictionary(lang);
  const common = dict.common || { back: 'Back' };
  
  const pageTitle = (dict as any).my_inquiries || 'My Offers & Inquiries';

  const [buyerProductRes, sellerProductRes, freightInquiries] = await Promise.all([
    tradingService.getInquiryList('/trading-inquiry/for-user?type=BUYER', token, lang),
    tradingService.getInquiryList('/trading-inquiry/for-user?type=SELLER', token, lang),
    tradingService.getInquiryList('/freight-inquiry/for-user', token, lang),
  ]);

  // Combine product inquiries, deduplicate by ID, and sort by date descending
  const seenIds = new Set<string>();
  const productInquiries: any[] = [];
  for (const item of [...buyerProductRes, ...sellerProductRes]) {
    const id = item?.id || item?._id;
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    productInquiries.push(item);
  }
  productInquiries.sort((a, b) => {
    const dateA = new Date(a?.created_at || a?.createdAt || 0).getTime();
    const dateB = new Date(b?.created_at || b?.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText={common.back} />

          <div>
            <MyInquiriesClient 
              lang={lang} 
              productInquiries={productInquiries} 
              freightInquiries={freightInquiries}
              dict={dict}
              token={token}
              userProfile={profileData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
