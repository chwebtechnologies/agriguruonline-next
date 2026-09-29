import React from 'react'
import Image from 'next/image'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import { VideoLightboxClient } from './VideoLightboxClient'
import { VideoTriggerClient } from './VideoTriggerClient'

interface VideoItem {
  id: string
  title: string
  url: string
  video_type: string
  image: string
  video_url: string
  video_thumbnail: string
  translations: Array<{
    lang_code: string
    title: string
  }>
}

interface VideoCollectionProps {
  videos: VideoItem[]
  lang: string
  imageBaseUrl: string
  dict?: Record<string, unknown>
}

function getYoutubeId(url: string): string | null {
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export default function VideoCollection({ videos, imageBaseUrl, dict = {} }: Omit<VideoCollectionProps, 'lang'>) {
  const slides = videos.map(video => {
    const title = video.title
    const thumbnailPath = video.video_thumbnail || video.image
    const imageUrl = thumbnailPath?.startsWith('http') ? thumbnailPath : `${imageBaseUrl}${thumbnailPath}`
    
    return {
      type: 'custom-video',
      video,
      title,
      src: imageUrl
    }
  })

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {videos.map((video, index) => {
          const title = video.title
          const thumbnailPath = video.video_thumbnail || video.image
          const imageUrl = thumbnailPath?.startsWith('http') ? thumbnailPath : `${imageBaseUrl}${thumbnailPath}`
          const videoUrl = video.video_url || video.url
          const ytId = getYoutubeId(videoUrl)
          const isYoutube = !!ytId
          
          return (
            <article key={video.id} className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs relative">
              {/* Trigger overlay to handle clicks without wrapping the Image in a client boundary */}
              <VideoTriggerClient index={index} />
              
              <div className="w-full aspect-video relative overflow-hidden bg-card/30 block border-b border-border pointer-events-none">
                {index === 0 ? (
                  <Image
                    src={imageUrl}
                    alt={title}
                    title={title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={true}
                    loading="eager"
                    fetchPriority="high"
                  />
                ) : (
                  <ImageWithSkeleton
                    src={imageUrl}
                    alt={title}
                    title={title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={index < 2}
                  />
                )}
                
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transform-gpu transition-colors duration-300 flex items-center justify-center z-20 pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all duration-300 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)] group-hover:bg-white/30 group-hover:border-white/60">
                    {isYoutube ? (
                      <i className="fa-brands fa-youtube text-white text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"></i>
                    ) : (
                      <i className="fa-solid fa-play text-white text-lg ml-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"></i>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col pointer-events-none">
                <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 line-clamp-2 tracking-tight min-h-[44px] sm:min-h-[52px]" >
                  <span className="hover:text-brand-blue transition-colors text-left line-clamp-2 w-full">
                    {title}
                  </span>
                </h2>
                
                <div className="flex items-center justify-between mt-1 pointer-events-auto relative z-30">
                  <span 
                    className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1 sm:gap-1.5 group/link cursor-pointer"
                  >
                    <span aria-hidden="true">{(dict?.watch_now as string) || 'Watch Now'}</span>
                    <span className="sr-only">Watch {title}</span>
                    <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                  </span>

                  <ShareButton 
                    title={title} 
                    url={videoUrl} 
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <VideoLightboxClient slides={slides} />
    </>
  )
}
