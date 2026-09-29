"use client";

import { useEffect, useState } from "react";

interface LoginRequiredBannerProps {
  redirectUrl: string | undefined;
  dict?: any;
}

export default function LoginRequiredBanner({ redirectUrl, dict = {} }: LoginRequiredBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show the banner if there is a redirectUrl
    if (redirectUrl) {
      setIsVisible(true);
    }
  }, [redirectUrl]);

  if (!isVisible || !redirectUrl) return null;

  // Helper to format the URL into a friendly page name dynamically
  const getFriendlyPageName = (url: string) => {
    try {
      // Handle both absolute and relative URLs
      const path = url.startsWith('http') ? new URL(url).pathname : url;
      const parts = path.split('/').filter(Boolean);
      
      // If it has a locale (2 chars), skip it
      const hasLocale = parts[0]?.length === 2;
      const segment = hasLocale ? parts[1] : parts[0];

      if (!segment) return "this page";

      // Handle special casing for AI Predict
      if (segment.toLowerCase() === 'ai-predict') {
        return "AI Predict";
      }

      // Capitalize and replace dashes with spaces (e.g., market-reports -> Market Reports)
      return segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    } catch (e) {
      return "this page";
    }
  };

  const pageName = getFriendlyPageName(redirectUrl);

  return (
    <div className="w-full max-w-md mx-auto mb-2 overflow-hidden rounded-lg bg-primary/5 border border-primary/20 shadow-sm animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex-shrink-0 text-primary">
          <i className="fa-solid fa-lock text-sm"></i>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-foreground">
            {dict?.please_sign_in_register || 'Please Sign In / Register to access'} <span className="font-semibold text-primary">{pageName}</span>
          </p>
        </div>
        
        <button 
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 text-foreground opacity-40 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-foreground/5"
          aria-label={dict?.dismiss_banner || 'Dismiss banner'}
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>
    </div>
  );
}
