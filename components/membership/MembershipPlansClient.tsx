'use client';

import React, { useState } from 'react';
import type { MembershipPlan } from '@/lib/api/user.service';
import PlanCard from './PlanCard';
import MembershipFaq from './MembershipFaq';
import MembershipActionModal from './MembershipActionModal';

interface MembershipPlansClientProps {
  plans: MembershipPlan[];
  lang: string;
  userProfile?: any;
  dict?: any;
}

export default function MembershipPlansClient({
  plans,
  lang,
  userProfile,
  dict,
}: MembershipPlansClientProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const currency: 'USD' | 'INR' = 'USD';
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<MembershipPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const safePlans = Array.isArray(plans) ? plans : [];
  // Sort plans by sequence (Silver: 2, Gold: 3, Platinum: 4)
  const sortedPlans = [...safePlans].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const silverPlan =
    sortedPlans.find((p) => p?.plan_name?.toLowerCase().includes('silver')) ||
    sortedPlans[0] ||
    null;
  const silverTrialDays =
    silverPlan?.yearly_trial_days || silverPlan?.monthly_trial_days || 90;

  // Determine current active plan name of the logged in user
  const userCurrentPlanName = (
    userProfile?.membership?.plan_name ||
    userProfile?.plan_name ||
    ''
  ).toLowerCase();

  const handleSelectPlan = (plan: MembershipPlan) => {
    setSelectedPlanForModal(plan);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPlanForModal(null);
  };

  return (
    <div className="w-full">
      {/* Streamlined Controls & Title - Full width aligned with category layout */}
      <div className="text-center w-full mt-1 mb-6 sm:mb-8">
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Verified commodity market intelligence, AI predictive forecasting, and direct counterparty trade network.
        </p>

        {/* Tactile Segmented Billing Cycle Switcher */}
        <div className="mt-4 flex items-center justify-center">
          <div className="inline-flex items-center p-1 bg-muted/80 rounded-2xl border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                billingInterval === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly Billing
            </button>

            <button
              type="button"
              onClick={() => setBillingInterval('yearly')}
              className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                billingInterval === 'yearly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Save 15%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Membership Plan Cards Grid - Balanced max-w-6xl container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch max-w-6xl mx-auto">
        {sortedPlans.map((plan) => {
          const isCurrentPlan =
            !!userCurrentPlanName &&
            !!plan.plan_name &&
            userCurrentPlanName.includes(plan.plan_name.toLowerCase());

          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingInterval={billingInterval}
              currency={currency}
              isCurrentPlan={isCurrentPlan}
              onSelect={handleSelectPlan}
              dict={dict}
            />
          );
        })}
      </div>

      {/* Prominent Common Line: Monthly Reset Notice */}
      <div className="mt-5 max-w-2xl mx-auto w-full">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-center shadow-xs">
          <p className="text-xs sm:text-[13px] text-muted-foreground font-medium leading-relaxed flex items-center justify-center gap-2">
            <i className="fa-solid fa-circle-info text-brand-blue text-xs sm:text-sm shrink-0"></i>
            <span>All feature quotas & limits reset monthly across both Monthly and Annual plans</span>
          </p>
        </div>
      </div>

      {/* High-Converting 100% Risk-Free Free Trial Banner - Silver Tier Theming */}
      <div className="mt-8 rounded-3xl bg-gradient-to-br from-slate-200/40 via-card to-card dark:from-slate-800/40 dark:via-card dark:to-card border border-slate-300/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-xl relative overflow-hidden w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black uppercase tracking-wider">
                <i className="fa-solid fa-gift text-[11px] text-slate-700 dark:text-slate-300"></i> {silverTrialDays}-Day Free Trial
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-foreground text-xs font-bold">
                <i className="fa-solid fa-credit-card text-[11px] text-slate-600 dark:text-slate-400"></i> No Card or Banking Details Required
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight">
              Try AgriGuru Online 100% Risk-Free for {silverTrialDays} Days
            </h3>

            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We believe in earning your trust first. We never ask for credit cards, debit cards, or banking details to start. Experience verified commodity spot rates, direct buyer/seller trade inquiries, and market analytics with zero financial commitment.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border/80 flex items-start gap-2.5 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-slate-300/60 dark:border-slate-700">
                  <i className="fa-solid fa-ban text-xs"></i>
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground">Zero Payment Info</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    No card or bank details. Zero auto-debits.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/80 flex items-start gap-2.5 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-slate-300/60 dark:border-slate-700">
                  <i className="fa-solid fa-chart-line text-xs"></i>
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground">Global Spot Rates</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    Live import-export spot prices and commodity market trends.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/80 flex items-start gap-2.5 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-slate-300/60 dark:border-slate-700">
                  <i className="fa-solid fa-bolt text-xs"></i>
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground">Instant Activation</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    Get started in 30 seconds. Cancel anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => silverPlan && handleSelectPlan(silverPlan)}
              className="py-3.5 px-6 rounded-2xl bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white dark:from-slate-200 dark:via-zinc-100 dark:to-slate-200 dark:hover:from-white dark:hover:to-slate-100 dark:text-slate-900 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 dark:shadow-slate-200/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              <i className="fa-solid fa-gift text-sm"></i>
              <span>Claim {silverTrialDays} Days Free Access</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
            <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5 justify-center">
              <i className="fa-solid fa-shield-halved text-slate-500 dark:text-slate-400 text-[10px]"></i>
              100% Risk-Free • No commitments
            </span>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Ribbon - w-full */}
      <div className="mt-6 py-3.5 px-4 rounded-xl bg-muted/30 border border-border/70 text-center w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center justify-center gap-1.5 text-foreground font-semibold text-[11px] sm:text-xs">
            <i className="fa-solid fa-chart-line text-slate-500 dark:text-slate-400 text-xs"></i>
            <span>Live Commodity Updates</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-foreground font-semibold text-[11px] sm:text-xs">
            <i className="fa-solid fa-shield-halved text-slate-500 dark:text-slate-400 text-xs"></i>
            <span>Verified Counterparties</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-foreground font-semibold text-[11px] sm:text-xs">
            <i className="fa-solid fa-bolt text-amber-500 text-xs"></i>
            <span>Instant Provisioning</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-foreground font-semibold text-[11px] sm:text-xs">
            <i className="fa-solid fa-arrows-rotate text-slate-500 dark:text-slate-400 text-xs"></i>
            <span>Cancel Anytime</span>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <MembershipFaq />

      {/* Action / Checkout Confirmation Modal */}
      <MembershipActionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        selectedPlan={selectedPlanForModal}
        billingInterval={billingInterval}
        currency={currency}
        lang={lang}
        userProfile={userProfile}
        dict={dict}
      />
    </div>
  );
}

