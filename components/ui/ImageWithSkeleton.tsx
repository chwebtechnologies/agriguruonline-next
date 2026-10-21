'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { resolveImageUrl, FALLBACK_IMAGE } from '@/lib/image-utils'

interface ImageWithSkeletonProps {
  src: unknown
  alt?: string
  title?: string
  fill?: boolean
  sizes?: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  skeletonClassName?: string
  style?: React.CSSProperties
  unoptimized?: boolean
}

export default function ImageWithSkeleton({
  src,
  alt = 'Image',
  title,
  fill = false,
  sizes,
  width,
  height,
  priority = false,
  className = '',
  skeletonClassName = '',
  style,
  unoptimized,
}: ImageWithSkeletonProps) {
  const initialSrc = resolveImageUrl(src)
  const [imgSrc, setImgSrc] = useState<string>(initialSrc)
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)

  useEffect(() => {
    const nextSrc = resolveImageUrl(src)
    setImgSrc(nextSrc)
    setHasError(false)
    setIsLoaded(false)
  }, [src])

  const isCdn = 
    imgSrc.includes('assets.agriguruonline.') || 
    imgSrc.includes('youtube.com') || 
    imgSrc.includes('ytimg.com') ||
    imgSrc.startsWith('http');

  const shouldBeUnoptimized = unoptimized ?? isCdn;

  return (
    <div className={`relative overflow-hidden w-full h-full bg-card/40 ${skeletonClassName}`}>
      {/* Skeleton shimmer shown while image is loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted/40 animate-pulse pointer-events-none z-0" />
      )}
      <Image
        src={hasError ? FALLBACK_IMAGE : imgSrc}
        alt={alt}
        title={title || alt}
        fill={fill}
        width={fill ? undefined : (width || 400)}
        height={fill ? undefined : (height || 267)}
        sizes={sizes || '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'}
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        unoptimized={shouldBeUnoptimized}
        quality={shouldBeUnoptimized ? undefined : 75}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError) {
            setHasError(true)
            setImgSrc(FALLBACK_IMAGE)
          }
          setIsLoaded(true)
        }}
        style={{ objectFit: 'cover', ...style }}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </div>
  )
}
