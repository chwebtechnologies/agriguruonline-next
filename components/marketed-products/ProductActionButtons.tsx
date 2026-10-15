'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ActionButton } from '@/components/ui/ActionButton';
import { useRouter } from 'next/navigation';
import { fetchProductDetails, fetchShippingTerms, fetchPaymentTerms, checkKYCStatus, checkFavoriteProductLimit } from '@/app/actions/product';
import { getProductDetailsAction, getShippingContainersAction, getShippingTermsAction } from '@/app/actions/charts';

const ProductInquiryModal = dynamic(
  () => import('./ProductInquiryModal').then(m => m.ProductInquiryModal),
  { ssr: false }
);
const AddFavoriteProductModal = dynamic(
  () => import('./AddFavoriteProductModal').then(m => m.AddFavoriteProductModal),
  { ssr: false }
);
import { ActionIndicationModal } from '@/components/ui/charts/ActionIndicationModal';

interface ProductActionButtonsProps {
  productSlugOrId: string;
  lang: string;
  common: any;
  userType?: string | null;
  layout?: 'stacked' | 'grid' | 'inline';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  productName?: string;
  countryName?: string;
  price?: number | string;
  onActionSuccess?: () => void;
  onModalOpenChange?: (isOpen: boolean) => void;
}

export function ProductActionButtons({
  productSlugOrId,
  lang,
  common,
  userType,
  layout = 'stacked',
  className = '',
  size = 'md',
  productName = 'Product',
  countryName = 'Unknown',
  price = '0.00',
  onActionSuccess,
  onModalOpenChange
}: ProductActionButtonsProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'buy' | 'sell' | 'add'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [kycTitle, setKycTitle] = useState('Action Required');
  const [kycMessage, setKycMessage] = useState('');
  const [kycIndicationText, setKycIndicationText] = useState('Submit Documents');
  const [kycRedirectUrl, setKycRedirectUrl] = useState(`/${lang}/profile`);
  const [kycSecondaryText, setKycSecondaryText] = useState<string | undefined>();
  const [kycSecondaryUrl, setKycSecondaryUrl] = useState<string | undefined>();

  useEffect(() => {
    onModalOpenChange?.(isModalOpen || isAddModalOpen || isKYCModalOpen);
  }, [isModalOpen, isAddModalOpen, isKYCModalOpen, onModalOpenChange]);

  const handleActionSuccess = () => {
    setIsModalOpen(false);
    setIsAddModalOpen(false);
    setIsKYCModalOpen(false);
    onActionSuccess?.();
  };

  // Client-side user type detection from cookies or prop
  const [clientUserType, setClientUserType] = useState<string | null>(() => {
    if (userType) return userType.toLowerCase();
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/user_info=([^;]+)/);
    if (!match) return null;
    try {
      const user = JSON.parse(decodeURIComponent(match[1]));
      const rawType = String(user?.user_type || user?.role || user?.type || '').toLowerCase();
      if (rawType.includes('buyer')) return 'buyer';
      if (rawType.includes('seller')) return 'seller';
      return rawType || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (userType) {
      setClientUserType(userType.toLowerCase());
      return;
    }
    const match = document.cookie.match(/user_info=([^;]+)/);
    if (match) {
      try {
        const user = JSON.parse(decodeURIComponent(match[1]));
        const rawType = String(user?.user_type || user?.role || user?.type || '').toLowerCase();
        if (rawType.includes('buyer')) setClientUserType('buyer');
        else if (rawType.includes('seller')) setClientUserType('seller');
        else if (rawType) setClientUserType(rawType);
      } catch {}
    }
  }, [userType]);

  const effectiveUserType = (userType || clientUserType || '').toLowerCase();
  const isBuyer = effectiveUserType === 'buyer';
  const isSeller = effectiveUserType === 'seller';

  const addProductHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}`;
  const buyHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=buy`;
  const sellHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=sell`;

  let sizeClass = 'min-h-[44px] py-2.5 sm:py-3 px-4 text-sm md:text-base rounded-xl'; // lg/md
  if (size === 'sm') {
    sizeClass = 'min-h-[36px] py-1.5 sm:py-2 px-1.5 sm:px-2.5 text-[13px] sm:text-[15px] rounded-lg';
  } else if (size === 'md') {
    sizeClass = 'min-h-[40px] py-2 sm:py-2.5 px-2 text-[13px] sm:text-sm rounded-lg';
  }

  const handleActionClick = async (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, action: 'buy' | 'sell' | 'add', fallbackHref: string) => {
    e.preventDefault();
    
    // Check if user is logged in via cookie
    const hasAuth = Boolean(
      effectiveUserType ||
      (typeof document !== 'undefined' && (document.cookie.includes('auth_token=') || document.cookie.includes('user_info=')))
    );

    // If not logged in, redirect to login ONLY for buy/sell
    if (!hasAuth && action !== 'add') {
      onActionSuccess?.();
      router.push(`/${lang}/login`);
      return;
    }
    
    if (isLoading) return;
    
    setModalAction(action);
    setIsLoading(true);
    
    try {
      if (action === 'add') {
        if (!hasAuth) {
          setKycTitle('Watchlist Access');
          setKycMessage('Track real-time commodity prices, daily trends, and historical charts. Sign up for a free trial or log in to add products to your watchlist.');
          setKycIndicationText('Start Free Trial');
          setKycRedirectUrl(`/${lang}/pricing`);
          setKycSecondaryText('Log In');
          setKycSecondaryUrl(`/${lang}/login`);
          setIsKYCModalOpen(true);
          setIsLoading(false);
          return;
        }

        const limitResponse = await checkFavoriteProductLimit(lang);
        const canCreate = limitResponse?.data?.can_create ?? limitResponse?.can_create;
        const indication = limitResponse?.response_indication || limitResponse?.data?.response_indication;
        const isPermitted = canCreate === true || canCreate === 1;

        if (!isPermitted) {
          if (limitResponse?.isUnauthorized) {
            setKycTitle('Watchlist Access');
            setKycMessage('Track real-time commodity prices, daily trends, and historical charts. Sign up for a free trial or log in to add products to your watchlist.');
            setKycIndicationText('Start Free Trial');
            setKycRedirectUrl(`/${lang}/pricing`);
            setKycSecondaryText('Log In');
            setKycSecondaryUrl(`/${lang}/login`);
          } else {
            setKycTitle('Action Required');
            setKycMessage(limitResponse?.message || "You have reached your favorite product limit. Please upgrade your membership plan to continue.");
            if (indication === 'NOT_VERIFIED' || indication === 'KYC_REQUIRED') {
              setKycIndicationText('Submit Documents');
              setKycRedirectUrl(`/${lang}/profile`);
            } else {
              setKycIndicationText('Upgrade Plan');
              setKycRedirectUrl(`/${lang}/pricing`);
            }
            setKycSecondaryText(undefined);
            setKycSecondaryUrl(undefined);
          }
          setIsKYCModalOpen(true);
          setIsLoading(false);
          return;
        }
      } else {
        const type = action === 'buy' ? 'BUYER' : 'SELLER';
        const kycResponse = await checkKYCStatus(lang, type);
        
        const canCreate = kycResponse?.data?.can_create ?? kycResponse?.can_create;
        const indication = kycResponse?.response_indication || kycResponse?.data?.response_indication;
        const isVerifiedInProfile = Boolean(kycResponse?.is_kyc_verified);
        const canCreateByMsg = /can create/i.test(kycResponse?.message || '');

        // If explicitly permitted to create, do NOT block - open the offer/inquiry form!
        const isPermitted = canCreate === true || canCreate === 1 || canCreateByMsg;

        const isBlocked = !isPermitted && (
          canCreate === false ||
          canCreate === 0 ||
          (indication === 'NOT_VERIFIED' && !isVerifiedInProfile) ||
          indication === 'MEMBERSHIP_REQUIRED' ||
          indication === 'LIMIT_OVER' ||
          indication === 'KYC_REQUIRED' ||
          ((kycResponse?.success === false || kycResponse?.success === 0 || kycResponse?.status === false || kycResponse?.status === 0) && Boolean(indication || kycResponse?.message))
        );

        if (isBlocked) {
          // If indication is NOT_VERIFIED but user is already verified in profile, DO NOT block!
          if (indication === 'NOT_VERIFIED' && isVerifiedInProfile) {
            // User is verified in profile, proceed smoothly
          } else {
            setKycTitle('Action Required');
            setKycMessage(kycResponse.message || "You cannot proceed with this action.");
            
            if (indication === 'NOT_VERIFIED' && !isVerifiedInProfile) {
              setKycIndicationText('Submit Documents');
              setKycRedirectUrl(`/${lang}/profile`);
            } else {
              setKycIndicationText('Upgrade Plan');
              setKycRedirectUrl(`/${lang}/profile`);
            }
            setKycSecondaryText(undefined);
            setKycSecondaryUrl(undefined);
            
            setIsKYCModalOpen(true);
            setIsLoading(false);
            return;
          }
        }
      }
      
      let productResponse;
      let termsResponse;
      let paymentTermsResponse;

      if (action === 'add') {
        const [prodRes, termsRes] = await Promise.all([
          getProductDetailsAction(productSlugOrId, lang),
          getShippingTermsAction(lang)
        ]);
        productResponse = prodRes;
        termsResponse = termsRes;
      } else {
        [productResponse, termsResponse, paymentTermsResponse] = await Promise.all([
          fetchProductDetails(productSlugOrId, lang),
          fetchShippingTerms(lang),
          fetchPaymentTerms(lang)
        ]);
      }
      
      const combinedData: any = {};
      
      if (productResponse && productResponse.success) {
        combinedData.product = productResponse.data;
      }
      if (termsResponse && termsResponse.success) {
        combinedData.shippingTerms = termsResponse.data?.shipping_term || termsResponse.data || [];
      }
      if (paymentTermsResponse && paymentTermsResponse.success) {
        combinedData.paymentTerms = paymentTermsResponse.data?.payment_term || [];
      }
      
      setModalData(combinedData);
      if (action === 'add') {
        setIsAddModalOpen(true);
      } else {
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch product details", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderButtons = () => {
    if (layout === 'grid') {
      return (
        <div className={`grid grid-cols-3 gap-2.5 ${className}`}>
          <ActionButton 
            variant="buy" 
            href={isBuyer ? undefined : buyHref}
            className={`${sizeClass} shadow-sm ${isSeller ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'buy' ? 'opacity-70 pointer-events-none' : ''}`}
            disabled={isSeller || (isLoading && modalAction === 'buy')}
            title={isSeller ? (common?.only_buyer_can_buy || "Only Buyer accounts can purchase products.") : undefined}
            onClick={(e) => !isSeller ? handleActionClick(e, 'buy', buyHref) : undefined}
          >
            {isLoading && modalAction === 'buy' ? 'Loading...' : common.buy}
          </ActionButton>

          <ActionButton 
            variant="add" 
            href={undefined}
            onClick={(e) => handleActionClick(e, 'add', addProductHref)}
            className={`${sizeClass} shadow-sm ${isLoading && modalAction === 'add' ? 'opacity-70 pointer-events-none' : ''}`}
            disabled={isLoading && modalAction === 'add'}
          >
            {isLoading && modalAction === 'add' ? 'Loading...' : common.addProduct}
          </ActionButton>

          <ActionButton 
            variant="sell" 
            href={isSeller ? undefined : sellHref}
            className={`${sizeClass} shadow-sm ${isBuyer ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'sell' ? 'opacity-70 pointer-events-none' : ''}`}
            disabled={isBuyer || (isLoading && modalAction === 'sell')}
            title={isBuyer ? (common?.only_seller_can_sell || "Only Seller accounts can offer products for sale.") : undefined}
            onClick={(e) => !isBuyer ? handleActionClick(e, 'sell', sellHref) : undefined}
          >
            {isLoading && modalAction === 'sell' ? 'Loading...' : common.sell}
          </ActionButton>
        </div>
      );
    }

    if (layout === 'stacked') {
      return (
        <div className={`flex flex-col gap-2 ${className}`}>
          <ActionButton 
            variant="add" 
            href={undefined}
            onClick={(e) => handleActionClick(e, 'add', addProductHref)}
            className={`${sizeClass} shadow-sm w-full ${isLoading && modalAction === 'add' ? 'opacity-70 pointer-events-none' : ''}`}
            disabled={isLoading && modalAction === 'add'}
          >
            {isLoading && modalAction === 'add' ? 'Loading...' : common.addProduct}
          </ActionButton>

          <div className="grid grid-cols-2 gap-2">
            <ActionButton 
              variant="buy" 
              href={isBuyer ? undefined : buyHref}
              className={`${sizeClass} shadow-sm ${isSeller ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'buy' ? 'opacity-70 pointer-events-none' : ''}`}
              disabled={isSeller || (isLoading && modalAction === 'buy')}
              title={isSeller ? (common?.only_buyer_can_buy || "Only Buyer accounts can purchase products.") : undefined}
              onClick={(e) => !isSeller ? handleActionClick(e, 'buy', buyHref) : undefined}
            >
              {isLoading && modalAction === 'buy' ? 'Loading...' : common.buy}
            </ActionButton>

            <ActionButton 
              variant="sell" 
              href={isSeller ? undefined : sellHref}
              className={`${sizeClass} shadow-sm ${isBuyer ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'sell' ? 'opacity-70 pointer-events-none' : ''}`}
              disabled={isBuyer || (isLoading && modalAction === 'sell')}
              title={isBuyer ? (common?.only_seller_can_sell || "Only Seller accounts can offer products for sale.") : undefined}
              onClick={(e) => !isBuyer ? handleActionClick(e, 'sell', sellHref) : undefined}
            >
              {isLoading && modalAction === 'sell' ? 'Loading...' : common.sell}
            </ActionButton>
          </div>
        </div>
      );
    }

    // fallback / inline
    return (
      <div className={`flex gap-2 ${className}`}>
        <ActionButton variant="add" href={undefined} onClick={(e) => handleActionClick(e, 'add', addProductHref)} disabled={isLoading && modalAction === 'add'} className={`${sizeClass} shadow-sm ${isLoading && modalAction === 'add' ? 'opacity-70 pointer-events-none' : ''}`}>{isLoading && modalAction === 'add' ? 'Loading...' : common.addProduct}</ActionButton>
        <ActionButton variant="buy" href={isBuyer ? undefined : buyHref} disabled={isSeller || (isLoading && modalAction === 'buy')} className={`${sizeClass} shadow-sm ${isLoading && modalAction === 'buy' ? 'opacity-70 pointer-events-none' : ''}`} title={isSeller ? (common?.only_buyer_can_buy || "Only Buyer accounts can purchase products.") : undefined} onClick={(e) => !isSeller ? handleActionClick(e, 'buy', buyHref) : undefined}>{isLoading && modalAction === 'buy' ? 'Loading...' : common.buy}</ActionButton>
        <ActionButton variant="sell" href={isSeller ? undefined : sellHref} disabled={isBuyer || (isLoading && modalAction === 'sell')} className={`${sizeClass} shadow-sm ${isLoading && modalAction === 'sell' ? 'opacity-70 pointer-events-none' : ''}`} title={isBuyer ? (common?.only_seller_can_sell || "Only Seller accounts can offer products for sale.") : undefined} onClick={(e) => !isBuyer ? handleActionClick(e, 'sell', sellHref) : undefined}>{isLoading && modalAction === 'sell' ? 'Loading...' : common.sell}</ActionButton>
      </div>
    );
  };

  return (
    <>
      {renderButtons()}
      
      {isModalOpen && (
        <ProductInquiryModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleActionSuccess}
          productId={modalData?.product?.id || productSlugOrId}
          lang={lang}
          common={common}
          productName={modalData?.product?.name || productName}
          countryName={modalData?.product?.country?.name || countryName}
          price={price}
          actionType={modalAction === 'add' ? 'buy' : modalAction} // fallback
          shippingTerms={modalData?.shippingTerms || []}
          packingTypes={modalData?.product?.packing_types || modalData?.product?.packingTypes || []}
          containers={modalData?.product?.containers || []}
          paymentTerms={modalData?.paymentTerms || []}
        />
      )}

      {isAddModalOpen && (
        <AddFavoriteProductModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleActionSuccess}
          productId={modalData?.product?.id || productSlugOrId}
          categoryId={modalData?.product?.category?.id}
          countryId={modalData?.product?.country?.id}
          lang={lang}
          common={common}
          productName={modalData?.product?.name || productName}
          countryName={modalData?.product?.country?.name || countryName}
          shippingTerms={modalData?.shippingTerms || []}
          containers={modalData?.product?.containers || []}
        />
      )}

      {isKYCModalOpen && (
        <ActionIndicationModal
          isOpen={isKYCModalOpen}
          onClose={() => setIsKYCModalOpen(false)}
          onConfirm={() => {
            handleActionSuccess();
            router.push(kycRedirectUrl);
          }}
          title={kycTitle}
          description={kycMessage}
          indicationText={kycIndicationText}
          type="warning"
          secondaryActionText={kycSecondaryText}
          onSecondaryAction={kycSecondaryText ? () => {
            handleActionSuccess();
            router.push(kycSecondaryUrl || `/${lang}/login`);
          } : undefined}
        />
      )}
    </>
  );
}
