import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-8">
          <PageHeader title="Events" backText="Back" />

          <div className="mt-3 w-full max-w-full overflow-hidden">
            <div className="responsive-layout-grid gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              
              {/* FEATURED IMAGE SKELETON */}
              <div className="grid-area-image w-full max-w-full min-w-0 space-y-4 animate-pulse">
                <div className="bg-card rounded-t-2xl rounded-b-none md:rounded-2xl border border-border border-b-0 md:border-b p-2 sm:p-2.5 shadow-xs overflow-hidden">
                  <div className="w-full aspect-[3/2] rounded-t-xl rounded-b-none bg-muted border border-border"></div>
                  <div className="flex items-center justify-between gap-1 sm:gap-3 px-0.5 sm:px-1 pt-2.5 pb-0.5 w-full max-w-full overflow-hidden mt-1">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <div className="w-36 h-4 bg-muted rounded"></div>
                      <div className="w-24 h-4 bg-muted rounded hidden md:block"></div>
                    </div>
                    <div className="w-12 h-4 rounded bg-muted"></div>
                  </div>
                </div>
              </div>

              {/* OTHER EVENTS SKELETON */}
              <div className="grid-area-other w-full max-w-full min-w-0 animate-pulse mt-6 md:mt-0 md:h-full md:min-h-[340px]">
                <div className="bg-card rounded-2xl border border-border p-3 sm:p-4 md:p-5 shadow-xs space-y-3 sm:space-y-3.5 overflow-hidden flex flex-col md:h-full md:min-h-[340px] md:max-h-[720px]">
                  <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
                    <div className="w-32 h-5 bg-muted rounded"></div>
                    <div className="w-16 h-3 bg-muted rounded"></div>
                  </div>
                  <div className="space-y-2.5 sm:space-y-3 md:flex-1 md:overflow-y-auto md:pr-1 custom-scrollbar min-h-0">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex flex-row gap-2.5 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl bg-background border border-border overflow-hidden items-start">
                        <div className="w-[95px] min-[360px]:w-[110px] sm:w-[125px] min-w-[95px] min-[360px]:min-w-[110px] sm:min-w-[125px] aspect-[3/2] bg-muted rounded-lg shrink-0"></div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="w-14 h-3 bg-muted rounded"></div>
                          <div className="w-full h-3.5 bg-muted rounded"></div>
                          <div className="w-3/5 h-2.5 bg-muted rounded"></div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="w-20 h-2.5 bg-muted rounded"></div>
                            <div className="w-14 h-2.5 bg-muted rounded"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* EVENT CONTENT SKELETON */}
              <div className="grid-area-content w-full max-w-full min-w-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8 shadow-xs flex flex-col animate-pulse overflow-hidden self-start md:h-auto">
                <div className="w-full h-7 sm:h-8 bg-muted rounded mb-2"></div>
                <div className="w-4/5 h-7 sm:h-8 bg-muted rounded mb-4 border-b border-border pb-2.5"></div>
                
                {/* Event Highlights Grid Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5">
                  <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="w-9 h-9 rounded-lg bg-muted shrink-0"></div>
                    <div className="space-y-1 flex-1">
                      <div className="w-14 h-2.5 bg-muted rounded"></div>
                      <div className="w-28 h-3.5 bg-muted rounded"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="w-9 h-9 rounded-lg bg-muted shrink-0"></div>
                    <div className="space-y-1 flex-1">
                      <div className="w-16 h-2.5 bg-muted rounded"></div>
                      <div className="w-24 h-3.5 bg-muted rounded"></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="w-full h-4 bg-muted rounded"></div>
                  <div className="w-full h-4 bg-muted rounded"></div>
                  <div className="w-11/12 h-4 bg-muted rounded"></div>
                  <div className="w-full h-4 bg-muted rounded"></div>
                  <div className="w-4/5 h-4 bg-muted rounded mb-6"></div>
                  
                  <div className="w-full h-4 bg-muted rounded"></div>
                  <div className="w-10/12 h-4 bg-muted rounded"></div>
                  <div className="w-full h-4 bg-muted rounded"></div>
                </div>

                {/* Bottom Tags Skeleton */}
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                  <div className="w-10 h-3 bg-muted rounded"></div>
                  <div className="w-16 h-5 bg-muted rounded-md"></div>
                  <div className="w-20 h-5 bg-muted rounded-md"></div>
                  <div className="w-14 h-5 bg-muted rounded-md"></div>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                  <div className="w-32 h-4 bg-muted rounded"></div>
                  <div className="w-28 h-4 bg-muted rounded"></div>
                </div>
              </div>

            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            .responsive-layout-grid {
              display: grid;
              grid-template-columns: minmax(0, 1fr);
              grid-template-areas: 
                "image"
                "content"
                "other";
              width: 100%;
              max-width: 100%;
            }
            @media (min-width: 768px) {
              .responsive-layout-grid {
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                grid-template-rows: auto 1fr;
                grid-template-areas: 
                  "image content"
                  "other content";
              }
            }
            .grid-area-image { grid-area: image; min-width: 0; max-width: 100%; }
            .grid-area-content { grid-area: content; min-width: 0; max-width: 100%; }
            .grid-area-other { grid-area: other; min-width: 0; max-width: 100%; }
          `}} />
        </div>
      </div>
    </div>
  )
}
