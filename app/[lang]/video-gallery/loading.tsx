import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Video Gallery" backText="Back" />
          
          <div className="px-2 sm:px-0 mb-6">
            <div className="w-full max-w-3xl h-5 rounded bg-ag-header-border/50 animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 px-2 sm:px-0 mt-2">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm animate-pulse"
              >
                <div className="w-full aspect-video bg-ag-header-border/50 border-b border-ag-header-border"></div>
                <div className="px-4 py-4 flex flex-col flex-grow">
                  <div className="w-full h-5 rounded bg-ag-header-border/50 mb-2"></div>
                  <div className="w-3/4 h-5 rounded bg-ag-header-border/50 mb-4"></div>
                  <div className="flex-grow"></div>
                  <div className="w-24 h-4 rounded bg-ag-header-border/50 mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
