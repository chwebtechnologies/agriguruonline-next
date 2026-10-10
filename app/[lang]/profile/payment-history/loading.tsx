import { PageHeader } from '@/components/ui/PageHeader';

export default function PaymentHistoryLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
        <PageHeader title="Payment History" backText="Back" />
        <div className="mt-4 flex flex-col gap-4 animate-pulse">
          {/* Skeleton Stats Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-16 bg-muted rounded"></div>
                  <div className="h-5 w-24 bg-muted/80 rounded"></div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-muted/60 shrink-0"></div>
              </div>
            ))}
          </div>

          {/* Skeleton Toolbar */}
          <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="h-9 flex-1 bg-muted/50 rounded-lg"></div>
              <div className="flex gap-1.5">
                <div className="h-8 w-16 bg-muted/60 rounded-lg"></div>
                <div className="h-8 w-18 bg-muted/60 rounded-lg"></div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <div className="flex gap-2">
                <div className="h-6 w-28 bg-muted/50 rounded"></div>
                <div className="h-6 w-28 bg-muted/50 rounded"></div>
              </div>
              <div className="h-4 w-32 bg-muted/40 rounded"></div>
            </div>
          </div>

          {/* Skeleton Table Card */}
          <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-border bg-muted/30 flex justify-between">
              <div className="h-4 w-28 bg-muted rounded"></div>
              <div className="h-4 w-32 bg-muted rounded"></div>
              <div className="h-4 w-16 bg-muted rounded"></div>
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-4 w-18 bg-muted rounded"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
              <div className="h-4 w-16 bg-muted rounded"></div>
            </div>
            <div className="divide-y divide-border">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-3.5 flex items-center justify-between gap-4">
                  <div className="h-4 w-28 bg-muted/60 rounded"></div>
                  <div className="h-4 w-36 bg-muted/70 rounded"></div>
                  <div className="h-4 w-16 bg-muted/50 rounded-full"></div>
                  <div className="h-4 w-24 bg-muted/50 rounded"></div>
                  <div className="h-4 w-28 bg-muted/50 rounded"></div>
                  <div className="h-4 w-16 bg-muted/70 rounded"></div>
                  <div className="h-5 w-20 bg-muted/50 rounded"></div>
                  <div className="h-4 w-20 bg-muted/50 rounded"></div>
                  <div className="h-7 w-20 bg-muted/60 rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
