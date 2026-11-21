'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  const resolvedSrc = resolveImageUrl(src)
  const [prevSrc, setPrevSrc] = useState<string>(resolvedSrc)
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Adjust state during render when prop changes (React recommended pattern)
  // Ensures state is never reset by an effect on mount, which previously caused
  // race conditions where cached images fired onLoad before the effect reset isLoaded to false.
  if (resolvedSrc !== prevSrc) {
    setPrevSrc(resolvedSrc)
    setIsLoaded(false)
    setHasError(false)
  }

  const checkComplete = useCallback((img: HTMLImageElement | null) => {
    if (!img) return
    if (img.complete) {
      if (img.naturalWidth > 0) {
        setIsLoaded(true)
      } else if (img.naturalWidth === 0 && img.src && !img.src.endsWith('/')) {
        setHasError(true)
        setIsLoaded(true)
      }
    }
  }, [])

  // Callback ref: As soon as the DOM element is attached, check if it's already complete
  // (e.g. from browser memory cache, HTTP cache, or Service Worker cache during SPA navigation)
  const setRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node
    if (node && node.complete) {
      queueMicrotask(() => {
        if (imgRef.current === node) {
          checkComplete(node)
        }
      })
    }
  }, [checkComplete])

  useEffect(() => {
    const img = imgRef.current
    if (img) {
      checkComplete(img)
      if (!img.complete && typeof img.decode === 'function') {
        img.decode()
          .then(() => setIsLoaded(true))
          .catch(() => {
            // Decoding failed or pending; onLoad/onError will handle it
          })
      }
    }

    // Safety fallback: Ensure images are NEVER permanently stuck invisible
    // (e.g. due to dropped events, mobile viewport observer delays, or slow networks)
    const timer = setTimeout(() => {
      const currentImg = imgRef.current
      if (currentImg && currentImg.complete && currentImg.naturalWidth === 0) {
        setHasError(true)
      }
      setIsLoaded(true)
    }, 1200)

    return () => clearTimeout(timer)
  }, [resolvedSrc, checkComplete])

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true)
    }
    setIsLoaded(true)
  }, [hasError])

  const finalSrc = hasError ? FALLBACK_IMAGE : resolvedSrc

  const isCdn =
    finalSrc.includes('assets.agriguruonline.') ||
    finalSrc.includes('youtube.com') ||
    finalSrc.includes('ytimg.com') ||
    finalSrc.startsWith('http')

  const shouldBeUnoptimized = unoptimized ?? isCdn

  return (
    <div className={`relative overflow-hidden w-full h-full bg-card/40 ${skeletonClassName}`}>
      {/* Skeleton shimmer shown while image is loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted/40 animate-pulse pointer-events-none z-0" />
      )}
      <Image
        ref={setRef}
        key={finalSrc}
        src={finalSrc}
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
        onLoad={handleLoad}
        onError={handleError}
        style={{ objectFit: 'cover', ...style }}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </div>
  )
}
