"use client";

import React, { useState, useMemo, useEffect } from "react";
import { getCountryCallingCode, parsePhoneNumber, type Country } from "react-phone-number-input";
import { AsYouType } from "libphonenumber-js";
import SearchableCountrySelect from "./SearchableCountrySelect";
import { getDefaultUserCountry } from "@/lib/country";

export interface SearchablePhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  country?: Country;
  onCountryChange?: (country: Country) => void;
  defaultCountry?: Country;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export default function SearchablePhoneInput({
  value = "",
  onChange,
  country: controlledCountry,
  onCountryChange,
  defaultCountry,
  className,
  placeholder,
  disabled = false,
  onBlur,
  onFocus,
}: SearchablePhoneInputProps) {
  // Determine effective default country (user detected location or prop)
  const resolvedDefaultCountry = useMemo<Country>(() => {
    return defaultCountry || getDefaultUserCountry();
  }, [defaultCountry]);

  // Determine initial country from value or default
  const initialCountry = useMemo<Country>(() => {
    if (controlledCountry) return controlledCountry;
    if (value) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed?.country) {
          return parsed.country as Country;
        }
      } catch {}
    }
    return resolvedDefaultCountry;
  }, [value, controlledCountry, resolvedDefaultCountry]);

  const [country, setCountry] = useState<Country>(initialCountry);

  // Sync controlled country prop if provided
  useEffect(() => {
    if (controlledCountry && controlledCountry !== country) {
      setCountry(controlledCountry);
    }
  }, [controlledCountry, country]);

  // Extract initial national digits
  const getNationalDigitsFromValue = (val: string, c: Country) => {
    if (!val) return "";
    try {
      const parsed = parsePhoneNumber(val);
      if (parsed) {
        return parsed.nationalNumber;
      }
    } catch {}

    // Fallback: remove non-digits and strip country code if present
    try {
      const callingCode = getCountryCallingCode(c);
      let clean = val.replace(/\D/g, "");
      if (clean.startsWith(callingCode)) {
        clean = clean.slice(callingCode.length);
      }
      return clean;
    } catch {
      return val.replace(/\D/g, "");
    }
  };

  const [nationalDigits, setNationalDigits] = useState(() =>
    getNationalDigitsFromValue(value, initialCountry)
  );

  const [prevValue, setPrevValue] = useState(value);

  // Sync when parent value prop changes
  if (value !== prevValue) {
    setPrevValue(value);
    if (!value) {
      setNationalDigits("");
    } else {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed?.country) {
          if (parsed.country !== country) {
            setCountry(parsed.country as Country);
            onCountryChange?.(parsed.country as Country);
          }
          setNationalDigits(parsed.nationalNumber);
        }
      } catch {}
    }
  }

  // Format national number for display
  const formattedDisplay = useMemo(() => {
    if (!nationalDigits) return "";
    try {
      const formatter = new AsYouType(country);
      return formatter.input(nationalDigits);
    } catch {
      return nationalDigits;
    }
  }, [nationalDigits, country]);

  // Dynamic placeholder for current country
  const dynamicPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    try {
      const sample = new AsYouType(country).input("501234567");
      return sample || "Enter mobile number";
    } catch {
      return "Enter mobile number";
    }
  }, [country, placeholder]);

  // Update country from dropdown selection
  const handleCountryChange = (newCountryCode?: string) => {
    if (!newCountryCode) return;
    const newCountry = newCountryCode as Country;
    setCountry(newCountry);
    onCountryChange?.(newCountry);

    // Emit updated E.164 phone string if digits exist
    if (nationalDigits) {
      try {
        const callingCode = getCountryCallingCode(newCountry);
        const fullValue = `+${callingCode}${nationalDigits}`;
        onChange(fullValue);
      } catch {}
    }
  };

  // Handle typing or pasting inside phone input box
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;

    // Check if user pasted an international number starting with '+'
    if (rawVal.trim().startsWith("+")) {
      try {
        const parsed = parsePhoneNumber(rawVal.trim());
        if (parsed?.country) {
          const newCountry = parsed.country as Country;
          setCountry(newCountry);
          onCountryChange?.(newCountry);
          setNationalDigits(parsed.nationalNumber);
          onChange(parsed.number);
          return;
        }
      } catch {}
    }

    // Extract numeric digits only
    let digitsOnly = rawVal.replace(/\D/g, "");

    try {
      const callingCode = getCountryCallingCode(country);
      // If user pasted or typed national number with calling code already attached
      if (digitsOnly.startsWith(callingCode) && digitsOnly.length > callingCode.length + 5) {
        digitsOnly = digitsOnly.slice(callingCode.length);
      }
      // If user typed domestic leading 0 (e.g. 09876543210 in India)
      if (digitsOnly.startsWith("0") && digitsOnly.length > 10) {
        digitsOnly = digitsOnly.replace(/^0+/, "");
      }

      setNationalDigits(digitsOnly);

      if (!digitsOnly) {
        onChange("");
        return;
      }

      const fullValue = `+${callingCode}${digitsOnly}`;
      onChange(fullValue);
    } catch {
      setNationalDigits(digitsOnly);
      onChange(digitsOnly);
    }
  };

  // Restrict keypresses to numbers, backspace, navigation keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    // Prevent non-numeric characters (allow numbers and '+' for pasting)
    if (!/^[0-9+]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div
      className={`flex items-center w-full px-3.5 h-12 bg-background border border-border/80 hover:border-border rounded-xl shadow-sm focus-within:bg-background focus-within:ring-2 focus-within:ring-brand-blue/20 focus-within:border-brand-blue transition-all font-medium ${
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

      {/* Number Input (No HTML pattern validation to avoid browser popups with formatted spaces) */}
      <input
        type="tel"
        aria-label="Phone number"
        inputMode="numeric"
        value={formattedDisplay}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={dynamicPlaceholder}
        disabled={disabled}
        className="w-full bg-transparent outline-none text-foreground text-sm font-medium placeholder:text-foreground/30 pl-1"
      />
    </div>
  );
}
