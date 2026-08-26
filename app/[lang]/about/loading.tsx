import { PageHeader } from '@/components/ui/PageHeader'

export default function AboutLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-4 sm:px-0">
          {/* Skeleton for PageHeader */}
          <div className="h-10 w-48 bg-muted rounded animate-pulse mb-6" />
          
          <div className="space-y-12">
            {/* Hero Section Skeleton */}
            <div className="text-center space-y-4">
              <div className="h-12 bg-muted rounded w-3/4 mx-auto animate-pulse" />
              <div className="h-6 bg-muted rounded w-full max-w-2xl mx-auto animate-pulse" />
              <div className="h-6 bg-muted rounded w-5/6 max-w-2xl mx-auto animate-pulse" />
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-6 bg-card border border-border rounded-xl space-y-4">
                  <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full animate-pulse" />
                    <div className="h-4 bg-muted rounded w-full animate-pulse" />
                    <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
