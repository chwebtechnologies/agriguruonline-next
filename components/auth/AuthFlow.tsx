"use client";

import { useState, useEffect } from "react";
import EmailStep from "./EmailStep";
import OtpStep from "./OtpStep";
import RegisterStep from "./RegisterStep";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";

type AuthStep = "EMAIL" | "OTP" | "REGISTER";

interface AuthFlowProps {
  lang: string;
}

export default function AuthFlow({ lang }: AuthFlowProps) {
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

  const handleEmailNext = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setStep("OTP");
  };

  const handleOtpVerify = (otp: string, nextStep: string | null) => {
    if (nextStep === "REQUIRE_REGISTRATION") {
      setStep("REGISTER");
    } else {
      window.location.replace(`/${lang}/profile`);
    }
  };

  const handleRegisterComplete = () => {
    // Simulate completing registration and logging in
    window.location.replace(`/${lang}/profile`);
  };

  const getTitle = () => {
    if (step === "EMAIL") return "Sign In / Register";
    if (step === "OTP") return "OTP Verification";
    return "Register";
  };

  return (
    <>
      <PageHeader title={getTitle()} backText="Back" hideBack={step === "REGISTER"} />
      <div className="w-full flex justify-center px-4 sm:px-0">
      {step === "EMAIL" && (
        <EmailStep onNext={handleEmailNext} lang={lang} />
      )}
      {step === "OTP" && (
        <OtpStep
          email={email}
          onBack={() => setStep("EMAIL")}
          onVerify={handleOtpVerify}
          lang={lang}
        />
      )}
      {step === "REGISTER" && (
        <RegisterStep
          email={email}
          onComplete={handleRegisterComplete}
          lang={lang}
        />
      )}
    </div>
    </>
  );
}
