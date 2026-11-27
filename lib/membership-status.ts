import { getNormalizedUserType } from './api-utils';

export interface MembershipStatus {
  isGuest: boolean;
  isRegisteredNonMember: boolean;
  isMember: boolean;
  buttonText: string;
  redirectUrl: string;
}

/**
 * Safely parse user_info cookie on the client side.
 */
export function getUserFromClientCookie(): any | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/user_info=([^;]+)/);
    if (match && match[1]) {
      return JSON.parse(decodeURIComponent(match[1]));
    }
  } catch (e) {
    // ignore parse error
  }
  return null;
}

/**
 * Extracts the plan name from any supported object shape
 * (membership object, membership_plan, root plan_name, etc.)
 */
export function getActiveMembershipPlanName(profile?: any): string {
  if (!profile) return '';

  const p = profile?.userProfile || profile?.user || profile?.profile || profile?.data || profile;

  // 1. Direct string plan on root
  if (typeof p?.plan === 'string' && p.plan.trim()) return p.plan.trim();
  if (typeof p?.membership === 'string' && p.membership.trim()) return p.membership.trim();
  if (typeof p?.membership_plan === 'string' && p.membership_plan.trim()) return p.membership_plan.trim();

  // 2. Resolve membership object
  const membership =
    p?.membership ||
    p?.membership_plan ||
    p?.user_membership ||
    p?.active_membership ||
    p?.current_membership ||
    (Array.isArray(p?.user_membership_history)
      ? p.user_membership_history[0]?.membership || p.user_membership_history[0]
      : p?.user_membership_history?.membership) ||
    (Array.isArray(p?.memberships) ? p.memberships[0] : undefined);

  const rawName =
    membership?.plan_name ||
    membership?.name ||
    membership?.title ||
    membership?.plan?.plan_name ||
    membership?.plan?.name ||
    p?.plan_name ||
    p?.membership_plan_name ||
    p?.membership_name ||
    p?.subscription?.plan_name ||
    p?.subscription?.name ||
    p?.current_plan?.plan_name ||
    p?.current_plan?.name ||
    p?.package_name ||
    p?.subscription_name ||
    p?.plan?.name ||
    p?.plan?.plan_name ||
    '';

  return String(rawName).trim();
}

/**
 * Returns true if the user's membership plan is expired/inactive.
 * Handles ISO, DD-MM-YYYY, DD/MM/YYYY, timestamps, and status strings.
 */
