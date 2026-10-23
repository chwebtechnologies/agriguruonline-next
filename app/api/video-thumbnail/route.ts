import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Known local posters mapped by YouTube videoId
const LOCAL_POSTERS: Record<string, string> = {
  'vi0fcb-IjLA': 'media/tutorial-thumbnail.jpg',
  'neEQrat8yuU': 'media/seller-tutorial-thumbnail.jpg',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return new NextResponse('Missing videoId parameter', { status: 400 });
  }

  // 1. Check if a local cached file exists
  const localRelative = LOCAL_POSTERS[videoId];
  if (localRelative) {
    const fullPath = path.join(process.cwd(), 'public', localRelative);
    if (fs.existsSync(fullPath)) {
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch (e) {
        console.error('Error reading local video poster:', e);
      }
    }
  }

  // 2. Fallback: Proxy directly from YouTube CDN server-side (bypasses browser ad-blockers)
  const candidateUrls = [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': res.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    } catch {
      // Continue to next candidate
    }
  }

  return new NextResponse('Thumbnail not found', { status: 404 });
}
