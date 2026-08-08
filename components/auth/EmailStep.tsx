"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { validateEmailDomain } from "@/app/actions/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailStepProps {
  onNext: (email: string) => void;
  lang: string;
}

export default function EmailStep({ onNext, lang }: EmailStepProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isFormatValid = EMAIL_REGEX.test(email.trim());
  const isButtonDisabled = !isFormatValid || isPending;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);

    if (val.trim() === "") {
      setError("");
    } else if (!EMAIL_REGEX.test(val.trim())) {
      setError("Please enter a valid email address.");
    } else {
      setError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Email address is required.");
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    startTransition(async () => {
      try {
        const { isValid, error: serverError } = await validateEmailDomain(trimmedEmail);
        
        if (!isValid) {
          setError(serverError || "Invalid email.");
          return;
        }
        
        onNext(trimmedEmail);
      } catch (err) {
        setError("Something went wrong verifying the email.");
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto mt-4 p-5 sm:p-6 flex flex-col items-center bg-background border border-foreground/10 rounded-2xl shadow-sm">      
      <form onSubmit={handleSubmit} className="w-full mb-6">
        <div className="mb-4">
          <label htmlFor="email" className={`block text-sm font-medium mb-2 transition-colors ${error ? 'text-red-500' : 'text-foreground'}`}>
            Email Address
          </label>
          <input
            type="text"
            id="email"
            value={email}
            disabled={isPending}
            onChange={handleEmailChange}
            className={`w-full px-4 py-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-colors disabled:opacity-70 ${
              error
                ? "border-red-500 focus:ring-red-500/50"
                : "border-foreground/20 focus:ring-foreground/50"
            }`}
            placeholder="your@email.com"
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
          className="w-full flex items-center justify-center py-3 px-4 bg-foreground text-background rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isPending ? (
            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
          ) : null}
          Continue
        </button>
      </form>

      <div className="flex items-center w-full mb-6">
        <div className="flex-1 h-px bg-foreground/20"></div>
        <span className="px-3 text-sm text-foreground/50">or continue with</span>
        <div className="flex-1 h-px bg-foreground/20"></div>
      </div>

      <div className="w-full space-y-3">
        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors">
          <i className="fa-brands fa-google text-lg"></i>
          <span className="font-medium text-foreground">Google</span>
        </button>
        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors">
          <i className="fa-brands fa-apple text-lg"></i>
          <span className="font-medium text-foreground">Apple</span>
        </button>
      </div>

      <p className="mt-8 text-xs text-center text-foreground/70">
        By continuing, you accept AgriGuru Online{" "}
        <Link href={`/${lang}/terms`} className="font-bold hover:underline text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href={`/${lang}/privacy`} className="font-bold hover:underline text-foreground">
          Privacy Policy
        </Link>.
      </p>
    </div>
  );
}
