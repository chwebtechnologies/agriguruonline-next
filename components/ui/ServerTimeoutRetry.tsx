'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ServerTimeoutRetryProps {
  title?: string
  description?: string
  retryText?: string
  lang?: string
  onRetry?: () => void | Promise<void>
  className?: string
}

const DICTIONARY: Record<string, { title: string; desc: string; retry: string; retrying: string }> = {
  en: {
    title: 'Server response taking longer than expected',
    desc: 'The server took too long to respond. This might be due to a temporary network lag or slow connection.',
    retry: 'Retry Now',
    retrying: 'Connecting...',
  },
  ar: {
    title: 'استجابة الخادم تستغرق وقتًا أطول من المتوقع',
    desc: 'استغرق الخادم وقتًا طويلاً للاستجابة. قد يكون هذا بسبب بطء في اتصالك أو مشكلة مؤقتة.',
    retry: 'إعادة المحاولة الآن',
    retrying: 'جارٍ الاتصال...',
  },
  fr: {
    title: 'La réponse du serveur prend plus de temps que prévu',
    desc: 'Le serveur a mis trop de temps à répondre. Cela peut être dû à un réseau lent ou à une latence temporaire.',
    retry: 'Réessayer maintenant',
    retrying: 'Connexion...',
  },
  zh: {
    title: '服务器响应超时',
    desc: '服务器响应时间过长。这可能是由于网络延迟或连接速度较慢引起的。',
    retry: '立即重试',
    retrying: '连接中...',
  },
}

export function ServerTimeoutRetry({
  title,
  description,
  retryText,
  lang = 'en',
  onRetry,
  className = '',
}: ServerTimeoutRetryProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  
  const safeLang = (DICTIONARY[lang] ? lang : 'en')
  const t = DICTIONARY[safeLang]

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      if (onRetry) {
        await onRetry()
      } else {
        // Default: Soft refresh Next.js Server Components without full browser reload
        router.refresh()
      }
    } finally {
      setTimeout(() => {
        setIsRetrying(false)
      }, 1500)
    }
  }

  return (
    <div className={`text-center py-12 px-4 bg-background rounded-2xl border border-dashed border-border mt-2 ${className}`}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4">
        {isRetrying ? (
          <i className="fa-solid fa-spinner fa-spin text-2xl" />
        ) : (
          <i className="fa-solid fa-clock-rotate-left text-2xl" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">
        {title || t.title}
      </h3>
      <p className="text-sm text-foreground/75 max-w-md mx-auto mb-5">
        {description || t.desc}
      </p>
      <button
        onClick={handleRetry}
        disabled={isRetrying}
        className="inline-flex items-center justify-center gap-2 h-10 px-6 text-sm font-medium transition-all duration-200 rounded-full bg-brand-blue text-white hover:bg-brand-blue-hover focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 dark:focus:ring-offset-zinc-950 cursor-pointer disabled:opacity-60 shadow-xs"
      >
        <i className={`fa-solid ${isRetrying ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`} />
        {isRetrying ? t.retrying : (retryText || t.retry)}
      </button>
    </div>
  )
}

export default ServerTimeoutRetry
