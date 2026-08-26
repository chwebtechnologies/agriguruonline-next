export default function DedicatedChartLoading() {
  return (
    <main className="bg-background text-foreground min-h-[100dvh] w-full flex flex-col items-center">
      <div className="w-full max-w-lg min-h-[100dvh] flex flex-col bg-background border-x border-border shadow-sm animate-pulse">
        {/* Header Skeleton */}
        <div className="h-14 border-b border-border flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-full bg-muted"></div>
          <div className="flex flex-col flex-1 gap-1.5">
            <div className="h-4 w-3/4 rounded bg-muted"></div>
            <div className="h-3 w-1/2 rounded bg-muted"></div>
          </div>
          <div className="w-8 h-8 rounded bg-muted"></div>
        </div>

        {/* Info Skeleton */}
        <div className="p-4 flex flex-col gap-2">
          <div className="h-8 w-1/3 rounded bg-muted mb-2"></div>
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-muted"></div>
            <div className="h-6 w-24 rounded-full bg-muted"></div>
          </div>
        </div>

        {/* Chart Area Skeleton */}
        <div className="w-full aspect-[4/3] bg-muted mt-2"></div>

        {/* Additional Info / Options */}
        <div className="p-4 flex flex-col gap-4">
          <div className="h-10 w-full rounded bg-muted"></div>
          <div className="h-24 w-full rounded bg-muted"></div>
        </div>
      </div>
    </main>
  )
}
