'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useScrollLock } from '@/lib/scroll-lock';

interface BecomeMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
  userProfile?: any;
  dict?: any;
}

export default function BecomeMemberModal({
  isOpen,
  onClose,
  lang = 'en',
  userProfile = null,
  dict = {},
}: BecomeMemberModalProps) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const fullName = userProfile?.first_name
    ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
    : userProfile?.name || 'Valued User';

  const customerId =
    userProfile?.customer_id ||
    userProfile?.id ||
    userProfile?.mobile_no ||
    userProfile?.email ||
    'Regular Member';

  const whatsappMessage = encodeURIComponent(
    `Hi AgriGuru Support, I have a Regular account (ID: ${customerId}) and would like to activate a Membership Plan to access full trader features.`
  );

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="become-member-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-card text-foreground rounded-3xl border border-border shadow-2xl p-6 sm:p-7 overflow-y-auto max-h-[90vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>

        {/* Header Icon + Title */}
        <div className="text-center pt-2 pb-4">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
            <i className="fa-solid fa-crown text-2xl"></i>
          </div>
          <h2
            id="become-member-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
          >
            Become a Member
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Unlock Full Trading Features on AgriGuru Online
          </p>
        </div>

        {/* User Badge */}
        <div className="mb-5 p-3 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs shrink-0">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <span className="font-semibold block truncate">{fullName}</span>
              <span className="text-[11px] text-muted-foreground">ID: {customerId}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
            Regular Account
          </span>
        </div>

        {/* Exclusive Benefits List */}
        <div className="space-y-2.5 mb-6 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5">
            <i className="fa-solid fa-check text-emerald-500 mt-0.5 text-xs"></i>
            <span className="text-foreground/90">
              Submit unlimited buy inquiries & seller offers
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <i className="fa-solid fa-check text-emerald-500 mt-0.5 text-xs"></i>
            <span className="text-foreground/90">
              Direct communication with verified international suppliers
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <i className="fa-solid fa-check text-emerald-500 mt-0.5 text-xs"></i>
            <span className="text-foreground/90">
              Full access to price charts, historical market trends & freight rates
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <i className="fa-solid fa-check text-emerald-500 mt-0.5 text-xs"></i>
            <span className="text-foreground/90">
              Priority KYC verification badge on your profile
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <Link
            href={`/${lang}/membership`}
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <i className="fa-solid fa-gem text-xs"></i>
            <span>View Membership Plans</span>
          </Link>

          <a
            href={`https://wa.me/918369066698?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <i className="fa-brands fa-whatsapp text-base text-emerald-600"></i>
            <span>Activate via WhatsApp</span>
          </a>
        </div>

        {/* Trust Footnote */}
        <div className="mt-4 pt-3 border-t border-border/50 text-center">
          <span className="text-[10.5px] text-muted-foreground font-medium flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
            Zero Risk • Instant Activation • Cancel Anytime
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
