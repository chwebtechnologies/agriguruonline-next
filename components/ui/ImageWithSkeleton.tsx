import React from 'react'
import Image from 'next/image'

const ASSETS_BASE = 'https://assets.agriguruonline.com'

export function resolveImageUrl(src: any): string {
  if (!src || typeof src !== 'string') return '/logo.webp'
  let url = src.trim()
  if (url.startsWith('/logo.') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }
  url = url.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com')
  if (!url.startsWith('http') && !url.startsWith('/')) {
    url = `${ASSETS_BASE}/${url}`
  }
  return url
}

interface ImageWithSkeletonProps {
  src: any
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
}: ImageWithSkeletonProps) {
  const resolvedSrc = resolveImageUrl(src)

  return (
    <div className={`relative overflow-hidden w-full h-full ${skeletonClassName}`}>
      <Image
        src={resolvedSrc}
        alt={alt}
        title={title || alt}
        fill={fill}
        width={fill ? undefined : (width || 400)}
        height={fill ? undefined : (height || 267)}
        sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        quality={65}
        style={{ objectFit: 'cover', ...style }}
        className={className}
      />
    </div>
  )
}
