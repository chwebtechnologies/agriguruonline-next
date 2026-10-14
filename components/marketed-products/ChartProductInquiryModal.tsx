'use client';

import React from 'react';
import { ProductInquiryModal } from './ProductInquiryModal';

interface ChartProductInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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
  onSuccess,
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

  const resolvedProductId = item.productId || item.product?.id || item.product_id || (typeof item.id === 'string' && !item.id.includes('-') ? item.id : '');
  const resolvedPackingTypes = (packingTypes && packingTypes.length > 0)
    ? packingTypes
    : (item.packingTypes || item.product?.packing_types || []);
  const resolvedContainers = (containers && containers.length > 0)
    ? containers
    : (item.containers || item.product?.containers || []);

  return (
    <ProductInquiryModal
      common={common}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      productName={item.product || item.productName || ''}
      countryName={item.country || item.countryName || ''}
      price={item.price || 0}
      productId={resolvedProductId}
      lang={lang}
      shippingTerms={shippingTerms}
      packingTypes={resolvedPackingTypes}
      containers={resolvedContainers}
      paymentTerms={paymentTerms}
      actionType={actionType}
      initialValues={{
        shipBy: item.shipById || item.shipping_container?.id || item.shippingContainer?.id || item.shipBy,
        shippingTerm: item.termId || item.shipping_term?.id || item.shippingTerm?.id || item.term,
        portOfLoading: item.polId || item.loading_port?.id || item.loadingPort?.id || item.pol,
        portOfDestination: item.podId || item.destination_port?.id || item.destinationPort?.id || item.pod,
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
