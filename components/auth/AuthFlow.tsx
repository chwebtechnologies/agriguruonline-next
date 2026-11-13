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
  const [step, setStep] = useState<AuthStep>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("ag_auth_step");
        if (saved === "OTP" || saved === "REGISTER") return saved as AuthStep;
      } catch (e) {}
    }
    return "EMAIL";
  });
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("ag_auth_email") || "";
      } catch (e) {}
    }
    return "";
  });
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

  const handleEmailNext = (submittedEmail: string) => {
    setEmail(submittedEmail);
    try {
      sessionStorage.setItem("ag_auth_step", "OTP");
      sessionStorage.setItem("ag_auth_email", submittedEmail);
    } catch (e) {}
    setStep("OTP");
  };

  const getPostAuthTargetUrl = () => {
    try {
      const stored = getStoredPlanSelection();
      if (stored?.planId) {
        return `/${lang}/become-member`;
      }
    } catch {}
    return redirectUrl || `/${lang}/dashboard`;
  };

  const promptNotificationOnLoginGesture = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const { detectIncognito } = await import("detectincognitojs");
      const res = await detectIncognito();
      if (res?.isPrivate) return;
    } catch (e) {}

    if (Notification.permission === "default") {
      try {
        const permResult = await Notification.requestPermission();
        if (permResult === "granted") {
          try {
            localStorage.setItem("ag_dismiss_notif_data", JSON.stringify({ count: 999, lastDismissed: Date.now() }));
            const { requestForToken } = await import("@/lib/firebase");
            const token = await requestForToken();
            if (token) {
              const { syncFcmTokenAction } = await import("@/app/actions/auth");
              await syncFcmTokenAction(token);
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  };

  const handleOtpVerify = async (otp: string, nextStep: string | null) => {
    if (nextStep === "REQUIRE_REGISTRATION") {
      try {
        sessionStorage.setItem("ag_auth_step", "REGISTER");
      } catch (e) {}
      setStep("REGISTER");
    } else {
      try {
        sessionStorage.removeItem("ag_auth_step");
        sessionStorage.removeItem("ag_auth_email");
      } catch (e) {}
      if (typeof window !== "undefined") {
        try { sessionStorage.setItem("ag_just_logged_in", "1"); } catch (e) {}
        window.dispatchEvent(new Event("auth-state-change"));
      }
      await promptNotificationOnLoginGesture();
      const targetUrl = getPostAuthTargetUrl();
      window.location.href = targetUrl;
    }
  };

  const handleRegisterComplete = async () => {
    try {
      sessionStorage.removeItem("ag_auth_step");
      sessionStorage.removeItem("ag_auth_email");
    } catch (e) {}
    if (typeof window !== "undefined") {
      try { sessionStorage.setItem("ag_just_logged_in", "1"); } catch (e) {}
      window.dispatchEvent(new Event("auth-state-change"));
    }
    await promptNotificationOnLoginGesture();
    const targetUrl = getPostAuthTargetUrl();
    window.location.href = targetUrl;
  };

  const handlePageHeaderBack = () => {
    if (step === "EMAIL") {
      try {
        sessionStorage.removeItem("ag_auth_step");
        sessionStorage.removeItem("ag_auth_email");
      } catch (e) {}
      router.push(`/${lang}`);
    } else if (step === "OTP") {
      try {
        sessionStorage.removeItem("ag_auth_step");
      } catch (e) {}
      setStep("EMAIL");
    }
  };

  const handleSocialSuccess = async (socialEmail: string, nextStep: string | null) => {
    if (socialEmail) {
      setEmail(socialEmail);
      try {
        sessionStorage.setItem("ag_auth_email", socialEmail);
      } catch (e) {}
    }
    if (nextStep === "REQUIRE_REGISTRATION") {
      setIsAppleFlow(false);
      try {
        sessionStorage.setItem("ag_auth_step", "REGISTER");
      } catch (e) {}
      setStep("REGISTER");
    } else if (nextStep === "REQUIRE_EMAIL") {
      setIsAppleFlow(true);
      try {
        sessionStorage.removeItem("ag_auth_step");
      } catch (e) {}
      setStep("EMAIL");
    } else {
      setIsAppleFlow(false);
      try {
        sessionStorage.removeItem("ag_auth_step");
        sessionStorage.removeItem("ag_auth_email");
      } catch (e) {}
      if (typeof window !== "undefined") {
        try { sessionStorage.setItem("ag_just_logged_in", "1"); } catch (e) {}
        window.dispatchEvent(new Event("auth-state-change"));
      }
      await promptNotificationOnLoginGesture();
      const targetUrl = getPostAuthTargetUrl();
      window.location.href = targetUrl;
    }
  };

  const handleCancelAppleFlow = () => {
    setIsAppleFlow(false);
    setEmail("");
    try {
      sessionStorage.removeItem("ag_auth_step");
      sessionStorage.removeItem("ag_auth_email");
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
            onBack={() => {
              try {
                sessionStorage.removeItem("ag_auth_step");
              } catch (e) {}
              setStep("EMAIL");
            }}
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
