"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CategoryLinkProps {
  href: string
  baseClassName?: string
  activeClassName?: string
  inactiveClassName?: string
  isActive?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export default function CategoryLink({ 
  href, 
  baseClassName = "", 
  activeClassName = "", 
  inactiveClassName = "", 
  isActive = false, 
  children, 
  onClick 
}: CategoryLinkProps) {
  const router = useRouter()

  const handleWarmup = () => {
    try {
      router.prefetch(href)
    } catch {}
  }

  return (
    <Link 
      prefetch={true} href={href} 
      onClick={onClick} 
      onPointerEnter={handleWarmup}
      onTouchStart={handleWarmup}
      className={`${baseClassName} ${isActive ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  )
}

