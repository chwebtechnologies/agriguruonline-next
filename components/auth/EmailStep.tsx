"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { validateEmailDomain } from "@/app/actions/auth";
import { toast } from "sonner";
import { authService } from "@/lib/api";
import { GoogleOAuthProvider } from "@react-oauth/google";
import GoogleLoginButton from "./GoogleLoginButton";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailStepProps {
  onNext: (email: string) => void;
  onGoogleSuccess?: (email: string, nextStep: string | null) => void;
  lang: string;
  dict?: any;
}

export default function EmailStep({ onNext, onGoogleSuccess, lang, dict }: EmailStepProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isFormatValid = EMAIL_REGEX.test(email.trim());
  const isButtonDisabled = !isFormatValid || isPending;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (error) {
      setError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      toast.error("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      toast.error("Please enter a valid email address.");
      return;
    }

    if (isPending) return;

    startTransition(async () => {
      try {
        const { isValid, error: serverError } = await validateEmailDomain(trimmedEmail);
        
        if (!isValid) {
          const errMsg = serverError || "Invalid email domain.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const lastSentStr = localStorage.getItem(`otp_sent_${trimmedEmail}`);
        if (lastSentStr) {
          const lastSent = parseInt(lastSentStr, 10);
          if (Date.now() - lastSent < 120 * 1000) {
            toast.success("OTP was already sent recently!");
            onNext(trimmedEmail);
            return;
          }
        }
        
        const response = await authService.sendOtp(trimmedEmail, lang);

        if (!response.ok) {
          let errorMessage = "Failed to send OTP. Please try again.";
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {}
          setError(errorMessage);
          toast.error(errorMessage);
          return;
        }
        
        localStorage.setItem(`otp_sent_${trimmedEmail}`, Date.now().toString());
        toast.success("OTP sent successfully!");
        onNext(trimmedEmail);
      } catch (err) {
        const errMsg = "Something went wrong sending OTP.";
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto mt-[5px] p-5 sm:p-6 flex flex-col items-center bg-card border border-foreground/10 rounded-2xl shadow-sm">      
      <form onSubmit={handleSubmit} className="w-full mb-6">
        <div className="mb-4">
          <label htmlFor="email" className={`block text-sm font-medium mb-2 transition-colors ${error ? 'text-red-500' : 'text-foreground'}`}>
            {dict?.email_label || "Email Address"}
          </label>
          <input
            type="email"
            id="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
            value={email}
            disabled={isPending}
            onChange={handleEmailChange}
            onInput={(e: React.FormEvent<HTMLInputElement>) => setEmail((e.target as HTMLInputElement).value)}
            className={`w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-colors ${
              error
                ? "border-red-500 focus:ring-red-500/50"
                : "border-foreground/20 focus:ring-brand-blue/50"
            }`}
            placeholder={dict?.common?.email_example || "your@email.com"}
          />
          {error && (
            <p className="text-red-500 text-sm mt-1.5 font-medium animate-in fade-in slide-in-from-top-1">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isButtonDisabled}
          className={`w-full flex items-center justify-center py-3.5 px-4 rounded-lg font-semibold text-[15px] transition-all shadow-md ${
            isButtonDisabled 
              ? "bg-foreground/10 text-foreground/40 cursor-not-allowed shadow-none" 
              : "bg-brand-blue hover:bg-brand-blue active:bg-[#1466D2] text-white active:scale-[0.98] cursor-pointer"
          }`}
        >
          {isPending ? (
            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
          ) : null}
          {dict?.continue || "Continue"}
        </button>
      </form>

      <div className="flex items-center w-full mb-6">
        <div className="flex-1 h-px bg-foreground/20"></div>
        <span className="px-3 text-sm text-foreground/50">{dict?.or_continue_with || "or continue with"}</span>
        <div className="flex-1 h-px bg-foreground/20"></div>
      </div>

      <div className="w-full space-y-3">
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "1069930285243-ac406a8ddj6ckg8rkmvm8khfpcqq9hpt.apps.googleusercontent.com"}>
          <GoogleLoginButton lang={lang} onSuccess={onGoogleSuccess} />
        </GoogleOAuthProvider>
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
        >
          <i className="fa-brands fa-apple text-lg"></i>
          <span className="font-medium text-foreground">Apple</span>
        </button>
      </div>

      <p className="mt-8 text-xs text-center text-foreground/80">
        {dict?.by_continuing || "By continuing, you accept AgriGuru Online"} {" "}
        <Link href={`/${lang}/terms`} className="font-bold hover:underline text-foreground">
          {dict?.terms_of_service || "Terms of Service"}
        </Link>{" "}
        {dict?.and || "and"} {" "}
        <Link href={`/${lang}/privacy`} className="font-bold hover:underline text-foreground">
          {dict?.privacy_policy || "Privacy Policy"}
        </Link>.
      </p>
    </div>
  );
}
