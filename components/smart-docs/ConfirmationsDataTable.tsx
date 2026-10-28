'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSmartDocsListAction, deleteSmartDocAction } from '@/app/actions/smart-docs';
import {
  normalizeActionParam,
  sanitizeDocId,
  extractAllSmartDocIds,
  getCurrencySymbol,
} from '@/lib/api/smart-docs.service';
import { DeleteConfirmModal } from '@/components/ui/charts/DeleteConfirmModal';

export { sanitizeDocId, extractAllSmartDocIds };

/**
 * Extracts a unique document identifier from a Smart Docs record.
 * Sanitizes against [object Object] and extracts primary string ID safely.
 */
export function extractSmartDocId(row: any): string {
  if (!row) return '';
  const allIds = extractAllSmartDocIds(row);
  return allIds[0] || '';
}

export const SMART_DOCS_ACTION_OPTIONS = [
  { label: 'ALL', value: 'All' },
  { label: 'CONFIRMATION', value: 'Confirmation' },
  { label: 'CONTRACT', value: 'Contract' },
  { label: 'DOCUMENT', value: 'Document' },
] as const;

export const SMART_DOCS_SEARCH_COLUMN_OPTIONS = [
  { label: 'Contract Number', value: 'contract_number' },
  { label: 'Seller', value: 'seller' },
  { label: 'Buyer', value: 'buyer' },
  { label: 'Product', value: 'product' },
  { label: 'Loading Port', value: 'loading_port' },
  { label: 'Destination Port', value: 'destination_port' },
  { label: 'Packing Type', value: 'packing_type' },
  { label: 'Country', value: 'country' },
] as const;

export interface DataTableColumn<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  sticky?: 'left' | 'right';
  minWidth?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface ConfirmationsDataTableProps {
  data?: any[];
  totalRecords?: number;
  initialPage?: number;
  initialPageSize?: number;
  lang?: string;
  dict?: any;
  action?: string;
  initialSearch?: string;
  initialSearchLabel?: string;
  searchLabel?: string;
  columns?: DataTableColumn[];
  title?: string;
  description?: string;
  isLoading?: boolean;
  onAddConfirmation?: () => void;
  onCreateDoc?: (row: any) => void;
  onDeleteRow?: (row: any) => void;
  addHref?: string;
  addButtonLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  searchPlaceholder?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  onRowClick?: (row: any) => void;
  onRefresh?: () => void;
  showTopCard?: boolean;
}

// Helper to format dates cleanly
function formatDate(dateValue: any): string {
  if (!dateValue) return '—';
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateValue);
  }
}

// Helper to format currency/numbers cleanly
function formatAmount(amount: any, currency = '$'): string {
  if (amount === undefined || amount === null || amount === '') return '—';
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  const cur = getCurrencySymbol(currency);
  return `${cur}${num.toLocaleString(cur === '₹' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}`;
}

// Helper to reliably extract values for table sorting
function getSortValue(row: any, key: string): any {
  if (!row) return '';
  switch (key) {
    case 'contract_no':
      return (
        row.contract_no ||
        row.contract_number ||
        row.confirmation_no ||
        row.confirmation_id ||
        row.contract_id ||
        row.doc_no ||
        row.document_no ||
        row.doc_number ||
        row.document_number ||
        row.smart_doc_no ||
        row.smart_docs_no ||
        row.inquiry_no ||
        row.order_no ||
        row.ref_no ||
        row.reference_no ||
        row.id ||
        ''
      );
    case 'status':
    case 'type':
      return (
        row.document_type ||
        row.doc_type ||
        row.type ||
        row.trade_type ||
        row.side ||
        row.action ||
        row.status ||
        row.doc_status ||
        row.confirmation_status ||
        row.document_status ||
        row.approval_status ||
        row.role ||
        ''
      );
    case 'contract_date':
      return (
        row.contract_date ||
        row.confirmation_date ||
        row.date ||
        row.doc_date ||
        row.document_date ||
        row.created_at ||
        row.createdAt ||
        ''
      );
    case 'buyer_name': {
      const b =
        row.buyer_name ||
        row.buyerName ||
        row.buyer_company_name ||
        row.buyer?.name ||
        row.buyer?.company_name ||
        row.buyer;
      return typeof b === 'object' ? (b?.name || b?.company_name || '') : String(b || '');
    }
    case 'seller_name': {
      const s =
        row.seller_name ||
        row.sellerName ||
        row.seller_company_name ||
        row.seller?.name ||
        row.seller?.company_name ||
        row.seller;
      return typeof s === 'object' ? (s?.name || s?.company_name || '') : String(s || '');
    }
    case 'product': {
      const p =
        row.product ||
        row.product_name ||
        row.productName ||
        row.commodity ||
        row.commodity_name ||
        row.commodityName ||
        row.item_name ||
        row.crop_name ||
        row.title;
      return typeof p === 'object' ? (p?.name || p?.title || '') : String(p || '');
    }
    case 'incoterm':
      return (
        row.incoterm ||
        row.incoterms ||
        row.incoterm_name ||
        row.shipping_term ||
        row.shipment_term ||
        row.delivery_term ||
        ''
      );
    case 'qty_fcl':
      return Number(
        row.fcl_quantity ??
        row.fclQuantity ??
        row.qty_fcl ??
        row.quantity_fcl ??
        row.fcl ??
        row.container_fcl ??
        row.container_count ??
        0
      );
    case 'qty_mt':
      return Number(
        row.mt_quantity ??
        row.mtQuantity ??
        row.qty_mt ??
        row.quantity_mt ??
        row.qty ??
        row.quantity ??
        row.metric_tons ??
        0
      );
    case 'total_value':
      return Number(row.total_value ?? row.totalValue ?? row.total_amount ?? row.totalAmount ?? row.grand_total ?? row.contract_value ?? 0);
    case 'product_country':
      return (
        row.product_country ||
        row.productCountry ||
        row.product_country_name ||
        row.origin_country ||
        row.origin_country_name ||
        row.country_of_origin ||
        row.country_of_origin_name ||
        row.originCountry ||
        row.country ||
        row.country_name ||
        ''
      );
    case 'packing_type':
      return (
        row.packing_type ||
        row.packingType ||
        row.packing_type_name ||
        row.packaging_type ||
        row.packagingType ||
        row.packaging_type_name ||
        row.packaging ||
        row.package_type ||
        ''
      );
    case 'loading_port':
      return (
        row.loading_port_name ||
        row.loadingPortName ||
        row.loading_port ||
        row.loadingPort ||
        row.port_of_loading_name ||
        row.portOfLoadingName ||
        row.port_of_loading ||
        row.portOfLoading ||
        row.pol_name ||
        row.pol ||
        row.origin_port ||
        ''
      );
    case 'loading_country':
      return (
        row.loading_port_country_name ||
        row.loadingPortCountryName ||
        row.loading_country_name ||
        row.loadingCountryName ||
        row.loading_country ||
        row.loadingCountry ||
        row.port_of_loading_country ||
        row.pol_country ||
        row.origin_country ||
        ''
      );
    case 'destination_port':
      return (
        row.destination_port_name ||
        row.destinationPortName ||
        row.discharge_port_name ||
        row.dischargePortName ||
        row.port_of_discharge_name ||
        row.destination_port ||
        row.destinationPort ||
        row.discharge_port ||
        row.port_of_discharge ||
        row.pod_name ||
        row.pod ||
        ''
      );
    case 'destination_country':
      return (
        row.destination_port_country_name ||
        row.destinationPortCountryName ||
        row.destination_country_name ||
        row.destinationCountryName ||
        row.discharge_port_country_name ||
        row.dischargePortCountryName ||
        row.discharge_country_name ||
        row.destination_country ||
        row.destinationCountry ||
        row.discharge_country ||
        row.pod_country ||
        row.delivery_country ||
        ''
      );
    case 'shipment_period':
      return (
        row.shipment_period ||
        row.shipmentPeriod ||
        row.shipping_period ||
        row.delivery_period ||
        row.shipping_start_date ||
        ''
      );
    case 'payment_term':
      return (
        row.payment_term ||
        row.paymentTerm ||
        row.payment_term_name ||
        row.payment_terms ||
        row.payment_method ||
        row.terms_of_payment ||
        ''
      );
    case 'ship_by':
      return (
        row.ship_by ||
        row.shipBy ||
        row.ship_by_name ||
        row.shipping_container ||
        row.container_type ||
        row.mode_of_shipment ||
        row.shipping_mode ||
        ''
      );
    default:
      return row[key] ?? '';
  }
}

