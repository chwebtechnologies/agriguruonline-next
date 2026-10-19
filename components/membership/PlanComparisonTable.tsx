'use client';

import React from 'react';
import type { MembershipPlan } from '@/lib/api/user.service';

interface PlanComparisonTableProps {
  plans: MembershipPlan[];
  billingInterval: 'monthly' | 'yearly';
  currency: 'USD' | 'INR';
  onSelect: (plan: MembershipPlan) => void;
  dict?: any;
}

interface FeatureGroup {
  title: string;
  icon: string;
  description: string;
  featureNames: string[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'AI & Quantitative Forecasting',
    icon: 'fa-brain',
    description: 'Machine learning directional models, price projections, and freight analytics',
    featureNames: [
      'AI Product Predict Analysis',
      'AI Freight Predict Analysis',
      'AI Guru Chatbot Assistant',
      'Download Market Reports',
    ],
  },
  {
    title: 'Trading Floor & Inquiries',
    icon: 'fa-handshake',
    description: 'Direct bilateral counterparty inquiries, offers, and favorite watchlists',
    featureNames: [
      'Inquiry & Offer Services',
      'Freight Inquiry Service',
      'Products Price Favourites',
      'Freights Rate Favourites',
      'Product Chart Price View',
      'Freight Chart Rate View',
    ],
  },
  {
    title: 'Multi-Channel Market Alerts',
    icon: 'fa-bell',
    description: 'Instant price target signals delivered to WhatsApp, Email, and mobile app',
    featureNames: [
      'Create Product Price Alert',
      'Create Freight Rate Alert',
      'WhatsApp Price Updates',
      'Email Product Price Update',
      'Agri News & Events Update',
    ],
  },
  {
    title: 'Security & Trade Management',
    icon: 'fa-user-shield',
    description: 'Verified trade status, simultaneous multi-device seats, and dedicated trade support',
    featureNames: [
      'Device Member A/c Login',
      'Verified KYC Member Tag',
      'Client Relations Executive',
    ],
  },
];

export default function PlanComparisonTable({
  plans,
  billingInterval,
  currency,
  onSelect,
  dict,
}: PlanComparisonTableProps) {
  const currencySymbol = currency === 'USD' ? '$' : '₹';

  const getFeature = (plan: MembershipPlan, featureName: string) => {
    return plan.features.find(
      (f) => f.name.toLowerCase().trim() === featureName.toLowerCase().trim()
    );
  };

  return (
    <div className="w-full mt-10 rounded-3xl bg-card border border-border shadow-xl overflow-hidden">
      {/* Table Section Header */}
      <div className="p-6 sm:p-8 border-b border-border bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-brand-blue text-xs font-bold uppercase tracking-wider mb-2">
            <i className="fa-solid fa-table-columns text-[10px]"></i>
            Full Feature Breakdown
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Compare All 18 Plan Capabilities
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            Examine exact monthly quotas, AI forecasting permissions, and trading desk allowances side-by-side.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-[11px] font-semibold text-foreground shadow-xs">
            <i className="fa-solid fa-arrows-rotate text-brand-blue text-[10px]"></i>
            Quotas refresh 1st of every month
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <i className="fa-solid fa-circle-check"></i> Included
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground/50">
            <i className="fa-solid fa-minus"></i> Not Included
          </span>
        </div>
      </div>

      {/* Overflow wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          {/* Table Header: Plans */}
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="py-5 px-6 text-xs sm:text-sm font-black uppercase tracking-wider text-muted-foreground w-[36%]">
                Feature / Service
              </th>

              {plans.map((plan) => {
                const planNameLower = plan.plan_name.toLowerCase();
                const isSilver = planNameLower.includes('silver');
                const isGold = planNameLower.includes('gold');
                const isPlatinum = planNameLower.includes('platinum');

                const price =
                  currency === 'USD'
                    ? billingInterval === 'yearly'
                      ? plan.yearly_usd_price
                      : plan.monthly_usd_price
                    : billingInterval === 'yearly'
                    ? plan.yearly_inr_price
                    : plan.monthly_inr_price;

                const trialDays =
                  billingInterval === 'yearly' ? plan.yearly_trial_days : plan.monthly_trial_days;
                const hasTrial = trialDays > 0;

                return (
                  <th
                    key={plan.id}
                    className={`py-5 px-6 text-center w-[21%] transition-colors ${
                      isGold
                        ? 'bg-amber-500/5 border-x border-amber-500/20'
                        : isPlatinum
                        ? 'bg-emerald-500/5 border-x border-emerald-500/20'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base sm:text-lg font-black text-foreground">
                          {plan.plan_name}
                        </span>
                        {isGold && (
                          <span className="w-2 h-2 rounded-full bg-amber-500" title="Most Popular" />
                        )}
                        {isPlatinum && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Full Access" />
                        )}
                      </div>

                      <span className="text-xs font-extrabold text-foreground">
                        {hasTrial ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {trialDays}d Free Trial
                          </span>
                        ) : (
                          `${currencySymbol}${price.toLocaleString()} / ${
                            billingInterval === 'yearly' ? 'yr' : 'mo'
                          }`
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => onSelect(plan)}
                        className={`mt-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                          isGold
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                            : isPlatinum
                            ? 'bg-primary-gradient hover:opacity-95 text-white shadow-xs'
                            : 'bg-foreground text-background hover:opacity-90'
                        }`}
                      >
                        {hasTrial ? 'Start Free' : 'Select'}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {FEATURE_GROUPS.map((group, groupIdx) => (
              <React.Fragment key={groupIdx}>
                {/* Section Header Row */}
                <tr className="bg-muted/50 border-y border-border">
                  <td
                    colSpan={plans.length + 1}
                    className="py-3.5 px-6 text-xs font-black uppercase tracking-wider text-foreground"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-card border border-border flex items-center justify-center text-foreground/80 text-xs">
                        <i className={`fa-solid ${group.icon}`}></i>
                      </div>
                      <span className="font-black">{group.title}</span>
                      <span className="hidden sm:inline text-[11px] font-normal text-muted-foreground ml-2">
                        — {group.description}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Feature Rows */}
                {group.featureNames.map((featureName, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="py-3.5 px-6 text-xs sm:text-sm font-semibold text-foreground">
                      {featureName}
                    </td>

                    {plans.map((plan) => {
                      const feat = getFeature(plan, featureName);
                      const isGold = plan.plan_name.toLowerCase().includes('gold');
                      const isPlatinum = plan.plan_name.toLowerCase().includes('platinum');
                      const isDevice = featureName.toLowerCase().includes('device');

                      return (
                        <td
                          key={plan.id}
                          className={`py-3.5 px-6 text-center text-xs font-bold transition-colors ${
                            isGold
                              ? 'bg-amber-500/5 border-x border-amber-500/20'
                              : isPlatinum
                              ? 'bg-emerald-500/5 border-x border-emerald-500/20'
                              : ''
                          }`}
                        >
                          {!feat || !feat.is_enabled ? (
                            <span className="text-muted-foreground/30 text-sm font-normal">
                              —
                            </span>
                          ) : feat.is_countable && feat.count_limit > 0 ? (
                            <span className="inline-block px-3 py-1 rounded-full bg-muted text-foreground border border-border/80 text-xs font-black shadow-xs">
                              {feat.count_limit}{' '}
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {isDevice ? 'Logins' : '/mo'}
                              </span>
                            </span>
                          ) : (
                            <i className="fa-solid fa-circle-check text-emerald-500 text-base"></i>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
