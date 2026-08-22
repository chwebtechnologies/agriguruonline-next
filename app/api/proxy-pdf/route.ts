import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      return new NextResponse(`Failed to fetch from upstream: ${response.statusText}`, { status: response.status })
    }

    const blob = await response.blob()
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/pdf',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      }
    })
  } catch (error) {
    console.error('PDF Proxy Error:', error)
    return new NextResponse('Error fetching PDF', { status: 500 })
  }
}
