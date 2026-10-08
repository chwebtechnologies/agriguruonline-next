'use client';

import React from 'react';
import Link from 'next/link';
import type { MembershipPlan } from '@/lib/api/user.service';

interface MembershipActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: MembershipPlan | null;
  billingInterval: 'monthly' | 'yearly';
  currency: 'USD' | 'INR';
  lang: string;
  userProfile?: any;
  dict?: any;
}

export default function MembershipActionModal({
  isOpen,
  onClose,
  selectedPlan,
  billingInterval,
  currency,
  lang,
  userProfile,
  dict,
}: MembershipActionModalProps) {
  if (!isOpen || !selectedPlan) return null;

  const planNameLower = selectedPlan.plan_name.toLowerCase();
  const isSilver = planNameLower.includes('silver');
  const isGold = planNameLower.includes('gold');
  const isPlatinum = planNameLower.includes('platinum');

  const trialDays =
    billingInterval === 'yearly'
      ? selectedPlan.yearly_trial_days
      : selectedPlan.monthly_trial_days;
  const hasTrial = trialDays > 0;

  const price =
    currency === 'USD'
      ? billingInterval === 'yearly'
        ? selectedPlan.yearly_usd_price
        : selectedPlan.monthly_usd_price
      : billingInterval === 'yearly'
      ? selectedPlan.yearly_inr_price
      : selectedPlan.monthly_inr_price;

  const currencySymbol = currency === 'USD' ? '$' : '₹';

  // Visual tokens
  const tierBg = isGold
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
    : isPlatinum
    ? 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'
    : 'bg-muted border-border text-foreground';

  const tierIcon = isGold
    ? 'fa-crown text-amber-500'
    : isPlatinum
    ? 'fa-gem text-slate-800 dark:text-zinc-200'
    : 'fa-star text-foreground';

  const topGlowBar = isGold
    ? 'from-amber-400 via-yellow-400 to-amber-600'
    : isPlatinum
    ? 'from-slate-400 via-zinc-200 to-slate-400 dark:from-zinc-500 dark:via-slate-300 dark:to-zinc-500'
    : 'from-slate-300 via-zinc-300 to-slate-400 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700';

  const isAuthenticated = !!userProfile;
  const currentPlanName =
    userProfile?.membership?.plan_name || userProfile?.plan_name;

  const accountIdentifier =
    userProfile?.customer_id ||
    userProfile?.phone ||
    userProfile?.email ||
    'Active Member';

  const whatsappMessage = encodeURIComponent(
    `Hi AgriGuru Support, I would like to activate the ${
      selectedPlan.plan_name
    } Plan (${billingInterval.toUpperCase()} Billing - ${currency} ${price}).\nAccount: ${accountIdentifier}`
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-card text-foreground rounded-3xl border border-border shadow-2xl p-6 sm:p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Ribbon */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${topGlowBar}`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-base"></i>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-4 mb-5">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 ${tierBg}`}
          >
            <i className={`fa-solid ${tierIcon} text-2xl`}></i>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black tracking-tight text-foreground">
                {selectedPlan.plan_name} Plan
              </h3>
              {hasTrial && (
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {trialDays}d Trial
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {billingInterval === 'yearly' ? 'Annual Billing (Save 15%)' : 'Monthly Billing'} • {currency} Currency
            </p>
          </div>
        </div>

        {/* Price Breakdown Card */}
        <div className="rounded-2xl bg-muted/50 border border-border p-4 sm:p-5 mb-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              {hasTrial ? 'Initial Commitment' : 'Subscription Rate'}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-foreground">
                {hasTrial ? 'Free Access' : `${currencySymbol}${price.toLocaleString()}`}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {hasTrial
                  ? `(First ${trialDays} Days)`
                  : `/${billingInterval === 'yearly' ? 'year' : 'month'}`}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
              {hasTrial ? 'No Card Required' : 'Instant Provisioning'}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-1">
              <i className="fa-solid fa-circle-check text-[10px]"></i> 100% Risk-Free
            </span>
          </div>
        </div>

        {/* Included Features Summary */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Included in {selectedPlan.plan_name} ({(selectedPlan.features || []).filter((f) => f.is_enabled).length}):
            </p>
            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
              <i className="fa-solid fa-arrows-rotate text-[9px] text-brand-blue"></i> Monthly Refreshed Quotas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {(selectedPlan.features || [])
              .filter((f) => f.is_enabled)
              .slice(0, 6)
              .map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center gap-2 text-foreground font-medium bg-card p-2 rounded-xl border border-border/60"
                >
                  <i className="fa-solid fa-circle-check text-emerald-500 text-xs shrink-0"></i>
                  <span className="truncate">
                    {feature.name}
                    {feature.is_countable &&
                      feature.count_limit > 0 &&
                      ` (${feature.count_limit})`}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Action Buttons based on Auth State */}
        {isAuthenticated ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-card border border-border text-xs flex items-center justify-between">
              <div>
                <span className="text-muted-foreground text-[11px] block">Verified Account</span>
                <span className="font-mono font-bold text-foreground">
                  {accountIdentifier}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground text-[11px] block">Current Plan</span>
                <span className="font-bold text-brand-blue uppercase">
                  {currentPlanName || 'Standard'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={`https://wa.me/919429494294?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3.5 px-4 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <i className="fa-brands fa-whatsapp text-lg"></i>
                <span>Activate via WhatsApp</span>
              </a>

              <Link
                href={`/${lang}/contact-us?subject=Membership%20Upgrade%20${selectedPlan.plan_name}`}
                className="py-3.5 px-4 rounded-xl font-bold text-sm bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center gap-2 transition-all"
              >
                <i className="fa-solid fa-headset text-sm"></i>
                <span>Trade Support</span>
              </Link>
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              Our team verifies credentials and enables your plan immediately.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-brand-blue/10 border border-brand-blue/20 text-xs text-foreground flex items-center gap-2.5">
              <i className="fa-solid fa-circle-info text-brand-blue text-base shrink-0"></i>
              <span>
                Please sign in to connect this membership tier directly to your verified trader profile.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link
                href={`/${lang}/login?redirect=/${lang}/membership`}
                className="flex-1 py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-brand-blue to-teal-600 hover:opacity-95 text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] text-center"
              >
                <i className="fa-solid fa-right-to-bracket text-sm"></i>
                <span>Sign In to Continue</span>
              </Link>

              <Link
                href={`/${lang}/register?redirect=/${lang}/membership`}
                className="flex-1 py-3.5 px-4 rounded-xl font-bold text-sm bg-card hover:bg-muted text-foreground border border-border flex items-center justify-center gap-2 transition-all text-center"
              >
                <i className="fa-solid fa-user-plus text-sm"></i>
                <span>Create Free Account</span>
              </Link>
            </div>
          </div>
        )}

        {/* Trust Footnote */}
        <div className="mt-5 pt-3 border-t border-border/50 text-center">
          <span className="text-[10px] text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-circle-check text-[10px] text-emerald-500"></i>
            Zero Hidden Charges • Instant Activation • Cancel Anytime
          </span>
        </div>
      </div>
    </div>
  );
}
