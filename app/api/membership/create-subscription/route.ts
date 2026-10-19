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
          error: 'Please sign in to proceed with payment.',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const lang = request.nextUrl.searchParams.get('lang_code') || 'en';

    if (!body.membership_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Membership plan is required.',
        },
        { status: 400 }
      );
    }

    const res = await userService.createSubscription(body, token, lang);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 0 || json.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: json.message || json.error || `Failed to initialize subscription (HTTP ${res.status})`,
        },
        { status: res.status >= 400 ? res.status : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: json.message || 'Subscription created successfully',
      data: json.data || json,
    });
  } catch (err: any) {
    console.error('[API /api/membership/create-subscription] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while initializing payment.',
      },
      { status: 500 }
    );
  }
}
