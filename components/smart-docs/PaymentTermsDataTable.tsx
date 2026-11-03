'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getPaymentTermListingAction,
  deletePaymentTermAction,
  savePaymentTermAction,
  updatePaymentTermAction,
  getPaymentTermByIdAction,
  togglePaymentTermStatusAction,
} from '@/app/actions/smart-docs';
import { DeleteConfirmModal } from '@/components/ui/charts/DeleteConfirmModal';
import { PaymentTermFormModal } from '@/components/smart-docs/PaymentTermFormModal';
import {
  extractPaymentTermTitle,
  extractPaymentTermStatus,
  extractPaymentTermId,
} from '@/lib/api/smart-docs.service';

export interface PaymentTermsDataTableProps {
  data?: any[];
  totalRecords?: number;
  initialPage?: number;
  initialPageSize?: number;
  initialSearch?: string;
  lang?: string;
  dict?: any;
  title?: string;
  description?: string;
}

export default function PaymentTermsDataTable({
  data = [],
  totalRecords = 0,
  initialPage = 1,
  initialPageSize = 10,
  initialSearch = '',
  lang = 'en',
  dict,
  title,
  description,
}: PaymentTermsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tableData, setTableData] = useState<any[]>(data);
  const [totalCount, setTotalCount] = useState<number>(totalRecords);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sorting state: 'title' or 'status'
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Delete modal state
  const [rowToDelete, setRowToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Add / Edit modal state
  const [manageModalMode, setManageModalMode] = useState<'add' | 'edit'>('add');
  const [editingPaymentTerm, setEditingPaymentTerm] = useState<any | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isManageModalLoading, setIsManageModalLoading] = useState<boolean>(false);
  const [loadingTermId, setLoadingTermId] = useState<string | null>(null);
  const [isSavingTerm, setIsSavingTerm] = useState<boolean>(false);
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

  // Inline toggle loading set for optimistic updates
  const [togglingTermIds, setTogglingTermIds] = useState<Set<string>>(new Set());

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
    if (search && search.trim().length >= 2) {
      params.set('search', search.trim());
    } else {
      params.delete('search');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Fetch payment terms from server action
  const fetchPaymentTerms = async (page: number, limit: number, search: string) => {
    setIsLoading(true);
    try {
      const res = await getPaymentTermListingAction({
        page,
        limit,
        lang,
        source: 'web',
        search: search.trim().length >= 2 ? search.trim() : undefined,
      });

      if (res && res.success) {
        setTableData(res.data || []);
        setTotalCount(res.total ?? (res.data || []).length);
      } else {
        toast.error(res?.error || 'Failed to fetch payment terms');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error fetching payment terms');
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
        fetchPaymentTerms(1, pageSize, '');
      }
      return;
    }

    if (trimmed.length < 2) return;

    searchDebounceTimerRef.current = setTimeout(() => {
      lastSearchedQueryRef.current = trimmed;
      setCurrentPage(1);
      syncUrlParams(1, pageSize, trimmed);
      fetchPaymentTerms(1, pageSize, trimmed);
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    lastSearchedQueryRef.current = '';
    setCurrentPage(1);
    syncUrlParams(1, pageSize, '');
    fetchPaymentTerms(1, pageSize, '');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || newPage < 1) return;
    setCurrentPage(newPage);
    syncUrlParams(newPage, pageSize, searchQuery);
    fetchPaymentTerms(newPage, pageSize, searchQuery);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    syncUrlParams(1, newSize, searchQuery);
    fetchPaymentTerms(1, newSize, searchQuery);
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
      let valA: any = '';
      let valB: any = '';

      if (sortKey === 'title') {
        valA = extractPaymentTermTitle(a).toLowerCase();
        valB = extractPaymentTermTitle(b).toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      } else if (sortKey === 'status') {
        valA = extractPaymentTermStatus(a) ? 1 : 0;
        valB = extractPaymentTermStatus(b) ? 1 : 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [tableData, sortKey, sortDirection]);

  // Inline toggle status handler with instant optimistic UI update
  const handleToggleStatus = async (row: any) => {
    const termId = extractPaymentTermId(row);
    if (!termId) {
      toast.error('Unable to identify payment term ID');
      return;
    }

    if (togglingTermIds.has(termId)) return;

    const currentStatus = extractPaymentTermStatus(row);
    const newStatus = !currentStatus;

    // Optimistic UI update
    setTogglingTermIds((prev) => new Set(prev).add(termId));
    setTableData((prev) =>
      prev.map((item) => {
        if (extractPaymentTermId(item) === termId) {
          return {
            ...item,
            status: newStatus,
            is_active: newStatus,
          };
        }
        return item;
      })
    );

    try {
      const res = await togglePaymentTermStatusAction(termId, newStatus, lang);
      if (res && res.success) {
        toast.success(
          res.message ||
            `Payment term marked as ${newStatus ? 'Active' : 'Inactive'}`
        );
      } else {
        // Revert on error
        setTableData((prev) =>
          prev.map((item) => {
            if (extractPaymentTermId(item) === termId) {
              return {
                ...item,
                status: currentStatus,
                is_active: currentStatus,
              };
            }
            return item;
          })
        );
        toast.error(res?.message || 'Failed to update status');
      }
    } catch (err: any) {
      // Revert on exception
      setTableData((prev) =>
        prev.map((item) => {
          if (extractPaymentTermId(item) === termId) {
            return {
              ...item,
              status: currentStatus,
              is_active: currentStatus,
            };
          }
          return item;
        })
      );
      toast.error(err?.message || 'Error updating status');
    } finally {
      setTogglingTermIds((prev) => {
        const next = new Set(prev);
        next.delete(termId);
        return next;
      });
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;
    const id = extractPaymentTermId(rowToDelete);
    if (!id) {
      toast.error('Unable to identify payment term to delete');
      setIsDeleteModalOpen(false);
      setRowToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deletePaymentTermAction(id, lang);
      if (res && res.success) {
        toast.success(res.message || 'Payment term deleted successfully');
        setTableData((prev) => prev.filter((p) => extractPaymentTermId(p) !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setIsDeleteModalOpen(false);
        setRowToDelete(null);
      } else {
        toast.error(res?.message || 'Failed to delete payment term');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting payment term');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add new payment term click
  const handleAddNewClick = () => {
    setManageModalMode('add');
    setEditingPaymentTerm(null);
    setModalErrors({});
    setIsManageModalOpen(true);
  };

  // Edit payment term click
  const handleEditClick = async (row: any) => {
    const id = extractPaymentTermId(row);
    if (!id) {
      toast.error('Unable to identify payment term ID');
      return;
    }

    setManageModalMode('edit');
    setLoadingTermId(id);
    setIsManageModalLoading(true);
    setModalErrors({});

    // Immediate placeholder data while network call is in flight
    setEditingPaymentTerm({
      id,
      title: extractPaymentTermTitle(row),
      name: extractPaymentTermTitle(row),
      status: extractPaymentTermStatus(row),
      is_active: extractPaymentTermStatus(row),
    });
    setIsManageModalOpen(true);

    try {
      const res = await getPaymentTermByIdAction(id, {
        lang,
        source: 'web',
      });

      if (res && res.success && res.data) {
        setEditingPaymentTerm(res.data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error fetching payment term details');
    } finally {
      setIsManageModalLoading(false);
      setLoadingTermId(null);
    }
  };

  // Save payment term from modal
  const handleSavePaymentTerm = async (savedData: any) => {
    setIsSavingTerm(true);
    try {
      if (manageModalMode === 'edit') {
        const termId = savedData.id || extractPaymentTermId(editingPaymentTerm);
        if (!termId) {
          toast.error('Unable to identify payment term ID to update');
          setIsSavingTerm(false);
          return;
        }

        const payload = {
          title: savedData.title,
          name: savedData.title,
          status: savedData.status,
          is_active: Boolean(savedData.status),
        };

        const res = await updatePaymentTermAction(termId, payload, {
          lang,
          source: 'web',
        });

        if (res && res.success) {
          toast.success(res.message || 'Payment term updated successfully');
          setIsManageModalOpen(false);
          setEditingPaymentTerm(null);
          setModalErrors({});
          fetchPaymentTerms(currentPage, pageSize, searchQuery);
          return res;
        } else {
          const errMap: Record<string, string> = {};
          const fields = res?.error_fields || res?.data?.error_fields || res?.data?.errors || [];
          if (Array.isArray(fields) && fields.length > 0) {
            fields.forEach((ef: any) => {
              if (typeof ef === 'string') {
                errMap.general = ef;
              } else if (ef && typeof ef === 'object') {
                const fKey = String(ef.field || ef.name || ef.param || ef.path || '').toLowerCase();
                const msg = String(ef.message || ef.msg || ef.error || 'Invalid value');
                if (fKey.includes('title') || fKey.includes('name')) errMap.title = msg;
                else errMap[fKey || 'general'] = msg;
              }
            });
          }
          setModalErrors(errMap);
          const hasFieldErrors = Object.keys(errMap).some((k) => k !== 'general');
          if (!hasFieldErrors) {
            toast.error(errMap.general || res?.message || 'Failed to update payment term');
          }
          return res;
        }
      } else {
        // Add new mode
        const payload = {
          title: savedData.title,
          name: savedData.title,
          status: savedData.status,
          is_active: Boolean(savedData.status),
        };

        const res = await savePaymentTermAction(payload);
        if (res && res.success) {
          toast.success(res.message || 'Payment term added successfully');
          setIsManageModalOpen(false);
          setEditingPaymentTerm(null);
          setModalErrors({});
          fetchPaymentTerms(currentPage, pageSize, searchQuery);
          return res;
        } else {
          toast.error(res?.message || 'Failed to add payment term');
          return res;
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving payment term');
    } finally {
      setIsSavingTerm(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-auto max-h-full relative z-10">
      {/* Table Controls Bar */}
      <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 border-b border-border bg-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-2.5 shrink-0 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-64 md:w-72 shrink-0">
            <i className="fa-solid fa-magnifying-glass absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={dict?.smart_docs?.search_payment_terms || 'Search payment terms...'}
              className="w-full h-8.5 sm:h-9 pl-8.5 pr-8 rtl:pr-8.5 rtl:pl-8 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Right Controls: + Add New Payment Term Button */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          {searchQuery && (
            <span className="text-[11px] text-muted-foreground hidden lg:inline-block">
              {searchQuery.trim().length < 2 ? (
                <span>Type at least 2 characters...</span>
              ) : (
                <>
                  Found <strong className="text-foreground">{totalCount}</strong> matching records
                </>
              )}
            </span>
          )}

          {/* + Add New Payment Term Button */}
          <button
            type="button"
            onClick={handleAddNewClick}
            className="h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            <span>{dict?.smart_docs?.add_payment_term || 'Add New Payment Term'}</span>
          </button>
        </div>
      </div>

      {/* Table Viewport - 2 Columns (Title & Status) + Actions Column */}
      <div className="w-full overflow-x-auto overflow-y-auto min-h-0 relative z-10 overscroll-contain flex-1">
        <table className="w-max min-w-full text-left rtl:text-right border-separate border-spacing-0 bg-card">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted text-foreground text-[13px] sm:text-[14px] font-bold uppercase tracking-wider select-none">
              {/* Column 1: Title (Sortable, flex/expanded width) */}
              <th
                onClick={() => handleSort('title')}
                style={{ minWidth: '280px' }}
                className="px-4 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>{dict?.smart_docs?.payment_term_title || 'Title'}</span>
                  <span className="text-xs">
                    {sortKey === 'title' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue"></i>
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue"></i>
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40"></i>
                    )}
                  </span>
                </div>
              </th>

              {/* Column 2: Status (Sortable, Toggle Column) */}
              <th
                onClick={() => handleSort('status')}
                style={{ minWidth: '120px', width: '120px' }}
                className="px-4 py-2 sm:py-2.5 border-b border-border text-center whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center justify-center gap-1.5 w-full">
                  <span>{dict?.smart_docs?.status || 'Status'}</span>
                  <span className="text-xs">
                    {sortKey === 'status' ? (
                      sortDirection === 'asc' ? (
                        <i className="fa-solid fa-arrow-up-wide-short text-brand-blue"></i>
                      ) : (
                        <i className="fa-solid fa-arrow-down-short-wide text-brand-blue"></i>
                      )
                    ) : (
                      <i className="fa-solid fa-sort opacity-40"></i>
                    )}
                  </span>
                </div>
              </th>

              {/* Actions - Sticky Right Column */}
              <th
                style={{ minWidth: '80px', width: '80px' }}
                className="px-2 py-2 sm:py-2.5 border-b border-border text-center whitespace-nowrap sticky right-0 rtl:right-auto rtl:left-0 z-20 border-l rtl:border-l-0 rtl:border-r border-border bg-muted shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              // Shimmer Skeleton Rows matching ProductsDataTable
              Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => {
                const isEven = idx % 2 === 0;
                const rowBgClass = isEven ? 'bg-table-row-even' : 'bg-table-row-odd';
                return (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className={`px-4 py-2 sm:py-2.5 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-56" />
                    </td>
                    <td className={`px-4 py-2 sm:py-2.5 border-b border-border ${rowBgClass}`}>
                      <div className="h-5.5 bg-muted/60 rounded-full w-10 mx-auto" />
                    </td>
                    <td
                      style={{ minWidth: '80px', width: '80px' }}
                      className={`px-2 py-2 sm:py-2.5 border-b border-border ${rowBgClass} sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]`}
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
                const rowId = extractPaymentTermId(row);
                const isRowLoading = loadingTermId === rowId && Boolean(rowId);
                const isToggling = togglingTermIds.has(rowId);
                const pTitle = extractPaymentTermTitle(row);
                const pStatus = extractPaymentTermStatus(row);

                return (
                  <tr
                    key={rowId || index}
                    className={`group ${rowBgClass} hover:bg-table-row-hover transition-colors`}
                  >
                    {/* Column 1: Title (Text) */}
                    <td
                      style={{ minWidth: '280px' }}
                      className={`px-4 py-2 sm:py-2.5 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="font-semibold text-foreground text-[14px] whitespace-nowrap block"
                        title={pTitle}
                      >
                        {pTitle}
                      </span>
                    </td>

                    {/* Column 2: Status Toggle (On / Off Switch) */}
                    <td
                      style={{ minWidth: '120px', width: '120px' }}
                      className={`px-4 py-2 sm:py-2.5 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-center`}
                    >
                      <div className="inline-flex items-center justify-center">
                        {/* Toggle Switch - Theme Blue */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pStatus}
                          disabled={isToggling}
                          onClick={() => handleToggleStatus(row)}
                          title={`Click to mark as ${pStatus ? 'Inactive' : 'Active'}`}
                          className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50 ${
                            pStatus ? 'bg-brand-blue' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span className="sr-only">Toggle Status</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              pStatus ? 'translate-x-4.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </td>

                    {/* Actions - Edit (Yellow) & Delete (Red) */}
                    <td
                      style={{ minWidth: '80px', width: '80px' }}
                      className={`px-2 py-2 sm:py-2.5 align-middle border-b border-border text-center sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] ${rowBgClass} group-hover:bg-table-row-hover transition-colors`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button - Yellow */}
                        <button
                          type="button"
                          disabled={isRowLoading}
                          onClick={() => handleEditClick(row)}
                          className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white shadow-2xs transition-all flex items-center justify-center text-xs shrink-0 cursor-pointer active:scale-95"
                          title={dict?.smart_docs?.edit || 'Edit'}
                          aria-label="Edit"
                        >
                          {isRowLoading ? (
                            <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                          ) : (
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                          )}
                        </button>

                        {/* Delete Button - Theme Red */}
                        <button
                          type="button"
                          onClick={() => {
                            setRowToDelete(row);
                            setIsDeleteModalOpen(true);
                          }}
                          className="w-7 h-7 rounded-lg bg-brand-red hover:bg-brand-red-hover text-white shadow-2xs transition-all flex items-center justify-center text-xs shrink-0 cursor-pointer active:scale-95"
                          title={dict?.smart_docs?.delete || 'Delete'}
                          aria-label="Delete"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              // Empty State
              <tr>
                <td colSpan={3} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground text-xl">
                      <i className="fa-solid fa-file-invoice-dollar"></i>
                    </div>
                    <h4 className="font-bold text-foreground text-base">
                      {dict?.smart_docs?.no_payment_terms_found || 'No Payment Terms Found'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery
                        ? 'No payment terms match your search query.'
                        : 'There are currently no payment terms available.'}
                    </p>
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors cursor-pointer"
                      >
                        Clear Search
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAddNewClick}
                        className="mt-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-plus text-xs" />
                        <span>Add First Payment Term</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-3 sm:px-3.5 py-1.5 sm:py-2 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-muted-foreground select-none shrink-0">
        {/* Left: Records per page selector + info */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <label htmlFor="records-per-page-terms" className="text-xs font-medium whitespace-nowrap">
              {dict?.smart_docs?.records_per_page || 'Records per page:'}
            </label>
            <select
              id="records-per-page-terms"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="bg-background border border-border text-foreground font-medium rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-blue transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {[10, 25, 50, 100].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {totalCount > 0 && (
            <>
              <span className="text-border hidden sm:inline">|</span>
              <span>
                Showing{' '}
                <strong className="text-foreground">
                  {(currentPage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-foreground">
                  {Math.min(currentPage * pageSize, totalCount)}
                </strong>{' '}
                of{' '}
                <strong className="text-foreground">{totalCount}</strong>{' '}
                records
              </span>
            </>
          )}
        </div>

        {/* Right: Pagination Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Prev Button */}
          <button
            disabled={currentPage <= 1 || totalCount === 0 || isLoading}
            onClick={() => handlePageChange(currentPage - 1)}
            className="h-7.5 sm:h-8 px-2 sm:px-2.5 rounded-md bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Prev"
            aria-label="Prev"
          >
            <i className="fa-solid fa-chevron-left text-[10px]"></i>
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1">
            {totalPages > 0 && totalCount > 0 ? (
              Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 5) return true;
                  if (page === 1 || page === totalPages) return true;
                  return Math.abs(page - currentPage) <= 1;
                })
                .reduce<(number | string)[]>((acc, page, idx, arr) => {
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`dots-${idx}`} className="px-1.5 text-muted-foreground font-bold">
                        ...
                      </span>
                    );
                  }
                  const pageNum = Number(p);
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isLoading}
                      className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-md text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                        isActive
                          ? 'bg-brand-blue text-white shadow-2xs pointer-events-none'
                          : 'bg-background border border-border text-foreground hover:bg-muted shadow-2xs'
                      }`}
                      aria-label={`Page ${pageNum}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })
            ) : null}
          </div>

          {/* Next Button */}
          <button
            disabled={currentPage >= totalPages || totalCount === 0 || isLoading}
            onClick={() => handlePageChange(currentPage + 1)}
            className="h-7.5 sm:h-8 px-2 sm:px-2.5 rounded-md bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Next"
            aria-label="Next"
          >
            <span className="hidden sm:inline">Next</span>
            <i className="fa-solid fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setRowToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        title={dict?.smart_docs?.delete_payment_term || 'Delete Payment Term'}
        description={
          rowToDelete ? (
            <span>
              Are you sure you want to delete{' '}
              <strong className="text-foreground font-semibold">
                &ldquo;{extractPaymentTermTitle(rowToDelete)}&rdquo;
              </strong>
              ?
            </span>
          ) : (
            'Are you sure you want to delete this payment term?'
          )
        }
        confirmText={dict?.smart_docs?.yes_delete || dict?.common?.delete || 'Delete Payment Term'}
        cancelText={dict?.smart_docs?.cancel || dict?.common?.cancel || 'Cancel'}
      />

      {/* Add / Edit Payment Term Modal */}
      <PaymentTermFormModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false);
          setEditingPaymentTerm(null);
          setIsManageModalLoading(false);
          setLoadingTermId(null);
          setModalErrors({});
        }}
        mode={manageModalMode}
        paymentTerm={editingPaymentTerm}
        onSave={handleSavePaymentTerm}
        dict={dict}
        isLoading={isManageModalLoading}
        isSubmitting={isSavingTerm}
        externalErrors={modalErrors}
      />
    </div>
  );
}

