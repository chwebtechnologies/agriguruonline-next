'use client';

import React from 'react';

interface SmartDocsFooterProps {
  activeLang?: string;
  dict?: any;
}

export function SmartDocsFooter({ activeLang = 'en', dict }: SmartDocsFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      id="smart-docs-footer"
      className="fixed bottom-0 left-0 right-0 z-[60] w-full bg-card/95 backdrop-blur-md border-t border-border text-foreground transition-colors duration-200 shadow-xs"
      style={{ paddingLeft: 'var(--ag-container-px, 1rem)', paddingRight: 'var(--ag-container-px, 1rem)' }}
    >
      <div className="mx-auto max-w-7xl h-11 sm:h-12 flex flex-row items-center justify-between gap-2.5 sm:gap-4 select-none">
        {/* Left Side: Copyright Notice */}
        <div className="text-xs sm:text-sm text-muted-foreground font-medium truncate min-w-0">
          <span>© {currentYear} AgriGuru Online. All rights reserved.</span>
        </div>

        {/* Right Side: WhatsApp Help & Support button */}
        <div className="flex items-center shrink-0">
          <a
            href="https://wa.me/918980131000?text=Hello%20AgriGuru%20Team%2C%20I%20need%20assistance%20with%20Smart%20Docs."
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Help & Support"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-2xs group focus:outline-none focus:ring-2 focus:ring-emerald-500/30 whitespace-nowrap shrink-0"
          >
            <i className="fa-brands fa-whatsapp text-emerald-500 text-sm sm:text-base transition-transform group-hover:scale-110"></i>
            <span>Help & Support</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default SmartDocsFooter;