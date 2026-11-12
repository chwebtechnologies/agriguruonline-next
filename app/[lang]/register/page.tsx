import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { getStandardMetadata, getSafeLanguage } from "@/lib/seo";
import { getValidAuthToken } from "@/lib/auth-token";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: "register",
    pathname: "register",
    lang,
    noIndex: true,
  });
}

interface RegisterPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function RegisterPage(props: RegisterPageProps) {
  const [{ lang }, cookieStore, validToken] = await Promise.all([
    props.params,
    cookies(),
    getValidAuthToken(),
  ]);

  if (validToken) {
    const hasStoredPlan = cookieStore.get("selected-plan")?.value;
    if (hasStoredPlan) {
      redirect(`/${lang}/become-member`);
    } else {
      redirect(`/${lang}/dashboard`);
    }
  }

  const dict = await getDictionary(lang);

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow lang={lang} dict={dict.auth} commonDict={dict.common} />
        </div>
      </div>
    </div>
  );
}
