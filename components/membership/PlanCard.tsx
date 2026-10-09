'use client';

import React from 'react';
import type { MembershipPlan, PlanFeature } from '@/lib/api/user.service';

interface PlanCardProps {
  plan: MembershipPlan;
  billingInterval: 'monthly' | 'yearly';
  currency: 'USD' | 'INR';
  isCurrentPlan: boolean;
  userHasOtherMembership?: boolean;
  isTrialEligible?: boolean;
  onSelect: (plan: MembershipPlan) => void;
  dict?: any;
}

interface FeatureQuota {
  text: string;
  isEnabled: boolean;
  isCountable: boolean;
}

interface FeatureDetails {
  description: string;
  allowance: string;
}

/**
 * Returns formatted badge text:
 * - Not included: "Not Included"
 * - Countable: 2-digit zero-padded number (e.g. 02, 05, 10, 20) with no redundant words
 * - Non-countable / unlimited: "~"
 */
function getFeatureQuota(feature: PlanFeature): FeatureQuota {
  if (!feature.is_enabled) {
    return { text: 'Not Included', isEnabled: false, isCountable: false };
  }

  if (feature.is_countable && feature.count_limit > 0) {
    // 2-digit alignment: 1 -> "01", 2 -> "02", 5 -> "05", 10 -> "10"
    const formatted = String(feature.count_limit).padStart(2, '0');
    return {
      text: formatted,
      isEnabled: true,
      isCountable: true,
    };
  }

  return { text: '~', isEnabled: true, isCountable: false };
}

/**
 * Returns detailed descriptions and exact allowance details for the hover tooltip
 */
function getFeatureDetails(feature: PlanFeature): FeatureDetails {
  const name = feature.name.toLowerCase();

  if (name.includes('device')) {
    const devCount = feature.count_limit;
    return {
      description: 'Simultaneous account access across mobile, desktop, and tablet devices.',
      allowance: devCount === 1 ? '01 Device limit' : `${String(devCount).padStart(2, '0')} Devices limit`,
    };
  }
  if (name.includes('product') && (name.includes('favourite') || name.includes('favorite'))) {
    return {
      description: 'Bookmark commodity items to track live trade prices and real-time market movements.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Saved products`,
    };
  }
  if (name.includes('freight') && (name.includes('favourite') || name.includes('favorite'))) {
    return {
      description: 'Save key shipping routes and transport corridors for instant logistics rate tracking.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Saved corridors`,
    };
  }
  if (name.includes('ai product predict') || (name.includes('predict') && name.includes('product'))) {
    return {
      description: 'Quantitative machine learning models projecting directional commodity price trends.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} AI forecasts / mo`,
    };
  }
  if (name.includes('ai freight predict') || (name.includes('predict') && name.includes('freight'))) {
    return {
      description: 'AI predictive models analyzing freight lanes and projecting transportation costs.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Freight forecasts / mo`,
    };
  }
  if (name.includes('product chart')) {
    return {
      description: 'Technical candlestick charting with historical price averages and trend analysis.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Chart views / mo`,
    };
  }
  if (name.includes('freight chart')) {
    return {
      description: 'Historical logistics rate tracking charts across major trade transport corridors.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Freight charts / mo`,
    };
  }
  if (name.includes('product price alert') || (name.includes('alert') && name.includes('product'))) {
    return {
      description: 'Automated target price threshold notifications triggered instantly in real-time.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Price alerts / mo`,
    };
  }
  if (name.includes('freight rate alert') || (name.includes('alert') && name.includes('freight'))) {
    return {
      description: 'Instant notification triggers when container or truck freight tariffs shift.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Freight alerts / mo`,
    };
  }
  if (name.includes('inquiry & offer') || name.includes('inquiry and offer')) {
    return {
      description: 'Post verified trade inquiries and submit binding offers with verified businesses.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Trade inquiries / mo`,
    };
  }
  if (name.includes('freight inquiry')) {
    return {
      description: 'Direct freight inquiries and booking negotiations with verified transport operators.',
      allowance: `${String(feature.count_limit).padStart(2, '0')} Freight inquiries / mo`,
    };
  }
  if (name.includes('news') || name.includes('events')) {
    return {
      description: 'Curated agricultural trade news, global policy updates, and import-export crop bulletins.',
      allowance: 'Continuous market news',
    };
  }
  if (name.includes('kyc') || name.includes('verified')) {
    return {
      description: 'Official verified trader trust badge displayed on your company profile.',
      allowance: 'Verified trade status',
    };
  }
  if (name.includes('guru') || name.includes('chatbot') || name.includes('assistant')) {
    return {
      description: '24/7 AI-powered agricultural intelligence assistant for instant calculations and trade insights.',
      allowance: 'Full access',
    };
  }
  if (name.includes('download') || name.includes('report')) {
    return {
      description: 'Export comprehensive PDF commodity market intelligence and analytics reports.',
      allowance:
        feature.count_limit > 0
          ? `${String(feature.count_limit).padStart(2, '0')} Downloads / mo`
          : 'Full report access',
    };
  }
  if (name.includes('client relations') || name.includes('executive')) {
    return {
      description: 'Dedicated senior agribusiness account manager for personal trading support.',
      allowance: 'Dedicated account manager',
    };
  }
  if (name.includes('whatsapp')) {
    return {
      description: 'Daily commodity price bulletins and critical trade rate updates via WhatsApp.',
      allowance: 'WhatsApp bulletins',
    };
  }
  if (name.includes('email')) {
    return {
      description: 'Daily and weekly closing commodity market price digests delivered via email.',
      allowance: 'Email digests',
    };
  }

  return {
    description: feature.is_enabled
      ? feature.is_countable
        ? `Usage quota allowance for ${feature.name}.`
        : 'Full unrestricted access included with this plan.'
      : 'This capability is not included in this tier.',
    allowance: feature.is_countable
      ? `${String(feature.count_limit).padStart(2, '0')} Allowance`
      : 'Included',
  };
}

