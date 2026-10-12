export default function AboutLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <div className="h-10 w-48 bg-muted rounded animate-pulse mb-6"></div>
          {/* First Section Skeleton */}
          <div className="mt-6 md:mt-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-4 md:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-8 md:h-12 w-4/5 bg-muted rounded animate-pulse"></div>
                  <div className="h-6 md:h-8 w-3/5 bg-muted/60 rounded animate-pulse"></div>
                </div>
                <div className="space-y-2.5 pt-1">
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-4/5 bg-muted/40 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="w-full aspect-[667/388] rounded-2xl bg-muted/40 animate-pulse border border-border/40"></div>
            </div>
          </div>

          {/* Second Section Skeleton */}
          <div className="mt-8 md:mt-12 space-y-3 md:space-y-4">
            <div className="text-center space-y-2.5 max-w-4xl mx-auto">
              <div className="h-7 md:h-8 w-2/3 mx-auto bg-muted rounded animate-pulse"></div>
              <div className="w-12 sm:w-16 h-1 bg-emerald-500/40 mx-auto rounded-full"></div>
            </div>
            <div className="space-y-2.5">
              <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
              <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Third Section Skeleton: Core Industry Problems */}
          <div className="mt-10 md:mt-14 space-y-6 md:space-y-8">
            <div className="text-center space-y-2.5 max-w-4xl mx-auto">
              <div className="h-7 md:h-8 w-1/3 mx-auto bg-muted rounded animate-pulse"></div>
              <div className="w-12 sm:w-16 h-1 bg-emerald-500/40 mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/40 bg-card p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/20 animate-pulse"></div>
                    <div className="h-6 w-3/4 bg-muted/60 rounded animate-pulse"></div>
                  </div>
                  <div className="h-48 w-full rounded-xl bg-muted/30 animate-pulse border border-border/30"></div>
                  <div className="space-y-2 pt-1">
                    <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                    <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                    <div className="h-4 w-4/5 bg-muted/40 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quote Skeleton */}
            <div className="rounded-2xl border border-emerald-500/20 bg-muted/20 p-6 sm:p-8 text-center max-w-4xl mx-auto space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 mx-auto animate-pulse"></div>
              <div className="h-6 w-4/5 mx-auto bg-muted/50 rounded animate-pulse"></div>
              <div className="h-6 w-3/5 mx-auto bg-muted/40 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Fourth Section Skeleton: Solutions Breakdown */}
          <div className="mt-12 md:mt-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-4 md:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-8 md:h-10 w-4/5 bg-muted rounded animate-pulse"></div>
                  <div className="w-12 sm:w-16 h-1 bg-emerald-500/40 rounded-full"></div>
                </div>
                <div className="space-y-2.5 pt-1">
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse"></div>
                </div>
                <div className="space-y-2.5">
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-4/5 bg-muted/40 rounded animate-pulse"></div>
                </div>
                <div className="h-6 w-3/4 bg-emerald-500/20 rounded animate-pulse"></div>
              </div>
              <div className="w-full aspect-[626/395] rounded-2xl bg-muted/40 animate-pulse border border-border/40"></div>
            </div>

            {/* Solution 2 Skeleton: Image Left, Text Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mt-12 md:mt-16">
              <div className="w-full aspect-[626/395] rounded-2xl bg-muted/40 animate-pulse border border-border/40 order-2 lg:order-1"></div>
              <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-8 md:h-10 w-4/5 bg-muted rounded animate-pulse"></div>
                  <div className="w-12 sm:w-16 h-1 bg-emerald-500/40 rounded-full"></div>
                </div>
                <div className="space-y-2.5 pt-1">
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse"></div>
                </div>
                <div className="space-y-2.5">
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-4/5 bg-muted/40 rounded animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* How It Works Scenario Skeleton */}
            <div className="rounded-3xl border border-border/60 bg-muted/10 p-6 sm:p-8 lg:p-10 space-y-6 mt-12 md:mt-16">
              <div className="space-y-3 text-center max-w-xl mx-auto">
                <div className="h-6 w-48 mx-auto bg-emerald-500/20 rounded-full animate-pulse"></div>
                <div className="h-8 w-3/4 mx-auto bg-muted rounded animate-pulse"></div>
                <div className="h-4 w-full mx-auto bg-muted/50 rounded animate-pulse"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-border/40 bg-card p-5 sm:p-6 space-y-4">
                    <div className="h-6 w-1/2 bg-muted/60 rounded animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                      <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse"></div>
                    </div>
                    <div className="h-14 w-full bg-muted/30 rounded-xl animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution 3 Skeleton: Text Left, Image Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mt-12 md:mt-16">
              <div className="space-y-4 md:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-8 md:h-10 w-4/5 bg-muted rounded animate-pulse"></div>
                  <div className="w-12 sm:w-16 h-1 bg-emerald-500/40 rounded-full"></div>
                </div>
                <div className="space-y-2.5 pt-1">
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-muted/40 rounded animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="w-full aspect-[626/395] rounded-2xl bg-muted/40 animate-pulse border border-border/40"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
