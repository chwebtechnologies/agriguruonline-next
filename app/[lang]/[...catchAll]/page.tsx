import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { cmsService } from '@/lib/api/cms.service';
import { getAlternates, getSafeLanguage, getSiteUrl } from '@/lib/seo';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import { resolveImageUrl } from '@/lib/image-utils';
import type { CmsContentItem } from '@/types/cms';

export const revalidate = 3600;

const SLUG_ALIASES: Record<string, string> = {
  'user-guide': 'agriguru-user-guide',
  'refund-cancellation': 'refund-cancellation-policy',
  'privacy': 'privacy-policy',
  'terms': 'terms-conditions',
};

const resolveSlug = (rawSlug: string): string => {
  return SLUG_ALIASES[rawSlug] || rawSlug;
};

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr'];
  try {
    const footerData = await cmsService.getFooter('en');
    const slugs = new Set<string>();

    if (footerData) {
      Object.values(footerData).forEach((items) => {
        items?.forEach((item) => {
          if (item.link_type === 'PAGE' && item.slug) {
            slugs.add(item.slug);
          }
        });
      });
    }

    // Common known slugs
    [
      'founder-profile',
      'our-team',
      'user-manual',
      'agriguru-user-guide',
      'disclaimer',
      'terms-conditions',
      'refund-cancellation-policy',
      'privacy-policy',
    ].forEach((s) => slugs.add(s));

    const params: Array<{ lang: string; catchAll: string[] }> = [];
    for (const lang of languages) {
      for (const slug of slugs) {
        // Exclude dedicated pages from catchAll params
        if (['about-us', 'contact-us', 'membership', 'career'].includes(slug)) continue;
        params.push({ lang, catchAll: [slug] });
      }
    }
    return params;
  } catch {
    return [];
  }
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string; catchAll: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);
  const segments = params?.catchAll || [];

  if (segments.length !== 1) {
    return { title: 'Not Found | AgriGuru Online' };
  }

  const slug = resolveSlug(segments[0]);

  // If pointing to dedicated routes, fallback gracefully
  if (['about-us', 'contact-us', 'membership', 'career'].includes(slug)) {
    return { title: 'AgriGuru Online' };
  }

  const data = await cmsService.getContentBySlug(slug, lang);
  if (!data || data.is_active === false) {
    return { title: 'Page Not Found | AgriGuru Online' };
  }

  const title = data.title || data.name || 'AgriGuru Online';
  const description =
    data.meta_description || `${title} - Learn more on AgriGuru Online.`;
  const keywords = data.meta_keywords || `${title.toLowerCase()}, agriguru online`;
  const alternates = getAlternates(slug, lang);

  const firstImage = data.page_description?.find((item) => item.image_url)?.image_url;
  const imageUrl = firstImage ? resolveImageUrl(firstImage) : `${getSiteUrl()}/logo.png`;

  return {
    title: `${title} | AgriGuru Online`,
    description,
    keywords,
    openGraph: {
      title: `${title} | AgriGuru Online`,
      description,
      url: alternates.canonical,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: imageUrl,
          width: 600,
          height: 400,
          alt: title,
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AgriGuru Online`,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
    },
    alternates,
  };
}

export default async function DynamicCmsCatchAllPage(props: {
  params: Promise<{ lang: string; catchAll: string[] }>;
}) {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);
  const segments = params?.catchAll || [];

  // Multi-segment unknown routes immediately 404
  if (segments.length !== 1) {
    notFound();
  }

  const rawSlug = segments[0];
  const slug = resolveSlug(rawSlug);

  // Dedicated routes safety check
  if (slug === 'about' || slug === 'about-us') {
    redirect(`/${lang}/about-us`);
  }
  if (slug === 'contact-us') {
    redirect(`/${lang}/contact-us`);
  }
  if (slug === 'membership' || slug === 'become-member') {
    redirect(`/${lang}/membership`);
  }
  if (slug === 'career') {
    redirect(`/${lang}/career`);
  }

  const [content, dict] = await Promise.all([
    cmsService.getContentBySlug(slug, lang),
    getDictionary(lang).catch(() => ({})),
  ]);

  if (!content || content.is_active === false) {
    notFound();
  }

  const commonDict = (dict as Record<string, any>).common || {};
  const backText = commonDict.back || 'Back';
  const pageTitle = content.title || content.name || 'AgriGuru Online';

  const sortedSections = [...(content.page_description || [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText={backText} />

          {/* Dynamic Content Sections */}
          <div className="mt-1 sm:mt-2 space-y-4 sm:space-y-6">
            {sortedSections.map((item: CmsContentItem, idx: number) => {
              const rawHtml = item.text_content || '';
              const cleanedHtml = rawHtml
                .replace(/<p>\s*(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/gi, '')
                .trim();
              const sanitizedHtml = DOMPurify.sanitize(cleanedHtml);

              const hasImage = Boolean(item.image_url && item.image_url.trim());
              const itemType = (item.type || '').toUpperCase();
              const isTextImage = itemType === 'TEXT_IMAGE';

              // =========================================================================
              // TYPE 1: Items with Images (e.g. Founder Profile, Our Team, Text/Image)
              // Mobile: Image always on top, text below.
              // Laptop/Desktop:
              //   - IMAGE_TEXT: Left Image, Right Text
              //   - TEXT_IMAGE: Left Text, Right Image
              // =========================================================================
              if (hasImage) {
                return (
                  <div
                    key={item.field_id || idx}
                    className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:bg-transparent lg:border-0 lg:shadow-none lg:p-0 lg:rounded-none lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start"
                  >
                    {/* Image Box */}
                    {/* Mobile: order-1 (always first). Desktop: lg:order-1 for IMAGE_TEXT, lg:order-2 for TEXT_IMAGE */}
                    <div
                      className={`w-full order-1 ${
                        isTextImage ? 'lg:order-2' : 'lg:order-1'
                      } lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs`}
                    >
                      <div className="relative w-full aspect-[600/400] rounded-xl overflow-hidden border border-border bg-muted/30">
                        <ImageWithSkeleton
                          src={item.image_url}
                          alt={item.header || `${pageTitle} - ${idx + 1}`}
                          title={item.header || pageTitle}
                          width={600}
                          height={400}
                          priority={idx === 0}
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                    </div>

                    {/* Content Box */}
                    {/* Mobile: order-2 (always after image). Desktop: lg:order-1 for TEXT_IMAGE, lg:order-2 for IMAGE_TEXT */}
                    <div
                      className={`w-full order-2 mt-4 sm:mt-5 lg:mt-0 ${
                        isTextImage ? 'lg:order-1' : 'lg:order-2'
                      } lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs`}
                    >
                      {item.header ? (
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 pb-2 border-b border-border/60">
                          {item.header}
                        </h2>
                      ) : null}

                      <div
                        className="prose prose-lg dark:prose-invert max-w-none text-foreground/90 font-normal
                        [&>*:first-child]:mt-0 [&>p:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p:last-child]:mb-0
                        text-justify prose-p:text-justify
                        prose-p:text-[17px] sm:prose-p:text-[18px] lg:prose-p:text-[19px] 
                        prose-p:leading-[1.75] sm:prose-p:leading-[1.8] lg:prose-p:leading-[1.85] 
                        prose-p:text-foreground/90 dark:prose-p:text-foreground/90 
                        prose-p:my-3 sm:prose-p:my-4 
                        prose-headings:text-foreground prose-strong:text-foreground 
                        prose-ul:my-4 prose-ul:list-disc prose-ul:ps-6
                        prose-ol:my-4 prose-ol:list-decimal prose-ol:ps-6
                        prose-li:my-1.5 prose-li:text-foreground/90
                        prose-a:text-emerald-600 dark:prose-a:text-emerald-400 hover:prose-a:underline"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                      />
                    </div>
                  </div>
                );
              }

              // =========================================================================
              // TYPE 2: Pure Text / Center Text (e.g. Disclaimer, Policies, Manual, Guide)
              // Clean card container matching disclaimer layout perfectly
              // =========================================================================
              return (
                <div
                  key={item.field_id || idx}
                  className="bg-card border border-border rounded-2xl p-4 sm:p-6 sm:p-8 shadow-xs"
                >
                  {item.header ? (
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 pb-2 border-b border-border/60">
                      {item.header}
                    </h2>
                  ) : null}

                  <div
                    className="prose prose-lg dark:prose-invert max-w-none text-foreground/90 font-normal
                    [&>*:first-child]:mt-0 [&>p:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p:last-child]:mb-0
                    text-justify prose-p:text-justify
                    prose-p:text-[16px] sm:prose-p:text-[17px] lg:prose-p:text-[18px] 
                    prose-p:leading-[1.75] sm:prose-p:leading-[1.8] lg:prose-p:leading-[1.85] 
                    prose-p:text-foreground/90 dark:prose-p:text-foreground/90 
                    prose-p:my-3 sm:prose-p:my-4 
                    prose-headings:text-foreground prose-strong:text-foreground 
                    prose-ul:my-4 prose-ul:list-disc prose-ul:ps-6
                    prose-ol:my-4 prose-ol:list-decimal prose-ol:ps-6
                    prose-li:my-1.5 prose-li:text-foreground/90
                    prose-a:text-emerald-600 dark:prose-a:text-emerald-400 hover:prose-a:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
