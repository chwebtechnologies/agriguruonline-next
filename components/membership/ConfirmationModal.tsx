'use client';

import React, { useEffect, useState, useTransition, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useScrollLock } from '@/lib/scroll-lock';
import { clearStoredPlanSelection } from '@/lib/membership-storage';
import {
  startTrialAction,
  createSubscriptionAction,
  captureSubscriptionAction,
  refreshUserProfileAction,
  getCurrentUserProfileAction,
} from '@/app/actions/membership';
import type { InitiateUpgradeResponse } from '@/lib/api/user.service';

export interface OnboardingFormValues {
  user_type?: string;
  country_id?: string;
  category?: string[];
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: InitiateUpgradeResponse | null;
  formValues?: OnboardingFormValues;
  userProfile?: any;
  lang?: string;
}

/**
 * Loads Razorpay checkout.js script asynchronously if not already loaded.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay] Failed to load checkout.js script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Inner PayPal Buttons component — lives inside PayPalScriptProvider.
 * Uses a pre-fetched subscriptionId so createSubscription returns synchronously,
 * preventing PayPal from closing the popup due to async delay.
 */
function PayPalSubscriptionButtons({
  preCreatedSubscriptionId,
  onApproveCallback,
  onErrorCallback,
  onCancelCallback,
}: {
  preCreatedSubscriptionId: string;
  onApproveCallback: (subscriptionID: string, orderID: string) => Promise<void>;
  onErrorCallback: (err: any) => void;
  onCancelCallback: () => void;
}) {
  const [{ isPending: isSDKPending }] = usePayPalScriptReducer();

  if (isSDKPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <i className="fa-solid fa-circle-notch fa-spin text-sm text-[#0070ba]"></i>
        <span>Loading PayPal...</span>
      </div>
    );
  }

  return (
    <PayPalButtons
      style={{
        layout: 'vertical',
        shape: 'rect',
        color: 'blue',
        label: 'subscribe',
      }}
      createSubscription={(_data, _actions) => {
        // Synchronous return — no async call here
        // subscriptionId was pre-fetched before buttons were rendered
        return Promise.resolve(preCreatedSubscriptionId);
      }}
      onApprove={async (data, _actions) => {
        await onApproveCallback(
          data.subscriptionID || '',
          data.orderID || ''
        );
      }}
      onError={(err: any) => {
        onErrorCallback(err);
      }}
      onCancel={() => {
        onCancelCallback();
      }}
    />
  );
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  orderDetails,
  formValues,
  userProfile,
  lang = 'en',
}: ConfirmationModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [initiatingGateway, setInitiatingGateway] = useState<'paypal' | 'razorpay' | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'paypal' | 'razorpay' | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resolvedProfile, setResolvedProfile] = useState<any>(userProfile || null);
  // PayPal pre-fetched subscription ID — set before showing PayPal buttons
  const [paypalSubscriptionId, setPaypalSubscriptionId] = useState<string | null>(null);
  const [paypalLoading, setPaypalLoading] = useState(false);

  const isPayPalSandbox = process.env.NEXT_PUBLIC_PAYPAL_ENV === 'sandbox';
  const paypalClientId =
    (isPayPalSandbox
      ? process.env.NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
      : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) ||
    'AR-gOZUqUgMpOJQ2k88MHJj-cM-URgY6Y3TwYX7M39jzFXFm3IQXboVJ3fUAVMERdfy1Wjm5ZiPYOrlN';

  const paypalScriptOptions = React.useMemo(
    () => ({
      clientId: paypalClientId,
      intent: 'subscription',
      vault: true,
    }),
    [paypalClientId]
  );

  useScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync userProfile prop if changed
  useEffect(() => {
    if (userProfile) {
      setResolvedProfile(userProfile);
    }
  }, [userProfile]);

  // Reset modal state and automatically resolve user profile / phone number when opened
  useEffect(() => {
    if (isOpen) {
      setAgreedToTerms(false);
      setSelectedGateway(null);
      setInitiatingGateway(null);
      setPaypalSubscriptionId(null);
      setPaypalLoading(false);

      // Auto-resolve user details if phone number or profile is missing
      if (!resolvedProfile?.mobile_no && !resolvedProfile?.phone) {
        // Step 1: Read from user_info cookie immediately
        if (typeof document !== 'undefined') {
          const match = document.cookie.match(/user_info=([^;]+)/);
          if (match && match[1]) {
            try {
              const u = JSON.parse(decodeURIComponent(match[1]));
              if (u) {
                setResolvedProfile((prev: any) => ({ ...(prev || {}), ...u }));
              }
            } catch {}
          }
        }

        // Step 2: Fetch fresh profile directly from server
        getCurrentUserProfileAction(lang).then((res) => {
          if (res.success && res.data) {
            setResolvedProfile(res.data);
          }
        });
      }
    }
  }, [isOpen, resolvedProfile, lang]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending && !initiatingGateway) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, initiatingGateway, onClose]);

  if (!isOpen || !orderDetails || !mounted || typeof document === 'undefined') return null;

  const isFreeTrial = Boolean(orderDetails.is_free_trial_applicable);
  const planName = orderDetails.new_membership_plan?.plan_name || 'Membership Plan';
  const isYearly = String(orderDetails.membership_duration || '').toUpperCase() === 'YEARLY';
  const duration = isYearly ? 'Annual' : 'Monthly';
  const trialDays = orderDetails.free_trial_days || 90;
  const inrAmount = Number(orderDetails.inr_amount ?? 0);
  const usdAmount = Number(orderDetails.usd_amount ?? 0);
  const formattedInr = inrAmount > 0 ? inrAmount.toLocaleString() : '0';
  const formattedUsd = usdAmount > 0 ? (Number.isInteger(usdAmount) ? String(usdAmount) : usdAmount.toFixed(2)) : '0';
  const planId =
    orderDetails.new_membership_plan?.id ||
    (orderDetails as any).membership_id ||
    (orderDetails as any).id ||
    '';
  const orderType = orderDetails.type || 'BECOME_A_MEMBER';

  // Extract and format prefill user information
  const effectiveProfile = resolvedProfile || userProfile;
  const rawPhone =
    effectiveProfile?.mobile_no ||
    effectiveProfile?.phone ||
    effectiveProfile?.contact ||
    effectiveProfile?.mobile ||
    '';
  let formattedContact = rawPhone ? String(rawPhone).trim() : '';
  if (formattedContact) {
    const code = effectiveProfile?.country_code
      ? String(effectiveProfile.country_code).trim().replace(/^\+/, '')
      : '';
    if (!formattedContact.startsWith('+')) {
      if (code && !formattedContact.startsWith(code)) {
        formattedContact = `+${code}${formattedContact}`;
      }
    }
  }
  const userEmail = effectiveProfile?.email || '';
  const fullName = effectiveProfile
    ? `${effectiveProfile.first_name || ''} ${effectiveProfile.last_name || ''}`.trim() ||
      effectiveProfile.name ||
      ''
    : '';

  // Format expiry date
  let formattedExpiry = orderDetails.expiry_date || '';
  if (orderDetails.expiry_date) {
    try {
      const d = new Date(orderDetails.expiry_date);
      if (!isNaN(d.getTime())) {
        formattedExpiry = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch {
      formattedExpiry = orderDetails.expiry_date;
    }
  }

  /**
   * Unified Post-Activation Handler
   * Follows strict 4-step sequence:
   * 1. Show Success Message
   * 2. Clear Local Storage & Cookies
   * 3. Refresh User Data & notify app
   * 4. Redirect User to /profile
   */
  const handlePostActivationSuccess = async (successMessage: string) => {
    // 1. Show toast message
    toast.success(successMessage);

    // 2. Clear stored plan selection to prevent infinite redirection loops
    clearStoredPlanSelection();

    // 3. Refresh user data on server and update session cookie
    try {
      await refreshUserProfileAction(lang);
    } catch (e) {
      console.warn('[ConfirmationModal] Profile refresh warning:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-change'));
    }

    onClose();

    // 4. Redirect user to profile dashboard
    router.push(`/${lang}/profile`);
    router.refresh();
  };

  /**
   * Single-click Free Trial Activation Handler
   */
  const handleConfirmTrial = () => {
    startTransition(async () => {
      try {
        const payload: {
          membership_id: string;
          membership_duration: 'MONTHLY' | 'YEARLY';
          type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
          user_type?: string;
          country_id?: string;
          category?: string[];
        } = {
          membership_id: planId,
          membership_duration: isYearly ? 'YEARLY' : 'MONTHLY',
          type: orderType,
        };

        if (orderDetails.type === 'BECOME_A_MEMBER' && formValues) {
          if (formValues.user_type) payload.user_type = formValues.user_type;
          if (formValues.country_id) payload.country_id = formValues.country_id;
          if (Array.isArray(formValues.category) && formValues.category.length > 0) {
            payload.category = formValues.category;
          }
        }

        const result = await startTrialAction(payload, lang);

        if (!result.success) {
          toast.error(result.error || 'Failed to activate free trial. Please try again.');
          return;
        }

        await handlePostActivationSuccess(result.message || 'Free trial activated successfully!');
      } catch (err: any) {
        console.error('[ConfirmationModal] startTrial error:', err);
        toast.error(err?.message || 'Something went wrong activating free trial.');
      }
    });
  };

  /**
   * Razorpay Payment Flow (INR)
   */
  const handleSelectRazorpay = async () => {
    if (isPending || initiatingGateway) return;
    setInitiatingGateway('razorpay');

    try {
      // 1. Ensure Razorpay checkout.js script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !(window as any).Razorpay) {
        toast.error('Unable to load Razorpay payment gateway. Please check your connection.');
        setInitiatingGateway(null);
        return;
      }

      // 2. Call API 5: Create Subscription
      const res = await createSubscriptionAction(
        {
          membership_id: planId,
          membership_duration: isYearly ? 'YEARLY' : 'MONTHLY',
          payment_gateway: 'RazorPay',
          type: orderType,
          ...(orderDetails.type === 'BECOME_A_MEMBER'
            ? {
                user_type:
                  formValues?.user_type ||
                  effectiveProfile?.user_type?.id ||
                  effectiveProfile?.user_type,
                country_id:
                  formValues?.country_id || effectiveProfile?.country_id,
                category:
                  formValues?.category ||
                  (effectiveProfile?.user_categories
                    ? effectiveProfile.user_categories.map((c: any) => c.id || c)
                    : []),
              }
            : {}),
        },
        lang
      );

      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to initialize Razorpay subscription.');
        setInitiatingGateway(null);
        return;
      }

      const data = res.data;
      const subscriptionId = data.subscription_id || data.order_id || data.id;
      const keyId =
        data.key_id ||
        data.key ||
        data.razorpay_key ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        process.env.NEXT_PUBLIC_RAZORPAY_SANDBOX_KEY_ID;

      console.log('[Razorpay Debug Info]:', {
        subscriptionId,
        keyId,
        backendResponseData: data,
        planInrAmount: inrAmount,
      });

      if (!subscriptionId) {
        toast.error('No subscription ID received from payment gateway.');
        setInitiatingGateway(null);
        return;
      }

      const isOrder = String(subscriptionId).startsWith('order_');

      // 3. Launch Razorpay Checkout Popup
      const options: any = {
        key: keyId,
        name: 'AgriGuru Online',
        description: `${planName} (${duration}) - ₹${formattedInr}`,
        handler: async function (response: any) {
          try {
            setInitiatingGateway('razorpay');
            // Call API 6: Capture Subscription
            const captureRes = await captureSubscriptionAction(
              {
                order_id: response.razorpay_order_id || response.razorpay_subscription_id || subscriptionId,
                subscription_id: response.razorpay_subscription_id || response.razorpay_order_id || subscriptionId,
                payment_gateway: 'RazorPay',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              lang
            );

            if (!captureRes.success) {
              toast.error(captureRes.error || 'Payment verification failed. Please contact support.');
              setInitiatingGateway(null);
              return;
            }

            await handlePostActivationSuccess(
              captureRes.message || 'Razorpay subscription verified and activated!'
            );
          } catch (err: any) {
            toast.error(err?.message || 'Payment verification failed.');
            setInitiatingGateway(null);
          }
        },
        prefill: {
          name: fullName,
          email: userEmail,
          contact: formattedContact,
        },
        notes: {
          plan_name: planName,
          duration: isYearly ? 'YEARLY' : 'MONTHLY',
          amount_inr: String(inrAmount),
        },
        theme: {
          color: '#059669',
        },
        modal: {
          ondismiss: function () {
            setInitiatingGateway(null);
            toast.info('Razorpay payment cancelled.');
          },
        },
      };

      if (isOrder) {
        options.order_id = subscriptionId;
        options.amount = Math.round(Number(data.amount || inrAmount) * 100);
        options.currency = data.currency || 'INR';
      } else {
        options.subscription_id = subscriptionId;
      }

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', function (resp: any) {
        console.error('[Razorpay Payment Failed]:', resp.error);
        toast.error(resp.error?.description || 'Razorpay payment was not completed.');
        setInitiatingGateway(null);
      });
      rzpInstance.open();
    } catch (err: any) {
      console.error('[handleSelectRazorpay] Error:', err);
      toast.error(err?.message || 'A network error occurred while connecting to Razorpay.');
      setInitiatingGateway(null);
    }
  };

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto overscroll-contain"
      onClick={() => !isPending && !initiatingGateway && onClose()}
    >
      <div
        className="relative w-full max-w-lg bg-card text-foreground rounded-3xl border border-border shadow-2xl p-6 sm:p-7 overflow-y-auto max-h-[92vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Ribbon */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 ${
            isFreeTrial
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
              : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500'
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isPending || Boolean(initiatingGateway)}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
        >
          <i className="fa-solid fa-xmark text-base"></i>
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isFreeTrial
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-primary/10 border-primary/20 text-primary'
            }`}
          >
            <i className={`fa-solid ${isFreeTrial ? 'fa-gift' : 'fa-credit-card'} text-xl`}></i>
          </div>
          <div>
            <h3 id="confirmation-modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              {isFreeTrial ? 'Confirm Free Trial' : 'Select Payment Method'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFreeTrial
                ? 'Zero upfront cost • Instant activation'
                : 'Choose your payment option to activate your membership'}
            </p>
          </div>
        </div>

        {/* Plan Summary Card */}
        <div className="rounded-2xl bg-muted/40 border border-border/80 p-4 sm:p-5 mb-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Selected Plan
              </span>
              <span className="text-lg font-black text-foreground">{planName}</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-card border border-border text-foreground">
              {duration} Billing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">
                {isFreeTrial ? 'Trial Price' : 'Plan Price'}
              </span>
              {isFreeTrial ? (
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    Free Trial – $0
                  </span>
                </div>
              ) : (
                <div className="mt-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-foreground">${formattedUsd}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      /{isYearly ? 'yr' : 'mo'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    (₹{formattedInr} INR)
                  </span>
                </div>
              )}
            </div>

            {isFreeTrial ? (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">Trial Duration</span>
                <span className="text-sm font-black text-foreground mt-0.5 block">
                  {trialDays} Days Free Access
                </span>
              </div>
            ) : (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">Billing Cycle</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">
                  {duration} ({isYearly ? '12 Months' : '1 Month'})
                </span>
              </div>
            )}

            {formattedExpiry && (
              <div className="col-span-2 pt-2 mt-1 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Access Valid Until</span>
                <span className="text-xs font-bold text-foreground">{formattedExpiry}</span>
              </div>
            )}
          </div>
        </div>

        {/* Free Trial Flow */}
        {isFreeTrial ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
              <i className="fa-solid fa-shield-halved text-emerald-600 dark:text-emerald-400 text-base shrink-0 mt-0.5"></i>
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  No Card or Banking Details Required
                </p>
                <p className="text-emerald-700 dark:text-emerald-400/90 text-[11px] mt-0.5">
                  Your {trialDays}-day trial activates immediately. You will not be charged or auto-debited at any point.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="py-3 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmTrial}
                disabled={isPending}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
                    <span>Activating Free Trial...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check text-sm"></i>
                    <span>Confirm & Activate Free Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Paid Subscription Flow */
          <div className="space-y-4">
            {/* Terms Agreement Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60 cursor-pointer transition-colors hover:bg-muted/50">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I have read and agree to the Subscription{' '}
                <span className="text-foreground underline font-medium">Payment Terms</span> and{' '}
                <span className="text-foreground underline font-medium">Refund Policy</span> of the AgriGuru Online Platform.
              </span>
            </label>

            {/* Direct Payment Action Selection */}
            <div
              className={`space-y-3 transition-opacity duration-200 ${
                !agreedToTerms ? 'opacity-60 pointer-events-none' : 'opacity-100'
              }`}
            >
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                Choose Payment Method to Continue
              </label>

              {/* 1. PayPal (International Users - USD) */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all shadow-sm">
                {/* PayPal Select Button — pre-creates subscription before showing SDK buttons */}
                {!paypalSubscriptionId && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (paypalLoading || Boolean(initiatingGateway)) return;
                      setPaypalLoading(true);
                      setSelectedGateway('paypal');
                      try {
                        const res = await createSubscriptionAction(
                          {
                            membership_id: planId,
                            membership_duration: isYearly ? 'YEARLY' : 'MONTHLY',
                            payment_gateway: 'PayPal',
                            type: orderType,
                            ...(orderType === 'BECOME_A_MEMBER'
                              ? {
                                  user_type:
                                    formValues?.user_type ||
                                    effectiveProfile?.user_type?.id ||
                                    effectiveProfile?.user_type,
                                  country_id:
                                    formValues?.country_id || effectiveProfile?.country_id,
                                  category:
                                    formValues?.category ||
                                    (effectiveProfile?.user_categories
                                      ? effectiveProfile.user_categories.map((c: any) => c.id || c)
                                      : []),
                                }
                              : {}),
                            env: isPayPalSandbox ? 'sandbox' : 'production',
                            is_sandbox: isPayPalSandbox,
                          },
                          lang
                        );

                        if (!res.success || !res.data) {
                          toast.error(res.error || 'Failed to initialize PayPal. Please try again.');
                          setPaypalLoading(false);
                          setSelectedGateway(null);
                          return;
                        }

                        const d = res.data?.data || res.data;
                        const subscriptionId =
                          d?.subscription_id || d?.order_id || d?.id ||
                          res.data?.subscription_id || res.data?.order_id || res.data?.id;

                        console.log('[PayPal Pre-Create Debug]:', { subscriptionId, backendData: res.data });

                        if (!subscriptionId) {
                          toast.error('PayPal did not return a subscription ID. Please try again.');
                          setPaypalLoading(false);
                          setSelectedGateway(null);
                          return;
                        }

                        setPaypalSubscriptionId(subscriptionId);
                      } catch (err: any) {
                        console.error('[PayPal pre-create error]:', err);
                        toast.error(err?.message || 'Failed to connect to PayPal.');
                        setPaypalLoading(false);
                        setSelectedGateway(null);
                      }
                    }}
                    disabled={Boolean(initiatingGateway) || paypalLoading || !agreedToTerms}
                    className="w-full p-4 hover:bg-muted/50 text-left flex items-center justify-between gap-3.5 transition-colors cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-card border border-border text-foreground flex items-center justify-center shrink-0 text-2xl group-hover:scale-105 transition-transform shadow-sm">
                        {paypalLoading
                          ? <i className="fa-solid fa-circle-notch fa-spin text-lg text-[#0070ba]"></i>
                          : <i className="fa-brands fa-paypal text-[#0070ba] dark:text-[#38a3ff]"></i>
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-black text-foreground">PayPal</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-muted text-muted-foreground border border-border/50">
                            International (USD)
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground block truncate mt-0.5">
                          {paypalLoading ? 'Connecting to PayPal...' : 'Credit/Debit Cards & PayPal Wallet'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-black text-foreground block">
                        ${formattedUsd}
                      </span>
                      <span className="text-xs font-bold text-foreground flex items-center gap-1 justify-end">
                        {paypalLoading ? 'Loading...' : 'Pay with PayPal'}{' '}
                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                      </span>
                    </div>
                  </button>
                )}

                {/* PayPal SDK Buttons — shown only after subscription is pre-created */}
                {paypalSubscriptionId && (
                  <div className="p-4 border-t border-border/60 bg-muted/20 animate-in fade-in duration-200">
                    {/* Account Info */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-card border border-border/80 text-xs mb-3 shadow-2xs">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-user-check text-xs"></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-foreground block truncate">
                          {fullName || userEmail ? `${fullName || userEmail}` : 'Verified Account'}
                        </span>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                          {userEmail && <span className="truncate">{userEmail}</span>}
                          {formattedContact && (
                            <>
                              <span>•</span>
                              <span className="truncate">{formattedContact}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPaypalSubscriptionId(null); setPaypalLoading(false); setSelectedGateway(null); }}
                        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline shrink-0 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3">
                      Click the PayPal button below to complete your subscription:
                    </p>

                    {/* PayPalScriptProvider wraps only the inner buttons component */}
                    <PayPalScriptProvider options={paypalScriptOptions}>
                      <PayPalSubscriptionButtons
                        preCreatedSubscriptionId={paypalSubscriptionId}
                        onApproveCallback={async (subscriptionID, orderID) => {
                          setInitiatingGateway('paypal');
                          try {
                            const captureRes = await captureSubscriptionAction(
                              {
                                order_id: orderID || subscriptionID,
                                subscription_id: subscriptionID,
                                payment_gateway: 'PayPal',
                              },
                              lang
                            );

                            if (!captureRes.success) {
                              toast.error(captureRes.error || 'PayPal verification failed.');
                              setInitiatingGateway(null);
                              return;
                            }

                            await handlePostActivationSuccess(
                              captureRes.message || 'PayPal subscription activated successfully!'
                            );
                          } catch (err: any) {
                            console.error('[PayPal onApprove] Error:', err);
                            toast.error(err?.message || 'Payment capture failed.');
                            setInitiatingGateway(null);
                          }
                        }}
                        onErrorCallback={(err: any) => {
                          console.error('[PayPal Error]:', err);
                          const errText = err?.message || (typeof err === 'string' ? err : 'PayPal encountered an error');
                          toast.error(`PayPal Error: ${errText}`);
                          setInitiatingGateway(null);
                          setPaypalSubscriptionId(null);
                          setPaypalLoading(false);
                          setSelectedGateway(null);
                        }}
                        onCancelCallback={() => {
                          toast.info('PayPal payment was cancelled.');
                          setInitiatingGateway(null);
                          setPaypalSubscriptionId(null);
                          setPaypalLoading(false);
                          setSelectedGateway(null);
                        }}
                      />
                    </PayPalScriptProvider>
                  </div>
                )}
              </div>

              {/* 2. Razorpay (Indian Users - INR) */}
              <button
                type="button"
                onClick={handleSelectRazorpay}
                disabled={Boolean(initiatingGateway) || !agreedToTerms}
                className="w-full p-4 rounded-2xl border border-border bg-card hover:bg-muted/60 hover:border-foreground/20 text-left flex items-center justify-between gap-3.5 transition-all cursor-pointer group shadow-sm disabled:opacity-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-card border border-border text-foreground flex items-center justify-center shrink-0 text-xl group-hover:scale-105 transition-transform shadow-sm">
                    {initiatingGateway === 'razorpay' ? (
                      <i className="fa-solid fa-circle-notch fa-spin text-lg text-emerald-600"></i>
                    ) : (
                      <i className="fa-solid fa-credit-card text-emerald-600 dark:text-emerald-400"></i>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-black text-foreground">Razorpay</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-muted text-muted-foreground border border-border/50">
                        India (INR)
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground block truncate mt-0.5">
                      UPI, NetBanking, Cards {formattedContact ? `• Phone: ${formattedContact}` : ''}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base sm:text-lg font-black text-foreground block">
                    ₹{formattedInr}
                  </span>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1 justify-end group-hover:translate-x-0.5 transition-transform">
                    {initiatingGateway === 'razorpay' ? 'Loading...' : 'Pay with Razorpay'}{' '}
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </span>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={Boolean(initiatingGateway)}
                className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Security Footer */}
        <div className="mt-4 pt-3 border-t border-border/50 text-center">
          <span className="text-[11px] sm:text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-emerald-500 text-xs"></i>
            256-Bit SSL Encrypted • Instant Activation • Cancel Anytime
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
