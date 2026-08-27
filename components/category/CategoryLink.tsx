"use client"

import Link from 'next/link'

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
  return (
    <Link 
      href={href} 
      onClick={onClick} 
      prefetch={true}
      className={`${baseClassName} ${isActive ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  )
}

