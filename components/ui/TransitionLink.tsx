'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, ReactNode } from 'react'

export function TransitionLink({ 
  href, 
  children, 
  className,
  prefetch
}: { 
  href: string
  children: ReactNode
  className?: string
  prefetch?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        // Here we could trigger a global loading state
        // For now, Next.js handles it. 
        startTransition(() => {
          router.push(href)
        })
      }}
    >
      {children}
    </a>
  )
}
