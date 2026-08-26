import { PageHeader } from '@/components/ui/PageHeader'

export default function CategoryLoading() {
  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <div className="animate-pulse">
            <div className="h-10 w-48 bg-foreground/10 rounded-lg mb-6"></div>
          </div>

          {/* Sub Categories Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="group flex flex-col rounded-2xl bg-card border border-foreground/10 overflow-hidden shadow-xs animate-pulse"
              >
                <div className="relative w-full aspect-[16/10] bg-foreground/10 border-b border-foreground/10"></div>

                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
                  <div className="h-5 w-3/4 bg-foreground/10 rounded mb-2"></div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="h-4 w-1/3 bg-foreground/10 rounded"></div>
                    <div className="w-6 h-6 rounded-full bg-foreground/10"></div>
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
