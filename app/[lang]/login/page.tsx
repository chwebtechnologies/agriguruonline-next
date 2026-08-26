import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params.lang || 'en';
  const title = 'Login to Your Account';
  const fullTitle = 'Login to Your Account | AgriGuru Online';
  const description = 'Log in to AgriGuru Online to access your agricultural commodity trading dashboard, price charts, and market reports.';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com';
  const pageUrl = `${siteUrl}/${lang}/login`;

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
          alt: 'AgriGuru Online Login',
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
        en: `${siteUrl}/en/login`,
        ar: `${siteUrl}/ar/login`,
        fr: `${siteUrl}/fr/login`,
        zh: `${siteUrl}/zh/login`,
        'x-default': `${siteUrl}/en/login`,
      }
    }
  };
}



interface LoginPageProps {
  params: {
    lang: string;
  };
}

// Since params in Next 15 must be treated as async in some contexts, we use standard page props
export default async function LoginPage({ params }: LoginPageProps) {
  // We await params if it's a promise, Next 15 requires awaiting it.
  const lang = (await params).lang;

  // Check if the user is already logged in
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    // If they have a token, redirect them to the profile page
    redirect(`/${lang}/profile`);
  }

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
