import { PageHeader } from '@/components/ui/PageHeader';

export default function AIPredictLoading() {
  return (
    <div className="bg-background text-foreground transition-theme pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="AI Predict" backText="Back" />

          <div className="flex flex-col gap-4 sm:gap-5 mt-4">
            {/* Top Action Bar Skeleton */}
            <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm h-[68px] sm:h-[80px] animate-pulse">
              <div className="flex-1 relative">
                <div className="w-full h-11 sm:h-12 bg-muted/40 rounded-lg"></div>
              </div>
            </div>

            {/* Grid of skeleton cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl h-[120px] animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
