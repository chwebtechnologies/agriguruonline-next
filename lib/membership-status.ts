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
 * Returns true if the user is a Regular (non-onboarded) account.
 * Users who have already onboarded as Buyer or Seller are NOT regular accounts,
 * even if their membership plan has expired or reverted to Guest/Regular/null.
 */
export function isRegularAccount(profile?: any): boolean {
  if (!profile) return true;

  const userTypeNorm = getNormalizedUserType(profile?.user_type);
  const roleName = String(profile?.role?.name || profile?.role || '').toLowerCase();

  if (
    userTypeNorm.includes('buyer') ||
    userTypeNorm.includes('seller') ||
    roleName.includes('buyer') ||
    roleName.includes('seller')
  ) {
    return false;
  }

  const planName = String(
    profile?.membership?.plan_name || profile?.membership?.name || profile?.plan_name || ''
  ).toLowerCase();

  return (
    !userTypeNorm ||
    userTypeNorm === 'regular' ||
    roleName === 'regular' ||
    planName === 'guest' ||
    planName === 'regular'
  );
}

/**
 * Returns true if the user's membership plan is expired/inactive.
 */
export function isMembershipExpired(profile?: any): boolean {
  if (!profile) return false;
  const membership = profile?.membership;
  const status = String(membership?.status || profile?.membership_status || '').toUpperCase();
  if (status === 'EXPIRED' || status === 'CANCELLED' || status === 'INACTIVE') {
    return true;
  }
  const expiryRaw = membership?.membership_expiry_date || profile?.membership_expiry_date;
  if (expiryRaw) {
    const expiryDate = new Date(expiryRaw);
    if (!isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether user is a guest, registered non-member, or active member.
 *
 * Rules:
 * - Guest user (not logged in): buttonText = 'Free Trial', redirectUrl = '/[lang]/login?redirectUrl=/[lang]/membership'
 * - Registered non-member (logged in as regular user or no active paid membership): buttonText = 'Free Trial', redirectUrl = '/[lang]/membership'
 * - Active member (has active paid membership and not regular): buttonText = 'Upgrade Plan', redirectUrl = '/[lang]/membership'
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

  // Profile exists or user has auth cookie
  const membership = profile?.membership;
  const planName = String(membership?.plan_name || membership?.name || '').toLowerCase();

  const isRegular = isRegularAccount(profile);
  const expired = isMembershipExpired(profile);

  const hasActiveMembership = Boolean(
    membership &&
    !expired &&
    planName &&
    planName !== 'guest' &&
    planName !== 'regular' &&
    planName !== 'null' &&
    planName !== 'undefined'
  );

  const isMember = hasActiveMembership && !isRegular;

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
