'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border shadow-xl rounded-xl p-3 min-w-[140px] !opacity-100 z-50">
        {label ? <p className="text-[13px] font-bold text-muted-foreground mb-2 border-b border-border/50 pb-1">{label}</p> : null}
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
                <span className="text-[13px] font-medium text-foreground/80">
                  {entry.name}
                </span>
              </div>
              <span className="text-[13px] font-bold text-foreground">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardClientProps {
  lang: string;
  common?: any;
  transactions?: any[];
}

const categoryData = [
  { name: 'Rice', value: 45 },
  { name: 'Sugar', value: 30 },
  { name: 'Grains', value: 15 },
  { name: 'Pulses', value: 10 },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

const contractDocuments = [
  { id: '000007/SC/RI/AG/2026/A', type: 'Sales Contract', product: 'IR64 Parboiled Rice 5%', route: 'Mundra to Mombasa', date: 'Today, 10:30 AM', status: 'Requires Signature', actionReq: true, icon: 'fa-file-signature' },
  { id: '000007/SC/RI/AG/2026/B', type: 'Shipment Instruction', product: 'IR64 Parboiled Rice 5%', route: 'Kolkata to Cotonou', date: '05 Oct 2026', status: 'Input Required', actionReq: true, icon: 'fa-file-export' },
  { id: '000012/SC/SU/AG/2026', type: 'Commercial Invoice', product: 'Icumsa 145 Sugar', route: 'Brazil to Jebel Ali', date: '02 Oct 2026', status: 'Input Required', actionReq: true, icon: 'fa-file-invoice' },
  { id: '000014/SC/SU/AG/2026', type: 'Bill Of Lading', product: 'Icumsa 145 Sugar', route: 'Brazil to Bandar Abbas', date: '01 Oct 2026', status: 'Input Required', actionReq: true, icon: 'fa-ship' },
  { id: '000008/SC/RI/AG/2026', type: 'Proforma Invoice', product: 'IR64 Parboiled Rice 5%', route: 'Mundra to Bandar Abbas', date: '01 Oct 2026', status: 'Requires Signature', actionReq: true, icon: 'fa-file-invoice-dollar' },
];

const recentInquiries = [
  { id: 'INQ-5042', product: 'Indian Green Cardamom', type: 'Product', status: 'Active', date: 'Today, 10:45 AM' },
  { id: 'FRT-1021', product: 'Mundra to Jebel Ali', type: 'Freight', status: 'Pending', date: 'Yesterday, 14:20' },
  { id: 'INQ-5040', product: 'Basmati Rice 1121', type: 'Product', status: 'Closed', date: '07 Oct 2026' },
  { id: 'INQ-5039', product: 'Fresh Cavendish Bananas', type: 'Product', status: 'Active', date: '06 Oct 2026' },
];

export default function DashboardClient({ lang, common, transactions = [] }: DashboardClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  // Mocking user type for display: 'buyer' -> shows Inquiries, 'seller' -> shows Offers
  const userType = 'buyer'; 
  const displayLabel = userType === 'buyer' ? 'Inquiries' : 'Offers';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      {/* 8 KPI Cards Grid - 4 per row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Product Inquiries/Offers */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-box-open text-6xl text-blue-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-brand-blue flex items-center justify-center">
              <i className="fa-solid fa-box text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Product {displayLabel}</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">24</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Active in marketplace
            </div>
            <Link href={`/${lang}/dashboard/product-inquiries`} className="mt-3 flex items-center text-[13px] font-medium text-brand-blue hover:text-brand-blue/80 transition-colors w-fit relative z-10">
              View Details <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 2: Freight Inquiries/Offers */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-ship text-6xl text-emerald-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center">
              <i className="fa-solid fa-truck-fast text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Freight {displayLabel}</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">8</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Active logistics requests
            </div>
            <Link href={`/${lang}/dashboard/freight-inquiries`} className="mt-3 flex items-center text-[13px] font-medium text-emerald-600 dark:text-emerald-500 hover:opacity-80 transition-colors w-fit relative z-10">
              View Details <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 3: Product Watchlist */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-binoculars text-6xl text-amber-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center">
              <i className="fa-solid fa-eye text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Product Watchlist</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">15</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Tracking market prices
            </div>
            <Link href={`/${lang}/dashboard/watchlist`} className="mt-3 flex items-center text-[13px] font-medium text-amber-600 dark:text-amber-500 hover:opacity-80 transition-colors w-fit relative z-10">
              View Details <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 4: Freight Watchlist */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-map-location-dot text-6xl text-purple-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center">
              <i className="fa-solid fa-route text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Freight Watchlist</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">6</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Tracking route rates
            </div>
            <Link href={`/${lang}/dashboard/freight-watchlist`} className="mt-3 flex items-center text-[13px] font-medium text-purple-600 dark:text-purple-500 hover:opacity-80 transition-colors w-fit relative z-10">
              View Details <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 5: My Contracts */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-file-signature text-6xl text-cyan-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 flex items-center justify-center">
              <i className="fa-solid fa-file-contract text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">My Contracts</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">3</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Active Contracts
            </div>
            <Link href={`/${lang}/dashboard/contracts`} className="mt-3 flex items-center text-[13px] font-medium text-cyan-600 dark:text-cyan-500 hover:opacity-80 transition-colors w-fit relative z-10">
              View Details <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 6: Smart Docs */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-list-check text-6xl text-rose-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center">
              <i className="fa-solid fa-folder-open text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Smart Docs</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">12</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Documents Created
            </div>
            <Link href={`/${lang}/dashboard/smart-docs`} className="mt-3 flex items-center text-[13px] font-medium text-rose-600 dark:text-rose-500 hover:opacity-80 transition-colors w-fit relative z-10">
              View Details <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 7: AI Market Predictor */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-brain text-6xl text-indigo-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center">
              <i className="fa-solid fa-microchip text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">AI Predictor</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">5</h3>
            <div className="text-sm font-medium text-muted-foreground">
              New insights ready
            </div>
            <Link href={`/${lang}/dashboard/ai-predictor`} className="mt-3 flex items-center text-[13px] font-medium text-indigo-600 dark:text-indigo-500 hover:opacity-80 transition-colors w-fit relative z-10">
              View Insights <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>

        {/* Card 8: Alert Setups */}
        <div className="bg-card border border-border shadow-xs hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fa-solid fa-bell text-6xl text-orange-500"></i>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center">
              <i className="fa-solid fa-bolt text-sm"></i>
            </div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Alerts</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-foreground mb-1">3</h3>
            <div className="text-sm font-medium text-muted-foreground">
              Triggers configured
            </div>
            <Link href={`/${lang}/dashboard/alerts`} className="mt-3 flex items-center text-[13px] font-medium text-orange-600 dark:text-orange-500 hover:opacity-80 transition-colors w-fit relative z-10">
              Manage Alerts <i className="fa-solid fa-arrow-right ml-1"></i>
            </Link>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Documents & Actions */}
        <div className="lg:col-span-2 bg-card border border-border shadow-xs rounded-2xl p-5 flex flex-col min-h-[400px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-foreground">Contract Documents & Actions</h3>
              <p className="text-sm text-muted-foreground">Track required documents and pending inputs for active deals</p>
            </div>
            <Link href={`/${lang}/dashboard/contracts`} className="text-sm font-medium text-brand-blue hover:text-brand-blue/80 transition-colors bg-brand-blue/5 hover:bg-brand-blue/10 px-3 py-1.5 rounded-lg">
              View All Contracts <i className="fa-solid fa-arrow-right ml-1 text-[11px]"></i>
            </Link>
          </div>
          
          <div className="flex flex-col gap-6">
            {/* Pending Inputs & Processing */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                {contractDocuments.map((doc, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-border bg-muted/10 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-background border border-border text-muted-foreground flex items-center justify-center shrink-0">
                        <i className={`fa-solid ${doc.icon} text-lg`}></i>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h4 className="text-[14px] font-bold text-foreground">{doc.type}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            doc.status === 'Requires Signature' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                            doc.status === 'Input Required' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            doc.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="text-[12px] text-muted-foreground flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground/80">{doc.id}</span>
                          <span className="w-1 h-1 rounded-full bg-border"></span>
                          <span>{doc.product}</span>
                          <span className="w-1 h-1 rounded-full bg-border hidden sm:block"></span>
                          <span className="hidden sm:block"><i className="fa-solid fa-route text-[10px] mr-1 opacity-70"></i>{doc.route}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto">
                      {doc.actionReq ? (
                        <button className="px-4 py-1.5 rounded-md bg-brand-blue text-white text-[13px] font-semibold hover:bg-brand-blue/90 transition-colors shadow-sm">
                          Action Required
                        </button>
                      ) : (
                        <button className="px-4 py-1.5 rounded-md bg-background border border-border text-foreground hover:bg-muted text-[13px] font-medium transition-colors">
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Donut Chart: Interest Categories */}
        <div className="bg-card border border-border shadow-xs rounded-2xl p-5 flex flex-col">
          <h3 className="text-lg font-bold text-foreground mb-1">My Interests</h3>
          <p className="text-sm text-muted-foreground mb-2">Dominant product categories</p>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
                <PieChart style={{ outline: 'none' }} className="focus:outline-none">
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    style={{ outline: 'none' }}
                    className="focus:outline-none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ outline: 'none' }} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend rendered nicely below */}
            <div className="w-full mt-6 grid grid-cols-2 gap-3 px-2">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-foreground leading-tight">{entry.name}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{entry.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-card border border-border shadow-xs rounded-2xl overflow-hidden mt-2">
        <div className="p-5 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Your latest payment activities</p>
          </div>
          <Link href={`/${lang}/profile/payment-history`} className="text-sm font-medium text-brand-blue hover:text-brand-blue/80 transition-colors">
            View All <i className="fa-solid fa-arrow-right ml-1 text-[11px]"></i>
          </Link>
        </div>
        {/* Desktop Table View - No forced min-w scroll */}
        <div className="hidden sm:block w-full">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-[12px] uppercase tracking-wider border-b border-border">
                <th className="px-5 py-3 font-semibold w-[28%]">Transaction ID</th>
                <th className="px-5 py-3 font-semibold w-[28%]">Plan & Amount</th>
                <th className="px-5 py-3 font-semibold w-[18%]">Payment Method</th>
                <th className="px-5 py-3 font-semibold w-[14%]">Date</th>
                <th className="px-5 py-3 font-semibold w-[12%] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 5).map((tx, i) => {
                  const txId = tx.payment_id || tx.id || tx.transaction_id || tx.subscription_id || tx.order_id || tx.razorpay_payment_id || tx.razorpay_order_id || tx.paypal_order_id || tx.paypal_subscription_id || tx._id || tx.txn_id || tx.reference_no || 'N/A';
                  const rawPlan = tx.user_membership_history?.membership?.plan_name || tx.user_membership_history?.membership?.name || tx.membership_plan?.plan_name || tx.membership_plan?.name || tx.membership?.plan_name || tx.membership?.name || tx.plan?.name || tx.plan?.plan_name || tx.plan_name || tx.package_name || tx.subscription?.plan_name || tx.subscription_name || tx.description || tx.title || tx.name || 'Subscription Plan';
                  const amountVal = tx.amount ?? tx.paid_amount ?? tx.total_amount ?? tx.price ?? tx.inr_amount ?? tx.usd_amount;
                  const curr = tx.currency || tx.currency_code || (tx.usd_amount ? 'USD' : 'INR');
                  const sym = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : curr === 'EUR' ? '€' : `${curr} `;
                  const amountDisplay = amountVal !== undefined && amountVal !== null ? `${sym}${Number(amountVal).toLocaleString('en-IN')}` : null;
                  const requirement = amountDisplay ? `${rawPlan} (${amountDisplay})` : rawPlan;

                  const getStr = (v: any, def: string) => typeof v === 'string' ? v : (v?.name || v?.title || v?.gateway || def);
                  const category = getStr(tx.payment_gateway || tx.payment_method || tx.payment_type || tx.gateway || tx.payment_mode || tx.mode || tx.type, 'Online');
                  const dateVal = tx.date || tx.created_at || tx.createdAt || tx.payment_date || tx.timestamp || tx.updated_at || tx.updatedAt;
                  const date = dateVal ? new Date(dateVal).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                  const status = getStr(tx.status || tx.payment_status || tx.order_status || tx.state, 'SUCCESS');
                  
                  return (
                    <tr key={txId !== 'N/A' ? `${txId}-${i}` : i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 text-xs font-mono font-medium text-foreground truncate" title={txId}>{txId}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-foreground/90 truncate" title={requirement}>{requirement}</td>
                      <td className="px-5 py-3.5 text-xs">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          category.toLowerCase().includes('card') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          category.toLowerCase().includes('razor') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          category.toLowerCase().includes('paypal') ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{date}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold rounded-full ${
                          status.toLowerCase() === 'success' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-muted-foreground">
                    No recent transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View - No Horizontal Scroll */}
        <div className="block sm:hidden divide-y divide-border">
          {transactions && transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx, i) => {
              const txId = tx.payment_id || tx.id || tx.transaction_id || tx.subscription_id || tx.order_id || tx.razorpay_payment_id || tx.razorpay_order_id || tx.paypal_order_id || tx.paypal_subscription_id || tx._id || tx.txn_id || tx.reference_no || 'N/A';
              const rawPlan = tx.user_membership_history?.membership?.plan_name || tx.user_membership_history?.membership?.name || tx.membership_plan?.plan_name || tx.membership_plan?.name || tx.membership?.plan_name || tx.membership?.name || tx.plan?.name || tx.plan?.plan_name || tx.plan_name || tx.package_name || tx.subscription?.plan_name || tx.subscription_name || tx.description || tx.title || tx.name || 'Subscription Plan';
              const amountVal = tx.amount ?? tx.paid_amount ?? tx.total_amount ?? tx.price ?? tx.inr_amount ?? tx.usd_amount;
              const curr = tx.currency || tx.currency_code || (tx.usd_amount ? 'USD' : 'INR');
              const sym = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : curr === 'EUR' ? '€' : `${curr} `;
              const amountDisplay = amountVal !== undefined && amountVal !== null ? `${sym}${Number(amountVal).toLocaleString('en-IN')}` : null;
              const requirement = amountDisplay ? `${rawPlan} (${amountDisplay})` : rawPlan;

              const getStr = (v: any, def: string) => typeof v === 'string' ? v : (v?.name || v?.title || v?.gateway || def);
              const category = getStr(tx.payment_gateway || tx.payment_method || tx.payment_type || tx.gateway || tx.payment_mode || tx.mode || tx.type, 'Online');
              const dateVal = tx.date || tx.created_at || tx.createdAt || tx.payment_date || tx.timestamp || tx.updated_at || tx.updatedAt;
              const date = dateVal ? new Date(dateVal).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
              const status = getStr(tx.status || tx.payment_status || tx.order_status || tx.state, 'SUCCESS');

              return (
                <div key={txId !== 'N/A' ? `${txId}-${i}` : i} className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground truncate max-w-[200px]">{txId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      status.toLowerCase() === 'success' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-foreground">{requirement}</span>
                    <span className="text-muted-foreground">{date}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No recent transactions found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
