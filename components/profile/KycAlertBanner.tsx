'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchKycDocsForClient } from '@/app/actions/profile';
import { setUnreadStatusInIndexedDB } from '@/lib/notificationStorage';

interface KycAlertBannerProps {
  initialIsKycVerified: boolean;
  initialKycStatus: string;
  userId?: string;
  lang?: string;
}

function computeStatusFromDocs(docs: any[]): { kycStatus: string; isKycVerified: boolean } {
  if (!Array.isArray(docs) || docs.length === 0) {
    return { kycStatus: 'MISSING', isKycVerified: false };
  }

  const hasRejected = docs.some((item: any) => item.is_uploaded && item.status?.toUpperCase() === 'REJECTED');
  const hasApproved = docs.some((item: any) => item.is_uploaded && item.status?.toUpperCase() === 'APPROVED');
  const hasActive = docs.some((item: any) => {
    if (!item.is_uploaded) return false;
    const s = item.status?.toUpperCase();
    return s !== 'REJECTED' && s !== 'EXPIRED';
  });

  // Priority 1: If ANY document is rejected, KYC status is REJECTED
  if (hasRejected) return { kycStatus: 'REJECTED', isKycVerified: false };
  // Priority 2: If approved and no rejection
  if (hasApproved && !hasRejected) return { kycStatus: 'APPROVED', isKycVerified: true };
  // Priority 3: If under review
  if (hasActive) return { kycStatus: 'PROCESSING', isKycVerified: false };
  // Priority 4: Missing
  return { kycStatus: 'MISSING', isKycVerified: false };
}

export default function KycAlertBanner({ initialIsKycVerified, initialKycStatus, userId, lang = 'en' }: KycAlertBannerProps) {
  const [isKycVerified, setIsKycVerified] = useState(initialIsKycVerified);
  const [kycStatus, setKycStatus] = useState(initialKycStatus);

  // Sync if server re-renders with new props
  useEffect(() => {
    setIsKycVerified(initialIsKycVerified);
    setKycStatus(initialKycStatus);
  }, [initialIsKycVerified, initialKycStatus]);

  // Client-side refresh: call API directly with no cache
  const refreshFromApi = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetchKycDocsForClient(lang, userId);
      if (res.success && Array.isArray(res.data)) {
        const { kycStatus: newStatus, isKycVerified: newVerified } = computeStatusFromDocs(res.data);
        setKycStatus(newStatus);
        setIsKycVerified(newVerified);
        if (newStatus === 'REJECTED') {
          setUnreadStatusInIndexedDB(true);
          window.dispatchEvent(new CustomEvent('new-notification', { detail: { type: 'kyc', status: 'REJECTED' } }));
        }
      }
    } catch (e) {
      console.error('[KycAlertBanner] Failed to refresh KYC status:', e);
    }
  }, [userId, lang]);



  // Listen for custom event from KycSection when documents are uploaded or updated
  useEffect(() => {
    const handleKycDocsUpdated = (event: any) => {
      const docs = event.detail?.docs;
      if (Array.isArray(docs)) {
        const { kycStatus: newStatus, isKycVerified: newVerified } = computeStatusFromDocs(docs);
        setKycStatus(newStatus);
        setIsKycVerified(newVerified);
      } else {
        refreshFromApi();
      }
    };
    window.addEventListener('kyc-docs-updated', handleKycDocsUpdated);
    return () => window.removeEventListener('kyc-docs-updated', handleKycDocsUpdated);
  }, [refreshFromApi]);

  // Listen for FCM notifications and refresh KYC status immediately
  useEffect(() => {
    const handleFcmMessage = (event: any) => {
      const payload = event.detail;
      const title = payload?.notification?.title || payload?.data?.title || '';
      const body = payload?.notification?.body || payload?.data?.body || '';
      const type = payload?.data?.type || '';

      const isKycRelated =
        (title + body + type).toLowerCase().includes('kyc') ||
        (title + body).toLowerCase().includes('document') ||
        (title + body).toLowerCase().includes('verif') ||
        (title + body).toLowerCase().includes('reject') ||
        (title + body).toLowerCase().includes('approv');

      if (isKycRelated) {
        setUnreadStatusInIndexedDB(true);
        window.dispatchEvent(new CustomEvent('new-notification', { detail: payload }));
        // Immediately set optimistic UI based on notification text
        if (body.toLowerCase().includes('reject') || title.toLowerCase().includes('reject')) {
          setKycStatus('REJECTED');
          setIsKycVerified(false);
        } else if (body.toLowerCase().includes('approv') || title.toLowerCase().includes('approv')) {
          setKycStatus('APPROVED');
          setIsKycVerified(true);
        } else {
          setKycStatus('MISSING');
          setIsKycVerified(false);
        }
        // Then confirm from API immediately and once again after 1.5s
        refreshFromApi();
        setTimeout(() => refreshFromApi(), 1500);
      }
    };

    window.addEventListener('fcm-message', handleFcmMessage);
    return () => window.removeEventListener('fcm-message', handleFcmMessage);
  }, [refreshFromApi]);

  // If status is APPROVED or PROCESSING, hide the banner
  if (kycStatus === 'APPROVED' || kycStatus === 'PROCESSING') {
    return null;
  }

  // If verified and NOT rejected/missing, hide banner
  if (isKycVerified && kycStatus !== 'REJECTED' && kycStatus !== 'MISSING') {
    return null;
  }

  return (
    <div className={`mb-6 border rounded-xl p-3 sm:px-5 flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 ${
      kycStatus === 'REJECTED'
        ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
    }`}>
      <div className="flex items-center gap-3 w-full">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 hidden sm:flex ${
          kycStatus === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/50 text-red-600' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'
        }`}>
          <i className={`fa-solid ${kycStatus === 'REJECTED' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'} text-sm`}></i>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:gap-2">
          <h3 className={`font-extrabold text-sm sm:text-base ${
            kycStatus === 'REJECTED' ? 'text-red-800 dark:text-red-400' : 'text-amber-800 dark:text-amber-400'
          }`}>
            {kycStatus === 'REJECTED' ? 'KYC Rejected' : 'Action Required: KYC Verification'}
          </h3>
          <span className={`hidden md:inline font-bold ${
            kycStatus === 'REJECTED' ? 'text-red-400' : 'text-amber-400'
          }`}>-</span>
          <p className={`text-sm font-medium leading-tight sm:leading-normal mt-0.5 md:mt-0 ${
            kycStatus === 'REJECTED' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
          }`}>
            {kycStatus === 'REJECTED'
              ? 'Please upload a clear new document to verify.'
              : 'Please upload required document to verify and unlock trading features.'}
          </p>
        </div>
      </div>
      <a href="#kyc-section" className={`shrink-0 px-4 py-2 sm:px-5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-sm transition-all whitespace-nowrap text-white ${
        kycStatus === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
      }`}>
        Verify Now
      </a>
    </div>
  );
}
