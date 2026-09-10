export default function LoadingMyInquiries() {
  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* PageHeader Skeleton */}
          <div className="flex items-center mb-1 sm:mb-2 animate-pulse">
            <div className="h-8 w-8 rounded-full mr-4 bg-muted/40" />
            <div className="h-8 w-48 bg-muted/40 rounded-lg" />
          </div>

          <div>
            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-stretch">
              
              {/* Left Column: Search, Tabs & Cards Skeleton */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3.5 bg-card/60 p-3.5 sm:p-4 rounded-2xl border border-border h-full">
                {/* Search Bar */}
                <div className="h-10 w-full bg-muted/40 rounded-xl animate-pulse" />

                {/* Tabs */}
                <div className="grid grid-cols-2 gap-2 bg-background/50 p-1 rounded-xl border border-border/80 animate-pulse">
                  <div className="h-8 bg-muted/40 rounded-lg" />
                  <div className="h-8 bg-muted/40 rounded-lg" />
                </div>

                {/* Cards List Skeleton */}
                <div className="mt-1 flex flex-col">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-3.5 mb-2.5 rounded-xl border border-border bg-card animate-pulse flex items-center gap-3.5">
                      <div className="w-5 h-5 rounded-sm bg-muted/40 shrink-0" />
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="h-4 w-3/4 bg-muted/40 rounded-md mb-1.5" />
                        <div className="h-3 w-1/2 bg-muted/40 rounded-md" />
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <div className="h-4 w-16 rounded-full bg-muted/40" />
                        <div className="h-3 w-12 rounded bg-muted/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Details Panel Skeleton */}
              <div className="lg:col-span-7 xl:col-span-8 h-full">
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-7 min-h-[380px] shadow-sm flex flex-col animate-pulse h-full">
                  <div className="border-b border-border pb-5 mb-6 flex justify-between items-center">
                    <div className="space-y-2">
                      <div className="h-3 w-24 bg-muted/40 rounded" />
                      <div className="h-7 w-64 bg-muted/40 rounded-lg" />
                    </div>
                    <div className="h-6 w-24 rounded-full bg-muted/40" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="bg-background/60 border border-border rounded-xl p-3.5 space-y-2">
                        <div className="h-3 w-16 bg-muted/40 rounded" />
                        <div className="h-5 w-24 bg-muted/40 rounded-md" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto bg-background/50 border border-border rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted/40 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-muted/40 rounded" />
                      <div className="h-3 w-3/4 bg-muted/40 rounded" />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
