'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getProductListingAction,
  deleteProductAction,
  saveProductAction,
  updateProductAction,
  getProductByIdAction,
} from '@/app/actions/smart-docs';
import { DeleteConfirmModal } from '@/components/ui/charts/DeleteConfirmModal';
import { ProductManageModal } from '@/components/smart-docs/draft/form/ProductManageModal';
import { generatePackingCuid } from '@/lib/api/smart-docs.service';

export interface ProductsDataTableProps {
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

// Helpers to cleanly extract fields regardless of backend response shape
export function extractProductName(row: any): string {
  if (!row) return '—';
  const val =
    row.product_name ||
    row.name ||
    row.productName ||
    row.product ||
    row.title ||
    row.label ||
    row.crop_name ||
    row.commodity_name ||
    row.commodity;
  if (typeof val === 'object') {
    return val?.name || val?.title || val?.label || '—';
  }
  return String(val || '—');
}

export function extractProductCountry(row: any): string {
  if (!row) return '—';
  const val =
    row.country_name ||
    row.countryName ||
    row.origin_country ||
    row.originCountry ||
    row.origin_country_name ||
    row.origin ||
    row.country ||
    row.country_of_origin ||
    row.country_of_origin_name;
  if (typeof val === 'object') {
    return val?.name || val?.country_name || val?.title || '—';
  }
  return String(val || '—');
}

export function extractProductHsn(row: any): string {
  if (!row) return '—';
  const val =
    row.hsn_code ||
    row.hsnCode ||
    row.hsn ||
    row.hsn_sac_code ||
    row.hsnSacCode ||
    row.hs_code ||
    row.code;
  if (typeof val === 'object') {
    return val?.code || val?.hsn || '—';
  }
  return String(val || '—');
}

export function extractProductCategory(row: any): string {
  if (!row) return '—';
  const val =
    row.category_name ||
    row.categoryName ||
    row.sub_category_name ||
    row.subCategoryName ||
    row.category ||
    row.category_title ||
    row.sub_category;
  if (typeof val === 'object') {
    return val?.name || val?.category_name || val?.title || '—';
  }
  return String(val || '—');
}

export function extractProductId(row: any): string {
  if (!row) return '';
  const val = row.id || row._id || row.product_id || row.productId || row.cuid || row.code;
  if (typeof val === 'object') {
    return val?.$oid || val?.id || '';
  }
  return String(val || '').trim();
}

export default function ProductsDataTable({
  data = [],
  totalRecords = 0,
  initialPage = 1,
  initialPageSize = 10,
  initialSearch = '',
  lang = 'en',
  dict,
  title,
  description,
}: ProductsDataTableProps) {
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
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isManageModalLoading, setIsManageModalLoading] = useState<boolean>(false);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

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

