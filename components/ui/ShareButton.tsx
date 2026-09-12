'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function ShareButton({ 
  title, 
  url, 
  label,
  className 
}: { 
  title: string
  url: string
  label?: string
  className?: string 
}) {
  const [copied, setCopied] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const absoluteUrl = typeof window !== 'undefined' 
    ? (url.startsWith('http') ? url : `${window.location.origin}${url}`)
    : url

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const shareData = {
      title: title || 'AgriGuru Online',
      text: title || '',
      url: absoluteUrl
    }

    // Always try native Web Share API first if supported and secure
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.isSecureContext) {
      try {
        if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
          await navigator.share({ url: absoluteUrl })
        } else {
          await navigator.share(shareData)
        }
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.warn('Native share failed, showing custom modal:', err)
      }
    }

    // Fallback: Show custom share modal
    setShowModal(true)
  }

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(absoluteUrl)
        .then(() => showFeedback())
        .catch(() => legacyCopy(absoluteUrl))
    } else {
      legacyCopy(absoluteUrl)
    }
  }

  const legacyCopy = (text: string) => {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      textArea.setAttribute('readonly', '')
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) {
        showFeedback()
      } else {
        fallbackPrompt(text)
      }
    } catch {
      fallbackPrompt(text)
    }
  }

  const fallbackPrompt = (text: string) => {
    prompt('Copy article link:', text)
  }

  const showFeedback = () => {
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setShowModal(false)
    }, 2000)
  }

  const defaultClasses = "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-transparent hover:bg-muted text-foreground hover:text-brand-blue transition-colors cursor-pointer"

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(title + " " + absoluteUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(title)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absoluteUrl)}`
  }

  const openPopup = (url: string) => {
    window.open(url, 'share-popup', 'width=600,height=600')
    setShowModal(false)
  }

  const shareModal = mounted && showModal ? createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transform-gpu animate-in fade-in duration-200" 
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }}
    >
      <div 
        className="bg-card w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl p-6 sm:p-7 shadow-2xl border-t sm:border border-border animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" 
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
      >
        {/* Mobile Drag Handle Pill */}
        <div className="w-12 h-1.5 bg-border/60 rounded-full mx-auto mb-6 sm:hidden"></div>

        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl text-foreground tracking-tight">Share this article</h3>
          <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-border transition-colors text-foreground">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-2 mb-8">
          <button onClick={() => openPopup(shareLinks.whatsapp)} className="flex flex-col items-center gap-2.5 group">
            <div className="w-[52px] h-[52px] rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center text-[26px] group-hover:bg-[#25D366] group-hover:text-white transition-all shadow-sm">
              <i className="fa-brands fa-whatsapp"></i>
            </div>
            <span className="text-[11px] font-semibold text-foreground/80">WhatsApp</span>
          </button>
          <button onClick={() => openPopup(shareLinks.facebook)} className="flex flex-col items-center gap-2.5 group">
            <div className="w-[52px] h-[52px] rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center text-[26px] group-hover:bg-[#1877F2] group-hover:text-white transition-all shadow-sm">
              <i className="fa-brands fa-facebook-f"></i>
            </div>
            <span className="text-[11px] font-semibold text-foreground/80">Facebook</span>
          </button>
          <button onClick={() => openPopup(shareLinks.twitter)} className="flex flex-col items-center gap-2.5 group">
            <div className="w-[52px] h-[52px] rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center text-2xl group-hover:bg-black group-hover:dark:bg-white group-hover:text-white group-hover:dark:text-black transition-all shadow-sm">
              <i className="fa-brands fa-x-twitter"></i>
            </div>
            <span className="text-[11px] font-semibold text-foreground/80">X</span>
          </button>
          <button onClick={() => openPopup(shareLinks.linkedin)} className="flex flex-col items-center gap-2.5 group">
            <div className="w-[52px] h-[52px] rounded-full bg-[#0A66C2]/10 text-[#0A66C2] flex items-center justify-center text-[26px] group-hover:bg-[#0A66C2] group-hover:text-white transition-all shadow-sm">
              <i className="fa-brands fa-linkedin-in"></i>
            </div>
            <span className="text-[11px] font-semibold text-foreground/80">LinkedIn</span>
          </button>
        </div>

        <button onClick={copyToClipboard} className="w-full py-4 rounded-xl bg-muted hover:bg-border transition-colors font-bold flex items-center justify-center gap-2.5 text-foreground text-[15px]">
          <i className={`fa-solid ${copied ? 'fa-check text-brand-green' : 'fa-link'}`}></i>
          {copied ? "Link Copied to Clipboard!" : "Copy Link"}
        </button>
        
        {/* Extra padding at bottom for iOS home indicator on mobile */}
        <div className="h-4 sm:h-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}></div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button 
        type="button"
        onClick={handleShare}
        className={className || defaultClasses}
        title={copied ? "Link Copied!" : "Share"}
        aria-label="Share article"
      >
        {label && <span>{copied ? "Copied!" : label}</span>}
        <i className={`fa-solid ${copied ? 'fa-check text-brand-green' : 'fa-share-nodes'} text-xs sm:text-sm transition-transform ${copied ? 'scale-110' : ''}`}></i>
      </button>
      {shareModal}
    </>
  )
}
