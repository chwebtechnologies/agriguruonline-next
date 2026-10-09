'use client';

import React, { useState, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { MembershipPlan, InitiateUpgradeResponse } from '@/lib/api/user.service';
import { getNormalizedUserType } from '@/lib/api-utils';
import { saveStoredPlanSelection } from '@/lib/membership-storage';
import { initiateUpgradeAction } from '@/app/actions/membership';
import PlanCard from './PlanCard';
import MembershipFaq from './MembershipFaq';
import ConfirmationModal from './ConfirmationModal';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams?.get('notice');
  const [isPending, startTransition] = useTransition();

  const isRegular =
    !userProfile?.user_type ||
    getNormalizedUserType(userProfile?.user_type) === 'regular' ||
    (typeof userProfile?.user_type === 'object' &&
      userProfile?.user_type?.name?.toLowerCase() === 'regular') ||
    userProfile?.role?.name?.toLowerCase() === 'regular' ||
    userProfile?.membership?.plan_name?.toLowerCase() === 'guest' ||
    userProfile?.membership?.plan_name?.toLowerCase() === 'regular';

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const currency = 'USD';
  const [confirmationOrder, setConfirmationOrder] = useState<InitiateUpgradeResponse | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(1); // Default to Gold (center)

  const safePlans = Array.isArray(plans) ? plans : [];
  // Sort plans by sequence (Silver: 2, Gold: 3, Platinum: 4)
  const sortedPlans = [...safePlans].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const totalPlans = sortedPlans.length;

  // Touch gesture handling for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    if (touchDeltaX.current < -35 && totalPlans > 0) {
      setActiveIndex((prev) => (prev + 1) % totalPlans);
    } else if (touchDeltaX.current > 35 && totalPlans > 0) {
      setActiveIndex((prev) => (prev - 1 + totalPlans) % totalPlans);
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  // Calculates side-by-side position without any 3D overlapping stack
  const getCardTransformClass = (index: number) => {
    if (totalPlans <= 1) return 'translate-x-0 z-20 opacity-100';

    const diff = (index - activeIndex + totalPlans) % totalPlans;

    if (diff === 0) {
      return 'translate-x-0 z-20 opacity-100 pointer-events-auto';
    } else if (diff === 1 || (totalPlans === 2 && diff === 1)) {
      return 'translate-x-[calc(100%+12px)] z-10 opacity-95 scale-[0.98] cursor-pointer pointer-events-auto';
    } else {
      return '-translate-x-[calc(100%+12px)] z-10 opacity-95 scale-[0.98] cursor-pointer pointer-events-auto';
    }
  };

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

  // Free trial eligibility: Without login users (guests) OR logged-in users who are specifically eligible
  const isUserTrialEligible =
    !userProfile || Boolean(userProfile?.is_free_trial_applicable);
  const showTrialBanner = isUserTrialEligible && silverTrialDays > 0;

  const handleSelectPlan = (plan: MembershipPlan) => {
    const duration = billingInterval.toUpperCase() as 'MONTHLY' | 'YEARLY';

    // Case 1: Guest User (not logged in) -> Persist and redirect to login
    if (!userProfile) {
      saveStoredPlanSelection({
        planId: plan.id,
        planName: plan.plan_name,
        duration,
      });
      toast.info('Plan selected! Please sign in to activate your membership.');
      router.push(`/${lang}/login?redirectUrl=/${lang}/become-member`);
      return;
    }

    // Case 2: Logged in as Regular user (not yet an onboarded Buyer/Seller) -> Persist and go to /become-member
    if (isRegular) {
      saveStoredPlanSelection({
        planId: plan.id,
        planName: plan.plan_name,
        duration,
      });
      router.push(`/${lang}/become-member`);
      return;
    }

    // Case 3: Already an active Buyer/Seller -> Direct Upgrade flow
    startTransition(async () => {
      try {
        const res = await initiateUpgradeAction(
          {
            membership_id: plan.id,
            membership_duration: duration,
            type: 'MEMBERSHIP_UPGRADE',
            is_free_trial_applicable: false,
          },
          lang
        );

        if (res.success && res.data) {
          const safeOrderDetails: InitiateUpgradeResponse = {
            ...res.data,
            type: res.data.type || 'MEMBERSHIP_UPGRADE',
            membership_duration: (String(res.data.membership_duration || duration).toUpperCase() as 'MONTHLY' | 'YEARLY'),
            inr_amount: Number(res.data.inr_amount ?? 0),
            usd_amount: Number(res.data.usd_amount ?? 0),
          };
          setConfirmationOrder(safeOrderDetails);
          setIsConfirmationOpen(true);
        } else {
          const errMsg = res.error || '';
          if (/already\s*(active|subscribed|have)|same\s*plan|current\s*plan/i.test(errMsg)) {
            toast.success('Your account is already active with this membership plan!');
            router.push(`/${lang}/profile`);
            router.refresh();
            return;
          }
          toast.error(res.error || 'Failed to initiate plan upgrade.');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error initiating upgrade.');
      }
    });
  };

  return (
    <div className="w-full">
      {/* Streamlined Controls & Title */}
      <div className="text-center w-full mt-1 mb-6 sm:mb-8">
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Verified commodity market intelligence, AI predictive forecasting, and direct counterparty trade network.
        </p>

        {/* Billing Cycle Switcher */}
        <div className="mt-4 flex items-center justify-center">
          {/* Monthly / Yearly Switcher */}
          <div className="inline-flex items-center p-1 bg-muted/80 rounded-2xl border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setBillingInterval('monthly')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
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
              className={`relative px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                billingInterval === 'yearly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Save 15%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE CIRCULAR CAROUSEL (Infinite loop, cards peek on both sides with zero overlap) */}
      <div className="block md:hidden w-full overflow-hidden py-2">
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="grid w-[82vw] max-w-[325px] mx-auto min-h-[660px]"
        >
          {sortedPlans.map((plan, index) => {
            const isCurrentPlan =
              !!userCurrentPlanName &&
              !!plan.plan_name &&
              userCurrentPlanName.includes(plan.plan_name.toLowerCase());

            const userHasOtherMembership =
              Boolean(userProfile && !isRegular && !!userCurrentPlanName && !isCurrentPlan);

            const planTrialDays =
              billingInterval === 'yearly' ? plan.yearly_trial_days : plan.monthly_trial_days;
            const isTrialEligible = isUserTrialEligible && planTrialDays > 0;

            const transformClass = getCardTransformClass(index);
            const isCenter = (index - activeIndex + totalPlans) % totalPlans === 0;

            return (
              <div
                key={plan.id || plan.plan_name}
                onClick={() => {
                  if (!isCenter) {
                    setActiveIndex(index);
                  }
                }}
                className={`col-start-1 row-start-1 w-full transition-transform duration-300 ease-out ${transformClass}`}
              >
                <PlanCard
                  plan={plan}
                  billingInterval={billingInterval}
                  currency={currency}
                  isCurrentPlan={isCurrentPlan}
                  userHasOtherMembership={userHasOtherMembership}
                  isTrialEligible={isTrialEligible}
                  onSelect={handleSelectPlan}
                  dict={dict}
                />
              </div>
            );
          })}
        </div>

        {/* Clean Pagination Dots */}
        <div className="flex justify-center items-center gap-2 mt-4">
          {sortedPlans.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeIndex === idx ? 'w-6 bg-brand-blue' : 'w-2 bg-muted-foreground/30'
              }`}
              aria-label={`Go to plan ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* DESKTOP GRID (Clean 3-column layout) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch max-w-6xl mx-auto">
        {sortedPlans.map((plan) => {
          const isCurrentPlan =
            !!userCurrentPlanName &&
            !!plan.plan_name &&
            userCurrentPlanName.includes(plan.plan_name.toLowerCase());

          const userHasOtherMembership =
            Boolean(userProfile && !isRegular && !!userCurrentPlanName && !isCurrentPlan);

          const planTrialDays =
            billingInterval === 'yearly' ? plan.yearly_trial_days : plan.monthly_trial_days;
          const isTrialEligible = isUserTrialEligible && planTrialDays > 0;

          return (
            <div key={plan.id || plan.plan_name} className="flex h-full">
              <PlanCard
                plan={plan}
                billingInterval={billingInterval}
                currency={currency}
                isCurrentPlan={isCurrentPlan}
                userHasOtherMembership={userHasOtherMembership}
                isTrialEligible={isTrialEligible}
                onSelect={handleSelectPlan}
                dict={dict}
              />
            </div>
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

      {/* High-Converting 100% Risk-Free Free Trial Banner - Only for unauthenticated users or trial-eligible members */}
      {showTrialBanner && (
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
      )}

      {/* Trust & Guarantee Ribbon */}
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

      {/* Action / Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        orderDetails={confirmationOrder}
        userProfile={userProfile}
        lang={lang}
      />
    </div>
  );
}
