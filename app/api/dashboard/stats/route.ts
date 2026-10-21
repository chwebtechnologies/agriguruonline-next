import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { tradingService } from '@/lib/api/trading.service';
import { userService } from '@/lib/api/user.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || searchParams.get('lang_code') || 'en';

    let stats = await tradingService.getDashboardStats(token, lang);
    console.log('[/api/dashboard/stats] tradingService stats:', stats);

    const hasCounts = stats && Object.entries(stats).some(([k, v]) => !k.includes('limit') && typeof v === 'number' && v > 0);

    if (!hasCounts) {
      console.log('[/api/dashboard/stats] Stats empty or zero, fetching direct counts fallback...');
      const [buyerInq, sellerInq, freightInq, favProducts, favPorts, alerts] = await Promise.all([
        tradingService.getInquiryList('/trading-inquiry/for-user?type=BUYER', token, lang).catch(() => []),
        tradingService.getInquiryList('/trading-inquiry/for-user?type=SELLER', token, lang).catch(() => []),
        tradingService.getInquiryList('/freight-inquiry/for-user', token, lang).catch(() => []),
        tradingService.getFavoriteProducts(token, lang).catch(() => []),
        tradingService.getFavoritePorts(token, lang).catch(() => []),
        userService.getUserAlerts(token, lang).catch(() => []),
      ]);

      const productInquiriesCount = (buyerInq?.length || 0) + (sellerInq?.length || 0);
      const freightInquiriesCount = freightInq?.length || 0;
      const favProductsCount = favProducts?.length || 0;
      const favPortsCount = favPorts?.length || 0;
      const alertsCount = alerts?.length || 0;

      stats = {
        ...(stats || {}),
        trading_inquiries_count: stats?.trading_inquiries_count || productInquiriesCount,
        freight_inquiries_count: stats?.freight_inquiries_count || freightInquiriesCount,
        favourite_product_count: stats?.favourite_product_count || favProductsCount,
        favourite_product_count_limit: stats?.favourite_product_count_limit || 10,
        favourite_port_count: stats?.favourite_port_count || favPortsCount,
        favourite_port_count_limit: stats?.favourite_port_count_limit || 10,
        alert_count: stats?.alert_count || alertsCount,
        ai_analysis_count: stats?.ai_analysis_count || 0,
        markter_report_count: stats?.markter_report_count || 0,
        instruction_count: stats?.instruction_count || 0,
        smart_doc_count: stats?.smart_doc_count || 0,
      };
    }

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (err: any) {
    console.error('[/api/dashboard/stats] Error:', err);
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500 });
  }
}
