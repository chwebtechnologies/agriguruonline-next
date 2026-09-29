"use client";

export default function OfflinePage() {
  const isArabic = typeof window !== 'undefined' && window.location.pathname.startsWith('/ar');
  const isFrench = typeof window !== 'undefined' && window.location.pathname.startsWith('/fr');
  const isChinese = typeof window !== 'undefined' && window.location.pathname.startsWith('/zh');
  
  const dict = {
    offline: isArabic ? 'أنت غير متصل بالإنترنت' : isFrench ? 'Vous êtes hors ligne' : isChinese ? '您已离线' : 'You are offline',
    desc: isArabic ? 'يرجى التحقق من اتصالك بالإنترنت. سنقوم بإعادة الاتصال تلقائيًا.' : isFrench ? 'Veuillez vérifier votre connexion.' : isChinese ? '请检查您的互联网连接。' : 'Please check your internet connection or try again later.',
    try_again: isArabic ? 'حاول مرة أخرى' : isFrench ? 'Réessayer' : isChinese ? '重试' : 'Try Again'
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <i className="fa-solid fa-wifi-slash text-6xl text-muted-foreground mb-4"></i>
      <h1 className="text-2xl font-bold mb-2">{dict.offline}</h1>
      <p className="text-muted-foreground mb-6">
        {dict.desc}
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium"
      >
        {dict.try_again}
      </button>
    </div>
  );
}
