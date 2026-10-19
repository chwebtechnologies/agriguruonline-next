import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService } from '@/lib/api/user.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get('auth_token')?.value ||
      cookieStore.get('__Secure-uid')?.value ||
      request.cookies.get('auth_token')?.value ||
      request.cookies.get('__Secure-uid')?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please sign in to proceed with membership activation.',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { membership_id, membership_duration, type = 'BECOME_A_MEMBER' } = body;
    const lang = request.nextUrl.searchParams.get('lang_code') || 'en';

    if (!membership_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Membership plan is required.',
        },
        { status: 400 }
      );
    }

    const safeDuration: 'MONTHLY' | 'YEARLY' =
      String(membership_duration).toUpperCase() === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const safeType: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE' =
      type === 'MEMBERSHIP_UPGRADE' ? 'MEMBERSHIP_UPGRADE' : 'BECOME_A_MEMBER';

    const payload = {
      membership_id,
      membership_duration: safeDuration,
      type: safeType,
    };

    const res = await userService.initiateMembershipUpgrade(payload, token, lang);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 0 || json.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: json.message || json.error || `Upgrade initiation failed (HTTP ${res.status})`,
        },
        { status: res.status >= 400 ? res.status : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: json.message || 'Upgrade initiation successful',
      data: json.data,
    });
  } catch (err: any) {
    console.error('[API /api/membership/initiate-upgrade] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'A network error occurred while initiating upgrade.',
      },
      { status: 500 }
    );
  }
}
