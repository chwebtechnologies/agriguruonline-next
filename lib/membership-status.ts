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
  const membership =
    profile.membership ||
    profile.membership_plan ||
    profile.user_membership_history?.membership;

  const rawName =
    membership?.plan_name ||
    membership?.name ||
    membership?.title ||
    profile.plan_name ||
    profile.membership_plan_name ||
    profile.membership_name ||
    profile.subscription?.plan_name ||
    profile.plan?.name ||
    profile.plan?.plan_name ||
    '';

  return String(rawName).trim();
}

/**
 * Returns true if the user's membership plan is expired/inactive.
 * Handles ISO, DD-MM-YYYY, DD/MM/YYYY, timestamps, and status strings.
 */
export function isMembershipExpired(profile?: any): boolean {
  if (!profile) return false;
  const membership =
    profile?.membership ||
    profile?.membership_plan ||
    profile?.user_membership_history?.membership;

  const status = String(
    membership?.status ||
    profile?.membership_status ||
    profile?.subscription_status ||
    ''
  ).trim().toUpperCase();

  if (status === 'EXPIRED' || status === 'CANCELLED' || status === 'INACTIVE') {
    return true;
  }

  const expiryRaw =
    membership?.membership_expiry_date ||
    profile?.membership_expiry_date ||
    membership?.expiry_date ||
    profile?.expiry_date ||
    membership?.expires_at ||
    profile?.expires_at;

  if (expiryRaw) {
    let expiryDate = new Date(expiryRaw);
    if (isNaN(expiryDate.getTime()) && typeof expiryRaw === 'string') {
      const parts = expiryRaw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (parts) {
        expiryDate = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
      }
    }
    if (!isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if the user is an active Member.
 * An active member is a user who has a paid/assigned membership plan
 * (e.g. Silver, Gold, Platinum) that is NOT expired and status is active.
 *
 * Registered users without a paid plan (or whose plan is guest/regular/null/expired)
 * are Non-Members and this will return false.
 */
export function isUserMember(profile?: any): boolean {
  if (!profile) return false;

  const planName = getActiveMembershipPlanName(profile).toLowerCase();

  // If no plan, or plan is explicitly guest/regular/free/null/none
  if (
    !planName ||
    planName === 'guest' ||
    planName === 'regular' ||
    planName === 'free' ||
    planName === 'free trial' ||
    planName === 'null' ||
    planName === 'undefined' ||
    planName === 'none'
  ) {
    return false;
  }

  // If membership has expired, user is not an active member
  if (isMembershipExpired(profile)) {
    return false;
  }

  // Check explicit status
  const membership =
    profile.membership ||
    profile.membership_plan ||
    profile.user_membership_history?.membership;

  const status = String(
    membership?.status ||
    profile.membership_status ||
    profile.subscription_status ||
    ''
  ).trim().toUpperCase();

  if (status === 'EXPIRED' || status === 'CANCELLED' || status === 'INACTIVE') {
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
