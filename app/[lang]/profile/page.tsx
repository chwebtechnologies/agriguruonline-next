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
import { ForceLogout } from '@/components/auth/ForceLogout';
import { getUserApiUrl, getTradingApiUrl } from '@/lib/api-utils';

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'profile',
    pathname: 'profile',
    lang,
    noIndex: true,
  });
}



export default async function ProfilePage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login`);
  }

  const dict = await getDictionary(lang);
  const common = dict.common || { back: 'Back', profile: 'My Profile' };

  // Fetch profile data
  const userApiUrl = getUserApiUrl();
  const profileApiUrl = `${userApiUrl}/user/my-profile?lang_code=${lang}&source=web`;
  let profileData = null;
  let shouldLogout = false;
  try {
    const res = await fetch(profileApiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      next: { revalidate: 60 }
    });
    
    if (res.ok) {
      const json = await res.json();
      if (json.success === false || !json.data) {
        // Token might be expired but API returned 200 with success: false
        shouldLogout = true;
      } else {
        profileData = json.data;
      }
    } else {
      // Any non-200 status for profile means we cannot securely render the page
      shouldLogout = true;
    }
  } catch (error: any) {
    console.error('Failed to fetch profile', error);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      // Don't immediately logout on abort error (which can happen during fast navigations)
      // We will let the lack of profile data trigger ForceLogout, but maybe we should try one more time?
      console.log('Abort error detected, not an auth failure necessarily.');
    }
    shouldLogout = true;
  }

  // 100% Security: If there is no profile data or we marked for logout, redirect immediately
  if (shouldLogout || !profileData) {
    return <ForceLogout lang={lang} />;
  }

  // Parallel Fetching for Categories, Countries, and KYC
  const tradingApiUrl = getTradingApiUrl();
  const categoriesApiUrl = `${tradingApiUrl}/category`;
  const cacheStale = Number(process.env.CATEGORIES_CACHE_STALE) || 300
  const cacheRevalidate = Number(process.env.CATEGORIES_CACHE_REVALIDATE) || 3600
  const cacheExpire = Number(process.env.CATEGORIES_CACHE_EXPIRE) || 86400

  const userId = profileData.id || profileData._id || profileData.customer_id;

  const [categoriesResult, countriesResult, kycResult] = await Promise.allSettled([
    getCategories(lang, { apiUrl: categoriesApiUrl, stale: cacheStale, revalidate: cacheRevalidate, expire: cacheExpire }),
    fetch(`${tradingApiUrl}/country?lang_code=${lang}&source=web`, { next: { revalidate: 60 } }).then(r => r.json()),
    fetch(`${userApiUrl}/required-document/verification/${userId}?lang_code=${lang}&source=web`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    }).then(r => r.json())
  ]);

  const apiCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  
  let apiCountries: any[] = [];
  if (countriesResult.status === 'fulfilled') {
    const countriesData = countriesResult.value;
    if (countriesData.data?.countries && Array.isArray(countriesData.data.countries)) {
      apiCountries = countriesData.data.countries;
    } else if (Array.isArray(countriesData.data)) {
      apiCountries = countriesData.data;
    }
  } else {
    console.error("Failed to fetch countries on server", countriesResult.reason);
  }

  const isKycVerified = profileData?.is_kyc_verified || false;
  let kycStatus = "MISSING";
  let rawKycDocs: any[] = [];
  
  if (kycResult.status === 'fulfilled') {
    const kycData = kycResult.value;
    if (kycData.success && Array.isArray(kycData.data)) {
      rawKycDocs = kycData.data;
      const hasActive = kycData.data.some((item: any) => {
        if (!item.is_uploaded) return false;
        const status = item.status?.toUpperCase();
        return status !== "REJECTED" && status !== "EXPIRED";
      });
      
      const hasRejected = kycData.data.some((item: any) => {
        if (!item.is_uploaded) return false;
        return item.status?.toUpperCase() === "REJECTED";
      });

      const hasApproved = kycData.data.some((item: any) => {
        if (!item.is_uploaded) return false;
        return item.status?.toUpperCase() === "APPROVED";
      });

      if (hasApproved) {
        kycStatus = "APPROVED";
      } else if (hasActive) {
        kycStatus = "PROCESSING";
      } else if (hasRejected) {
        kycStatus = "REJECTED";
      } else {
        kycStatus = "MISSING";
      }
    }
  } else {
    console.error("Failed to fetch KYC status on server", kycResult.reason);
  }

  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={(common as any).profile || 'My Profile'} backText={common.back || 'Back'} />

          <div className="mt-4">
            
            {/* Dynamic KYC Alert Banner */}
            {!isKycVerified && kycStatus !== "APPROVED" && kycStatus !== "PROCESSING" && (
              <div className={`mb-6 border rounded-xl p-3 sm:px-5 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 ${
                kycStatus === "REJECTED" 
                  ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" 
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
              }`}>
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 hidden sm:flex ${
                    kycStatus === "REJECTED" ? "bg-red-100 dark:bg-red-900/50 text-red-600" : "bg-amber-100 dark:bg-amber-900/50 text-amber-600"
                  }`}>
                    <i className={`fa-solid ${kycStatus === "REJECTED" ? "fa-circle-xmark" : "fa-triangle-exclamation"} text-sm`}></i>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                    <h3 className={`font-extrabold text-sm sm:text-base ${
                      kycStatus === "REJECTED" ? "text-red-800 dark:text-red-400" : "text-amber-800 dark:text-amber-400"
                    }`}>
                      {kycStatus === "REJECTED" ? "KYC Rejected" : "Action Required: KYC Verification"}
                    </h3>
                    <span className={`hidden md:inline font-bold ${
                      kycStatus === "REJECTED" ? "text-red-400" : "text-amber-400"
                    }`}>-</span>
                    <p className={`text-sm font-medium leading-tight sm:leading-normal mt-0.5 md:mt-0 ${
                      kycStatus === "REJECTED" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
                    }`}>
                      {kycStatus === "REJECTED" 
                        ? "Please upload a clear new document to verify." 
                        : "Please upload required document to verify and unlock trading features."}
                    </p>
                  </div>
                </div>
                <a href="#kyc-section" className={`shrink-0 px-4 py-2 sm:px-5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-sm transition-all whitespace-nowrap text-white ${
                  kycStatus === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                }`}>
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
                <ProfileForm categories={apiCategories} countries={apiCountries} lang={lang} profileData={profileData} />
              </div>

              {/* Right Column (Sidebar Widgets) */}
              <div className="lg:col-span-4 flex flex-col gap-2 lg:gap-6">
                
                {/* Desktop-only Membership Card (Shows in sidebar on large screens) */}
                <div className="hidden lg:block">
                  <MembershipCard profileData={profileData} />
                </div>

                <div id="kyc-section" className="scroll-mt-24">
                  <KycSection profileData={profileData} lang={lang} initialKycDocs={rawKycDocs} />
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
