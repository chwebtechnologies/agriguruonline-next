'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getProductSlugByName } from '@/lib/product-slug-utils';
import { getLatestInquiryDetailsAction } from '@/app/actions/inquiries';
import { ActionIndicationModal } from '@/components/ui/charts/ActionIndicationModal';
import { InquiryNegotiationModal, InquiryDetailsData } from './InquiryNegotiationModal';

interface Inquiry {
  id: string;
  type: string;
  created_at: string;
  product: {
    name: string;
    country: {
      name: string;
      flag: string;
      iso2: string;
    };
  };
  market_range: string;
}

interface OfferCardProps {
  inquiry: Inquiry;
  lang: string;
  imageBaseUrl: string;
  offerType: 'BUYER' | 'SELLER';
  userType?: string | null;
  isLoggedIn?: boolean;
  dict?: any;
}

export function OfferCard({
  inquiry,
  lang,
  imageBaseUrl,
  offerType,
  userType,
  isLoggedIn,
  dict = {},
}: OfferCardProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [kycMessage, setKycMessage] = useState('');
  const [kycTitle, setKycTitle] = useState('Action Required');
  const [kycIndicationText, setKycIndicationText] = useState('Verify KYC');
  const [kycRedirectUrl, setKycRedirectUrl] = useState(`/${lang}/profile`);

  const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState(false);
  const [negotiationData, setNegotiationData] = useState<InquiryDetailsData | null>(null);

  const flagUrl = inquiry.product.country.flag?.startsWith('http')
    ? inquiry.product.country.flag
    : `${imageBaseUrl}${inquiry.product.country.flag || ''}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const isForBuyer = offerType === 'BUYER';
  const buttonText = isForBuyer ? (dict?.common?.buy || 'Buy') : (dict?.common?.sell || 'Sell');
  const buttonColorClass = isForBuyer
    ? 'bg-[var(--brand-green)] hover:bg-[var(--brand-green-hover)] text-white'
    : 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white';

  const matchedSlug = getProductSlugByName(inquiry.product.name);
  const actionParam = isForBuyer ? 'buy' : 'sell';
  const targetHref = matchedSlug
    ? `/${lang}/product/${encodeURIComponent(matchedSlug)}?action=${actionParam}`
    : isForBuyer
    ? `/${lang}/latest-offers-for-buyers`
    : `/${lang}/latest-inquiries-for-sellers`;

  // Guest user redirect link
  const guestLoginHref = `/${lang}/login?redirectUrl=${encodeURIComponent(targetHref)}`;

  const isDisabled =
    (buttonText === 'Buy' && userType === 'seller') ||
    (buttonText === 'Sell' && userType === 'buyer');

  // Handle action click for logged-in user:
  const handleActionClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await getLatestInquiryDetailsAction(inquiry.id, lang);

      if (response?.isUnauthorized) {
        router.push(guestLoginHref);
        return;
      }

      const status = response?.data?.status;

      // Scenario 1: KYC / NOT_VERIFIED
      if (status === 'NOT_VERIFIED' || /kyc/i.test(response?.message || '')) {
        setKycTitle(dict?.common?.kyc_required_title || 'KYC Verification Required');
        setKycMessage(
          response?.message ||
            "You cannot post an inquiry or offer until your KYC documents are verified, which usually takes 1-2 business days. If you've already submitted them, Please wait for approval or contact customer support"
        );
        setKycIndicationText(dict?.common?.verify_kyc || 'Submit Documents');
        setKycRedirectUrl(`/${lang}/profile`);
        setIsKYCModalOpen(true);
        return;
      }

      // Scenario 2: NEGOTIATE -> Open Negotiation Details Table Modal
      if (status === 'NEGOTIATE' && response?.data) {
        setNegotiationData(response.data);
        setIsNegotiationModalOpen(true);
        return;
      }

      // If success has details or direct negotiation
      if (response?.success && response?.data?.details) {
        setNegotiationData(response.data);
        setIsNegotiationModalOpen(true);
        return;
      }

      // Scenario 3: Error or other messages from API
      if (response?.message) {
        setKycTitle('Notice');
        setKycMessage(response.message);
        setKycIndicationText('OK');
        setKycRedirectUrl(`/${lang}/profile`);
        setIsKYCModalOpen(true);
      }
    } catch (err: any) {
      console.error('[OfferCard.handleActionClick] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="group flex flex-col w-full flex-shrink-0 min-h-[110px] sm:min-h-[120px] rounded-lg bg-card border border-border/60 overflow-hidden hover:shadow-sm transition-shadow duration-300">
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3.5 flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-[65px_1fr] sm:grid-cols-[75px_1fr] gap-x-2 gap-y-2.5 sm:gap-y-3">
            {/* Row 1: Country */}
            <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">
              {dict?.common?.country || 'Country'}:
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground font-bold text-[14px] sm:text-[15px]">
                  {inquiry.product.country.name}
                </span>
                {inquiry.product.country.flag && (
                  <div className="relative w-[16px] h-[11px] flex-shrink-0 border border-border/50 rounded-sm overflow-hidden shadow-xs">
                    <Image
                      src={flagUrl}
                      alt={inquiry.product.country.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[12px] sm:text-[13px] font-medium">
                  {dict?.common?.date || 'Date'}:
                </span>
                <span className="text-foreground font-bold text-[14px] sm:text-[15px]">
                  {formatDate(inquiry.created_at)}
                </span>
              </div>
            </div>

            {/* Row 2: Product */}
            <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">
              {dict?.common?.product || 'Product'}:
            </div>
            <h2
              className="text-foreground font-bold text-[14px] sm:text-[15px] line-clamp-2 break-words leading-tight"
              title={inquiry.product.name}
            >
              {inquiry.product.name}
            </h2>

            {/* Row 3: Price & Action */}
            <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">
              {dict?.common?.price || 'Price'}:
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-bold text-[14px] sm:text-[15px]">
                {inquiry.market_range}
              </span>
              {isDisabled ? (
                <div
                  title={
                    userType === 'seller'
                      ? dict?.common?.only_buyer_can_buy ||
                        'Only Buyer accounts can purchase products.'
                      : dict?.common?.only_seller_can_sell ||
                        'Only Seller accounts can offer products for sale.'
                  }
                  className={`${buttonColorClass} px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded text-[11px] sm:text-[12px] md:text-[13px] font-bold shadow-sm transition-colors opacity-50 cursor-not-allowed text-center whitespace-nowrap shrink-0 select-none`}
                >
                  {buttonText}
                </div>
              ) : isLoggedIn === false ? (
                /* Guest User -> Redirect to login */
                <Link
                  href={guestLoginHref}
                  className={`${buttonColorClass} px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded text-[11px] sm:text-[12px] md:text-[13px] font-bold shadow-sm transition-colors whitespace-nowrap shrink-0 select-none`}
                >
                  {buttonText}
                </Link>
              ) : (
                /* Logged In User -> Call /trading-inquiry/latest/details/${id} */
                <button
                  type="button"
                  onClick={handleActionClick}
                  disabled={isLoading}
                  className={`${buttonColorClass} px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded text-[11px] sm:text-[12px] md:text-[13px] font-bold shadow-sm transition-colors whitespace-nowrap shrink-0 select-none flex items-center gap-1.5`}
                >
                  {isLoading && <i className="fa-solid fa-spinner fa-spin text-xs"></i>}
                  {buttonText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KYC / Indication Modal - only mounted when triggered */}
      {isKYCModalOpen && (
        <ActionIndicationModal
          isOpen={isKYCModalOpen}
          onClose={() => setIsKYCModalOpen(false)}
          onConfirm={() => {
            setIsKYCModalOpen(false);
            router.push(kycRedirectUrl);
          }}
          title={kycTitle}
          description={kycMessage}
          indicationText={kycIndicationText}
          type="warning"
        />
      )}

      {/* Inquiry Negotiation Details Table Modal - only mounted when triggered */}
      {isNegotiationModalOpen && (
        <InquiryNegotiationModal
          isOpen={isNegotiationModalOpen}
          onClose={() => setIsNegotiationModalOpen(false)}
          data={negotiationData}
          offerType={offerType}
          lang={lang}
          dict={dict}
        />
      )}
    </>
  );
}
