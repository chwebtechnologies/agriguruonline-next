"use client"

import Image, { ImageProps } from 'next/image'
import { useState, useRef, useEffect } from 'react'

interface ImageWithSkeletonProps extends ImageProps {
  skeletonClassName?: string
}

export default function ImageWithSkeleton({
  skeletonClassName = "",
  className = "",
  onLoad,
  ...props
}: ImageWithSkeletonProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) {
      setIsLoaded(true)
    }
  }, [])

  return (
    <div className={`relative overflow-hidden w-full h-full ${skeletonClassName}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-ag-subheader-border animate-pulse z-0" />
      )}
      <Image
        {...props}
        fetchPriority={props.priority ? 'high' : 'auto'}
        ref={imgRef}
        className={`transition-opacity duration-500 ease-in-out z-10 ${isLoaded ? "opacity-100" : "opacity-0"} ${className}`}
        onLoad={(e) => {
          setIsLoaded(true)
          if (onLoad) onLoad(e)
        }}
      />
    </div>
  )
}
