"use client"

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ProductSkeletonOverlay from './ProductSkeletonOverlay'

interface ProductLinkProps {
  href: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

export default function ProductLink({ 
  href, 
  className = "", 
  children, 
  onClick 
}: ProductLinkProps) {
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

  // Listen for global navigation events
  useEffect(() => {
    const handleNavigating = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setGlobalNavigatingTo(customEvent.detail)
    }
    window.addEventListener('productNavigating', handleNavigating)
    return () => window.removeEventListener('productNavigating', handleNavigating)
  }, [])

  // Reset pending state if the pathname changes (navigation completed)
  useEffect(() => {
    setIsPending(false)
    setGlobalNavigatingTo(null)
  }, [pathname])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only intercept if we are navigating to a different page
    if (pathname !== href) {
      e.preventDefault()
      if (onClick) onClick()
      
      // Dispatch global event
      window.dispatchEvent(new CustomEvent('productNavigating', { detail: href }))
      
      setIsPending(true)
      router.push(href)
    } else {
      if (onClick) onClick()
    }
  }

  return (
    <>
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
      
      {isPending && portalNode && createPortal(
        <ProductSkeletonOverlay />,
        portalNode
      )}
    </>
  )
}
