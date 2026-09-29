'use client';

import React from 'react';
import { ProductInquiryModal } from './ProductInquiryModal';

interface ChartProductInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any; // The favorite/chart item containing fixed details
  actionType?: 'buy' | 'sell';
  lang?: string;
  common?: any;
  shippingTerms?: any[];
  packingTypes?: any[];
  containers?: any[];
  paymentTerms?: any[];
}

export function ChartProductInquiryModal({
  isOpen,
  onClose,
  item,
  actionType = 'buy',
  lang = 'en',
  common = {},
  shippingTerms = [],
  packingTypes = [],
  containers = [],
  paymentTerms = []
}: ChartProductInquiryModalProps) {
  if (!isOpen || !item) return null;

  return (
    <ProductInquiryModal
      common={common}
      isOpen={isOpen}
      onClose={onClose}
      productName={item.product || item.productName || ''}
      countryName={item.country || item.countryName || ''}
      price={item.price || 0}
      productId={item.productId || ''}
      lang={lang}
      shippingTerms={shippingTerms}
      packingTypes={packingTypes}
      containers={containers}
      paymentTerms={paymentTerms}
      actionType={actionType}
      initialValues={{
        shipBy: item.shipById,
        shippingTerm: item.termId,
        portOfLoading: item.polId,
        portOfDestination: item.podId,
        shipByName: item.shipBy,
        shippingTermName: item.term,
        portOfLoadingName: item.pol,
        portOfDestinationName: item.pod,
      }}
      readOnlyFields={{
        shipBy: true,
        shippingTerm: true,
        portOfLoading: true,
        portOfDestination: true,
      }}
    />
  );
}

export default ChartProductInquiryModal;
