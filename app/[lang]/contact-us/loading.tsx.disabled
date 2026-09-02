import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
          <PageHeader title="Contact Us" backText="Back" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 mt-4 animate-pulse">
            
            {/* Left Column: Office Info & Locations */}
            <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
              
              {/* Headquarters Card Skeleton */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-border shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-border rounded w-3/4"></div>
                    <div className="h-4 bg-border rounded w-1/2"></div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-border rounded w-full"></div>
                  <div className="h-4 bg-border rounded w-4/5"></div>
                </div>

                <div className="flex flex-col gap-3 pt-3 border-t border-border mt-auto">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-border shrink-0"></div>
                      <div className="h-4 bg-border rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global Footprint Skeleton */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 bg-border rounded shrink-0"></div>
                  <div className="h-5 bg-border rounded w-1/2"></div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-9 rounded-lg bg-border"></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Contact Form Skeleton */}
            <div className="lg:col-span-7">
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs h-full flex flex-col">
                <div className="mb-4 sm:mb-5 space-y-2">
                  <div className="h-6 bg-border rounded w-1/3"></div>
                  <div className="h-4 bg-border rounded w-1/2"></div>
                </div>

                <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <div className="h-4 bg-border rounded w-1/4"></div>
                      <div className="h-10 rounded-lg bg-border w-full"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 bg-border rounded w-1/4"></div>
                      <div className="h-10 rounded-lg bg-border w-full"></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <div className="h-4 bg-border rounded w-1/4"></div>
                      <div className="h-10 rounded-lg bg-border w-full"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 bg-border rounded w-1/4"></div>
                      <div className="h-10 rounded-lg bg-border w-full"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-4 bg-border rounded w-1/4"></div>
                    <div className="h-10 rounded-lg bg-border w-full"></div>
                  </div>

                  <div className="space-y-1 flex-1 flex flex-col">
                    <div className="h-4 bg-border rounded w-1/4"></div>
                    <div className="flex-1 min-h-[100px] bg-border rounded-lg w-full"></div>
                  </div>

                  <div className="pt-2">
                    <div className="h-10 rounded-lg bg-border w-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}