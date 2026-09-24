import React from 'react';
import { ActionButton } from '@/components/ui/ActionButton';

interface ProductActionButtonsProps {
  productSlugOrId: string;
  lang: string;
  common: any;
  userType?: string | null;
  layout?: 'stacked' | 'grid' | 'inline';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProductActionButtons({
  productSlugOrId,
  lang,
  common,
  userType,
  layout = 'stacked',
  className = '',
  size = 'md'
}: ProductActionButtonsProps) {
  const addProductHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}`;
  const buyHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=buy`;
  const sellHref = `/${lang}/product/${encodeURIComponent(productSlugOrId)}?action=sell`;

  let sizeClass = 'py-2.5 sm:py-3 px-4 text-sm md:text-base rounded-xl'; // lg/md
  if (size === 'sm') {
    sizeClass = 'py-1 sm:py-1.5 px-1 sm:px-2 text-[13px] sm:text-[15px] rounded-lg';
  } else if (size === 'md') {
    sizeClass = 'py-2 sm:py-2.5 px-2 text-[13px] sm:text-sm rounded-lg';
  }

  if (layout === 'grid') {
    return (
      <div className={`grid grid-cols-3 gap-2.5 ${className}`}>
        <ActionButton 
          variant="buy" 
          href={buyHref}
          className={`${sizeClass} shadow-sm ${userType === 'seller' ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={userType === 'seller'}
          title={userType === 'seller' ? "Only Buyer accounts can purchase products." : ""}
        >
          {common.buy}
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
          href={sellHref}
          className={`${sizeClass} shadow-sm ${userType === 'buyer' ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={userType === 'buyer'}
          title={userType === 'buyer' ? "Only Seller accounts can offer products for sale." : ""}
        >
          {common.sell}
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
            href={buyHref}
            className={`${sizeClass} shadow-sm ${userType === 'seller' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={userType === 'seller'}
            title={userType === 'seller' ? "Only Buyer accounts can purchase products." : ""}
          >
            {common.buy}
          </ActionButton>

          <ActionButton 
            variant="sell" 
            href={sellHref}
            className={`${sizeClass} shadow-sm ${userType === 'buyer' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={userType === 'buyer'}
            title={userType === 'buyer' ? "Only Seller accounts can offer products for sale." : ""}
          >
            {common.sell}
          </ActionButton>
        </div>
      </div>
    );
  }

  // fallback / inline
  return (
    <div className={`flex gap-2 ${className}`}>
      <ActionButton variant="add" href={addProductHref} className={`${sizeClass} shadow-sm`}>{common.addProduct}</ActionButton>
      <ActionButton variant="buy" href={buyHref} disabled={userType === 'seller'} className={`${sizeClass} shadow-sm`} title={userType === 'seller' ? "Only Buyer accounts can purchase products." : ""}>{common.buy}</ActionButton>
      <ActionButton variant="sell" href={sellHref} disabled={userType === 'buyer'} className={`${sizeClass} shadow-sm`} title={userType === 'buyer' ? "Only Seller accounts can offer products for sale." : ""}>{common.sell}</ActionButton>
    </div>
  );
}
