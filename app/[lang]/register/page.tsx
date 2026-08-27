import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params.lang || 'en';
  const title = 'Create an Account';
  const fullTitle = 'Create an Account | AgriGuru Online';
  const description = 'Register for an AgriGuru Online account to unlock global agricultural trading, real-time commodity pricing, and trade reports.';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com';
  const pageUrl = `${siteUrl}/${lang}/register`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: `${siteUrl}/logo.png`,
          width: 1200,
          height: 630,
          alt: 'Register on AgriGuru Online',
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${siteUrl}/logo.png`],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/register`,
        ar: `${siteUrl}/ar/register`,
        fr: `${siteUrl}/fr/register`,
        zh: `${siteUrl}/zh/register`,
        'x-default': `${siteUrl}/en/register`,
      }
    }
  };
}

interface RegisterPageProps {
  params: {
    lang: string;
  };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  // We await params if it's a promise, Next 15 requires awaiting it.
  const lang = (await params).lang;

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow lang={lang} />
        </div>
      </div>
    </div>
  );
}
