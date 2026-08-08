"use client";

import { useState, useRef, useEffect } from "react";

interface OtpStepProps {
  email: string;
  onBack: () => void;
  onVerify: (otp: string) => void;
  lang: string;
}

export default function OtpStep({ email, onBack, onVerify, lang }: OtpStepProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      onVerify(newOtp.join(""));
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
      onVerify(otp.join(""));
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
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/50 transition-all"
            />
          ))}
        </div>
        
        <button
          type="submit"
          disabled={!otp.every((digit) => digit !== "")}
          className="w-full py-3 px-4 bg-foreground text-background rounded-lg font-medium transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mb-4"
        >
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
        <button className="text-foreground font-medium hover:underline">
          Resend
        </button>
      </p>
    </div>
  );
}
