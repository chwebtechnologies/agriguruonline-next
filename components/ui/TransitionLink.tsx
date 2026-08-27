'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

export function TransitionLink({ 
  href, 
  children, 
  className,
  prefetch = true
}: { 
  href: string
  children: ReactNode
  className?: string
  prefetch?: boolean
}) {
  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
    >
      {children}
    </Link>
  )
}

