import { PageHeader } from '@/components/ui/PageHeader'

export default function VideoCollectionLoading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Loading..." backText="Back" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
              >
                <div className="w-full aspect-video bg-muted border-b border-border"></div>
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
                  <div className="w-3/4 h-4 sm:h-5 rounded bg-muted mb-1"></div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="w-20 h-3 sm:h-4 rounded bg-muted"></div>
                    <div className="w-6 h-6 rounded-full bg-muted"></div>
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
