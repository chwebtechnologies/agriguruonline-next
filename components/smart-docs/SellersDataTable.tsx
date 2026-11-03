'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getSellerListingAction,
  deleteSellerAction,
  saveSellerAction,
  updateSellerAction,
  getSellerByIdAction,
  getSellerBankDetailsAction,
  updateSellerBankDetailsAction,
  deleteSellerBankDetailAction,
} from '@/app/actions/smart-docs';
import {
  extractSellerCompanyName,
  extractSellerAddress,
  extractSellerCity,
  extractSellerState,
  extractSellerCountry,
  extractSellerId,
  formatAssetUrl,
} from '@/lib/api/smart-docs.service';
import { DeleteConfirmModal } from '@/components/ui/charts/DeleteConfirmModal';
import SellerManageModal from '@/components/smart-docs/SellerManageModal';

export interface SellersDataTableProps {
  data?: any[];
  totalRecords?: number;
  initialPage?: number;
  initialPageSize?: number;
  initialSearch?: string;
  lang?: string;
  dict?: any;
  title?: string;
  description?: string;
  countries?: any[];
}

export default function SellersDataTable({
  data = [],
  totalRecords = 0,
  initialPage = 1,
  initialPageSize = 10,
  initialSearch = '',
  lang = 'en',
  dict,
  title,
  description,
  countries = [],
}: SellersDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tableData, setTableData] = useState<any[]>(data);
  const [totalCount, setTotalCount] = useState<number>(totalRecords);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sorting state across all columns
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [rowToDelete, setRowToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [manageModalMode, setManageModalMode] = useState<'add' | 'edit'>('add');
  const [editingSeller, setEditingSeller] = useState<any | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isManageModalLoading, setIsManageModalLoading] = useState<boolean>(false);
  const [loadingSellerId, setLoadingSellerId] = useState<string | null>(null);

  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchedQueryRef = useRef<string>(initialSearch);

  // Sync props data if initial data changes
  useEffect(() => {
    setTableData(data);
    setTotalCount(totalRecords);
  }, [data, totalRecords]);

  // Sync URL search parameters
  const syncUrlParams = (page: number, limit: number, search: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search && search.trim().length >= 3) {
      params.set('search', search.trim());
    } else {
      params.delete('search');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Fetch sellers from server action
  const fetchSellers = async (page: number, limit: number, search: string) => {
    setIsLoading(true);
    try {
      const res = await getSellerListingAction({
        page,
        limit,
        lang,
        source: 'web',
        search: search.trim().length >= 3 ? search.trim() : undefined,
      });

      if (res && res.success) {
        setTableData(res.data || []);
        setTotalCount(res.total ?? (res.data || []).length);
      } else {
        toast.error(res?.error || 'Failed to fetch sellers');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error fetching sellers');
    } finally {
      setIsLoading(false);
    }
  };

  // Search input handler with debounce
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    const trimmed = val.trim();
    if (trimmed.length === 0) {
      if (lastSearchedQueryRef.current !== '') {
        lastSearchedQueryRef.current = '';
        syncUrlParams(1, pageSize, '');
        fetchSellers(1, pageSize, '');
      }
      return;
    }

    if (trimmed.length < 3) return;

    searchDebounceTimerRef.current = setTimeout(() => {
      lastSearchedQueryRef.current = trimmed;
      setCurrentPage(1);
      syncUrlParams(1, pageSize, trimmed);
      fetchSellers(1, pageSize, trimmed);
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    lastSearchedQueryRef.current = '';
    setCurrentPage(1);
    syncUrlParams(1, pageSize, '');
    fetchSellers(1, pageSize, '');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || newPage < 1) return;
    setCurrentPage(newPage);
    syncUrlParams(newPage, pageSize, searchQuery);
    fetchSellers(newPage, pageSize, searchQuery);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    syncUrlParams(1, newSize, searchQuery);
    fetchSellers(1, newSize, searchQuery);
  };

  // Column header sorting handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Client-side sorted rows
  const sortedData = useMemo(() => {
    if (!sortKey) return tableData;

    return [...tableData].sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortKey === 'company_name') {
        valA = extractSellerCompanyName(a).toLowerCase();
        valB = extractSellerCompanyName(b).toLowerCase();
      } else if (sortKey === 'address') {
        valA = extractSellerAddress(a).toLowerCase();
        valB = extractSellerAddress(b).toLowerCase();
      } else if (sortKey === 'city') {
        valA = extractSellerCity(a).toLowerCase();
        valB = extractSellerCity(b).toLowerCase();
      } else if (sortKey === 'state') {
        valA = extractSellerState(a).toLowerCase();
        valB = extractSellerState(b).toLowerCase();
      } else if (sortKey === 'country') {
        valA = extractSellerCountry(a).toLowerCase();
        valB = extractSellerCountry(b).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tableData, sortKey, sortDirection]);

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;
    const id = extractSellerId(rowToDelete);
    if (!id) {
      toast.error('Unable to identify seller to delete');
      setIsDeleteModalOpen(false);
      setRowToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteSellerAction(id, lang);
      if (res && res.success) {
        toast.success(res.message || 'Seller deleted successfully');
        setTableData((prev) => prev.filter((p) => extractSellerId(p) !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setIsDeleteModalOpen(false);
        setRowToDelete(null);
      } else {
        toast.error(res?.message || 'Failed to delete seller');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting seller');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add new seller click
  const handleAddNewSellerClick = () => {
    setManageModalMode('add');
    setEditingSeller(null);
    setIsManageModalOpen(true);
  };

  // Edit seller click: fetches authoritative record by ID
  const handleEditClick = async (row: any) => {
    const id = extractSellerId(row);
    if (!id) {
      toast.error('Unable to identify seller ID');
      return;
    }

    setManageModalMode('edit');
    setLoadingSellerId(id);
    setIsManageModalLoading(true);

    // Initial placeholder seller data
    setEditingSeller({
      id,
      company_name: extractSellerCompanyName(row),
      address: extractSellerAddress(row),
      city: extractSellerCity(row),
      state: extractSellerState(row),
      country: extractSellerCountry(row),
      country_id: row.country?.id || row.country_id || '',
      country_code: row.country_code || '',
      zip_code: row.zip_code || row.zipcode || '',
      zipcode: row.zip_code || row.zipcode || '',
      email: row.email || row.email_address || '',
      contact_number: row.contact_number || row.phone || '',
      certificate_name_number:
        row.certificate_name_number ||
        row.certificate_name_and_number ||
        row.certificate_no ||
        '',
      certificate_name_and_number:
        row.certificate_name_number ||
        row.certificate_name_and_number ||
        row.certificate_no ||
        '',
      authority_name: row.authority_name || row.authority || '',
      authorised_signature:
        row.authorised_signature || row.authority_signature || row.signature || '',
      authority_signature:
        row.authorised_signature || row.authority_signature || row.signature || '',
      company_logo: row.company_logo || row.logo || '',
      bank_name: row.bank_name || '',
      bank_details: row.bank_details || '',
    });
    setIsManageModalOpen(true);

    try {
      const res = await getSellerByIdAction(id, {
        lang,
        source: 'web',
      });

      if (res && res.success && res.data) {
        setEditingSeller(res.data);
      }
    } catch (err: any) {
      console.warn('Error fetching detailed seller info:', err);
    } finally {
      setIsManageModalLoading(false);
      setLoadingSellerId(null);
    }
  };

  // Save Business Details Action Bridge
  const handleSaveBusiness = useCallback(
    async (businessData: any) => {
      try {
        if (manageModalMode === 'edit') {
          const id =
            (typeof businessData?.get === 'function' ? businessData.get('id') : businessData?.id) ||
            extractSellerId(editingSeller);
          const res = await updateSellerAction(id, businessData, { lang, source: 'web' });
          if (res && res.success) {
            fetchSellers(currentPage, pageSize, searchQuery);
          }
          return res;
        } else {
          const res = await saveSellerAction(businessData);
          if (res && res.success) {
            fetchSellers(currentPage, pageSize, searchQuery);
          }
          return res;
        }
      } catch (err: any) {
        return { success: false, message: err?.message || 'Error saving business details' };
      }
    },
    [manageModalMode, editingSeller, lang, currentPage, pageSize, searchQuery]
  );

  // Save Bank Details Action Bridge
  const handleSaveBank = useCallback(
    async (bankData: any, sellerId: string) => {
      try {
        const res = await updateSellerBankDetailsAction(sellerId, bankData, { lang, source: 'web' });
        if (res && res.success) {
          fetchSellers(currentPage, pageSize, searchQuery);
        }
        return res;
      } catch (err: any) {
        return { success: false, message: err?.message || 'Error saving bank details' };
      }
    },
    [lang, currentPage, pageSize, searchQuery]
  );

  // Fetch Bank Details Action Bridge
  const handleFetchBankDetails = useCallback(
    async (sellerId: string) => {
      return await getSellerBankDetailsAction(sellerId, { lang, source: 'web' });
    },
    [lang]
  );

  // Delete Bank Detail Action Bridge
  const handleDeleteBankDetail = useCallback(
    async (bankDetailId: string) => {
      try {
        const res = await deleteSellerBankDetailAction(bankDetailId, { lang, source: 'web' });
        if (res && res.success) {
          fetchSellers(currentPage, pageSize, searchQuery);
        }
        return res;
      } catch (err: any) {
        return { success: false, message: err?.message || 'Error deleting bank detail' };
      }
    },
    [lang, currentPage, pageSize, searchQuery]
  );

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-auto max-h-full relative z-10">
      {/* Table Controls Bar */}
      <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 border-b border-border bg-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-2.5 shrink-0 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-64 md:w-72 shrink-0">
            <i className="fa-solid fa-magnifying-glass absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={dict?.smart_docs?.search_sellers || 'Search sellers / exporters...'}
              className="w-full h-8.5 sm:h-9 pl-8.5 pr-8 rtl:pr-8.5 rtl:pl-8 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>

        {/* Right Controls: Add Seller Button */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          {searchQuery && (
            <span className="text-[11px] text-muted-foreground hidden lg:inline-block">
              {searchQuery.trim().length < 3 ? (
                <span>Type at least 3 characters...</span>
              ) : (
                <>
                  Found <strong className="text-foreground">{totalCount}</strong> matching records
                </>
              )}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddNewSellerClick}
            className="h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-plus text-xs" />
            <span>{dict?.smart_docs?.add_seller || 'Add New Seller'}</span>
          </button>
        </div>
      </div>

      {/* Table Viewport */}
      <div className="w-full overflow-x-auto overflow-y-auto min-h-0 relative z-10 overscroll-contain flex-1">
        <table className="w-max min-w-full text-left rtl:text-right border-separate border-spacing-0 bg-card">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted text-foreground text-[13px] sm:text-[14px] font-bold uppercase tracking-wider select-none">
              {/* 1. Company Name */}
              <th
                onClick={() => handleSort('company_name')}
                style={{ minWidth: '220px', width: '220px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>{dict?.smart_docs?.company_name || 'Company Name'}</span>
                  <span className="text-xs">
                    {sortKey === 'company_name' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue" />
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue" />
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40" />
                    )}
                  </span>
                </div>
              </th>

              {/* 2. Address */}
              <th
                onClick={() => handleSort('address')}
                style={{ minWidth: '220px', width: '260px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>{dict?.smart_docs?.address || 'Address'}</span>
                  <span className="text-xs">
                    {sortKey === 'address' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue" />
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue" />
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40" />
                    )}
                  </span>
                </div>
              </th>

              {/* 3. City */}
              <th
                onClick={() => handleSort('city')}
                style={{ minWidth: '120px', width: '130px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>{dict?.smart_docs?.city || 'City'}</span>
                  <span className="text-xs">
                    {sortKey === 'city' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue" />
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue" />
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40" />
                    )}
                  </span>
                </div>
              </th>

              {/* 4. State */}
              <th
                onClick={() => handleSort('state')}
                style={{ minWidth: '120px', width: '130px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>{dict?.smart_docs?.state || 'State'}</span>
                  <span className="text-xs">
                    {sortKey === 'state' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue" />
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue" />
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40" />
                    )}
                  </span>
                </div>
              </th>

              {/* 5. Country */}
              <th
                onClick={() => handleSort('country')}
                style={{ minWidth: '130px', width: '130px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-center whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center justify-center gap-1.5 w-full">
                  <span>{dict?.smart_docs?.country || 'Country'}</span>
                  <span className="text-xs">
                    {sortKey === 'country' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue" />
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue" />
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40" />
                    )}
                  </span>
                </div>
              </th>

              {/* 6. Actions - Sticky Right Column */}
              <th
                style={{ minWidth: '76px', width: '76px' }}
                className="px-2 py-2 sm:py-2.5 border-b border-border text-center whitespace-nowrap sticky right-0 rtl:right-auto rtl:left-0 z-20 border-l rtl:border-l-0 rtl:border-r border-border bg-muted shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              // Shimmer Skeleton Rows
              Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => {
                const isEven = idx % 2 === 0;
                const rowBgClass = isEven ? 'bg-table-row-even' : 'bg-table-row-odd';
                return (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-36" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-44" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-20" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-20" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-24 mx-auto" />
                    </td>
                    <td
                      style={{ minWidth: '76px', width: '76px' }}
                      className={`px-2 py-1.5 sm:py-2 border-b border-border ${rowBgClass} sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]`}
                    >
                      <div className="h-4.5 bg-muted/60 rounded-md w-12 mx-auto" />
                    </td>
                  </tr>
                );
              })
            ) : sortedData.length > 0 ? (
              sortedData.map((row, index) => {
                const isEven = index % 2 === 0;
                const rowBgClass = isEven ? 'bg-table-row-even' : 'bg-table-row-odd';
                const rowId = extractSellerId(row);
                const isRowLoading = loadingSellerId === rowId && Boolean(rowId);
                const cName = extractSellerCompanyName(row);
                const cAddress = extractSellerAddress(row);
                const cCity = extractSellerCity(row);
                const cState = extractSellerState(row);
                const cCountry = extractSellerCountry(row);

                return (
                  <tr
                    key={rowId || index}
                    className={`group ${rowBgClass} hover:bg-table-row-hover transition-colors`}
                  >
                    {/* 1. Company Name - CLEAN plain text, NO letter box / NO avatar */}
                    <td
                      style={{ minWidth: '220px', width: '220px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="font-semibold text-foreground text-[14px] whitespace-nowrap block"
                        title={cName}
                      >
                        {cName}
                      </span>
                    </td>

                    {/* 2. Address */}
                    <td
                      style={{ minWidth: '220px', width: '260px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="text-[14px] text-foreground/90 whitespace-nowrap block truncate max-w-[280px]"
                        title={cAddress}
                      >
                        {cAddress}
                      </span>
                    </td>

                    {/* 3. City */}
                    <td
                      style={{ minWidth: '120px', width: '130px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="text-[14px] text-foreground/90 whitespace-nowrap block"
                        title={cCity}
                      >
                        {cCity}
                      </span>
                    </td>

                    {/* 4. State */}
                    <td
                      style={{ minWidth: '120px', width: '130px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="text-[14px] text-foreground/90 whitespace-nowrap block"
                        title={cState}
                      >
                        {cState}
                      </span>
                    </td>

                    {/* 5. Country - CLEAN plain text, NO globe icon */}
                    <td
                      style={{ minWidth: '130px', width: '130px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-center`}
                    >
                      <span
                        className="text-[14px] text-foreground/90 whitespace-nowrap block text-center"
                        title={cCountry}
                      >
                        {cCountry}
                      </span>
                    </td>

                    {/* 6. Actions - Yellow Edit & Red Delete EXACT matching ProductsDataTable */}
                    <td
                      style={{ minWidth: '76px', width: '76px' }}
                      className={`px-2 py-1.5 sm:py-2 align-middle border-b border-border text-center sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] ${rowBgClass} group-hover:bg-table-row-hover transition-colors`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button - Yellow (Amber 500) */}
                        <button
                          type="button"
                          disabled={isRowLoading}
                          onClick={() => handleEditClick(row)}
                          className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white shadow-2xs transition-all flex items-center justify-center text-xs shrink-0 cursor-pointer active:scale-95"
                          title={dict?.smart_docs?.edit || 'Edit'}
                          aria-label="Edit"
                        >
                          {isRowLoading ? (
                            <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                          ) : (
                            <i className="fa-solid fa-pen-to-square text-xs" />
                          )}
                        </button>

                        {/* Delete Button - Theme Red (Brand Red) */}
                        <button
                          type="button"
                          onClick={() => {
                            setRowToDelete(row);
                            setIsDeleteModalOpen(true);
                          }}
                          className="w-7 h-7 rounded-lg bg-brand-red hover:bg-brand-red-hover text-white shadow-2xs transition-all flex items-center justify-center text-xs shrink-0 cursor-pointer active:scale-95"
                          title={dict?.smart_docs?.delete_seller || 'Delete'}
                          aria-label="Delete"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              // Empty State
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-xl mb-3 text-muted-foreground/80">
                      <i className="fa-solid fa-user-tie" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {searchQuery
                        ? 'No matching sellers found'
                        : dict?.smart_docs?.no_sellers_found || 'No Sellers Found'}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {searchQuery
                        ? `No results matched "${searchQuery}". Try modifying your search keywords.`
                        : 'Get started by creating your first seller or exporter profile.'}
                    </p>
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                      >
                        Clear Search
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAddNewSellerClick}
                        className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-brand-blue hover:bg-brand-blue/90 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <i className="fa-solid fa-plus text-xs" />
                        <span>{dict?.smart_docs?.add_seller || 'Add New Seller'}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Bar */}
      <div className="px-3 sm:px-3.5 py-2 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 relative z-20">
        {/* Left: Entries Counter & Limit Selector */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
          <span>
            Showing{' '}
            <strong className="text-foreground">
              {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-foreground">
              {Math.min(currentPage * pageSize, totalCount)}
            </strong>{' '}
            of <strong className="text-foreground">{totalCount}</strong> entries
          </span>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-border">
            <span className="hidden min-[400px]:inline text-[11px]">Show</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-7 px-1.5 text-xs bg-background border border-border rounded text-foreground outline-none focus:border-brand-blue cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Right: Page Navigation Buttons */}
        <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
          {/* Previous Page Button */}
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="h-7 px-2.5 rounded border border-border bg-background text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
          >
            <i className="fa-solid fa-chevron-left text-[10px]" />
            <span className="hidden min-[380px]:inline">Prev</span>
          </button>

          {/* Page Indicators */}
          <span className="px-2 text-xs text-foreground font-medium">
            Page {currentPage} of {totalPages}
          </span>

          {/* Next Page Button */}
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="h-7 px-2.5 rounded border border-border bg-background text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className="hidden min-[380px]:inline">Next</span>
            <i className="fa-solid fa-chevron-right text-[10px]" />
          </button>
        </div>
      </div>

      {/* Add / Edit Seller Modal */}
      <SellerManageModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false);
          setEditingSeller(null);
        }}
        mode={manageModalMode}
        seller={editingSeller}
        countries={countries}
        onSaveBusiness={handleSaveBusiness}
        onSaveBank={handleSaveBank}
        onFetchBankDetails={handleFetchBankDetails}
        onDeleteBankDetail={handleDeleteBankDetail}
        dict={dict}
        isLoading={isManageModalLoading}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRowToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={dict?.smart_docs?.delete_seller || 'Delete Seller / Exporter'}
        description={
          <span>
            Are you sure you want to delete{' '}
            <strong className="text-foreground">
              {rowToDelete ? extractSellerCompanyName(rowToDelete) : 'this seller'}
            </strong>
            ?
          </span>
        }
        isDeleting={isDeleting}
        confirmText="Delete Seller"
      />
    </div>
  );
}