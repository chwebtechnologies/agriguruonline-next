import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/app/[lang]/dictionaries'
import { PageHeader } from '@/components/ui/PageHeader'
import ProfilePictureUpload from '@/components/profile/ProfilePictureUpload';
import ProfileForm from '@/components/profile/ProfileForm';
import KycSection from '@/components/profile/KycSection';
import MembershipCard from '@/components/profile/MembershipCard';
import { getCategories } from '@/lib/category';

export const metadata: Metadata = {
  title: 'My Profile | AgriGuru Online',
  description: 'Manage your profile and business details on AgriGuru Online',
};

export const instant = false;

export default async function ProfilePage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login`);
  }

  const dict = await getDictionary(lang);
  const common = dict.common || { back: 'Back', profile: 'My Profile' };

  // Fetch profile data
  const profileApiUrl = `https://user-api.agriguruonline.cloud/user/my-profile?lang_code=${lang}&source=web`;
  let profileData = null;
  try {
    const res = await fetch(profileApiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    if (res.ok) {
      const json = await res.json();
      profileData = json.data;
    } else if (res.status === 401 || res.status === 403) {
      redirect(`/${lang}/login`);
    }
  } catch (error) {
    console.error('Failed to fetch profile', error);
  }

  // Fetch categories using identical Next.js cached configuration as Header
  const tradingApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://trading-api.agriguruonline.cloud'
  const categoriesApiUrl = `${tradingApiUrl.replace(/\/$/, '')}/category`
  const cacheStale = Number(process.env.CATEGORIES_CACHE_STALE) || 300
  const cacheRevalidate = Number(process.env.CATEGORIES_CACHE_REVALIDATE) || 3600
  const cacheExpire = Number(process.env.CATEGORIES_CACHE_EXPIRE) || 86400

  const apiCategories = await getCategories(lang, {
    apiUrl: categoriesApiUrl,
    stale: cacheStale,
    revalidate: cacheRevalidate,
    expire: cacheExpire
  })

  // Set KYC state from API (fallback to false if not found)
  const isKycVerified = profileData?.is_kyc_verified || false;

  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-2 sm:px-0">
          <PageHeader title={(common as any).profile || 'My Profile'} backText={common.back || 'Back'} />

          <div className="mt-4">
            
            {/* Compact Global KYC Alert Banner */}
            {!isKycVerified && (
              <div className="mb-6 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900 rounded-xl p-3 sm:px-5 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 text-red-600 rounded-full flex items-center justify-center shrink-0 hidden sm:flex">
                    <i className="fa-solid fa-triangle-exclamation text-sm"></i>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                    <h3 className="text-red-800 dark:text-red-400 font-extrabold text-sm sm:text-base">Action Required: KYC Verification</h3>
                    <span className="hidden md:inline text-red-400 font-bold">-</span>
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium leading-tight sm:leading-normal mt-0.5 md:mt-0">Please verify your identity to unlock features.</p>
                  </div>
                </div>
                <a href="#kyc-section" className="shrink-0 px-4 py-2 sm:px-5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-sm transition-all whitespace-nowrap">
                  Verify Now
                </a>
              </div>
            )}

            {/* Mobile-only Membership Card (Shows above the form on smaller screens) */}
            <div className="block lg:hidden mb-3">
              <MembershipCard profileData={profileData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-6 items-start">
              
              {/* Left Column (Main Content) */}
              <div className="lg:col-span-8 flex flex-col gap-2 lg:gap-6">
                
                {/* Main Form */}
                <ProfileForm categories={apiCategories} lang={lang} profileData={profileData} token={token} />
              </div>

              {/* Right Column (Sidebar Widgets) */}
              <div className="lg:col-span-4 flex flex-col gap-2 lg:gap-6">
                
                {/* Desktop-only Membership Card (Shows in sidebar on large screens) */}
                <div className="hidden lg:block">
                  <MembershipCard profileData={profileData} />
                </div>

                <div id="kyc-section" className="scroll-mt-24">
                  <KycSection />
                </div>
                
                {/* Mobile-only Upgrade Plan Button */}
                <button className="lg:hidden w-[60%] mx-auto mt-2 mb-2 sm:mb-0 bg-plan-platinum p-3.5 sm:p-4 rounded-full text-white font-black flex items-center justify-center gap-2.5 shadow-xl shadow-sky-900/20 active:scale-[0.98] transition-all relative overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none z-0"></div>
                  <i className="fa-solid fa-crown text-white drop-shadow-md relative z-10 text-[15px]"></i>
                  <span className="tracking-widest uppercase text-sm sm:text-base relative z-10 drop-shadow-md">Upgrade Plan</span>
                  <i className="fa-solid fa-award text-white drop-shadow-md relative z-10 text-lg"></i>
                </button>
                
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
