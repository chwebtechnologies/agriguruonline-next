import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Register | Agriguru Online",
  description: "Create a new account",
};

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
          <PageHeader title="Sign In / Register" backText="Back" />
          <AuthFlow lang={lang} />
        </div>
      </div>
    </div>
  );
}
