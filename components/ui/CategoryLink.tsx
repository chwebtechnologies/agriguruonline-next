"use client"

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CategorySkeletonOverlay from './CategorySkeletonOverlay'

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
  const pathname = usePathname()
  const [isPending, setIsPending] = useState(false)
  const [globalNavigatingTo, setGlobalNavigatingTo] = useState<string | null>(null)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.getElementById('skeleton-portal')
    if (el) {
      setPortalNode(el)
    } else {
      setPortalNode(document.body)
    }
  }, [])

  // Listen for global navigation events from any CategoryLink
  useEffect(() => {
    const handleNavigating = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setGlobalNavigatingTo(customEvent.detail)
    }
    window.addEventListener('categoryNavigating', handleNavigating)
    return () => window.removeEventListener('categoryNavigating', handleNavigating)
  }, [])

  // Reset pending state if the pathname changes (navigation completed)
  useEffect(() => {
    setIsPending(false)
    setGlobalNavigatingTo(null)
  }, [pathname])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only intercept if we are navigating to a different page to avoid stuck skeleton
    if (pathname !== href) {
      e.preventDefault()
      if (onClick) onClick()
      
      // Dispatch global event so all other links know to remove their active state
      window.dispatchEvent(new CustomEvent('categoryNavigating', { detail: href }))
      
      setIsPending(true)
      router.push(href)
    } else {
      // If clicking the same page, just let it be or close the menu
      if (onClick) onClick()
    }
  }

  // If we are actively navigating, only the target link should look active.
  // Otherwise, fallback to the standard isActive check based on the current URL.
  const actuallyActive = globalNavigatingTo 
    ? globalNavigatingTo === href 
    : isActive

  return (
    <>
      <a href={href} onClick={handleClick} className={`${baseClassName} ${actuallyActive ? activeClassName : inactiveClassName}`}>
        {children}
      </a>
      
      {isPending && portalNode && createPortal(
        <CategorySkeletonOverlay />,
        portalNode
      )}
    </>
  )
}
