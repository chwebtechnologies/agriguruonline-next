import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
          <PageHeader title="Alerts Setups" backText="Back" />
          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="h-6 bg-muted rounded w-1/2"></div>
                    <div className="h-5 bg-muted rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="flex justify-between mt-2 pt-3 border-t border-border">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-1/4"></div>
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
