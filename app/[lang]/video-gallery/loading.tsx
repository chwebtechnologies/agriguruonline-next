import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Video Gallery" backText="Back" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
              >
                <div className="w-full aspect-video bg-muted border-b border-border"></div>
                <div className="px-4 py-4 flex flex-col flex-grow">
                  <div className="w-full h-5 rounded bg-muted mb-2"></div>
                  <div className="w-3/4 h-5 rounded bg-muted mb-4"></div>
                  <div className="flex-grow"></div>
                  <div className="w-24 h-4 rounded bg-muted mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
