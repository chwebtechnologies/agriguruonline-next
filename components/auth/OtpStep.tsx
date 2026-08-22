"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { createSession } from "@/app/actions/auth";

interface OtpStepProps {
  email: string;
  onBack: () => void;
  onVerify: (otp: string, nextStep: string | null) => void;
  lang: string;
}

export default function OtpStep({ email, onBack, onVerify, lang }: OtpStepProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    const lastSentStr = localStorage.getItem(`otp_sent_${email}`);
    let initialCountdown = 120;
    if (lastSentStr) {
      const lastSent = parseInt(lastSentStr, 10);
      const passedSeconds = Math.floor((Date.now() - lastSent) / 1000);
      if (passedSeconds < 120) {
        initialCountdown = 120 - passedSeconds;
      } else {
        initialCountdown = 0;
      }
    }
    setCountdown(initialCountdown);
  }, [email]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResend = () => {
    startTransition(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_USER_API_URL ;
        const response = await fetch(`${apiUrl}/auth/send-otp?lang_code=${lang}&source=web`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          let errorMessage = "Failed to resend OTP. Please try again.";
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {}
          toast.error(errorMessage);
          return;
        }

        localStorage.setItem(`otp_sent_${email}`, Date.now().toString());
        setCountdown(120);
        toast.success("OTP resent successfully!");
      } catch (err) {
        toast.error("Something went wrong resending the OTP.");
      }
    });
  };

  const handleVerify = (otpString: string) => {
    startTransition(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_USER_API_URL ;
        const response = await fetch(`${apiUrl}/auth/verify-otp?lang_code=${lang}&source=web`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, otp: otpString, source: "WEB" }),
        });

        if (!response.ok) {
          let errorMessage = "Failed to verify OTP. Please try again.";
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {}
          toast.error(errorMessage);
          return;
        }

        let nextStep = null;
        try {
          const successData = await response.json();
          console.log("OTP verify successData:", successData); // DEBUG
          nextStep = successData?.data?.next_step || null;

          if (nextStep === "LOGGED_IN" && successData.data?.access_token) {
            console.log("Attempting to create session..."); // DEBUG
            await createSession(successData.data.access_token, successData.data.user);
            console.log("Session created successfully."); // DEBUG
          }
        } catch (e) {
          console.error("Failed to setup session or parse response:", e); // DEBUG
          toast.error("Failed to setup session. Please try again.");
          return;
        }

        toast.success("OTP verified successfully!");
        onVerify(otpString, nextStep);
      } catch (err) {
        console.error("Something went wrong verifying the OTP:", err); // DEBUG
        toast.error("Something went wrong verifying the OTP.");
      }
    });
  };

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    // Take only the last character if they pasted multiple or typed multiple
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Move to next input if filled
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger verify if all filled
    if (value && index === 5 && newOtp.every((digit) => digit !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Move to previous input on backspace if empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.every((digit) => digit !== "")) {
      handleVerify(otp.join(""));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-4 p-5 sm:p-6 flex flex-col items-center bg-background border border-foreground/10 rounded-2xl shadow-sm">
      <p className="text-sm text-foreground/70 mb-2 text-center">
        We sent a verification code to
      </p>
      <p className="text-sm font-medium text-foreground mb-8 text-center">
        {email}
      </p>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex justify-between gap-2 mb-8">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isPending}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/50 transition-all disabled:opacity-50"
            />
          ))}
        </div>
        
        <button
          type="submit"
          disabled={!otp.every((digit) => digit !== "") || isPending}
          className="w-full flex items-center justify-center py-3 px-4 bg-foreground text-background rounded-lg font-medium transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed mb-4"
        >
          {isPending ? (
            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
          ) : null}
          Verify
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 px-4 bg-transparent border border-foreground/20 text-foreground rounded-lg font-medium hover:bg-foreground/5 transition-colors"
        >
          Back
        </button>
      </form>
      
      <p className="mt-8 text-sm text-foreground/70">
        Didn't receive the code?{" "}
        {countdown > 0 ? (
          <span className="text-foreground/50 font-medium">
            Resend in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </span>
        ) : (
          <button 
            onClick={handleResend}
            disabled={isPending}
            className="text-foreground font-medium hover:underline disabled:opacity-50"
            type="button"
          >
            {isPending ? "Sending..." : "Resend"}
          </button>
        )}
      </p>
    </div>
  );
}
