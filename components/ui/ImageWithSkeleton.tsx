"use client"

import { useState, useRef, useEffect } from 'react'

const ASSETS_BASE = 'https://assets.agriguruonline.com'

export function resolveImageUrl(src: any): string {
  if (!src || typeof src !== 'string') return '/logo.svg'
  let url = src.trim()
  // Rewrite wrong domain
  url = url.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com')
  // Prepend CDN base for relative paths
  if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('data:') && !url.startsWith('blob:')) {
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
  fill,
  sizes,
  width,
  height,
  priority = false,
  className = '',
  skeletonClassName = '',
  style,
}: ImageWithSkeletonProps) {
  const resolvedSrc = resolveImageUrl(src)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const finalSrc = errored ? '/logo.svg' : resolvedSrc

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [finalSrc])

  const imgStyle: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
    : { width: width || '100%', height: height || 'auto', objectFit: 'cover' }

  return (
    <div
      className={`relative overflow-hidden w-full h-full ${skeletonClassName}`}
      style={{ backgroundColor: loaded ? 'transparent' : 'var(--muted, #e5e7eb)' }}
    >
      <img
        ref={imgRef}
        src={finalSrc}
        alt={alt}
        title={title || alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        style={{ ...imgStyle, opacity: loaded ? 1 : 0, transition: 'opacity 0.15s ease', ...style }}
        className={`${fill ? 'absolute inset-0 object-cover' : ''} ${className}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!errored) {
            setErrored(true)
            setLoaded(true)
          }
        }}
      />
    </div>
  )
}