export default function PlanCard({
  plan,
  billingInterval,
  currency,
  isCurrentPlan,
  userHasOtherMembership = false,
  isTrialEligible = false,
  onSelect,
}: PlanCardProps) {
  const planNameLower = plan.plan_name.toLowerCase();
  const isSilver = planNameLower.includes('silver');
  const isGold = planNameLower.includes('gold');
  const isPlatinum = planNameLower.includes('platinum');

  const trialDays =
    billingInterval === 'yearly'
      ? plan.yearly_trial_days
      : plan.monthly_trial_days;
  const hasTrial = Boolean(isTrialEligible && trialDays > 0);

  const currentPrice =
    currency === 'USD'
      ? billingInterval === 'yearly'
        ? plan.yearly_usd_price
        : plan.monthly_usd_price
      : billingInterval === 'yearly'
      ? plan.yearly_inr_price
      : plan.monthly_inr_price;

  const monthlyPrice =
    currency === 'USD' ? plan.monthly_usd_price : plan.monthly_inr_price;
  const yearlyPrice =
    currency === 'USD' ? plan.yearly_usd_price : plan.yearly_inr_price;
  const currencySymbol = currency === 'USD' ? '$' : '₹';

  // Savings in yearly billing
  const annualMonthlySum = monthlyPrice * 12;
  const annualSavings = Math.max(0, annualMonthlySum - yearlyPrice);
  const monthlyEquivalent =
    billingInterval === 'yearly'
      ? currency === 'USD'
        ? (yearlyPrice / 12).toFixed(2)
        : Math.round(yearlyPrice / 12).toLocaleString()
      : null;

  // Professional safe plan titles and descriptions
  const tierCategory = isSilver
    ? 'Starter Plan'
    : isGold
    ? 'Professional Plan'
    : 'Enterprise Plan';

  const tierDescription = isSilver
    ? 'Essential commodity market access, verified inquiries, and price tracking.'
    : isGold
    ? 'AI predictive market forecasts, automated alerts, and higher trade allowances.'
    : 'Complete trade intelligence suite with senior trade relations executive support.';

  // Badges per user requirements:
  // - Gold: "Most Popular"
  // - Silver with eligible trial: "Free Trial" / "X Days Free Trial"
  // - Platinum: Clean metallic look
  const tierBadge = isGold
    ? {
        text: 'Most Popular',
        icon: 'fa-crown',
        wrapperClass:
          'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/25 border border-amber-300/60',
      }
    : hasTrial
    ? {
        text: `${trialDays} Days Free Trial`,
        icon: 'fa-gift',
        wrapperClass:
          'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white border border-emerald-400/50 font-black shadow-xs',
      }
    : null;

  // Distinct metallic colors
  const cardBorderClass = isGold
    ? 'border-amber-500/70 dark:border-amber-400/60 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/30'
    : isPlatinum
    ? 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 shadow-xl shadow-zinc-900/5 dark:shadow-black/20 ring-1 ring-zinc-300/80 dark:ring-zinc-700/80'
    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30 ring-1 ring-slate-300/70 dark:ring-slate-700/70';

  const cardBgClass = isGold
    ? 'bg-gradient-to-b from-amber-500/[0.04] via-card to-card'
    : isPlatinum
    ? 'bg-gradient-to-b from-zinc-500/[0.03] via-card to-card'
    : 'bg-gradient-to-b from-slate-500/[0.04] via-card to-card';

  // Primary Action Button styling
  const buttonClass = isCurrentPlan
    ? 'bg-muted text-muted-foreground border border-border cursor-default opacity-80'
    : isGold
    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black shadow-lg shadow-amber-500/25 active:scale-[0.98]'
    : isPlatinum
    ? 'bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-black shadow-md active:scale-[0.98]'
    : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white font-black shadow-md active:scale-[0.98]';

  // Top metallic accent ribbon
  const topGlowBar = isGold
    ? 'from-amber-400 via-yellow-300 to-amber-500'
    : isPlatinum
    ? 'from-zinc-400 via-slate-100 to-zinc-500 dark:from-zinc-400 dark:via-slate-200 dark:to-zinc-600'
    : 'from-slate-300 via-zinc-100 to-slate-400 dark:from-slate-500 dark:via-zinc-300 dark:to-slate-600';

  return (
    <div
      className={`relative rounded-3xl text-foreground border flex flex-col justify-between transition-all duration-300 hover:shadow-2xl overflow-hidden h-full w-full ${cardBorderClass} ${cardBgClass} p-4 sm:p-5`}
    >
      {/* Top Metallic Color Ribbon */}
      <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${topGlowBar}`} />

      {/* Floating Status Badge */}
      {tierBadge && (
        <div className="absolute top-3.5 right-4 z-20">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] tracking-wide uppercase ${tierBadge.wrapperClass}`}
          >
            <i className={`fa-solid ${tierBadge.icon} text-[9px]`}></i>
            {tierBadge.text}
          </span>
        </div>
      )}

      {/* Top Header & Identity */}
      <div className="w-full">
        <div className="h-11 sm:h-12 flex items-center gap-3 mb-2.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${
              isGold
                ? 'bg-gradient-to-br from-amber-400/20 via-yellow-500/15 to-amber-500/20 border-amber-400/50 text-amber-500 dark:text-amber-400'
                : isPlatinum
                ? 'bg-gradient-to-br from-zinc-200 via-slate-200 to-zinc-300 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200'
                : 'bg-gradient-to-br from-slate-100 via-zinc-200 to-slate-300 dark:from-slate-800 dark:via-zinc-700 dark:to-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
            }`}
          >
            <i
              className={`fa-solid ${
                isGold ? 'fa-crown' : isPlatinum ? 'fa-gem' : 'fa-award'
              } text-lg`}
            ></i>
          </div>

          <div className="min-w-0 pr-2">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
              {plan.plan_name}
            </h3>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
              {tierCategory}
            </span>
          </div>
        </div>

        {/* Uniform 2-line Description Area */}
        <p className="text-xs text-muted-foreground leading-snug h-9 sm:h-10 flex items-center mb-3.5">
          {tierDescription}
        </p>

        {/* Pricing Display - Synchronized Fixed Height */}
        <div className="h-[76px] p-3 sm:p-3.5 rounded-2xl bg-muted/40 border border-border/80 flex flex-col justify-center mb-4">
          {hasTrial ? (
            <div>
              <div className="flex items-baseline justify-between gap-2 leading-none">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Free Access
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 shrink-0">
                  {trialDays} Days Free
                </span>
              </div>
              <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 truncate">
                <i className="fa-solid fa-shield-halved text-[11px] shrink-0"></i>
                <span className="truncate">100% Risk-Free • No card required</span>
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-lg sm:text-xl font-black text-foreground/70">
                  {currencySymbol}
                </span>
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {currentPrice.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1">
                  /{billingInterval === 'yearly' ? 'year' : 'month'}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground w-full font-medium">
                <span className="truncate">
                  {billingInterval === 'yearly' && monthlyEquivalent ? (
                    <>
                      ≈ <strong className="text-foreground">{currencySymbol}{monthlyEquivalent}</strong>/mo billed annually
                    </>
                  ) : (
                    'Billed monthly • Cancel anytime'
                  )}
                </span>

                {billingInterval === 'yearly' && annualSavings > 0 && (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                    Save {currencySymbol}{annualSavings.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Primary Call to Action Button - Synchronized Fixed Height */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => !isCurrentPlan && onSelect(plan)}
            disabled={isCurrentPlan}
            className={`w-full h-11 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${buttonClass}`}
          >
            {isCurrentPlan ? (
              <>
                <i className="fa-solid fa-check text-xs"></i>
                <span>Current</span>
              </>
            ) : userHasOtherMembership ? (
              <>
                <span>Upgrade</span>
                <i className="fa-solid fa-arrow-up text-xs"></i>
              </>
            ) : hasTrial ? (
              <>
                <span>Start {trialDays}-Day Free Trial</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </>
            ) : (
              <>
                <span>Proceed</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </>
            )}
          </button>
        </div>

        {/* Deliverables Section - Exactly as ordered in API response */}
        <div className="pt-3.5 border-t border-border/70">
          <div className="h-6 flex items-center justify-between mb-2.5">
            <span className="text-xs sm:text-[12.5px] font-black uppercase tracking-wider text-foreground">
              {(plan.features || []).filter((f) => f.is_enabled).length} Features Included
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
              <i className="fa-solid fa-arrows-rotate text-[10px] text-emerald-500"></i>
              Monthly Reset
            </span>
          </div>

          <div className="space-y-1">
            {(plan.features || []).map((feature) => {
              const quota = getFeatureQuota(feature);
              const details = getFeatureDetails(feature);
              const featureDisplayName =
                feature.is_countable && feature.count_limit > 0
                  ? `${feature.count_limit} ${feature.name}`
                  : feature.name;

              return (
                <div
                  key={feature.id || feature.name}
                  className={`group relative hover:z-50 flex items-center justify-between gap-2.5 h-8 sm:h-[34px] px-2 -mx-2 rounded-xl transition-all duration-150 ${
                    quota.isEnabled
                      ? 'hover:bg-muted/40 text-foreground cursor-pointer'
                      : 'opacity-55 hover:opacity-85 text-muted-foreground hover:bg-muted/20 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-1 flex-1">
                    {quota.isEnabled ? (
                      <i className="fa-solid fa-check text-emerald-500 dark:text-emerald-400 text-sm sm:text-[15px] font-black shrink-0 w-4 text-left"></i>
                    ) : (
                      <i className="fa-solid fa-xmark text-muted-foreground/35 text-xs sm:text-[13px] shrink-0 w-4 text-left pl-0.5"></i>
                    )}
                    <span
                      title={featureDisplayName}
                      className={`text-[13px] sm:text-[13.5px] leading-tight truncate ${
                        quota.isEnabled
                          ? 'font-medium text-foreground/90 group-hover:text-foreground'
                          : 'text-muted-foreground/75'
                      }`}
                    >
                      {featureDisplayName}
                    </span>
                  </div>

                  <span
                    className={`font-bold px-2 py-0.5 rounded-md shrink-0 border transition-colors ${
                      quota.isCountable
                        ? 'font-mono tabular-nums text-xs min-w-[32px] text-center ' +
                          (isGold
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            : isPlatinum
                            ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                            : 'bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700')
                        : quota.isEnabled
                        ? 'font-mono text-xs font-black min-w-[32px] text-center ' +
                          (isGold
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            : isPlatinum
                            ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                            : 'bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700')
                        : 'text-[10px] sm:text-[10.5px] bg-muted/40 text-muted-foreground border-border/40'
                    }`}
                  >
                    {quota.text}
                  </span>

                  {/* Interactive Feature Detail Tooltip on Hover - Desktop Only */}
                  <div
                    role="tooltip"
                    className="pointer-events-none hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-68 sm:w-72 max-w-[calc(100%-16px)] p-3 rounded-2xl bg-zinc-900 dark:bg-black text-white border border-zinc-700/80 dark:border-zinc-800 shadow-2xl shadow-black/70 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-200 z-50"
                  >
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                        <span className="font-bold text-xs text-white truncate">
                          {feature.name}
                        </span>
                        <span
                          className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                            quota.isEnabled
                              ? isGold
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-zinc-800 text-zinc-100 border-zinc-700'
                              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
                          }`}
                        >
                          {quota.isCountable ? `Limit: ${quota.text}` : quota.isEnabled ? 'Included (~)' : 'Not Included'}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-300 leading-relaxed font-normal">
                        {details.description}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-800 text-[10px]">
                        <span className="flex items-center gap-1 font-semibold text-zinc-200">
                          <i className="fa-solid fa-arrows-rotate text-[9px] text-emerald-400"></i>
                          <span>
                            {feature.month_wise
                              ? 'Monthly Reset'
                              : feature.is_countable
                              ? 'Simultaneous Limit'
                              : 'Continuous Access'}
                          </span>
                        </span>
                        <span className={`font-semibold truncate ${quota.isEnabled ? 'text-amber-300' : 'text-zinc-400'}`}>
                          {quota.isEnabled ? details.allowance : 'Upgrade to unlock'}
                        </span>
                      </div>
                    </div>

                    {/* Caret pointing down - 100% Solid matching background */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 dark:bg-black border-b border-r border-zinc-700/80 dark:border-zinc-800 rotate-45" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

