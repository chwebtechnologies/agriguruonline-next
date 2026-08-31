import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  // Parse the URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    console.error(`Invalid URL format provided to PDF proxy: ${url}`);
    return new NextResponse('Invalid URL format', { status: 400 });
  }

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`PDF proxy upstream failed for ${url} with status ${response.status}`);
      return new NextResponse(`Failed to fetch from upstream: ${response.statusText}`, { status: response.status })
    }

    const contentType = response.headers.get('Content-Type');
    console.log(`PDF Proxy fetched ${url} with Content-Type: ${contentType}`);
    
    // Some storage providers (like S3) might return application/octet-stream or binary/octet-stream for PDFs
    // So we just log the content type and continue instead of strictly blocking it.

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
