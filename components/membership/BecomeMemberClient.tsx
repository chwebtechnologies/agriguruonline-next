'use client';

import React, { useState, useEffect, useTransition, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getStoredPlanSelection } from '@/lib/membership-storage';
import { initiateUpgradeAction } from '@/app/actions/membership';
import type { MembershipPlan, StoredPlanSelection, InitiateUpgradeResponse } from '@/lib/api/user.service';
import ConfirmationModal from './ConfirmationModal';
import ModalErrorBoundary from '@/components/ui/ModalErrorBoundary';
import SearchableCountrySelect from '@/components/ui/SearchableCountrySelect';

interface DropdownItem {
  id: string;
  name: string;
  iso2?: string;
  phone_code?: string;
  flag?: string;
}

interface BecomeMemberClientProps {
  userTypes?: DropdownItem[];
  categories?: DropdownItem[];
  countries?: DropdownItem[];
  userProfile?: any;
  plans?: MembershipPlan[];
  initialStoredPlan?: StoredPlanSelection | null;
  lang: string;
}

export default function BecomeMemberClient({
  userTypes = [],
  categories = [],
  countries = [],
  userProfile,
  plans = [],
  initialStoredPlan = null,
  lang,
}: BecomeMemberClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active plan selection state
  const [storedPlan, setStoredPlan] = useState<StoredPlanSelection | null>(initialStoredPlan);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  // Form states: 3 simple fields
  const [userTypeId, setUserTypeId] = useState<string>('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [countryId, setCountryId] = useState<string>('');
  const [countryIso, setCountryIso] = useState<string>('');

  // Category dropdown state
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [categorySearch, setCategorySearch] = useState<string>('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categorySearchInputRef = useRef<HTMLInputElement>(null);

  // Field validation errors
  const [errors, setErrors] = useState<{
    userType?: string;
    categories?: string;
    country?: string;
  }>({});

  // Confirmation modal states
  const [orderDetails, setOrderDetails] = useState<InitiateUpgradeResponse | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // Client hydration check for stored plan selection
  useEffect(() => {
    if (!storedPlan) {
      const found = getStoredPlanSelection();
      if (found) {
        setStoredPlan(found);
      }
    }
    setHasCheckedStorage(true);
  }, [storedPlan]);

  // Pre-fill user profile fields if already set on their account
  useEffect(() => {
    if (userProfile?.country_id && !countryId) {
      setCountryId(userProfile.country_id);
    }
    const profileUserTypeId =
      typeof userProfile?.user_type === 'object'
        ? userProfile?.user_type?.id
        : userProfile?.user_type;

    if (profileUserTypeId && !userTypeId) {
      setUserTypeId(profileUserTypeId);
    }
    if (
      Array.isArray(userProfile?.user_categories) &&
      userProfile.user_categories.length > 0 &&
      selectedCategoryIds.length === 0
    ) {
      setSelectedCategoryIds(
        userProfile.user_categories.map((c: any) => c.id || c.category_id).filter(Boolean)
      );
    }
  }, [userProfile, countryId, userTypeId, selectedCategoryIds.length]);

  // Synchronize country ID and country ISO code
  useEffect(() => {
    if (Array.isArray(countries) && countries.length > 0) {
      if (countryId) {
        const matched = countries.find(
          (c) => c.id === countryId || (c.iso2 && c.iso2.toUpperCase() === countryId.toUpperCase())
        );
        if (matched?.iso2) {
          setCountryIso(matched.iso2.toUpperCase());
        }
      } else {
        const targetId = userProfile?.country_id || userProfile?.country?.id;
        const matched = targetId
          ? countries.find(
              (c) => c.id === targetId || (c.iso2 && c.iso2.toUpperCase() === String(targetId).toUpperCase())
            )
          : countries.find((c) => c.iso2?.toUpperCase() === 'IN') || countries[0];

        if (matched) {
          setCountryId(matched.id);
          if (matched.iso2) setCountryIso(matched.iso2.toUpperCase());
        }
      }
    }
  }, [countries, countryId, userProfile]);

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    }
    if (isCategoryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryOpen]);

  // Auto-focus search input when category dropdown opens
  useEffect(() => {
    if (isCategoryOpen) {
      const timer = setTimeout(() => {
        categorySearchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCategoryOpen]);

  // Find active plan details
  const activePlanDetails = (plans || []).find(
    (p) =>
      p.id === storedPlan?.planId ||
      p.plan_name.toLowerCase() === storedPlan?.planName?.toLowerCase()
  );

  const trialDays =
    storedPlan?.duration === 'YEARLY'
      ? activePlanDetails?.yearly_trial_days
      : activePlanDetails?.monthly_trial_days;
  const isFreeTrial = Boolean(
    (!userProfile || userProfile.is_free_trial_applicable !== false) && trialDays && trialDays > 0
  );

  // Category search filter
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    const list = Array.isArray(categories) ? categories : [];
    if (!q) return list;
    return list.filter((c) => c && c.name && c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  // Country options for SearchableCountrySelect
  const countryOptions = useMemo(() => {
    const list = Array.isArray(countries) ? countries : [];
    return list
      .filter((c) => Boolean(c && (c.iso2 || c.id)))
      .map((c) => ({
        value: (c.iso2 || c.id || '').toUpperCase(),
        label: c.name || c.iso2 || 'Country',
      }))
      .filter((o) => Boolean(o.value));
  }, [countries]);

  const toggleCategory = (id: string) => {
    setErrors((prev) => ({ ...prev, categories: undefined }));
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllCategories = () => {
    setErrors((prev) => ({ ...prev, categories: undefined }));
    setSelectedCategoryIds(categories.map((c) => c.id));
  };

  const handleClearCategories = () => {
    setSelectedCategoryIds([]);
  };

  const handleCountryChange = (val?: string) => {
    const upper = (val || '').toUpperCase();
    setCountryIso(upper);
    setErrors((prev) => ({ ...prev, country: undefined }));

    const list = Array.isArray(countries) ? countries : [];
    const matched = list.find(
      (c) => c.iso2?.toUpperCase() === upper || c.id === val
    );
    if (matched) {
      setCountryId(matched.id);
    } else {
      setCountryId(val || '');
    }
  };

  const validateForm = () => {
    const newErrors: { userType?: string; categories?: string; country?: string } = {};

    if (!userTypeId) {
      newErrors.userType = 'Please select whether you are a Buyer or Seller.';
    }
    if (selectedCategoryIds.length === 0) {
      newErrors.categories = 'Please select at least one trade category.';
    }
    if (!countryId) {
      newErrors.country = 'Please select your operating country.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please complete all 3 required fields.');
      return;
    }

    if (!storedPlan?.planId) {
      toast.error('No membership plan selected. Please choose a plan first.');
      router.push(`/${lang}/membership`);
      return;
    }

    setIsSubmitting(true);
    try {
      const safeDuration = (String(storedPlan.duration || 'MONTHLY').toUpperCase() as 'MONTHLY' | 'YEARLY');
      const res = await initiateUpgradeAction(
        {
          membership_id: storedPlan.planId,
          membership_duration: safeDuration,
          type: 'BECOME_A_MEMBER',
        },
        lang
      );

      if (!res.success || !res.data) {
        console.error('[BecomeMemberClient] initiateUpgradeAction failed:', res);
        toast.error(res.error || 'Failed to initiate member setup. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const rawDetails = (res.data as any)?.data || res.data;
      const safeOrderDetails: InitiateUpgradeResponse = {
        ...rawDetails,
        new_membership_plan: {
          id:
            rawDetails?.new_membership_plan?.id ||
            (rawDetails as any)?.membership_id ||
            (rawDetails as any)?.id ||
            storedPlan.planId,
          plan_name:
            rawDetails?.new_membership_plan?.plan_name ||
            (rawDetails as any)?.plan_name ||
            storedPlan.planName ||
            'Selected Plan',
        },
        type: rawDetails.type || 'BECOME_A_MEMBER',
        membership_duration: (String(rawDetails.membership_duration || safeDuration).toUpperCase() as 'MONTHLY' | 'YEARLY'),
        inr_amount: Number(rawDetails.inr_amount ?? 0),
        usd_amount: Number(rawDetails.usd_amount ?? 0),
        is_free_trial_applicable: Boolean(rawDetails.is_free_trial_applicable),
        free_trial_days: rawDetails.free_trial_days || 90,
        expiry_date: rawDetails.expiry_date || '',
      };

      setOrderDetails(safeOrderDetails);
      setIsConfirmationOpen(true);
    } catch (err: any) {
      console.error('[BecomeMemberClient] Submit exception:', err);
      toast.error(err?.message || 'A network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // State: No plan selected in storage
  if (hasCheckedStorage && !storedPlan) {
    return (
      <div className="max-w-md mx-auto my-6 p-6 rounded-2xl bg-card border border-border text-center shadow-lg space-y-3">
        <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl">
          <i className="fa-solid fa-layer-group"></i>
        </div>
        <h2 className="text-xl font-black text-foreground">Select a Membership Plan First</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Please select a plan before completing your member onboarding.
        </p>
        <div className="pt-1">
          <Link
            href={`/${lang}/membership`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
          >
            <span>Browse Membership Plans</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-3.5">
      {/* Selected Plan Banner (Ultra Compact, No Extra Lines) */}
      <div className="px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-2xs flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue border border-brand-blue/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-award text-sm"></i>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs sm:text-sm font-black text-foreground">
              {storedPlan?.planName || 'Selected'} Plan
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
              {storedPlan?.duration === 'YEARLY' ? 'Annual' : 'Monthly'}
            </span>
            {isFreeTrial && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <i className="fa-solid fa-gift text-[9px]"></i>
                <span>{trialDays}-Day Free Trial</span>
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/${lang}/membership`}
          className="px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-bold text-foreground transition-all flex items-center gap-1 shrink-0"
        >
          <i className="fa-solid fa-arrows-rotate text-[10px] text-muted-foreground"></i>
          <span>Change</span>
        </Link>
      </div>

      {/* Main Streamlined Onboarding Form (3 Simple Fields, Zero Scroll Needed) */}
      <form
        onSubmit={handleSubmit}
        className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3.5 text-foreground"
      >
        <div className="border-b border-border/70 pb-2.5">
          <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
            Complete Your Trade Profile
          </h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            3 quick selections to personalize verified matching.
          </p>
        </div>

        {/* 1. Trade Role (Compact, No Icons) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1">
              <span>Trade Role</span>
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">Select whether you buy or sell</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {userTypes.map((type) => {
              const isSelected = userTypeId === type.id;

              return (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => {
                    setUserTypeId(type.id);
                    setErrors((prev) => ({ ...prev, userType: undefined }));
                  }}
                  className={`h-11 px-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between text-left font-bold text-xs sm:text-sm ${
                    isSelected
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue shadow-2xs ring-1 ring-brand-blue/20'
                      : 'border-border/70 bg-card hover:border-border hover:bg-muted/30 text-foreground/80'
                  }`}
                >
                  <span className="truncate">{type.name}</span>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ml-2 ${
                      isSelected
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-muted-foreground/30 bg-transparent'
                    }`}
                  >
                    {isSelected && <i className="fa-solid fa-check text-[8px]"></i>}
                  </div>
                </button>
              );
            })}
          </div>

          {errors.userType && (
            <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-0.5">
              <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
              <span>{errors.userType}</span>
            </p>
          )}
        </div>

        {/* 2. Commodity Categories (Single-Line Compact Dropdown) */}
        <div className="space-y-1.5 pt-2 border-t border-border/60" ref={categoryDropdownRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1">
              <span>Commodity Categories</span>
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              {selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length} selected` : 'Select categories'}
            </span>
          </div>

          {/* Searchable Multi-Select Dropdown Trigger */}
          <div className="relative">
            <div
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              className={`w-full h-11 px-3 rounded-xl bg-card border transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs ${
                errors.categories
                  ? 'border-rose-500'
                  : isCategoryOpen
                  ? 'border-brand-blue ring-2 ring-brand-blue/20'
                  : 'border-border/80 hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selectedCategoryIds.length === 0 ? (
                  <span className="text-muted-foreground text-xs sm:text-sm truncate">
                    Select commodity categories...
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                    {selectedCategoryIds.slice(0, 2).map((id) => {
                      const cat = categories.find((c) => c.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue border border-brand-blue/20 text-[11px] font-bold shrink-0 max-w-[130px]"
                        >
                          <span className="truncate">{cat?.name || id}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(id);
                            }}
                            className="text-brand-blue/60 hover:text-brand-blue cursor-pointer"
                            aria-label={`Remove ${cat?.name}`}
                          >
                            <i className="fa-solid fa-xmark text-[9px]"></i>
                          </button>
                        </span>
                      );
                    })}
                    {selectedCategoryIds.length > 2 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border text-[11px] font-bold shrink-0">
                        +{selectedCategoryIds.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <i
                className={`fa-solid fa-chevron-down text-xs text-muted-foreground transition-transform duration-200 shrink-0 ${
                  isCategoryOpen ? 'rotate-180' : ''
                }`}
              ></i>
            </div>

            {/* Dropdown Menu */}
            {isCategoryOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                {/* Search Bar */}
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"></i>
                  <input
                    ref={categorySearchInputRef}
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search categories (e.g. Rice, Pulses)..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                {/* Subheader Toolbar */}
                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span className="font-semibold text-muted-foreground">
                    {selectedCategoryIds.length} of {categories.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllCategories}
                      className="text-brand-blue hover:underline font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={handleClearCategories}
                      className="text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Category Item List */}
                <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                  {filteredCategories.map((category) => {
                    const isSelected = selectedCategoryIds.includes(category.id);

                    return (
                      <div
                        key={category.id}
                        onClick={() => toggleCategory(category.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-brand-blue/10 text-brand-blue font-semibold'
                            : 'hover:bg-muted/50 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'border-brand-blue bg-brand-blue text-white'
                                : 'border-muted-foreground/30 bg-background'
                            }`}
                          >
                            {isSelected && <i className="fa-solid fa-check text-[8px]"></i>}
                          </div>
                          <span className="truncate">{category.name}</span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredCategories.length === 0 && (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No matching categories found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {errors.categories && (
            <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-0.5">
              <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
              <span>{errors.categories}</span>
            </p>
          )}
        </div>

        {/* 3. Operating Country */}
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1">
              <span>Operating Country</span>
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-muted-foreground">Primary trade jurisdiction</span>
          </div>

          <SearchableCountrySelect
            value={countryIso}
            onChange={handleCountryChange}
            options={countryOptions.length > 0 ? countryOptions : undefined}
            showDialCode={false}
            placeholder="Select your operating country..."
            className="w-full"
          />

          {errors.country && (
            <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-0.5">
              <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
              <span>{errors.country}</span>
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 px-5 rounded-xl bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
                <span>Preparing Order Details...</span>
              </>
            ) : (
              <>
                <span>Proceed to Membership Confirmation</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal Protected by ModalErrorBoundary */}
      <ModalErrorBoundary
        onError={(err) => {
          console.error('[BecomeMemberClient] ConfirmationModal render error:', err);
          toast.error(`Error opening confirmation dialog: ${err?.message || 'Unknown error'}`);
          setIsConfirmationOpen(false);
        }}
      >
        <ConfirmationModal
          isOpen={isConfirmationOpen}
          onClose={() => setIsConfirmationOpen(false)}
          orderDetails={orderDetails}
          formValues={{
            user_type: userTypeId,
            country_id: countryId,
            category: selectedCategoryIds,
          }}
          userProfile={userProfile}
          lang={lang}
        />
      </ModalErrorBoundary>
    </div>
  );
}
