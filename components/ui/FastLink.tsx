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
    // Disabled manual prefetch to save network bandwidth on 2G connections
  }

  return (
    <Link 
      href={href}
      prefetch={false}
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
