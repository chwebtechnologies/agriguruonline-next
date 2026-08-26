import { PageHeader } from '@/components/ui/PageHeader'

export default function AboutLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="About Us" backText="Back" />

          {/* Hero Section Skeleton */}
          <div className="mt-8 mb-16 text-center w-full flex flex-col items-center">
            <div className="h-12 w-3/4 max-w-2xl bg-ag-header-border/50 rounded-lg animate-pulse mb-4"></div>
            <div className="h-10 w-1/2 max-w-lg bg-ag-header-border/50 rounded-lg animate-pulse mb-8"></div>
            
            <div className="w-full max-w-4xl space-y-4">
              <div className="h-4 w-full bg-ag-header-border/50 rounded animate-pulse"></div>
              <div className="h-4 w-full bg-ag-header-border/50 rounded animate-pulse"></div>
              <div className="h-4 w-5/6 bg-ag-header-border/50 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Content Section Skeleton */}
          <div className="space-y-16 w-full mt-12">
            <div className="grid md:grid-cols-2 items-center gap-8 w-full">
              <div className="w-full h-[350px] bg-ag-header-border/50 rounded-lg animate-pulse"></div>
              <div className="flex flex-col gap-6">
                <div className="h-8 w-3/4 bg-ag-header-border/50 rounded animate-pulse"></div>
                <div className="space-y-3">
                  <div className="h-5 w-1/4 bg-ag-header-border/50 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-ag-header-border/50 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-ag-header-border/50 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
