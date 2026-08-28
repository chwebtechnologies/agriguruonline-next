"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ProductLinkProps {
  href: string
  className?: string
  title?: string
  children: React.ReactNode
  onClick?: () => void
}

export default function ProductLink({ 
  href, 
  className = "", 
  title,
  children, 
  onClick 
}: ProductLinkProps) {
  const router = useRouter()

  const handleWarmup = () => {
    try {
      router.prefetch(href)
    } catch {}
  }

  return (
    <Link 
      href={href} 
      className={className} 
      title={title} 
      prefetch={true}
      onPointerEnter={handleWarmup}
      onTouchStart={handleWarmup}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

