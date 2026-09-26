import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTradingApiUrl } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get('auth_token')?.value;
    if (!token) token = cookieStore.get('__Secure-uid')?.value;
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lang_code = searchParams.get('lang_code') || 'en';
    
    const formData = await req.formData();
    
    const url = `${getTradingApiUrl()}/price-analysis?lang_code=${lang_code}&source=web`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: 'Failed to create prediction' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    console.error('Error in price-analysis proxy POST:', error);
    const err = error as Error;
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get('auth_token')?.value;
    if (!token) token = cookieStore.get('__Secure-uid')?.value;
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const lang_code = searchParams.get('lang_code') || 'en';
    const type = searchParams.get('type') || 'product';
    const job_id = searchParams.get('job_id');

    if (!job_id) {
       return NextResponse.json({ success: false, message: 'Job ID missing' }, { status: 400 });
    }

    if (action === 'status') {
      const url = `${getTradingApiUrl()}/price-analysis/status/${type}/${job_id}?lang_code=${lang_code}&source=web`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } 
    
    if (action === 'stream') {
      const url = `${getTradingApiUrl()}/price-analysis/stream/${type}/${job_id}?lang_code=${lang_code}&source=web`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in price-analysis proxy GET:', error);
    const err = error as Error;
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
