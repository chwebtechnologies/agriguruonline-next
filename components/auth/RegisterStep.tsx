"use client";

import { useState, useEffect, useTransition } from "react";
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber, type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { toast } from "sonner";
import { createSession } from "@/app/actions/auth";
import SearchablePhoneInput from "@/components/ui/SearchablePhoneInput";
import { getUserApiUrl } from "@/lib/api-utils";

interface RegisterStepProps {
  email: string;
  onComplete: () => void;
  lang: string;
}

export default function RegisterStep({ email, onComplete, lang }: RegisterStepProps) {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country | undefined>("AE" as Country);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Optionally fetch timezone based country code if needed using Intl API
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Default to AE, could map timezone to country if really needed without external API
    } catch (e) {}
  }, []);

  const phoneError = phone.length > 0 && !isValidPhoneNumber(phone);
  const isFormValid = fullName.trim() !== "" && companyName.trim() !== "" && phone && !phoneError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !isValidPhoneNumber(phone)) {
      toast.error("Please enter a valid mobile number.");
      return;
    }
    
    startTransition(async () => {
      try {
        const parsed = parsePhoneNumber(phone);
        const countryCode = parsed ? `+${parsed.countryCallingCode}` : "";
        const nationalNumber = parsed ? parsed.nationalNumber : "";

        const names = fullName.trim().split(" ");
        const firstName = names[0];
        const lastName = names.slice(1).join(" ");

        const payload = {
          company_name: companyName.trim(),
          country_code: countryCode,
          email: email,
          first_name: firstName,
          last_name: lastName,
          mobile_no: nationalNumber,
          source: "WEB"
        };

        const apiUrl = getUserApiUrl();
        const res = await fetch(`${apiUrl}/auth/register?lang_code=${lang}&source=web`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          let errorMessage = "Failed to register. Please try again.";
          try {
            const errorData = await res.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {}
          toast.error(errorMessage);
          return;
        }

        const data = await res.json();
        
        if (data.success === 1 && data.data?.access_token) {
           await createSession(data.data.access_token, data.data.user);
           toast.success("Account created successfully!");
           onComplete();
        } else {
           toast.error(data.message || "Something went wrong.");
        }
      } catch (err) {
        toast.error("An error occurred during registration.");
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto mt-4 p-5 sm:p-6 flex flex-col items-center bg-background border border-foreground/10 rounded-2xl shadow-sm">
      <p className="text-sm text-foreground/70 mb-3 text-center">
        It looks like you don't have an account yet. Let's get you set up.
      </p>
      <div className="w-full flex justify-center mb-8">
        <span className="text-sm font-medium text-foreground bg-foreground/5 border border-foreground/10 py-1.5 px-4 rounded-full">
          {email}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-4">
          <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/50"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-2">
            Company Name
          </label>
          <input
            type="text"
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/50"
            required
          />
        </div>

        <div className="mb-8">
          <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
            Mobile Number
          </label>
          <div className="custom-phone-wrapper">
            <SearchablePhoneInput
              defaultCountry={country}
              value={phone}
              onChange={(val) => setPhone(val || "")}
            />
            {phoneError && (
              <p className="text-red-500 text-sm mt-1.5 font-medium animate-in fade-in slide-in-from-top-1">
                Please enter a valid mobile number for {country || "this country"}.
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!isFormValid || isPending}
          className="w-full flex items-center justify-center py-3 px-4 bg-foreground text-background rounded-lg font-medium transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
        >
          {isPending ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : null}
          Create Account
        </button>
      </form>
    </div>
  );
}
