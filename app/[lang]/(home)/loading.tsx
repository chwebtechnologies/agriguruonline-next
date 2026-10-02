export default function HomeLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Hero Carousel Skeleton */}
          <div className="w-full h-[290px] sm:h-[300px] md:h-[310px] lg:h-[320px] xl:h-[340px] rounded-2xl bg-card border border-border animate-pulse mb-4 flex items-center justify-center p-6 sm:p-12">
            <div className="max-w-2xl w-full space-y-4">
              <div className="h-6 w-32 bg-muted rounded-full" />
              <div className="h-8 sm:h-10 w-3/4 bg-muted rounded-xl" />
              <div className="h-4 sm:h-5 w-full bg-muted/70 rounded-md" />
              <div className="h-4 sm:h-5 w-2/3 bg-muted/70 rounded-md" />
              <div className="h-10 w-36 bg-muted rounded-xl mt-4" />
            </div>
          </div>

          {/* Section Skeleton (News / Feeds) */}
          <div className="w-full pt-4 pb-2 space-y-4">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-96 max-w-full bg-muted/60 rounded-md animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-72 rounded-2xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
