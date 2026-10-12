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

function formatShortDate(dStr: any): string {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return String(dStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface PaymentHistoryClientProps {
  transactions: any[];
  lang: string;
}

export default function PaymentHistoryClient({ transactions = [], lang }: PaymentHistoryClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const pageSize = 25;

  const handleDownloadInvoice = async (tx: any, fallbackId: string) => {
    // 1. If direct downloadable URL is provided
    const directUrl = tx.download || tx.download_url || tx.invoice_url || tx.invoice_pdf || tx.invoice_file || tx.receipt_url;
    if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
      window.open(directUrl, '_blank');
      return;
    }

    // 2. Extract record ID for official invoice API
    const invoiceIdentifier = tx.id || tx._id || tx.subscription_id || tx.payment_id || fallbackId;
    if (!invoiceIdentifier || invoiceIdentifier === 'N/A' || invoiceIdentifier === '-') {
      toast.error('Invoice identifier not found for this transaction.');
      return;
    }

    setDownloadingId(fallbackId);
    try {
      const res = await getSubscriptionInvoiceAction(String(invoiceIdentifier), lang);
      if (res.success && res.data?.pdf_buffer) {
        const invoiceNo = tx.invoice_id || tx.invoice_no || tx.invoiceNo || tx.invoice_number || tx.receipt_no;
        const fileName = res.data.file_name || `${invoiceNo || 'invoice'}.pdf`;
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

  // Filter transactions based on search query
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    if (!searchQuery.trim()) return transactions;

    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((tx) => {
      const txId = String(
        tx.payment_id || tx.id || tx.transaction_id || tx.subscription_id || tx.order_id || tx.reference_no || ''
      ).toLowerCase();
      const plan = String(
        tx.user_membership_history?.membership?.plan_name ||
          tx.user_membership_history?.membership?.name ||
          tx.membership_plan?.plan_name ||
          tx.plan?.name ||
          tx.plan_name ||
          tx.description ||
          tx.title ||
          ''
      ).toLowerCase();
      const method = String(
        tx.payment_gateway || tx.payment_method || tx.gateway || tx.mode || tx.type || ''
      ).toLowerCase();
      const status = String(tx.status || tx.payment_status || tx.state || '').toLowerCase();

      return txId.includes(q) || plan.includes(q) || method.includes(q) || status.includes(q);
    });
  }, [transactions, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  return (
    <div className="bg-card border border-border shadow-xs rounded-2xl overflow-hidden mt-2">
      {/* Search Bar on Right */}
      <div className="p-3.5 sm:p-4 border-b border-border flex justify-end items-center">
        <div className="relative w-full sm:w-72">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search transactions..."
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
      </div>

      {/* Desktop Table View (>= 1024px) */}
      <div className="hidden lg:block w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-[12px] uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 font-semibold">Transaction ID</th>
              <th className="px-4 py-3 font-semibold">Plan & Amount</th>
              <th className="px-4 py-3 font-semibold">Plan Period</th>
              <th className="px-4 py-3 font-semibold">Plan Type</th>
              <th className="px-4 py-3 font-semibold">Payment Method</th>
              <th className="px-4 py-3 font-semibold">Date & Time</th>
              <th className="px-4 py-3 font-semibold text-center">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedTransactions && paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((tx, i) => {
                const txId = tx.payment_id || tx.id || tx.transaction_id || tx.subscription_id || tx.order_id || tx.razorpay_payment_id || tx.razorpay_order_id || tx.paypal_order_id || tx.paypal_subscription_id || tx._id || tx.txn_id || tx.reference_no || 'N/A';
                const rawPlan = tx.user_membership_history?.membership?.plan_name || tx.user_membership_history?.membership?.name || tx.membership_plan?.plan_name || tx.membership_plan?.name || tx.membership?.plan_name || tx.membership?.name || tx.plan?.name || tx.plan?.plan_name || tx.plan_name || tx.package_name || tx.subscription?.plan_name || tx.subscription_name || tx.description || tx.title || tx.name || 'Subscription Plan';
                const amountVal = tx.amount ?? tx.paid_amount ?? tx.total_amount ?? tx.price ?? tx.inr_amount ?? tx.usd_amount;
                const curr = tx.currency || tx.currency_code || (tx.usd_amount ? 'USD' : 'INR');
                const sym = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : curr === 'EUR' ? '€' : `${curr} `;
                const amountDisplay = amountVal !== undefined && amountVal !== null ? `${sym}${Number(amountVal).toLocaleString('en-IN')}` : null;

                // Plan Period calculation
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

                // Plan Type (Monthly / Yearly / Quarterly)
                const rawDuration =
                  tx.user_membership_history?.membership_duration ||
                  tx.user_membership_history?.duration ||
                  tx.membership_duration ||
                  tx.duration ||
                  tx.plan_type ||
                  tx.planType ||
                  tx.duration_type ||
                  tx.billing_cycle ||
                  tx.interval ||
                  tx.subscription_type ||
                  (tx.is_yearly ? 'YEARLY' : tx.is_monthly ? 'MONTHLY' : '') ||
                  (typeof tx.type === 'string' && /month|year|quarter/i.test(tx.type) ? tx.type : '');

                let planType = '';
                if (rawDuration) {
                  const norm = String(rawDuration).trim().toLowerCase();
                  if (norm.includes('month')) planType = 'Monthly';
                  else if (norm.includes('year') || norm.includes('annual')) planType = 'Yearly';
                  else if (norm.includes('quarter')) planType = 'Quarterly';
                  else if (norm !== '-' && norm !== 'null' && norm !== 'undefined') {
                    planType = String(rawDuration).charAt(0).toUpperCase() + String(rawDuration).slice(1).toLowerCase();
                  }
                }

                if (!planType) {
                  if (/yearly|annual/i.test(rawPlan)) planType = 'Yearly';
                  else if (/monthly/i.test(rawPlan)) planType = 'Monthly';
                  else if (/quarterly/i.test(rawPlan)) planType = 'Quarterly';
                  else planType = 'Monthly';
                }

                const getStr = (v: any, def: string) => typeof v === 'string' ? v : (v?.name || v?.title || v?.gateway || def);
                const category = getStr(tx.payment_gateway || tx.payment_method || tx.payment_type || tx.gateway || tx.payment_mode || tx.mode || tx.type, 'Online');
                
                // Date & Time formatting
                const dateVal = tx.date || tx.transact_at || tx.transacted_at || tx.created_at || tx.createdAt || tx.payment_date || tx.timestamp || tx.updated_at || tx.updatedAt;
                let formattedDate = 'N/A';
                let formattedTime = '';
                if (dateVal) {
                  const d = new Date(dateVal);
                  if (!isNaN(d.getTime())) {
                    formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  } else {
                    formattedDate = String(dateVal);
                  }
                }

                const status = getStr(tx.status || tx.payment_status || tx.order_status || tx.state, 'SUCCESS');
                
                return (
                  <tr key={txId !== 'N/A' ? `${txId}-${i}` : i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-xs font-mono font-medium text-foreground whitespace-nowrap">
                      <span className="truncate max-w-[150px] inline-block align-bottom" title={txId}>{txId}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-bold text-foreground/90 truncate max-w-[200px]" title={rawPlan}>{rawPlan}</div>
                      {amountDisplay && (
                        <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">{amountDisplay}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                      {period !== '-' ? (
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <i className="fa-regular fa-calendar text-[11px] text-muted-foreground opacity-70"></i>
                          <span>{period}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-foreground font-medium whitespace-nowrap">
                      {planType}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-foreground font-medium whitespace-nowrap">
                      {category}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{formattedDate}</span>
                        {formattedTime && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <i className="fa-regular fa-clock text-[10px] opacity-70"></i>
                            {formattedTime}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        status.toLowerCase() === 'success' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDownloadInvoice(tx, txId)}
                        disabled={downloadingId === txId}
                        className="h-7 px-2.5 rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5 font-semibold text-[11px] shadow-2xs"
                        title="Download Official PDF Invoice"
                      >
                        {downloadingId === txId ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
                            <span>PDF...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-file-arrow-down text-[11px]"></i>
                            <span>Download</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tablet & Mobile Card View (< 1024px) */}
      <div className="block lg:hidden divide-y divide-border">
        {paginatedTransactions && paginatedTransactions.length > 0 ? (
          paginatedTransactions.map((tx, i) => {
            const txId = tx.payment_id || tx.id || tx.transaction_id || tx.subscription_id || tx.order_id || tx.razorpay_payment_id || tx.razorpay_order_id || tx.paypal_order_id || tx.paypal_subscription_id || tx._id || tx.txn_id || tx.reference_no || 'N/A';
            const rawPlan = tx.user_membership_history?.membership?.plan_name || tx.user_membership_history?.membership?.name || tx.membership_plan?.plan_name || tx.membership_plan?.name || tx.membership?.plan_name || tx.membership?.name || tx.plan?.name || tx.plan?.plan_name || tx.plan_name || tx.package_name || tx.subscription?.plan_name || tx.subscription_name || tx.description || tx.title || tx.name || 'Subscription Plan';
            const amountVal = tx.amount ?? tx.paid_amount ?? tx.total_amount ?? tx.price ?? tx.inr_amount ?? tx.usd_amount;
            const curr = tx.currency || tx.currency_code || (tx.usd_amount ? 'USD' : 'INR');
            const sym = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : curr === 'EUR' ? '€' : `${curr} `;
            const amountDisplay = amountVal !== undefined && amountVal !== null ? `${sym}${Number(amountVal).toLocaleString('en-IN')}` : null;

            // Plan Period calculation
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

            // Plan Type (Monthly / Yearly / Quarterly)
            const rawDuration =
              tx.user_membership_history?.membership_duration ||
              tx.user_membership_history?.duration ||
              tx.membership_duration ||
              tx.duration ||
              tx.plan_type ||
              tx.planType ||
              tx.duration_type ||
              tx.billing_cycle ||
              tx.interval ||
              tx.subscription_type ||
              (tx.is_yearly ? 'YEARLY' : tx.is_monthly ? 'MONTHLY' : '') ||
              (typeof tx.type === 'string' && /month|year|quarter/i.test(tx.type) ? tx.type : '');

            let planType = '';
            if (rawDuration) {
              const norm = String(rawDuration).trim().toLowerCase();
              if (norm.includes('month')) planType = 'Monthly';
              else if (norm.includes('year') || norm.includes('annual')) planType = 'Yearly';
              else if (norm.includes('quarter')) planType = 'Quarterly';
              else if (norm !== '-' && norm !== 'null' && norm !== 'undefined') {
                planType = String(rawDuration).charAt(0).toUpperCase() + String(rawDuration).slice(1).toLowerCase();
              }
            }

            if (!planType) {
              if (/yearly|annual/i.test(rawPlan)) planType = 'Yearly';
              else if (/monthly/i.test(rawPlan)) planType = 'Monthly';
              else if (/quarterly/i.test(rawPlan)) planType = 'Quarterly';
              else planType = 'Monthly';
            }

            const getStr = (v: any, def: string) => typeof v === 'string' ? v : (v?.name || v?.title || v?.gateway || def);
            const category = getStr(tx.payment_gateway || tx.payment_method || tx.payment_type || tx.gateway || tx.payment_mode || tx.mode || tx.type, 'Online');
            
            // Date & Time formatting
            const dateVal = tx.date || tx.transact_at || tx.transacted_at || tx.created_at || tx.createdAt || tx.payment_date || tx.timestamp || tx.updated_at || tx.updatedAt;
            let formattedDate = 'N/A';
            let formattedTime = '';
            if (dateVal) {
              const d = new Date(dateVal);
              if (!isNaN(d.getTime())) {
                formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              } else {
                formattedDate = String(dateVal);
              }
            }

            const status = getStr(tx.status || tx.payment_status || tx.order_status || tx.state, 'SUCCESS');

            return (
              <div key={txId !== 'N/A' ? `${txId}-${i}` : i} className="p-3.5 sm:p-4 flex flex-col gap-2.5 hover:bg-muted/10 transition-colors">
                {/* Top Row: ID & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground min-w-0">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">ID:</span>
                    <span className="truncate" title={txId}>{txId}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    status.toLowerCase() === 'success' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {status}
                  </span>
                </div>

                {/* Middle Row: Plan Name, Duration/Period, and Amount */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-foreground truncate" title={rawPlan}>
                      {rawPlan}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">{planType}</span>
                      {period !== '-' && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <i className="fa-regular fa-calendar text-[10px] opacity-70"></i>
                            <span>{period}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {amountDisplay && (
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                        {amountDisplay}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Payment Method, Date/Time & Download Action */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="font-medium text-foreground">{category}</span>
                    <span>•</span>
                    <span>{formattedDate}</span>
                    {formattedTime && (
                      <span className="hidden sm:inline-flex items-center gap-1 opacity-70">
                        ({formattedTime})
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownloadInvoice(tx, txId)}
                    disabled={downloadingId === txId}
                    className="h-7 px-2.5 rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5 font-semibold text-[11px] shadow-2xs shrink-0"
                    title="Download Official PDF Invoice"
                  >
                    {downloadingId === txId ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-file-arrow-down text-[10px]"></i>
                        <span>Download</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No transactions found
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          Showing <strong className="text-foreground">{filteredTransactions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
          <strong className="text-foreground">
            {Math.min(currentPage * pageSize, filteredTransactions.length)}
          </strong>{' '}
          of <strong className="text-foreground">{filteredTransactions.length}</strong> records
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground text-xs flex items-center gap-1"
              title="Previous Page"
            >
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
              <span>Prev</span>
            </button>
            <span className="px-2.5 py-1 text-foreground font-semibold text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg bg-background border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground text-xs flex items-center gap-1"
              title="Next Page"
            >
              <span>Next</span>
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}