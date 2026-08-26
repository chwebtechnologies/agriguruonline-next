export default function DedicatedChartLoading() {
  return (
    <main className="bg-background text-foreground min-h-[100dvh] w-full flex flex-col items-center">
      <div className="w-full max-w-lg min-h-[100dvh] flex flex-col bg-background border-x border-foreground/10 shadow-sm animate-pulse">
        {/* Header Skeleton */}
        <div className="h-14 border-b border-foreground/10 flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-full bg-foreground/10"></div>
          <div className="flex flex-col flex-1 gap-1.5">
            <div className="h-4 w-3/4 rounded bg-foreground/10"></div>
            <div className="h-3 w-1/2 rounded bg-foreground/10"></div>
          </div>
          <div className="w-8 h-8 rounded bg-foreground/10"></div>
        </div>

        {/* Info Skeleton */}
        <div className="p-4 flex flex-col gap-2">
          <div className="h-8 w-1/3 rounded bg-foreground/10 mb-2"></div>
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-foreground/10"></div>
            <div className="h-6 w-24 rounded-full bg-foreground/10"></div>
          </div>
        </div>

        {/* Chart Area Skeleton */}
        <div className="w-full aspect-[4/3] bg-foreground/10 mt-2"></div>

        {/* Additional Info / Options */}
        <div className="p-4 flex flex-col gap-4">
          <div className="h-10 w-full rounded bg-foreground/10"></div>
          <div className="h-24 w-full rounded bg-foreground/10"></div>
        </div>
      </div>
    </main>
  )
}
