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
  const userTypeNorm = getNormalizedUserType(profile?.user_type);
  const roleName = String(profile?.role?.name || profile?.role || '').toLowerCase();
  const membership = profile?.membership;
  const planName = String(membership?.plan_name || membership?.name || '').toLowerCase();

  const isRegular =
    !profile?.user_type ||
    userTypeNorm === 'regular' ||
    (typeof profile?.user_type === 'object' && profile?.user_type?.name?.toLowerCase() === 'regular') ||
    roleName === 'regular' ||
    planName === 'guest' ||
    planName === 'regular';

  const hasActiveMembership = Boolean(
    membership &&
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
