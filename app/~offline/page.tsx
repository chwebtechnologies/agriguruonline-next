"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflinePage() {
  const router = useRouter();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isArabic = typeof window !== 'undefined' && window.location.pathname.startsWith('/ar');
  const isFrench = typeof window !== 'undefined' && window.location.pathname.startsWith('/fr');
  const isChinese = typeof window !== 'undefined' && window.location.pathname.startsWith('/zh');
  
  const dict = {
    offline: isArabic ? 'أنت غير متصل بالإنترنت' : isFrench ? 'Vous êtes hors ligne' : isChinese ? '您已离线' : 'You are offline',
    desc: isArabic ? 'يرجى التحقق من اتصالك بالإنترنت. سنقوم بإعادة الاتصال تلقائيًا.' : isFrench ? 'Veuillez vérifier votre connexion. Reconnexion automatique dès le retour du réseau.' : isChinese ? '请检查您的互联网连接。恢复网络后将自动重连。' : 'Please check your internet connection. We will automatically reconnect once you are back online.',
    try_again: isArabic ? 'إعادة المحاولة' : isFrench ? 'Réessayer' : isChinese ? '重试' : 'Try Again',
    reconnecting: isArabic ? 'جارٍ إعادة الاتصال...' : isFrench ? 'Reconnexion en cours...' : isChinese ? '正在重新连接...' : 'Reconnecting...',
  };

  const handleReconnect = () => {
    setIsReconnecting(true);
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/');
    }
  };

  useEffect(() => {
    const onOnline = () => {
      handleReconnect();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background text-foreground">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        {isReconnecting ? (
          <i className="fa-solid fa-spinner fa-spin text-3xl text-brand-blue" />
        ) : (
          <i className="fa-solid fa-wifi text-3xl text-muted-foreground relative">
            <span className="absolute top-1/2 left-1/2 w-[130%] h-0.5 bg-destructive -translate-x-1/2 -translate-y-1/2 -rotate-45" />
          </i>
        )}
      </div>
      <h1 className="text-2xl font-bold mb-2">
        {isReconnecting ? dict.reconnecting : dict.offline}
      </h1>
      <p className="text-muted-foreground mb-6 max-w-md text-sm md:text-base">
        {dict.desc}
      </p>
      <button 
        onClick={handleReconnect}
        disabled={isReconnecting}
        className="px-6 py-2.5 bg-brand-blue text-white rounded-full font-medium hover:bg-brand-blue-hover transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
      >
        <i className={`fa-solid ${isReconnecting ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`} />
        {isReconnecting ? dict.reconnecting : dict.try_again}
      </button>
    </div>
  );
}
