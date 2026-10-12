import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { cmsService } from '@/lib/api/cms.service';
import { getAlternates, getSafeLanguage, getSiteUrl } from '@/lib/seo';
import ImageWithSkeleton, { resolveImageUrl } from '@/components/ui/ImageWithSkeleton';
import type { CmsContentItem } from '@/types/cms';

export const revalidate = 3600;

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }];
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  const data = await cmsService.getContentBySlug('founder-profile', lang);

  const title = data?.title || 'Founder Profile';
  const description =
    data?.meta_description || 'Meet the founders of AgriGuru Online.';
  const keywords = data?.meta_keywords || 'founder profile, agriguru online';
  const alternates = getAlternates('founder-profile', lang);

  const firstImage = data?.page_description?.[0]?.image_url;
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

export default async function FounderProfilePage(props: {
  params: Promise<{ lang: string }>;
}) {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  const [content, dict] = await Promise.all([
    cmsService.getContentBySlug('founder-profile', lang),
    getDictionary(lang).catch(() => ({})),
  ]);

  if (!content || content.is_active === false) {
    notFound();
  }

  const commonDict = (dict as Record<string, any>).common || {};
  const footerDict = (dict as Record<string, any>).footer || {};
  const backText = commonDict.back || 'Back';
  const pageTitle = content.title || footerDict.founder_profile || 'Founder Profile';

  const sortedSections = [...(content.page_description || [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText={backText} />

          {/* Dynamic Founder Profile Sections */}
          <div className="mt-1 sm:mt-2 space-y-4 sm:space-y-6">
            {sortedSections.map((item: CmsContentItem, idx: number) => {
              const rawHtml = item.text_content || '';
              const cleanedHtml = rawHtml
                .replace(/<p>\s*(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/gi, '')
                .trim();
              const sanitizedHtml = DOMPurify.sanitize(cleanedHtml);

              return (
                <div
                  key={item.field_id || idx}
                  className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs lg:bg-transparent lg:border-0 lg:shadow-none lg:p-0 lg:rounded-none lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start"
                >
                  {/* Left: Image (Integrated on mobile, separate Card on desktop) */}
                  {item.image_url ? (
                    <div className="w-full lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs">
                      <div className="relative w-full aspect-[600/400] rounded-xl overflow-hidden border border-border bg-muted/30">
                        <ImageWithSkeleton
                          src={item.image_url}
                          alt={`${pageTitle} - ${idx + 1}`}
                          title={pageTitle}
                          width={600}
                          height={400}
                          priority={idx === 0}
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Right: Content (Integrated on mobile, separate Card on desktop) */}
                  <div
                    className={`mt-4 sm:mt-5 lg:mt-0 lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs ${
                      !item.image_url ? 'lg:col-span-2' : ''
                    }`}
                  >
                    <div
                      className="prose prose-lg dark:prose-invert max-w-none text-foreground/90 font-normal
                      [&>*:first-child]:mt-0 [&>p:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p:last-child]:mb-0
                      text-justify prose-p:text-justify
                      prose-p:text-[17px] sm:prose-p:text-[18px] lg:prose-p:text-[19px] 
                      prose-p:leading-[1.75] sm:prose-p:leading-[1.8] lg:prose-p:leading-[1.85] 
                      prose-p:text-foreground/90 dark:prose-p:text-foreground/90 
                      prose-p:my-3 sm:prose-p:my-4 
                      prose-headings:text-foreground prose-strong:text-foreground 
                      prose-a:text-emerald-600 dark:prose-a:text-emerald-400 hover:prose-a:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
