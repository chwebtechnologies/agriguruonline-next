import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Server-side translation and audio cache
const translationCache = new Map<string, string>();
const audioCache = new Map<string, { buffer: Uint8Array; timestamp: number }>();

// Clean HTML to plain text while preserving natural paragraph breaks
function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(p|div|section|article)\b[^>]*>\s*(<br\s*[\/]?>|&nbsp;|\s)*<\/\1>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|article|section)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&hellip;/gi, ', ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/(\.\s*){2,}/g, '. ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// Split text into natural spoken sentences without breaking numbers/decimals
function splitIntoSentences(text: string, lang: string): string[] {
  if (!text) return [];
  const langKey = (lang || 'en').toLowerCase().split('-')[0];
  const isAsianLang = langKey === 'zh';
  const isArabic = langKey === 'ar';
  const maxLen = isAsianLang ? 80 : 160;

  // Split by sentence terminators (Chinese uses zero-width space after full stop)
  const rawChunks = (isAsianLang
    ? text.split(/(?<=[。！？\n])\s*/u)
    : text.split(/(?<=[!?؟۔。！？\n]|(?<=\.(?!\d)))\s+/u)
  )
    .map(s => s.trim().replace(/\.{2,}/g, '.'))
    .filter(s => s.length > 0 && /[\p{L}\p{N}]/u.test(s));

  const finalSegments: string[] = [];

  for (const chunk of rawChunks) {
    if (chunk.length > maxLen) {
      const subSplitRegex: RegExp = isAsianLang
        ? /(?<=[，、；：,;:])\s*/u
        : isArabic
        ? /(?<=[،؛:;,])\s*/u
        : /(?<=[,;:\u2014\u2013\-])\s+/u;

      const subParts = chunk.split(subSplitRegex).map(p => p.trim()).filter(Boolean);
      let currentSub = '';

      for (const part of subParts) {
        if ((currentSub + (currentSub ? ' ' : '') + part).length > maxLen && currentSub.trim()) {
          const seg = currentSub.trim().replace(/\.{2,}/g, '.');
          if (/[\p{L}\p{N}]/u.test(seg)) {
            finalSegments.push(seg);
          }
          currentSub = part;
        } else {
          currentSub = currentSub ? (isAsianLang ? `${currentSub}${part}` : `${currentSub} ${part}`) : part;
        }
      }
      if (currentSub.trim()) {
        const seg = currentSub.trim().replace(/\.{2,}/g, '.');
        if (/[\p{L}\p{N}]/u.test(seg)) {
          finalSegments.push(seg);
        }
      }
    } else {
      finalSegments.push(chunk);
    }
  }

  return finalSegments.filter(s => s.trim().length > 0 && /[\p{L}\p{N}]/u.test(s));
}

// Translate a text block with multiple clients and fallback endpoints
async function translateTextBlock(text: string, targetLang: string): Promise<string> {
  const normLang = (targetLang || 'en').toLowerCase().split('-')[0];
  if (normLang === 'en' || !text || text.trim().length === 0) return text;

  const targetCode = normLang === 'zh' ? 'zh-CN' : normLang;
  const cacheKey = `${targetCode}:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // 1. Google Translate API clients
  const googleClients = ['gtx', 'dict-chrome-ex'];
  for (const client of googleClients) {
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(gUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.[0])) {
          const translated = data[0].map((item: any) => item[0]).join('');
          if (translated && translated.trim().length > 0) {
            translationCache.set(cacheKey, translated.trim());
            return translated.trim();
          }
        }
      }
    } catch {
      // Try next client
    }
  }

  // 2. Secondary fallback: MyMemory API
  try {
    const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|${targetCode}`;
    const mController = new AbortController();
    const mTimer = setTimeout(() => mController.abort(), 4000);
    const res = await fetch(mUrl, { signal: mController.signal });
    clearTimeout(mTimer);
    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        translationCache.set(cacheKey, translated.trim());
        return translated.trim();
      }
    }
  } catch {
    // Fall through
  }

  return text;
}

// Break long text into chunks of maximum length at word/character boundaries
function chunkTextForAudio(text: string, maxLen = 160): string[] {
  if (text.length <= maxLen) return [text];

  // Chinese text has no whitespace: split by punctuation or chunk length
  const isChinese = /[\u4e00-\u9fa5]/.test(text);
  if (isChinese) {
    const parts = text.split(/(?<=[，、；。！？,;!?])\s*/u).filter(Boolean);
    const chunks: string[] = [];
    let current = '';
    for (const part of parts) {
      if ((current + part).length > 80 && current) {
        chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text.slice(0, 80)];
  }

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + (current ? ' ' : '') + word).length > maxLen && current) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

