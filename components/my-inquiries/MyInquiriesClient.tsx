'use client';

import React, { useState, useMemo } from 'react';
import InquiryListCard from './InquiryListCard';

interface MyInquiriesClientProps {
  lang: string;
  productInquiries: any[];
  freightInquiries: any[];
  dict: any;
}

export default function MyInquiriesClient({
  lang,
  productInquiries = [],
  freightInquiries = [],
  dict,
}: MyInquiriesClientProps) {
  const [activeTab, setActiveTab] = useState<'product' | 'freight'>('product');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const activeList = activeTab === 'product' ? productInquiries : freightInquiries;

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase().trim();
    return activeList.filter((item) => {
      const title = (
        item?.product?.name ||
        item?.product_name ||
        item?.commodity?.name ||
        item?.commodity_name ||
        item?.crop_name ||
        item?.variety ||
        item?.title ||
        item?.name ||
        item?.inquiry_title ||
        ''
      ).toLowerCase();
      const status = (item?.status || item?.status_text || '').toLowerCase();
      const type = (item?.type || '').toLowerCase();
      const ports = `${item?.loading_port || item?.pol || ''} ${item?.discharge_port || item?.pod || ''}`.toLowerCase();
      return title.includes(q) || status.includes(q) || type.includes(q) || ports.includes(q);
    });
  }, [activeList, searchQuery]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Derive current selected item or fallback to first item
  const selectedItem = useMemo(() => {
    if (selectedItemId) {
      const found = activeList.find((i) => (i?.id || i?._id) === selectedItemId);
      if (found) return found;
    }
    return filteredList[0] || null;
  }, [activeList, filteredList, selectedItemId]);

  const handleTabChange = (tab: 'product' | 'freight') => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedItemId(null);
    setCheckedItems([]);
  };

  const handleCheckItem = (itemId: string) => {
    setCheckedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleCheckAll = () => {
    if (filteredList.length === 0) return;
    if (checkedItems.length === filteredList.length) {
      setCheckedItems([]);
    } else {
      setCheckedItems(filteredList.map((item, index) => item?.id || item?._id || `inquiry-${index}`));
    }
  };

  const handleDeleteSelected = () => {
    if (confirm(`Are you sure you want to delete ${checkedItems.length} selected items?`)) {
      console.log('Deleting items:', checkedItems);
      setCheckedItems([]);
      // In a real application, make API call here and refresh list
    }
  };

  // Safe dictionary labels
  const tabLabels = {
    product: dict?.product_inquiries || 'Product Inquiry',
    freight: dict?.freight_inquiries || 'Freight Inquiry',
  };

  // Helper to extract fields from selected item
  const selectedTitle =
    selectedItem?.product?.name ||
    selectedItem?.product_name ||
    selectedItem?.commodity?.name ||
    selectedItem?.commodity_name ||
    selectedItem?.title ||
    selectedItem?.name ||
    (activeTab === 'freight' ? 'Freight Route Inquiry' : 'Product Inquiry');

  const selectedStatus =
    selectedItem?.status ||
    selectedItem?.status_text ||
    selectedItem?.inquiry_status ||
    'Negotiation';

  const selectedDate = (() => {
    const val = selectedItem?.created_at || selectedItem?.createdAt || selectedItem?.date || selectedItem?.created_on;
    if (!val) return 'N/A';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strTime = hours + ':' + minutes + ' ' + ampm;
      return `${day}-${month}-${year} ${strTime}`;
    } catch {
      return 'N/A';
    }
  })();

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Main Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 xl:gap-6 items-stretch">
        
        {/* Left Column: Search, Tabs & List */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3.5 bg-card/60 p-3.5 sm:p-4 rounded-2xl border border-border h-full">
          
          {/* Search Bar matching mockup */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <i className="fa-solid fa-magnifying-glass text-foreground/40 text-sm"></i>
            </div>
            <input
              type="text"
              placeholder="Search Here"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border text-foreground rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors placeholder:text-foreground/40"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/40 hover:text-foreground"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            )}
          </div>

          {/* Segmented Two Tabs OR Action Bar */}
          {checkedItems.length > 0 ? (
            <div className="flex items-center justify-between bg-brand-blue/10 p-2 sm:p-2.5 rounded-xl border border-brand-blue/20">
              <div 
                className="flex items-center gap-2.5 cursor-pointer select-none pl-1"
                onClick={handleCheckAll}
              >
                <div className={`w-[18px] h-[18px] rounded-sm border flex items-center justify-center transition-colors ${
                  checkedItems.length === filteredList.length ? 'bg-brand-blue border-brand-blue' : 'border-brand-blue/50 bg-background/50'
                }`}>
                  {checkedItems.length === filteredList.length && <i className="fa-solid fa-check text-[11px] text-white"></i>}
                </div>
                <span className="text-sm font-semibold text-brand-blue">
                  Select All ({checkedItems.length})
                </span>
              </div>
              <button 
                onClick={handleDeleteSelected}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                title="Delete Selected"
              >
                <i className="fa-regular fa-trash-can text-lg"></i>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 bg-background/50 p-1 rounded-xl border border-border/80">
              <button
                onClick={() => handleTabChange('product')}
                className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'product'
                    ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                    : 'text-foreground/60 hover:text-foreground hover:bg-card/40'
                }`}
              >
                <span>{tabLabels.product}</span>
                {productInquiries.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'product' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-foreground/10 text-foreground/60'}`}>
                    {productInquiries.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleTabChange('freight')}
                className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'freight'
                    ? 'bg-card text-foreground shadow-sm border border-border font-semibold'
                    : 'text-foreground/60 hover:text-foreground hover:bg-card/40'
                }`}
              >
                <span>{tabLabels.freight}</span>
                {freightInquiries.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'freight' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-foreground/10 text-foreground/60'}`}>
                    {freightInquiries.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* List Items Container */}
          <div className="mt-1 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredList.length > 0 ? (
              filteredList.map((item, index) => {
                const itemId = item?.id || item?._id || `inquiry-${index}`;
                const isActive = (selectedItem?.id || selectedItem?._id) === itemId || (!selectedItem && index === 0);
                return (
                  <InquiryListCard
                    key={`${itemId}-${index}`}
                    item={item}
                    type={activeTab}
                    isActive={isActive}
                    isChecked={checkedItems.includes(itemId)}
                    onClick={() => setSelectedItemId(itemId)}
                    onCheck={(e) => {
                      e.stopPropagation();
                      handleCheckItem(itemId);
                    }}
                  />
                );
              })
            ) : (
              <div className="p-8 text-center bg-background/50 rounded-xl border border-dashed border-border flex flex-col items-center justify-center min-h-[220px]">
                <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-folder-open text-xl text-foreground/30"></i>
                </div>
                <h4 className="text-sm font-medium text-foreground">
                  {searchQuery ? 'No matching inquiries' : `No ${activeTab} inquiries`}
                </h4>
                <p className="text-xs text-foreground/50 mt-1 max-max-xs">
                  {searchQuery
                    ? `No inquiries match "${searchQuery}". Try a different search term.`
                    : `You haven't submitted any ${activeTab} inquiries or offers yet.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Clean Details Overview */}
        <div className="lg:col-span-7 xl:col-span-8 h-full">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-7 min-h-[380px] shadow-sm flex flex-col h-full">
            {selectedItem ? (
              <div className="flex flex-col h-full">
                {/* Header matching Canva layout top */}
                <div className="border-b border-border pb-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-blue">
                      {activeTab === 'product' ? 'Product Inquiry' : 'Freight Inquiry'}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                      {selectedTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue font-semibold uppercase tracking-wider">
                      {selectedStatus}
                    </span>
                  </div>
                </div>

                {/* Key Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                  {activeTab === 'product' ? (
                    <>
                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Type / Role</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1 capitalize">
                          {selectedItem?.type || selectedItem?.inquiry_type || 'Buyer Inquiry'}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Quantity</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.quantity ? `${selectedItem.quantity} ${selectedItem.quantity_unit || selectedItem.unit || 'MT'}` : 'Not Specified'}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Price / Target</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.target_price || selectedItem?.price ? `$${selectedItem.target_price || selectedItem.price}` : (selectedItem?.market_range || 'Market Price')}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Country / Origin</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.product?.country?.name || selectedItem?.country?.name || selectedItem?.country || 'International'}
                        </p>
                      </div>

                      {(selectedItem?.packaging || selectedItem?.packing || selectedItem?.packaging_type) && (
                        <div className="bg-background/60 border border-border rounded-xl p-3.5">
                          <span className="text-[11px] text-foreground/50 uppercase font-medium">Packaging</span>
                          <p className="text-sm sm:text-base font-semibold text-foreground mt-1 capitalize">
                            {selectedItem.packaging || selectedItem.packing || selectedItem.packaging_type}
                          </p>
                        </div>
                      )}

                      {(selectedItem?.shipment_term || selectedItem?.incoterm || selectedItem?.delivery_term) && (
                        <div className="bg-background/60 border border-border rounded-xl p-3.5">
                          <span className="text-[11px] text-foreground/50 uppercase font-medium">Shipment Terms</span>
                          <p className="text-sm sm:text-base font-semibold text-foreground mt-1 uppercase">
                            {selectedItem.shipment_term || selectedItem.incoterm || selectedItem.delivery_term}
                          </p>
                        </div>
                      )}

                      {(selectedItem?.payment_term || selectedItem?.payment_type) && (
                        <div className="bg-background/60 border border-border rounded-xl p-3.5">
                          <span className="text-[11px] text-foreground/50 uppercase font-medium">Payment Terms</span>
                          <p className="text-sm sm:text-base font-semibold text-foreground mt-1 capitalize">
                            {selectedItem.payment_term || selectedItem.payment_type}
                          </p>
                        </div>
                      )}

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Date Created</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedDate}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Reference ID</span>
                        <p className="text-xs sm:text-sm font-mono text-foreground/80 mt-1 truncate" title={selectedItem?.id || selectedItem?._id}>
                          {selectedItem?.id || selectedItem?._id || 'N/A'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Loading Port (POL)</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.loading_port || selectedItem?.pol || selectedItem?.loadingPort?.name || 'N/A'}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Discharge Port (POD)</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.discharge_port || selectedItem?.pod || selectedItem?.dischargePort?.name || 'N/A'}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Container Type</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.container_type || selectedItem?.shipping_container?.name || 'Standard Container'}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Target Freight</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedItem?.target_freight || selectedItem?.price ? `$${selectedItem.target_freight || selectedItem.price}` : 'Quote on Request'}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Date Created</span>
                        <p className="text-sm sm:text-base font-semibold text-foreground mt-1">
                          {selectedDate}
                        </p>
                      </div>

                      <div className="bg-background/60 border border-border rounded-xl p-3.5">
                        <span className="text-[11px] text-foreground/50 uppercase font-medium">Reference ID</span>
                        <p className="text-xs sm:text-sm font-mono text-foreground/80 mt-1 truncate">
                          {selectedItem?.id || selectedItem?._id || 'N/A'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Status / Negotiation notice placeholder */}
                <div className="mt-auto bg-background/50 border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0 text-xl">
                    <i className="fa-solid fa-comments-dollar"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground">Negotiation & Process Timeline</h4>
                    <p className="text-xs text-foreground/60 mt-0.5">
                      Full negotiation stages (Details, Negotiation, Confirmation, Contract) will be activated once the details API is connected.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full flex-grow text-center py-16">
                <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
                  <i className="fa-solid fa-hand-pointer text-2xl text-foreground/30"></i>
                </div>
                <h3 className="text-lg font-semibold text-foreground">Select an inquiry</h3>
                <p className="text-xs text-foreground/60 mt-1 max-w-sm">
                  Choose an item from the left panel to preview its details and negotiation status.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
