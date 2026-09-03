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
  dict?: any;
}

export default function RegisterStep({ email, onComplete, lang, dict }: RegisterStepProps) {
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
    <div className="w-full max-w-md mx-auto mt-[5px] p-5 sm:p-6 flex flex-col items-center bg-card border border-foreground/10 rounded-2xl shadow-sm">
      <p className="text-sm text-foreground/80 mb-3 text-center">
        It looks like you don't have an account yet. Let's get you set up.
      </p>
      <div className="w-full flex justify-center mb-8">
        <span className="text-sm font-medium text-foreground bg-foreground/5 border border-foreground/10 py-1.5 px-4 rounded-full">
          {email}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-5">
          <label htmlFor="fullName" className="block text-[13px] font-bold text-foreground mb-1.5">
            Full Name <span className="text-brand-red">*</span>
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-brand-blue transition-colors">
              <i className="fa-regular fa-user text-[14px]"></i>
            </div>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-background border border-border/80 hover:border-border rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm placeholder:text-muted-foreground/50"
              placeholder="John Doe"
              required
            />
          </div>
        </div>

        <div className="mb-5">
          <label htmlFor="companyName" className="block text-[13px] font-bold text-foreground mb-1.5">
            Company Name <span className="text-brand-red">*</span>
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-brand-blue transition-colors">
              <i className="fa-regular fa-building text-[14px]"></i>
            </div>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-background border border-border/80 hover:border-border rounded-xl text-sm font-medium text-foreground focus:bg-background focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all shadow-sm placeholder:text-muted-foreground/50"
              placeholder="Your Company LLC"
              required
            />
          </div>
        </div>

        <div className="mb-8">
          <label htmlFor="phone" className="block text-[13px] font-bold text-foreground mb-1.5">
            Mobile Number <span className="text-brand-red">*</span>
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
          className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2.5 text-[15px] transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
        >
          {isPending ? <i className="fa-solid fa-circle-notch fa-spin text-[14px]"></i> : <i className="fa-solid fa-user-plus text-[14px] group-hover:scale-110 transition-transform"></i>}
          {isPending ? 'Creating...' : 'Create Account'}
          {/* Shine effect */}
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-button-shine" />
        </button>
      </form>
    </div>
  );
}
