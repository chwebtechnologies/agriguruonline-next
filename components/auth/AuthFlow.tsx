"use client";

import { useState, useEffect } from "react";
import EmailStep from "./EmailStep";
import OtpStep from "./OtpStep";
import RegisterStep from "./RegisterStep";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";
import LoginRequiredBanner from "./LoginRequiredBanner";

type AuthStep = "EMAIL" | "OTP" | "REGISTER";

interface AuthFlowProps {
  lang: string;
  redirectUrl?: string;
  dict?: any;
  commonDict?: any;
}

export default function AuthFlow({ lang, redirectUrl, dict, commonDict }: AuthFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("EMAIL");
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Cleanup expired OTPs from localStorage on mount
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("otp_sent_")) {
          const timestampStr = localStorage.getItem(key);
          if (timestampStr) {
            const timestamp = parseInt(timestampStr, 10);
            // If older than 2 minutes
            if (now - timestamp >= 120 * 1000) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // Ignore errors for localStorage
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      // If user presses browser back button, always take them to EMAIL step
      setStep("EMAIL");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleEmailNext = (submittedEmail: string) => {
    setEmail(submittedEmail);
    // Push a state so browser back button works
    window.history.pushState({ step: "OTP" }, "");
    setStep("OTP");
  };

  const handleOtpVerify = (otp: string, nextStep: string | null) => {
    if (nextStep === "REQUIRE_REGISTRATION") {
      // Replace state so going back from REGISTER skips OTP
      window.history.replaceState({ step: "REGISTER" }, "");
      setStep("REGISTER");
    } else {
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.push(`/${lang}/profile`);
      }
    }
  };

  const handleRegisterComplete = () => {
    // Simulate completing registration and logging in
    if (redirectUrl) {
      router.push(redirectUrl);
    } else {
      router.push(`/${lang}/profile`);
    }
  };

  const handlePageHeaderBack = () => {
    if (step === "EMAIL") {
      router.push(`/${lang}`);
    } else if (step === "OTP") {
      // Go back in history which will trigger popstate and set step to EMAIL
      window.history.back();
    }
  };

  const getTitle = () => {
    if (step === "EMAIL") return dict?.sign_in_register || "Sign In / Register";
    if (step === "OTP") return dict?.otp_verification || "OTP Verification";
    return dict?.register || "Register";
  };

  return (
    <>
      <PageHeader 
        title={getTitle()} 
        backText={commonDict?.back || "Back"} 
        hideBack={step === "REGISTER"} 
        onBackClick={handlePageHeaderBack}
      />
      <div className="w-full flex flex-col items-center px-4 sm:px-0">
        <LoginRequiredBanner redirectUrl={redirectUrl} dict={dict} />
        {step === "EMAIL" && (
          <EmailStep onNext={handleEmailNext} lang={lang} dict={dict} />
        )}
      {step === "OTP" && (
        <OtpStep
          email={email}
          onBack={() => window.history.back()}
          onVerify={handleOtpVerify}
          lang={lang}
          dict={dict}
        />
      )}
      {step === "REGISTER" && (
        <RegisterStep
          email={email}
          onComplete={handleRegisterComplete}
          lang={lang}
          dict={dict}
        />
      )}
    </div>
    </>
  );
}
