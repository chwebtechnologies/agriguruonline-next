'use client';

import React, { useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProductInquiryModal } from './ProductInquiryModal';
import { useRouter } from 'next/navigation';
import { fetchProductDetails, fetchShippingTerms, fetchPaymentTerms } from '@/app/actions/product';

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
  const [modalAction, setModalAction] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  const addProductHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}`;
  const buyHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=buy`;
  const sellHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=sell`;

  let sizeClass = 'py-2.5 sm:py-3 px-4 text-sm md:text-base rounded-xl'; // lg/md
  if (size === 'sm') {
    sizeClass = 'py-1 sm:py-1.5 px-1 sm:px-2 text-[13px] sm:text-[15px] rounded-lg';
  } else if (size === 'md') {
    sizeClass = 'py-2 sm:py-2.5 px-2 text-[13px] sm:text-sm rounded-lg';
  }

  const handleActionClick = async (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, action: 'buy' | 'sell', fallbackHref: string) => {
    e.preventDefault();
    
    // If not logged in, redirect to login
    if (!userType) {
      router.push(`/${lang}/login`);
      return;
    }
    
    if (isLoading) return;
    
    setModalAction(action);
    setIsLoading(true);
    
    try {
      const [productResponse, termsResponse, paymentTermsResponse] = await Promise.all([
        fetchProductDetails(productSlugOrId, lang),
        fetchShippingTerms(lang),
        fetchPaymentTerms(lang)
      ]);
      
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
    } catch (error) {
      console.error("Failed to fetch product details", error);
    } finally {
      setIsLoading(false);
      setIsModalOpen(true);
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
            href={addProductHref}
            className={`${sizeClass} shadow-sm`}
          >
            {common.addProduct}
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
            href={addProductHref}
            className={`${sizeClass} shadow-sm w-full`}
          >
            {common.addProduct}
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
        <ActionButton variant="add" href={addProductHref} className={`${sizeClass} shadow-sm`}>{common.addProduct}</ActionButton>
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
        productName={modalData?.product?.name || productName}
        countryName={modalData?.product?.country?.name || countryName}
        price={price}
        actionType={modalAction}
        shippingTerms={modalData?.shippingTerms || []}
        packingTypes={modalData?.product?.packing_types || []}
        containers={modalData?.product?.containers || []}
        paymentTerms={modalData?.paymentTerms || []}
      />
    </>
  );
}
