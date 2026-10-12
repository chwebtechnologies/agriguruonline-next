import { redirect } from 'next/navigation';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }];
}

export default async function AboutRedirectPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params?.lang || 'en';
  redirect(`/${lang}/about-us`);
}
