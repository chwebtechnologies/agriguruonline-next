'use client';

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { getSubscriptionInvoiceAction } from '@/app/actions/membership';

// Helper to convert base64 PDF buffer into downloadable file in browser
function downloadPdfBuffer(pdfBuffer: string, fileName: string): boolean {
  try {
    const base64Data = pdfBuffer.includes(';base64,')
      ? pdfBuffer.split(';base64,')[1]
      : pdfBuffer;

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'invoice.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1500);
    return true;
  } catch (err) {
    console.error('Failed to parse and download PDF buffer:', err);
    return false;
  }
}

interface PaymentHistoryClientProps {
  transactions: any[];
  lang: string;
}

export default function PaymentHistoryClient({ transactions = [], lang }: PaymentHistoryClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'plan'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Normalize API data dynamically from response
  const normalizedData = useMemo(() => {
    if (!Array.isArray(transactions)) return [];

    const formatShortDate = (dStr: any) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return String(dStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    return transactions.map((tx, idx) => {
      // 1. Payment ID (Prefer payment_id; fallback to internal id)
      const paymentId =
        tx.payment_id ||
        tx.paymentId ||
        tx.id ||
        tx.transaction_id ||
        tx.subscription_id ||
        tx._id ||
        tx.txn_id ||
        '-';

      // 2. Plan Name
      const planName =
        tx.user_membership_history?.membership?.plan_name ||
        tx.user_membership_history?.membership?.name ||
        tx.membership?.plan_name ||
        tx.membership_plan?.plan_name ||
        tx.plan?.plan_name ||
        tx.plan?.name ||
        tx.plan_name ||
        tx.planName ||
        tx.package_name ||
        tx.title ||
        tx.name ||
        'Standard Plan';

      // 3. Plan Type
      const rawDuration =
        tx.user_membership_history?.membership_duration ||
        tx.membership_duration ||
        tx.plan_type ||
        tx.planType ||
        tx.type ||
        (tx.is_yearly ? 'YEARLY' : tx.is_monthly ? 'MONTHLY' : '-');

      let planType = String(rawDuration);
      if (planType.toUpperCase() === 'MONTHLY') planType = 'Monthly';
      else if (planType.toUpperCase() === 'YEARLY') planType = 'Yearly';
      else if (planType.toUpperCase() === 'QUARTERLY') planType = 'Quarterly';

      // 4. Period
      const startDateRaw = tx.user_membership_history?.start_date || tx.start_date || tx.startDate;
      const expiryDateRaw = tx.user_membership_history?.expiry_date || tx.expiry_date || tx.expiryDate || tx.valid_till;

      let period = '-';
      if (startDateRaw && expiryDateRaw) {
        period = `${formatShortDate(startDateRaw)} - ${formatShortDate(expiryDateRaw)}`;
      } else if (expiryDateRaw) {
        period = `Till ${formatShortDate(expiryDateRaw)}`;
      } else if (startDateRaw) {
        period = `From ${formatShortDate(startDateRaw)}`;
      } else if (tx.period || tx.duration || tx.validity) {
        period = String(tx.period || tx.duration || tx.validity);
      }

      // 5. Transact at
      const rawDate =
        tx.date ||
        tx.transact_at ||
        tx.transacted_at ||
        tx.payment_date ||
        tx.created_at ||
        tx.createdAt ||
        tx.timestamp;

      let transactAtFormatted = '-';
      let rawTimestamp = 0;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          rawTimestamp = d.getTime();
          transactAtFormatted = d.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        } else {
          transactAtFormatted = String(rawDate);
        }
      }

      // 6. Amount & Currency
      const numAmount = Number(
        tx.amount ?? tx.paid_amount ?? tx.total_amount ?? tx.inr_amount ?? tx.usd_amount ?? 0
      );
      const currency = String(
        tx.currency || tx.currency_code || (tx.usd_amount ? 'USD' : 'INR')
      ).toUpperCase();
      const sym =
        currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
      const rawAmountVal = tx.amount ?? tx.paid_amount ?? tx.total_amount ?? tx.inr_amount ?? tx.usd_amount;
      const amountDisplay =
        rawAmountVal !== undefined && rawAmountVal !== null
          ? `${sym}${numAmount.toLocaleString('en-IN')}`
          : '-';

      // 7. Payment (Method / Gateway & Status)
      const paymentMethod =
        tx.payment_gateway ||
        tx.payment_method ||
        tx.payment ||
        tx.gateway ||
        tx.payment_type ||
        tx.payment_mode ||
        'Online';
      const status = tx.status || tx.payment_status || tx.state || 'SUCCESS';

      // 8. Invoice No
      const invoiceNo =
        tx.invoice_id ||
        tx.invoice_no ||
        tx.invoiceNo ||
        tx.invoice_number ||
        tx.receipt_no ||
        tx.receipt ||
        '-';

      // 9. Download link/action
      const downloadUrl =
        tx.download ||
        tx.download_url ||
        tx.invoice_url ||
        tx.invoice_pdf ||
        tx.invoice_file ||
        tx.receipt_url ||
        null;
      const recordId = tx.id || tx._id || tx.subscription_id || tx.payment_id || '';

      return {
        id: `${paymentId}-${idx}`,
        recordId: String(recordId),
        paymentId: String(paymentId),
        planName: String(planName),
        planType: String(planType),
        period: String(period),
        transactAt: transactAtFormatted,
        rawTimestamp,
        amount: numAmount,
        amountDisplay,
        currency,
        sym,
        paymentMethod: String(paymentMethod),
        status: String(status),
        invoiceNo: String(invoiceNo),
        downloadUrl,
        raw: tx,
      };
    });
  }, [transactions]);

  // Overall Metrics Calculation
  const metrics = useMemo(() => {
    let totalSpent = 0;
    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let currencySym = '₹';

    normalizedData.forEach((item) => {
      const s = item.status.toLowerCase();
      if (s === 'success' || s === 'completed' || s === 'paid') {
        successCount++;
        totalSpent += item.amount;
        if (item.sym) currencySym = item.sym;
      } else if (s === 'pending') {
        pendingCount++;
      } else {
        failedCount++;
      }
    });

    const latestPlan = normalizedData.length > 0 ? normalizedData[0].planName : 'None';
    const latestDuration = normalizedData.length > 0 ? normalizedData[0].planType : '';

    return {
      totalSpent: `${currencySym}${totalSpent.toLocaleString('en-IN')}`,
      totalCount: normalizedData.length,
      successCount,
      pendingCount,
      failedCount,
      latestPlan,
      latestDuration,
    };
  }, [normalizedData]);

  // Filtering
  const filteredData = useMemo(() => {
    return normalizedData.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.paymentId.toLowerCase().includes(q) ||
          item.planName.toLowerCase().includes(q) ||
          item.planType.toLowerCase().includes(q) ||
          item.period.toLowerCase().includes(q) ||
          item.invoiceNo.toLowerCase().includes(q) ||
          item.paymentMethod.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q) ||
          item.transactAt.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (statusFilter !== 'ALL') {
        const s = item.status.toLowerCase();
        if (statusFilter === 'SUCCESS' && !(s === 'success' || s === 'completed' || s === 'paid')) return false;
        if (statusFilter === 'PENDING' && s !== 'pending') return false;
        if (statusFilter === 'FAILED' && !(s === 'failed' || s === 'cancelled' || s === 'rejected')) return false;
      }

      if (typeFilter !== 'ALL') {
        const t = item.planType.toLowerCase();
        if (typeFilter === 'MONTHLY' && !t.includes('month')) return false;
        if (typeFilter === 'YEARLY' && !t.includes('year')) return false;
      }

      return true;
    });
  }, [normalizedData, searchQuery, statusFilter, typeFilter]);

  // Sorting
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (sortField === 'date') {
        return sortOrder === 'desc' ? b.rawTimestamp - a.rawTimestamp : a.rawTimestamp - b.rawTimestamp;
      }
      if (sortField === 'amount') {
        return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
      if (sortField === 'plan') {
        return sortOrder === 'desc' ? b.planName.localeCompare(a.planName) : a.planName.localeCompare(b.planName);
      }
      return 0;
    });
  }, [filteredData, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const toggleSort = (field: 'date' | 'amount' | 'plan') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const copyPaymentId = (id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      toast.success('Payment ID copied to clipboard');
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleDownloadClick = async (item: any) => {
    // 1. If direct downloadable URL is provided
    if (item.downloadUrl && typeof item.downloadUrl === 'string' && item.downloadUrl.startsWith('http')) {
      window.open(item.downloadUrl, '_blank');
      return;
    }

    // 2. Extract record ID for official invoice API
    const invoiceIdentifier = item.recordId || item.raw?.id || item.raw?._id || item.paymentId;
    if (!invoiceIdentifier || invoiceIdentifier === '-') {
      toast.error('Invoice identifier not found for this transaction.');
      return;
    }

    setDownloadingId(item.id);
    try {
      const res = await getSubscriptionInvoiceAction(invoiceIdentifier, lang);
      if (res.success && res.data?.pdf_buffer) {
        const fileName = res.data.file_name || `${item.invoiceNo !== '-' ? item.invoiceNo : 'invoice'}.pdf`;
        const ok = downloadPdfBuffer(res.data.pdf_buffer, fileName);
        if (ok) {
          toast.success(res.message || 'Payment invoice downloaded successfully!');
        } else {
          toast.error('Unable to create PDF file. Please try again.');
        }
      } else {
        toast.error(res.error || 'Failed to generate payment invoice.');
      }
    } catch (err: any) {
      console.error('Invoice download error:', err);
      toast.error(err?.message || 'Error occurred while downloading invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 1. Quick Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Total Spent */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border/80 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Total Paid
            </span>
            <span className="text-base sm:text-lg font-extrabold text-foreground tracking-tight mt-0.5 truncate">
              {metrics.totalSpent}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-wallet text-sm"></i>
          </div>
        </div>

        {/* Card 2: Total Transactions */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border/80 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Total Invoices
            </span>
            <span className="text-base sm:text-lg font-extrabold text-foreground tracking-tight mt-0.5 truncate">
              {metrics.totalCount}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
            <i className="fa-solid fa-receipt text-sm"></i>
          </div>
        </div>

        {/* Card 3: Success Rate */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border/80 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Successful
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {metrics.successCount}
              </span>
              {metrics.totalCount > 0 && (
                <span className="text-[11px] text-muted-foreground font-medium">
                  ({Math.round((metrics.successCount / metrics.totalCount) * 100)}%)
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-circle-check text-sm"></i>
          </div>
        </div>

        {/* Card 4: Current / Latest Plan */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border/80 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Latest Plan
            </span>
            <span className="text-base sm:text-lg font-extrabold text-foreground tracking-tight mt-0.5 truncate" title={metrics.latestPlan}>
              {metrics.latestPlan}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-crown text-sm"></i>
          </div>
        </div>
      </div>

      {/* 2. Interactive Search & Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-2xs flex flex-col gap-3">
        {/* Top line: Search and quick status filter pills */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Payment ID, Plan Name, Invoice No, Date..."
              className="w-full pl-8.5 pr-8 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                title="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All ({normalizedData.length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('SUCCESS');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'SUCCESS'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              <i className="fa-solid fa-check text-[10px]"></i>
              <span>Paid ({metrics.successCount})</span>
            </button>
            {metrics.pendingCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('PENDING');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                <i className="fa-solid fa-clock text-[10px]"></i>
                <span>Pending ({metrics.pendingCount})</span>
              </button>
            )}
            {metrics.failedCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('FAILED');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === 'FAILED'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <i className="fa-solid fa-xmark text-[10px]"></i>
                <span>Failed ({metrics.failedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom line: Duration filter, sorting, and records count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Duration Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">Duration:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs bg-background border border-border rounded-lg text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
              >
                <option value="ALL">All Durations</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">Sort:</span>
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('-') as ['date' | 'amount' | 'plan', 'asc' | 'desc'];
                  setSortField(f);
                  setSortOrder(o);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs bg-background border border-border rounded-lg text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
              >
                <option value="date-desc">Newest Date First</option>
                <option value="date-asc">Oldest Date First</option>
                <option value="amount-desc">Amount: High to Low</option>
                <option value="amount-asc">Amount: Low to High</option>
                <option value="plan-asc">Plan Name (A-Z)</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {(searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTypeFilter('ALL');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs text-brand-blue hover:text-brand-blue/80 bg-brand-blue/10 rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate-left text-[10px]"></i>
                Reset Filters
              </button>
            )}
          </div>

          {/* Records badge */}
          <span className="text-[11px] font-semibold text-muted-foreground ml-auto">
            Showing <strong className="text-foreground">{sortedData.length}</strong> of{' '}
            <strong className="text-foreground">{normalizedData.length}</strong> transactions
          </span>
        </div>
      </div>

      {/* 3. Main Payment History Table & Responsive View */}
      <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
        {/* Desktop Table View (>= 1024px) - Clean, spacious, with dedicated non-truncated Download column */}
        <div className="hidden lg:block w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border select-none">
                <th className="px-3.5 py-3 font-bold w-[15%]">Payment ID</th>
                <th
                  className="px-3.5 py-3 font-bold w-[16%] cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('plan')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Plan Name</span>
                    <i
                      className={`fa-solid ${
                        sortField === 'plan'
                          ? sortOrder === 'asc'
                            ? 'fa-sort-up text-brand-blue'
                            : 'fa-sort-down text-brand-blue'
                          : 'fa-sort opacity-30'
                      } text-[10px]`}
                    ></i>
                  </div>
                </th>
                <th className="px-3 py-3 font-bold w-[9%] text-center">Type</th>
                <th className="px-3 py-3 font-bold w-[12%]">Period</th>
                <th
                  className="px-3 py-3 font-bold w-[14%] cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Transact At</span>
                    <i
                      className={`fa-solid ${
                        sortField === 'date'
                          ? sortOrder === 'asc'
                            ? 'fa-sort-up text-brand-blue'
                            : 'fa-sort-down text-brand-blue'
                          : 'fa-sort opacity-30'
                      } text-[10px]`}
                    ></i>
                  </div>
                </th>
                <th
                  className="px-3 py-3 font-bold w-[10%] cursor-pointer hover:text-foreground transition-colors text-right"
                  onClick={() => toggleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Amount</span>
                    <i
                      className={`fa-solid ${
                        sortField === 'amount'
                          ? sortOrder === 'asc'
                            ? 'fa-sort-up text-brand-blue'
                          : 'fa-sort-down text-brand-blue'
                          : 'fa-sort opacity-30'
                      } text-[10px]`}
                    ></i>
                  </div>
                </th>
                <th className="px-3.5 py-3 font-bold w-[11%]">Method & Status</th>
                <th className="px-3 py-3 font-bold w-[10%] font-mono">Invoice No</th>
                {/* Download Header: Sized comfortably so "Download" or "Invoice" never wraps or gets cut */}
                <th className="px-3.5 py-3 font-bold w-[110px] text-center whitespace-nowrap">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => {
                  const isSuccess =
                    item.status.toLowerCase() === 'success' ||
                    item.status.toLowerCase() === 'completed' ||
                    item.status.toLowerCase() === 'paid';
                  const isPending = item.status.toLowerCase() === 'pending';

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors group">
                      {/* 1. Payment ID */}
                      <td className="px-3.5 py-3.5 align-middle font-mono text-[11px] font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[130px]" title={item.paymentId}>
                            {item.paymentId}
                          </span>
                          {item.paymentId !== '-' && (
                            <button
                              onClick={() => copyPaymentId(item.paymentId)}
                              className="text-muted-foreground hover:text-brand-blue transition-colors shrink-0 p-1 rounded hover:bg-muted"
                              title="Copy Payment ID"
                            >
                              <i
                                className={`fa-solid ${
                                  copiedId === item.paymentId ? 'fa-check text-emerald-500' : 'fa-copy'
                                } text-[11px]`}
                              ></i>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 2. Plan Name */}
                      <td className="px-3.5 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-crown text-[11px]"></i>
                          </div>
                          <span className="font-bold text-foreground truncate" title={item.planName}>
                            {item.planName}
                          </span>
                        </div>
                      </td>

                      {/* 3. Plan Type */}
                      <td className="px-3 py-3.5 align-middle text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                            item.planType.toLowerCase().includes('year')
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : item.planType.toLowerCase().includes('month')
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {item.planType}
                        </span>
                      </td>

                      {/* 4. Period */}
                      <td className="px-3 py-3.5 align-middle text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-regular fa-calendar text-[10px] text-muted-foreground/70 shrink-0"></i>
                          <span className="truncate" title={item.period}>
                            {item.period}
                          </span>
                        </div>
                      </td>

                      {/* 5. Transact at */}
                      <td className="px-3 py-3.5 align-middle text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-regular fa-clock text-[10px] text-muted-foreground/70 shrink-0"></i>
                          <span className="truncate" title={item.transactAt}>
                            {item.transactAt}
                          </span>
                        </div>
                      </td>

                      {/* 6. Amount */}
                      <td className="px-3 py-3.5 align-middle text-right">
                        <span className="font-extrabold text-foreground text-sm tracking-tight">
                          {item.amountDisplay}
                        </span>
                      </td>

                      {/* 7. Payment (Method & Status) */}
                      <td className="px-3.5 py-3.5 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                            <i className="fa-solid fa-credit-card text-[10px] text-muted-foreground"></i>
                            <span className="truncate max-w-[90px]" title={item.paymentMethod}>
                              {item.paymentMethod}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-fit inline-flex items-center gap-1 ${
                              isSuccess
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : isPending
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuccess
                                  ? 'bg-emerald-500'
                                  : isPending
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-rose-500'
                              }`}
                            ></span>
                            <span>{item.status}</span>
                          </span>
                        </div>
                      </td>

                      {/* 8. Invoice No */}
                      <td className="px-3 py-3.5 align-middle font-mono text-[11px] text-muted-foreground">
                        <button
                          onClick={() => setSelectedInvoice(item)}
                          className="hover:text-brand-blue hover:underline transition-colors text-left truncate max-w-[100px] inline-block"
                          title="Click to view details"
                        >
                          {item.invoiceNo}
                        </button>
                      </td>

                      {/* 9. Download / Action - Beautiful button with clear text that NEVER cuts off */}
                      <td className="px-3.5 py-3.5 align-middle text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick View Button */}
                          <button
                            onClick={() => setSelectedInvoice(item)}
                            className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all inline-flex items-center justify-center"
                            title="View Invoice Details"
                          >
                            <i className="fa-solid fa-eye text-[11px]"></i>
                          </button>

                          {/* Direct PDF Download Action Button */}
                          <button
                            onClick={() => handleDownloadClick(item)}
                            disabled={downloadingId === item.id}
                            className="h-7 px-2.5 rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5 font-semibold text-[11px] shadow-2xs"
                            title="Download Official PDF Invoice"
                          >
                            {downloadingId === item.id ? (
                              <>
                                <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
                                <span>PDF...</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-file-arrow-down text-[11px]"></i>
                                <span>PDF</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <i className="fa-solid fa-receipt text-xl opacity-60"></i>
                      </div>
                      <span className="text-sm font-semibold text-foreground">No transactions found</span>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                          ? 'Try adjusting your search queries or active filters to find what you need.'
                          : 'You do not have any payment history records yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tablet & Mobile Card View (< 1024px) - Clean, Receipt-style layout with zero clipping */}
        <div className="block lg:hidden divide-y divide-border">
          {paginatedData.length > 0 ? (
            paginatedData.map((item) => {
              const isSuccess =
                item.status.toLowerCase() === 'success' ||
                item.status.toLowerCase() === 'completed' ||
                item.status.toLowerCase() === 'paid';
              const isPending = item.status.toLowerCase() === 'pending';

              return (
                <div key={item.id} className="p-3.5 flex flex-col gap-3 hover:bg-muted/10 transition-colors">
                  {/* Card Header: Payment ID & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">ID:</span>
                      <span className="truncate">{item.paymentId}</span>
                      {item.paymentId !== '-' && (
                        <button
                          onClick={() => copyPaymentId(item.paymentId)}
                          className="text-muted-foreground hover:text-brand-blue p-1 rounded hover:bg-muted"
                          title="Copy ID"
                        >
                          <i
                            className={`fa-solid ${
                              copiedId === item.paymentId ? 'fa-check text-emerald-500' : 'fa-copy'
                            } text-[11px]`}
                          ></i>
                        </button>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 inline-flex items-center gap-1 ${
                        isSuccess
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : isPending
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSuccess
                            ? 'bg-emerald-500'
                            : isPending
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-rose-500'
                        }`}
                      ></span>
                      <span>{item.status}</span>
                    </span>
                  </div>

                  {/* Card Body: Plan, Duration, and Amount */}
                  <div className="flex justify-between items-start gap-3 bg-muted/20 p-2.5 rounded-lg border border-border/60">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-crown text-[11px] text-brand-blue"></i>
                        <h4 className="font-bold text-sm text-foreground truncate">{item.planName}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            item.planType.toLowerCase().includes('year')
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                        >
                          {item.planType}
                        </span>
                        <span>•</span>
                        <span className="truncate">{item.period}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-base text-foreground tracking-tight">
                        {item.amountDisplay}
                      </span>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                        <i className="fa-solid fa-credit-card text-[9px]"></i>
                        <span>{item.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata and Action Buttons */}
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <div className="flex flex-col text-[11px]">
                      <span>{item.transactAt}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/80">
                        Inv: {item.invoiceNo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInvoice(item)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <i className="fa-solid fa-eye text-[10px]"></i>
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() => handleDownloadClick(item)}
                        disabled={downloadingId === item.id}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-blue hover:bg-brand-blue/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        {downloadingId === item.id ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-file-arrow-down text-[10px]"></i>
                            <span>Download Invoice</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No transactions found matching your criteria.
            </div>
          )}
        </div>

        {/* 4. Pagination Bar */}
        {sortedData.length > 0 && (
          <div className="p-3 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-foreground">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-foreground">
                  {Math.min(currentPage * pageSize, sortedData.length)}
                </strong>{' '}
                of <strong className="text-foreground">{sortedData.length}</strong>
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 px-2 py-1 bg-background border border-border rounded-lg text-xs text-foreground cursor-pointer focus:outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground"
                  title="Previous Page"
                >
                  <i className="fa-solid fa-chevron-left text-[10px]"></i>
                </button>
                <span className="px-3 py-1 text-foreground font-semibold">
                  {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground"
                  title="Next Page"
                >
                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Sleek Invoice Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                  <i className="fa-solid fa-file-invoice text-sm"></i>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Official Invoice Summary</h3>
                  <p className="text-[10px] text-muted-foreground">Receipt #{selectedInvoice.invoiceNo}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Close Modal"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
              {/* Receipt Header Banner */}
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-extrabold text-foreground tracking-tight">AgriGuru Online</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      VERIFIED
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Membership & Subscription Receipt</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-foreground">{selectedInvoice.invoiceNo}</div>
                  <div className="text-[11px] text-muted-foreground">{selectedInvoice.transactAt}</div>
                </div>
              </div>

              {/* Transaction Key-Value Details */}
              <div className="bg-muted/30 p-3.5 rounded-xl border border-border flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Payment ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground">{selectedInvoice.paymentId}</span>
                    {selectedInvoice.paymentId !== '-' && (
                      <button
                        onClick={() => copyPaymentId(selectedInvoice.paymentId)}
                        className="text-muted-foreground hover:text-brand-blue p-0.5"
                        title="Copy ID"
                      >
                        <i className="fa-solid fa-copy text-[10px]"></i>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Invoice Number:</span>
                  <span className="font-mono font-bold text-foreground">{selectedInvoice.invoiceNo}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Plan Name:</span>
                  <span className="font-bold text-foreground">{selectedInvoice.planName}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Subscription Type:</span>
                  <span className="font-semibold text-foreground">{selectedInvoice.planType}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Validity Period:</span>
                  <span className="text-foreground">{selectedInvoice.period}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Payment Gateway:</span>
                  <span className="text-foreground font-medium">{selectedInvoice.paymentMethod}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Payment Status:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[11px]">
                    {selectedInvoice.status}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-border/70 pt-2.5 mt-1">
                  <span className="text-foreground font-bold text-sm">Total Paid:</span>
                  <span className="text-foreground font-extrabold text-base tracking-tight text-emerald-600 dark:text-emerald-400">
                    {selectedInvoice.amountDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <i className="fa-solid fa-print text-xs"></i>
                <span>Print</span>
              </button>
              <button
                onClick={() => handleDownloadClick(selectedInvoice)}
                disabled={downloadingId === selectedInvoice.id}
                className="px-4 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                {downloadingId === selectedInvoice.id ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-arrow-down text-xs"></i>
                    <span>Download PDF Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}