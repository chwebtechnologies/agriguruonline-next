'use client'

export function ShareButton({ title, url }: { title: string, url: string }) {
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Convert relative URL to absolute URL if needed
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: title, // Adding text is crucial for apps like WhatsApp to pick up the share properly on iOS
          url: absoluteUrl
        })
      } catch (err: any) {
        // User cancelled share
        if (err.name === 'AbortError') return;
        
        console.error('Error sharing:', err)
        fallbackShare(absoluteUrl)
      }
    } else {
      fallbackShare(absoluteUrl)
    }
  }

  const fallbackShare = (absoluteUrl: string) => {
    // Fallback for browsers/OS that don't support Web Share API
    if (navigator.clipboard) {
      navigator.clipboard.writeText(absoluteUrl).then(() => {
        alert('Link copied to clipboard!')
      }).catch(err => {
        console.error('Failed to copy: ', err)
      })
    }
  }

  return (
    <button 
      onClick={handleShare}
      className="flex items-center justify-center w-7 h-7 rounded-full bg-ag-subheader-bg text-foreground hover:text-ag-primary transition-colors"
      title="Share"
    >
      <i className="fa-solid fa-share-nodes text-sm"></i>
    </button>
  )
}
