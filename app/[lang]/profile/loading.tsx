import { PageHeader } from '@/components/ui/PageHeader'

export default function ProfileLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="My Profile" backText="Back" />

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-6 items-start animate-pulse">
            {/* Left Column (Main Form) */}
            <div className="lg:col-span-8 flex flex-col gap-2 lg:gap-6">
              <div className="bg-card rounded-2xl border border-border shadow-xs p-5 sm:p-6">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-20 h-20 rounded-full bg-muted shrink-0"></div>
                  <div className="space-y-2 flex-grow">
                    <div className="h-5 bg-muted rounded w-1/3"></div>
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-11 bg-muted rounded-lg w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (Membership / KYC) */}
            <div className="lg:col-span-4 flex flex-col gap-2 lg:gap-6">
              <div className="bg-card rounded-2xl border border-border shadow-xs p-5 h-44">
                <div className="h-5 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>

              <div className="bg-card rounded-2xl border border-border shadow-xs p-5 h-64">
                <div className="h-5 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-4/5"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
