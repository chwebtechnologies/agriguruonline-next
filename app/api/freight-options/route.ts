import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTradingApiUrl, getSafeLang } from '@/lib/api-utils';
import { refreshTokensAction } from '@/app/actions/auth';
import { getUserProfile } from '@/lib/user-data';
import { tradingService } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const lang = getSafeLang(searchParams.get('lang') || 'en');
    const tradingApiUrl = getTradingApiUrl();

    if (type === 'check-kyc') {
      const favFreightId = searchParams.get('favFreightId') || '';
      try {
        const cookieStore = await cookies();
        let token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
        if (!token && cookieStore.get('refresh_token')?.value) {
          try {
            const refreshRes = await refreshTokensAction();
            if (refreshRes && refreshRes.success && refreshRes.access_token) {
              token = refreshRes.access_token;
            }
          } catch (refreshErr) {
            console.error('Token refresh failed in check-kyc route:', refreshErr);
          }
        }

        if (!token) {
          return NextResponse.json({ success: false, message: 'Unauthorized', data: null, isUnauthorized: true });
        }

        let user_id = '';
        let isKycVerified = false;
        let userType: any = null;

        try {
          const profileResult = await getUserProfile(token, lang);
          const profile = profileResult?.userProfile;
          if (profile) {
            user_id = profile.id || profile._id || profile.customer_id || '';
            isKycVerified = Boolean(profile.is_kyc_verified);
            userType = profile.user_type;
          }
        } catch (e) {
          console.error('Error retrieving user profile in check-kyc route:', e);
        }

        if (!user_id) {
          const userInfoCookie = cookieStore.get('user_info')?.value;
          if (userInfoCookie) {
            try {
              const u = JSON.parse(decodeURIComponent(userInfoCookie));
              user_id = u?.id || u?._id || u?.customer_id || '';
              if (u?.is_kyc_verified !== undefined) {
                isKycVerified = Boolean(u.is_kyc_verified);
              }
              if (u?.user_type) {
                userType = u.user_type;
              }
            } catch {}
          }
        }

        if (!favFreightId) {
          return NextResponse.json({
            success: false,
            status: false,
            can_create: false,
            message: 'Please select or add a freight route first.',
            data: null,
            is_kyc_verified: isKycVerified,
            user_type: userType
          });
        }

        const url = `${tradingApiUrl}/freight-inquiry/next-button?lang_code=${lang}&source=web`;
        const body = {
          type: 'BUYER',
          user_id: user_id,
          favourite_freight_id: String(favFreightId)
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-source': 'web',
            'source': 'web',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errorMsg = Array.isArray(data?.message)
            ? data.message.join(', ')
            : (data?.message || data?.error || 'Failed to check freight inquiry permissions');
          return NextResponse.json({
            success: false,
            status: false,
            can_create: false,
            message: errorMsg,
            data: null,
            is_kyc_verified: isKycVerified,
            user_type: userType,
            ...data
          });
        }

        return NextResponse.json({
          ...data,
          is_kyc_verified: isKycVerified,
          user_type: userType
        });
      } catch (error: any) {
        console.error('Error in /api/freight-options?type=check-kyc:', error);
        return NextResponse.json({ success: false, message: error?.message || 'Failed to check freight inquiry status', data: null });
      }
    }

    if (type === 'price') {
      try {
        const cookieStore = await cookies();
        let token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
        if (!token && cookieStore.get('refresh_token')?.value) {
          try {
            const refreshRes = await refreshTokensAction();
            if (refreshRes && refreshRes.success && refreshRes.access_token) {
              token = refreshRes.access_token;
            }
          } catch {}
        }

        if (!token) {
          return NextResponse.json({ success: false, message: 'Unauthorized', data: null });
        }

        let user_id = '';
        try {
          const profileResult = await getUserProfile(token, lang);
          if (profileResult?.userProfile?.id) {
            user_id = profileResult.userProfile.id;
          }
        } catch {}

        const queryParams = new URLSearchParams({
          type: 'BUYER',
          lang_code: lang,
          source: 'web'
        });

        const favFreightId = searchParams.get('favourite_freight_id');
        const containerId = searchParams.get('shipping_container_id');
        const polId = searchParams.get('loading_port_id');
        const podId = searchParams.get('destination_port_id');
        const prodId = searchParams.get('product_id');
        const linerId = searchParams.get('liner_term_id');
        const shippingId = searchParams.get('shipping_term_id');

        if (favFreightId) queryParams.append('favourite_freight_id', favFreightId);
        if (containerId) queryParams.append('shipping_container_id', containerId);
        if (polId) queryParams.append('loading_port_id', polId);
        if (podId && podId !== 'N/A') queryParams.append('destination_port_id', podId);
        if (prodId) queryParams.append('product_id', prodId);
        if (linerId) queryParams.append('liner_term_id', linerId);
        if (shippingId) queryParams.append('shipping_term_id', shippingId);
        if (user_id) queryParams.append('user_id', user_id);

        const priceUrl = `${tradingApiUrl}/freight-inquiry/price?${queryParams.toString()}`;
        const res = await fetch(priceUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'x-app-source': 'web'
          }
        });

        const data = await res.json().catch(() => null);
        return NextResponse.json(data || { success: false, message: 'No price data' });
      } catch (err: any) {
        console.error('Error in /api/freight-options?type=price:', err);
        return NextResponse.json({ success: false, message: err?.message || 'Failed to fetch price' });
      }
    }

    if (type === 'products') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `${tradingApiUrl}/product?is_active=true&lang_code=${lang}&source=web`,
          {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'x-app-source': 'web'
            },
            next: { revalidate: 300 }
          }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const list = json?.data?.products || json?.data?.product || (Array.isArray(json?.data) ? json.data : []);
          return NextResponse.json(
            { success: true, data: Array.isArray(list) ? list : [] },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
              }
            }
          );
        }
      } catch (err) {
        console.error('[API /api/freight-options?type=products] error:', err);
      }
      return NextResponse.json({ success: true, data: [] });
    }

    if (type === 'liner-terms') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `${tradingApiUrl}/liner-term?is_active=true&lang_code=${lang}&source=web`,
          {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'x-app-source': 'web'
            },
            next: { revalidate: 300 }
          }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const list = json?.data?.liner_term || json?.data?.liner_terms || (Array.isArray(json?.data) ? json.data : []);
          return NextResponse.json(
            { success: true, data: Array.isArray(list) ? list : [] },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
              }
            }
          );
        }
      } catch (err) {
        console.error('[API /api/freight-options?type=liner-terms] error:', err);
      }
      return NextResponse.json({ success: true, data: [] });
    }

    if (type === 'shipping-terms') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `${tradingApiUrl}/shipping-term?is_active=true&lang_code=${lang}&source=web`,
          {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'x-app-source': 'web'
            },
            next: { revalidate: 3600 }
          }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const list = json?.data?.shipping_term || json?.data || [];
          return NextResponse.json(
            { success: true, data: Array.isArray(list) ? list : [] },
            {
              headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
              }
            }
          );
        }
      } catch (err) {
        console.error('[API /api/freight-options?type=shipping-terms] error:', err);
      }
      return NextResponse.json({ success: true, data: [] });
    }

    if (type === 'payment-terms') {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'x-app-source': 'web'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `${tradingApiUrl}/payment-term?is_active=true&lang_code=${lang}&source=web`,
          { headers, cache: 'no-store', signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json().catch(() => null);
          const list = json?.data?.payment_term || json?.data || [];
          return NextResponse.json({ success: true, data: Array.isArray(list) ? list : [] });
        }
      } catch (err) {
        console.error('[API /api/freight-options?type=payment-terms] error:', err);
      }
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/freight-options] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const lang = getSafeLang(searchParams.get('lang') || 'en');
    const tradingApiUrl = getTradingApiUrl();

    if (type === 'submit-inquiry') {
      const payload = await req.json().catch(() => ({}));
      const cookieStore = await cookies();
      let token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
      if (!token && cookieStore.get('refresh_token')?.value) {
        try {
          const refreshRes = await refreshTokensAction();
          if (refreshRes && refreshRes.success && refreshRes.access_token) {
            token = refreshRes.access_token;
          }
        } catch (refreshErr) {
          console.error('Token refresh failed in submit-inquiry:', refreshErr);
        }
      }

      if (!token) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
      }

      let user_id = payload.user_id;
      if (!user_id) {
        try {
          const profileResult = await getUserProfile(token, lang);
          if (profileResult?.userProfile?.id) {
            user_id = profileResult.userProfile.id;
          }
        } catch (e) {
          console.error('Error fetching user profile for freight inquiry:', e);
        }
      }

      const qty = Number(payload.quantity ?? 0);
      const capacity = Number(payload.load_capacity ?? payload.loadCapacity ?? 26) || 26;
      const computedFcl = (payload.quantity_type === 'MT' || payload.quantity_unit === 'MT') ? Math.ceil(qty / capacity) : qty;
      const finalFcl = Number(payload.fcl) > 0 ? Number(payload.fcl) : Math.max(1, computedFcl || 1);

      // Exact backend payload specification
      const finalPayload = {
        comment: payload.comment || payload.comments || payload.description || "",
        destination_port_id: payload.destination_port_id,
        fcl: finalFcl,
        freight: Number(payload.freight ?? payload.freight_rate ?? 0),
        is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
        liner_term_id: payload.liner_term_id,
        loading_port_id: payload.loading_port_id,
        payment_term_id: payload.payment_term_id,
        price_bid: Number(payload.price_bid ?? payload.asking_freight_rate ?? 0),
        product_id: payload.product_id,
        quantity: qty,
        quantity_type: payload.quantity_type || payload.quantity_unit || "MT",
        shipping_container_id: payload.shipping_container_id,
        shipping_end_date: payload.shipping_end_date || payload.shipment_end_date,
        shipping_start_date: payload.shipping_start_date || payload.shipment_start_date,
        shipping_term_id: payload.shipping_term_id,
        user_id: user_id || payload.user_id
      };

      const res = await tradingService.createFreightInquiry(finalPayload, token, lang);
      return NextResponse.json(res);
    }

    return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/freight-options POST] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
