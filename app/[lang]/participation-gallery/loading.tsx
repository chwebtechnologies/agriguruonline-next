import { PageHeader } from '@/components/ui/PageHeader'
import { ParticipationGalleryGridSkeleton } from './page'

export default function ParticipationGalleryLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Participation Gallery" backText="Back" />
          <ParticipationGalleryGridSkeleton />
        </div>
      </div>
    </div>
  )
}
