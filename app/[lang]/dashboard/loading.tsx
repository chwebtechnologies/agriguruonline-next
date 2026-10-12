export default function DashboardLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
          {/* Header Skeleton */}
          <div className="h-10 w-48 bg-muted rounded animate-pulse mb-4"></div>
          
          <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-[120px] rounded-2xl bg-card border border-border shadow-xs animate-pulse p-5">
                  <div className="h-4 w-24 bg-muted rounded mb-3"></div>
                  <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                  <div className="h-3 w-16 bg-muted rounded"></div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 h-[400px] rounded-2xl bg-card border border-border shadow-xs animate-pulse p-5">
                <div className="h-5 w-40 bg-muted rounded mb-6"></div>
                <div className="w-full h-[300px] bg-muted/50 rounded-xl"></div>
              </div>
              <div className="h-[400px] rounded-2xl bg-card border border-border shadow-xs animate-pulse p-5">
                <div className="h-5 w-32 bg-muted rounded mb-6"></div>
                <div className="w-full h-48 bg-muted/50 rounded-full mx-auto max-w-[200px]"></div>
              </div>
            </div>

            <div className="h-[300px] rounded-2xl bg-card border border-border shadow-xs animate-pulse p-5">
              <div className="h-5 w-48 bg-muted rounded mb-6"></div>
              <div className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-12 w-full bg-muted/50 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
