import { PageHeader } from '@/components/ui/PageHeader'

export default function NewsDetailLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest News" backText="Back" />
          <div className="mt-1 sm:mt-1.5 w-full max-w-full overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              {/* Image Skeleton */}
              <div className="w-full max-w-full min-w-0 space-y-4">
                <div className="w-full aspect-[3/2] bg-muted animate-pulse rounded-2xl border border-border"></div>
              </div>
              
              {/* Content Skeleton */}
              <div className="w-full max-w-full min-w-0 mt-6 md:mt-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8">
                <div className="w-3/4 h-8 bg-muted animate-pulse rounded mb-2"></div>
                {/* Audio Player Skeleton */}
                <div className="w-full h-16 bg-muted/60 animate-pulse rounded-xl border border-border/60 mb-4"></div>
                <div className="space-y-4">
                  <div className="w-full h-4 bg-muted animate-pulse rounded"></div>
                  <div className="w-full h-4 bg-muted animate-pulse rounded"></div>
                  <div className="w-5/6 h-4 bg-muted animate-pulse rounded"></div>
                  <div className="w-full h-4 bg-muted animate-pulse rounded mt-4"></div>
                  <div className="w-full h-4 bg-muted animate-pulse rounded"></div>
                  <div className="w-4/6 h-4 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
