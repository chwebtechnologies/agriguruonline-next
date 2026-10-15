"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function FastLink({ 
  href,
  onPointerEnter,
  onTouchStart,
  ...props 
}: React.ComponentProps<typeof Link>) {
  const router = useRouter()

  const handleWarmup = (e: React.PointerEvent<HTMLAnchorElement> | React.TouchEvent<HTMLAnchorElement>) => {
    try {
      if (href) {
        router.prefetch(String(href))
      }
    } catch {}
  }

  return (
    <Link 
      href={href}
      onPointerEnter={(e) => {
        handleWarmup(e)
        if (onPointerEnter) onPointerEnter(e)
      }}
      onTouchStart={(e) => {
        handleWarmup(e)
        if (onTouchStart) onTouchStart(e)
      }}
      {...props}
    />
  )
}
