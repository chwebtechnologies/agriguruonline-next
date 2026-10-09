"use client";

import { useState, useEffect } from "react";
import EmailStep from "./EmailStep";
import OtpStep from "./OtpStep";
import RegisterStep from "./RegisterStep";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";
import LoginRequiredBanner from "./LoginRequiredBanner";
import { getStoredPlanSelection } from "@/lib/membership-storage";

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
  const [isAppleFlow, setIsAppleFlow] = useState(false);

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
            if (now - timestamp >= 120 * 1000) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // Check if resuming an Apple flow or clean up stale state
      const txnId = localStorage.getItem("apple_txn_id");
      if (txnId) {
        setIsAppleFlow(true);
        const savedAppleEmail = localStorage.getItem("apple_email");
        if (savedAppleEmail) {
          setEmail(savedAppleEmail);
        }
      }
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

  const getPostAuthTargetUrl = () => {
    try {
      const stored = getStoredPlanSelection();
      if (stored?.planId) {
        return `/${lang}/become-member`;
      }
    } catch {}
    return redirectUrl || `/${lang}/profile`;
  };

  const handleOtpVerify = (otp: string, nextStep: string | null) => {
    if (nextStep === "REQUIRE_REGISTRATION") {
      // Replace state so going back from REGISTER skips OTP
      window.history.replaceState({ step: "REGISTER" }, "");
      setStep("REGISTER");
    } else {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-state-change"));
      }
      const targetUrl = getPostAuthTargetUrl();
      window.location.href = targetUrl;
    }
  };

  const handleRegisterComplete = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-state-change"));
    }
    const targetUrl = getPostAuthTargetUrl();
    window.location.href = targetUrl;
  };

  const handlePageHeaderBack = () => {
    if (step === "EMAIL") {
      router.push(`/${lang}`);
    } else if (step === "OTP") {
      window.history.back();
    }
  };

  const handleSocialSuccess = (socialEmail: string, nextStep: string | null) => {
    if (socialEmail) {
      setEmail(socialEmail);
    }
    if (nextStep === "REQUIRE_REGISTRATION") {
      setIsAppleFlow(false);
      window.history.replaceState({ step: "REGISTER" }, "");
      setStep("REGISTER");
    } else if (nextStep === "REQUIRE_EMAIL") {
      setIsAppleFlow(true);
      setStep("EMAIL");
    } else {
      setIsAppleFlow(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-state-change"));
      }
      const targetUrl = getPostAuthTargetUrl();
      window.location.href = targetUrl;
    }
  };

  const handleCancelAppleFlow = () => {
    setIsAppleFlow(false);
    setEmail("");
    try {
      localStorage.removeItem("apple_txn_id");
      localStorage.removeItem("apple_email");
      localStorage.removeItem("apple_first_name");
      localStorage.removeItem("apple_last_name");
    } catch (e) {}
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
          <EmailStep
            initialEmail={email}
            isAppleFlow={isAppleFlow}
            onCancelAppleFlow={handleCancelAppleFlow}
            onNext={handleEmailNext}
            onGoogleSuccess={handleSocialSuccess}
            onAppleSuccess={handleSocialSuccess}
            lang={lang}
            dict={dict}
          />
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
