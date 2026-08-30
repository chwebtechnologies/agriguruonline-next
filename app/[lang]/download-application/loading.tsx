import { PageHeader } from '@/components/ui/PageHeader'

export default function DownloadAppLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 animate-pulse">
          
          {/* Header */}
          <PageHeader title="Download App" backText="Back" />

          {/* SECTION 1: HERO */}
          <section className="relative pt-4 sm:pt-6 lg:pt-8 pb-8 lg:pb-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
              <div className="flex-1 w-full lg:w-1/2 space-y-6">
                <div className="h-8 bg-muted rounded-full w-3/4 mx-auto lg:mx-0"></div>
                <div className="h-16 bg-muted rounded-xl w-full mx-auto lg:mx-0"></div>
                <div className="h-16 bg-muted rounded-xl w-5/6 mx-auto lg:mx-0"></div>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <div className="h-14 w-40 bg-muted rounded-2xl"></div>
                  <div className="h-14 w-40 bg-muted rounded-2xl"></div>
                </div>
              </div>
              <div className="flex-1 w-full lg:w-1/2 relative h-[320px] sm:h-[440px] lg:h-[480px] flex justify-center items-center mt-6 lg:mt-0">
                <div className="h-[290px] sm:h-[420px] lg:h-[490px] w-[145px] sm:w-[210px] lg:w-[245px] bg-muted rounded-[2rem]"></div>
              </div>
            </div>
          </section>

          {/* SECTION 2: CORE PROBLEM 1 */}
          <section className="pt-8 sm:pt-10 pb-12 sm:pb-16 border-t border-border/50 relative overflow-hidden">
            <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 flex flex-col items-center">
              <div className="h-10 w-2/3 bg-muted rounded-lg mb-4"></div>
              <div className="h-6 w-1/2 bg-muted rounded-lg"></div>
            </div>
            
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
              <div className="flex-1 flex justify-center relative w-full py-4 sm:py-6">
                <div className="h-[340px] sm:h-[460px] lg:h-[500px] w-[170px] sm:w-[230px] lg:w-[250px] bg-muted rounded-[2rem]"></div>
              </div>
              <div className="flex-[1.5] w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="bg-card p-4 sm:p-5 rounded-xl border border-border/60">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-muted shrink-0"></div>
                      <div className="h-5 w-1/2 bg-muted rounded"></div>
                    </div>
                    <div className="h-4 w-full bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 3: CORE PROBLEM 2 */}
          <section className="py-10 sm:py-16 border-t border-border/50 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
              <div className="flex-[1.5] order-2 lg:order-1 space-y-6">
                <div className="flex items-center justify-center lg:justify-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-muted shrink-0"></div>
                  <div className="h-10 w-2/3 bg-muted rounded-lg"></div>
                </div>
                <div className="h-20 bg-muted rounded-lg w-full max-w-2xl mx-auto lg:mx-0"></div>
                <div className="space-y-3.5 max-w-xl mx-auto lg:mx-0">
                  <div className="h-24 bg-muted rounded-xl"></div>
                  <div className="h-24 bg-muted rounded-xl"></div>
                </div>
              </div>
              <div className="flex-1 flex justify-center order-1 lg:order-2 relative w-full py-4 sm:py-6">
                 <div className="h-[340px] sm:h-[460px] lg:h-[500px] w-[170px] sm:w-[230px] lg:w-[250px] bg-muted rounded-[2rem]"></div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
