import { Metadata } from 'next';
import { getDictionary } from '@/app/[lang]/dictionaries'
import { PageHeader } from '@/components/ui/PageHeader'
import ProfilePictureUpload from '@/components/profile/ProfilePictureUpload';
import ProfileForm from '@/components/profile/ProfileForm';
import KycSection from '@/components/profile/KycSection';
import MembershipCard from '@/components/profile/MembershipCard';

export const metadata: Metadata = {
  title: 'My Profile | AgriGuru Online',
  description: 'Manage your profile and business details on AgriGuru Online',
};

export default async function ProfilePage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en';
  const dict = await getDictionary(lang);
  const common = dict.common || { back: 'Back', profile: 'My Profile' };

  // Mocking global state for demonstration. In reality, this comes from API/Auth context.
  const isKycVerified = false; 

  return (
    <div className="bg-background text-foreground min-h-[calc(100vh-4rem)]">
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
            <div className="block lg:hidden mb-6">
              <MembershipCard />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 items-start">
              
              {/* Left Column (Main Content) */}
              <div className="lg:col-span-8 flex flex-col gap-3 lg:gap-6">
                
                {/* Main Form */}
                <ProfileForm />
              </div>

              {/* Right Column (Sidebar Widgets) */}
              <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-6">
                
                {/* Desktop-only Membership Card (Shows in sidebar on large screens) */}
                <div className="hidden lg:block">
                  <MembershipCard />
                </div>

                <div id="kyc-section" className="scroll-mt-24">
                  <KycSection />
                </div>
                
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
