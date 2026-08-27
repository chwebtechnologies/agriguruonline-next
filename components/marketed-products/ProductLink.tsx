"use client"

import Link from 'next/link'

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
  return (
    <Link 
      href={href} 
      className={className} 
      title={title} 
      prefetch={true}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

