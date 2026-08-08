"use client";

import { useState } from "react";
import EmailStep from "./EmailStep";
import OtpStep from "./OtpStep";
import RegisterStep from "./RegisterStep";
import { useRouter } from "next/navigation";

type AuthStep = "EMAIL" | "OTP" | "REGISTER";

interface AuthFlowProps {
  lang: string;
}

export default function AuthFlow({ lang }: AuthFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("EMAIL");
  const [email, setEmail] = useState("");

  const handleEmailNext = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setStep("OTP");
  };

  const handleOtpVerify = (otp: string) => {
    // Here you would typically verify the OTP via your API
    console.log("Verifying OTP:", otp, "for email:", email);
    
    // For demonstration, let's pretend if the email contains "new", they go to register
    // Otherwise they are considered "logged in" and we redirect to profile/home
    if (email.includes("new")) {
      setStep("REGISTER");
    } else {
      // Simulate successful login
      router.push(`/${lang}/profile`); // Or wherever you want them to go
    }
  };

  const handleRegisterComplete = () => {
    // Simulate completing registration and logging in
    router.push(`/${lang}/profile`);
  };

  return (
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
  );
}