export type SmartDocType = 'Confirmation' | 'Contract' | 'Document';

// Helper to determine the document/status type of a row
export function getSmartDocType(row: any, activeAction?: string): SmartDocType {
  const val = String(
    row?.document_type ||
    row?.doc_type ||
    row?.type ||
    row?.status ||
    row?.doc_status ||
    row?.document_status ||
    row?.confirmation_status ||
    row?.approval_status ||
    row?.action ||
    ''
  ).toLowerCase().trim();

  if (val.includes('contract')) return 'Contract';
  if (val.includes('doc')) return 'Document';
  if (val.includes('confirm') || val.includes('quotation') || val.includes('quote')) return 'Confirmation';

  if (activeAction) {
    const act = activeAction.toLowerCase().trim();
    if (act === 'contract') return 'Contract';
    if (act === 'document') return 'Document';
    if (act === 'confirmation') return 'Confirmation';
  }

  return 'Confirmation';
}

// Color and styling map for document types based on AgriGuru theme
export function getDocTypeColorConfig(type: SmartDocType) {
  switch (type) {
    case 'Confirmation':
      return {
        bg: 'bg-brand-blue',
        hoverBg: 'hover:bg-brand-blue-hover',
        text: 'text-white',
        textColor: 'text-brand-blue dark:text-sky-400',
        border: 'border-brand-blue',
        label: 'Confirmation',
      };
    case 'Contract':
      return {
        bg: 'bg-brand-red',
        hoverBg: 'hover:bg-brand-red-hover',
        text: 'text-white',
        textColor: 'text-brand-red dark:text-rose-400',
        border: 'border-brand-red',
        label: 'Contract',
      };
    case 'Document':
      return {
        bg: 'bg-brand-green',
        hoverBg: 'hover:bg-brand-green-hover',
        text: 'text-white',
        textColor: 'text-brand-green dark:text-emerald-400',
        border: 'border-brand-green',
        label: 'Document',
      };
  }
}