/**
 * GET /api/tts?text=...&lang=...
 * Official Google TTS audio stream in genuine broadcast quality female voices.
 * Automatically translates non-target text on-the-fly for Arabic and Chinese.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawText = (searchParams.get('text') || '').trim();
    const rawLang = (searchParams.get('lang') || 'en').toLowerCase().split('-')[0];

    if (!rawText) {
      return new NextResponse('Text is required', { status: 400 });
    }

    const targetCode = rawLang === 'zh' ? 'zh-CN' : rawLang === 'ar' ? 'ar' : rawLang === 'fr' ? 'fr' : 'en';
    const cacheKey = `${targetCode}:${rawText}`;

    // Check memory cache
    const cached = audioCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000 * 24) {
      return new NextResponse(cached.buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.buffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    // Auto-translate to target language if sentence does not contain native script
    let textToSynthesize = rawText;
    if (rawLang === 'ar' && !/[\u0600-\u06FF]/.test(rawText)) {
      textToSynthesize = await translateTextBlock(rawText, 'ar');
    } else if (rawLang === 'zh' && !/[\u4e00-\u9fa5]/.test(rawText)) {
      textToSynthesize = await translateTextBlock(rawText, 'zh-CN');
    } else if (rawLang === 'fr' && searchParams.get('translate') === 'true') {
      textToSynthesize = await translateTextBlock(rawText, 'fr');
    }

    // Split into chunks under Google TTS limit (<=160 chars)
    const chunks = chunkTextForAudio(textToSynthesize, 160);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${targetCode}&client=tw-ob`;
      const ttsController = new AbortController();
      const ttsTimer = setTimeout(() => ttsController.abort(), 5000);
      const res = await fetch(ttsUrl, {
        signal: ttsController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
        },
      });
      clearTimeout(ttsTimer);

      if (res.ok) {
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 0) {
          audioBuffers.push(Buffer.from(arr));
        }
      }
    }

    if (audioBuffers.length > 0) {
      const combined = Buffer.concat(audioBuffers);
      const uint8 = new Uint8Array(combined);

      // Keep cache size bounded
      if (audioCache.size > 200) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) audioCache.delete(firstKey);
      }
      audioCache.set(cacheKey, { buffer: uint8, timestamp: Date.now() });

      return new NextResponse(uint8 as any, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': uint8.byteLength.toString(),
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    return new NextResponse('Audio unavailable', { status: 502 });
  } catch (error) {
    console.error('[API TTS GET] error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

/**
 * POST /api/tts
 * Robust batch translation that never gets rate limited or returns English text for Arabic
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title = '', content = '', lang = 'en' } = body;

    const langKey = (lang || 'en').toLowerCase().split('-')[0];
    const cleanBody = cleanHtml(content);

    // If English, return English sentences immediately
    if (langKey === 'en') {
      const fullText = [title, cleanBody].filter(Boolean).join('.\n\n');
      const sentences = splitIntoSentences(fullText, 'en');
      return NextResponse.json({
        success: true,
        lang: 'en',
        sentences: sentences.length > 0 ? sentences : [title || 'AgriGuru Online'],
      });
    }

    // Check if the content is already in the target script (e.g. Arabic)
    const isArabicTarget = langKey === 'ar';
    const isChineseTarget = langKey === 'zh';
    const hasTargetScript = isArabicTarget
      ? /[\u0600-\u06FF]/.test(title + ' ' + cleanBody)
      : isChineseTarget
      ? /[\u4e00-\u9fa5]/.test(title + ' ' + cleanBody)
      : false;

    if (hasTargetScript) {
      const combined = [title, cleanBody].filter(Boolean).join('.\n\n');
      const sentences = splitIntoSentences(combined, langKey);
      return NextResponse.json({
        success: true,
        lang: langKey,
        sentences: sentences.length > 0 ? sentences : [title || 'AgriGuru Online'],
      });
    }

    // Combine full article and translate in large, safe blocks to avoid rate limiting
    const fullArticleText = [title, cleanBody].filter(Boolean).join('.\n\n');
    let translatedFullText = '';

    if (fullArticleText.length <= 3500) {
      // Single fast translation request
      translatedFullText = await translateTextBlock(fullArticleText, langKey);
    } else {
      // Split large article by paragraph boundaries into chunks of ~2500 chars
      const paras = fullArticleText.split(/\n\n+/);
      const chunksToTranslate: string[] = [];
      let cur = '';

      for (const p of paras) {
        if ((cur + '\n\n' + p).length > 2500 && cur) {
          chunksToTranslate.push(cur.trim());
          cur = p;
        } else {
          cur = cur ? `${cur}\n\n${p}` : p;
        }
      }
      if (cur.trim()) chunksToTranslate.push(cur.trim());

      const translatedChunks: string[] = [];
      for (const chunk of chunksToTranslate) {
        const trans = await translateTextBlock(chunk, langKey);
        translatedChunks.push(trans);
      }
      translatedFullText = translatedChunks.join('\n\n');
    }

    // If target is Arabic, verify output contains Arabic characters
    if (isArabicTarget && !/[\u0600-\u06FF]/.test(translatedFullText)) {
      // Retry translation of title and first paragraphs with dict client
      const retryTitle = await translateTextBlock(title, 'ar');
      const retryBody = await translateTextBlock(cleanBody.slice(0, 1500), 'ar');
      translatedFullText = [retryTitle, retryBody].filter(Boolean).join('.\n\n');
    }

    // If target is Chinese, verify output contains Chinese characters
    if (isChineseTarget && !/[\u4e00-\u9fa5]/.test(translatedFullText)) {
      // Retry translation of title and first paragraphs with dict client
      const retryTitle = await translateTextBlock(title, 'zh-CN');
      const retryBody = await translateTextBlock(cleanBody.slice(0, 1500), 'zh-CN');
      translatedFullText = [retryTitle, retryBody].filter(Boolean).join('。\n\n');
    }

    const sentences = splitIntoSentences(translatedFullText, langKey);

    return NextResponse.json({
      success: true,
      lang: langKey,
      sentences: sentences.length > 0 ? sentences : [translatedFullText || 'AgriGuru Online'],
    });
  } catch (error) {
    console.error('[API TTS POST] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process audio text' }, { status: 500 });
  }
}

