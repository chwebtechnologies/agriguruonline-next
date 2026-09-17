"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { createSession } from "@/app/actions/auth";
import { authService } from "@/lib/api";

interface OtpStepProps {
  email: string;
  onBack: () => void;
  onVerify: (otp: string, nextStep: string | null) => void;
  lang: string;
  dict?: any;
}

export default function OtpStep({ email, onBack, onVerify, lang, dict }: OtpStepProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(120);
  const [error, setError] = useState("");

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
    setError("");
    setOtp(["", "", "", "", "", ""]);
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
    startTransition(async () => {
      try {
        const response = await authService.sendOtp(email, lang);

        if (!response.ok) {
          let errorMessage = "Failed to resend OTP. Please try again.";
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {}
          setError(errorMessage);
          toast.error(errorMessage);
          return;
        }

        localStorage.setItem(`otp_sent_${email}`, Date.now().toString());
        setCountdown(120);
        toast.success("OTP resent successfully!");
      } catch (err) {
        const errMsg = "Something went wrong resending the OTP.";
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  const isExpired = error.toLowerCase().includes("expired");

  const handleVerify = (otpString: string) => {
    setError("");
    startTransition(async () => {
      try {
        const response = await authService.verifyOtp(email, otpString, lang);

        if (!response.ok) {
          let errorMessage = "Failed to verify OTP. Please try again.";
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {}
          setError(errorMessage);
          if (errorMessage.toLowerCase().includes("expired")) {
            setCountdown(0);
            localStorage.removeItem(`otp_sent_${email}`);
          }
          toast.error(errorMessage);
          return;
        }

        let nextStep = null;
        try {
          const successData = await response.json();
          nextStep = successData?.data?.next_step || null;

          if (nextStep === "LOGGED_IN" && successData.data?.access_token) {
            await createSession(
              successData.data.access_token, 
              successData.data.user
            );
          }
        } catch (e) {
          const errMsg = "Failed to setup session. Please try again.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        toast.success("OTP verified successfully!");
        onVerify(otpString, nextStep);
      } catch (err) {
        const errMsg = "Something went wrong verifying the OTP.";
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const pastedNumbers = pastedData.replace(/\D/g, "").slice(0, 6);
    
    if (pastedNumbers) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedNumbers.length; i++) {
        newOtp[i] = pastedNumbers[i];
      }
      setOtp(newOtp);
      
      const nextIndex = Math.min(pastedNumbers.length, 5);
      inputRefs.current[nextIndex]?.focus();
      
      if (pastedNumbers.length === 6) {
        handleVerify(pastedNumbers);
      }
    }
  };

  const handleChange = (index: number, value: string) => {
    if (error) setError("");
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
    if (error) setError("");
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Move to previous input on backspace if empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.every((digit) => digit !== "") && !isExpired) {
      handleVerify(otp.join(""));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-[5px] p-5 sm:p-6 flex flex-col items-center bg-card border border-foreground/10 rounded-2xl shadow-sm">
      <p className="text-sm text-foreground/80 mb-2 text-center">
        We sent a verification code to
      </p>
      <p className="text-sm font-medium text-foreground mb-8 text-center">
        {email}
      </p>

      <form onSubmit={handleSubmit} className="w-full">
        <div 
          className={`flex justify-between gap-2 ${error ? "mb-2" : "mb-8"} ${(countdown === 0 || isExpired) ? "cursor-not-allowed" : ""}`}
          title={(countdown === 0 || isExpired) ? "Time expired. Please resend OTP to continue." : undefined}
        >
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              disabled={isPending || countdown === 0 || isExpired}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={`w-12 h-14 text-center text-xl font-bold rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                error
                  ? "border-red-500 focus:ring-red-500/50 text-red-500"
                  : "border-foreground/20 focus:ring-foreground/50"
              } ${(countdown === 0 || isExpired) ? "pointer-events-none" : ""}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-6 text-center font-medium animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 bg-transparent border border-foreground/20 text-foreground rounded-lg font-medium hover:bg-foreground/5 transition-colors"
          >
            Back
          </button>

          <button
            type="submit"
            disabled={!otp.every((digit) => digit !== "") || isPending || isExpired}
            className="flex-1 flex items-center justify-center py-3 px-4 bg-foreground text-background rounded-lg font-medium transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <i className="fa-solid fa-spinner fa-spin mr-2"></i>
            ) : null}
            Verify
          </button>
        </div>
      </form>
      
      <p className="mt-8 text-sm text-foreground/80 text-center flex items-center justify-center flex-wrap gap-1.5">
        Didn&apos;t receive the code?{" "}
        {countdown > 0 && !isExpired ? (
          <span className="text-foreground/50 font-medium">
            Resend in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </span>
        ) : (
          <button 
            onClick={handleResend}
            disabled={isPending}
            className={
              (countdown === 0 || isExpired)
                ? "text-brand-blue font-bold hover:underline transition-colors animate-pulse"
                : "text-foreground font-medium hover:underline disabled:opacity-50"
            }
            type="button"
          >
            {isPending ? "Sending..." : "Resend"}
          </button>
        )}
      </p>

      <p className="mt-2 text-xs text-foreground/50 text-center">
        If you didn&apos;t receive the email, please check your spam or junk folder.
      </p>
    </div>
  );
}
