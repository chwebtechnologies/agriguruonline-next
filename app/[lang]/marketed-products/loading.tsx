import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Marketed Products" backText="Back" />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs animate-pulse"
              >
                <div className="relative w-full aspect-square bg-muted border-b border-border">
                  {/* Flag placeholder (top-left) */}
                  <div className="absolute top-2 left-2 w-7 h-5 bg-card/90 rounded border border-border"></div>
                  {/* Info icon placeholder (top-right) */}
                  <div className="absolute top-2 right-2 w-6 h-6 sm:w-7 sm:h-7 bg-card/90 rounded-full border border-border"></div>
                </div>

                <div className="p-2 flex flex-col flex-1">
                  <div className="h-3 bg-muted rounded w-1/2 mx-auto mb-1.5" />
                  <div className="h-4 sm:h-5 bg-muted rounded w-3/4 mx-auto mb-3" />

                  <div className="mt-auto space-y-1.5">
                    <div className="h-6 sm:h-7 bg-muted rounded w-full" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="h-6 sm:h-7 bg-muted rounded" />
                      <div className="h-6 sm:h-7 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
