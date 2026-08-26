"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getCountryCallingCode, parsePhoneNumber, type Country } from "react-phone-number-input";
import { AsYouType } from "libphonenumber-js";
import SearchableCountrySelect from "./SearchableCountrySelect";

export interface SearchablePhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function SearchablePhoneInput({
  value = "",
  onChange,
  defaultCountry = "AE",
  className,
  placeholder,
  disabled = false,
}: SearchablePhoneInputProps) {
  // Determine initial country and national number digits from value
  const initialCountry = useMemo<Country>(() => {
    if (value) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed?.country) {
          return parsed.country as Country;
        }
      } catch (e) {}
    }
    return defaultCountry;
  }, [value, defaultCountry]);

  const [country, setCountry] = useState<Country>(initialCountry);

  // Extract initial national digits
  const getNationalDigitsFromValue = (val: string, c: Country) => {
    if (!val) return "";
    try {
      const parsed = parsePhoneNumber(val);
      if (parsed) {
        return parsed.nationalNumber;
      }
    } catch (e) {}

    // Fallback: remove non-digits and strip country code if present
    const callingCode = getCountryCallingCode(c);
    let clean = val.replace(/\D/g, "");
    if (clean.startsWith(callingCode)) {
      clean = clean.slice(callingCode.length);
    }
    return clean;
  };

  const [nationalDigits, setNationalDigits] = useState(() =>
    getNationalDigitsFromValue(value, initialCountry)
  );

  // Synchronize when value changes externally
  useEffect(() => {
    if (value) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed?.country) {
          setCountry(parsed.country as Country);
          setNationalDigits(parsed.nationalNumber);
          return;
        }
      } catch (e) {}
    }
  }, [value]);

  // Format national number for display
  const formattedDisplay = useMemo(() => {
    if (!nationalDigits) return "";
    const formatter = new AsYouType(country);
    return formatter.input(nationalDigits);
  }, [nationalDigits, country]);

  // Dynamic placeholder for current country
  const dynamicPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    // Generate example national placeholder
    const sample = new AsYouType(country).input("501234567");
    return sample || "Enter mobile number";
  }, [country, placeholder]);

  // Update country from dropdown selection
  const handleCountryChange = (newCountryCode?: string) => {
    if (!newCountryCode) return;
    const newCountry = newCountryCode as Country;
    setCountry(newCountry);

    // Emit updated E.164 phone string if digits exist
    if (nationalDigits) {
      const callingCode = getCountryCallingCode(newCountry);
      const fullValue = `+${callingCode}${nationalDigits}`;
      onChange(fullValue);
    }
  };

  // Handle typing inside phone input box (NUMBERS ONLY)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Strictly extract numeric digits only
    const digitsOnly = rawVal.replace(/\D/g, "");
    setNationalDigits(digitsOnly);

    if (!digitsOnly) {
      onChange("");
      return;
    }

    const callingCode = getCountryCallingCode(country);
    const fullValue = `+${callingCode}${digitsOnly}`;
    onChange(fullValue);
  };

  // Restrict keypresses to numbers, backspace, navigation keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation, delete, tab, enter, copy-paste
    if (
      [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key) ||
      (e.ctrlKey && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) ||
      (e.metaKey && ["a", "c", "v", "x"].includes(e.key.toLowerCase()))
    ) {
      return;
    }

    // Prevent non-numeric characters (like '+', '-', letters, symbols)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div
      className={`flex items-center w-full px-3.5 h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl focus-within:bg-background focus-within:ring-2 focus-within:ring-brand-blue/50 focus-within:border-brand-blue transition-all font-medium ${
        className || ""
      }`}
    >
      {/* Searchable Country Select Dropdown */}
      <SearchableCountrySelect
        value={country}
        onChange={handleCountryChange}
        disabled={disabled}
        showDialCode={true}
      />

      {/* Number Input (Strictly digits, no duplicate country code) */}
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={formattedDisplay}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={dynamicPlaceholder}
        disabled={disabled}
        className="w-full bg-transparent outline-none text-foreground text-sm font-medium placeholder:text-foreground/30 pl-1"
      />
    </div>
  );
}
