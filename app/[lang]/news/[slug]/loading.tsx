import { PageHeader } from '@/components/ui/PageHeader'

export default function NewsDetailLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest News" backText="Back" />
          <style dangerouslySetInnerHTML={{ __html: `
            .responsive-layout-grid {
              display: grid;
              grid-template-columns: minmax(0, 1fr);
              grid-template-areas: 
                "image"
                "content"
                "author"
                "other";
              width: 100%;
              max-width: 100%;
            }
            @media (min-width: 768px) {
              .responsive-layout-grid {
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                grid-template-rows: auto auto 1fr;
                grid-template-areas: 
                  "image content"
                  "author content"
                  "other content";
              }
            }
            .grid-area-image { grid-area: image; min-width: 0; max-width: 100%; }
            .grid-area-author { grid-area: author; min-width: 0; max-width: 100%; }
            .grid-area-content { grid-area: content; min-width: 0; max-width: 100%; }
            .grid-area-other { grid-area: other; min-width: 0; max-width: 100%; }
          `}} />
          <div className="mt-1 sm:mt-1.5 w-full max-w-full overflow-hidden">
            <div className="responsive-layout-grid gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              {/* Image Skeleton */}
              <div className="grid-area-image w-full max-w-full min-w-0">
                <div className="w-full aspect-[3/2] bg-muted animate-pulse rounded-2xl border border-border"></div>
              </div>
              
              {/* Author Skeleton */}
              <div className="grid-area-author w-full max-w-full min-w-0 mt-6 md:mt-0">
                <div className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card flex items-start gap-3 sm:gap-3.5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted animate-pulse shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="w-28 h-3.5 bg-muted animate-pulse rounded"></div>
                    <div className="w-full h-3 bg-muted animate-pulse rounded"></div>
                    <div className="w-3/4 h-3 bg-muted animate-pulse rounded"></div>
                  </div>
                </div>
              </div>

              {/* Other Skeleton */}
              <div className="grid-area-other w-full max-w-full min-w-0 mt-6 md:mt-0 md:h-full md:min-h-[340px]">
                <div className="w-full h-80 bg-muted animate-pulse rounded-2xl border border-border"></div>
              </div>
              
              {/* Content Skeleton */}
              <div className="grid-area-content w-full max-w-full min-w-0 mt-6 md:mt-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8">
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