  // Fetch products from server action
  const fetchProducts = async (page: number, limit: number, search: string) => {
    setIsLoading(true);
    try {
      const res = await getProductListingAction({
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
        toast.error(res?.error || 'Failed to fetch products');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error fetching products');
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
        fetchProducts(1, pageSize, '');
      }
      return;
    }

    if (trimmed.length < 3) return;

    searchDebounceTimerRef.current = setTimeout(() => {
      lastSearchedQueryRef.current = trimmed;
      setCurrentPage(1);
      syncUrlParams(1, pageSize, trimmed);
      fetchProducts(1, pageSize, trimmed);
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    lastSearchedQueryRef.current = '';
    setCurrentPage(1);
    syncUrlParams(1, pageSize, '');
    fetchProducts(1, pageSize, '');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || newPage < 1) return;
    setCurrentPage(newPage);
    syncUrlParams(newPage, pageSize, searchQuery);
    fetchProducts(newPage, pageSize, searchQuery);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    syncUrlParams(1, newSize, searchQuery);
    fetchProducts(1, newSize, searchQuery);
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

      if (sortKey === 'product_name') {
        valA = extractProductName(a).toLowerCase();
        valB = extractProductName(b).toLowerCase();
      } else if (sortKey === 'country') {
        valA = extractProductCountry(a).toLowerCase();
        valB = extractProductCountry(b).toLowerCase();
      } else if (sortKey === 'hsn_code') {
        valA = extractProductHsn(a).toLowerCase();
        valB = extractProductHsn(b).toLowerCase();
      } else if (sortKey === 'category') {
        valA = extractProductCategory(a).toLowerCase();
        valB = extractProductCategory(b).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tableData, sortKey, sortDirection]);

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;
    const id = extractProductId(rowToDelete);
    if (!id) {
      toast.error('Unable to identify product to delete');
      setIsDeleteModalOpen(false);
      setRowToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteProductAction(id, lang);
      if (res && res.success) {
        toast.success(res.message || 'Product deleted successfully');
        setTableData((prev) => prev.filter((p) => extractProductId(p) !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setIsDeleteModalOpen(false);
        setRowToDelete(null);
      } else {
        toast.error(res?.message || 'Failed to delete product');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting product');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add new product click
  const handleAddNewProductClick = () => {
    setManageModalMode('add');
    setEditingProduct(null);
    setModalErrors({});
    setIsManageModalOpen(true);
  };

  // Edit product click: fetches GET /product/:id?lang_code=en&source=web with auth and displays in modal
  const handleEditClick = async (row: any) => {
    const id = extractProductId(row);
    if (!id) {
      toast.error('Unable to identify product ID');
      return;
    }

    setManageModalMode('edit');
    setLoadingProductId(id);
    setIsManageModalLoading(true);
    setModalErrors({});

    // Initial placeholder product data while authoritative API call is in flight
    setEditingProduct({
      id,
      label: extractProductName(row),
      name: extractProductName(row),
      product_name: extractProductName(row),
      hsn: extractProductHsn(row),
      hsn_code: extractProductHsn(row),
      country: extractProductCountry(row),
      category: extractProductCategory(row),
      spec: row.specification || row.spec || '',
      unit_type: row.unit_type || row.unitType || (row.is_liquid ? 'liquid' : 'solid'),
      unitType: row.unit_type || row.unitType || (row.is_liquid ? 'liquid' : 'solid'),
      packings: row.packing_types || row.packings || row.packingTypes || [],
    });
    setIsManageModalOpen(true);

    try {
      const res = await getProductByIdAction(id, {
        lang,
        source: 'web',
      });

      if (res && res.success && res.data) {
        setEditingProduct(res.data);
      } else {
        toast.error(res?.message || res?.error || 'Failed to fetch product details');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error fetching product details');
    } finally {
      setIsManageModalLoading(false);
      setLoadingProductId(null);
    }
  };

  const handleSaveProduct = async (savedProd: any) => {
    setIsSavingProduct(true);
    try {
      if (manageModalMode === 'edit') {
        const productId = savedProd.id || extractProductId(editingProduct);
        if (!productId) {
          toast.error('Unable to identify product ID to update');
          setIsSavingProduct(false);
          return;
        }

        let effectiveCountryId =
          savedProd.country_id ||
          editingProduct?.country_id ||
          editingProduct?.countryId ||
          editingProduct?.raw?.country_id ||
          editingProduct?.raw?.country?.id ||
          '';

        if (!effectiveCountryId) {
          const cName = String(savedProd.country || savedProd.country_name || '').toLowerCase();
          if (cName.includes('india')) {
            effectiveCountryId = 'cm710m0og002smzt00fy4a8cg';
          }
        }

        // Build exact patch payload according to API specification
        const patchPayload = {
          category: savedProd.category || '',
          country_id: effectiveCountryId,
          hsn_code: savedProd.hsn_code || savedProd.hsn || '',
          name: savedProd.name || savedProd.product_name || '',
          packing_types: (savedProd.packing_types || []).map((pt: any) => {
            const cleanQty =
              typeof pt.quantity === 'number'
                ? pt.quantity
                : parseFloat(String(pt.quantity)) || 0;
            const uTypeUpper = String(
              pt.unit_type || pt.unitType || savedProd.unitType || 'SOLID'
            ).toUpperCase() === 'LIQUID' ? 'LIQUID' : 'SOLID';

            let cfVal = pt.conversion_factor ?? pt.conversionFactor;
            let effectiveCf: number;

            if (cfVal !== undefined && cfVal !== null && String(cfVal).trim() !== '' && !isNaN(Number(cfVal)) && Number(cfVal) > 0) {
              effectiveCf = parseFloat(Number(cfVal).toFixed(3));
            } else {
              const sibling = (savedProd.packing_types || []).find(
                (other: any) =>
                  other !== pt &&
                  (other.conversion_factor || other.conversionFactor) &&
                  parseFloat(String(other.quantity)) > 0
              );
              if (sibling) {
                const sQty = parseFloat(String(sibling.quantity));
                const sCf = Number(sibling.conversion_factor || sibling.conversionFactor);
                effectiveCf = parseFloat((cleanQty * (sCf / sQty)).toFixed(3));
              } else {
                effectiveCf = cleanQty > 0 ? parseFloat(cleanQty.toFixed(3)) : 1;
              }
            }

            if (isNaN(effectiveCf) || effectiveCf <= 0) {
              effectiveCf = cleanQty > 0 ? parseFloat(cleanQty.toFixed(3)) : 1;
            }

            const resolvedId = (pt.id && !String(pt.id).startsWith('pack-'))
              ? String(pt.id)
              : generatePackingCuid();

            const item: any = {
              id: resolvedId,
              title: String(pt.title || pt.name || '').trim(),
              quantity: cleanQty,
              conversion_factor: effectiveCf,
              unit_type: uTypeUpper,
            };

            if (uTypeUpper === 'LIQUID') {
              const d =
                typeof pt.density === 'number'
                  ? pt.density
                  : parseFloat(String(pt.density)) || 1;
              item.density = d;
              item.net_weight_kg =
                typeof pt.net_weight_kg === 'number'
                  ? pt.net_weight_kg
                  : parseFloat(String(pt.net_weight_kg || pt.netWeightKg)) || cleanQty * d;
            }

            return item;
          }),
          specifications:
            savedProd.specifications ||
            savedProd.spec ||
            savedProd.specification ||
            '',
        };

        const res = await updateProductAction(productId, patchPayload, {
          lang,
          source: 'web',
        });

        if (res && res.success) {
          toast.success(res.message || 'Product updated successfully');
          setIsManageModalOpen(false);
          setEditingProduct(null);
          setModalErrors({});
          fetchProducts(currentPage, pageSize, searchQuery);
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
                if (fKey.includes('name')) errMap.name = msg;
                else if (fKey.includes('country')) errMap.country = msg;
                else if (fKey.includes('hsn')) errMap.hsn_code = msg;
                else if (fKey.includes('category')) errMap.category = msg;
                else if (fKey.includes('spec')) errMap.specifications = msg;
                else if (
                  fKey.includes('packing') ||
                  fKey.includes('conversion_factor') ||
                  msg.toLowerCase().includes('conversion_factor') ||
                  msg.toLowerCase().includes('id should not be empty')
                ) errMap.packing_types = msg;
                else errMap[fKey || 'general'] = msg;
              }
            });
          }
          setModalErrors(errMap);

          // If there are specific input field errors, they are displayed right under the inputs.
          // ONLY trigger a toast if there is an error not mapped to any specific input field.
          const hasFieldErrors = Object.keys(errMap).some((k) => k !== 'general');
          if (!hasFieldErrors) {
            toast.error(errMap.general || res?.message || 'Failed to update product');
          }
          return res;
        }
      } else {
        // Add new product mode
        const res = await saveProductAction(savedProd);
        if (res && res.success) {
          toast.success(res.message || 'Product added successfully');
          setIsManageModalOpen(false);
          setEditingProduct(null);
          setModalErrors({});
          fetchProducts(currentPage, pageSize, searchQuery);
          return res;
        } else {
          toast.error(res?.message || 'Failed to add product');
          return res;
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving product');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-auto max-h-full relative z-10">
      {/* Table Controls Bar - Matching ConfirmationsDataTable exactly */}
      <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 border-b border-border bg-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-2.5 shrink-0 relative z-20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative w-full sm:w-64 md:w-72 shrink-0">
            <i className="fa-solid fa-magnifying-glass absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={dict?.smart_docs?.search_products || 'Search products...'}
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

        {/* Right Controls: + Add New Product Button */}
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

          {/* + Add New Product Button */}
          <button
            type="button"
            onClick={handleAddNewProductClick}
            className="h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-md bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Table Viewport - Matching ConfirmationsDataTable exactly */}
      <div className="w-full overflow-x-auto overflow-y-auto min-h-0 relative z-10 overscroll-contain flex-1">
        <table className="w-max min-w-full text-left rtl:text-right border-separate border-spacing-0 bg-card">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted text-foreground text-[13px] sm:text-[14px] font-bold uppercase tracking-wider select-none">
              {/* Product Name (Sortable) */}
              <th
                onClick={() => handleSort('product_name')}
                style={{ minWidth: '220px', width: '220px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>Product Name</span>
                  <span className="text-xs">
                    {sortKey === 'product_name' ? (
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

              {/* Country (Sortable) */}
              <th
                onClick={() => handleSort('country')}
                style={{ minWidth: '130px', width: '130px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-center whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center justify-center gap-1.5 w-full">
                  <span>Country</span>
                  <span className="text-xs">
                    {sortKey === 'country' ? (
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

              {/* HSN Code (Sortable) */}
              <th
                onClick={() => handleSort('hsn_code')}
                style={{ minWidth: '130px', width: '130px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-center whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center justify-center gap-1.5 w-full">
                  <span>HSN Code</span>
                  <span className="text-xs">
                    {sortKey === 'hsn_code' ? (
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

              {/* Category (Sortable) */}
              <th
                onClick={() => handleSort('category')}
                style={{ minWidth: '180px', width: '180px' }}
                className="px-3.5 py-2 sm:py-2.5 border-b border-border text-left rtl:text-right whitespace-nowrap bg-muted cursor-pointer hover:bg-muted/80 transition-colors select-none"
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>Category</span>
                  <span className="text-xs">
                    {sortKey === 'category' ? (
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

              {/* Actions - Tight compact width, Sticky Right */}
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
              // Shimmer Skeleton Rows matching ConfirmationsDataTable
              Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => {
                const isEven = idx % 2 === 0;
                const rowBgClass = isEven ? 'bg-table-row-even' : 'bg-table-row-odd';
                return (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-36" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-20 mx-auto" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-24 mx-auto" />
                    </td>
                    <td className={`px-3.5 py-1.5 sm:py-2 border-b border-border ${rowBgClass}`}>
                      <div className="h-4.5 bg-muted/60 rounded-md w-28" />
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
                const rowId = extractProductId(row);
                const isRowLoading = loadingProductId === rowId && Boolean(rowId);
                const pName = extractProductName(row);
                const pCountry = extractProductCountry(row);
                const pHsn = extractProductHsn(row);
                const pCategory = extractProductCategory(row);

                return (
                  <tr
                    key={rowId || index}
                    className={`group ${rowBgClass} hover:bg-table-row-hover transition-colors`}
                  >
                    {/* Product Name */}
                    <td
                      style={{ minWidth: '220px', width: '220px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="font-semibold text-foreground text-[14px] whitespace-nowrap block"
                        title={pName}
                      >
                        {pName}
                      </span>
                    </td>

                    {/* Country */}
                    <td
                      style={{ minWidth: '130px', width: '130px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-center`}
                    >
                      <span
                        className="text-[14px] text-foreground/90 whitespace-nowrap block text-center"
                        title={pCountry}
                      >
                        {pCountry}
                      </span>
                    </td>

                    {/* HSN Code */}
                    <td
                      style={{ minWidth: '130px', width: '130px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-center`}
                    >
                      <span
                        className="font-mono text-[14px] font-medium text-foreground whitespace-nowrap block text-center"
                        title={pHsn}
                      >
                        {pHsn}
                      </span>
                    </td>

                    {/* Category */}
                    <td
                      style={{ minWidth: '180px', width: '180px' }}
                      className={`px-3.5 py-1.5 sm:py-2 align-middle border-b border-border text-[13px] sm:text-[14px] ${rowBgClass} group-hover:bg-table-row-hover transition-colors text-left rtl:text-right`}
                    >
                      <span
                        className="text-[14px] text-foreground/90 whitespace-nowrap block"
                        title={pCategory}
                      >
                        {pCategory}
                      </span>
                    </td>

                    {/* Actions - Edit (Yellow) & Delete (Theme Red), exact same size */}
                    <td
                      style={{ minWidth: '76px', width: '76px' }}
                      className={`px-2 py-1.5 sm:py-2 align-middle border-b border-border text-center sticky right-0 rtl:right-auto rtl:left-0 z-10 border-l rtl:border-l-0 rtl:border-r border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.12)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] ${rowBgClass} group-hover:bg-table-row-hover transition-colors`}
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
              // Empty State matching ConfirmationsDataTable
              <tr>
                <td colSpan={5} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground text-xl">
                      <i className="fa-solid fa-boxes-stacked"></i>
                    </div>
                    <h4 className="font-bold text-foreground text-base">
                      {dict?.smart_docs?.no_products_found || 'No Products Found'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery
                        ? 'No products match your search query.'
                        : 'There are currently no products available.'}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer - Matching ConfirmationsDataTable exactly */}
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
        title={dict?.smart_docs?.delete_product || 'Delete Product'}
        description={
          rowToDelete ? (
            <span>
              Are you sure you want to delete{' '}
              <strong className="text-foreground font-semibold">
                &ldquo;{extractProductName(rowToDelete)}&rdquo;
              </strong>
              ?
            </span>
          ) : (
            'Are you sure you want to delete this product?'
          )
        }
        confirmText={dict?.smart_docs?.yes_delete || dict?.common?.delete || 'Delete Product'}
        cancelText={dict?.smart_docs?.cancel || dict?.common?.cancel || 'Cancel'}
      />

      {/* Add / Edit Product Modal */}
      <ProductManageModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false);
          setEditingProduct(null);
          setIsManageModalLoading(false);
          setLoadingProductId(null);
          setModalErrors({});
        }}
        mode={manageModalMode}
        product={editingProduct}
        onSave={handleSaveProduct}
        dict={dict}
        isLoading={isManageModalLoading}
        isSubmitting={isSavingProduct}
        externalErrors={modalErrors}
      />
    </div>
  );
}
