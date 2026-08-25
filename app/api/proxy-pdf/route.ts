import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  // Prevent SSRF by allowing only trusted origins
  const allowedOrigins = [
    'https://assets.agriguruonline.com',
    'https://assets.agriguruonline.cloud',
    'https://trading-api.agriguruonline.cloud',
    'https://cms-api.agriguruonline.cloud'
  ];

  let isValidOrigin = false;
  try {
    const parsedUrl = new URL(url);
    if (allowedOrigins.includes(parsedUrl.origin)) {
      isValidOrigin = true;
    }
  } catch (e) {
    return new NextResponse('Invalid URL format', { status: 400 });
  }

  if (!isValidOrigin) {
    return new NextResponse('Domain not allowed', { status: 403 });
  }

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      return new NextResponse(`Failed to fetch from upstream: ${response.statusText}`, { status: response.status })
    }

    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/pdf')) {
      return new NextResponse('Upstream returned non-PDF content', { status: 400 });
    }

    const blob = await response.blob()
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600',
      }
    })
  } catch (error) {
    console.error('PDF Proxy Error:', error)
    return new NextResponse('Error fetching PDF', { status: 500 })
  }
}
