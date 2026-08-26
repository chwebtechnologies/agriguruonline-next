"use client"

import { PageHeader } from '@/components/ui/PageHeader'

export default function CategorySkeletonOverlay() {
  return (
    <div className="w-full h-full min-h-screen bg-background text-foreground overflow-y-auto pointer-events-auto">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Category" backText="Back" />

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div 
                key={index} 
                className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs animate-pulse"
              >
                {/* Image Skeleton */}
                <div className="relative w-full aspect-[16/10] bg-muted border-b border-border block">
                </div>
                
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
                  {/* Title Skeleton */}
                  <div className="h-5 w-3/4 bg-muted rounded mb-2"></div>
                  
                  {/* Footer Skeleton */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="h-4 w-1/3 bg-muted rounded"></div>
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
