'use client';

import React, { useState, useMemo } from 'react';
import InquiryListCard from './InquiryListCard';
import InquiryDetailsPanel from './InquiryDetailsPanel';

interface MyInquiriesClientProps {
  lang: string;
  productInquiries: any[];
  freightInquiries: any[];
  dict: any;
  token?: string;
  userProfile?: any;
}

export default function MyInquiriesClient({
  lang,
  productInquiries = [],
  freightInquiries = [],
  dict,
  token,
  userProfile,
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
  const [isMobileDetailView, setIsMobileDetailView] = useState(false);

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
    setIsMobileDetailView(false);
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

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Main Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 xl:gap-6 items-stretch">
        
        {/* Left Column: Search, Tabs & List */}
        <div className={`lg:col-span-5 xl:col-span-4 flex flex-col gap-3.5 bg-card/60 p-3.5 sm:p-4 rounded-2xl border border-border h-full overflow-hidden ${isMobileDetailView ? 'hidden lg:flex' : ''}`}>
          
          {/* Search Bar matching mockup */}
          <div className="relative shrink-0">
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
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/40 hover:text-foreground shrink-0"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            )}
          </div>

          {/* Segmented Two Tabs OR Action Bar */}
          {checkedItems.length > 0 ? (
            <div className="flex items-center justify-between bg-brand-blue/10 p-2 sm:p-2.5 rounded-xl border border-brand-blue/20 shrink-0">
              <div 
                className="flex items-center gap-2.5 cursor-pointer select-none pl-1"
                onClick={handleCheckAll}
              >
                <div className={`w-[18px] h-[18px] rounded-sm border flex items-center justify-center transition-colors ${
                  checkedItems.length === filteredList.length ? 'bg-brand-blue border-brand-blue' : 'border-brand-blue opacity-50 bg-background/50'
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
            <div className="grid grid-cols-2 gap-2 bg-background/50 p-1 rounded-xl border border-border/80 shrink-0">
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
          <div className="mt-1 flex-1 relative min-h-[400px]">
            <div className="absolute inset-0 overflow-y-auto pr-1 custom-scrollbar">
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
                    onClick={() => {
                      setSelectedItemId(itemId);
                      setIsMobileDetailView(true);
                    }}
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
        </div>

        {/* Right Column: Complete Details & Negotiation Panel */}
        <div className={`lg:col-span-7 xl:col-span-8 ${isMobileDetailView ? 'fixed inset-0 z-[100] bg-background overflow-y-auto p-3 sm:p-4 block lg:static lg:z-auto lg:bg-transparent lg:p-0 lg:overflow-visible lg:h-full' : 'hidden lg:block h-full'}`}>
          <InquiryDetailsPanel
            selectedItem={selectedItem}
            selectedItemId={selectedItemId || (selectedItem?.id || selectedItem?._id || null)}
            activeTab={activeTab}
            lang={lang}
            token={token}
            userProfile={userProfile}
            dict={dict}
            onBack={() => setIsMobileDetailView(false)}
          />
        </div>
      </div>
    </div>
  );
}