export function isMembershipExpired(profile?: any): boolean {
  if (!profile) return false;

  const p = profile?.userProfile || profile?.user || profile?.profile || profile?.data || profile;
  const membership =
    p?.membership ||
    p?.membership_plan ||
    p?.user_membership ||
    p?.active_membership ||
    (Array.isArray(p?.user_membership_history)
      ? p.user_membership_history[0]?.membership || p.user_membership_history[0]
      : p?.user_membership_history?.membership);

  const status = String(
    membership?.status ||
    p?.membership_status ||
    p?.subscription_status ||
    p?.status ||
    ''
  ).trim().toUpperCase();

  // Explicit expired / cancelled / inactive status
  if (status === 'EXPIRED' || status === 'CANCELLED' || status === 'INACTIVE') {
    return true;
  }

  const expiryRaw =
    membership?.membership_expiry_date ||
    p?.membership_expiry_date ||
    membership?.expiry_date ||
    p?.expiry_date ||
    membership?.expires_at ||
    p?.expires_at ||
    membership?.valid_till ||
    p?.valid_till;

  if (expiryRaw) {
    let expiryDate: Date | null = null;

    if (typeof expiryRaw === 'number') {
      // If 10-digit Unix timestamp (seconds), convert to milliseconds
      expiryDate = new Date(expiryRaw < 10000000000 ? expiryRaw * 1000 : expiryRaw);
    } else if (typeof expiryRaw === 'string') {
      const trimmed = expiryRaw.trim();
      if (/^\d{10}$/.test(trimmed)) {
        expiryDate = new Date(Number(trimmed) * 1000);
      } else {
        expiryDate = new Date(trimmed);
        if (isNaN(expiryDate.getTime())) {
          const parts = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (parts) {
            expiryDate = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
          }
        }
      }
    }

    if (expiryDate && !isNaN(expiryDate.getTime())) {
      // Set to end of the expiry day (23:59:59.999) to prevent false expiry on the same calendar day
      expiryDate.setHours(23, 59, 59, 999);
      if (expiryDate.getTime() < Date.now()) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns true if the user is an active Member.
 * An active member is a user who has a paid/assigned membership plan
 * (e.g. Silver, Gold, Platinum) or active trial that is NOT expired.
 */
export function isUserMember(profile?: any): boolean {
  if (!profile) return false;

  const p = profile?.userProfile || profile?.user || profile?.profile || profile?.data || profile;
  const planName = getActiveMembershipPlanName(p).toLowerCase();

  // Recognized paid/trial membership tiers
  const isPaidOrTrialTier =
    planName.includes('silver') ||
    planName.includes('gold') ||
    planName.includes('platinum') ||
    planName.includes('trial') ||
    planName === 'member' ||
    planName.includes('membership');

  // If plan is recognized tier, user is a member (unless expired)
  if (isPaidOrTrialTier) {
    if (isMembershipExpired(p)) {
      return false;
    }
    return true;
  }

  // Non-member names: empty, guest, regular, free (without tier/trial), null, undefined, none
  if (
    !planName ||
    planName === 'guest' ||
    planName === 'regular' ||
    planName === 'free' ||
    planName === 'null' ||
    planName === 'undefined' ||
    planName === 'none'
  ) {
    // Check if user is an onboarded Buyer or Seller with an active membership object
    const userTypeNorm = getNormalizedUserType(p?.user_type);
    const roleName = String(p?.role?.name || p?.role || '').toLowerCase();
    const isTrader =
      userTypeNorm.includes('buyer') ||
      userTypeNorm.includes('seller') ||
      roleName.includes('buyer') ||
      roleName.includes('seller');

    const membership =
      p?.membership ||
      p?.membership_plan ||
      p?.user_membership ||
      p?.active_membership;

    if (isTrader && membership && !isMembershipExpired(p)) {
      const status = String(membership?.status || p?.membership_status || '').trim().toUpperCase();
      if (status === 'ACTIVE' || status === 'TRIAL' || status === '') {
        return true;
      }
    }

    return false;
  }

  // Any other named plan that is not expired
  if (isMembershipExpired(p)) {
    return false;
  }

  return true;
}

/**
 * Returns true if the user is a Regular (non-onboarded, non-paying) account.
 * An active paying member is NEVER a regular account.
 * An onboarded Buyer or Seller is NEVER a regular account.
 */
export function isRegularAccount(profile?: any): boolean {
  if (!profile) return true;

  // Active members are never regular accounts
  if (isUserMember(profile)) {
    return false;
  }

  const userTypeNorm = getNormalizedUserType(profile?.user_type);
  const roleName = String(profile?.role?.name || profile?.role || '').toLowerCase();

  // Onboarded Buyer or Seller accounts retain access
  if (
    userTypeNorm.includes('buyer') ||
    userTypeNorm.includes('seller') ||
    roleName.includes('buyer') ||
    roleName.includes('seller')
  ) {
    return false;
  }

  const planName = getActiveMembershipPlanName(profile).toLowerCase();

  return (
    !userTypeNorm ||
    userTypeNorm === 'regular' ||
    roleName === 'regular' ||
    !planName ||
    planName === 'guest' ||
    planName === 'regular'
  );
}

/**
 * Determines whether user is a guest, registered non-member, or active member.
 *
 * Rules:
 * - Guest user (not logged in): buttonText = 'Free Trial', redirectUrl = '/[lang]/login?redirectUrl=/[lang]/membership'
 * - Registered non-member (logged in, has not purchased a plan / no active membership): buttonText = 'Free Trial', redirectUrl = '/[lang]/membership'
 * - Active member (has purchased a plan, membership not expired): buttonText = 'Upgrade Plan', redirectUrl = '/[lang]/membership'
 */
export function getMembershipStatus(
  userOrProfile?: any,
  lang: string = 'en',
  dict?: any
): MembershipStatus {
  let profile = userOrProfile;

  // If no profile passed, try reading from client cookie if available
  if (!profile && typeof document !== 'undefined') {
    profile = getUserFromClientCookie();
  }

  // Check if authenticated
  let hasAuth = Boolean(profile);
  if (!hasAuth && typeof document !== 'undefined') {
    const c = document.cookie;
    hasAuth = c.includes('auth_token=') || c.includes('__Secure-uid=');
  }

  if (!hasAuth && !profile) {
    return {
      isGuest: true,
      isRegisteredNonMember: false,
      isMember: false,
      buttonText: dict?.header?.free_trial || 'Free Trial',
      redirectUrl: `/${lang}/login?redirectUrl=/${lang}/membership`,
    };
  }

  const isMember = isUserMember(profile);

  return {
    isGuest: !hasAuth,
    isRegisteredNonMember: !isMember,
    isMember,
    buttonText: isMember
      ? (dict?.header?.upgrade_plan || 'Upgrade Plan')
      : (dict?.header?.free_trial || 'Free Trial'),
    redirectUrl: `/${lang}/membership`,
  };
}
