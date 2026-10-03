'use client';

import React, { useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProductInquiryModal } from './ProductInquiryModal';
import { useRouter } from 'next/navigation';
import { ActionIndicationModal } from '@/components/ui/charts/ActionIndicationModal';
import { fetchProductDetails, fetchShippingTerms, fetchPaymentTerms, checkKYCStatus } from '@/app/actions/product';
import { getProductDetailsAction, getShippingContainersAction } from '@/app/actions/charts';
import { AddFavoriteProductModal } from './AddFavoriteProductModal';

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
  price = '0.00'
}: ProductActionButtonsProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'buy' | 'sell' | 'add'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [kycMessage, setKycMessage] = useState('');
  const [kycIndicationText, setKycIndicationText] = useState('Submit Documents');
  const [kycRedirectUrl, setKycRedirectUrl] = useState(`/${lang}/profile`);

  const addProductHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}`;
  const buyHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=buy`;
  const sellHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=sell`;

  let sizeClass = 'py-2.5 sm:py-3 px-4 text-sm md:text-base rounded-xl'; // lg/md
  if (size === 'sm') {
    sizeClass = 'py-1 sm:py-1.5 px-1 sm:px-2 text-[13px] sm:text-[15px] rounded-lg';
  } else if (size === 'md') {
    sizeClass = 'py-2 sm:py-2.5 px-2 text-[13px] sm:text-sm rounded-lg';
  }

  const handleActionClick = async (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, action: 'buy' | 'sell' | 'add', fallbackHref: string) => {
    e.preventDefault();
    
    // Check userType from props or client cookie fallback
    const getClientUserType = (): string | null => {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(/user_info=([^;]+)/);
      if (!match) return null;
      try {
        const user = JSON.parse(decodeURIComponent(match[1]));
        const rawType = user?.role || user?.user_type || user?.type;
        return rawType ? String(rawType).toLowerCase() : null;
      } catch {
        return null;
      }
    };

    const activeUser = userType || getClientUserType();

    // If not logged in, redirect to login ONLY for buy/sell
    if (!activeUser && action !== 'add') {
      router.push(`/${lang}/login`);
      return;
    }
    
    if (isLoading) return;
    
    setModalAction(action);
    setIsLoading(true);
    
    try {
      if (action !== 'add') {
        const type = action === 'buy' ? 'BUYER' : 'SELLER';
        const kycResponse = await checkKYCStatus(lang, type);
        
        const isErrorOrNotVerified = 
          (kycResponse && kycResponse.data && kycResponse.data.can_create === false) ||
          (kycResponse && kycResponse.response_indication === 'NOT_VERIFIED') ||
          (kycResponse && kycResponse.data?.response_indication === 'NOT_VERIFIED') ||
          (kycResponse && (kycResponse.success === 0 || kycResponse.success === false) && (kycResponse.response_indication || kycResponse.data?.response_indication || kycResponse.message));

        if (isErrorOrNotVerified) {
          setKycMessage(kycResponse.message || "You cannot proceed with this action.");
          
          const indication = kycResponse.response_indication || kycResponse.data?.response_indication;
          
          if (indication === 'NOT_VERIFIED') {
            setKycIndicationText('Submit Documents');
            setKycRedirectUrl(`/${lang}/profile`);
          } else {
            setKycIndicationText('Upgrade Plan');
            setKycRedirectUrl(`/${lang}/profile`);
          }
          
          setIsKYCModalOpen(true);
          setIsLoading(false);
          return;
        }
      }
      
      let productResponse;
      let termsResponse;
      let paymentTermsResponse;

      if (!activeUser && action === 'add') {
        // Fetch unauthenticated product data for Add to Favorites
        [productResponse] = await Promise.all([
          getProductDetailsAction(productSlugOrId, lang)
        ]);
        // Note: For unauthenticated, we don't have shipping terms readily available without a token through fetchShippingTerms,
        // but getProductDetailsAction returns the product which has containers. We will rely on product containers.
      } else {
        [productResponse, termsResponse, paymentTermsResponse] = await Promise.all([
          fetchProductDetails(productSlugOrId, lang),
          fetchShippingTerms(lang),
          action !== 'add' ? fetchPaymentTerms(lang) : Promise.resolve(null)
        ]);
      }
      
      const combinedData: any = {};
      
      if (productResponse && productResponse.success) {
        combinedData.product = productResponse.data;
      }
      if (termsResponse && termsResponse.success) {
        combinedData.shippingTerms = termsResponse.data?.shipping_term || [];
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
            href={userType === 'buyer' ? undefined : buyHref}
            className={`${sizeClass} shadow-sm ${userType === 'seller' ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'buy' ? 'opacity-70 pointer-events-none' : ''}`}
            disabled={userType === 'seller' || (isLoading && modalAction === 'buy')}
            title={userType === 'seller' ? "Only Buyer accounts can purchase products." : undefined}
            onClick={(e) => userType !== 'seller' ? handleActionClick(e, 'buy', buyHref) : undefined}
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
            href={userType === 'seller' ? undefined : sellHref}
            className={`${sizeClass} shadow-sm ${userType === 'buyer' ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'sell' ? 'opacity-70 pointer-events-none' : ''}`}
            disabled={userType === 'buyer' || (isLoading && modalAction === 'sell')}
            title={userType === 'buyer' ? "Only Seller accounts can offer products for sale." : undefined}
            onClick={(e) => userType !== 'buyer' ? handleActionClick(e, 'sell', sellHref) : undefined}
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
              href={userType === 'buyer' ? undefined : buyHref}
              className={`${sizeClass} shadow-sm ${userType === 'seller' ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'buy' ? 'opacity-70 pointer-events-none' : ''}`}
              disabled={userType === 'seller' || (isLoading && modalAction === 'buy')}
              title={userType === 'seller' ? "Only Buyer accounts can purchase products." : undefined}
              onClick={(e) => userType !== 'seller' ? handleActionClick(e, 'buy', buyHref) : undefined}
            >
              {isLoading && modalAction === 'buy' ? 'Loading...' : common.buy}
            </ActionButton>

            <ActionButton 
              variant="sell" 
              href={userType === 'seller' ? undefined : sellHref}
              className={`${sizeClass} shadow-sm ${userType === 'buyer' ? 'opacity-50 cursor-not-allowed' : ''} ${isLoading && modalAction === 'sell' ? 'opacity-70 pointer-events-none' : ''}`}
              disabled={userType === 'buyer' || (isLoading && modalAction === 'sell')}
              title={userType === 'buyer' ? "Only Seller accounts can offer products for sale." : undefined}
              onClick={(e) => userType !== 'buyer' ? handleActionClick(e, 'sell', sellHref) : undefined}
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
        <ActionButton variant="buy" href={userType === 'buyer' ? undefined : buyHref} disabled={userType === 'seller' || (isLoading && modalAction === 'buy')} className={`${sizeClass} shadow-sm ${isLoading && modalAction === 'buy' ? 'opacity-70 pointer-events-none' : ''}`} title={userType === 'seller' ? "Only Buyer accounts can purchase products." : undefined} onClick={(e) => userType !== 'seller' ? handleActionClick(e, 'buy', buyHref) : undefined}>{isLoading && modalAction === 'buy' ? 'Loading...' : common.buy}</ActionButton>
        <ActionButton variant="sell" href={userType === 'seller' ? undefined : sellHref} disabled={userType === 'buyer' || (isLoading && modalAction === 'sell')} className={`${sizeClass} shadow-sm ${isLoading && modalAction === 'sell' ? 'opacity-70 pointer-events-none' : ''}`} title={userType === 'buyer' ? "Only Seller accounts can offer products for sale." : undefined} onClick={(e) => userType !== 'buyer' ? handleActionClick(e, 'sell', sellHref) : undefined}>{isLoading && modalAction === 'sell' ? 'Loading...' : common.sell}</ActionButton>
      </div>
    );
  };

  return (
    <>
      {renderButtons()}
      
      <ProductInquiryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={modalData?.product?.id || productSlugOrId}
        lang={lang}
        common={common}
        productName={modalData?.product?.name || productName}
        countryName={modalData?.product?.country?.name || countryName}
        price={price}
        actionType={modalAction === 'add' ? 'buy' : modalAction} // fallback
        shippingTerms={modalData?.shippingTerms || []}
        packingTypes={modalData?.product?.packing_types || []}
        containers={modalData?.product?.containers || []}
        paymentTerms={modalData?.paymentTerms || []}
      />

      <AddFavoriteProductModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
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

      <ActionIndicationModal
        isOpen={isKYCModalOpen}
        onClose={() => setIsKYCModalOpen(false)}
        onConfirm={() => {
          setIsKYCModalOpen(false);
          router.push(kycRedirectUrl);
        }}
        title="Action Required"
        description={kycMessage}
        indicationText={kycIndicationText}
        type="warning"
      />
    </>
  );
}
