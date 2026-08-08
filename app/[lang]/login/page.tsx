import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Agriguru Online",
  description: "Login to your account",
};

interface LoginPageProps {
  params: {
    lang: string;
  };
}

// Since params in Next 15 must be treated as async in some contexts, we use standard page props
export default async function LoginPage({ params }: LoginPageProps) {
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