export function ConfirmationsDataTable({
  data = [],
  totalRecords,
  initialPage = 1,
  initialPageSize,
  lang = 'en',
  dict,
  action = 'All',
  columns: customColumns,
  title = 'Confirmations/Quotations',
  description = 'Manage, track, and generate smart agricultural trade contracts and confirmations.',
  isLoading = false,
  onAddConfirmation,
  onCreateDoc,
  onDeleteRow,
  addHref,
  addButtonLabel,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onRowClick,
  onRefresh,
  showTopCard = false,
  initialSearch = '',
  initialSearchLabel = '',
  searchLabel = '',
}: ConfirmationsDataTableProps) {
  const router = useRouter();
  const effectiveTitle = title || dict?.smart_docs?.page_title || 'Confirmations/Quotations';
  const effectiveDescription =
    description ||
    dict?.smart_docs?.page_description ||
    'Manage, track, and generate smart agricultural trade contracts and confirmations.';
  const effectiveAddButtonLabel =
    addButtonLabel ||
    dict?.smart_docs?.add_new_confirmation ||
    dict?.smart_docs?.add_confirmation ||
    'Add New Confirmation';
  const effectiveAddHref =
    addHref !== undefined
      ? addHref
      : `/${lang}/smart-docs/draft`;
  const effectiveEmptyTitle = emptyTitle || dict?.smart_docs?.no_confirmations_found || 'No Confirmations Found';
  const effectiveEmptyDescription =
    emptyDescription ||
    dict?.smart_docs?.no_confirmations_desc ||
    'There are currently no trade confirmations available. Click the button below to add your first confirmation.';
  const [tableData, setTableData] = useState<any[]>(data);
  const [serverTotal, setServerTotal] = useState<number | null>(
    typeof totalRecords === 'number' ? totalRecords : null
  );
  const [pageSize, setPageSize] = useState<number>(initialPageSize || defaultPageSize);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [selectedAction, setSelectedAction] = useState<string>(() => normalizeActionParam(action || 'All'));
  const [selectedSearchColumn, setSelectedSearchColumn] = useState<string>(
    () => initialSearchLabel || searchLabel || ''
  );
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [isFetching, setIsFetching] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnFilterOpen, setIsColumnFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  // Delete confirmation modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const lastSearchedQueryRef = useRef<string>(initialSearch || '');
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(target)) {
        setIsColumnFilterOpen(false);
      }
    };
    if (isFilterOpen || isColumnFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen, isColumnFilterOpen]);

  // Close dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
        setIsColumnFilterOpen(false);
      }
    };
    if (isFilterOpen || isColumnFilterOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen, isColumnFilterOpen]);

  // Close dropdowns on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isFilterOpen) setIsFilterOpen(false);
      if (isColumnFilterOpen) setIsColumnFilterOpen(false);
    };
    if (isFilterOpen || isColumnFilterOpen) {
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isFilterOpen, isColumnFilterOpen]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  // Localized action filter options
  const actionOptions = useMemo(() => [
    { label: dict?.smart_docs?.action_types?.all || 'ALL', value: 'All' },
    { label: dict?.smart_docs?.action_types?.confirmation || 'CONFIRMATION', value: 'Confirmation' },
    { label: dict?.smart_docs?.action_types?.contract || 'CONTRACT', value: 'Contract' },
    { label: dict?.smart_docs?.action_types?.document || 'DOCUMENT', value: 'Document' },
  ], [dict]);

  // Current active filter option metadata
  const currentActionOption = useMemo(() => {
    return (
      actionOptions.find(
        (opt) => opt.value.toLowerCase() === selectedAction.toLowerCase()
      ) || { label: selectedAction.toUpperCase(), value: selectedAction }
    );
  }, [actionOptions, selectedAction]);

  // Localized column search options
  const searchColumnOptions = useMemo(() => [
    { label: dict?.smart_docs?.search_columns?.contract_number || 'Contract Number', value: 'contract_number' },
    { label: dict?.smart_docs?.search_columns?.seller || 'Seller', value: 'seller' },
    { label: dict?.smart_docs?.search_columns?.buyer || 'Buyer', value: 'buyer' },
    { label: dict?.smart_docs?.search_columns?.product || 'Product', value: 'product' },
    { label: dict?.smart_docs?.search_columns?.loading_port || 'Loading Port', value: 'loading_port' },
    { label: dict?.smart_docs?.search_columns?.destination_port || 'Destination Port', value: 'destination_port' },
    { label: dict?.smart_docs?.search_columns?.packing_type || 'Packing Type', value: 'packing_type' },
    { label: dict?.smart_docs?.search_columns?.country || 'Country', value: 'country' },
  ], [dict]);

  // Current active search column metadata
  const selectedColumnOption = useMemo(() => {
    if (!selectedSearchColumn) return null;
    return (
      searchColumnOptions.find(
        (opt) => opt.value.toLowerCase() === selectedSearchColumn.toLowerCase()
      ) || { label: selectedSearchColumn, value: selectedSearchColumn }
    );
  }, [searchColumnOptions, selectedSearchColumn]);

  // Dynamic search input placeholder based on selected search column
  const dynamicSearchPlaceholder = useMemo(() => {
    if (selectedColumnOption) {
      return `${dict?.smart_docs?.search_by || 'Search by'} ${selectedColumnOption.label}...`;
    }
    return searchPlaceholder || dict?.smart_docs?.search_confirmations || 'Search confirmations...';
  }, [selectedColumnOption, searchPlaceholder, dict]);

  // Synchronize URL search params safely
  const syncUrlParams = useCallback(
    (page: number, limit: number, act: string, search: string, col: string) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);

      // Page
      if (page > 1) {
        url.searchParams.set('page', String(page));
      } else {
        url.searchParams.delete('page');
      }

      // Limit
      if (limit !== 25) {
        url.searchParams.set('limit', String(limit));
      } else {
        url.searchParams.delete('limit');
      }

      // Action
      if (act && act !== 'All') {
        url.searchParams.set('action', act);
      } else {
        url.searchParams.delete('action');
      }

      // Search Query
      const trimmedSearch = search.trim();
      if (trimmedSearch.length >= 3) {
        url.searchParams.set('search', trimmedSearch);
      } else {
        url.searchParams.delete('search');
      }

      // Search Column Label
      if (col.trim()) {
        url.searchParams.set('search_label', col.trim());
      } else {
        url.searchParams.delete('search_label');
      }

      window.history.replaceState(null, '', url.toString());
    },
    []
  );

  // Fetch smart docs via authenticated server action:
  const fetchSmartDocs = useCallback(
    async (
      targetPage: number = currentPage,
      targetLimit: number = pageSize,
      targetAction: string = selectedAction,
      targetSearch: string = searchQuery,
      targetSearchLabel: string = selectedSearchColumn
    ) => {
      setIsFetching(true);
      try {
        const formattedAction = normalizeActionParam(targetAction);
        const trimmedSearch = targetSearch.trim();
        // Only trigger search in API if >= 3 characters or empty (to reset)
        const effectiveSearch = trimmedSearch.length >= 3 ? trimmedSearch : undefined;
        const effectiveSearchLabel =
          effectiveSearch && targetSearchLabel.trim() ? targetSearchLabel.trim() : undefined;

        const res = await getSmartDocsListAction({
          page: targetPage,
          limit: targetLimit,
          action: formattedAction,
          lang: lang || 'en',
          search: effectiveSearch,
          search_label: effectiveSearchLabel,
        });

        if (res && Array.isArray(res.data)) {
          setTableData(res.data);
          setServerTotal(typeof res.total === 'number' ? res.total : res.data.length);
          setCurrentPage(targetPage);
          setPageSize(targetLimit);
        }
      } catch (error) {
        console.error('[ConfirmationsDataTable] fetchSmartDocs error:', error);
      } finally {
        setIsFetching(false);
      }
    },
    [currentPage, pageSize, selectedAction, searchQuery, selectedSearchColumn, lang]
  );

  // Handle document deletion via authenticated Server Action
  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;

    const docId = extractSmartDocId(rowToDelete);
    const allCandidateIds = extractAllSmartDocIds(rowToDelete);
    if (!docId && allCandidateIds.length === 0) {
      toast.error('Unable to find document ID to delete.');
      return;
    }

    const effectiveDocId = docId || allCandidateIds[0];
    const docType = getSmartDocType(rowToDelete, selectedAction);

    setIsDeleting(true);
    try {
      const res = await deleteSmartDocAction({
        documentId: effectiveDocId,
        candidateIds: allCandidateIds,
        docType,
        action: selectedAction,
        lang: lang || 'en',
      });

      if (res.success) {
        toast.success(res.message || dict?.smart_docs?.record_deleted_success || 'Record deleted successfully');
        setIsDeleteModalOpen(false);
        setRowToDelete(null);

        // Optimistically remove from state by checking any matching candidate ID
        setTableData((prev) =>
          prev.filter((item) => {
            const itemCandidateIds = extractAllSmartDocIds(item);
            return !allCandidateIds.some((id) => itemCandidateIds.includes(id));
          })
        );
        setServerTotal((prev) => (typeof prev === 'number' && prev > 0 ? prev - 1 : 0));

        // Re-fetch to keep pagination and server data synchronized
        const targetPage =
          tableData.length <= 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        await fetchSmartDocs(targetPage, pageSize, selectedAction, searchQuery, selectedSearchColumn);

        if (onRefresh) {
          onRefresh();
        }
      } else {
        toast.error(res.error || dict?.smart_docs?.record_delete_failed || 'Failed to delete record');
      }
    } catch (err: any) {
      console.error('[ConfirmationsDataTable] handleConfirmDelete error:', err);
      toast.error(err?.message || dict?.smart_docs?.record_delete_failed || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sync internal state when parent props change
  useEffect(() => {
    if (Array.isArray(data)) {
      setTableData(data);
      if (typeof totalRecords === 'number') {
        setServerTotal(totalRecords);
      }
    }
  }, [data, totalRecords]);

  // Sync action prop if changed externally
  useEffect(() => {
    if (action) {
      setSelectedAction(normalizeActionParam(action));
    }
  }, [action]);

  // Sync search label prop if changed externally
  useEffect(() => {
    if (initialSearchLabel || searchLabel) {
      setSelectedSearchColumn(initialSearchLabel || searchLabel || '');
    }
  }, [initialSearchLabel, searchLabel]);

  // Self-heal: If totalRecords indicates records exist or data is empty on mount, fetch immediately
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      if ((!data || data.length === 0) && (totalRecords === undefined || totalRecords > 0)) {
        fetchSmartDocs(currentPage, pageSize, selectedAction, searchQuery, selectedSearchColumn);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    }
    await fetchSmartDocs(currentPage, pageSize, selectedAction, searchQuery, selectedSearchColumn);
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage === currentPage || newPage < 1) return;
    setCurrentPage(newPage);
    syncUrlParams(newPage, pageSize, selectedAction, searchQuery, selectedSearchColumn);
    await fetchSmartDocs(newPage, pageSize, selectedAction, searchQuery, selectedSearchColumn);
  };

  const handlePageSizeChange = async (newLimit: number) => {
    setPageSize(newLimit);
    setCurrentPage(1);
    syncUrlParams(1, newLimit, selectedAction, searchQuery, selectedSearchColumn);
    await fetchSmartDocs(1, newLimit, selectedAction, searchQuery, selectedSearchColumn);
  };

  const handleActionChange = async (newAction: string) => {
    const formattedAction = normalizeActionParam(newAction);
    setIsFilterOpen(false);
    if (formattedAction.toLowerCase() === selectedAction.toLowerCase()) return;
    setSelectedAction(formattedAction);
    setCurrentPage(1);
    syncUrlParams(1, pageSize, formattedAction, searchQuery, selectedSearchColumn);
    await fetchSmartDocs(1, pageSize, formattedAction, searchQuery, selectedSearchColumn);
  };

  const handleColumnChange = async (newColumn: string) => {
    setIsColumnFilterOpen(false);
    if (newColumn === selectedSearchColumn) return;
    setSelectedSearchColumn(newColumn);
    setCurrentPage(1);
    syncUrlParams(1, pageSize, selectedAction, searchQuery, newColumn);

    // If there is an active search query (>= 3 chars), immediately refetch with new column!
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 3) {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
      lastSearchedQueryRef.current = trimmed;
      await fetchSmartDocs(1, pageSize, selectedAction, trimmed, newColumn);
    }
  };

  // Debounced search change handler:
  // Starts querying only from 3rd character onwards (length >= 3)
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    const trimmed = val.trim();

    // 1. Cleared to empty -> reset immediately if previous query was active
    if (trimmed.length === 0) {
      if (lastSearchedQueryRef.current !== '') {
        lastSearchedQueryRef.current = '';
        syncUrlParams(1, pageSize, selectedAction, '', selectedSearchColumn);
        fetchSmartDocs(1, pageSize, selectedAction, '', selectedSearchColumn);
      }
      return;
    }

    // 2. 1 or 2 characters -> Do not trigger search (prevent unnecessary API calls)
    if (trimmed.length < 3) {
      return;
    }

    // 3. 3 or more characters -> Debounce 400ms then trigger search
    searchDebounceTimerRef.current = setTimeout(() => {
      lastSearchedQueryRef.current = trimmed;
      syncUrlParams(1, pageSize, selectedAction, trimmed, selectedSearchColumn);
      fetchSmartDocs(1, pageSize, selectedAction, trimmed, selectedSearchColumn);
    }, 400);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = searchQuery.trim();
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
      if (trimmed.length >= 3) {
        lastSearchedQueryRef.current = trimmed;
        syncUrlParams(1, pageSize, selectedAction, trimmed, selectedSearchColumn);
        fetchSmartDocs(1, pageSize, selectedAction, trimmed, selectedSearchColumn);
      } else if (trimmed.length === 0 && lastSearchedQueryRef.current !== '') {
        lastSearchedQueryRef.current = '';
        syncUrlParams(1, pageSize, selectedAction, '', selectedSearchColumn);
        fetchSmartDocs(1, pageSize, selectedAction, '', selectedSearchColumn);
      }
    }
  };

  const handleSearchClear = async () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    setSearchQuery('');
    lastSearchedQueryRef.current = '';
    syncUrlParams(1, pageSize, selectedAction, '', selectedSearchColumn);
    await fetchSmartDocs(1, pageSize, selectedAction, '', selectedSearchColumn);
  };

  // Derive dynamic or default Confirmation columns
  const activeColumns = useMemo<DataTableColumn[]>(() => {
    if (customColumns && customColumns.length > 0) {
      return customColumns;
    }

    // Default smart confirmation columns: 21 columns in exact requested sequence
    return [
      // 1. Contract No. (Sticky Left)
      {
        key: 'contract_no',
        title: dict?.smart_docs?.columns?.contract_no || 'Contract No.',
        sortable: true,
        sticky: 'left',
        align: 'left',
        minWidth: '130px',
        render: (row: any, index: number) => {
          const val =
            row.contract_no ||
            row.contract_number ||
            row.confirmation_no ||
            row.confirmation_id ||
            row.contract_id ||
            row.doc_no ||
            row.document_no ||
            row.doc_number ||
            row.document_number ||
            row.smart_doc_no ||
            row.smart_docs_no ||
            row.inquiry_no ||
            row.order_no ||
            row.ref_no ||
            row.reference_no ||
            row.id ||
            row._id ||
            `CONF-${String((currentPage - 1) * pageSize + index + 1).padStart(4, '0')}`;
          return (
            <span
              className="font-mono text-[14px] font-medium text-foreground whitespace-nowrap block text-left"
              title={String(val)}
            >
              {String(val)}
            </span>
          );
        },
      },
      // 2. Status
      {
        key: 'status',
        title: dict?.smart_docs?.columns?.status || 'Status',
        sortable: true,
        align: 'center',
        minWidth: '90px',
        render: (row: any) => {
          const docType = getSmartDocType(row, selectedAction);
          const config = getDocTypeColorConfig(docType);
          const label =
            docType === 'Confirmation'
              ? (dict?.smart_docs?.action_types?.confirmation || config.label)
              : docType === 'Contract'
              ? (dict?.smart_docs?.action_types?.contract || config.label)
              : (dict?.smart_docs?.action_types?.document || config.label);

          return (
            <span
              className={`text-[14px] font-bold ${config.textColor} whitespace-nowrap block text-center`}
              title={label}
            >
              {label}
            </span>
          );
        },
      },
      // 3. Contract Date
      {
        key: 'contract_date',
        title: dict?.smart_docs?.columns?.contract_date || 'Contract Date',
        sortable: true,
        align: 'center',
        minWidth: '105px',
        render: (row: any) => {
          const raw =
            row.contract_date ||
            row.confirmation_date ||
            row.date ||
            row.doc_date ||
            row.document_date ||
            row.created_at ||
            row.createdAt ||
            row.created_date ||
            row.issue_date;
          return <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center">{formatDate(raw)}</span>;
        },
      },
      // 4. Buyer Name
      {
        key: 'buyer_name',
        title: dict?.smart_docs?.columns?.buyer_name || 'Buyer Name',
        sortable: true,
        align: 'left',
        minWidth: '130px',
        render: (row: any) => {
          const b =
            row.buyer_name ||
            row.buyerName ||
            row.buyer_company_name ||
            row.buyer?.name ||
            row.buyer?.company_name ||
            row.buyer?.company ||
            (String(row.type || row.action || '').toLowerCase().includes('buy')
              ? row.party_name || row.party?.name || row.company_name
              : null) ||
            row.buyer;
          const display = typeof b === 'object' ? (b?.name || b?.company_name || '—') : String(b || '—');
          return (
            <span className="text-[14px] font-semibold text-foreground whitespace-nowrap block text-left" title={display}>
              {display}
            </span>
          );
        },
      },
      // 5. Seller Name
      {
        key: 'seller_name',
        title: dict?.smart_docs?.columns?.seller_name || 'Seller Name',
        sortable: true,
        align: 'left',
        minWidth: '130px',
        render: (row: any) => {
          const s =
            row.seller_name ||
            row.sellerName ||
            row.seller_company_name ||
            row.seller?.name ||
            row.seller?.company_name ||
            row.seller?.company ||
            (String(row.type || row.action || '').toLowerCase().includes('sell')
              ? row.party_name || row.party?.name || row.company_name
              : null) ||
            row.seller;
          const display = typeof s === 'object' ? (s?.name || s?.company_name || '—') : String(s || '—');
          return (
            <span className="text-[14px] font-semibold text-foreground whitespace-nowrap block text-left" title={display}>
              {display}
            </span>
          );
        },
      },
      // 6. Product
      {
        key: 'product',
        title: dict?.smart_docs?.columns?.product || 'Product',
        sortable: true,
        align: 'left',
        minWidth: '150px',
        render: (row: any) => {
          const prod =
            row.product ||
            row.product_name ||
            row.productName ||
            row.product?.name ||
            row.commodity ||
            row.commodity_name ||
            row.commodityName ||
            row.commodity?.name ||
            row.crop_name ||
            row.item_name ||
            row.title;
          const display = typeof prod === 'object' ? (prod?.name || prod?.title || '—') : String(prod || '—');
          const variety = row.variety || row.grade || row.specification;
          return (
            <div className="flex flex-col items-start justify-center whitespace-nowrap text-left">
              <span className="text-[14px] font-semibold text-foreground" title={display}>
                {display}
              </span>
              {variety && (
                <span className="text-[12px] text-muted-foreground" title={String(variety)}>
                  {String(variety)}
                </span>
              )}
            </div>
          );
        },
      },
      // 7. Incoterm
      {
        key: 'incoterm',
        title: dict?.smart_docs?.columns?.incoterm || 'Incoterm',
        sortable: true,
        align: 'center',
        minWidth: '80px',
        render: (row: any) => {
          const val =
            row.incoterm ||
            row.incoterms ||
            row.incoterm_name ||
            row.shipping_term ||
            row.shipment_term ||
            row.delivery_term ||
            row.trade_term ||
            row.shippingTerm;
          if (!val) return <span className="text-[14px] text-muted-foreground">—</span>;
          return (
            <span className="text-[14px] font-semibold text-foreground tracking-wide uppercase block text-center">
              {String(val)}
            </span>
          );
        },
      },
      // 8. Price
      {
        key: 'price',
        title: dict?.smart_docs?.columns?.price || 'Price',
        sortable: true,
        align: 'right',
        minWidth: '95px',
        render: (row: any) => {
          const price =
            row.price ??
            row.rate ??
            row.unit_price ??
            row.unitPrice ??
            row.target_price;
          const currency = row.currency || row.currency_code || row.price_currency || '$';
          const unit = row.price_unit || row.rate_unit || row.uom || row.unit;
          if (price === undefined || price === null || price === '') {
            return <span className="text-[14px] text-muted-foreground">—</span>;
          }
          return (
            <div className="text-right whitespace-nowrap">
              <span className="text-[14px] font-semibold text-foreground">
                {formatAmount(price, currency)}
              </span>
              {unit && <span className="text-xs text-muted-foreground ml-1">/{unit}</span>}
            </div>
          );
        },
      },
      // 9. QTY FCL
      {
        key: 'qty_fcl',
        title: dict?.smart_docs?.columns?.qty_fcl || 'QTY FCL',
        sortable: true,
        align: 'right',
        minWidth: '85px',
        render: (row: any) => {
          const fcl =
            row.fcl_quantity ??
            row.fclQuantity ??
            row.qty_fcl ??
            row.quantity_fcl ??
            row.fcl ??
            row.container_fcl ??
            row.container_count ??
            row.fcl_count ??
            row.containers;
          if (fcl === undefined || fcl === null || fcl === '') {
            return <span className="text-[14px] text-muted-foreground">—</span>;
          }
          return (
            <span className="text-[14px] font-semibold text-foreground whitespace-nowrap">
              {String(fcl)} <span className="text-xs text-muted-foreground font-normal">FCL</span>
            </span>
          );
        },
      },
      // 10. QTY MT
      {
        key: 'qty_mt',
        title: dict?.smart_docs?.columns?.qty_mt || 'QTY MT',
        sortable: true,
        align: 'right',
        minWidth: '90px',
        render: (row: any) => {
          const mt =
            row.mt_quantity ??
            row.mtQuantity ??
            row.qty_mt ??
            row.quantity_mt ??
            row.qty ??
            row.quantity ??
            row.metric_tons ??
            row.weight_mt ??
            row.total_quantity;
          if (mt === undefined || mt === null || mt === '') {
            return <span className="text-[14px] text-muted-foreground">—</span>;
          }
          const num = Number(mt);
          return (
            <span className="text-[14px] font-semibold text-foreground whitespace-nowrap">
              {!isNaN(num) ? num.toLocaleString('en-IN') : String(mt)}{' '}
              <span className="text-xs text-muted-foreground font-normal">MT</span>
            </span>
          );
        },
      },
      // 11. Total Value
      {
        key: 'total_value',
        title: dict?.smart_docs?.columns?.total_value || 'Total Value',
        sortable: true,
        align: 'right',
        minWidth: '105px',
        render: (row: any) => {
          const val =
            row.total_value ??
            row.totalValue ??
            row.total_amount ??
            row.totalAmount ??
            row.grand_total ??
            row.grandTotal ??
            row.contract_value ??
            row.value ??
            row.amount;
          const currency = row.currency || row.currency_code || '$';
          if (val === undefined || val === null || val === '') {
            return <span className="text-[14px] text-muted-foreground">—</span>;
          }
          return (
            <span className="text-[14px] font-bold text-foreground whitespace-nowrap">
              {formatAmount(val, currency)}
            </span>
          );
        },
      },
      // 12. Product Country
      {
        key: 'product_country',
        title: dict?.smart_docs?.columns?.product_country || 'Product Country',
        sortable: true,
        align: 'center',
        minWidth: '110px',
        render: (row: any) => {
          const val =
            row.product_country ||
            row.productCountry ||
            row.product_country_name ||
            row.productCountryName ||
            row.origin_country ||
            row.origin_country_name ||
            row.country_of_origin ||
            row.country_of_origin_name ||
            row.originCountry ||
            row.country ||
            row.country_name ||
            row.product?.country ||
            row.product?.country_name ||
            row.product?.origin_country;
          const display = typeof val === 'object' ? (val?.name || val?.country_name || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 13. Packing Type
      {
        key: 'packing_type',
        title: dict?.smart_docs?.columns?.packing_type || 'Packing Type',
        sortable: true,
        align: 'center',
        minWidth: '110px',
        render: (row: any) => {
          const val =
            row.packing_type ||
            row.packingType ||
            row.packing_type_name ||
            row.packaging_type ||
            row.packagingType ||
            row.packaging_type_name ||
            row.packaging ||
            row.packing ||
            row.package_type;
          const display = typeof val === 'object' ? (val?.name || val?.title || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 14. Loading Port
      {
        key: 'loading_port',
        title: dict?.smart_docs?.columns?.loading_port || 'Loading Port',
        sortable: true,
        align: 'center',
        minWidth: '110px',
        render: (row: any) => {
          const val =
            row.loading_port_name ||
            row.loadingPortName ||
            row.loading_port ||
            row.loadingPort ||
            row.port_of_loading_name ||
            row.portOfLoadingName ||
            row.port_of_loading ||
            row.portOfLoading ||
            row.pol_name ||
            row.pol ||
            row.origin_port ||
            row.origin_port_name;
          const display = typeof val === 'object' ? (val?.name || val?.port_name || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 15. Loading Country
      {
        key: 'loading_country',
        title: dict?.smart_docs?.columns?.loading_country || 'Loading Country',
        sortable: true,
        align: 'center',
        minWidth: '110px',
        render: (row: any) => {
          const val =
            row.loading_port_country_name ||
            row.loadingPortCountryName ||
            row.loading_country_name ||
            row.loadingCountryName ||
            row.loading_country ||
            row.loadingCountry ||
            row.port_of_loading_country ||
            row.port_of_loading_country_name ||
            row.pol_country ||
            row.pol_country_name ||
            row.origin_country ||
            row.origin_country_name;
          const display = typeof val === 'object' ? (val?.name || val?.country_name || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 16. Destination Port
      {
        key: 'destination_port',
        title: dict?.smart_docs?.columns?.destination_port || 'Destination Port',
        sortable: true,
        align: 'center',
        minWidth: '115px',
        render: (row: any) => {
          const val =
            row.destination_port_name ||
            row.destinationPortName ||
            row.discharge_port_name ||
            row.dischargePortName ||
            row.port_of_discharge_name ||
            row.portOfDischargeName ||
            row.destination_port ||
            row.destinationPort ||
            row.discharge_port ||
            row.port_of_discharge ||
            row.portOfDischarge ||
            row.pod_name ||
            row.pod;
          const display = typeof val === 'object' ? (val?.name || val?.port_name || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 17. Destination Country
      {
        key: 'destination_country',
        title: dict?.smart_docs?.columns?.destination_country || 'Destination Country',
        sortable: true,
        align: 'center',
        minWidth: '115px',
        render: (row: any) => {
          const val =
            row.destination_port_country_name ||
            row.destinationPortCountryName ||
            row.destination_country_name ||
            row.destinationCountryName ||
            row.discharge_port_country_name ||
            row.dischargePortCountryName ||
            row.discharge_country_name ||
            row.destination_country ||
            row.destinationCountry ||
            row.discharge_country ||
            row.port_of_discharge_country ||
            row.pod_country ||
            row.pod_country_name ||
            row.delivery_country ||
            row.delivery_country_name;
          const display = typeof val === 'object' ? (val?.name || val?.country_name || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 18. Shipment Period
      {
        key: 'shipment_period',
        title: dict?.smart_docs?.columns?.shipment_period || 'Shipment Period',
        sortable: true,
        align: 'center',
        minWidth: '125px',
        render: (row: any) => {
          const s = row.shipping_start_date || row.shipment_start_date || row.start_date;
          const e = row.shipping_end_date || row.shipment_end_date || row.end_date;
          let val = '—';
          if (s && e) val = `${formatDate(s)} – ${formatDate(e)}`;
          else if (s) val = formatDate(s);
          else if (e) val = formatDate(e);
          else {
            val =
              row.shipment_period ||
              row.shipmentPeriod ||
              row.shipping_period ||
              row.delivery_period ||
              '—';
          }
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={val}>
              {val}
            </span>
          );
        },
      },
      // 19. Payment Term
      {
        key: 'payment_term',
        title: dict?.smart_docs?.columns?.payment_term || 'Payment Term',
        sortable: true,
        align: 'center',
        minWidth: '115px',
        render: (row: any) => {
          const val =
            row.payment_term ||
            row.paymentTerm ||
            row.payment_term_name ||
            row.payment_terms ||
            row.paymentTerms ||
            row.payment_method ||
            row.paymentMethod ||
            row.terms_of_payment;
          const display = typeof val === 'object' ? (val?.name || val?.title || '—') : String(val || '—');
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 20. Ship By
      {
        key: 'ship_by',
        title: dict?.smart_docs?.columns?.ship_by || 'Ship By',
        sortable: true,
        align: 'center',
        minWidth: '85px',
        render: (row: any) => {
          const val =
            row.ship_by ||
            row.shipBy ||
            row.ship_by_name ||
            row.shipping_container ||
            row.container_type ||
            row.mode_of_shipment ||
            row.shipping_mode ||
            row.shipment_mode ||
            row.transport_mode;
          let display = typeof val === 'object' ? (val?.name || val?.title || '—') : String(val || '—');
          if (display && display !== '—') {
            display = display.replace(/_/g, ' ');
          }
          return (
            <span className="text-[14px] text-foreground/90 whitespace-nowrap block text-center" title={display}>
              {display}
            </span>
          );
        },
      },
      // 21. Actions (Sticky Right)
      {
        key: 'action',
        title: dict?.smart_docs?.columns?.actions || dict?.smart_docs?.columns?.action || 'Actions',
        align: 'center',
        sticky: 'right',
        minWidth: '78px',
        className: 'w-[78px] max-w-[78px]',
        render: (row: any) => {
          const docType = getSmartDocType(row, selectedAction);
          const isConfirmation = docType === 'Confirmation';
          const config = getDocTypeColorConfig(docType);

          return (
            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Button 1: File Circle Plus (Action only implemented for Confirmation; Contract & Document are pending) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // Contract and Document are not built yet, so do not perform any draft/edit action
                  if (!isConfirmation) {
                    return;
                  }

                  if (onCreateDoc) {
                    onCreateDoc(row);
                  } else {
                    const rowDocId = extractSmartDocId(row);
                    if (rowDocId) {
                      router.push(`/${lang}/smart-docs/draft?id=${encodeURIComponent(rowDocId)}`);
                    } else {
                      router.push(`/${lang}/smart-docs/draft`);
                    }
                  }
                }}
                className={`w-7 h-7 rounded-lg ${config.bg} ${
                  isConfirmation
                    ? `${config.hoverBg} cursor-pointer active:scale-95`
                    : 'opacity-80 cursor-default'
                } text-white shadow-2xs transition-all flex items-center justify-center text-xs shrink-0`}
                title={
                  isConfirmation
                    ? (dict?.smart_docs?.continue_to_draft || 'Continue to Draft')
                    : `${docType}`
                }
              >
                <i className="fa-solid fa-file-circle-plus text-xs"></i>
              </button>

              {/* Button 2: Trash Delete Button (Works for all records) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRowToDelete(row);
                  setIsDeleteModalOpen(true);
                  if (onDeleteRow) {
                    onDeleteRow(row);
                  }
                }}
                className="w-7 h-7 rounded-lg border border-border bg-background hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-all flex items-center justify-center text-xs shadow-2xs active:scale-95 cursor-pointer shrink-0"
                title={dict?.smart_docs?.delete || 'Delete'}
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          );
        },
      },
    ];
  }, [customColumns, currentPage, pageSize, dict, selectedAction, lang, onCreateDoc, onDeleteRow, router]);

  // Deep client-side search across current table data
  const filteredData = useMemo(() => {
    if (!Array.isArray(tableData)) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query || query.length < 3) return tableData;

    return tableData.filter((item) => {
      if (!item || typeof item !== 'object') return false;

      // If a specific search column is selected, match against that column
      if (selectedSearchColumn) {
        const col = selectedSearchColumn.toLowerCase();
        let targetVal = '';
        if (col === 'contract_number' || col === 'contract_no') {
          targetVal = String(getSortValue(item, 'contract_no'));
        } else if (col === 'seller') {
          targetVal = String(getSortValue(item, 'seller_name'));
        } else if (col === 'buyer') {
          targetVal = String(getSortValue(item, 'buyer_name'));
        } else if (col === 'product') {
          targetVal = String(getSortValue(item, 'product'));
        } else if (col === 'loading_port') {
          targetVal = String(getSortValue(item, 'loading_port'));
        } else if (col === 'destination_port') {
          targetVal = String(getSortValue(item, 'destination_port'));
        } else if (col === 'packing_type') {
          targetVal = String(getSortValue(item, 'packing_type'));
        } else if (col === 'country') {
          targetVal = `${getSortValue(item, 'product_country')} ${getSortValue(item, 'loading_country')} ${getSortValue(item, 'destination_country')}`;
        }

        if (targetVal) {
          return targetVal.toLowerCase().includes(query);
        }
      }

      // Default fallback: search across all fields
      return Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') {
          return Object.values(val).some((nestedVal) =>
            String(nestedVal).toLowerCase().includes(query)
          );
        }
        return String(val).toLowerCase().includes(query);
      });
    });
  }, [tableData, searchQuery, selectedSearchColumn]);

  // Sorting logic using getSortValue for high-fidelity column sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      let valA = getSortValue(a, sortKey);
      let valB = getSortValue(b, sortKey);

      // Handle null/undefined values
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      // Number comparison
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      // Date comparison
      const dateA = Date.parse(valA);
      const dateB = Date.parse(valB);
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // String comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination calculations:
  // If server pagination is active (total records provided and paginated by API), we display sortedData directly
  const totalRecordsCount = serverTotal !== null ? serverTotal : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecordsCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedData = useMemo(() => {
    // When server-side pagination is active or data array already fits within pageSize:
    // sortedData IS ALREADY the slice for the current page. DO NOT slice again!
    if (serverTotal !== null || sortedData.length <= pageSize) {
      return sortedData;
    }
    // Only slice if full unfiltered dataset was passed client-side without server pagination
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, safeCurrentPage, pageSize, serverTotal]);

  const effectiveLoading = isLoading || isFetching;

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
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

  const handleAddClick = () => {
    if (onAddConfirmation) {
      onAddConfirmation();
    }
  };

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Optional Top Header Card */}
      {showTopCard && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 sm:p-4 rounded-xl shadow-xs shrink-0 mb-1.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs shadow-2xs shrink-0">
                <i className="fa-solid fa-file-signature"></i>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                {title}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              {description}
            </p>
          </div>

          {/* Action Button: Add Confirmation */}
          <div className="flex items-center gap-2 shrink-0">
            {effectiveAddHref ? (
              <Link
                href={effectiveAddHref}
                className="h-8 sm:h-8.5 px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-2 shadow-xs active:scale-95 shrink-0"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>{effectiveAddButtonLabel}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAddClick}
                className="h-8 sm:h-8.5 px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-2 shadow-xs active:scale-95 shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>{effectiveAddButtonLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main DataTable Container */}
      <div className="w-full bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-auto max-h-full relative z-10">
        {/* Table Controls Bar (Search + Action Filter + Add Confirmation Action) */}
        <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 border-b border-border bg-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-2.5 shrink-0 relative z-20">
          {/* Left: Action Filter Dropdown (First) + Search Column Dropdown (Second) + Search Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* 1. Custom Document Type / Action Filter Dropdown */}
            <div ref={filterDropdownRef} className="relative w-full sm:w-36 shrink-0">
              <button
                type="button"
                id="smart-docs-action-filter"
                aria-label="Filter by document type"
                aria-haspopup="listbox"
                aria-expanded={isFilterOpen}
                onClick={() => {
                  setIsFilterOpen((prev) => !prev);
                  setIsColumnFilterOpen(false);
                }}
                className={`w-full h-8.5 sm:h-9 px-3 text-xs font-semibold bg-background border rounded-md text-foreground inline-flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs select-none ${
                  isFilterOpen
                    ? 'border-brand-blue ring-1 ring-brand-blue'
                    : selectedAction.toLowerCase() !== 'all'
                    ? 'border-brand-blue/60 text-brand-blue font-bold'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <i
                    className={`fa-solid fa-filter text-xs shrink-0 ${
                      selectedAction.toLowerCase() !== 'all'
                        ? 'text-brand-blue'
                        : 'text-muted-foreground'
                    }`}
                  ></i>
                  <span className="truncate uppercase tracking-wide font-semibold text-xs">
                    {currentActionOption.label}
                  </span>
                </div>
                {selectedAction.toLowerCase() === 'all' ? (
                  <i
                    className={`fa-solid fa-chevron-down text-[10px] text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isFilterOpen ? 'rotate-180' : ''
                    }`}
                  ></i>
                ) : (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear filter to ALL"
                    title="Reset filter"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionChange('All');
                      setIsFilterOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        handleActionChange('All');
                        setIsFilterOpen(false);
                      }
                    }}
                    className="p-1 -mr-1 rtl:-ml-1 rtl:mr-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark text-xs shrink-0"></i>
                  </span>
                )}
              </button>

              {/* Floating Options Menu */}
              {isFilterOpen && (
                <div
                  role="listbox"
                  aria-label="Filter options"
                  className="absolute left-0 rtl:left-auto rtl:right-0 top-full mt-1 w-full sm:w-48 bg-card border border-border rounded-lg shadow-lg p-1 z-50 flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-0.5 text-left rtl:text-right">
                    {dict?.smart_docs?.filter_by_type || 'Filter by type'}
                  </div>
                  {actionOptions.map((opt) => {
                    const isSelected =
                      selectedAction.toLowerCase() === opt.value.toLowerCase();
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleActionChange(opt.value)}
                        className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-md text-left rtl:text-right flex items-center justify-between transition-colors cursor-pointer uppercase tracking-wider ${
                          isSelected
                            ? 'bg-brand-blue text-white shadow-xs font-bold'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <i className="fa-solid fa-check text-xs text-white shrink-0 ml-2 rtl:ml-0 rtl:mr-2"></i>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Column Search Dropdown */}
            <div ref={columnDropdownRef} className="relative w-full sm:w-40 shrink-0">
              <button
                type="button"
                id="smart-docs-column-filter"
                aria-label="Select search column"
                aria-haspopup="listbox"
                aria-expanded={isColumnFilterOpen}
                onClick={() => {
                  setIsColumnFilterOpen((prev) => !prev);
                  setIsFilterOpen(false);
                }}
                className={`w-full h-8.5 sm:h-9 px-3 text-xs font-semibold bg-background border rounded-md text-foreground inline-flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs select-none ${
                  isColumnFilterOpen
                    ? 'border-brand-blue ring-1 ring-brand-blue'
                    : selectedSearchColumn
                    ? 'border-brand-blue/60 text-brand-blue font-bold'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <i
                    className={`fa-solid fa-table-columns text-xs shrink-0 ${
                      selectedSearchColumn
                        ? 'text-brand-blue'
                        : 'text-muted-foreground'
                    }`}
                  ></i>
                  <span
                    className={`truncate tracking-wide text-xs ${
                      selectedSearchColumn
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground font-normal'
                    }`}
                  >
                    {selectedColumnOption ? selectedColumnOption.label : (dict?.smart_docs?.select_column || 'Select Column')}
                  </span>
                </div>
                {!selectedSearchColumn ? (
                  <i
                    className={`fa-solid fa-chevron-down text-[10px] text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isColumnFilterOpen ? 'rotate-180' : ''
                    }`}
                  ></i>
                ) : (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear column selection"
                    title={dict?.smart_docs?.clear_column_filter || 'Clear column filter'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColumnChange('');
                      setIsColumnFilterOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        handleColumnChange('');
                        setIsColumnFilterOpen(false);
                      }
                    }}
                    className="p-1 -mr-1 rtl:-ml-1 rtl:mr-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark text-xs shrink-0"></i>
                  </span>
                )}
              </button>

              {/* Floating Column Options Menu */}
              {isColumnFilterOpen && (
                <div
                  role="listbox"
                  aria-label="Column search options"
                  className="absolute left-0 rtl:left-auto rtl:right-0 top-full mt-1 w-full sm:w-52 bg-card border border-border rounded-lg shadow-lg p-1 z-50 flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-0.5 text-left rtl:text-right">
                    {dict?.smart_docs?.search_by_column || 'Search by column'}
                  </div>
                  {searchColumnOptions.map((opt) => {
                    const isSelected =
                      selectedSearchColumn.toLowerCase() === opt.value.toLowerCase();
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleColumnChange(opt.value)}
                        className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-md text-left rtl:text-right flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-brand-blue text-white shadow-xs font-bold'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && (
                          <i className="fa-solid fa-check text-xs text-white shrink-0 ml-2 rtl:ml-0 rtl:mr-2"></i>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Search Box - Same height as dropdowns and proportional width */}
            <div className="relative w-full sm:w-64 md:w-72 shrink-0">
              <i className="fa-solid fa-magnifying-glass absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={dynamicSearchPlaceholder}
                className="w-full h-8.5 sm:h-9 pl-8.5 pr-8 rtl:pr-8.5 rtl:pl-8 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                  title={dict?.smart_docs?.clear_search || 'Clear search'}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Count indicator + Action Buttons */}
          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 shrink-0 flex-wrap">
            {searchQuery && (
              <span className="text-[11px] text-muted-foreground hidden lg:inline-block">
                {searchQuery.trim().length < 3 ? (
                  <span>{dict?.smart_docs?.type_min_chars || 'Type at least 3 characters...'}</span>
                ) : (
                  <>
                    {dict?.smart_docs?.found_matching || 'Found'}{' '}
                    <strong className="text-foreground">{filteredData.length}</strong>{' '}
                    {dict?.smart_docs?.matching_records || 'matching records'}
                  </>
                )}
              </span>
            )}

            {/* Add Confirmation Button in Table Toolbar */}
            {effectiveAddHref ? (
              <Link
                href={effectiveAddHref}
                className="h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>{effectiveAddButtonLabel}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAddClick}
                className="h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>{effectiveAddButtonLabel}</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Viewport */}
        <div className="w-full overflow-x-auto overflow-y-auto flex-1 min-h-0 relative z-10 overscroll-contain">
          <table className="w-max min-w-full text-left rtl:text-right border-separate border-spacing-0 bg-card">
            <thead>
              <tr className="bg-muted text-foreground text-[13px] sm:text-[14px] font-bold uppercase tracking-wider select-none">
                {activeColumns.map((col) => {
                  const isCurrentSort = sortKey === col.key;
                  const isStickyLeft = col.sticky === 'left';
                  const isStickyRight = col.sticky === 'right';

                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key, col.sortable)}
                      className={`px-3 py-2 sm:py-2.5 font-bold text-[13px] sm:text-[14px] text-foreground border-b border-border whitespace-nowrap sticky top-0 ${
                        isStickyLeft
                          ? 'sticky left-0 rtl:left-auto rtl:right-0 top-0 z-30 bg-muted border-r rtl:border-r-0 rtl:border-l border-border shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)]'
                          : isStickyRight
                          ? 'sticky right-0 rtl:right-auto rtl:left-0 top-0 z-30 bg-muted border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]'
                          : 'bg-muted z-20'
                      } ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left rtl:text-right'
                      } ${col.sortable ? 'cursor-pointer hover:text-brand-blue transition-colors' : ''} ${
                        col.className || ''
                      }`}
                      style={{ minWidth: col.minWidth, width: col.minWidth }}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === 'right'
                            ? 'justify-end w-full'
                            : col.align === 'center'
                            ? 'justify-center w-full'
                            : ''
                        }`}
                      >
                        <span>{col.title}</span>
                        {col.sortable && (
                          <span className="text-xs">
                            {isCurrentSort ? (
                              sortDirection === 'asc' ? (
                                <i className="fa-solid fa-arrow-up-wide-short text-brand-blue"></i>
                              ) : (
                                <i className="fa-solid fa-arrow-down-short-wide text-brand-blue"></i>
                              )
                            ) : (
                              <i className="fa-solid fa-sort opacity-40"></i>
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {effectiveLoading ? (
                // Shimmer Skeleton Rows
                Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBgClass = isEven ? 'bg-table-row-even' : 'bg-table-row-odd';

                  return (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      {activeColumns.map((col, cIdx) => {
                        const isStickyLeft = col.sticky === 'left';
                        const isStickyRight = col.sticky === 'right';
                        return (
                          <td
                            key={`skeleton-col-${cIdx}`}
                            style={{ minWidth: col.minWidth, width: col.minWidth }}
                            className={`px-3 py-1.5 sm:py-2 border-b border-border ${rowBgClass} ${
                              isStickyLeft
                                ? 'sticky left-0 rtl:left-auto rtl:right-0 z-10 border-r rtl:border-r-0 rtl:border-l border-border shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)]'
                                : isStickyRight
                                ? 'sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]'
                                : ''
                            }`}
                          >
                            <div
                              className={`h-4.5 bg-muted/60 rounded-md ${
                                col.align === 'right'
                                    ? 'w-16 ml-auto'
                                  : col.align === 'center'
                                  ? 'w-16 mx-auto'
                                  : 'w-24'
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : paginatedData.length > 0 ? (
                // Rendered Data Rows
                paginatedData.map((row, index) => {
                  const isEven = index % 2 === 0;
                  const rowBgClass = isEven ? 'bg-table-row-even' : 'bg-table-row-odd';

                  return (
                    <tr
                      key={row.id || row.contract_no || row.confirmation_no || row.ref_no || index}
                      onClick={() => {
                        if (onRowClick) {
                          onRowClick(row);
                        }
                      }}
                      className={`group ${onRowClick ? 'cursor-pointer' : ''}`}
                    >
                      {activeColumns.map((col) => {
                        const isStickyLeft = col.sticky === 'left';
                        const isStickyRight = col.sticky === 'right';
                        return (
                          <td
                            key={col.key}
                            style={{ minWidth: col.minWidth, width: col.minWidth }}
                            className={`px-3 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors ${
                              isStickyLeft
                                ? 'sticky left-0 rtl:left-auto rtl:right-0 z-10 border-r rtl:border-r-0 rtl:border-l border-border shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)]'
                                : isStickyRight
                                ? 'sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]'
                                : ''
                            } ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                ? 'text-center'
                                : 'text-left rtl:text-right'
                            } ${col.className || ''}`}
                          >
                            {col.render ? (
                              col.render(row, index)
                            ) : (
                              <span className="text-[13px] sm:text-[14px] text-foreground">
                                {row[col.key] !== undefined && row[col.key] !== null
                                  ? String(row[col.key])
                                  : '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                // Empty State Row
                <tr>
                  <td colSpan={activeColumns.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-muted/50 border border-border flex items-center justify-center text-muted-foreground text-2xl shadow-2xs">
                        <i className="fa-solid fa-file-contract"></i>
                      </div>

                      <div className="flex flex-col gap-1">
                        <h2 className="text-sm font-bold text-foreground">
                          {searchQuery ? (dict?.smart_docs?.no_matching_confirmations || 'No matching confirmations') : effectiveEmptyTitle}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery
                            ? (dict?.smart_docs?.no_matching_desc || `No confirmations match your search term "${searchQuery}". Try searching for something else or clear the filter.`)
                            : effectiveEmptyDescription}
                        </p>
                      </div>

                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={handleSearchClear}
                          className="mt-1 px-3.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                          <span>{dict?.smart_docs?.clear_search || 'Clear Search'}</span>
                        </button>
                      ) : effectiveAddHref ? (
                        <Link
                          href={effectiveAddHref}
                          className="mt-1 px-4 py-2 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>{effectiveAddButtonLabel}</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAddClick}
                          className="mt-1 px-4 py-2 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>{effectiveAddButtonLabel}</span>
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
          {/* Left: Per page records selector + Record info */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <label htmlFor="records-per-page-footer" className="text-xs font-medium whitespace-nowrap">
                {dict?.smart_docs?.records_per_page || 'Records per page:'}
              </label>
              <select
                id="records-per-page-footer"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                disabled={effectiveLoading}
                className="bg-background border border-border text-foreground font-medium rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-blue transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {totalRecordsCount > 0 && (
              <>
                <span className="text-border hidden sm:inline">|</span>
                <span>
                  {dict?.smart_docs?.showing || 'Showing'}{' '}
                  <strong className="text-foreground">
                    {(safeCurrentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  {dict?.smart_docs?.to || 'to'}{' '}
                  <strong className="text-foreground">
                    {Math.min(safeCurrentPage * pageSize, totalRecordsCount)}
                  </strong>{' '}
                  {dict?.smart_docs?.of || 'of'}{' '}
                  <strong className="text-foreground">{totalRecordsCount}</strong>{' '}
                  {dict?.smart_docs?.records || 'records'}
                </span>
              </>
            )}
          </div>

          {/* Right: Pagination Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Prev Button */}
            <button
              disabled={safeCurrentPage <= 1 || totalRecordsCount === 0 || effectiveLoading}
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              className="h-7.5 sm:h-8 px-2 sm:px-2.5 rounded-md bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title={dict?.smart_docs?.prev || 'Prev'}
              aria-label={dict?.smart_docs?.prev || 'Prev'}
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
              <span className="hidden sm:inline">{dict?.smart_docs?.prev || 'Prev'}</span>
            </button>

            {/* Numbered Page Buttons */}
            <div className="flex items-center gap-1">
              {totalPages > 0 && totalRecordsCount > 0 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 5) return true;
                    if (page === 1 || page === totalPages) return true;
                    return Math.abs(page - safeCurrentPage) <= 1;
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
                    const isActive = pageNum === safeCurrentPage;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={effectiveLoading}
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
              ) : (
                <button
                  disabled
                  className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-md text-xs font-semibold bg-background border border-border text-foreground opacity-40 cursor-not-allowed flex items-center justify-center shadow-2xs"
                  aria-label="Page 1"
                >
                  1
                </button>
              )}
            </div>

            {/* Next Button */}
            <button
              disabled={safeCurrentPage >= totalPages || totalRecordsCount === 0 || effectiveLoading}
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              className="h-7.5 sm:h-8 px-2 sm:px-2.5 rounded-md bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title={dict?.smart_docs?.next || 'Next'}
              aria-label={dict?.smart_docs?.next || 'Next'}
            >
              <span className="hidden sm:inline">{dict?.smart_docs?.next || 'Next'}</span>
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
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
        title={dict?.smart_docs?.delete_record || 'Delete Record'}
        description={dict?.smart_docs?.delete_record_confirm || 'Are you sure you want to delete this record? This will also delete all associated confirmations, contracts, and documents.'}
        confirmText={dict?.smart_docs?.yes_delete || 'Yes, Delete'}
        cancelText={dict?.smart_docs?.cancel || dict?.common?.cancel || 'Cancel'}
      />
    </div>
  );
}

export default ConfirmationsDataTable;

