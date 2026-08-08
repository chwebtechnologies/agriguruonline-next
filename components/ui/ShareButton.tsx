'use client'

export function ShareButton({ title, url }: { title: string, url: string }) {
  const handleShare = async () => {
    // Convert relative URL to absolute URL if needed
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url: absoluteUrl
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(absoluteUrl)
      alert('Link copied to clipboard!')
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
