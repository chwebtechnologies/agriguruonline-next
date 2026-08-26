import { PageHeader } from '@/components/ui/PageHeader'
import ListingFilters from '@/components/shared/ListingFilters'

export default function Loading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Market Updates" backText="Back" />
          <ListingFilters categories={[]} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(12)].map((_, i) => (
              <div 
                key={i} 
                className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm animate-pulse"
              >
                {/* 794/1120 aspect ratio as used in the Market Updates Page */}
                <div className="w-full aspect-[794/1120] bg-ag-header-border/50 border-b border-ag-header-border"></div>
                <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
                  <div className="w-full h-5 rounded bg-ag-header-border/50 mb-2"></div>
                  <div className="w-3/4 h-5 rounded bg-ag-header-border/50 mb-4"></div>
                  <div className="w-full h-3 rounded bg-ag-header-border/50 mb-1.5"></div>
                  <div className="w-full h-3 rounded bg-ag-header-border/50 mb-1.5"></div>
                  <div className="w-4/5 h-3 rounded bg-ag-header-border/50 mb-4"></div>
                  <div className="flex-grow"></div>
                  <div className="flex items-center justify-between mt-auto border-t border-ag-header-border pt-3">
                    <div className="w-20 h-4 rounded bg-ag-header-border/50"></div>
                    <div className="w-6 h-6 rounded-full bg-ag-header-border/50"></div>
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
